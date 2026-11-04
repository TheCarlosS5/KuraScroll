# Revisión profunda del backend

Fecha: 2026-11-03  
Alcance: lectura estática de `src/backend`, configuración y scripts de ejecución relacionados. Los hallazgos describen el estado anterior a la remediación listada abajo. Se modificó código del backend durante el seguimiento; no se ejecutaron compilación ni pruebas.

## Resumen ejecutivo

La revisión original encontró una superficie administrativa amplia, escucha en `0.0.0.0`, CORS abierto y falta de autenticación común. Los cambios de remediación de abajo corrigen el host predeterminado, limitan CORS, añaden protección por token al exponer la API, y cierran rutas de escritura arbitraria en ingesta/mirror. Los hallazgos detallados siguen documentando ese estado original; la sección de estado separa lo aplicado de lo pendiente.

El punto estructural que amplifica varios riesgos es la confianza en identificadores/rutas entregados por el usuario o almacenados en DB: la ingesta forma rutas con `seriesSlug` sin validar el segmento, y mirror copia archivos usando rutas procedentes de filas de la DB y un destino libre. La extracción de archivos ZIP aplana nombres a `basename`, sobrescribe colisiones y no limita tamaño/cantidad de entradas.

## Estado de remediación

Se empezaron a aplicar correcciones en esta misma revisión. La descripción inicial de los hallazgos refleja el estado del código antes de esos cambios.

- **Aplicado:** el servidor ahora escucha en `127.0.0.1` por defecto; un `HOST` no loopback exige `API_TOKEN` aleatorio de al menos 32 caracteres. Cuando se configura, se acepta mediante `Authorization: Bearer ...` o `x-api-token` y se compara en tiempo constante. `/health` y preflight permanecen públicos.
- **Aplicado:** CORS usa allowlist exacta; por defecto admite los orígenes Vite locales y se configura con `KURA_CORS_ORIGINS` (separados por coma).
- **Aplicado:** la ingesta HTTP exige una fuente existente bajo `INCOMING_DIR` (por defecto `STORAGE_ROOT/incoming`), valida slug y números, limita páginas/bytes y escribe en staging antes de publicar el capítulo con rename.
- **Aplicado:** lectura de páginas y export CBZ comprueban contención bajo `STORAGE_ROOT` y resuelven symlinks antes de servir/copiar.
- **Aplicado:** el endpoint de mirror genera destinos dentro de `STORAGE_ROOT/backups/mirrors`, rechaza rutas de destino enviadas por el cliente y permite una operación a la vez. El servicio ignora rutas de DB absolutas o fuera de la raíz y evita symlinks de origen.
- **Aplicado:** ingestores ZIP comparten límites de tamaño de archivo, entrada, cantidad, expansión acumulada y ratio; se preservan subdirectorios para impedir colisiones de basename. El import HTTP admite hasta 16 MiB y el gunzip aplica su límite durante la expansión.
- **Aplicado:** deep zoom valida ID de capítulo, dimensiones, página y coordenadas antes de consultar/escribir su caché; los errores de generación no devuelven rutas ni detalles internos.
- **Aplicado en la revisión de seguimiento:** el mirror usa un directorio acumulativo estable para que las ejecuciones diferenciales comparen contra los archivos previos; en capítulos que cambiaron, los archivos existentes de igual tamaño se comparan por SHA-256 antes de decidir que no requieren copia. Un snapshot completo reemplaza las páginas copiadas.
- **Aplicado en la revisión de seguimiento:** los originales extraídos de un CBZ se eliminan del staging antes de publicar el capítulo; solo se conserva la salida optimizada.
- **Aplicado:** backup export y sync usan el principal local fijo; los errores de varias rutas sensibles se sanitizaron y el servidor registra errores. `SIGINT`/`SIGTERM` cierran Fastify y la DB que creó la app.
- **Pendiente:** otras rutas siguen aceptando `userId` arbitrario o parámetros sin schema formal; hay que migrarlas a identidad autenticada y JSON Schema endpoint por endpoint.
- **Pendiente:** si se usa el frontend a través de una interfaz no loopback, debe adjuntar el token en sus requests; no se añadió configuración de token a la UI.
- **Pendiente:** límites de frecuencia/cuota para backups/import y cierre ordenado de todos los timers/servicios de fondo.
- **Pendiente:** auditoría completa de cada ruta que accede a medios y revisión de límites de las cargas profundas de zoom y telemetría.
- **Pendiente:** no se ejecutaron compilación ni pruebas; validar compatibilidad con los callers actuales antes de desplegar.

