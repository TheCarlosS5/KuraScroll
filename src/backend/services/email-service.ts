import nodemailer from 'nodemailer';
import { getAppConfig } from '../config/app-config.js';

export interface SendVerificationEmailOptions {
  toEmail: string;
  handle: string;
  code: string;
}

export class EmailService {
  async sendVerificationCode(options: SendVerificationEmailOptions): Promise<{ success: boolean; simulated: boolean; error?: string }> {
    const config = getAppConfig();
    const { toEmail, handle, code } = options;

    if (!config.smtp || !config.smtp.host) {
      // Never write one-time codes to logs. A private dev install may opt out of email verification.
      return config.requireEmailVerification
        ? { success: false, simulated: false, error: 'SMTP no está configurado.' }
        : { success: true, simulated: true };
    }

    const { host, port, secure, user, pass, from } = config.smtp;

    const subject = `Tu código de verificación de KuraScroll: ${code}`;
    const textBody = `Hola @${handle},\n\nTu código de verificación para KuraScroll es: ${code}\n\nEste código expira en 15 minutos.\nSi no creaste una cuenta en KuraScroll, puedes ignorar este correo.\n\n— El equipo de KuraScroll`;

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: secure || port === 465,
        requireTLS: !(secure || port === 465),
        connectionTimeout: 8_000,
        greetingTimeout: 8_000,
        socketTimeout: 8_000,
        auth: user && pass ? { user, pass } : undefined,
      });
      await transporter.sendMail({ from, to: toEmail, subject, text: textBody });
      return { success: true, simulated: false };
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code: unknown }).code)
        : 'unknown';
      console.error('[EmailService] SMTP delivery failed:', code);
      return { success: false, simulated: false, error: 'No se pudo enviar el correo de verificación.' };
    }
  }
}
