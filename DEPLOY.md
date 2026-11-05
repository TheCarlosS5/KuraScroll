# Guía de Despliegue y Operación — KuraScroll Cloud-Community

Esta guía documenta la arquitectura de ejecución, requisitos de almacenamiento persistente, configuración de seguridad, copias de seguridad y procedimientos operativos para desplegar KuraScroll en un entorno VPS o servidor dedicado.

---

## 1. Arquitectura Operativa y Limitaciones Actuales

> [!IMPORTANT]
> **Modelo de ejecución: Un único contenedor / proceso con volumen persistente.**
> - La base de datos actual utiliza **SQLite vía `node:sqlite` (DatabaseSync)** en modo WAL (`kura-scroll.db`).
> - Los archivos binarios y capítulos optimizados en WebP residen en el sistema de archivos local (`STORAGE_ROOT`).
> - **SQLite no soporta accesos concurrentes de escritura entre múltiples procesos o réplicas de contenedores.**
> - **No se debe desplegar en arquitecturas serverless ni contenedores con almacenamiento efímero.** Toda la carpeta `/app/data` debe estar mapeada a un volumen Docker persistente o a un disco SSD/NVMe/HDD local permanente.

### Hoja de Ruta para Escalabilidad Horizontal (Fase Futura)
Para escalar a múltiples réplicas detrás de un balanceador de carga en fases posteriores:
1. Migrar la capa de persistencia a **PostgreSQL** mediante Kysely o Drizzle.
2. Migrar `storageRoot` a un servicio de almacenamiento de objetos compatible con S3 (MinIO, Cloudflare R2 o AWS S3).
3. Utilizar Redis para gestión de sesiones y colas de transcodificación.

---

## 2. Requisitos Mínimos del Servidor

- **CPU:** 2 núcleos (4 núcleos recomendados para transcodificación con Sharp).
- **RAM:** 2 GB mínimo (4 GB recomendados). Sharp usa un hilo y una caché libvips de 16 MB; se aceptan hasta dos solicitudes de carga simultáneas por instancia y una sola extracción CBZ/ZIP a la vez. Un archivo comprimido puede ocupar hasta 250 MB en memoria y extraer hasta 1 GB temporal a disco, así que estas cuotas reducen picos de recursos pero no sustituyen la supervisión de RAM y espacio libre.
- **Disco:** Al menos 20 GB de almacenamiento persistente (SSD/HDD) según el catálogo de manga esperado.
- **Docker:** Versión 24.0+ con Docker Compose v2.

---

## 3. Despliegue con Docker Compose (Recomendado)

### Paso 1: Clonar y Configurar Entorno
```bash
git clone <url-del-repositorio> kura-scroll
cd kura-scroll
cp .env.example .env
```

Edite `.env` con sus valores de producción:
```ini
# Aceptar el modo web público: los cambios de estado requieren una sesión de usuario.
PUBLIC_PLATFORM_MODE=true
TRUST_PROXY=true

# Generar clave secreta aleatoria de 64 caracteres hex:
# openssl rand -hex 32
SESSION_SECRET=<salida-completa-de-openssl-rand>

# Establezca en 'true' si utiliza un proxy inverso con HTTPS (Caddy / Nginx)
COOKIE_SECURE=true

# Orígenes autorizados para CORS
KURA_CORS_ORIGINS=https://manga.tudominio.com

# Opcional: Configuración de correo SMTP para verificación
REQUIRE_EMAIL_VERIFICATION=true
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@tudominio.com
SMTP_PASS=tu_password_smtp
SMTP_FROM=KuraScroll <no-reply@tudominio.com>
```

Compose detiene el arranque si `SESSION_SECRET` está vacío. En modo público, `API_TOKEN` no se usa: el navegador inicia sesión con cookies y las rutas de escritura requieren una sesión. `COOKIE_SECURE=true` requiere HTTPS en el proxy inverso. El puerto del contenedor solo se publica en `127.0.0.1`; mantén `TRUST_PROXY=true` únicamente detrás de un proxy local de confianza.

### Paso 2: Compilar y Ejecutar Contenedor
```bash
docker compose up -d --build
```

### Paso 3: Verificar Salud
```bash
docker compose ps
curl http://localhost:4000/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "service": "kura-scroll-backend",
  "timestamp": "2026-11-05T..."
}
```

---

## 4. Configuración con Proxy Inverso (HTTPS)

Se recomienda utilizar **Caddy** o **Nginx** frente a KuraScroll para gestionar certificados SSL automáticos Let's Encrypt. El ejemplo de abajo usa `request_body`, disponible desde Caddy v2.10.0; usa esa versión o una posterior.

### Ejemplo de Configuración Caddyfile:
```caddy
manga.tudominio.com {
    reverse_proxy 127.0.0.1:4000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # Límite de carga de capítulos grandes y archivos CBZ/ZIP
    request_body {
        max_size 300MB
    }
}
```

---

## 5. Endpoints y Capacidades Operativas Incorporadas

