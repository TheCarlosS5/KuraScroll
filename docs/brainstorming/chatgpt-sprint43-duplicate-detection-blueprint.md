# Sprint 43 — Duplicate Detection & Cross-Scanlation Reconciliation

Vro, este sprint tiene una trampa importante: dos títulos pueden representar la misma obra sin parecerse prácticamente nada, y dos capítulos con el mismo número pueden no ser el mismo contenido.

Por eso no confiaría todo a Jaro-Winkler. Construiría un motor de record linkage con cuatro etapas:

1. Normalización lingüística que conserve los títulos originales.
2. Generación de candidatos mediante FTS5 y alias conocidos.
3. Scoring difuso con Jaro-Winkler, similitud de tokens y N-Gram.
4. Confirmación y fusión controlada, conservando versiones, progreso y archivos originales.

Para los capítulos aplicaría un principio adicional: el capítulo lógico es independiente de la versión publicada por cada scanlation group.

Decisiones de arquitectura

-

  Recomendado

  &#x20;TypeScript nativo, sin dependencias pesadas.

- FTS5 como generador de candidatos, no como algoritmo final de similitud.

- Alias verificados para títulos traducidos o romanizados.

- Jaro-Winkler + Dice de tokens + Dice de trigramas.

- Números de capítulo como cadenas decimales normalizadas, nunca `float`.

- Variantes de scanlation conservadas como versiones del capítulo lógico.

- Fusión confirmada explícitamente y ejecutada mediante transacciones cortas.

## 1. Motor de emparejamiento difuso

### 1.1. Jaro-Winkler vs. Levenshtein vs. N-Gram

No escogería un único algoritmo para todas las comparaciones.

| Algoritmo          | Ventaja                                                  | Problema                           | Uso en KuraScroll                |
| ------------------ | -------------------------------------------------------- | ---------------------------------- | -------------------------------- |
| Jaro-Winkler       | Detecta errores tipográficos y caracteres desplazados    | Premia prefijos iguales            | Comparación principal            |
| Levenshtein        | Mide inserciones, eliminaciones y sustituciones          | Coste \\(O(m \times n)\\)          | Desempate en candidatos pequeños |
| N-Gram             | Detecta fragmentos similares pese a pequeñas variaciones | Puede confundir títulos genéricos  | Recuperación y scoring           |
| Token Dice/Jaccard | Tolera diferencias en orden de palabras                  | Pierde cierta información de orden | Comparación complementaria       |
| Alias exacto       | Reconoce títulos de otros idiomas                        | Requiere metadatos fiables         | Identidad entre idiomas          |

Jaro-Winkler añade una bonificación a los primeros caracteres coincidentes. Es útil para errores de escritura, pero esa bonificación puede favorecer títulos que comparten un prefijo genérico. Su formulación habitual limita el prefijo a cuatro caracteres y utiliza un factor de escala de 0,1.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://xlinux.nist.gov\&sz=32)

XLinux+1



El caso que no debes intentar resolver con similitud de caracteres:

| Título A                 | Título B                | Tratamiento                                        |
| ------------------------ | ----------------------- | -------------------------------------------------- |
| Attack on Titan          | Shingeki no Kyojin      | Alias verificado                                   |
| Solo Leveling            | Na Honjaman Level Up    | Alias verificado                                   |
| Attack on Titan Season 2 | Attack on Titan         | Misma franquicia, posible serie/temporada distinta |
| Solo Leveling            | Solo Leveling: Ragnarok | No fusionar automáticamente                        |

Los primeros dos ejemplos son equivalencias de título entre idiomas, no errores tipográficos. Jaro-Winkler no conoce su significado. Necesitas alias alternativos procedentes de metadatos, importaciones, una fuente externa fiable o confirmación del usuario.

### 1.2. Normalización lingüística: conserva siempre el título original

Propongo guardar tres representaciones:

- `title_raw`: texto original, exactamente como fue importado.
- `title_display`: título normalizado para presentación, preferiblemente NFC.
- `title_match`: representación utilizada por el motor de comparación.

No sobrescribas el título original con el resultado del normalizador.

#### Pipeline de normalización

| Paso | Operación                                     | Precaución                                              |
| ---- | --------------------------------------------- | ------------------------------------------------------- |
| 1    | Identificar etiquetas de scanlation           | Eliminar solamente grupos reconocidos                   |
| 2    | Unicode NFKD                                  | Usarlo para comparación, no para reemplazar el original |
| 3    | Eliminar diacríticos latinos                  | No eliminar indiscriminadamente marcas japonesas        |
| 4    | Normalizar mayúsculas y minúsculas            | Mantener el idioma original por separado                |
| 5    | Convertir guiones y puntuación en separadores | No concatenar palabras                                  |
| 6    | Reducir espacios repetidos                    | Mantener una forma determinista                         |
| 7    | Extraer temporada, volumen y subtítulo        | No borrar calificadores importantes                     |

Unicode define NFKD como descomposición de compatibilidad. Es útil para comparación flexible, pero puede eliminar distinciones que importan en otros contextos; por ello debes conservar el texto original.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.unicode.org\&sz=32)

Unicode+1



#### Código guía: normalizador

