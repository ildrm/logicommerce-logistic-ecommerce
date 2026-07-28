const S10_WEIGHTS = [8, 6, 4, 2, 3, 5, 9, 7] as const;

export function s10CheckDigit(serial: string): number {
  if (!/^\d{8}$/u.test(serial)) throw new Error('S10 serial must contain eight digits');
  const sum = serial
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * S10_WEIGHTS[index]!, 0);
  const candidate = 11 - (sum % 11);
  if (candidate === 10) return 0;
  if (candidate === 11) return 5;
  return candidate;
}

export function buildS10Identifier(serviceIndicator: string, serial: string, countryCode: string) {
  const service = serviceIndicator.toUpperCase();
  const country = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/u.test(service)) throw new Error('S10 service indicator must be two letters');
  if (!/^[A-Z]{2}$/u.test(country)) throw new Error('S10 country code must be two letters');
  return `${service}${serial}${s10CheckDigit(serial)}${country}`;
}

export function isValidS10Identifier(identifier: string) {
  const normalized = identifier.toUpperCase();
  if (!/^[A-Z]{2}\d{9}[A-Z]{2}$/u.test(normalized)) return false;
  return Number(normalized[10]) === s10CheckDigit(normalized.slice(2, 10));
}

export function ssccCheckDigit(firstSeventeenDigits: string): number {
  if (!/^\d{17}$/u.test(firstSeventeenDigits)) {
    throw new Error('SSCC body must contain seventeen digits');
  }
  const weighted = firstSeventeenDigits
    .split('')
    .reverse()
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (weighted % 10)) % 10;
}

export function isValidSscc(sscc: string) {
  return /^\d{18}$/u.test(sscc) && Number(sscc[17]) === ssccCheckDigit(sscc.slice(0, 17));
}

export function normalizeUnLocode(code: string) {
  const normalized = code.replaceAll(' ', '').toUpperCase();
  if (!/^[A-Z]{2}[A-Z2-9]{3}$/u.test(normalized)) {
    throw new Error('UN/LOCODE must be an ISO country code plus three location characters');
  }
  return normalized;
}

export function assertCapacity(
  maximumWeight: bigint | null,
  maximumVolume: bigint | null,
  currentWeight: bigint,
  currentVolume: bigint,
  addedWeight: bigint,
  addedVolume: bigint,
) {
  if (maximumWeight !== null && currentWeight + addedWeight > maximumWeight) {
    throw new Error('Consolidation weight capacity exceeded');
  }
  if (maximumVolume !== null && currentVolume + addedVolume > maximumVolume) {
    throw new Error('Consolidation volume capacity exceeded');
  }
}

const CONSOLIDATION_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['CLOSED', 'CANCELLED'],
  CLOSED: ['LOADED', 'OPEN'],
  LOADED: ['DEPARTED', 'CLOSED'],
  DEPARTED: ['ARRIVED', 'EXCEPTION'],
  EXCEPTION: ['DEPARTED', 'ARRIVED', 'CANCELLED'],
  ARRIVED: ['DECONSOLIDATED'],
  DECONSOLIDATED: ['COMPLETED'],
};

const POSTAL_DISPATCH_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  OPEN: ['CLOSED', 'CANCELLED'],
  CLOSED: ['HANDED_OVER', 'OPEN'],
  HANDED_OVER: ['IN_TRANSIT', 'RECEIVED'],
  IN_TRANSIT: ['RECEIVED', 'EXCEPTION'],
  EXCEPTION: ['IN_TRANSIT', 'RECEIVED'],
  RECEIVED: ['VERIFIED'],
};

const CLAIM_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['UNDER_REVIEW', 'INFO_REQUIRED', 'REJECTED'],
  INFO_REQUIRED: ['SUBMITTED', 'CANCELLED'],
  UNDER_REVIEW: ['INFO_REQUIRED', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'],
  APPROVED: ['PAID'],
  PARTIALLY_APPROVED: ['PAID'],
  REJECTED: ['CLOSED'],
  PAID: ['CLOSED'],
};

export function assertTransition(
  workflow: 'CONSOLIDATION' | 'POSTAL_DISPATCH' | 'INSURANCE_CLAIM',
  current: string,
  next: string,
) {
  const transitions =
    workflow === 'CONSOLIDATION'
      ? CONSOLIDATION_TRANSITIONS
      : workflow === 'POSTAL_DISPATCH'
        ? POSTAL_DISPATCH_TRANSITIONS
        : CLAIM_TRANSITIONS;
  if (!transitions[current]?.includes(next)) {
    throw new Error(`Invalid ${workflow.toLowerCase()} transition: ${current} to ${next}`);
  }
}
