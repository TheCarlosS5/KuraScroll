# Auditoría UX: Motor de Transiciones Cinéticas y Efecto Parallax en Viñetas Clímax (Sprint 70)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación del impacto narrativo, accesibilidad vestibular y rendimiento en hardware legacy del motor de transiciones cinéticas y efecto parallax en viñetas de acción o clímax.

---

## 1. Impacto Narrativo en Viñetas Clímax (Lectura de Diálogos)
El efecto *parallax* y las transiciones cinéticas añaden una profundidad tridimensional impresionante a las viñetas de acción intensa (ej. explosiones o ataques finales). Sin embargo, un exceso de movimiento puede dificultar la lectura.
* **Prioridad al Texto:** El parallax y los movimientos cinéticos deben aplicarse únicamente a los fondos de la viñeta o capas ambientales, **manteniendo los bocadillos de diálogo y los personajes principales en primer plano estático o con movimiento mínimo**. Esto garantiza que Carlos pueda leer los textos sin desenfoques ni fatiga visual en medio de la acción.

---

## 2. Accesibilidad y Respeto a `prefers-reduced-motion: reduce`
* **Salud Vestibular:** Las animaciones cinéticas y el desplazamiento parallax son una causa común de mareo y malestar en usuarios con sensibilidad vestibular o propensión a la cinetosis.
* **Desactivación Automática:** KuraScroll detecta rigurosamente la directiva del sistema operativo o navegador `prefers-reduced-motion: reduce` y desactiva al instante todo efecto parallax o transición cinética pesada, mostrando las viñetas con transiciones planas y limpias.
* **Control Manual:** Se incluye un toggle explícito en la configuración visual: `[ ] Permitir efectos cinéticos y parallax`, permitiendo desactivarlo a cualquier usuario que prefiera una experiencia estática tradicional.

---

## 3. Rendimiento en Pantallas de Baja Resolución y Hardware Legacy (1366x768 / T4500)
* **Optimización de Capas (GPU Layering):** Los cálculos de parallax deben ejecutarse mediante aceleración por hardware (`will-change: transform`) de forma ligera para evitar que la GPU integrada (como la Intel GMA 4500MHD) sufra caídas de fotogramas (*stuttering*).
* **Degradación Elegante:** Si la tasa de refresco cae por debajo de un umbral seguro, el motor reduce automáticamente la profundidad del parallax o desactiva las capas vectoriales secundarias para asegurar una lectura fluida.

---

## Conclusión
El motor de transiciones cinéticas del Sprint 70 enriquece la dramaturgia visual de las obras maestras del manga, implementado con un estricto respeto por la accesibilidad vestibular, la legibilidad del texto y el rendimiento en hardware modesto.
