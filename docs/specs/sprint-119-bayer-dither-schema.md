# Informe de Investigación y Especificación Técnica: Sintetizador de Matriz de Dither Ordenado de Bayer y Desbande Subpíxel Adaptativo (Sprint 119)

**Módulo:** Sintetizador de Matriz de Dither Ordenado de Bayer y Desbande Subpíxel Adaptativo (`Adaptive Subpixel Color De-Banding & Ordered Bayer Dither Matrix Synthesizer / SLA 83`)  
**Subagente Líder:** Lead Metadata Researcher  
**Destinatario:** Parent Agent (`a06e2886-f1e3-4be7-a0c9-4f4944819e1f`)  
**Fecha:** 3 de Noviembre de 2026  
**Hardware Objetivo:** Intel Pentium T4500 (2 Cores / 2 Threads @ 2.30 GHz, 1MB L2 cache, V8 Heap $\le 512\text{ MB}$, sin soporte AVX), GPU Integrada Intel GMA 4500MHD (Fill-rate efectivo $380\text{ MP/s}$, 0 blur, fondo `#18181b`, 0 CLS, 60 FPS estables), Paneles LCD TN 60Hz ($16-25\text{ ms}$ response time, 6-bit nativo + FRC, contraste nativo $300:1$), Disco Mecánico SATA II 4TB 5400 RPM (Latencia de búsqueda física $12-15\text{ ms}$, $75-100\text{ IOPS}$)  

---

## 1. Fundamentos Matemáticos y Formulación de Matrices de Bayer

El tramado ordenado (*ordered dithering*) propuesto por Bryce Bayer en 1973 permite dispersar el error de cuantización en altas frecuencias espaciales mediante matrices recursivas ortogonales de potencia de dos ($N = 2^k$):

### 1.1 Construcción Recursiva de Matrices de Bayer
A partir de la semilla base $2 \times 2$:
$$M_2 = \begin{bmatrix} 0 & 2 \\ 3 & 1 \end{bmatrix}$$

La recursión para $M_{2N}$ se define como:
$$M_{2N} = \begin{bmatrix} 4 M_N & 4 M_N + 2 U_N \\ 4 M_N + 3 U_N & 4 M_N + 1 U_N \end{bmatrix}$$
donde $U_N$ es la matriz unitaria de orden $N \times N$.

Para las matrices canónicas implementadas en KuraScroll:
- **Matriz $4 \times 4$ ($N=4$, $16$ niveles):**
  $$M_4 = \begin{bmatrix} 0 & 8 & 2 & 10 \\ 12 & 4 & 14 & 6 \\ 3 & 11 & 1 & 9 \\ 15 & 7 & 13 & 5 \end{bmatrix}$$
- **Matriz $8 \times 8$ ($N=8$, $64$ niveles):**
  Abarca valores enteros discretos de $0$ a $63$.

### 1.2 Normalización a Offsets de Media Cero $[-0.5, 0.5]$
Para realizar desbande (*de-banding*) subpíxel sin provocar un desplazamiento artificial de la exposición o brillo medio de la viñeta, los valores enteros de la matriz se normalizan simétricamente en el rango $[-0.5, 0.5]$:
$$D_N(x, y) = \frac{M_N(x \ \& \ (N-1), \ y \ \& \ (N-1)) + 0.5}{N^2} - 0.5$$

**Propiedad Clave:** La esperanza matemática o media espacial es exactamente nula ($E[D_N] = 0.0$). Al sumar este offset al canal cromático, el histograma de luminancia global permanece inalterado.

### 1.3 Indexación Ultra-Rápida con Bitmask (Zero-Division)
En una CPU sin instrucciones vectoriales AVX como la Intel Pentium T4500, la operación de módulo (`%`) por división entera degrada el rendimiento del bucle de píxeles. Dado que $N \in \{2, 4, 8\}$, la indexación de fila y columna se resuelve en **$1$ ciclo de CPU** mediante máscaras a nivel de bits:
- $N = 2 \implies \text{mask} = \texttt{0x01}$
- $N = 4 \implies \text{mask} = \texttt{0x03}$
- $N = 8 \implies \text{mask} = \texttt{0x07}$
$$\text{index}(x, y) = ((y \ \& \ \text{mask}) \cdot N) + (x \ \& \ \text{mask})$$

---

## 2. Impacto Visual en Paneles LCD TN de 6-bit con FRC Deficiente

Los paneles TN convencionales de computadores portátiles de la era del Pentium T4500 (resolución 1366x768) poseen controladores de columna de **6 bits nativos por canal subpíxel** ($2^6 = 64$ tonos por color primario, totalizando $262,144$ colores reales frente a los $16.7$ millones de un panel de 8 bits):

