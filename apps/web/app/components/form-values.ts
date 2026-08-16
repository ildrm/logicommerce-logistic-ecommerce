export function scaledDecimalFormValue(
  value: FormDataEntryValue | null,
  decimalPlaces: number,
  label: string,
): number {
  if (typeof value !== 'string' || !Number.isInteger(decimalPlaces) || decimalPlaces < 0) {
    throw new Error(`${label} must be a valid non-negative decimal`);
  }
  const normalized = value.trim();
  if (normalized.startsWith('-')) {
    throw new Error(`${label} must be a valid non-negative decimal`);
  }
  const match = /^(?:0|[1-9]\d*)(?:\.(\d+))?$/u.exec(normalized);
  const fraction = match?.[1] ?? '';
  if (!match || fraction.length > decimalPlaces) {
    throw new Error(`${label} must have at most ${decimalPlaces} decimal places`);
  }
  const scale = 10n ** BigInt(decimalPlaces);
  const whole = BigInt(normalized.split('.')[0]!);
  const fractional = BigInt(fraction.padEnd(decimalPlaces, '0') || '0');
  const result = whole * scale + fractional;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} is too large`);
  }
  return Number(result);
}