```
interface TitleNormalization {
  raw: string;
  normalized: string;
}

function normalizeTitle(
  raw: string,
  knownScanlationTags: ReadonlySet<string>
): TitleNormalization {
  let value = raw.normalize("NFKD");

  // Elimina únicamente etiquetas reconocidas.
  value = value.replace(/\[([^\]]{1,60})\]/gu, (full, tag: string) => {
    const normalizedTag = tag
      .normalize("NFKC")
      .toLowerCase()
      .trim();

    return knownScanlationTags.has(normalizedTag)
      ? " "
      : ` ${tag} `;
  });

  // Elimina marcas diacríticas después de caracteres latinos.
  // Conserva las marcas de otros sistemas de escritura.
  value = value.replace(
    /(\p{Script=Latin})\p{M}+/gu,
    "$1"
  );

  // Los guiones y la puntuación pasan a ser espacios.
  value = value
    .toLowerCase()
    .replace(/[‐‑‒–—―]/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ")
    .normalize("NFC");

  return {
    raw,
    normalized: value
  };
}
```

El conjunto `knownScanlationTags` debe alimentarse con los grupos conocidos por KuraScroll. No elimines todo lo que esté entre corchetes: `[Final Season]`, `[Part 2]` o `[Colored Edition]` pueden ser información importante.

Tampoco elimines automáticamente palabras como `season`, `volume`, `ragnarok`, `extra` o `side story`. Sepáralas como calificadores para poder distinguir una secuela de un duplicado.

#### Romaji y otros sistemas de escritura

Aquí evitaría un error frecuente:

Romaji es romanización japonesa, no una transliteración universal de títulos asiáticos.

Para japonés puedes generar una segunda representación de búsqueda desde kana, pero debes contemplar:

- Combinaciones como `きゃ`, `しゅ` y `ちょ`.
- Consonantes dobles, mediante el pequeño `っ`.
- Vocales largas.
- La representación de `ん` antes de determinadas consonantes.
- Variantes de romanización, como Hepburn.

No es suficiente aplicar un reemplazo individual de cada carácter.

Para coreano, utiliza una representación de romanización propia o alias verificados. Para chino, una conversión a pinyin requiere información lingüística que no debes intentar improvisar con reglas japonesas.

Mi recomendación para Sprint 43 es generar variantes de romanización solo donde exista una implementación pequeña, determinista y probada. Las equivalencias dudosas deben resolverse mediante alias.

### 1.3. Implementación TypeScript de Jaro-Winkler

Esta versión trabaja con puntos de código Unicode mediante `Array.from()`, en lugar de asumir que cada carácter ocupa una unidad UTF-16.

```
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const s1 = Array.from(a);
  const s2 = Array.from(b);

  const maxDistance = Math.max(
    0,
    Math.floor(Math.max(s1.length, s2.length) / 2) - 1
  );

  const matched1 = new Array<boolean>(s1.length).fill(false);
  const matched2 = new Array<boolean>(s2.length).fill(false);

  let matches = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - maxDistance);
    const end = Math.min(i + maxDistance + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (matched2[j] || s1[i] !== s2[j]) continue;

      matched1[i] = true;
      matched2[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  const ordered1 = s1.filter((_, i) => matched1[i]);
  const ordered2 = s2.filter((_, i) => matched2[i]);

  let transpositions = 0;

  for (let i = 0; i < matches; i++) {
    if (ordered1[i] !== ordered2[i]) {
      transpositions++;
    }
  }

  const halfTranspositions = transpositions / 2;

  const jaro = (
    matches / s1.length +
    matches / s2.length +
    (matches - halfTranspositions) / matches
  ) / 3;

  // Bonificación de prefijo, limitada a cuatro caracteres.
  let prefix = 0;
  const maxPrefix = Math.min(4, s1.length, s2.length);

  while (
    prefix < maxPrefix &&
    s1[prefix] === s2[prefix]
  ) {
    prefix++;
  }

  return jaro > 0.7
    ? jaro + prefix * 0.1 * (1 - jaro)
    : jaro;
}
```

La puntuación retorna un valor entre 0 y 1. Esta implementación es una guía para títulos cortos; no la ejecutes contra todo el catálogo sin un filtro previo.

### 1.4. Complementar Jaro-Winkler con N-Gram y tokens

Usaría dos medidas complementarias:

- Dice de tokens: compara las palabras de ambos títulos.
- Dice de trigramas: compara secuencias de tres caracteres.

Código guía para trigramas:

```
function trigrams(value: string): Set<string> {
  const chars = Array.from(`  ${value}  `);
  const result = new Set<string>();

  for (let i = 0; i <= chars.length - 3; i++) {
    result.add(chars.slice(i, i + 3).join(""));
  }

  return result;
}

function diceCoefficient(
  a: Set<string>,
  b: Set<string>
): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;

  for (const item of a) {
    if (b.has(item)) intersection++;
  }

  return (2 * intersection) / (a.size + b.size);
}

function tokenDice(a: string, b: string): number {
  const tokensA = new Set(a.split(/\s+/u).filter(Boolean));
  const tokensB = new Set(b.split(/\s+/u).filter(Boolean));

  return diceCoefficient(tokensA, tokensB);
}
```

La puntuación compuesta inicial podría ser:

```
interface TitleScore {
  jaroWinkler: number;
  tokenDice: number;
  trigramDice: number;
  total: number;
}

function calculateTitleScore(
  a: string,
  b: string
): TitleScore {
  const jw = jaroWinkler(a, b);

  const tokens = tokenDice(a, b);

  const grams = diceCoefficient(
    trigrams(a),
    trigrams(b)
  );

  return {
    jaroWinkler: jw,
    tokenDice: tokens,
    trigramDice: grams,
    total:
      jw * 0.40 +
      tokens * 0.35 +
      grams * 0.25
  };
}
```

Los pesos son valores iniciales de calibración, no porcentajes científicamente universales. Debes probarlos con títulos reales de tu catálogo y medir falsos positivos y falsos negativos.

Una mejora importante: no utilices el score compuesto para reemplazar un alias verificado. Un alias exacto confirmado debe tener una evidencia distinta y más fuerte que una coincidencia difusa.

