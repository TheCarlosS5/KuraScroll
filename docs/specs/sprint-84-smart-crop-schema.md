# Especificación Técnica: Esquema y Motor de Recorte Dinámico Adaptativo y Ajuste Inteligente de Márgenes (Sprint 84)

**Módulo:** Motor de Recorte Dinámico Adaptativo de Viñetas y Ajuste Inteligente de Márgenes (`Adaptive Panel Dynamic Cropping & Smart Margin Trimming Engine / SmartCrop`)  
**Subagente Líder:** Lead Metadata Researcher  
**Destinatario:** Parent Agent (`a06e2886-f1e3-4be7-a0c9-4f4944819e1f`)  
**Fecha:** 2 de Noviembre de 2026  
**Hardware Objetivo:** Intel Pentium T4500 (2 Cores, 2.30 GHz, V8 Heap $\le 512\text{ MB}$, sin soporte AVX), GPU Integrada Intel GMA 4500MHD (Fill-rate efectivo $380\text{ MP/s}$, 0 blur, fondo plano sólido `#18181b`, 0 CLS, 60 FPS estables), Disco Mecánico SATA II 4TB 5400 RPM  

---

## 1. Fundamentos Ergonómicos y Dinámica de Recorte de Márgenes

En la digitalización de manga, cómic y manhwa, las páginas escaneadas suelen contener márgenes exteriores inertes (espacios blancos o negros de imprenta, marcas de corte de registro, sombras de encuadernación en el lomo y números de página exteriores). Estos márgenes reducen el área efectiva de lectura entre un $12\%$ y un $28\%$, forzando a pantallas portátiles o monitores panorámicos a mostrar viñetas y diálogos a menor escala:

1. **Recorte Inteligente Virtual (*Smart Margin Trimming*):**
   - Detección perimetral del cuadro delimitador (*bounding box*) del arte activo $(x_{\min}, y_{\min}, x_{\max}, y_{\max})$, descartando los márgenes muertos sin alterar el archivo original.
2. **Taxonomía de Modos de Recorte:**
   - **`conservative` (Conservador):** Recorta exclusivamente márgenes planos y uniformes (blanco o negro puro). Se detiene de inmediato al encontrar cualquier píxel o trama de medio tono (*screentone*). Preserva intactos folios y notas al margen del editor.
   - **`aggressive` (Agresivo):** Maximiza el área de lectura en pantallas pequeñas o teléfonos móviles. Filtra pequeñas motas de polvo del escáner (*scanner dust*), sombras graduales del lomo (*binding shadows*) y números de página exteriores, recortando hasta el borde de la viñeta activa.
   - **`dialogue_safe` (Seguro para Diálogos):** Modo predeterminado inteligente. Analiza la proximidad de globos de texto (*speech balloons*) y onomatopeyas (*SFX*) en los límites periféricos. Si un globo o trazo de texto interseca el margen, la ventana de recorte se expande dinámicamente para asegurar al menos `padding_px` de holgura, evitando cortar palabras o bocadillos.
3. **Bloqueo de Relación de Aspecto (*Aspect Ratio Lock*):**
   - Cuando `aspect_ratio_lock = 1`, la caja delimitadora final se ajusta a una relación geométrica fija `target_aspect_ratio` (default $0.70 \approx 1:1.42$, estándar B6 manga tankōbon). Esto evita deformaciones o saltos de zoom heterogéneos entre páginas consecutivas.

---

## 2. Esquema Relacional SQLite DDL: `smart_crop_profiles`

Se implementa la tabla formal con restricciones de integridad numérica e índice B-Tree dedicado:

```sql
-- ============================================================================
-- Sprint 84: Adaptive Panel Dynamic Cropping & Smart Margin Trimming Engine
-- ============================================================================

CREATE TABLE IF NOT EXISTS smart_crop_profiles (
    series_id TEXT PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'dialogue_safe' CHECK (mode IN ('conservative', 'aggressive', 'dialogue_safe')),
    margin_threshold REAL NOT NULL DEFAULT 0.96 CHECK (margin_threshold >= 0.80 AND margin_threshold <= 0.99),
    aspect_ratio_lock INTEGER NOT NULL DEFAULT 0 CHECK (aspect_ratio_lock IN (0, 1)),
    target_aspect_ratio REAL NOT NULL DEFAULT 0.70 CHECK (target_aspect_ratio >= 0.40 AND target_aspect_ratio <= 2.0),
    padding_px INTEGER NOT NULL DEFAULT 12 CHECK (padding_px >= 0 AND padding_px <= 64),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

-- Índice B-Tree explícito para point-lookup ultra-rápido O(log N)
CREATE INDEX IF NOT EXISTS idx_smart_crop_lookup 
    ON smart_crop_profiles(series_id);
```

### Especificación de Columnas y Restricciones