## Hallazgos priorizados

### 1. [Crítico] Endpoints sin autenticación y acciones administrativas expuestas

**Evidencia:** `src/backend/app.ts` registra en una misma instancia rutas de backup, mantenimiento, ingesta, sync, storage y muchas operaciones mutables. No se ve un hook global de autenticación ni una política común de autorización en la inicialización. Ejemplos concretos: `src/backend/routes/backup-routes.ts` (`POST /api/v1/backup/import`, `POST /api/v1/backup/mirror`, `GET /api/v1/backup/export`); `src/backend/routes/maintenance-routes.ts` (`POST /api/v1/admin/maintenance/compact`); `src/backend/routes/chapter-routes.ts` (`POST /api/v1/chapters/ingest`). `src/backend/server.ts` usa `HOST = process.env.HOST || '0.0.0.0'`.

**Impacto:** cualquier cliente que alcance el puerto puede ejecutar mutaciones y operaciones administrativas. Export puede revelar la biblioteca/progreso; import puede sobrescribir datos; compact puede consumir disco/CPU; ingesta puede leer archivos locales y alterar el almacenamiento. El enlace a todas las interfaces hace que esto aplique también a la LAN y, según firewall/proxy, potencialmente a Internet.

**Corrección recomendada:**

1. Añadir autenticación común como `preHandler`/plugin de Fastify antes de registrar rutas; evitar protección manual inconsistente por endpoint.
2. Separar roles/capacidades (`read`, `library:write`, `backup:write`, `admin`) y proteger en especial backup, mantenimiento, sync, pairing y mutaciones de perfil.
3. Para instalación local de un solo usuario, usar token aleatorio de instalación con comparación segura, rotación y almacenamiento fuera de la DB exportada; no confiar en CORS ni en `userId` enviado por el cliente como identidad.
4. Cambiar el host predeterminado a `127.0.0.1` y requerir configuración explícita para escucha LAN; documentar firewall y TLS/proxy cuando se habilite.
5. Agregar pruebas de integración que demuestren 401/403 sin credenciales y acceso permitido/restringido por rol.

### 2. [Crítico] Backup mirror acepta destino arbitrario y puede escribir fuera del área de datos

**Evidencia:** `src/backend/routes/backup-routes.ts` acepta `destinationDir` en `POST /api/v1/backup/mirror` y lo pasa al servicio. `src/backend/services/differential-mirror-service.ts` resuelve el valor con `path.resolve(params.destinationDir)`, crea el directorio y escribe `kura-scroll.db`, manifiesto, covers y capítulos allí. No se comprueba que el destino esté bajo una carpeta de backups autorizada.

**Impacto:** un cliente no autenticado o con permisos insuficientes puede provocar escritura en cualquier ruta accesible por el proceso, agotar el disco o sobrescribir archivos (incluido `kura-scroll.db` en el directorio elegido, pues se elimina el destino previo antes del rename). En Windows las rutas absolutas y unidades hacen especialmente fácil salir del árbol esperado.

**Corrección recomendada:**

1. Eliminar `destinationDir` del contrato público; generar el destino servidor-side bajo un `BACKUP_ROOT` configurado.
2. Resolver y canonicalizar ambas rutas, comprobar contención por `path.relative` y rechazar rutas absolutas, `..`, rutas UNC y destinos existentes no confiables.
3. Usar nombres de snapshot generados por el servidor y crear archivos con política de no sobrescritura (`wx`) o directorio único.
4. Rechazar destinos que coincidan con `storageRoot`, directorio de DB, raíz del proyecto o sus ancestros.
5. Aplicar cuota, límite de frecuencia y autorización `backup:write`.

