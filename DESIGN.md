# DESIGN — Grocery Planner

Sistema de diseño del producto. Define cómo se ve y se siente la app.

Versión del documento: 1.2
Última actualización: 2026-08-07

---

## 1. Filosofía del diseño

**Simple. Plano. Elegante. Mínimo.**

La app debe sentirse como una libreta bien hecha de una familia: cálida, limpia
y sin ruido. Nada compite con la lista de compras; todo lo demás es decorado
discreto que ayuda a leerla.

Reglas de oro:

- **Plano total**: sin 3D, sin gradientes, sin sombras, sin relieve.
- **Sin bordes**: nada de líneas para separar; el espacio y el color separan.
- **Un color protagonista**: el verde. Todo lo demás es neutro (blanco/humo y gris suave).
- **Tipografía con carácter**: estilo **General Sans** — limpia, redonda, moderna y legible.
- **Aire**: el espacio en blanco es el mejor elemento de diseño.
- **Cada cosa para algo**: si un elemento no ayuda a comprar más rápido, no va.

---

## 2. Color

### 2.1 Verde (el protagonista)

Un verde **fresco, vivo pero suave**, que recuerde comida sana y naturaleza,
sin ser chillón. Sirve para todo lo importante: acciones, estado activo, "lo mío".

| Uso | Valor sugerido | Para qué |
|---|---|---|
| **Verde principal** | `#16A34A` (verde hoja) | Botones principales, links, marca, "ya lo llevo" |
| **Verde suave** | `#BBF7D0` (verde menta) | Fondos sutiles, estado activo de chips |
| **Verde intenso (apoyo)** | `#15803D` | Texto de éxito, estados destacados |

Reglas:
- El verde se usa con **moderación**: un elemento principal por pantalla.
- Nada de gradientes del verde; siempre un color **plano**.
- El verde significa "acción de compra": agregar, llevar, comprar, listo.

### 2.2 Neutros (el fondo)

La base es **blanco** y **tonos de humo/gris muy suave**. Texto en un gris
oscuro con matiz cálido (no negro puro, no azul frío).

| Uso | Valor sugerido (claro) | Valor sugerido (oscuro) |
|---|---|---|
| Fondo general | `#F8FAF9` (blanco-humo) | `#0C1510` (verde-negro, modo noche) |
| Tarjetas/superficies | `#FFFFFF` | `#16211A` |
| Texto principal | `#1C2B22` (verde-gris oscuro) | `#E6F0EA` |
| Texto secundario | `#6B7A70` (gris-verde) | `#9AA8A0` |
| Texto deshabilitado | `#B4BFB8` | `#5B6A61` |
| Fondo de "toque" | `#EEF4F0` (humo verde) | `#1F2D25` |

Reglas:
- El modo oscuro mantiene el mismo espíritu: fondos con **tinte verde profundo**, nunca gris neutro.
- Los neutros **nunca compiten** con el verde; el verde siempre gana.

### 2.3 Semáforo funcional (reducido a lo necesario)

| Color | Uso |
|---|---|
| **Ámbar** `#D97706` | Urgente, prioridad alta, "falta poco" |
| **Rojo suave** `#DC2626` | Errores, cancelar, "ya no hay" |
| **Azul gris** `#3B82F6` | Enlaces/chat, información (uso mínimo) |

Solo estos; sin colores decorativos sueltos. Si un color no comunica un estado, se usa neutro.

---

## 3. Tipografía

### 3.1 La familia tipográfica

Estilo **General Sans**: una geométrica moderna de palo seco, redondeada y
amable, con buena legibilidad en pantallas pequeñas. Alternativas reales del
mismo espíritu (miden de preferencia a igual): **Inter**, **Figtree**, **Sora**.

- **Titulares**: peso semibold o bold, con **tracking ligero** (espaciado levemente abierto).
- **Cuerpo**: peso regular, perfecta legibilidad.
- **Números/cantidades**: la misma familia, con soporte de **tablas numéricas**
  (los números alineados verticalmente).

