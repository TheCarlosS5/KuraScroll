# Blueprint Arquitectónico: Optimización para Intel Pentium T4500 & HDD 4TB
> **Consultoría Senior:** ChatGPT (Sesión Brave `Colaboración en proyecto - Brave`)  
> **Fecha:** 2026-11-01  
> **Host Target:** Laptop/PC Legacy con CPU Intel Pentium T4500 (2C/2T @ 2.30GHz, SSSE3, sin AVX), 3GB-4GB RAM, Bus SATA II y HDD 4TB.

---

## 1. Veredicto Arquitectónico y Filosofía de Diseño

> **"KuraScroll debe ser lento importando una biblioteca enorme antes que volverse inutilizable mientras alguien está leyendo."**  
> — ChatGPT Senior Architect

Con 2 núcleos, 2 hilos, 3-4 GB de RAM y un HDD mecánico SATA II de 5400 RPM:
- Ya no optimizamos para exprimir el 100% de los núcleos.
- Optimizamos para **Low-Resource Mode Permanente**: garantizar que el servidor web Fastify mantenga latencia de lectura P95 < 200ms sin importar si en segundo plano se están ingestando 50 tomos.

---

## 2. Presupuestos de Memoria y Perfiles de Hardware

| Parámetro | Perfil Estándar (Moderno) | Perfil T4500 (4 GB RAM) | Perfil T4500 (3 GB RAM) |
|---|---|---|---|
| **Node `--max-old-space-size`** | 2048 MiB | **512 MiB** | **384 MiB** |
| **ByteLRU Caché WebP (RAM)** | 256 MiB | **16 MiB** | **8 MiB** |
| **ByteLRU Manifests (RAM)** | 32 MiB | **4 MiB** | **2 MiB** |
| **Tamaño Máximo por Entrada** | 10 MiB | **2 MiB** | **1.5 MiB** |
| **SQLite `cache_size`** | -64000 (~64 MiB) | **-2048 (~2 MiB)** | **-1024 (~1 MiB)** |
| **SQLite `mmap_size`** | 268435456 (256 MiB) | **0 (Desactivado)** | **0 (Desactivado)** |
| **SQLite `page_size`** | 4096 | **4096 (Alineado)** | **4096 (Alineado)** |
| **Concurrencia Sharp (`libvips`)** | Auto (según CPUs) | **1 (Estricto)** | **1 (Estricto)** |
| **Imágenes Concurrentes en Ingesta** | 4 | **1 (Secuencial)** | **1 (Secuencial)** |
| **Prioridad de Proceso Worker** | Normal | **`BelowNormal`** | **`BelowNormal`** |

---

## 3. Separación de Procesos y Prioridad de CPU en Windows

Para evitar que Sharp pegue ambos núcleos al 100% y congele la interfaz web o el sistema operativo:
1. **Proceso Principal (`KuraScroll API`):**
   - Corre con prioridad `Normal`.
   - Aloja Fastify, lectura estática de WebP y consultas de lectura SQLite WAL.
2. **Proceso / Worker de Ingestión (`KuraScroll Ingestion Worker`):**
   - Corre con prioridad `BelowNormal`.
   - Código nativo en Node.js:
     ```javascript
     import os from 'node:os';
     try {
       os.setPriority(process.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
     } catch (err) {
       console.warn('[Ingestion Worker] No se pudo reducir prioridad:', err.message);
     }
     ```
   - O vía lanzador de PowerShell:
     ```powershell
     Start-Process node -ArgumentList "src/backend/cli/ingest-worker.js" -Priority BelowNormal -NoNewWindow
     ```

---

## 4. Control Adaptativo de Ingesta (Adaptive Throttle)

La ingesta se autorregula dinámicamente monitoreando la latencia de la API y la memoria del sistema con histéresis:
```typescript
if (apiP95 > 500 || memoryPressure === 'high' || diskQueueDepth > 8) {
  pauseIngestion();
} else if (apiP95 < 200 && memoryPressure === 'normal') {
  resumeIngestion();
}
```

Reglas adicionales:
- No generar WebP si el archivo original ya está en WebP con dimensiones y calidad adecuadas.
- Pausas breves entre páginas procesadas (15ms sleep) para ceder tiempo de CPU al event loop.
- No ejecutar `VACUUM` ni respaldos en caliente durante sesiones de lectura activa.

---

## 5. Batería de Pruebas de Resiliencia para Hardware Modesto

ChatGPT propuso añadir pruebas específicas de degradación bajo presión:
1. **100 imágenes consecutivas a 1 hilo:** Probar que no hay acumulación de buffers en memoria nativa RSS.
2. **Ingesta + 10 solicitudes de lectura simultáneas:** Probar que Fastify responde en < 200ms sin verse afectada.
3. **SQLite WAL bajo escritura intensa:** Comprobar que los lectores no sufren bloqueos.
4. **50 capítulos consecutivos:** Validar RSS plano sin fugas.
5. **Worker cancelado abruptamente:** Recuperación sin archivos corruptos ni locks huérfanos.