| Flujo | Endpoint | Descripción |
|-------|----------|-------------|
| **Autenticación** | `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` | Registro con hash scrypt, cookies de sesión `HttpOnly`, `SameSite=Lax`, `Secure` configurable. |
| **Verificación Email** | `POST /api/v1/auth/verify-email`, `POST /api/v1/auth/resend-code` | Códigos de 6 dígitos con hash SHA-256, expiración 15 min, max 5 intentos. SMTP por socket o simulación dev. |
| **Perfiles** | `GET /api/v1/users/:handle`, `PUT /api/v1/users/me` | Consulta de perfil público y lista de mangas publicados; edición de biografía y nombre. |
| **Avatar de Usuario** | `POST /api/v1/users/me/avatar` | Carga multipart `'avatar'`, validación de magic bytes (JPEG/PNG/WebP), optimización Sharp 256x256 WebP en `/storage/avatars/`. |
| **Creación de Manga** | `POST /api/v1/manga`, `PUT /api/v1/manga/:seriesId`, `DELETE /api/v1/manga/:seriesId` | Registro de serie con `slug` único; permisos para creador o moderador/admin; borrado lógico (`removed`). |
| **Portada de Manga** | `POST /api/v1/manga/:seriesId/cover` | Carga multipart `'cover'`, validación de magic bytes, optimización WebP a 800px en `/storage/covers/`. |
| **Capítulos por Páginas** | `POST /api/v1/manga/:seriesId/chapters/:chapterId/pages` | Carga streaming página a página con optimización WebP y control de cuota. |
| **Capítulos por Archivo** | `POST /api/v1/manga/:seriesId/chapters/:chapterId/upload-archive` | Carga `.cbz`/`.zip` hasta 250 MB; extracción protegida contra Zip Slip y zip bombs, ordenamiento natural, límite de 1 GB descomprimido, una extracción concurrente y hasta 2 cargas HTTP simultáneas por instancia (HTTP 429 al excederlo). `AdmZip` mantiene el comprimido en memoria durante la extracción. |
| **Comentarios** | `GET /api/v1/comments`, `POST /api/v1/comments`, `PUT /api/v1/comments/:id`, `DELETE /api/v1/comments/:id` | Hilos separados para manga y capítulos; edición con límite de 2.000 caracteres; borrado por autor o moderador; rate limit estricto; paginación server-side. |
| **Catálogo y Biblioteca** | `GET /api/v1/series` | Paginación server-side con límite y offset, conteo total de series y filtrado integral por tipo, estado, género y término de búsqueda. |
| **Historial de Lectura** | `GET /api/v1/progress/recent`, `POST /api/v1/progress` | Progreso de lectura respaldado en cuenta mediante sesión autenticada y encabezado CSRF, aislando el historial del usuario de los datos locales en IndexedDB de otros perfiles en el mismo navegador. |
| **Moderación / Reportes** | `POST /api/v1/reports`, `GET /api/v1/admin/reports`, `PUT /api/v1/admin/reports/:reportId` | Sistema de denuncias por infracción o copyright y panel de resolución para moderadores. Huéspedes son guiados a autenticarse antes de denunciar. |
| **Previsualización de Borradores** | `GET /api/v1/series/:slug`, `GET /api/v1/chapters/:chapterId` | El creador o moderador/admin puede leer y verificar sus propios mangas/capítulos en borrador antes de publicarlos. |

---

## 5. Procedimientos de Copia de Seguridad y Restauración

### Copia de Seguridad en Caliente (SQLite WAL)
Para realizar una copia de seguridad segura sin detener el servicio:
```bash
# Copia de seguridad atómica de SQLite utilizando la utilidad sqlite3 o script de backup
docker compose exec kura-scroll node -e "
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('/app/data/kura-scroll.db');
  db.exec('VACUUM INTO \"/app/data/backup-$(date +%Y%m%d).db\"');
"

# Copia de seguridad de los archivos de capítulos
docker compose exec kura-scroll tar -czf /app/data/storage-backup-$(date +%Y%m%d).tar.gz /app/data/storage
```

### Restauración
1. Detener el contenedor: `docker compose down`
2. Reemplazar el archivo `/var/lib/docker/volumes/kura_scroll_data/_data/kura-scroll.db`.
3. Extraer el archivo tar de almacenamiento en `/app/data/storage`.
4. Iniciar el contenedor: `docker compose up -d`.

---

## 6. Configuración del Primer Administrador

Cuando se registra el primer usuario en la plataforma, tiene rol `user`. Para ascenderlo a `admin`:
```bash
docker compose exec kura-scroll node -e "
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('/app/data/kura-scroll.db');
  const res = db.prepare(\"UPDATE users SET role = 'admin' WHERE handle = 'tu_usuario'\").run();
  console.log('Filas actualizadas:', res.changes);
"
```

---

## 7. Políticas de Moderación y Derechos de Autor

> [!WARNING]
> KuraScroll proporciona herramientas técnicas para la moderación (reporte de contenidos, suspensión de cuentas, eliminación lógica de mangas y capítulos), pero **no realiza verificación legal automática de derechos de autor**.
> 
> Como operador del servicio, usted es responsable de:
> - Publicar términos de servicio claros y una política de notificación y retirada (DMCA / Aviso legal).
> - Atender las denuncias registradas en la tabla `content_reports`.
> - Requerir verificación por correo electrónico (`REQUIRE_EMAIL_VERIFICATION=true`) para restringir la carga masiva no autorizada.
