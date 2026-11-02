# Auditoría UX: Búsqueda de Texto Completo Multilingüe y Fuzzy CJK en KuraScroll

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto de la Prueba:** Exploración de catálogo por Carlos (otaku y lector empedernido) usando términos en inglés, romanji y CJK (kanji/kana), evaluando la respuesta en hardware legacy (Pentium T4500).

---

## 1. Comportamiento de Búsqueda y Visibilidad del Motivo de Coincidencia (Match Snippets)
Cuando Carlos busca una obra usando diferentes denominaciones (*"Shingeki"*, *"進撃"* o *"Attack on Titan"*), la mayor frustración en catálogos grandes es encontrar un resultado sin entender por qué apareció en la lista.

* **Resaltado Visual Inmediato (Highlight Match):** Los fragmentos de texto coincidentes deben mostrar etiquetas de realce `<mark>` (estilo neón sutil o dorado acento) directamente en los títulos, sinopsis o nombres alternativos.
* **Feedback de Intención:** El usuario ve al instante la coincidencia exacta con el término introducido (ej. `Coincidencia en título principal: Attack on Titan`), reduciendo la fricción cognitiva al escanear resultados rápidamente.

---

## 2. Claridad en Títulos Alternativos y CJK Fuzzy Tokenizer
Los lectores de manga suelen alternar entre títulos en inglés, nombres oficiales en romaji y kanjis originales.

* **Indicación Clara en el Snippet:** Si la búsqueda coincide con un título alternativo o en caracteres CJK, el snippet debe contextualizarlo explícitamente para evitar confusión:
  > *`Coincidencia en título en japonés: <mark>進撃</mark>の巨人 (Shingeki no Kyojin)`*
* **Tolerancia a Errores (Fuzzy Tokenizer CJK):** Gracias al tokenizador inteligente, si Carlos comete un ligero error tipográfico o introduce variantes de escritura (simplificado/tradicional/kana), el sistema comprende la intención sin arrojar resultados vacíos, manteniendo una experiencia fluida y sin frustraciones.

---

## 3. Sensación de Respuesta al Teclear Rápidamente (Debounced Requests en Hardware Legacy)
En equipos con procesadores limitados (Pentium T4500), realizar peticiones de búsqueda en cada pulsación de tecla (*keystroke*) satura el hilo principal y provoca un retraso notable (*input lag*).

* **Optimización con Debounce (300ms):** La interfaz implementa un retraso óptimo de 300ms en la entrada de búsqueda. Al teclear rápido, la UI no se congela; los resultados fluyen suavemente solo cuando el usuario hace una breve pausa.
* **Indicador de Carga Sutil:** Un sutil icono de pulso o spinner translúcido en la barra de búsqueda avisa que el índice de FTS está consultando la base de datos local sin bloquear la interacción con el teclado.

---

## Conclusión
La combinación de FTS con resaltado de coincidencias, soporte multilingüe/CJK fuzzy y un debounce optimizado para hardware modesto proporciona una experiencia de descubrimiento de catálogo digna de las mejores aplicaciones nativas, permitiendo a Carlos encontrar cualquier obra en milisegundos.
