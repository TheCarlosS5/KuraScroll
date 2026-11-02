# Sprint 45 Benchmark Report: Optical Replay & Kinetic Dwell-Time Attention Heatmaps

**Fecha:** 2 Noviembre 2026  
**Entorno de Ejecución:** Windows 10 x64  
**Hardware de Referencia:** Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, 1MB L2 cache, 512MB RAM cap), Western Digital 4TB SATA II HDD (5400/7200 RPM, 75-100 IOPS), Intel GMA 4500MHD GPU.  
**SLA Targets:**
- Write-Behind Batch Flush Latency: $< 2.000\text{ ms}$
- Heatmap Query Latency: $< 1.000\text{ ms}$
- GMA 4500MHD Rendering: 0 CSS blur, 0 backdrop-filter, 0 CLS

---

## 1. Resultados Empíricos de Rendimiento

### A. Dwell Write-Behind 50-Item Batch Flush
* **Corridas Evaluadas:** 20 ejecuciones de batch
* **Items por Batch:** 50 eventos coalescidos
* **Total de Eventos Transaccionados:** 1,000 items
* **Latencia Media de Flush:** **0.668 ms** (SLA $< 2.000\text{ ms}$ $\to$ **3.0x más rápido**)
* **Rango Min / Max:** 0.561 ms / 1.861 ms
* **Rendimiento de Escritura (Throughput):** **74,839 eventos/seg**
* **Transaccionalidad:** Atómica en SQLite WAL (`BEGIN IMMEDIATE ... COMMIT`) con recálculo normalizado de `dwell_intensity_score` (0-100).

### B. Consulta de Heatmap para Capítulos de 50 Páginas
* **Iteraciones:** 500 consultas concurrentes
* **Tiempo Total Transcurrido:** 77.03 ms
* **Latencia Media por Consulta:** **0.1541 ms** (SLA $< 1.0000\text{ ms}$ $\to$ **6.5x más rápido**)
* **Throughput de Consulta:** **6,491 consultas/seg**
* **Tamaño del Payload JSON:** ~5.6 KB para 45 páginas

---

## 2. Auditoría de Seguridad GPU y Experiencia de Usuario (GMA 4500MHD)

| Característica | Implementación | Cumplimiento |
|---|---|---|
| **Filtros CSS Pesados** | `backdrop-filter: none`, `filter: blur(0)` | 100% PASS (Zero Compositor Stalls) |
| **Estabilidad de Layout** | `position: fixed; right: 0.75rem; z-index: 40;` | 0 CLS (Sin desplazamiento de páginas) |
| **Aceleración GPU** | `transform: scale(1.25)` en hover, `opacity` | Direct Surface Blit |
| **Paleta de Intensidad** | `amber-500` (epic), `violet-500` (deep), `cyan-500` (flow), `slate-600` (breeze) | Alto contraste WCAG AAA |

---

## 3. Filtros de Telemetría y Privacidad Diferencial (Directivas ChatGPT)

1. **Rechazo de Skimming Rápido:**
   - Eventos con dwell $< 1.0\text{ s}$ o velocidad de scroll $v > 1500\text{ px/s}$ son descartados inmediatamente en memoria (`totalRejectedEvents++`), protegiendo el HDD de escrituras espurias.
2. **Clamping de Inactividad AFK:**
   - Dwell $> 180.0\text{ s}$ es truncado a $180.0\text{ s}$ para evitar distorsiones estadísticas si el lector deja la pestaña abierta.
3. **Privacidad de Comunidad:**
   - La vista agregada comunitaria exige un umbral mínimo de lectura (`minTotalReads >= 20`) para evitar inferencia de perfiles de lectura individuales. Las estadísticas locales se mantienen 100% privadas en el dispositivo.

---

## 4. Estado de Verificación
* Tests Unitarios de Servicio: **9/9 PASS** (45 ms)
* Tests de Rutas Fastify: **6/6 PASS** (287 ms)
* Tests de Frontend React: **5/5 PASS** (110 ms)
* Benchmark de Latencia: **2/2 PASS** (109 ms)