1. **El Problema del FRC Temporal Deficiente:**
   - Para simular los 8 bits de sRGB, el chip temporizador (T-Con) del panel TN emplea **Frame Rate Control (FRC) temporal**, alternando rápidamente entre dos tonos de 6-bit a 60 Hz.
   - En sombras profundas y viñetas con gradientes suaves (cielos nocturnos, lavados de tinta gris), el FRC temporal no logra converger, generando un **parpadeo microscópico molesto (*shimmer / temporal flicker*)** y escalones duros de color (*false contouring / posterization*).
2. **Solución Espacial de Bayer:**
   - Al inyectar el tramado ordenado de Bayer $4 \times 4$ con una amplitud acotada al tamaño de paso de 6-bit ($\pm 0.5 / 64 \approx \pm 0.0078$), el escalón de cuantización se modula **espacialmente** entre píxeles adyacentes a alta frecuencia.
   - El sistema visual humano actúa como un filtro pasobajas natural, integrando los puntos adyacentes como un degradado suave y eliminando las bandas concéntricas sin depender del FRC oscilante.

---

## 3. Preservación del Manga y Prevención del Ruido en Tramas (Screentones)

El manga japonés físico emplea tramas de semitono mecánicas (*screentones / amishiba / Ben-Day dots*) para representar medios tonos mediante patrones regulares de puntos de tinta negra:

1. **Riesgo Crítico de Resonancia de Muaré (*Moiré Artifacts*):**
   - Si se aplica dithering ciego y homogéneo a toda la página, la frecuencia espacial de la matriz de Bayer colisiona armónicamente con la frecuencia angular de las tramas del mangaka, creando interferencias ondulantes gigantescas (*moiré fringes*) que arruinan la lectura.
2. **Estrategia KuraScroll: Desbande Selectivo de Gradientes (`gradient_selective`):**
   - **Exclusión de Bordes y Altas Frecuencias:** Se calcula el gradiente espacial local $|\nabla I|$. En líneas entintadas, texto de globos de diálogo o tramas densas ($|\nabla I| \ge \tau_{\text{deband}}$), el dither se anula estrictamente ($\text{weight} = 0.0$).
   - **Inyección Exclusiva en Gradientes Suaves:** El dither de Bayer solo se inyecta en regiones de gradiente continuo ($|\nabla I| < \tau_{\text{deband}}$ con $\tau \approx 0.04$), como lavados digitales, cielos y degradados de viñeta.
   - **Amplitud Sub-LSB:** La intensidad máxima se acota a $1.0 / \text{pasos}$, garantizando que el grano resultante sea imperceptible a la distancia de lectura estándar ($30-40\text{ cm}$).

---

## 4. Esquema Relacional SQLite DDL: `bayer_dither_profiles`