### 3. [Crítico] Ingesta acepta ruta local arbitraria y slug no validado

**Evidencia:** `src/backend/routes/chapter-routes.ts`, `POST /api/v1/chapters/ingest`, toma `sourcePath` del JSON y lo entrega a `ingestChapter`. La comprobación de catálogo valida que exista el `seriesSlug`, pero no valida que sea el slug de esa fila ni que sea un componente seguro. `src/backend/services/chapter-ingestion-service.ts` construye `relDir = path.join('series', params.seriesSlug, ...)`, crea `targetDir` mediante `path.resolve(storageRoot, relDir)`, y si `isArchive` es falso hace `readdir(sourcePath)`.

**Impacto:** quien pueda llamar la ruta puede hacer que el proceso lea directorios locales que no deberían ser fuentes de ingesta; puede además intentar traversal mediante campos numéricos/slug o causar escritura fuera de `storageRoot`. `volumeNumber`/`chapterNumber` se validan solo superficialmente (`chapterNumber` debe ser number); no se exige finitud, rango o entero. La escritura de archivos ocurre antes de crear registros DB y puede dejar restos parciales tras un error.

**Corrección recomendada:**

1. No aceptar rutas físicas desde HTTP. Recibir un identificador de upload o elegir archivos desde un `INCOMING_ROOT` fijo del servidor.
2. Recuperar el slug desde la fila de serie, no confiar en el valor del cuerpo para formar paths.
3. Validar `chapterNumber` y `volumeNumber` con schema (entero finito, límites, política para capítulos especiales) y crear un identificador sin colisiones.
4. Aplicar función común de contención de rutas para toda lectura/escritura; validar la ruta real también frente a symlinks.
5. Ingestar a directorio temporal, completar optimización/manifest/validación, y publicar con rename atómico; borrar staging al fallar.
6. Limitar concurrencia global, tamaño del input, número de páginas, bytes totales y duración por trabajo.

### 4. [Alto] CORS permite cualquier origen

**Evidencia:** en `src/backend/app.ts` la configuración de `@fastify/cors` usa `origin: true`.

**Impacto:** refleja el origen de cualquier web que pueda alcanzar el API. CORS no reemplaza autenticación; con endpoints sin autorización aumenta el alcance de ataques iniciados desde navegadores y facilita exfiltración/acciones cross-origin. Si luego se agregan cookies o credenciales, el riesgo aumenta.

**Corrección recomendada:** usar una lista de orígenes permitidos tomada de configuración y comparada exactamente; en modo local permitir solo el origen del frontend local esperado. Rechazar `Origin: null` salvo necesidad explícita y definir `credentials` de forma deliberada. Añadir comprobaciones de `Origin`/CSRF para mutaciones si se usan cookies.

### 5. [Alto] Controles de tamaño incompatibles: límite global 1 MiB y validador de backup 100 MiB

**Evidencia:** `src/backend/app.ts` configura por defecto `bodyLimit` a `1048576` (1 MiB). `src/backend/backup-import/validation/validate-backup.ts` documenta y aplica un máximo predeterminado de 100 MiB, pero el import HTTP atraviesa primero el parser de Fastify y no puede llegar a ese validador con payloads mayores a 1 MiB.

**Impacto:** export/import de backups grandes no funciona como promete el validador y se rechaza antes con 413. Elevar el límite global a 100 MiB sin streaming, a su vez, puede multiplicar memoria consumida con solicitudes concurrentes.

**Corrección recomendada:** definir límite específico solo para import, alineado con la política del producto; preferir carga streaming a archivo temporal, límites de concurrencia y validación incremental. Si se mantiene JSON en memoria, medir bytes antes de parsear y documentar un máximo menor y realista. La descompresión gzip debe tener límite de salida aplicado durante la descompresión, no solo después de materializar todo el buffer.

### 6. [Alto] Extracción ZIP con colisiones y sin límites anti ZIP bomb

