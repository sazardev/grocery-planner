# SPEC — Grocery Planner

Planeador de compras para una familia. Documento de producto y lógica de negocio.

Versión del documento: 2.0
Última actualización: 2026-08-07

---

## 1. Visión

Un solo sistema **self-hosted** que vive en un PC de la familia. Desde cualquier
dispositivo —celular, tablet, laptop, PC de casa— cualquiera de la familia entra
a la misma lista de compras y colabora en tiempo real.

Pensado para el día a día real:

- **Uno en casa** (checa la despensa y pide lo que falta).
- **Otro en el mandado** (ve la lista y va marcando lo que ya lleva).
- **Ambos en el mandado** (se reparten pasillos y no se duplican).
- **La abuela** quiere avisar que el domingo comen todos en su casa y hay que
  comprar para 12 personas.

La lista de compras es el corazón, pero alrededor gira **toda la vida de la
familia**: cuenta de cada miembro, un hogar compartido al que se entra por
invitación, historia de lo que se compra, **planes de compra** (cuándo se va a
comprar y qué va a faltar en X días), un **calendario familiar** con eventos y
ocasiones (cumpleaños, uniones, desayunos), fotos, comentarios a la comida y a
las solicitudes, y un mini chat.

Principios que rigen todo:

- **Velocidad sobre estética**: agregar una falta debe tomar menos de 5 segundos.
- **Cero fricción para la familia**: nadie tiene que "aprender" la app; se usa
  como un mensaje de WhatsApp.
- **Nada se pierde**: cada acción queda en el historial y se puede revertir.
- **Planear para no improvisar**: la app no solo dice qué falta hoy, sino qué va
  a faltar en X días y cuándo conviene ir al mandado.
- **Todo en español y para todos**: chicos, abuelos y tecnología poco familiar.

---

## 2. Cuentas, usuarios y autenticación

### 2.1 La cuenta

Cada persona tiene **una cuenta** con:

- **Nombre** (ej. "María", "Papá").
- **Avatar** (foto o iniciales; si no sube foto, se genera un color/avatar con inicial).
- **Alias** opcional (ej. "la mamá de Ana") para que los chicos la reconozcan.
- **Contraseña** (encriptada; nunca se guarda en claro).
- **Zona horaria** del hogar (para fechas, horas y notificaciones).

Una cuenta puede estar en **un hogar** en esta fase (ver §3.6 multi-hogar).

### 2.2 Registro

- **Crear hogar nuevo**: el primer usuario crea su cuenta y su hogar; queda como
  **Admin del hogar**.
- **Unirse por invitación**: si ya tiene cuenta, acepta un enlace/código de
  invitación y queda dentro del hogar con el rol que le tocó.

### 2.3 Métodos de acceso

Combinables y configurables por el Admin:

| Método | Cómo funciona |
|---|---|
| **Usuario + contraseña** | Mínimo para todos los hogares. Sesión con token seguro y expiración. |
| **Huella / Face ID** | Solo en los dispositivos personales de cada miembro. La biometría **nunca viaja al servidor**: es una llave local que desbloquea una sesión ya iniciada. |
| **Modo host / quiosco** | Pantalla fija de la casa (tablet de cocina, PC) que entra "dentro" sin credenciales. Se pausa si hay visita. |
| **PIN rápido** | Opcional: un PIN de 4 dígitos por hogar/miembro para entrar rápido desde un dispositivo conocido. |

### 2.4 Sesiones

- Una persona puede tener **varias sesiones activas** (celular, tablet, web).
- Se ve **dónde están conectados** los miembros (dispositivo y hora de último uso).
- El miembro (o el Admin) puede **cerrar sesiones remotas** si perdió el celular.

### 2.5 Recuperación

Como el sistema es self-hosted (sin correos obligatorios), la recuperación usa:

- **Clave de respaldo** del hogar: el Admin genera una clave; con ella se recupera
  la cuenta de cualquier miembro.
- **Regenerar contraseña por un Organizador** cuando no hay clave.

---

