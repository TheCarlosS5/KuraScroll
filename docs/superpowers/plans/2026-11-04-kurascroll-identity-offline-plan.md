# KuraScroll: cuentas, seguridad y entrada invitada — plan de implementación

> For agentic workers: REQUIRED SUB-SKILL: apply the subagent-driven workflow through agy's internal invoke_subagent tools; do not use Codex-native subagents. Keep this checklist current and review each agent diff.

## Goal

Añadir cuentas públicas seguras, datos personales por cuenta y una entrada invitada con Omitir que funciona online y offline.

## Architecture

Fastify resuelve la cuenta desde una cookie opaca guardada en SQLite y aplica una matriz de permisos antes de llegar a las rutas. React ofrece registro/login o invitado; el progreso invitado permanece separado en IndexedDB y el service worker almacena únicamente contenido público.

## Tech Stack

Fastify 5, TypeScript, SQLite, React 19, Vite, IndexedDB, SMTP configurable y APIs nativas de Node para secretos aleatorios y hash de contraseña.

## Spec

docs/superpowers/specs/2026-11-04-kurascroll-public-web-design.md

## Global Constraints

- Mantener el host predeterminado del backend en 127.0.0.1 y publicar detrás de proxy HTTPS.
- No enviar un API_TOKEN al JavaScript del navegador.
- No usar un userId recibido en query/body como identidad del usuario.
- Progreso y rachas personales son privados; el invitado guarda progreso en IndexedDB.
- El botón Omitir aparece siempre que no haya una sesión válida, con conexión y sin ella.
- El service worker solo guarda respuestas públicas; las respuestas de usuario llevan Cache-Control: no-store.
- Crear el primer administrador mediante comando local, nunca por orden de registro.
- No ejecutar git reset, clean, checkout ni revert sobre los cambios locales existentes.
- Preservar los cambios locales existentes en Navbar, ResolutionTierHUD, OtakuStatsModal, OtakuStatsRadar, useCloudlessSync y Navbar.test.tsx.

## Review Focus

- Cookie ausente, vencida o revocada: las rutas privadas no devuelven datos de otra cuenta y la entrada ofrece Omitir.
- Solicitud con userId manipulado: el servidor usa la cuenta de la sesión o rechaza la petición.
- Navegador sin red con shell previamente guardado: Omitir abre el modo invitado y el catálogo/capítulos disponibles en caché.
- Dos cuentas en el mismo origen: el cierre de sesión elimina datos personales temporales sin borrar el progreso invitado local.
- Ruta API no inventariada, ruta administrativa o petición de escritura desde origen no permitido: se deniega antes de ejecutar el handler.

---

## Mapa de archivos

- Crear migraciones versionadas en src/backend/db/migrations y el registro/aplicador en src/backend/db/database.ts.
- Crear modelos/repositorios/servicios de sesión bajo src/backend/repositories y src/backend/services.
- Crear src/backend/plugins/authentication.ts y src/backend/routes/auth-routes.ts.
- Actualizar src/backend/app.ts para resolver identidad y aplicar permisos; actualizar rutas personalizadas existentes.
- Crear scripts/create-admin.ts y un comando npm dedicado.
- Crear componentes de autenticación bajo frontend/src/components/auth y estado compartido bajo frontend/src/services.
- Actualizar frontend/src/App.tsx, frontend/src/components/common/Navbar.tsx, frontend/src/services/local-storage-service.ts y frontend/src/hooks/useReadingProgress.ts.
- Actualizar frontend/src/service-worker.ts para no guardar datos de cuenta y retirar el caché API previo.
- Actualizar .env.example y crear docs/security/route-access-matrix.md.

## Contratos compartidos

- SessionIdentity: userId string, handle string, role user|admin, emailVerified boolean.
- authenticateRequest(request): Promise<SessionIdentity | null>.
- requireUser(request, reply): SessionIdentity o respuesta 401.
- requireRole('admin'): preHandler que permite administradores y responde 403 para otros usuarios.
- AuthService: register, login, logout, verifyEmail, requestPasswordReset, resetPassword y currentSession.
- RegisterInput contiene email, password y handle; LoginInput contiene email y password; AuthResult contiene SessionIdentity y expiresAt.
- La API web deriva todos los IDs personales del estado de autenticación del request.

~~~
export interface SessionIdentity {
  userId: string;
  handle: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
}

export interface RegisterInput { email: string; password: string; handle: string }
export interface LoginInput { email: string; password: string }
export interface AuthResult { identity: SessionIdentity; expiresAt: string }
~~~
- El modo invitado no inventa ni envía un userId al backend.

