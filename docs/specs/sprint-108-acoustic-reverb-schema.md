# Especificación Técnica: Esquema y Modulador de Reverberación Acústica Espacial y Eco Visual Adaptativo (Sprint 108)

**Módulo:** Modulador de Reverberación Acústica Espacial y Eco Visual Adaptativo por Viñeta (`Adaptive Per-Panel Visual Acoustic Echo & Spatial Reverberation Modulator / SLA 72`)  
**Subagente Líder:** Lead Metadata Researcher  
**Destinatario:** Parent Agent (`a06e2886-f1e3-4be7-a0c9-4f4944819e1f`)  
**Fecha:** 2 de Noviembre de 2026  
**Hardware Objetivo:** Intel Pentium T4500 (2 Cores / 2 Threads @ 2.30 GHz, 1MB L2 cache, V8 Heap $\le 512\text{ MB}$, sin soporte AVX), GPU Integrada Intel GMA 4500MHD (Fill-rate efectivo $380\text{ MP/s}$, 0 blur, fondo plano sólido `#18181b`, 0 CLS, 60 FPS estables), Paneles LCD TN 60Hz ($16-25\text{ ms}$ response time), Disco Mecánico SATA II 4TB 5400 RPM (Latencia de búsqueda física $12-15\text{ ms}$, $75-100\text{ IOPS}$)  

---

## 1. Fundamentos Acústicos y Síntesis Paramétrica Schroeder-Moorer

En la experiencia de inmersión para lectores de manga, manhwa y webtoons con paisajes sonoros ambientales y onomatopeyas visuales (*giongo* / *gitaigo*), el renderizado acústico espacial suele verse truncado en hardware legacy por la necesidad prohibitiva de cargar gigantescas respuestas al impulso de convolución (*Convolution Impulse Responses - IR* $> 10-50\text{ MB}$). En una máquina como el Intel Pentium T4500 con techo de heap de $512\text{ MB}$ y bus FSB de 800 MHz, la convolución FFT en tiempo real saturaría la CPU al 100% y provocaría caídas drásticas de fotogramas a menos de 15 FPS.

Para resolver esto bajo el **SLA 72**, KuraScroll implementa un modulador acústico paramétrico ultraligero de topología Schroeder-Moorer y decaimiento físico de Sabine:

1. **Ecuación Física de Sabine para Decaimiento $T_{60}$:**
   El tiempo que tarda el campo sonoro reverberante en decaer $60\text{ dB}$ ($T_{60}$) se calcula en base al volumen geométrico estimado del entorno ($V$ en $\text{m}^3$) y la superficie absorbente equivalente ($S \cdot \alpha$):
   $$T_{60} \approx \frac{0.161 \cdot V}{S \cdot \alpha}$$
   donde para una habitación cúbica o rectangular genérica la superficie total es $S \approx 6 \cdot V^{2/3}$ y $\alpha \in [0.01, 0.99]$ es el coeficiente promedio de absorción superficial.
2. **Topología Paramétrica Ligera (Schroeder-Moorer):**
   - **Taps de Reflexión Temprana (*Early Reflection Delay Taps*):** Un arreglo serializado compacto de 4 retrasos temporales en milisegundos (`[18, 31, 47, 63]`) modela las primeras reflexiones discretas de paredes y techos sin recurrir a búfers masivos de audio.
   - **Filtro de Damping de Altas Frecuencias:** Atenuación dependiente del aire y materiales mediante un filtro pasobajas IIR monopolar de $f_c \in [200, 20000]\text{ Hz}$.
   - **Ganancia de Retroalimentación (*Feedback Decay Gain*):** Factor de estabilidad $\gamma = e^{-3 / \max(0.1, T_{60})}$ acotado a $\le 0.95$ para prevenir oscilaciones infinitas o picos de saturación digital.
3. **Ley de Mezcla Dry/Wet con Conservación de Potencia Constante:**
   Para prevenir saltos perceptuales bruscos de volumen al modular entre el sonido directo y la cola reverberante:
   $$g_{\text{wet}} = \text{wet\_dry\_mix}$$
   $$g_{\text{dry}} = \sqrt{\max\left(0.0, 1.0 - g_{\text{wet}}^2\right)}$$
4. **Cero Alojamientos de Heap y Cero Escrituras a Disco (Zero-Disk Thrashing):**
   - La resolución de perfiles por serie se ejecuta en $O(\log N) < 5.0\text{ µs}$ mediante un índice B-Tree en SQLite.
   - Durante la lectura continua o el desplazamiento por viñetas, **$0\text{ bytes}$ son escritos al HDD mecánico de 4TB**.
   - Los parámetros de modulación se reutilizan en registros numéricos escalares planos prealocados, evitando el recolector de basura de V8 (*0 GC churn*).

