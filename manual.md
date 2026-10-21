# Manual del usuario de loopwork

**Versión del manual: 1.15.0.** Taller local de archivos y código asistido por IA dentro de
DeepSeek, ChatGPT, Gemini y Claude. La IA propone, tú revisas y apruebas.

Este manual explica cómo usar loopwork paso a paso. Para una visión general y
límites técnicos, consulta el [README](./README.md); para el estado de desarrollo,
el [roadmap](./roadmap.md).

## Contenido

1. [Conceptos básicos](#1-conceptos-básicos)
2. [Instalación y primer arranque](#2-instalación-y-primer-arranque)
3. [Recorrido por el panel](#3-recorrido-por-el-panel)
4. [Trabajar con archivos](#4-trabajar-con-archivos)
5. [El editor integrado](#5-el-editor-integrado)
6. [El ciclo con la IA](#6-el-ciclo-con-la-ia)
7. [Versionar con Git local](#7-versionar-con-git-local)
8. [Checkpoints: copias de seguridad por archivo](#8-checkpoints-copias-de-seguridad-por-archivo)
9. [Ejecutar archivos](#9-ejecutar-archivos)
10. [Respaldo y almacenamiento](#10-respaldo-y-almacenamiento)
11. [Privacidad: qué sale y qué no](#11-privacidad-qué-sale-y-qué-no)
12. [Recuperación ante fallos](#12-recuperación-ante-fallos)
13. [Referencia de comandos](#13-referencia-de-comandos)
14. [Solución de problemas](#14-solución-de-problemas)
15. [Recetas rápidas](#15-recetas-rápidas)
16. [Glosario](#16-glosario)

---

## 1. Conceptos básicos

loopwork añade un **panel flotante** a la página del chat. Ese panel gestiona un
**disco virtual** con archivos, un editor, Git y copias de seguridad. Lo importante:

- **La IA no ve tu disco.** Solo conoce lo que tú le compartes de forma explícita.
- **Todo cambio pasa por ti.** La IA propone un parche; tú ves el *diff* y pulsas Aplicar.
- **Todo es local.** Los comandos del panel no se envían al chat ni gastan tokens.
- **Es reversible en la práctica**, pero no mágico: hay Git, checkpoints y un registro de
  escrituras, aun así no existe un "deshacer" universal (ver [sección 12](#12-recuperación-ante-fallos)).

### Dónde viven tus archivos

Hay dos opciones:

| Modo | Dónde están los archivos | Cuándo usarlo |
|---|---|---|
| **OPFS** (por defecto) | Almacenamiento privado del navegador, para ese sitio | Pruebas rápidas, sin tocar tu PC |
| **Carpeta real** | Una carpeta de tu PC que tú eliges | Proyectos que quieres ver con otras herramientas |

El almacenamiento OPFS **pertenece a cada sitio**: lo que guardes en DeepSeek no aparece
en ChatGPT, Gemini ni Claude. Para moverlo, exporta un ZIP en un sitio e impórtalo en otro.

## 2. Instalación y primer arranque

1. Usa un navegador **Chromium** moderno (Chrome, Edge, Brave…).
2. Instala [Tampermonkey](https://www.tampermonkey.net/) (o Violentmonkey).
3. Crea un script nuevo y pega completo `loopwork.js`.
4. Guarda y abre o recarga [chat.deepseek.com](https://chat.deepseek.com/),
   [chatgpt.com](https://chatgpt.com/) o [gemini.google.com](https://gemini.google.com/app) o
   [claude.ai](https://claude.ai/).
5. Comprueba que el panel muestra **v1.15.0**.

**Alternativa: extensión de Chrome.** En vez de Tampermonkey puedes cargar la carpeta `extension/`:
abre `chrome://extensions`, activa **Modo de desarrollador**, pulsa **Cargar descomprimida** y elige la carpeta.
No pide permisos, trae sus bibliotecas incluidas y evita que el chat intercepte **Ctrl+V** dentro del panel.
Usa solo una vía a la vez: con el userscript y la extensión activos aparecerían dos paneles.

**Actualizar:** pega la versión nueva *completa* (incluida la cabecera `==UserScript==`,
porque ahí se declaran las bibliotecas) y recarga el chat. No dejes dos versiones activas.

**Si el panel no aparece:** comprueba que el script está habilitado para el sitio, que no hay
varias versiones activas, y revisa la consola del navegador (F12).

### La bienvenida

La primera vez verás una guía con botones de ejemplo. Sus botones **solo preparan** el
comando en la entrada; tú decides cuándo ejecutarlo. **Entendido** la oculta; la recuperas
con **Primeros pasos**.

## 3. Recorrido por el panel

**Encabezado**

- **Estado:** *Listo · local*, *Operación en curso* o *Editor abierto*. Durante una
  operación los botones principales se bloquean.
- **Idioma:** Español · English · 简体中文. Se guarda y no requiere recargar. Se bloquea
  mientras haya una operación, el editor abierto o el modal de Git.
- **Ampliar / Reducir** y **Contraer / Abrir:** cambian el tamaño sin borrar tu comando.
- **Barra Git:** muestra rama y cambios pendientes, con los botones *Guardar cambios en Git*,
  *Ver cambios* y *Revertir…*.

**Cuerpo**

- Fila de almacenamiento (OPFS o carpeta real), con *Eliminar todos* y *Limpiar log*.
- Botones: **Nuevo archivo…**, **Explorar / Importar archivos…**, **Deshacer**, **Rehacer**, **Ayuda**, **Primeros pasos**.
- **Lista de archivos** con cuatro acciones por fila: **Editar · Ejecutar · Descargar · Eliminar**.
  Muestra hasta 50 filas; los nombres largos se acortan (el tooltip da la ruta completa).
- **Registro (log)** con la salida de los comandos.
- **Campo de comandos:** Enter ejecuta, Shift+Enter añade línea, ↑/↓ recorre el historial.
- **Ejecutar**, **Ejecutar + Compartir** y **Compartir archivo…**.
- **ⓘ** (esquina inferior): créditos del proyecto.

Puedes **arrastrar el encabezado** para mover el panel.

## 4. Trabajar con archivos

### Crear un archivo nuevo

1. Pulsa **Nuevo archivo…**.
2. Escribe el nombre (puede incluir carpeta: `web/index.html`) y pulsa Enter o **Abrir editor**.
3. Pega o escribe el código y pulsa **Crear archivo** (o Ctrl+S).

El archivo **no existe hasta que lo guardas**, y nunca sobrescribe uno existente. Si ya existía,
se abre para editar. Equivale a `!edit pagina.html`.

### Importar desde tu PC

**Explorar / Importar archivos…** acepta selección múltiple y copia los bytes originales a la
raíz del disco (hasta 512 MB por archivo). No sube nada al chat. Si un archivo ya existe,
se pide confirmación antes de reemplazarlo (y no hay deshacer automático).

### Descargar

**Descargar** pide al navegador guardar el archivo actual, sin convertir sus bytes. El mensaje
«Descarga solicitada» **no garantiza** que se haya guardado; revisa las descargas del navegador.

### Eliminar

**Eliminar** borra un archivo tras confirmación. **Eliminar todos** borra los archivos de
usuario y **conserva** `.git`, `.dv` (checkpoints y registro) y `.dv_tmp`. Si usas carpeta real,
la confirmación te avisa de que son archivos reales de tu PC.

**Copia previa automática (desde 1.7.0).** Antes de `rm`, `rm -r`, **Eliminar todos**, de
reemplazar un destino con `cp`/`mv`, de importar un archivo o un ZIP sobre uno existente y de
`write` sobre un archivo con contenido distinto, loopwork guarda un **checkpoint** del archivo
afectado (etiquetas «Antes de rm», «Antes de cp», «Antes de importar»…). La confirmación te dice
cuántas copias se guardarán y cuántos archivos **no** tendrán copia por superar 1 MB. Si no puede
guardar la copia, **no toca nada**. Recupera con `!checkpoint --list --tag "Antes de rm"` y
`!restore ID`. Los archivos internos (`.git`, `.dv`, `.dv_tmp`) no se copian.

**Deshacer y rehacer (`!undo`, `!redo`).** Un *paso* es todo lo que hizo una operación: las copias previas de `rm`, `cp`/`mv`,
importar, `write`, guardar desde el editor o una propuesta multiarchivo, o la **creación** de archivos y carpetas (`mkdir`,
`touch`, `mktree`, `write`, `cp`/`mv`, importar y el editor sobre un archivo nuevo).

```text
!undo --list     # pasos que se pueden deshacer, el más reciente primero
!undo            # deshace el último paso (pide confirmación)
!undo 3          # deshace tres pasos (máx. 50)
!redo            # rehace el último paso deshecho
!redo 2
```

- Los botones **Deshacer** y **Rehacer** del panel y **Alt+Z** / **Alt+Mayús+Z** (con el foco en el panel) hacen lo mismo; no
  tocan el Ctrl+Z del chat ni el del editor.
- Todo pide confirmación mostrando qué se va a tocar. Un archivo borrado se recrea; uno modificado vuelve a su contenido
  anterior; uno creado se borra tras guardar su contenido para poder rehacerlo. Una carpeta creada solo se quita si queda vacía.
- **Un cambio nuevo descarta lo que se podía rehacer.** `redo` se niega si el archivo cambió después de deshacer.
- El estado se guarda en `.dv/undo-state.json`: sobrevive a recargar la página.
- Repetir `undo` **no** rehace: retrocede otro paso (para volver adelante usa `redo`). Los archivos de más de 1 MB no tienen
  copia, así que su creación no se puede deshacer.

**Retención automática.** Se conservan hasta **20 copias por archivo** y 64 MB en total; lo más antiguo se borra solo, y la
copia más reciente de cada archivo nunca. El aviso aparece en el registro. Si necesitas conservar una versión, exporta el
ZIP o haz un commit de Git.

### Ocultar y mostrar el panel

La **✕** del encabezado oculta el panel y deja un botón flotante **💾 DV** abajo a la derecha; púlsalo para volver.
También alterna **Alt+Shift+D** y, en la extensión de Chrome, el **icono de la barra**. Se recuerda al recargar. Ocultar
no cierra el editor ni detiene nada.

### Comandos de archivo

```text
!ls -R
!write hola.txt "Hola mundo"
!cat hola.txt | head -n 5 > resumen.txt
!cp origen.txt copia.txt
!mv viejo.txt nuevo.txt
!rm -r carpeta
```

Redirección: `>` reemplaza, `>>` añade; un destino `.gz` se comprime (sin `>>`).

### Armar un proyecto desde cero: carpetas, árbol y `cd`

Las llaves funcionan como en bash:

```text
!mkdir -p app/{src,docs,tests/unit}
!touch app/src/{index,util}.js app/docs/guia.md
!tree app
!mktree web "sitio/
  css/
    estilo.css
  index.html"
!cat plan.txt | mktree proyecto
```

- Se admiten listas (`{a,b}`), anidadas, rangos (`{1..3}`, `{01..10}`, `{a..e}`); máx. 200 rutas por orden.
- `mktree` entiende un esquema con **sangría** (es carpeta si termina en `/` o tiene hijos) o el dibujo que produce `tree`;
  máx. 300 elementos. Planifica todo antes de crear nada: si algo choca (un archivo donde va una carpeta, o al revés) no toca el
  disco. Nunca sobrescribe.
- Git no registra carpetas vacías: usa `touch carpeta/.gitkeep`. Las carpetas vacías aparecen en la lista del panel («carpeta
  vacía»), en `ls` y `tree`, y viajan en el ZIP.

**Carpeta actual.** `!cd /datos` (o `!cd datos`) cambia la carpeta de trabajo; `!cd ..` sube, `!cd -` vuelve a la anterior,
`!cd /` o `!cd` a la raíz y `!pwd` la muestra. Después, `!ls`, `!cat a.txt`, `!write nuevo.txt "…"`, `!mkdir`, `!touch`,
`!mktree`, `!cp`, `!grep`, `!git add`, `!checkpoint`, las redirecciones `>` y demás resuelven las rutas desde ahí. El panel
muestra `· /datos` junto al estado, repite la carpeta delante de cada comando y su **lista de archivos** pasa a esa carpeta, con
filas **📁 carpeta/** y botón **Entrar**, y **Subir** para volver. Se recuerda al recargar y vuelve a la raíz si la carpeta
desaparece. No se puede entrar en `.git`, `.dv` ni `.dv_tmp`.

> Las propuestas `dv` de la IA, `!undo`, `!restore` y los checkpoints usan siempre rutas **desde la raíz**. La IA no sabe en
> qué carpeta estás: si un comando `!` suyo lleva una ruta relativa, se resolverá desde tu carpeta actual.

## 5. El editor integrado

Se abre con **Editar**, con **Nuevo archivo…** o con `!edit archivo`. Es una ventana que
puedes **mover** (arrastra la barra de título), **redimensionar** (esquina inferior derecha),
**minimizar** (conserva el borrador) y **ampliar**.

### Qué incluye

- Resaltado de sintaxis (JS/TS, HTML con `<script>`/`<style>`, CSS, JSON, Python, shell/YAML, Markdown).
- Números de línea y **minimapa** clicable y arrastrable.
- **Buscar/reemplazar** flotante con mayúsculas (`Aa`), expresiones regulares (`.*`) y `$1`.
- Cierre automático de paréntesis, comillas y etiquetas HTML; sangría inteligente.
- **HTML:** botón **Vista previa** (en vivo, sin scripts ni red) y **Pestaña** (se refresca al guardar). La vista previa recuerda si la dejaste abierta y se restaura al reabrir el editor.
- **JSON:** botón **Formatear**.
- **Guías de bloque** (JS, JSON, CSS, HTML, Python): entre los números de línea y el código, una línea vertical por cada bloque
  de varias líneas con una marca donde abre y otra donde cierra. Las llaves y corchetes se leen sin contar los de cadenas o comentarios;
  en Python se usa la sangría y en HTML las etiquetas. El bloque donde está el cursor se resalta, un clic en una guía selecciona
  el bloque entero y el botón **Guías** las oculta (se recuerda). Son solo visuales: no se pueden plegar.
- **Revisar** (JS, CSS, HTML, Python): lista llaves/paréntesis/corchetes sin cerrar o cruzados, cadenas o comentarios sin cerrar,
  `;` olvidado en CSS y, en Python, `:` que falta y sangría inconsistente. Cada aviso salta a su línea y, si el arreglo es seguro,
  ofrece **Arreglar**; **Arreglar todo** los aplica de una vez (un solo paso de Ctrl+Z). No cambia JS por «falta de `;`»:
  en JavaScript es opcional y adivinarlo cambiaría el programa.
- **Función** y **Reemplazar función** (JS, Python y `<script>` de HTML): seleccionan la función, método o clase del cursor
  (repetir amplía a la exterior) y la sustituyen por el portapapeles reajustando la sangría. Si el texto pegado tiene llaves
  o comillas sin equilibrar pide confirmación.
- Tamaño de letra A−/A+ (se recuerda), Copiar, Pegar, Descargar borrador.
- Barra de estado: línea/columna, selección, líneas, bytes, lenguaje, LF/CRLF.

### Atajos

| Atajo | Acción |
|---|---|
| Ctrl+S / 💾 Guardar | Muestra el diff y pide confirmación antes de guardar |
| Ctrl+F / Ctrl+H / F3 | Buscar / reemplazar / siguiente |
| Ctrl+D | Selecciona la palabra o la siguiente coincidencia |
| Ctrl+G | Ir a la línea |
| Ctrl+/ | Comentar o descomentar |
| Alt+↑/↓ · Shift+Alt+↑/↓ | Mover línea · duplicar |
| Ctrl+Shift+K | Borrar línea |
| Tab / Shift+Tab | Sangrar / quitar sangría |
| Shift+Alt+F | Formatear JSON |
| Alt+Shift+→ | Selecciona la función del cursor (repetir: la exterior) |
| Esc | Cierra ayuda, "ir a línea" o búsqueda; si no hay nada abierto, cierra el editor |

### Guardar con seguridad

1. Al guardar ves el **diff completo** y confirmas.
2. El guardado es **transaccional**: se escribe un temporal verificado, se registra en el
   journal y se comprueba el resultado.
3. **Cada guardado de un archivo existente crea antes un checkpoint** (etiqueta «Antes de guardar desde editor»);
   si no se puede verificar la copia, no se guarda. Recupéralo con `!undo`.
4. Si el archivo cambió mientras lo tenías abierto, **no se sobrescribe**: conserva tu
   borrador y vuelve a abrirlo.
5. Tras guardar, el editor **sigue abierto** para continuar (las propuestas del chat sí se cierran).
6. Cerrar con cambios sin guardar pide confirmación; la página avisa antes de cerrarse.

Límite: 1 MB, UTF-8 sin bytes NUL. BOM y CRLF uniforme se conservan.

## 6. El ciclo con la IA

```text
Archivo -> compartir explícitamente -> la IA propone
        -> Revisar parche en DV -> revisar diff -> aprobar
        -> ejecutar -> revisar Git -> commit / checkpoint
```

### Paso 1: compartir el archivo

Dos formas, ambas explícitas:

- **Compartir archivo…** (selector): **Enviar archivo al chat** envía el texto completo
  **de inmediato, sin segunda confirmación**. Máximo 64 KB, solo UTF-8. Los archivos mayores
  aparecen deshabilitados con el motivo.
- **Compartir con instrucción…**: marca hasta 8 archivos (64 KB en total), escribe qué quieres cambiar y,
  si quieres, incluye la lista de archivos del disco. Verás una **vista previa** antes de enviar. El mensaje
  lleva tu tarea, cada archivo con su hash y las reglas del protocolo (con varios archivos pide un bloque
  `changes`).
- Por comando: `!view programa.js --from 1 --to 20 --share` (resumen de hasta 1200 caracteres
  tras vista previa) o `!ls --share-file "programa.js"` (archivo completo, con vista previa).

El mensaje incluye el **SHA256** del archivo y las instrucciones para que la IA responda con un
bloque ```` ```dv ```` de JSON puro. Si ya tienes un borrador en el chat, **no se reemplaza**.

> Compartir gasta el contexto del chat. Lo local no.

### Paso 2: recibir la propuesta

La IA debe responder con un único objeto JSON:

```dv
{"path":"programa.js","hash":"HASH_REAL","operation":"replace","old":"return 1;","new":"return 2;"}
```

| Campo | Significado |
|---|---|
| `path` | Ruta exacta del archivo |
| `hash` | SHA256 completo (64 hex minúsculas) de la versión que la IA vio; no debe inventarlo |
| `operation` | `replace`, `insert-before`, `insert-after`, `append`, `patch` o `replace-function` |
| `old` | Texto exacto que aparece **una sola vez** (no se usa en `append` ni `patch`) |
| `new` | Texto exacto a insertar; los saltos se escriben `\n` (o `\r\n`) |
| `patch` | Solo con `operation: "patch"`: un diff unificado de **un** archivo (sin `old`/`new`) |
| `name` | Solo con `operation: "replace-function"`: nombre de la función (`render`) o `Clase.metodo`; sin `old` |

**Reemplazar una función entera.** `{"path":"app.js","hash":"…","operation":"replace-function","name":"render","new":"function render() {\n  …\n}"}`
sustituye la función completa (JS, Python y `<script>` de HTML); `new` debe incluir la **firma** y, en Python, los
decoradores si deben conservarse. Se rechaza si el nombre no existe, si es ambiguo (usa `Clase.metodo`) o si `new` tiene
llaves o comillas sin equilibrar (típico de una respuesta cortada). La sangría de `new` se ajusta a la del original;
después sigue el flujo normal de diff, aprobación y checkpoint.

**Varios archivos a la vez.** Un único bloque puede llevar `{"changes":[{…},{…}]}` (2 a 20 cambios, cada uno con su
`path`, `hash` y operación, sin repetir rutas). loopwork prepara **todos** antes de mostrar nada: si uno falla
(hash, bloque no encontrado, patch) no se propone ninguno. La revisión muestra el diff de cada archivo; **Aplicar todo**
comprueba otra vez todos los hashes, guarda un checkpoint por archivo (etiqueta «Antes de propuesta multiarchivo») y
escribe; si una escritura falla, devuelve a su versión original los ya escritos. No crea archivos nuevos ni commit.

**`patch` para cambios grandes.** Cada *hunk* debe coincidir exactamente donde dice (sin
tolerancia a líneas desplazadas); si uno falla se rechaza todo y el archivo no se toca. El hash
sigue siendo obligatorio y el cambio pasa por el mismo diff y la misma aprobación.

Si el hash es obsoleto, el bloque aparece dos veces o no aparece, la propuesta se **rechaza**.

### Paso 3: revisar y aplicar

- En el bloque del asistente aparece **Revisar parche en DV**. Si el JSON está incompleto, el
  botón permanece deshabilitado explicando por qué.
- Al pulsarlo se abre el editor con el diff. **No se guarda nada todavía.**
- **Aplicar cambios** crea y verifica un **checkpoint** de la versión anterior, comprueba el
  hash otra vez y guarda. Si falla el checkpoint, el archivo queda intacto.
- Después ejecuta y versiona tú mismo: la propuesta no ejecuta código ni hace commit.

### Comandos en bloques del chat

Si el asistente responde un bloque con **una sola línea que empieza por `!`** (por ejemplo
`!ls`), aparece **Ejecutar en DV**. Al pulsarlo se ejecuta localmente **sin modal de
confirmación inicial** y la salida va al panel. Se mantienen las confirmaciones propias del
comando (borrado, sobrescritura, ejecución de archivos).

### Atajo `!` en la entrada del chat

Escribir `!comando` en el chat y pulsar Enter lo ejecuta localmente. Es un atajo mitigado:
**prefiere el panel**, porque depende de la interfaz del sitio y de que Enter sea interceptado.

## 7. Versionar con Git local

Todo es local: no hay remoto, no hace falta cuenta de GitHub.

### Con botones (sin escribir comandos)

1. **Inicializar Git local:** crea la rama `main` y abre la revisión. No hace commit.
2. **Guardar archivo(s) en Git:** abre un modal con la lista completa de cambios (incluidos
   borrados), un mensaje sugerido editable y **Confirmar commit local**.
   - Equivale a `git add --all` + `git commit`: guarda las **versiones actuales de todos**
     los archivos listados, y **reemplaza el staging anterior**.
   - Cancelar no añade archivos ni crea commits.
   - Si algo cambia desde la revisión, el guardado se rechaza: usa **Actualizar lista**.
3. **Ver cambios:** muestra los dos diffs (working tree vs staging, y staging vs HEAD).
4. **Revertir…:** botón **Revertir** junto a cada archivo que existe en el último commit.
   Abre el editor con el diff, crea un checkpoint de tu versión actual y no escribe nada hasta
   que pulses **Aplicar**. No toca el staging ni deshace commits.

### Con comandos

```text
!git init
!git status
!git add --all
!git commit -m "mensaje"
!git log
!git log --oneline -n 5
!git log -- index.html          # solo commits que tocan ese archivo
!git diff            # working tree vs staging
!git diff 3d681c2 a007fc0       # entre dos commits o ramas
!git diff --staged   # staging vs HEAD
!git show HEAD:index.html
!git branch experimento
!git checkout experimento
!git restore --source HEAD index.html
```

Notas importantes:

- Referencias válidas: `HEAD`, nombre de rama o **SHA completo** (no `HEAD~N`). `git diff A B` y `git log` también aceptan SHA abreviado (7+ caracteres).
- `git show ref:archivo` lee texto UTF-8 hasta 1 MB; para traerlo de vuelta usa `git restore`
  o el botón Revertir (con `| save` o `>` el texto puede alterar saltos de línea).
- `git checkout` solo cambia a ramas locales existentes y **se bloquea** si hay cambios,
  staging pendiente o archivos sin seguimiento/ignorados. No tiene `--force`.
- `Working tree limpio` describe el estado de Git; **no** significa que tus datos del
  navegador estén respaldados.

## 8. Checkpoints: copias de seguridad por archivo

Un checkpoint guarda los **bytes exactos** de un archivo (hasta 1 MB), incluso si nunca se
hizo commit.

```text
!checkpoint prueba.txt "antes de editar"
!checkpoint --list
!checkpoint --list --file prueba.txt --tag "antes de"
!checkpoint --list --verify
!checkpoint show ID
!checkpoint show ID --content
!checkpoint diff ID1 ID2
!restore ID
```

El listado y la limpieza automática solo leen los metadatos y el tamaño (rápido); el hash completo se comprueba al
restaurar, ver o comparar. `--list --verify` comprueba todas las copias y marca con ⚠ las corruptas.

- `restore` vuelve a la ruta original. Si el archivo existe y es texto, pasa por editor y diff;
  si es binario o falta, pide confirmación directa. Siempre guarda antes otro checkpoint de la
  versión actual.
- **Limpieza** (irreversible y confirmada):

```text
!checkpoint delete ID
!checkpoint prune --keep 5
!checkpoint prune --older-than 7d
```

  Siempre se protege la copia más reciente de cada archivo (también los empates de fecha),
  así que `--keep 5` puede dejar más de cinco.
- `show`, `diff`, `delete` y `prune` son subcomandos reservados: para un archivo con ese
  nombre, usa `./show`.

## 9. Ejecutar archivos

El botón **Ejecutar** (o `!run archivo`) pide confirmación y admite dos tipos:

**HTML estático:** abre una **pestaña de vista previa conectada**.
- Sin scripts ni recursos externos; CSS inline e imágenes `data:` funcionan.
- Se actualiza al **guardar**, con **Actualizar desde disco** o con **F5**.
- No refleja borradores sin guardar.
- Necesita que la página del chat siga abierta; si la recargas, vuelve a pulsar Ejecutar.
- Permite ventanas emergentes si el navegador bloquea la pestaña.

**JavaScript de consola:** se ejecuta en un Worker aislado.
- Máx. 3 segundos, 100 mensajes y ~20 KB de logs. Usa `await` para tareas asíncronas.
- Sin DOM, Node, imports, red ni acceso al disco.
- En **Gemini** el ejecutor JS está bloqueado por la política de seguridad del sitio, y el
  panel lo informa. Eso no indica un error en tu archivo.

Para probar aplicaciones web interactivas, ábrelas fuera del chat con un servidor local.

## 10. Respaldo y almacenamiento

### Exportar e importar el disco (ZIP)

- **Exportar disco (.zip)…** descarga **todo**: archivos, carpetas vacías, `.git` y checkpoints. Se genera
  localmente, sin subir nada, y se abre con cualquier gestor ZIP.
- **Importar ZIP…** restaura un ZIP: los archivos con el mismo nombre se **reemplazan sin
  deshacer** (pide confirmación). Se verifica el CRC de cada entrada.

Es la forma recomendada de sacar una copia completa del navegador y de mover el disco entre
sitios (DeepSeek ↔ ChatGPT ↔ Gemini ↔ Claude).

### Carpeta real

1. Pulsa **Usar carpeta real…** (solo en navegadores Chromium).
2. Confirma la advertencia (solo la primera vez) y elige la carpeta.
3. Mientras esté conectada, **reemplaza a OPFS**: comandos, Git y editor trabajan sobre
   archivos reales de tu PC, con los permisos de tu usuario.

Si el navegador olvida el permiso en una sesión nueva, aparece **Reconectar carpeta…**.
**Volver a OPFS** deja de usarla sin borrar nada de la carpeta.

> **Importante:** "Borrar datos del sitio" puede eliminar archivos, Git, journal y checkpoints del
> modo OPFS. El modo incógnito puede ser temporal. **Exporta ZIP o descarga lo importante.**

## 11. Privacidad: qué sale y qué no

| Acción | ¿Se comparte algo con el chat? |
|---|---|
| Comandos locales, importar, editar, ejecutar, descargar, Git, checkpoints | No |
| Revisar parche en DV y aprobar | No |
| `--share` | Resumen que revisas (hasta 1200 caracteres) |
| Botón **Ejecutar + Compartir** | Envía el resumen **directamente**, sin confirmación adicional |
| `--share-file ruta` | Archivo completo, **con vista previa y confirmación** |
| **Compartir archivo → Enviar archivo al chat** | Envía el archivo **directamente**, sin confirmación adicional |

**"Local-first" no significa "cero red":**
- DeepSeek, ChatGPT, Gemini y Claude son servicios remotos.
- El gestor de userscripts descarga las bibliotecas Git y diff desde jsDelivr al instalar/actualizar
  (no se suben tus archivos). Si no estuvieran disponibles, se intenta cargarlas desde esm.sh.
- OPFS pertenece al origen del sitio, no a tu cuenta ni a una conversación.

**Aviso POSIBLE FUGA:** si pulsas Enter o enviar con un comando registrado y ese mismo texto
aparece fuera del panel en 5 segundos, se muestra una alerta. Es una **heurística del DOM**:
no verifica tráfico de red y puede tener falsos positivos y negativos. Ignora el historial
cargado automáticamente.

## 12. Recuperación ante fallos

Cada guardado sigue este camino:

1. Se escribe `.dv_tmp/<id>.tmp` y se verifica su SHA-256.
2. Se anota `PREPARED` en `.dv/journal.jsonl` (si no puede anotarse, no se escribe).
3. Se comprueba que el destino no cambió, se escribe y se verifica.
4. Se anota `COMMITTED` y se borra el temporal.

Si el navegador se cierra a medias, al abrir el chat (o con `!recover`) las transacciones
`PREPARED` de más de 2 minutos se resuelven:

| Situación | Resultado |
|---|---|
| El destino ya tiene la versión nueva | Se marca completada |
| Conserva la anterior | Se revierte |
| Cambió por otra vía | **No se sobrescribe**; la versión aprobada queda como `archivo.recuperado-<id>` |

Consulta el registro con `!journal -n 20`.

**Lo que NO está cubierto:** no hay copia automática antes de importar, `rm` o `mv`; sin
Web Locks puede haber carreras entre pestañas; una limpieza de checkpoints interrumpida puede
dejar restos; y `Working tree limpio` no certifica archivos ignorados. Git y checkpoints
complementan, pero **no son un respaldo externo**.

## 13. Referencia de comandos

`!help` (o el botón **Ayuda**) muestra siempre la lista actualizada. El prefijo `!` es
opcional dentro del panel. Los comandos y flags **no se traducen** al cambiar de idioma.

### Ficheros y texto

| Comando | Qué hace |
|---|---|
| `ls [-R] [ruta]` | Lista contenido |
| `cd [ruta]` · `pwd` | Cambian y muestran la carpeta actual (`cd /datos`, `cd ..`, `cd -`, `cd /`); las rutas relativas parten de ahí |
| `mkdir [-p] carpeta...` | Crea carpetas; con `-p` crea también las intermedias y no falla si ya existen |
| `touch [-p] archivo...` | Crea archivos vacíos; nunca pisa los existentes |
| `tree [-L N] [ruta]` | Dibuja el árbol (`├──`/`└──`), carpetas primero |
| `mktree [base] "esquema"` · `cat plan.txt \| mktree [base]` | Crea un árbol entero desde un esquema con sangría o con el dibujo de `tree`; no sobrescribe y no hace nada si hay conflictos |
| `cat [archivo...]` · `head [-n N] [archivo]` | Leen texto; aceptan pipes |
| `grep [-i] [-n] [-F] patrón [archivo]` | Busca por líneas (regex o literal) |
| `write archivo texto` | Escritura transaccional |
| `save archivo` | Guarda el último resultado textual |
| `cp origen destino` · `mv origen destino` | Copia verificada; `mv` siempre confirma |
| `undo [N]` · `undo --list` | Deshace los últimos N pasos (por defecto 1), con confirmación; `--list` los muestra |
| `redo [N]` | Rehace los pasos deshechos con `undo` |
| `rm [-r] ruta` | Borra tras confirmación, con copia previa (checkpoint) de hasta 1 MB por archivo |
| `edit archivo` | Abre el editor (en blanco si no existe) |
| `view archivo [--from N] [--to N]` | Líneas numeradas y hash completo |
| `propose propuesta.json` | Prepara un cambio JSON para el editor |
| `replace archivo old new [--all] [--regex] [--hash SHA256] [--dry-run]` | Reemplazo literal (o con regex: `$1`…`$99` y `$&` insertan grupo o coincidencia, `\$` da un `$` y cualquier otro `$` queda literal; sin coincidencias vacías, ambigua pide `--all`) con diff y aprobación |
| `run archivo.html` / `run archivo.js` | HTML estático o JS de consola aislado |

### Sistema y auditoría

| Comando | Qué hace |
|---|---|
| `checkpoint …` · `restore ID` | Ver [sección 8](#8-checkpoints-copias-de-seguridad-por-archivo) |
| `journal [-n N]` | Estado de las escrituras (PREPARED/COMMITTED/ABORTED/CONFLICT) |
| `recover` | Revisa escrituras interrumpidas y limpia temporales huérfanos |
| `diag` (botón **Diagnóstico**) | Informe del sitio y del script para pegar en un issue; no incluye mensajes ni archivos |
| `help` | Ayuda del registro de comandos |

### Git

`git init · status · add [archivo|--all] · commit -m · log [--oneline] [-n N] [-- archivo] · diff [--staged] [ref] | diff A B ·
show [ref|ref:archivo] · restore [--staged] [--source ref] archivo · branch [nombre] · checkout rama`

### Opciones de compartir (aplicables a cualquier comando)

| Opción | Efecto |
|---|---|
| `--share` | Envía el resumen del resultado al chat, con vista previa |
| `--share-file ruta` | Envía un archivo completo, con vista previa |
| `--` | Termina las opciones; `"--share"` entre comillas es texto literal |

### Pipes y reglas

```text
!cat entrada.txt | head -n 10 > salida.txt
```

`propose`, `replace`, `checkpoint`, `restore`, `edit`, `recover` y `git checkout` **no admiten**
pipes ni redirecciones. Los argumentos con espacios van entre comillas; el tokenizador no
interpreta escapes de shell como `\n`.

### Límites

| Operación | Límite |
|---|---|
| Compartir archivo | 64 KB, UTF-8 sin NUL |
| Editor, propuestas, checkpoints, run, show histórico | 1 MB |
| Importación / copia verificada | 512 MB por archivo |
| ZIP importado | 1 GiB |
| JS aislado | 3 s, 100 mensajes, ~20 KB |
| Log en panel | 800 caracteres por resultado (Ayuda tiene vista completa) |
| Explorador | 50 filas |

## 14. Solución de problemas

| Síntoma | Qué hacer |
|---|---|
| El panel no aparece | Revisa que el script está habilitado, que no hay dos versiones y la consola (F12) |
| El texto del editor aparece en el chat | Fue un bug de foco (corregido en 1.5.39); actualiza el script completo |
| No aparece **Revisar parche en DV** | La interfaz del sitio pudo cambiar: copia el JSON y usa `!propose '{…}'` en el panel |
| "hash obsoleto" | El archivo cambió: ejecuta `!view` de nuevo y pide una propuesta nueva |
| "bloque old ambiguo / no encontrado" | Pide a la IA un `old` único y literal; revisa espacios y saltos |
| "hay un borrador en el chat" | Borra o conserva tu borrador antes de compartir |
| El apóstrofe rompe `!propose` inline | Codifícalo como `\u0027` o importa un `.json` y usa `!propose archivo.json` |
| La pestaña HTML no se abre | Permite ventanas emergentes para el sitio |
| La vista previa dejó de actualizarse | La página del chat se recargó: pulsa **Ejecutar** otra vez |
| `run archivo.js` falla en Gemini (o en Claude) | La política de seguridad del sitio bloquea Workers; prueba fuera del chat |
| En Claude, el mensaje se queda en la entrada o el envío se cancela | Desde 1.5.41 se busca el botón por su etiqueta (también en español) y se usa Enter si no aparece. Si persiste, pulsa **Diagnóstico** y adjunta el informe al reportarlo |
| **Ctrl+V** no pega en el panel o el texto aparece en el chat (claude.ai) | Actualiza a 1.5.42. Si sigue pasando con el userscript, usa la extensión de Chrome: registra el aislamiento antes que los scripts del sitio. Mientras tanto, el botón **Pegar** del editor usa el portapapeles directamente |
| En Claude, el texto compartido no llega o el envío se cancela | El compositor de claude.ai es experimental: vacía la entrada, reintenta y, si persiste, copia el mensaje a mano y repórtalo con tu versión |
| Error de Git "sin inicializar" | Pulsa **Inicializar Git local** o `!git init` |
| `checkout bloqueado` | Haz commit o conserva tus archivos; no hay `--force` |
| Aviso POSIBLE FUGA | Revisa el chat; es solo una alerta heurística |
| Perdí datos tras borrar "datos del sitio" | OPFS se elimina: restaura desde tu ZIP o desde archivos descargados |

Para **reportar un fallo**, pulsa **Diagnóstico** (o `!diag`) y pega el informe; incluye además versión, navegador, comando o pasos, resultado esperado y
error. Usa un archivo mínimo, sin credenciales ni datos sensibles.

## 15. Recetas rápidas

**Corregir un archivo con ayuda de la IA**

1. **Nuevo archivo…** o **Importar** → pega/elige tu código.
2. **Compartir archivo…** → **Enviar archivo al chat** → explica qué quieres.
3. En la respuesta, pulsa **Revisar parche en DV** → revisa el diff → **Aplicar cambios**.
4. **Ejecutar** para probar → **Guardar cambios en Git**.

**Deshacer un cambio que no te gustó**

- Si hiciste commit antes: **Revertir…** (o `!git restore --source HEAD archivo`).
- Si no: `!checkpoint --list --file archivo` y `!restore ID`.

**Recuperar archivos tras "Eliminar todos"**

```text
!git status                      # los verás como deleted (unstaged)
!git restore --source HEAD index.html
```

**Hacer una copia completa antes de algo arriesgado**

**Exportar disco (.zip)…** y guarda el archivo fuera del navegador.

**Probar una idea sin tocar `main`**

```text
!git branch idea
!git checkout idea
```

## 16. Glosario

- **OPFS:** almacenamiento privado del navegador para un sitio.
- **Disco virtual:** el conjunto de archivos que gestiona loopwork (OPFS o carpeta real).
- **Diff:** comparación línea a línea entre la versión actual y la propuesta.
- **Hash / SHA256:** huella del contenido; detecta que un archivo es distinto, no que sea correcto.
- **Propuesta:** JSON `dv` con un cambio; no se aplica sin tu aprobación.
- **Checkpoint:** copia de bytes de un archivo, independiente de Git.
- **Staging:** zona intermedia de Git entre tus archivos y el commit.
- **Journal:** registro de escrituras (`PREPARED`/`COMMITTED`) usado para recuperación.
- **Working tree:** los archivos tal como están ahora en tu disco.
- **Carpeta real:** una carpeta de tu PC conectada mediante la API del navegador.
