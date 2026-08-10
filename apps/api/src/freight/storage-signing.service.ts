import { createHash, createHmac } from 'node:crypto';
import { BadGatewayException, Injectable } from '@nestjs/common';
import { parseEnvironment } from '@logicommerce/config';
import { boundedFetch } from '../platform/bounded-http.js';

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function encodePath(value: string): string {
  return value
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

type SignedRequest = { url: string; headers: Record<string, string> };

@Injectable()
export class StorageSigningService {
  private readonly environment = parseEnvironment(process.env);

  presignPut(
    objectKey: string,
    contentType: string,
    sizeBytes: number,
    checksum: string,
    expiresSeconds = 300,
  ) {
    const checksumBase64 = Buffer.from(checksum, 'hex').toString('base64');
    return this.presign(
      'PUT',
      objectKey,
      expiresSeconds,
      {
        'content-type': contentType,
        'content-length': String(sizeBytes),
        'x-amz-checksum-sha256': checksumBase64,
      },
      true,
    );
  }

  presignGet(objectKey: string, expiresSeconds = 300) {
    return this.presign('GET', objectKey, expiresSeconds, {}, true);
  }

  async finalizeUpload(stagingKey: string, finalKey: string): Promise<void> {
    const copy = this.presign(
      'PUT',
      finalKey,
      60,
      { 'x-amz-copy-source': `/${this.environment.S3_BUCKET}/${stagingKey}` },
      false,
    );
    const result = await boundedFetch(
      copy.url,
      { method: 'PUT', headers: copy.headers },
      { timeoutMs: this.environment.PROVIDER_HTTP_TIMEOUT_MS, maxResponseBytes: 65_536 },
    );
    if (!result.response.ok) throw new BadGatewayException('Object storage copy failed');
    await this.deleteObject(stagingKey).catch(() => undefined);
  }

  async objectMetadata(objectKey: string) {
    const signed = this.presign('HEAD', objectKey, 60, { 'x-amz-checksum-mode': 'ENABLED' }, false);
    const result = await boundedFetch(
      signed.url,
      { method: 'HEAD', headers: signed.headers },
      { timeoutMs: this.environment.PROVIDER_HTTP_TIMEOUT_MS, maxResponseBytes: 1_024 },
    );
    if (!result.response.ok) throw new BadGatewayException('Uploaded object was not found');
    return {
      sizeBytes: Number(result.response.headers.get('content-length') ?? '-1'),
      contentType: result.response.headers.get('content-type')?.split(';', 1)[0]?.trim() ?? '',
      checksum: this.decodeChecksum(result.response.headers.get('x-amz-checksum-sha256')),
    };
  }

  private decodeChecksum(value: string | null): string {
    if (!value) return '';
    try {
      const decoded = Buffer.from(value.replace(/^"|"$/gu, ''), 'base64');
      return decoded.length === 32 ? decoded.toString('hex') : '';
    } catch {
      return '';
    }
  }

  async deleteObject(objectKey: string) {
    const signed = this.presign('DELETE', objectKey, 60, {}, false);
    const result = await boundedFetch(
      signed.url,
      { method: 'DELETE', headers: signed.headers },
      { timeoutMs: this.environment.PROVIDER_HTTP_TIMEOUT_MS, maxResponseBytes: 1_024 },
    );
    if (!result.response.ok && result.response.status !== 404) {
      throw new BadGatewayException('Object storage cleanup failed');
    }
  }

  private presign(
    method: 'DELETE' | 'GET' | 'HEAD' | 'PUT',
    objectKey: string,
    expiresSeconds: number,
    headers: Record<string, string>,
    publicEndpoint: boolean,
  ): SignedRequest {
    const endpoint = new URL(
      publicEndpoint
        ? (this.environment.S3_PUBLIC_ENDPOINT ?? this.environment.S3_ENDPOINT)
        : this.environment.S3_ENDPOINT,
    );
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/gu, '');
    const date = amzDate.slice(0, 8);
    const scope = `${date}/${this.environment.S3_REGION}/s3/aws4_request`;
    const path = `/${encodePath(this.environment.S3_BUCKET)}/${encodePath(objectKey)}`;
    const normalizedHeaders = Object.fromEntries(
      Object.entries({ host: endpoint.host, ...headers }).map(([key, value]) => [
        key.toLowerCase(),
        value.trim().replace(/\s+/gu, ' '),
      ]),
    );
    const signedHeaders = Object.keys(normalizedHeaders).sort().join(';');
    const parameters = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.environment.S3_ACCESS_KEY}/${scope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresSeconds),
      'X-Amz-SignedHeaders': signedHeaders,
    });
    parameters.sort();
    const canonicalHeaders = Object.entries(normalizedHeaders)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}:${value}\n`)
      .join('');
    const canonicalRequest = [
      method,
      path,
      parameters.toString(),
      canonicalHeaders,
      signedHeaders,
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    const dateKey = hmac(`AWS4${this.environment.S3_SECRET_KEY}`, date);
    const regionKey = hmac(dateKey, this.environment.S3_REGION);
    const serviceKey = hmac(regionKey, 's3');
    const signingKey = hmac(serviceKey, 'aws4_request');
    parameters.set(
      'X-Amz-Signature',
      createHmac('sha256', signingKey).update(stringToSign).digest('hex'),
    );
    return {
      url: `${endpoint.origin}${path}?${parameters.toString()}`,
      headers,
    };
  }
}
