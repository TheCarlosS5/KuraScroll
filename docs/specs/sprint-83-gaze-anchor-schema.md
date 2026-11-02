# Especificación Técnica: Esquema y Motor de Trayectoria Predictiva de Mapa de Calor de Mirada y Restaurador Anti-Desviación (Sprint 83)

**Módulo:** Motor de Trayectoria Predictiva de Mapa de Calor de Mirada y Restaurador Anti-Desviación de Fijación Ocular (`Predictive Gaze Heatmap Trajectory & Eye Fixation Anti-Drift Restorer Engine / GazeAnchor`)  
**Subagente Líder:** Lead Metadata Researcher  
**Destinatario:** Parent Agent (`a06e2886-f1e3-4be7-a0c9-4f4944819e1f`)  
**Fecha:** 2 de Noviembre de 2026  
**Hardware Objetivo:** Intel Pentium T4500 (2 Cores, 2.30 GHz, V8 Heap $\le 512\text{ MB}$, sin soporte AVX), GPU Integrada Intel GMA 4500MHD (Fill-rate efectivo $380\text{ MP/s}$, 0 blur, fondo plano sólido `#18181b`, 0 CLS, 60 FPS estables), Disco Mecánico SATA II 4TB 5400 RPM  

---

## 1. Fundamentos Psicooculares y Dinámica de Seguimiento Ocular

El seguimiento de la mirada del lector durante el consumo de manga, cómic o webtoon no puede tratarse como un cursor de ratón convencional. El sistema visual humano exhibe patrones cinemáticos discretos y ruido biológico involuntario:

1. **Fijaciones Oculares (*Fixations*) y Umbral de Permanencia (*Dwell Time*):**
   - Períodos cuasi-estáticos donde la fóvea procesa texto y arte ($200-350\text{ ms}$, calibrado con un valor por defecto de $250\text{ ms}$ en un rango de $50-1000\text{ ms}$).
2. **Movimientos Sacádicos (*Saccades*) y Barridos de Retorno (*Return Sweeps*):**
   - Saltos balísticos ultrarrápidos ($20-40\text{ ms}$, velocidades de $300^\circ-900^\circ/\text{s}$) entre centros de atención visual:
     - **Manga Tradicional (`manga_rtl`):** Flujo de derecha a izquierda y de arriba a abajo. Al agotar una línea de viñetas, se produce un *Return Sweep* balístico desde el margen izquierdo hacia el margen derecho del panel inferior siguiente.
     - **Cómic Occidental (`manga_ltr`):** Flujo de izquierda a derecha; el *Return Sweep* viaja de derecha a izquierda.
     - **Webtoon (`webtoon`):** Flujo continuo vertical en tira. La mirada permanece concentrada en el corredor central ($60\%$ del ancho de pantalla), con sacadas predominantemente verticales y micro-ajustes de sincronización con el scroll continuo.
3. **Temblor Fisiológico, Nistagmo y Desviación Involuntaria (*Ocular Drift*):**
   - Durante una fijación, el ojo humano experimenta un micro-derrape fisiológico involuntario ($< 30\text{ arcmin}$). Los rastreadores de pupila basados en webcam o sensores infrarrojos traducen este micro-derrape en oscilaciones parásitas de alta frecuencia ($30-60\text{ Hz}$). Sin una zona muerta de supresión de temblor (*deadband filtering*), la interfaz sufriría *camera shudder* y desencadenaría cinetosis o pérdida de foco.
4. **Restaurador Anti-Desviación (*Anti-Drift Restorer*):**
   - Mediante un radio de tolerancia espacial configurable (`drift_tolerance_px`, default $40.0\text{ px}$, rango $[10.0, 200.0]$), cualquier micro-desplazamiento inferior a dicho radio que no alcance la velocidad sacádica ($v < v_{\text{saccade}}$) queda estrictamente bloqueado en el ancla focal de la viñeta actual, garantizando estabilidad visual absoluta con **0 Cumulative Layout Shift (CLS)**.

---

## 2. Esquema Relacional SQLite DDL: `gaze_anchor_profiles`

Se define la tabla relacional formal con restricciones de integridad numérica estrictas e índice B-Tree dedicado:

