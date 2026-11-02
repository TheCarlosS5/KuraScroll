# Auditoría UX: Latencia de Disco Frío en HDDs de 4TB frente a Precarga Predictiva Pre-Flight (Sprint 59)

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la experiencia de lectura al pasar páginas de manga almacenadas en discos duros mecánicos masivos (HDD 4TB con latencia de seek en frío de 300-500ms) comparada con el sistema de precarga predictiva *Pre-Flight Warmed* (0-16ms de respuesta instantánea).

---

## 1. El Impacto del "Cold Seek" en HDDs de 4TB
Muchos coleccionistas almacenan sus inmensas bibliotecas de manga en discos mecánicos de alta capacidad (4TB o superiores). Estos discos sufren un fenómeno conocido como *cold seek* o reposo de cabezal tras unos minutos sin uso.
* **La Frustración del Retardo (300-500ms):** Cuando el lector llega al final de una página y pulsa para avanzar, si el HDD está en reposo, el cabezal físico debe desplazarse mecánicamente para ubicar el sector del archivo. Ese medio segundo de espera (**300-500ms**) rompe de inmediato el ritmo visual, generando un micro-congelamiento (*stutter*) muy molesto.

---

## 2. La Magia del Precarga Predictiva *Pre-Flight Warmed* (0-16ms)
El sistema predictivo anticipa el comportamiento del lector (precargando inteligentemente las siguientes 2 o 3 páginas en búfer de memoria RAM al detectar la velocidad de lectura).
* **Volteo Instantáneo:** Al pulsar la tecla de avance, la página ya está caliente en memoria, reduciendo el tiempo de renderizado a **0-16ms (un solo frame a 60 FPS)**. La sensación es la de estar leyendo un libro físico de papel satinado.

---

## 3. Prevención de Distracciones Visuales y Sutilidad del Indicador de "Warmth"
Un sistema de precarga en segundo plano no debe entorpecer visualmente la interfaz.
* **Cero Parpadeos (No Flickering):** Los indicadores de estado de caché no deben mostrar animaciones agresivas ni spinners molestos en la esquina de la pantalla.
* **El Indicador de "Warmth" Ideal:** Un punto monocromático ultrafino o un icono de nube/disco casi imperceptible en la barra de estado (que cambia de un tono tenue a un brillo sutil cuando la precarga está completa) garantiza transparencia absoluta sin distraer al lector durante escenas clave.

---

## 4. Ganancia Psicológica de Inmersión en Secuencias Clímax
Durante las secuencias de acción trepidante o giros argumentales dramáticos, la tensión narrativa depende de la velocidad con la que el lector devora las páginas.
* **Inmersión Ininterrumpida:** Eliminar el seek stutter del HDD mecánico en el momento cumbre de una pelea o un cliffhanger permite que Carlos mantenga el estado de *flow* mental, maximizando el disfrute emocional de la obra.
