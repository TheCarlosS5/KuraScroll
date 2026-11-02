# Auditoría UX: WebP Reescalado frente a Escaneos Crudos (Sprint 58)

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la legibilidad, calidad artística y frustraciones del usuario (persona: Carlos) ante diferentes niveles de reescalado y compresión de imágenes de manga (tiers de 800px, 1200px y 1600px con calidad Q=80 y filtro de interpolación Lanczos3).

---

## 1. Análisis de Legibilidad por Niveles de Resolución
Los escaneos originales de manga suelen tener resoluciones gigantescas (a menudo superiores a 2000px o 3000px de ancho), lo que satura la memoria y el almacenamiento si no se tratan adecuadamente. Sin embargo, una compresión excesiva destruye los elementos más finos de la página.

* **Nivel de 800px (Ahorro Extremo):** Inaceptable para la mayoría de los mangas. Provoca que el texto secundario, los globos de diálogo pequeños y el *furigana* (kana sobre kanji) se vuelvan borrosos e ilegibles. Solo útil para conexiones extremadamente lentas en pantallas muy reducidas.
* **Nivel de 1200px (El Estándar Equilibrado):** Ofrece una excelente relación calidad/rendimiento para la mayoría de pantallas de portátiles y tablets (incluyendo resoluciones de 1366x768). Los trazos de tinta principal se mantienen limpios, aunque los kanjis muy densos pueden perder definición si la fuente original era deficiente.
* **Nivel de 1600px + Q=80 con Lanczos3 (El Nivel de Fidelidad Otaku):** **La opción recomendada para lectores exigentes.** El filtro de interpolación *Lanczos3* preserva la nitidez de los bordes sin generar artefactos de sierra (*aliasing*), permitiendo leer con total claridad tanto el trazo del mangaka como el texto más pequeño.

---

## 2. Identificación de Frustraciones del Usuario
1. **Kanjis borrosos y Furigana ilegible:** Si el sistema escala agresivamente por debajo de 1000px, los estudiantes de idiomas y lectores de raws sufrirán al intentar descifrar los caracteres.
2. **Artefactos de compresión en tramas de puntos (*Screentones*):** Una compresión barata genera patrones de interferencia (*moiré*) y manchas grises en los sombreados tradicionales del manga. El uso de WebP Q=80 minimiza este defecto de manera sobresaliente.
3. **Thrashing de caché por cambios bruscos de zoom:** Si el cambio entre niveles de calidad genera saltos o demoras al cargar, el lector experimenta parpadeos molestos.

---

## 3. Prescripción de Umbrales Visuales y Filtros de Nitidez
* **Umbral Recomendado por Defecto:** Configurar **1200px / 1600px** como límite superior con compresión **WebP (Q=80)** y el algoritmo de redimensionamiento **Lanczos3**.
* **Control Granular:** Permitir en la configuración del lector un selector de calidad visual (*Velocidad / Equilibrado / Calidad Máxima 4K*) para que Carlos pueda elegir priorizar el ahorro de espacio o la perfección absoluta del trazo.
