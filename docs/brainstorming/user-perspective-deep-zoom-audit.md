# Auditoría UX: Zoom Profundo Piramidal (Pyramidal Deep-Zoom & Pan-and-Scan) (Sprint 66)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la experiencia de navegación en dobles páginas de alta resolución y escenas de combate épicas (ej. *Berserk*, *One Piece*, *Solo Leveling*) mediante el sistema de zoom profundo piramidal (*Deep-Zoom Pan & Scan*).

---

## 1. Apreciación de Dobles Páginas Épicas (El Arte Oculto en el Detalle)
En los grandes hitos del manga y manhwa (como el Eclipse en *Berserk*, dobles páginas marinas en *One Piece* o batallas de monarcas en *Solo Leveling*), los mangakas cargan las ilustraciones de micro-detalles, expresiones faciales sutiles y fondos hiperelaborados que se pierden al encajar la página completa en una pantalla estándar de 1366x768.
* **La Necesidad del Deep-Zoom:** Los lectores ávidos no solo leen el texto; examinan el arte con lupa. Un sistema de zoom profundo piramidal permite hacer acercamientos extremos (hasta 400% o más) sin pixelación ni demoras de carga frustrantes, permitiendo apreciar el trazo de tinta original.

---

## 2. Transiciones Fluidadas: Del Modo Ajuste (Fit Mode) al Modo Detalle
Una de las mayores frustraciones en visores tradicionales es que, al hacer zoom, la imagen salta bruscamente o se descentra, desorientando por completo al lector.
* **Transiciones Sin Desorientación:** El paso del modo normal de visualización (*Fit to Screen*) al modo de inspección detallada (*Magnifying Pan Mode*) debe ser suave y guiado mediante interpolación con GSAP.
* **Anclaje de Puntero (Focal Point Anchoring):** El zoom debe expandirse exactamente desde el punto donde el usuario hizo clic o doble toque, manteniendo el foco visual en el detalle que llamó su atención (ej. una espada, un rostro o un bocadillo secundario) sin perder el norte en la página.

---

## 3. Ergonomía de Navegación en Modo Pan-and-Scan
* **Controles Intuitivos:** Arrastrar con el ratón (*click and drag*), pellizcar en pantallas táctiles (*pinch-to-zoom*) o usar las teclas de dirección del teclado para deslizarse suavemente por el lienzo ampliado.
* **Minimapa de Posición (Discreto):** Al superar el 150% de zoom, un indicador visual flotante y translúcido muy sutil en la esquina inferior muestra un rectángulo guía dentro de la miniatura de la página, indicando en qué zona exacta se encuentra el visor, previniendo la sensación de "estar perdido en el mapa".

---

## Conclusión
El motor de Zoom Profundo Piramidal del Sprint 66 otorga a KuraScroll una capacidad de exhibición artística de nivel de galería, permitiendo a los fanáticos sumergirse en los detalles más complejos del arte del manga sin mareos ni fricciones de navegación.