### 3.2 Jerarquía (escala sugerida)

| Elemento | Tamaño | Peso | Nota |
|---|---|---|---|
| Título de pantalla | 28–32px | Semibold | Directo, sin adorno |
| Título de sección | 20px | Semibold | |
| Nombre de ítem | 16–17px | Medium | Lo más importante de la lista |
| Cantidad/unidad | 15px | Regular | Junto al nombre, en gris |
| Cuerpo / mensajes | 15px | Regular | |
| Etiquetas / chips | 13px | Medium | Mayúsculas solo en etiquetas cortas |
| Nota / metadato | 13px | Regular | Gris, pequeño |

Reglas:
- Una sola familia tipográfica; sin "fonts" de apoyo ni serif.
- El **nombre del ítem** es siempre lo más visible de una fila.
- Mayúsculas solo para etiquetas cortas ("FALTA", "LÍSTO"); nunca en texto largo.
- Sin texto sobre el verde si no hay contraste suficiente; sobre verde usar blanco.

---

## 4. Forma, espacio y superficie

### 4.1 Formas

- **Esquinas suavemente redondeadas** en todo (8–12px en tarjetas y botones;
  círculos completos en avatares e iconos de toque).
- Sin "bordes": los separadores se hacen con **color de fondo alterno** o espacio,
  nunca con líneas.
- Los elementos principales (botón grande de captura, chips de estado) son
  **redondeados de píldora** — amables, táctiles.

### 4.2 Espacio

- **Respirar es gratis**: la lista usa espaciado generoso entre ítems (los ítems
  no se pegan entre sí).
- Espaciado base en pasos de 4 (4, 8, 12, 16, 24, 32px).
- El contenido se centra en un ancho máximo cómodo (la app no se "estira" en
  pantallas gigantes; se queda en una columna legible).
- El ritmo de espaciado es **fluido por dispositivo**: más denso en celular
  (8–16px) y más aireado en tablet/desktop (16–32px). Detalle en §10.8.

### 4.3 Superficies (planas, sin sombra)

- Las tarjetas son **blancas sobre fondo humo** — la separación se logra por
  contraste de color, **no por sombra ni borde**.
- El elemento "levantado" (menú, chat) usa un tono ligeramente distinto del
  fondo y la píldora redondeada; jamás sombra.
- **Sin 3D**: nada de elevación falsa, nada de profundidad, nada de gradiente
  en fondos ni en botones.

---

## 5. Componentes principales (cómo se ven)

### 5.1 La fila de un ítem (el elemento más importante)

```
[avatar verde]  Pollo  ·  2 kg            [FALTA]
                pedido por María · hace 5 min
```

- **Checkbox redondeado** a la izquierda (verde suave relleno al marcarlo).
- **Nombre** arriba (gris oscuro), **metadatos** debajo (gris claro).
- **Chip de estado** a la derecha (píldora de fondo verde suave con texto verde).
- Al marcarse "ya lo llevo": la fila se vuelve **verde suave de fondo**, nombre
  en verde oscuro con un **tachado discreto**, y queda el check lleno.
- Toque en la fila = ver detalle. Deslizar = más opciones (editar, foto, cancelar).

### 5.2 Botones

| Tipo | Forma | Color |
|---|---|---|
| Primario (agregar, llevar, comprar) | Píldora rellena | Verde principal, texto blanco |
| Secundario | Píldora con fondo de toque (humo verde) | Texto verde oscuro |
| Silencioso | Solo texto | Gris |
| Peligro (cancelar) | Texto | Rojo suave |

- Botones **sin relieve**: color plano, sin sombra, sin gradiente.
- El botón **"Falta…"** (quiosco/captura rápida) es **grande y protagonista**:
  la píldora verde más ancha de la pantalla, con un signo `+`.

