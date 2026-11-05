# Guía de Despliegue en Servidor Público (HTTPS & Seguridad)

Esta guía describe cómo desplegar **KuraScroll** de forma segura en un entorno de producción accesible a través de Internet.

---

## 1. Arquitectura de Red y Principios de Seguridad

1. **Backend en Loopback Exclusivo**:
   - El proceso de Node/Fastify **nunca** debe enlazar a `0.0.0.0`.
   - Se ejecuta en `HOST=127.0.0.1` y `PORT=4000` (o el puerto interno asignado).
   - El acceso externo se realiza **únicamente** a través de un reverse proxy HTTPS (Nginx o Caddy).

2. **Aislamiento del `API_TOKEN`**:
   - El `API_TOKEN` es un secreto del canal servidor-proxy; **jamás** se entrega al frontend ni al navegador.
   - El reverse proxy **elimina cualquier cabecera `x-api-token` enviada por el cliente** para evitar suplantaciones o sondeos.
   - A continuación, el reverse proxy inyecta el `API_TOKEN` en la petición enviada al upstream de loopback.
   - El token solo valida que la petición proviene del proxy de confianza; **nunca** concede identidad de usuario ni rol de administrador por sí mismo.

3. **Cookies de Sesión Seguras**:
   - La cookie de autenticación `kura_session` es de tipo `HttpOnly`, con `SameSite=Lax` y `Secure` activado bajo HTTPS.
   - El proxy debe remitir cabeceras `X-Forwarded-Proto https` y `X-Forwarded-For` para que Fastify reconozca la conexión cifrada.

---

## 2. Variables de Entorno de Producción (`.env`)

Crea un archivo `.env` en la raíz del servidor:

```ini
# Red y Servidor
NODE_ENV=production
HOST=127.0.0.1
PORT=4000
DATABASE_PATH=./data/kura-scroll.db
STORAGE_ROOT=./data/storage
INCOMING_DIR=./data/storage/incoming

# Token interno entre Reverse Proxy y Backend (Mínimo 32 caracteres aleatorios)
API_TOKEN=gen_random_secret_at_least_32_characters_long_abcdef123456

# URL Pública y Orígenes Permitidos
APP_BASE_URL=https://manga.tudominio.com
ALLOWED_ORIGINS=https://manga.tudominio.com

# Servicio de Correo Saliente (SMTP)
# En producción es indispensable para el registro y recuperación de contraseñas.
SMTP_HOST=smtp.tudominio.com
SMTP_PORT=587
SMTP_USER=notificaciones@tudominio.com
SMTP_PASS=tu_clave_smtp_segura
SMTP_FROM="KuraScroll <notificaciones@tudominio.com>"
SMTP_SECURE=false

# Para desarrollo/pruebas locales sin servidor SMTP, usar:
# SMTP_HOST=console
```

---

## 3. Configuración de Reverse Proxy

### Opción A: Caddy (Recomendado por TLS automático)

Archivo `/etc/caddy/Caddyfile`:

```caddy
manga.tudominio.com {
    # 1. Eliminar cualquier x-api-token que el cliente intente enviar
    request_header -x-api-token

    # 2. Inyectar el API_TOKEN de confianza al upstream local
    request_header x-api-token "gen_random_secret_at_least_32_characters_long_abcdef123456"

    # 3. Proxy hacia el backend de KuraScroll
    reverse_proxy 127.0.0.1:4000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # Límites de subida para preparación web de capítulos
    request_body {
        max_size 50MB
    }

    # Cabeceras de seguridad
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

### Opción B: Nginx

Archivo `/etc/nginx/sites-available/kurascroll`:

```nginx
server {
    server_name manga.tudominio.com;
    listen 80;
    return 301 https://$host$request_uri;
}

server {
    server_name manga.tudominio.com;
    listen 443 ssl http2;

    ssl_certificate /etc/letsencrypt/live/manga.tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/manga.tudominio.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    location / {
        # 1. Eliminar cualquier cabecera x-api-token enviada por el navegador
        proxy_set_header x-api-token "";

        # 2. Inyectar el token secreto configurado en el servidor
        proxy_set_header x-api-token "gen_random_secret_at_least_32_characters_long_abcdef123456";

        # 3. Transmitir metadatos de conexión al backend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        # Pasar cookies intactas
        proxy_pass_header Set-Cookie;
        proxy_pass http://127.0.0.1:4000;

        proxy_read_timeout 90s;
        proxy_connect_timeout 90s;
    }
}
```

---

## 4. Bootstrap del Primer Administrador

Antes de abrir el registro público o publicar la aplicación, es fundamental crear la cuenta administrativa principal y, si se utilizaba KuraScroll en modo local previo, reclamar el avance de lectura acumulado.

Ejecuta el script interactivo en la terminal del servidor:

```bash
# Modo interactivo
npx tsx scripts/create-admin.ts

# O con argumentos directos:
npx tsx scripts/create-admin.ts \
  --email "admin@tudominio.com" \
  --handle "admin" \
  --password "ContraseñaSegura123!" \
  --claim-legacy
```

El script:
1. Aplica las migraciones de identidad (`001_identity.sql`).
2. Verifica que el correo y el handle estén disponibles.
3. Almacena la contraseña utilizando `scrypt` con sal única de 16 bytes.
4. Asigna rol `admin` y marca el correo como verificado inmediatamente.
5. Reasigna opcionalmente todas las filas legadas (`user_id = 'local_user'`) a la nueva cuenta administrativa de forma atómica.

---

## 5. Verificación de Funcionamiento

1. **Comprobar Health Check**:
   ```bash
   curl -i https://manga.tudominio.com/api/v1/health
   ```
2. **Comprobar Sesión Vacía**:
   ```bash
   curl -i https://manga.tudominio.com/api/v1/auth/session
   ```
   Debe responder `{ "identity": null }` con cabecera `Cache-Control: no-store`.
3. **Intentar Falsificar `x-api-token` desde Cliente**:
   ```bash
   curl -i -H "x-api-token: token_falso" https://manga.tudominio.com/api/v1/auth/session
   ```
   El proxy debe eliminar el token falso y reemplazarlo por el token configurado en el servidor upstream.
4. **Registro de Usuario de Prueba**:
   Asegúrate de que el enlace de verificación recibido por correo dirija correctamente a `https://manga.tudominio.com/api/v1/auth/verify-email?token=...`.
