# Sprint 106: UI/UX Critique & Reader Typography Architecture

## 1. El Impacto de la Tipografía Diminuta en Escaneos
* Muchos mangas clásicos escaneados de publicaciones físicas presentan fuentes tipográficas de 8 a 10 píxeles. En monitores de laptop (como la pantalla de la máquina Intel Pentium T4500), el lector debe inclinarse hacia la pantalla o entrecerrar los ojos, causando fatiga visual severa y abandono prematuro.
* El componente `BalloonFontHUD.tsx` proporciona control visual inmediato con atajo de teclado `'F'` para calibrar el auto-escalador de glifos en tiempo real.

## 2. Preservación Óptica de Glifos Furigana
* La anotación fonética *furigana* (ruby text) sobre kanjis densos requiere un ratio de altura de aproximadamente 40-50% respecto al carácter principal. Si el escalado comprime verticalmente el texto, los radicales y la pronunciación se vuelven ilegibles.
* La opción `is_furigana_preserved` asigna holgura superior en el cálculo para salvaguardar la legibilidad de la lectura fonética.

## 3. Restricciones de Hardware Intel GMA 4500MHD
* Cero desenfoques CSS (`filter: blur()` o `backdrop-filter`).
* Fondo sólido `#18181b`, bordes `#27272a`, tipografía monospace, cero layout shifts (`CLS = 0`).
