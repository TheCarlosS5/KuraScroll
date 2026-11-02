# Auditoría UX: Ecualizador de Bordes de Texto y Kanji en Rango Dinámico Adaptativo (Adaptive Dynamic Range In-Viewport Text & Kanji Edge Equalizer) (Sprint 97)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la legibilidad en mangas clásicos escaneados de los años 80-90 (*Berserk*, *Slam Dunk*, *Monster*), ecualización de kanjis complejos y furigana diminuta, y rendimiento del atajo `'E'` a 60 FPS.

---

## 1. Legibilidad en Mangas Clásicos Escaneados de los 80-90 (*Berserk*, *Monster*)
Los mangas clásicos digitalizados de colecciones antiguas sufren frecuentemente de escaneos con bajo contraste, papel amarillento o borrosidad en los globos de diálogo debido a la impresión original en papel barato.
* **El Impacto del Ecualizador de Bordes (Edge Equalizer):** El motor detecta selectivamente los glifos de texto y aplica una ecualización local de contraste y nitidez adaptativa. Esto rescata kanjis complejos y *furigana* diminutos que antes lucían empastados o ilegibles, devolviéndoles una definición cristalina sin alterar el fondo de la viñeta.

---

## 2. Rendimiento y Ergonomía del Atajo `'E'`
* **Atajo Dedicado:** Presionar la tecla `E` activa o ajusta instantáneamente el ecualizador de texto, permitiendo al lector alternar entre el modo de escaneo original y el modo ecualizado para verificar la mejora al instante.
* **Fluidez a 60 FPS:** El procesamiento por lotes dentro del *viewport* se ejecuta de manera ligera en segundo plano, garantizando una respuesta inmediata sin tirones ni caídas de fotogramas durante el scroll.

---

## Conclusión
El ecualizador de bordes de texto del Sprint 97 es una herramienta milagrosa para disfrutar de obras maestras clásicas de los 80 y 90 con una legibilidad perfecta en pantallas modernas.