```sql
-- ============================================================================
-- Sprint 83: Predictive Gaze Heatmap Trajectory & Eye Fixation Anti-Drift Restorer
-- ============================================================================

CREATE TABLE IF NOT EXISTS gaze_anchor_profiles (
    series_id TEXT PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'manga_rtl' CHECK (mode IN ('webtoon', 'manga_rtl', 'manga_ltr')),
    saccade_sensitivity REAL NOT NULL DEFAULT 1.0 CHECK (saccade_sensitivity >= 0.1 AND saccade_sensitivity <= 3.0),
    dwell_threshold_ms INTEGER NOT NULL DEFAULT 250 CHECK (dwell_threshold_ms >= 50 AND dwell_threshold_ms <= 1000),
    drift_tolerance_px REAL NOT NULL DEFAULT 40.0 CHECK (drift_tolerance_px >= 10.0 AND drift_tolerance_px <= 200.0),
    return_anchor_enabled INTEGER NOT NULL DEFAULT 1 CHECK (return_anchor_enabled IN (0, 1)),
    heatmap_resolution TEXT NOT NULL DEFAULT 'medium' CHECK (heatmap_resolution IN ('low', 'medium', 'high')),
    updated_at INTEGER NOT NULL
);

-- Índice B-Tree explícito para point-lookup ultra-rápido O(log N)
CREATE INDEX IF NOT EXISTS idx_gaze_anchor_lookup 
    ON gaze_anchor_profiles(series_id);
```

### Especificación de Columnas y Restricciones

| Campo | Tipo SQLite | Restricciones / Validación | Valor por Defecto | Propósito Técnico |
| :--- | :--- | :--- | :--- | :--- |
| `series_id` | `TEXT PRIMARY KEY` | No nulo, clave primaria única | *N/A* | Identificador canónico de la serie en KuraScroll. |
| `mode` | `TEXT` | `CHECK(mode IN ('webtoon', 'manga_rtl', 'manga_ltr'))` | `'manga_rtl'` | Topología cinemática de lectura para predicción sacádica. |
| `saccade_sensitivity` | `REAL` | `CHECK(saccade_sensitivity >= 0.1 AND <= 3.0)` | `1.0` | Multiplicador de umbral de velocidad para clasificar sacadas vs fijaciones. |
| `dwell_threshold_ms` | `INTEGER` | `CHECK(dwell_threshold_ms >= 50 AND <= 1000)` | `250` | Milisegundos mínimos de permanencia para registrar una fijación en el heatmap. |
| `drift_tolerance_px` | `REAL` | `CHECK(drift_tolerance_px >= 10.0 AND <= 200.0)` | `40.0` | Radio de zona muerta en píxeles para filtrar temblor y nistagmo involuntario. |
| `return_anchor_enabled`| `INTEGER` | `CHECK(return_anchor_enabled IN (0, 1))` | `1` | Si está habilitada la anticipación predictiva del barrido de retorno (*Return Sweep*).|
| `heatmap_resolution` | `TEXT` | `CHECK(heatmap_resolution IN ('low', 'medium', 'high'))` | `'medium'` | Granularidad de la malla espacial acumulativa (`16x16`, `32x32`, `64x64`). |
| `updated_at` | `INTEGER` | Marca de tiempo UNIX epoch (ms) | *N/A* | Control de concurrencia e invalidación de caché ETag 304. |

---

## 3. Protocolo Estricto de Cero Sobrecarga de Disco (Zero-Disk Thrashing en HDD 5400 RPM)

### 3.1. Análisis del Riesgo Catastrófico de E/S en Disco Mecánico
Un rastreador de mirada emite eventos de telemetría a una frecuencia continua de $30\text{ Hz}$ a $60\text{ Hz}$.
- En el disco mecánico del sistema (4TB 5400 RPM SATA II), el tiempo de búsqueda física promedio (*average seek time*) es de $\approx 9.79\text{ ms}$.
- Si se escribiera cada coordenada o fijación directamente a SQLite en disco:
  $$\text{Tiempo de búsqueda por segundo} = 60 \times 9.79\text{ ms} = 587.4\text{ ms/segundo}$$
  Esto consumiría cerca del **$60\%$ de la capacidad operativa física de las cabezas del disco**, colapsando la cola de E/S (*I/O queue saturation*), provocando congelamiento del audio ambiental (Sprint 73/82), caídas severas de cuadros ($< 15\text{ FPS}$) y bloqueos de escritura WAL en SQLite.

### 3.2. Arquitectura de Acumulación en Memoria RAM sin Asignación Dinámica
Para garantizar **Cero Sobrecarga de Disco (*Zero-Disk Thrashing*)**:
1. **Separación de Telemetría Transitoria vs Configuración:**
   - SQLite almacena **únicamente** la configuración del perfil por serie (`gaze_anchor_profiles`), consultada una sola vez al abrir el tomo y retenida en memoria.
