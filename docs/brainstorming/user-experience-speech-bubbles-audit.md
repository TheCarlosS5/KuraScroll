# Auditoría UX: Overlays de Burbujas de Diálogo y Soporte de Furigana (Ruby Text)

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la experiencia de lectura inmersiva con traducción flotante en burbujas de diálogo y soporte de furigana para estudiantes de idiomas y lectores de manga en idioma original.

---

## 1. El Riesgo de Invasión Visual en el Arte y Control de Opacidad
Las ilustraciones de los mangakas son obras de arte sagradas para los lectores. Superponer capas de texto traducido u overlays puede arruinar la estética si no se maneja con delicadeza.
* **El Peligro del Texto Opaco Masivo:** Un cuadro de traducción sólido sobre el dibujo original destruye el trazo y tapa detalles del fondo.
* **Soluciones Ergonómicas:**
  - **Deslizador de Opacidad del Overlay:** Permitir al usuario ajustar la transparencia del texto flotante (ej. del 40% al 100%) mediante un atajo rápido o en el menú visual.
  - **Modo "Hover / Tap to Reveal":** Opción para que el texto traducido o el furigana solo aparezcan al pasar el cursor o hacer *tap* sobre la burbuja original, manteniendo el arte limpio el 90% del tiempo.

---

## 2. Valor Pedagógico del Furigana (Ruby Text) para Estudiantes de Idiomas
Para los entusiastas que leen raws (manga en japonés) o manhwas para practicar el idioma, el soporte nativo de furigana es una herramienta de incalculable valor pedagógico.
* **Inmersión sin Fricción:** Poder ver los pequeños kana (hiragana/katakana) flotando exactamente encima de los kanji complejos elimina la necesidad de detenerse a buscar cada palabra en un diccionario externo.
* **Gamificación del Aprendizaje:** Convierte cada sesión de lectura en una sesión de estudio pasivo extremadamente efectiva y placentera.

---

## 3. Prevención de Desalineación Visual en Pantallas y Modos de Lectura
El mayor desafío técnico y de diseño es asegurar que el texto superpuesto no se desalinee al cambiar de tamaño de ventana o alternar entre modos de lectura.
* **Responsive Ruby Rendering:** El motor de renderizado debe escalar dinámicamente el tamaño de los caracteres furigana en proporción al kanji base para evitar que se superpongan entre renglones.
* **Coordenadas Relativas (Viewports):** El posicionamiento de los overlays de burbujas debe calcularse con base en porcentajes relativos a la dimensión de la página, garantizando una alineación perfecta tanto en modo horizontal (manga tradicional) como en scroll vertical (webtoon).

---

## Conclusión
El soporte de Speech Bubble Overlays y Furigana eleva a KuraScroll al nivel de las herramientas profesionales de lectura y aprendizaje de idiomas, siempre y cuando se preserve el respeto por el arte original mediante controles estrictos de opacidad y visibilidad.