## 3. Hogares, familias y unión

### 3.1 El hogar

Un **hogar = una familia = una sola lista de compras compartida** + su calendario
y su chat. El hogar tiene:

- **Nombre** (ej. "Los Ramírez").
- **Reglas** configuradas por el Organizador (ver §14).
- **Miembros** con roles (ver §3.2).
- **Invitation** (enlace + QR + código) para sumar gente.

### 3.2 Roles

| Rol | Qué puede hacer |
|---|---|
| **Miembro** | Agregar/editar/borrar cosas de la lista, subir fotos, chatear, comentar, marcar compras, ver historial, ver calendario y crear eventos. |
| **Organizador** | Todo lo de Miembro + reorganizar/seccionar la lista, crear/quitar categorías, planear compras, invitar/quitar miembros, ajustar reglas (nombre, límites, notificaciones). |
| **Admin del hogar** | Lo mismo que Organizador + administrar quién entra al sistema (enlaces de invitación, expulsión, cambio de roles, clave de respaldo). |

### 3.3 Invitaciones y enlaces para compartir

El corazón para sumar a la familia es **compartir el acceso fácilmente**:

- **Enlace de invitación**: un link único (ej. `https://casa:8787/join#TOKEN`).
  Se comparte por WhatsApp, mensaje o QR.
- **Código QR**: para escanear con el celular y entrar en un toque.
- **Código corto**: 6 dígitos (ej. `492-113`) que se dicta por teléfono a la
  abuela.
- Configuración del enlace (por el Admin):
  - **Caducidad** (24 h, 7 días, nunca).
  - **Límite de usos** (una persona, 5, ilimitado).
  - **Rol que otorga** al aceptar (Miembro por defecto).
  - **Revocar** en cualquier momento (los enlaces viejos dejan de servir).

### 3.4 Unión de familias

Escenarios reales:

- **Alguien se suma**: hijo se casa, nuera entra → acepta el enlace y ya está.
- **Dos hogares se fusionan**: una familia entera se une a la otra. El Admin
  puede **fusionar la lista** (se suman los ítems pendientes, se conservan los
  historiales) o **adoptar** solo a las personas.
- **Mudanza / divorcio**: se puede crear un hogar nuevo y que cada miembro
  elija a cuál quedarse (los historiales de cada quien se conservan).

### 3.5 Gestión de miembros

- Lista de miembros con rol, avatar, última conexión y si está "en el mandado".
- **Expulsión** (solo Admin) y **cambio de rol**.
- **Silenciar** temporalmente a un miembro (deja de recibir notificaciones, no
  se le quitan permisos).
- Cada miembro ve **quién está conectado ahora** (presencia en tiempo real, ver §12).

### 3.6 Multi-hogar (fase futura)

El modelo inicial es **una cuenta = un hogar**. Que una persona viva en dos
familias a la vez queda fuera de alcance (ver §17).

---

## 4. La lista de compras (el corazón)

### 4.1 El ítem de la lista

Cada cosa que se anota es un **ítem**. Un ítem tiene:

- **Nombre** (ej. "pollo", "leche", "escobas").
- **Cantidad** (ej. 2 kilos, 1 bolsa, 3 piezas).
- **Unidad** (kg, g, l, pieza, bolsa, docena, paquete, tarro…).
- **Categoría** (frutas, carnes, lácteos, limpieza, hogar, farmacia, despensa…).
- **Prioridad** (baja / media / alta / urgente).
- **Nota** (ej. "pechugas, no muslos", "la marca que nos gusta").
- **Foto(s)** opcionales (despensa, empaque exacto, recibo).
- **Quién lo pidió** (el miembro que lo agregó).
- **Estado** (ver §4.3).
- **Asignado a** (opcional, ver §6).
- **Tienda y pasillo** (opcional): dónde se consigue.
- **Precio aproximado** (opcional): para reportes de gasto.
- **Cadencia de repetición** (opcional): "cada 3 días", "cada semana" — el
  sistema la aprende del historial (ver §7).
