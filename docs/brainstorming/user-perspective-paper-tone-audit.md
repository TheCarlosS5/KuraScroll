# Auditoría UX: Motor Adaptativo de Tinte de Papel, Simulación E-Ink y Remapeo de Paleta (Sprint 64)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de los 6 presets de tinte de papel y simulación de tinta electrónica (E-Ink) para lectura prolongada de manga, preservando tramas finas (*screentones*) y evitando deslumbramientos nocturnos.

---

## 1. Evaluación de Presets de Tinte de Papel y Tramas (*Screentones*)
Los mangas tradicionales dependen fuertemente de patrones de puntos finos (*screentones* / *halftones*) para los sombreados y degradados. Un remapeo de paleta mal calibrado destruye estos patrones generando interferencia visual (*moiré* o dientes de sierra).
* **E-Ink Paper & Vintage Newsprint:** Estos presets aplican un tono marfil o gris claro texturizado que imita el papel de un tomo físico real. El remapeo inteligente ajusta el contraste dinámico para que los puntos de las tramas se mantengan nítidos sin fundirse en manchas negras sólidas ni perderse en el fondo.
* **Midnight Amber (Modo Noche Cálido):** Diseñado para lectura en la cama a oscuras. Elimina por completo las longitudes de onda de luz azul y tiñe los blancos brillantes con un tono ámbar profundo. Crucialmente, el remapeo protege las líneas de tinta negra y los detalles en sombras oscuras mediante una curva de tono ajustada para que las viñetas nocturnas no se vean "empastadas" o ilegibles.

---

## 2. Ergonomía de Activación (HUD y Atajo de Teclado `'T'`)
Para que un lector utilice con frecuencia los filtros de color y papel, el acceso debe ser inmediato y sin fricciones:
* **Atajo de Teclado `'T'` (Tone / Theme):** Permite a los *power users* alternar cíclicamente entre los 6 presets de papel sin apartar los ojos de la viñeta ni abrir menús complejos.
* **Menú HUD del Lector:** Un icono dedicado en la barra de herramientas flotante despliega una parrilla visual con previsualizaciones miniatura de cada tinte de papel (Blanco Puro, E-Ink, Sepia, Newsprint, Midnight Amber, OLED Slate), haciendo la selección altamente intuitiva.

---

## 3. Recomendaciones y Mejoras Ergonómicas
1. **Memoria por Serie:** Permitir que KuraScroll recuerde el preset de tinte preferido para cada manga de forma independiente (ej. un webtoon a color se lee mejor en Blanco Puro, mientras que un manga seinen antiguo luce increíble en Vintage Newsprint).
2. **Control Deslizante de Intensidad:** Añadir un slider opcional para ajustar la fuerza del tinte (del 20% al 100%) por si el usuario desea un efecto más sutil.
