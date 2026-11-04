# KuraScroll: procesamiento local y carga compartida — plan de implementación

> For agentic workers: REQUIRED SUB-SKILL: apply the subagent-driven workflow through agy's internal invoke_subagent tools; do not use Codex-native subagents. This plan depends on the identity contract.

## Goal

Procesar CBZ/ZIP, PDF e imágenes en el dispositivo de quien sube y publicar capítulos en la biblioteca compartida sin transcodificación del servidor.

## Architecture

Un worker procesa una página a la vez, genera WebP y envía cada página al backend. Fastify crea una carga temporal ligada a la cuenta, transmite páginas a staging, verifica manifiesto/cuota y publica los archivos y filas SQLite después de completar todo el trabajo.

## Tech Stack

React 19, Vite, TypeScript, Web Workers, PDF.js, Canvas/WebP, lector ZIP incremental, Fastify streaming y SQLite.

## Spec

docs/superpowers/specs/2026-11-04-kurascroll-public-web-design.md

## Global Constraints

- No llamar a Sharp ni decodificar/transcodificar imágenes en ninguna ruta HTTP de carga.
- Aceptar CBZ/ZIP, PDF o varias imágenes ordenadas naturalmente.
- Procesar una página a la vez y liberar sus buffers después de subirla.
- Salida objetivo WebP, ancho máximo 1440 px y calidad aproximada 82.
- Rechazar fallback de MIME: no asignar extensión WebP si el navegador produjo PNG/JPEG.
- Máximo 250 MiB por fuente, 10 000 entradas ZIP, ratio 200:1, 1 GiB expandido/salida, 50 MiB por imagen fuente y 5 000 páginas.
- Cuota por cuenta configurable; valor inicial de despliegue 10 GiB.
- No reemplazar un capítulo duplicado ni publicar contenido parcialmente cargado.
- Conservar todos los cambios de usuario previos y no ejecutar limpieza destructiva de git.

## Review Focus

- ZIP dañado, cifrado, con rutas repetidas o ratio abusivo: falla localmente con un mensaje comprensible y nunca publica.
- PDF vacío/dañado o página demasiado grande: cancela el trabajo antes de crear el capítulo.
- Navegador no soporta codificación WebP: avisa antes de aceptar el capítulo y no etiqueta una imagen con MIME incorrecto.
- Interrupción de red tras algunas páginas: el usuario reintenta y el backend conserva solo páginas ya confirmadas de su carga.
- Dos subidas concurrentes del mismo capítulo o cuota agotada: una recibe conflicto/cuota; archivos y DB no se sobrescriben.

---

## Mapa de archivos

- Crear src/backend/db/migrations/002_client_uploads.sql.
- Crear src/backend/services/client-processed-upload-service.ts y src/backend/routes/client-upload-routes.ts.
- Integración del orquestador en src/backend/app.ts sin editar handlers ajenos a la carga.
- Crear frontend/src/workers/chapter-processor.worker.ts.
- Crear frontend/src/services/chapter-processor-client.ts y upload-api-client.ts.
- Crear frontend/src/components/upload/UploadWizard.tsx y UploadProgress.tsx.
- Crear frontend/src/pages/UploadPage.tsx e integrar navegación en el punto reservado por el plan de identidad.
- Integración del orquestador en frontend/package.json y package-lock.json para PDF.js y un lector ZIP incremental adecuado.
- Actualizar docs/deployment/public-web.md con límites y flujo de ingesta.

## Interfaces compartidas

- CreateUploadInput: seriesId o newSeries { title, type }, chapterNumber, volumeNumber?, chapterTitle?.
- UploadSession: id, expiresAt, confirmedPages number[], status open|publishing|complete|failed.
- UploadPageMetadata: pageNumber, fileName, width, height, aspectRatio, byteLength, mimeType image/webp, sha256.
- ChapterManifest: ordered pages, pageCount, totalBytes y metadata de serie/capítulo.
- createUpload(input): Promise<UploadSession>.
- getUploadStatus(uploadId): Promise<UploadSession>.
- putUploadPage(uploadId, metadata, Blob): Promise<void>.
- finalizeUpload(uploadId, manifest): Promise<{ chapterId, seriesSlug, pageCount }>.
- cancelUpload(uploadId): Promise<void>.

### Tarea 1: introducir dependencias de procesamiento web

**Archivos:**

