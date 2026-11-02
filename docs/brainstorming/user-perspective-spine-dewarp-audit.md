# Auditoría UX: Motor de Aplanamiento y Corrección de Pliegues de Lomo (Spine Dewarping Engine) (Sprint 74)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la experiencia de lectura en tomos físicos escaneados donde el pliegue central del lomo (*spine shadow & curve*) distorsiona el texto y las ilustraciones.

---

## 1. El Fastidio del Lomo y la Sombra Central en Escaneos Físicos
Al leer tomos físicos escaneados (*tankōbon*), el pliegue central del libro genera dos problemas graves:
* **Pérdida de Texto:** Las letras situadas cerca del margen interior quedan atrapadas en la curvatura del papel o ensombrecidas, obligando al lector a forzar la vista para adivinar las palabras.
* **Deformación Geométrica:** Las líneas rectas de las viñetas se curvan hacia el centro, restando profesionalidad a la presentación visual.

---

## 2. Aplanamiento Sutil y Natural (Preservación de Proporciones)
* **El Peligro del Estiramiento Excesivo:** Un algoritmo de aplanamiento (*dewarping*) agresivo puede distorsionar las caras y los cuerpos de los personajes, haciéndolos lucir estirados o antinaturales.
* **La Solución Ergonómica:** El motor de aplanamiento de KuraScroll debe aplicar una corrección de perspectiva y brillo focalizada exclusivamente en la zona del lomo, compensando la curvatura y la sombra sin alterar las proporciones artísticas del resto de la página.

---

## 3. Control en el HUD y Exclusión Inteligente (Webtoons)
* **Detección Automática o Exclusión Manual:** Los webtoons coreanos son de formato digital nativo y no poseen lomo físico. Aplicarles un filtro de aplanamiento sería un error. 
* **Toggle en el HUD del Lector:** Un botón de acceso rápido en la barra flotante permite activar o desactivar el *Spine Dewarping* con un solo clic, permitiendo al usuario decidir cuándo necesita la corrección (manga escaneado) y cuándo no (webtoon / doujinshi digital).

---

## Conclusión
El motor de corrección de pliegues de lomo del Sprint 74 rescata la legibilidad de los escaneos físicos tradicionales, entregando una superficie plana y limpia sin sacrificar las proporciones artísticas ni molestar en formatos digitales nativos.
