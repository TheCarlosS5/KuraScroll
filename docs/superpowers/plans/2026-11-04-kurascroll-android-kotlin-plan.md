# KuraScroll Android Kotlin — plan de implementación

> Este trabajo empieza después de integrar y revisar KuraScroll Web. La implementación se hace en Antigravity (`agy`) con subagentes internos de Agy; no usar subagentes nativos de Codex. Mantener visible la terminal solicitada.

## Objetivo

Crear, compilar y revisar manualmente en emulador Android la app nativa descrita en `docs/superpowers/specs/2026-11-04-kurascroll-android-design.md`.

## Dependencias y límites

- Backend web ya compilado e integrado; usar contratos reales documentados en `docs/security/route-access-matrix.md` y las rutas registradas en código.
- No añadir un token API al APK. Acordar e implementar en backend un mecanismo móvil explícito de sesión opaca revocable antes de conectar la app.
- No iniciar la fase Android hasta cerrar las revisiones de privacidad de datos personales, Omitir y carga procesada en dispositivo en web.
- Preservar cambios locales del usuario. No desplegar el backend, publicar APK ni abrir puertos externos.
- Android Studio, SDK y emulador se pueden instalar desde fuentes oficiales si faltan; no descargar imágenes de sistema ni binarios desde mirrors no oficiales.
- No crear ni ejecutar suites de tests ni benchmarks. Hacer builds y pruebas manuales en el emulador solicitadas por el usuario.

## Coordinación Agy

- [ ] Actualizar el task artifact de Agy con estado Web cerrado / Android activo / KuraGames pendiente.
- [ ] Agy principal mantiene contratos de API/DB, `settings.gradle.kts`, catálogos de versiones y cualquier archivo compartido.
- [ ] Usar agentes internos: (1) auth/sesión móvil y contrato API, (2) importación/procesamiento en dispositivo, (3) Compose y experiencia de lectura. No permitir ediciones simultáneas de archivos compartidos.
- [ ] Integrar cada entrega, revisar permisos, validar los datos/errores y compilar antes de conectar la siguiente capa.

## Fase 1: contrato móvil y seguridad del servidor

- [ ] Inventariar endpoints existentes reales y contratos de registro, login, sesión, progreso, perfiles, comentarios e ingesta.
- [ ] Diseñar endpoints móviles de crear/renovar/revocar sesión; devolver token opaco solo por HTTPS y aceptar Bearer solo en rutas de API.
- [ ] Guardar hash del token, expiración, revocación y tipo móvil en SQLite; mantener cookie de navegador y controles CSRF del navegador.
- [ ] No inferir identidad desde query/body; probar autorización por usuario y estado de verificación.
- [ ] Documentar expiración, recuperación tras reinstalación, cierre de sesión y revocación de todas las sesiones.

## Fase 2: esqueleto Android

- [ ] Confirmar Android Studio, Java/JDK, Android SDK y emulador; instalar lo que falte desde developer.android.com/android-studio.
- [ ] Crear proyecto Kotlin con Gradle Kotlin DSL, Jetpack Compose y una arquitectura por módulos/capas mantenible.
- [ ] Definir `minSdk` compatible con APIs SAF, Room y PdfRenderer; definir versiones compile/target desde una release estable instalada.
- [ ] Añadir navegación, tema y estados de carga/error; configurar HTTPS y eliminar hosts locales del build de entrega.
- [ ] Configurar permisos Android mínimos: Internet; notificaciones solo si una carga larga las necesita y bajo política del sistema; sin READ/WRITE_EXTERNAL_STORAGE general.

## Fase 3: almacenamiento, red y modo invitado

- [ ] Room: catálogo, capítulos cacheados, progreso de lectura por cuenta, progreso invitado, preferencias y cola de sincronización versionada.
- [ ] Persistir token cifrado con Android Keystore; separar clave/valor cifrado, limpiar al cerrar sesión y excluir secretos de backup/log.
- [ ] Crear cliente HTTP con TLS, Authorization Bearer, timeouts, reintentos acotados y saneamiento de logs.
- [ ] Implementar Omitir como opción de entrada permanente; estado de red solo cambia qué contenido está disponible, no si se puede entrar.
- [ ] Particionar datos locales por userId autenticado derivado del servidor y borrar caché privada al cambiar/cerrar sesión.
- [ ] Sincronizar progreso por cuenta y reintentar en red disponible; evitar doble registro de racha y resolver conflictos de forma determinista.

## Fase 4: biblioteca y lector

- [ ] Implementar catálogo cacheable con búsqueda/paginación y placeholders que no dependan de recursos remotos para mantener la pantalla usable offline.
- [ ] Implementar detalle de serie antes del lector, perfiles y comentarios/spoilers/reporte.
- [ ] Implementar lector eficiente para capítulos de páginas WebP servidos o cacheados, precarga acotada y restauración de cursor.
- [ ] Implementar progreso/rachas local primero y sync posterior; ofrecer importación explícita del progreso invitado.

## Fase 5: ingesta en el teléfono

- [ ] SAF: selector de CBZ/ZIP, PDF, varias imágenes; persistir permisos URI solo para trabajos reanudables y liberarlos al terminar/cancelar.
- [ ] ZIP streaming con límites de entrada/tamaño, protección traversal/symlink y orden natural estable.
- [ ] PDF con PdfRenderer en dispatcher de IO y bitmap de página a demanda; no renderizar todas las páginas simultáneamente.
- [ ] Imágenes con `BitmapFactory`/decodificación por muestreo y conversión secuencial WebP; controlar memoria y segmentar tiras demasiado largas.
- [ ] Respetar límite del backend y tipos reales. Mostrar preview, progreso, bytes, error/reintento y cancelación antes de publicar.
- [ ] Conectar al flujo de carga por páginas, hashes, estado de sesión, finalización/publicación atómica y eliminación de borradores.
- [ ] WorkManager solo para subir trabajo ya procesado que requiera persistencia; vincular red/cancelación y notificación conforme a políticas Android actuales.

## Fase 6: validación en emulador y cierre

- [ ] Compilar APK debug y arrancarlo en el emulador oficial; mantener la app y la terminal visibles.
- [ ] Recorrer registro/login/logout, Omitir con y sin red, cache de catálogo, lectura/cursor, progreso/racha, comentario spoiler, perfil y subida de archivos disponibles de muestra.
- [ ] Verificar reanudación/cancelación, archivo corrupto, ZIP inseguro, PDF grande, imagen de gran dimensión, red intermitente y cuenta no verificada.
- [ ] Confirmar a través de inspección y UI que no se filtran sesiones, que no hay API_TOKEN en APK y que el invitado no accede a rutas personales del servidor.
- [ ] Revisar visualmente pantallas clave y uso de memoria/animación en la configuración de emulador instalada; no hacer benchmarks SLA.
- [ ] Informar ubicación del APK de depuración, pasos de build y límites de la validación.
- [ ] Actualizar task artifact: Android cerrado / KuraGames activo.

## Cierre

Android se considera terminado cuando compila, se instala en el emulador, los recorridos anteriores se completan manualmente y los datos/identidad se mantienen aislados. Después, avanzar a KuraGames usando su especificación y plan dedicados.