### 5.3 Chips y estados

Píldoras pequeñas de **fondo plano** con texto en el color correspondiente:

- FALTA → verde suave / texto verde.
- URGENTE → fondo ámbar suave / texto ámbar.
- PEDIDO POR X → fondo humo / texto gris-verde con el avatar mini de quien lleva.
- YA LO LLEVO → verde relleno suave con el check.
- COMPRADO → gris deshabilitado (la fila se opaca).

### 5.4 Avisos y mensajes

- Mensajes del sistema en el chat: **píldora de fondo humo** con icono discreto,
  texto gris — son informativos, no protagonizan.
- Mensajes de la familia: burbuja con **fondo blanco/humo**, esquinas
  redondeadas, texto gris oscuro. Sin sombra.

### 5.5 Avatares

- Círculos con la **foto de cada miembro**; si no hay foto, iniciales sobre fondo verde suave.
- Los avatares son la forma de decir "esto lo pidió X" / "lo lleva X".

---

## 6. Movimiento y respuesta (mínimo y con sentido)

- **Sin animaciones de adorno** (sin rebotes, sin zoom, sin transiciones de páginas).
- Movimientos **funcionales y breves**:
  - Al marcar "ya lo llevo": el check se rellena en ~150ms y la fila cambia de color.
  - Al tocar: un **destello de "toque"** (el fondo del elemento se aclara) para
    confirmar que sí se pulsó.
- Cambios en vivo (alguien más marcó algo) se reflejan **al instante y en silencio**
  — nada de popups interrumpiendo.

---

## 7. Iconografía

- Iconos de **trazo redondeado y amable** (estilo outline suave, 1.5–2px), nunca
  rellenos agresivos ni muy finos.
- Todos del mismo set, del mismo grosor, del mismo tamaño visual.
- El verde solo en iconos que representan una acción de compra; el resto gris.

---

## 8. Modo oscuro

- Mismo diseño, misma tipografía, mismas formas.
- Fondos **verde-negro** (`#0C1510`) con superficies un tono arriba.
- El verde principal **brilla un poco más** (`#4ADE80`) para mantener contraste.
- Se activa con la preferencia del dispositivo (y se puede forzar por familia).

---

## 9. Pautas por pantalla

### 9.1 La lista (el día a día)

- Solo lo esencial: título, filtro, botón "Falta…", y la lista.
- El **botón de captura rápida** fijo abajo a la derecha o abajo en el quiosco,
  grande, verde, en forma de píldora con `+ Falta…`.
- Los filtros como **chips horizontales deslizables** (Falta / Urgente / Llevo / Todas).
- La lista ordenada por prioridad por defecto: urgente arriba con su chip ámbar.

### 9.2 El mandado (celular, una mano)

- Contraste alto y botones grandes; el foco es **marcar "ya lo llevo"** con un pulgar.
- Resumen fijo arriba: "Llevas 3 de 9" con una **barra de progreso plana verde**.
- Vista "Lo mío": solo lo asignado a ti, en verde.

### 9.3 Chat

- Limpio, aireado, burbujas planas blancas/humo.
- Los mensajes del sistema se ven distintos (humo, centrados) para no confundirse
  con lo que escribió la familia.

### 9.4 Detalle de un ítem

- Foto grande arriba (si hay), luego nombre grande, luego cantidades y chips,
  luego el historial del ítem en una lista simple y cronológica.

### 9.5 La TV del salón (Android TV / smart TV)

- La TV es el **visor del hogar**: lista completa, quién lleva qué, resumen
  del mandado. Poco interactúa, todo se ve.
- Navegación con **D-pad** (flechas + Enter), sin gestos ni hover (§10.10).
- Foco que aterriza en lo importante y texto leíble desde el sofá (≥ 22px).
- El detalle de un ítem y el resumen del mandado viven en **paneles** a la
  derecha, no en páginas nuevas.

