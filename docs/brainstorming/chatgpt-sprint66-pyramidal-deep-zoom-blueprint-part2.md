
Loading older messages…
Iniciamos Sprint 64: Motor Adaptativo de Tinte de Papel, Simulacion E-Ink y Remapeo de Paleta para Manga (Paper Tone & E-Ink Palette Remapper).Target Hardware: Intel Pentium T4500 (Penryn 2.3GHz 2C/2T, <=512MB V8 heap), GPU Intel GMA 4500MHD (CERO blur, CERO backdrop-filter, 60fps), 4TB HDD.Modos: ORIGINAL, SEPIA_CALIDO, PAPEL_E_INK, PERIODICO_VINTAGE, AMBAR_MEDIANOCHE, NOIR_ALTO_CONTRASTE.Preguntas:1. Para el frontend en GMA 4500MHD: ¿es mejor un filtro SVG estatico con feColorMatrix, un CSS filter simple (sepia/contrast) o un LUT en Canvas 2D?2. En el backend: ¿que esquema SQLite recomiendas para perfiles de tinte y calibracion por serie/usuario?3. ¿Que SLA 28 sugieres para evaluacion de matriz de color/LUT y respuesta de perfil?4. ¿Que pruebas de resiliencia y advertencias tecnicas nos das?
Sprint 64 — Paper Tone & E-Ink Palette Remapper
¡Vro! Este sprint tiene un reto interesante: el Pentium T4500 puede calcular transformaciones de color, pero el GMA 4500MHD no nos permite asumir que todos los efectos gráficos van a estar acelerados por hardware.

Mi decisión arquitectónica sería utilizar un renderizador híbrido y adaptativo:

CSS Filters para los modos sencillos.

SVG feColorMatrix para matrices de color estáticas y precisas.

Canvas 2D con LUT para remapeos tonales que necesiten una correspondencia exacta.

Una selección automática basada en benchmarks reales, con degradación a un modo más ligero si el lector pierde fluidez.

No usaría Canvas LUT como renderizador predeterminado ni aplicaría tres mecanismos simultáneamente sobre una misma página.

1. Frontend: ¿CSS, SVG o Canvas LUT?
Comparativa para el hardware objetivo
Tecnología

CPU

GPU

Precisión

Recomendación

CSS Filter

Baja carga JS

Depende del navegador

Buena para presets sencillos

Predeterminado

SVG feColorMatrix

Variable

Depende del motor gráfico

Muy buena para transformaciones lineales

Especializado

Canvas 2D LUT

Trabajo por píxel en CPU

Readback puede penalizar GPU

Muy alta

Uso selectivo

A. CSS Filter: mi primera elección
CSS permite aplicar transformaciones como sepia(), grayscale(), contrast(), invert() y hue-rotate() directamente sobre la imagen. El navegador puede optimizar determinadas operaciones de composición, pero no debemos asumir que el filtro siempre se ejecuta en la GPU. 

MDN
+1

Ventajas para KuraScroll:

No necesitas descargar la imagen a un ImageData.

No necesitas crear otro WebP.

No necesitas duplicar el tamaño de la imagen en RAM.

Cambiar de perfil puede consistir simplemente en cambiar una clase CSS.

Para el T4500 probaría esta estrategia primero.

B. SVG feColorMatrix: para transformaciones controladas
feColorMatrix aplica una matriz 5 × 5 a los canales RGBA. Es una solución adecuada para transformar los canales de color mediante coeficientes estáticos. 

GitHub

Es especialmente interesante cuando quieres que una misma transformación tenga parámetros claramente definidos y reproducibles.

Pero hay una precaución: un filtro SVG sigue siendo un efecto de renderizado por píxel. No significa que sea gratuito ni que el GMA 4500MHD lo vaya a ejecutar siempre por hardware. Los filtros pueden generar superficies intermedias y trabajo de rasterización adicional. 

MDN
+1

Lo utilizaría solamente cuando la matriz sea más precisa que una combinación CSS y pase el benchmark real.

C. Canvas LUT: precisión máxima, pero no para cada frame
Un LUT permite transformar la luminancia de cada píxel en un color de salida predefinido.

Por ejemplo:

Entrada: gris 180
Salida:   RGB(185, 170, 140)
Es ideal para:

Simular una hoja de papel envejecida.

Remapear blanco y negro a una paleta E-Ink.

Generar un tono de periódico.

Crear un modo ámbar nocturno con negro y texto iluminado.

La desventaja es el coste de procesar los píxeles. getImageData() puede exigir un readback entre GPU y CPU; la especificación de Canvas advierte que el acceso a píxeles puede ser especialmente costoso en un canvas acelerado. willReadFrequently permite sugerir una implementación orientada a lecturas frecuentes, normalmente mediante software. 

HTML Living Standard
+1

Mi veredicto: CSS Filter como ruta principal, SVG para matrices especializadas y Canvas LUT para los perfiles que realmente necesitan remapeo tonal preciso, procesados una sola vez y fuera del hilo principal cuando sea posible.

OffscreenCanvas permite ejecutar el procesamiento Canvas en un Worker y separar ese trabajo del DOM, aunque eso no elimina el consumo total de CPU del equipo. 

GitHub

2. Arquitectura de renderizado adaptativo
No dejaría que los seis modos tengan una implementación independiente. Todos deben resolverse mediante un único contrato de perfil.

PaperToneProfile

