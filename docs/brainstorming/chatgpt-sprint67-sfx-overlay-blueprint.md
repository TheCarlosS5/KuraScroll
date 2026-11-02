# Sprint 67 — Dynamic SFX & Onomatopoeia Overlay Engine

¡Vro, este sprint puede darle a KuraScroll una característica especialmente buena para manga y webtoons: comprender las expresiones sonoras y visuales de la obra sin borrar ni modificar los dibujos originales!

Mi recomendación central es construir un sistema de traducción contextual con overlays SVG no destructivos, apoyado por un diccionario multilingüe y un índice espacial. El original permanece intacto; la traducción es una capa opcional que el lector puede activar, desactivar o consultar.

Hay una distinción lingüística que vale la pena conservar en el modelo:

- Japonés: `giseigo` (voces), `giongo` (sonidos), `gitaigo` (apariencias, acciones y estados) y, cuando sea útil, `gijōgo` (sensaciones y estados psicológicos). No todo el vocabulario mimético japonés representa un sonido audible.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://pmc.ncbi.nlm.nih.gov\&sz=32)

  PMC+1

- Coreano: `의성어` (uiseongeo) representa sonidos; `의태어` (uitaeeo) describe formas, movimientos y estados. La Academia de Estudios Coreanos distingue expresamente ambas categorías.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://encykorea.aks.ac.kr\&sz=32)

  한국민족문화대백과사전+1



Por tanto, el motor no debe traducir todo como «¡BOOM!». Debe entender qué está representando la expresión y cuál es la mejor equivalencia en español o inglés.

## Arquitectura general

Original CBZ / WebP

Página original inmutable, revisión y dimensiones normalizadas.

SFX Detector + OCR

Región, texto japonés/coreano, polígono, orientación y confianza.

SFX Lexicon

Giseigo, giongo, gitaigo, uiseongeo y uitaeeo.

Context Resolver

Acción, intensidad, movimiento, escena y sentido.

Translation Manifest

Traducción elegida, alternativas, geometría normalizada y estilo visual.

SVG Overlay Renderer

Texto traducido, rotación, inclinación y tipografía adaptada a la escena.

Regla no negociable: ninguna operación del motor SFX debe modificar el WebP original, la imagen del CBZ ni la pirámide Deep Zoom del Sprint 66.

## 1. Frontend: DOM absoluto o SVG escalable

Para vuestro hardware elegiría un sistema híbrido:



Recomendación

&#x20;SVG para dibujar los SFX y DOM HTML para los controles interactivos.



Los SFX suelen necesitar rotación, escalado, inclinación, distribución vertical, líneas base diagonales y posicionamiento preciso. SVG permite controlar estas propiedades mediante coordenadas, transformaciones y elementos `<text>`.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developer.mozilla.org\&sz=32)

MDN+1



### Comparativa

| Característica             | DOM absoluto         | SVG                            |
| -------------------------- | -------------------- | ------------------------------ |
| Texto traducido            | Excelente            | Excelente                      |
| Rotación e inclinación     | CSS transform        | Transform SVG                  |
| Coordenadas normalizadas   | Requiere cálculo CSS | Natural con `viewBox`          |
| Muchos elementos agrupados | Coste de DOM         | Un único árbol SVG             |
| Accesibilidad interactiva  | Muy buena            | Requiere atributos y controles |
| Texto siguiendo formas     | Más complicado       | Mejor soporte                  |
| Escalado con la imagen     | Transform CSS        | Transform del grupo            |
| Complejidad visual         | Baja                 | Media                          |

Para KuraScroll no crearía un elemento HTML absoluto independiente por cada sílaba de una onomatopeya. Utilizaría un SVG por página que contiene los overlays visibles.

### 1.1. Sistema de coordenadas

Cada página se representa en su sistema original:

```
<svg
  viewBox="0 0 6000 4000"
  preserveAspectRatio="none"
>
  <g id="sfx-overlay">
    <!-- Traducciones -->
  </g>
</svg>
```

Una región del 50% del ancho y 30% de la altura se expresa como:

```
x = 0.50
y = 0.30
```

El backend no necesita conocer el tamaño del viewport del navegador. El SVG se escala junto con la página o con la composición Deep Zoom.

### 1.2. Renderizado SVG recomendado

```
interface SfxOverlayItem {
  id: number;
  text: string;

  x: number;
  y: number;

  rotation: number;
  scale: number;

  fontSize: number;

  color: string;
  outlineColor: string;

  vertical: boolean;
}

function SfxSvgOverlay({
  items
}: {
  items: readonly SfxOverlayItem[];
}) {
  return (
    <svg
      className="sfx-overlay"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {items.map(item => (
        <text
          key={item.id}
          x={item.x}
          y={item.y}
          fontSize={item.fontSize}
          fill={item.color}
          stroke={item.outlineColor}
          strokeWidth="2"
          strokeLinejoin="round"
          paintOrder="stroke fill"
          textAnchor="middle"
          dominantBaseline="middle"
          transform={
            `rotate(${item.rotation} ${item.x} ${item.y}) ` +
            `scale(${item.scale})`
          }
          writingMode={
            item.vertical ? "vertical-rl" : "horizontal-tb"
          }
        >
          {item.text}
        </text>
      ))}
    </svg>
  );
}
```

El ejemplo utiliza un `viewBox` normalizado para la ilustración. En producción utilizaría directamente las dimensiones lógicas del manifest de la página cuando ya estén disponibles.

También evitaría pasar estilos calculados o strings complejos a React durante cada frame de paneo. El SVG se crea cuando cambia el manifest, no cada vez que se mueve el viewport.

### 1.3. Tipografía de manga

Prepararía una pequeña colección de presets, no un catálogo de fuentes enorme.

| Preset           | Uso                                  |
| ---------------- | ------------------------------------ |
| `IMPACT_BOLD`    | Golpes, explosiones                  |
| `BRUSH_JP`       | SFX japoneses tradicionales          |
| `ROUGH_DISPLAY`  | Criaturas, rugidos                   |
| `CONDENSED`      | Sonidos largos en espacios estrechos |
| `SOFT_ROUNDED`   | Caídas suaves, movimientos delicados |
| `KOREAN_DISPLAY` | Onomatopeyas coreanas                |

La fuente de traducción debe ser independiente de la fuente japonesa o coreana. No debemos suponer que una fuente latina puede representar caracteres Hangul, kanji y kana correctamente.

Para los perfiles de fuentes, registraría fallback:

```
.sfx-font-impact {
  font-family: "Arial Black", Impact, sans-serif;
  font-weight: 900;
}

.sfx-font-condensed {
  font-family: "Arial Narrow", "Arial", sans-serif;
  font-weight: 800;
}

.sfx-font-brush {
  font-family: "Yu Mincho", "Noto Serif JP", serif;
}
```

Las fuentes nuevas se deben cargar y validar previamente. Evitaría descargar familias de fuentes completas durante la lectura.

### 1.4. Contorno de alto contraste sin blur

En SVG:

```
.sfx-text {
  stroke: #111;
  stroke-width: 2px;
  stroke-linejoin: round;
  paint-order: stroke fill;

  filter: none;
}
```

En DOM, cuando se necesite texto HTML, también se puede usar un contorno CSS de radio cero mediante varios `text-shadow` de un píxel. No utilizaría `text-shadow` difuso ni sombras grandes.

### 1.5. Cómo sostener 60 FPS

La regla fundamental es que los overlays se transforman junto con la página. No recalculamos cada etiqueta durante cada movimiento del puntero.

```
.sfx-overlay {
  position: absolute;
  inset: 0;

  width: 100%;
  height: 100%;

  pointer-events: none;
  overflow: visible;
}

.sfx-overlay text {
  filter: none;
}
```

Durante el paneo:

1. Actualizar `tx`, `ty` y `scale` en un objeto mutable.
2. Programar un único `requestAnimationFrame`.
3. Aplicar una transformación al contenedor común de página.
4. Mantener los nodos SVG existentes.
5. Volver a calcular colisiones y visibilidad solamente cuando sea necesario.

El movimiento de la página y la capa SVG deben utilizar exactamente la misma transformación.

No haría esto: actualizar `left`, `top`, `fontSize` y `rotation` de 30 elementos DOM en cada evento `pointermove`.

Haría esto: transformar una sola composición completa y actualizar la geometría únicamente cuando cambie el manifest, la escala o el conjunto de overlays visibles.

`contain: layout style paint` puede ayudar a aislar una subestructura del DOM, pero `paint` crea un límite de pintura y puede recortar los elementos que sobresalen de su contenedor. Para SFX que se extienden fuera de una viñeta, no aplicaría esa combinación sin comprobar el clipping.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developer.mozilla.org\&sz=32)