2. **Matrices Tipadas de Huella Mínima en V8 Heap:**
   - La acumulación espacial del mapa de calor de mirada se almacena en memoria volátil utilizando buffers planos `Uint8Array` indexados por fila/columna:
     - `low`: Malla de $16 \times 16 = 256$ bytes (`Uint8Array(256)`).
     - `medium`: Malla de $32 \times 32 = 1024$ bytes ($1\text{ KB}$, `Uint8Array(1024)`).
     - `high`: Malla de $64 \times 64 = 4096$ bytes ($4\text{ KB}$, `Uint8Array(4096)`).
3. **Cálculo de Celda sin Alocación:**
   $$\text{col} = \lfloor x_{\text{norm}} \times W_{\text{grid}} \rfloor, \quad \text{row} = \lfloor y_{\text{norm}} \times H_{\text{grid}} \rfloor$$
   $$\text{index} = \text{row} \times W_{\text{grid}} + \text{col}$$
   El incremento `heatmapGrid[index]++` (con saturación en $255$) se ejecuta en apenas **$76.83\text{ ns}$**, con **0 bytes asignados al Garbage Collector** y **$0\text{ bytes}$ escritos a disco**.
4. **Persistencia Agregada Opcional:** Si el usuario decide guardar estadísticas de sesión, se realiza un volcado compacto por lotes (*batched write*) únicamente al cerrar el capítulo, nunca durante la lectura activa.

---

## 4. Arquitectura de Fallback para Series sin Perfil

Cuando una serie recién importada carece de registro en `gaze_anchor_profiles`, el sistema debe resolver su cinemática inmediatamente en tiempo $O(1)$ sin lanzar excepciones ni forzar escrituras sincrónicas en base de datos.

### Objeto Singleton de Fallback en Memoria
```typescript
export interface GazeAnchorProfile {
  seriesId: string;
  mode: 'webtoon' | 'manga_rtl' | 'manga_ltr';
  saccadeSensitivity: number;
  dwellThresholdMs: number;
  driftTolerancePx: number;
  returnAnchorEnabled: number;
  heatmapResolution: 'low' | 'medium' | 'high';
  updatedAt: number;
}

export const DEFAULT_GAZE_ANCHOR_PROFILES: Record<'manga_rtl' | 'webtoon' | 'manga_ltr', GazeAnchorProfile> = {
  manga_rtl: {
    seriesId: 'fallback_default',
    mode: 'manga_rtl',
    saccadeSensitivity: 1.0,
    dwellThresholdMs: 250,
    driftTolerancePx: 40.0,
    returnAnchorEnabled: 1,
    heatmapResolution: 'medium',
    updatedAt: 0
  },
  webtoon: {
    seriesId: 'fallback_default',
    mode: 'webtoon',
    saccadeSensitivity: 1.0,
    dwellThresholdMs: 250,
    driftTolerancePx: 40.0,
    returnAnchorEnabled: 1,
    heatmapResolution: 'medium',
    updatedAt: 0
  },
  manga_ltr: {
    seriesId: 'fallback_default',
    mode: 'manga_ltr',
    saccadeSensitivity: 1.0,
    dwellThresholdMs: 250,
    driftTolerancePx: 40.0,
    returnAnchorEnabled: 1,
    heatmapResolution: 'medium',
    updatedAt: 0
  }
};
```

### Resolución de Fallback Basada en Metadatos
1. Si `gaze_anchor_profiles` contiene una fila para `series_id`, se retorna dicha fila (lookup de **$5.87\text{ µs}$**).
2. Si la fila no existe, se consulta el tipo de lectura en los metadatos de la serie (`series.reading_direction` o `series.type`):
   - Series `webtoon` / `manhwa` / `vertical` $\to$ Se adopta `DEFAULT_GAZE_ANCHOR_PROFILES.webtoon`.
   - Series `comic` / `ltr` $\to$ Se adopta `DEFAULT_GAZE_ANCHOR_PROFILES.manga_ltr`.
   - Series `manga` / `rtl` (o no determinado) $\to$ Se adopta `DEFAULT_GAZE_ANCHOR_PROFILES.manga_rtl`.
- Latencia de resolución de fallback medida en benchmark: **$1.85\text{ µs}$**.

---

## 5. Algoritmo Anti-Desviación Ocular y Manejo de Casos de Borde