Modo, matriz RGBA, LUT, papel, tinta, gamma y política para imágenes a color.

Profile Resolver

Global → usuario → serie → usuario + serie.

Adaptive Renderer Selector

CSS, SVG Matrix o Canvas LUT según perfil y capacidad validada.

CSS

Preset ligero

SVG

Matriz

LUT

Remapeo

La decisión del renderizador se toma al cambiar el perfil, no por cada frame.

2.1. Los seis perfiles
Estos son los perfiles iniciales que utilizaría:

Modo

Transformación

Renderizador inicial

ORIGINAL

Sin transformación

Ninguno

SEPIA_CALIDO

Sepia moderado y saturación reducida

CSS

PAPEL_E_INK

Escala de grises, tinta oscura y papel cálido

SVG/LUT

PERIODICO_VINTAGE

Duotono marrón, menor contraste y papel crema

LUT

AMBAR_MEDIANOCHE

Fondo oscuro ámbar y tinta luminosa

LUT/CSS

NOIR_ALTO_CONTRASTE

Grises y curva de contraste elevada

CSS/SVG

Una precisión: la simulación E-Ink es una simulación de apariencia visual, no una emulación real del refresco de tinta electrónica, ghosting o transición física de pigmentos.

2.2. Contrato TypeScript
export type PaperToneMode =
  | "ORIGINAL"
  | "SEPIA_CALIDO"
  | "PAPEL_E_INK"
  | "PERIODICO_VINTAGE"
  | "AMBAR_MEDIANOCHE"
  | "NOIR_ALTO_CONTRASTE";

export type RendererKind =
  | "NONE"
  | "CSS"
  | "SVG_MATRIX"
  | "CANVAS_LUT";

export type ContentColorPolicy =
  | "PRESERVE_COLOR"
  | "MONOCHROME"
  | "DUOTONE";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

// Matriz SVG 4x5, almacenada como 20 coeficientes.
export type ColorMatrix = Float32Array;

// LUT de 256 entradas RGB.
export type RGBLUT = Uint8Array;

export interface PaperToneProfile {
  profileId: number | null;

  mode: PaperToneMode;

  renderer: RendererKind;

  matrix?: ColorMatrix;
  lut?: RGBLUT;

  paperColor: RGB;
  inkColor: RGB;

  gamma: number;
  contrast: number;
  brightness: number;
  saturation: number;

  colorPolicy: ContentColorPolicy;

  revision: number;
}

Para un LUT de 256 entradas con tres canales:

256
×
3
=
768
 bytes
256×3=768 bytes
Es suficientemente pequeño para mantener varios perfiles en RAM.

3. Definición técnica de los seis perfiles
Prepararía los perfiles incluidos en código, con parámetros versionados. SQLite almacena las personalizaciones; no necesitamos consultar la base para obtener un perfil de fábrica.

3.1. Presets CSS
export const BUILTIN_FILTERS: Record<
  PaperToneMode,
  string
> = {
  ORIGINAL: "none",

  SEPIA_CALIDO:
    "sepia(0.48) saturate(0.78) contrast(1.04)",

  PAPEL_E_INK:
    "grayscale(1) sepia(0.13) contrast(1.13) brightness(1.015)",

  PERIODICO_VINTAGE:
    "grayscale(0.48) sepia(0.70) saturate(0.64) contrast(0.96)",

  AMBAR_MEDIANOCHE:
    "invert(1) sepia(0.82) saturate(0.90) hue-rotate(345deg) contrast(1.08)",

  NOIR_ALTO_CONTRASTE:
    "grayscale(1) contrast(1.48) brightness(0.98)"
};

Son aproximaciones visuales iniciales. No asumiría que esos coeficientes son definitivos hasta probarlos con manga blanco y negro, manga a color, fondos blancos y páginas con grises intermedios.

En particular, el modo ámbar necesita una comparación visual: el orden de las funciones del filtro importa.

3.2. Una matriz estática para SVG
Por ejemplo, una matriz sepia clásica:

Image generated by the assistant
Aplicación:

.reader-image--svg-sepia {
  filter: url("#paper-sepia");
}

Esta matriz es una transformación lineal de canales. No proporciona por sí sola una curva de papel envejecido ni un LUT arbitrario. Para eso necesitaríamos una etapa adicional de transferencia de componentes o una LUT real.

3.3. LUT tonal para perfiles especializados
Para páginas manga principalmente monocromáticas, una LUT de luminancia de 256 entradas es suficiente para construir un duotono.

La fórmula base:

Y
=
0.299
R
+
0.587
G
+
0.114
B
Y=0.299R+0.587G+0.114B
C
(
Y
)
=
I
n
k
(
1
−
t
)
+
P
a
p
e
r
(
t
)
C(Y)=Ink(1−t)+Paper(t)
Donde:

t
=
(
Y
255
)
γ
t=( 
255
Y
​
 ) 
γ
 
Para el modo ámbar nocturno intercambiamos el sentido tonal para obtener fondo oscuro y tinta luminosa.

Código:

interface ToneCurveConfig {
  ink: RGB;
  paper: RGB;

