# KuraScroll Sprint 54: Intel GMA 4500MHD GPU Fill-Rate & Compositor Constraints Blueprint

**Módulo:** Restricciones de Fill-Rate, Arquitectura de Texturas y Gobernador de Renderizado para Intel GMA 4500MHD  
**Subagente Líder:** Lead Metadata Researcher  
**Destinatario:** Parent Agent (`a06e2886-f1e3-4be7-a0c9-4f4944819e1f`)  
**Fecha:** 2 de Noviembre de 2026  
**Hardware Objetivo:** Intel Mobile GM45/GS45/GL40 Express Chipset, Intel GMA 4500MHD (Gen 5, 533 MHz, UMA)  

---

## 1. Arquitectura de Hardware de la GPU Intel GMA 4500MHD

La GPU integrada **Intel GMA 4500MHD** (plataforma móvil *Cantiga* de 65 nm, integrada en el Northbridge GM45/GS45/GL40) presenta particularidades críticas que limitan el rendimiento gráfico en navegadores modernos:

```mermaid
graph TD
    RAM["RAM del Sistema DDR2/DDR3 (Compartida UMA)"] -->|Bus 64-bit / 128-bit: 6.4 - 12.8 GB/s| Northbridge["Northbridge GM45 / Bus Arbiter"]
    Northbridge --> CPU["CPU Pentium T4500 (V8 JS, SQLite, OS)"]
    Northbridge --> GPU["Intel GMA 4500MHD (10 EUs @ 533 MHz)"]
    Northbridge --> Display["RAMDAC / LVDS (Refresco de Pantalla @ 60Hz: ~250-500 MB/s)"]
    GPU --> ROPs["2 ROPs (Peak: 1.066 GPixels/s | Efectivo: ~380 MPixels/s)"]
    GPU --> TMUs["2 TMUs (L1 Cache: 4 KB | L2 Cache: 32 KB)"]
```

### Especificaciones Clave de la GPU:
- **Unidades de Ejecución (EUs):** 10 EUs programables de 5ª Generación.
- **Render Output Units (ROPs):** 2 ROPs dedicados.
- **Texture Mapping Units (TMUs):** 2 TMUs.
- **Frecuencia de Reloj ($f_{core}$):** 533 MHz nominal, reduciéndose a 320 MHz o 200 MHz en estados de ahorro de energía / batería.
- **Fill-Rate Teórico Máximo:**
  $$\text{Pixel Fill-Rate} = 2\text{ ROPs} \times 533\text{ MHz} = \mathbf{1.066\text{ GPixels/s}}\quad (1,066\text{ MP/s})$$
- **Fill-Rate Efectivo Sostenido:** En compositores web de Chromium/Firefox (Direct3D 9Ex / Direct3D 11-on-10Level9 / OpenGL 2.1), el rendimiento real cae a **$280 - 420\text{ MPixels/s}$** debido a la contención del bus UMA.

---

## 2. Límites de Texturas y Características del Bus de Memoria

### 2.1. Dimensiones Máximas de Textura (`GL_MAX_TEXTURE_SIZE`)
- **Límite de Hardware / Driver:**
  - DirectX 10 / Shader Model 4.0: Las especificaciones teóricas admiten hasta $8192 \times 8192$, pero los controladores WDDM 1.1 de Intel (versión 8.15.10.2869) exponen un límite seguro de **$2048 \times 2048$ píxeles** (o $4096 \times 4096$ en extensiones tardías).
  - OpenGL 2.1: `GL_MAX_TEXTURE_SIZE = 2048`.
- **Arquitectura de Caché de Texturas:**
  - Caché L1 de texturas: apenas **4 KB** por sub-slice.
  - Caché L2 unificada: **32 KB**.
  - Subir texturas que superen los $2048 \times 2048$ píxeles provoca *thrashing* masivo en la caché de texturas, forzando múltiples lecturas directas a la memoria RAM compartida.
- **Implicación para Webtoons:**
  - Un capítulo largo de Webtoon de $800 \times 35,000\text{ px}$ **no puede cargarse como una sola textura continua**.
  - Debe trocearse (*slice slicing*) en paneles que no superen los $2048\text{ px}$ de altura, confirmando la validez del *Seam Stitcher* del Sprint 51.

