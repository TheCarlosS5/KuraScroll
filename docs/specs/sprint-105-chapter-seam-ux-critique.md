# Sprint 105: UI/UX & Reader Psychology Architecture — Chapter Seam Kinematics

## 1. El Impacto de las Costuras de Capítulo en la Deserción de Lectores (*Drop-off*)
En la lectura maratónica (*binge reading*) de webtoons y manhwas en scroll vertical continuo, llegar al final de un capítulo es el punto crítico donde más lectores abandonan la obra o pierden el ritmo narrativo.
* **El Problema Tradicional:** Las plataformas fuerzan al usuario a detenerse ante botones diminutos de *"Siguiente Capítulo"* o pantallas de carga intermedias con destellos blancos (*white flashes*), desorientando la visión en entornos oscuros y quebrando el *flow* inmersivo.
* **La Solución Cinemática de KuraScroll:** Un motor de amortiguación viscosa exponencial que reduce gradualmente el momentum del desplazamiento al aproximarse a la costura (seam) y realiza pre-baking de los primeros paneles del siguiente capítulo, ofreciendo un deslizamiento continuo y orgánico.

## 2. Inercia Cinética y Resistencia Física Pre-Seam
* **Resistencia Táctil Gradual:** Emula la sutil fricción física del paso de hoja Tankōbon al aproximarse al límite (`seam_threshold_px = 160px`).
* **Encaje Magnético Suave (`is_magnetic_snap`):** Si la velocidad residual es baja ($< 150\text{ px/s}$) y la distancia al límite es menor a $30\text{ px}$, el motor bloquea suavemente la posición alineando la costura sin rebotes bruscos.
* **Pre-Baking en Memoria RAM:** El búfer circular pre-carga hasta 4 viñetas (`pre_bake_panels = 4`) del capítulo contiguo en RAM, neutralizando la latencia de seek de 12-15ms del disco HDD de 4TB.

## 3. Especificaciones del Componente `ChapterSeamHUD.tsx`
* **Contención Sólida:** Fondo `#18181b`, bordes `#27272a`, cero efectos de desenfoque (`blur`), garantizando 60 FPS estables en GPUs integradas Intel GMA 4500MHD.
* **Atajo Global:** Activación y cierre mediante la tecla `J` / `j`.
* **Visualizador Radar 2D:** Guía horizontal con zona de pre-bake, línea de costura y corredor dinámico que proyecta el vector de velocidad resultante.
