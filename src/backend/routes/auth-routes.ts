import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { AuthService, RegisterInput, LoginInput } from '../services/auth-service.js';

export interface AuthRoutesOptions {
  authService: AuthService;
}

export function registerAuthRoutes(app: FastifyInstance, options: AuthRoutesOptions): void {
  const { authService } = options;

  const setSessionCookie = (reply: FastifyReply, rawToken: string, request: FastifyRequest) => {
    const isSecure = process.env.NODE_ENV === 'production' || request.protocol === 'https';
    reply.setCookie('kura_session', rawToken, {
      path: '/',
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    });
  };

  const clearSessionCookie = (reply: FastifyReply, request: FastifyRequest) => {
    const isSecure = process.env.NODE_ENV === 'production' || request.protocol === 'https';
    reply.clearCookie('kura_session', {
      path: '/',
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
    });
  };

  // POST /api/v1/auth/register
  app.post('/api/v1/auth/register', async (request: FastifyRequest<{ Body: RegisterInput }>, reply: FastifyReply) => {
    const body = request.body || ({} as RegisterInput);
    try {
      const result = await authService.register(body);
      setSessionCookie(reply, result.rawToken, request);
      return reply.status(201).send({ identity: result.identity });
    } catch (err: any) {
      const status = typeof err.statusCode === 'number' ? err.statusCode : 400;
      return reply.status(status).send({ error: err.message || 'Error en el registro' });
    }
  });

  // POST /api/v1/auth/login
  app.post('/api/v1/auth/login', async (request: FastifyRequest<{ Body: LoginInput }>, reply: FastifyReply) => {
    const body = request.body || ({} as LoginInput);
    try {
      const result = await authService.login(body);
      setSessionCookie(reply, result.rawToken, request);
      return reply.status(200).send({ identity: result.identity });
    } catch (err: any) {
      const status = typeof err.statusCode === 'number' ? err.statusCode : 401;
      return reply.status(status).send({ error: err.message || 'Credenciales inválidas' });
    }
  });

  // POST /api/v1/auth/logout
  app.post('/api/v1/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies?.kura_session;
    if (token) {
      try {
        await authService.logout(token);
      } catch (err) {
        request.log.error(err, 'Failed to revoke session in logout');
      }
    }
    clearSessionCookie(reply, request);
    return reply.status(200).send({ success: true });
  });

  // GET /api/v1/auth/session
  app.get('/api/v1/auth/session', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    return reply.status(200).send({ identity: request.sessionIdentity });
  });

  // GET /api/v1/auth/verify-email
  app.get('/api/v1/auth/verify-email', async (request: FastifyRequest<{ Querystring: { token?: string } }>, reply: FastifyReply) => {
    const token = request.query?.token;
    if (!token) {
      return reply.status(400).send({ error: 'Token de verificación requerido' });
    }

    const verified = await authService.verifyEmail(token);
    if (!verified) {
      return reply.status(400).send({ verified: false, error: 'Enlace de verificación inválido o expirado' });
    }

    return reply.status(200).send({ verified: true, message: 'Correo verificado correctamente' });
  });

  // POST /api/v1/auth/forgot-password
  app.post('/api/v1/auth/forgot-password', async (request: FastifyRequest<{ Body: { email?: string } }>, reply: FastifyReply) => {
    const email = request.body?.email;
    if (!email) {
      return reply.status(400).send({ error: 'Correo electrónico requerido' });
    }

    await authService.requestPasswordReset(email);
    return reply.status(200).send({
      success: true,
      message: 'Si el correo está registrado, se ha enviado un enlace para restablecer la contraseña.',
    });
  });

  // POST /api/v1/auth/reset-password
  app.post('/api/v1/auth/reset-password', async (request: FastifyRequest<{ Body: { token?: string; newPassword?: string } }>, reply: FastifyReply) => {
    const { token, newPassword } = request.body || {};
    if (!token || !newPassword) {
      return reply.status(400).send({ error: 'El token y la nueva contraseña son requeridos' });
    }

    try {
      const reset = await authService.resetPassword(token, newPassword);
      if (!reset) {
        return reply.status(400).send({ success: false, error: 'Token inválido o expirado' });
      }
      return reply.status(200).send({
        success: true,
        message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.',
      });
    } catch (err: any) {
      const status = typeof err.statusCode === 'number' ? err.statusCode : 400;
      return reply.status(status).send({ error: err.message || 'Error al restablecer la contraseña' });
    }
  });
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, options) => {
  registerAuthRoutes(app, options);
};