MDN



### 1.6. Evitar colisiones con el arte original

Una traducción no debe tapar:

- Rostros y expresiones.
- Bocadillos de diálogo.
- Líneas importantes de movimiento.
- Onomatopeyas originales que el lector quiere conservar.

Crearía un pequeño sistema de colocación que proponga posiciones cercanas al SFX original:

```
Región SFX original
       |
       +-- Traducción encima
       |
       +-- Traducción debajo
       |
       +-- Traducción lateral
       |
       +-- Traducción en margen libre
```

El motor puede calcular varios candidatos, pero la selección requiere una función de coste:

\\[ Cost = w_1 \cdot OverlapSFX + w_2 \cdot OverlapDialogue + w_3 \cdot OverlapFace + w_4 \cdot DistanceFromSource \\]

Los pesos deben priorizar no tapar el diálogo ni los rostros.

El original seguirá siendo visible. Añadiría tres modos de presentación:

| Modo                     | Comportamiento                                        |
| ------------------------ | ----------------------------------------------------- |
| `ORIGINAL_ONLY`          | Solo SFX original                                     |
| `TRANSLATION_ADJACENT`   | Traducción cerca de la expresión original             |
| `TRANSLATION_ANNOTATION` | Traducción pequeña y explicativa, anclada a la región |

No implementaría borrado del texto original ni inpainting en este sprint. Eso ya sería una modificación destructiva del arte, con un coste de CPU, memoria y posibles artefactos totalmente innecesario para el objetivo.

## 2. Backend: diccionario japonés/coreano y traducción contextual

### 2.1. Estructura lingüística

No guardaría una traducción única por expresión.

Una misma forma puede representar sonidos, movimientos o sensaciones diferentes según la escena.

El diccionario debe representar:

1. Forma original.
2. Idioma y sistema de escritura.
3. Categoría lingüística.
4. Lecturas y romanizaciones.
5. Significados posibles.
6. Traducciones por idioma objetivo.
7. Ejemplos contextuales.
8. Estilo y fuerza visual de la expresión.

Por ejemplo, el coreano `의성어` y `의태어` no son categorías intercambiables: uno representa sonidos y otro describe apariencia, movimiento o estado. Además, las consonantes y vocales pueden cambiar la sensación expresiva de una forma.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://encykorea.aks.ac.kr\&sz=32)

한국민족문화대백과사전+2



En japonés también separaría los efectos que imitan sonidos de los que expresan acciones, estados o sensaciones.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://pmc.ncbi.nlm.nih.gov\&sz=32)

PMC+1



### 2.2. Tipos TypeScript

```
export type SfxLanguage = "ja" | "ko";

export type SfxCategory =
  | "GISEIGO"       // Voz de seres vivos
  | "GIONGO"        // Sonidos de objetos/entorno
  | "GITAGO"        // Acción, movimiento, estado
  | "GIJOGO"        // Sensación o estado psicológico
  | "UISEONGEO"     // Coreano: imitación de sonido
  | "UITAEEO";      // Coreano: imitación de forma/estado

export type SfxTranslationStrategy =
  | "EQUIVALENT_SFX"
  | "DESCRIPTIVE"
  | "TRANSLITERATION"
  | "KEEP_ORIGINAL";

export type SfxTargetLanguage = "es" | "en";

export type SfxOrientation =
  | "HORIZONTAL"
  | "VERTICAL"
  | "ROTATED"
  | "CURVED";

export type SfxConfidence =
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export interface SfxLexeme {
  entryId: number;

  sourceLanguage: SfxLanguage;
  category: SfxCategory;

  canonicalSurface: string;

  kana?: string;
  hangul?: string;

  romanization?: string;

  semanticTags: readonly string[];
}

export interface SfxSense {
  senseId: number;
  entryId: number;

  meaningEs: string;
  meaningEn: string;

  contextTags: readonly string[];

  intensity: number;
  motion: "STATIC" | "IMPACT" | "RAPID" | "CONTINUOUS" | "UNKNOWN";
}

export interface SfxTranslation {
  senseId: number;

  targetLanguage: SfxTargetLanguage;

  translatedText: string;

  strategy: SfxTranslationStrategy;

  register: "NEUTRAL" | "COLOQUIAL" | "DRAMATIC" | "LITERARY";

  confidence: number;
}
```

Añadiría `category` como clasificación primaria, pero permitiría varias etiquetas semánticas. Por ejemplo, un mismo sonido puede describir un golpe, su intensidad, su repetición y la reacción emocional que provoca.

### 2.3. Diccionario de referencia y romanización

Guardaría como claves de búsqueda:

- Japonés original.
- Kana, cuando la forma utiliza kanji.
- Romaji Hepburn normalizado.
- Hangul original.
- Romanización coreana.
- Equivalentes españoles.
- Equivalentes ingleses.
- Aliases y variantes gráficas.

Para coreano usaría la Romanización Revisada como convención predeterminada, no una transcripción improvisada. El Instituto Nacional de la Lengua Coreana documenta su sistema oficial de romanización basado en la pronunciación estándar.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.korean.go.kr\&sz=32)

Korean Language Portal



No eliminaría todos los caracteres repetidos al normalizar. En este tipo de vocabulario, la repetición puede intensificar o modificar el efecto. La forma canónica y las variantes deben conservar la repetición original.

## 3. Esquema SQLite recomendado

Dividiría el diccionario en cuatro grupos de tablas: entradas, formas alternativas, sentidos y traducciones.

### 3.1. Entradas léxicas

```
CREATE TABLE IF NOT EXISTS sfx_lexemes (
    entry_id INTEGER PRIMARY KEY,

    language_code TEXT NOT NULL
        CHECK (language_code IN ('ja', 'ko')),

    category TEXT NOT NULL
        CHECK (category IN (
            'GISEIGO',
            'GIONGO',
            'GITAGO',
            'GIJOGO',
            'UISEONGEO',
            'UITAEEO'
        )),

    canonical_surface TEXT NOT NULL,
    normalized_surface TEXT NOT NULL,

    description_es TEXT,
    description_en TEXT,

    source_id INTEGER,

    revision INTEGER NOT NULL DEFAULT 1,

    confidence REAL NOT NULL DEFAULT 1.0
        CHECK (confidence BETWEEN 0.0 AND 1.0),

    status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN (
            'ACTIVE',
            'REVIEW',
            'DISABLED'
        )),

    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,

    UNIQUE(language_code, normalized_surface)
);

CREATE INDEX IF NOT EXISTS idx_sfx_lexeme_lookup
ON sfx_lexemes (
    language_code,
    normalized_surface
);
```

### 3.2. Variantes de escritura y romanizaciones

```
CREATE TABLE IF NOT EXISTS sfx_lexeme_variants (
    variant_id INTEGER PRIMARY KEY,

    entry_id INTEGER NOT NULL,

    variant_type TEXT NOT NULL
        CHECK (variant_type IN (
            'KANJI',
            'HIRAGANA',
            'KATAKANA',
            'ROMAJI',
            'HANGUL',
            'RR_ROMANIZATION',
            'OCR_VARIANT',
            'ALIAS'
        )),

    locale TEXT NOT NULL,

    surface TEXT NOT NULL,
    normalized_surface TEXT NOT NULL,

    FOREIGN KEY (entry_id)
        REFERENCES sfx_lexemes(entry_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sfx_variant_lookup
ON sfx_lexeme_variants(
    locale,
    normalized_surface
);
```

Esto es más flexible que tener columnas obligatorias para `kana`, `romaji` y `hangul` dentro de cada entrada. No todas las entradas tienen las tres formas, y algunas presentan múltiples variantes.

### 3.3. Sentidos semánticos

```
CREATE TABLE IF NOT EXISTS sfx_senses (
    sense_id INTEGER PRIMARY KEY,

    entry_id INTEGER NOT NULL,

    sense_order INTEGER NOT NULL DEFAULT 0,

    event_type TEXT NOT NULL,

    semantic_description_es TEXT NOT NULL,
    semantic_description_en TEXT NOT NULL,

    intensity REAL NOT NULL DEFAULT 0.5
        CHECK (intensity BETWEEN 0.0 AND 1.0),

    duration_type TEXT NOT NULL DEFAULT 'INSTANT'
        CHECK (duration_type IN (
            'INSTANT',
            'REPEATED',
            'CONTINUOUS',
            'UNKNOWN'
        )),

    motion_type TEXT NOT NULL DEFAULT 'UNKNOWN'
        CHECK (motion_type IN (
            'STATIC',
            'IMPACT',
            'RAPID',
            'SLOW',
            'CONTINUOUS',
            'UNKNOWN'
        )),

    FOREIGN KEY (entry_id)
        REFERENCES sfx_lexemes(entry_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sfx_sense_entry
ON sfx_senses(entry_id, sense_order);
```