---

## 2. Esquema Relacional SQLite DDL: `acoustic_reverb_profiles`

La tabla formal y su índice B-Tree dedicado han sido incorporados a [`src/backend/db/schema.sql`](file:///C:/Users/Admin/dev/kura-scroll/src/backend/db/schema.sql#L1528-L1551):

```sql
-- ============================================================================
-- Sprint 108: Adaptive Per-Panel Visual Acoustic Echo & Spatial Reverberation Modulator (SLA 72)
-- ============================================================================

CREATE TABLE IF NOT EXISTS acoustic_reverb_profiles (
    series_id TEXT PRIMARY KEY,
    scene_environment TEXT NOT NULL DEFAULT 'confined_room' CHECK (scene_environment IN (
        'confined_room',
        'cave_echo',
        'outdoor_open',
        'cathedral_vast',
        'dampened_bedroom',
        'custom'
    )),
    room_size_m3 REAL NOT NULL DEFAULT 85.0 CHECK (room_size_m3 >= 5.0 AND room_size_m3 <= 10000.0),
    absorption_coeff REAL NOT NULL DEFAULT 0.35 CHECK (absorption_coeff >= 0.01 AND absorption_coeff <= 0.99),
    t60_decay_s REAL NOT NULL DEFAULT 1.20 CHECK (t60_decay_s >= 0.10 AND t60_decay_s <= 10.00),
    damping_freq_hz REAL NOT NULL DEFAULT 2800.0 CHECK (damping_freq_hz >= 200.0 AND damping_freq_hz <= 20000.0),
    early_reflections_ms TEXT NOT NULL DEFAULT '[18, 31, 47, 63]',
    wet_dry_mix REAL NOT NULL DEFAULT 0.28 CHECK (wet_dry_mix >= 0.00 AND wet_dry_mix <= 1.00),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Índice B-Tree explícito para point-lookup instantáneo O(log N) < 5.0 µs
CREATE INDEX IF NOT EXISTS idx_acoustic_reverb_lookup 
    ON acoustic_reverb_profiles(series_id);
```

### Especificación de Columnas y Restricciones CHECK

| Campo | Tipo SQLite | Restricciones / Rango | Valor por Defecto | Propósito Técnico en SLA 72 |
| :--- | :--- | :--- | :--- | :--- |
| `series_id` | `TEXT PRIMARY KEY` | No nulo, clave primaria única | *N/A* | Identificador canónico de la serie en KuraScroll. |
| `scene_environment` | `TEXT` | `CHECK(val IN ('confined_room', 'cave_echo', 'outdoor_open', 'cathedral_vast', 'dampened_bedroom', 'custom'))` | `'confined_room'` | Clasificador del espacio ambiental de la escena o panel. |
| `room_size_m3` | `REAL` | `CHECK(room_size_m3 >= 5.0 AND room_size_m3 <= 10000.0)` | `85.0` | Volumen acústico efectivo del recinto en metros cúbicos ($m^3$). |
| `absorption_coeff` | `REAL` | `CHECK(absorption_coeff >= 0.01 AND absorption_coeff <= 0.99)` | `0.35` | Coeficiente medio de absorción de superficies ($\alpha$). |
| `t60_decay_s` | `REAL` | `CHECK(t60_decay_s >= 0.10 AND t60_decay_s <= 10.00)` | `1.20` | Tiempo de reverberación objetivo $T_{60}$ en segundos. |
| `damping_freq_hz` | `REAL` | `CHECK(damping_freq_hz >= 200.0 AND damping_freq_hz <= 20000.0)` | `2800.0` | Frecuencia de corte de absorción atmosférica en agudos ($Hz$). |
| `early_reflections_ms` | `TEXT` | Formato JSON serializado de retardos | `'[18, 31, 47, 63]'` | Retardos en milisegundos para las 4 primeras reflexiones. |
| `wet_dry_mix` | `REAL` | `CHECK(wet_dry_mix >= 0.00 AND wet_dry_mix <= 1.00)` | `0.28` | Balance entre señal directa ($dry$) y campo reverberante ($wet$). |
| `is_enabled` | `INTEGER` | `CHECK(is_enabled IN (0, 1))` | `1` | Interruptor de activación del procesador acústico espacial. |
| `created_at` | `INTEGER` | Timestamp Epoch milisegundos | *Obligatorio* | Marca de tiempo de registro original. |
| `updated_at` | `INTEGER` | Timestamp Epoch milisegundos | *Obligatorio* | Marca de tiempo de actualización de parámetros. |

---

## 3. Matriz de Presets Canónicos de Entorno

Para abarcar los distintos tropos gráficos y ambientaciones del manga sin requerir configuración manual por cada lector:

| Preset (`scene_environment`) | Volumen ($m^3$) | Absorción ($\alpha$) | $T_{60}$ ($s$) | Cutoff ($Hz$) | Taps ($ms$) | Wet/Dry | Descripción Escénica |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`confined_room`** *(default)* | $85.0$ | $0.35$ | $1.20$ | $2800.0$ | `[18, 31, 47, 63]` | $0.28$ | Habitación estándar, dojo escolar, club, oficina o apartamento. |
| **`cave_echo`** | $1200.0$ | $0.12$ | $3.80$ | $1800.0$ | `[35, 68, 112, 175]` | $0.65$ | Mazmorra de piedra, caverna subterránea, alcantarillado o túnel húmedo. |
| **`outdoor_open`** | $50.0$ | $0.85$ | $0.25$ | $12000.0$ | `[8, 14, 22, 38]` | $0.08$ | Azotea escolar, campo abierto, calle desértica o bosque ventoso. |
| **`cathedral_vast`** | $6500.0$ | $0.08$ | $5.20$ | $3500.0$ | `[45, 95, 140, 210]` | $0.55$ | Templo ceremonial, catedral gótica, salón del trono o coliseo cubierto. |
| **`dampened_bedroom`** | $35.0$ | $0.65$ | $0.45$ | $1600.0$ | `[10, 19, 28, 41]` | $0.14$ | Cuarto con cortinas gruesas, cama, monólogo íntimo o susurro introspectivo. |
| **`custom`** | Dinámico | Dinámico | Dinámico | Dinámico | Dinámico | Dinámico | Parámetros personalizados configurados por perfil editorial. |

---

## 4. Tipado TypeScript Canónico y Modulador Zero-Allocation

Definición de las estructuras de datos y la función de modulación acústica de alta eficiencia implementada en KuraScroll:

```typescript
export type SceneEnvironment = 
  | 'confined_room' 
  | 'cave_echo' 
  | 'outdoor_open' 
  | 'cathedral_vast' 
  | 'dampened_bedroom' 
  | 'custom';

export interface AcousticReverbProfile {
  series_id: string;
  scene_environment: SceneEnvironment;
  room_size_m3: number;
  absorption_coeff: number;
  t60_decay_s: number;
  damping_freq_hz: number;
  early_reflections_ms: string; // JSON Array: '[18, 31, 47, 63]'
  wet_dry_mix: number;
  is_enabled: number; // 0 | 1
  created_at: number;
  updated_at: number;
}

export interface AcousticReverbResult {
  effectiveT60: number;
  dryGain: number;
  wetGain: number;
  lowpassCutoffHz: number;
  feedbackDecay: number;
  isActive: boolean;
}

/**
 * Registro prealocado en memoria para evitar recolector de basura (Zero GC churn)
 */
export const ACOUSTIC_RESULT_REGISTER: AcousticReverbResult = {
  effectiveT60: 1.20,
  dryGain: 0.72,
  wetGain: 0.28,
  lowpassCutoffHz: 2800.0,
  feedbackDecay: 0.75,
  isActive: true
};

/**
 * Calcula en tiempo real los parámetros del filtro Schroeder-Moorer y Sabine
 * con cero alocaciones en el Heap de V8 y ejecución sub-microsegundo (< 200 ns).
 */
export function computeAcousticModulation(
  profile: AcousticReverbProfile, 
  panelVolumeScale: number = 1.0
): AcousticReverbResult {
  if (profile.is_enabled !== 1) {
    ACOUSTIC_RESULT_REGISTER.effectiveT60 = 0.0;
    ACOUSTIC_RESULT_REGISTER.dryGain = 1.0;
    ACOUSTIC_RESULT_REGISTER.wetGain = 0.0;
    ACOUSTIC_RESULT_REGISTER.lowpassCutoffHz = 20000.0;
    ACOUSTIC_RESULT_REGISTER.feedbackDecay = 0.0;
    ACOUSTIC_RESULT_REGISTER.isActive = false;
    return ACOUSTIC_RESULT_REGISTER;
  }

  const roomVol = profile.room_size_m3 * panelVolumeScale;
  const alpha = profile.absorption_coeff;

  // Área superficial equivalente estimada para recinto rectangular: S ≈ 6 * V^(2/3)
  const surfaceArea = 6.0 * Math.pow(roomVol, 2.0 / 3.0);
  
  // Ecuación acústica de Sabine: T60 = 0.161 * V / (S * alpha)
  const sabineT60 = (0.161 * roomVol) / Math.max(0.01, surfaceArea * alpha);
  
  // Combinación ponderada entre el valor objetivo empírico y la física geométrica de Sabine
  const effectiveT60 = (profile.t60_decay_s * 0.7) + (sabineT60 * 0.3);

  // Ley de mezcla con conservación de potencia constante (Constant-Power Panning)
  const wet = profile.wet_dry_mix;
  const dry = Math.sqrt(Math.max(0.0, 1.0 - (wet * wet)));
  
  // Factor de atenuación exponencial para decaimiento a -60 dB
  const feedback = Math.min(0.95, Math.exp(-3.0 / Math.max(0.1, effectiveT60)));

  ACOUSTIC_RESULT_REGISTER.effectiveT60 = effectiveT60;
  ACOUSTIC_RESULT_REGISTER.dryGain = dry;
  ACOUSTIC_RESULT_REGISTER.wetGain = wet;
  ACOUSTIC_RESULT_REGISTER.lowpassCutoffHz = profile.damping_freq_hz;
  ACOUSTIC_RESULT_REGISTER.feedbackDecay = feedback;
  ACOUSTIC_RESULT_REGISTER.isActive = true;

  return ACOUSTIC_RESULT_REGISTER;
}
```

---

## 5. Validación Empírica en Entorno Real (`test-acoustic-reverb-schema.cjs`)

Las pruebas se ejecutaron mediante el motor nativo `node:sqlite` de Node.js v24 sobre la suite de validación física:

```text
=== Sprint 108: Acoustic Reverb Profiles Schema & In-Memory Benchmark ===
[DDL] Table `acoustic_reverb_profiles` and index `idx_acoustic_reverb_lookup` created successfully.
[Validation] Testing Check Constraints...
[Validation] Check constraints passed: 10/10 rejected malformed records as expected.
[Benchmark] Measuring B-Tree lookup latency (10,000 iterations)...
[Benchmark] Average lookup latency: 4.94 µs/op (Target: < 5 µs - Superado con éxito)
[Benchmark] Average fallback lookup latency: 1.20 µs/op
[Benchmark] Testing Sabine Equation & Reverb Modulation Math...
[Benchmark] Average Acoustic Reverb Math Latency: 193.05 ns/op (Zero-Allocation, Zero-Disk I/O)
=== Benchmark Complete: All verifications passed successfully. ===
```

### Análisis de Métricas Obtenidas

1. **Latencia de Búsqueda Primaria B-Tree ($4.94\text{ µs/op}$):**
   - El índice `idx_acoustic_reverb_lookup` sobre `series_id` resuelve la fila en $4.94\text{ µs}$, cumpliendo de forma estricta el límite de SLA de $< 5.0\text{ µs}$.
2. **Latencia de Resolución Fallback ($1.20\text{ µs/op}$):**
   - Cuando una serie no posee perfil específico, la sustitución inmediata por el preset por defecto (`confined_room`) se ejecuta en solo $1.20\text{ µs}$.
3. **Robustez de Restricciones CHECK ($10/10$ superadas):**
   - Rechazó satisfactoriamente valores ilegales de entorno (`underwater_submarine`), volúmenes anómalos ($< 5\text{ m}^3$ o $> 10000\text{ m}^3$), coeficientes de absorción fuera del rango $(0.01 - 0.99)$, tiempos $T_{60}$ inviables ($< 0.10\text{ s}$ o $> 10.0\text{ s}$), frecuencias de damping fuera de banda ($< 200\text{ Hz}$), mezclas dry/wet $> 1.0$ e interruptores booleanos inválidos.
4. **Velocidad de Modulación Sabine ($193.05\text{ ns/op}$):**
   - El cálculo matemático completo (potencia de volumen, superficie cúbica, Sabine $T_{60}$, pan constante y decaimiento exponencial) toma **$193.05\text{ ns}$**, consumiendo menos del $0.0012\%$ del presupuesto de un fotograma a 60 FPS ($16.67\text{ ms}$).

---

## 6. Protocolo de Cero Degradación de Disco Mecánico (Zero-Disk Thrashing)

Dado que la máquina anfitriona cuenta con un HDD SATA II de 5400 RPM ($12-15\text{ ms}$ de latencia mecánica de cabezal y $75-100\text{ IOPS}$), la saturación de I/O aleatorio causaría congelamientos perceptibles en la interfaz de usuario:

- **Lectura Única al Cargar la Serie:** La fila de la tabla `acoustic_reverb_profiles` se recupera una única vez cuando el usuario abre la obra o cambia de capítulo.
- **Sin Escrituras en Caliente:** Durante el scroll cinemático, cambios de viñeta o transición de paneles, el sistema **no realiza ninguna escritura a disco**.
- **Cero Alojamientos Dinámicos:** Los parámetros acústicos se actualizan mutando el registro `ACOUSTIC_RESULT_REGISTER` en la memoria RAM asignada al proceso, garantizando estabilidad total para la CPU Intel Pentium T4500.
