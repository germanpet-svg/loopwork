# loopwork

**Taller local de archivos y código asistido por IA dentro de DeepSeek.**
Userscript basado en OPFS y Git: la IA propone, el usuario revisa y aprueba.

Versión actual: **1.5.32**. **114 pruebas Node** y validaciones aisladas en navegador.
Es un prototipo funcional, no un IDE completo ni un sistema de respaldo externo.

## Contenido

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
- Panel independiente del chat: ejecutar comandos locales no envía un mensaje al modelo.
- Importación múltiple desde la PC y descarga de archivos con sus bytes originales.
- Botones por archivo: **Editar · Ejecutar · Descargar · Eliminar**.
- Editor de texto con líneas, búsqueda/reemplazo literal, diff y aprobación.
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

No instala un motor WASM ni ofrece Python, Node, shell, dependencias, autocomplete
o validación semántica por lenguaje. El motor de edición verifica candidatos y
hashes, pero su recuperación transaccional todavía está incompleta.

## Instalación

1. Usa un navegador Chromium moderno, con OPFS, Web Crypto, Workers,
   Compression Streams y módulos dinámicos disponibles.
2. Instala un gestor de userscripts como
   [Tampermonkey](https://www.tampermonkey.net/).
3. Crea un script nuevo y pega completo
   [deepseek-disco.user.js](./deepseek-disco.user.js).
4. Guarda y abre o recarga [chat.deepseek.com](https://chat.deepseek.com/).
5. Comprueba que el panel muestra **v1.5.32**.

No hace falta npm para usarlo. Sí hace falta el gestor de userscripts; si el
navegador exige permisos adicionales para ejecutarlos, concédelos al gestor.
La compatibilidad con otros navegadores y futuras versiones de DeepSeek no está
certificada.

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
pueden requerir **Actualizar lista**. No hay botón de Revertir: consultar `git log`
o `git show` no restaura ni deshace un commit.

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
- Requiere mantener la página de DeepSeek abierta. Si la cierras o recargas,
  vuelve a pulsar **Ejecutar** para crear una nueva conexión. Si el archivo falta,
  no es UTF-8 válido o supera 256 KB, muestra un error y retira la vista anterior.

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

   También se reconocen bloques con `!propose 'JSON'` (incluido el prefijo
   configurado), pero solo con JSON inline: sin archivos, pipes, redirecciones
   ni `--share`. Otros comandos, incluido `!replace`, no son ejecutables desde
   este botón. En el panel puedes usar `!propose 'JSON'` como antes.

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
| `!write archivo texto` | Guarda texto mediante candidato y verificación |
| `!save archivo` | Guarda el último resultado textual; no exporta bytes históricos |
| `!cp origen destino` / `!mv origen destino` | Copia bytes verificados; mv confirma y borra origen tras comprobarlo |
| `!rm [-r] ruta` | Borra una ruta tras confirmación, sin rollback |
| `!view archivo [--from N] [--to N]` | Líneas numeradas y hash completo |
| `!propose propuesta.json` | Prepara un cambio JSON para el editor |
| `!replace archivo old new [--all] [--hash SHA256] [--dry-run]` | Literal único o todas las coincidencias no solapadas; diff/aprobación obligatorios |
| `!run archivo.html` / `!run archivo.js` | HTML estático en pestaña conectada o JS de consola aislado |
| `!journal [-n N]` | Consulta el journal básico, no toda la sesión |

### Git

| Comando | Alcance |
|---|---|
| `!git init` | Inicializa rama main |
| `!git status` | Cambios staged/unstaged y sin seguimiento |
| `!git add archivo` / `!git add --all` | Staging, incluidos borrados; metadatos internos excluidos |
| `!git commit -m "mensaje"` | Commit con cambios staged |
| `!git log` | Últimos diez commits |
| `!git diff [--staged] [ref]` | Staging/HEAD/ref frente a staging o working tree; no dos commits |
| `!git show [ref]` | Metadatos del commit; no su diff |
| `!git show ref:archivo` | Texto de archivo histórico sin restaurarlo |
| `!git branch [nombre]` | Lista o crea rama; crear no cambia de rama |
| `!git checkout rama` | Cambia a rama local existente con confirmación y estado limpio |

Las referencias admitidas por `show` son HEAD, rama o SHA completo; no SHA
abreviado, `HEAD~N` ni resolución de tags anotados.
Checkout bloquea editor abierto, modificaciones, staging pendiente y archivos
sin seguimiento o ignorados. No tiene force, checkout de archivos/commits ni
rollback automático. Un checkpoint no limpia esos cambios.

`!restore ID` restaura un checkpoint, **no es `git restore`**. Git remoto,
restauración Git de archivos y exportación de repositorios siguen pendientes.

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

- Copias hasta 256 KB, con bytes originales y hash en `.dv/checkpoints`.
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

| Acción | Qué se comparte con DeepSeek |
|---|---|
| Comandos locales, importar, editar, ejecutar, descargar | Nada por el canal de compartir del userscript |
| Revisar parche en DV → aprobar | Nada; revisión, checkpoint y escritura locales |
| `--share` | Resumen revisado del resultado |
| Botón Ejecutar + Compartir | Envía directamente el resumen (hasta 1200 caracteres), sin confirmación adicional |
| `--share-file ruta` | Texto completo del archivo, tras vista previa/confirmación |
| Selector Compartir archivo → Enviar archivo a DeepSeek | Envía directamente el texto completo del archivo elegido, sin confirmación adicional |

Compartir archivos requiere UTF-8 sin NUL y máximo **65536 bytes (64 KB)**.
Los mayores aparecen deshabilitados con explicación. El selector se actualiza
al abrir y tras refresh/importación; otra pestaña puede requerir reabrirlo.
Un borrador existente del chat no se reemplaza.
El clic en **Ejecutar + Compartir** autoriza el envío del resumen a DeepSeek.
En el selector, **Enviar archivo a DeepSeek** autoriza el envío directo del
archivo elegido; abrir el selector no envía nada.
Si el comando incluye `--share-file`, se mantiene la vista previa del mensaje
completo. Las confirmaciones propias de ejecución, edición y borrado no cambian.

**Local-first no significa cero red:** DeepSeek es un servicio remoto y Git/diff
se cargan bajo demanda desde esm.sh (`isomorphic-git@1.32.1`, `diff@7.0.0`).
No se suben archivos para cargar esas bibliotecas; el sitio y el código que
ejecuta en su origen siguen formando parte de la frontera de confianza.
El Shadow DOM no es una barrera de seguridad contra la página anfitriona.

OPFS pertenece al **origen de chat.deepseek.com**, no a una conversación ni a
un usuario del modelo. No hay separación por cuenta implementada. Otro
navegador/perfil/origen no ve automáticamente esos datos.

**Borrar datos del sitio puede eliminar archivos, Git, journal y checkpoints.**
El almacenamiento privado/incógnito puede ser temporal y la persistencia no es
garantizada. Descarga archivos importantes fuera del navegador.

El aviso **POSIBLE FUGA** correlaciona un intento manual reciente (5 segundos)
con el comando exacto aparecido fuera del panel. Ignora carga sin intento;
solo conserva el último intento. No verifica red ni recepción del servidor y
puede tener falsos positivos/negativos.

## Límites y recuperación

| Operación | Límite actual |
|---|---|
| Compartir archivo | 64 KB, UTF-8 sin NUL |
| Editor, propuestas, checkpoints, run, show histórico | 256 KB por archivo/candidato |
| Importación/copia verificada | 512 MB por archivo; hashing usa memoria |
| JS aislado | 3 segundos, 100 mensajes y unos 20 KB de logs |
| Vista de resultados en log | 800 caracteres; Ayuda tiene vista completa |
| Explorador | 50 filas; Eliminar todos incluye todos los archivos de usuario |

HTML no ejecuta scripts, navegación ni assets OPFS relativos. JS no dispone de
DOM, Node, imports/dependencias, red ni OPFS; usa `await` para tareas asíncronas.
No existe cuota estricta de memoria para el Worker. CSP del sitio puede bloquear
el entorno; no se degrada a ejecutar en la página principal.

Git protege estados confirmados; checkpoints guardan estados por archivo.
Journal registra algunas escrituras, pero es básico, no cubre toda la sesión y
sus fallos aún pueden ocultarse. No hay garantía de reversibilidad total:

- No hay backup universal antes de write/import/rm y otras operaciones.
- El helper llamado `atomicWrite` no implementa temp+rename ni recuperación
  persistente ante interrupciones.
- No hay bloqueo multipestaña; persisten ventanas de carrera.
- Una limpieza interrumpida puede dejar un checkpoint incompleto o binario huérfano.
- `Working tree limpio` no certifica los archivos ignorados ni todo el disco.

## Desarrollo y pruebas

Archivos principales:

- [deepseek-disco.user.js](./deepseek-disco.user.js): implementación.
- [tests/userscript.test.cjs](./tests/userscript.test.cjs): regresiones Node.
- [index.html](./index.html): laboratorio separado; sus pruebas no se integran
  automáticamente en el userscript.
- [roadmap.md](./roadmap.md): avances, evidencia y pendientes.

Con Node.js moderno y npm:

```text
npm ci
npm test
npm run check
```

114 pruebas cubren OPFS simulado y Git real, hashes, edición, sharing, checkpoints,
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

Consulta [roadmap.md](./roadmap.md). Las fases son parciales: faltan recuperación,
validadores, formateadores/linters, Git restore, diff entre commits, exportación
histórica exacta, grafo, experimentos/recetas, Git remoto y motores adicionales.

La licencia del proyecto **no está formalizada en un archivo LICENSE**.
El borrador anterior decía MIT; antes de publicarlo o presentarlo como MIT,
el titular debe confirmar la elección y añadir el archivo correspondiente.
Las dependencias conservan sus propias licencias.

> Dos mentes en bucle: la IA propone, el usuario decide y el resultado se verifica.