- **Fechas clave**: cuándo se pidió, cuándo se compró, cuándo "se acaba" (ver §7.3).
- **Comentarios** (ver §11.3): lo que la familia opina de ese producto.
- **Historial**: todo lo que le pasó a ese ítem con fecha, hora y quién lo hizo.

### 4.2 Cómo se agrega un ítem (rápido y en un toque)

- **Agregar por texto libre**: escribes "pollo 2kg" y el sistema sugiere la
  categoría, unidad y cantidad basándose en cómo lo ha escrito la familia antes.
- **Sugerencias inteligentes**: al empezar a escribir, sugiere ítems que la
  familia ya ha comprado (aprende de su historial y de su cadencia).
- **Botón rápido "Falta…"**: desde la pantalla de host, un toque abre la captura
  y agrega sin fricción.
- **Repetir del historial**: "agregar igual que la semana pasada" (ver §8).
- **Por foto**: subes la foto de la alacena vacía o de un recibo y la asocias al ítem.
- **Por voz** (opcional): "agrega leche" dictado en el quiosco de cocina.
- **Por evento**: un evento del calendario genera su lista (ver §9.4).
- **Por proyección**: el sistema avisa "según lo que consumen, en 2 días faltará
  leche" y la agregas con un toque (ver §7.3).

### 4.3 Estados de un ítem (el ciclo de vida)

| Estado | Significado | Quién lo cambia |
|---|---|---|
| **Falta** (pendiente) | Hace falta, nadie lo ha tomado aún. | Cualquiera al agregarlo. |
| **Pedido / "voy por él"** | Alguien ya se comprometió a comprarlo en el mandado. | El miembro que lo toma. |
| **Ya lo llevo / en el carrito** | El que está en el mandado lo metió al carrito. | El que está comprando. |
| **Comprado** | Pagado y/o llegó a casa. | El que compra o el de la casa al recibirlo. |
| **Cancelado** | Se quita porque ya no se necesita (con motivo opcional). | Cualquiera. |

> **Nota de implementación (fase 1)**: la lista incluye 5 estados. El estado
> intermedio **"En la lista"** del borrador original se fusionó con
> "Falta/pedido" para mantener el flujo simple; un ítem que ya fue confirmado
> para el mandado se ve como "Pedido" o asignado a alguien. DATA.md y el
> código (`ItemStatus`) son la autoridad de fase 1.

Reglas de estado:

- Un ítem **"Pedido"** por alguien muestra quién lo lleva; los demás lo ven con
  su nombre y ya no lo agregan de nuevo.
- El que va al mandado **marca "ya lo llevo"** y eso queda registrado; al terminar
  marca "comprado" (por ítem o de golpe "todo lo que marqué está comprado").
- Si alguien en casa ve que **ya hay pollo** en la refri, puede cancelar el ítem
  y avisar en el chat automáticamente.
- Un ítem comprado no se puede volver a "falta" sin pasarlo por "pendiente" otra vez.

### 4.4 Flexibilidad, orden y secciones

- La lista se puede ver **ordenada** por: prioridad, categoría, pasillo, tienda,
  fecha en que se agregó, quién la pidió, o precio.
- **Orden manual**: el Organizador puede arrastrar los ítems para fijar un orden
  personalizado ("esto primero en la tienda").
- **Secciones**: la lista se puede dividir en secciones nombradas y arrastrables
  (ej. "Desayunos", "Carnes", "Limpieza", "Para el domingo"). Un ítem pertenece a
  una sección.
- **Pendientes de solo lectura**: cualquiera puede consultar, pero solo el dueño
  del ítem o el Organizador pueden editar el orden ajeno.

### 4.5 Búsqueda y filtros

