import { BadGatewayException } from '@nestjs/common';

export type BoundedHttpOptions = {
  timeoutMs: number;
  maxResponseBytes: number;
};

async function boundedBody(response: Response, maxResponseBytes: number): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxResponseBytes) {
        await reader.cancel('response limit exceeded');
        throw new BadGatewayException('Upstream response exceeded the configured limit');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    total,
  );
}

export async function boundedFetch(
  url: string | URL,
  init: RequestInit,
  options: BoundedHttpOptions,
): Promise<{ response: Response; body: Buffer }> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    throw new BadGatewayException('Upstream request failed', { cause: error });
  }
  if (response.status >= 300 && response.status < 400) {
    throw new BadGatewayException('Upstream redirects are not allowed');
  }
  return { response, body: await boundedBody(response, options.maxResponseBytes) };
}

export async function boundedJson<T>(
  url: string | URL,
  init: RequestInit,
  options: BoundedHttpOptions,
): Promise<{ response: Response; body: T }> {
  const result = await boundedFetch(url, init, options);
  const contentType = result.response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    throw new BadGatewayException('Upstream response must be JSON');
  }
  try {
    return { response: result.response, body: JSON.parse(result.body.toString('utf8')) as T };
  } catch (error) {
    throw new BadGatewayException('Upstream returned invalid JSON', { cause: error });
  }
}
