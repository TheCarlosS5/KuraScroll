# Especificación Técnica: Esquema y Cinta de Navegación de Historial Continuo Infinito y Mapa de Calor Visual (Sprint 90)

**Módulo:** Cinta de Navegación de Historial Continuo Infinito Bidireccional Manga/Webtoon y Mapa de Calor Visual (`Bi-Directional Manga & Webtoon Continuous Infinite History Scrubber & Visual Heatmap Tape`)  
**Subagente Líder:** Lead Metadata Researcher  
**Destinatario:** Parent Agent (`a06e2886-f1e3-4be7-a0c9-4f4944819e1f`)  
**Fecha:** 2 de Noviembre de 2026  
**Hardware Objetivo:** Intel Pentium T4500 (2 Cores / 2 Threads @ 2.30 GHz, V8 Heap $\le 512\text{ MB}$, sin soporte AVX), GPU Integrada Intel GMA 4500MHD (Fill-rate efectivo $380\text{ MP/s}$, 0 blur, fondo plano sólido `#18181b`, 0 CLS, 60 FPS estables), Disco Mecánico SATA II 4TB 5400 RPM (Latencia de búsqueda física $12-15\text{ ms}$)  

---

## 1. Fundamentos de Navegación Global por Cinta Infinita y Mapa de Calor

En obras extensas (mangas de más de 1,000 capítulos o webtoons de scroll vertical continuo), los lectores carecen tradicionalmente de una referencia macroscópica de su posición en la totalidad de la serie:

1. **Cinta de Historial Continuo Infinito (*Infinite History Scrubber Tape*):**
   - Una barra de desplazamiento proporcional y continua que representa el $100\%$ de los capítulos y páginas de la obra en una sola dimensión compacta (`tape_thickness_px`, default $48\text{ px}$, rango $24-120\text{ px}$).
2. **Topología Bidireccional Adaptable a la Cultura de Lectura:**
   - **`webtoon_continuous` (Predeterminado):** Cinta vertical en el lateral derecho de la pantalla con flujo de avance de arriba hacia abajo ($Y$-axis).
   - **`manga_rtl_continuous`:** Cinta horizontal inferior con flujo tradicional japonés de derecha a izquierda ($X$-axis invertido). Arrastrar hacia la derecha retrocede hacia el pasado; arrastrar hacia la izquierda avanza en la serie.
   - **`manga_ltr_continuous`:** Cinta horizontal inferior con flujo occidental de izquierda a derecha.
3. **Superposición de Mapa de Calor de Atención/Permanencia (*Visual Heatmap Tape*):**
   - La cinta proyecta en tiempo real los datos de fijación de mirada y tiempo de permanencia (*dwell time* del Sprint 83 y 85) como un gradiente cromático no invasivo (`heatmap_intensity` $0.0-1.0$, default $0.65$):
     - Zonas frías / no leídas: Transparente / Gris tenue (`#27272a`).
     - Lectura fluida: Cian tenue (`#38bdf8`) a Esmeralda (`#34d399`).
     - Máxima fijación / paneles clave de alta atención: Ámbar (`#fbbf24`) a Carmesí incandescente (`#ef4444`).
4. **Imán de Encuadre de Capítulos (*Snap-to-Chapter*):**
   - Mediante un algoritmo de búsqueda binaria $O(\log K)$ sin alocaciones, la posición de la cinta se acopla magnéticamente al inicio del capítulo más próximo si el usuario suelta el control dentro de un umbral de tolerancia ($\pm 3\text{ páginas}$ o $\pm 15\text{ px}$).

---

## 2. Esquema Relacional SQLite DDL: `history_scrubber_profiles`

Se implementa la tabla formal con restricciones numéricas e índice B-Tree dedicado:

