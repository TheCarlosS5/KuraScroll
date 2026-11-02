# Auditoría UX: Divisor Inteligente de Dobles Páginas y Unificador de Webtoons (Intelligent Dual-Page Splitter & Webtoon Vertical Stitcher Engine) (Sprint 76)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la experiencia visual y ergonómica al gestionar dobles páginas en dispositivos móviles/tablets y eliminar los destellos blancos en el scroll continuo de webtoons.

---

## 1. Experiencia del Purista del Manga (Dobles Páginas en Móviles vs. Laptops)
Leer un manga tradicional en formato físico o en una pantalla grande de laptop permite apreciar las dobles páginas de manera panorámica. Sin embargo, en la pantalla vertical de un smartphone, una doble página se ve microscópica si se encoge para caber entera.
* **Solución de División Inteligente (Dual-Page Splitter):** El motor detecta automáticamente cuando una imagen es una doble página apaisada y ofrece un modo de corte limpio en dos mitades secuenciales (derecha e izquierda), permitiendo leer cada sección con el tamaño perfecto en formato vertical sin perder legibilidad en los bocadillos de texto.

---

## 2. Flujo Webtoon: Eliminación del Destello Blanco (White Gap Flash)
* **El Problema:** Al hacer scroll vertical rápido en un webtoon con temas oscuros, los saltos de 1px o los espacios en blanco entre cortes de imagen generan parpadeos o destellos blancos (*white flash*) muy molestos para la vista.
* **La Solución (Vertical Stitcher Engine):** El unificador de cortes rellena los huecos con el color de fondo dominante de la página (o negro absoluto en modo oscuro), garantizando una transición totalmente uniforme y fluida.

---

## 3. Ergonomía Táctil y Atajos de Teclado
* **Táctil (Móvil/Tablet):** Gestos de doble toque para alternar rápidamente entre ajuste de ancho y ajuste de altura de página, y deslizamiento intuitivo entre mitades de dobles páginas.
* **Atajos (Escritorio):** Tecla `F` para alternar el modo de ajuste completo y teclas de flecha optimizadas para recorrer las mitades de un *spread* de manera natural.
