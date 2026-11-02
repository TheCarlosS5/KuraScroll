# Especificación Técnica: Taxonomía de Onomatopeyas CJK, Catálogo Canónico y Motor de Superposición Espacial de SFX (Sprint 67)

**Módulo:** Motor Dinámico de Traducción y Superposición de Onomatopeyas (`Dynamic SFX & Onomatopoeia Overlay Engine`)  
**Subagente Líder:** Lead Metadata Researcher  
**Destinatario:** Parent Agent (`a06e2886-f1e3-4be7-a0c9-4f4944819e1f`)  
**Fecha:** 2 de Noviembre de 2026  
**Hardware Objetivo:** Intel Pentium T4500 (2 Cores, 512 MB RAM), GPU Intel GMA 4500MHD, Disco Mecánico SATA II 4TB (5400 RPM)  

---

## 1. Taxonomía Lingüística de Onomatopeyas y Mimetismos CJK

A diferencia de las lenguas occidentales, donde las onomatopeyas son casi exclusivamente imitaciones de ruidos acústicos reales (ej. "boom", "crash", "bang"), las lenguas de Asia Oriental (japonés y coreano) poseen sistemas lexicológicos altamente estructurados para representar **sonidos físicos**, **movimientos sin sonido**, **condiciones ambientales** y **estados emocionales internos**.

```
+--------------------------------------------------------------------------------------------------+
|                            TAXONOMÍA LINGÜÍSTICA DE ONOMATOPEYAS CJK                             |
+----------------------+----------------------+--------------------------+-------------------------+
| Lengua / Clase       | Denominación Nativa  | Definición Fenomenológica| Ejemplos Arquetípicos   |
+----------------------+----------------------+--------------------------+-------------------------+
| **JAPONÉS**          |                      |                          |                         |
| 1. Giseigo           | 擬声語 (Phonomimes)  | Sonidos vocales reales de| ワンワン (Ladrido),     |
|                      |                      | humanos y animales.      | ギャー (Grito/Alarido)  |
| 2. Giongo            | 擬音語 (Acoustics)   | Ruidos de objetos inertes| ドン (Impacto/Boom),    |
|                      |                      | y fenómenos naturales.   | ゴゴゴ (Retumbo oscuro) |
| 3. Gitaigo           | 擬態語 (Phenomimes)  | Estados físicos mudos,   | ドキドキ (Palpitación), |
|                      |                      | texturas o condiciones.  | シーン (Silencio sepulcral)|
| 4. Gijougo           | 擬情語 (Psychomimes) | Sentimientos y estados   | ワクワク (Ilusión/Gozo),|
|                      |                      | psicológicos internos.   | イライラ (Irritación)   |
| 5. Giougo            | 擬応語 (Kinemimes)   | Trayectorias, dinámicas  | サッ (Desplazamiento),  |
|                      |                      | y aceleración física.    | バッ (Aparición súbita) |
+----------------------+----------------------+--------------------------+-------------------------+
| **COREANO**          |                      |                          |                         |
| 1. Uiseong-eo        | 의성어 (Sound Words) | Imitación de sonidos     | 쾅 (Kwang - Choque),    |
|                      |                      | acústicos audibles.      | 뻑 (Ppeok - Puñetazo)   |
| 2. Uitae-eo          | 의태어 (Mimetisms)   | Mimetismo de movimiento, | 스르륵 (Surgir/Humo),   |
|                      |                      | presencia o apariencia.  | 번쩍 (Destello de luz)  |
+----------------------+----------------------+--------------------------+-------------------------+
```