### Tarea 1: inventariar y cerrar la política de rutas

**Archivos:**

- Crear docs/security/route-access-matrix.md.
- Revisar src/backend/app.ts y los archivos en src/backend/routes.

- [ ] Enumerar cada método/ruta registrado en app.ts y asignar acceso público, usuario o administrador.
- [ ] Marcar como usuario cualquier ruta que lee o escribe progreso, racha, preferencia, marcador, sincronización, perfil o biblioteca personal.
- [ ] Marcar backup, mantenimiento, importación, ingesta local, telemetría administrativa y gestión de cuentas como administrador.
- [ ] Marcar catálogo, perfiles públicos, capítulos publicados, comentarios públicos, salud y login/verificación como públicos.
- [ ] Dejar denegadas las rutas que no estén inventariadas; revisar que todas las rutas de lectura necesarias para el lector estén clasificadas.
- [ ] Registrar los casos de compatibilidad de localhost y API_TOKEN sin publicar el token en el frontend.

**Entregable:** matriz con método, patrón, rol requerido y límite de recurso para cada ruta.

### Tarea 2: añadir migración de cuentas y sesiones

**Archivos:**

- Integración del orquestador en src/backend/db/database.ts.
- Crear src/backend/db/migrations/001_identity.sql.
- Crear src/backend/repositories/auth-repository.ts.

- [ ] Añadir tabla schema_migrations o usar PRAGMA user_version para ejecutar cada migración una sola vez dentro de una transacción.
- [ ] Crear users con id aleatorio, email normalizado único, handle único, password_hash, role, email_verified_at, created_at y disabled_at.
- [ ] Crear auth_sessions con hash del token, user_id, created_at, expires_at y revoked_at.
- [ ] Crear email_action_tokens con hash, user_id, tipo de acción y expiración para verificación y recuperación.
- [ ] No asignar automáticamente filas legadas de local_user a ninguna cuenta.
- [ ] Ejecutar la migración contra una DB existente sin eliminar ni reconstruir tablas actuales.

~~~sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL UNIQUE,
  handle TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  email_verified_at TEXT,
  disabled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
~~~

**Interfaces:**

- AuthRepository recibe DatabaseInstance.
- createUser, findUserByEmail, findUserByHandle, createSession, findSessionByTokenHash, revokeSession y consumeActionToken devuelven filas tipadas o null.

### Tarea 3: crear autenticación y transporte SMTP

**Archivos:**

- Crear src/backend/services/auth-service.ts.
- Crear src/backend/services/email-service.ts.
- Crear src/backend/routes/auth-routes.ts.
- Integración del orquestador en package.json, package-lock.json y .env.example.

- [ ] Implementar hash de contraseña con sal única y comparación de tiempo constante.
- [ ] Generar tokens de sesión y de acción con un CSPRNG; almacenar solo sus hashes.
- [ ] Implementar registro, verificación, login, logout, sesión actual, cambio de contraseña, solicitud y confirmación de restablecimiento.
- [ ] Hacer que registro, login y recuperación respondan sin revelar si un correo existe.
- [ ] Configurar host/puerto/usuario/contraseña/remitente SMTP por variables de entorno; no guardar secretos en DB ni código.
- [ ] En desarrollo, imprimir el enlace de verificación/restablecimiento en consola; en producción exigir SMTP antes de habilitar registro público.
- [ ] Configurar cookie HttpOnly, Secure y SameSite=Lax; proteger escrituras con origen/CSRF y límites de frecuencia.
- [ ] Probar manualmente registro, link de verificación, login, logout y restablecimiento con el transport de desarrollo.

### Tarea 4: conectar identidad y roles a las rutas existentes

**Archivos:**

- Crear src/backend/plugins/authentication.ts.
- Integración del orquestador en src/backend/app.ts.
- Modificar las rutas personales enumeradas en docs/security/route-access-matrix.md.
- Integración del orquestador en src/backend/server.ts solo si hace falta documentar confianza del proxy.

- [ ] Decorar Fastify request con sessionIdentity y resolver la cookie una vez por solicitud.
- [ ] Aplicar la matriz de acceso antes de ejecutar handlers.
- [ ] Cambiar los handlers personales para derivar userId de sessionIdentity y descartar cualquier userId del body/query.
- [ ] Rechazar escrituras de una cuenta deshabilitada o sin correo verificado cuando la política lo requiera.
- [ ] Restringir rutas de backup, mantenimiento, importación y gestión de cuentas a admin.
- [ ] Asegurar que API_TOKEN no convierta una solicitud del navegador en administrador ni permita saltarse la matriz de rutas.
- [ ] Responder 401/403 con mensajes sanitizados y no filtrar datos privados en logs o errores.
- [ ] Mantener una ruta pública solo si aparece explícitamente en la matriz.