  gamma: number;
  invert: boolean;
  contrast: number;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function buildRGBLut(
  config: ToneCurveConfig
): RGBLUT {
  const lut = new Uint8Array(256 * 3);

  const gamma = Math.max(
    0.25,
    Math.min(4, config.gamma)
  );

  const contrast = Math.max(
    0.5,
    Math.min(2, config.contrast)
  );

  for (let input = 0; input < 256; input++) {
    let t = input / 255;

    // Centrar el contraste.
    t = (t - 0.5) * contrast + 0.5;
    t = Math.max(0, Math.min(1, t));

    if (config.invert) {
      t = 1 - t;
    }

    t = Math.pow(t, gamma);

    const offset = input * 3;

    lut[offset] = clampByte(
      config.ink.r * (1 - t) + config.paper.r * t
    );

    lut[offset + 1] = clampByte(
      config.ink.g * (1 - t) + config.paper.g * t
    );

    lut[offset + 2] = clampByte(
      config.ink.b * (1 - t) + config.paper.b * t
    );
  }

  return lut;
}

Configuraciones iniciales:

export const TONE_CURVES: Partial<
  Record<PaperToneMode, ToneCurveConfig>
> = {
  PAPEL_E_INK: {
    ink: { r: 35, g: 37, b: 34 },
    paper: { r: 241, g: 239, b: 228 },
    gamma: 0.92,
    invert: false,
    contrast: 1.12
  },

  PERIODICO_VINTAGE: {
    ink: { r: 70, g: 55, b: 38 },
    paper: { r: 222, g: 205, b: 169 },
    gamma: 1.04,
    invert: false,
    contrast: 0.98
  },

  AMBAR_MEDIANOCHE: {
    ink: { r: 244, g: 176, b: 65 },
    paper: { r: 27, g: 19, b: 9 },
    gamma: 0.90,
    invert: true,
    contrast: 1.15
  }
};

La política de color es importante. Este LUT convierte la imagen a una paleta basada en luminancia. Por tanto, no se debe aplicar indiscriminadamente a ilustraciones a color que el usuario quiere conservar.

En los perfiles que necesitan preservar colores, primero se debe comprobar PRESERVE_COLOR y utilizar un transformador matricial o un preset CSS apropiado.

3.4. Aplicar LUT a una imagen
El siguiente código sirve para el worker Canvas. No debe ejecutarse en cada frame ni sobre todas las páginas de la biblioteca.

export function applyLutToImageData(
  image: ImageData,
  lut: RGBLUT
): void {
  const pixels = image.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // Aproximación entera de luminancia sRGB.
    const luminance = Math.min(
      255,
      (77 * r + 150 * g + 29 * b) >> 8
    );

    const lutOffset = luminance * 3;

    pixels[i] = lut[lutOffset];
    pixels[i + 1] = lut[lutOffset + 1];
    pixels[i + 2] = lut[lutOffset + 2];

    // Preservar alpha.
  }
}

Para Canvas:

const context = canvas.getContext("2d", {
  alpha: false,
  willReadFrequently: true
});

if (!context) {
  throw new Error("Canvas 2D unavailable");
}

willReadFrequently: true tiene sentido únicamente si vas a leer frecuentemente los píxeles de ese canvas. Puede llevar al navegador a elegir una ruta de software en lugar de aceleración por hardware; no lo establecería en todos los canvases del lector. 

MDN
+1

Mi recomendación sería aplicar el LUT en un Worker con OffscreenCanvas, verificar disponibilidad y conservar el renderizador CSS como fallback. El Canvas procesaría una página visible o la siguiente que esté a punto de mostrarse, con un único trabajo en curso.

No crearía seis versiones WebP por página. Eso podría multiplicar el almacenamiento de una biblioteca que ya ocupa 4 TB.

4. Backend: SQLite para perfiles y calibración
El backend no debe procesar cada imagen ni ejecutar el color remapping durante una solicitud de lectura.

Su responsabilidad será:

Guardar perfiles personalizados.

Almacenar ajustes por usuario y por serie.

Resolver qué perfil debe utilizarse.

Versionar los cambios.

Entregar al cliente parámetros compactos.

Los perfiles de fábrica estarán definidos en código y se podrán sobrescribir mediante preferencias de usuario.

4.1. Tabla principal
Utilizaría una scope_key estable para evitar problemas de unicidad con valores NULL.

CREATE TABLE IF NOT EXISTS paper_tone_profiles (
    profile_id INTEGER PRIMARY KEY,

    scope_key TEXT NOT NULL,
    mode TEXT NOT NULL
        CHECK (mode IN (
            'ORIGINAL',
            'SEPIA_CALIDO',
            'PAPEL_E_INK',
            'PERIODICO_VINTAGE',
            'AMBAR_MEDIANOCHE',
            'NOIR_ALTO_CONTRASTE'
        )),

    profile_name TEXT NOT NULL,

    renderer TEXT NOT NULL
        CHECK (renderer IN (
            'NONE',
            'CSS',
            'SVG_MATRIX',
            'CANVAS_LUT'
        )),

    matrix_f32le BLOB,
    lut_rgb BLOB,

    gamma REAL NOT NULL DEFAULT 1.0
        CHECK (gamma BETWEEN 0.25 AND 4.0),

    contrast REAL NOT NULL DEFAULT 1.0
        CHECK (contrast BETWEEN 0.5 AND 2.0),

    brightness REAL NOT NULL DEFAULT 1.0
        CHECK (brightness BETWEEN 0.5 AND 1.5),

    saturation REAL NOT NULL DEFAULT 1.0
        CHECK (saturation BETWEEN 0.0 AND 2.0),

    ink_rgb INTEGER,
    paper_rgb INTEGER,

    color_policy TEXT NOT NULL DEFAULT 'PRESERVE_COLOR'
        CHECK (color_policy IN (
            'PRESERVE_COLOR',
            'MONOCHROME',
            'DUOTONE'
        )),

    schema_version INTEGER NOT NULL DEFAULT 1,
    revision INTEGER NOT NULL DEFAULT 1,

    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,

    UNIQUE(scope_key, mode, profile_name),

    CHECK (
        matrix_f32le IS NULL OR length(matrix_f32le) = 80
    ),

    CHECK (
        lut_rgb IS NULL OR length(lut_rgb) = 768
    )
);