### 1.1. Las 5 Clases del Japonés (*Ono-mita-gopée*)
1. **Giseigo (擬声語):** Expresiones fónicas de seres vivos. Abarca llantos, risas humanas (*ハハハ*, *クスクス*), gritos agónicos y ladridos.
2. **Giongo (擬音語):** Sonidos mecánicos, impactos y fuerzas de la naturaleza. Constituye la columna vertebral del manga de acción (*Shonen/Seinen*), como el legendario *ドン* de Eiichiro Oda o el choque de acero *ガキン* de Kentaro Miura en *Berserk*.
3. **Gitaigo (擬態語):** Fenómenos visuales o táctiles que **no producen sonido**. Por ejemplo, *シーン* (*Shīn*) denota silencio absoluto, y *ピカピカ* (*Pika-pika*) denota algo que brilla limpiamente.
4. **Gijougo (擬情語):** Estados anímicos y psicológicos subjetivos. *ドキドキ* (*Doki-doki*) describe la aceleración cardíaca por nerviosismo o romance, mientras que *ゾクゾク* (*Zoku-zoku*) representa el escalofrío de terror ante una presencia asesina.
5. **Giougo (擬応語):** Cinética corporal y vectores de aceleración. *サッ* (*Sa*) indica evasión instantánea (*Shunpo*), y *スッ* (*Su*) un movimiento deslizante suave.

### 1.2. Las 2 Clases del Coreano en Manhwa
1. **Uiseong-eo (의성어):** Vocablos que imitan ondas sonoras acústicas reales (ej. *쾅* = explosión masiva, *콰직* = crujido óseo, *탕* = disparo de arma de fuego).
2. **Uitae-eo (의태어):** Palabras descriptivas de actitudes, movimientos y efectos mágicos sin sonido acústico (ej. *스르륵* = sombras de nigromante emergiendo del suelo en *Solo Leveling*, *두근두근* = palpitaciones de tensión).

---

## 2. Catálogo Canónico de las 50 Onomatopeyas Más Icónicas de Manga y Manhwa

A continuación se presenta el catálogo estandarizado e indexado de KuraScroll:

