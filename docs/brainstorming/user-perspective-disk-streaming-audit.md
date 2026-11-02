# Auditoría UX: Latencia de Disco Mecánico y Streaming de Páginas (Sprint 57)

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la percepción del usuario (persona: Carlos) al leer archivos comprimidos (.cbz/.zip) almacenados en discos duros mecánicos tradicionales (HDD 5400 RPM / SATA II) utilizando streaming de páginas con seek cero en lugar de extracción total previa.

---

## 1. El Dolor del Lector en Hardware Antiguo (HDD Mecánico)
Muchos lectores entusiastas almacenan sus inmensas bibliotecas de manga en discos duros mecánicos secundarios (HDDs de 5400 RPM o 7200 RPM con alta latencia de búsqueda de cabezal, aprox. 12-15ms por seek aleatorio).
* **El Problema con la Extracción Total:** Cuando una app tradicional intenta escanear y extraer un archivo .cbz de 500MB completo antes de abrir el capítulo, el disco sufre múltiples seeks aleatorios. En un HDD lento, esto genera un **bloqueo o interrupción de 2 a 4 segundos por capítulo**, destruyendo por completo la fluidez del paso de página y generando una frustración insoportable.

---

## 2. Percepción del Usuario ante el Zero-Seek Page Streaming
La tecnología de streaming directo de páginas individuales desde el archivo comprimido sin descompresión global cambia radicalmente la experiencia en almacenamiento mecánico.
* **Respuesta Instantánea (<15ms):** Al solicitar únicamente la imagen de la página actual mediante lectura secuencial directa en el índice del archivo ZIP, el tiempo de respuesta se reduce drásticamente, haciendo que el paso de página se sienta **tan instantáneo como en una unidad SSD de alta velocidad**.
* **Cero Carga Percibida:** Carlos no experimenta tiempos muertos al cambiar de capítulo. La transición es fluida y el lector mantiene una inmersión continua, eliminando la sensación de que la aplicación "se ha congelado".

---

## 3. Conclusión Ergonómica
La optimización del Sprint 57 demuestra que KuraScroll no solo está diseñada para equipos de última generación, sino que respeta y potencia con maestría el hardware legacy (como HDDs mecánicos y portátiles antiguas), garantizando una experiencia de lectura de nivel profesional en cualquier circunstancia.