## 2. Evitar O(N²): FTS5 como generador de candidatos

Arquitectura de búsqueda

Catálogo de series

Títulos principales + alias + títulos romanizados

FTS5 / Blocking

Recuperar un conjunto reducido de candidatos

Scoring TypeScript

Jaro-Winkler + tokens + trigramas

Duplicate Candidates

Evidencia, score y revisión humana

FTS5 ya está en la arquitectura de KuraScroll. Reutilizaría su índice y sus utilidades de sanitización de consultas del sprint anterior.

### 2.1. Índice de títulos y alias

Propuesta de tabla relacional:

```
CREATE TABLE IF NOT EXISTS series_titles (
    id INTEGER PRIMARY KEY,
    series_id INTEGER NOT NULL,
    title_raw TEXT NOT NULL,
    title_norm TEXT NOT NULL,
    language TEXT,
    script TEXT,

    title_type TEXT NOT NULL CHECK (
        title_type IN (
            'primary',
            'english',
            'native',
            'romaji',
            'synonym'
        )
    ),

    source TEXT NOT NULL DEFAULT 'import',
    verified INTEGER NOT NULL DEFAULT 0
        CHECK (verified IN (0, 1)),

    normalizer_version INTEGER NOT NULL DEFAULT 1,

    UNIQUE(series_id, title_norm, title_type)
);

CREATE INDEX IF NOT EXISTS idx_series_titles_norm
ON series_titles(title_norm);

CREATE INDEX IF NOT EXISTS idx_series_titles_series
ON series_titles(series_id, title_type);
```

El índice FTS debería indexar los títulos normalizados y sus variantes. Ejemplo simplificado:

```
CREATE VIRTUAL TABLE IF NOT EXISTS series_title_fts
USING fts5(
    title_norm,
    tokenize = 'unicode61 remove_diacritics 2',
    prefix = '2 3'
);
```

Si prefieres mantener el índice sincronizado con `series_titles`, puedes usar una tabla FTS externa con sus triggers de sincronización. No mantengas dos fuentes de verdad independientes.

Consulta de candidatos:

```
SELECT
    rowid AS title_id,
    bm25(series_title_fts) AS rank
FROM series_title_fts
WHERE series_title_fts MATCH ?
ORDER BY rank ASC
LIMIT 50;
```

Después recuperas los `series_id` de los títulos resultantes, descartas la propia serie y deduplicas los IDs.

El índice FTS5 de trigramas también puede ayudar a recuperar coincidencias por fragmentos, pero recuerda su limitación: las consultas de texto completo con menos de tres caracteres Unicode no encuentran resultados. No debe ser el único mecanismo de recuperación para títulos muy cortos.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.sqlite.org\&sz=32)

SQLite+1



### 2.2. Blocking para controlar el número de comparaciones

Mi política sería:

- Buscar la serie modificada contra FTS5.
- Recuperar hasta 50 candidatos iniciales.
- Incluir alias exactos y candidatos del índice auxiliar CJK existente.
- Deduplicar las series resultantes.
- Comparar los mejores 20–50 candidatos.
- Guardar cada pareja una sola vez, siempre con `left_id < right_id`.

Si el catálogo contiene \\(N\\) series, no recorrerás todas las parejas posibles. En lugar de ello, cada serie procesará un conjunto acotado de candidatos.

El coste se aproxima a \\(O(N \times K \times L)\\), donde `K` es el máximo de candidatos por serie y `L` la longitud media del título. Al fijar `K`, el crecimiento práctico se acerca a un proceso lineal respecto al catálogo.

No prometería O(N) estricto: FTS5 depende de la distribución de los términos y del tamaño de sus listas de coincidencias. Pero sí eliminamos el enfoque ingenuo de comparar todas las series contra todas.

### 2.3. No vuelvas a procesar todo el catálogo

Añade una versión de normalización y una marca de modificación:

```
series.title_version
series.normalizer_version
series.duplicate_scan_version
```

Al ejecutar una detección:

1. Selecciona series nuevas o modificadas.
2. Procesa lotes de 16–32 series.
3. Recupera candidatos por FTS5.
4. Calcula puntuaciones fuera de la transacción de lectura.
5. Guarda resultados por lotes cortos.
6. Avanza el cursor de trabajo.
7. Cede al `PauseGate`.

Reutiliza la prioridad `Priority.BACKGROUND` y el `IOCoordinator`. No añadas un nuevo scheduler.

En este host también controlaría el tiempo de CPU: un lote puede detenerse tras unos 10–15 ms de comparación y continuar en el siguiente turno del event loop. La prioridad del coordinador controla admisión de I/O, pero no hace que JavaScript deje de ocupar el hilo; el yield cooperativo también es necesario.

## 3. Detección de duplicados: score, evidencia y revisión

No fusionaría series automáticamente basándome en un umbral de Jaro-Winkler. Una coincidencia puede ser una temporada, una edición coloreada, un remake o una obra derivada.

### 3.1. Modelo de candidatos

```
CREATE TABLE IF NOT EXISTS series_duplicate_candidates (
    id INTEGER PRIMARY KEY,

    left_series_id INTEGER NOT NULL,
    right_series_id INTEGER NOT NULL,

    title_score REAL NOT NULL,
    metadata_score REAL NOT NULL DEFAULT 0,

    match_type TEXT NOT NULL CHECK (
        match_type IN (
            'exact',
            'verified_alias',
            'fuzzy',
            'metadata'
        )
    ),

    evidence_json TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'ACCEPTED',
                'REJECTED',
                'MERGED',
                'STALE'
            )
        ),

    normalizer_version INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (left_series_id < right_series_id),

    UNIQUE(left_series_id, right_series_id)
);
```

