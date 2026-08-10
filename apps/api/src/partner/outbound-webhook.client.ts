import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { BadGatewayException } from '@nestjs/common';
import { parseEnvironment } from '@logicommerce/config';

export const OUTBOUND_WEBHOOK = Symbol('OUTBOUND_WEBHOOK');

export type OutboundWebhookInput = {
  url: string;
  eventId: string;
  eventType: string;
  timestamp: string;
  signature: string;
  body: string;
};

export interface OutboundWebhookPort {
  validateDestination(value: string): Promise<void>;
  deliver(input: OutboundWebhookInput): Promise<number>;
}

type PinnedDestination = {
  url: URL;
  address: string;
  family: 4 | 6;
};

function parseDestination(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new BadGatewayException('Webhook endpoint must be an HTTPS URL without credentials');
  }
  return url;
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:')
  )
    return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/u)?.[1];
  const ipv4 = mapped ?? (isIP(normalized) === 4 ? normalized : undefined);
  if (!ipv4) return false;
  const octets = ipv4.split('.').map(Number);
  const [a = -1, b = -1, c = -1] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

export class DeterministicOutboundWebhookClient implements OutboundWebhookPort {
  validateDestination(value: string): Promise<void> {
    parseDestination(value);
    return Promise.resolve();
  }

  async deliver(input: OutboundWebhookInput): Promise<number> {
    await this.validateDestination(input.url);
    return 202;
  }
}

export class HttpOutboundWebhookClient implements OutboundWebhookPort {
  private readonly environment = parseEnvironment(process.env);
  private readonly allowedHosts = this.environment.PARTNER_WEBHOOK_ALLOWED_HOSTS.split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  async deliver(input: OutboundWebhookInput): Promise<number> {
    const destination = await this.resolveDestination(input.url);
    return this.postPinned(destination, input);
  }

  async validateDestination(value: string): Promise<void> {
    await this.resolveDestination(value);
  }

  private async resolveDestination(value: string): Promise<PinnedDestination> {
    const url = parseDestination(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/u, '');
    if (this.environment.NODE_ENV === 'production' && !this.hostAllowed(hostname)) {
      throw new BadGatewayException('Webhook endpoint host is not allowlisted');
    }
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch (error) {
      throw new BadGatewayException('Webhook endpoint DNS resolution failed', { cause: error });
    }
    if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new BadGatewayException('Webhook endpoint resolves to a prohibited network');
    }
    const selected = addresses[0];
    if (!selected || (selected.family !== 4 && selected.family !== 6)) {
      throw new BadGatewayException('Webhook endpoint DNS resolution was invalid');
    }
    return { url, address: selected.address, family: selected.family };
  }

  private postPinned(destination: PinnedDestination, input: OutboundWebhookInput): Promise<number> {
    return new Promise((resolve, reject) => {
      const requestBody = Buffer.from(input.body);
      const outbound = request(
        destination.url,
        {
          method: 'POST',
          signal: AbortSignal.timeout(this.environment.PARTNER_WEBHOOK_TIMEOUT_MS),
          lookup: (_hostname, _options, callback) => {
            callback(null, destination.address, destination.family);
          },
          headers: {
            'content-type': 'application/json',
            'content-length': String(requestBody.length),
            'user-agent': 'LogiCommerce-Webhook/1.0',
            'x-logicommerce-event-id': input.eventId,
            'x-logicommerce-event-type': input.eventType,
            'x-logicommerce-timestamp': input.timestamp,
            'x-logicommerce-signature': input.signature,
          },
        },
        (response) => {
          let responseBytes = 0;
          response.on('data', (chunk: Buffer) => {
            responseBytes += chunk.length;
            if (responseBytes > 65_536) {
              response.destroy(new Error('Webhook response exceeded the configured limit'));
            }
          });
          response.on('error', (error) => {
            reject(new BadGatewayException('Webhook delivery failed', { cause: error }));
          });
          response.on('end', () => {
            const status = response.statusCode ?? 502;
            if (status >= 300 && status < 400) {
              reject(new BadGatewayException('Webhook redirects are not allowed'));
              return;
            }
            resolve(status);
          });
        },
      );
      outbound.on('error', (error) => {
        reject(new BadGatewayException('Webhook delivery failed', { cause: error }));
      });
      outbound.end(requestBody);
    });
  }

  private hostAllowed(hostname: string) {
    return this.allowedHosts.some((allowed) =>
      allowed.startsWith('*.')
        ? hostname.endsWith(allowed.slice(1)) && hostname !== allowed.slice(2)
        : hostname === allowed,
    );
  }
}

export function createOutboundWebhookClient(): OutboundWebhookPort {
  const environment = parseEnvironment(process.env);
  return environment.PARTNER_WEBHOOK_ADAPTER === 'http'
    ? new HttpOutboundWebhookClient()
    : new DeterministicOutboundWebhookClient();
}