- **Búsqueda instantánea** sobre nombre, nota, categoría, marca y quién lo pidió.
- **Filtros combinables**:
  - Por estado (falta / pedido / comprado…).
  - Por categoría.
  - Por prioridad.
  - Por sección.
  - Por miembro (lo que pidió X / lo que lleva Y).
  - Por asignado.
  - Por tienda.
  - Por rango de fechas y **ventanas de tiempo**: hoy, esta semana, este mes,
    este año, los últimos 7/30 días.
  - Por "lo que me toca a mí".
  - Solo "con foto".
  - Solo "con comentarios".
  - Solo "de este evento" (ver §9.4).
  - Solo "urgente".

### 4.6 Comentarios a la comida y a las solicitudes

Cada ítem puede recibir **comentarios** de la familia, ligados a su historial
(ver §11.3):

- Sobre la **comida**: "esta marca de canela es la buena", "no compres la leche
  entera, la de deslactosada nos cae mejor".
- Sobre la **solicitud**: "¿2 kg es para la semana o para el pastel?", "yo prefiero
  el arroz integral".
- El comentario queda en el historial del ítem y se ve la próxima vez que se pida.

---

## 5. Modos de uso según la situación

### 5.1 Alguien en casa, otro en el mandado (caso típico)

1. En casa se anotan las faltas ("falta pollo", "2kg de arroz", foto de la despensa).
2. El que va al mandado abre la lista desde su teléfono.
3. Toma los ítems ("voy por estos"), o el de la casa se los **asigna** (ver §6).
4. En la tienda va marcando **"ya lo llevo"** ítem por ítem; se va actualizando
   en el celular de quien está en casa en tiempo real.
5. Si algo no hay, el de la tienda lo marca y escribe en el chat "no había
   canela, ¿la compro de otra marca?".
6. Al pagar marca todo como **comprado**. La lista queda limpia y el historial guardado.

### 5.2 Ambos en el mandado

- La lista en vivo en ambos teléfonos. Cuando uno marca "ya lo llevo", el otro
  lo ve al instante y **no se duplica**.
- Se pueden **repartir pasillos/categorías** ("yo llevo carnes, tú lácteos").
- Cada quien ve su resumen de lo que lleva para no perderse.

### 5.3 Mandado para algo puntual (fiesta, comida del domingo)

- El Organizador puede crear **una lista de evento separada** (ej. "BBQ domingo")
  y al final fusionarla o desecharla.
- Las listas de evento no ensucian el historial del hogar a menos que se fusionen.

### 5.4 Varias tiendas

- Se puede indicar en qué tienda se hará el mandado (opcional).
- Si hay ítems que solo se consiguen en un lugar (ej. frutería aparte),
  el filtro "por tienda" ayuda a repartirlos.
- Cada tienda puede tener **pasillos** configurados (ver §14).

---

## 6. Asignación y reparto de tareas

- **Asignar ítems**: el de la casa puede asignar "tú llevas esto" a un miembro
  que irá al mandado. El asignado lo ve destacado y le llega un aviso.
- **Asignar mandados enteros**: "el mandado de mañana es de Ana".
- **Retomar**: si alguien no puede ir, pasa el mandado o los ítems a otro con
  un toque.
- Cada miembro tiene una vista **"Lo mío"**: todo lo que debe comprar hoy,
  agrupado por tienda y pasillo.
- Quién está en casa puede **confirmar recepción**: cuando llega el mandado,
  marca "recibido" y el que compró recibe su reconocimiento (y la familia sabe
  que el pollo ya está en la refri).

---

## 7. Planificación y tiempos (planear la compra)

### 7.1 Planes de compra

Un **plan de compra** responde: *¿cuándo vamos a comprar, a dónde, y quién?*

- Crear un plan: **día y hora** (ej. sábado 9:00), **tienda**, **asignado a**,
  **lista asociada** (la lista activa o una de evento).