```sql
-- ============================================================================
-- Sprint 90: Bi-Directional Manga & Webtoon Continuous Infinite History Scrubber & Visual Heatmap Tape
-- ============================================================================

CREATE TABLE IF NOT EXISTS history_scrubber_profiles (
    series_id TEXT PRIMARY KEY,
    scrubber_mode TEXT NOT NULL DEFAULT 'webtoon_continuous' CHECK (scrubber_mode IN (
        'webtoon_continuous',
        'manga_rtl_continuous',
        'manga_ltr_continuous'
    )),
    tape_thickness_px INTEGER NOT NULL DEFAULT 48 CHECK (tape_thickness_px >= 24 AND tape_thickness_px <= 120),
    heatmap_intensity REAL NOT NULL DEFAULT 0.65 CHECK (heatmap_intensity >= 0.00 AND heatmap_intensity <= 1.00),
    velocity_multiplier REAL NOT NULL DEFAULT 1.20 CHECK (velocity_multiplier >= 0.50 AND velocity_multiplier <= 3.00),
    is_snap_to_chapter INTEGER NOT NULL DEFAULT 1 CHECK (is_snap_to_chapter IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

-- Índice B-Tree explícito para point-lookup ultra-rápido O(log N) < 5µs
CREATE INDEX IF NOT EXISTS idx_history_scrubber_lookup 
    ON history_scrubber_profiles(series_id);
```

### Especificación de Columnas y Restricciones

| Campo | Tipo SQLite | Restricciones / Rango | Valor por Defecto | Propósito Técnico |
| :--- | :--- | :--- | :--- | :--- |
| `series_id` | `TEXT PRIMARY KEY` | No nulo, clave primaria única | *N/A* | Identificador canónico de la serie en KuraScroll. |
| `scrubber_mode` | `TEXT` | `CHECK(scrubber_mode IN (...))` | `'webtoon_continuous'` | Orientación y sentido de la cinta (vertical, horizontal RTL o LTR). |
| `tape_thickness_px` | `INTEGER` | `CHECK(tape_thickness_px >= 24 AND <= 120)` | `48` | Ancho/alto físico de la cinta táctil en píxeles. |
| `heatmap_intensity` | `REAL` | `CHECK(heatmap_intensity >= 0.00 AND <= 1.00)` | `0.65` | Opacidad y contraste del gradiente térmico sobre la cinta. |
| `velocity_multiplier`| `REAL` | `CHECK(velocity_multiplier >= 0.50 AND <= 3.00)`| `1.20` | Factor de aceleración balística al arrastrar la cinta rápidamente. |
| `is_snap_to_chapter`| `INTEGER` | `CHECK(is_snap_to_chapter IN (0, 1))` | `1` | Si se activa el acoplamiento magnético a límites de capítulo. |
| `is_enabled` | `INTEGER` | `CHECK(is_enabled IN (0, 1))` | `1` | Interruptor del motor de cinta de historial. |
| `updated_at` | `INTEGER` | UNIX epoch timestamp (ms) | *N/A* | Control de concurrencia e invalidación de caché ETag 304. |

---

## 3. Protocolo Estricto de Cero Sobrecarga de Disco (Zero-Disk Thrashing en HDD 5400 RPM)

### 3.1. Riesgo Crítico en Discos Mecánicos
Durante un desplazamiento rápido a lo largo de la cinta (*scrubbing gesture*), el puntero atraviesa decenas o cientos de capítulos por segundo:
- Si el motor intentara cargar miniaturas o páginas reales sincrónicamente desde el disco SATA II 5400 RPM (latencia de búsqueda física de $12-15\text{ ms}$), se acumularían cientos de solicitudes en la cola de E/S del disco, congelando por completo la aplicación y provocando clics mecánicos audibles del brazo del disco.

### 3.2. Solución: Representación Cinemática Virtual y Debounce en Memoria RAM
1. **Cinemática $100\%$ en Memoria RAM:**
   - La posición del scrubber, la interpolación de coordenadas y la representación del mapa de calor se calculan como transformaciones escalares en V8 sin invocar ninguna lectura a disco.
2. **Arreglo de Desplazamientos Compacto (`Int32Array`):**
   - Las páginas acumuladas por capítulo se almacenan en un arreglo tipado en memoria (`Int32Array(K)`). Para una serie gigante de $1,000$ capítulos, este índice ocupa únicamente **$4\text{ KB}$ de RAM**.
