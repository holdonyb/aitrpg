import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';

type VerificationDeliveryResult = {
  delivered: boolean;
  debugCode?: string;
};

export class VerificationDeliveryError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'resend_sandbox_restricted'
      | 'resend_sender_unverified'
      | 'delivery_failed',
  ) {
    super(message);
  }
}

@Injectable()
export class MailerService {
  private transporter: Transporter | null = null;
  private resend: Resend | null = null;

  constructor(private readonly configService: ConfigService) {}

  async sendVerificationCode(
    email: string,
    code: string,
  ): Promise<VerificationDeliveryResult> {
    const mode = this.getDeliveryMode();
    if (mode === 'debug') {
      return {
        delivered: false,
        debugCode: code,
      };
    }

    const from =
      this.configService.get<string>('EMAIL_FROM') ?? 'no-reply@example.com';
    const appName =
      this.configService.get<string>('EMAIL_APP_NAME') ?? 'AITRPG';

    const subject = `${appName} 登录验证码`;
    const text = `你的 ${appName} 登录验证码是 ${code}，10 分钟内有效。`;
    const html = `<p>你的 <strong>${appName}</strong> 登录验证码是：</p><p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p><p>10 分钟内有效。</p>`;

    if (mode === 'resend') {
      const { error } = await this.getResend().emails.send({
        from,
        to: [email],
        subject,
        text,
        html,
      });

      if (error) {
        const message = error.message.toLowerCase();
        if (
          message.includes('testing emails') ||
          message.includes('verify a domain')
        ) {
          throw new VerificationDeliveryError(
            'Resend sandbox only allows delivery to the owner email until a domain is verified. Verify a domain and update EMAIL_FROM before using public email login.',
            message.includes('verify a domain')
              ? 'resend_sender_unverified'
              : 'resend_sandbox_restricted',
          );
        }

        throw new VerificationDeliveryError(
          `Resend delivery failed: ${error.message}`,
          'delivery_failed',
        );
      }
    } else {
      await this.getTransporter().sendMail({
        from,
        to: email,
        subject,
        text,
        html,
      });
    }

    return {
      delivered: true,
    };
  }

  private getDeliveryMode() {
    const mode = this.configService.get<string>('EMAIL_DELIVERY_MODE');
    if (mode === 'resend') {
      return 'resend';
    }

    if (mode === 'smtp') {
      return 'smtp';
    }

    if (mode === 'debug') {
      return 'debug';
    }

    if (this.configService.get<string>('RESEND_API_KEY')) {
      return 'resend';
    }

    if (this.configService.get<string>('SMTP_HOST')) {
      return 'smtp';
    }

    return 'debug';
  }

  private getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? '1025');
    const secure = this.configService.get<string>('SMTP_SECURE') === 'true';
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host) {
      throw new Error('SMTP_HOST is required when EMAIL_DELIVERY_MODE=smtp');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth:
        user && pass
          ? {
              user,
              pass,
            }
          : undefined,
    });

    return this.transporter;
  }

  private getResend() {
    if (this.resend) {
      return this.resend;
    }

    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new Error(
        'RESEND_API_KEY is required when EMAIL_DELIVERY_MODE=resend',
      );
    }

    this.resend = new Resend(apiKey);
    return this.resend;
  }
}
