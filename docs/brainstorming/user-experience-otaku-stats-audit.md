# Auditoría UX: Estadísticas Otaku, Gráficos de Radar de Géneros, Heatmap de Actividad y Visualización de Bajo Consumo

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto de la Prueba:** Evaluación de la interfaz de estadísticas personales de lectura desde la perspectiva de Carlos (otaku y lector empedernido) en hardware con resoluciones compactas (netbooks 1024x600 y 1366x768).

---

## 1. Visualización de Estadísticas Personales y Motivación
Las estadísticas de lectura en aplicaciones de manga no deben sentirse como una hoja de cálculo fría de Excel, sino como un **resumen épico de logros del usuario** (estilo "Perfil de Cazador" o "Estadísticas de Rango").
* **Sensación de Logro:** Ver el total de capítulos leídos, tiempo invertido y géneros favoritos genera una fuerte conexión emocional y orgullo por el hábito cultivado.
* **Diseño Limpio:** El panel de estadísticas se presenta en tarjetas modulares (*bento grid*) que priorizan la información más satisfactoria (ej. capítulos devorados, racha activa y géneros dominantes).

---

## 2. Legibilidad en Pantallas Pequeñas (1024x600 y 1366x768)
En portátiles y netbooks con pantallas compactas, los gráficos complejos (como un gráfico de radar de géneros o un heatmap anual) corren el riesgo de solaparse o volverse ilegibles.
* **Adaptabilidad del Gráfico de Radar:** Las etiquetas de los ejes de géneros (ej. *Shonen, Isekai, Seinen, Romance, Slice-of-Life*) deben contar con un tamaño de fuente reducido pero nítido (mínimo 11px con contraste WCAG AA) y abreviaturas automáticas si el espacio es crítico.
* **Heatmap de Actividad Escalable:** El mapa de calor de actividad diaria se adapta haciendo scroll horizontal táctil o reduciendo la densidad de celdas en resoluciones de 1024x600, asegurando que los últimos meses sean siempre visibles sin romper el diseño general.

---

## 3. Conexión Conceptual con las Insignias (Badges - Sprint 31)
Para cerrar el ciclo de gamificación, las estadísticas no operan de forma aislada; sirven como el motor que valida los logros otaku.
* **Enlace Directo en UI:** Cada sección del radar o del heatmap está conectada visualmente con los badges obtenidos. Por ejemplo, al destacar que el género Isekai representa el 60% de la lectura, se muestra de forma sutil la insignia de *"Caminante de Mundos"* desbloqueada.
* **Sabor Otaku:** Uso de micro-copys motivadores que validan el esfuerzo del lector (ej. *"Tu género principal es Shonen (45%). Nivel de maná: Alto"*).

---

## Conclusión
El módulo de estadísticas del Sprint 41 transforma datos estáticos en una experiencia visual gratificante, respetando las limitaciones de pantallas compactas y reforzando el sentido de comunidad y progreso otaku.
