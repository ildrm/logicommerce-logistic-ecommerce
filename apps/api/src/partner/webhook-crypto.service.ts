import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { parseEnvironment } from '@logicommerce/config';

@Injectable()
export class WebhookCryptoService {
  private readonly key = createHash('sha256')
    .update(parseEnvironment(process.env).FIELD_ENCRYPTION_KEY)
    .digest();

  encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  decrypt(value: string) {
    const [version, iv, tag, encrypted] = value.split('.');
    if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Invalid webhook secret');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  hash(value: string) {
    return createHmac('sha256', this.key).update(value).digest('hex');
  }

  sign(secret: string, timestamp: string, eventId: string, body: string) {
    return createHmac('sha256', secret).update(`${timestamp}.${eventId}.${body}`).digest('hex');
  }

  verify(secret: string, timestamp: string, eventId: string, body: string, signature: string) {
    const expected = Buffer.from(this.sign(secret, timestamp, eventId, body));
    const candidate = Buffer.from(signature);
    return expected.length === candidate.length && timingSafeEqual(expected, candidate);
  }
}