No guardaría solamente un número. `evidence_json` debe explicar por qué el sistema considera candidatas las dos series:

```
{
  "matchedTitleA": "Solo Leveling",
  "matchedTitleB": "나 혼자만 레벨업",
  "aliasMatch": true,
  "titleScore": 1,
  "yearCompatible": true,
  "formatCompatible": true,
  "warnings": []
}
```

El resultado debería poder ser revisado por una persona sin tener que investigar de nuevo desde cero.

### 3.2. Umbrales iniciales

| Score compuesto | Resultado sugerido          |
| --------------- | --------------------------- |
| 0.96–1.00       | Candidato de confianza alta |
| 0.88–0.95       | Revisión manual             |
| 0.78–0.87       | Candidato débil, opcional   |
| Menor de 0.78   | Descartar                   |

Estos límites son provisionales. Una coincidencia de alias verificado puede ser fuerte aunque no coincida el título normalizado; una puntuación alta entre títulos genéricos puede ser engañosa.

Añade señales independientes: idioma, formato, año, autor, identificadores de metadatos y calificadores de temporada. Las temporadas y secuelas deben generar advertencias, no desaparecer durante la normalización.

Regla que impondría: detección automática, sí; fusión destructiva sin confirmación, no.

## 4. Cross-Scanlation Chapter Reconciler

Esta parte debe tener un modelo distinto al de los duplicados de series.

Un capítulo puede tener varias publicaciones:

```
Serie: Nombre de la obra
│
├── Capítulo lógico 01
│   ├── Scan A — 22 páginas
│   ├── Scan B — 24 páginas
│   └── Scan C — 22 páginas, mayor resolución
│
├── Capítulo lógico 02
│   ├── Scan A — 20 páginas
│   └── Scan B — 20 páginas
│
└── Capítulo lógico 10.5
    └── Scan A — 12 páginas
```

Las versiones son fuentes distintas de un mismo capítulo lógico. No son capítulos adicionales que deban aparecer necesariamente en la lista del lector.

### 4.1. Identidad de un capítulo

Usaría esta clave conceptual:

```
(
  canonical_series_id,
  chapter_number_key,
  special_type,
  part_key,
  language
)
```

El grupo de scanlation no forma parte de la identidad. Es una propiedad de la versión.

Tampoco usaría el título del capítulo como identificador principal: un grupo puede publicar `The Beginning`, otro `Comienzo` y otro no tener título.

### 4.2. Números fraccionarios: no uses floats

No guardes `10.5` como `REAL` para identificar el capítulo.

Los números decimales pueden tener representaciones de punto flotante imprecisas. Para esta identidad usa texto normalizado.

Ejemplos:

| Entrada        | `chapter_number_key` |
| -------------- | -------------------- |
| `01`           | `1`                  |
| `Ch. 1`        | `1`                  |
| `Chapter 10.5` | `10.5`               |
| `10.50`        | `10.5`               |
| `10.05`        | `10.05`              |
| `Chapter 100`  | `100`                |

Conserva los ceros y el texto original en metadatos cuando formen parte de un identificador editorial, pero normaliza la clave numérica.

Código guía:

```
interface ParsedChapterNumber {
  numberKey: string;
  partKey: string | null;
  specialType: "regular" | "extra" | "prologue" | "oneshot";
  original: string;
}

function normalizeDecimalKey(
  whole: string,
  fraction?: string
): string {
  const normalizedWhole = whole.replace(/^0+(?=\d)/u, "");
  const normalizedFraction = fraction?.replace(/0+$/u, "");

  return normalizedFraction
    ? `${normalizedWhole}.${normalizedFraction}`
    : normalizedWhole;
}

function parseChapterNumber(
  input: string
): ParsedChapterNumber | null {
  const raw = input.trim();

  const special = raw.match(
    /\b(prologue|extra|oneshot|one shot)\b/iu
  );

  if (special) {
    const type = special[1].toLowerCase();

    return {
      numberKey: "0",
      partKey: null,
      specialType:
        type === "prologue" ? "prologue" :
        type === "extra" ? "extra" : "oneshot",
      original: raw
    };
  }

  const match = raw.match(
    /^(?:(?:chapter|ch\.?|cap[ií]tulo)\s*)?(\d{1,6})(?:[.,](\d+))?(?:\s*[-_]\s*([a-z]))?/iu
  );

  if (!match) return null;

  return {
    numberKey: normalizeDecimalKey(match[1], match[2]),
    partKey: match[3]?.toLowerCase() ?? null,
    specialType: "regular",
    original: raw
  };
}
```

Este parser es una base, no una gramática completa de todos los sitios de manga. El importador debería conocer el patrón de nombres de cada fuente, y el reconciliador debe conservar los casos que no pueda interpretar con seguridad.

No conviertas automáticamente `10-1` en `10.1`: puede representar un segmento o una parte editorial distinta.

### 4.3. Orden de capítulos

Ordena por componentes, no por cadenas lexicográficas:

1. Tipo de capítulo.
2. Parte editorial, si existe.
3. Entero de la numeración.
4. Fracción decimal normalizada.
5. Desempate estable por ID o fecha.

Para comparar la parte entera y decimal como texto, puedes usar la comparación numérica de longitudes y luego la comparación lexicográfica, evitando conversiones a `Number` en claves editoriales muy grandes.

## 5. ¿Cómo determinar si dos versiones son el mismo capítulo?

Propongo comparar por etapas. No basta con que ambos se llamen `Chapter 1`.

