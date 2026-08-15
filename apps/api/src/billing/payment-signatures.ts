import { createHmac, timingSafeEqual } from 'node:crypto';

function signatureParts(signature: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const part of signature.split(',')) {
    const [key, value] = part.split('=', 2);
    if (key && value) (result[key] ??= []).push(value);
  }
  return result;
}

function safeEqual(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyStripeSignature(
  body: string,
  signature: string,
  secret: string,
  nowSeconds = Date.now() / 1_000,
): boolean {
  const parts = signatureParts(signature);
  const timestamp = Number(parts.t?.[0]);
  if (!timestamp || Math.abs(nowSeconds - timestamp) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return (parts.v1 ?? []).some((candidate) => safeEqual(candidate, expected));
}

export function verifyCoinbaseSignature(
  body: string,
  signature: string,
  headers: Record<string, string>,
  secret: string,
  nowSeconds = Date.now() / 1_000,
): boolean {
  const values = signatureParts(signature);
  const timestamp = Number(values.t?.[0]);
  if (!timestamp || Math.abs(nowSeconds - timestamp) > 300) return false;
  const headerNames = values.h?.[0] ?? '';
  const signedHeaderNames = headerNames.split(' ').filter(Boolean);
  if (signedHeaderNames.length === 0) return false;
  const signedHeaderValues = signedHeaderNames
    .map((name) => headers[name.toLowerCase()] ?? '')
    .join('.');
  const signed = `${timestamp}.${headerNames}.${signedHeaderValues}.${body}`;
  const expected = createHmac('sha256', secret).update(signed).digest('hex');
  return safeEqual(expected, values.v1?.[0]);
}
