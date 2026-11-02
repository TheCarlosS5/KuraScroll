# Auditoría UX: Ruta de Lectura Espacial por Viñeta y Evitación de Colisión de Bocadillos (Adaptive Per-Panel Reading Path Spatial Occlusion & Balloon Collision Avoider) (Sprint 102)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la evitación de oclusión en globos de diálogo (*speech balloon occlusion*), prevención de saltos bruscos al mover elementos de la interfaz, y usabilidad del atajo `'O'` con radar visual.

---

## 1. Por qué Evitar la Oclusión de Bocadillos Mejora la Inmersión
En el manga y el webtoon, los globos de diálogo (*speech balloons*) contienen el alma narrativa y los giros argumentales de cada viñeta. 
* **El Problema:** Cuando elementos de la interfaz (controles flotantes, barras de progreso, chips de tiempo o marcas de lectura) se superponen directamente sobre un bocadillo de texto, tapan las palabras y obligan al lector a entrecerrar los ojos o adivinar fragmentos de la frase.
* **La Solución (Balloon Collision Avoider):** El motor detecta las coordenadas espaciales de los textos y reubica de forma inteligente los elementos del HUD hacia zonas vacías o márgenes neutrales, garantizando que el arte y los diálogos permanezcan 100% visibles e inviolables.

---

## 2. Equilibrio Dinámico: Reubicación del HUD sin Saltos Bruscos
* **Transiciones Amortiguadas:** Si el HUD se desplazara de un lado a otro instantáneamente cada vez que un bocadillo entra en el campo de visión, el parpadeo y movimiento constante en la periferia distraerían al usuario.
* **Suavizado de Movimiento:** La reubicación de los elementos flotantes se ejecuta mediante fundidos y transiciones suaves (*fade & slide* de 300ms), asegurando que el reencuadre ocurra de manera orgánica y sin tirones molestos.

---

## 3. Evaluación del Atajo de Teclado `'O'` y el Radar Visual
* **Atajo Dedicado (`'O'` de *Occlusion / Overlay*):** Permite activar o desactivar rápidamente el modo de evitación de colisiones y alternar la visualización del radar espacial de análisis de globos de diálogo.
* **Radar Visual Discreto:** Ofrece una representación esquemática y translúcida opcional para desarrolladores o usuarios avanzados que desean verificar cómo el sistema detecta los textos, manteniéndose completamente oculto durante la lectura estándar para preservar la pureza visual.

---

## Conclusión
El evitador de colisiones de bocadillos del Sprint 102 protege la legibilidad narrativa con una elegancia técnica sobresaliente, asegurando que la interfaz nunca se interponga entre el lector y la historia.
