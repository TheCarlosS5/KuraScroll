# ChatGPT Senior Architectural Blueprint: Sprint 43
## Automated Series Duplicate Detection, Jaro-Winkler Natural Fuzzy Matching & Cross-Scanlation Chapter Reconciler

**Consultor Senior:** ChatGPT (Sesión Brave `Colaboración en proyecto - Brave`)  
**Fecha:** Noviembre 2026  
**Hardware Objetivo:** Intel Pentium T4500 (2C/2T @ 2.30 GHz, 512 MB RAM cap, 4 TB SATA II HDD)  
**Objetivo:** Eliminar la duplicación accidental de series y capítulos al escanear e importar colecciones locales o backups de Tachiyomi/Mihon, logrando normalización de strings en < 10 µs y comparación difusa Jaro-Winkler en < 20 µs.

---

## 1. El Problema: Duplicación Accidental en Manga/Manhwa/Manhua

Cuando el usuario descarga o sincroniza mangas desde diversas fuentes, una misma obra se fragmenta en múltiples entradas de base de datos debido a:
1. **Tags de grupos de scanlation**: `[Asura Scans]`, `(Flame Comics)`, `[Reaper]`, `{MangaDex}`, `TCB Scans -`.
2. **Sufijos de formato y resolución**: `(Webtoon)`, `[Official]`, `[HD]`, `1080p`, `[Digital Colored]`, `(Tankobon)`.
3. **Variaciones de romanización (Hepburn / McCune-Reischauer)**:
   - `Tōkyō Revengers` vs `Tokyo Revengers` vs `Toukyou Revengers`.
   - `Solo Leveling` vs `Na Honjaman Level Up`.
   - `Kimetsu no Yaiba` vs `Demon Slayer`.
4. **Símbolos y puntuación**: `SPY×FAMILY` vs `SPY x FAMILY`; `Re:Zero` vs `Re Zero`.

---

## 2. Pipeline de Pre-Normalización en TypeScript Puro (< 10 µs)

```typescript
const SCANLATION_GROUPS = new Set([
  'asura scans', 'asurascans', 'flame comics', 'flame scans', 'flamescans',
  'reaper scans', 'reaperscans', 'mangadex', 'tcb scans', 'tcb',
  'zero scans', 'zeroscans', 'alpha scans', 'luminous scans', 'realm scans',
  'void scans', 'cosmic scans', 'reset scans', 'drakescans', 'bato',
  'batoto', 'comick', 'webtoons', 'line webtoon', 'tapas', 'tappytoon',
  'lezhin', 'bilibili', 'kakaopage', 'seven seas', 'viz media', 'yen press',
  'kodansha', 'shonen jump', 'jump comics'
]);

const NOISE_TOKENS = new Set([
  'webtoon', 'official', 'digital', 'hd', 'hq', 'lq', '1080p', '720p', '4k',
  'full color', 'colored', 'raw', 'uncensored', 'censored', 'tankobon',
  'scanlation', 'scans', 'comic', 'manga', 'manhwa', 'manhua', 'oneshot',
  'complete', 'end', 'batch', 'v01', 'v02', 'vol', 'volume', 'ch', 'chapter'
]);

const BRACKET_REGEX = /\[([^\]]+)\]|\(([^\)]+)\)|\{([^\}]+)\}/g;

export function normalizeTitle(rawTitle: string): string {
  if (!rawTitle) return '';

  let title = rawTitle;

  // 1. Eliminar contenido entre corchetes/paréntesis que coincida con scanlators o ruido
  title = title.replace(BRACKET_REGEX, (_match, p1, p2, p3) => {
    const inside = (p1 || p2 || p3 || '').trim().toLowerCase();
    for (const group of SCANLATION_GROUPS) {
      if (inside.includes(group)) return '';
    }
    for (const noise of NOISE_TOKENS) {
      if (inside === noise || inside.startsWith(noise + ' ') || inside.endsWith(' ' + noise)) {
        return '';
      }
    }
    if (/^(1080p|720p|4k|\d{4})$/i.test(inside)) return '';
    return ` ${inside} `;
  });

  // 2. Descomposición canónica Unicode NFKD y eliminación de tildes/macrones (ō -> o)
  title = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

  // 3. Minúsculas
  title = title.toLowerCase();

  // 4. Normalización de signos de multiplicación e interpuncts japoneses (× -> espacio)
  title = title.replace(/[×✕✖*・·]/g, ' ');

  // 5. Normalización de guiones tipográficos, dos puntos, tildes y barras
  title = title.replace(/[—–−―\-_:;/\\~〜|]/g, ' ');

  // 6. Eliminación de signos de puntuación y comillas
  title = title.replace(/['"`‘’“”!?.,()\[\]{}@#$%^&+=<>]/g, '');

  // 7. Colapso de espacios en blanco
  return title.replace(/\s+/g, ' ').trim();
}
```

---

## 3. Matriz de Reconciliación en 3 Niveles

1. **Nivel 1 (Coincidencia Exacta Normalizada)**: `normalizeTitle(a) === normalizeTitle(b)` $\rightarrow$ Fusión inmediata.
2. **Nivel 2 (Jaro-Winkler Natural $\ge 0.88$)**:
   Tolera transliteraciones menores (`tokyo revengers` vs `toukyou revengers` = **96.9%**; `spy family` vs `spy x family` = **96.7%**).
3. **Nivel 3 (Expansión de Sinónimos Multilingües)**:
   Búsqueda en la tabla `series_titles` para títulos en inglés vs romaji japonés o hangul coreano (`Shingeki no Kyojin` $\leftrightarrow$ `Attack on Titan`; `Na Honjaman Level Up` $\leftrightarrow$ `Solo Leveling`).

---

## 4. Reconciliación de Capítulos entre Scanlations
Cuando una serie entrante se identifica como duplicada:
1. No se crea una nueva serie en `series`.
2. Se consulta `chapters` por `(series_id, chapter_number)`.
3. Si el capítulo no existe, se inserta asignando el scanlator (`chapters.scanlation_group = 'Flame Comics'`).
4. Si ya existe, se mantiene la versión de mayor resolución o se enlaza sin duplicar el progreso de lectura del usuario (`user_progress`).