~~~typescript
app.get('/api/v1/progress/recent', {
  preHandler: requireUser,
}, async (request) => {
  return progressRepository.listRecent(request.sessionIdentity.userId);
});
~~~

### Tarea 5: adaptar avance, rachas y datos locales

**Archivos:**

- Modificar src/backend/routes/progress-routes.ts y src/backend/routes/analytics-routes.ts.
- Modificar frontend/src/hooks/useReadingProgress.ts.
- Revisar frontend/src/services/offline-sync-manager.ts, frontend/src/services/sync-coordinator.ts y frontend/src/services/local-storage-service.ts.

- [ ] Hacer que progreso/racha y endpoints de resumen usen la identidad autenticada del servidor.
- [ ] Actualizar fetches personales para enviar credenciales de sesión same-origin y dejar de serializar userId.
- [ ] Mantener progreso de invitado en IndexedDB, separado de datos obtenidos con sesión.
- [ ] Añadir acción explícita de importación del progreso invitado después de iniciar sesión; mostrar qué se importará y permitir cancelar.
- [ ] Añadir herramienta local de reclamación de datos legacy para el primer administrador; requerir confirmación y registrar la operación.
- [ ] No mezclar automáticamente local_user con la primera cuenta pública.

### Tarea 6: añadir entrada con Omitir y caché privada segura

**Archivos:**

- Crear frontend/src/components/auth/AuthProvider.tsx y AuthEntryScreen.tsx.
- Integración del orquestador en frontend/src/App.tsx y frontend/src/components/common/Navbar.tsx.
- Modificar frontend/src/service-worker.ts y frontend/src/services/local-storage-service.ts.

- [ ] Al arrancar, consultar la sesión; si es válida, abrir el catálogo; si no, mostrar login, registro y Omitir.
- [ ] Mostrar Omitir sin consultar navigator.onLine; al pulsarlo abrir catálogo como invitado en ambos estados de red.
- [ ] Si offline, conservar el shell ya precargado y mostrar solo catálogo/series/páginas públicas disponibles en caché.
- [ ] Mantener al usuario en la vista de serie/capítulo solicitada antes del login cuando inicie sesión o pulse Omitir.
- [ ] Separar el store local invitado de cualquier estado personal temporal de cuenta.
- [ ] Hacer que las rutas privadas respondan Cache-Control: no-store y que el service worker nunca las guarde en Cache API.
- [ ] Cambiar la versión del caché API y purgar el caché anterior que podía contener respuestas personales.
- [ ] Preservar el texto local ya cambiado en Navbar y evitar reformatear archivos del lector o estadísticas.

~~~tsx
type EntryState = 'checking' | 'authenticated' | 'guest';

if (entryState === 'checking') return <StartupShell />;
if (entryState === 'authenticated') return <CatalogPage />;
return <AuthEntryScreen onSkip={() => setEntryState('guest')} />;
~~~

### Tarea 7: crear primer administrador y guía de despliegue

**Archivos:**

- Crear scripts/create-admin.ts.
- Integración del orquestador en package.json y .env.example.
- Crear docs/deployment/public-web.md.

- [ ] Crear un comando local interactivo que pida correo y contraseña y asigne rol admin sin abrir una ruta pública de promoción.
- [ ] Permitir una operación explícita de reclamación de los datos legacy durante el bootstrap del dueño.
- [ ] Documentar configuración del proxy HTTPS, dominio público, origen CORS exacto, SMTP, cookie segura, cuota y primer administrador.
- [ ] Mantener el backend enlazado a 127.0.0.1 y explicar que el registro público se habilita solo después del bootstrap y SMTP.

### Tarea 8: revisión de identidad y modo invitado

- [ ] Ejecutar npm run build desde la raíz y resolver errores de TypeScript/Vite.
- [ ] Revisar manualmente acceso público/usuario/admin usando la matriz y peticiones con IDs falsificados.
- [ ] Revisar en navegador la entrada con sesión válida, sin sesión, online y offline con shell previamente visitado.
- [ ] Confirmar que no se cachean respuestas de progreso, rachas, preferencias, perfil privado ni sesiones.
- [ ] Revisar git diff y git status; conservar los seis cambios locales previos.