| Evidencia                               | Fuerza                         |
| --------------------------------------- | ------------------------------ |
| Misma serie y número normalizado        | Necesaria, pero insuficiente   |
| Mismo idioma                            | Fuerte                         |
| Títulos compatibles                     | Complementaria                 |
| Mismo número de páginas                 | Complementaria                 |
| Secuencia de hashes idéntica de páginas | Muy fuerte                     |
| Mismas dimensiones y proporciones       | Complementaria                 |
| Mismo scanlation group                  | No demuestra que sea duplicado |
| Diferente resolución                    | No implica capítulo diferente  |

### 5.1. Hashes y archivos de imagen

Si KuraScroll ya tiene hashes de páginas, reutilízalos.

Puedes crear una huella de secuencia:

```
chapter_signature =
  hash(
    page_1_hash +
    page_2_hash +
    page_3_hash +
    ...
  )
```

Esto permite detectar dos versiones idénticas sin volver a leer todos los bytes del HDD durante cada reconciliación.

Si no existen hashes, no generaría SHA-256 de todo el archivo durante el escaneo inicial de candidatos. En el T4500 y el HDD mecánico eso puede convertirse en una operación de lectura y CPU importante.

Primero utiliza información barata:

- Número de páginas.
- Tamaño total.
- Dimensiones almacenadas en metadatos.
- Idioma.
- Título.
- Número normalizado.
- Grupo de procedencia.

Después, solo para candidatos dudosos, calcula o verifica una huella mediante una tarea de fondo.

No uses el tamaño mayor como sinónimo de calidad mayor.

### 5.2. Calidad de versiones

El reconciliador debe conservar todas las versiones válidas y elegir una versión preferida, no borrar las demás.

Propondría una puntuación de calidad basada en:

| Señal            | Consideración                                         |
| ---------------- | ----------------------------------------------------- |
| Integridad       | Imágenes que decodifican correctamente                |
| Resolución       | Suficiente para la pantalla y sin escalado artificial |
| Completitud      | Número y orden de páginas esperados                   |
| Consistencia     | Sin páginas faltantes o corruptas                     |
| Idioma           | Preferencia del lector                                |
| Scanlation group | Grupo preferido por el usuario                        |
| Tamaño           | Indicador auxiliar, no criterio absoluto              |

La preferencia de usuario debe ganar sobre el score automático. Por ejemplo, un usuario puede preferir Scan B incluso si Scan C contiene imágenes de mayor resolución.

Si dos versiones son casi idénticas, pero una tiene más resolución, selecciona la mejor como predeterminada sin perder la otra.

## 6. Modelo de datos: capítulo lógico y versiones

No cambiaría radicalmente `chapters` en este sprint si actualmente representa una entrada importada. Añadiría una capa de reconciliación que permita evolucionar el modelo con migraciones pequeñas.

### 6.1. Variantes de capítulo

Una propuesta:

```
CREATE TABLE IF NOT EXISTS chapter_variants (
    id INTEGER PRIMARY KEY,

    logical_chapter_id INTEGER NOT NULL,
    source_chapter_id INTEGER NOT NULL UNIQUE,

    scanlation_group TEXT,
    language TEXT,

    page_count INTEGER NOT NULL DEFAULT 0,
    total_bytes INTEGER NOT NULL DEFAULT 0,

    source_hash TEXT,
    quality_score REAL NOT NULL DEFAULT 0,

    status TEXT NOT NULL DEFAULT 'AVAILABLE'
        CHECK (
            status IN (
                'AVAILABLE',
                'CORRUPT',
                'ARCHIVED'
            )
        ),

    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(logical_chapter_id, source_chapter_id)
);

CREATE INDEX IF NOT EXISTS idx_chapter_variants_logical
ON chapter_variants(logical_chapter_id, status);
```

`logical_chapter_id` identifica el capítulo que verá el usuario. `source_chapter_id` conserva la relación con la entrada original importada.

En una implementación más consolidada, cada variante debería contener también su archivo de origen y su secuencia de páginas, con una asociación estable de páginas.

### 6.2. Mapa de capítulos fusionados

Para mantener compatibilidad con las tablas que ya usan `chapter_id`, añade un redirect lógico:

```
CREATE TABLE IF NOT EXISTS chapter_merge_map (
    source_chapter_id INTEGER PRIMARY KEY,
    canonical_chapter_id INTEGER NOT NULL,
    merge_job_id TEXT NOT NULL,
    merged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK(source_chapter_id <> canonical_chapter_id)
);
```

Al resolver un capítulo:

```
chapter_id solicitado
       │
       ▼
¿Existe en chapter_merge_map?
       │
   ┌───┴────┐
   │        │
  NO       SÍ
   │        │
   ▼        ▼
Original  canonical_chapter_id
```

Una vez que las versiones quedan vinculadas al capítulo lógico, las consultas del catálogo deben mostrar el capítulo una sola vez. Las consultas de versiones deben poder recuperar sus releases por separado.

### 6.3. Candidatos de reconciliación

```
CREATE TABLE IF NOT EXISTS chapter_duplicate_candidates (
    id INTEGER PRIMARY KEY,

    left_chapter_id INTEGER NOT NULL,
    right_chapter_id INTEGER NOT NULL,

    number_match INTEGER NOT NULL,
    title_score REAL NOT NULL,
    page_count_match INTEGER NOT NULL DEFAULT 0,
    content_match INTEGER NOT NULL DEFAULT 0,

    evidence_json TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'ACCEPTED',
                'REJECTED',
                'MERGED',
                'STALE'
            )
        ),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(left_chapter_id, right_chapter_id)
);
```

Las parejas deben guardarse con IDs ordenados para impedir duplicados (`left_chapter_id < right_chapter_id`).

### 6.4. Regla fundamental de progreso

El progreso debe pertenecer al capítulo lógico, no a una scanlation específica.

