# Auditoría UX: Heatmaps de Atención Kinética y Replay Óptico de Sesión de Lectura

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la visualización de heatmaps de atención comunitaria (zonas donde más se detiene la mirada o el scroll de los lectores) en páginas de manga y webtoons.

---

## 1. El Riesgo Crítico de Spoilers Involuntarios por Intensidad de Calor
Ver un mapa de calor (*heatmap*) superpuesto sobre una página de manga antes de leerla es un arma de doble filo.
* **El Peligro del "Spoiler Visual":** Si el panel clímax de una pelea o una revelación impactante (ej. una muerte o un plot twist) tiene una concentración masiva de color rojo o ámbar brillante debido a la atención de miles de lectores anteriores, **el ojo de Carlos se dirigirá instintivamente a ese panel**, arruinando por completo el factor sorpresa y el suspense del giro argumental.
* **Infracción de la Inmersión Otaku:** Para un lector apasionado, los spoilers son la peor ofensa posible. Un sistema de heatmaps ciego destruiría la experiencia narrativa en la primera lectura.

---

## 2. Soluciones y Ergonómicas: Modo Post-Lectura y Prevención de Spoilers
Para disfrutar de la sabiduría comunitaria sin arruinar la historia, se proponen las siguientes directrices de diseño:

### A. Modo "Spoiler-Free" por Defecto (Heatmap Post-Lectura)
* **Regla de Oro:** El heatmap de atención **nunca** debe mostrarse en la primera pasada o lectura activa de un capítulo.
* **Activación Posterior:** El heatmap solo se desbloquea y visualiza **después de haber terminado de leer el capítulo por primera vez** (o mediante un botón explícito de alternancia *"Ver mapa de atención comunitaria"*). Al activarlo, una advertencia sutil recuerda: *"⚠️ Este modo muestra las zonas donde más se detuvo la comunidad. Puede contener indicios narrativos."*

### B. Anonimización y Respeto a la Privacidad (Opt-In / Opt-Out)
* **Privacidad Absoluta:** La telemetría de scroll y tiempo de parada debe ser estrictamente anónima y agregada.
* **Interruptor de Privacidad (Opt-Out):** En la configuración general del lector, debe existir una opción clara y accesible: 
  > *`[ ] Contribuir con datos de velocidad y atención anónimos para heatmaps comunitarios`* (Activado por defecto con opción de desactivarlo para usuarios que priorizan la privacidad estricta).

---

## 3. Conclusión y Recomendaciones
El sistema de Heatmaps Kinéticos es una característica brillante para análisis de ritmo y popularidad de paneles, pero su implementación UX debe proteger sagradamente la narrativa mediante la restricción *"Post-Lectura"* y controles de privacidad transparentes.
