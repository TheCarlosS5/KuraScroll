# Auditoría UX: Motor de Ritmo Visual Adaptativo por Viñeta e Interpolador de Encuadre Dinámico (Adaptive Per-Panel Visual Pacing & Dynamic Zoom Framing Interpolator) (Sprint 99)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación del ritmo visual por viñeta (*per-panel pacing*), transiciones cinemáticas suaves para portadas y mangas de combate con viñetas asimétricas, y respeto estricto a la reducción de movimiento (`is_motion_reduced`).

---

## 1. Ergonomía del Atajo de Teclado `'P'`
* **Invocación Rápida:** La tecla `P` (*Pan / Pacing*) permite alternar o abrir al instante el HUD de configuración del encuadre y ritmo de viñetas, permitiendo al usuario personalizar la velocidad de transición sin interrumpir su inmersión.

---

## 2. Prevención de Fatiga Visual en Mangas de Combate (Viñetas Asimétricas)
En mangas de acción trepidante con composiciones de página caóticas, diagonales y viñetas asimétricas (como *Chainsaw Man* o *Jujutsu Kaisen*), el ojo humano suele esforzarse para seguir el orden correcto de lectura.
* **El Impacto del Encuadre Dinámico:** El interpolador de zoom guía la atención de manera fluida y rítmica de una viñeta a otra. Las transiciones amortiguadas eliminan los movimientos robóticos, reduciendo drásticamente la fatiga ocular durante las escenas de combate más densas.

---

## 3. Accesibilidad y Respeto a `is_motion_reduced`
* **Salud Vestibular:** Para lectores sensibles al movimiento o con propensión a la cinetosis, cualquier interpolación de zoom y paneo automático puede resultar intolerable.
* **Desactivación Inmediata:** El sistema verifica el estado de `is_motion_reduced` (ya sea por preferencia del sistema operativo o activado manualmente en KuraScroll), desactivando al instante todos los efectos de zoom cinemático y reemplazándolos por cortes instantáneos limpios y estáticos.

---

## Conclusión
El motor de ritmo visual del Sprint 99 aporta una experiencia cinematográfica de primer nivel a la lectura de mangas complejos, gobernada con rigor ergonómico y total accesibilidad para usuarios sensibles al movimiento.
