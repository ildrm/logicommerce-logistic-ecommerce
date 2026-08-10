import { Injectable, NotFoundException } from '@nestjs/common';
import { parseEnvironment } from '@logicommerce/config';
import nodemailer, { type Transporter } from 'nodemailer';

export type IdentityMailPurpose = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'PASSWORDLESS_LOGIN';

const subjects: Record<IdentityMailPurpose, string> = {
  EMAIL_VERIFICATION: 'Verify your LogiCommerce email',
  PASSWORD_RESET: 'Reset your LogiCommerce password',
  PASSWORDLESS_LOGIN: 'Your LogiCommerce sign-in link',
};

@Injectable()
export class IdentityMailAdapter {
  private readonly environment = parseEnvironment(process.env);
  private readonly previews = new Map<string, { purpose: IdentityMailPurpose; token: string }>();
  private readonly transporter: Transporter | undefined;

  constructor() {
    if (this.environment.EMAIL_ADAPTER === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: this.environment.SMTP_HOST,
        port: this.environment.SMTP_PORT,
        secure: this.environment.SMTP_SECURE,
        requireTLS: true,
        tls: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: true,
        },
        ...(this.environment.SMTP_USER && this.environment.SMTP_PASSWORD
          ? {
              auth: {
                user: this.environment.SMTP_USER,
                pass: this.environment.SMTP_PASSWORD,
              },
            }
          : {}),
        connectionTimeout: this.environment.PROVIDER_HTTP_TIMEOUT_MS,
        greetingTimeout: this.environment.PROVIDER_HTTP_TIMEOUT_MS,
        socketTimeout: this.environment.PROVIDER_HTTP_TIMEOUT_MS,
      });
    }
  }

  async send(email: string, purpose: IdentityMailPurpose, token: string): Promise<void> {
    if (!this.transporter) {
      if (this.environment.NODE_ENV === 'production') {
        throw new Error('A production identity mail adapter must be configured');
      }
      this.previews.set(`${email.toLowerCase()}:${purpose}`, { purpose, token });
      return;
    }
    const link = new URL('/account', this.environment.PUBLIC_BASE_URL);
    link.searchParams.set('purpose', purpose.toLowerCase());
    link.searchParams.set('token', token);
    await this.transporter.sendMail({
      from: this.environment.SMTP_FROM,
      to: email,
      subject: subjects[purpose],
      text: `Open this single-use link to continue: ${link.toString()}\n\nIf you did not request this message, ignore it.`,
    });
  }

  preview(email: string, purpose: IdentityMailPurpose) {
    if (this.environment.NODE_ENV === 'production')
      throw new NotFoundException('Resource not found');
    const preview = this.previews.get(`${email.toLowerCase()}:${purpose}`);
    if (!preview) throw new NotFoundException('Resource not found');
    return preview;
  }
}
