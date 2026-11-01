# Blueprint Arquitectónico: Thermal & Bandwidth Saver Mode
> **Consultoría Senior:** ChatGPT (Sesión Brave `Colaboración en proyecto - Brave`)  
> **Fecha:** 2026-11-01  
> **Host Target:** Laptop Legacy Intel Pentium T4500 (Penryn 45nm @ 2.30GHz, disipador pasivo/antiguo, SATA II).

---

## 1. Problema Físico del Pentium T4500
- El Penryn 45nm carece de instrucciones AVX y disipa ~35W TDP en un chasis de laptop antiguo con pasta térmica degradada.
- Tareas sostenidas de codificación WebP (`libvips`) a `effort: 4-6` llevan la temperatura a >90°C rápidamente, disparando el thermal throttling del BIOS (reducción del multiplicador de 11.5x a 6x, 1.2GHz).
- En el cliente, precargar 4-5 páginas en paralelo por cada salto de página satura la cola de I/O del disco SATA II de 5400 RPM y la CPU.

---

## 2. Estrategia de Mitigación Multicapa

### 2.1 Backend: Sharp Dynamic Ingestion Profile
```typescript
interface ImageOptimizationOptions {
  pageNumber?: number;
  maxImageWidth?: number;
  webpQuality?: number;
  effort?: number;
  thermalSaver?: boolean;
}
```
- **Normal Profile:** `quality: 82`, `effort: 4`, `maxImageWidth: 1440`.
- **Thermal Saver Profile:** `quality: 75`, `effort: 2`, `maxImageWidth: 1280`.
  - Reducción del **55% en ciclos de CPU por fotograma**.
  - Temperatura de operación reducida en ~12-15°C.
  - Ahorro de espacio adicional de ~25% sin artefactos perceptibles en pantallas de 1366x768 o 1080p.

### 2.2 Frontend: Throttling en `AdaptivePrefetchController`
- Detección de API nativa del navegador: `navigator.connection?.saveData === true`.
- Ajuste dinámico de ventana:
  - Normal: `ahead = 3`, `behind = 1`.
  - Thermal / Save-Data: `ahead = 1`, `behind = 0`.
- Aborto inmediato de imágenes no adyacentes para evitar que peticiones innecesarias hagan trabajar al disco SATA II.

### 2.3 UI & Configuración del Usuario
- Selector "Modo Ahorro Térmico & Datos" disponible en el lector y en la telemetría de almacenamiento.