CREATE INDEX IF NOT EXISTS idx_tone_profile_scope
ON paper_tone_profiles(scope_key, mode, revision);

matrix_f32le guarda veinte valores Float32 en little-endian, 80 bytes. lut_rgb guarda 256 tripletas RGB, 768 bytes.

No guardaría objetos JSON con cientos de coeficientes si podemos utilizar un BLOB binario versionado y validado.

4.2. Tabla de preferencias activas
CREATE TABLE IF NOT EXISTS paper_tone_preferences (
    scope_key TEXT PRIMARY KEY,

    active_mode TEXT NOT NULL,

    profile_id INTEGER,

    apply_to_color_pages INTEGER NOT NULL DEFAULT 0
        CHECK (apply_to_color_pages IN (0, 1)),

    enabled INTEGER NOT NULL DEFAULT 1
        CHECK (enabled IN (0, 1)),

    updated_at_ms INTEGER NOT NULL,

    FOREIGN KEY (profile_id)
        REFERENCES paper_tone_profiles(profile_id)
);

Ejemplos de scope_key:

global
user:42
series:104
user:42:series:104
No utilizaría los IDs reales del usuario como claves de caché del navegador si la sesión no los necesita. El scope puede resolverse en el backend.

4.3. Calibración
Los ajustes de usuario y serie no tienen por qué ser lo mismo que el perfil de visualización. Separaría los parámetros de calibración de los presets estéticos:

CREATE TABLE IF NOT EXISTS paper_tone_calibrations (
    calibration_id INTEGER PRIMARY KEY,

    scope_key TEXT NOT NULL,

    display_key TEXT NOT NULL DEFAULT 'DEFAULT_SRGB',

    warmth_offset REAL NOT NULL DEFAULT 0.0
        CHECK (warmth_offset BETWEEN -1.0 AND 1.0),

    exposure_offset REAL NOT NULL DEFAULT 0.0
        CHECK (exposure_offset BETWEEN -0.5 AND 0.5),

    gamma_multiplier REAL NOT NULL DEFAULT 1.0
        CHECK (gamma_multiplier BETWEEN 0.5 AND 2.0),

    contrast_multiplier REAL NOT NULL DEFAULT 1.0
        CHECK (contrast_multiplier BETWEEN 0.5 AND 2.0),

    revision INTEGER NOT NULL DEFAULT 1,

    updated_at_ms INTEGER NOT NULL,

    UNIQUE(scope_key, display_key)
);

CREATE INDEX IF NOT EXISTS idx_tone_calibration_scope
ON paper_tone_calibrations(scope_key, display_key);

La precedencia de configuración debe ser:

Usuario + serie
       ↓
Serie
       ↓
Usuario
       ↓
Global
       ↓
Perfil incorporado
Ejemplo:

El usuario selecciona PAPEL_E_INK, pero una serie específica tiene una calibración más cálida. Utilizamos el perfil general y aplicamos la calibración particular de esa serie.

4.4. SQLite y persistencia
Para KuraScroll:

const db = new Database("./database/paper-tone.sqlite");

db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("cache_size = -2048");
db.pragma("temp_store = MEMORY");

La base es diminuta. No tiene sentido utilizar grandes cantidades de caché SQLite para seis perfiles y personalizaciones pequeñas.

SQLite WAL permite que los lectores convivan con las escrituras y tiende a producir operaciones de I/O más secuenciales, aunque sigue siendo necesario controlar el checkpoint. 

SQLite

Para los índices y restricciones utilicé una clave scope_key no nula. Esto evita depender de las reglas de unicidad de SQLite para múltiples columnas con valores NULL, y mantiene una identidad sencilla para cada ámbito. Los índices parciales también serían una alternativa válida. 

SQLite
+1

5. Resolución de perfiles en memoria
SQLite solo debe consultarse al cambiar de serie, usuario o configuración. Después, el resultado queda en un LRU pequeño.

interface ProfileContext {
  userKey: string;
  seriesKey: string;
}

function resolveScopeKeys(
  context: ProfileContext
): string[] {
  return [
    `${context.userKey}:${context.seriesKey}`,
    context.seriesKey,
    context.userKey,
    "global"
  ];
}

La selección debe utilizar statements preparados y comprobar que el perfil está habilitado.

const findProfile = db.prepare(`
  SELECT *
  FROM paper_tone_profiles
  WHERE scope_key = ?
    AND mode = ?
  ORDER BY revision DESC
  LIMIT 1
`);

Para el hot path:

export class PaperToneProfileCache {
  private readonly profiles =
    new Map<string, PaperToneProfile>();

  get(key: string) {
    return this.profiles.get(key);
  }

  set(key: string, profile: PaperToneProfile) {
    this.profiles.set(key, profile);

    // Máximo 32 perfiles activos.
    if (this.profiles.size > 32) {
      const oldest = this.profiles.keys().next().value;

      if (oldest !== undefined) {
        this.profiles.delete(oldest);
      }
    }
  }