### 3.4. Traducciones

```
CREATE TABLE IF NOT EXISTS sfx_translations (
    translation_id INTEGER PRIMARY KEY,

    sense_id INTEGER NOT NULL,

    target_language TEXT NOT NULL
        CHECK (target_language IN ('es', 'en')),

    translated_text TEXT NOT NULL,

    strategy TEXT NOT NULL
        CHECK (strategy IN (
            'EQUIVALENT_SFX',
            'DESCRIPTIVE',
            'TRANSLITERATION',
            'KEEP_ORIGINAL'
        )),

    register TEXT NOT NULL DEFAULT 'NEUTRAL',

    style_preset TEXT NOT NULL DEFAULT 'IMPACT_BOLD',

    priority INTEGER NOT NULL DEFAULT 100,

    confidence REAL NOT NULL DEFAULT 1.0
        CHECK (confidence BETWEEN 0.0 AND 1.0),

    source_id INTEGER,

    revision INTEGER NOT NULL DEFAULT 1,

    FOREIGN KEY (sense_id)
        REFERENCES sfx_senses(sense_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sfx_translation_sense
ON sfx_translations(
    sense_id,
    target_language,
    priority
);
```

### 3.5. Etiquetas contextuales

```
CREATE TABLE IF NOT EXISTS sfx_context_tags (
    tag_id INTEGER PRIMARY KEY,
    tag_key TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS sfx_sense_tags (
    sense_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,

    PRIMARY KEY(sense_id, tag_id),

    FOREIGN KEY (sense_id)
        REFERENCES sfx_senses(sense_id)
        ON DELETE CASCADE,

    FOREIGN KEY (tag_id)
        REFERENCES sfx_context_tags(tag_id)
        ON DELETE CASCADE
);
```

Etiquetas sugeridas:

```
impact
explosion
footsteps
heartbeat
wind
water
rumble
trembling
silence
sparkle
crunch
creaking
breathing
fear
anger
movement
```

No utilizaría una sola columna de tags separada por comas. Las relaciones normalizadas permiten encontrar rápidamente todos los sentidos asociados a una escena concreta.

## 4. Buscador multilingüe SQLite

Reutilizaría el FTS5 trigram del Sprint 60 y el tokenizador CJK del proyecto. No crearía un nuevo motor de búsqueda de idiomas.

Crearía un índice especializado para búsquedas del diccionario:

```
CREATE VIRTUAL TABLE IF NOT EXISTS sfx_search_fts
USING fts5(
    source_surface,
    romanization,
    meaning_es,
    meaning_en,
    content='sfx_search_documents',
    content_rowid='search_id',
    tokenize='unicode61 remove_diacritics 0',
    detail=full
);
```

La tabla `sfx_search_documents` contiene una fila por variante de búsqueda, con la relación al `entry_id`.

Para las búsquedas de subcadenas en kana, hangul o romanización, reutilizaría el trigram existente o crearía un índice separado solo cuando el tamaño y los benchmarks lo justifiquen. FTS5 admite el tokenizador `trigram` para coincidencias de subcadenas, mientras que `unicode61` proporciona búsqueda de tokens Unicode. Sin embargo, el trigram necesita al menos tres caracteres para búsquedas FTS completas; consultas más cortas deben ir a los índices exactos.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.sqlite.org\&sz=32)

SQLite



La estrategia:

| Consulta                  | Índice                      |
| ------------------------- | --------------------------- |
| Expresión japonesa exacta | B-tree `normalized_surface` |
| Kana parcial              | Trigram                     |
| Romaji                    | B-tree + FTS5               |
| Hangul exacto             | B-tree                      |
| Hangul parcial            | Trigram                     |
| Significado español       | FTS5                        |
| Meaning English           | FTS5                        |
| Alias                     | B-tree + FTS5               |

No buscaría globalmente mediante `LIKE '%texto%'` sobre todas las entradas. El motor debe usar el índice correspondiente y limitar las consultas a una página de resultados pequeña.

## 5. Estructura espacial: coordenadas normalizadas

Esta parte debe integrarse directamente con el viewport Deep Zoom del Sprint 66.

No guardaría posiciones absolutas en píxeles CSS, porque cambian con la resolución, orientación, zoom y tamaño de ventana.

Todas las posiciones se refieren a la página original ya normalizada por orientación EXIF.

Usaría coordenadas normalizadas:

\\[ x_n=\frac{x}{W}, \qquad y_n=\frac{y}{H} \\]

Por tanto:

```
(0, 0) = esquina superior izquierda
(1, 1) = esquina inferior derecha
```

### 5.1. Bounding box de una onomatopeya

```
export interface NormalizedSfxBox {
  x: number;
  y: number;

  width: number;
  height: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface SfxGeometry {
  bounds: NormalizedSfxBox;

  // Polígono opcional para SFX inclinados o irregulares.
  polygon?: readonly NormalizedPoint[];

  orientation: SfxOrientation;

  baselineAngle: number;

  anchor: NormalizedPoint;
}
```

El bounding box permite calcular la intersección con el viewport. El polígono permite conservar la forma de la región detectada por OCR. El ángulo de la línea base ayuda a reconstruir la inclinación visual.

### 5.2. Guardar coordenadas como enteros

En SQLite almacenaría coordenadas normalizadas con una escala fija de un millón:

```
const SFX_COORD_SCALE = 1_000_000;

export function normalizeCoordinate(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Invalid coordinate");
  }

  return Math.round(
    Math.max(0, Math.min(1, value)) *
    SFX_COORD_SCALE
  );
}

export function denormalizeCoordinate(value: number): number {
  return value / SFX_COORD_SCALE;
}
```

Esto evita guardar coordenadas flotantes dependientes de la resolución del scan y permite establecer límites mediante `CHECK`.

### 5.3. Tabla de apariciones de SFX

```
CREATE TABLE IF NOT EXISTS sfx_occurrences (
    occurrence_id INTEGER PRIMARY KEY,

    page_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    series_id TEXT NOT NULL,

    page_revision INTEGER NOT NULL,
    source_fingerprint TEXT NOT NULL,

    entry_id INTEGER,

    source_language TEXT NOT NULL
        CHECK (source_language IN ('ja', 'ko')),

    source_text TEXT NOT NULL,
    normalized_source_text TEXT NOT NULL,

    -- BBox normalizada en escala 0..1.000.000.
    x INTEGER NOT NULL CHECK (x BETWEEN 0 AND 1000000),
    y INTEGER NOT NULL CHECK (y BETWEEN 0 AND 1000000),

    width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 1000000),
    height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 1000000),

    anchor_x INTEGER NOT NULL CHECK (anchor_x BETWEEN 0 AND 1000000),
    anchor_y INTEGER NOT NULL CHECK (anchor_y BETWEEN 0 AND 1000000),

    baseline_angle REAL NOT NULL DEFAULT 0,

    orientation TEXT NOT NULL
        CHECK (orientation IN (
            'HORIZONTAL',
            'VERTICAL',
            'ROTATED',
            'CURVED'
        )),

    reading_direction TEXT NOT NULL DEFAULT 'LTR',

    ocr_confidence REAL NOT NULL
        CHECK (ocr_confidence BETWEEN 0.0 AND 1.0),

    detection_confidence REAL NOT NULL
        CHECK (detection_confidence BETWEEN 0.0 AND 1.0),

    selected_sense_id INTEGER,
    selected_translation_id INTEGER,

    status TEXT NOT NULL DEFAULT 'DETECTED'
        CHECK (status IN (
            'DETECTED',
            'RESOLVED',
            'REVIEW',
            'DISABLED'
        )),

    created_at_ms INTEGER NOT NULL,

    FOREIGN KEY (entry_id)
        REFERENCES sfx_lexemes(entry_id),

    FOREIGN KEY (selected_sense_id)
        REFERENCES sfx_senses(sense_id),

    FOREIGN KEY (selected_translation_id)
        REFERENCES sfx_translations(translation_id),

    CHECK (x + width <= 1000000),
    CHECK (y + height <= 1000000)
);

CREATE INDEX IF NOT EXISTS idx_sfx_occurrence_page
ON sfx_occurrences(
    page_id,
    page_revision,
    status
);

CREATE INDEX IF NOT EXISTS idx_sfx_occurrence_chapter
ON sfx_occurrences(
    chapter_id,
    page_id
);

CREATE INDEX IF NOT EXISTS idx_sfx_occurrence_entry
ON sfx_occurrences(entry_id);
```

