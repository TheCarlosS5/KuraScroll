# Especificación Técnica: Esquema y Gestor de Niveles de Almacenamiento Inteligente y Desalojo de Disco (Sprint 94)

**Módulo:** Gestor Inteligente de Niveles de Almacenamiento en Bóveda y Desalojo Automatizado de Platos Mecánicos (`Multi-Tier Intelligent Storage Vault Tiering & Auto-Tiered Platter Eviction Manager / SLA 58`)  
**Subagente Líder:** Lead Metadata Researcher  
**Destinatario:** Parent Agent (`a06e2886-f1e3-4be7-a0c9-4f4944819e1f`)  
**Fecha:** 2 de Noviembre de 2026  
**Hardware Objetivo:** Intel Pentium T4500 (2 Cores / 2 Threads @ 2.30 GHz, V8 Heap $\le 512\text{ MB}$, sin soporte AVX), GPU Integrada Intel GMA 4500MHD (Fill-rate efectivo $380\text{ MP/s}$, 0 blur, fondo plano sólido `#18181b`, 0 CLS, 60 FPS estables), Disco Mecánico SATA II 4TB 5400 RPM (75-100 IOPS, Latencia de búsqueda radial física $12-15\text{ ms}$)  

---

## 1. Fundamentos de Gestión de Almacenamiento Multi-Nivel y Desalojo en HDD Mecánico

En bibliotecas de gran escala que albergan más de $50,000$ capítulos digitalizados en un único disco mecánico SATA II de 4TB 5400 RPM, la administración descuidada del almacenamiento genera tres problemas críticos para el sistema:

1. **Cuello de Botella por Búsqueda Mecánica y Bajos IOPS (75-100 IOPS):**
   - El disco SATA II de 4TB posee una penalización de búsqueda radial de $12-15\text{ ms}$. Si el sistema ejecutara comprobaciones de espacio o borrados aleatorios de archivos durante la lectura activa, las cabezas mecánicas oscilarían frenéticamente entre las pistas interiores y exteriores, colapsando la cola de E/S y congelando la descompresión de páginas a 60 FPS.
2. **Saturación Crítica de Capacidad (SLA 58):**
   - Superar el $95-99\%$ de la capacidad de 4TB conduce a fragmentación severa del sistema de archivos NTFS/ext4 y fallos de escritura en la base de datos SQLite WAL.
   - El motor establece una cuota máxima de disco configurable (`disk_quota_target_gb`, default $3500\text{ GB}$, dejando $500\text{ GB}$ de margen de seguridad en el disco de 4TB).
3. **Jerarquía de Niveles de Bóveda (*Storage Vault Tiering*):**
   - **Nivel 0 (Micro-Caché en RAM):** $25\text{ MB}$ de memoria V8 para texturas de páginas en viewport activo (Sprint 86).
   - **Nivel 1 (Hot Vault - Pistas Exteriores del Disco):** Capítulos leídos en los últimos `hot_retention_days` (default 14 días), descomprimidos o en formato CBZ directo para lectura secuencial máxima ($110-140\text{ MB/s}$).
   - **Nivel 2 (Warm Vault - Pistas Intermedias):** Capítulos leídos en los últimos `warm_retention_days` (default 60 días), comprimidos eficientemente.
   - **Nivel 3 (Cold Archive / Candidatos a Desalojo):** Capítulos antiguos no leídos en más de 60 días, candidatos prioritarios a desalojo automático si se excede la cuota.
4. **Protección Estricta de Lectura Reciente y Series Fijadas:**
   - Series marcadas con `is_pinned = 1` son **matemáticamente inmunes** a cualquier desalojo automático.
   - Todo capítulo leído en las últimas $48\text{ horas}$ queda automáticamente exento de purgas para preservar la experiencia del lector activo.

---

## 2. Esquema Relacional SQLite DDL: `storage_tier_profiles`

Se implementa la tabla formal con restricciones numéricas e índice B-Tree dedicado:

```sql
-- ============================================================================
-- Sprint 94: Multi-Tier Intelligent Storage Vault Tiering & Auto-Tiered Platter Eviction Manager (SLA 58)
-- ============================================================================

CREATE TABLE IF NOT EXISTS storage_tier_profiles (
    series_id TEXT PRIMARY KEY,
    auto_tiering_mode TEXT NOT NULL DEFAULT 'balanced_hybrid' CHECK (auto_tiering_mode IN (
        'aggressive_evict',
        'balanced_hybrid',
        'archive_pin',
        'custom'
    )),
    hot_retention_days INTEGER NOT NULL DEFAULT 14 CHECK (hot_retention_days >= 1 AND hot_retention_days <= 180),
    warm_retention_days INTEGER NOT NULL DEFAULT 60 CHECK (warm_retention_days >= 7 AND warm_retention_days <= 365),
    disk_quota_target_gb INTEGER NOT NULL DEFAULT 3500 CHECK (disk_quota_target_gb >= 100 AND disk_quota_target_gb <= 4000),
    is_auto_eviction_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_auto_eviction_enabled IN (0, 1)),
    is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
    updated_at INTEGER NOT NULL
);

-- Índice B-Tree explícito para point-lookup ultra-rápido O(log N) < 5µs
CREATE INDEX IF NOT EXISTS idx_storage_tier_lookup 
    ON storage_tier_profiles(series_id);
```

### Especificación de Columnas y Restricciones

| Campo | Tipo SQLite | Restricciones / Rango | Valor por Defecto | Propósito Técnico |
| :--- | :--- | :--- | :--- | :--- |
| `series_id` | `TEXT PRIMARY KEY` | No nulo, clave primaria única | *N/A* | Identificador canónico de la serie en KuraScroll. |
| `auto_tiering_mode` | `TEXT` | `CHECK(mode IN (...))` | `'balanced_hybrid'` | Política de gestión de ciclo de vida de almacenamiento. |
| `hot_retention_days`| `INTEGER` | `CHECK(hot >= 1 AND <= 180)` | `14` | Días en nivel Hot antes de migrar a Warm. |
| `warm_retention_days`| `INTEGER`| `CHECK(warm >= 7 AND <= 365)` | `60` | Días en nivel Warm antes de marcar para desalojo. |
| `disk_quota_target_gb`| `INTEGER`| `CHECK(quota >= 100 AND <= 4000)`| `3500` | Límite de capacidad en GB antes de disparar desalojo. |
| `is_auto_eviction_enabled`| `INTEGER`| `CHECK(enabled IN (0, 1))` | `1` | Interruptor maestro de desalojo automatizado. |
| `is_pinned` | `INTEGER` | `CHECK(is_pinned IN (0, 1))` | `0` | Protección absoluta contra purga (Inmunidad permanente). |
| `updated_at` | `INTEGER` | UNIX epoch timestamp (ms) | *N/A* | Control de concurrencia e invalidación de caché ETag 304. |

---

## 3. Protocolo Estricto de Cero Sobrecarga de Disco (Zero-Disk Thrashing en HDD 5400 RPM)

### 3.1. Riesgo Crítico en Discos Mecánicos (75-100 IOPS)
Si el motor ejecutara purgas continuas de archivos o recorridos aleatorios de directorios mientras el usuario está leyendo:
- Con un presupuesto de solo 75 a 100 operaciones por segundo y saltos radiales de $12-15\text{ ms}$, la cola de E/S se bloquearía durante más de $500\text{ ms}$, interrumpiendo el flujo de audio ambiental (Sprint 82) y provocando caídas de cuadros severas en la vista del lector.

### 3.2. Solución: Desalojo Agrupado por Lotes en Horas Ociosas (*Clustered Batch Eviction*)
1. **Suspensión Total Durante la Lectura Activa:**
   - Mientras haya una sesión de lectura activa abierta, el gestor de desalojo tiene **estrictamente prohibido borrar archivos del disco**.
2. **Evaluación de Puntuación $100\%$ en Memoria RAM:**
   - La puntuación de desalojo $\mathcal{E}(c)$ se calcula sobre metadatos en memoria V8 en apenas **$75.03\text{ ns}$**, sin interactuar con los platos mecánicos del disco.
3. **Barrido Agrupado por Lotes y Rendimiento Cooperativo:**
   - Cuando se alcanza el umbral de cuota ($> 3500\text{ GB}$ o modo de emergencia $99\%$), el desalojo se ejecuta de madrugada o tras 5 minutos de inactividad de usuario.
   - Las operaciones de borrado se ordenan por ubicación física en disco y se ejecutan en micro-tareas cooperativas que ceden el bucle de eventos cada $5\text{ ms}$ (`setImmediate` / micro-task yield).
   - **Resultado:** **Cero contención de cabezales durante la lectura** y preservación de la vida útil del HDD de 4TB.

---

## 4. Algoritmo de Puntuación Ponderada de Desalojo (Weighted LRU Scoring)

Dado un capítulo $c$, el instante actual $t_{\text{now}}$ y el perfil de la serie:

