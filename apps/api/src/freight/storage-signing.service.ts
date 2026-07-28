import { createHash, createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { parseEnvironment } from '@logicommerce/config';

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function encodePath(value: string): string {
  return value
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

@Injectable()
export class StorageSigningService {
  private readonly environment = parseEnvironment(process.env);

  presignPut(objectKey: string, expiresSeconds = 900) {
    return this.presign('PUT', objectKey, expiresSeconds);
  }

  presignGet(objectKey: string, expiresSeconds = 300) {
    return this.presign('GET', objectKey, expiresSeconds);
  }

  private presign(method: 'GET' | 'PUT', objectKey: string, expiresSeconds: number) {
    const endpoint = new URL(this.environment.S3_ENDPOINT);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/gu, '');
    const date = amzDate.slice(0, 8);
    const scope = `${date}/${this.environment.S3_REGION}/s3/aws4_request`;
    const path = `/${encodePath(this.environment.S3_BUCKET)}/${encodePath(objectKey)}`;
    const parameters = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.environment.S3_ACCESS_KEY}/${scope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresSeconds),
      'X-Amz-SignedHeaders': 'host',
    });
    parameters.sort();
    const canonicalRequest = [
      method,
      path,
      parameters.toString(),
      `host:${endpoint.host}\n`,
      'host',
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
    return `${endpoint.origin}${path}?${parameters.toString()}`;
  }
}
