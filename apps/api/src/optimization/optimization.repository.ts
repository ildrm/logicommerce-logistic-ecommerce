import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { DatabaseClient, Prisma, TenantContext } from '@logicommerce/database';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.module.js';
import { DeterministicOptimizerService, sha256 } from './deterministic-optimizer.service.js';
import type {
  CreateNetworkModelDto,
  RecordOptimizationOutcomeDto,
  RunOptimizationDto,
} from './optimization.dto.js';

@Injectable()
export class OptimizationRepository {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly optimizer: DeterministicOptimizerService,
  ) {}

  models(context: TenantContext): Promise<unknown> {
    return this.db.networkModel.findMany({
      where: { tenantId: context.tenantId },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  createModel(
    context: TenantContext,
    principal: AuthPrincipal,
    input: CreateNetworkModelDto,
  ): Promise<unknown> {
    const nodeKeys = new Set(input.nodes.map((node) => node.key));
    if (
      nodeKeys.size !== input.nodes.length ||
      input.lanes.some((lane) => !nodeKeys.has(lane.from) || !nodeKeys.has(lane.to))
    )
      throw new ConflictException('Network lanes must reference unique declared nodes');
    return this.db.networkModel.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        key: input.key,
        version: input.version,
        nodes: input.nodes as unknown as Prisma.InputJsonValue,
        lanes: input.lanes as unknown as Prisma.InputJsonValue,
        carriers: input.carriers as Prisma.InputJsonValue,
        createdBy: principal.userId,
      },
    });
  }

  runs(context: TenantContext): Promise<unknown> {
    return this.db.optimizationRun.findMany({
      where: { tenantId: context.tenantId },
      include: { recommendations: { include: { outcome: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async run(
    context: TenantContext,
    principal: AuthPrincipal,
    modelId: string,
    input: RunOptimizationDto,
  ): Promise<unknown> {
    const model = await this.db.networkModel.findFirst({
      where: { id: modelId, tenantId: context.tenantId, status: 'ACTIVE' },
    });
    if (!model) throw new NotFoundException('Resource not found');
    const weights = {
      cost: input.costWeight ?? 1,
      carbon: input.carbonWeight ?? 1,
      sla: input.slaWeight ?? 1,
    };
    const frozenInput = {
      networkModel: {
        id: model.id,
        key: model.key,
        version: model.version,
        nodes: model.nodes,
        lanes: model.lanes,
        carriers: model.carriers,
      },
      demandCapacityCostCarbonSla: input.inputSnapshot,
      constraints: input.constraints,
      weights,
    };
    const inputHash = sha256(frozenInput);
    const existing = await this.db.optimizationRun.findUnique({
      where: {
        tenantId_networkModelId_objectiveVersion_algorithmVersion_inputHash: {
          tenantId: context.tenantId,
          networkModelId: model.id,
          objectiveVersion: input.objectiveVersion,
          algorithmVersion: this.optimizer.algorithmVersion,
          inputHash,
        },
      },
      include: { recommendations: true },
    });
    if (existing) return existing;
    const recommendations = this.optimizer.recommend(
      model.lanes as Array<{
        from: string;
        to: string;
        carrierKey: string;
        capacity: number;
        costMinor: number;
        carbonGrams: number;
        slaHours: number;
      }>,
      weights,
      input.constraints,
    );
    if (recommendations.length === 0)
      throw new ConflictException('No feasible alternatives satisfy the frozen constraints');
    return this.db.optimizationRun.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        networkModelId: model.id,
        objectiveVersion: input.objectiveVersion,
        algorithmVersion: this.optimizer.algorithmVersion,
        inputSnapshot: frozenInput as unknown as Prisma.InputJsonValue,
        constraints: input.constraints as Prisma.InputJsonValue,
        inputHash,
        outputHash: sha256(recommendations),
        createdBy: principal.userId,
        recommendations: {
          create: recommendations.map((recommendation) => ({
            id: randomUUID(),
            tenantId: context.tenantId,
            rank: recommendation.rank,
            plan: recommendation.plan as unknown as Prisma.InputJsonValue,
            score: recommendation.score,
            forecast: recommendation.forecast as Prisma.InputJsonValue,
            explanation: recommendation.explanation as unknown as Prisma.InputJsonValue,
          })),
        },
      },
      include: { recommendations: true },
    });
  }

  async decide(
    context: TenantContext,
    principal: AuthPrincipal,
    recommendationId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string,
  ): Promise<unknown> {
    const recommendation = await this.db.optimizationRecommendation.findFirst({
      where: { id: recommendationId, tenantId: context.tenantId, status: 'PROPOSED' },
    });
    if (!recommendation) throw new NotFoundException('Resource not found');
    return this.db.$transaction(async (tx) => {
      const result = await tx.optimizationRecommendation.update({
        where: { id: recommendation.id },
        data: {
          status: decision,
          approvedBy: decision === 'APPROVED' ? principal.userId : null,
          approvedAt: decision === 'APPROVED' ? new Date() : null,
        },
      });
      await this.audit(
        tx,
        context,
        principal,
        `optimization.${decision.toLowerCase()}`,
        result.id,
        reason,
      );
      return result;
    });
  }

  async execute(
    context: TenantContext,
    principal: AuthPrincipal,
    recommendationId: string,
  ): Promise<unknown> {
    const recommendation = await this.db.optimizationRecommendation.findFirst({
      where: { id: recommendationId, tenantId: context.tenantId, status: 'APPROVED' },
    });
    if (!recommendation) throw new NotFoundException('Resource not found');
    return this.db.$transaction(async (tx) => {
      const result = await tx.optimizationRecommendation.update({
        where: { id: recommendation.id },
        data: { status: 'EXECUTED', executedAt: new Date() },
      });
      await this.audit(
        tx,
        context,
        principal,
        'optimization.executed',
        result.id,
        'Approved rollout executed',
      );
      return result;
    });
  }

  async rollback(
    context: TenantContext,
    principal: AuthPrincipal,
    recommendationId: string,
    reason: string,
  ): Promise<unknown> {
    const recommendation = await this.db.optimizationRecommendation.findFirst({
      where: { id: recommendationId, tenantId: context.tenantId, status: 'EXECUTED' },
    });
    if (!recommendation) throw new NotFoundException('Resource not found');
    return this.db.$transaction(async (tx) => {
      const result = await tx.optimizationRecommendation.update({
        where: { id: recommendation.id },
        data: { status: 'ROLLED_BACK', rolledBackAt: new Date() },
      });
      await this.audit(tx, context, principal, 'optimization.rolled_back', result.id, reason);
      return result;
    });
  }

  async outcome(
    context: TenantContext,
    principal: AuthPrincipal,
    recommendationId: string,
    input: RecordOptimizationOutcomeDto,
  ): Promise<unknown> {
    const recommendation = await this.db.optimizationRecommendation.findFirst({
      where: {
        id: recommendationId,
        tenantId: context.tenantId,
        status: { in: ['EXECUTED', 'ROLLED_BACK'] },
      },
    });
    if (!recommendation) throw new NotFoundException('Resource not found');
    const forecast = recommendation.forecast as Record<string, unknown>;
    const variance = Object.fromEntries(
      Object.entries(input.actual)
        .filter(([key, value]) => typeof value === 'number' && typeof forecast[key] === 'number')
        .map(([key, value]) => [key, (value as number) - (forecast[key] as number)]),
    );
    return this.db.optimizationOutcome.upsert({
      where: { recommendationId },
      create: {
        id: randomUUID(),
        tenantId: context.tenantId,
        recommendationId,
        actual: input.actual as Prisma.InputJsonValue,
        variance: variance as Prisma.InputJsonValue,
        measuredBy: principal.userId,
      },
      update: {
        actual: input.actual as Prisma.InputJsonValue,
        variance: variance as Prisma.InputJsonValue,
        measuredBy: principal.userId,
        measuredAt: new Date(),
      },
    });
  }

  private async audit(
    tx: Prisma.TransactionClient,
    context: TenantContext,
    principal: AuthPrincipal,
    action: string,
    entityId: string,
    reason: string,
  ) {
    await tx.auditEvent.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        actorId: principal.userId,
        actorType: 'USER',
        action,
        entityType: 'OptimizationRecommendation',
        entityId,
        reason,
        requestId: context.correlationId,
        correlationId: context.correlationId,
        authenticationMethod: 'SESSION',
        approvalReference: action === 'optimization.approved' ? entityId : null,
      },
    });
  }
}