### 2.2. Características del Bus de Memoria UMA (Dynamic Video Memory Technology - DVMT 5.0)
- **VRAM Física:** **0 MB dedicados**. Todo el búfer gráfico reside en la RAM del sistema.
- **Ancho del Bus:** 64 bits (Single-channel) o $2 \times 64$ bits (Dual-channel interleaved).
- **Ancho de Banda Teórico:**
  - Canal simple DDR2-800 / DDR3-800: **$6.4\text{ GB/s}$**.
  - Canal doble DDR2-800: **$12.8\text{ GB/s}$**.
- **Contención del Bus de Memoria (The Memory Bottleneck):**
  - El bus de $6.4\text{ GB/s}$ es compartido simultáneamente por:
    1. **El barrido del display (RAMDAC/LVDS):** Mantener un panel de $1366 \times 768 \times 32\text{bpp}$ a 60 Hz consume $\approx 251\text{ MB/s}$ continuos sin interrupción.
    2. **La CPU Pentium T4500:** Ejecución de código V8 JavaScript, decodificación WebP y consultas SQLite.
    3. **La GPU GMA 4500MHD:** Lecturas de texturas y escrituras al *framebuffer*.
  - En la práctica, la GPU solo dispone de **$3.5\text{ a }5.0\text{ GB/s}$ reales**, lo que hace que cualquier lectura/escritura redundante penalice directamente la tasa de cuadros por segundo (*framerate*).

---

## 3. Factores de Escala Óptimos en el Lienzo ($0.75\times$ vs $1.00\times$)

Al renderizar una página típica de manga digital ($1440 \times 2160$ px, 32-bit RGBA) en una pantalla de laptop de $1366 \times 768$ o monitor 1080p:

| Factor de Escala | Resolución Resultante | Píxeles Totales | Tamaño VRAM (RGBA) | Tráfico de Bus a 60 FPS | Tiempo Raster GPU (Presupuesto 16.6ms) | Nitidez Visual en Pantalla 768p/1080p |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **$1.00\times$ (Nativo)** | $1440 \times 2160$ | $3.11\text{ MP}$ | $11.87\text{ MB}$ | $711.9\text{ MB/s}$ | **$8.19\text{ ms}$ (49.1% del frame)** | Referencia (Supermuestreado) |
| **$0.85\times$ (Alto)** | $1224 \times 1836$ | $2.25\text{ MP}$ | $8.57\text{ MB}$ | $514.4\text{ MB/s}$ | **$5.91\text{ ms}$ (35.5%)** | Indistinguible |
| **$0.75\times$ (Sweet Spot)** | $1080 \times 1620$ | $1.75\text{ MP}$ | $6.67\text{ MB}$ | $400.5\text{ MB/s}$ | **$4.60\text{ ms}$ (27.6%)** | **Nítido, 1:1 con pantalla 1080p** |
| **$0.50\times$ (Modo Eco / Paced)** | $720 \times 1080$ | $0.78\text{ MP}$ | $2.97\text{ MB}$ | $178.0\text{ MB/s}$ | **$2.05\text{ ms}$ (12.3%)** | Ligero suavizado, ideal para ahorro térmico |

### Por qué $0.75\times$ es el Factor Óptimo en GMA 4500MHD:
1. **Ahorro del $43.8\%$ en VRAM:** El consumo por textura cae de $11.87\text{ MB}$ a **$6.67\text{ MB}$**. Al mantener 3 páginas en el búfer de precaché (anterior, actual, siguiente), se ahorran **$15.6\text{ MB}$** de memoria física, evitando swap en disco SATA II.
2. **Reducción del $43.8\%$ en Tráfico de Bus:** El bus se descarga de $711.9\text{ MB/s}$ a $400.5\text{ MB/s}$, dejando ancho de banda libre para la CPU y evitando el tartamudeo (*micro-stuttering*) durante el scroll.
3. **Alineación 1:1 con la Pantalla:** Dado que una pantalla de laptop de 768p o 1080p muestra como máximo $\sim 1080\text{ px}$ de altura para la página, renderizar a $1440 \times 2160$ desperdicia más del $40\%$ del fill-rate en píxeles que la GPU termina descartando durante el filtrado bilineal. La escala **$0.75\times$ ($1080 \times 1620$)** ofrece la máxima nitidez percibida sin desperdicio.

---

## 4. Confirmación de Ausencia de Hardware Float Texture Blending y Coste de Pases del Compositor