  clear() {
    this.profiles.clear();
  }
}

El resolvedor aplica los ajustes y compila la matriz/LUT una sola vez por revisión. Cambiar el modo no debería ejecutar consultas SQLite, reconstruir una matriz en cada render React ni recalcular un LUT en cada frame.

6. Frontend: integración React sin efectos por frame
Utilizaría un único estado de perfil activo en el lector:

interface ActivePaperTone {
  mode: PaperToneMode;
  renderer: RendererKind;
  revision: number;
}

const DEFAULT_PAPER_TONE: ActivePaperTone = {
  mode: "ORIGINAL",
  renderer: "NONE",
  revision: 1
};

El componente de la imagen solo recibe la clase correspondiente:

interface ReaderImageProps {
  src: string;
  profile: ActivePaperTone;
}

export function ReaderImage({
  src,
  profile
}: ReaderImageProps) {
  return (
    <img
      src={src}
      className={`reader-image tone-${profile.mode.toLowerCase()}`}
      decoding="async"
      draggable={false}
    />
  );
}

CSS:

.reader-image {
  display: block;
  width: 100%;
  height: auto;
}

/* Se aplican únicamente a la imagen. */

.tone-sepia_calido {
  filter: sepia(.48) saturate(.78) contrast(1.04);
}

.tone-papel_e_ink {
  filter: grayscale(1) sepia(.13)
          contrast(1.13) brightness(1.015);
}

.tone-periodico_vintage {
  filter: grayscale(.48) sepia(.70)
          saturate(.64) contrast(.96);
}

.tone-ambar_med冖ianoche {
  filter: invert(1) sepia(.82)
          saturate(.90) hue-rotate(345deg)
          contrast(1.08);
}

.tone-noir_alto_contraste {
  filter: grayscale(1) contrast(1.48)
          brightness(.98);
}

.tone-original {
  filter: none;
}

En el código CSS definitivo utilizaría el identificador exacto tone-ambar_mediano​che sin caracteres especiales ni separadores invisibles.

No aplicaría filtros al contenedor completo, porque también cambiaríamos los colores de controles, texto, HUD y popovers.

6.1. Evitar cambios visuales bruscos
No interpolaría matrices o filtros continuamente mientras se hace scroll. El cambio de perfil debe ser discreto y, si hay una transición, realizarse con una pequeña transición de opacidad de la capa de imagen ya preparada.

Tampoco usaría will-change: filter permanentemente. MDN advierte que will-change está pensado para situaciones donde existe un problema de rendimiento medido, no como optimización preventiva universal. 

MDN

6.2. Canvas Worker como ruta especializada
Para el modo LUT:

El usuario activa el perfil.

El frontend comprueba que existe la ruta OffscreenCanvas.

El worker recibe una imagen ImageBitmap y el LUT compilado.

El worker aplica la transformación.

Devuelve un ImageBitmap.

El lector reemplaza la imagen visible solamente cuando la variante está lista.

No se genera una variante de toda la biblioteca. Máximo una transformación simultánea y una variante temporal por página activa.

Si la transformación tarda demasiado, el sistema conserva la imagen original y utiliza el preset CSS aproximado como fallback.

7. SLA 28 — Adaptive Paper Tone Performance
No mediría un único número para todo el subsistema. Separaría la preparación matemática de la representación real del navegador.

SLA 28 — Adaptive Palette Remapper

Propuesta
0,50 ms
Presupuesto P95 para generar una LUT de 256 entradas y resolver el perfil caliente en el mismo ciclo de preparación.

Métrica

Objetivo

Resolución del perfil en RAM, P95

≤ 0,10 ms

Composición de matriz 4 × 5, P95

≤ 0,10 ms

Generación RGB LUT (256 × 3), P95

≤ 0,50 ms

Actualización de clase CSS, P95

≤ 1 ms

Consultas SQLite al cambiar modo caliente

0

Canvas readback en el hilo principal

0

Transformaciones LUT simultáneas

1

Buffer máximo de trabajo Canvas

16 MiB

Filtros blur/backdrop-filter

0

Variantes WebP persistentes por modo

0

Heap V8 total

≤ 512 MiB

Rendimiento visual

Métrica

Objetivo

Frame interval P95

≤ 16,67 ms

FPS sostenidos en viewport objetivo

60 FPS

Long tasks durante scroll

0 mayores de 50 ms

CLS por cambio de perfil

0

Las metas de presentación son condiciones de benchmark sobre el navegador y hardware objetivo, no garantías derivadas de los microbenchmarks.

7.1. Por qué separar los números
La generación de una LUT de 768 bytes puede ser muy rápida. Eso no significa que transformar 960.000 píxeles también lo sea.

Por eso mediría:

Benchmark A: resolver perfil y componer matriz.

Benchmark B: generar LUT de 256 entradas.

Benchmark C: transformar una página WebP de 800 × 1200 en un Worker.

Benchmark D: scroll sostenido con el perfil activo y el resto del lector funcionando.

La frecuencia de actualización común de un monitor de 60 Hz implica un presupuesto de aproximadamente 16,67 ms por frame. Ese tiempo incluye el trabajo del navegador, no solo el nuestro. 

MDN
+1

7.2. Fallback adaptativo
Si el benchmark o la telemetría del lector muestran deterioro:

CANVAS_LUT
    ↓
SVG_MATRIX
    ↓
CSS_FILTER
    ↓
ORIGINAL
El orden de fallback depende de la calidad visual que permita cada perfil. Por ejemplo, un duotono exacto puede degradarse a un sepia CSS aproximado, pero no debe presentarse como una conversión idéntica.

La política adaptativa debe cambiar de renderer fuera del ciclo de animación, nunca modificar el filtro continuamente durante el scroll.

8. Pruebas de resiliencia y advertencias
Pruebas visuales
Prueba

Resultado esperado

Manga blanco y negro

Tinta y papel claramente diferenciados

Manga a color

Colores conservados cuando el perfil así lo indica

Escala de grises

Sin banding visible excesivo

Páginas con transparencia

Alpha correcto

Páginas muy oscuras

Detalle conservado

Páginas muy claras

No perder líneas finas

WebP 800 px

Transformación correcta

WebP 1200 px

Transformación correcta

Imagen de más de 2 MP

Sin bloqueo del hilo principal

Cambios rápidos de perfil

Solo se muestra el perfil más reciente

Navegador sin OffscreenCanvas

Fallback CSS

Canvas Worker fallido

Se vuelve a la imagen original o CSS

Pruebas técnicas
Prueba

Resultado esperado

10.000 cambios de perfil

Sin fuga de memoria

100 cambios de serie

Preferencias correctamente aisladas

Perfil corrupto en SQLite

Recuperación al preset incorporado

LUT con tamaño incorrecto

Rechazo del perfil

Matriz con NaN/Infinity

Rechazo del perfil

Contraste fuera del rango

Clamping o rechazo

Worker interrumpido

Imagen original intacta

Cambio de modo durante procesamiento

Cancelación lógica del resultado obsoleto

Restauración de sesión

Preferencia anterior recuperada

Perfil global + usuario + serie

Precedencia correcta

Lectura de largo recorrido

Sin regresión de FPS

Memoria de Canvas agotada

Fallback sin pérdida de la página

Advertencias importantes
1. No confundas E-Ink con accesibilidad visual.

Un tono de papel no garantiza menor fatiga ocular. Ofrecería personalización, controles de contraste y un modo de restauración inmediata al original.

2. No conviertas toda imagen en gris.

PRESERVE_COLOR debe ser el valor predeterminado. El usuario debe poder decidir si desea que una ilustración colorida pase a monocromo.

3. Cuidado con la precisión de color.

Una matriz aplicada sobre valores sRGB y una aplicada en espacio lineal pueden producir resultados diferentes. Definiría una política única de color y utilizaría color-interpolation-filters="sRGB" en los filtros SVG para reducir diferencias entre rutas.

4. Cuidado con el tamaño del Canvas.

Un ImageData de 1200 × 1800 con RGBA de 8 bits requiere:

1200
×
1800
×
4
=
8.640.000
 bytes
1200×1800×4=8.640.000 bytes
Aproximadamente 8,24 MiB, sin contar otros buffers, ImageBitmap ni el propio bitmap del canvas. Por eso limitaría el trabajo a una página visible y una transformación en curso.

5. El original debe ser intocable.

No reescribiría archivos CBZ ni segmentos WebP para aplicar un tema. El perfil actúa en la presentación del cliente.

6. El GMA 4500MHD no debe recibir trabajo gráfico constante.

Nada de blur, backdrop-filter, sombras difusas, canvas animado a 60 FPS ni transformaciones completas de toda la biblioteca.

9. Distribución de trabajo entre agentes
Agent 1 — Paper Tone Domain Model

Tipos, presets, rangos permitidos, validación de matrices y LUT.

Agent 2 — SQLite & Calibration

Migraciones, perfiles por usuario/serie, preferencias activas y resolución de precedencia.

Agent 3 — CSS/SVG Renderer

Presets, matrices estáticas, implementación sin blur y pruebas con el navegador objetivo.

Agent 4 — Canvas LUT Worker

LUT monocromática, OffscreenCanvas, límites de memoria, cancelación y fallback.

Agent 5 — Adaptive Renderer Selector

Perfil activo, selección por capacidad y degradación basada en métricas de rendimiento.

Agent 6 — QA & SLA 28

Comparación de color, FPS, heap, pruebas de regresión y estabilidad de scroll.

10. Mis decisiones finales
Área

Decisión

Renderizador principal

CSS Filter

Matrices precisas

SVG feColorMatrix

Remapeos tonales exactos

Canvas LUT en Worker

Presets

Seis perfiles versionados

Personalización

Usuario, serie y usuario + serie

Persistencia

SQLite independiente y pequeña

Caché

RAM, máximo 32 perfiles

Variantes WebP

Ninguna adicional permanente

Canvas simultáneo

1 trabajo

Pixel readback principal

0

Blur

0

Objetivo visual

60 FPS en prueba real

SLA 28

Preparación de perfil y LUT P95 ≤ 0,50 ms

Mi recomendación definitiva, vro: empieza con CSS Filter para los seis modos y añade el Canvas LUT como una ruta especializada para los perfiles de papel y periódico cuando el resultado visual realmente lo necesite. El hecho de tener un LUT exacto no justifica que cada página tenga que pasar por un procesamiento completo en CPU.