Sin embargo, hay un problema: las páginas de dos versiones no siempre se corresponden por índice.

Ejemplo:

```
Scan A: 22 páginas
Scan B: 24 páginas
```

Si el usuario estaba en la página 18 de A, no puedes asumir que la página 18 de B sea exactamente la misma imagen o escena.

La solución ideal es utilizar una identidad estable para cada página lógica:

```
logical_page
    ├── variant A: page 1
    ├── variant B: page 1
    ├── variant A: page 2
    └── variant B: page 2
```

Cuando no puedas alinear páginas mediante sus huellas:

- Conserva la versión que estaba leyendo el usuario como su versión preferida.
- Mantén el `page_index` dentro de esa variante.
- No cambies automáticamente su posición a la versión de mayor calidad.
- Permite cambiar de versión con una transición consciente, recalculando la posición cuando haya correspondencia.

Esto evita una pérdida de progreso silenciosa.

## 7. Fusión de series y capítulos en SQLite WAL

Aquí hay que separar dos operaciones:

Fusión lógica: declarar que dos registros representan la misma serie o capítulo.

Consolidación física: mover referencias, historiales, marcadores y relaciones hacia el registro canónico.

No haría toda la consolidación física de una serie grande dentro de una transacción monolítica. SQLite WAL permite que los lectores continúen viendo su snapshot mientras se escribe, pero sigue existiendo un solo escritor; una transacción larga retiene el bloqueo de escritura y puede hacer crecer el WAL.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.sqlite.org\&sz=32)

SQLite



### 7.1. Fusión lógica de series

Añade un mapa de series:

```
CREATE TABLE IF NOT EXISTS series_merge_map (
    source_series_id INTEGER PRIMARY KEY,
    canonical_series_id INTEGER NOT NULL,
    merge_job_id TEXT NOT NULL,
    merged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK(source_series_id <> canonical_series_id)
);
```

Cuando el usuario confirma una fusión:

1. Validar que ambas series siguen existiendo.
2. Comprobar que el candidato no está obsoleto.
3. Validar que el destino no crea un ciclo.
4. Guardar el mapa `source → canonical`.
5. Incorporar los títulos de la fuente como alias del destino.
6. Marcar la fuente como fusionada y ocultarla del catálogo.
7. Confirmar la transacción.

La resolución de una serie siempre debe seguir el mapa hasta encontrar el ID canónico. Detecta ciclos y limita la longitud de la cadena; cuando se consolide un grupo, aplana las relaciones para no tener cadenas interminables de redirects.

### 7.2. Reconciliación física por lotes

Después de la fusión lógica:

- Migra los capítulos en lotes pequeños.
- Asocia las versiones originales al capítulo lógico.
- Migra o redirige progreso y bookmarks.
- Conserva los archivos fuente.
- Actualiza índices y relaciones.
- Finaliza el trabajo cuando todas las referencias estén consolidadas.

Cada lote debe ser reanudable e idempotente. Si KuraScroll se cierra después de haber procesado 80 de 120 capítulos, debe continuar desde el último estado confirmado.

### 7.3. Cómo preservar el progreso en la migración

En la situación sencilla en que ambas filas representan exactamente el mismo capítulo y las páginas están alineadas, la migración puede seguir este patrón:

```
INSERT INTO reading_progress (
    user_id,
    chapter_id,
    last_page_index,
    furthest_page_index,
    updated_at
)
SELECT
    user_id,
    ?,
    last_page_index,
    furthest_page_index,
    updated_at
FROM reading_progress
WHERE chapter_id = ?

ON CONFLICT(user_id, chapter_id)
DO UPDATE SET

    furthest_page_index = MAX(
        reading_progress.furthest_page_index,
        excluded.furthest_page_index
    ),

    last_page_index = CASE
        WHEN excluded.updated_at > reading_progress.updated_at
        THEN excluded.last_page_index
        ELSE reading_progress.last_page_index
    END,

    updated_at = MAX(
        reading_progress.updated_at,
        excluded.updated_at
    );
```

Los dos parámetros representan el capítulo canónico y el capítulo de origen, en ese orden.

No uses `MAX(last_page_index)`. La última página visitada es una posición actual y puede retroceder. La página máxima alcanzada sí puede conservarse mediante `MAX(furthest_page_index)`, siempre que ambas versiones tengan una secuencia de páginas compatible.

Si las páginas difieren, primero calcula su correspondencia o conserva el progreso asociado a la versión original.

También deben reconciliarse:

- `user_bookmarks`: conservar notas y evitar colisiones de `(user_id, chapter_id, page_index)`.
- `reading_sessions`: mantener el historial, aunque las consultas resuelvan IDs antiguos.
- Progreso offline: traducir los IDs antiguos mediante `chapter_merge_map` antes de aplicar mutaciones pendientes.
- Eventos encolados: resolver los IDs antiguos al procesar el outbox.
- Referencias a capítulos en notificaciones o listas: utilizar el ID canónico.

No elimines el registro de origen hasta que hayas verificado que todas las relaciones dependientes están resueltas.

### 7.4. Límites transaccionales

Para un par pequeño de capítulos:

```
BEGIN IMMEDIATE
    validar identidad
    migrar progreso
    migrar bookmarks
    asociar variante
    crear chapter_merge_map
    actualizar estado candidato
COMMIT
```

Es una transacción corta y atómica.

Para una fusión de serie con centenares de capítulos:

```
Transacción lógica inicial
        │
        ▼
Mapa source → canonical
        │
        ▼
Lotes de consolidación
        ├── lote 1 → COMMIT
        ├── lote 2 → COMMIT
        ├── lote 3 → COMMIT
        └── ...
        │
        ▼
Verificación final
        │
        ▼
Finalización
```

