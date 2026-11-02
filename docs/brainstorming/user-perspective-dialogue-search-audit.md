# Auditoría UX: OCR Local de Diálogos de Ultra-Baja Latencia y Motor de Búsqueda de Trigramas (Sprint 60)

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la experiencia del lector (persona: Carlos) al buscar frases célebres o momentos épicos mediante OCR de diálogos y búsqueda por trigramas, incluyendo políticas anti-spoiler y ergonomía de salto al resultado.

---

## 1. El Comportamiento del Otaku al Buscar Momentos Épicos
Los lectores de manga recuerdan a menudo frases icónicas ("¡No puedes vencerme!", "Yo soy la justicia", "Bankai", "¡Despiértate!"), pero rara vez recuerdan el número exacto del capítulo o volumen donde ocurrieron.
* **El Poder del OCR de Diálogos:** Poder teclear una frase suelta y encontrar instantáneamente la página exacta eleva la experiencia de KuraScroll a un nivel de utilidad inigualable (estilo buscador de citas literarias).

---

## 2. El Riesgo Crítico de Spoilers por Diálogo y Políticas Anti-Spoiler
* **El Problema:** Si Carlos busca una frase épica sobre un villano y el buscador arroja resultados de un capítulo avanzado que aún no ha leído (ej. el capítulo 140 cuando va por el 45), la vista previa del diálogo o el título del capítulo **actuarán como un spoiler masivo devastador**.
* **Propuesta de Política Anti-Spoiler:**
  - **Filtro por Defecto:** El motor de búsqueda de diálogos debe **filtrar y excluir automáticamente** todos los capítulos posteriores al progreso actual de lectura del usuario (`capítulo leídos $\le$ progreso actual`).
  - **Botón de Excepción Explícita:** Si el usuario está buscando a propósito un spoiler o recordando una escena leída hace tiempo en otra plataforma, el modal de búsqueda incluirá un selector discreto: `[ ] Incluir capítulos no leídos (¡Advertencia de spoilers!)`.

---

## 3. Ergonomía de Salto al Resultado (Viewfinder & Pulsing Frame)
Al hacer clic en un resultado de diálogo OCR, ¿cómo debe reaccionar el lector?
* **Página Completa con Marco Pulsante (Recomendado):** En lugar de hacer un zoom invasivo y ciego únicamente sobre el bocadillo (lo que hace perder el contexto espacial de la página), la interfaz debe saltar a la página exacta y resaltar el bocadillo de diálogo con un **suave marco animado de luz pulsante (efecto neón sutil)** durante 2 segundos.
* **Por qué es ergonómico:** Permite al lector ubicar inmediatamente la frase buscada sin perder la perspectiva artística de la viñeta completa.

---

## Conclusión
El motor de búsqueda por OCR de diálogos del Sprint 60 es una genialidad para los fans, protegida de manera impecable contra spoilers mediante filtros inteligentes de progreso y una navegación ergonómica basada en marcos pulsantes.