La restricción de `x + width` y `y + height` evita que una región normalizada se salga de la página.

### 5.4. Polígonos y letras curvas

Para SFX curvos o inclinados añadiría una tabla de vértices:

```
CREATE TABLE IF NOT EXISTS sfx_occurrence_vertices (
    occurrence_id INTEGER NOT NULL,

    vertex_order INTEGER NOT NULL,

    x INTEGER NOT NULL CHECK (x BETWEEN 0 AND 1000000),
    y INTEGER NOT NULL CHECK (y BETWEEN 0 AND 1000000),

    PRIMARY KEY (occurrence_id, vertex_order),

    FOREIGN KEY (occurrence_id)
        REFERENCES sfx_occurrences(occurrence_id)
        ON DELETE CASCADE
) WITHOUT ROWID;
```

No exigiría polígonos a todas las apariciones. Para una palabra horizontal, el bounding box es suficiente. Para una expresión diagonal o curva, el polígono ayuda a estimar la región y evitar colisiones con otros elementos.

Limitaría inicialmente los polígonos a 4–8 vértices por aparición. No es necesario introducir mallas complejas para un overlay textual.

### 5.5. Índice espacial RTree

Para una página con muchas apariciones, SQLite puede resolver intersecciones espaciales con RTree.

```
CREATE VIRTUAL TABLE IF NOT EXISTS sfx_occurrence_rtree
USING rtree(
    occurrence_id,
    min_x, max_x,
    min_y, max_y
);
```

Los valores se insertan en coordenadas normalizadas de coma flotante, después de convertir los enteros de un millón.

```
CREATE TRIGGER IF NOT EXISTS sfx_occurrence_rtree_insert
AFTER INSERT ON sfx_occurrences
BEGIN
    INSERT INTO sfx_occurrence_rtree(
        occurrence_id,
        min_x,
        max_x,
        min_y,
        max_y
    )
    VALUES (
        new.occurrence_id,
        new.x / 1000000.0,
        (new.x + new.width) / 1000000.0,
        new.y / 1000000.0,
        (new.y + new.height) / 1000000.0
    );
END;
```

Añadiría triggers equivalentes para actualización y eliminación.

La disponibilidad de RTree debe comprobarse durante la inicialización SQLite, porque depende de cómo se haya compilado la biblioteca. Para el manifiesto habitual de una página, también puedes recuperar todas sus apariciones mediante el índice B-tree y resolver la visibilidad en memoria. No añadiría una consulta RTree al camino caliente del paneo.

### 5.6. Conversión de coordenadas al viewport

El frontend transforma cada punto:

\\[ screenX=t_x+(x_n\cdot W)\cdot s \\]

\\[ screenY=t_y+(y_n\cdot H)\cdot s \\]

Código:

```
export interface SfxScreenPosition {
  x: number;
  y: number;

  width: number;
  height: number;
}

export function mapSfxToScreen(
  box: NormalizedSfxBox,
  pageWidth: number,
  pageHeight: number,
  scale: number,
  tx: number,
  ty: number,
  output: SfxScreenPosition
): void {
  const imageX = box.x * pageWidth;
  const imageY = box.y * pageHeight;

  output.x = tx + imageX * scale;
  output.y = ty + imageY * scale;

  output.width = box.width * pageWidth * scale;
  output.height = box.height * pageHeight * scale;
}
```

La función recibe un objeto de salida reutilizable. No crea objetos nuevos en el ciclo del paneo.

Muy importante: las coordenadas de los SFX pertenecen a la página original, no a cada tesela Deep Zoom. Por eso una traducción seguirá bien colocada al cambiar del nivel general al detalle.

## 6. Detección y traducción: no confundir OCR con diccionario

El motor necesita detectar expresiones que no son texto de bocadillo. Para eso reutilizaría los datos de OCR del Sprint 55, pero añadiría un clasificador SFX especializado.

La secuencia:

```
Página original
      ↓
Regiones OCR candidatas
      ↓
Clasificador SFX / diálogo / decoración
      ↓
OCR especializado de kana o hangul
      ↓
Normalización de la expresión
      ↓
Lexicon Lookup
      ↓
Selección contextual del sentido
      ↓
Traducción española o inglesa
      ↓
Generación de overlay
```

La etapa de clasificación es importante porque una palabra dibujada puede parecerse a un SFX, pero ser parte de una señal, un cartel o un texto narrativo integrado en la ilustración.

No ejecutaría un modelo pesado en cada cambio de página. La detección y el reconocimiento se realizan AOT, durante la importación o indexación del capítulo.

### 6.1. Resolución contextual

Un diccionario no debe traducir por similitud textual solamente.

Construiría un puntaje de resolución:

\\[ Score = w_1L + w_2C + w_3A + w_4I + w_5F \\]

Donde:

- \\(L\\): coincidencia léxica.
- \\(C\\): compatibilidad contextual.
- \\(A\\): correspondencia con la acción representada.
- \\(I\\): intensidad compatible.
- \\(F\\): confianza de detección/OCR.

No es necesario usar IA generativa para cada expresión. El sistema puede trabajar con reglas, etiquetas y traducciones curadas.

Ejemplo conceptual:

```
export interface SfxContext {
  action:
    | "IMPACT"
    | "MOVEMENT"
    | "FALL"
    | "WATER"
    | "FIRE"
    | "EMOTION"
    | "AMBIENCE"
    | "UNKNOWN";

  intensity: number;

  repetition: number;

  visualTags: readonly string[];
}

export interface SfxResolutionResult {
  senseId: number | null;
  translationId: number | null;

  confidence: number;

  alternatives: readonly number[];

  requiresReview: boolean;
}
```

### 6.2. Política de confianza

| Confianza     | Comportamiento                               |
| ------------- | -------------------------------------------- |
| 0.90–1.00     | Mostrar traducción recomendada               |
| 0.75–0.89     | Mostrar traducción con opción de alternativa |
| 0.50–0.74     | Conservar original y ofrecer anotación       |
| Menos de 0.50 | No traducir automáticamente                  |

Estos umbrales son valores iniciales de producto. Deben calibrarse con un corpus de manga y webtoon anotado por personas, no elegirse porque sí.

La recomendación más importante: ante una detección dudosa, mostrar menos información es mejor que traducir una onomatopeya incorrectamente.

## 7. Contrato de overlays: geometría, traducción y estilo

Definiría un manifest completo para una página. El frontend no tiene que buscar el diccionario ni interpretar nuevamente el contexto.

```
export type SfxPlacement =
  | "ABOVE"
  | "BELOW"
  | "LEFT"
  | "RIGHT"
  | "NEAR_SOURCE"
  | "MARGIN";

export type SfxDisplayMode =
  | "ORIGINAL_ONLY"
  | "TRANSLATION_ADJACENT"
  | "TRANSLATION_ANNOTATION";

export interface SfxStyle {
  fontPreset:
    | "IMPACT_BOLD"
    | "BRUSH_JP"
    | "ROUGH_DISPLAY"
    | "CONDENSED"
    | "SOFT_ROUNDED"
    | "KOREAN_DISPLAY";

  fontSizeRatio: number;

  fillColor: string;
  outlineColor: string;

  outlineWidthRatio: number;

  bold: boolean;
  italic: boolean;
}

export interface SfxOverlay {
  occurrenceId: number;

  sourceText: string;
  translatedText: string;

  sourceLanguage: SfxLanguage;
  targetLanguage: SfxTargetLanguage;

  strategy: SfxTranslationStrategy;

  sourceBounds: NormalizedSfxBox;

  polygon?: readonly NormalizedPoint[];

  translatedAnchor: NormalizedPoint;

  baselineAngle: number;

  orientation: SfxOrientation;

  placement: SfxPlacement;

  style: SfxStyle;

  confidence: number;
}

export interface SfxPageManifest {
  pageId: string;

  pageRevision: number;
  sourceFingerprint: string;

  originalWidth: number;
  originalHeight: number;

  targetLanguage: SfxTargetLanguage;

  displayMode: SfxDisplayMode;

  dictionaryRevision: number;

  overlays: readonly SfxOverlay[];
}
```

Separaría `sourceBounds` de `translatedAnchor`: la primera representa dónde estaba el SFX original y la segunda determina dónde se dibuja la traducción.

Eso permite que una expresión muy grande se traduzca con una etiqueta más corta en un espacio cercano, sin superponerla necesariamente sobre los caracteres originales.