### 5.1. Formulación Matemática del Restorer Anti-Drift
Sean $(x_t, y_t)$ las coordenadas oculares reportadas en el instante $t$, y $(x_{\text{anchor}}, y_{\text{anchor}})$ la coordenada del ancla focal actual:

$$\Delta x = x_t - x_{\text{anchor}}, \quad \Delta y = y_t - y_{\text{anchor}}$$
$$d^2 = (\Delta x)^2 + (\Delta y)^2$$

Evaluación de zona muerta (*deadband condition*):
$$\text{Posición Bloqueada} = 
\begin{cases} 
(x_{\text{anchor}}, y_{\text{anchor}}) & \text{si } d^2 \le (\text{drift\_tolerance\_px})^2 \\
(x_t, y_t) & \text{si } d^2 > (\text{drift\_tolerance\_px})^2 \text{ y } v > v_{\text{saccade}}
\end{cases}$$

- La comparación utiliza el cuadrado de la distancia ($d^2 \le \text{tol}^2$), eliminando la llamada costosa a `Math.sqrt()` y reduciendo la latencia de evaluación a **$69.13\text{ ns}$**.

### 5.2. Manejo de Casos de Borde (Edge Cases)

1. **Coordenadas Fuera de Límites (*Out-of-Bounds Clamping*):**
   - Si el rastreador ocular reporta coordenadas erráticas fuera de la pantalla (e.g. $x = -150$, $y = 9999$), se aplican abrazaderas rígidas inmediatas:
     $$x_{\text{clamped}} = \max(0, \min(W_{\text{viewport}}, x)), \quad y_{\text{clamped}} = \max(0, \min(H_{\text{viewport}}, y))$$
2. **Valores `NaN` o `null`:**
   - Si la API del rastreador emite valores indeterminados por parpadeo (*blink*) o pérdida de rostro, el sistema descarta la muestra sin lanzar errores y retiene el último ancla válido conocido.
3. **Tiempos de Permanencia Negativos (*Negative Dwell Time*):**
   - Valores menores a $0\text{ ms}$ (debidos a desincronizaciones de reloj en clientes remotos) son forzados a $0\text{ ms}$ mediante `Math.max(0, dwellTime)` o rechazados por la validación del esquema Fastify.
4. **Idempotencia y Caché ETag 304:**
   - La cabecera ETag se deriva determinísticamente de `W/"${series_id}-${updated_at}"`. Si el cliente envía `If-None-Match`, el servidor Fastify retorna `304 Not Modified` evitando lecturas repetitivas a la base de datos.

---

## 6. Resultados de Verificación y Benchmarks Empíricos

Ejecutados en el entorno de desarrollo sobre Node.js v24 y el motor SQLite nativo (`scratch/test-gaze-anchor-schema.cjs`):

```
=== Sprint 83: GazeAnchor Profiles Schema & In-Memory Benchmark ===
[DDL] Table `gaze_anchor_profiles` and index `idx_gaze_anchor_lookup` created successfully.
[Validation] Testing Check Constraints...
[Validation] Check constraints passed: 5/5 rejected malformed records as expected.
[Benchmark] Measuring B-Tree lookup latency (10,000 iterations)...
[Benchmark] Average lookup latency: 5.87 µs/op
[Benchmark] Measuring fallback resolution latency (10,000 iterations)...
[Benchmark] Average fallback resolution latency: 1.85 µs/op
[Benchmark] Testing Anti-Drift Deadband & Clamping Math...
[Benchmark] Average Anti-Drift deadband eval latency: 69.13 ns/op
[Benchmark] Testing In-Memory Heatmap Accumulation (Uint8Array 32x32)...
[Benchmark] Average In-Memory Heatmap update latency: 76.83 ns/op (Zero-Disk I/O, <1KB RAM)
=== Benchmark Complete: All verifications passed successfully. ===
```

---

## 7. Conclusión y Estado de Integración

- La tabla `gaze_anchor_profiles` y el índice `idx_gaze_anchor_lookup` han sido integrados en el archivo central [`schema.sql`](file:///C:/Users/Admin/dev/kura-scroll/src/backend/db/schema.sql).
- Las restricciones `CHECK` garantizan la sanitización estricta de modos de lectura, rangos de sensibilidad sacádica, umbrales de permanencia y tolerancias espaciales.
- El protocolo de almacenamiento en matrices tipadas en memoria (`Uint8Array`) garantiza una ejecución con **Cero Sobrecarga de Disco**, preservando la integridad del disco mecánico SATA II 4TB 5400 RPM y la fluidez de lectura a 60 FPS en el hardware objetivo.