| # | ID Canónico | Grafía Original | Romanización | Idioma | Clase | Traducción EN | Traducción ES | Obra / Contexto Icónico | Tier Háptico |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `jp_don` | **ドン!!** | Don!! | ja | Giongo | BOOM!! / DOOM!! | ¡¡PUM!! / ¡¡BOOM!! | *One Piece* (Revelación épica / Remate dramático) | 2 (Pesado) |
| **2** | `jp_gogogo` | **ゴゴゴ** | Gogogo | ja | Giongo | RUMBLE... / MENACING | RETUMBO... / AMENAZANTE | *JoJo's Bizarre Adventure* (Aura de Stand / Tensión) | 1 (Medio) |
| **3** | `jp_dododo` | **ドドド** | Dododo | ja | Giongo | THUD THUD / APPROACH | RETUMBO / PASOS PESADOS | *JoJo* / *One Piece* (Marcha de ejército / Carga bélica) | 2 (Pesado) |
| **4** | `jp_baan` | **バーン** | Bān | ja | Giongo | BAM!! / GRAND ENTRANCE | ¡¡BAM!! / ¡¡APARICIÓN!! | Universal Shonen (Entrada triunfal de personaje) | 2 (Pesado) |
| **5** | `jp_zubat` | **ズバッ** | Zuba' | ja | Giongo | SLASH!! | ¡¡ZAS!! / ¡¡CORTE!! | *One Piece* / *Demon Slayer* (Corte limpio de espada) | 1 (Medio) |
| **6** | `jp_bot` | **ボッ** | Bo' | ja | Giongo | WHOOSH!! / FLARE | ¡¡FUSH!! / ¡¡LLAMARADA!! | *One Piece* / *Naruto* (Ignición repentina de fuego) | 1 (Medio) |
| **7** | `jp_nikat` | **ニカッ** | Nika' | ja | Gitaigo | GRIN / SMILE | ¡¡SONRISA RADIANTE!! | *One Piece* (Luffy Gear 5 / Joy Boy sonriendo) | 0 (Ligero) |
| **8** | `jp_zukyūn` | **ズキューン** | Zukyūn | ja | Giongo | IMPACT!! / KISS SHOCK | ¡¡ZASCA!! / ¡¡IMPACTO!! | *JoJo* (Dio besando a Erina / Mordedura vampírica) | 1 (Medio) |
| **9** | `jp_memetaa` | **メメタァ** | Memetaa | ja | Giongo | FROG PUNCH RESONANCE | ¡¡IMPACTO RESONANTE!! | *JoJo Phantom Blood* (Hamon atravesando la rana) | 1 (Medio) |
| **10** | `jp_bakyūn` | **バキューン** | Bakyūn | ja | Giongo | BANG!! / GUNSHOT | ¡¡PUM!! / ¡¡DISPARO!! | *JoJo* / *Chainsaw Man* (Impacto de bala / Disparo Makima)| 2 (Pesado) |
| **11** | `jp_rerorero` | **レロレロ** | Rero-rero | ja | Giseigo | LICK LICK LICK | LAMIENDO / RERO RERO | *JoJo Stardust Crusaders* (Kakyoin con la cereza) | 0 (Ligero) |
| **12** | `jp_oraora` | **オラオラ** | Ora-ora | ja | Giseigo | ORA ORA ORA!! | ¡¡ORA ORA ORA!! | *JoJo* (Lluvia de golpes de Star Platinum) | 2 (Pesado) |
| **13** | `jp_mudamuda`| **無駄無駄** | Muda-muda | ja | Giseigo | USELESS USELESS!! | ¡¡INÚTIL INÚTIL!! | *JoJo* (Ráfaga de golpes de The World / Dio) | 2 (Pesado) |
| **14** | `jp_gooo` | **ゴオオ** | Gooo | ja | Giongo | ROAR / KI AURA ROARING | ¡¡ESTRUENDO / AURA KI!! | *Dragon Ball* (Aura de Super Saiyan estallando) | 2 (Pesado) |
| **15** | `jp_panat` | **パナッ** | Pana' | ja | Giougo | VANISH!! | ¡¡DESAPARICIÓN!! | *Dragon Ball* (Teletransportación instantánea) | 0 (Ligero) |
| **16** | `jp_dokat` | **ドカッ** | Doka' | ja | Giongo | WHAM!! / HEAVY BLOW | ¡¡GOLPAZO!! / ¡¡ZASCA!! | *Dragon Ball* / *Naruto* (Patada o puñetazo contundente) | 2 (Pesado) |
| **17** | `jp_bashit` | **バシッ** | Bashi' | ja | Giongo | SMACK!! / DEFLECTION | ¡¡PALMADA / BLOQUEO!! | *Dragon Ball* / *Slam Dunk* (Desvío de ataque / Tapón) | 1 (Medio) |
| **18** | `jp_kiin` | **キーン** | Kīn | ja | Giongo | SUPERSONIC DASH | ¡¡ZUMBIDO SUPERSÓNICO!! | *Dragon Ball* / *Dr. Slump* (Vuelo supersónico Arale) | 1 (Medio) |
| **19** | `jp_shut` | **シュッ** | Shu' | ja | Giougo | SWOOSH!! | ¡¡SWOOSH!! / ¡¡FUSH!! | *Naruto* (Lanzamiento de Shuriken / Evasión veloz) | 0 (Ligero) |
| **20** | `jp_chidoric` | **カカカ** | Kakaka | ja | Giongo | CRACKLE / CHIDORI | ¡¡CHISPORROTEO ELÉCTRICO!!| *Naruto* (Chidori de Sasuke / Relámpagos concentrados)| 1 (Medio) |
| **21** | `jp_bakit` | **バキッ** | Baki' | ja | Giongo | SNAP!! / CRACK!! | ¡¡CRAC!! / ¡¡FRACTURA!! | *Baki* / *Berserk* (Rotura de huesos / Quijada quebrada) | 2 (Pesado) |
| **22** | `jp_clang` | **ガキン** | Gakin / Clang| ja | Giongo | CLANG!! | ¡¡CLANG!! / ¡¡CLANC!! | *Berserk* (Guts Dragonslayer chocando contra armadura) | 2 (Pesado) |
| **23** | `jp_zashut` | **ザシュッ** | Zashu' | ja | Giongo | CLEAVE!! / GORE SLASH | ¡¡TAJADA BRUTAL!! | *Berserk* (Espada cortando cuerpos por la mitad) | 2 (Pesado) |
| **24** | `jp_gushat` | **グシャッ** | Gusha' | ja | Giongo | SQUISH!! / CRUSH | ¡¡APLASTAMIENTO VISCERAL!!| *Berserk* / *Tokyo Ghoul* (Cráneo reventado / Tripas) | 2 (Pesado) |
| **25** | `jp_dokun` | **ドクン** | Dokun | ja | Gitaigo | THUMP / OMINOUS PULSE | LATIDO / PULSO SINIESTRO | *Berserk* (Behelit activándose / Ojo abriéndose) | 1 (Medio) |
| **26** | `jp_gichigichi`| **ギチギチ** | Gichi-gichi | ja | Giongo | SQUEAK / BONE STRAIN | CRUJIDO DE TENDONES | *Berserk* (Apóstol mutando y retorciendo sus huesos) | 1 (Medio) |
| **27** | `jp_dooon` | **ドォォン** | Dooon | ja | Giongo | THUNDER BLAST!! | ¡¡ESTRUENDO TITÁNICO!! | *Attack on Titan* (Rayo de transformación de Titán) | 2 (Pesado) |
| **28** | `jp_shuu` | **シュー** | Shū | ja | Giongo | STEAM HISS... | SILBIDO DE VAPOR... | *Attack on Titan* (Vapor caliente del equipo ODM) | 0 (Ligero) |
| **29** | `jp_gabut` | **ガブッ** | Gabu' | ja | Giongo | CHOMP!! | ¡¡MORDISCO VORAZ!! | *Attack on Titan* (Mandíbula de Titán cerrándose) | 2 (Pesado) |
| **30** | `jp_kachit` | **カチッ** | Kachi' | ja | Giongo | CLICK!! | ¡¡CLIC!! | *Death Note* (Bolígrafo escribiendo / Encendedor) | 0 (Ligero) |
| **31** | `jp_sarasara` | **サラサラ** | Sara-sara | ja | Gitaigo | SMOOTH WRITING | TRAZO FLUIDO... | *Death Note* (Light escribiendo nombres frenéticamente) | 0 (Ligero) |
| **32** | `jp_niyari` | **ニヤリ** | Niyari | ja | Gijougo | SMIRK / EVIL GRIN | SONRISA SINIESTRA | *Death Note* / *Code Geass* (Kira sonriendo con malicia) | 0 (Ligero) |
| **33** | `jp_girat` | **ギラッ** | Gira' | ja | Gitaigo | DEADLY GLARE | DESTELLO ASESINO | *Hunter x Hunter* (Mirada de sed de sangre asesina) | 0 (Ligero) |
| **34** | `jp_zokut` | **ゾクッ** | Zoku' | ja | Gijougo | CHILL DOWN SPINE | ESCALOFRÍO ATERRADOR | *Hunter x Hunter* (Aura abrumadora de Nen de Hisoka) | 1 (Medio) |
| **35** | `jp_pitat` | **ピタッ** | Pita' | ja | Giougo | SUDDEN STOP | PARADA EN SECO | *Hunter x Hunter* / *Haikyuu* (Frenado instantáneo) | 0 (Ligero) |
| **36** | `jp_shiin` | **シーン** | Shīn | ja | Gitaigo | DEAFENING SILENCE | SILENCIO SEPULCRAL | Universal Manga (Pasma absoluta tras evento impactante) | 0 (Ligero) |
| **37** | `jp_dokidoki` | **ドキドキ** | Doki-doki | ja | Gijougo | HEARTBEAT / NERVOUS | LATIDO ACELERADO | Universal Manga (Palpitaciones de nervios o amor) | 0 (Ligero) |
| **38** | `jp_wakuwaku` | **ワクワク** | Waku-waku | ja | Gijougo | EXCITEMENT / THRILL | ILUSIÓN ENTUSIASTA | *Spy x Family* (Anya Forger emocionada por misión) | 0 (Ligero) |
| **39** | `jp_bat` | **バッ** | Ba' | ja | Giougo | DRAMATIC FLOURISH | ¡¡DESPLIEGUE SÚBITO!! | Universal Shonen (Aparición repentina / Capa al viento) | 1 (Medio) |
| **40** | `jp_sat` | **サッ** | Sa' | ja | Giougo | SWIFT REPOSITION | PASO VELOZ / DESVÍO | *Bleach* (Shunpo de Byakuya) / *Jujutsu Kaisen* | 0 (Ligero) |
| **41** | `jp_kukuku` | **ククク** | Kukuku | ja | Giseigo | HEHEHE / CHUCKLE | JE JE JE... | *Bleach* (Risa contenida y condescendiente de Aizen) | 0 (Ligero) |
| **42** | `jp_zugaan` | **ズガーン** | Zugān | ja | Giongo | DIMENSION CRACK / BLAST | ¡¡QUIEBRA DIMENSIONAL!! | *Jujutsu Kaisen* (Vacío Púrpura de Satoru Gojo) | 2 (Pesado) |
| **43** | `ko_kwak` | **콰아아** | Kwaaa | ko | Uiseong-eo| ROAR / MANA BLAST | ¡¡RUGIDO DE MANÁ!! | *Solo Leveling* (Disparo de energía mágica de Jin-Woo) | 2 (Pesado) |
| **44** | `ko_kwajik` | **콰직** | Kwajik | ko | Uiseong-eo| SKULL CRUSH!! | ¡¡CRUJIDO DESTRUCTIVO!! | *Solo Leveling* (Aplastando el cráneo de una hormiga) | 2 (Pesado) |
| **45** | `ko_seureureuk`| **스르륵**| Seureureuk | ko | Uitae-eo | SHADOW EMERGENCE | SURGIR DE LAS SOMBRAS | *Solo Leveling* (Ejército de sombras emergiendo) | 0 (Ligero) |
| **46** | `ko_ppeok` | **뻑** | Ppeok | ko | Uiseong-eo| BLUNT FACE PUNCH | ¡¡GOLPAZO DIRECTO!! | *Solo Leveling* / *Lookism* (Puñetazo seco a la mandíbula)| 2 (Pesado) |
| **47** | `ko_swik` | **쉭** | Swik | ko | Uiseong-eo| DAGGER THRUST | ¡¡ESTOCADA VELOZ!! | *Solo Leveling* (Dagas de colmillo de Rasaka atacando) | 1 (Medio) |
| **48** | `ko_kung` | **쿵** | Kung | ko | Uiseong-eo| HEAVY THUD / FOOTSTEP | ¡¡RETUMBO DE PISADA!! | *Solo Leveling* / *ORV* (Pisada de jefe de mazmorra) | 2 (Pesado) |
| **49** | `ko_beonjjeok`| **번쩍** | Beonjjeok | ko | Uitae-eo | FLASH / LEVEL UP | ¡¡DESTELLO CEGADOR!! | *Solo Leveling* / *Overgeared* (Subida de nivel / Ventana) | 0 (Ligero) |
| **50** | `ko_dugeun` | **두근두근** | Dugeun-dugeun| ko | Uitae-eo | HEART POUNDING | LATIDO PALPITANTE | Manhwa Romance / Acción (Corazón latiendo con furia) | 0 (Ligero) |

