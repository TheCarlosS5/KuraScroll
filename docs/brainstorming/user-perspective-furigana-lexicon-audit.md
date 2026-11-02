# Auditoría UX: Popover de Furigana y Glosario de Lore (Sprint 62)

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la experiencia de interacción con el popover flotante de Furigana y notas de Lore (glosario dinámico) en el visor de manga, evaluando retardo de hover (*hover delay*), atajo de teclado `'L'`, usabilidad táctil y legibilidad en modo oscuro.

---

## 1. Interacción Ergonómica: Hover Delay y Atajo de Teclado `'L'`
Cuando un lector estudia japonés o busca contexto mitológico/histórico en un manhwa o manga, los popover informativos no deben estorbar la lectura fluida.
* **Hover Delay (300ms):** Para evitar que las ventanas emergentes parpadeen o aparezcan por accidente cada vez que el cursor pasa velozmente sobre un kanji o término, se establece un retardo inteligente de 300ms. El popover solo se despliega si el usuario detiene intencionalmente la mirada o el ratón sobre la palabra.
* **Atajo de Teclado `'L'` (Lexicon / Lore):** Permite a los *power users* activar o desactivar rápidamente la capa de glosario interactivo sin necesidad de navegar por menús flotantes, optimizando la velocidad de navegación.

---

## 2. Experiencia Táctil en Móviles y Laptops Táctiles
En pantallas táctiles (tablets o convertibles 2-en-1), el concepto de *hover* no existe de manera natural.
* **Tap to Pin:** Un toque (*tap*) sobre una palabra con furigana o término de lore abre y fija (*pin*) el popover informativo flotante. Un segundo toque fuera de la tarjeta la cierra con suavidad, evitando que los dedos del usuario bloqueen la lectura de la explicación.

---

## 3. Legibilidad del Texto en Modo Oscuro y OLED True Black
* **Contraste y Suavidad:** Las tarjetas emergentes de furigana y glosario utilizan un fondo translúcido cálido o gris oscuro profundo (`#1E1C1A`) con bordes de acento sutiles y texto en color crema claro (`#E6DFD5`), cumpliendo con holgura los estándares WCAG AA. 
* **Ausencia de Deslumbramiento:** Se evita por completo el uso de fondos blancos puros en los popovers para prevenir destellos molestos en habitaciones a oscuras.

---

## Conclusión
El popover de Furigana y Lore del Sprint 62 ofrece una herramienta pedagógica y narrativa de primer nivel, equilibrando la sutileza del hover en escritorio, la precisión del *tap-to-pin* en táctil y una legibilidad impecable en modo oscuro.