### 7.1. Renderizado con `viewBox` de dimensiones originales

Esta sería mi implementación preferida:

```
interface SfxPageLayerProps {
  manifest: SfxPageManifest;
  mode: SfxDisplayMode;
}

export function SfxPageLayer({
  manifest,
  mode
}: SfxPageLayerProps) {
  if (mode === "ORIGINAL_ONLY") {
    return null;
  }

  const {
    originalWidth: width,
    originalHeight: height
  } = manifest;

  return (
    <svg
      className="sfx-page-layer"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {manifest.overlays.map(item => {
        const x = item.translatedAnchor.x * width;
        const y = item.translatedAnchor.y * height;

        const fontSize =
          item.style.fontSizeRatio * height;

        return (
          <text
            key={item.occurrenceId}
            x={x}
            y={y}
            fill={item.style.fillColor}
            stroke={item.style.outlineColor}
            strokeWidth={
              item.style.outlineWidthRatio * height
            }
            strokeLinejoin="round"
            paintOrder="stroke fill"
            fontSize={fontSize}
            fontWeight={item.style.bold ? 900 : 700}
            fontStyle={item.style.italic ? "italic" : "normal"}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={
              `rotate(${item.baselineAngle} ${x} ${y})`
            }
          >
            {item.translatedText}
          </text>
        );
      })}
    </svg>
  );
}
```

El `viewBox` coincide con las dimensiones de la página. El SVG y las teselas Deep Zoom comparten así el mismo sistema geométrico.

Para un SFX vertical o curvo, el renderizador puede utilizar un grupo SVG con una orientación específica. No generaría rutas vectoriales de texto para cada palabra: eso eleva la complejidad y puede aumentar el coste de rasterización.

### 7.2. Evitar rerenders durante pan y zoom

React se ocupa de crear el overlay cuando cambia el manifest. El controlador del viewport solo modifica la transformación del contenedor.

```
<div className="deep-zoom-page">
  <div
    ref={pageTransformRef}
    className="deep-zoom-transform"
  >
    <TileCanvas />
    <SfxPageLayer
      manifest={manifest}
      mode={mode}
    />
  </div>
</div>
```

```
.deep-zoom-transform {
  position: absolute;
  inset: 0;

  transform-origin: 0 0;
}

.sfx-page-layer {
  position: absolute;
  inset: 0;

  width: 100%;
  height: 100%;

  overflow: visible;
  pointer-events: none;

  filter: none;
}
```

La posición, escala y rotación de la página deben aplicarse una sola vez al contenedor común.

Para interacciones, añadiría una capa HTML accesible de controles separados. El SVG visual puede tener `aria-hidden="true"` y un listado semántico alternativo con las traducciones para lectores de pantalla.

### 7.3. Límites de complejidad visual

Establecería inicialmente:

| Recurso                                | Límite                       |
| -------------------------------------- | ---------------------------- |
| SFX detectados por página              | Sin límite de almacenamiento |
| SFX dibujados simultáneamente          | 32                           |
| SFX visibles prioritarios              | 24                           |
| Actualizaciones de geometría por frame | 1 lote                       |
| Nodos SVG reconstruidos durante pan    | 0                            |
| Filtros SVG                            | 0                            |
| CSS blur                               | 0                            |
| Backdrop-filter                        | 0                            |
| Sombras difusas                        | 0                            |

Si una página tiene más de 32 apariciones, se muestran primero las de mayor confianza, relevancia visual y cercanía al viewport. Las demás pueden aparecer al cambiar la escala o abrir el panel de consulta.

## 8. Endpoints Fastify v5

Utilizaría tres endpoints principales y uno editorial.

### 8.1. Manifest de una página

```
GET /api/v1/pages/:pageId/sfx/manifest?target=es&mode=TRANSLATION_ADJACENT
```

Devuelve las traducciones ya resueltas para esa página.

Esquema Fastify v5:

```
const manifestSchema = {
  params: {
    type: "object",
    properties: {
      pageId: {
        type: "string",
        minLength: 1,
        maxLength: 128
      }
    },
    required: ["pageId"],
    additionalProperties: false
  },

  querystring: {
    type: "object",
    properties: {
      target: {
        type: "string",
        enum: ["es", "en"]
      },

      mode: {
        type: "string",
        enum: [
          "ORIGINAL_ONLY",
          "TRANSLATION_ADJACENT",
          "TRANSLATION_ANNOTATION"
        ]
      }
    },
    additionalProperties: false
  }
};
```

En Fastify 5, los esquemas de parámetros y querystring deben ser JSON Schema completos cuando se utiliza el validador predeterminado.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub+1



Respuesta conceptual:

```
{
  "pageId": "page-849",
  "pageRevision": 3,
  "sourceFingerprint": "sha256:...",
  "originalWidth": 6000,
  "originalHeight": 4000,
  "targetLanguage": "es",
  "displayMode": "TRANSLATION_ADJACENT",
  "dictionaryRevision": 12,
  "overlays": [
    {
      "occurrenceId": 183,
      "sourceText": "ドン",
      "translatedText": "¡BUM!",
      "sourceLanguage": "ja",
      "targetLanguage": "es",
      "strategy": "EQUIVALENT_SFX",
      "sourceBounds": {
        "x": 0.36,
        "y": 0.43,
        "width": 0.14,
        "height": 0.08
      },
      "translatedAnchor": {
        "x": 0.43,
        "y": 0.50
      },
      "baselineAngle": -12,
      "orientation": "ROTATED",
      "placement": "BELOW",
      "confidence": 0.96,
      "style": {
        "fontPreset": "IMPACT_BOLD",
        "fontSizeRatio": 0.045,
        "fillColor": "#ffffff",
        "outlineColor": "#111111",
        "outlineWidthRatio": 0.001,
        "bold": true,
        "italic": false
      }
    }
  ]
}
```

El ejemplo de traducción es ilustrativo; la traducción definitiva depende del contexto de la escena.

### 8.2. Búsqueda del diccionario

```
GET /api/v1/sfx/lookup?q=ドン&source=ja&target=es
```

Respuesta:

```
{
  "query": "ドン",
  "sourceLanguage": "ja",
  "targetLanguage": "es",
  "results": [
    {
      "entryId": 51,
      "surface": "ドン",
      "category": "GIONGO",
      "senses": [
        {
          "senseId": 120,
          "meaning": "Impacto fuerte",
          "translation": "¡BUM!",
          "strategy": "EQUIVALENT_SFX"
        }
      ]
    }
  ]
}
```

Este endpoint es para el glosario, no para el movimiento normal del lector. Las traducciones de la página ya deben venir dentro de su manifest.

### 8.3. Detalle de una entrada

```
GET /api/v1/sfx/entries/:entryId?target=es
```

Devuelve definiciones, alternativas, romanización, ejemplos y diferencias contextuales.

### 8.4. Correcciones editoriales

```
PATCH /api/v1/sfx/occurrences/:occurrenceId/translation
```

Solo para usuarios con permisos editoriales.

Request:

```
{
  "translationId": 901,
  "targetLanguage": "es",
  "translatedText": "¡CRAC!",
  "strategy": "EQUIVALENT_SFX",
  "expectedRevision": 4
}
```

Utilizaría control de versión optimista mediante `expectedRevision`. Una corrección crea una nueva revisión de la traducción, en lugar de modificar silenciosamente un contenido compartido que otra persona puede estar editando.

El endpoint debe validar también que el usuario tenga permisos para modificar esa aparición y que la traducción pertenezca al idioma objetivo solicitado.

### 8.5. ETag y cache HTTP

Las rutas deben incluir versión de página y revisión de diccionario cuando sea posible:

```
/api/v1/pages/page-849/r3/sfx/manifest/d12?target=es
```

Headers:

```
ETag: "sha256-..."
Cache-Control: private, max-age=3600, must-revalidate
Content-Type: application/json
```

Una página y un diccionario inmutables permiten cachear el manifest. Una corrección crea una revisión nueva.

Para respuestas dinámicas no versionadas, utilizaría `ETag` y revalidación. No aplicaría `immutable` a una ruta cuyo contenido puede cambiar bajo la misma URL.

## 9. Índice FTS y mantenimiento del diccionario

Definiría un documento de búsqueda por variante, no uno por entrada que mezcle todos los idiomas.

