import { Injectable, NotFoundException } from '@nestjs/common';

export type IdentityMailPurpose = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'PASSWORDLESS_LOGIN';

@Injectable()
export class IdentityMailAdapter {
  private readonly previews = new Map<string, { purpose: IdentityMailPurpose; token: string }>();

  send(email: string, purpose: IdentityMailPurpose, token: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('A production identity mail adapter must be configured');
    }
    this.previews.set(`${email}:${purpose}`, { purpose, token });
    return Promise.resolve();
  }

  preview(email: string, purpose: IdentityMailPurpose) {
    if (process.env.NODE_ENV === 'production') throw new NotFoundException('Resource not found');
    const preview = this.previews.get(`${email.toLowerCase()}:${purpose}`);
    if (!preview) throw new NotFoundException('Resource not found');
    return preview;
  }
}
