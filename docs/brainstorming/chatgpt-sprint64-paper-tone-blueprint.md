# Blueprint Senior ChatGPT: Sprint 64 - Motor Adaptativo de Tinte de Papel, Simulación E-Ink y Remapeo de Paleta para Manga

> [!IMPORTANT]
> Consulta arquitectónica senior realizada a ChatGPT vía MCP Brave en la sesión activa.
> Diseñado específicamente para **Intel Pentium T4500 (Penryn 2C/2T @ 2.3 GHz, V8 heap $\le$ 512 MB)**, **Intel GMA 4500MHD (DirectX 10 / WDDM 1.1, CERO blur, CERO backdrop-filter, 60 FPS, CLS = 0)** y **HDD Mecánico SATA II de 4TB**.

---

## 1. Recomendación de Pipeline Gráfico para Intel GMA 4500MHD

1. **SVG Filter Matrix (`feColorMatrix`) vs Canvas 2D LUT vs CSS Filter:**
   - **Elección Senior:** **Filtro SVG Estático con `<feColorMatrix type="matrix" values="..."/>`**.
   - **Por qué NO Canvas 2D:** Un LUT en Canvas 2D requeriría `ctx.getImageData()` y `ctx.putImageData()`, lo que transferiría hasta $1440 \times 2160 \times 4 \approx 12.4\text{ MB}$ por página a través del bus PCI-Express/RAM hacia la GPU. Esto destruiría el framerate en el Pentium T4500 y saturaría el heap V8.
   - **Por qué SVG `feColorMatrix`:** El filtro se evalúa directamente en hardware durante la rasterización de la capa del compositor en un solo paso de textura. El consumo de CPU es del **0%** y el uso de memoria es de **0 bytes**.
   - **Contención estricta:** El contenedor de lectura debe tener `contain: layout paint` y `transform: translateZ(0)` para garantizar $CLS = 0$.

---

## 2. Definición Matemática de los 6 Presets de Tinte

Una matriz de color SVG transforma cada vector $[R, G, B, A, 1]^T$ multiplicándolo por una matriz $5 \times 4$:

$$
\begin{bmatrix}
R' \\ G' \\ B' \\ A'
\end{bmatrix}
=
\begin{bmatrix}
m_{00} & m_{01} & m_{02} & m_{03} & m_{04} \\
m_{10} & m_{11} & m_{12} & m_{13} & m_{14} \\
m_{20} & m_{21} & m_{22} & m_{23} & m_{24} \\
m_{30} & m_{31} & m_{32} & m_{33} & m_{34}
\end{bmatrix}
\begin{bmatrix}
R \\ G \\ B \\ A \\ 1
\end{bmatrix}
$$

### Coeficientes Exactos de los Presets:
1. **`ORIGINAL`** (Identidad):
   `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0`
2. **`SEPIA_CALIDO`** (3200K, calidez relajante):
   `0.393 0.769 0.189 0 0.05  0.349 0.686 0.168 0 0.02  0.272 0.534 0.131 0 -0.02  0 0 0 1 0`
3. **`PAPEL_E_INK`** (Carta 1200, microcápsulas reflectivas):
   `0.280 0.560 0.110 0 0.04  0.280 0.560 0.110 0 0.04  0.260 0.540 0.100 0 0.02  0 0 0 1 0`
4. **`PERIODICO_VINTAGE`** (Papel prensa Showa oxidado por lignina):
   `0.350 0.650 0.150 0 0.08  0.320 0.620 0.140 0 0.06  0.250 0.500 0.100 0 0.01  0 0 0 1 0`
5. **`AMBAR_MEDIANOCHE`** (< 2200K, atenuación del 93% en luz azul < 480nm):
   `0.350 0.650 0.150 0 0.10  0.250 0.550 0.10 0 0.04  0.020 0.050 0.010 0 0.00  0 0 0 1 0`
6. **`NOIR_ALTO_CONTRASTE`** (Entintado shonen monocromo binario):
   `0.500 1.000 0.200 0 -0.15  0.500 1.000 0.200 0 -0.15  0.500 1.000 0.200 0 -0.15  0 0 0 1 0`

---

## 3. Esquema SQLite Lean & In-Memory Statement Caching

```sql
CREATE TABLE IF NOT EXISTS user_paper_tone_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default_user',
  series_id TEXT DEFAULT NULL,
  preset TEXT NOT NULL DEFAULT 'ORIGINAL',
  warmth REAL NOT NULL DEFAULT 0.0,
  contrast REAL NOT NULL DEFAULT 1.0,
  brightness REAL NOT NULL DEFAULT 1.0,
  custom_matrix TEXT DEFAULT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_paper_tone_scoped 
ON user_paper_tone_profiles(user_id, IFNULL(series_id, '__global__'));
```

---

## 4. Requerimientos de SLA 28 & Resiliencia
- **SLA 28:** Latencia de síntesis de matriz y resolución de perfil en SQLite con prepared statements $< 0.05\text{ ms}$ (50 µs).
- **Sanitización y Clamping:**
  - `warmth`: $[-1.0, 1.0]$
  - `contrast`: $[0.5, 2.0]$
  - `brightness`: $[0.5, 1.5]$
  - Coeficientes de matriz protegidos contra `NaN`, `null`, e `Infinity`.
  - Si `preset` es desconocido $\to$ fallback inmediato a `ORIGINAL`.
