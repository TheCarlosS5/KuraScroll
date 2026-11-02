# Auditoría UX: Motor de Lupa de Enfoque Sacádico (Saccadic Glance & Panel Magnifier Loupe Engine) (Sprint 78)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación ergonómica de la lupa de inspección flotante (*Magnifier Loupe*) para lectura detallada de kanjis con furigana, onomatopeyas y fondos complejos de panel sin perder la orientación general de la página.

---

## 1. Ergonomía de Inspección sin Pérdida de Contexto
Al leer obras con arte denso o textos pequeños, hacer zoom completo de toda la página suele desorientar al lector al perder la perspectiva global del panel.
* **La Solución (Panel Magnifier Loupe):** Una lupa circular o rectangular flotante y ajustable (magnificación de 1.5x a 3x) que sigue el cursor o el dedo, permitiendo examinar al instante kanjis complejos con su respectivo *furigana*, onomatopeyas y detalles ocultos en el fondo.
* **Prevención de Mareos:** Como la página completa permanece estática mientras se desplaza únicamente el área de la lente, se elimina por completo el riesgo de cinetosis o mareo visual asociado al zoom y paneo agresivo.

---

## 2. Comportamiento durante el Paso de Página
* **No Interferencia:** La lupa es un elemento dinámico e independiente. Al pulsar las teclas de flecha o hacer un gesto táctil para cambiar de página, la lupa se oculta automáticamente de forma instantánea (`0ms`), dejando el lienzo completamente limpio para recibir el nuevo capítulo o página sin superposiciones molestas.

---

## 3. Accesibilidad para Pantallas Pequeñas y Fatiga Visual
* **Accesibilidad Inclusiva:** Para usuarios con fatiga visual o pantallas compactas de 1366x768 (como el hardware Pentium T4500), la lupa actúa como una herramienta de lectura asistida indispensable, permitiendo ampliar zonas críticas con un solo movimiento sin alterar la distribución general del visor.

---

## 4. Puntos de Fricción y Recomendaciones de Diseño
1. **Control de Tamaño y Zoom:** Proveer un acceso rápido (con la rueda del ratón o atajos `+` / `-`) para ajustar el factor de aumento y el diámetro de la lente sobre la marcha.
2. **Modo Toggle Estricto:** Permitir apagar la lupa con un atajo dedicado (`Z` o `Space + Click`) para aquellos momentos donde el usuario prefiera una lectura totalmente limpia y sin elementos flotantes.