**Evidencia:** `src/backend/services/archive-extractor.ts` recorre todas las entradas, llama `entry.getData()` para materializar cada archivo completo, y escribe `path.basename(entry.entryName)` en el directorio temporal. No limita número de entradas, tamaño comprimido/descomprimido total, tamaño individual ni relación de expansión. Si dos entradas de directorios distintos tienen el mismo basename, ambas escriben el mismo destino y una sobrescribe a la otra. La defensa `isPathSafe` comprueba la entrada original, pero la extracción usa basename.

**Impacto:** un CBZ malicioso puede agotar memoria, CPU o disco; colisiones producen pérdida silenciosa/páginas equivocadas; procesamiento de archivos enormes causa degradación del servicio.

**Corrección recomendada:** validar metadatos antes de extracción y aplicar límites duros acumulativos; usar extracción en streaming con contador de bytes, timeout y cancelación. Mantener jerarquía segura o asignar nombres deterministas únicos por índice y detectar duplicados antes de escribir. Rechazar entradas cifradas, symlinks y extensiones/formatos no permitidos; no confiar en tamaños declarados por ZIP.

### 7. [Alto] El mirror copia rutas de DB sin verificar contención ni symlinks

**Evidencia:** `src/backend/services/differential-mirror-service.ts` toma `cover_image` y `storage_path` de SQLite y los combina directamente con `storageRoot`/`destDir` mediante `path.join`. También sigue archivos con `stat`, que dereferencia symlinks. Un valor con traversal o un symlink puede hacer que la copia lea datos fuera de almacenamiento y los lleve al snapshot.

**Impacto:** fuga de archivos locales al snapshot/descarga posterior; escrituras fuera del destino permitido; backups contaminados o inconsistentes. Aunque los registros normalmente sean internos, pueden introducirse por importación.

**Corrección recomendada:** normalizar y validar todas las rutas importadas antes de persistirlas; en cada operación resolver ruta real (`realpath`) y asegurar contención bajo raíz; rechazar symlinks y tipos no regulares. Para destino, aplicar la misma regla de contención y evitar `path.join(destDir, ruta_db)` con rutas absolutas.

### 8. [Alto] Exportación de backup puede seleccionar identidad de usuario arbitraria

**Evidencia:** `src/backend/routes/backup-routes.ts` toma `userId` de querystring y usa `local_user` si falta. `src/backend/routes/sync-routes.ts` también acepta `userId` del cuerpo para replay y del query para status.

**Impacto:** el identificador no es autenticación. Un cliente puede consultar/exportar el estado de otro usuario si el esquema contiene datos multiusuario, o escribir mutaciones atribuidas a otro ID. En modo de usuario único también facilita falsear actividad y progreso.

**Corrección recomendada:** derivar el user ID de la identidad autenticada y retirar esos parámetros de los contratos públicos. Si la app seguirá siendo single-user, usar un ID fijo interno y rechazar cualquier otro valor enviado por el cliente.

### 9. [Medio] Errores internos se devuelven al cliente

**Evidencia:** rutas como `backup-routes.ts`, `chapter-routes.ts` y `maintenance-routes.ts` serializan `err.message` directamente en respuestas HTTP.

**Impacto:** mensajes de filesystem, SQLite y librerías pueden revelar rutas, estructura interna y detalles útiles para explotación; además hay respuestas 400 para errores de servidor en ingesta/import.

**Corrección recomendada:** establecer `setErrorHandler` común que devuelva un código/correlación estable y mensajes sanitizados; conservar stack y detalle en logs estructurados con redacción de datos sensibles. Mapear errores de validación a 400/422, conflictos a 409, límites a 413 y fallos internos a 500.

### 10. [Medio] Parámetros HTTP con validación incompleta y respuestas no acotadas

**Evidencia:** rutas principales emplean casts TypeScript (`req.body as ...`) y validaciones manuales parciales. En backup import `chunkSize` se acepta como cualquier número; sync comprueba el tamaño del array, pero no el shape y tamaño individual de cada mutación en la ruta. Muchas rutas generadas exponen múltiples parámetros numéricos de configuración.

**Impacto:** NaN, infinitos, números negativos o strings pueden alcanzar servicios/SQLite; grandes campos de texto generan consumo de CPU/memoria; errores inconsistentes y datos inválidos persistidos.

