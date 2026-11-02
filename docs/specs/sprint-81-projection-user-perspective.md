# Auditoría UX: Motor de Proyección de Lectura Multi-Ángulo (Multi-Angle Reading Projection Engine) (Sprint 81)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación ergonómica de la corrección de perspectiva trapezoidal (*keystone projection*) para lectura en diferentes posturas (escritorio, soporte inclinado, cama) y optimización en hardware legacy (Pentium T4500 / GMA 4500MHD).

---

## 1. Ergonomía Postural y Proyección Keystone
Los lectores de manga y webtoons disfrutan de las historias en múltiples posturas: sentados erguidos frente al escritorio, recostados en la cama viendo la pantalla desde un ángulo picado, o usando un soporte articulado.
* **El Problema:** Al mirar una pantalla desde un ángulo inclinado sin ajuste, los textos y viñetas sufren distorsión visual y escorzo, obligando al usuario a adoptar posturas incómodas para mantener la perpendicularidad visual.
* **La Solución (Multi-Angle Projection):** El motor de proyección permite aplicar una sutil corrección de perspectiva trapezoidal (*keystone*), compensando el ángulo de visión para que el contenido se proyecte óptimamente alineado con los ojos del lector, sin importar si la laptop está apoyada sobre las piernas o inclinada en la cama.

---

## 2. Legibilidad del Texto en Ángulos No Cero (Pitch / Yaw)
* **Preservación de Definición:** Al deformar geométricamente el lienzo mediante shaders ligeros, los textos de los bocadillos y el *furigana* pueden sufrir *aliasing*. El motor aplica interpolación subpíxel y suavizado de bordes para que, incluso con ángulos de inclinación (pitch/yaw), las letras mantengan su nitidez y no induzcan fatiga ocular.

---

## 3. Accesibilidad por Teclado (`'P'` Toggle y `ESC`)
* **Atajos Rápidos de Control:**
  - `P`: Activar / Desactivar el modo de proyección multi-ángulo o abrir el calibrador rápido de perspectiva.
  - `ESC`: Cerrar instantáneamente el menú de calibración de proyección y volver al visor estándar.
* **Navegabilidad:** Totalmente compatible con navegación por teclado y lectores de pantalla, cumpliendo con los estándares de usabilidad inclusiva.

---

## Conclusión
El motor de proyección multi-ángulo del Sprint 81 adapta KuraScroll a la comodidad física del lector en cualquier postura, combinando flexibilidad ergonómica, nitidez de texto y accesibilidad intuitiva por teclado.