- Integración del orquestador en frontend/package.json y frontend/package-lock.json.
- Revisar la configuración de workers en frontend/vite.config.ts.

- [ ] Añadir PDF.js para renderizar PDFs en navegador usando su worker.
- [ ] Añadir un lector ZIP compatible con navegador y lectura incremental, sin expandir el archivo completo a RAM.
- [ ] Confirmar que el worker de Vite resuelve módulos y assets PDF.js desde el build.
- [ ] Mantener las versiones compatibles con Node 20+ y los navegadores destino.
- [ ] No añadir un conversor nativo de servidor para compensar incompatibilidad de navegador.

### Tarea 2: implementar worker para ZIP e imágenes

**Archivos:**

- Crear frontend/src/workers/chapter-processor.worker.ts.
- Crear frontend/src/services/chapter-processor-client.ts.

- [ ] Aceptar File, configuración de capítulo y mensajes de cancelación.
- [ ] Para ZIP, validar cantidad de entradas, extensión, tamaño, ratio y total expandido antes de aceptar páginas.
- [ ] Mantener solo páginas PNG, JPEG, WebP, AVIF y GIF de primer cuadro que el navegador pueda decodificar.
- [ ] Ordenar nombres con orden natural y preservar subcarpetas en el desempate.
- [ ] Decodificar una página, respetar orientación de imagen, reducir a 1440 píxeles de ancho y producir WebP a calidad 0.82.
- [ ] Dividir tiras verticales que excedan el límite de dimensión WebP en segmentos contiguos con orden estable.
- [ ] Enviar progreso por página y total estimado, responder a cancelación y liberar ImageBitmap/Canvas/ArrayBuffer al terminar cada página.
- [ ] Verificar blob.type; fallar explícitamente si el encoder devolvió un formato distinto de WebP.
- [ ] Producir UploadPageMetadata con dimensión, nombre determinista, tamaño y SHA-256.

### Tarea 3: procesar PDF de forma secuencial

**Archivos:**

- Modificar frontend/src/workers/chapter-processor.worker.ts.
- Modificar frontend/src/services/chapter-processor-client.ts.

- [ ] Abrir el PDF con PDF.js usando su worker separado y rechazar documento vacío o ilegible.
- [ ] Renderizar una página a la vez con ancho de salida máximo de 1440 px.
- [ ] Convertir la página renderizada a WebP, verificar MIME y registrar dimensiones/suma.
- [ ] Liberar la página PDF.js y el canvas antes de renderizar la siguiente.
- [ ] Rechazar archivos fuente mayores a 250 MiB y documentos que superen los límites de página/bytes.
- [ ] Permitir cancelar el render y mostrar en UI la página actual.

### Tarea 4: crear staging de cargas en SQLite y disco

**Archivos:**

- Crear src/backend/db/migrations/002_client_uploads.sql.
- Crear src/backend/services/client-processed-upload-service.ts.
- Modificar src/backend/repositories/series-repository.ts y chapter-repository.ts solo para métodos de commit transaccional.
- Modificar src/backend/routes/series-routes.ts y chapter-routes.ts para servir solo contenido con visibility_status published.

- [ ] Crear upload_sessions con id aleatorio, user_id, destino, límite reservado, estado, fecha de expiración y manifiesto final.
- [ ] Añadir a series created_by y visibility_status; añadir a chapters uploaded_by, visibility_status y storage_bytes. Las filas previas conservan propietario NULL, estado publicado y cuota heredada no atribuida.
- [ ] Guardar las páginas bajo una carpeta aleatoria dentro de STORAGE_ROOT/.tmp/client-uploads; no aceptar rutas locales del cliente.
- [ ] Asociar el ID de carga a sessionIdentity y verificar propietario en status, put, finalize y cancel.
- [ ] Transmitir cada body a un archivo temporal con contador de bytes y hash; mantener como máximo una página activa por carga.
- [ ] Rechazar página no WebP por firma/MIME, número repetido con hash distinto, más de 5 000 páginas, más de 50 MiB por página o más de 1 GiB total.
- [ ] Rechazar si la cuota del usuario excedería 10 GiB o el límite configurado; contabilizar capítulos existentes del usuario.
- [ ] Hacer que status devuelva páginas confirmadas y que repetir una misma página con el mismo hash sea idempotente.
- [ ] Expirar cargas a las 24 horas y limpiar staging de manera segura al iniciar y en tarea de bajo impacto.