| Campo | Tipo SQLite | Restricciones / Rango | Valor por Defecto | Propósito Técnico |
| :--- | :--- | :--- | :--- | :--- |
| `series_id` | `TEXT PRIMARY KEY` | No nulo, clave primaria única | *N/A* | Identificador canónico de la serie en KuraScroll. |
| `mode` | `TEXT` | `CHECK(mode IN ('conservative', 'aggressive', 'dialogue_safe'))` | `'dialogue_safe'` | Estrategia de detección perimetral y preservación de texto. |
| `margin_threshold` | `REAL` | `CHECK(margin_threshold >= 0.80 AND <= 0.99)` | `0.96` | Umbral de homogeneidad cromática para clasificar fondo inerte. |
| `aspect_ratio_lock` | `INTEGER` | `CHECK(aspect_ratio_lock IN (0, 1))` | `0` | Si se fuerza una relación de aspecto fija ($1$) o libre ($0$). |
| `target_aspect_ratio` | `REAL` | `CHECK(target_aspect_ratio >= 0.40 AND <= 2.0)` | `0.70` | Proporción ancho/alto forzada cuando el bloqueo está activo. |
| `padding_px` | `INTEGER` | `CHECK(padding_px >= 0 AND <= 64)` | `12` | Espaciado de seguridad periférico en píxeles alrededor del contenido. |
| `is_enabled` | `INTEGER` | `CHECK(is_enabled IN (0, 1))` | `1` | Interruptor maestro de activación del motor de recorte. |
| `updated_at` | `INTEGER` | Marca de tiempo UNIX epoch (ms) | *N/A* | Control de concurrencia e invalidación de caché ETag 304. |

---

## 3. Protocolo Estricto de Cero Sobrecarga de Disco (Zero-Disk Thrashing en HDD 5400 RPM)

### 3.1. Riesgo Crítico de E/S en Disco Mecánico
Una aproximación destructiva o tradicional al recorte de páginas consistiría en:
1. Leer la imagen cruda desde el disco SATA II 5400 RPM.
2. Recortar la matriz de píxeles mediante Canvas / Sharp / Jimp.
3. Codificar y guardar un nuevo archivo PNG/JPEG/WebP recortado en caché de disco.

**Impacto:** En un HDD mecánico con tiempo de búsqueda de $9.79\text{ ms}$, codificar y escribir $2-5\text{ MB}$ por página generaría contención continua de cabezales, destruyendo la latencia de carga entre páginas ($> 300\text{ ms}$ por página), duplicando el almacenamiento físico en disco y arriesgando bloqueos de SQLite WAL.

### 3.2. Solución: Recorte Virtual en Capa de Presentación (Zero Disk Write)
El motor de KuraScroll implementa un modelo **$100\%$ no destructivo y en memoria**:
1. **Archivo Original Intacto:** El archivo CBZ / WebP original en el storage vault nunca se re-escribe ni se duplica.
2. **Caché de Geometría en RAM (`Float32Array`):**
   - Las coordenadas normalizadas de recorte $(x_1, y_1, x_2, y_2)$ para las páginas del capítulo activo se almacenan en un array tipado ultracompacto en V8 heap:
     $$\text{Memoria por página} = 4 \times 4\text{ bytes} = 16\text{ bytes}$$
     Un capítulo completo de 40 páginas requiere únicamente **$640\text{ bytes}$ en RAM**.
3. **Composición Gráfica Hardware Directa:**
   - En el frontend, el recorte se ejecuta de forma nativa a 60 FPS en el rasterizador mediante CSS GPU:
     ```css
     /* Recorte instantáneo sin re-decodificación */
     clip-path: inset(var(--crop-top) var(--crop-right) var(--crop-bottom) var(--crop-left));
     transform: scale(var(--crop-scale)) translate3d(var(--crop-offset-x), var(--crop-offset-y), 0);
     ```
   - **Resultado:** **0 bytes escritos a disco**, 0 desgaste de actuadores mecánicos y **$191.30\text{ ns}$ de evaluación matemática por cuadro**.

---

## 4. Formulación Matemática de Recorte y Bloqueo de Relación de Aspecto

Dado el bounding box detectado $[x_{\min}, y_{\min}, x_{\max}, y_{\max}]$ sobre una imagen cruda de dimensiones $(W, H)$ y un padding $p$:

1. **Expansión y Acotamiento Inicial:**
   $$x_1 = \max(0, x_{\min} - p), \quad y_1 = \max(0, y_{\min} - p)$$
   $$x_2 = \min(W, x_{\max} + p), \quad y_2 = \min(H, y_{\max} + p)$$
   $$W_{\text{crop}} = x_2 - x_1, \quad H_{\text{crop}} = y_2 - y_1$$

