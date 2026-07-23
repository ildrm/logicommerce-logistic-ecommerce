import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`;
}

export function sha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

@Injectable()
export class DeterministicOptimizerService {
  readonly algorithmVersion = 'weighted-lane-ranking-v1';

  recommend(
    lanes: Array<{
      from: string;
      to: string;
      carrierKey: string;
      capacity: number;
      costMinor: number;
      carbonGrams: number;
      slaHours: number;
    }>,
    weights: { cost: number; carbon: number; sla: number },
    constraints: Record<string, unknown>,
  ) {
    const maximumCost = this.numberConstraint(constraints.maxCostMinor);
    const maximumCarbon = this.numberConstraint(constraints.maxCarbonGrams);
    const maximumSla = this.numberConstraint(constraints.maxSlaHours);
    const minimumCapacity = this.numberConstraint(constraints.minimumCapacity) ?? 0;
    return lanes
      .filter(
        (lane) =>
          lane.capacity >= minimumCapacity &&
          (maximumCost === null || lane.costMinor <= maximumCost) &&
          (maximumCarbon === null || lane.carbonGrams <= maximumCarbon) &&
          (maximumSla === null || lane.slaHours <= maximumSla),
      )
      .map((lane) => ({
        lane,
        score:
          lane.costMinor * weights.cost +
          lane.carbonGrams * weights.carbon +
          lane.slaHours * weights.sla,
      }))
      .sort(
        (left, right) =>
          left.score - right.score ||
          left.lane.costMinor - right.lane.costMinor ||
          left.lane.carrierKey.localeCompare(right.lane.carrierKey) ||
          left.lane.from.localeCompare(right.lane.from) ||
          left.lane.to.localeCompare(right.lane.to),
      )
      .slice(0, 5)
      .map((candidate, index) => ({
        rank: index + 1,
        plan: candidate.lane,
        score: candidate.score,
        forecast: {
          costMinor: candidate.lane.costMinor,
          carbonGrams: candidate.lane.carbonGrams,
          slaHours: candidate.lane.slaHours,
        },
        explanation: {
          algorithmVersion: this.algorithmVersion,
          weightedInputs: weights,
          satisfiedConstraints: constraints,
          claim: 'Deterministic feasible alternative; mathematical optimality is not claimed.',
        },
      }));
  }

  private numberConstraint(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
