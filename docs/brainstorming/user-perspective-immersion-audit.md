# Auditoría de Inmersión Sensorial y Ergonomía de Efectos (Sprint 56)

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación crítica de los efectos de vibración (*haptics*), temblores de pantalla (*screen shake*) y cumplimiento de accesibilidad para lectores apasionados (persona: Carlos).

---

## 1. El Peligro del Cinetosis y la Fatiga Táctil/Visual
Los efectos cinemáticos como el temblor de pantalla ante una explosión o la vibración continua del dispositivo durante una pelea intensa pueden parecer atractivos en un tráiler, pero **en sesiones de lectura prolongadas (1 a 3 horas) provocan mareo (cinetosis), fatiga visual y molestia general**. 
* **Regla de Oro:** El movimiento en una interfaz de lectura debe ser siempre sutil, justificado y estrictamente opcional.

---

## 2. Estado Predeterminado: Opt-In Obligatorio
* **Decisión Crítica:** El estado por defecto para cualquier efecto de vibración o temblor de pantalla **debe ser Desactivado (*Opt-In*)**. 
* **Por qué:** Un usuario que abre KuraScroll por primera vez en público (en el transporte o de noche) no debe recibir sorpresas mecánicas o sacudidas visuales inesperadas. La app debe ser silenciosa y estable por defecto.

---

## 3. Controles Independientes (Haptics vs. Screen Shake)
Las preferencias de hardware y físicas de los usuarios varían enormemente:
* **Toggle de Vibración (Haptics):** Permite activar o desactivar la respuesta háptica en dispositivos móviles o mandos compatibles.
* **Toggle de Temblor de Pantalla (Screen Shake):** Controla exclusivamente el efecto visual de sacudida en la interfaz web/desktop.
* **Por qué es vital:** Un usuario de PC de escritorio puede querer desactivar el temblor visual para evitar distracciones, mientras que un usuario en tablet o móvil puede preferir vibraciones hápticas sutiles sin alterar la estabilidad del lienzo de lectura. Ambos controles deben ser 100% independientes.

---

## 4. Accesibilidad y Trastornos Vestibulares (`prefers-reduced-motion`)
* **Respeto a la Configuración del Sistema:** KuraScroll debe consultar obligatoriamente la directiva CSS/Media Query `prefers-reduced-motion: reduce`. 
* **Automatización:** Si el sistema operativo del usuario indica sensibilidad al movimiento, cualquier efecto de sacudida de pantalla, zoom violento o animación cinemática debe **eliminarse automáticamente**, priorizando la salud y el confort accesibles por encima de cualquier efecto inmersivo.

---

## Conclusión
El diseño de inmersión sensorial del Sprint 56 se alinea perfectamente con las necesidades ergonómicas de Carlos: máximo respeto por el confort del usuario, controles granulares independientes, opt-in estricto por defecto y cumplimiento riguroso de accesibilidad para evitar el mareo.