```
CREATE TABLE IF NOT EXISTS sfx_search_documents (
    search_id INTEGER PRIMARY KEY,

    entry_id INTEGER NOT NULL,

    locale TEXT NOT NULL,

    source_surface TEXT NOT NULL DEFAULT '',
    romanization TEXT NOT NULL DEFAULT '',

    meaning_es TEXT NOT NULL DEFAULT '',
    meaning_en TEXT NOT NULL DEFAULT '',

    FOREIGN KEY (entry_id)
        REFERENCES sfx_lexemes(entry_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sfx_search_entry
ON sfx_search_documents(entry_id);
```

Índice de texto:

```
CREATE VIRTUAL TABLE IF NOT EXISTS sfx_search_fts
USING fts5(
    source_surface,
    romanization,
    meaning_es,
    meaning_en,
    content='sfx_search_documents',
    content_rowid='search_id',
    tokenize='unicode61 remove_diacritics 0',
    detail=full
);
```

Para coincidencias parciales, se puede complementar con el trigram ya utilizado en Sprint 60:

```
CREATE VIRTUAL TABLE IF NOT EXISTS sfx_substring_fts
USING fts5(
    source_surface,
    romanization,
    content='sfx_search_documents',
    content_rowid='search_id',
    tokenize='trigram case_sensitive 0'
);
```

La búsqueda exacta de kana y hangul se resuelve primero con B-tree. Las búsquedas parciales utilizan trigram cuando la longitud de la consulta lo permite. Las consultas de uno o dos caracteres se limitan a lookup exacto o al índice CJK existente.

Para tablas FTS de contenido externo, mantendría triggers de inserción, actualización y borrado. SQLite documenta que FTS5 no actualiza automáticamente el índice externo cuando cambia su tabla de contenido: la aplicación debe sincronizar ambas estructuras.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.sqlite.org\&sz=32)

SQLite



No crearía un tokenizer japonés o coreano nuevo para este sprint: reutilizaría las capacidades probadas del proyecto.

## 10. Detección AOT y orquestación de recursos

El trabajo pesado debe ocurrir en la indexación del capítulo, no cuando aparece el SFX en pantalla.

### Pipeline de importación

```
CBZ Original
   |
   v
OCR / Text Region Detection
   |
   +--> Dialogue
   |
   +--> SFX Candidate
           |
           v
       Language Detection
           |
           v
       Japanese / Korean OCR
           |
           v
       Lexicon Resolution
           |
           v
       Translation Selection
           |
           v
       Spatial Placement
           |
           v
       SFX Page Manifest
```

Reutilizaría el OCR y el índice espacial de Sprint 55, pero incorporaría una etapa específica para detectar texto artístico:

- Caracteres muy grandes.
- Escritura inclinada o vertical.
- Texto separado de los bocadillos.
- Repeticiones de caracteres.
- Letras con formas irregulares.
- Regiones que atraviesan más de una viñeta.

No confiaría únicamente en OCR tradicional: los SFX pueden ser decorativos, estar parcialmente ocultos, seguir trayectorias curvas o mezclarse con el dibujo.

### Worker del T4500

El proceso de importación puede trabajar con baja prioridad:

```
Interactive Reader
      |
      +--> Visible tile rendering
      |
      +--> Page SFX manifest lookup
      |
BACKGROUND
      |
      +--> SFX OCR
      +--> Lexicon resolver
      +--> Translation manifest builder
```

No ejecutaría OCR, análisis semántico, traducción o cálculo de polígonos en cada movimiento del viewport.

Mantendría un solo trabajo pesado de fondo y aprovecharía el `IOCoordinator` y su `PauseGate` existentes.

### Política de traducción

El sistema prioriza en este orden:

1. Traducción editorial curada para la expresión y el sentido.
2. Traducción de diccionario compatible con el contexto.
3. Equivalencia aproximada basada en las etiquetas de acción e intensidad.
4. Transliteración o conservación del original.

Las alternativas deben mantenerse disponibles. No conviertas automáticamente una expresión japonesa o coreana en una palabra española solo porque tenga una coincidencia fonética parecida.

## 11. SLA 31 — SFX Lexicon & Spatial Overlay Engine

Mi propuesta es medir tres partes separadas: búsqueda léxica, resolución espacial y presentación.

SLA 31 — Dynamic SFX Overlay

Objetivos propuestos

# 50 µs

P95 para lookup exacto de una expresión en el diccionario residente en RAM.

| Métrica                               | Objetivo  |
| ------------------------------------- | --------- |
| Lookup exacto SFX en RAM, P95         | ≤ 50 µs   |
| Lookup exacto SFX en RAM, P99         | ≤ 100 µs  |
| Consulta SQLite caliente, P95         | ≤ 1 ms    |
| Normalización de 100 regiones, P95    | ≤ 0,25 ms |
| Resolución espacial de 100 SFX, P95   | ≤ 0,50 ms |
| Culling de 100 overlays, P95          | ≤ 0,50 ms |
| Actualización de manifest en SVG, P95 | ≤ 2 ms    |
| Consultas SQLite durante pan/zoom     | 0         |
| OCR durante la lectura interactiva    | 0         |
| Solicitudes externas por SFX caliente | 0         |

Renderizado

| Métrica                           | Objetivo           |
| --------------------------------- | ------------------ |
| Nodos SVG visibles                | ≤ 32               |
| Tiempo de frame P95               | ≤ 16,67 ms         |
| Long tasks durante pan/zoom       | 0 mayores de 50 ms |
| CSS blur/backdrop-filter          | 0                  |
| Alteraciones del archivo original | 0                  |
| CLS del overlay                   | 0                  |
| V8 heap total del backend         | ≤ 512 MiB          |

Los límites son metas de aceptación. La latencia en RAM no incluye carga inicial del diccionario ni búsqueda fría en HDD.

### 11.1. Definición de las mediciones

Lookup en RAM

Una búsqueda exacta:

```
normalizedSurface -> entryId -> selectedSense -> translation
```

Debe utilizar estructuras precargadas, sin consultar SQLite.

Resolución espacial

Tomamos 100 apariciones y calculamos su posición en el sistema de coordenadas de la página. Luego aplicamos la transformación del viewport y verificamos cuáles intersectan la región visible.

Actualización visual

Contamos el tiempo de actualización del SVG después de recibir un manifest nuevo, pero lo medimos fuera del loop de paneo.

Frame time

Medimos el paneo con overlays visibles, las teselas Deep Zoom activas y el resto del lector en funcionamiento.

Un microbenchmark de diccionario no demuestra por sí solo que el GMA 4500MHD pueda mantener 60 FPS.

### 11.2. Cálculo de colisiones y colocación

La traducción puede ser más larga que la onomatopeya original. Por eso no utilizaría el bounding box original como si fuera automáticamente el espacio disponible para el texto traducido.

Generaría hasta cuatro posiciones candidatas y calcularía sus colisiones contra:

- Texto original.
- Bocadillos de diálogo.
- Rostros y elementos visuales protegidos.
- Otros SFX traducidos.
- Límites de la viñeta y la página.

Una implementación básica:

```
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function placementCost(
  candidate: Rect,
  source: Rect,
  protectedRegions: readonly Rect[],
  otherTranslations: readonly Rect[]
): number {
  let cost = 0;

  for (const region of protectedRegions) {
    if (overlaps(candidate, region)) {
      cost += 1000;
    }
  }

  for (const translation of otherTranslations) {
    if (overlaps(candidate, translation)) {
      cost += 500;
    }
  }

  const dx = candidate.x - source.x;
  const dy = candidate.y - source.y;

  cost += Math.sqrt(dx * dx + dy * dy) * 10;

  return cost;
}
```

El motor elige la posición de menor coste. En un empate, se prefiere la posición más cercana al SFX original.

No permitiría que una traducción fuera del área de página se coloque automáticamente sobre otra viñeta. Si no existe una ubicación adecuada, se muestra la traducción como anotación contextual, no como texto grande sobre el arte.

### 11.3. Persistir la composición elegida por idioma

Como las traducciones al español e inglés pueden ocupar espacios muy diferentes, guardaría un layout independiente por idioma:

