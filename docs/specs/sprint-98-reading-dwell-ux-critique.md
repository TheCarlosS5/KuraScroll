# Auditoría UX: Predictor de Tiempo de Permanencia y Micro-Mapa de Calor de Precarga Predictiva (Predictive Intelligent Pre-Reading Micro-Heatmap Dwell Predictor) (Sprint 98)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación del predictor de permanencia (*dwell time*) para mitigar micro-tirones (*stutters*) en discos duros mecánicos con latencia de seek de 12ms, usabilidad del atajo `'D'` y sutilidad de las barras de estado.

---

## 1. Mitigación de Micro-Tirones en Discos Mecánicos (HDD 12ms Seek)
Al leer en discos duros mecánicos tradicionales, el mayor enemigo de la fluidez es el retraso de 12ms a 15ms necesario para mover el cabezal físico (*seek*) cuando se solicita una nueva página de manera repentina.
* **El Impacto del Predictor de Dwell:** Al analizar el tiempo de permanencia del lector en la página actual (basado en el movimiento de scroll y la densidad de texto OCR), el sistema predice con alta precisión el momento exacto en que el usuario está a punto de pasar de página, ordenando al disco duro que mueva el cabezal con milisegundos de anticipación. El resultado es un paso de página **100% instantáneo y sin tirones**.

---

## 2. Ergonomía del Atajo de Teclado `'D'` y HUD
* **Invocación Rápida:** Presionar la tecla `D` (*Diagnostics / Dwell*) abre un panel HUD compacto que muestra las estadísticas de tiempo de permanencia y el estado del búfer de precarga.
* **Respeto por la Pantalla Limpia:** Para evitar saturar al lector con datos innecesarios mientras se sumerge en la historia, la barra de cuenta regresiva y los indicadores de prefetch permanecen **estrictamente ocultos por defecto**, desplegándose únicamente al pulsar `'D'`.

---

## Conclusión
El predictor de dwell del Sprint 98 es una obra de ingeniería invisible que resuelve con elegancia la lentitud física de los discos mecánicos veteranos, manteniendo una interfaz libre de distracciones y con control total mediante el atajo `'D'`.