---

## 10. Ultra-responsive: una app para todos los dispositivos

La misma app, el mismo diseño, en celular Android/iPhone, tablet, quiosco,
laptop, PC de escritorio y **TV (Android TV / smart TV)**, en vertical o
horizontal, con o sin señal. No hay
"versión móvil" y "versión escritorio": hay **un sistema que se reordena solo**
según la pantalla.

Principios responsive:

- **Mobile-first**: se diseña primero para el teléfono en una mano y se
  enriquece hacia pantallas grandes; nunca se "reduce" una versión de escritorio.
- **Fluido, no saltos**: tamaños, espacios y columnas crecen con la pantalla
  usando unidades relativas y `clamp()`, en vez de fijarse por dispositivo.
- **Una sola fuente de verdad**: los tokens de espaciado, radio y tipografía son
  los mismos en todas las pantallas; lo que cambia es la **distribución**.
- **Prioridad por gesto**: cada pantalla define una acción principal; esa acción
  siempre está al alcance del pulgar o del cursor sin buscar.
- **Sin romper**: ningún ancho de ventana, orientación o modo oscuro rompe el
  layout; todo se reacomoda con gracia.

### 10.1 Puntos de ruptura (breakpoints)

Se definen por **ancho de la ventana** (no por "¿es celular?") porque la web se
ve en cualquier tamaño. Mobile-first: se empieza en el más pequeño y se agrega.

| Rango | Nombre | Experiencia |
|---|---|---|
| < 480px | **Teléfono compacto** | Una columna, nav inferior, todo con una mano. |
| 480–767px | **Teléfono grande** | Una columna; captura rápida flotante; filtros siempre visibles. |
| 768–1023px | **Tablet vertical** | Dos columnas: lista principal + panel de detalle; nav superior. |
| 1024–1279px | **Tablet horizontal / laptop** | Tres columnas posibles; lista + chat + detalle lado a lado. |
| 1280–1919px | **Desktop** | Layout completo, multi-columna, nav lateral. |
| ≥ 1920px | **Pantallas grandes** | Columnas más anchas pero **contenido nunca ultra-estirado**: se mantiene un ancho máximo de lectura cómodo por columna (~720px). |

Reglas:

- Rupturas por `min-width` (progresivas), no por dispositivo específico.
- El contenido se centra con margen fluido; en pantallas muy anchas las
  columnas extra llenan el espacio sobrante, no la columna de texto.
- La TV se detecta **no por ancho** (una TV y un monitor 4K comparten tamaño)
  sino por **modo de entrada**: si hay D-pad/remoto y no hay toque ni cursor,
  se activa el modo 10-foot (§10.10).

### 10.2 Orientación (vertical y horizontal)

| Dispositivo | Vertical (retrato) | Horizontal (landscape) |
|---|---|---|
| Teléfono | Una columna; nav inferior; captura flotante abajo. | Nav se compacta a píldoras; la captura flotante pasa a ser un botón fijo más discreto; la lista aprovecha el alto. |
| Tablet | Dos columnas; nav superior. | Tres columnas; nav superior; listas más densas por el alto disponible. |
| Desktop/web | — | Multi-columna estable; el alto ya no es limitante. |
| TV / smart TV | No aplica (siempre horizontal). | **Modo 10-foot**: foco por control remoto (D-pad), sin gestos ni hover, texto grande leíble a distancia (§10.11). |

Reglas:

- En horizontal de teléfono el **alto es limitado**: se prioriza la lista por
  encima de cabeceras decorativas; los títulos se compactan.
- En horizontal siempre se mantienen la acción principal y el resumen del
  mandado visibles (barra fija compacta).
- En tablet horizontal el detalle puede vivir en un **panel lateral** en vez de
  empujar la lista a otra página.
- La **TV nunca se trata como un celular gigante**: cambia el modo de entrada
  (remoto con D-pad), no solo el tamaño de la pantalla (§10.11).

