# Auditoría UX: Efectos de Sonido Dinámicos (SFX) y Audio Ambiental

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la inmersión con efectos de sonido dinámicos (SFX) y audio ambiental sincronizados con la lectura de manga y webtoons.

---

## 1. El Dilema del Audio en el Manga: Emoción vs. Molestia
El sonido en un medio visual impreso/digital tradicional puede elevar la escena o arruinarla por completo si no se maneja con prudencia.

* **El Peligro del Sonido Invasivo:** Explosiones o estruendos repentinos durante escenas de diálogo silencioso o dramático resultan molestos y rompen la concentración del lector.
* **El Peligro del Entorno (Lectura en Público):** Un lector abriendo la app en el transporte público (metro, autobús) o en una sala de espera no puede tolerar sorpresas sonoras. **La regla de oro absoluta es: Silencio por defecto en la primera visita.** Cualquier reproducción de audio debe requerir un consentimiento explícito o mantenerse silenciada hasta que el usuario active la función.

---

## 2. La Naturaleza del Audio: Síntesis Procedural vs. Música Orquestal
Los efectos de sonido no deben competir con la imaginación del lector ni abrumar la atmósfera.

* **Sonidos Sutiles y Procedurales (SFX Ligeros):** El uso de sutiles efectos sintéticos (*whoosh* al pasar de página, un *thud* suave en un golpe seco de acción, o crujidos de papel) enriquece la experiencia háptica y visual sin saturar.
* **Evitar Música Pesada:** Las pistas de música orquestal pesada en bucle cansan rápidamente y obligan al lector a silenciar la app. El audio ambiental debe limitarse a texturas sonoras muy suaves (lluvia de fondo, viento sutil) o dispararse únicamente en momentos cinemáticos clave.

---

## 3. Estrategia de Configuración por Defecto y Persona del Lector
* **Perfil de Carlos (Lector Exigente / Nocturno / En Movimiento):** Valora la inmersión pero prioriza el control absoluto de su entorno auditivo.
* **Estrategia de Configuración Predeterminada:**
  1. **Audio Master:** Silenciado (*Muted*) por defecto en la primera ejecución de la PWA.
  2. **Banner de Invitación No Intrusivo:** Un pequeño aviso flotante en la barra superior al entrar a un capítulo con soporte de audio: `🎵 Esta serie incluye efectos de sonido inmersivos. [Activar Audio]`.
  3. **Controles Independientes:** Sliders separados para volumen general, efectos SFX de página y audio ambiental, permitiendo al usuario desactivar las explosiones pero conservar el sonido relajante de lluvia si lo desea.
