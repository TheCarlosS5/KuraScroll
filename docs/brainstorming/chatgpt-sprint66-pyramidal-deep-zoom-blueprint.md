
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

Worked for 6m 55s
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

1.4. Worker aislado para el Pentium T4500
La configuración de Sharp la establecería antes de iniciar el proceso, no después de ejecutar otras operaciones del servidor.

PowerShell:

$env:UV_THREADPOOL_SIZE = "1"

node --max-old-space-size=160 `
  dist/deepzoom-worker.js

Linux:

export UV_THREADPOOL_SIZE=1
export MALLOC_ARENA_MAX=2

node --max-old-space-size=160 dist/deepzoom-worker.js

UV_THREADPOOL_SIZE=1 limita el número de trabajos Sharp que pueden procesarse simultáneamente mediante libuv; sharp.concurrency(1) limita los hilos libvips por imagen. Son límites diferentes. 

sharp
+1

En el arranque:

import sharp from "sharp";

sharp.concurrency(1);

sharp.cache({
  memory: 8,
  files: 2,
  items: 8
});

// Una sola generación simultánea.
const MAX_ACTIVE_DEEPZOOM_JOBS = 1;

console.log({
  sharpConcurrency: sharp.concurrency(),
  sharpCache: sharp.cache()
});

No confundir el límite de 8 MiB de la caché de libvips con la memoria total del worker: no limita por sí solo los decoders, los buffers nativos ni la memoria de Node. Mantendría también un límite de RSS supervisado por el sistema operativo, con un techo de partida de 256–320 MiB para este worker, ajustado después de probar los scans más grandes.

La cola debe ser:

VISIBLE PAGE REQUEST
        ↓
Interactive IO
        ↓
BACKGROUND Deep Zoom Queue
        ↓
Maximum 1 active Sharp pipeline
Nunca lanzaría 96 operaciones Sharp con Promise.all() para generar las 96 teselas de una página.

1.5. Pipeline de entrada CBZ → Deep Zoom
La entrada debe llegar como stream desde los offsets del CBZ, utilizando la infraestructura de Sprint 57.

import sharp from "sharp";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

import { createReadStream } from "node:fs";
import { createInflateRaw } from "node:zlib";

interface ArchiveImageEntry {
  archivePath: string;
  dataOffset: number;
  compressedSize: number;
  compressionMethod: 0 | 8;
}

export async function generateDeepZoomArchive(
  entry: ArchiveImageEntry,
  outputTemporaryPath: string,
  signal: AbortSignal
): Promise<void> {
  const source = createReadStream(entry.archivePath, {
    start: entry.dataOffset,
    end: entry.dataOffset + entry.compressedSize - 1,
    highWaterMark: 64 * 1024
  });

  const inflater = entry.compressionMethod === 8
    ? createInflateRaw()
    : null;

  const input = inflater
    ? source.pipe(inflater)
    : source;

  const tiler = sharp({
    limitInputPixels: 40_000_000,
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
      container: "zip"
    });

  const output = createWriteStream(
    outputTemporaryPath,
    { flags: "wx" }
  );

  await pipeline(
    input,
    tiler,
    output,
    { signal }
  );
}

El ejemplo asume que el offset, tamaño, método de compresión y bounds del miembro ZIP ya fueron validados. El flujo ZIP DEFLATE utiliza InflateRaw, no el decodificador zlib con cabecera.

Para esta operación he elegido el contenedor ZIP de Sharp: produce un paquete de teselas que después podemos indexar con el lector ZIP existente. El resultado debe pasar por el indexador y verificar el método de compresión real de cada tesela; no debemos asumir que todas las entradas del paquete son STORE.

Sharp documenta expresamente el uso de tile() para generar archivos Deep Zoom, la posibilidad de seleccionar el formato WebP y el uso de ZIP como contenedor. 

sharp
+1

Importante para producción: si el stream de entrada proviene de un ZIP anidado, sus errores deben propagarse también al stream Sharp. El uso de pipeline() ofrece mejor propagación y destrucción de streams que conectar varios .pipe() sin gestión de errores. Además, el archivo de salida debe quedar en estado BUILDING hasta completar el proceso.

1.6. Estrategia para no saturar el HDD
Dividiría la generación en tres momentos:

Momento

Trabajo

Importación o apertura inicial

Generar overview

Primer zoom

Solicitar niveles de detalle y encolar generación si faltan

Capítulos populares

Completar la pirámide durante tiempo ocioso

Pero aquí hay un matiz: no generaría una pirámide nueva en cada pinch zoom. Una vez creada, todas las teselas se vuelven inmutables. Los siguientes zooms únicamente leen tiles existentes.

Si una pirámide no está completa, el navegador conserva el nivel inmediatamente inferior disponible. Nunca deja un hueco negro esperando a que Sharp termine.

2. React 19: cuadrícula virtual y matemáticas AABB
Esta es la parte central del lector.

El navegador debe conocer:

Dimensiones originales de la página.

Resolución del nivel seleccionado.

Downsample del nivel.

Tamaño de tesela.

Posición del viewport.

Escala y traslación actuales.

Con esa información calcula cuáles teselas intersectan el viewport y solicita solo esas.

2.1. Transformación entre imagen y pantalla
Utilizaremos estas variables:

Símbolo

Significado

W
,
H
W,H

Dimensiones originales

V
w
,
V
h
V 
w
​
 ,V 
h
​
 

Dimensiones del viewport

s
s

Escala de zoom

t
x
,
t
y
t 
x
​
 ,t 
y
​
 

Traslación del origen de la imagen

d
d

Factor de reducción del nivel

Transformación de coordenadas de imagen a pantalla:

s
c
r
e
e
n
X
=
t
x
+
s
⋅
i
m
a
g
e
X
screenX=t 
x
​
 +s⋅imageX
s
c
r
e
e
n
Y
=
t
y
+
s
⋅
i
m
a
g
e
Y
screenY=t 
y
​
 +s⋅imageY
Transformación inversa, de viewport a coordenadas de imagen:

i
m
a
g
e
X
=
s
c
r
e
e
n
X
−
t
x
s
imageX= 
s
screenX−t 
x
​
 
​
 
i
m
a
g
e
Y
=
s
c
r
e
e
n
Y
−
t
y
s
imageY= 
s
screenY−t 
y
​
 
​
 
Con esto calculamos la caja AABB del viewport en coordenadas de la imagen.

x
m
i
n
=
max
⁡
(
0
,
−
t
x
/
s
)
x 
min
​
 =max(0,−t 
x
​
 /s)
y
m
i
n
=
max
⁡
(
0
,
−
t
y
/
s
)
y 
min
​
 =max(0,−t 
y
​
 /s)
x
m
a
x
=
min
⁡
(
W
,
(
V
w
−
t
x
)
/
s
)
x 
max
​
 =min(W,(V 
w
​
 −t 
x
​
 )/s)
y
m
a
x
=
min
⁡
(
H
,
(
V
h
−
t
y
)
/
s
)
y 
max
​
 =min(H,(V 
h
​
 −t 
y
​
 )/s)
Si xMax <= xMin o yMax <= yMin, la imagen no intersecta el viewport y no debe solicitarse ninguna tesela.

2.2. Convertir AABB en coordenadas de teselas
Cada nivel tiene su propio tamaño y factor de reducción.

Por ejemplo:

export interface PyramidLevel {
  level: number;

  width: number;
  height: number;

  // Píxeles originales que representa
  // cada píxel de este nivel.
  downsample: number;

  columns: number;
  rows: number;
}

export interface DeepZoomGeometry {
  originalWidth: number;
  originalHeight: number;

  tileSize: 512;
  overlap: 1;

  levels: readonly PyramidLevel[];
}

export interface ViewportTransform {
  scale: number;
  tx: number;
  ty: number;

  width: number;
  height: number;
}

La coordenada del viewport se convierte primero a coordenadas del nivel:

L
x
=
i
m
a
g
e
X
d
L 
x
​
 = 
d
imageX
​
 
L
y
=
i
m
a
g
e
Y
d
L 
y
​
 = 
d
imageY
​
 
Después calculamos:

c
o
l
m
i
n
=
⌊
L
x
,
m
i
n
512
⌋
col 
min
​
 =⌊ 
512
L 
x,min
​
 
​
 ⌋
r
o
w
m
i
n
=
⌊
L
y
,
m
i
n
512
⌋
row 
min
​
 =⌊ 
512
L 
y,min
​
 
​
 ⌋
c
o
l
m
a
x
=
⌈
L
x
,
m
a
x
512
⌉
−
1
col 
max
​
 =⌈ 
512
L 
x,max
​
 
​
 ⌉−1
r
o
w
m
a
x
=
⌈
L
y
,
m
a
x
512
⌉
−
1
row 
max
​
 =⌈ 
512
L 
y,max
​
 
​
 ⌉−1
El -1 en los máximos es importante: si el viewport termina exactamente en el límite de una tesela, no debemos pedir la siguiente.

2.3. Implementación AABB sin crear objetos por frame
El hot path debe utilizar números escalares y devolver un rango compacto:

export interface VisibleTileRange {
  minCol: number;
  maxCol: number;

  minRow: number;
  maxRow: number;

  count: number;
}

export function calculateVisibleTileRange(
  geometry: DeepZoomGeometry,
  level: PyramidLevel,
  viewport: ViewportTransform,
  output: VisibleTileRange
): boolean {
  const s = viewport.scale;

  if (
    !Number.isFinite(s) ||
    s <= 0 ||
    level.downsample <= 0
  ) {
    output.count = 0;
    return false;
  }

  // Caja AABB en coordenadas originales.
  let xMin = -viewport.tx / s;
  let yMin = -viewport.ty / s;

  let xMax = (viewport.width - viewport.tx) / s;
  let yMax = (viewport.height - viewport.ty) / s;

  // Clamp a los límites originales.
  xMin = Math.max(0, Math.min(
    geometry.originalWidth,
    xMin
  ));

  yMin = Math.max(0, Math.min(
    geometry.originalHeight,
    yMin
  ));

  xMax = Math.max(0, Math.min(
    geometry.originalWidth,
    xMax
  ));

  yMax = Math.max(0, Math.min(
    geometry.originalHeight,
    yMax
  ));

  if (xMax <= xMin || yMax <= yMin) {
    output.count = 0;
    return false;
  }

  // AABB en coordenadas del nivel elegido.
  const d = level.downsample;

  const levelXMin = xMin / d;
  const levelYMin = yMin / d;

  const levelXMax = xMax / d;
  const levelYMax = yMax / d;

  const tileSize = geometry.tileSize;

  const minCol = Math.floor(levelXMin / tileSize);
  const minRow = Math.floor(levelYMin / tileSize);

  const maxCol = Math.min(
    level.columns - 1,
    Math.ceil(levelXMax / tileSize) - 1
  );

  const maxRow = Math.min(
    level.rows - 1,
    Math.ceil(levelYMax / tileSize) - 1
  );

  output.minCol = Math.max(0, minCol);
  output.minRow = Math.max(0, minRow);

  output.maxCol = Math.max(-1, maxCol);
  output.maxRow = Math.max(-1, maxRow);

  if (
    output.maxCol < output.minCol ||
    output.maxRow < output.minRow
  ) {
    output.count = 0;
    return false;
  }

  output.count =
    (output.maxCol - output.minCol + 1) *
    (output.maxRow - output.minRow + 1);

  return true;
}

Este cálculo no crea arrays, objetos de tesela ni cadenas. El rango describe un rectángulo de índices.

Para enumerar las teselas, se itera después, fuera del cálculo AABB.

2.4. Selección automática de LOD
No elegiría siempre el nivel de máxima resolución. Eso obligaría a descargar más datos cuando la imagen está reducida para caber en pantalla.

El nivel ideal busca que un píxel del nivel corresponda aproximadamente a un píxel CSS:

e
f
f
e
c
t
i
v
e
S
c
a
l
e
=
s
⋅
d
effectiveScale=s⋅d
La selección es la que minimiza:

∣
log
⁡
2
(
e
f
f
e
c
t
i
v
e
S
c
a
l
e
)
∣
∣log 
2
​
 (effectiveScale)∣
Código:

export function selectPyramidLevel(
  levels: readonly PyramidLevel[],
  scale: number,
  currentLevel: number | null
): PyramidLevel {
  if (levels.length === 0) {
    throw new Error("Pyramid has no levels");
  }

  // Histeresis para no oscilar entre dos niveles.
  if (currentLevel !== null) {
    const current = levels.find(
      level => level.level === currentLevel
    );

    if (current) {
      const effective = scale * current.downsample;

      if (effective >= 0.67 && effective <= 1.50) {
        return current;
      }
    }
  }

  let best = levels[0];
  let bestError = Infinity;

  for (const level of levels) {
    const effective = scale * level.downsample;

    const error = Math.abs(
      Math.log2(effective)
    );

    if (error < bestError) {
      bestError = error;
      best = level;
    }
  }

  return best;
}

Los umbrales 0.67 y 1.50 son valores iniciales. La histeresis evita que el lector solicite un nivel diferente continuamente cuando el zoom oscila alrededor de un límite.

2.5. Zoom manteniendo el punto bajo el cursor
El zoom no debe mover la región que el usuario estaba observando.

Si el cursor está en 
(
p
x
,
p
y
)
(p 
x
​
 ,p 
y
​
 ), primero calculamos qué coordenada original está debajo:

i
m
a
g
e
X
=
(
p
x
−
t
x
)
/
s
imageX=(p 
x
​
 −t 
x
​
 )/s
Después se calcula la nueva traslación:

t
x
′
=
p
x
−
i
m
a
g
e
X
⋅
s
′
t 
x
′
​
 =p 
x
​
 −imageX⋅s 
′
 
t
y
′
=
p
y
−
i
m
a
g
e
Y
⋅
s
′
t 
y
′
​
 =p 
y
​
 −imageY⋅s 
′
 
Implementación:

export function zoomAtPoint(
  viewport: ViewportTransform,
  pointerX: number,
  pointerY: number,
  factor: number,
  minScale: number,
  maxScale: number
): void {
  const imageX =
    (pointerX - viewport.tx) / viewport.scale;

  const imageY =
    (pointerY - viewport.ty) / viewport.scale;

  const newScale = Math.max(
    minScale,
    Math.min(maxScale, viewport.scale * factor)
  );

  viewport.scale = newScale;

  viewport.tx = pointerX - imageX * newScale;
  viewport.ty = pointerY - imageY * newScale;
}

El objeto viewport se modifica directamente. No crea otro objeto por evento de wheel o pinch.

2.6. Pan y pinch zoom con eventos Pointer
Para el paneo utilizaría Pointer Events, no listeners de mouse y touch separados.

setPointerCapture() permite que el elemento siga recibiendo eventos del puntero aunque el cursor salga de sus límites durante el arrastre. Esto evita perder el gesto de paneo en los bordes. 

MDN

La estrategia:

Pointer down: guardar la posición inicial.

Pointer move: actualizar tx y ty en un objeto mutable.

Pointer up: liberar captura.

Dos punteros: calcular el centro y la distancia para pinch zoom.

Cada evento solo modifica el estado mutable y agenda un único requestAnimationFrame.

No llamar a setState() por cada pointermove.

Ejemplo de controlador:

interface PointerSample {
  id: number;
  x: number;
  y: number;
}

export class PanZoomController {
  readonly transform: ViewportTransform;

  private pointers: PointerSample[] = [];

  private lastPanX = 0;
  private lastPanY = 0;

  private pinchDistance = 0;
  private pinchScale = 1;

  private frameId = 0;

  constructor(
    initial: ViewportTransform,
    private readonly render: () => void,
    private readonly minScale: number,
    private readonly maxScale: number
  ) {
    this.transform = initial;
  }

  pointerDown(event: PointerEvent) {
    if (this.pointers.length >= 2) return;

    this.pointers.push({
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY
    });

    if (this.pointers.length === 1) {
      this.lastPanX = event.clientX;
      this.lastPanY = event.clientY;
    } else {
      this.pinchDistance = this.distance();
      this.pinchScale = this.transform.scale;
    }

    (event.currentTarget as HTMLElement)
      .setPointerCapture(event.pointerId);
  }

  pointerMove(event: PointerEvent) {
    const pointer = this.pointers.find(
      item => item.id === event.pointerId
    );

    if (!pointer) return;

    pointer.x = event.clientX;
    pointer.y = event.clientY;

    if (this.pointers.length === 1) {
      this.transform.tx +=
        event.clientX - this.lastPanX;

      this.transform.ty +=
        event.clientY - this.lastPanY;

      this.lastPanX = event.clientX;
      this.lastPanY = event.clientY;
    } else if (this.pointers.length === 2) {
      this.applyPinch();
    }

    this.schedule();
  }

  pointerUp(event: PointerEvent) {
    this.removePointer(event.pointerId);
    this.schedule();
  }

  private removePointer(id: number) {
    for (let i = 0; i < this.pointers.length; i++) {
      if (this.pointers[i].id === id) {
        this.pointers.splice(i, 1);
        break;
      }
    }

    if (this.pointers.length === 1) {
      const pointer = this.pointers[0];

      this.lastPanX = pointer.x;
      this.lastPanY = pointer.y;
    }

    if (this.pointers.length === 0) {
      this.pinchDistance = 0;
    }
  }

  private distance(): number {
    const a = this.pointers[0];
    const b = this.pointers[1];

    return Math.hypot(
      b.x - a.x,
      b.y - a.y
    );
  }

  private applyPinch() {
    const nextDistance = this.distance();

    if (this.pinchDistance <= 0) return;

    const centerX =
      (this.pointers[0].x + this.pointers[1].x) / 2;

    const centerY =
      (this.pointers[0].y + this.pointers[1].y) / 2;

    const factor = nextDistance / this.pinchDistance;

    zoomAtPoint(
      this.transform,
      centerX,
      centerY,
      factor,
      this.minScale,
      this.maxScale
    );

    this.pinchDistance = nextDistance;
    this.pinchScale = this.transform.scale;
  }

  private schedule() {
    if (this.frameId !== 0) return;

    this.frameId = requestAnimationFrame(() => {
      this.frameId = 0;
      this.render();
    });
  }

  dispose() {
    if (this.frameId !== 0) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }

    this.pointers.length = 0;
  }
}

Este controlador es un esqueleto para dos punteros; falta integrar pointercancel, lostpointercapture y las reglas de límites de traslación. También se puede añadir zoom con rueda, pero usaría passive: false solamente si hay que cancelar el comportamiento por defecto del navegador. wheel no es equivalente a scroll y sus deltas no siempre reflejan el movimiento que realmente terminó ocurriendo. 

MDN

Para el viewport:

.deep-zoom-viewport {
  position: relative;
  overflow: hidden;

  width: 100%;
  height: 100%;

  touch-action: none;
  contain: layout paint;
  user-select: none;
}

touch-action: none solo debe activarse en el área del lector mientras el usuario está interactuando con la imagen. El HUD, los botones y los controles deben quedar fuera de la superficie que captura los gestos.

2.7. Renderizado: no crear una imagen gigante transformada
Esta es mi recomendación más fuerte para la GMA 4500MHD:

No crear un elemento DOM de 6000 × 4000 con transform: scale() y esperar que el navegador lo gestione sin coste.

Aunque los archivos originales sean teselas de 512, el navegador podría promocionar capas grandes, crear superficies intermedias o mantener texturas decodificadas de más.

Usaría una superficie de renderizado del tamaño del viewport, no del tamaño de la imagen virtual:

Viewport 1366 × 768
     |
     +-- Canvas visible (tamaño acotado)
             |
             +-- Tile [3,2] 512 × 512
             +-- Tile [4,2] 512 × 512
             +-- Tile [3,3] 512 × 512
             +-- Tile [4,3] 512 × 512
             +-- Tile [5,3] 512 × 512
             +-- Tile [5,4] 512 × 512
El renderer dibuja en coordenadas de viewport las teselas que intersectan. Solo mantiene una pequeña cantidad de bitmaps decodificados en el momento de pintar y los libera después, en vez de mantener decenas de texturas durante toda la sesión.

En el GMA 4500MHD, limitaría también el bitmap del canvas a:

DPR máximo 1.

Dimensiones de cada superficie menores o iguales a 2048.

Presupuesto de superficie de aproximadamente 4 MiB.

Solo un bitmap de tesela temporal durante el pintado.

Sin canvases gigantes fuera de pantalla.

Sin will-change: transform permanente.

Un canvas de 1366 × 768 a RGBA de 8 bits ocupa aproximadamente 4 MiB de memoria de píxeles. Una tesela de 512 × 512 ocupa aproximadamente 1 MiB al decodificarse como RGBA, y con solapamiento de dos píxeles por lado ocuparía alrededor de 1,01 MiB.

Eso permite un presupuesto de memoria controlada bastante razonable. Pero hay que repetir la advertencia: el driver puede crear buffers o copias adicionales. El límite de 8 MiB es una meta para los recursos que administra KuraScroll, no un límite garantizado de todas las asignaciones internas del navegador.

3. Fastify v5 + SQLite: metadatos y entrega de teselas
El modelo debe poder resolver una tesela con una consulta directa:

pageId + pyramidRevision + level + col + row
                      ↓
                 tile metadata
                      ↓
                 pack segment
                      ↓
                byte range
                      ↓
                  WebP tile
No necesitamos consultar toda la pirámide cuando llega cada solicitud. Primero cargamos el manifest, después las peticiones individuales consultan el índice pequeño.

3.1. Esquema de metadatos
CREATE TABLE IF NOT EXISTS deepzoom_pages (
    page_id TEXT NOT NULL,
    pyramid_revision INTEGER NOT NULL,

    source_fingerprint TEXT NOT NULL,
    source_revision INTEGER NOT NULL,

    original_width INTEGER NOT NULL,
    original_height INTEGER NOT NULL,

    oriented_width INTEGER NOT NULL,
    oriented_height INTEGER NOT NULL,

    orientation_applied INTEGER NOT NULL DEFAULT 1
        CHECK (orientation_applied IN (0, 1)),

    tile_size INTEGER NOT NULL DEFAULT 512,
    overlap INTEGER NOT NULL DEFAULT 1,

    tile_format TEXT NOT NULL DEFAULT 'webp'
        CHECK (tile_format = 'webp'),

    webp_quality INTEGER NOT NULL DEFAULT 80,

    pipeline_version INTEGER NOT NULL,

    level_count INTEGER NOT NULL,

    state TEXT NOT NULL
        CHECK (state IN (
            'BUILDING',
            'VERIFYING',
            'READY',
            'FAILED',
            'RETIRED'
        )),

    manifest_etag TEXT NOT NULL,

    created_at_ms INTEGER NOT NULL,

    PRIMARY KEY (page_id, pyramid_revision)
) WITHOUT ROWID;

Las dimensiones originales y orientadas se guardan separadas. Si Sharp aplica EXIF orientation con .rotate(), el manifest debe describir las dimensiones del resultado ya orientado. El frontend no debe rotar otra vez la misma imagen.

La tabla de niveles:

CREATE TABLE IF NOT EXISTS deepzoom_levels (
    page_id TEXT NOT NULL,
    pyramid_revision INTEGER NOT NULL,

    level INTEGER NOT NULL,

    width INTEGER NOT NULL,
    height INTEGER NOT NULL,

    downsample INTEGER NOT NULL,

    columns_count INTEGER NOT NULL,
    rows_count INTEGER NOT NULL,

    PRIMARY KEY (
        page_id,
        pyramid_revision,
        level
    ),

    FOREIGN KEY (page_id, pyramid_revision)
        REFERENCES deepzoom_pages(page_id, pyramid_revision)
) WITHOUT ROWID;

Y la tabla de teselas:

CREATE TABLE IF NOT EXISTS deepzoom_tiles (
    tile_id INTEGER PRIMARY KEY,

    page_id TEXT NOT NULL,
    pyramid_revision INTEGER NOT NULL,

    level INTEGER NOT NULL,
    tile_col INTEGER NOT NULL,
    tile_row INTEGER NOT NULL,

    width INTEGER NOT NULL,
    height INTEGER NOT NULL,

    -- Coordenadas del contenido lógico en nivel original.
    logical_x INTEGER NOT NULL,
    logical_y INTEGER NOT NULL,

    -- Tamaño del contenido real del archivo WebP.
    encoded_width INTEGER NOT NULL,
    encoded_height INTEGER NOT NULL,

    pack_segment_id TEXT NOT NULL,

    byte_offset INTEGER NOT NULL,
    byte_length INTEGER NOT NULL,

    compression_method INTEGER NOT NULL
        CHECK (compression_method IN (0, 8)),

    etag TEXT NOT NULL,
    sha256 TEXT NOT NULL,

    state TEXT NOT NULL DEFAULT 'READY'
        CHECK (state IN ('READY', 'INVALID')),

    UNIQUE (
        page_id,
        pyramid_revision,
        level,
        tile_col,
        tile_row
    ),

    FOREIGN KEY (page_id, pyramid_revision, level)
        REFERENCES deepzoom_levels(
            page_id,
            pyramid_revision,
            level
        )
);

CREATE INDEX IF NOT EXISTS idx_deepzoom_tile_lookup
ON deepzoom_tiles (
    page_id,
    pyramid_revision,
    level,
    tile_row,
    tile_col
);

CREATE INDEX IF NOT EXISTS idx_deepzoom_pack_range
ON deepzoom_tiles (
    pack_segment_id,
    byte_offset
);

Los offsets deben seguir siendo enteros de 64 bits. Si existe la posibilidad de que el offset supere el rango seguro de Number, usa bigint en el acceso Node y un driver que preserve ese valor sin truncarlo.

3.2. Ejemplo de niveles para 6000 × 4000
Una estructura de metadatos simplificada:

{
  "pageId": "page-849",
  "revision": 3,
  "originalWidth": 6000,
  "originalHeight": 4000,
  "tileSize": 512,
  "overlap": 1,
  "format": "webp",
  "levels": [
    {
      "level": 0,
      "width": 375,
      "height": 250,
      "downsample": 16,
      "columns": 1,
      "rows": 1
    },
    {
      "level": 1,
      "width": 750,
      "height": 500,
      "downsample": 8,
      "columns": 2,
      "rows": 1
    },
    {
      "level": 2,
      "width": 1500,
      "height": 1000,
      "downsample": 4,
      "columns": 3,
      "rows": 2
    },
    {
      "level": 3,
      "width": 3000,
      "height": 2000,
      "downsample": 2,
      "columns": 6,
      "rows": 4
    },
    {
      "level": 4,
      "width": 6000,
      "height": 4000,
      "downsample": 1,
      "columns": 12,
      "rows": 8
    }
  ]
}

Esta es una representación de niveles seleccionados para explicar el modelo; la pirámide completa generada por Sharp puede incluir niveles adicionales según la profundidad elegida. El índice debe registrar los niveles que realmente produjo el pipeline, nunca inventarlos a partir de una tabla estática.

El número de columnas y filas se obtiene mediante:

c
o
l
u
m
n
s
=
⌈
w
i
d
t
h
/
512
⌉
columns=⌈width/512⌉
r
o
w
s
=
⌈
h
e
i
g
h
t
/
512
⌉
rows=⌈height/512⌉
3.3. Versionado e invalidación
La ruta de cada tesela debe incorporar una revisión inmutable:

/api/v1/pages/{pageId}/deepzoom/{revision}/{level}/{col}/{row}.webp
La revisión cambia cuando cambian:

El contenido original.

El pipeline de Deep Zoom.

El tamaño de tesela.

El solapamiento.

La calidad o el formato de WebP.

No cambia por una simple actualización de estadísticas de acceso.

El fingerprint de la fuente puede derivarse de la identidad de la página y la revisión del contenido, no del offset físico del CBZ. Así, una reorganización ZIP del Sprint 63 no obliga a regenerar toda la pirámide cuando los bytes visuales originales no cambiaron.

3.4. Endpoint Fastify v5
Fastify v5 requiere esquemas JSON completos para params, querystring y body cuando se usa el validador JSON Schema predeterminado. 

GitHub

La ruta debería tener un schema estricto:

fastify.get(
  "/api/v1/pages/:pageId/deepzoom/:revision/:level/:col/:row.webp",
  {
    schema: {
      params: {
        type: "object",
        properties: {
          pageId: { type: "string", minLength: 1 },
          revision: { type: "integer", minimum: 1 },
          level: { type: "integer", minimum: 0 },
          col: { type: "integer", minimum: 0 },
          row: { type: "integer", minimum: 0 }
        },
        required: [
          "pageId",
          "revision",
          "level",
          "col",
          "row"
        ],
        additionalProperties: false
      }
    }
  },
  async (request, reply) => {
    const params = request.params as {
      pageId: string;
      revision: number;
      level: number;
      col: number;
      row: number;
    };

    const tile = findDeepZoomTile(params);

    if (!tile || tile.state !== "READY") {
      return reply.code(404).send({
        error: "Tile not ready"
      });
    }

    reply
      .header("Content-Type", "image/webp")
      .header("Content-Length", tile.byte_length)
      .header("ETag", tile.etag)
      .header(
        "Cache-Control",
        "private, max-age=31536000, immutable"
      )
      .header("X-Content-Type-Options", "nosniff");

    if (etagMatches(
      request.headers["if-none-match"],
      tile.etag
    )) {
      return reply.code(304).send();
    }

    const lease = segmentManager.acquire(
      tile.pack_segment_id
    );

    const stream = createTileReadStream(tile);

    let released = false;

    const release = () => {
      if (released) return;
      released = true;
      lease.release();
    };

    stream.once("close", release);
    stream.once("error", release);

    return reply.send(stream);
  }
);

createTileReadStream() debe:

Comprobar que el rango de bytes es válido.

Leer únicamente los bytes de la tesela.

Aplicar InflateRaw si el miembro de almacenamiento está en DEFLATE.

Liberar el lease cuando se cierre el stream.

Cancelar la lectura cuando el cliente desconecte.

No cargar una tesela completa en un Buffer si puede servirse por stream.

Fastify admite el envío de streams como respuesta y los transmite sin serializarlos como JSON. 

Fastify latest

3.5. HTTP Cache-Control y ETag
Para teselas inmutables utilizaría:

HTTP/1.1 200 OK
Content-Type: image/webp
Content-Length: 112840
ETag: "sha256-..."
Cache-Control: private, max-age=31536000, immutable
X-Content-Type-Options: nosniff
private es apropiado cuando el material pertenece a la biblioteca personal del usuario. Para contenido público y no personalizado se puede utilizar public.

Una tesela de una revisión inmutable no debe cambiar jamás bajo la misma URL. Cuando cambia la fuente o el pipeline se crea una revisión nueva.

Con If-None-Match se devuelve 304 Not Modified sin cuerpo cuando la representación coincide con el ETag del cliente. El estándar HTTP define los validadores y el uso de If-None-Match para este comportamiento. 

RFC Editor
+1

No implementaría Range en cada tesela inicialmente: las imágenes WebP de 512 × 512 son pequeñas y una respuesta completa es más sencilla. El soporte Range sí puede mantenerse para el paquete ZIP de pirámide.

2.8. Canvas y memoria gráfica: presupuesto realista
Para evitar que el navegador mantenga diez o doce texturas independientes, usaría un compositor Canvas 2D limitado al viewport.

No crearía un canvas del tamaño original de la imagen. Para una pantalla de 1366 × 768, el backing store RGBA ocupa aproximadamente 4 MiB. Una tesela de 512 × 512 ocupa alrededor de 1 MiB tras decodificarse; con un píxel de overlap en cada borde, aproximadamente 1,01 MiB.

Mi presupuesto inicial:

Recurso

Presupuesto

Canvas del viewport

≤ 4 MiB

Bitmaps decodificados residentes

≤ 2 MiB

Decodificación temporal de tesela

≤ 1 MiB

Margen operativo

≥ 1 MiB

Total administrado

≤ 8 MiB

La política sería:

Un canvas de viewport.

Máximo dos ImageBitmap retenidos.

Una operación de decodificación simultánea.

Bitmap temporal cerrado después de pintarse o descartarse.

Caché de teselas comprimidas pequeña y limitada por bytes.

Nada de un canvas secundario con dimensiones de la imagen original.

ImageBitmap.close() libera expresamente los recursos gráficos asociados al bitmap; no debemos simplemente perder la referencia y esperar que el recolector los libere cuando pueda. 

MDN
+1

El tamaño del canvas también se limita por área:

const MAX_CANVAS_PIXELS = 1_000_000;

export function getSafeCanvasScale(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number
): number {
  const dpr = Math.min(1, devicePixelRatio);

  const requestedPixels =
    cssWidth * cssHeight * dpr * dpr;

  const memoryScale = Math.sqrt(
    MAX_CANVAS_PIXELS / requestedPixels
  );

  return Math.min(1, memoryScale);
}

Así el canvas no supera aproximadamente 4 MiB de backing store a RGBA de 8 bits. En una pantalla de mayor resolución, se reduce la resolución interna y se escala visualmente al tamaño CSS.

Es un compromiso deliberado: en un monitor de 1920 × 1080 se podría sacrificar algo de nitidez durante el movimiento continuo para preservar estabilidad. El detalle nativo vuelve a renderizarse cuando el usuario deja de desplazar la página.

Para comprobar que esta política no deja bitmaps vivos por accidente, el renderer debe cerrar los recursos después del dibujo y cerrar también todos los bitmaps almacenados al desmontar el lector, cambiar de página o invalidar una revisión.

2.9. Cola visual de teselas
No todas las teselas visibles merecen la misma prioridad.

Utilizaría esta clasificación:

Prioridad

Teselas

VISIBLE_CORE

Intersectan el centro del viewport

VISIBLE_EDGE

Intersectan los bordes

NEAR_PREFETCH

Una tesela más allá de la región visible

BACKGROUND

Resto del nivel o niveles siguientes

La cola puede reutilizar el predictor del Sprint 59:

Dirección del paneo.

Velocidad de desplazamiento.

Último nivel seleccionado.

Tiles que ya están en caché.

Pero el predictor nunca debe bloquear una tesela visible para calentar una tesela futura.

Para una vista inicial, primero se pinta el overview. Después se solicitan los tiles centrales de detalle y, por último, los bordes y la región que anticipa el movimiento.

La concurrencia inicial sería:

Visible tile fetches:       2 máximo
Image decode:               1 máximo
Background tile prefetch:   0 durante interacción activa
No significa que debamos tener dos descargas si el HDD ya está saturado. El adaptador de lectura debe respetar el IOCoordinator y su prioridad actual.

4. SLA 30 — Deep-Zoom Coordinate & Viewport Engine
Yo propondría medir el motor en cuatro categorías. No sirve de mucho obtener una AABB de 4 µs si después se crean cientos de strings y objetos, se ejecuta un render React completo y se bloquea el hilo principal.

SLA 30 — Deep-Zoom Spatial Engine

Objetivo propuesto
50 µs
Límite P95 para calcular el rango AABB de teselas visibles.

Métrica

Objetivo

Cálculo AABB, P95

≤ 50 µs

Cálculo AABB, P99

≤ 100 µs

Selección de LOD, P95

≤ 20 µs

Diff de teselas visibles, P95

≤ 100 µs

Asignaciones durante AABB

0 objetos temporales

Solicitudes duplicadas de teselas

0

Textura individual

≤ 514 × 514 px

Superficie Canvas

≤ 1 MP

Decodificaciones simultáneas

1

Superficies/bitmaps administrados

≤ 8 MiB

V8 heap del backend

≤ 512 MiB

Dimensiones de capas completas

No superar 2048 × 2048

Experiencia de lectura

Métrica

Objetivo

Frame time P95 en pan, con tiles calientes

≤ 16,67 ms

FPS durante interacción estable

60 en pantalla de 60 Hz

Long task durante pan/zoom

0 mayores de 50 ms

CLS durante montaje y zoom

0

Pantalla negra o crash

0 en soak test

Son umbrales de aceptación, no resultados ya verificados. Los 60 FPS dependen del navegador, driver, resolución del viewport y decodificación de la imagen.

4.1. Microbenchmark AABB
Mediría la misma función que utiliza el lector, con una geometría y nivel ya cargados.

export function benchmarkAabb(
  geometry: DeepZoomGeometry,
  level: PyramidLevel,
  iterations = 100_000
) {
  const output: VisibleTileRange = {
    minCol: 0,
    maxCol: 0,
    minRow: 0,
    maxRow: 0,
    count: 0
  };

  // Calentamiento de V8.
  for (let i = 0; i < 20_000; i++) {
    calculateVisibleTileRange(
      geometry,
      level,
      {
        scale: 0.8 + (i % 10) * 0.05,
        tx: -i % 700,
        ty: -i % 500,
        width: 1366,
        height: 768
      },
      output
    );
  }

  const batches = 100;
  const operationsPerBatch =
    Math.floor(iterations / batches);

  const samples = new Float64Array(batches);

  for (let batch = 0; batch < batches; batch++) {
    const start = performance.now();

    for (let i = 0; i < operationsPerBatch; i++) {
      calculateVisibleTileRange(
        geometry,
        level,
        {
          scale: 1,
          tx: -(i % 1000),
          ty: -(i % 600),
          width: 1366,
          height: 768
        },
        output
      );
    }

    samples[batch] =
      (performance.now() - start) *
      1_000_000 /
      operationsPerBatch;
  }

  samples.sort();

  return {
    p50Nanoseconds: samples[49],
    p95Nanoseconds: samples[94],
    p99Nanoseconds: samples[98]
  };
}

Este test es de coste amortizado por operación en lotes; para verificar latencia de una llamada real también recogería muestras aisladas durante un período largo, ya que el rendimiento de V8 puede variar con JIT y recolección de basura.

Los benchmarks finales se ejecutan en build de producción, no con React en modo desarrollo. La propia documentación de React recomienda medir con una compilación de producción y sobre hardware representativo. 

React

4.2. Pruebas de latencia de interacción
Mediría:

Pointer event received
        ↓
Transform updated
        ↓
AABB calculated
        ↓
Visible tile diff
        ↓
Frame scheduled
        ↓
Canvas painted
Guardar tiempos independientes para cada etapa. Eso permite encontrar el cuello de botella real.

No mezclaría:

Latencia de AABB.

Latencia de acceso SQLite.

Latencia HDD.

Descarga de WebP.

Decodificación WebP.

Dibujo Canvas.

Composición del navegador.

El AABB puede cumplir 50 µs mientras una tesela tarda 40 ms en llegar del HDD. Eso no significa que el SLA esté incumplido: son subsistemas diferentes.

5. Edge cases que debemos blindar
Esta es la batería que utilizaría para aprobar el Sprint 66. En deep zoom los errores de geometría suelen manifestarse como teselas negras, franjas, imágenes desalineadas o solicitudes fuera de los límites.

5.1. Rotación EXIF y orientación de pantalla
Una imagen puede indicar orientación EXIF de 90°, 180° o 270°.

Mi recomendación: normalizar la orientación en el backend mediante .rotate() y registrar las dimensiones resultantes en el manifest. Sharp aplica la orientación EXIF mediante esta operación; el frontend debe utilizar las dimensiones ya normalizadas. 

sharp
+1

Si el usuario también puede rotar la página en el lector:

La rotación del usuario es una transformación independiente.

El AABB se calcula aplicando la transformación inversa de esa rotación.

En 90° y 270° se intercambian las dimensiones efectivas del viewport de imagen.

No volver a aplicar EXIF.

Pruebas obligatorias: las cuatro orientaciones, con un viewport parcialmente fuera de la imagen.

5.2. Pinch zoom
Los casos que más fallos pueden introducir:

Dos dedos se aproximan o alejan mientras el usuario panea.

Un dedo se levanta antes que el otro.

Se cancela un pointer por cambio de pestaña.

Se pierde pointercapture.

Se intenta dividir por distancia cero.

Se produce una escala NaN por un evento malformado.

Condiciones:

function validScale(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

Nunca permitas que la escala llegue a cero ni que se convierta en Infinity o NaN.

Mantendría:

minScale = fitScale
maxScale = 1.0
Como máximo inicial, permitiría ampliar hasta la escala de píxel nativo. Se puede probar 1.5x o 2x como ampliación adicional, pero no aparecerá nuevo detalle: solo se agrandan los píxeles disponibles.

5.3. Última fila y última columna
Este edge case es especialmente importante.

Para una imagen de 6000 × 4000, la última tesela de la fila inferior y de la columna derecha no tiene 512 píxeles completos.

El tamaño válido se calcula así:

t
i
l
e
W
i
d
t
h
=
min
⁡
(
512
,
l
e
v
e
l
W
i
d
t
h
−
c
o
l
⋅
512
)
tileWidth=min(512,levelWidth−col⋅512)
t
i
l
e
H
e
i
g
h
t
=
min
⁡
(
512
,
l
e
v
e
l
H
e
i
g
h
t
−
r
o
w
⋅
512
)
tileHeight=min(512,levelHeight−row⋅512)
Código:

export function getTileDimensions(
  level: PyramidLevel,
  col: number,
  row: number,
  tileSize = 512
) {
  if (
    col < 0 ||
    row < 0 ||
    col >= level.columns ||
    row >= level.rows
  ) {
    return null;
  }

  const remainingWidth =
    level.width - col * tileSize;

  const remainingHeight =
    level.height - row * tileSize;

  return {
    width: Math.min(tileSize, remainingWidth),
    height: Math.min(tileSize, remainingHeight)
  };
}

No rellenaría artificialmente las zonas que no existen con píxeles negros, ni enviaría peticiones para celdas que estén completamente fuera de la página.

5.4. Overlap y seams
Utilizaría overlap: 1 al construir la pirámide.

Cada tesela debe conservar:

Coordenadas lógicas de contenido.

Coordenadas de renderizado con overlap.

Dimensiones codificadas reales.

Cantidad de píxeles adicionales en cada borde.

Si no se conserva esta información, las teselas pueden aparecer desplazadas, solapadas o con líneas de separación.

La coordenada lógica se calcula utilizando tileSize = 512, no utilizando el ancho codificado de 514.

5.5. Fallback para imágenes pequeñas
No todas las páginas tienen que convertirse en pirámides.

Pero tampoco usaría únicamente la condición width <= 2048 && height <= 2048.

Una imagen de 2048 × 2048 necesita aproximadamente 16 MiB de almacenamiento RGBA sin compresión. Por lo tanto, puede respetar el límite máximo de dimensiones de textura y aun así exceder nuestro presupuesto de memoria.

Aplicaría una condición doble:

const MAX_TEXTURE_DIMENSION = 2048;
const MAX_DIRECT_RGBA_BYTES =
  4 * 1024 * 1024;

export function shouldUseDirectImage(
  width: number,
  height: number
): boolean {
  if (
    width <= 0 ||
    height <= 0 ||
    width > MAX_TEXTURE_DIMENSION ||
    height > MAX_TEXTURE_DIMENSION
  ) {
    return false;
  }

  const estimatedBytes =
    width * height * 4;

  return estimatedBytes <= MAX_DIRECT_RGBA_BYTES;
}

Ejemplos:

Imagen

Estrategia

1200 × 900

Directa

1600 × 1000

Directa si el navegador soporta el presupuesto

1800 × 1800

Deep Zoom

2048 × 2048

Deep Zoom

3000 × 2000

Deep Zoom

6000 × 4000

Deep Zoom

Para imágenes pequeñas, la ruta directa puede utilizar decoding="async" y decode() para preparar la imagen antes de sustituir el contenido visible, evitando un frame vacío durante el cambio. 

MDN
+1

5.6. Rotación, spreads y dobles páginas
No asumiría que una doble página siempre tiene un único orden de lectura.

KuraScroll ya dispone de las funciones de doble página del Sprint 51. El nuevo motor debería aceptar un documento con dos páginas lógicas, cada una con su geometría y pirámide, o un único scan panorámico.

Mi recomendación:

Dos páginas independientes: dos manifest y dos viewports lógicos dentro de un lector común.

Scan panorámico: un manifest con una sola dimensión original.

Cambio de modo: conservar el zoom y la posición relativa cuando sea posible.

Al pasar de doble página a página individual: no reutilizar offsets ni coordenadas sin recalcular.

5.7. Cancelación de teselas obsoletas
Cuando el usuario hace zoom rápido, puede ocurrir que las teselas de un nivel anterior lleguen después de las nuevas.

Cada cambio importante de página o revisión tendrá un generationId.

interface TileRequestContext {
  generationId: number;

  pageId: string;
  revision: number;

  level: number;
  col: number;
  row: number;
}

Al recibir la respuesta, si el generationId no coincide, se descarta. No se debe pintar una tesela antigua sobre un nivel nuevo.

También deduplicaría las peticiones con una clave:

pageId:revision:level:col:row
Y cancelaría peticiones pendientes de regiones que ya no son visibles, siempre que no estén compartidas por otra solicitud activa.

5.8. Fallos de decodificación o archivos corruptos
Casos que deben cubrirse:

WebP truncado.

ETag correcto pero bytes incorrectos.

Pack segment inexistente.

Offset fuera de rango.

Tile que no corresponde al nivel solicitado.

Página sustituida durante una descarga.

Respuesta HTTP 404/500.

Falta de memoria durante createImageBitmap().

Canvas o contexto 2D no disponible.

Si falla una tesela, conservaría la representación del nivel inferior y marcaría el tile como fallido. No limpiaría toda la pantalla ni reiniciaría todo el viewport.

5.9. Preservar la geometría y evitar CLS
El manifest debe conocerse antes de colocar el viewport:

.deep-zoom-stage {
  position: relative;
  width: 100%;
  aspect-ratio: var(--page-ratio);

  overflow: hidden;
  contain: layout paint;
}

El viewport conserva sus dimensiones desde el primer render. El cambio de LOD solo cambia las teselas que se pintan, nunca el tamaño del contenedor.

6. Pruebas obligatorias de aceptación
Prueba

Escenario

Resultado requerido

AABB básico

6000 × 4000

Rango correcto

AABB fuera de límites

Pan más allá del borde

Sin teselas inválidas

AABB por zoom

0.1× a 1×

LOD coherente

AABB aleatorio

10.000 transformaciones

Cero resultados fuera de bounds

Zoom focal

Zoom bajo el cursor

Mantiene el punto observado

Pinch

Dos dedos durante 100 gestos

Sin saltos ni escalas inválidas

Pan rápido

500 movimientos

Sin acumulación de listeners

Última columna

Ancho no múltiplo de 512

Dimensiones correctas

Última fila

Alto no múltiplo de 512

Dimensiones correctas

EXIF

0°, 90°, 180°, 270°

Geometría correcta

Overlap

Todos los límites de teselas

Sin seams visibles

Cache cold

Primera apertura

Overview y tiles correctos

Cache warm

Reapertura

Sin regeneración Sharp

Cambio de zoom

Nivel anterior → nuevo

Sin teselas obsoletas

Cambio de página

100 páginas consecutivas

Sin peticiones cruzadas

Tile HTTP 304

ETag idéntico

Sin transferencia de cuerpo

Tile corrupta

Bytes truncados

Fallback al nivel inferior

Memoria

Lectura continua de 60 min

Sin acumulación creciente

Soak GPU

Zoom y pan durante 30 min

Sin pantalla negra o crash

CLS

Montaje, cambio LOD y rotación

0

Rendimiento

Pan con tiles calientes

60 FPS objetivo

7. Orden de implementación de los agentes
Para este sprint dividiría el trabajo por contrato de datos y responsabilidad, no por páginas o componentes de forma arbitraria.

Agent 1 — Deep Zoom Metadata & SQLite

Dimensiones originales/orientadas, levels, grids, revisions, offsets y manifest.

Agent 2 — Sharp Deep Zoom Builder

Worker aislado, generación de pirámide, WebP q80, ZIP tile container y verificación.

Agent 3 — Tile Storage & Fastify Gateway

Indexado de tiles, streaming por offsets, ETag, cache y leases de segmentos.

Agent 4 — AABB & LOD Engine

Coordenadas, intersecciones, selección de nivel, rangos visibles y diff de tiles.

Agent 5 — React Pan-Zoom Renderer

Pointer events, pinch, canvas acotado, carga incremental, ImageBitmap LRU y CLS cero.

Agent 6 — Hardware QA

Pruebas en el T4500/GMA 4500MHD, memoria gráfica, soak test y validación SLA 30.

8. Mi configuración definitiva para comenzar
Parámetro

Valor inicial

Tamaño de tesela

512 × 512

Overlap

1 px

Formato

WebP

Calidad inicial

80

Encoding effort

1

Sharp concurrency

1

UV thread pool

1

Jobs Deep Zoom activos

1

Límite de píxeles de entrada

40 MP

Canvas backing store

≤ 1 MP

Máximo de superficies

2048 × 2048

Bitmaps residentes

Máximo 2

Decodificaciones simultáneas

1

Caché comprimida de tiles

2 MiB iniciales

Requests en paralelo

2

AABB P95

≤ 50 µs

Difusión de LOD P95

≤ 20 µs

Frame time P95

≤ 16,67 ms

VRAM administrada, objetivo

≤ 8 MiB

CLS

0

Una recomendación adicional sobre la calidad: q80 es un punto de partida razonable para medir, pero no lo fijaría sin comparar líneas finas, tramas, screentones y degradados de manga. Haría una prueba visual q80 frente a q85 en páginas de Vagabond y Berserk. El objetivo es preservar legibilidad y detalle, no ganar únicamente porcentaje de compresión.

Mi veredicto, vro
La arquitectura que elegiría para KuraScroll es Sharp Deep Zoom AOT + almacenamiento indexado + viewport Canvas limitado + AABB sin asignaciones en el hot path.

Hay dos objetivos que debemos mantener separados:

El zoom y paneo deben responder inmediatamente con los datos ya disponibles.

Las teselas que faltan deben llegar progresivamente sin bloquear el movimiento.

El éxito del Sprint 66 no será únicamente mostrar un scan 6000 × 4000. Será conseguir que el usuario pueda ampliar una viñeta, recorrerla y volver a la página completa sin que el navegador tenga que mantener toda la imagen como una única textura.

Y la advertencia más importante: 60 FPS y 8 MiB de VRAM no pueden garantizarse solamente con TypeScript. Deben verificarse con el navegador y el driver real del GMA 4500MHD. Lo que sí podemos controlar con rigor es el tamaño de las superficies, el número de bitmaps administrados, la concurrencia de decodificación y la cantidad de trabajo que programamos por frame.

Como siguiente paso útil, prepararía los contratos compartidos de DeepZoomManifest, PyramidLevel, TileDescriptor y ViewportTransform junto con una matriz de pruebas para que los seis agentes trabajen sin incompatibilidades.


Preparar contratos y tareas técnicas del Sprint 66

Documentación de referencia
Sharp — Deep Zoom tile output

Sharp — cache y concurrency

Sharp — libuv y libvips parallelism

Fastify — respuestas mediante streams

Fastify v5 — JSON Schema requerido

MDN — ImageBitmap.close()

MDN — Pointer capture

RFC 9111 — HTTP caching