Mientras se consolida, todas las rutas de lectura deben resolver los IDs antiguos mediante los mapas. Así no se necesita una transacción gigante para que el catálogo presente una identidad lógica consistente.

Regla de oro: no hagas operaciones del HDD, hashing o análisis de imágenes dentro de `BEGIN IMMEDIATE`. Prepara y valida los datos antes de adquirir el bloqueo de escritura.

## 8. REST API Fastify

Separaría los endpoints de detección de los endpoints de confirmación. El descubrimiento es una tarea de fondo; las fusiones son operaciones explícitas que modifican datos.

### 8.1. Detección automática

| Método | Endpoint                                         | Función                      |
| ------ | ------------------------------------------------ | ---------------------------- |
| POST   | `/api/v1/maintenance/duplicate-detection`        | Iniciar análisis             |
| GET    | `/api/v1/maintenance/duplicate-detection/:jobId` | Consultar progreso           |
| DELETE | `/api/v1/maintenance/duplicate-detection/:jobId` | Cancelar análisis            |
| GET    | `/api/v1/series/duplicate-candidates`            | Listar candidatos            |
| GET    | `/api/v1/series/duplicate-candidates/:id`        | Ver evidencia y puntuaciones |
| POST   | `/api/v1/series/duplicate-candidates/:id/reject` | Rechazar candidato           |
| POST   | `/api/v1/series/duplicate-candidates/:id/merge`  | Confirmar fusión             |

Ejemplo de solicitud:

```
POST /api/v1/maintenance/duplicate-detection
Content-Type: application/json
```

```
{
  "scope": "modified",
  "includeAliases": true,
  "includeFuzzy": true
}
```

Ejemplo de confirmación:

```
POST /api/v1/series/duplicate-candidates/42/merge
Content-Type: application/json
```

```
{
  "canonicalSeriesId": 15,
  "expectedCandidateVersion": 3
}
```

La versión esperada evita ejecutar una fusión sobre una propuesta que cambió desde que el usuario la revisó.

### 8.2. Cross-Scanlation Reconciler

| Método | Endpoint                                           | Función                       |
| ------ | -------------------------------------------------- | ----------------------------- |
| GET    | `/api/v1/series/:id/chapter-reconciliation`        | Listar candidatos             |
| GET    | `/api/v1/chapters/duplicate-candidates/:id`        | Ver comparación               |
| POST   | `/api/v1/chapters/duplicate-candidates/:id/merge`  | Confirmar equivalencia        |
| POST   | `/api/v1/chapters/duplicate-candidates/:id/reject` | Declarar capítulos diferentes |
| GET    | `/api/v1/chapters/:id/variants`                    | Ver versiones disponibles     |
| PUT    | `/api/v1/chapters/:id/preferred-variant`           | Cambiar versión preferida     |

La respuesta de candidatos debería incluir el número normalizado, título, grupo, idioma, cantidad de páginas, tamaño, evidencia de hashes y advertencias sobre progreso.

No devolvería únicamente el score: la interfaz necesita explicar por qué dos capítulos se están proponiendo como equivalentes.

## 9. Estructura de módulos

Recomendaría esta distribución:

```
src/
├── modules/
│   ├── duplicate-detection/
│   │   ├── TitleNormalizer.ts
│   │   ├── AliasResolver.ts
│   │   ├── JaroWinkler.ts
│   │   ├── NGramSimilarity.ts
│   │   ├── CandidateGenerator.ts
│   │   ├── DuplicateScorer.ts
│   │   ├── DuplicateDetectionService.ts
│   │   └── DuplicateDetectionRepository.ts
│   │
│   ├── chapter-reconciliation/
│   │   ├── ChapterNumberParser.ts
│   │   ├── ChapterIdentityResolver.ts
│   │   ├── ChapterVariantResolver.ts
│   │   ├── ChapterQualityScorer.ts
│   │   ├── ProgressMigrator.ts
│   │   └── ChapterMergeService.ts
│   │
│   └── merge-engine/
│       ├── SeriesMergeService.ts
│       ├── MergeJobRepository.ts
│       ├── CanonicalIdResolver.ts
│       └── MergeRecoveryService.ts
```

La detección no debe tener permiso para eliminar archivos. Su responsabilidad termina al crear candidatos con evidencia. La fusión tampoco debe eliminar CBZ originales ni versiones físicas de capítulos.

### Integración con IOCoordinator

El flujo sería:

```
DuplicateDetectionService
        │
        ▼
 Priority.BACKGROUND
        │
        ▼
 CandidateGenerator
        │
        ├── Consultar FTS5
        ├── Recuperar alias
        └── Procesar un lote limitado
                 │
                 ▼
             PauseGate
                 │
        ┌────────┴────────┐
        │                 │
  Hay lectura         Sistema libre
  interactiva             │
        │                 ▼
     Pausar          DuplicateScorer
                          │
                          ▼
                    Guardar candidatos
```

No crearía otro sistema de colas. Reutiliza el controlador de mantenimiento existente y permite que las operaciones interactivas tengan prioridad.

También separaría el cálculo de similitud de las escrituras SQLite: no mantengas una transacción abierta mientras comparas cientos de títulos.

## 10. SLA y aceptación del Sprint 43

Los números siguientes son objetivos de ingeniería para el T4500, no resultados medidos. Los probaría con el catálogo real y con carga de lectura activa.