---

## 3. Especificación Técnica de Coordenadas Espaciales Normalizadas en SQLite

Para garantizar que las cajas delimitadoras de las onomatopeyas se dibujen con precisión milimétrica sin importar si el lector visualiza la página en un móvil a $800\text{ px}$, un portátil a $1200\text{ px}$ o un monitor 4K, KuraScroll define una representación **estrictamente invariante a la escala en punto flotante normalizado $[0.0, 1.0]$**.

### 3.1. Definición del Bounding Box Normalizado
Para una página escaneada con dimensiones nativas $W_{\text{orig}} \times H_{\text{orig}}$:

$$\text{normX} = \frac{X_{\text{px}}}{W_{\text{orig}}}, \quad \text{normY} = \frac{Y_{\text{px}}}{H_{\text{orig}}}$$
$$\text{normW} = \frac{\text{Width}_{\text{px}}}{W_{\text{orig}}}, \quad \text{normH} = \frac{\text{Height}_{\text{px}}}{H_{\text{orig}}}$$

- **Rango Válido:** Todos los valores se restringen a $0.0 \le \text{normX}, \text{normY} \le 1.0$ y $0.0 < \text{normW}, \text{normH} \le 1.0$.
- **Ángulo de Inclinación Tipográfica (`rotationDeg`):** Rotación en grados ($-180.0^\circ$ a $+180.0^\circ$) con pivote en el centro geométrico de la caja $(\text{normX} + \text{normW}/2, \; \text{normY} + \text{normH}/2)$, permitiendo rotar onomatopeyas inclinadas en viñetas de combate.
- **Denormalización en el Cliente:**
  $$X_{\text{viewport}} = \text{round}(\text{normX} \times W_{\text{viewport}})$$
  $$Y_{\text{viewport}} = \text{round}(\text{normY} \times H_{\text{viewport}})$$

