export interface SafeUser {
  id: string;
  handle: string;
  displayName: string;
  role: 'user' | 'moderator' | 'admin';
  emailVerified: boolean;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
}

export class ClientAuthService {
  private static async request(path: string, options: RequestInit = {}): Promise<any> {
    const headers = new Headers(options.headers || {});
    headers.set('X-Requested-With', 'KuraScrollSPA');
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(path, {
      ...options,
      headers,
      credentials: 'include', // Ensures session cookies are sent and received
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || `Error del servidor (${res.status})`);
    }

    return data;
  }

  static async getMe(): Promise<SafeUser | null> {
    try {
      const data = await this.request('/api/v1/auth/me');
      return data.user || null;
    } catch {
      return null;
    }
  }

  static async login(login: string, password: string): Promise<{ user: SafeUser; requiresVerification: boolean }> {
    const data = await this.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
    return {
      user: data.user,
      requiresVerification: Boolean(data.requiresVerification),
    };
  }

  static async register(params: {
    handle: string;
    email: string;
    password: string;
    displayName?: string;
  }): Promise<{ user: SafeUser; requiresVerification: boolean }> {
    const data = await this.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return {
      user: data.user,
      requiresVerification: Boolean(data.requiresVerification),
    };
  }

  static async logout(): Promise<void> {
    await this.request('/api/v1/auth/logout', { method: 'POST' });
  }

  static async verifyEmail(code: string): Promise<void> {
    await this.request('/api/v1/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  static async resendCode(): Promise<void> {
    await this.request('/api/v1/auth/resend-code', { method: 'POST' });
  }

  static async updateProfile(data: { displayName?: string; bio?: string; avatarUrl?: string }): Promise<SafeUser> {
    const res = await this.request('/api/v1/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.user;
  }

  static async uploadAvatar(file: File): Promise<{ avatarUrl: string; user: SafeUser }> {
    const formData = new FormData();
    formData.append('avatar', file);
    const headers = new Headers();
    headers.set('X-Requested-With', 'KuraScrollSPA');
    const res = await fetch('/api/v1/users/me/avatar', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Error al subir avatar (${res.status})`);
    }
    return data;
  }
}
