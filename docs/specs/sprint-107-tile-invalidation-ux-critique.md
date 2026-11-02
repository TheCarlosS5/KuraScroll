# Auditoría UX: Invalidador de Micro-Tiles y Recolector de Basura en Memoria Bi-Temporal y Adaptativa con Paginación por Frames (Bi-Temporal Frame-Paced Adaptive Micro-Tile Invalidator & Memory Cache Garbage Collector) (Sprint 107)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la fluidez al hacer scroll rápido y revertir la dirección (flick hacia arriba), prevención de destellos blancos y latencias de disco en HDD de 4TB mediante el margen `PRESERVE_WARM`, y usabilidad del atajo `'T'` junto con el HUD de telemetría.

---

## 1. Comportamiento en Scroll Rápido e Inversión Inmediata (*Scroll Flick Up*)
Cuando un lector se desplaza velozmente hacia abajo por un manhwa y de repente hace un gesto rápido (*flick*) hacia arriba para revisar un panel anterior, un sistema de caché mal optimizado desecha los tiles pasados demasiado pronto.
* **El Problema:** Esto provoca un re-fetch desde el almacenamiento, resultando en destellos blancos (*white flashing*) y micro-congelamientos molestos.
* **La Solución (Bi-Temporal Tile Invalidation):** El invalidador bi-temporal y el búfer de tiles mantienen cálidas las regiones recorridas recientemente, garantizando que el regreso en sentido inverso ocurra de forma instantánea y sin parpadeos.

---

## 2. Prevención de *Thrashing* en HDD SATA II de 4TB con el Margen `PRESERVE_WARM`
* **El Desafío del Disco Mecánico:** En discos duros mecánicos de 4TB conectados por SATA II, realizar operaciones de lectura y purga de caché descontroladas (*cache thrashing*) obliga al cabezal del disco a realizar múltiples seeks aleatorios, degradando el rendimiento.
* **La Solución (`PRESERVE_WARM`):** Al reservar un margen de seguridad de tiles "calientes" en memoria RAM, se evita la invalidación prematura. El disco duro solo lee cuando es estricta y previsiblemente necesario, protegiendo el hardware y garantizando una respuesta de 0ms en la lectura cotidiana.

---

## 3. Usabilidad del Atajo `'T'` y Telemetría en el HUD
* **Atajo Dedicado (`'T'` de *Tiles / Telemetry*):** Permite invocar un panel de diagnóstico HUD que muestra el estado del recolector de basura (*Garbage Collector*), el uso de memoria RAM y la actividad de los tiles en tiempo real.
* **Discreción Visual:** El HUD de telemetría se mantiene compacto y translúcido, ocultable con un solo toque o la tecla `ESC`, asegurando que los usuarios avanzados obtengan datos profundos sin estorbar la lectura de los entusiastas casuales.

---

## Conclusión
El motor de invalidación de micro-tiles del Sprint 107 optimiza de manera magistral la gestión de memoria para hardware legacy, ofreciendo una experiencia de scroll bidireccional impecable y sin fatiga de disco.
