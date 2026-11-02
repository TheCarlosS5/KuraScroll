# Auditoría UX: Mezclador de Paisajes Sonoros Ambientales (Ambient Soundscapes Mixer) (Sprint 73)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la experiencia de usuario ante el mezclador de paisajes sonoros ambientales (lluvia, fuego, viento, cafetería) sincronizados con la lectura de manga.

---

## 1. El Respeto por el Silencio y el Riesgo de Intrusión
Para muchos lectores, la lectura de manga es una actividad de concentración íntima y silenciosa. Reproducir sonido sin un consentimiento claro es una de las mayores molestias en una aplicación web.
* **Silencio por Defecto:** El mezclador de sonidos ambientales debe estar estrictamente silenciado (*Muted*) por defecto en la primera ejecución de KuraScroll.
* **Memorización del Estado Mute:** Si el usuario desactiva el sonido o prefiere el silencio absoluto, la aplicación debe recordar esta preferencia para siempre en sesiones futuras, evitando reabrir canales de audio de forma imprevista.

---

## 2. Transiciones Suaves (Fade-In / Fade-Out)
* **Cero Sustos Auditivos:** Un cambio brusco de volumen o iniciar una pista de audio ambiental al 100% de golpe con un chasquido digital resulta desagradable y rompe la concentración.
* **Fundido Progresivo:** Todo inicio, pausa o cambio de pista sonora debe implementarse con un fundido gradual (*fade-in / fade-out* de 1.5 a 2 segundos), creando una atmósfera envolvente y natural.

---

## 3. Claridad en el Estado del HUD
* **Indicador Visual Discreto:** En la barra HUD del visor, un pequeño icono de onda sonora o altavoz con un ecualizador minúsculo en miniatura indica si hay un paisaje sonoro activo. Al hacer clic, despliega el mezclador para ajustar niveles de lluvia, viento o chimenea de forma totalmente intuitiva.
* **Feedback de Pausa:** Si el audio está pausado, el icono muestra un tenue estado inactivo, previniendo confusiones sobre si la app está emitiendo sonido en segundo plano.

---

## Conclusión
El mezclador de paisajes sonoros del Sprint 73 enriquece la inmersión atmosférica (ideal para leer obras de misterio, terror o slice-of-life con lluvia de fondo), siempre que se mantenga el respeto absoluto por el silencio por defecto y las transiciones con fundido suave.
