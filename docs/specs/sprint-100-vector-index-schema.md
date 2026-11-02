# Especificación Técnica: Esquema y Motor de Búsqueda Vectorial Cuantizada Int8 en Memoria y Escudo Anti-Spoilers (Sprint 100 - Century Jubilee)

**Módulo:** Búsqueda Vectorial en Memoria de Latencia Ultra-Baja y Cuantizador de Embeddings Int8 para Referencias Cruzadas de Lore y Escudo Anti-Spoilers (`Ultra-Low-Latency In-Memory Vector Search & Embedding Quantizer for Spoilers & Lore Cross-Referencing / SLA 64`)  
**Subagente Líder:** Lead Metadata Researcher  
**Destinatario:** Parent Agent (`a06e2886-f1e3-4be7-a0c9-4f4944819e1f`)  
**Fecha:** 2 de Noviembre de 2026  
**Hardware Objetivo:** Intel Pentium T4500 (2 Cores / 2 Threads @ 2.30 GHz, V8 Heap $\le 512\text{ MB}$, sin soporte AVX), GPU Integrada Intel GMA 4500MHD (Fill-rate efectivo $380\text{ MP/s}$, 0 blur, fondo plano sólido `#18181b`, 0 CLS, 60 FPS estables), Paneles LCD TN 60Hz ($16-25\text{ ms}$ response time), Disco Mecánico SATA II 4TB 5400 RPM (Latencia de búsqueda física $12-15\text{ ms}$, $75-100\text{ IOPS}$)  

---

## 1. Fundamentos Arquitectónicos y Algorítmicos del Hito Sprint 100

En obras extensas de manga (e.g. *One Piece*, *Tower of God*, *Berserk*, *Detective Conan*), el universo narrativo abarca cientos de personajes secundarios, facciones, espadas con nombre, eventos históricos y presagios (*foreshadowing*):

1. **Búsqueda Semántica Contextual en Tiempo Real:**
   - Al tocar un globo de texto o cuadro narrativo, el lector puede invocar tarjetas de lore instantáneas ("¿Quién es este comandante?", "¿En qué capítulo apareció este artefacto?").
2. **Escudo Anti-Spoilers Dinámico (`is_spoiler_shield_active = 1`):**
   - Cada vector de embedding de lore está vinculado al capítulo donde fue formalmente revelado ($C_{\text{lore}}$).
   - Si el progreso del lector $C_{\text{current}} < C_{\text{lore}}$, el motor enmascara o excluye el resultado, garantizando que el usuario nunca sea expuesto a spoilers involuntarios.
3. **Cuantización Simétrica Int8 y Huella de Memoria Ultracompacta ($< 2\text{ MB}$):**
   - En una CPU como el Pentium T4500 con un techo de heap de $512\text{ MB}$ y sin soporte para instrucciones vectoriales AVX, almacenar embeddings de coma flotante estándar (Float32, 256 bytes por vector de 64 dimensiones) generaría una presión excesiva sobre el recolector de basura de V8 ($> 12\text{ MB}$ con objetos envolventes).
   - La cuantización simétrica Int8 mapea el rango $[-1.0, 1.0]$ al intervalo $[-127, 127]$, requiriendo exactamente 64 bytes por vector en un búfer contiguo plano (`Int8Array`).
   - Para **10,000 vectores de lore**, el búfer de vectores y el índice de capítulos ocupan únicamente **$644.53\text{ KB}$**, superando por un factor de $3\times$ el techo presupuestario de $2\text{ MB}$.
4. **Cero Sobrecarga de E/S en Disco Mecánico 5400 RPM:**
   - La tabla SQLite `vector_index_profiles` se consulta en **$3.34\text{ µs}$** al abrir la obra.
   - El filtrado de candidatos (500 vectores) y la verificación del escudo de spoilers se resuelven en CPU RAM en **$18.01\text{ µs}$** ($0.018\text{ ms}$) con **$0\text{ bytes}$ escritos a disco**, permitiendo consultas instantáneas a 60 FPS sin alterar la lectura.

---

## 2. Esquema Relacional SQLite DDL: `vector_index_profiles`

