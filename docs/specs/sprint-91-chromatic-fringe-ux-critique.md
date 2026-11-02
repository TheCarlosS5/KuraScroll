# Auditoría UX: Neutralizador Adaptativo de Franjas de Color Subpíxel y Motor de Nitidez de Texto In-Viewport (Sprint 91)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la neutralización de franjas de color subpíxel (*chromatic fringing*) y el realce de nitidez en textos diminutos, protegiendo las ilustraciones a color y evitando halos en trazos finos de tinta.

---

## 1. Legibilidad de Kanjis Diminutos y Diálogos de 8-10px en Paneles LCD
En pantallas LCD tradicionales, los textos extremadamente pequeños o el *furigana* (8-10px) suelen sufrir de aberración cromática o franjas de color (bordes rojos/azules) debido a la estructura de subpíxeles, lo que provoca fatiga visual y lectura borrosa.
* **El Impacto de la Neutralización:** Al aplicar un filtro de corrección subpíxel adaptativo, los contornos de las letras recuperan un negro puro y nítido, permitiendo distinguir sin esfuerzo cada trazo de los kanjis más complejos sin forzar la vista.

---

## 2. Protección de Ilustraciones a Color (Portadas y Páginas de Manhwa)
Un error crítico en los filtros de nitidez de texto es aplicarlos de forma ciega a toda la imagen, lo que satura y arruina las gradientes de color, las portadas y las páginas a todo color de los webtoons o manhwas.
* **Solución Ergonómica (Detección de Texto vs. Arte):** El motor diferencia automáticamente las zonas de texto/bocadillos y aplica la neutralización de franjas y el realce de nitidez exclusivamente en los glifos y trazos de tinta monocromática, dejando las ilustraciones a color totalmente intactas y fieles al original.

---

## 3. Prevención de Artefactos "Ringing" (Halos Blancos en Trazos Finos)
Obras maestras del manga seinen como *Berserk* o *Vagabond* destacan por un trazo de plumilla hiperdetallado, con líneas de sombreado y tramas extremadamente finas.
* **El Peligro del Sharpening Excesivo:** Un filtro de nitidez agresivo genera un efecto de *ringing* (halos blancos brillantes alrededor de las líneas negras), haciendo que el dibujo luzca artificial y granulado.
* **Calibración Óptima:** El motor del Sprint 91 utiliza un algoritmo de realce con límite de pendiente (*clamped unsharp mask*), realzando la legibilidad del texto sin introducir halos molestos en los trazos delicados del autor.

---

## Conclusión
El neutralizador subpíxel y motor de nitidez del Sprint 91 optimiza la legibilidad tipográfica en paneles LCD y protege escrupulosamente el arte a color y los trazos finos de las obras maestras del manga.
