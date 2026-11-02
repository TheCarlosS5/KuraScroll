# Sprint 47 Benchmark Report: Hybrid FTS5 + Int8 Quantized Vector Search + RRF

**Fecha:** 2 Noviembre 2026  
**Entorno de Ejecución:** Windows 10 x64  
**Hardware de Referencia:** Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, 1MB L2 cache, 512MB RAM cap), Western Digital 4TB SATA II HDD (5400/7200 RPM, 75-100 IOPS), Intel GMA 4500MHD GPU.  
**SLA Targets:**
- 1,000 Int8 Vector Memory Scan Latency: $< 1.0000\text{ ms}$
- Reciprocal Rank Fusion (RRF k=60) Latency: $< 0.0500\text{ ms}$
- Memory Footprint per Vector: $\le 384\text{ bytes}$ (75% de ahorro frente a Float32)
- GMA 4500MHD GPU Compliance: 0 CSS blur, 0 backdrop-filter, 0 CLS

---

## 1. Resultados Empíricos de Rendimiento

### A. Escaneo Vectorial en Memoria (Int8 Quantized Dot Product, 384 dimensiones)
* **Vectores en el Almacén Activo:** 1,000 series
* **Dimensiones por Vector:** 384 (`Int8Array`)
* **Huella de Memoria RAM:** **375 KB** (10,000 series consumirían apenas **3.75 MB**, muy por debajo del límite de 512MB)
* **Corridas Evaluadas:** 500 iteraciones
* **Tiempo Total Transcurrido:** 271.47 ms
* **Latencia Media por Escaneo Completo:** **0.5429 ms** (SLA $< 1.0000\text{ ms}$ $\to$ **1.8x más rápido**)
* **Throughput de Escaneo:** **1,842 búsquedas/seg**
* **Rendimiento de Producto Punto:** **1,841,819 operaciones/segundo**
* **Optimizaciones:** Desenrollado 8x (`unrolled loop`) en JavaScript V8, evitando asignaciones de objetos durante el ciclo de cálculo de similitud coseno.

### B. Fusión Recíproca de Rangos (Reciprocal Rank Fusion, RRF $k=60$)
* **Candidatos Fusionados:** 50 léxicos (FTS5) + 50 semánticos (Vector)
* **Iteraciones:** 5,000 fusiones
* **Tiempo Total Transcurrido:** 95.33 ms
* **Latencia Media por Fusión:** **0.0191 ms (19.1 µs)** (SLA $< 0.0500\text{ ms}$ $\to$ **2.6x más rápido**)
* **Throughput de Fusión:** **52,448 fusiones/seg**
* **Efecto de Doble Coincidencia:** Una obra en el puesto #1 léxico y #1 semántico recibe una puntuación RRF de **0.03278**, duplicando a las obras que solo coinciden en un motor (**0.01639**).

---

## 2. Auditoría de Seguridad GPU y Experiencia de Usuario (GMA 4500MHD)

| Característica | Implementación | Cumplimiento |
|---|---|---|
| **Filtros Gráficos** | Sin `backdrop-filter`, sin `filter: blur()`, fondos con alpha lineal | 100% PASS (Zero Compositor Stalls) |
| **Estabilidad de Layout** | Dimensiones fijas en insignias de resultado (`contain: layout paint`) | 0 CLS |
| **Explicabilidad Otaku** | Distinción visual: `Híbrido 92%` (Violeta/Cian), `Semántico 85%` (Cian), `Exacto` (Esmeralda) | 100% Legible |

---

## 3. Estado de Verificación
* Tests Unitarios de Utilidades Cuantizadoras: **5/5 PASS** (96 ms)
* Tests Unitarios de Servicio Híbrido: **5/5 PASS** (34 ms)
* Tests de Rutas Fastify: **3/3 PASS** (244 ms)
* Tests de Frontend React: **3/3 PASS** (58 ms)
* Benchmark de Latencia: **2/2 PASS** (429 ms)