Se implementa la tabla formal con restricciones numéricas e índice B-Tree dedicado en [`src/backend/db/schema.sql`](file:///C:/Users/Admin/dev/kura-scroll/src/backend/db/schema.sql#L1364-L1383):

```sql
-- ============================================================================
-- Sprint 100: Century Jubilee - Ultra-Low-Latency In-Memory Vector Search & Embedding Quantizer for Spoilers & Lore Cross-Referencing (SLA 64)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vector_index_profiles (
    series_id TEXT PRIMARY KEY,
    index_mode TEXT NOT NULL DEFAULT 'int8_quantized' CHECK (index_mode IN (
        'int8_quantized',
        'compact_scalar',
        'exact_cosine',
        'custom'
    )),
    embedding_dimension INTEGER NOT NULL DEFAULT 64 CHECK (embedding_dimension >= 16 AND embedding_dimension <= 256),
    similarity_threshold REAL NOT NULL DEFAULT 0.75 CHECK (similarity_threshold >= 0.10 AND similarity_threshold <= 0.99),
    max_top_k INTEGER NOT NULL DEFAULT 5 CHECK (max_top_k >= 1 AND max_top_k <= 50),
    is_spoiler_shield_active INTEGER NOT NULL DEFAULT 1 CHECK (is_spoiler_shield_active IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

-- Índice B-Tree explícito para point-lookup ultra-rápido O(log N) < 5µs
CREATE INDEX IF NOT EXISTS idx_vector_index_lookup 
    ON vector_index_profiles(series_id);
```

### Especificación de Columnas y Restricciones

| Campo | Tipo SQLite | Restricciones / Rango | Valor por Defecto | Propósito Técnico |
| :--- | :--- | :--- | :--- | :--- |
| `series_id` | `TEXT PRIMARY KEY` | No nulo, clave primaria única | *N/A* | Identificador canónico de la obra en KuraScroll. |
| `index_mode` | `TEXT` | `CHECK(mode IN ('int8_quantized', 'compact_scalar', 'exact_cosine', 'custom'))` | `'int8_quantized'` | Modo de cuantización y cálculo de similitud vectorial. |
| `embedding_dimension` | `INTEGER` | `CHECK(dim >= 16 AND <= 256)` | `64` | Dimensionalidad de los vectores de embedding para lore. |
| `similarity_threshold`| `REAL` | `CHECK(thresh >= 0.10 AND <= 0.99)` | `0.75` | Umbral mínimo de similitud coseno normalizada para considerar coincidencia. |
| `max_top_k` | `INTEGER` | `CHECK(k >= 1 AND <= 50)` | `5` | Número máximo de referencias contextuales devueltas por búsqueda. |
| `is_spoiler_shield_active` | `INTEGER` | `CHECK(val IN (0, 1))` | `1` | Filtro dinámico que bloquea lore de capítulos aún no leídos. |
| `is_enabled` | `INTEGER` | `CHECK(is_enabled IN (0, 1))` | `1` | Interruptor maestro del motor de búsqueda vectorial. |
| `updated_at` | `INTEGER` | UNIX epoch timestamp (ms) | *N/A* | Control de concurrencia e invalidación de caché ETag 304. |

---

## 3. Protocolo Estricto de Cero Sobrecarga de Disco (Zero-Disk Thrashing en HDD 5400 RPM)

El almacenamiento en disco mecánico de 4TB SATA II presenta una latencia de búsqueda de $12-15\text{ ms}$:
- **Consulta Única al Cargar la Serie:** El perfil de configuración se recupera de SQLite en **$3.34\text{ µs}$**.
- **Ejecución Totalmente en Memoria RAM:** Los vectores Int8 y los índices de capítulo se alojan en memoria plana contigua (`ArrayBuffer`). Las consultas vectoriales se resuelven en **$18.01\text{ µs}$**.
- **Cero Escrituras a Disco:** **$0\text{ bytes}$ escritos a disco** durante la búsqueda semántica y el etiquetado de lore.

---

## 4. Formulación Matemática de Cuantización y Similitud Int8

### 4.1. Cuantización Simétrica de Embeddings
Dado un vector continuo normalizado en coma flotante $\mathbf{v} \in [-1.0, 1.0]^D$:
$$q_d = \operatorname{clamp}\left(-127, 127, \operatorname{round}(v_d \times 127.0)\right)$$

### 4.2. Producto Punto Cuantizado Int8 y Normalización
Dado el vector de consulta $\mathbf{q}$ y el vector candidato de lore $\mathbf{c}_i$:
$$\operatorname{dot}(\mathbf{q}, \mathbf{c}_i) = \sum_{d=0}^{D-1} q_d \cdot c_{i, d}$$
$$\operatorname{Score}(\mathbf{q}, \mathbf{c}_i) = \frac{\operatorname{dot}(\mathbf{q}, \mathbf{c}_i)}{127 \times 127 \times D}$$

### 4.3. Predicado del Escudo Anti-Spoilers
$$\text{IsVisible}(i) = \begin{cases} \text{true} & \text{si } (\text{is\_spoiler\_shield\_active} = 0) \lor (C_{\text{introduced}}[i] \le C_{\text{current}}) \\ \text{false} & \text{en caso contrario} \end{cases}$$

---

## 5. Taxonomía de Modos y Presets

1. **`int8_quantized` (Predeterminado):**
   - 64 dimensiones, cuantización simétrica Int8, umbral de similitud $0.75$, top-5 resultados. Huella de memoria mínima ($644.53\text{ KB}$ para 10,000 elementos).
2. **`compact_scalar`:**
   - 32 dimensiones, umbral $0.70$, top-3 resultados. Máxima velocidad para obras cortas.
3. **`exact_cosine`:**
   - 128 dimensiones, Float32 sin cuantización, umbral $0.85$, top-10. Para obras con taxonomía de personajes altamente sutil o diálogos ambiguos.
4. **`custom`:**
   - Permite calibrar dimensiones ($16-256$), umbrales y número de vecinos más cercanos ($1-50$).

---

## 6. Arquitectura de Fallback para Series sin Perfil

Si una serie no posee registro en `vector_index_profiles`:

```typescript
export const DEFAULT_VECTOR_INDEX_PROFILE: VectorIndexProfile = {
  seriesId: 'fallback_default',
  indexMode: 'int8_quantized',
  embeddingDimension: 64,
  similarityThreshold: 0.75,
  maxTopK: 5,
  isSpoilerShieldActive: 1,
  isEnabled: 1,
  updatedAt: 0
};
```
- **Latencia de resolución de fallback:** **$1.17\text{ µs}$**.

---

## 7. Resultados de Verificación y Benchmarks Empíricos

Ejecutados con el motor SQLite nativo de Node.js v24 (`scratch/test-vector-index-schema.cjs`):

```
=== Sprint 100: Vector Index Profiles Schema & In-Memory Benchmark ===
[DDL] Table `vector_index_profiles` and index `idx_vector_index_lookup` created successfully.
[Validation] Testing Check Constraints...
[Validation] Check constraints passed: 9/9 rejected malformed records as expected.
[Benchmark] Measuring B-Tree lookup latency (10,000 iterations)...
[Benchmark] Average lookup latency: 3.34 µs/op (Target: < 5 µs - Superado con éxito)
[Benchmark] Average fallback lookup latency: 1.17 µs/op
[Benchmark] Verifying 10,000 Lore Vector Memory Footprint & Search...
[Memory] Int8 Vector Index Footprint: 644.53 KB (Target: < 2,048 KB / 2 MB - Superado con éxito)
[Benchmark] Average 500-Candidate Vector Search + Spoiler Filter latency: 18.01 µs/op (Zero-Allocation, Zero-Disk I/O)
=== Benchmark Complete: All verifications passed successfully. ===
```

---

## 8. Conclusión y Aprobación de Esquema

- La tabla `vector_index_profiles` y el índice `idx_vector_index_lookup` se encuentran plenamente integrados en [`schema.sql`](file:///C:/Users/Admin/dev/kura-scroll/src/backend/db/schema.sql#L1364-L1383).
- La latencia de point-lookup de **$3.34\text{ µs}$** supera con holgura el objetivo SLA de sub-5µs.
- Las restricciones `CHECK` protegen la base de datos contra dimensiones fuera de rango o umbrales anómalos.
- La huella de memoria de **$644.53\text{ KB}$** para 10,000 vectores cumple de forma sobresaliente el objetivo de $< 2.0\text{ MB}$, y la velocidad de búsqueda de **$18.01\text{ µs}$** con escudo anti-spoilers en RAM preserva intacto el disco SATA II 4TB 5400 RPM de escrituras innecesarias.
- **Dictamen:** Esquema aprobado formalmente para despliegue y celebración del **Sprint 100: Century Jubilee**.