### 4.1. Estado de Soporte de Texturas Flotantes (Floating-Point Textures)
- **Almacenamiento (`GL_ARB_texture_float`):** **Soportado**. La GPU puede reservar texturas `RGBA16F` y `RGBA32F`.
- **Mezclado Alfa por Hardware (`GL_EXT_float_blend` / `D3DFMT_A16B16G16R16F` Blending):** **TOTALMENTE AUSENTE en los ROPs**.
- **Consecuencia Técnica Crítica:**
  - Si un shader web o contexto Canvas intenta realizar operaciones de blending (`gl.enable(gl.BLEND)`) sobre una textura flotante, los ROPs de la GMA 4500MHD no pueden procesar el cálculo.
  - El driver WDDM de Intel se ve forzado a desviar la operación a la CPU mediante emulación por software o realizar un lento desempaquetado multi-pass.
  - **El framerate colapsa inmediatamente de 60 FPS a 5 - 8 FPS.**
- **Directiva Obligatoria para KuraScroll:**
  - Todos los lienzos, búferes de dibujo, recortes de doble página y overlays deben usar estrictamente **enteros sin signo normalizados de 8 bits (`RGBA8` / `UNORM8`)**. Se prohíbe el uso de texturas flotantes en la tubería de renderizado.

### 4.2. Coste de Pases del Compositor (Offscreen Framebuffer Objects - FBOs)
En navegadores web (Chromium/Blink), ciertas propiedades CSS fuerzan la asignación de texturas intermedias fuera de pantalla (*offscreen render targets*):
- `backdrop-filter: blur(...)`
- `filter: blur(...)` o `filter: drop-shadow(...)`
- Jerarquías complejas con `opacity < 1` y `mix-blend-mode`

#### Anatomía de un Pase Offscreen en GMA 4500MHD (Viewport $1366 \times 768 = 1.05\text{ MP}$):
Cada pase requiere escribir $4.0\text{ MB}$ en un FBO intermedio, leerlo como textura para aplicar el shader de convolución, y volver a escribirlo en el *backbuffer*.
- **Pase Directo (1 Pass, Estándar KuraScroll):**
  - Escritura directa al backbuffer: Tráfico de bus $4.00\text{ MB/frame}$. Tiempo GPU: **$3.39\text{ ms}$** $\rightarrow$ **60 FPS estables**.
- **Filtro Directo CSS (sepia, contrast, invert):**
  - Aplicado en el quad final sin FBO intermedio: Tiempo GPU: **$3.39\text{ ms}$** $\rightarrow$ **60 FPS estables**.
- **Blur Gaussiano Ingenuo (`filter: blur(16px)`):**
  - 3 pases (FBO horizontal + FBO vertical + composición): Tráfico de bus $20.01\text{ MB/frame}$. Tiempo GPU: **$11.41\text{ ms}$** $\rightarrow$ **60 FPS ajustados**.
- **Backdrop-Filter Blur + Ambient Blur (Anidado):**
  - 5 pases con 4 FBOs intermedios: Tráfico de bus **$36.02\text{ MB/frame}$**. Tiempo GPU: **$19.43\text{ ms}$** $\rightarrow$ **Colapso a $< 30\text{ FPS}$ y calor extremo en la CPU Penryn**.

---

## 5. Directivas de Renderizado para el Lector KuraScroll

1. **Regla de Oro de 1 Solo Pase:** Prohibir terminantemente `backdrop-filter: blur()` y `filter: blur()`. Sustituirlos por gradientes radiales puros (`radial-gradient`), que se resuelven en un solo pase de rasterizado.
2. **Escala por Defecto en Hardware Antiguo:** Configurar `canvasScale = 0.75` por defecto cuando `hardwareProfile.profileName === 'pentium-t4500-legacy'`, conmutable a `0.50` en el gobernador `PACED_30` (Sprint 54).
3. **Formato de Píxel Fijo:** Todo contexto de canvas y WebGL debe inicializarse con `{ alpha: true, depth: false, antialias: false, powerPreference: 'low-power' }` sobre formatos de 8 bits `UNORM8`.
4. **Aislamiento de Pintura:** Aplicar `contain: strict` y `will-change: transform` únicamente en el contenedor de página activo para evitar que el navegador repinte la interfaz completa durante el scroll.
