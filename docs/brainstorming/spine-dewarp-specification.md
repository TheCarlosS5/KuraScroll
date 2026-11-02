# Sprint 74: Smart Page Curvature & Spine Flattening Dewarping Engine

> [!IMPORTANT]
> **Misión:** Corrección geométrica no destructiva de la distorsión cilíndrica de lomo (*spine gutter distortion*) en páginas escaneadas de tomos Tankōbon físicos.
> **Restricciones de Hardware:**
> 1. **Host CPU:** Intel Pentium T4500 (2C/2T 2.3GHz, V8 heap $\le$ 512MB). Cero redes neuronales ni procesamiento OpenCV en servidor. El backend solo almacena perfiles en SQLite y expone cálculos de malla.
> 2. **Almacenamiento:** HDD mecánico SATA II de 4TB (`STORAGE_ROOT`, 5400 RPM). Cero recodificación ni reescritura de imágenes en disco.
> 3. **Cliente / GPU:** Intel GMA 4500MHD. Des-deformación en cliente mediante división de 16 franjas verticales discretas en el área de lomo, con transformaciones CSS de elongación y compensación de sombreado (0 blur, 0 CLS, textura max 2048x2048).
> 4. **SLA 38:** Latencia de cálculo de malla geométrica de des-deformación (Dewarping Mesh Geometry Slices Calculation) $< 0.02\text{ ms}$ ($< 20\ \mu\text{s}$).

---

## 1. Modelo Analítico de Aplanamiento de Lomo Tankōbon

Para un lomo ubicado en un extremo (o centro en doble página), la curvatura cilíndrica comprime progresivamente los elementos visuales a medida que se aproximan al canalón (*gutter*).

Dado:
- $W_{\text{spine}}$: Ancho de la zona afectada por el lomo (normalmente $15\% - 30\%$ del ancho de página).
- $D_{\text{curv}}$: Profundidad o intensidad de curvatura ($0.0 \le D_{\text{curv}} \le 1.0$).
- $C_{\text{shadow}}$: Compensación de sombra del canalón ($0.0 \le C_{\text{shadow}} \le 0.5$).
- $N$: Número de franjas de muestreo discretas ($N = 16$).

Para cada franja $i \in [0, N-1]$ a una distancia normalizada $u_i = \frac{i}{N}$ desde el lomo ($u = 0$ en el lomo, $u = 1$ en la zona plana):
- Factor de compresión cilíndrica cuadrática:
  $$d_i = D_{\text{curv}} \times (1.0 - u_i)^2$$
- Factor de elongación horizontal correctivo para aplanar la imagen:
  $$s_i = 1.0 + d_i \times 0.85$$
- Factor de compensación de iluminación/brillo:
  $$b_i = 1.0 + C_{\text{shadow}} \times (1.0 - u_i)$$

---

## 2. Esquema Relacional SQLite (`schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS page_spine_dewarp_profiles (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL,
    chapter_id TEXT,
    page_number INTEGER,
    gutter_side TEXT NOT NULL DEFAULT 'auto' CHECK (gutter_side IN ('left', 'right', 'center', 'auto')),
    curvature_depth REAL NOT NULL DEFAULT 0.25,
    spine_width_pct REAL NOT NULL DEFAULT 0.20,
    shadow_compensation REAL NOT NULL DEFAULT 0.15,
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spine_dewarp_lookup
    ON page_spine_dewarp_profiles(series_id, chapter_id, page_number);
```