---

### 3.2. Esquema DDL en SQLite para Persistencia de SFX

```sql
-- Catálogo global de onomatopeyas con metadatos léxicos y hápticos
CREATE TABLE IF NOT EXISTS sfx_catalog (
    id TEXT PRIMARY KEY, -- ej: 'jp_don', 'ko_kwak'
    script_original TEXT NOT NULL,
    romanization TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('ja', 'ko', 'zh')),
    linguistic_class TEXT NOT NULL CHECK (linguistic_class IN (
        'giseigo', 'giongo', 'gitaigo', 'gijougo', 'giougo',
        'uiseong_eo', 'uitae_eo'
    )),
    literal_meaning TEXT NOT NULL,
    translation_en TEXT NOT NULL,
    translation_es TEXT NOT NULL,
    haptic_tier INTEGER NOT NULL DEFAULT 1 CHECK (haptic_tier IN (0, 1, 2)),
    synth_recipe TEXT, -- Parámetros Web Audio en JSON (ADSR, frecuencias)
    iconic_reference TEXT NOT NULL
);

-- Regiones espaciales de onomatopeyas vinculadas a páginas específicas
CREATE TABLE IF NOT EXISTS page_sfx_overlays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK (page_number >= 1),
    sfx_id TEXT NOT NULL REFERENCES sfx_catalog(id) ON DELETE CASCADE,
    custom_text TEXT, -- Texto alternativo opcional si difiere del catálogo
    norm_x REAL NOT NULL CHECK (norm_x >= 0.0 AND norm_x <= 1.0),
    norm_y REAL NOT NULL CHECK (norm_y >= 0.0 AND norm_y <= 1.0),
    norm_w REAL NOT NULL CHECK (norm_w > 0.0 AND norm_w <= 1.0),
    norm_h REAL NOT NULL CHECK (norm_h > 0.0 AND norm_h <= 1.0),
    rotation_deg REAL DEFAULT 0.0,
    font_scale REAL DEFAULT 1.0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(chapter_id, page_number, norm_x, norm_y)
);

CREATE INDEX IF NOT EXISTS idx_page_sfx_lookup 
    ON page_sfx_overlays(chapter_id, page_number);
```

