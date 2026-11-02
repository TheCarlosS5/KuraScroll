# ChatGPT Senior Architectural Blueprint: Sprint 42
## Automated Storage Compaction, SQLite WAL Checkpoint Tuning & Orphan Image Garbage Collector

**Consultor Senior:** ChatGPT (Sesión Brave `Colaboración en proyecto - Brave`)  
**Fecha:** Noviembre 2026  
**Objetivo:** Diseñar el servicio de mantenimiento y compactación de almacenamiento para el host **Intel Pentium T4500 (2C/2T @ 2.30 GHz)** y disco mecánico **4TB SATA II (~80 IOPS)**, eliminando imágenes huérfanas sin seek storms, estabilizando el archivo WAL y recuperando espacio fragmentado con `incremental_vacuum`.

---

## 1. El Peligro del "Seek Storm" en Disco Mecánico de 4TB
En un disco de 5400/7200 RPM con 12-15ms de latencia radial por búsqueda:
- Un escaneo recursivo indiscriminado de cientos de miles de archivos satura por completo la cola de I/O de Windows, elevando la latencia de los lectores activos de 15ms a más de 3000ms.
- **Directiva Senior:** Escaneo particionado por serie/capítulo en lotes (`chunks` de 25-50 archivos), coordinado exclusivamente a través de `IOCoordinator` con `IOPriority.BACKGROUND`.
- Si entra una lectura interactiva de usuario (`IOPriority.CRITICAL`), el garbage collector cede el paso de inmediato en `PauseGate` (< 15ms SLA).

---

## 2. Detección y Recolección de Imágenes Huérfanas

### 2.1 Reglas de Retención (Archivos Protegidos)
Nunca deben ser eliminados:
1. Archivos registrados en `chapter_pages.file_name`.
2. Archivos registrados en `series.cover_image`.
3. Archivos estructurales: `ComicInfo.xml`, `.gitkeep`, `manifest.json`.

### 2.2 Algoritmo de Diferencia en Memoria (Set Difference)
Para cada directorio de capítulo `series/{slug}/{chapterNum}/`:
1. `diskFiles = readdirSync(...)`
2. `dbFiles = db.prepare('SELECT file_name FROM chapter_pages WHERE chapter_id = ?').all(chapterId)`
3. `orphans = diskFiles.filter(f => !dbFilesSet.has(f) && !isProtected(f))`
4. Eliminar `orphans` en background y contabilizar bytes recuperados.

---

## 3. Sintonización de SQLite WAL e Incremental Vacuum

### 3.1 Puntos de Control WAL
- **`PRAGMA wal_checkpoint(PASSIVE)`**: Modo en caliente. Escribe todos los frames de transacciones pasadas al archivo `.db` principal que no interfieran con lectores activos. Cero bloqueos.
- **`PRAGMA wal_checkpoint(TRUNCATE)`**: Solo ejecutable cuando la base de datos esté libre de lectores, truncando el archivo `-wal` a 0 bytes.

### 3.2 `PRAGMA auto_vacuum = INCREMENTAL`
- `VACUUM` tradicional bloquea la base de datos entera y reescribe todo el archivo en una copia temporal (devastador para un disco de 4TB).
- Con `auto_vacuum = 2` (INCREMENTAL), se ejecuta:
  ```sql
  PRAGMA incremental_vacuum(250);
  ```
  Esto devuelve hasta 250 páginas libres (1 MB) al sistema operativo en pasos discretos de menos de 10ms cada uno.

---

## 4. Estructura de Endpoints Fastify
- **`POST /api/v1/admin/maintenance/compact`**: Ejecuta el pase de recolección de basura y compactación WAL, devolviendo métricas completas.
- **`GET /api/v1/admin/maintenance/status`**: Reporta tamaño de la BD, tamaño de WAL, páginas libres (`freelist_count`), y estado del recolector.

---

## 5. Criterios de Aceptación para Sprint 42
- [ ] `StorageCompactorService` implementado con eliminación segura de huérfanos y límites por lote.
- [ ] Ejecución en `IOPriority.BACKGROUND` con pausa automática si hay lectores activos.
- [ ] `PRAGMA wal_checkpoint(PASSIVE)` y `PRAGMA incremental_vacuum` integrados.
- [ ] Rutas Fastify de mantenimiento operativas.
- [ ] Suite de pruebas unitarias y de resiliencia con 100% PASS.
- [ ] Monorepo build y SLA audit sin regresiones.