| Métrica                                  | Objetivo inicial     |
| ---------------------------------------- | -------------------- |
| Dependencias de fuzzy matching           | 0                    |
| Comparación completa N²                  | 0                    |
| Candidatos por serie                     | Máximo 50            |
| Comparaciones por lote                   | Limitadas y medibles |
| Longitud máxima admitida de título       | 256 puntos de código |
| Lote de series procesadas                | 16–32                |
| Trabajo CPU antes de yield               | Objetivo ≤15 ms      |
| Escrituras de resultados                 | Por lotes cortos     |
| Fusión automática destructiva            | 0                    |
| Archivos originales eliminados por merge | 0                    |
| Pérdida de progreso confirmada           | 0                    |

Para el scoring, mide P50 y P95 por comparación y por lote; no establezcas un SLA de milisegundos sin probar títulos cortos, largos, CJK y alias múltiples.

### Matriz de pruebas

A. Normalización y títulos

- `Attack on Titan` y `Attack-on-Titan`.
- `Solo Leveling` y sus alias verificados.
- Mayúsculas, acentos y puntuación.
- `[ScanGroup]` conocido se elimina.
- `[Final Season]` se conserva como calificador.
- Títulos japoneses con dakuten.
- Hiragana y katakana según la política elegida.
- Hangul y romanización.
- Emojis y caracteres suplementarios.
- Dos títulos similares de series diferentes no se fusionan automáticamente.

B. Blocking y FTS5

- Alias exactos recuperados.
- Títulos con diferencias ortográficas recuperados.
- Consultas de menos de tres caracteres.
- Candidatos duplicados deduplicados.
- No se generan pares `A-B` y `B-A`.
- La detección incremental no vuelve a procesar todo el catálogo.
- FTS5 no recibe expresiones de usuario sin sanitizar.

C. Capítulos

- `01` equivale a `Ch. 1`.
- `10.5` y `10.50` tienen la misma clave.
- `10.5` y `10` permanecen separados.
- `10-1` no se interpreta arbitrariamente como decimal.
- Capítulos extra y prólogos conservan su identidad.
- Dos scanlations del mismo capítulo aparecen como variantes.
- Distintas traducciones no mezclan idiomas accidentalmente.

D. Integridad y recuperación

- El último progreso leído se conserva.
- El máximo de página alcanzado no disminuye.
- Las posiciones se mapean correctamente entre versiones compatibles.
- Los bookmarks no se duplican.
- El outbox puede resolver IDs antiguos.
- La fusión interrumpida se reanuda.
- Las versiones originales siguen disponibles.
- Los mapas de IDs no permiten ciclos.

E. Concurrencia

- Lectura interactiva durante detección.
- Lectura interactiva durante consolidación.
- Escrituras concurrentes controladas.
- Transacciones de merge cortas.
- `SQLITE_BUSY` y errores transitorios gestionados.
- Sin hashing masivo durante navegación.

## 11. Distribución entre agentes

| Agente                 | Responsabilidad                                      | Entregable           |
| ---------------------- | ---------------------------------------------------- | -------------------- |
| A — Matching Engine    | Normalizador, Jaro-Winkler, N-Gram y scorer          | Motor TypeScript     |
| B — FTS5               | Índices de títulos, alias y generación de candidatos | Candidate Generator  |
| C — Chapter Reconciler | Parser numérico, identidad y variantes               | Reconciliador        |
| D — Merge Engine       | Series merge, progreso, bookmarks y redirects        | Merge Services       |
| E — Integration/QA     | Fastify, WAL, IOCoordinator y pruebas                | Integración completa |

Orden de implementación recomendado:

1. Normalizador y pruebas de títulos.
2. Algoritmos de similitud y pruebas unitarias.
3. Integración de candidatos con FTS5.
4. Persistencia de candidatos y revisión.
5. Parser y normalización de números de capítulo.
6. Modelo de variantes de scanlation.
7. Resolución de progreso y bookmarks.
8. Fusionador transaccional y recovery.
9. Endpoints Fastify.
10. Pruebas de estrés en el T4500.

No dejes que el agente del motor de similitud implemente también el merge de SQLite. Son responsabilidades distintas y deben tener contratos independientes.

## Veredicto final de arquitecto

# Blocking + Hybrid Fuzzy Matching + Logical Merge

Las tres decisiones que más protegerán a KuraScroll:

1\. Para las series: FTS5 reduce candidatos; Jaro-Winkler, N-Gram y tokens puntúan las coincidencias; los alias resuelven diferencias entre idiomas.

2\. Para los capítulos: la identidad se establece mediante serie, numeración, idioma y tipo; cada scanlation es una variante del capítulo lógico.

3\. Para los merges: conservar progreso, marcadores, outbox y archivos originales; confirmar la fusión lógica en una transacción breve y consolidar las referencias por lotes.

Mi advertencia principal: nunca confundas una coincidencia de título con una identidad editorial confirmada. Tampoco confundas una versión de mayor resolución con una versión que pueda sustituir sin consecuencias a la que el usuario estaba leyendo.

El éxito de Sprint 43 no será que encuentre miles de duplicados, sino que encuentre buenos candidatos, explique sus decisiones y permita fusionarlos sin romper el catálogo ni el progreso.

Referencias técnicas: [NIST — Jaro-Winkler](https://xlinux.nist.gov/dads/HTML/jaroWinkler.html?utm_source=chatgpt.com) · [SQLite — FTS5](https://www.sqlite.org/fts5.html?utm_source=chatgpt.com) · [Unicode — Normalization Forms](https://www.unicode.org/standard/reports/tr15/?utm_source=chatgpt.com) · [SQLite — Write-Ahead Logging](https://www.sqlite.org/wal.html?utm_source=chatgpt.com).

Como siguiente paso, conviene convertir el blueprint en tareas de agentes con contratos de migración y un conjunto de títulos y capítulos reales para calibrar los umbrales antes de activar las fusiones.

Auditar detección y fusiones del Sprint 43 cada domingo
