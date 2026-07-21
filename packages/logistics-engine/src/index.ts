export type StockState =
  | 'EXPECTED'
  | 'INBOUND'
  | 'ON_HAND'
  | 'RESERVED'
  | 'ALLOCATED'
  | 'QUARANTINED'
  | 'DAMAGED'
  | 'EXPIRED'
  | 'RECALLED';

export type StockLedgerDelta = {
  readonly state: StockState;
  readonly quantity: bigint;
};

export class InventoryInvariantError extends Error {
  readonly code = 'INV_INVARIANT_VIOLATION';
}

export function applyStockDelta(
  current: Readonly<Record<StockState, bigint>>,
  delta: StockLedgerDelta,
  allowNegative = false,
): Record<StockState, bigint> {
  const next = { ...current, [delta.state]: current[delta.state] + delta.quantity };
  if (!allowNegative && next[delta.state] < 0n) {
    throw new InventoryInvariantError(`${delta.state} stock cannot become negative`);
  }
  return next;
}

export type RoutingWeights = {
  readonly promise: number;
  readonly capacity: number;
  readonly cost: number;
  readonly risk: number;
  readonly carbon: number;
};

export type RoutingCandidate = {
  readonly id: string;
  readonly legallyEligible: boolean;
  readonly inventoryAvailable: boolean;
  readonly promiseScore: number;
  readonly capacityScore: number;
  readonly costScore: number;
  readonly riskScore: number;
  readonly carbonScore: number;
};

export type ScoredRoutingCandidate = RoutingCandidate & {
  readonly score: number;
  readonly reasonCodes: readonly string[];
};

export function scoreRoutingCandidates(
  candidates: readonly RoutingCandidate[],
  weights: RoutingWeights,
): readonly ScoredRoutingCandidate[] {
  return candidates
    .filter((candidate) => candidate.legallyEligible && candidate.inventoryAvailable)
    .map((candidate) => ({
      ...candidate,
      score:
        candidate.promiseScore * weights.promise +
        candidate.capacityScore * weights.capacity +
        candidate.costScore * weights.cost +
        candidate.riskScore * weights.risk +
        candidate.carbonScore * weights.carbon,
      reasonCodes: ['LEGAL_ELIGIBLE', 'INVENTORY_AVAILABLE', 'WEIGHTED_POLICY_V1'],
    }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}