### 10.3 Zona de pulgar y ergonomía táctil

- En teléfono, las acciones frecuentes viven en la **mitad inferior** de la
  pantalla (la zona natural del pulgar derecho/izquierdo).
- El botón **"Falta…"** siempre está fijo, flotante y al alcance del pulgar.
- **Zonas táctiles ≥ 44–48px** en todo control tocable; en celular se prefieren
  48px+. Sin excepciones en acciones frecuentes.
- La separación entre objetivos táctiles ≥ 8px para evitar toques equivocados.
- En tablet/desktop el cursor permite controles más compactos, pero los
  botones principales conservan tamaño generoso.
- **Modos de entrada**: no todo se toca. La app soporta **toque** (celular,
  tablet, quiosco), **cursor/teclado** (desktop, web) y **foco con D-pad**
  (TV, controles por flechas). Todo lo alcanzable con un dedo lo es también con
  las flechas y con Tab; nada depende solo de hover o de gesto táctil (§10.11).
- En TV el "pulgar" es el **foco del control remoto**: los elementos enfocables
  son grandes, el foco se mueve por flechas y se confirma con Enter.

### 10.4 Safe areas y notches

En celulares con notch, barra de gestos o esquinas redondeadas (y en ventanas
con bordes redondeados de escritorio) el contenido debe respetar las zonas
seguras:

- Todo el padding de borde incluye `env(safe-area-inset-*)` (arriba, abajo,
  izquierda, derecha).
- La **nav inferior** y el **botón flotante** suben por encima de la barra de
  gestos inferior.
- En horizontal, los insets laterales evitan que la nav/scroll choque con el
  notch o la isla.
- La barra superior (estado del sistema) nunca se tapa con contenido.

### 10.5 Navegación según dispositivo

| Dispositivo | Patrón de navegación |
|---|---|
| Teléfono | **Nav inferior fija** (Inicio, Mandado, Chat, Mío, Familia, Ajustes) — al alcance del pulgar. Reglas viven dentro de la sección Familia. |
| Tablet vertical | Nav superior compacta con los mismos destinos + filtros en chips. |
| Tablet horizontal / laptop | Nav superior o lateral compacta; listas secundarias en paneles. |
| Desktop | **Nav lateral** fija (columna izquierda) + contenido central; opciones secundarias en paneles. |
| TV / smart TV | **Nav lateral grande** con foco por D-pad; los destinos se recorren con flechas y Enter, nunca con gestos. |
| Quiosco / host | Sin nav: pantalla de host siempre fija en la lista, con el botón "Falta…" gigante. |

- El **patrón cambia de lugar, no de contenido**: los mismos destinos existen en
  todas las pantallas.
- En celular, el detalle de ítem, el chat y el historial son **páginas empujadas**
  (con botón atrás); en pantallas grandes pasan a ser **paneles laterales**.
- En TV no hay "páginas empujadas": todo es navegación por foco dentro de una
  misma vista, con el botón atrás del remoto como vía de escape.

### 10.6 Grid adaptable

- **Teléfono**: 1 columna. La fila de ítem ocupa todo el ancho.
- **Tablet vertical**: 2 columnas (lista + detalle) con la lista al 40–50%.
- **Tablet horizontal / laptop**: hasta 3 columnas (lista + detalle + chat).
- **Desktop**: 3 columnas y panel de navegación lateral; la lista puede
  expandirse hasta un máximo cómodo.
- **TV**: 1 columna principal ancha para la lista (filas grandes) + panel
  lateral de detalle; el foco se mueve entre los dos paneles con flechas.
- El **quiosco** usa 1–2 columnas según orientación, siempre con el botón
  principal gigante.

### 10.7 Tipografía fluida

- El cuerpo base escala con la pantalla vía `clamp()`: **15px en teléfono →
  17px en desktop** (nunca menos de 14px en teléfono para no sacrificar lectura).