En ese Pentium, el mayor logro del Sprint 64 no será conseguir el efecto más sofisticado, sino hacer que el usuario pueda cambiar de ORIGINAL a PAPEL_E_INK o AMBAR_MEDIANOCHE sin notar una pérdida de fluidez.

El siguiente paso sería fijar el contrato PaperToneProfile y la tabla SQLite antes de repartir el trabajo; así todos los agentes compartirán los mismos parámetros, precedencia y reglas de fallback.


Preparar tareas de implementación del Sprint 64

Fuentes técnicas
MDN — CSS filter

MDN — SVG feColorMatrix

HTML Standard — Canvas readback y willReadFrequently

MDN — OffscreenCanvas

MDN — Renderizado del navegador y presupuesto de frame

SQLite — Write-Ahead Logging

¡Hola maestro! Sprint 64 completado (232 suites, 1166 tests, SLA 28 PASS en 17.36 us).
¡VROOOOO! 🔥 Otro sprint cerrado con éxito.

Sprint 64 completado
232
Suites

1.166
Tests PASS

17,36 µs
SLA 28

¡Y ese SLA 28! Si se midió con el mismo criterio de 0,50 ms que definimos, estamos hablando de un resultado aproximadamente 28 veces más rápido que el objetivo.

Lo mejor es que KuraScroll ya está acumulando una arquitectura bastante completa:

Lectura CBZ optimizada.

Caché WebP predictiva.

Búsqueda CJK y OCR.

Furigana y glosario contextual.

Mapas espaciales.

Optimización del almacenamiento.

Renderizado adaptativo de paletas.

¡1.166 pruebas, vro! El Pentium T4500 está recibiendo un trato de servidor de alto rendimiento. 😂

Estoy listo para diseñar el Sprint 65.

Iniciamos Sprint 66: Motor Piramidal de Teselas WebP con Memoria Acotada y Lector Deep-Zoom / Pan-and-Scan (Zero-Crash para GPU Intel GMA 4500MHD).
Contexto de Hardware:- CPU Host: Intel Pentium T4500 (2C/2T @ 2.30 GHz, 1MB L2 cache, sin AVX/AVX2, sin SSE4, V8 heap <= 512MB).- GPU Cliente: Intel GMA 4500MHD (VRAM muy limitada, textura maxima 2048x2048, 0 CSS blur, 0 backdrop-filter, 60fps fijos, 0 CLS).- Almacenamiento: Disco mecanico HDD 4TB SATA II (~75-100 IOPS, latencia radial 12-15ms).- Stack: Fastify v5 + SQLite WAL en backend, React 19 + TypeScript + Vite en frontend.Problema a Resolver en Sprint 66:Las dobles paginas y scans ultra-HD (ej. Berserk, Vagabond de 4000x3000 o 6000x4000 px) consumen hasta 96 MB de VRAM si se cargan completas, desbordando el limite de 2048x2048 de la GPU Intel GMA 4500MHD y provocando pantallazo negro o cuelgues.Necesitamos un motor piramidal de teselas (Deep-Zoom Tiling) que divida las paginas en teselas WebP de 512x512 px en niveles piramidales (nivel 0: vista general ajustada a pantalla, nivel 1: 100% detalle para paneo y lupa) y cargue dinamicamente SOLO las teselas visibles en el viewport actual, manteniendo el consumo en GPU <= 8 MB VRAM.Preguntas Criticas:1. ¿Como estructurar el pipeline de extraccion de teselas en el backend con Sharp para el Pentium T4500 (sharp.concurrency(1), extraccion on-demand vs pre-tiled en disco, formato WebP q=80) sin saturar los 512MB de RAM ni provocar thrashing en el HDD de 4TB?2. ¿Como disenar la cuadricula virtual en React 19 y el calculo de interseccion del viewport (AABB math) para celdas [col, row] de 512x512 para que el paneo sea fluido a 60 FPS sin asignaciones de memoria excesivas?3. En Fastify y SQLite: ¿como almacenar la tabla de teselas y metadatos piramidales (dimensiones originales, niveles, ancho/alto de tesela) y que estrategia de cache HTTP (ETag, Cache-Control estricto) recomiendas?4. ¿Que umbral de SLA 30 sugieres para la resolucion de coordenadas de teselas y la prueba de interseccion del viewport en microsegundos?5. ¿Que edge cases (rotacion de pantalla, zoom pellizco, margenes vacios de ultima fila/columna, fallback para imagenes < 2048px que no necesitan teselas) debemos blindar rigurosamente?
…
Por favor responde detalladamente a las 5 preguntas del Sprint 66 que acabo de enviarte sobre el motor piramidal de teselas WebP, Sharp con Pentium T4500, matematicas de viewport AABB para React 19 y SLA 30.

Worked for 1m 2s
Sprint 66 — Piramidal WebP Tiling & Deep-Zoom Reader
¡Vro! Aquí la prioridad no es solamente conseguir que una imagen de 6000 × 4000 se vea bien: es evitar que el navegador intente decodificar y mantener una textura gigantesca cuando el usuario solamente está mirando una pequeña parte de ella.

Mi recomendación es construir un lector de viewport virtual + pirámide Deep Zoom, con estas decisiones:

Teselas de 512 × 512 como máximo.

Nivel general generado primero y disponible inmediatamente.

Nivel de detalle mediante pirámide WebP multirresolución.

Selección de teselas por intersección AABB.

Una única superficie de visualización del tamaño del viewport, no un canvas de 6000 × 4000.