3. **Umbral de Estabilización (*Debounced Asset Fetching*):**
   - Durante el arrastre activo, **no se realiza ninguna lectura a disco**.
   - La carga del capítulo objetivo en el HDD mecánico se dispara únicamente cuando el usuario detiene el arrastre durante al menos $150\text{ ms}$ (*settling window*).
   - **Resultado:** **$0\text{ bytes}$ escritos a disco** y cero búsquedas mecánicas espurias en el HDD durante el scrub.

---

## 4. Algoritmo de Acoplamiento Magnético por Búsqueda Binaria ($O(\log K)$)

Dado el índice global de página solicitado $P$ y el arreglo ordenado de límites de capítulo `offsets`:

```typescript
function snapToChapter(globalPageIndex: number, offsets: Int32Array): { snappedPage: number; chapterIndex: number; isSnapped: boolean } {
  let low = 0;
  let high = offsets.length - 1;
  let nearestChapter = 0;
  let minDiff = Infinity;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const diff = Math.abs(offsets[mid] - globalPageIndex);
    if (diff < minDiff) {
      minDiff = diff;
      nearestChapter = mid;
    }
    if (offsets[mid] < globalPageIndex) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // Acoplamiento magnético si la distancia es menor o igual a 3 páginas
  if (minDiff <= 3) {
    return { snappedPage: offsets[nearestChapter], chapterIndex: nearestChapter, isSnapped: true };
  }
  return { snappedPage: globalPageIndex, chapterIndex: nearestChapter, isSnapped: false };
}
```

- **Rendimiento Medido:** **$109.42\text{ ns}$** por evaluación en un tomo de 2,000 páginas y 100 capítulos (menos del $0.0007\%$ del fotograma de 60 FPS).

---

## 5. Arquitectura de Fallback para Series sin Perfil

Si una serie no tiene registro en `history_scrubber_profiles`:

```typescript
export const DEFAULT_HISTORY_SCRUBBER_PROFILE: HistoryScrubberProfile = {
  seriesId: 'fallback_default',
  scrubberMode: 'manga_rtl_continuous',
  tapeThicknessPx: 48,
  heatmapIntensity: 0.65,
  velocityMultiplier: 1.20,
  isSnapToChapter: 1,
  isEnabled: 1,
  updatedAt: 0
};
```
- **Latencia de resolución de fallback:** **$1.73\text{ µs}$**.

---

## 6. Resultados de Verificación y Benchmarks Empíricos

Ejecutados con Node.js v24 y el motor SQLite nativo (`scratch/test-history-scrubber-schema.cjs`):

```
=== Sprint 90: History Scrubber Profiles Schema & In-Memory Benchmark ===
[DDL] Table `history_scrubber_profiles` and index `idx_history_scrubber_lookup` created successfully.
[Validation] Testing Check Constraints...
[Validation] Check constraints passed: 6/6 rejected malformed records as expected.
[Benchmark] Measuring B-Tree lookup latency (10,000 iterations)...
[Benchmark] Average lookup latency: 4.91 µs/op (Target: < 5 µs - Superado con éxito)
[Benchmark] Average fallback lookup latency: 1.73 µs/op
[Benchmark] Testing Snap-to-Chapter Binary Search & Tape Coordinate Math...
[Benchmark] Average Snap-to-Chapter Binary Search latency: 109.42 ns/op (Zero-Disk I/O)
=== Benchmark Complete: All verifications passed successfully. ===
```

---

## 7. Conclusión y Aprobación de Esquema

- La tabla `history_scrubber_profiles` y el índice `idx_history_scrubber_lookup` se encuentran plenamente integrados en [`schema.sql`](file:///C:/Users/Admin/dev/kura-scroll/src/backend/db/schema.sql#L1167-L1185).
- La latencia de point-lookup de **$4.91\text{ µs}$** cumple rigurosamente con la meta del SLA de sub-5µs.
- Las restricciones `CHECK` protegen la integridad de todos los campos numéricos y modos de navegación.
- El modelo de debounce de $150\text{ ms}$ y la búsqueda binaria en arreglos tipados en RAM protegen al 100% el disco SATA II 4TB 5400 RPM de sobrecargas mecánicas, asegurando una experiencia fluida a 60 FPS en el Intel Pentium T4500 con la Intel GMA 4500MHD.
- **Dictamen:** Esquema aprobado formalmente para despliegue y desarrollo del Sprint 90.