- Títulos también fluyen (ej. título de pantalla 28px → 34px) pero **el nombre
  del ítem y las cantidades se mantienen en una talla estable** para que la
  lista se lea igual de rápido en cualquier dispositivo.
- En quiosco (pantalla a distancia) la tipografía sube un escalón más (32–40px
  en lo principal).
- En **TV** (aún más lejos que el quiosco) sube otro escalón: cuerpo ≥ 22px y
  el nombre de ítem 28–32px; los chips y etiquetas nunca bajan de 18px para
  leerse desde el sofá.

### 10.8 Espaciado y densidad fluidos

- Los **gaps y paddings usan unidades relativas** (`clamp()` o escala), no px
  fijos por dispositivo.
- Teléfono: ritmo denso (8–16px) para que más contenido quepa en el alto.
- Tablet/desktop: más aire (16–32px); el contenido no se pega a los bordes.
- El **quiosco** usa aire aún mayor por ser una pantalla lejana.
- Densidad de la lista: en celular las filas son más altas (48px+); en desktop
  pueden ser más compactas manteniendo el mínimo táctil.

### 10.9 Ventana de escritorio y escala del sistema

- **Redimensionar la ventana** reacomoda el layout en vivo (los mismos
  breakpoints aplican al ancho de ventana, no solo a "pantallas de dispositivo").
- **Zoom del sistema / accesibilidad**: el diseño aguanta hasta 200% de zoom
  sin cortes ni solapamientos; el texto no se trunca en ningún breakpoint.
- En pantallas muy grandes el contenido no se "estira": columnas de ancho
  máximo cómodo, centradas, con aire.

### 10.10 Modo 10-foot: Android TV / smart TV

La TV no es un celular gigante: se ve a **2–4 metros**, se maneja con un
**control remoto (D-pad)** y no tiene gestos, hover ni teclado físico. Reglas
propias:

**Foco por D-pad**
- El control enfocable es **grande** (≥ 48px, en TV se prefiere 56–64px).
- El elemento con foco se resalta con el **fondo verde suave + borde "falso"**
  por color (sin línea, sin sombra): píldora rellena `--gp-mint` con texto
  verde oscuro, como el estado activo de los chips.
- El foco se mueve con las **flechas** (arriba/abajo/izquierda/derecha) y se
  confirma con **Enter/OK**; el botón **Atrás** del remoto siempre existe.
- **Sin drag & drop ni deslizar**: el orden manual en TV usa botones explícitos
  ("subir", "bajar", "mover") en vez de arrastrar.
- Al abrir la app, el foco aterriza en la **acción principal** (el botón
  "Falta…"), nunca en un punto muerto.

**Lectura a distancia**
- Título de pantalla 40–48px; nombre de ítem 28–32px; cuerpo ≥ 22px
  (§10.7). El contraste se mantiene AA, sin bajar de ese tamaño.
- Las filas de la lista son **altas (≥ 72px)** y con mucho aire, para escanear
  con los ojos desde el sofá.

**Interacción mínima y en vivo**
- La TV es un **visor** del hogar: se usa para ver la lista, ver quién lleva
  qué, y (si hay micrófono) pedir "falta pollo" por voz.
- Los cambios en vivo se reflejan igual de silenciosos que en el celular (§6);
  la TV nunca interrumpe con popups.

**Bordes y sobrescan**
- Mantener márgenes seguros de ~32–48px en los bordes: algunos TVs recortan el
  borde (sobrescan). El contenido crítico nunca vive pegado al marco.

**Modo oscuro**
- La TV **empieza en modo oscuro por defecto** (el salón suele ser oscuro),
  respetando la preferencia del sistema cuando la hay.

### 10.11 Checklist de validación por pantalla

Cada cambio de UI se valida en:

1. Teléfono compacto vertical (360×640) y horizontal (640×360).
2. Teléfono grande (390–430px).
3. Tablet vertical (768–834px) y horizontal (1024–1112px).
4. Laptop (1280–1440px) y desktop grande (1920px+).
5. TV / smart TV (1920×1080, modo 10-foot).
6. Modo oscuro en cada uno de los anteriores.
7. Zoom al 200% y tipografía del sistema en grande.
8. Con y sin barra de gestos / notch (simulado en emulador o devtools).
9. Navegación completa **solo con teclado** (Tab + Enter) y **solo con D-pad**
   (TV): no puede haber funciones que exijan mouse o gesto táctil.

---

## 11. Lo que NO se hace (anti-pautas)

- ❌ Gradientes (de ningún color, en ningún fondo).
- ❌ Sombras (ni suaves ni duras).
- ❌ Bordes/líneas para separar contenido.
- ❌ 3D, relieve, "elevación", esqueumorfismo (maderas, metal, brillos).
- ❌ Más de un color de marca.
- ❌ Animaciones decorativas o excesivas.
- ❌ Texto sobre fondo verde con contraste insuficiente.
- ❌ Fuentes serif, manuscritas o display llamativas.
- ❌ Íconos de varios estilos mezclados.
- ❌ Layout que se rompe al redimensionar la ventana o cambiar de orientación.
- ❌ Zonas táctiles < 44px (o < 48px en acciones frecuentes).
- ❌ Nav/acciones fuera del alcance del pulgar en celular (ocultas, en esquinas altas).
- ❌ Contenido tapado por notch, barra de gestos o esquinas redondeadas.
- ❌ Texto que se corta o se trunca en pantallas pequeñas o con zoom alto.
- ❌ Tratar la TV como un celular gigante (toque/hover en vez de foco D-pad).
- ❌ Funciones que solo funcionan con mouse, touch o gesto (sin alternativa por teclado/D-pad).
- ❌ Drag & drop como única vía de ordenar en TV.
- ❌ Foco invisible o imposible de mover con flechas.
- ❌ Contenido crítico pegado al borde en TV (sobrescan).

---

## 12. Tono de los textos

- **Cercano y breve**: "¿Qué falta en casa?", "¡Listo, llegó el pollo!".
- Frases de acción en segunda persona, sin burocracia ("Agregar pollo", no "Registro de ítem").
- Tú y no usted. Familia, no organización.

---

## 13. Ejemplo de "sensación"

> Abres la app. Fondo blanco-humo, mucho aire. Arriba dice **"¿Qué falta?"** en
> letra clara. Un botón verde en forma de píldora: **`+ Falta…`**. Tocas, escribes
> "pollo 2kg", un toque más y la fila aparece: pollo con su chip verde "FALTA".
> Tu hermana en el super lo marca "ya lo llevo"; la fila se pinta de menta con un
> check. Sin líneas, sin sombras, sin ruido. Así debe sentirse siempre.

---

## 14. Notas técnicas de diseño (para cuando se implemente)

- Paleta completa y tokens (colores, espaciado, radios, pesos) se definirán como
  variables del sistema de diseño (CSS custom properties).
- La fuente General Sans se puede usar desde su CDN oficial o descargarse;
  de preferencia con las variantes Regular, Medium, Semibold y Bold.
- Accesibilidad: contraste AA en texto sobre fondo; zonas táctiles ≥ 44px.
- El modo oscuro sigue la preferencia del sistema operativo.
- Responsive se implementa **mobile-first** con breakpoints `min-width`
  (480 / 768 / 1024 / 1280), tipografía fluida con `clamp()`, unidades relativas
  para espaciado y `env(safe-area-inset-*)` para las zonas seguras (ver §10).
- **Android TV / smart TV** se detecta aparte y activa el **modo 10-foot**
  (foco por D-pad, sin hover/gestos, tipografía a distancia, nav lateral,
  sobrescan) — ver §10.10.