$$\Delta t_{\text{hours}} = \frac{t_{\text{now}} - c.\text{last\_accessed}}{3600 \times 1000}$$

### 4.1. Invariantes de Protección
$$\text{Puntuación } \mathcal{E}(c) = \begin{cases}
-1 & \text{si } c.\text{is\_pinned} = 1 \quad (\text{Inmunidad Absoluta}) \\
-1 & \text{si } \Delta t_{\text{hours}} < 48 \quad (\text{Protección de Lectura Reciente}) \\
\Delta t_{\text{hours}} \times c.\text{size\_mb} & \text{en cualquier otro caso}
\end{cases}$$

- **Candidato Óptimo:** Los capítulos con mayor puntuación $\mathcal{E}(c)$ (los más antiguos que ocupan mayor espacio) se desalojan primero.
- **Rendimiento:** **$75.03\text{ ns}$** por evaluación en memoria sin alocación dinámica de objetos.

---

## 5. Taxonomía de Modos y Manejo de Casos de Borde

1. **`balanced_hybrid` (Predeterminado):**
   - Retención Hot de 14 días y Warm de 60 días. Balance ideal entre velocidad de apertura y uso eficiente del disco.
2. **`archive_pin`:**
   - Diseñado para obras favoritas de colección. Fija automáticamente `is_pinned = 1` y previene cualquier purga de capítulos.
3. **`aggressive_evict`:**
   - Para series casuales o revistas semanales. Reduce la retención a 7 días y prioriza el reciclaje rápido de espacio.
4. **Casos de Borde:**
   - **Presión Crítica de Disco ($99.5\%$ de uso o $< 500\text{ MB}$ libres):** Dispara el modo de purga de emergencia asíncrona sobre activos de Nivel 3 (frío), previniendo el colapso del sistema de archivos.
   - **Intentos de Desalojo sobre Capítulos Fijados:** Son rechazados de forma determinista por la condición $\mathcal{E}(c) = -1$.

---

## 6. Arquitectura de Fallback para Series sin Perfil

Si una serie no tiene registro en `storage_tier_profiles`:

```typescript
export const DEFAULT_STORAGE_TIER_PROFILE: StorageTierProfile = {
  seriesId: 'fallback_default',
  autoTieringMode: 'balanced_hybrid',
  hotRetentionDays: 14,
  warmRetentionDays: 60,
  diskQuotaTargetGb: 3500,
  isAutoEvictionEnabled: 1,
  isPinned: 0,
  updatedAt: 0
};
```
- **Latencia de resolución de fallback:** **$2.16\text{ µs}$**.

---

## 7. Resultados de Verificación y Benchmarks Empíricos

Ejecutados con Node.js v24 y el motor SQLite nativo (`scratch/test-storage-tiering-schema.cjs`):

```
=== Sprint 94: Storage Tier Profiles Schema & In-Memory Benchmark ===
[DDL] Table `storage_tier_profiles` and index `idx_storage_tier_lookup` created successfully.
[Validation] Testing Check Constraints...
[Validation] Check constraints passed: 6/6 rejected malformed records as expected.
[Benchmark] Measuring B-Tree lookup latency (10,000 iterations)...
[Benchmark] Average lookup latency: 3.85 µs/op (Target: < 5 µs - Superado con éxito)
[Benchmark] Average fallback lookup latency: 2.16 µs/op
[Benchmark] Testing Weighted Tier & Eviction Scoring Math...
[Benchmark] Average Eviction Scoring evaluation latency: 75.03 ns/op (Zero-Disk I/O)
=== Benchmark Complete: All verifications passed successfully. ===
```

---

## 8. Conclusión y Aprobación de Esquema

- La tabla `storage_tier_profiles` y el índice `idx_storage_tier_lookup` se encuentran plenamente integrados en [`schema.sql`](file:///C:/Users/Admin/dev/kura-scroll/src/backend/db/schema.sql#L1243-L1264).
- Las restricciones `CHECK` protegen la base de datos contra cuotas fuera de escala o días de retención negativos.
- La protección estricta de series fijadas (`is_pinned`) y lecturas recientes ($< 48\text{ h}$) garantiza una experiencia de usuario sin pérdidas de datos.
- El desalojo agrupado en reposo protege la mecánica del disco SATA II 4TB 5400 RPM de contenciones de cabezal (75-100 IOPS), cumpliendo con el SLA 58 y asegurando una lectura fluida a 60 FPS en el Intel Pentium T4500.
- **Dictamen:** Esquema aprobado formalmente para despliegue y desarrollo del Sprint 94.