**Corrección recomendada:** definir JSON Schema de Fastify para cada body/query/params con `additionalProperties: false`, tipos estrictos, `minimum`/`maximum`, límites de string/array y enum. Usar schemas TypeScript derivados y validación común en lugar de casts manuales. Poner máximos razonables para `chunkSize` y el tamaño agregado del lote.

### 11. [Medio] Dependencia de un solo archivo monolítico de registro de rutas

**Evidencia:** `src/backend/app.ts` importa y registra una cantidad muy grande de rutas y servicios directamente, con construcción de servicios dispersa en el archivo.

**Impacto:** difícil auditar qué rutas reciben dependencias, qué rutas mutan estado y qué servicios se cierran al apagar; aumenta el riesgo de omitir controles comunes y hace el arranque sensible a fallos de inicialización secundarios.

**Corrección recomendada:** dividir registro por dominios (`library`, `reader`, `sync`, `admin`, `media`), agrupar dependencias en un container explícito y aplicar hooks/políticas por grupo. Mantener una tabla de inventario de endpoint, método, permiso y límite.

### 12. [Medio] Falta política visible de ciclo de vida/cierre de recursos

**Evidencia:** `server.ts` crea la app y llama `listen`; no se observa manejo de señales para cerrar Fastify, SQLite, watchers, daemons y streams. `app.ts` acepta/crea varios servicios de fondo y los registra con Fastify.

**Impacto:** reinicios pueden dejar procesos/handles activos, perder flushes de buffers o dejar WAL/archivos temporales a medias. El impacto concreto depende de hooks internos de cada servicio.

**Corrección recomendada:** añadir `onClose` para cada daemon, watcher, cola, servicio que mantenga timers y DB; manejar `SIGINT`/`SIGTERM` con cierre ordenado y timeout; asegurar vaciado de buffers antes de cerrar SQLite. Verificar que `buildApp` no inicie recursos si el servidor no completa el arranque.

## Observaciones positivas

- `createDatabase` habilita `foreign_keys`, configura `busy_timeout` y usa WAL para DB persistente.
- La mayoría de escrituras complejas observadas usa sentencias preparadas; `VACUUM INTO` en el mirror escapa comillas simples en la ruta.
- La extracción implementa una comprobación inicial contra Zip Slip, y las imágenes servidas limitan `pageFile` a un nombre sin separadores.
- El import de backup tiene límites de tamaño/descompresión y conteos en la capa de validación, aunque hay que alinear esos límites con HTTP y mover la defensa contra bombas de compresión a un flujo acotado.

## Orden sugerido de remediación

1. **Cerrar exposición:** host loopback por defecto, autenticación/autorización común, proteger backup/admin/ingest/sync y acotar CORS.
2. **Eliminar rutas elegidas por cliente:** destino de mirror server-side, ingesta desde staging controlado; validar contención tanto en origen como destino y rechazar symlinks.
3. **Poner límites de recursos:** ZIP y gzip en streaming con máximos, límite y concurrencia de import, límites por endpoint.
4. **Endurecer contratos:** JSON Schema estricto, identidad derivada de credenciales y manejo uniforme de errores.
5. **Consistencia operacional:** ingesta atómica, shutdown ordenado, métricas/auditoría de tareas privilegiadas.
6. **Verificación:** después de aplicar cada bloque, añadir pruebas de integración para autorización, traversal, ZIP bomb/collisions, 413, rollback de ingesta y no fuga de errores.

## Limitaciones de esta revisión

La revisión fue estática y enfocada en el backend principal y sus flujos de mayor riesgo. El repositorio contiene muchas rutas y servicios especializados; no se hizo una inspección línea por línea de cada perfil de efectos. Las observaciones sobre ausencia de controles se limitan al código inspeccionado en la inicialización/rutas citadas; si existe autenticación en un proxy externo, debe documentarse y reforzarse con defensa en profundidad dentro de Fastify. No se inspeccionaron reglas reales del firewall, reverse proxy ni permisos de sistema de archivos del entorno de despliegue.