```
CREATE TABLE IF NOT EXISTS sfx_occurrence_layouts (
    layout_id INTEGER PRIMARY KEY,

    occurrence_id INTEGER NOT NULL,

    target_language TEXT NOT NULL
        CHECK (target_language IN ('es', 'en')),

    translation_id INTEGER NOT NULL,

    anchor_x INTEGER NOT NULL
        CHECK (anchor_x BETWEEN 0 AND 1000000),

    anchor_y INTEGER NOT NULL
        CHECK (anchor_y BETWEEN 0 AND 1000000),

    rotation_degrees REAL NOT NULL DEFAULT 0,

    font_preset TEXT NOT NULL,

    font_size_ratio REAL NOT NULL
        CHECK (font_size_ratio BETWEEN 0.005 AND 0.15),

    outline_width_ratio REAL NOT NULL DEFAULT 0.001
        CHECK (outline_width_ratio BETWEEN 0 AND 0.01),

    placement TEXT NOT NULL
        CHECK (placement IN (
            'ABOVE',
            'BELOW',
            'LEFT',
            'RIGHT',
            'NEAR_SOURCE',
            'MARGIN'
        )),

    collision_score REAL NOT NULL DEFAULT 0,

    layout_revision INTEGER NOT NULL DEFAULT 1,

    FOREIGN KEY (occurrence_id)
        REFERENCES sfx_occurrences(occurrence_id)
        ON DELETE CASCADE,

    FOREIGN KEY (translation_id)
        REFERENCES sfx_translations(translation_id),

    UNIQUE (
        occurrence_id,
        target_language,
        translation_id
    )
);

CREATE INDEX IF NOT EXISTS idx_sfx_layout_occurrence
ON sfx_occurrence_layouts(
    occurrence_id,
    target_language
);
```

La colocación se puede calcular AOT y corregir posteriormente mediante edición manual. El navegador no necesita ejecutar el algoritmo de colisiones durante el paneo.

## 12. Implementación del Fastify Gateway

Un handler de manifiesto debería trabajar sobre el resultado precargado.

```
import type { FastifyInstance } from "fastify";

interface SfxManifestParams {
  pageId: string;
}

interface SfxManifestQuery {
  target: "es" | "en";
  mode:
    | "ORIGINAL_ONLY"
    | "TRANSLATION_ADJACENT"
    | "TRANSLATION_ANNOTATION";
}

export async function registerSfxRoutes(
  fastify: FastifyInstance,
  services: {
    manifestService: {
      get(
        pageId: string,
        target: SfxTargetLanguage,
        mode: SfxDisplayMode
      ): Promise<SfxPageManifest | null>;
    };
  }
) {
  fastify.get<{
    Params: SfxManifestParams;
    Querystring: SfxManifestQuery;
  }>(
    "/api/v1/pages/:pageId/sfx/manifest",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            pageId: {
              type: "string",
              minLength: 1,
              maxLength: 128
            }
          },
          required: ["pageId"],
          additionalProperties: false
        },

        querystring: {
          type: "object",
          properties: {
            target: {
              type: "string",
              enum: ["es", "en"]
            },
            mode: {
              type: "string",
              enum: [
                "ORIGINAL_ONLY",
                "TRANSLATION_ADJACENT",
                "TRANSLATION_ANNOTATION"
              ]
            }
          },
          required: ["target", "mode"],
          additionalProperties: false
        }
      }
    },
    async (request, reply) => {
      const result =
        await services.manifestService.get(
          request.params.pageId,
          request.query.target,
          request.query.mode
        );

      if (!result) {
        return reply.code(404).send({
          error: "SFX manifest not found"
        });
      }

      const etag = createManifestETag(result);

      reply
        .header("ETag", etag)
        .header("Cache-Control", "private, max-age=300, must-revalidate")
        .header("Vary", "Accept-Language");

      const ifNoneMatch =
        request.headers["if-none-match"];

      if (etagMatches(ifNoneMatch, etag)) {
        return reply.code(304).send();
      }

      return reply
        .type("application/json")
        .send(result);
    }
  );
}
```

`createManifestETag()` debe calcular o recuperar un hash de la revisión de página, la revisión del diccionario, el idioma y el modo de composición. No es necesario hashear nuevamente todo el objeto en cada request si el manifiesto ya se almacena con un fingerprint.

Para mayor eficiencia, si el manifest contiene versiones inmutables, la ruta puede incluir `pageRevision` y `dictionaryRevision` y usar:

```
Cache-Control: private, max-age=31536000, immutable
```

La ruta no debe cambiar de contenido con la misma combinación de revisiones. Para las rutas editoriales o los manifests no versionados, mantendría revalidación mediante ETag.

### 12.1. Control de acceso y contenido seguro

Los textos SFX provienen de OCR y de diccionarios externos. Deben tratarse como datos no confiables.

- Renderizar siempre el texto mediante nodos de texto React o SVG.
- No usar `dangerouslySetInnerHTML`.
- No admitir atributos SVG arbitrarios proporcionados por el diccionario.
- Permitir solamente presets tipográficos registrados.
- Validar colores contra una lista o formato hexadecimal permitido.
- Limitar rotaciones, tamaños de fuente y número de overlays.
- Comprobar permisos en las rutas de corrección.
- No permitir que una traducción introduzca un `href`, un `foreignObject` o un script SVG.

La traducción debe ser texto, no código.

## 13. Memoria y rendimiento del T4500

No mantendría todo el diccionario en memoria. La estrategia debe ser similar a la de los manifiestos Deep Zoom.

### Presupuesto inicial de RAM

| Componente                         | Presupuesto |
| ---------------------------------- | ----------- |
| Índice léxico SFX global caliente  | 4 MiB       |
| Entradas del capítulo activo       | 1 MiB       |
| Manifest de página                 | 256 KiB     |
| Traducciones y estilos             | 512 KiB     |
| LRU de traducciones recientes      | 1 MiB       |
| Margen para estructuras temporales | 1 MiB       |
| Presupuesto incremental inicial    | 7,75 MiB    |

Son límites de planificación; hay que medir el heap real de los objetos JavaScript, que puede ser superior al tamaño de sus strings y datos serializados.

Mantendría tres cachés:

Global Lexicon Cache

Entradas frecuentes y variantes de escritura, limitada por bytes.

Chapter SFX Cache

Entradas detectadas dentro del capítulo y sus traducciones disponibles.

Page Overlay Cache

El manifiesto de la página activa y sus overlays espaciales.

Al cambiar de capítulo se promueve la siguiente caché si ya estaba precargada por el Smart Precache. No se debe volver a consultar SQLite por cada toque.

### Gestión de misses

```
SFX lookup
    |
    +-- RAM HIT
    |     |
    |     +-- Mostrar traducción
    |
    +-- RAM MISS
          |
          +-- Consultar worker SQLite
          |
          +-- Resultado válido
                |
                +-- Insertar en LRU
                +-- Actualizar HUD
```

No realizaría una consulta síncrona de `better-sqlite3` desde el hilo principal del servidor si la respuesta puede implicar varias búsquedas, FTS y desambiguación.

Para las consultas complejas utilizaría el worker especializado del buscador o una cola de trabajo de `BACKGROUND`.

El renderizador SVG tampoco necesita acceso a la base. Recibe un `SfxPageManifest` y se limita a dibujar.

## 14. Pruebas de resiliencia

Estas son las pruebas que considero obligatorias antes de aprobar el Sprint 67.

### A. Pruebas lingüísticas

| Prueba                       | Resultado esperado                             |
| ---------------------------- | ---------------------------------------------- |
| Japonés en katakana          | Coincidencia léxica correcta                   |
| Japonés en hiragana          | Variante identificada                          |
| Japonés con kanji            | Lectura/contexto correcto                      |
| Romaji                       | Alias encontrado                               |
| Coreano hangul               | Coincidencia correcta                          |
| Coreano romanizado           | Alias encontrado                               |
| Romanización con guion       | Normalización consistente                      |
| Expresión repetida           | Repetición preservada                          |
| Variante OCR aproximada      | Candidatos, sin traducción automática insegura |
| Giongo frente a gitaigo      | Sentido diferenciado                           |
| Uiseongeo frente a uitaeeo   | Categoría correcta                             |
| Traducción es/en             | Locale respetado                               |
| Varias traducciones posibles | Alternativas conservadas                       |
| Expresión desconocida        | Original intacto                               |

Un caso importante es la forma gráfica repetida. No se debe convertir indiscriminadamente:

```
ドドドド
```

en una forma simplificada que pierda la intensidad o el efecto original.

### B. Pruebas espaciales

| Prueba                        | Resultado esperado                    |
| ----------------------------- | ------------------------------------- |
| SFX horizontal                | Posición correcta                     |
| SFX vertical japonés          | Orientación correcta                  |
| SFX diagonal                  | Rotación preservada                   |
| SFX curvo                     | Polígono respetado                    |
| SFX en el borde               | Coordenadas dentro de página          |
| SFX entre teselas             | Overlay continuo                      |
| Página rotada mediante lector | Geometría coherente                   |
| EXIF 90°/270°                 | Dimensiones correctas                 |
| SFX superpuestos              | Detección de colisión                 |
| SFX sobre diálogo             | Traducción reubicada                  |
| SFX cerca de una cara         | Región protegida                      |
| Doble página                  | Coordenadas independientes por página |

