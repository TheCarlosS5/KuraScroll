# Blueprint Arquitectónico: Adaptive Ingestion Controller & Self-Healing Indexer
> **Consultoría Senior:** ChatGPT (Sesión Brave `Colaboración en proyecto - Brave`)  
> **Fecha:** 2026-11-01  
> **Hardware:** Intel Pentium T4500 (2C/2T @ 2.30GHz, SSSE3), 3GB-4GB RAM, SATA II, HDD 4TB (5400 RPM).

---

## 1. Módulo 1: Adaptive Ingestion Controller (AIC)

### 1.1 Estados y Máquina de Estados
El controlador gestiona el ritmo de la ingesta en segundo plano para proteger en todo momento la experiencia de lectura en Fastify:
- **`RUNNING` (Normal):** Ingesta activa. Pausa cooperativa de 15ms entre imágenes convertidas.
- **`THROTTLED` (Atenuado):** La API o la memoria muestran síntomas de estrés. Pausa cooperativa se eleva a 150ms–250ms.
- **`PAUSED` (Suspendido):** Lecturas intensivas en curso (`apiP95 > 500ms`) o memoria RSS crítica (`> 380MB`). El worker no toma nuevos trabajos de la cola.

### 1.2 Métricas de Control con Histéresis
1. **Latencia API Fastify (`apiP95`):**
   - Muestreo circular de las últimas 50 solicitudes de lectura de páginas y manifiestos.
   - `apiP95 > 500ms` $\rightarrow$ `PAUSED` inmediato.
   - `apiP95 > 250ms` $\rightarrow$ `THROTTLED`.
   - Recuperación a `RUNNING`: `apiP95 < 150ms` sostenido durante al menos 5 segundos continuos (evita oscilaciones rápidas tipo *thrashing*).
2. **Presión de Memoria RSS (`process.memoryUsage().rss`):**
   - Límite T4500 (512MB V8 old space):
     - `RSS > 380 MiB` $\rightarrow$ `PAUSED` forzado + desalojo forzado de `ByteLRU`.
     - `RSS < 300 MiB` $\rightarrow$ Permite volver a reanudar.
3. **Event Loop Lag:**
   - Monitoreado con intervalo de drift (p.ej. `setInterval(100ms)`). Si el drift excede 100ms, el worker cede el paso.

---

## 2. Módulo 2: Self-Healing Indexer (SHI)

### 2.1 Fase de Arranque (Boot Recovery)
1. **Limpieza de Huérfanos:**
   - Buscar y eliminar de inmediato archivos `.part`, `.tmp` o subdirectorios temporales de descompresión huérfanos dejados por apagones o cierres abruptos de la laptop.
2. **Verificación de Integridad SQLite:**
   - Ejecutar `PRAGMA wal_checkpoint(TRUNCATE)` para consolidar el WAL.
   - Ejecutar `PRAGMA quick_check` para validar que el índice B-Tree y la tabla no tienen corrupción de bloques físicos.

### 2.2 Fase de Reconciliación Incremental (Anti-Saturación 4TB)
1. **Mtime High-Watermark:**
   - **Regla de Oro:** NUNCA hacer un recorrido recursivo completo (`readdir` de miles de carpetas) en cada arranque sobre el disco de 4TB (tardaría minutos y causaría un cuello de botella de I/O en SATA II).
   - Guardar en una tabla `folder_sync_state(folder_path TEXT PRIMARY KEY, last_mtime INTEGER)`.
   - Solo inspeccionar a fondo las carpetas cuyo `mtime` del sistema de archivos sea superior al registrado en la base de datos.
2. **Reconciliación de Capítulos a Medias:**
   - Verificar si hay capítulos con `status = 'processing'` o capítulos registrados en la BD sin imágenes en `chapter_pages`.
   - Si el directorio del capítulo contiene WebPs completas, regenerar el registro `chapter_pages`. Si está incompleto, marcar para reintento limpio.
3. **Portadas Faltantes (Missing Covers):**
   - Detectar series donde `cover_image_path` no apunta a un archivo físico existente.
   - Encolar la descarga / generación de la portada en segundo plano con `concurrency: 1`.
