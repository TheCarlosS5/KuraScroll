# Sprint 106: QA Resilience & Boundary Matrix — Dialogue Balloon Font Auto-Scaler

## 1. Casos Límite y Pruebas de Resiliencia

1. **Dimensiones Nulas o Negativas de Bocadillo de Diálogo:**
   - Si `balloonWidth <= 0` o `balloonHeight <= 0`, el motor aplica contención inmediata fijando dimensiones mínimas seguras (1px) y retornando `minFontSizePx` sin divisiones por cero ni errores NaN.

2. **Longitud de Texto Extrema:**
   - Texto vacío (`textLength = 0`): Asigna longitud efectiva mínima (1 caracter) y escala a tamaño confortable sin explotar la raíz cuadrada.
   - Texto gigantesco (`textLength > 10,000` caracteres): Amortigua el escalado reduciendo progresivamente la fuente hasta `minFontSizePx` e indicando `isOverflowSafe = false` sin bloqueos de bucle.

3. **Viewport Bounds:**
   - Desde pantallas móviles compactas ($320 \times 480$) hasta monitores 4K ($3840 \times 2160$), la potencia de escala $(W_v / 1280)^{0.25}$ modula suavemente el factor sin saltos discretos ni reflows de CSS.

4. **Preservación Furigana:**
   - Cuando `isFuriganaPreserved = true`, se reserva el margen vertical superior del globo para permitir el renderizado tipográfico ruby sin colisión geométrica.
