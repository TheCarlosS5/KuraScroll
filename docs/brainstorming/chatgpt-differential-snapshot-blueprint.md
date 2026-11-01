# Blueprint Arquitectónico: Differential Library Snapshot & Export Mirroring
> **Consultoría Senior:** ChatGPT (Sesión Brave `Colaboración en proyecto - Brave`)  
> **Fecha:** 2026-11-01  
> **Host Target:** Laptop Legacy Intel Pentium T4500 (2C/2T @ 2.30GHz, 3GB-4GB RAM, SATA II, HDD 4TB).

---

## 1. Problema de Respaldo en Grandes Bibliotecas (4TB HDD)
- En un HDD de 4TB conectado por SATA II (con transferencias reales sostenidas de ~60–90 MB/s), copiar o comprimir una biblioteca completa de 500GB o 2TB puede demorar entre 4 y 10 horas y elevar la temperatura del disco y procesador.
- La duplicación recursiva de archivos sin verificar cambios desgasta innecesariamente el brazo radial del disco.

---

## 2. Estrategia de Respaldo Diferencial (Level 0 / Level 1)

### 2.1 Componentes del Snapshot
1. **Instantánea Atómica de Base de Datos:**
   - Ejecución de `VACUUM INTO <dest>/database.db`.
   - Garantiza consistencia transaccional absoluta (cero lecturas corruptas de SQLite WAL).
2. **Manifiesto de Respaldo (`snapshot-manifest.json`):**
   - Contiene metadatos, timestamp, número de series, capítulos respaldados y hash SHA-256 de la base de datos.
3. **Copia Incremental de Archivos WebP:**
   - Si es diferencial: solo copia capítulos registrados con `created_at > last_snapshot_time` o cuya carpeta no exista aún en el directorio de destino.
   - Si el archivo `.webp` ya existe en el destino con idéntico tamaño en bytes, se omite su copia.

### 2.2 Control de I/O y Presión en Memoria (T4500)
- Inserción de pausas cooperativas (`adaptiveController.acquireYieldSlice()` o 15ms) entre capítulos transferidos.
- Copia directa a nivel de sistema de archivos (`fs.copyFile`) para que el kernel de Windows use DMA (Direct Memory Access) sin pasar buffers por el heap de Node.js V8.
