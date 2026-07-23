import { Injectable } from '@nestjs/common';

@Injectable()
export class DeterministicIdentityVerificationAdapter {
  verify(token: string) {
    return {
      approved: !token.toLowerCase().startsWith('reject'),
      reference: `local-kyc:${token.slice(0, 32)}`,
    };
  }
}