---

## 4. Motor de Renderizado Dinámico de Superposición (Overlay Engine)

El motor admite tres modos de visualización configurables por el usuario:
1. **`ORIGINAL_RAW`:** El arte del mangaka permanece inalterado sin ninguna etiqueta visual.
2. **`TRANSLATED_OVERLAY`:** Se renderiza una insignia tipográfica limpia con sombreado oscuro (*drop-shadow*) que flota sobre el SFX original en el idioma del lector (español o inglés).
3. **`INTERACTIVE_TOOLTIP`:** Al pasar el cursor o pulsar sobre la onomatopeya en la pantalla táctil:
   - Se muestra un tooltip animado con la pronunciación fonética y significado dramático.
   - Dispara simultáneamente la vibración háptica calibrada (**Sprint 56**) y la síntesis procedural de sonido (**Sprint 49**).

### 4.1. Transformación CSS / SVG para Renderizado de la Insignia

```css
.sfx-overlay-badge {
  position: absolute;
  left: calc(var(--norm-x) * 100%);
  top: calc(var(--norm-y) * 100%);
  width: calc(var(--norm-w) * 100%);
  height: calc(var(--norm-h) * 100%);
  transform: rotate(calc(var(--rotation-deg) * 1deg));
  transform-origin: center center;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  font-family: 'Bangers', 'MangaImpact', sans-serif;
  text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000;
  color: #FFF;
  cursor: pointer;
  user-select: none;
}
```