- El plan aparece en el calendario familiar y se muestra como recordatorio.
- "Citar tiempos": se puede **fijar** un plan para una hora exacta (ej. "salimos
  a las 10:00") y el sistema avisa "el mandado es en 30 minutos".
- **Planes recurrentes**: compra semanal, quincenal o mensual en automático
  (ej. "mandado grande cada sábado").
- **Ventana sugerida**: el sistema detecta los horarios en que la familia suele
  comprar y sugiere el mejor momento.

### 7.2 ¿Qué faltará para X días?

Con base en el **historial y la cadencia de consumo** (ver §8), el sistema
proyecta:

- "Según lo que consumen, **en 2 días faltará leche**".
- "Esta semana va a faltar: leche, pan, fruta" (resumen del domingo).
- "El plan del sábado debería incluir pollo porque se acaba el jueves".

La familia **confirma o descarta** la sugerencia con un toque; lo confirmado
entra a la lista del próximo plan.

### 7.3 Cadencias y fechas

- El sistema aprende **cada cuánto** se compra un producto (de su historial) y
  guarda esa **cadencia** (ej. leche = 3 días, pañales = 1 semana).
- Un ítem puede tener una **fecha estimada de "se acaba"**; al acercarse, se
  vuelve a sugerir.
- Ventanas de consulta por **días, horas, semana, mes y año**: "lo que se pidió
  hoy", "lo que se compra esta semana", "lo que gastamos este mes".

---

## 8. Historial total y calendario histórico

Todo queda registrado. **Nada se borra de verdad.**

### 8.1 Qué se registra

- Cada ítem comprado con: fecha, tienda (si se dijo), quién lo pidió, quién lo
  compró, precio aproximado (opcional), cantidad y fotos.
- Cada cambio de estado, edición, asignación, cancelación, comentario o
  reacción, con quién y cuándo.
- Cada mandado (plan de compra): quién lo hizo, a dónde, qué llevó, cuándo llegó.

### 8.2 Cómo se usa

- **Ver historia por ítem**: "cada cuánto compramos leche / pollo" y a qué precio.
- **Repetir compra**: un botón "comprar lo mismo de la semana pasada" recrea la
  lista de ese día (se puede editar antes de confirmar).
- **Reportes simples para la familia**:
  - Lo que más compramos (top de productos).
  - Cuánto gastamos por semana/mes/año (si registran precio).
  - Cuántos mandados hizo cada quien (para repartir equitativo).
- **Recuperación**: un ítem cancelado por error se puede "traer de vuelta" desde
  el historial.

### 8.3 Calendario histórico

- Una **línea de tiempo** con todo lo que pasó: compras, mandados, eventos,
  comentarios y cambios.
- Navegación por **día, semana, mes y año**.
- Sirve para responder "¿qué compramos para la cena del año pasado?" o "¿cuándo
  fue la última vez que invitaron a la familia?".

---

## 9. Eventos, ocasiones y calendario familiar

### 9.1 Tipos de eventos

| Tipo | Ejemplo |
|---|---|
| **Cumpleaños** | Cumple de Ana (recurrente cada año). |
| **Unión / aniversario** | Boda de los papás, aniversario de X. |
| **Desayuno / comida familiar** | Desayuno del domingo, comida de Navidad. |
| **Celebración** | Año Nuevo, posadas, San Juan, graduación. |
| **Reunión / visita** | Viene la abuela, cena con amigos. |
| **Mandado / plan** | El mandado del sábado (ver §7). |

### 9.2 El evento

Un evento tiene:

- **Nombre**, **fecha** y **hora** (o "todo el día").
- **Tipo** (ver §9.1).
- **Lugar** (opcional).
- **Participantes** (miembros del hogar; opcional: "invitados" sin cuenta).
- **Nota** (ej. "llevar pastel, esconder regalo").
- **Recurrencia**: los cumpleaños y aniversarios se repiten cada año en automático.
- **Recordatorio**: avisar X días/horas antes (configurable).

### 9.3 Calendario familiar

- Vista **día / semana / mes / año** de todo lo que pasa en el hogar: eventos,
  mandados, planes de compra.
- Lo que se compra y lo que se celebra viven en el mismo calendario.
- Cada evento se puede **ver, editar, mover o borrar** según el rol.

### 9.4 El evento genera su lista

- Al crear un evento se puede generar **su lista de compras** ("BBQ domingo").
- Esa lista es separada; al final se **fusiona** al historial del hogar o se **descarta**.
- Los ítems de un evento se marcan como "de este evento" y se pueden filtrar.

### 9.5 Calendario histórico (unión de §8.3 y §9)

El calendario es **pasado y futuro** a la vez: lo que ya pasó (compras, eventos)
y lo que viene (planes, cumpleaños). Todo navegable por día/semana/mes/año.

---

## 10. Fotos e imágenes

- Cada ítem puede tener **una o varias fotos**.
- Dónde se usan:
  - Foto de la **despensa/alacena** para mostrar qué falta.
  - Foto del **producto exacto** (la marca que quieren, la talla de pañal).
  - Foto del **recibo** al comprar (para llevar el gasto).
- La lista tiene un filtro **"ver solo lo que tiene foto"**.
- Hay una vista **galería del mandado**: el que compra va subiendo fotos en
  vivo y los de casa ven "lo que hay / lo que ya agarró".
- En el **chat** se pueden mandar fotos (ver §11).
- Límite de fotos por ítem configurable (ver §14) para ahorrar espacio.

---

## 11. Chat, comentarios y comunicación

### 11.1 Chat del hogar

- Chat compartido del hogar para hablar del mandado, la despensa, lo que sobra.
- Mensajes con **texto, fotos y emojis**.
- **Menciones**: `@María` avisa a esa persona (ver §13).
- **Reacciones**: 👍, ❤️, 😂… en cualquier mensaje.
- Mensajes importantes se pueden **fijar** arriba del chat.

### 11.2 Mensajes del sistema (anclados a la lista)

Ciertos eventos entran solos al chat como mensajes del sistema, ej.:

- "María agregó: pollo 2kg".
- "Juan marcó como comprado: leche".
- "No había canela, Juan pregunta si la compra de otra marca".
- "El mandado llegó y Ana lo recibió".
- "Mañana es el cumple de Ana 🎂".

### 11.3 Comentarios a la comida y a las solicitudes

- **Citar un ítem**: se puede mandar un mensaje "acerca del pollo" para que
  quede ligado a ese ítem y se vea en su historial.
- **Comentarios de comida**: opiniones de un producto que quedan guardadas en su
  historial ("esta canela es la buena").
- **Comentarios de solicitudes**: aclaraciones sobre una petición ("quiero el
  arroz integral, no el blanco").
- Cada ítem muestra cuántos comentarios tiene; se abren en su propio hilo.

### 11.4 Presencia

- Se ve **quién está conectado** ahora (presencia en tiempo real, ver §12).

---

## 12. Presencia en tiempo real

- Cada miembro conectado aparece en el chat, en la lista y en el calendario.
- Estados: **en línea**, **hace X min**, **desconectado**, **en el mandado**.
- La presencia se basa en latidos (heartbeat) del dispositivo; si un dispositivo
  no responde en ~30 segundos, se marca como "hace X min".
- En el quiosco de casa se ve quién está conectado en grande, para no duplicar
  el mandado.

---

## 13. Notificaciones

Cada miembro configura sus avisos (por app/el sistema, sin correos):

- Cuando alguien lo **asigna** a algo.
- Cuando alguien pide algo **urgente**.
- Cuando **alguien conectado empieza el mandado** y va marcando compras.
- Cuando **llega el mandado** y hay que recibir/confirmar.
- Cuando en el chat lo **mencionan** (@María).
- **Recordatorios de eventos** (cumpleaños, desayunos, planes de compra).
- **Proyección de faltas** ("en 2 días faltará leche", ver §7.2).
- **Resumen diario** opcional: "hoy falta comprar X cosas" a la hora que elija
  la familia.
- **Resumen semanal** opcional: "esta semana faltará X, el plan es el sábado".

Opciones por miembro:

- Horario **silencioso** (no molestar en la noche).
- Elegir qué tipos de aviso recibe.
- Elegir si recibe avisos de eventos (cumpleaños de todos o solo de algunos).

---

## 14. Reglas de la familia (configurables por el Organizador)

- **Nombre del hogar** (ej. "Los Ramírez").
- **Lista de tiendas** favoritas y sus **pasillos** (opcional).
- **Unidades y categorías** preferidas.
- **Secciones** de la lista (las que la familia use: Desayunos, Carnes…).
- **Quién recibe qué notificación** (ver §13).
- **Modo invitado/host** del quiosco de casa (y si se pausa).
- **Límite de fotos** por ítem si quieren ahorrar espacio (opcional).
- **Privacidad**: si el sistema está expuesto a internet, control de quién puede
  ver fotos y precios.
- **Idioma y zona horaria** del hogar.
- **Clave de respaldo** del hogar (ver §2.5).

---

## 15. Seguridad y privacidad

- **Self-hosted**: todo vive en el PC de la familia, no en la nube de nadie.
- **Red interna vs externa**: se entra desde la red de la casa; si el Admin lo
  decide, se expone hacia afuera (con HTTPS recomendado) para acceder desde
  cualquier lado.
- **La biometría nunca viaja al servidor** (ver §2.3).
- **Contraseñas** con hash seguro en el servidor.
- **Datos sensibles** (fotos, precios): visibles solo a miembros del hogar;
  configuración de privacidad por hogar.
- **Respaldo**: exportar/importar todo el hogar (lista, historial, eventos, chat)
  para llevarlo a otra máquina.

---

## 16. Experiencia pensada para cada pantalla

| Pantalla | Experiencia |
|---|---|
| **Celular (mandado)** | Una mano: marcar "ya lo llevo" rápido, chat, ver "lo mío". Botón grande de captura rápida. |
| **Tablet del hogar / PC** | La lista completa, arreglable con arrastrar y soltar, secciones, ver historial, subir fotos, calendario y planes, administrar. |
| **Quiosco de cocina** | Pantalla de host: siempre lista, botón gigante "Falta…", ver lo que el del mandado va llevando en vivo, quién está conectado. |
| **Web desde cualquier lado** | Lo mismo que la tablet, para cuando estás fuera sin app. |

Pantallas principales:

1. **Lista** (lo que falta, con filtros y secciones).
2. **Lo mío** (lo que me toca comprar hoy).
3. **Calendario** (eventos, mandados, planes; día/semana/mes/año).
4. **Historial** (línea de tiempo y reportes).
5. **Chat**.
6. **Ajustes** (cuenta, hogar, miembros, reglas, invitaciones).

---

## 17. Fuera de alcance (fase futura)

- Presupuesto/cuentas completas de la familia (facturas, deudas).
- Recetas que sugieran la lista de ingredientes.
- Planificador de menú semanal ligado a la compra.
- Multi-hogar (una persona en dos familias a la vez) — el modelo inicial es
  un miembro = un hogar.
- Inventario completo de despensa (stock) — inicialmente solo "falta", no
  "cuánto queda en la alacena".
- IA predictiva avanzada (más allá de cadencias aprendidas del historial).
- Pagos en línea o integración con supermercados.

---

## 18. Glosario

- **Hogar**: una familia/una lista compartida + calendario + chat.
- **Ítem**: una cosa de la lista.
- **Mandado**: la salida de compras (quién va, a dónde, qué lleva).
- **Plan de compra**: cuándo se va a comprar (día/hora/tienda/quien).
- **Falta**: algo que se necesita comprar (estado inicial).
- **"Ya lo llevo"**: marcado por quien está en la tienda.
- **Sección**: grupo de ítems de la lista (ej. "Desayunos").
- **Cadencia**: cada cuánto se compra/consume un producto.
- **Proyección**: estimación de qué va a faltar en X días.
- **Evento**: cumpleaños, aniversario, desayuno, celebración… del calendario familiar.
- **Ocasión**: cualquier motivo que genere una lista (fiesta, comida, visita).
- **Quiosco / host**: dispositivo fijo de la casa siempre dentro del sistema.
- **Self-hosted**: el sistema vive en un PC de la familia, no en la nube de nadie.
