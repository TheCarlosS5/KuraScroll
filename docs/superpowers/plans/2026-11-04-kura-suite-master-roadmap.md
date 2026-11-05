# Hoja de ruta Kura: Web, Android y KuraGames local

Fecha: 2026-11-04  
Estado: En ejecución; fases secuenciales

## Meta

Completar la plataforma web pública KuraScroll, continuar con la aplicación Android Kotlin y terminar con KuraGames para biblioteca local de juegos. Agy implementa y coordina solo sus subagentes internos; Codex prepara/revisa los planes, diffs, seguridad, builds y recorridos manuales.

## Fases y puertas

### 1. KuraScroll Web — activa

- Especificación: `docs/superpowers/specs/2026-11-04-kurascroll-public-web-design.md`.
- Plan maestro y subplanes: `docs/superpowers/plans/2026-11-04-kurascroll-public-web-master-plan.md` más identidad, ingesta y comunidad.
- Terminar identidad, Omitir, ingesta procesada en cliente, perfiles/comentarios/reportes y guía de operación.
- Revisar cada ruta registrada, datos privados y Service Worker; compilar y hacer revisión manual web.
- No desplegar ni abrir puertos públicos. Cerrar esta fase antes de conectar Android.

### 2. KuraScroll Android — después de Web

- Especificación: `docs/superpowers/specs/2026-11-04-kurascroll-android-design.md`.
- Plan: `docs/superpowers/plans/2026-11-04-kurascroll-android-kotlin-plan.md`.
- Acordar primero la sesión móvil con el backend; luego crear Kotlin/Compose, almacenamiento local, lector, ingesta en teléfono y modo invitado.
- Instalar herramientas desde Android Developers si faltan; compilar e instalar en emulador oficial y hacer revisión manual.

### 3. KuraGames — después de Android

- Especificación: `docs/superpowers/specs/2026-11-04-kuragames-local-library-design.md`.
- Plan: `docs/superpowers/plans/2026-11-04-kuragames-local-library-plan.md`.
- App de escritorio Tauri/React local-first para copiar/importar juegos desde carpetas, USB o discos disponibles. No hay enlaces ni descargas de Internet, servicios remotos ni juegos incluidos; en modo sin Internet el contenido tiene que estar en un medio local disponible.
- Construir catálogo y ficha visual relacionados con KuraStream/KuraScroll, manteniendo una identidad propia de KuraGames.

## Reglas de integración

- Mantener terminal visible y sesión de Agy abierta mientras haya fase activa.
- Delegar tareas independientes solo a subagentes internos de Agy. El orquestador Agy conserva los contratos y archivos compartidos y revisa cada integración.
- No descartar cambios locales anteriores del usuario ni mezclar unrelated generated reports.
- Sin publicación externa, despliegue ni apertura de puertos.
- Builds y recorridos manuales son obligatorios para declarar cierre. No agregar suites ni ejecutar benchmarks no solicitados.
- Mantener las fases posteriores pendientes hasta que la puerta anterior esté cerrada y revisada.
- El apagado de Windows se reserva para el final de las tres fases, tras la revisión de Codex y la indicación explícita de cierre al terminal de Agy.