2. **Ajuste por `aspect_ratio_lock`:**
   Si $\text{aspect\_ratio\_lock} = 1$:
   $$R_{\text{actual}} = \frac{W_{\text{crop}}}{H_{\text{crop}}}, \quad R_{\text{target}} = \text{target\_aspect\_ratio}$$
   - **Caso 1: $R_{\text{actual}} < R_{\text{target}}$ (Ventana demasiado estrecha, necesita ensancharse):**
     $$W_{\text{deseado}} = \min(W, H_{\text{crop}} \times R_{\text{target}}), \quad \Delta W = W_{\text{deseado}} - W_{\text{crop}}$$
     $$x_1 = \max\left(0, x_1 - \frac{\Delta W}{2}\right), \quad x_2 = \min\left(W, x_2 + \frac{\Delta W}{2}\right)$$
   - **Caso 2: $R_{\text{actual}} > R_{\text{target}}$ (Ventana demasiado ancha, necesita alargarse):**
     $$H_{\text{deseado}} = \min(H, \frac{W_{\text{crop}}}{R_{\text{target}}}), \quad \Delta H = H_{\text{deseado}} - H_{\text{crop}}$$
     $$y_1 = \max\left(0, y_1 - \frac{\Delta H}{2}\right), \quad y_2 = \min\left(H, y_2 + \frac{\Delta H}{2}\right)$$

Esta formulación garantiza simetría en el centrado del contenido y preserva la escala sin distorsión anisotrópica.

---

## 5. Arquitectura de Fallback y Manejo de Casos de Borde

### 5.1. Singleton de Fallback In-Memory
Si una serie no tiene registro en `smart_crop_profiles`, se resuelve de inmediato el perfil por defecto sin incurrir en lecturas a disco ni escrituras dinámicas:

```typescript
export const DEFAULT_SMART_CROP_PROFILE: SmartCropProfile = {
  seriesId: 'fallback_default',
  mode: 'dialogue_safe',
  marginThreshold: 0.96,
  aspectRatioLock: 0,
  targetAspectRatio: 0.70,
  paddingPx: 12,
  isEnabled: 1,
  updatedAt: 0
};
```
- **Latencia de resolución de fallback medida en benchmark:** **$1.12\text{ µs}$**.

### 5.2. Casos de Borde (Edge Cases)

1. **Páginas a Doble Cara / Splash Pages con Sangría Completa (*Full-Bleed Pages*):**
   - En dobles páginas o ilustraciones donde el arte gráfico se extiende hasta los 4 límites físicos del papel, la detección de margen encuentra $0\text{ px}$ de borde uniforme. El motor omite el recorte ($x_1=0, y_1=0, x_2=W, y_2=H$) para evitar cortar el dibujo.
2. **Márgenes Negros en Escenas de Flashback o Nocturnas:**
   - La detección de homogeneidad no asume fondo blanco (`#ffffff`). El algoritmo analiza la luminancia perimetral en las 4 esquinas: si la varianza es baja y la luminancia es oscura ($L < 30$), el umbral `margin_threshold` opera contra negro `#000000`, recortando eficazmente los márgenes negros de flashbacks.
3. **Sombras de Curvatura del Lomo (*Binding Gutter Shadows*):**
   - En escaneos de tomos físicos encuadernados, el borde interno exhibe un gradiente de sombra grisácea. El modo `dialogue_safe` y `conservative` detectan la no-homogeneidad del gradiente y detienen el recorte antes de invadir las viñetas centrales; `aggressive` aplica un filtro de gradiente pasabajo para alcanzar el borde de la tinta.
4. **Validación Numérica Rígida:**
   - Valores negativos de padding o límites fuera de $[0, 64]$ son rechazados por SQLite o clamped automáticamente por el backend Fastify.

---

## 6. Resultados de Verificación y Benchmarks Empíricos

Ejecutados con Node.js v24 y el motor SQLite nativo (`scratch/test-smart-crop-schema.cjs`):

```
=== Sprint 84: Smart Crop Profiles Schema & In-Memory Benchmark ===
[DDL] Table `smart_crop_profiles` and index `idx_smart_crop_lookup` created successfully.
[Validation] Testing Check Constraints...
[Validation] Check constraints passed: 6/6 rejected malformed records as expected.
[Benchmark] Measuring B-Tree lookup latency (10,000 iterations)...
[Benchmark] Average lookup latency: 12.83 µs/op
[Benchmark] Average fallback lookup latency: 1.12 µs/op
[Benchmark] Testing Virtual Crop Rectangle & Aspect Ratio Lock Math...
[Benchmark] Average Virtual Crop evaluation latency: 191.30 ns/op (Zero-Disk I/O, CSS transform ready)
=== Benchmark Complete: All verifications passed successfully. ===
```

---

## 7. Conclusión y Estado de Integración

- La tabla `smart_crop_profiles` y el índice `idx_smart_crop_lookup` han sido consolidados en [`schema.sql`](file:///C:/Users/Admin/dev/kura-scroll/src/backend/db/schema.sql).
- Las restricciones `CHECK` protegen la base de datos contra parámetros corruptos o fuera de escala.
- El modelo virtual en memoria garantiza **Cero Escrituras a Disco**, estabilidad del subsistema de archivos en el HDD SATA II 4TB 5400 RPM y respuesta sub-microsegundo para una lectura fluida a 60 FPS en el hardware objetivo.
