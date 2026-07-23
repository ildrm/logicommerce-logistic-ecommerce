import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { DatabaseClient, Prisma, TenantContext } from '@logicommerce/database';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.module.js';
import type {
  CompleteRecoveryExerciseDto,
  CreateSloDto,
  PrivacyRequestDto,
  RecordSloObservationDto,
  RetentionPolicyDto,
  StartRecoveryExerciseDto,
} from './operability.dto.js';

@Injectable()
export class OperabilityRepository {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  slos(context: TenantContext): Promise<unknown> {
    return this.db.serviceLevelObjective.findMany({
      where: { tenantId: context.tenantId },
      include: { observations: { orderBy: { windowEnd: 'desc' }, take: 20 } },
      orderBy: { key: 'asc' },
    });
  }

  createSlo(context: TenantContext, input: CreateSloDto): Promise<unknown> {
    return this.db.serviceLevelObjective.upsert({
      where: { tenantId_key: { tenantId: context.tenantId, key: input.key } },
      create: { id: randomUUID(), tenantId: context.tenantId, ...input },
      update: input,
    });
  }

  async observe(
    context: TenantContext,
    objectiveId: string,
    input: RecordSloObservationDto,
  ): Promise<unknown> {
    const objective = await this.db.serviceLevelObjective.findFirst({
      where: { id: objectiveId, tenantId: context.tenantId, status: 'ACTIVE' },
    });
    if (!objective) throw new NotFoundException('Resource not found');
    const start = new Date(input.windowStart);
    const end = new Date(input.windowEnd);
    if (start >= end) throw new ConflictException('SLO observation window is invalid');
    return this.db.sloObservation.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        objectiveId,
        value: input.value,
        sampleSize: input.sampleSize,
        windowStart: start,
        windowEnd: end,
        status: input.value >= objective.target ? 'MET' : 'BREACHED',
      },
    });
  }

  recoveryExercises(context: TenantContext): Promise<unknown> {
    return this.db.recoveryExercise.findMany({
      where: { tenantId: context.tenantId },
      orderBy: { startedAt: 'desc' },
    });
  }

  startRecovery(
    context: TenantContext,
    principal: AuthPrincipal,
    input: StartRecoveryExerciseDto,
  ): Promise<unknown> {
    return this.db.recoveryExercise.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        ...input,
        status: 'RUNNING',
        startedAt: new Date(),
        executedBy: principal.userId,
      },
    });
  }

  async completeRecovery(
    context: TenantContext,
    exerciseId: string,
    input: CompleteRecoveryExerciseDto,
  ): Promise<unknown> {
    const exercise = await this.db.recoveryExercise.findFirst({
      where: { id: exerciseId, tenantId: context.tenantId, status: 'RUNNING' },
    });
    if (!exercise) throw new NotFoundException('Resource not found');
    return this.db.recoveryExercise.update({
      where: { id: exercise.id },
      data: {
        status:
          input.measuredRpoMinutes <= 15 && input.measuredRtoMinutes <= 60 ? 'PASSED' : 'FAILED',
        completedAt: new Date(),
        measuredRpoMinutes: input.measuredRpoMinutes,
        measuredRtoMinutes: input.measuredRtoMinutes,
        evidence: input.evidence as Prisma.InputJsonValue,
      },
    });
  }

  retentionPolicies(context: TenantContext): Promise<unknown> {
    return this.db.dataRetentionPolicy.findMany({
      where: { tenantId: context.tenantId },
      orderBy: { dataClass: 'asc' },
    });
  }

  setRetention(
    context: TenantContext,
    principal: AuthPrincipal,
    input: RetentionPolicyDto,
  ): Promise<unknown> {
    return this.db.dataRetentionPolicy.upsert({
      where: {
        tenantId_dataClass: { tenantId: context.tenantId, dataClass: input.dataClass },
      },
      create: {
        id: randomUUID(),
        tenantId: context.tenantId,
        dataClass: input.dataClass,
        retentionDays: input.retentionDays,
        legalHold: input.legalHold ?? false,
        action: input.action,
        approvedBy: principal.userId,
      },
      update: {
        retentionDays: input.retentionDays,
        legalHold: input.legalHold ?? false,
        action: input.action,
        approvedBy: principal.userId,
        approvedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }

  privacyRequests(context: TenantContext): Promise<unknown> {
    return this.db.privacyRequest.findMany({
      where: { tenantId: context.tenantId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  createPrivacy(context: TenantContext, input: PrivacyRequestDto): Promise<unknown> {
    return this.db.privacyRequest.create({
      data: {
        id: randomUUID(),
        tenantId: context.tenantId,
        subjectRef: input.subjectRef,
        kind: input.kind,
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
      },
    });
  }

  async completePrivacy(
    context: TenantContext,
    principal: AuthPrincipal,
    requestId: string,
    evidence: Record<string, unknown>,
  ): Promise<unknown> {
    const request = await this.db.privacyRequest.findFirst({
      where: { id: requestId, tenantId: context.tenantId, status: 'RECEIVED' },
    });
    if (!request) throw new NotFoundException('Resource not found');
    return this.db.privacyRequest.update({
      where: { id: request.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        evidence: evidence as Prisma.InputJsonValue,
        handledBy: principal.userId,
      },
    });
  }
}