### C. Pruebas visuales y de GPU

| Prueba                         | Resultado requerido                   |
| ------------------------------ | ------------------------------------- |
| 1 overlay visible              | Sin regresión                         |
| 10 overlays                    | Sin parpadeos                         |
| 24 overlays                    | Rendimiento dentro del objetivo       |
| 32 overlays                    | Sin crecimiento inesperado de memoria |
| 100 overlays detectados        | Culling correcto                      |
| Pan continuo 30 minutos        | Sin fugas                             |
| Zoom de 0,1× a 2×              | Posición consistente                  |
| Cambio de idioma               | No rompe el layout                    |
| Cambio de página rápido        | No aparecen traducciones antiguas     |
| Fuente no disponible           | Fallback funcional                    |
| SVG sin soporte suficiente     | Renderizador alternativo              |
| WebP tile cargada parcialmente | Overlay permanece alineado            |

### D. Pruebas de integridad y seguridad

Estas son especialmente importantes porque el arte original es una fuente que no debemos alterar.

1. Calcular SHA-256 del archivo original antes de activar el motor.
2. Activar traducciones en español e inglés.
3. Exportar o leer nuevamente el archivo original.
4. Verificar que su fingerprint sigue siendo el mismo.
5. Verificar que ningún endpoint modifica bytes del CBZ o del WebP.
6. Comprobar que los textos OCR no pueden introducir HTML, CSS o atributos SVG arbitrarios.
7. Verificar que los manifests pertenecen a la revisión correcta de la página.
8. Probar que un worker interrumpido no marca como `RESOLVED` una traducción incompleta.
9. Probar cambios simultáneos de idioma y capítulo.
10. Comprobar que un fallo de SQLite no provoca desaparición de la página.

### E. Pruebas de persistencia y recuperación

- Caída del proceso durante el procesamiento OCR.
- Caída después de insertar una entrada léxica.
- Caída entre la inserción de sentido y traducción.
- Actualización concurrente de una corrección editorial.
- Colisión de dos traducciones con la misma revisión.
- Corrupción del manifest almacenado.
- Invalidación tras sustituir la imagen original.
- Reinicio con una página que tiene overlays incompletos.

Las transacciones de entrada, sentido y traducción deben conservar la integridad referencial. El estado de una aparición solo pasa a `RESOLVED` cuando existe una traducción válida o una decisión explícita de conservar el original.

## 15. Edge cases lingüísticos y editoriales

Hay errores que no son problemas de programación, sino de interpretación del lenguaje.

### 15.1. Traducción equivalente frente a traducción descriptiva

Hay onomatopeyas que tienen equivalentes naturales en español, pero otras funcionan mejor como descripción.

Ejemplo conceptual:

| Intención             | Tipo de traducción              |
| --------------------- | ------------------------------- |
| Golpe brusco          | Equivalente SFX: «¡PUM!»        |
| Movimiento tembloroso | Descriptiva: «Temblando»        |
| Brillo repetido       | Equivalente visual: «Destellos» |
| Rumor amenazante      | Descriptiva: «Retumba»          |

El motor debe conservar la intención y la emoción, no traducir la forma sonora letra por letra.

### 15.2. No todas las expresiones requieren un reemplazo

Algunas expresiones funcionan como parte de la identidad estética de una obra.

Por eso ofrecería `KEEP_ORIGINAL` como resultado válido. El lector puede mostrar una explicación breve al seleccionar la expresión, pero no es obligatorio tapar el texto original con otra palabra.

### 15.3. El tamaño importa

Las traducciones más largas deben poder reducir su tamaño hasta un límite razonable.

No permitiría que un SFX ocupe el doble de espacio que la expresión original sin que el algoritmo de colocación lo justifique.

Una política inicial:

```
fontSize mínimo = 0.65 × tamaño calculado
fontSize máximo = 1.15 × tamaño calculado
```

Si el texto no cabe, cambiar de posición o utilizar una anotación contextual antes que seguir reduciendo el tamaño indefinidamente.

### 15.4. Las traducciones no son universales

La misma expresión puede representar distintas sensaciones según la acción dibujada. Por eso el diccionario necesita sentidos múltiples, etiquetas contextuales y procedencia editorial.

En coreano, la modificación de vocales y consonantes puede influir en la sensación de intensidad, ligereza o aspereza; el modelo debe conservar las variantes originales y evitar colapsarlas en una sola entrada por coincidencia aproximada.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://encykorea.aks.ac.kr\&sz=32)

한국민족문화대백과사전+1



### 15.5. No asumir OCR perfecto

El sistema debe contemplar:

- Caracteres parcialmente tapados.
- Escritura caligráfica.
- Katakana deformado.
- Hangul estirado.
- Efectos que mezclan varias palabras.
- Letras integradas en el dibujo.
- Texto que cruza los límites de una viñeta.

En una región de baja confianza, conservamos el original y ofrecemos consulta manual.

## 16. Orden de implementación por agentes

No dividiría el trabajo simplemente por lenguajes. Definiría contratos comunes para que el japonés y el coreano utilicen el mismo flujo de almacenamiento y composición.

1. Agent 1 — SFX Lexicon Database

   Migraciones SQLite, entradas, variantes, sentidos, traducciones, tags y FTS.
2. Agent 2 — Japanese/Korean SFX Resolver

   Normalización, reconocimiento de variantes, categorías lingüísticas, romanización y selección de sentidos.
3. Agent 3 — SFX Detection & Spatial Index

   OCR especializado, regiones, polígonos, orientación, confianza y fingerprint de fuente.
4. Agent 4 — Contextual Translation Engine

   Selección de equivalentes es/en, traducción descriptiva, intensidad, alternativas y revisión editorial.
5. Agent 5 — Overlay Layout Engine

   Posicionamiento, colisiones, estilos, fuentes permitidas y geometría normalizada.
6. Agent 6 — SVG Reader Integration

   Renderizador, modo original, overlay, integración con Deep Zoom, interacción accesible y CLS.
7. Agent 7 — QA & SLA 31

   Corpus japonés/coreano, pruebas espaciales, comparación visual, pan/zoom, memoria y rendimiento del T4500.

## 17. Decisiones finales que recomiendo adoptar

| Área                           | Decisión                             |
| ------------------------------ | ------------------------------------ |
| Renderizador visual            | SVG agrupado por página              |
| Controles interactivos         | HTML/React                           |
| Sistema de coordenadas         | Normalizado 0–1                      |
| Coordenadas SQLite             | Enteros 0–1.000.000                  |
| Geometría                      | Bounding box + polígono opcional     |
| Diccionario                    | Entradas y sentidos separados        |
| Idiomas de origen              | Japonés y coreano                    |
| Búsqueda                       | B-tree + FTS5 existente              |
| Traducción                     | Contextual y versionada              |
| Composición                    | AOT, posición por idioma             |
| Presentación                   | Traducción cercana, original intacto |
| Procesamiento durante pan/zoom | 0 OCR, 0 SQLite, 0 traducción        |
| SVG blur y CSS blur            | 0                                    |
| Overlays visibles              | Máximo inicial 32                    |
| SLA 31                         | Lookup P95 ≤ 50 µs                   |

## 18. Mi veredicto para KuraScroll

Yo implementaría el Sprint 67 en este orden:

1. Diccionario SQLite y modelo de sentidos.
2. Reconocimiento y clasificación de SFX desde OCR.
3. Resolución contextual y traducciones.
4. Coordenadas normalizadas y layouts por idioma.
5. Manifest de página versionado.
6. Renderizador SVG integrado con Deep Zoom.
7. Pruebas de 60 FPS, memoria e integridad del arte original.

La decisión más importante es mantener separado el significado de la expresión y su representación visual.

Un SFX puede significar un impacto, una vibración, un estado emocional o un movimiento. Después, esa interpretación se traduce al español o inglés y recibe un estilo visual apropiado.

Así KuraScroll no termina siendo un simple reemplazador de palabras japonesas y coreanas: se convierte en un lector con una auténtica capa de traducción editorial, manteniendo intactas las ilustraciones originales.

Para comenzar la implementación, el contrato que cerraría primero es `SfxPageManifest`, junto con `SfxLexeme`, `SfxSense`, `SfxTranslation` y `SfxGeometry`. Una vez estabilizados, los agentes pueden trabajar independientemente sin inventar estructuras incompatibles.

Siguiente paso útil: convertiría este diseño en tickets técnicos por agente, con dependencias, criterios de aceptación y pruebas concretas para que el equipo pueda comenzar el Sprint 67 sin pisarse el trabajo.