---

## 5. Implementación de Referencia en TypeScript: `SfxOverlayEngine`

```typescript
export interface SfxOverlayRecord {
  id: number;
  chapterId: string;
  pageNumber: number;
  sfxId: string;
  scriptOriginal: string;
  romanization: string;
  translationEn: string;
  translationEs: string;
  normX: number;
  normY: number;
  normW: number;
  normH: number;
  rotationDeg: number;
  hapticTier: 0 | 1 | 2;
  synthRecipe: string | null;
}

export class SfxOverlayEngine {
  /**
   * Transforma coordenadas normalizadas a píxeles exactos de viewport.
   */
  public static calculateViewportBox(
    overlay: { normX: number; normY: number; normW: number; normH: number },
    viewportWidth: number,
    viewportHeight: number
  ): { x: number; y: number; width: number; height: number } {
    return {
      x: Math.round(overlay.normX * viewportWidth),
      y: Math.round(overlay.normY * viewportHeight),
      width: Math.round(overlay.normW * viewportWidth),
      height: Math.round(overlay.normH * viewportHeight)
    };
  }

  /**
   * Genera el estilo CSS in-line optimizado para el componente overlay.
   */
  public static generateInlineStyle(overlay: SfxOverlayRecord): Record<string, string> {
    return {
      position: 'absolute',
      left: `${(overlay.normX * 100).toFixed(2)}%`,
      top: `${(overlay.normY * 100).toFixed(2)}%`,
      width: `${(overlay.normW * 100).toFixed(2)}%`,
      height: `${(overlay.normH * 100).toFixed(2)}%`,
      transform: `rotate(${overlay.rotationDeg}deg)`,
      transformOrigin: 'center center'
    };
  }
}
```

---

## 6. Conclusión y Resumen de Especificación

- **Rigor Lingüístico:** Estructuración de las 5 categorías de onomatopeyas japonesas (*Giseigo, Giongo, Gitaigo, Gijougo, Giougo*) y las 2 categorías de manhwa coreano (*Uiseong-eo, Uitae-eo*).
- **Catálogo Canónico:** 50 efectos de sonido legendarios completamente mapeados con referencias icónicas (JoJo, One Piece, Dragon Ball, Berserk, Attack on Titan, Solo Leveling), equivalencias en inglés y español, y vinculación con tiers de vibración háptica.
- **Invarianza Espacial en SQLite:** Modelo de coordenadas $[0.0, 1.0]$ con rotación e indexación B-tree en SQLite para consultas contiguas con cero saltos radiales mecánicos en discos SATA II de 4TB.
