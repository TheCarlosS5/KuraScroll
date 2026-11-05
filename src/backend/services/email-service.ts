import net from 'node:net';
import tls from 'node:tls';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailConfig {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
  secure?: boolean;
}

export class EmailService {
  private config: EmailConfig;

  constructor(config?: EmailConfig) {
    this.config = {
      host: config?.host ?? process.env.SMTP_HOST,
      port: config?.port ?? (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined),
      user: config?.user ?? process.env.SMTP_USER,
      pass: config?.pass ?? process.env.SMTP_PASS,
      from: config?.from ?? process.env.SMTP_FROM ?? 'noreply@kurascroll.local',
      secure: config?.secure ?? (process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465'),
    };
  }

  public isConfigured(): boolean {
    return Boolean(this.config.host && this.config.host !== 'console');
  }

  public async sendMail(options: EmailOptions): Promise<void> {
    if (!this.isConfigured()) {
      // Development console fallback
      console.log('='.repeat(64));
      console.log('[KuraScroll Email Service - Console Transport]');
      console.log(`To: ${options.to}`);
      console.log(`From: ${this.config.from}`);
      console.log(`Subject: ${options.subject}`);
      console.log('-'.repeat(64));
      console.log(options.text);
      if (options.html) {
        console.log('-'.repeat(64));
        console.log('[HTML Content]:', options.html);
      }
      console.log('='.repeat(64));
      return;
    }

    // Production SMTP delivery via node:net / node:tls
    await this.sendSmtp(options);
  }

  public async sendVerificationEmail(to: string, handle: string, verifyUrl: string): Promise<void> {
    const subject = 'Verifica tu cuenta en KuraScroll';
    const text = [
      `¡Hola, ${handle}!`,
      '',
      'Gracias por registrarte en KuraScroll.',
      'Para verificar tu correo y habilitar la subida de capítulos y comentarios en la comunidad, visita:',
      verifyUrl,
      '',
      'Este enlace es válido por 24 horas.',
      'Si no has creado esta cuenta, puedes ignorar este mensaje.',
    ].join('\n');

    await this.sendMail({ to, subject, text });
  }

  public async sendPasswordResetEmail(to: string, handle: string, resetUrl: string): Promise<void> {
    const subject = 'Restablece tu contraseña de KuraScroll';
    const text = [
      `¡Hola, ${handle}!`,
      '',
      'Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.',
      'Para definir una nueva contraseña, visita:',
      resetUrl,
      '',
      'Este enlace es válido durante 1 hora.',
      'Si no has solicitado este cambio, puedes ignorar este mensaje; tu contraseña actual no se modificará.',
    ].join('\n');

    await this.sendMail({ to, subject, text });
  }

  private sendSmtp(options: EmailOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const host = this.config.host!;
      const port = this.config.port ?? (this.config.secure ? 465 : 587);
      const isDirectTls = this.config.secure || port === 465;

      let socket: net.Socket;
      let buffer = '';
      let timer: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (socket && !socket.destroyed) socket.destroy();
      };

      const fail = (err: Error) => {
        cleanup();
        reject(err);
      };

      try {
        if (isDirectTls) {
          socket = tls.connect({ host, port, minVersion: 'TLSv1.2' });
        } else {
          socket = net.createConnection({ host, port });
        }
      } catch (err) {
        return reject(err);
      }

      timer = setTimeout(() => {
        fail(new Error(`SMTP connection timed out after 15s to ${host}:${port}`));
      }, 15000);

      socket.setEncoding('utf-8');

      const readReply = (): Promise<{ code: number; lines: string[] }> => {
        return new Promise((resolveReply, rejectReply) => {
          const onData = (data: string) => {
            buffer += data;
            const lines = buffer.split('\r\n');
            // If the last entry is empty, it means we had a trailing \r\n
            if (lines.length > 1 && lines[lines.length - 1] === '') {
              const completeLines = lines.slice(0, -1);
              const lastLine = completeLines[completeLines.length - 1];
              // SMTP complete response regex: e.g. "250 OK" (not "250-OK")
              const match = /^(\d{3})\s(.*)$/.exec(lastLine);
              if (match) {
                socket.off('data', onData);
                socket.off('error', onError);
                buffer = '';
                resolveReply({ code: Number(match[1]), lines: completeLines });
              }
            }
          };

          const onError = (err: Error) => {
            socket.off('data', onData);
            socket.off('error', onError);
            rejectReply(err);
          };

          socket.on('data', onData);
          socket.on('error', onError);
        });
      };

      const sendCommand = async (cmd: string, expectedCodePrefix: number | string): Promise<string[]> => {
        socket.write(`${cmd}\r\n`);
        const reply = await readReply();
        const prefixStr = String(expectedCodePrefix);
        if (!String(reply.code).startsWith(prefixStr)) {
          throw new Error(`SMTP command "${cmd.slice(0, 15)}..." failed: got code ${reply.code} (${reply.lines.join(' | ')})`);
        }
        return reply.lines;
      };

      (async () => {
        try {
          // 1. Initial greeting
          const greeting = await readReply();
          if (greeting.code !== 220) {
            throw new Error(`Invalid SMTP greeting code: ${greeting.code}`);
          }

          // 2. EHLO
          await sendCommand('EHLO localhost', 250);

          // 3. STARTTLS if plain socket and advertised
          if (!isDirectTls && (port === 587 || port === 25)) {
            try {
              await sendCommand('STARTTLS', 220);
              socket = await new Promise<tls.TLSSocket>((resolveUpgrade, rejectUpgrade) => {
                const tlsSocket = tls.connect({
                  socket,
                  host,
                  minVersion: 'TLSv1.2',
                }, () => resolveUpgrade(tlsSocket));
                tlsSocket.on('error', rejectUpgrade);
              });
              socket.setEncoding('utf-8');
              // Re-negotiate EHLO after TLS upgrade
              await sendCommand('EHLO localhost', 250);
            } catch (tlsErr) {
              // If server doesn't support STARTTLS, proceed if allowed or fail
            }
          }

          // 4. Authentication (if user & pass provided)
          if (this.config.user && this.config.pass) {
            await sendCommand('AUTH LOGIN', 334);
            await sendCommand(Buffer.from(this.config.user).toString('base64'), 334);
            await sendCommand(Buffer.from(this.config.pass).toString('base64'), 235);
          }

          // 5. MAIL FROM
          const fromAddr = this.config.from!;
          const fromMatch = /<([^>]+)>/.exec(fromAddr);
          const cleanFrom = fromMatch ? fromMatch[1] : fromAddr;
          await sendCommand(`MAIL FROM:<${cleanFrom}>`, 250);

          // 6. RCPT TO
          const toMatch = /<([^>]+)>/.exec(options.to);
          const cleanTo = toMatch ? toMatch[1] : options.to;
          await sendCommand(`RCPT TO:<${cleanTo}>`, 250);

          // 7. DATA
          await sendCommand('DATA', 354);

          // Build raw RFC2822 payload
          const dateStr = new Date().toUTCString();
          const boundary = `====_KuraScroll_${Date.now()}_====`;
          const rawHeaders = [
            `From: ${fromAddr}`,
            `To: ${options.to}`,
            `Subject: =?UTF-8?B?${Buffer.from(options.subject).toString('base64')}?=`,
            `Date: ${dateStr}`,
            `MIME-Version: 1.0`,
            options.html
              ? `Content-Type: multipart/alternative; boundary="${boundary}"`
              : `Content-Type: text/plain; charset=UTF-8`,
            `Content-Transfer-Encoding: 8bit`,
            '',
          ];

          let body = '';
          if (options.html) {
            body = [
              `--${boundary}`,
              `Content-Type: text/plain; charset=UTF-8`,
              `Content-Transfer-Encoding: 8bit`,
              '',
              options.text,
              '',
              `--${boundary}`,
              `Content-Type: text/html; charset=UTF-8`,
              `Content-Transfer-Encoding: 8bit`,
              '',
              options.html,
              '',
              `--${boundary}--`,
            ].join('\r\n');
          } else {
            body = options.text;
          }

          const rawData = rawHeaders.join('\r\n') + body + '\r\n.';
          await sendCommand(rawData, 250);

          // 8. QUIT
          try {
            await sendCommand('QUIT', 221);
          } catch {
            // Ignore quit error if message was already accepted
          }

          cleanup();
          resolve();
        } catch (err: any) {
          fail(err);
        }
      })();
    });
  }
}
