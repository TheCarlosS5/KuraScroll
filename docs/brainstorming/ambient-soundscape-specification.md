# Sprint 73: Multi-Track Ambient Soundscapes & Atmospheric BGM Mixer Engine

> [!IMPORTANT]
> **Misión:** Proveer acompañamiento sonoro inmersivo de fondo (lluvia, fuego, viento, taberna, misterio, combate, lofi zen) coordinado con el género del manga/manhwa.
> **Restricciones de Hardware:**
> 1. **Host CPU:** Intel Pentium T4500 (2C/2T 2.3GHz, V8 heap $\le$ 512MB). Cero transcodificación de audio en el servidor Fastify.
> 2. **Almacenamiento:** HDD mecánico SATA II de 4TB (`STORAGE_ROOT`, 5400 RPM). Archivos de audio en bucle ligero (Opus/WebM o MP3 a 64-96 kbps, transmitidos en bloques de 64KB con `Cache-Control: public, max-age=31536000, immutable`).
> 3. **Cliente / GPU:** Intel GMA 4500MHD. Mezclador Web Audio API en cliente (`AudioContext`, nodos `GainNode` para Maestro y cada canal), guardias estrictos de reproducción automática (*Autoplay Gesture Guard*), y **0 CLS** / cero filtros de desenfoque.
> 4. **SLA 37:** Latencia matemática de interpolación de ganancia (*Equal-Power Cross-Fade*) $< 0.02\text{ ms}$ ($< 20\ \mu\text{s}$).

---

## 1. Catálogo Canónico de 8 Presets Atmosféricos

| ID Preset | Género Primario | Título Atmosférico | Canal 1 (Base Ambiental) | Canal 2 (Elemento Secundario) | Canal 3 (Armonía Sutil) | Volumen Defecto |
|:---|:---|:---|:---|:---|:---|:---|
| `rain_night` | Romance, Drama, Slice of Life | Lluvia Nocturna en Ventana | `rain_gentle_loop.webm` | `distant_thunder_loop.webm` | `piano_soft_loop.webm` | 0.45 |
| `medieval_tavern` | Fantasía, Isekai, Aventura | Taberna Medieval & Campamento | `fireplace_crackling.webm` | `tavern_crowd_murmur.webm` | `acoustic_lute_loop.webm` | 0.50 |
| `epic_combat` | Shōnen, Acción, Artes Marciales | Pulso de Combate Épico | `war_drums_pulse.webm` | `metal_clash_ambience.webm` | `low_bass_drone.webm` | 0.60 |
| `mist_mystery` | Seinen, Misterio, Psicológico, Terror | Niebla & Viento Desolado | `desolate_wind_loop.webm` | `subtle_whispers.webm` | `eerie_drone_loop.webm` | 0.40 |
| `shrine_breeze` | Slice of Life, Sobrenatural, Histórico | Brisa de Santuario Shinto | `wind_chimes_breeze.webm` | `cicadas_summer_loop.webm` | `koto_ambient_loop.webm` | 0.40 |
| `lofi_zen` | Comedia, Escolar, Recuentos de la Vida | Lo-Fi Zen Study | `lofi_vinyl_crackles.webm` | `warm_electric_piano.webm` | `soft_kick_snare_loop.webm` | 0.55 |
| `cyber_subterranean` | Cyberpunk, Ciencia Ficción, Mecha | Sintetizador Subterráneo | `analog_synth_drone.webm` | `neon_hum_generator.webm` | `sub_pulse_loop.webm` | 0.50 |
| `silence_pure` | General, Manga Lectura Silenciosa | Silencio Puro (Pausado) | `none` | `none` | `none` | 0.00 |

---

## 2. Esquema SQLite Relacional (`schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS ambient_soundscape_presets (
  id TEXT PRIMARY KEY,
  genre TEXT NOT NULL,
  title TEXT NOT NULL,
  track_base_url TEXT NOT NULL,
  track_sub_url TEXT,
  track_harmony_url TEXT,
  default_volume REAL NOT NULL DEFAULT 0.5,
  fade_duration_ms INTEGER NOT NULL DEFAULT 1500,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_soundscape_genre ON ambient_soundscape_presets(genre);

CREATE TABLE IF NOT EXISTS user_soundscape_preferences (
  user_id TEXT PRIMARY KEY,
  master_volume REAL NOT NULL DEFAULT 0.7,
  is_muted INTEGER NOT NULL DEFAULT 0,
  auto_play_on_reader INTEGER NOT NULL DEFAULT 0,
  active_preset_id TEXT NOT NULL DEFAULT 'silence_pure',
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_soundscape_user_pref ON user_soundscape_preferences(user_id);
```

---

## 3. Matemática de Equal-Power Cross-Fade (SLA 37)

Para transicionar suavemente entre dos estados o pistas sin caídas de volumen perceptibles (*volume dips*) en la potencia acústica total:
$$\text{gainOut}(t) = \cos\left(t \times \frac{\pi}{2}\right)$$
$$\text{gainIn}(t) = \sin\left(t \times \frac{\pi}{2}\right)$$
Donde $t \in [0.0, 1.0]$.
La suma de potencias satisface:
$$\text{gainOut}^2 + \text{gainIn}^2 = \cos^2\left(t \frac{\pi}{2}\right) + \sin^2\left(t \frac{\pi}{2}\right) = 1.0$$
Target SLA 37: Cálculo de la curva de igual potencia en **$< 0.02\text{ ms}$ ($< 20\ \mu\text{s}$)** con **cero asignación en heap**.
