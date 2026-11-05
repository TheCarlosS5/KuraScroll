export interface SessionIdentity {
  userId: string;
  handle: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
  displayName?: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  handle: string;
  displayName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export class AuthApiClient {
  async getSession(): Promise<SessionIdentity | null> {
    try {
      const res = await fetch('/api/v1/auth/session', {
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin',
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.identity || null;
    } catch {
      return null;
    }
  }

  async login(input: LoginInput): Promise<{ identity: SessionIdentity }> {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al iniciar sesión');
    }
    return await res.json();
  }

  async register(input: RegisterInput): Promise<{ identity: SessionIdentity }> {
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al registrarse');
    }
    return await res.json();
  }

  async logout(): Promise<void> {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => {});
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const res = await fetch('/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return await res.json();
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
    const res = await fetch('/api/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al restablecer la contraseña');
    }
    return await res.json();
  }

  async verifyEmail(token: string): Promise<{ verified: boolean }> {
    const res = await fetch(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`);
    if (!res.ok) {
      throw new Error('Token de verificación inválido o expirado');
    }
    return await res.json();
  }
}

export const authApiClient = new AuthApiClient();