### Tarea 5: publicar capítulo validado

**Archivos:**

- Modificar src/backend/services/client-processed-upload-service.ts.
- Modificar src/backend/db/migrations/002_client_uploads.sql.
- Modificar src/backend/repositories/series-repository.ts y chapter-repository.ts.

- [ ] Validar manifiesto: páginas contiguas 1..N, nombres seguros, mime WebP, tamaños/dimensiones finitos y bytes totales exactos.
- [ ] Rechazar capítulo existente con HTTP 409 sin reemplazar archivo ni filas.
- [ ] Crear serie básica dentro del commit solo cuando la carga final valida toda la información.
- [ ] Registrar uploaded_by y created_by desde sessionIdentity, nunca desde JSON.
- [ ] Guardar estado publishing antes del rename, mover staging a la ruta final en el mismo volumen y luego confirmar capítulo/páginas y estado complete en SQLite.
- [ ] En el arranque, reconciliar sesiones publishing: completar desde manifiesto válido o borrar destino huérfano; nunca exponer filas sin archivos.
- [ ] Si finalize se repite después de complete, devolver el mismo chapterId y resultado.

### Tarea 6: exponer API de subida streaming

**Archivos:**

- Crear src/backend/routes/client-upload-routes.ts.
- Integración del orquestador en src/backend/app.ts.

- [ ] Implementar POST /api/v1/uploads para crear sesión con JSON pequeño.
- [ ] Implementar GET /api/v1/uploads/:uploadId para estado y páginas confirmadas.
- [ ] Implementar PUT /api/v1/uploads/:uploadId/pages/:pageNumber como stream octet-stream o parte multipart; no cargar el capítulo entero en request.body.
- [ ] Ajustar límite de cuerpo solo para la ruta de página; conservar 1 MiB global en el resto de API.
- [ ] Implementar POST /api/v1/uploads/:uploadId/complete y DELETE /api/v1/uploads/:uploadId.
- [ ] Implementar retiro de capítulo solo para uploaded_by o admin; conservar el registro con estado removed para que el progreso histórico no desaparezca.
- [ ] Al retirar, borrar los archivos y manifiestos de página, poner storage_bytes en cero y preservar la fila de capítulo/progreso para no perder historia.
- [ ] Excluir de catálogo, ficha, manifiesto, exportación pública e imágenes cualquier serie/capítulo hidden o removed.
- [ ] Limitar a una carga activa por usuario y aplicar rate limit.
- [ ] Devolver 401/403/409/413/415/429 con mensajes utilizables y sin rutas físicas internas.

### Tarea 7: construir asistente de subida

**Archivos:**

- Crear frontend/src/services/upload-api-client.ts.
- Crear frontend/src/components/upload/UploadWizard.tsx y UploadProgress.tsx.
- Crear frontend/src/pages/UploadPage.tsx.
- Integrar la navegación mediante el punto reservado por el plan de identidad.

- [ ] Requerir sesión verificada antes de mostrar el selector de archivos.
- [ ] Permitir elegir serie o crear ficha básica, capítulo, volumen y título.
- [ ] Aceptar un CBZ/ZIP, un PDF o un conjunto de imágenes, y mostrar límites antes del proceso.
- [ ] Consultar estado de carga y reanudar con el mismo archivo cuando coincida su huella; reenviar solo páginas no confirmadas.
- [ ] Mostrar fase de preparación/subida, página actual, bytes enviados, cancelación y reintento.
- [ ] Mostrar conflicto de duplicado, cuota, formato no soportado, red y error de almacenamiento sin limpiar otros datos del usuario.
- [ ] Al completar, navegar a la ficha pública del capítulo y refrescar catálogo.

### Tarea 8: revisión de la ingesta

- [ ] Ejecutar npm run build desde la raíz y resolver errores de TypeScript/Vite.
- [ ] Revisar el camino HTTP y confirmar que no importa Sharp, PDF.js ni un extractor ZIP del backend.
- [ ] Inspeccionar los handlers para confirmar streaming y límites independientes del navegador.
- [ ] Hacer revisión manual de ZIP, PDF, imágenes, cancelación, reintento, duplicado, cuota y limpieza de staging.
- [ ] Revisar que el lector existente abra las páginas WebP publicadas y que el manifiesto preserve su orden.
