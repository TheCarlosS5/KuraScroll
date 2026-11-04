# KuraScroll: web pública — plan maestro

> For agentic workers: REQUIRED SUB-SKILL: apply the subagent-driven workflow through agy's internal invoke_subagent tools; do not use Codex-native subagents. The agy orchestrator maintains the task artifact and reviews each integration.

## Goal

Entregar primero una web pública con cuentas, biblioteca compartida, procesamiento de capítulos en el dispositivo, perfiles y comentarios; dejar Android Kotlin para una fase posterior.

## Architecture

Identidad y permisos son la base. La ingesta se publica en un módulo separado que recibe páginas WebP procesadas en navegador y las guarda mediante staging. Perfiles/comentarios consumen las mismas sesiones y permisos; el backend se mantiene como fuente de verdad.

## Tech Stack

Fastify, TypeScript, SQLite, React 19, Vite, IndexedDB, Web Workers, PDF.js, Canvas/WebP y SMTP configurable.

## Spec

docs/superpowers/specs/2026-11-04-kurascroll-public-web-design.md

## Global Constraints

- Implementar la web en esta fase; no iniciar Android Kotlin.
- El navegador procesa una página a la vez; el backend no descomprime ni transcodifica en las rutas HTTP.
- Cuenta y permisos provienen de la sesión del servidor; ignorar userId de query/body.
- Omitir está visible sin sesión con o sin conexión; invitado usa IndexedDB y solo contenido público.
- SMTP y cuota se configuran por entorno; ningún secreto se guarda en Git.
- HTTPS/proxy, origen exacto, bootstrap local del primer administrador y matriz de rutas son requisitos para publicar.
- Preservar los cambios existentes en Navbar.tsx, ResolutionTierHUD.tsx, OtakuStatsModal.tsx, OtakuStatsRadar.tsx, useCloudlessSync.ts y Navbar.test.tsx.
- No borrar, revertir ni formatear archivos modificados previamente por el usuario.

## Review Focus

- Identidad no autenticada o userId manipulado no debe acceder a datos personales.
- La ruta de subida debe recibir solo páginas procesadas y no importar Sharp.
- El modo Omitir debe funcionar en ambos estados de red si el shell ya está cacheado.
- El caché PWA no debe guardar datos privados, ni conservar respuestas personales de la versión anterior.
- Operaciones administrativas deben fallar para usuarios normales aunque se invoquen directamente por HTTP.

---

## Orden de los subproyectos

1. docs/superpowers/plans/2026-11-04-kurascroll-identity-offline-plan.md
   - Define autenticación, matriz de acceso, aislamiento de progreso/rachas, bootstrap admin y entrada Omitir.
   - Debe terminar primero porque define SessionIdentity, requireUser y requireRole.
2. docs/superpowers/plans/2026-11-04-kurascroll-client-ingestion-plan.md
   - Consume SessionIdentity y requireUser.
   - Publica capítulos compartidos procesados en el dispositivo.
3. docs/superpowers/plans/2026-11-04-kurascroll-community-plan.md
   - Consume SessionIdentity, roles y series/capítulos ya publicados.
   - Añade perfiles, comentarios y reportes.

Cada subplan se integra y se compila antes de iniciar el siguiente bloque de mutaciones que dependa de él.

## Coordinación de Antigravity

Al comenzar, crear un task artifact Markdown con write_to_file e IsArtifact true, ArtifactMetadata.ArtifactType task. Mantener las tres fases y sus casillas actualizadas.

Usar al menos tres subagentes internos:

- Agente de cuentas: implementar repositorio/servicio/rutas de autenticación y migración de identidad.
- Agente de ingesta: leer el subplan y revisar librerías/contrato mientras termina identidad; después implementar worker y rutas de carga con interfaces confirmadas.
- Agente de comunidad: revisar el detalle de serie y permisos mientras termina identidad; después implementar perfil/comentarios en sus propios archivos.

El agente principal de agy conserva la propiedad exclusiva de los archivos compartidos: src/backend/app.ts, src/backend/db/database.ts, frontend/src/App.tsx, frontend/src/components/common/Navbar.tsx, frontend/package.json, package-lock.json y .env.example. Los subagentes entregan módulos enfocados y contratos; el principal los registra, revisa conflictos y conserva cambios locales.

Los subagentes no deben editar simultáneamente esos archivos compartidos. Si requieren un cambio común, primero envían la interfaz propuesta al orquestador y esperan su integración. No incluir cambios previos del usuario en un commit de funcionalidad.

## Secuencia de verificación y cierre

- [ ] Revisar git status y git diff antes de editar; anotar los cambios locales existentes.
- [ ] Completar identidad/seguridad/Omitir, revisar la matriz de rutas y ejecutar npm run build.
- [ ] Completar ingesta, revisar el camino HTTP, tamaños, staging/recuperación y ejecutar npm run build.
- [ ] Completar comunidad, revisar permisos/reportes y ejecutar npm run build.
- [ ] Hacer revisión manual de registro con SMTP de desarrollo, ingreso/salida, invitado online/offline, subida y comentarios.
- [ ] Leer todos los diffs de subagentes; confirmar que solo los archivos esperados cambiaron y que los seis edits previos permanecen.
- [ ] Dejar pasos de despliegue para SMTP, dominio HTTPS, cuota y primer administrador; no publicar el servidor ni abrir puertos desde esta tarea.
- [ ] Presentar al dueño el resumen, el hash del commit de diseño, los archivos de plan, build/revisión realizados y los requisitos pendientes de configuración.
