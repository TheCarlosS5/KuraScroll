# KuraScroll: perfiles, comentarios y reportes — plan de implementación

> For agentic workers: REQUIRED SUB-SKILL: apply the subagent-driven workflow through agy's internal invoke_subagent tools; do not use Codex-native subagents. This plan depends on the identity contract.

## Goal

Añadir perfiles públicos y una conversación por serie antes de que el lector abra un capítulo, con marca de spoilers y reportes.

## Architecture

Los datos públicos se consultan sin cuenta; las escrituras requieren cookie de sesión verificada. El backend deriva autor de sessionIdentity, limita frecuencia y mantiene una cola de moderación administrada por rol.

## Tech Stack

Fastify, SQLite, React 19, Vite, TypeScript y Lucide React existente.

## Spec

docs/superpowers/specs/2026-11-04-kurascroll-public-web-design.md

## Global Constraints

- Perfil público: identificador, nombre visible, biografía corta y fecha de creación.
- Correo, avance, rachas e historial no se exponen en perfiles.
- Los comentarios son texto plano, paginados y asociados a serie/autor/fecha.
- Los comentarios pueden ocultar spoilers hasta que el lector pulse mostrar.
- Leer es público; escribir, retirar y reportar requiere cuenta verificada.
- El autor puede retirar sus comentarios/aportes; solo admin modera a otros.
- No añadir votos, calificaciones ni mensajes privados.
- Aplicar rate limit y límites de texto en el backend, no solo en React.
- Conservar cambios previos de Navbar y de componentes de estadísticas/lector.

## Review Focus

- Perfil inexistente: responde 404 sin revelar email ni existencia de otra cuenta.
- Usuario A intenta editar/eliminar comentario de B: responde 403 y no modifica el registro.
- Comentario marcado spoiler: texto queda oculto antes de la acción explícita de revelar.
- Cuenta no verificada o invitado intenta publicar/reportar: responde 401/403.
- Reporte duplicado o spam: queda limitado y el comentario continúa visible hasta que un admin lo resuelva.

---

## Mapa de archivos

- Crear src/backend/db/migrations/003_community.sql.
- Crear src/backend/services/community-service.ts y src/backend/routes/community-routes.ts.
- Integración del orquestador en src/backend/app.ts dentro de la política de permisos.
- Crear frontend/src/pages/UserProfilePage.tsx.
- Crear frontend/src/components/community/CommentThread.tsx, CommentComposer.tsx y ReportDialog.tsx.
- Crear frontend/src/pages/AdminReportsPage.tsx.
- Modificar frontend/src/pages/SeriesDetailPage.tsx.
- Integración del orquestador en frontend/src/App.tsx y frontend/src/components/common/Navbar.tsx, sin descartar el texto de Estadísticas de Lectura.

## Interfaces compartidas

- PublicProfile: handle, displayName, bio, createdAt.
- PublicComment: id, seriesSlug, authorHandle, authorDisplayName, body, hasSpoiler, createdAt, status.
- ReportItem: id, targetType comment|chapter|series, targetId, reason, createdAt, reporterHandle, status.
- GET /api/v1/users/:handle -> PublicProfile sin email ni estadísticas privadas.
- PUT /api/v1/users/me -> actualiza displayName y bio de la sesión.
- GET /api/v1/series/:slug/comments?cursor=&limit= -> lista paginada.
- POST /api/v1/series/:slug/comments -> crea comentario a nombre de la sesión.
- DELETE /api/v1/comments/:commentId -> autor o administrador.
- POST /api/v1/reports -> crea reporte deduplicado por usuario/objetivo.
- GET /api/v1/admin/reports y PATCH /api/v1/admin/reports/:reportId -> admin.
- PATCH /api/v1/admin/chapters/:chapterId/visibility, /series/:slug/visibility y /comments/:commentId/visibility -> admin.

### Tarea 1: crear esquema de perfil y comunidad

**Archivos:**

- Crear src/backend/db/migrations/003_community.sql.
- Revisar src/backend/db/database.ts y el aplicador de migraciones del plan de identidad.

- [ ] Añadir campos display_name y bio a users mediante ALTER compatible con SQLite.
- [ ] Crear series_comments con id, series_id, user_id, body, has_spoiler, status published|hidden|removed, created_at y updated_at.
- [ ] Crear content_reports con reporter_id, target_type, target_id, reason, status, reviewed_by y timestamps.
- [ ] Añadir índices para comentarios por serie/fecha y reportes pendientes por estado/fecha.
- [ ] Añadir restricciones de longitud y valores permitidos en SQLite.
- [ ] No guardar email, progreso o rachas en tablas públicas de comunidad.

