# loopwork

**Taller local de archivos y código asistido por IA dentro de DeepSeek, ChatGPT, Gemini y Claude.**
Userscript basado en OPFS y Git: la IA propone, el usuario revisa y aprueba.

Versión actual: **1.10.0**. **135 pruebas Node** más una suite nueva en `tests/` (80 pruebas: traducciones, análisis de código y e2e en Chromium).
Es un prototipo funcional, no un IDE completo ni un sistema de respaldo externo.

**Documentación:** [Manual del usuario](./manual.md) (paso a paso) ·
[Roadmap](./roadmap.md) (estado y pendientes) · [Portada del proyecto](./index.html).

## En 60 segundos

1. Instala [Tampermonkey](https://www.tampermonkey.net/) y pega
   [loopwork.js](./loopwork.js) en un script nuevo.
2. Abre DeepSeek (o ChatGPT / Gemini / Claude, experimentales): aparece el panel flotante.
3. **Nuevo archivo…** → pega tu código → **Compartir archivo…** → pide un cambio.
4. En la respuesta pulsa **Revisar parche en DV**, mira el diff y **Aplicar cambios**.
5. **Ejecutar** para probar y **Guardar cambios en Git** para versionar.

Todo ocurre en tu navegador: la IA solo ve lo que tú compartes, y nada se
escribe sin tu aprobación.

| Sitio | Estado |
| --- | --- |
| chat.deepseek.com | Verificado en uso real |
| chatgpt.com | Experimental (falta confirmar con cuenta real) |
| gemini.google.com | Experimental (falta cuenta Pro; `run archivo.js` no disponible por CSP) |
| claude.ai | Experimental, nuevo en 1.5.40 (selectores sin probar con una cuenta real) |

## Contenido

- [En 60 segundos](#en-60-segundos)
- [Qué ofrece](#qué-ofrece)
- [Instalación](#instalación)
- [Primeros pasos](#primeros-pasos)
- [Idiomas](#idiomas)
- [Ciclo de corrección con IA](#ciclo-de-corrección-con-ia)
- [Comandos](#comandos)
- [Checkpoints](#checkpoints)
- [Privacidad y almacenamiento](#privacidad-y-almacenamiento)
- [Límites y recuperación](#límites-y-recuperación)
- [Desarrollo y pruebas](#desarrollo-y-pruebas)
- [Autores y colaboradores](#autores-y-colaboradores)
- [Roadmap y licencia](#roadmap-y-licencia)

## Qué ofrece

- Disco virtual local en el almacenamiento privado del sitio (OPFS).
- **Carpeta real opcional** (botón **Usar carpeta real…**, API `showDirectoryPicker`
  de Chromium): reemplaza OPFS por una carpeta real de tu PC mientras está
  conectada, con los mismos comandos, Git y editor. El permiso se guarda en
  IndexedDB y se reactiva solo si el navegador aún lo recuerda; si no, el panel
  ofrece **Reconectar carpeta…**. **Volver a OPFS** regresa al almacenamiento
  privado sin borrar archivos de la carpeta real.
- **Exportar disco (.zip)… / Importar ZIP…**: respaldo y restauración completos
  del disco (incluye `.git` y checkpoints) sin dependencias externas; el `.zip`
  se genera con un escritor propio (store/deflate) y se puede abrir con
  cualquier gestor de archivos o herramienta ZIP estándar.
- Panel independiente del chat: ejecutar comandos locales no envía un mensaje al modelo.
- Importación múltiple desde la PC y descarga de archivos con sus bytes originales.
- Botones por archivo: **Editar · Ejecutar · Descargar · Eliminar**.
- Editor de código con resaltado, minimapa, buscar/reemplazar (regex), vista previa HTML en vivo, diff y aprobación.
- La **Vista previa** del editor HTML recuerda si estaba abierta: al cerrar y volver a abrir el editor se restaura.
- **Nuevo archivo…** (o `!edit pagina.html`): editor en blanco para pegar código; nunca sobrescribe.
- Escrituras transaccionales (temporal verificado + journal PREPARED/COMMITTED) con recuperación al iniciar.
- Propuestas JSON con hash para evitar aplicar cambios a una versión obsoleta.
- Botón de revisión en bloques de corrección del chat, con diff, aprobación y checkpoint previo.
  Reconoce el formato real de DeepSeek (`.md-code-block` con `<pre>` sin `<code>`;
  lenguaje `dv` leído de la cabecera del bloque). Validado en chat.deepseek.com.
- Git local: commits, staging, diff, lectura histórica y ramas protegidas.
- Guardado contextual en Git con lista revisable, mensaje editable y confirmación sin escribir comandos.
- Checkpoints independientes de Git, incluso para archivos sin commit.
- Vista previa HTML estática y JavaScript de consola aislado.
- HTML en pestaña conectada: actualización al guardar, botón Actualizar desde disco y recarga con F5.
- Interfaz, ayuda, avisos y errores en español, inglés y chino simplificado.
- Compartir resultados y archivos desde el panel con un clic explícito; `--share` y `--share-file` conservan vista previa y confirmación.
- **Soporte experimental para ChatGPT** (`chatgpt.com`/`chat.openai.com`): la detección
  de entrada de chat, botón de enviar y bloques `dv` se adaptó para funcionar ahí también,
  pero solo se verificó el DOM en una sesión sin iniciar sesión; falta confirmación de
  un usuario real con el panel instalado.
- **Soporte experimental para Gemini** (`gemini.google.com`, también con Pro):
  editor Quill, botón de envío y bloques del asistente. Los comandos `!` de una
  línea muestran **Ejecutar en DV**, sin confirmación inicial adicional. Como Gemini puede mostrar
  el lenguaje `dv` como “Code snippet”, los bloques JSON de sus respuestas también
  ofrecen revisión: solo se habilita si cumplen el esquema de propuesta.
  Se verificaron el montaje del panel, la entrada Quill y la cancelación/ejecución
  local de `!ls` desde un bloque real sin iniciar sesión; falta validar con una
  cuenta Pro.

No instala un motor WASM ni ofrece Python, Node, shell, dependencias, autocomplete
o validación semántica por lenguaje. El motor de edición verifica candidatos y
hashes y recupera escrituras interrumpidas (ver [Límites y recuperación](#límites-y-recuperación)).

## Instalación

1. Usa un navegador Chromium moderno, con OPFS, Web Crypto, Workers,
   Compression Streams y módulos dinámicos disponibles.
2. Instala un gestor de userscripts como
   [Tampermonkey](https://www.tampermonkey.net/).
3. Crea un script nuevo y pega completo
   [loopwork.js](./loopwork.js).
4. Guarda y abre o recarga [chat.deepseek.com](https://chat.deepseek.com/)
   (también disponible, de forma experimental, en [chatgpt.com](https://chatgpt.com/)
   y [gemini.google.com](https://gemini.google.com/app)).
5. Comprueba que el panel muestra **v1.10.0**.

### Alternativa: extensión de Chrome

La misma funcionalidad está disponible como **extensión de Chrome** (Manifest V3,
Chrome 111 o superior; también Edge y Brave). No necesita Tampermonkey, **no pide
ningún permiso** y lleva `isomorphic-git` y `diff` dentro, así que no descarga
nada de jsDelivr. Además aísla copiar, cortar y pegar del panel frente a la página,
lo que corrige que **Ctrl+V** no pegara en claude.ai.

1. Genera o descarga la carpeta `extension/` (`python3 tools/build-extension.py`, o descomprime
   `loopwork-extension-1.10.0.zip`).
2. Abre `chrome://extensions`, activa **Modo de desarrollador** y pulsa **Cargar descomprimida**.
3. Elige la carpeta `extension/` y recarga el chat.

**Icono de la barra:** pulsarlo muestra u oculta el panel de la pestaña (sin permisos extra). **Usa una sola vía:** si instalas la extensión, desactiva o borra el userscript en Tampermonkey; con las dos
activas aparecerían dos paneles. Para actualizar, vuelve a generar la carpeta y pulsa el botón de recarga de la
extensión en `chrome://extensions`. Aún no está en Chrome Web Store.

No hace falta npm para usarlo. Sí hace falta el gestor de userscripts; si el
navegador exige permisos adicionales para ejecutarlos, concédelos al gestor.
La compatibilidad con otros navegadores y futuras versiones de DeepSeek no está
certificada.

- **Soporte experimental para Claude** (`claude.ai`, nuevo en 1.5.40): el compositor
  de claude.ai es un editor ProseMirror (`contenteditable`), no un `<textarea>`; el
  adaptador lo localiza, lee sus párrafos línea a línea y lo rellena con
  `insertText` o, si este aplana los saltos de línea, con un pegado sintético.
  Si el texto no coincide exactamente, el envío se cancela y se restaura el borrador.
  Los bloques del asistente se reconocen por `.font-claude-response` /
  `[data-is-streaming]`, y los del usuario por `[data-testid="user-message"]`.
  En 1.5.41 el botón de enviar se localiza también por su etiqueta traducida
  («Enviar mensaje» en un claude.ai en español) y, si no aparece, se envía con Enter.
  Los mensajes fijos que dicen «DeepSeek» muestran ahora el nombre del sitio
  actual. Los selectores se basan en el DOM conocido de claude.ai y la lógica de
  edición se comprobó contra un editor ProseMirror real en un navegador aislado,
  pero **falta confirmarlo en claude.ai con una cuenta**. Es posible que `run archivo.js`
  quede bloqueado por la CSP del sitio, como en Gemini; el panel lo informará.

Para probar Gemini, actualiza el userscript completo en Tampermonkey y recarga
Gemini. Pide una respuesta con un bloque de código que contenga únicamente `!ls`:
debe aparecer **Ejecutar en DV** y, al pulsarlo, mostrar la salida en el
panel, sin enviar otro mensaje. No requiere API ni clave de Gemini.
El disco OPFS pertenece a cada origen: Gemini no verá los archivos guardados en
DeepSeek, ChatGPT o Claude. Para trasladarlos, exporta un ZIP en el sitio de origen e
impórtalo en Gemini.

Si el panel no aparece:

- Comprueba que el script está habilitado y autorizado para el sitio.
- Evita tener varias versiones activas al mismo tiempo.
- Recarga la página y revisa la consola del navegador.
- Si aparece un error OPFS, permisos o CSP, conserva el mensaje para diagnosticarlo.

## Primeros pasos

Al abrirlo por primera vez aparece una bienvenida. Sus tres ejemplos solo
preparan el comando en la entrada: tú decides cuándo ejecutarlo. **Entendido**
recuerda que ya la viste; puedes recuperarla con **Primeros pasos** o desde
Ayuda. No crea archivos ni comparte nada automáticamente.

El encabezado indica **Listo · local**, **Operación en curso** o **Editor abierto**.
Los botones principales se deshabilitan durante una operación. **Ampliar/Reducir**
cambia el tamaño sin borrar el comando; **Contraer/Abrir** oculta o muestra el
contenido. Los botones tienen tooltips y foco visible para navegación por teclado.
El editor sigue en su ventana independiente con diff y aprobación.
Cada archivo muestra nombre, tamaño y acciones en una sola fila. Los nombres
largos se acortan visualmente; su tooltip muestra la ruta completa. Si la ventana
es demasiado estrecha, la lista permite desplazarse horizontalmente.

### Idiomas

El selector del encabezado ofrece **Español · English · 简体中文**. Traduce
botones, etiquetas accesibles, tooltips, editor, modal Git, ayuda, avisos,
confirmaciones, errores propios del userscript y las instrucciones que se
adjuntan al compartir un archivo con DeepSeek.

- La primera vez usa el idioma compatible del navegador; si no encuentra
  español, inglés o chino, usa español. Las variantes de chino se muestran
  en **chino simplificado**, no en tradicional.
- Tu elección se guarda en los ajustes locales del sitio, conservando el prefijo
  de comandos. No requiere recargar DeepSeek ni envía una petición a la IA.
- Cambiar idioma conserva el borrador del comando, el historial del log,
  la posición y el estado ampliado/contraído del panel. Los mensajes históricos
  del log permanecen como se emitieron.
- Durante una operación, con editor abierto o revisando el modal Git,
  el selector queda bloqueado para no perder borradores.
- Los botones de parche del chat y las pestañas HTML conectadas actualizan sus
  textos. Las pestañas desconectadas deben volver a abrirse desde Ejecutar.

**Los comandos, opciones y campos JSON no se traducen**: `git`, `run`, `propose`,
`--share`, `path`, `hash`, etc. Tampoco los nombres/rutas, bytes de archivos,
código, commits existentes, etiquetas de checkpoints del usuario o salida de
sus programas. Los errores nativos del navegador y de bibliotecas conservan el
idioma que esas herramientas emiten.

Las traducciones están incluidas en el userscript: no se consulta un servicio
externo para traducir. El español se usa como clave fuente de `t()`; los catálogos
incorporados contienen inglés y chino. Las pruebas comprueban cobertura de cada
mensaje explícito e integridad de marcadores `{0}`, `{1}`, etc., para que las rutas
y el contenido interpolados nunca se traduzcan ni se interpreten como HTML.

### Crear un archivo nuevo

Pulsa **Nuevo archivo…**, escribe el nombre en el campo que aparece en el panel
(puede incluir carpeta, ej. `web/index.html`) y pulsa Enter o **Abrir editor**;
se abre el editor en blanco. No usa `prompt()`, que algunos navegadores bloquean. Pega o escribe el código y pulsa **Crear archivo**
(o Ctrl+S). El archivo no existe hasta guardarlo; si mientras tanto apareció otro
con ese nombre, no se sobrescribe. Desde la línea de comandos:

```text
!edit pagina.html
```

Si el archivo ya existe, `edit` y **Nuevo archivo…** lo abren en el editor normal.
Tras guardar, el editor **sigue abierto** para continuar editando (las propuestas
del chat sí se cierran al aplicarse).

El editor se puede mover arrastrando su barra de título y redimensionar desde
la esquina inferior derecha. **Minimizar** conserva el borrador y permite usar
el chat; **Restaurar** vuelve a mostrarlo. **Ampliar / Reducir** alterna entre
la ventana completa y el tamaño/posición anteriores, también con la vista
previa HTML abierta. Minimizar no guarda ni cierra el archivo.

### Editor integrado

Pensado para no necesitar otro editor:

- Resaltado de sintaxis (JS/TS, HTML con <script>/<style>, CSS, JSON, Python,
  shell, Markdown), números de línea y minimapa clicable y arrastrable.
- Buscar/reemplazar flotante con mayúsculas (Aa), expresiones regulares (.*) y $1,
  contador de resultados; ir a línea sin prompt().
- Cierre automático de paréntesis, comillas y etiquetas HTML; Enter con sangría
  inteligente; Backspace borra pares vacíos.
- HTML: **Vista previa** en vivo del borrador (sin scripts ni red) y **Pestaña**,
  que se refresca al guardar (ideal en pantalla dividida).
- JSON: **Formatear**. Tamaño de letra A−/A+ (se recuerda), Copiar, Pegar,
  Descargar el borrador, indicador ● de cambios y aviso al cerrar la página.
- Barra de estado: Ln/Col, selección, líneas, bytes, lenguaje, LF/CRLF.
- Todo cambio sigue pasando por diff y aprobación; deshacer (Ctrl+Z) se conserva.

| Atajo | Acción |
| --- | --- |
| Ctrl+S / 💾 Guardar | Muestra el diff y pide confirmación antes de guardar (se activa al editar) |
| Ctrl+F / Ctrl+H / F3 | Buscar / reemplazar / siguiente (barra flotante; ▶/▼ muestra el reemplazo, Esc solo la cierra) |
| Ctrl+D | Selecciona la palabra o la siguiente coincidencia de la selección |
| Ctrl+G | Ir a la línea |
| Ctrl+/ | Comentar o descomentar |
| Alt+↑/↓ · Shift+Alt+↑/↓ | Mover línea · duplicar |
| Ctrl+Shift+K | Borrar línea |
| Tab / Shift+Tab | Sangrar / quitar sangría |
| Shift+Alt+F | Formatear JSON |
| Alt+Shift+→ | Selecciona la función del cursor (repetir: la exterior) |
| Esc | Cierra ayuda, ir a línea o búsqueda; si no, el editor |

**Guías de bloque (1.10.0).** Junto a los números de línea se dibuja una línea vertical por cada bloque de varias líneas
(llaves y corchetes en JS/CSS/JSON, sangría en Python, etiquetas en HTML), con una marca donde abre y otra donde cierra;
el bloque del cursor se resalta, un clic lo selecciona y el botón **Guías** las oculta.

**Revisión básica y funciones (1.9.0).** En JS, CSS, HTML y Python el botón **Revisar** avisa de llaves, paréntesis o
corchetes sin cerrar o cruzados, cadenas sin cerrar, `;` olvidado entre declaraciones CSS y, en Python, dos puntos
que faltan y sangría inconsistente; cada aviso salta a su línea y, si el arreglo es seguro, ofrece **Arreglar**
(o **Arreglar todo**). En JS, Python y los `<script>` de un HTML, **Función** selecciona la función (o método, o clase) que
contiene el cursor y **Reemplazar función** la sustituye por el texto del portapapeles ajustando la sangría. Desde la IA:
`operation: "replace-function"` con `name` y `new` (ver el manual).

### Importar y explorar

Pulsa **Explorar / Importar archivos…**. Los archivos se guardan en la raíz del
disco virtual, no se envían al chat. Reemplazar uno existente requiere confirmación.

También puedes crear texto:

```text
!write hola.txt "Hola mundo"
!ls
!cat hola.txt
```

En el panel el prefijo `!` es opcional. En la entrada del chat se usa `!`;
Enter o el botón de envío reconocido interceptan comandos registrados.
**Prefiere el panel**: la captura del chat depende de la interfaz de DeepSeek.
Shift+Enter añade una línea; otras combinaciones no garantizan interceptación.

### Versionar

No necesitas escribir comandos: el encabezado muestra el estado Git y un botón:

- **Inicializar Git local** si todavía no hay repositorio. El clic crea la rama
  `main` y abre la revisión; no hace commit por sí solo.
- **Guardar archivo en Git** si hay un único archivo pendiente.
- **Guardar N cambios en Git** si hay varios.
- **Todo guardado en Git**, deshabilitado, cuando no hay cambios.

El botón abre un modal de hasta 860 px, con rama, lista completa de cambios
(incluidos borrados y staging), mensaje sugerido editable y **Confirmar commit
local**. Cancelar no añade archivos al staging ni crea commits. Si acabas de
inicializar Git, cancelar conserva ese repositorio vacío.

La confirmación equivale a `git add --all` seguido de `git commit`: versiona las
**versiones actuales** de todos los archivos de la lista, no una selección.
Reemplaza el staging anterior por esas versiones; si un archivo staged tiene
ediciones posteriores, guarda la última versión del disco. Los metadatos internos
y archivos ignorados sin seguimiento quedan fuera. No hace checkpoint adicional,
no borra archivos de trabajo y no envía nada a DeepSeek ni a un servidor.

**Ver cambios** abre la misma revisión y muestra los dos diffs: working tree
frente a staging, y staging frente a HEAD. Los archivos nuevos sin seguimiento
aparecen en la lista, no en `git diff`. Puedes actualizar la lista conservando
tu mensaje. Si cambian archivos, staging, rama o HEAD desde la revisión,
el guardado se rechaza y debes actualizarla. Se verifica el contenido del commit
y su HEAD; fallos durante staging pueden dejar staging parcial, informado sin
rollback automático. No hay bloqueo entre pestañas.

El estado se actualiza tras las operaciones del panel. Cambios desde otra pestaña
pueden requerir **Actualizar lista**.

**Revertir…** abre la misma lista con un botón **Revertir** junto a cada archivo
que existe en el último commit (los archivos nuevos no lo tienen; usa Eliminar).
Equivale a `git restore --source HEAD archivo`: abre el editor con el diff, no
escribe nada hasta **Aplicar**, crea un checkpoint de tu versión actual y vuelve
a comprobar el hash antes de guardar. Binarios o archivos borrados piden
confirmación. No toca el staging ni hace commit; un commit ya hecho no se deshace.

**Todos los comandos siguen disponibles**, para controlar staging por separado:

```text
!git init
!git add --all
!git commit -m "primer commit"
!git status
```

`Working tree limpio` describe el estado Git; no significa que todos los datos
del navegador estén respaldados.

### Ejecutar y descargar

```text
!write test.html '<!doctype html><html><body><h1>Hola</h1></body></html>'
!run test.html
```

O pulsa **Ejecutar** en su fila. HTML abre una **pestaña de vista previa conectada**
sin scripts ni recursos externos; si ya está abierta para ese archivo, se reutiliza.
JavaScript de consola se ejecuta en Worker aislado y muestra logs/errores en el
panel. Ambos requieren confirmación.

El ejecutor JavaScript carga su iframe aislado mediante una URL Blob, sin
asignar `srcdoc` desde el chat. Libera la URL y retira el iframe al terminar,
fallar o agotar el tiempo. Esto evita el destino TrustedHTML de `srcdoc`, pero
la CSP del sitio todavía puede bloquear la navegación Blob o los Workers.
En Gemini se comprobó que la CSP heredada bloquea el script de arranque del
iframe Blob y también los Workers Blob. Por ello `run archivo.js` no está
disponible allí con este ejecutor; usar Blob no basta para habilitarlo.
El panel distingue entre falta de señal de arranque del controlador y ausencia
de respuesta del Worker, e informa del posible bloqueo sin relajar el sandbox.
Esto no indica necesariamente un error en tu archivo. Para interactividad de
HTML y JavaScript, abre el proyecto fuera del chat con un servidor local.

Para trabajar lado a lado, arrastra la pestaña a otra ventana y coloca DeepSeek
en media pantalla y la vista previa en la otra (por ejemplo, con **Win+Izquierda**
y **Win+Derecha**). El userscript no organiza las ventanas automáticamente.

La vista previa:

- Se actualiza al **guardar** desde el editor, aplicar un parche, importar,
  escribir o restaurar el archivo mediante el userscript. No refleja borradores.
- Tiene **Actualizar desde disco** para volver a leer el archivo OPFS actual.
- **F5** recarga la pestaña y solicita nuevamente el archivo al panel;
  no reutiliza una copia HTML antigua.
- Conserva el HTML en un iframe con `sandbox=""`. Solo el controlador de la
  pestaña tiene un script propio; los scripts del archivo están desactivados.
  CSS inline e imágenes `data:` funcionan; CSS/JS/imágenes relativas de OPFS
  y recursos de red todavía no se resuelven.
- En sitios con Trusted Types, como Gemini, el parser inerte y los destinos
  de vista previa usan la política privada `dv-static-preview`. No se crea
  una política `default` ni se elimina la limpieza, el sandbox o la CSP.
  Si el sitio prohíbe crear esa política, se muestra el error sin desactivar
  sus protecciones; `DOMParser` por sí solo tampoco evita Trusted Types.
- Requiere mantener la página de DeepSeek abierta. Si la cierras o recargas,
  vuelve a pulsar **Ejecutar** para crear una nueva conexión. Si el archivo falta,
  no es UTF-8 válido o supera 1 MB, muestra un error y retira la vista anterior.

Permite ventanas emergentes para DeepSeek si el navegador bloquea la pestaña.
No hay sincronización automática con cambios de otra instancia del userscript:
usa **Actualizar desde disco**. La CSP del sitio puede bloquear la vista previa;
la validación en localhost no certifica su funcionamiento en DeepSeek.

**Descargar** solicita guardar el archivo actual en la PC sin convertir sus
bytes. El navegador decide la ubicación y puede bloquear la descarga; el mensaje
«Descarga solicitada» no certifica que haya terminado.

**Eliminar todos** borra archivos de usuario tras confirmación y conserva Git,
checkpoints y metadatos internos. No tiene deshacer automático: no recupera
archivos sin commit o checkpoint.

## Ciclo de corrección con IA

```text
Archivo OPFS -> compartir explícitamente -> IA propone
            -> Revisar parche en DV (o pegar comando) -> revisar diff -> aprobar
            -> ejecutar -> revisar Git -> commit/checkpoint
```

La IA **no ve ni accede automáticamente al OPFS**. La conversación y el panel
no comparten un disco accesible al modelo.

1. Obtén líneas y hash de la versión actual:

   ```text
   !view programa.js --from 1 --to 20
   ```

2. Comparte el texto necesario, desde el selector **Compartir archivo…** o con
   un comando explícito:

   ```text
   !view programa.js --from 1 --to 20 --share
   ```

   `--share` envía un resumen de hasta 1200 caracteres. Verifica en la vista
   previa que contiene el contexto necesario; no es el archivo completo.

3. Compartir un archivo completo incluye su SHA256 y las instrucciones para
   responder con un bloque `dv` de JSON puro. El hash corresponde a los bytes
   originales, incluidos BOM y CRLF. La IA no debe inventarlo ni recalcularlo.
   Ejemplo ilustrativo: reemplaza `HASH_REAL` por los
   64 caracteres SHA256 de la versión revisada.

   ```dv
   {"path":"programa.js","hash":"HASH_REAL","operation":"replace","old":"return 1;","new":"return 2;"}
   ```

   En un bloque del asistente aparecerá **Revisar parche en DV**. Un JSON
   incompleto o inválido mantiene el botón deshabilitado con explicación;
   se actualiza mientras llega la respuesta. Al pulsarlo se vuelve a leer
   el bloque y se valida contra el archivo actual. No guarda ni envía mensajes.

   Los bloques del asistente que empiezan con `!` y contienen una sola línea
   muestran **Ejecutar en DV**. Al pulsarlo, sin un modal de confirmación inicial, se ejecutan
   localmente y la salida aparece en el panel. Esto incluye `!propose` y
   `!replace`: usan el mismo flujo de comandos que el panel; no la revisión
   con checkpoint previo del botón de parche. Las opciones de compartir
   conservan su confirmación independiente. También se mantienen las
   confirmaciones de borrado, sobrescritura y ejecución de archivos.

   Los bloques `dv` con JSON y las propuestas que no son comandos `!` de una
   línea conservan **Revisar parche en DV**. También se reconoce `propose`
   con el prefijo configurado, pero esta revisión solo admite JSON inline:
   sin archivos, pipes, redirecciones ni `--share`.

   También puedes importar un JSON y ejecutar `!propose propuesta.json`.
   Operaciones: `replace`, `insert-before`, `insert-after`, `append`.
   `old` es obligatorio y debe coincidir exactamente una vez, salvo `append`,
   que no admite `old`. No se añaden saltos de línea automáticamente.

   Se recomienda JSON puro `dv`: permite apóstrofos sin escapes de shell.
   En JSON usa `\n` para saltos, o `\r\n` para conservar CRLF. Si el comando inline entre comillas simples
   contiene apóstrofos, codifícalos como `\u0027` o usa un archivo JSON.
   El tokenizador no interpreta escapes de shell como `\n`.

4. Revisa el diff completo y confirma **Aplicar cambios**. Los parches abiertos
   desde el botón del chat crean y verifican un checkpoint de la versión anterior
   antes de guardar; si falla esa copia, el archivo queda intacto. Cerrar el editor
   cancela el cambio. La propuesta no escribe por sí sola; un hash obsoleto se
   rechaza al preparar, abrir y guardar (también tras preparar el temporal).
   No se ejecuta el código corregido, ni se hace staging o commit automáticamente.
   Consulta la copia con `!checkpoint --list --file programa.js` y recupérala
   con `!restore ID` si lo necesitas.
5. Ejecuta y versiona cuando corresponda:

   ```text
   !run programa.js
   !git diff
   !git add --all
   !git commit -m "corrección revisada"
   ```

Compartir con la IA consume el contexto/tokens del chat. Solo las operaciones
locales del panel no invocan al modelo. La aprobación sigue siendo manual.

El reconocimiento del chat usa contenedores de asistente
(`data-message-role`, `data-role` o `.ds-markdown`) y bloques `pre code`.
La interfaz de DeepSeek puede cambiar: si falta el botón, copia la propuesta
al panel. Esos selectores son heurísticos, no autentican el origen del texto;
ningún bloque se aplica automáticamente. SHA256 detecta versiones distintas,
no certifica que una corrección sea correcta ni ofrece un bloqueo entre pestañas.

## Comandos

El botón **Ayuda** o `!help` muestra la ayuda del registro de comandos.

| Comando | Alcance |
|---|---|
| `!ls [-R] [ruta]` | Lista contenido del disco |
| `!cat [archivo...]` / `!head [-n N] [archivo]` | Lee texto; también aceptan entrada de pipeline |
| `!grep [-i] [-n] [-F] patrón [archivo]` | Regex por líneas, sin distinguir mayúsculas con `-i`, numeradas con `-n`, literales con `-F`; acepta pipes |
| `!write archivo texto` | Guarda texto mediante candidato y verificación; si reemplaza contenido distinto, checkpoint previo |
| `!save archivo` | Guarda el último resultado textual; no exporta bytes históricos |
| `!cp origen destino` / `!mv origen destino` | Copia bytes verificados; mv confirma y borra origen tras comprobarlo |
| `!undo` | Deshace la última operación con copia previa (rm, cp/mv, importar, write, guardar, propuesta multiarchivo); repetirlo la rehace. Se conservan 20 copias por archivo y 64 MB |
| `!rm [-r] ruta` | Borra una ruta tras confirmación; guarda antes un checkpoint de cada archivo de hasta 1 MB (recupera con `!restore`) |
| `!view archivo [--from N] [--to N]` | Líneas numeradas y hash completo |
| `!propose propuesta.json` | Prepara un cambio JSON (`replace`, `insert-before/after`, `append` o `patch` con diff unificado exacto) para el editor |
| `!replace archivo old new [--all] [--regex] [--hash SHA256] [--dry-run]` | Literal único o todas las coincidencias no solapadas (o regex con `$1`); diff/aprobación obligatorios |
| `!propose` con `{"changes":[…]}` | Varios archivos en una sola revisión: se comprueban todos los hashes, se guarda un checkpoint por archivo y se aplican todos o ninguno (2 a 20 cambios, rutas distintas) |
| `!diag` (botón **Diagnóstico**) | Informe del sitio y del script para reportar fallos; sin mensajes ni archivos |
| `!run archivo.html` / `!run archivo.js` | HTML estático en pestaña conectada o JS de consola aislado |
| `!edit archivo` | Abre el editor; si no existe, empieza en blanco y lo crea al guardar |
| `!journal [-n N]` | Consulta el journal con el estado de cada escritura (PREPARED/COMMITTED/ABORTED/CONFLICT) |
| `!recover` | Revisa escrituras interrumpidas y limpia temporales huérfanos |

### Git

| Comando | Alcance |
|---|---|
| `!git init` | Inicializa rama main |
| `!git status` | Cambios staged/unstaged y sin seguimiento |
| `!git add archivo` / `!git add --all` | Staging, incluidos borrados; metadatos internos excluidos |
| `!git commit -m "mensaje"` | Commit con cambios staged |
| `!git log [--oneline] [-n N] [-- archivo]` | Últimos commits (10 por defecto, máx. 200); con `-- archivo`, solo los que lo tocan |
| `!git diff [--staged] [ref]` | Staging/HEAD/ref frente a staging o working tree |
| `!git diff A B` | Diff entre dos commits o ramas (SHA abreviado válido); no toca el working tree |
| `!git show [ref]` | Metadatos del commit; no su diff |
| `!git show ref:archivo` | Texto de archivo histórico sin restaurarlo |
| `!git restore archivo` | Vuelve a la versión del staging, con diff y checkpoint previo |
| `!git restore --source ref archivo` | Vuelve a la versión de HEAD, una rama o un SHA completo |
| `!git restore --staged archivo` | Saca el archivo del staging; no cambia el archivo |
| `!git branch [nombre]` | Lista o crea rama; crear no cambia de rama |
| `!git checkout rama` | Cambia a rama local existente con confirmación y estado limpio |

Las referencias admitidas por `show` y `restore --source` son HEAD, rama o SHA completo; no SHA
abreviado, `HEAD~N` ni resolución de tags anotados.
Checkout bloquea editor abierto, modificaciones, staging pendiente y archivos
sin seguimiento o ignorados. No tiene force, checkout de archivos/commits ni
rollback automático. Un checkpoint no limpia esos cambios.

`!restore ID` restaura un checkpoint; `!git restore` restaura desde Git. Ambos
crean un checkpoint de la versión actual antes de sobrescribir. `git restore` no
borra archivos nuevos, no acepta carpetas ni varios archivos y no combina
`--staged` con el working tree. Git remoto y exportación de repositorios siguen pendientes.

### Pipes y redirección

```text
!cat entrada.txt | head -n 10 > salida.txt
!git show HEAD:test.html
!save texto-recuperado.html
```

`>` reemplaza y `>>` añade; destinos `.gz` comprimen texto y no admiten append.
La salida procesa líneas: puede normalizar saltos y `>` escribe un `\n` por
línea. `save` no añade ese salto, pero guarda el resultado ya procesado.
**Ninguno garantiza fidelidad binaria ni restauración histórica byte a byte.**

`propose`, `replace`, `checkpoint`, `restore` y `git checkout` no aceptan pipes
ni redirecciones.

## Checkpoints

```text
!checkpoint prueba.txt "antes de editar"
!checkpoint --list
!checkpoint --list --file prueba.txt --tag "antes de"
!checkpoint show ID
!checkpoint show ID --content
!checkpoint diff ID1 ID2
!restore ID
```

- Copias hasta 1 MB, con bytes originales y hash en `.dv/checkpoints`.
- Listado reciente primero; `--file` compara ruta normalizada y `--tag` busca
  texto literal en la etiqueta, sensible a mayúsculas.
- Contenido/diff requieren UTF-8 sin NUL; metadatos admiten binarios.
- Restore vuelve a la ruta original. Texto existente pasa por editor/diff;
  binario o archivo ausente requiere confirmación directa.
- Antes de sobrescribir un archivo existente al restaurar se guarda otra copia.
  No hace staging/commit. Cerrar el editor cancela la aplicación.

Limpieza **irreversible y confirmada**:

```text
!checkpoint delete ID
!checkpoint prune --keep 5
!checkpoint prune --older-than 7d
```

Protege la copia más reciente de cada archivo, incluidos empates de fecha.
`--keep 5` conserva cinco globalmente más esas copias protegidas; pueden quedar
más de cinco. Las opciones keep/older-than son excluyentes. Corrupción o cambio
de inventario bloquea la limpieza; un fallo parcial se informa sin rollback.

Los nombres show/diff/delete/prune son subcomandos reservados: para guardar un
archivo que se llame así, usa `./show`, por ejemplo.

## Privacidad y almacenamiento

| Acción | Qué se comparte con el chat del sitio actual |
|---|---|
| Comandos locales, importar, editar, ejecutar, descargar | Nada por el canal de compartir del userscript |
| Revisar parche en DV → aprobar | Nada; revisión, checkpoint y escritura locales |
| `--share` | Resumen revisado del resultado |
| Botón Ejecutar + Compartir | Envía directamente el resumen (hasta 1200 caracteres), sin confirmación adicional |
| `--share-file ruta` | Texto completo del archivo, tras vista previa/confirmación |
| Selector Compartir archivo → Enviar archivo al chat | Envía directamente el texto completo del archivo elegido, sin confirmación adicional |

Compartir archivos requiere UTF-8 sin NUL y máximo **65536 bytes (64 KB)**.
Los mayores aparecen deshabilitados con explicación. El selector se actualiza
al abrir y tras refresh/importación; otra pestaña puede requerir reabrirlo.
Un borrador existente del chat no se reemplaza.
El clic en **Ejecutar + Compartir** autoriza el envío del resumen al chat del sitio actual.
En el selector, **Enviar archivo al chat** autoriza el envío directo del
archivo elegido; abrir el selector no envía nada.
Si el comando incluye `--share-file`, se mantiene la vista previa del mensaje
completo. Las confirmaciones propias de ejecución, edición y borrado no cambian.

**Local-first no significa cero red:** DeepSeek, ChatGPT, Gemini y Claude son servicios remotos.
Tampermonkey/Violentmonkey descarga y gestiona las bibliotecas Git/diff mediante
`@require` desde jsDelivr (`isomorphic-git@1.32.1`, `diff@7.0.0`) antes de ejecutar
el userscript. Actualiza también la cabecera completa y recarga el chat para
que el gestor procese estas dependencias. Se usan los globales `window.git` y
`window.Diff`, sin importar módulos desde la página cuando están disponibles.
Si no están disponibles, se conserva la importación bajo demanda desde esm.sh
como alternativa; esta sí está sujeta a las restricciones de red/CSP del sitio.
Git es local y no requiere iniciar sesión en GitHub; abrir GitHub no autentica
ni sincroniza este disco.
No se suben archivos para cargar esas bibliotecas; el sitio y el código que
ejecuta en su origen siguen formando parte de la frontera de confianza.
El Shadow DOM no es una barrera de seguridad contra la página anfitriona.

OPFS pertenece al **origen del sitio actual** (`chat.deepseek.com`, `chatgpt.com`,
`gemini.google.com` o `claude.ai`, por ejemplo), no a una conversación ni a
un usuario del modelo. No hay separación por cuenta implementada. Otro
navegador/perfil/origen no ve automáticamente esos datos.

**Borrar datos del sitio puede eliminar archivos, Git, journal y checkpoints.**
El almacenamiento privado/incógnito puede ser temporal y la persistencia no es
garantizada. Descarga archivos importantes fuera del navegador.

**Carpeta real (opcional).** Al conectar una carpeta con **Usar carpeta real…**,
el disco deja de ser un sandbox del sitio: los comandos pueden crear, modificar
y borrar archivos reales de tu PC dentro de esa carpeta, con los mismos
permisos que tu usuario del sistema operativo. El handle de la carpeta y el
permiso de escritura se guardan en IndexedDB del origen; "Borrar datos del
sitio" también borra esa referencia (no los archivos reales). Disponible solo
en navegadores Chromium con `showDirectoryPicker` (no en Firefox ni Safari).
Requiere gesto explícito del usuario para conceder o renovar el permiso; el
navegador puede pedir reconfirmarlo en sesiones nuevas.

**Exportar/Importar ZIP.** El botón **Exportar disco (.zip)…** descarga todo
el contenido del disco actual (incluidos `.git` y los checkpoints) como un
único archivo `.zip` generado localmente, sin subir nada a ningún servidor.
**Importar ZIP…** hace el proceso inverso: escribe cada archivo del `.zip`
elegido en el disco, reemplazando los que coincidan en nombre sin deshacer
automático (por eso pide confirmación explícita antes de empezar). Es la
forma recomendada de sacar una copia completa del disco fuera del navegador,
independientemente de si estás usando OPFS o una carpeta real conectada.

El aviso **POSIBLE FUGA** correlaciona un intento manual reciente (5 segundos)
con el comando exacto aparecido fuera del panel. Ignora carga sin intento;
solo conserva el último intento. No verifica red ni recepción del servidor y
puede tener falsos positivos/negativos.

## Límites y recuperación

| Operación | Límite actual |
|---|---|
| Compartir archivo | 64 KB, UTF-8 sin NUL |
| Editor, propuestas, checkpoints, run, show histórico | 1 MB por archivo/candidato |
| Importación/copia verificada | 512 MB por archivo; hashing usa memoria |
| JS aislado | 3 segundos, 100 mensajes y unos 20 KB de logs |
| Vista de resultados en log | 800 caracteres; Ayuda tiene vista completa |
| Explorador | 50 filas; Eliminar todos incluye todos los archivos de usuario |

HTML no ejecuta scripts, navegación ni assets OPFS relativos. JS no dispone de
DOM, Node, imports/dependencias, red ni OPFS; usa `await` para tareas asíncronas.
No existe cuota estricta de memoria para el Worker. CSP del sitio puede bloquear
el entorno; no se degrada a ejecutar en la página principal.

Git protege estados confirmados; checkpoints guardan estados por archivo.

Las escrituras del editor, propuestas y `write` son transaccionales:

1. El contenido se escribe en `.dv_tmp/<id>.tmp` y se verifica su SHA-256.
2. Se registra `PREPARED` en `.dv/journal.jsonl` (si no se puede registrar, no se escribe).
3. Se comprueba de nuevo que el destino no cambió, se escribe y se verifica.
4. Se registra `COMMITTED` y se borra el temporal.

OPFS no tiene `rename` atómico de archivos, así que el temporal verificado hace de
copia de recuperación. Al abrir DeepSeek (o con `!recover`), cada `PREPARED` sin
cierre de más de 2 minutos se resuelve: si el destino ya tiene la versión nueva se
marca completada; si conserva la anterior se revierte; si cambió por otra vía **no
se sobrescribe** y la versión aprobada se guarda junto a él como
`archivo.recuperado-<id>`. Los temporales huérfanos se eliminan. Las transacciones
recientes de otra pestaña se respetan, y donde existe Web Locks las escrituras de
varias pestañas se serializan.

No hay garantía de reversibilidad total:

- No hay backup universal antes de import/rm y otras operaciones.
- Sin Web Locks persisten ventanas de carrera entre pestañas.
- Una limpieza interrumpida puede dejar un checkpoint incompleto o binario huérfano.
- `Working tree limpio` no certifica los archivos ignorados ni todo el disco.

## Desarrollo y pruebas

Archivos principales:

- [loopwork.js](./loopwork.js): implementación.
- [tests/userscript.test.cjs](./tests/userscript.test.cjs): regresiones Node.
- [tools/build-extension.py](./tools/build-extension.py): genera la extensión de Chrome (`extension/`) a partir del userscript.
- [manual.md](./manual.md): manual del usuario.
- [index.html](./index.html): portada del proyecto (apta para GitHub Pages).
- `laboratorio.html`: laboratorio separado de pruebas OPFS/Git (antes llamado
  `index.html`); sus pruebas no se integran automáticamente en el userscript.
- [roadmap.md](./roadmap.md): avances, evidencia y pendientes.

Suite nueva (1.8.0), independiente de la anterior: [tests/e2e](./tests/e2e/README.md) comprueba que todo texto tenga
traducción y ejercita en Chromium las copias previas, `git log/diff`, `patch`, `--regex`, `diag`, el pegado y la vista previa
del editor (`cd tests/e2e && npm install && npm test`).

Con Node.js moderno y npm:

```text
npm ci
npm test
npm run check
```

135 pruebas cubren OPFS simulado y Git real, hashes, edición, creación de archivos, escrituras transaccionales y recuperación, sharing, checkpoints,
descarga, checkout protegido, guardado Git con botones y pestañas HTML conectadas. Hay comprobaciones adicionales en OPFS nativo
en orígenes localhost aislados. Eso no certifica todos los flujos en DeepSeek;
las pruebas reales reportadas por el usuario se distinguen en el roadmap.
El flujo Git de v1.5.28 se comprobó también en navegador con OPFS nativo:
inicialización, revisión, diff y commits persistentes después de recargar.
La vista previa de v1.5.29 se comprobó en el mismo entorno: actualización al guardar,
F5 y actualización manual de cambios externos, con scripts del archivo desactivados.
Las pruebas de i18n cubren catálogos completos, preferencias, idiomas del navegador,
ayuda, errores, compartir, cambio de interfaz y preservación de datos.
La selección de idioma, su persistencia y la ayuda en chino simplificado se
comprobaron también en el navegador, usando un origen local aislado.
En v1.5.34 se comprobó en chat.deepseek.com real (OPFS nativo): Nuevo archivo…,
Tab, Ctrl+S, journal PREPARED/COMMITTED sin temporales, `!edit`, `!recover`, Esc
y la recuperación al iniciar de una escritura interrumpida con conflicto.
No existe aún `!test` para ejecutar frameworks sobre archivos del disco virtual.

Para reportar un fallo, incluye versión, navegador, comando/pasos, resultado
esperado y error. Usa un archivo mínimo sin credenciales ni información sensible.

## Autores y colaboradores

El botón **ⓘ**, en la esquina inferior derecha del panel, muestra estos créditos,
la frase del roadmap y un enlace a [geeknome.com](https://geeknome.com), que se abre en una pestaña nueva.

- **División de Informática de Geeknome** — organización del proyecto.
- **Germán Peña** — autor e impulsor del proyecto.
- **DeepSeek** — herramienta de IA colaboradora en ideas, propuestas y revisión.
- **GitHub Copilot** — herramienta de IA colaboradora en implementación,
  documentación y pruebas.

Las herramientas de IA se reconocen como apoyo al desarrollo, no como personas
ni como una declaración de patrocinio o afiliación oficial con sus proveedores.

## Roadmap y licencia

Consulta [roadmap.md](./roadmap.md) (empieza por «Estado de un vistazo» y el «Plan priorizado»). Las fases son parciales: faltan
formateadores/linters, validadores más allá de JSON/JS/HTML básico, exportación
histórica exacta, grafo, experimentos/recetas, Git remoto y motores adicionales.

La licencia del proyecto **no está formalizada en un archivo LICENSE**.
El borrador anterior decía MIT; antes de publicarlo o presentarlo como MIT,
el titular debe confirmar la elección y añadir el archivo correspondiente.
Las dependencias conservan sus propias licencias.

> Dos mentes en bucle: la IA propone, el usuario decide y el resultado se verifica.