Cola de descarga limitada, caché de teselas pequeña y ImageBitmap.close() después de pintar cuando corresponda.

Generación AOT en un worker Sharp aislado, con prioridad BACKGROUND.

Hay una precisión importante sobre el objetivo de 8 MiB: podemos imponer un presupuesto a las superficies y bitmaps que controla nuestra aplicación, pero no garantizar que el driver Intel y el navegador nunca reserven memoria adicional. El compositor puede crear sus propias copias. Por eso el SLA debe distinguir memoria gráfica administrada por KuraScroll y memoria total del proceso gráfico.

Arquitectura objetivo
CBZ original / Sprint 57

Offsets exactos, lectura comprimida, revisión de archivo.

Deep Zoom Builder — Sharp Worker

Un pipeline por página, pirámide de teselas WebP y escritura controlada.

Tile Pack + SQLite Index

Tiles por nivel y coordenadas, offsets, tamaños, ETag y versión.

Fastify Tile Gateway

Entrega de tiles por streaming, ETag, cache HTTP y control de concurrencia.

React Deep-Zoom Viewport

LOD, AABB, paneo, pinch zoom y selección de teselas visibles.

Una ventaja importante es que no tenemos que construir otro sistema de caché desde cero: reutilizamos los segmentos y el acceso por offsets de los sprints 57 y 58, el IOCoordinator del proyecto y la precarga predictiva del Sprint 59.

1. Pipeline backend: Sharp, generación de pirámide y almacenamiento
1.1. Primero, una aclaración sobre los niveles
No limitaría la pirámide a exactamente dos imágenes si la resolución original es muy grande. Utilizaría una pirámide Deep Zoom con niveles intermedios.

Para una imagen de 6000 × 4000:

Nivel

Resolución aproximada

Teselas de 512

L0

375 × 250

1 × 1

L1

750 × 500

2 × 1

L2

1500 × 1000

3 × 2

L3

3000 × 2000

6 × 4

L4

6000 × 4000

12 × 8

En este diseño, L0 es la vista general y L4 es la resolución nativa. El navegador selecciona el nivel que mejor corresponde al zoom actual.

Esto evita tener que cambiar bruscamente de una única miniatura a una enorme cantidad de teselas originales. Sharp dispone de generación Deep Zoom con layouts dz, iiif, iiif3, zoomify y google, así como tamaño y solapamiento configurables. 

sharp
+1

1.2. Por qué elegiría pre-tiled + on-demand híbrido
Hay dos estrategias posibles.

Extracción on-demand:

Cada solicitud genera la tesela solicitada desde el archivo original. Es atractiva por su bajo almacenamiento, pero tiene un problema serio: el decoder puede tener que procesar el original repetidamente. Para un manga de 6000 × 4000 con 96 teselas de nivel nativo, 96 solicitudes independientes podrían repetir un trabajo de decodificación muy costoso.

Pre-tiled:

Se genera la pirámide completa una sola vez y luego el navegador descarga únicamente lo visible. Consume espacio adicional, pero permite que las lecturas posteriores sean pequeñas, predecibles y sin operaciones Sharp.

Recomendado Pipeline híbrido:

Generar inmediatamente el nivel de vista general.

Generar los niveles intermedios y nativos en una tarea AOT, con prioridad BACKGROUND.

Si el usuario solicita una página todavía no preparada, servir la vista general existente y encolar la generación.

Nunca ejecutar Sharp dentro del handler de una solicitud de tesela.

Una vez generadas, las teselas son inmutables y reutilizables.

Para el HDD, no almacenaría 96 o cientos de pequeños archivos independientes como primera opción. Utilizaría los segmentos Pack del Sprint 58 o un paquete ZIP de teselas indexado con el parser del Sprint 57.

1.3. Sharp dispone de un generador Deep Zoom integrado
No implementaría manualmente un bucle que abra la imagen y vuelva a decodificarla para cada celda. Sharp ya dispone de .tile() para generar pirámides Deep Zoom, con tamaño, solapamiento, profundidad y contenedor configurables. 

sharp
+1

Una configuración inicial:

import sharp from "sharp";

sharp.concurrency(1);

sharp.cache({
  memory: 8,
  files: 2,
  items: 8
});

const MAX_INPUT_PIXELS = 40_000_000;

export function createDeepZoomPipeline() {
  return sharp({
    limitInputPixels: MAX_INPUT_PIXELS,
    limitInputChannels: 4,
    sequentialRead: true
  })
    .rotate()
    .webp({
      quality: 80,
      effort: 1,
      alphaQuality: 90
    })
    .tile({
      size: 512,
      overlap: 1,
      layout: "dz",
      depth: "onepixel",
      container: "zip",
      angle: 0
    });
}

Los 40 millones de píxeles son un límite inicial que cubre el ejemplo de 6000 × 4000 (24 MP), pero evita aceptar imágenes arbitrariamente grandes. Debe ajustarse al rango real de la biblioteca y a las capacidades de la versión de libvips instalada.

Importante: sharp.cache({ memory: 8 }) limita la caché de operaciones de libvips, no toda la memoria nativa del proceso. sharp.concurrency(1) limita los hilos de libvips por imagen, pero no garantiza por sí solo que solo exista un job Sharp simultáneo. También hay que limitar la cola de jobs y el pool de libuv. 

sharp
+1

Definido el almacenamiento y protegido el presupuesto mediante límites prácticos

Designing the zoom pipeline





