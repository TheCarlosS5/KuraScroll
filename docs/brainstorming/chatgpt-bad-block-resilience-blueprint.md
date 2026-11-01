# Blueprint Arquitectónico: Bad Block Resilience & Image Integrity Scanner
> **Consultoría Senior:** ChatGPT (Sesión Brave `Colaboración en proyecto - Brave`)  
> **Fecha:** 2026-11-01  
> **Host Target:** Laptop Legacy Intel Pentium T4500 (2C/2T @ 2.30GHz, 3GB-4GB RAM, SATA II, HDD 4TB a 5400 RPM).

---

## 1. Problema de Sectores Defectuosos en HDDs Mecánicos
- Un disco mecánico de 4TB en una laptop puede desarrollar sectores defectuosos (*bad blocks*) por vibraciones o cortes de energía.
- Si un archivo `.webp` queda truncado o con ceros (`\0\0\0\0`), invocar Sharp sobre él gasta ciclos de CPU intentando decodificarlo, y si Fastify intenta servirlo, un error 500 rompe la experiencia de lectura del usuario.

---

## 2. Estrategia de Verificación en Dos Fases (Two-Phase Integrity Check)

### 2.1 Fase 1: Fast Header Check (Cero Carga de CPU)
- Leer únicamente los primeros 16 bytes del archivo:
  - Offset 0–3: `RIFF` (0x52, 0x49, 0x46, 0x46)
  - Offset 8–11: `WEBP` (0x57, 0x45, 0x42, 0x50)
  - Tamaño de archivo > 64 bytes.
- Si falla, el archivo está corrupto o truncado de inmediato sin consumir memoria de libvips ni calentar la CPU.

### 2.2 Fase 2: Deep Decodability Check (Sharp Concurrency = 1)
- Ejecutar `sharp(filePath).metadata()` a baja prioridad para confirmar que las tablas VP8/VP8X no tienen bloques truncados.

---

## 3. Degradación Elegante en Fastify (Graceful Reader Fallback)
- Si una página sufre un error de I/O de disco (`EIO`, sector dañado) o cabecera rota:
  - Se registra el evento en `corrupt_files_log`.
  - Se sirve una imagen WebP de reemplazo ligera (placeholder "Página no disponible en disco") con código 200, permitiendo al usuario continuar leyendo sin que la aplicación colapse.

---

## 4. Esquema SQLite
```sql
CREATE TABLE IF NOT EXISTS corrupt_files_log (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    chapter_id TEXT,
    error_reason TEXT NOT NULL,
    detected_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'pending_repair' CHECK(status IN ('pending_repair', 'repaired', 'quarantined'))
);
```