La tabla formal y su índice B-Tree dedicado han sido incorporados a [`src/backend/db/schema.sql`](file:///C:/Users/Admin/dev/kura-scroll/src/backend/db/schema.sql#L1784-L1807):

```sql
-- ============================================================================
-- Sprint 119: Adaptive Subpixel Color De-Banding & Ordered Bayer Dither Matrix Synthesizer (SLA 83)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bayer_dither_profiles (
    series_id TEXT PRIMARY KEY,
    matrix_size INTEGER NOT NULL DEFAULT 4 CHECK (matrix_size IN (2, 4, 8)),
    bit_depth INTEGER NOT NULL DEFAULT 8 CHECK (bit_depth IN (1, 4, 6, 8)),
    dither_intensity REAL NOT NULL DEFAULT 0.85 CHECK (dither_intensity >= 0.0 AND dither_intensity <= 1.0),
    deband_threshold REAL NOT NULL DEFAULT 0.04 CHECK (deband_threshold >= 0.01 AND deband_threshold <= 0.20),
    screentone_preservation_mode TEXT NOT NULL DEFAULT 'gradient_selective' CHECK (screentone_preservation_mode IN (
        'gradient_selective',
        'uniform',
        'shadows_only',
        'disabled'
    )),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Índice B-Tree explícito para point-lookup instantáneo O(log N) < 5.0 µs
CREATE INDEX IF NOT EXISTS idx_bayer_dither_lookup 
    ON bayer_dither_profiles(series_id);
```

### Especificación de Columnas y Restricciones CHECK

| Campo | Tipo SQLite | Restricciones / Rango | Valor por Defecto | Propósito Técnico en SLA 83 |
| :--- | :--- | :--- | :--- | :--- |
| `series_id` | `TEXT PRIMARY KEY` | No nulo, clave primaria única | *N/A* | Identificador canónico de la serie en KuraScroll. |
| `matrix_size` | `INTEGER` | `CHECK(val IN (2, 4, 8))` | `4` | Dimensión de la matriz de Bayer ($2\times 2$, $4\times 4$, $8\times 8$). |
| `bit_depth` | `INTEGER` | `CHECK(val IN (1, 4, 6, 8))` | `8` | Profundidad de cuantización objetivo ($6\text{ bit}$ para paneles TN viejos). |
| `dither_intensity` | `REAL` | `CHECK(val >= 0.0 AND val <= 1.0)` | `0.85` | Factor de escala de amplitud del offset normalizado. |
| `deband_threshold` | `REAL` | `CHECK(val >= 0.01 AND val <= 0.20)` | `0.04` | Umbral de gradiente máximo para aplicar el dither desbande. |
| `screentone_preservation_mode` | `TEXT` | `CHECK(val IN ('gradient_selective', 'uniform', 'shadows_only', 'disabled'))` | `'gradient_selective'` | Modo de preservación de tramas de manga para evitar muaré. |
| `is_enabled` | `INTEGER` | `CHECK(val IN (0, 1))` | `1` | Interruptor maestro del sintetizador de dither. |
| `created_at` | `INTEGER` | Epoch timestamp en milisegundos | *Obligatorio* | Registro de inserción inicial. |
| `updated_at` | `INTEGER` | Epoch timestamp en milisegundos | *Obligatorio* | Registro de última actualización. |

---

## 5. Matriz de Presets Canónicos de Dither

| Preset | Matriz | Bit-Depth | Intensidad | Umbral ($\tau$) | Modo Preservación | Caso de Uso |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`tn_6bit_deband`** *(default)* | $4 \times 4$ | $6\text{ bit}$ | $0.85$ | $0.04$ | `gradient_selective` | Optimizado para laptops TN viejas; neutraliza FRC y banding. |
| **`retro_print_1bit`** | $8 \times 8$ | $1\text{ bit}$ | $1.00$ | $0.01$ | `uniform` | Estilo retro Macintosh / impresión de periódico monocromo de 1-bit. |
| **`subtle_8bit_clean`** | $4 \times 4$ | $8\text{ bit}$ | $0.50$ | $0.02$ | `gradient_selective` | Pantallas IPS/OLED modernas; desbande ultra-sutil en degradados. |
| **`shadow_enhancer`** | $4 \times 4$ | $6\text{ bit}$ | $0.90$ | $0.06$ | `shadows_only` | Manga seinen con escenas oscuras; realce de tonos sin grano en rostros. |

---

## 6. Tipado TypeScript Canónico y Modulador Zero-Allocation

```typescript
export type BayerMatrixSize = 2 | 4 | 8;
export type TargetBitDepth = 1 | 4 | 6 | 8;
export type ScreentonePreservationMode = 'gradient_selective' | 'uniform' | 'shadows_only' | 'disabled';

export interface BayerDitherProfile {
  series_id: string;
  matrix_size: BayerMatrixSize;
  bit_depth: TargetBitDepth;
  dither_intensity: number;
  deband_threshold: number;
  screentone_preservation_mode: ScreentonePreservationMode;
  is_enabled: number;
  created_at: number;
  updated_at: number;
}

export interface BayerDitherResult {
  matrixSize: BayerMatrixSize;
  bitmask: number;
  offset: number;
  quantizedValue: number;
  isDitherApplied: boolean;
}

/**
 * Matrices de Bayer precomputadas con offsets normalizados en [-0.5, 0.5]
 */
export const BAYER_4X4_OFFSETS = new Float32Array([
   0/16 - 0.46875,  8/16 - 0.46875,  2/16 - 0.46875, 10/16 - 0.46875,
  12/16 - 0.46875,  4/16 - 0.46875, 14/16 - 0.46875,  6/16 - 0.46875,
   3/16 - 0.46875, 11/16 - 0.46875,  1/16 - 0.46875,  9/16 - 0.46875,
  15/16 - 0.46875,  7/16 - 0.46875, 13/16 - 0.46875,  5/16 - 0.46875
]);

/**
 * Cálculo de índice por bitmasking puro sin operadores de división
 */
export function getBayerIndex(x: number, y: number, matrixSize: BayerMatrixSize): number {
  const mask = matrixSize === 8 ? 7 : (matrixSize === 4 ? 3 : 1);
  return ((y & mask) * matrixSize) + (x & mask);
}

/**
 * Cuantización estricta por canal con clamping saturado anti-desbordamiento
 */
export function clampQuantizedColor(val: number, bitDepth: TargetBitDepth): number {
  if (bitDepth === 6) {
    return Math.max(0, Math.min(63, Math.round((val / 255.0) * 63)));
  }
  if (bitDepth === 4) {
    return Math.max(0, Math.min(15, Math.round((val / 255.0) * 15)));
  }
  if (bitDepth === 1) {
    return val >= 128 ? 1 : 0;
  }
  return Math.max(0, Math.min(255, Math.round(val)));
}

/**
 * Operación aritmética de dither a prueba de desbordamiento de enteros de 32 bits
 */
export function applySafeDitherArithmetic(r: number, g: number, b: number, offset: number): number {
  const satR = Math.max(0, Math.min(255, Math.round(r + offset * 16.0)));
  const satG = Math.max(0, Math.min(255, Math.round(g + offset * 16.0)));
  const satB = Math.max(0, Math.min(255, Math.round(b + offset * 16.0)));
  return Math.max(0, Math.min(255, Math.round(0.2126 * satR + 0.7152 * satG + 0.0722 * satB)));
}

/**
 * Generación determinista de ETag FNV-1a para el manifiesto de dither
 */
export function computeDitherEtag(matrixSize: number, bitDepth: number): string {
  let hash = 0x811c9dc5;
  const str = matrixSize + 'x' + matrixSize + '_' + bitDepth + 'bit';
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return '"' + (hash >>> 0).toString(16).padStart(8, '0') + '"';
}
```

---

## 7. Validación Empírica en Host Físico (`test-bayer-dither-schema.cjs`)

Las pruebas se ejecutaron mediante el motor nativo `node:sqlite` de Node.js v24 sobre la suite de validación física:

```text
=== Sprint 119: Bayer Dither Profiles Schema & In-Memory Benchmark ===
[DDL] Table `bayer_dither_profiles` and index `idx_bayer_dither_lookup` created successfully.
[Validation] Testing Check Constraints...
[Validation] Check constraints passed: 10/10 rejected malformed records as expected.
[Benchmark] Measuring B-Tree lookup latency (10,000 iterations)...
[Benchmark] Average lookup latency: 3.59 µs/op (Target: < 5 µs - Superado con éxito)
[Benchmark] Average fallback lookup latency: 0.80 µs/op
[Benchmark] Testing Bayer Matrix Synthesis & Quantization Math...
[Benchmark] Average Bayer Dither & Clamping Math Latency: 149.80 ns/op (Zero-Allocation, Zero-Disk I/O)
[Benchmark] Average Deterministic Dither ETag Latency: 480.77 ns/op
=== Benchmark Complete: All verifications passed successfully. ===
```

### Análisis de Métricas

1. **Latencia B-Tree Point-Lookup ($3.59\text{ µs/op}$):**
   - El índice `idx_bayer_dither_lookup` resuelve el perfil de la serie en $3.59\text{ µs}$, superando el requerimiento de SLA de $< 5.0\text{ µs}$.
2. **Latencia Fallback Inmediato ($0.80\text{ µs/op}$):**
   - Series no configuradas reciben el preset seguro `tn_6bit_deband` en solo $0.80\text{ µs}$.
3. **Verificación de Restricciones CHECK ($10/10$ superadas):**
   - Se rechazaron dimensiones inválidas de matriz (ej. 3 o 16), profundidades de bits no soportadas (10 o 12 bits), intensidades fuera de $[0.0, 1.0]$, umbrales fuera de $[0.01, 0.20]$, modos de preservación anómalos y banderas booleanas corruptas.
4. **Cálculo Matemático de Indexación y Clamping ($149.80\text{ ns/op}$):**
   - La indexación bitmask, lectura de offset normalizado y cuantización saturada se ejecuta en **$149.80\text{ ns}$**, demandando menos del $0.0009\%$ del presupuesto de un cuadro a 60 FPS ($16.67\text{ ms}$).
5. **Caché HTTP 304 Determinista ($480.77\text{ ns/op}$):**
   - Respuestas instantáneas sin consultar la base de datos física en cada petición.

---

## 8. Protocolo de Cero Degradación de Disco Mecánico (Zero-Disk Thrashing)

- **Lectura Única al Montar el Lector:** La tabla `bayer_dither_profiles` se consulta una sola vez al cargar la serie.
- **Sin Escrituras en Caliente:** Durante el desplazamiento, zoom dinámico o tramado subpíxel en el canvas de renderizado, **se escriben $0\text{ bytes}$ al disco mecánico SATA II de 4TB**.
- **Compatibilidad Plena con GMA 4500MHD:** Las matrices se procesan mediante operaciones aritméticas enteras nativas en JavaScript / WebGL fragment shaders simples, sin invocar ningún filtro de desenfoque ni sobrecargar el fill-rate de $380\text{ MP/s}$.
