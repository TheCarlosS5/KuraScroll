# Auditoría UX: Predicción de Velocidad de Lectura y Chip Flotante Dinámico de Tiempo Restante

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto de la Prueba:** Evaluación del chip flotante de tiempo de lectura estimado en maratones de manga y webtoons con scroll vertical continuo.

---

## 1. Impacto Psicológico: ¿Reduce la fatiga o aumenta la motivación?
 Saber cuánto tiempo falta para terminar un capítulo o un volumen puede tener un doble filo psicológico:
* **El peligro del contador rígido:** Si se presenta como un reloj cronometrado estricto, genera ansiedad y sensación de "reloj de fichaje".
* **El enfoque KuraScroll (Motivación sin presión):** El chip flotante utiliza un tono amigable y estimaciones basadas en la velocidad real del usuario (ej. *"~3 min restantes"*). Al ver que un capítulo se puede terminar en pocos minutos, el lector se anima a continuar (*"bueno, solo 3 minutos más y cierro el arco"*), reduciendo la fatiga mental y combatiendo la indecisión.

---

## 2. Comportamiento durante el Scroll Intenso de Webtoons
En los webtoons, el scroll vertical es continuo y rápido. Un elemento mal diseñado en pantalla puede arruinar la experiencia inmersiva del arte.
* **No-Intrusiveness (Discreción Visual):** El chip flotante se sitúa de forma semi-transparente en una esquina inferior o superior (configurable), con un fondo translúcido estilo cristal esmerilado (`backdrop-blur`).
* **Desvanecimiento Dinámico (Auto-Hide):** Durante el desplazamiento rápido (*fast scrolling*), el chip reduce su opacidad al 30% o se oculta suavemente mediante GSAP, reapareciendo de inmediato y con la estimación actualizada tan pronto como el lector se detiene a leer.

---

## 3. Comportamiento al Salto Directo de Capítulos desde el Cajón (Drawer)
Cuando Carlos salta de manera repentina del capítulo 12 al capítulo 35 a través del cajón lateral:
* **Recálculo Instantáneo:** El motor de velocidad de lectura recalcula al vuelo la estimación basándose en el promedio de páginas/scroll del nuevo capítulo.
* **Transición Fluida del Chip:** Al abrir el nuevo capítulo, el chip muestra brevemente un estado de carga sutil (o el valor estimado recalculado) en menos de 100ms, evitando mostrar datos obsoletos del capítulo anterior que desorienten al lector.

---

## Conclusión
El chip flotante dinámico de tiempo de lectura equilibra perfectamente la información útil y el respeto por el arte visual, ofreciendo a los lectores de manga y webtoons una guía de ritmo natural y estimulante.
