import { BadGatewayException } from '@nestjs/common';
import { parseEnvironment, type Environment } from '@logicommerce/config';
import { boundedJson } from '../platform/bounded-http.js';

export const IDENTITY_VERIFICATION = Symbol('IDENTITY_VERIFICATION');

export type IdentityVerificationInput = {
  token: string;
  tenantId: string;
  userId: string;
};

export interface IdentityVerificationPort {
  verify(input: IdentityVerificationInput): Promise<{ approved: boolean; reference: string }>;
}

export class DeterministicIdentityVerificationAdapter implements IdentityVerificationPort {
  verify(input: IdentityVerificationInput) {
    return Promise.resolve({
      approved: !input.token.toLowerCase().startsWith('reject'),
      reference: `local-kyc:${input.token.slice(0, 32)}`,
    });
  }
}

export class HttpIdentityVerificationAdapter implements IdentityVerificationPort {
  private readonly url: URL;

  constructor(private readonly environment: Environment) {
    if (!environment.IDENTITY_VERIFICATION_URL || !environment.IDENTITY_VERIFICATION_TOKEN) {
      throw new Error('The HTTP identity-verification provider is not completely configured');
    }
    this.url = new URL('/v1/verifications/resolve', environment.IDENTITY_VERIFICATION_URL);
  }

  async verify(input: IdentityVerificationInput) {
    const { response, body } = await boundedJson<{ approved?: unknown; reference?: unknown }>(
      this.url,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.environment.IDENTITY_VERIFICATION_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(input),
      },
      {
        timeoutMs: this.environment.PROVIDER_HTTP_TIMEOUT_MS,
        maxResponseBytes: this.environment.PROVIDER_HTTP_MAX_RESPONSE_BYTES,
      },
    );
    if (
      !response.ok ||
      typeof body.approved !== 'boolean' ||
      typeof body.reference !== 'string' ||
      !body.reference
    ) {
      throw new BadGatewayException('Identity-verification provider returned an invalid result');
    }
    return { approved: body.approved, reference: body.reference };
  }
}

export function createIdentityVerificationAdapter(): IdentityVerificationPort {
  const environment = parseEnvironment(process.env);
  return environment.IDENTITY_VERIFICATION_ADAPTER === 'http'
    ? new HttpIdentityVerificationAdapter(environment)
    : new DeterministicIdentityVerificationAdapter();
}