### Tarea 2: implementar servicios y rutas públicas/privadas

**Archivos:**

- Crear src/backend/services/community-service.ts.
- Crear src/backend/routes/community-routes.ts.
- Integración del orquestador en src/backend/app.ts.

- [ ] Obtener perfil por handle público; responder 404 uniforme si no existe.
- [ ] Actualizar solo displayName y bio del usuario autenticado.
- [ ] Validar displayName entre 2 y 40 caracteres y bio entre 0 y 280 caracteres; guardar texto plano.
- [ ] Listar comentarios públicos por cursor con máximo 50 por página y ordenar del más reciente al más antiguo.
- [ ] Crear comentario solo desde identidad verificada; limitar body a 2 000 caracteres, trim y rechazar vacío.
- [ ] Marcar hasSpoiler como booleano validado.
- [ ] Permitir borrar comentario al autor o admin, sin aceptar userId del cliente.
- [ ] Crear reporte para comentario/serie/capítulo con motivo enum y deduplicación por reporter/target.
- [ ] Crear cola admin con ocultar, restaurar, retirar y cerrar reporte.
- [ ] Registrar cada cambio de visibilidad; ocultar conserva archivos para restaurar, retirar quita el contenido público y delega el borrado físico seguro al servicio propietario.
- [ ] Aplicar rate limits configurables a edición de perfil, comentarios y reportes.
- [ ] Registrar las mutaciones administrativas sin almacenar contenido sensible adicional.

### Tarea 3: crear perfil público

**Archivos:**

- Crear frontend/src/pages/UserProfilePage.tsx.
- Integración del orquestador en frontend/src/App.tsx y Navbar solo donde sea necesario.

- [ ] Mostrar handle, nombre visible, biografía y fecha de alta.
- [ ] No mostrar email, progreso, racha ni historial de lectura.
- [ ] Permitir editar displayName/bio solo en el perfil propio con sesión verificada.
- [ ] Enlazar los nombres de autor de comentarios a la página de perfil.
- [ ] Mantener la pantalla de invitado navegable sin forzar login.

### Tarea 4: añadir conversación antes del lector

**Archivos:**

- Crear frontend/src/components/community/CommentThread.tsx.
- Crear frontend/src/components/community/CommentComposer.tsx.
- Crear frontend/src/components/community/ReportDialog.tsx.
- Modificar frontend/src/pages/SeriesDetailPage.tsx.

- [ ] Integrar comentarios en la ficha existente de serie antes de entrar al lector.
- [ ] Permitir lectura pública paginada y mostrar autor/fecha/perfil.
- [ ] Ocultar por defecto el cuerpo de un comentario con hasSpoiler=true y revelar solo tras acción explícita.
- [ ] Mostrar el composer a usuarios verificados y enlaces a login/registro/Omitir a invitados.
- [ ] Permitir al autor retirar su comentario y a cualquier cuenta verificada reportarlo.
- [ ] Cerrar modal y refrescar listado tras crear/retiro/reporte satisfactorios.
- [ ] Mostrar errores de red, longitud y rate limit sin borrar el borrador del comentario.

### Tarea 5: añadir panel de reportes

**Archivos:**

- Crear frontend/src/pages/AdminReportsPage.tsx.
- Integración del orquestador en frontend/src/App.tsx y Navbar con una entrada visible solo a admin.

- [ ] Consultar la cola paginada de reportes con la sesión del administrador.
- [ ] Mostrar contenido reportado, motivo, autor y fecha con acciones ocultar/restaurar/retirar para series, capítulos y comentarios.
- [ ] Exigir confirmación antes de retirar un capítulo o serie compartidos.
- [ ] Ocultar el panel y proteger también el endpoint cuando el usuario no sea admin.
- [ ] Refrescar la cola tras resolver y conservar el estado ante un error de red.

### Tarea 6: revisión de la comunidad

- [ ] Ejecutar npm run build desde la raíz y resolver errores de TypeScript/Vite.
- [ ] Revisar manualmente perfil público/propio, comentario, spoiler, retiro del autor y reporte.
- [ ] Revisar autorización admin frente a usuario normal e invitado.
- [ ] Confirmar que la ficha de serie conserva el flujo existente de capítulo y biblioteca.
- [ ] Revisar git diff para confirmar que los cambios previos del usuario siguen presentes.
