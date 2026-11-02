# Auditoría UX: Mapeo de Tono de Contraste Dinámico y Compensador de Sangrado de Tinta en Semitonos (Dynamic Contrast Tone-Mapping & Halftone Ink Bleed Compensator) (Sprint 103)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación del levantamiento del punto de negro en un 8% para evitar que las tramas de semitonos (*halftones*) se empasten en escaneos económicos, preservación de la riqueza de la tinta sin deslavar la imagen, y usabilidad del atajo `'I'` con retroalimentación en curva de transferencia.

---

## 1. Prevención del Empastamiento en Semitonos (*Halftone Mud*) en Escaneos Económicos
En muchos tomos económicos o digitalizaciones antiguas de manga, la compresión y la calidad del papel provocan que los pequeños puntos de las tramas de sombreado (*halftone screentones*) se fusionen y se conviertan en manchas de lodo negro opaco (*black mud*).
* **El Impacto del Levantamiento del 8% (*Black Point Lift*):** Elevar sutilmente el punto de negro en un 8% separa digitalmente los puntos individuales de la trama de semitonos, restaurando la textura grisácea original y devolviendo la claridad y el relieve visual a los sombreados sombríos de la obra.

---

## 2. Equilibrio Dinámico: Evitar el Deslavado Excesivo de Tinta
* **El Reto:** Si el levantamiento de negros o el ajuste de contraste es demasiado agresivo, las líneas de tinta negra principal pierden profundidad y la página luce deslavada y grisácea (*washed out*).
* **La Solución Ergonómica:** El compensador de tinta aplica una curva de transferencia de tono en "S" invertida muy precisa, asegurando que los trazos de los personajes y las líneas de contorno permanezcan firmes y oscuros, mientras que el rango dinámico intermedio de los semitonos recupera su nitidez.

---

## 3. Evaluación del Atajo de Teclado `'I'` y Curva de Transferencia
* **Atajo Dedicado (`'I'` de *Ink / Tone Curves*):** Permite activar o ajustar al instante el compensador de sangrado de tinta y abrir un minimapa visual opcional con la curva de transferencia de tono.
* **Retroalimentación Visual Clara:** El gráfico de la curva muestra en tiempo real cómo se remapean los niveles de luz y sombra, ayudando al usuario a calibrar el nivel de compensación perfecto para cada manga escaneado de forma totalmente intuitiva.

---

## Conclusión
El compensador de sangrado de tinta del Sprint 103 rescata digitalmente la legibilidad artística de escaneos complejos, ofreciendo una experiencia visual limpia, contrastada y fiel a la intención original del mangaka.
