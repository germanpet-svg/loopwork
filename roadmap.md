# Roadmap: Entorno de edicion y analisis local (OPFS + WASM + Git)

Proyecto: **loopwork** (userscript `loopwork.js`). Documentos
hermanos: [README](./README.md) (vision general y limites) y
[manual del usuario](./manual.md) (uso paso a paso).

## Estado de un vistazo (1.13.0)

**Funciona y tiene pruebas** (135/135 pruebas Node en la ultima ejecucion
registrada, mas validaciones en navegador con OPFS nativo):

- Disco virtual OPFS o carpeta real; exportar/importar ZIP completo.
- Editor integrado con diff y aprobacion; escrituras transaccionales con
  journal y recuperacion al iniciar.
- Protocolo `dv` de propuestas con hash; boton **Revisar parche en DV**.
- Git local (init, add, commit, log, diff, show, branch, checkout protegido,
  restore) y botones de guardado/revision/reversion sin escribir comandos.
- Checkpoints por archivo (listar, ver, comparar, restaurar, limpiar) y **copia previa automatica** antes de rm, mv/cp que sobrescriben, importar, ZIP y write.
- Propuestas `patch` (diff unificado exacto), `replace --regex`, avisos de validacion (JSON/JS/HTML), `git diff A B`, `git log --oneline/-n/-- archivo` y `!diag`.
- Suite de navegador en `tests/e2e` (Playwright) y comprobacion de cobertura de traducciones en `tests/unit`.
- Vista previa HTML conectada y JavaScript de consola aislado.
- Interfaz en espanol, ingles y chino simplificado.
- Extension de Chrome (MV3) generada desde el mismo userscript, sin permisos.

**Verificado en uso real:** DeepSeek (chat.deepseek.com).
**Experimental:** ChatGPT y Gemini (solo verificados en sesion anonima;
falta confirmacion con cuenta real), Claude (claude.ai, nuevo en 1.5.40, sin
probar con cuenta real), carpeta real, `run archivo.js` (no
disponible en Gemini por CSP).

**Siguiente:** ver el [plan priorizado](#plan-priorizado-revision-2026-10-16).

## Plan priorizado (revision 2026-10-16)

Revision de las 87 casillas pendientes. Criterio: **solo entra lo que mejora el
bucle real** (compartir -> proponer -> revisar -> aplicar -> probar -> versionar),
reduce el riesgo de perder datos o mantiene vivos los adaptadores de cada chat.
Lo demas se aparca con motivo (abajo), en lugar de dejarlo como promesa.

Esfuerzo: S = horas, M = uno o dos dias, L = una semana o mas.

### Prioridad 1 - estabilidad y confianza (1.5.44 - 1.6.0)

| # | Que | Por que sirve | Esf. | Hecho cuando |
| - | --- | ------------- | ---- | ------------ |
| 1 | ✅ **1.6.0** (parcial: arnes, claude.ai, editor, pegado, Git, copias; faltan fixtures de DeepSeek/ChatGPT/Gemini) **Pruebas de navegador en el repo** (Playwright): arnes con shadow DOM abierto, fixtures del DOM de cada sitio (composer, boton de enviar, bloques del asistente) y casos de editor, vista previa, pegado y Git | Los fallos de 1.5.39 a 1.5.43 (foco, boton de enviar localizado, Ctrl+V, vista previa) fueron de interfaz y las 135 pruebas Node no los cubren. Absorbe `!selftest` y el test "crear -> commit -> cerrar -> reabrir -> hash" | M | `npm run e2e` pasa y falla si se rompe un selector |
| 2 | ✅ **1.6.0** **Diagnostico del sitio**: boton/`!diag` que genera un informe copiable (version, sitio, entrada, boton de enviar, bloques del asistente, CSP/Workers/Trusted Types, OPFS) sin datos del usuario | Confirmar ChatGPT, Gemini y Claude con cuentas reales sin depender de capturas; cada reporte trae lo necesario | S | El informe se genera en los 4 sitios y se pega en un issue |
| 3 | ✅ **1.6.0** (variante: usa checkpoints y `!restore`, no `.dv/trash`; sin copia sobre 1 MB, y la confirmacion lo avisa) **Papelera y copia previa** en `rm`, `mv` que sobrescribe, importar archivo/ZIP y Eliminar todos: `.dv/trash/<id>/`, `!trash --list`, `!undelete ID`, purga confirmada | Cierra el hueco que la documentacion admite ("no hay copia antes de rm/mv/import") y cumple "reversible siempre" | M | Ninguna operacion del panel destruye bytes sin copia recuperable (hasta el limite) |
| 4 | ✅ **1.6.0** **Traducciones sin excepcion**: si falta una clave, usar el espanol y registrar la clave en el log; prueba que lista claves sin traducir | Hoy `t()` lanza `Missing translation` en ingles/chino: peor que un texto sin traducir | S | Cambiar idioma nunca rompe una accion |
| 5 | ⏳ **pendiente de decision del titular (licencia) y de la URL del repo** **LICENSE y empaque**: archivo de licencia, `@updateURL/@downloadURL`, nombre `loopwork.user.js` para instalar desde GitHub, politica de privacidad | Necesario para publicar y para que Tampermonkey actualice solo | S | Instalar desde la URL raw ofrece actualizacion |

### Prioridad 2 - mejorar el bucle con la IA (1.6.x)

| # | Que | Por que sirve | Esf. | Hecho cuando |
| - | --- | ------------- | ---- | ------------ |
| 6 | ✅ **1.6.0** **Propuesta `patch` (diff unificado)** y `replace --regex`: `Diff.applyPatch` ya esta cargado; hash obligatorio, sin tolerancia, rechazo si no aplica limpio; misma revision con diff | Los modelos escriben diffs con soltura; el `old` unico es fragil en cambios grandes | M | Un diff multi-hunk se aplica o se rechaza entero |
| 7 | ✅ **1.6.0** **Validacion antes de aplicar**: JSON (`JSON.parse`), JS (solo compilar, sin ejecutar, si la CSP lo permite), HTML (etiquetas sin cerrar); resultado como aviso en la revision | Detecta propuestas rotas antes de guardar; si no puede validar, lo dice | S-M | La revision muestra "valido / invalido / no verificable" |
| 8 | ✅ **1.7.0** (solo edita archivos existentes; no crea nuevos) **Propuestas multiarchivo**: un `dv` con `changes: [...]`, una revision, verificar todos los hashes antes de escribir, checkpoint por archivo | Los cambios reales rara vez tocan un solo archivo | M-L | Si un archivo falla la verificacion no se escribe ninguno |
| 9 | ✅ **1.7.0** **Compartir con instruccion**: caja "que quieres cambiar" + archivos elegidos + arbol (`!tree`) en un envio, con tope de 64 KB y vista previa | Hoy son varios pasos manuales; es la mayor friccion del uso diario | M | De "elegir archivos" a "mensaje enviado" en un flujo |
| 10 | ✅ **1.6.0** (sin `.gitignore` por defecto: los metadatos internos ya se excluyen) **Git para revisar**: `git diff A B` entre commits/ramas, `log --oneline`, `log -- archivo`, `.gitignore` por defecto | Es lo que falta para entender que cambio la IA (README lo lista como carencia) | M | Se ve el diff de cualquier par de commits |
| 11 | ⏳ **sin hacer** **Descarga exacta de una version Git** (HEAD o SHA) y `git archive` como ZIP reutilizando el escritor ZIP | Entrega el resultado sin friccion; bytes exactos | S | Descargar `ref:archivo` coincide byte a byte |

### Prioridad 3 - despues de usarlo con cuentas reales

| # | Que | Nota |
| - | --- | ---- |
| 12 | **Modularizar** `src/*.js` + compilacion a `loopwork.js` y `extension/` | Hacerlo despues del punto 1, con la red de pruebas puesta |
| 13 | **Probar en una rama**: aplicar la propuesta en una rama nueva sin tocar `main` | Util, pero exige reglas claras de `checkout` con cambios pendientes |
| 14 | **Prettier opcional** (JS/CSS/JSON/MD/HTML), solo en la extension y empaquetado aparte | Un formateador cubre la mayoria del valor; el resto no compensa |
| 15 | **`!test` minimo para JS**: aserciones en el Worker aislado, sin frameworks | Reemplaza la idea de ejecutar Jest/pytest en el navegador |
| 16 | **Git remoto solo en la extension**, permisos opcionales y token en memoria | GitHub no permite CORS en git por HTTP desde una pagina; la extension si podria. Opt-in, con confirmacion antes de cada push |
| 17 | **Vista de ramas en texto** (`log --graph` simple) | Antes que cualquier grafo visual |

### Aparcado o descartado (con motivo)

| Fase / item | Decision | Motivo |
| ----------- | -------- | ------ |
| 7 Formateadores Black, gofmt, rustfmt, shfmt | Aparcado | Cada uno exige su propio WASM y mantenimiento; el valor esta en Prettier |
| 8 Linters ESLint, Ruff, Clippy, shellcheck | Aparcado | Igual que arriba; un linter completo no cabe en un userscript |
| 9 Jest, Vitest, pytest, cargo test, go test | Descartado | Necesitan runtime, dependencias y sistema de archivos; se reformula como `!test` minimo (punto 15) |
| 6 YAML, Python y Shell por WASM | Aparcado | Sin demanda; JSON/JS/HTML cubren el uso actual |
| 10 Experimentos, recetas, registro de ideas | Aparcado | Es un producto aparte; antes hay que ver si alguien lo usa. Git + checkpoints ya guardan el rastro |
| 13 Aprendizaje compartido, modo exploracion | Aparcado | Sin definicion concreta ni criterio de hecho |
| 11 OAuth device flow, submodulos, hooks | Descartado | GitHub no ofrece CORS para ese flujo desde una pagina; el riesgo supera el beneficio |
| 0.5 Modelo de datos comando/commit/experimento/receta | Aparcado | Solo tiene sentido si se retoma la Fase 10 |
| `!git checkout <commit>` (HEAD separado) | Aparcado | `restore --source` ya cubre recuperar una version sin peligro |
| `!sed`, `!jq` | Descartado | Se cubren con `replace --regex` y propuestas `patch` |

## Vision

Entorno 100% local en el navegador donde:

- Los datos viven en OPFS
- Motores WASM procesan sin subir nada
- La IA propone, el usuario ejecuta, ambos observan en vivo
- El bucle es iterativo, ramificable y reversible
- Cada paso es una oportunidad de aprendizaje y bifurcacion

Universal por diseno: sirve para programacion (foco principal),
analisis de datos, edicion de texto, y bioinformatica (colateral
soportada). Los motores especializados son usuarios del entorno,
no su proposito.

## Publico objetivo

- Principal: programadores que quieren editar y versionar codigo
  desde el navegador, con IA, sin subir nada.
- Secundario: analistas de datos, editores de texto.
- Colateral: bioinformaticos y otros dominios con motores WASM.

## Arquitectura de roles

- CHAT IA -> piensa, propone, diagnostica. No escribe archivos.
- CHAT PLUGIN -> ejecuta comandos sobre OPFS. Sin consumo de tokens.
- MODAL -> muestra diff, estado Git, arbol, errores.
- USUARIO -> aprueba, ejecuta, observa, bifurca.
- MOTOR -> candidato -> validar -> aplicar atomicamente.
- GIT -> historial, ramas, comparacion.

## Las tres capas de seguridad

Git NO es suficiente. Protege lo versionado, pero no:

- Archivos sin trackear.
- Operaciones a medias.
- Archivos ignorados.
- El estado entre working tree y commit.

| Capa                 | Que protege                                  |
| -------------------- | -------------------------------------------- |
| Git                  | Historial, ramas, comparacion de estados     |
| Motor transaccional  | Candidato -> validar -> aplicar atomicamente |
| Registro operaciones | Recuperacion + auditoria                     |

Regla: una operacion no se considera terminada hasta que el
sistema verifica el resultado.

## Los cuatro conceptos separados

- Comando: que operacion se quiere ejecutar
- Commit: que estado se guardo
- Experimento: que hipotesis se evalua, con que pruebas
- Receta: como reproducir una transformacion

Un commit no explica por que. Una receta si documenta el
procedimiento. Un experimento agrupa ramas y resultados.

## Principios de diseno

1. Todo local. Nada sube salvo decision explicita.
2. El usuario ve antes de aplicar (dry-run por defecto).
3. Reversible siempre (Git + motor + registro).
4. El error es feature, no bug.
5. Friccion pedagogica intencional (copia-pega ensena).
6. El output real son las bifurcaciones, no solo el archivo.
7. Universal por diseno: no asume dominio.
8. Ninguna edicion sobrescribe silenciosamente un original.

## Privacidad por operacion

| Modo                  | Que se envia                                |
| --------------------- | ------------------------------------------- |
| Local                 | Nada. Resultados no se adjuntan.            |
| Compartir diagnostico | Solo el resumen que el usuario revisa.      |
| Compartir archivo     | Muestra que se enviara y pide confirmacion. |

Verificable, no declarativo.

## Lo que ya esta probado en el laboratorio

- isomorphic-git sobre OPFS: pruebas aisladas reportadas por el usuario.
- Adapter OPFS del laboratorio (makeFs), distinto al del userscript.
- Sandbox aislado (**dv_git_test**/).
- Validacion de rutas (cleanPath).
- Deteccion de cambios externos via statusMatrix.
- Tests integrados en el navegador.

Las pruebas del laboratorio (laboratorio.html) NO se integran automaticamente en el userscript.
Su test E2E contiene siete pasos, pero releer archivos no equivale a cerrar
y reabrir el navegador. No dar ese criterio por certificado.

## Carpeta real opcional via File System Access API (1.5.36)

- Boton **Usar carpeta real...** en el panel: abre `showDirectoryPicker`,
  pide permiso readwrite, guarda el `FileSystemDirectoryHandle` en IndexedDB
  (`dv-fs-handles`) y lo usa como `rootDir` en lugar de OPFS mientras este
  conectado.
- Sin cambios en getHandle/walk/writeBytes/makeFs (Git): todo opera sobre la
  misma interfaz `FileSystemDirectoryHandle`/`FileSystemFileHandle`, asi que
  Git, checkpoints, editor y el protocolo `dv` funcionan igual sobre la
  carpeta real.
- Al reabrir, `queryPermission` reactiva la carpeta sin pedir nada si el
  navegador aun recuerda el permiso; si no, aparece **Reconectar carpeta...**
  (requiere gesto del usuario, sin volver a elegir carpeta).
- **Volver a OPFS** limpia el handle guardado y regresa al almacenamiento
  privado sin tocar los archivos de la carpeta real.
- Confirmacion explicita antes de conectar (advierte que los comandos podran
  escribir/borrar en esa carpeta) y aviso reforzado en "Eliminar todos"
  cuando el modo activo es carpeta real.
- Solo disponible en navegadores Chromium con `showDirectoryPicker`; el boton
  se oculta si la API no existe.
- 1.5.37: el confirm() de advertencia al conectar solo se muestra la primera
  vez (persistido en localStorage `dv.localFolder.consent.v1`); conexiones
  siguientes van directo al picker nativo + permiso, que ya es la barrera
  real de seguridad.

## Exportar/Importar disco completo como ZIP (1.5.38)

- Botones **Exportar disco (.zip)...** / **Importar ZIP...** en el panel,
  junto a los de carpeta real.
- Escritor y lector ZIP propios (sin dependencias externas): CRC32 manual,
  `CompressionStream('deflate-raw')`/`DecompressionStream('deflate-raw')`
  nativos para el metodo deflate, y metodo store (0) cuando deflate no
  reduce el tamano o el archivo esta vacio. Formato estandar, abrible con
  cualquier gestor de archivos o herramienta ZIP.
- Exportar recorre `walk(rootDir)` completo, incluyendo `.git` y `.dv`
  (checkpoints): es un respaldo real del disco, no una exportacion parcial
  para compartir con el chat.
- Importar pide confirmacion explicita una sola vez (reemplaza archivos
  existentes sin deshacer), valida tamano maximo (`MAX_ZIP_BYTES`, 1 GiB),
  verifica el CRC32 de cada entrada antes de escribirla y usa `splitPath`
  (ya validado contra path traversal) para resolver cada ruta dentro de
  `rootDir`.
- Funciona igual en modo OPFS o carpeta real conectada, porque opera sobre
  la misma interfaz generica de `rootDir`.
- Cubierto por 2 tests nuevos (round-trip con archivos binarios/vacios/
  internos, y errores: disco vacio, busy, confirm cancelado, ZIP demasiado
  grande, EOCD invalido, CRC corrupto).

## Soporte experimental para ChatGPT (1.5.38)

Primer paso del punto "funciona con otros chats" del roadmap: el protocolo
`dv` (path + hash + replace) nunca dependio de DeepSeek, solo el adaptador
de sitio que lee la entrada de chat y detecta bloques de codigo. Cambios:

- `@match` ampliado a `https://chatgpt.com/*` y `https://chat.openai.com/*`
  ademas de `chat.deepseek.com`.
- `adapter.getInput()` prioriza `<textarea>` visible (igual que antes) y
  ahora cae a `[contenteditable="true"]` si no hay ninguna (cubre futuros
  composers tipo ProseMirror/Lexical). Verificado en vivo: la version
  anonima de chatgpt.com sigue usando `<textarea>`, por lo que el deteccion
  original ya funcionaba sin cambios.
- `adapter.getText`/`setText` distinguen por duck-typing (`el.value !==
  undefined`) en vez de por `tagName`, para soportar tanto textarea como
  contenteditable sin romper mocks de test.
- `adapter.findSend(input)` probaba antes "el ultimo boton visible con
  icono subiendo hasta 8 ancestros" desde el input; en ChatGPT eso devolvia
  el boton equivocado (p.ej. "Add files and more"), porque el boton real de
  enviar vive varios niveles mas arriba que otros iconos visibles. Ahora se
  intenta primero una lista de selectores conocidos de otros sitios
  (`[data-testid="send-button"]`, `[data-composer-submit]`, `aria-label`
  "Send message"/"Send prompt") y solo si ninguno aparece se usa la
  heuristica generica (que sigue siendo la que resuelve DeepSeek).
- Deteccion de rol de mensaje (usuario vs. asistente) en
  `installChatCodeActions` ampliada con `[data-message-author-role="user"
  /"assistant"]` (DOM real de ChatGPT, confirmado via busqueda), sin tocar
  los selectores existentes de DeepSeek (`data-message-role`, `data-role`,
  `.ds-markdown`).
- Verificado abriendo chatgpt.com (sesion anonima) e inspeccionando el DOM
  real del composer y el boton de enviar; no se pudo probar una conversacion
  logueada real (requiere cuenta del usuario), asi que el deteccion de
  bloques `dv` en respuestas del asistente y el flujo logueado completo
  quedan pendientes de confirmar por el usuario con Tampermonkey instalado.
- Sin cambios de `@grant`/permisos adicionales; Tampermonkey pedira
  confirmar el nuevo dominio al actualizar el script.
- Cubierto por 3 tests nuevos: deteccion de bloques `dv` con marcado
  `data-message-author-role`, preferencia del selector de envio conocido
  sobre la heuristica generica (reproduce el bug encontrado en ChatGPT), y
  fallback a contenteditable cuando no hay textarea visible.
- Pendiente (no incluido aqui): genericizar los textos de UI que dicen
  "DeepSeek" explicitamente (botones, confirmaciones, mensajes de log); hoy
  son cosmeticos y no afectan la funcionalidad en otros sitios.

## Soporte experimental para Gemini (1.5.3x, antes de 1.5.39)

Segundo sitio adicional tras ChatGPT. El protocolo `dv` no cambia; solo el
adaptador de sitio.

- `@match` incluye `https://gemini.google.com/*`.
- Entrada: editor Quill (`rich-textarea .ql-editor[contenteditable="true"]`).
- Bloques del asistente (`model-response` / `code-block`): Gemini muestra los
  lenguajes desconocidos, `dv` incluido, como "Code snippet". Por eso un bloque
  JSON de una respuesta de Gemini tambien ofrece **Revisar parche en DV**, pero
  el boton solo se habilita si el JSON cumple el esquema de propuesta.
- Los comandos `!` de una sola linea muestran **Ejecutar en DV** y se ejecutan
  localmente sin modal de confirmacion inicial.
- Vista previa HTML: con Trusted Types activo se usa la politica privada
  `dv-static-preview`; no se crea una politica `default` ni se relaja la CSP.
- `run archivo.js` NO funciona en Gemini: su CSP bloquea tanto el script de
  arranque del iframe Blob como los Workers Blob. El panel lo informa sin
  degradar el sandbox.
- Verificado sin iniciar sesion: montaje del panel, entrada Quill y
  cancelacion/ejecucion local de `!ls` desde un bloque real. **Pendiente:**
  validar con una cuenta (incluida Pro).
- El OPFS es por origen: Gemini no ve los archivos de DeepSeek ni de ChatGPT;
  se trasladan con Exportar/Importar ZIP.

## Comandos y sintaxis de bash (1.16.0)

- **Hecho:** `echo tail wc sort uniq tee find stat rmdir basename dirname date whoami man which history clear env printenv
  export unset true false`; `grep` con varios archivos y `-r -l -c`; `cat -n`; `ls -l/-a/-h` (aceptados) y varias rutas; `rm`
  con varias rutas, `-f` y `-rf`; `cp`/`mv` hacia una carpeta existente.
- **Sintaxis:** `;`, `&&` y `||` (el estado es el del último comando ejecutado), variables `export X=v` con `$X` y `${X}`
  (las no definidas, como `$1` o `$&`, se dejan tal cual), comodines `*` y `?` por segmento en `ls cat head tail wc sort uniq rm
  stat view grep`; los archivos con punto inicial solo se casan con un punto explícito.
- Límites conocidos: sin `&`, subshells, `$(…)`, heredocs, `if/for`, `sed`, `awk` ni `diff`; las variables solo viven en la sesión;
  los comodines no son recursivos (usa `find`); los comandos con editor (`replace`, `propose`, `edit`, `checkpoint`, `restore`,
  `recover`) no se pueden encadenar. Un `;` o `&&` sin comillas dentro de un texto ahora separa comandos: escríbelo entre comillas.
- Inspirado en el catálogo de comandos de Termly (`help`, `whoami`, `pwd`, `printenv`, `export`, `cd`, `ls`, `cat`, `man`,
  `history`), cuyo código es GPLv3 y **no** se ha copiado: todo es implementación propia sobre el disco de loopwork.

## Carpeta actual: cd y pwd (1.14.0)

- **Hecho:** `cd [ruta]` (`/datos`, `..`, `-`, `/`, sin argumento = raíz) y `pwd`. Los comandos de ficheros y texto
  (`ls tree cat head grep rm mkdir touch cp mv view edit run write save replace mktree`, `git add/restore/log --`,
  `checkpoint`) y las redirecciones `>` / `>>` resuelven las rutas desde la carpeta actual; `ls` y `tree` sin argumento usan
  la actual y `mktree` crea el árbol en ella. El estado del panel y el eco de cada comando muestran la carpeta.
- Se guarda en el navegador (se conserva al recargar) y se restablece a la raíz si la carpeta desaparece. No se puede
  entrar en `.git`, `.dv` ni `.dv_tmp`, y una ruta con `..` que sale del disco da error (salvo en `cd`, que se queda en la raíz).
- **Aviso:** la IA no sabe en qué carpeta estás. Los bloques `dv` (propuestas) y todo lo guardado por el sistema usan rutas
  desde la raíz; si un comando `!` que escribe la IA lleva rutas relativas, se resolverán desde tu carpeta actual.

## Deshacer y rehacer de varios pasos (1.12.0 y 1.13.0)

- **Hecho:** `undo [N]`, `undo --list` y `redo [N]`. Un paso es un grupo de checkpoints de la misma operación (misma etiqueta,
  máx. 10 s) o una creación registrada (`mkdir`, `touch`, `mktree`, `write` o editor sobre un archivo nuevo).
- Estado persistente en `.dv/undo-state.json` (pasos ya deshechos, pila de rehacer y creaciones, con tope de tamaño);
  sobrevive a recargas. Las copias que solo sirven para rehacer llevan la etiqueta `↶ rehacer`, no cuentan como pasos
  y la poda automática no las toca; se borran al rehacer o al hacer un cambio nuevo.
- Deshacer una creación guarda antes el contenido (para rehacer) y borra; las carpetas solo se quitan si quedan vacías,
  y `redo` se niega si el archivo cambió después de deshacer. Todo pide confirmación; el diff del editor ya no se usa aquí.
- **Cambio de comportamiento:** ya no basta repetir `undo` para rehacer; ahora retrocede otro paso y `redo` rehace.
- Botones **Deshacer/Rehacer** en el panel y atajo Alt+Z / Alt+Mayús+Z con el foco en el panel (no toca Ctrl+Z del chat).
- `cp`, `mv`, importar archivos e importar ZIP también registran lo que crean. El ZIP exporta e importa las **carpetas vacías**,
  y el panel las lista como «carpeta vacía».
- Límites: un archivo de más de 1 MB no se puede deshacer como creación (no habría copia para rehacer); `>` y `save` sobre
  un archivo nuevo no se registran todavía; `mv` genera dos pasos (copia y borrado del origen).

## Árboles de carpetas desde el panel (1.11.0)

- **Hecho:** `mkdir [-p]`, `touch [-p]`, `tree [-L N]` y `mktree` (esquema con sangría o dibujo de `tree`,
  por argumento o por pipe). Expansión de llaves tipo bash (`{a,b}`, anidadas, `{1..3}`, `{01..10}`, `{a..e}`,
  máx. 200 rutas por orden y 300 elementos por esquema).
- `mktree` planifica todo antes de crear nada: ante cualquier conflicto (archivo en el camino, nombre usado como
  archivo y carpeta) no crea nada. Nunca sobrescribe; las rutas internas (`.git`, `.dv`, `.dv_tmp`) se rechazan.
- Límites conocidos: Git no registra carpetas vacías (usar `touch carpeta/.gitkeep`); las carpetas vacías no salen
  en la lista de archivos del panel pero sí en `ls` y `tree`; la exportación ZIP de carpetas vacías no está verificada.

## Checkpoints sin rehashear y mejoras descartadas (1.10.2)

- **Hecho:** `checkpointInventory` ya no hashea cada copia. El listado, la poda automática, `undo` y `delete`/`prune` usan solo el
  `.json` y el tamaño del `.bin`; el hash completo se comprueba al restaurar, ver o diff (`readCheckpoint` sigue verificando) y
  antes de borrar. `checkpoint --list --verify` marca con ⚠ las copias corruptas. Con el tope de 64 MB, cada guardado ya no relee hasta 64 MB.
- **Descartado por poca importancia** (se retoma solo si aparece un problema real): diferir la poda con temporizador (la poda ya es barata
  y un temporizador puede dejar copias de más), limpiar las copias de `applyBatch` si falla antes de escribir (ruido inofensivo, y en un
  lote ya escrito se necesitan para `!undo`), `SITE_NAME` como función (el host no cambia durante la vida de la página) y el
  `installFocusTrap` del panel (fuga mínima al cambiar de idioma).
- Pruebas: 1 e2e nueva. Total 83.

## Revisión de código externa (1.10.1)

Se comprobó cada punto de una revisión externa contra el código antes de tocar nada:
- **`replace --regex` y macros de `$`: real, corregido.** `String.replace` interpretaba `$$`, `` $` `` y `$'` (también en el editor).
  Ahora solo `$1`…`$99` y `$&` se expanden, `\$` da un `$` y el resto queda literal (`regexReplacer`).
- **Binarios por tuberías: real, pero distinto del descrito.** `save` no lee la tubería (guarda el último resultado) y las redirecciones
  `>` sí; el fallo era que `cat` decodificaba binarios sin avisar y que `save` tras un error guardaba el texto `❌…`. Ahora `cat`/`lines`
  rechazan binarios y UTF-8 inválido (usa `cp`/`mv`/Descargar), `save` se niega si el último comando falló y una redirección abortada
  no deja un archivo vacío nuevo.
- **`withWriteLock`: no es un fallo.** `() => fn()` ya devuelve la promesa, así que el candado se mantiene hasta que termina la escritura.
- **Vistas previas HTML: no es una fuga.** `closeHTMLPreview` limpia temporizadores, canal y URL del blob; `pagehide` las cierra todas, y los
  temporizadores de la página no sobreviven a su cierre.
- Pruebas: 2 e2e nuevas. Total 82.

## Editor: guías de bloque (1.10.0)

- `codeBlocks` calcula bloques multilínea (llaves/corchetes, sangría de Python, etiquetas HTML, y `<script>`/`<style>`) con su
  profundidad; el editor los dibuja como líneas verticales junto a los números de línea, resalta el del cursor y el clic lo selecciona.
- Decisión: solo visual. Plegar código exigiría sustituir el `textarea` por un editor propio; queda como posible mejora.
- Pruebas: 4 unitarias y 1 e2e nuevas. Total 80.

## Editor: revisión básica y funciones completas (1.9.0)

- `codeAnalyze`: máscara de comentarios, cadenas, plantillas y regex; equilibrio de `([{` con arreglo seguro (cerrar al final,
  corregir el cierre equivocado, insertar el que falta); `;` en CSS (error entre declaraciones, aviso en la última); en HTML
  revisa solo el contenido de `<script>` y `<style>`; en Python `:` que falta, sangría inesperada/inconsistente y tabuladores mezclados.
- Decisión: en JS no se «arregla» el `;` (ASI lo hace opcional) y en Python solo se detecta la sangría, porque corregirla
  cambiaría el significado.
- `codeFunctions`: funciones, métodos, flechas y clases (con propietario `Clase.metodo`) en JS, Python y `<script>`.
  Editor: **Función** (más pequeña, repetir amplía), **Reemplazar función** (portapapeles + sangría) y Alt+Shift+→.
- Protocolo `dv`: `operation: "replace-function"` con `name` y `new`; rechaza nombre inexistente, ambiguo o `new` desequilibrado.
- Límites conocidos: heurística de regex en JS, sin soporte para TypeScript con genéricos complejos; detecta, no analiza tipos.
- Pruebas: `codetools.test.mjs` (16) y `code-tools.test.mjs` (7). Total 75.

## Datos seguros: undo, guardado con copia y retención (1.8.0)

- El editor crea un checkpoint antes de **cada** guardado de un archivo existente (antes solo en restore y parches del chat).
- `!undo`: restaura la ultima operacion con copia previa, agrupando las copias de una misma operacion (10 s y misma
  etiqueta); archivos borrados se recrean, los modificados pasan por diff, varios por una revision conjunta.
- Retencion automatica: 20 copias por archivo y 64 MB totales (`CFG.CHECKPOINT_KEEP_PER_FILE`, `CHECKPOINT_MAX_TOTAL_BYTES`);
  nunca borra la mas reciente de cada archivo y no interrumpe la operacion si falla.
- Pruebas: `undo-retention.test.mjs`. Total 52.

## Teclado aislado de la página (1.7.1)

- Sintoma (ChatGPT): lo escrito en el panel pasaba al chat. Causa probable: el sitio lleva lo tecleado al composer si el
  foco no esta en un campo editable, y con el shadow DOM cerrado el destino visible es el contenedor del panel.
  **No se pudo confirmar en ChatGPT real** (sin cuenta); se reprodujo con una pagina que imita ese comportamiento.
- Arreglo: `@run-at document-start` (y la extension tambien en `document_start`) para registrar primero, en captura de
  `window`, un guard que no deja pasar keydown/keypress/keyup del panel a la pagina y los reenvia como copia al elemento enfocado
  (Enter, historial, atajos del editor siguen funcionando). Alt+Shift+D se maneja ahi.
- Pruebas: `keyboard-guard.test.mjs` (falla sin el guard: reproduce el sintoma).

## Multiarchivo, tarea compartida y visibilidad del panel (1.7.0)

- `{"changes":[…]}`: 2 a 20 cambios, se preparan todos antes de abrir la revision; **Aplicar todo** reverifica hashes,
  guarda un checkpoint por archivo y revierte los ya escritos si una escritura falla.
- **Compartir con instruccion**: tarea + hasta 8 archivos (64 KB) + arbol opcional, con vista previa; el mensaje explica `changes` y `patch`.
- Panel: **✕** lo oculta y un boton flotante **💾 DV** lo restaura; Alt+Shift+D; se recuerda. La extension sustituye el popup por
  un clic en el icono que alterna el panel (service worker + relay en mundo aislado; sigue sin permisos).
- Suite: 40 pruebas (3 unitarias + 37 e2e).

## Vista previa: recarga forzada (1.6.2)

- Al ocultar y volver a mostrar la vista previa, asignar el mismo `srcdoc` a un iframe que estuvo oculto podia dejarla en
  blanco (ocurria en el navegador del usuario, no en Chromium headless). Ahora cada pintado quita `srcdoc` y lo repone con
  el iframe ya visible; al ocultar se vacia. Prueba: 6 pulsaciones seguidas en `editor-preview.test.mjs`.

## Vista previa del editor: apertura por defecto (1.6.1)

- Con la preferencia de 1.5.43 el HTML se reabria con la vista previa ya encendida y pulsar **Vista previa** la
  *apagaba* (parecia quedar en blanco). Ahora los HTML se abren siempre con la vista previa visible; el boton la oculta
  y solo esa decision explicita se recuerda. Cubierto por `tests/e2e/cases/editor-preview.test.mjs`.

## Mejoras de seguridad, revision y pruebas (1.6.0)

- **Copia previa automatica** (checkpoint) antes de `rm`, `rm -r`, Eliminar todos, `cp`/`mv` que reemplazan, importar
  archivo o ZIP sobre existentes y `write` con contenido distinto. La confirmacion informa de cuantas copias se
  guardan y de los archivos que superan 1 MB (sin copia). Si la copia falla no se modifica nada.
- **Limite real**: el codigo usa `MAX_RUN_BYTES = 1 MB`; los mensajes y documentos decian 256 KB. Se alineo todo a 1 MB.
- `t()` ya no lanza `Missing translation`: usa el espanol y registra la clave (visible en `!diag`). Una prueba
  de cobertura impide que falte alguna.
- `!diag` / boton **Diagnostico**: informe sin datos personales (sitio, entrada, boton de enviar, CSP, bibliotecas).
- Revision del editor: avisos de JSON no valido, sintaxis JS (solo compila, no ejecuta; "no verificable" en modulos o
  con CSP estricta) y etiquetas HTML sin pareja. Son avisos, no bloquean.
- Propuestas `operation: "patch"` (un archivo, hash obligatorio, sin tolerancia) y `replace --regex [--all]`.
- Git: `git diff A B`, `git log --oneline`, `-n N`, `-- archivo`.
- Pruebas: `tests/e2e` (Chromium) y `tests/unit` (traducciones). Las 135 pruebas Node anteriores no se pudieron
  ejecutar en esta sesion (el repositorio recibido no incluia `tests/userscript.test.cjs`); ejecutalas antes de publicar.

## La vista previa del editor se restaura (1.5.43)

Reporte: en el editor de un HTML, al cerrar y volver a abrir ya no aparecia la vista previa.

- Causa: `liveOpen` nacia en `false` en cada apertura del editor y el panel arrancaba oculto,
  asi que cada reapertura obligaba a pulsar **Vista previa** otra vez.
- Arreglo: el estado se guarda en `localStorage` (`dv.editor.live.v1`, con try/catch por si no hay
  almacenamiento). Al abrir un HTML se restaura el panel, el estado del boton y el primer render.
  Minimizar, ampliar y restaurar ya conservaban la vista previa.
- Comprobado en un navegador aislado: abrir, editar, guardar, cerrar y reabrir deja la vista previa abierta
  con el contenido guardado; el boton la cierra al pulsarlo.
- La pestana conectada (**Pestana**) se abre, se cierra y se vuelve a abrir correctamente; si la
  pestana estaba cerrada se crea una nueva en lugar de reutilizar la anterior.
- Cambio de nombre: el script pasa a llamarse `loopwork.js` (cabecera `@name loopwork`).

## Extension de Chrome y arreglo de Ctrl+V (1.5.42)

Problema reportado en claude.ai: Ctrl+V no pegaba dentro del panel.

- Causa probable: el panel vive en un shadow DOM cerrado, asi que para el
  documento el elemento enfocado es el host (un `div`), no un campo editable.
  Los manejadores globales de `paste` del sitio lo tratan como "sin foco" y
  desvian el texto a su propio composer (mismo mecanismo que el robo de foco de 1.5.39).
- Userscript: `installClipboardGuard(host, shadow)` detiene `paste/copy/cut` en el
  host (fase de burbuja) y, si el sitio ya cancelo el pegado, inserta el texto a mano
  en el campo enfocado. Aplicado al panel y al editor.
- Extension (`extension/`, generada con `tools/build-extension.py`):
  - Manifest V3, `world: "MAIN"` (mismo contexto que `@grant none`), sin permisos
    ni `host_permissions`; solo `content_scripts` para los cinco dominios.
  - `early-guard.js` corre en `document_start`, antes que los scripts del sitio, y en
    la fase de captura de `window` aisla `paste/copy/cut` cuyo `composedPath()` incluya
    `#dv-host` o `#dv-code-editor`, sin cancelar el evento (la accion nativa sigue). Esto
    cubre tambien los manejadores del sitio registrados en captura, que el userscript
    (`document-idle`) no puede adelantar.
  - `isomorphic-git@1.32.1` y `diff@7.0.0` van incluidos en `vendor/`: la extension
    no descarga nada de jsDelivr ni de esm.sh. Las bibliotecas se bajan una vez de npm
    al construir.
  - El script de contenido de la extension no esta sujeto a la CSP de la pagina; los
    Workers/iframes Blob de `run archivo.js` si lo siguen estando.
  - Popup estatico con la version y los sitios.
- Evidencia: extension cargada en Chromium (con `--load-extension`) sobre una
  pagina falsa que imita el desvio de `paste` de claude.ai. El panel se monta, las
  bibliotecas quedan como `window.git`/`window.Diff`, el sitio no ve los eventos `paste`
  originados en el panel (si ve los de la pagina), y un Ctrl+V real escribe en el campo del
  panel dejando vacio el composer del sitio.
- **No probado** en claude.ai, chatgpt.com, gemini.google.com ni chat.deepseek.com reales.
- Pendiente: publicar en Chrome Web Store (cuenta de desarrollador y revision),
  opcion de actualizar sin regenerar la carpeta, y firmar/empaquetar `.crx`.
- Nota: si se instalan a la vez el userscript y la extension aparecen dos paneles.

## Soporte experimental para Claude (1.5.40)

Tercer sitio adicional. El protocolo `dv` no cambia; solo el adaptador.

- `@match` incluye `https://claude.ai/*`.
- Entrada: el compositor de claude.ai es un editor ProseMirror
  (`[data-testid="chat-input"]` / `div.ProseMirror[contenteditable="true"]`),
  sin `<textarea>`. `getInput()` lo busca antes de la heuristica generica.
- Lectura: `getText()` aplica el lector por parrafos (antes solo Quill de Gemini)
  tambien a `.ProseMirror`; el parrafo vacio con `<br>` cuenta como linea vacia.
  Esto tambien beneficia al compositor ProseMirror de ChatGPT.
- Escritura: `insertText`; si ProseMirror aplana los saltos de linea, se reintenta
  con un evento `paste` sintetico (`text/plain`), que crea un parrafo por linea.
  Para `.ProseMirror` ya no se cae a `textContent` (rompe el estado del editor):
  si el texto no coincide exactamente, `sendToChat` cancela y restaura el borrador.
- Boton de enviar: ya cubierto por `button[aria-label="Send message"]`.
- Mensajes: usuario `[data-testid="user-message"]`; asistente
  `.font-claude-response`, `.font-claude-message` o `[data-is-streaming]`.
- Bloques de codigo: el lenguaje `dv` se lee de `language-dv` o de la etiqueta
  de la cabecera del bloque (`[class*="group/copy"]`). Como respaldo, un bloque
  JSON del asistente con `"path"` y `"hash"` tambien ofrece **Revisar parche en DV**.
- Textos: `t()` sustituye "DeepSeek" por el nombre del sitio actual (Claude,
  ChatGPT o Gemini), de modo que mensajes como "Nada enviado a DeepSeek" no
  resulten engañosos fuera de DeepSeek. En DeepSeek y en las pruebas no cambia nada.
- Evidencia: la logica de `getInput/getText/setText` se ejecuto contra un
  editor ProseMirror real (prosemirror-view) en un navegador aislado con una
  linea, varias lineas, lineas vacias y bloques con ``` ; todas coinciden
  exactamente y se pueden vaciar. **No se probo en claude.ai** (requiere cuenta)
  y los selectores salen del DOM conocido, que puede cambiar.
- Pendiente: confirmar con una cuenta (envio, boton de parche, `!` en la
  entrada), comprobar si la CSP bloquea `run archivo.js` y si un mensaje largo
  se convierte en adjunto ("pasted content") al usar el pegado sintetico.
- 1.5.41 (fallo reportado en uso real: "no se encontro un boton de envio
  habilitado", y el texto quedaba en la entrada): el boton de claude.ai lleva
  una etiqueta traducida ("Enviar mensaje"), que `button[aria-label="Send message"]`
  no cubria. `findSend` ahora busca, subiendo desde la entrada, botones visibles
  cuya etiqueta/titulo sea de envio (send, enviar, envoyer, senden, invia, 发送...)
  excluyendo detener/adjuntar/modelo/compartir. Si aun asi no hay boton, solo en
  claude.ai se envia con Enter. Si falla, se registra en el panel la lista de
  botones junto a la entrada (con su estado) y se retira el texto de la entrada.
  Comprobado con un ProseMirror real y una barra de botones en espanol:
  envio por boton, envio por Enter y fallo limpio.
- Sin pruebas Node nuevas: la carpeta `tests/` no estaba disponible al hacer el
  cambio. Conviene anadir casos para `getText/setText` con `.ProseMirror`.

## Guardia de foco para el editor y el modal de Git (1.5.39)

Bug reportado por el usuario en ChatGPT: al abrir el editor de codigo (o el
modal "Guardar cambios en Git") y escribir, el texto aparecia en el chat de
ChatGPT en vez de en el campo del panel.

- Causa raiz: el editor y el panel viven en un `host.attachShadow({ mode:
  'closed' })`; `document.activeElement`, visto desde fuera del shadow DOM,
  siempre devuelve el elemento host (nunca el control interno realmente
  enfocado), sin importar el navegador. Algunos sitios de chat reenfocan su
  propio composer apenas detectan que el foco "visible" de la pagina no es
  un campo reconocible (input/textarea/contenteditable) ante cualquier
  evento; como el host nunca lo es, le ganan el foco al editor sin que el
  usuario haga nada, y las teclas siguientes caen en su propio chat.
- Verificado en vivo en chatgpt.com (sesion anonima): un `<textarea>`
  insertado normalmente en `document.body` nunca pierde el foco al escribir,
  pero uno dentro de un `attachShadow({mode:'closed'})` hace que
  `document.activeElement` reporte el host en vez del textarea, aunque la
  escritura real siga llegando bien a ese textarea (el navegador conserva el
  foco interno real); el robo de foco exacto de la sesion logueada del
  usuario no se pudo reproducir sin su cuenta, pero el mecanismo general
  (host cerrado != campo reconocible para el DOM externo) es la causa mas
  probable y la correccion aplicada lo cubre de forma generica.
- Arreglo: `installFocusTrap(host, scopeEl, initial, isActive)`, una
  utilidad nueva que sigue el ultimo control enfocado dentro del shadow DOM
  (via un listener `focusin` interno, sin retargeting) y, si el foco sale
  del `host` mientras `isActive()` siga siendo verdadero (un `focusin`
  global en `document` con `composedPath()` que no incluye al host), lo
  devuelve de inmediato a ese ultimo control.
- Aplicado al dialogo del editor de codigo (activo mientras `editorOpen` es
  verdadero; limpiado en `release()`, incluyendo los cierres por error) y al
  overlay de "Guardar cambios en Git" del panel (activo mientras esta
  visible; se instala una sola vez junto con el panel, de vida larga como el
  propio panel).
- No cambia el comportamiento del panel principal (persistente, no modal):
  el usuario sigue pudiendo hacer clic libremente entre el panel y el chat
  para enviar mensajes; el guardia solo actua dentro de los dos dialogos que
  realmente se comportan como modales de pantalla completa.
- Cubierto por 1 test nuevo que simula un `focusin` global fuera del host
  mientras el editor esta abierto y comprueba que el foco vuelve al textarea
  del editor. 135/135 pruebas pasando.

## Avance verificado - userscript 1.5.26

Checklist tachado = implementacion y evidencia indicada abajo.
No significa que una fase completa este cerrada.

- [x] Sintaxis JavaScript comprobada con `npm run check`.
- [x] Rutas Git: aceptar `.` y `./`, mantener rechazo de `..`.
- [x] Adapter: ENOENT para ausentes, ENOTDIR para listar archivos,
      EISDIR para leer directorios.
- [x] Git local: init, add, commit, log, status con isomorphic-git 1.32.1.
- [x] status no lista archivos sin cambios; add --all incluye borrados.
- [x] Metadatos internos excluidos del staging; `.dv-user.txt` sigue visible.
- [x] Errores de git log visibles, sin ocultar repositorios corruptos.
- [x] Redirecciones `>` y `>>`, streaming y gzip (sin append a gzip).
- [x] Validar todos los nombres de comandos y destinos de redireccion
      antes de ejecutar; aplicar MAX_COLLECT_CHARS a la salida en memoria.
- [x] `ls [ruta]` y `ls -R [ruta]` respetan la carpeta elegida.
- [x] `head -n 0` devuelve salida vacia.
- [x] `rm [-r] <ruta>`: una ruta literal, confirmacion obligatoria,
      raiz y metadatos protegidos, verificacion posterior.
- [x] Observer: excluir panel y HOST_ID; solo comandos registrados exactos,
      correlacionados con intento manual reciente; un aviso por intento.
      No ejecuta mensajes observados ni alerta por carga automatica sin intento.
- [x] Con busy, conservar la entrada del panel y del chat.
- [x] Help actualizado: rm, redirecciones y limites reales de Git.
- [x] Pruebas del userscript propias, no una copia del laboratorio.
- [x] Git sin repo: status/add/commit/log/diff indican usar git init.
- [x] git log distingue rama sin commits de objetos ausentes/corrupcion.
- [x] git commit rechaza staging sin cambios respecto a HEAD.
- [x] git status muestra cambios staged y unstaged simultaneos.
- [x] git diff unificado, git diff --staged y comparacion con referencia.
      Adiciones/eliminaciones usan /dev/null; binarios se reportan sin
      convertirlos a texto; archivos sin seguimiento se ven en status.
- [x] cp/mv para archivos, rutas normalizadas y metadatos protegidos.
- [x] Confirmar reemplazo en cp; confirmar todo mv, incluido borrado del origen.
- [x] Copiar bytes mediante stream; verificar tamano y SHA256 del destino.
- [x] mv verifica tambien el origen actual antes de borrarlo, detectando
      cambios durante la copia. Errores de borrado indican donde quedo la copia.
- [x] Compartir no sobrescribe borradores (ni siquiera espacios en la entrada).
- [x] Vista previa truncada a 1500 caracteres y confirmacion obligatoria
      para diagnosticos y archivos, tanto por flags como por botones.
- [x] Archivos compartidos: maximo 64 KB elegido por el usuario; solo UTF-8
      valido sin NUL; rutas internas bloqueadas y fences adaptados al contenido.
- [x] Parser de sharing basado en tokens: respeta comillas, pipes,
      destinos de redireccion y --; errores de flags antes de ejecutar.
- [x] --share y --share-file juntos producen un unico mensaje confirmado.
- [x] Errores de entrada/boton/timeout explicitos y guardia de envio concurrente.
- [x] Normalizar CRLF/CR a LF para preview, insercion, comparacion y limpieza
      del mensaje: evita falsa deteccion de borrador al compartir texto Windows.
- [x] Reconocer ds-button--disabled en botones role=button de DeepSeek.
- [x] `!run archivo.html`: vista previa estatica aislada con boton de cierre.
- [x] `!run archivo.js`: Worker en iframe de origen opaco, logs y errores,
      CSP sin red, sin acceso a OPFS/DOM de la pagina, timeout de 3 segundos.
- [x] Boton Ejecutar junto a Editar por archivo: mismo flujo run local,
      confirmacion, historial, resultados/logs y guardia busy; sin sharing.
- [x] Explorador: boton Eliminar por archivo y Eliminar todos los archivos
      de usuario. Confirmacion obligatoria; conserva .git, .dv y .dv_tmp.
      Listado oculta metadatos y aclara cuando muestra solo 50 archivos.
- [x] Boton Explorar / Importar archivos: seleccion multiple del equipo,
      importacion local a raiz OPFS con bytes originales y verificacion SHA256.
      Confirmacion por reemplazo; seleccion se reinicia para reimportar.
- [x] isInsidePanel recorre parentNode/host cruzando Shadow Roots anidados.
      Observer excluye tanto mutation.target como addedNodes internos,
      conserva filtro de comandos registrados y deduplicacion por intento.
- [x] Boton Ayuda abre lista completa desplazable desde el mismo registro
      de help, sin truncar a 800 caracteres ni sobrescribir lastResult.
- [x] Avisos DOM indican POSIBLE FUGA, no afirman envio al servidor.
- [x] Editor local oscuro con boton Editar por archivo, lineas numeradas,
      busqueda y reemplazo literal (primero/todos), edicion libre y diff completo.
- [x] Aplicar solo despues de revisar diff; invalidacion al editar el borrador,
      confirmacion y hash original comprobado antes de escribir/verificar.
- [x] view: codigo numerado con hash completo y rango de lineas.
- [x] propose: JSON con hash, replace/insert-before/insert-after/append;
      bloque old unico y exacto, candidato sin escritura y apertura del editor.
- [x] replace literal: bloque unico por defecto, --all explicito con contador,
      --hash opcional y diff/aprobacion obligatorios; dry-run siempre activo.
- [x] checkpoint/restore de un archivo: bytes/hash persistentes, listado de IDs,
      aprobacion y checkpoint previo al sobrescribir; incluye no versionados.
- [x] git show: metadatos de commit o texto historico ref:archivo, solo lectura.
- [x] Descargar por archivo en explorador: Blob OPFS original a PC,
      texto/binarios/gzip sin conversion, sin compartir ni staging.
- [x] Selector compartir muestra todos los archivos de usuario; >64 KB
      visibles/deshabilitados con motivo, actualizacion si dialogo abierto.

Evidencia reproducible:

- `npm install` instala dependencias de desarrollo fijadas de Git y diff;
  package-lock.json registra la resolucion. El userscript no requiere npm.
- `npm test`: 81 pruebas Node con OPFS simulado en memoria y la libreria
  Git real. Cubren commits, cambios, borrados staged, filtros, limites,
  cancelacion de rm, abort de redireccion, gzip y diff. Los parches generados
  se aplican en memoria y se verifica que reconstruyen exactamente el texto
  esperado, incluyendo ausencia de salto de linea al final.
  Ademas cp/mv: bytes binarios/gzip/vacios, cancelacion, limites, rutas,
  fallos de escritura/verificacion/borrado y cambios externos del origen.
  Sharing: comillas/flags, limite exacto y exceso de 64 KB, texto invalido,
  borradores, cancelacion, envios combinados, concurrencia, fallos de envio,
  normalizacion CRLF/CR y bloqueo de botones CSS-disabled.
  Run: motores no soportados, rutas, limites, cancelacion, embedding seguro
  de codigo y ejecucion del bootstrap de consola con logs await/errores.
  Botones de borrado: cancelacion, busy, proteccion de metadatos, alcance
  completo de mas de 50 archivos y error parcial explicito.
  Importacion: binarios/gzip/vacios, reemplazo/cancelacion, nombres protegidos,
  limites, busy y fallo de lote con conservacion de exitos anteriores.
- 1.5.10: tests de Shadow Roots anidados, targets internos, nodos desconectados
  y error explicito si falta document.body. Navegador localhost: !ls desde
  boton del panel y cambios en Shadow DOM anidado producen cero alertas;
  nodo externo simulado produce una alerta. Ayuda visible con comandos
  run/Git/importacion. No se forzo ningun envio ni fuga real en DeepSeek.
- 1.5.11 tests: reemplazos de bloques/funciones y literales `$&`, version
  obsoleta rechazada, texto UTF-8/BOM/CRLF, rutas y limites.
  Navegador localhost con OPFS nativo: boton Editar abre, reemplazo no cambia
  archivo, numeracion visible, diff contiene linea retirada/anadida,
  aplicar confirmado guarda contenido correcto, cierra editor y no alerta.
- 1.5.12 tests: view/rangos/hash, propuestas inline y archivo JSON, operaciones,
  rechazo de hash viejo/bloque ambiguo/esquema invalido/sin cambios y limites.
  Navegador localhost OPFS: propose -> editor con candidato/diff automatico,
  archivo intacto antes de confirmar -> Aplicar -> contenido y hash nuevos.

## Compartir archivo sin confirmacion adicional (1.5.26)

- [x] A peticion del usuario, Enviar archivo a DeepSeek en el selector envia
      directamente el archivo elegido. Abrir selector no envia. Texto visible
      y tooltip explican el envio sin segunda confirmacion.
- [x] Limite 64 KB, UTF-8/no binarios, rutas internas, busy y borradores siguen
      protegidos. --share-file en comandos conserva vista previa/confirmacion.
- Regresion Node: envio directo, borrador intacto, rechazo de archivo grande,
  binario, ruta interna y busy. Pruebas con chat simulado, sin envio a DeepSeek.

## Compartir resumen con un clic (1.5.25)

- [x] A peticion del usuario, Ejecutar + Compartir autoriza envio directo del
      resumen (limite 1200 caracteres) sin segunda confirmacion. Tooltip avisa.
- [x] Se conservan proteccion de borradores, controles de envio y errores
      explicitos. --share y archivos mantienen vista previa/confirmacion,
      incluso --share-file combinado con el boton. No cambia confirmaciones
      de operaciones locales.
- Regresiones Node: envio directo y preservacion de borrador; archivo y origen
  chat no pueden saltar su confirmacion. No se envio nada a DeepSeek en pruebas.

## Alineacion del explorador (1.5.24)

- [x] Nombre, bytes y cuatro botones permanecen en una fila sin salto.
      Nombre flexible con elipsis y tooltip de ruta completa; controles y bytes
      no se comprimen. Desplazamiento horizontal en ventanas muy estrechas.
- Evidencia: reglas CSS comprobadas en navegador aislado a 440 y 320 px,
  nombre largo y cuatro botones alineados; scroll horizontal solo a 320 px.
  Sintaxis valida y 78 pruebas Node pasan.

## Usabilidad inicial (1.5.23)

- [x] Bienvenida integrada primera vez, recordada por origen en localStorage.
      Tres ejemplos ls/status/help preparan entrada sin ejecutar; confirma si
      reemplazan borrador. Error de preferencias visible, no silencio.
- [x] Primeros pasos y Ver introduccion en Ayuda reabren la guia.
- [x] Tooltips de botones, type=button, foco visible, etiquetas accesibles.
- [x] Header con estado textual Listo/local, Operacion en curso, Editor abierto.
      Actualizacion sincronica con busy; controles principales bloqueados,
      borrador conservado. No implica exito del ultimo comando ni estado Git.
- [x] Ampliar/Reducir dentro de ventana; conserva posicion normal y comando.
      Drag bloqueado al ampliar; Contraer/Abrir accesible sin borrar borradores.
      Alineacion de filas revisada en 1.5.24 (ver arriba).
- [x] Editor integrado con estados borrador/aprobacion (ventana propia; "Volver" ya no hace falta).
      Modal existente se conserva para no arriesgar guardias hash/diff.
- [x] Acciones por archivo (Editar, Ejecutar, Descargar, Eliminar) en cada fila.
- Evidencia: 78 pruebas Node (incluye actualizacion busy durante espera/error);
  navegador localhost OPFS: bienvenida inicial, ejemplo sin ejecutar, recordar
  y reabrir tras reload, ampliar/reducir conserva entrada, busy deshabilita
  ejecutar, abrir/cerrar editor actualiza estado, botones con title.
  No se enviaron datos; pendiente comprobar ergonomia en DeepSeek.

## Consulta y limpieza de checkpoints (1.5.22)

```text
!checkpoint --list --file prueba.txt
!checkpoint --list --tag "antes de"
!checkpoint show ID
!checkpoint show ID --content
!checkpoint diff ID1 ID2
!checkpoint delete ID
!checkpoint prune --keep 5
!checkpoint prune --older-than 7d
```

- Listado por fecha descendente (UUID solo desempata). file ruta exacta
  normalizada; tag substring literal de etiqueta, sensible a mayusculas.
- show devuelve metadata, tamano y SHA256; content solo UTF-8 sin NUL.
  diff direccion ID1 -> ID2, completo y solo lectura; admite archivos distintos.
  Binarios no se decodifican silenciosamente. Mostrar bytes binarios/exportar
  un checkpoint exacto sigue pendiente. Consultas usan salida textual por
  lineas: no garantizan preservar salto final; no son exportacion exacta.
- delete/prune confirmados con lista de IDs/rutas/fechas e irreversibilidad.
  NO se borra la fecha mas reciente por archivo; todas las copias empatadas
  en esa fecha quedan protegidas. Sin force ni borrado total.
- keep N es global y N entero positivo: conserva N mas recientes MAS las
  ultimas copias por archivo. Resultado puede tener mas de N copias.
  older-than Nd usa dias enteros positivos y antiguedad respecto a Date.now.
  Ambos modos son excluyentes, sin filtros de borrado por file/tag.
- Valida todas las copias publicadas antes de seleccionar y otra vez tras
  confirmacion. Corrupcion o cambio de inventario bloquea sin simular exito.
  No pipes/redirecciones para checkpoint (incluidas consultas, por ahora).
- Borrado dirigido de metadata y copia; verifica ausencia. Error parcial
  muestra conteo y advierte ID incompleto; sin rollback. Si metadata se borra
  pero binario falla, puede quedar .bin huerfano no listado. Limpieza de
  huerfanos/recuperacion sigue pendiente. No elimina archivos de usuario/Git.
- No bloqueo multipestana: hay carrera despues de revalidar; fechas son
  del reloj local, no orden monotono. Cuota global/limite de inventario
  pendientes; listar verifica hashes y su coste crece con cantidad de copias.
- Subcomandos show/diff/delete/prune reservados; para archivo con esos nombres
  usar ./show, ./diff, etc. No borrar/copiar metadatos manualmente.
- Usuario aprobo este alcance. 77 tests: filtros/orden, contenido/diff,
  binarios, cancelacion, keep/edad/delete, empate/ultima copia protegidos,
  cambio durante confirmacion y fallo parcial. Borrados de tests solo en OPFS
  simulado en memoria, no en disco del usuario.
- Navegador localhost OPFS: metadata/content/diff/filtros/orden correctos y
  prune cancelado conserva copias y working tree. Sin borrar en DeepSeek.

Importante: no hay auditoria forense completa ni garantia de "no perder nada".
Journal sigue basico y puede fallar silenciosamente; no cubre todas las
operaciones. Restore conserva copia previa, pero write/import/rm y otras
operaciones no tienen backup universal ni recuperacion por interrupcion.
Checkpoints y Git son complementarios, no backup externo del navegador.

## Ramas locales y checkout protegido (1.5.21)

Alcance elegido por usuario: listar/crear ramas y cambiar solo con archivos y
staging limpios, sin force ni descarte automatico.

```text
!git branch
!git branch experiment
!git checkout experiment
!git checkout main
```

- branch lista locales con * activa, incluida rama inicial sin commits.
  Crear requiere commit actual y no cambia de rama; nombre duplicado/invalido
  falla mediante isomorphic-git. No borrar/renombrar ramas ni force.
- checkout solo acepta rama local EXISTENTE. No SHA/HEAD separado, archivos,
  -b, -f, --force ni pipes/redirecciones. Editor abierto bloquea cambio.
- Antes de confirmar: statusMatrix debe estar limpio; ningun archivo de
  usuario sin seguimiento/ignorado se permite, aunque no colisione con destino.
  Guardar checkpoint NO elimina esos cambios; hacer commit o conservar archivos
  fuera del disco antes de continuar. git status puede ocultar los ignorados,
  por eso checkout comprueba tambien inventario real OPFS.
- Rama destino se inspecciona: rechaza metadatos .git/.dv/.dv_tmp, rutas
  incompatibles, enlaces simbolicos/submodulos. Fuente/staging con metadatos
  versionados tambien bloquea; snapshots/journal locales no se pierden.
- Confirmacion explicita; revalida hashes de archivos, HEAD/rama y OID destino.
  Hash por archivo hasta 512 MB, en memoria; no garantiza presupuesto global.
  Llamada force:false y verificacion posterior de HEAD/rama/estado limpio.
- Una interrupcion/error puede dejar estado parcial. Error explicito solicita
  revisar status/branch: NO rollback automatico, recuperacion ni transaccion
  multipestana. Persiste carrera entre comprobacion y checkout.
- Commit muestra rama ACTUAL, no main fijo.
- 74 tests: crear/cancelar/cambiar, commits por rama, checkpoints conservados,
  cambios staged/unstaged/borrados/no versionados/ignorados bloqueados,
  metadatos peligrosos y cambios durante confirmacion.
- Navegador localhost OPFS: main -> experiment -> commit -> main recupera
  contenido inicial -> experiment recupera nuevo -> borrador bloquea checkout
  y queda intacto. Checkpoint conservado. Confirmaciones simuladas; sin
  envio al chat, pendiente comprobacion de version en DeepSeek.

Git local no queda cerrado: git restore de archivos con backup/diff,
diff entre DOS commits, checkout de commit, .gitignore por defecto, grafo y
recuperacion siguen pendientes. !restore ID es checkpoint, no git restore.

## Fechas Git (1.5.20)

- Usuario confirma que 0:00:00 era medianoche real, no un timestamp defectuoso.
- Log/show comparten formateo defensivo: valor ausente/no finito o fuera del
  rango Date muestra motivo "sin fecha". Timestamp 0 y medianoche siguen validos.
- No cambia fechas almacenadas, hashes, commits ni contenido. Log sigue en
  hora local del navegador; show usa ISO UTC. Regresion cubre ambos modos,
  valores invalidos/fuera de rango, epoch y medianoche real.

## Selector de compartir (1.5.19)

- Antes se ocultaban archivos >65536 bytes: importarlos no implicaba que
  apareciesen. Ahora aparecen deshabilitados y con motivo/tamano exacto.
- Limite elegido de 64 KB permanece, sin compartir archivos grandes por
  sorpresa. Alternativa: `!head -n 30 "archivo" --share` con preview/aprobacion.
- Lista se relee al abrir; refresh tras importacion/comandos actualiza tambien
  dialogo abierto, conservando seleccion valida. Si todos superan el limite,
  envio deshabilitado y aviso. Solo se excluyen metadatos internos.
- UTF-8/binarios se validan antes del envio, no al enumerar. Copias en otra
  pestana requieren reabrir la lista; no hay sincronizacion automatica entre tabs.
- Verificado navegador localhost OPFS: 65536 B habilitado, 65537 B visible
  deshabilitado, solo archivos grandes bloquea envio, nuevo archivo aparece
  al abrir y al refresh con dialogo abierto, seleccion preservada.
  Sin enviar mensajes. 70 regresiones y sintaxis correctas.

Revision adicional de 1.5.19:

- runFromExplorer no falla con apostrofes: tokenizer concatena segmentos
  adyacentes `'test'"'"'s.html'` en un unico argumento `test's.html`.
  No requiere escapes ni prohibir nombres validos. Regresion usa archivos
  OPFS con apostrofes internos/iniciales/finales/repetidos y el run real;
  llega a confirmacion y cancela sin ejecutar ni abrir previews.
- Observer conserva UN intento, no una cola: dos intentos rapidos pueden
  reemplazarse. Limitacion documentada, mejora pendiente con deduplicacion,
  caducidad y pruebas para no reintroducir alertas por historial.
- Descarga retira enlace inmediatamente y revoca URL a los 60 s. Varias
  descargas retienen referencias temporalmente; eso no permite inferir
  una cantidad fija de RAM (depende del navegador y respaldo del File OPFS).
  No reducir plazo arbitrariamente: podria invalidar descargas en curso.
- Selector cambia a otra opcion valida si la anterior supera 64 KB; conserva
  la vista previa/confirmacion antes de cualquier envio.

## Descarga del archivo actual (1.5.18)

- Boton Descargar junto a Editar/Ejecutar por archivo. Obtiene File OPFS y
  crea URL blob local, sin decodificar, comprimir ni transformar bytes.
- Guarda con nombre base (sin directorios); el navegador decide carpeta,
  dialogo y nombres duplicados. No borra/modifica el original.
- Sin limite artificial de 256 KB/64 KB: no lee arrayBuffer para descargar.
  Sujeto a recursos/permisos del navegador. Raiz, carpetas y metadatos bloqueados.
- Busy impide iniciar durante otra operacion; errores explicitos. Enlace
  temporal retirado; URL revocada tras 60 segundos o inmediatamente al fallar.
- Mensaje "Descarga solicitada", no afirma que el archivo se guardo en PC:
  una politica del navegador puede bloquearla sin error detectable por JS.
- Tests: bytes binarios/gzip/vacio exactos, nombre base, limpieza, errores,
  rutas protegidas y busy. Navegador localhost OPFS: boton visible y URL blob
  conserva los 6 bytes de prueba, con nombre correcto. El clic real solicito
  descarga, pero la herramienta integrada no emitio evento download; no se
  certifica guardado en disco PC ni descarga real en DeepSeek.
- Es archivo ACTUAL del working tree, no necesariamente HEAD. Exportar version
  historica exacta y archivo de repositorio siguen pendientes.

## Revision de pendientes y siguiente orden (1.5.17)

La lista aportada por el usuario es correcta salvo estos matices:

- Fase 1: falta politica/default de .gitignore y comandos branch/checkout.
  La exclusion interna .git/.dv/.dv_tmp ya existe; no sustituye .gitignore.
- Fase 5: propose ya es protocolo JSON estructurado con hash y aprobacion.
  Automatizar coordinacion entre chats/ejecucion sigue pendiente y no debe
  permitir que la IA escriba o comparta sin aprobacion.
- Fases 6-9: hay tests del propio proyecto, NO motor !test para archivos OPFS.
- Fase 10: checkpoint/restore por archivo ya disponibles; eliminar checkpoints,
  ramas visuales, experimentos y recetas siguen pendientes.
- Fase 12: lectura historica git show implementada ahora; descarga binaria
  exacta, archive y exportacion de recetas siguen pendientes.
- Resto de la lista: modelo de datos, recuperacion, inventario, regex/sed/patch/jq,
  grafo, validadores y Git remoto siguen sin implementarse.

Prioridad propuesta: exportacion exacta/backup fuera del navegador, validacion
basica de JSON/JS, recuperacion transaccional; despues branch/checkout con
proteccion de cambios no confirmados. No borrar checkpoints sin confirmacion
explicita ni habilitar checkout que descarte borradores.

## Lectura historica Git (1.5.17)

```text
!git show
!git show HEAD:test.html
!git show SHA_COMPLETO:test.html
!git show "main:carpeta/archivo con espacios.js" | head -n 20
```

- Sin argumento: metadatos de HEAD (SHA completo, padres, autor, fecha y
  mensaje). Con referencia sola: metadatos, NO diff del commit.
- ref:archivo muestra contenido confirmado en ese commit, aunque el archivo
  actual haya cambiado o se haya borrado. No hace checkout/restauracion/staging.
- Referencias de commit: HEAD, rama o SHA completo; no implementa HEAD~N,
  SHA abreviado, opciones de Git nativo ni resolucion de tags anotados.
  El SHA completo se obtiene con git show, no del log abreviado.
- Texto UTF-8 sin NUL hasta 1 MB; binarios/UTF-8 invalido se rechazan, sin
  convertir bytes silenciosamente. La libreria carga el objeto antes de
  comprobar tamano: el limite no garantiza memoria ante objetos enormes.
- Rutas raiz/traversal/metadatos protegidas. Repo/refs/objetos/archivo ausentes
  o corrupcion devuelven error; no simula historia vacia.
- El pipeline presenta texto por lineas (puede normalizar saltos y ultima
  nueva linea). Redireccion/save NO son exportacion exacta de bytes.
  El log muestra 800 caracteres; usar head/rangos o guardar salida textual.
  Compartir sigue siendo explicito con confirmacion.
- Node: lectura de dos commits, cambios staged/unstaged intactos, archivo
  eliminado, vacio, espacios, refs invalidas, binarios y corrupcion.
- Navegador localhost OPFS nativo: v1/v2 confirmadas -> borrador -> show de
  SHA anterior y HEAD; hash del borrador y estado Git permanecen iguales.
  No se enviaron datos a DeepSeek; verificacion en el sitio real pendiente.

## Checkpoints por archivo (1.5.16)

Alcance elegido: un archivo por checkpoint, no todo el disco.

```text
!checkpoint test.html "antes de corregir"
!checkpoint --list
!restore ID_REAL_DEL_CHECKPOINT
```

- Copia bytes originales en `.dv/checkpoints/<UUID>.bin`, verifica SHA256 y
  publica metadata `.json` con ruta normalizada, hash, tamano, fecha y etiqueta.
  IDs no se reutilizan. Un archivo sin commit tambien se puede guardar.
- Hasta 256 KB por archivo; incluye UTF-8, BOM/CRLF, binarios, gzip y vacios.
  No comprime/descomprime. Raiz, carpetas y rutas internas no se aceptan.
- restore verifica copia y metadata antes de tocar destino. Ruta original,
  sin destino alternativo. Si ya coincide, informa sin cambios.
- Texto existente UTF-8 sin NUL: candidato en editor con diff/aprobacion.
  Solo al Aplicar se crea checkpoint de la version actual y se guarda.
  Si editas candidato antes de aplicar, el resultado sera tu borrador revisado.
- Binario/no UTF-8 o archivo ausente: confirmacion con ruta, ID, tamano/hash;
  no hay diff textual. Si existe archivo, checkpoint previo antes de escribir.
  Si falta, se recrea (incluidos directorios padre). Carpeta en destino falla.
- Recomprueba version antes de restaurar; error al crear copia previa bloquea
  sobrescritura. Hash final verificado; no hace staging/commit ni ejecuta codigo.
- Copias se conservan al Eliminar todos; no son listadas en explorador ni
  staged por Git. `checkpoint --list` valida copias, no oculta corrupcion.
  Desde 1.5.22 hay borrado/prune protegidos; no cuota global, consumen espacio OPFS.
- No es backup fuera del navegador: borrar datos del sitio elimina copias.
  No implementa transaccion temp+rename ni recuperacion automatica tras cierre.
  Si falla restauracion, copias permanecen para reintentar; no simula rollback.
  Una interrupcion al crear puede dejar copia/metadata incompleta, con error
  al leer/listar. Persiste ventana de carrera con otras pestanas.
- Pruebas Node: bytes/binarios/vacios, cancelacion, restauracion ausente,
  diff/candidato sin escritura, backup previo, hash viejo, corrupcion,
  limites, fallo de escritura, conflicto durante confirmacion y fallo de backup.
- Navegador localhost OPFS real: checkpoint CRLF -> cambiar a LF -> restore
  con editor/diff -> original intacto hasta aprobar -> CRLF exacto y hash
  restaurados -> checkpoint previo LF. Recarga conserva ambas copias/archivo.
  Confirmaciones simuladas; no cierre completo del navegador ni prueba en
  DeepSeek. No se envio nada al chat.

## Hito reportado: borrado y recuperacion desde Git (2026-10-14)

Usuario reporta prueba en su sesion:

1. Eliminar todos -> archivos de usuario borrados, historial Git conservado.
2. git status -> deleted (unstaged) para prueba.txt, index.html y test.html.
3. git show HEAD:index.html -> save -> index.html recuperado (19.2 KB).
4. git show HEAD:test.html > test.html -> 976 B, un byte adicional.
5. git show HEAD:prueba.txt -> save -> prueba.txt recuperado (2 B).
6. git show HEAD:test.html -> save -> test.html recuperado (975 B).
7. git status -> Working tree limpio.

El usuario describe recuperacion bit-perfect en los tres archivos. No se
inspeccionaron hashes/bytes de esa sesion por el asistente; queda registrada
como evidencia aportada. Estado limpio es evidencia de coincidencia con
Git, no certificacion independiente de todo el contenido del disco.

Alcance: recuperacion de esos archivos confirmados en HEAD, no de archivos
sin commit ni de todos los estados previos. show/save procesa salida textual:
puede normalizar saltos; redireccion agrega salto final por linea. No garantiza
restauracion exacta para UTF-8 arbitrario, BOM/CRLF/binarios. Recuperacion Git
directa de bytes con backup y aprobacion sigue pendiente. No se marca como
cerrada recuperacion transaccional ni se promete "cero perdidas" universal.

## Hito: ciclo completo de edicion y Git

### v1.5.12 - reportado por el usuario (2026-10-13)

El usuario reporta el ciclo:

`view test.html -> propose insert-before -> editor -> revisar diff ->
Aplicar -> git add --all -> git commit -> git status limpio`.

Reporta original intacto antes de confirmar, staging de 3 archivos y commit
`5c10bbe`. Es evidencia aportada por el usuario, no una ejecucion inspeccionada
por el asistente. La ausencia de avisos no certifica ausencia de trafico de red.

### v1.5.13 - verificado por el asistente (2026-10-13)

Navegador localhost aislado, OPFS nativo y Git/diff del userscript:

1. init -> code.js -> add --all -> commit inicial.
2. view -> hash completo -> replace con --hash.
3. Editor con diff automatico; original intacto antes de confirmar.
4. Aplicar confirmado -> contenido y hash nuevos; git diff muestra el cambio.
5. add --all -> commit `f0a3849` -> `Working tree limpio.`
6. Recargar el origen -> contenido/hash, commits y estado limpio persisten.
   No se probo cierre completo del navegador.

Confirmacion simulada solo en el fixture. No se enviaron mensajes ni archivos
a DeepSeek. No equivale a certificar esta version en el sitio real.
Hay tambien un test de regresion persistente del ciclo con OPFS en memoria.

## Reemplazo literal seguro (1.5.13)

```text
!replace programa.js "return 1;" "return 2;"
!replace programa.js "nombreViejo" "nombreNuevo" --all
!replace programa.js "return 1;" "return 2;" --hash HASH_REAL --dry-run
```

- Sin --all requiere bloque exacto unico (incluye deteccion de solapamientos).
- --all sustituye coincidencias no solapadas y muestra el contador.
- Siempre prepara candidato y abre editor con diff; nunca guarda directamente.
  --dry-run es explicito pero no cambia ese comportamiento seguro por defecto.
- --hash opcional protege frente a una propuesta hecha para otra version.
  Sin el flag trabaja sobre la version actual; para IA preferir hash/propose.
- Comparte validacion de candidato y guardia de hash del editor. Rechaza NUL,
  ausencia de cambios y candidato >256 KB. No acepta pipes/redirecciones/regex.
- `""` permite reemplazo vacio. Para bloques multilinea/escapes usar propose JSON;
  el tokenizer del comando no interpreta `\n` como salto de linea.
- Tras Aplicar, revisar git diff y hacer staging/commit explicitamente.

## Protocolo de propuestas IA (1.5.12)

1. `!view programa.js --from 1 --to 30` obtiene lineas y SHA256 completo.
   Numeros no son parte del archivo. Rango invalido falla; no adivina limites.
2. Compartir rango con `--share` (resumen hasta 1200 caracteres) o guardar
   salida con `!save vista.txt` y compartir archivo hasta 64 KB. El log normal
   muestra hasta 800 caracteres; elegir rangos pequenos o guardar la salida.
   La IA no tiene acceso automatico al disco.
3. La IA devuelve un comando, por ejemplo (sustituir HASH_REAL):

```text
!propose '{"path":"programa.js","hash":"HASH_REAL","operation":"replace","old":"return 1;","new":"return 2;"}'
```

Tambien se puede importar un archivo propuesta.json y usar:

```text
!propose propuesta.json
```

4. propose valida y abre el editor con diff. Nada se guarda por ejecutar el
   comando. Revisar -> Aplicar confirmado -> hash verificado -> run -> compartir
   resultado -> nueva propuesta con hash actualizado.

Contrato:

- Un objeto JSON: path, hash SHA256 de 64 caracteres hex minusculos,
  operation, new; old obligatorio salvo append. Campos desconocidos fallan.
- replace sustituye un bloque exacto que aparece UNA vez. insert-before/after
  usa old como ancla unica. append concatena new al final, sin old.
- Cada propuesta tiene una operacion. No acepta pipes/redirecciones.
- JSON new/old codifican saltos con `\n` o `\r\n`, comillas con `\"`.
  No se insertan saltos automaticamente. El hash es de bytes, no texto normalizado.
- Comando inline va entre comillas simples; si el codigo contiene apostrofes,
  codificarlos en JSON como `\u0027` o usar archivo JSON importado.
- No usa numeros de linea para modificar: old es literal, no regex.
  Bloques ambiguos o ausentes, hash obsoleto y candidatos >256 KB se rechazan.
- Se verifica hash al preparar, al abrir editor y antes de guardar. No es
  bloqueo atomico multipestana; recuperacion persistente sigue pendiente.
- Cerrar cancela candidato. Editar el candidato invalida aprobacion de diff.
- No hay validacion semantica ni ejecucion automatica. Requiere usuario
  para compartir, aprobar, ejecutar y crear commits.

## Editor local (1.5.11)

Alcance aprobado: editor estilo oscuro, no Monaco ni corrector automatico.

- Boton Editar por archivo abre modal independiente; maximo un editor.
  Texto UTF-8 sin NUL, hasta 256 KB, metadatos internos bloqueados.
- Buscar siguiente recorre coincidencias literales y vuelve al inicio;
  Reemplazar primero actua sobre la primera coincidencia DEL ARCHIVO,
  no necesariamente sobre la seleccion encontrada. Reemplazar todos muestra
  contador en el borrador. Campos admiten bloques multilinea.
- El usuario puede pegar funciones completas o insertar codigo libremente.
  No hay deteccion semantica de funciones, regex, resaltado sintactico,
  autocompletado ni validacion de lenguaje en esta primera version.
- Revisar diff prepara candidato; Aplicar exige mismo candidato revisado
  y confirmacion. Cambiar texto invalida aprobacion. Cerrar borrador cambiado
  pide confirmar descarte.
- Hash de bytes de apertura vs archivo actual evita sobrescribir una version
  modificada mientras estaba abierto. Ante conflicto se conserva el borrador.
  No es bloqueo multipestana: persiste ventana entre verificar y escribir.
- Guardado normal usa motor atomicWrite existente; no crea commit ni backup automatico
  (restore en 1.5.16 si conserva checkpoint previo)
  y no resuelve todavia recuperacion/journal fiable. Comparar con Git y confirmar.
- BOM se conserva; CRLF uniforme se conserva al guardar. Texto con saltos
  mixtos o CR aislado se normaliza a LF al editar, visible en el diff.
- Ayuda documenta el boton. Editor tiene host propio excluido por isInsidePanel.
- Tras guardar: `!run archivo.js`, `!git diff`, compartir explicitamente.
  Protocolo de propuestas con hash integrado en 1.5.12; no certifica cierre
  completo de fase 3: patch/sed/jq/validadores/recuperacion siguen pendientes.

Limites del detector de fugas:

- 1.5.14 corrige avisos al cargar conversaciones con ejemplos de propose/view:
  no escanea sin intento de envio manual reciente desde la entrada del chat.
  Registra Enter (tambien modificadores salvo Shift/IME), clic en el boton
  reconocido y submit del formulario; solo eventos isTrusted.
- Ventana de 5 segundos y coincidencia del comando COMPLETO, normalizado a LF.
  Un aviso por intento; siguiente intento sustituye al previo, y editar la
  entrada manualmente cancela correlacion. Cambios de texto y subnodos cubiertos.
- Verificado con regresiones de carga sin intento, ejemplos diferentes,
  caducidad, eventos sinteticos ignorados, texto actualizado y Shadow DOM.
  No se ha forzado envio real a DeepSeek para verificar esta version.
- Un MutationObserver sobre document.body no atraviesa por si mismo Shadow
  Roots. El helper refuerza las exclusiones; no demuestra que todos los falsos
  positivos reportados procedieran del panel ni garantiza cero falsos positivos.
- No certifica rol de mensajes. Una cita identica aparecida justo despues de
  intentar enviar puede aun coincidir; no es posible prometer cero falsos avisos.
- Envios sin evento reconocido, texto transformado o aparicion tras 5 segundos
  pueden no detectarse. Se prioriza evitar alertas por historial/ejemplos.
- Es una alerta heuristica DOM, no detector de trafico ni prueba de recepcion.
- No probar fugas enviando comandos privados al servidor. Usar fixtures.
- 1.5.9 en navegador localhost con OPFS real: boton visible, evento change
  con dos File seleccionados, bytes binarios conservados, lista actualizada y
  seleccion reiniciada. Prueba con DataTransfer, no con dialogo del sistema.

Importacion local (1.5.9):

- Explorar / Importar archivos NO sube nada a DeepSeek. Se eligen archivos
  del equipo y se guardan en la raiz del disco virtual, sin ejecutar ni staged.
- Hasta 512 MB por archivo, con la misma verificacion usada por cp/mv.
  Copia streaming, pero hashes en memoria; no garantiza RAM para archivos grandes.
- No importa carpetas. Nombres invalidos o reservados (.git/.dv/.dv_tmp)
  se rechazan; colision con carpeta se informa.
- Reemplazos confirmados sin backup automatico. Si se cancela uno, se omite
  y sigue con los demas. Si falla importacion/verificacion se detiene el lote
  y se informa cuantos archivos ya se importaron; no hace rollback colectivo.
- Archivos disponibles para cat, run, Git o compartir explicitamente.
  El limite de compartir sigue siendo 64 KB, independiente de importar.

Botones de borrado (1.5.8):

- Eliminar usa la ruta exacta de la fila y pide confirmacion.
- Eliminar todos toma una lista de TODOS los archivos de usuario existentes,
  incluso los no visibles por el limite de 50 filas. No borra archivos creados
  posteriormente por otra pestana ni elimina carpetas recursivamente.
- Conserva historial Git, journal, temporales y carpetas vacias.
- No hay deshacer automatico. Si falla un borrado, se detiene e indica cuantos
  archivos se borraron; no simula rollback. Refresh al finalizar/cancelar.
- No hace staging ni commit automaticamente: revisar git status tras borrar.
- Verificado con tests aislados; botones aun por comprobar en DeepSeek.
- Navegador en origen localhost aislado: OPFS nativo, Git cargado mediante
  el mismo import del userscript, init -> write -> add -> commit -> status
  limpio -> log; redireccion gzip y lectura posterior correctas.
- Tras recargar ese origen, archivo y commit siguen accesibles y el panel
  monta con Shadow DOM cerrado. No se comprobo cierre completo del navegador.
- Los botones Ejecutar, Ejecutar + Compartir y Compartir archivo son
  visibles en ese entorno; Confirmar Envio aparece al abrir el dialogo.
  Se abrio temporalmente el Shadow DOM solo para inspeccionar esos botones.
- Hasta 1.5.5 se probaron fixtures locales, no el DOM real de DeepSeek.
  No se probaron autenticacion ni conexiones Git remotas.
  No se compartieron archivos ni resultados con la IA.
- Validacion de 1.5.3 en otro origen localhost aislado, OPFS nativo:
  repo ausente -> init -> log sin commits -> rechazo de commit vacio ->
  diff staged de archivo nuevo -> commit -> edicion -> diff unstaged ->
  add -> diff staged; diff unstaged vuelve a quedar vacio.
  Git y diff se importaron desde las mismas URLs usadas por el userscript.
- Validacion de 1.5.4 en origen localhost aislado con OPFS nativo:
  copiar bytes binarios con cabecera gzip a ruta con espacios, cancelar
  mv sin cambios y aceptar mv; destino con bytes identicos y origen ausente.
  Confirmaciones simuladas solo en esa prueba; en uso real son dialogos.
- Validacion de 1.5.5 en origen localhost aislado con OPFS nativo y un
  chat simulado sin destino remoto: borrador preservado; ambos flags envian
  una sola vez con preview; selector excluye .git/.dv y archivo de 65537 bytes.
  Confirmacion simulada; no se enviaron datos a DeepSeek.
- Diagnostico de 1.5.6 en DeepSeek autenticado: textarea visible unica,
  conserva identidad; insercion de marcador inocuo con CRLF normalizada por
  el navegador a LF. Comparar contra el original falla; contra LF funciona.
  Confirmada clase ds-button--disabled en el boton real sin texto.
  Marcadores retirados y entrada vacia al terminar, SIN pulsar enviar.
  Esto reproduce una causa del error reportado, no demuestra que todos los
  errores del usuario tengan esa causa ni certifica recepcion del servidor.
- 1.5.7 en navegador localhost, OPFS nativo: JS con logs, error runtime,
  bucle infinito detenido por timeout; fetch bloqueado por CSP, document
  ausente y OPFS inaccesible. HTML sanitizado conserva texto/CSS inline,
  elimina scripts/iframes/navegacion y bloquea acceso al padre por origen opaco.
  No se probo run en DeepSeek ni se compartieron resultados reales con la IA.

## Primer motor de ejecucion local (1.5.7)

Alcance elegido por el usuario: HTML estatico y JavaScript de consola aislado.
NO ejecutar HTML activo con scripts dentro de DeepSeek.

- 1.5.15: Ejecutar en cada fila junto a Editar equivale a `!run <ruta>`.
  Preserva rutas con espacios/comillas como argumento literal; no comparte.
  Otras extensiones muestran el mismo error de motor no disponible que run.
  Tests de rutas, busy y resultados; navegador localhost OPFS real:
  botones Editar/Ejecutar/Eliminar, HTML con espacio abre preview, JS produce
  log y fin. Confirmaciones simuladas; pendiente verificar en DeepSeek.
- `!run ejemplo.html`: modal independiente con iframe sandbox sin permisos.
  Solo CSS inline e imagenes data:. Sin scripts, formularios, links navegables
  ni recursos externos. Archivos OPFS relativos no se resuelven todavia.
  Se procesa en template inerte antes de montar para no cargar recursos
  durante el saneamiento.
- `!run ejemplo.js`: codigo en funcion async dentro de Worker dedicado,
  alojado en iframe sandbox allow-scripts SIN allow-same-origin. Maximo 256 KB
  UTF-8, 3 segundos, 100 mensajes y unos 20 KB de consola. Worker terminado
  y URLs blob retiradas al finalizar. Sin Node, imports/dependencias ni DOM.
- Usar await para tareas asincronas; timers no esperados se terminan al acabar
  la funcion. Console log/info/warn/error/debug capturados; otros metodos
  de consola no tienen salida integrada.
- Confirmacion antes de abrir/ejecutar. Resultado en lastResult: `!save salida.txt`.
  `!run ejemplo.js --share`: resultado al chat solo tras preview/confirmacion.
- Error/timeout no se presenta como exito. Motores Python, shell, C/TS/etc.
  muestran "motor no disponible".
- La vista previa HTML no constituye test de JS web. Falta resolver assets,
  DOM activo y consola de aplicaciones web en entorno adecuado.
- No hay cuota estricta de memoria para Workers: codigo que consume memoria
  puede afectar el navegador. No es una VM para malware ni sustituye un
  sandbox de sistema operativo. CSP del sitio puede impedir el arranque:
  se informa timeout/error, no se degrada a ejecutar en la pagina principal.
- Proximo bucle: candidato -> diff -> aprobar -> run -> guardar/compartir
  resultados. El motor de edicion con aprobacion aun esta pendiente.

Uso de diff (solo lectura, no aplica cambios):

- `!git diff`: staging vs working tree, como Git nativo.
- `!git diff --staged`: HEAD vs staging; antes del primer commit compara
  con el arbol vacio.
- `!git diff HEAD` (o una referencia/commit): referencia vs working tree.
- `!git diff --staged <ref>`: referencia vs staging.
- No detecta renames como tales: se muestran como borrado + adicion.
- Solo texto UTF-8 valido sin NUL produce parche; otros contenidos
  muestran "Binary files ... differ" con tamanos.
- Limite acumulado de entradas: MAX_COLLECT_CHARS (8 MB de bytes);
  limite de salida en caracteres al ejecutar; diff por archivo tiene
  timeout de 2 segundos. No es un motor para archivos grandes.
- Motor de parches: diff@7.0.0, importado bajo demanda desde esm.sh.
  No se sube contenido, pero la primera carga de Git/diff necesita red.

Uso de cp/mv:

- `!cp "origen.bin" "carpeta/copia.bin"` conserva el origen.
- `!mv "origen.bin" "carpeta/nuevo.bin"` siempre pide confirmacion;
  copia y verifica antes de borrar el origen.
- Solo archivos; no copia recursiva ni destino implicito dentro de carpetas.
  Se crean padres faltantes. Para nombres que empiezan por guion usar `--`.
- Rutas raiz, .., .git, .dv y .dv_tmp bloqueadas en ambos extremos.
  Rutas iguales tras normalizacion se rechazan.
- Reemplazar destino existente requiere confirmacion, no tiene backup.
  Una escritura fallida aborta; un destino nuevo incompleto se retira,
  y un fallo de limpieza se informa explicitamente.
- MAX_HASH_BYTES limita archivos a 512 MB; la copia usa streaming, pero
  SHA256 usa arrayBuffer en memoria. El limite no garantiza memoria suficiente.
- mv NO es atomico ni ofrece rollback/recuperacion persistente. Tras cierre
  inesperado pueden quedar ambas copias. Si falla verificacion se conserva
  el origen, pero un destino ya reemplazado no se restaura automaticamente.
- La comprobacion del origen reduce riesgos, pero no es un bloqueo contra
  otras pestanas: aun existe una ventana entre verificar y borrar.
- cp/mv no registran transacciones recuperables en journal ni hacen staging
  automaticamente. Revisar `git status`, `git diff HEAD`, `git add --all`.

Uso y limites de sharing:

- `!cat "archivo con espacios.txt" --share` comparte un diagnostico.
- `!ls --share-file "archivo con espacios.txt"` comparte el archivo completo
  si el comando tuvo exito. Si ambos flags aparecen, una sola confirmacion.
- `"--share"` entre comillas se conserva como argumento literal;
  `--` termina las opciones de sharing en ese segmento del pipeline.
- Flags duplicados, ruta vacia, ausente o interna se rechazan antes de ejecutar.
  Existencia/contenido del archivo se verifican despues: el comando puede crearlo.
- El limite es 65536 bytes por archivo, no 65536 caracteres; se rechaza binario
  o UTF-8 invalido. No se descomprime gzip automaticamente para compartir.
- La vista previa no muestra todo un archivo largo; indica longitud del mensaje
  y truncamiento. El usuario confirma el mensaje construido desde esa lectura.
- Boton Confirmar Envio abre la confirmacion con vista previa antes de enviar.
- Si hay borrador, se rechaza compartir sin reemplazarlo. Para reintentar
  guardar/vaciar borrador y compartir de nuevo.
- Si no aparece boton habilitado o la entrada no se vacia tras pulsarlo,
  error explicito. Solo se retira el mensaje insertado si sigue sin cambios;
  un borrador nuevo del usuario no se elimina.
- El boton del sitio sigue identificado por heuristica. Que se vacie la entrada
  NO prueba recepcion del servidor. Ante resultado incierto, revisar el chat
  antes de reintentar para evitar duplicados; no hay reintentos automaticos.
- 1.5.6 adapta saltos Windows a LF como hace textarea; OPFS no se modifica.
  Un mensaje residual insertado por 1.5.5 puede seguir apareciendo como borrador:
  inspeccionarlo/guardarlo antes de vaciar manualmente, no borrarlo a ciegas.
- La cancelacion de sharing no deshace el comando local ejecutado previamente.

Proximos pendientes de estabilizacion:

- [x] Panel e interceptores comprobados en DeepSeek real (1.5.34).
- [ ] `!selftest` sobre un sandbox propio -> absorbido por las pruebas de navegador (plan, punto 1).
- [x] `!cp` y `!mv` basicos para archivos, con reemplazo confirmado y copia
      verificada antes de borrar. Directorios y recuperacion quedan pendientes.
- [x] No sobrescribir borradores del chat al compartir; limitar tamano,
      mostrar vista previa y manejar errores/timeouts de envio explicitamente.
- [x] Parsear --share y --share-file como tokens, respetando comillas y
      contenido literal; ya no se extraen mediante regex sobre texto libre.
- [x] Journal con recuperacion verificable (1.5.34).

Nota: rm no ofrece deshacer automatico ni copia de recuperacion. Por eso
requiere confirmacion incluso para archivos. Su implementacion no cierra
el principio "reversible siempre" ni la fase transaccional.

## FASE 0 - Base actual (YA EXISTE)

- [x] OPFS funcional
- [x] Shell con comandos basicos
- [x] Motores WASM (QC, alineador) como caso colateral
- [x] isomorphic-git probado sobre OPFS
- [x] Adapter OPFS para Git local (sin symlinks; no es POSIX completo)
- [x] Sandbox aislado + validacion de rutas
- [x] Tests integrados (7/7 pasan)
- [x] Historial, descarga, hash

## FASE 0.5 - Investigacion y diseno (EN CURSO)

Cerrar antes de implementar el resto.

- [x] Leer userscript real (shell de comandos, comunicacion con IA)
- [x] Documentar interfaces existentes
- [ ] Definir modelo de datos: comando / commit / experimento / receta (aparcado: ver plan)
- [x] Motor transaccional disenado e implementado (candidato + journal + recuperacion)
- [ ] Test de integridad: crear -> commit -> cerrar -> reabrir -> hash (plan, punto 1)

Criterio de salida: los cinco puntos resueltos y documentados.

Interfaces actuales del userscript:

- REG + def: registro de comandos con run(ctx), args, stdin y warn.
- tokenize + parsePipeline: argumentos, pipes y redireccion final.
- execute: texto o tokens, validacion previa, ejecucion local; devuelve `{ ok, text }`.
- parseSharing: opciones externas al comando; mantiene tokens literales.
- fileShareMessage/sendWithPreview/shareFile: limite, preview y envio protegido.
- handleExecution: busy, historial por canal y opciones de compartir.
- splitPath/getHandle/requireFile/openWriter: acceso OPFS y streaming.
- makeFs: puente de esas operaciones al filesystem de isomorphic-git.
- atomicWrite: candidato, hashes, escritura y journal; aun sin recuperacion.
- adapter: localizar entrada/boton y enviar al chat; envio aun heuristico.
- buildPanel/installInterceptors: UI, atajos y deteccion pasiva de fugas.

## FASE 1 - Git local minimo

- [x] !git init
- [x] !git status
- [x] !git add <file> (y --all, incluyendo eliminaciones)
- [x] !git commit -m "..."
- [x] !git log basico (ultimos diez commits)
- [x] !git show [ref|ref:archivo] (lectura historica, 1.5.17)
- [x] !git branch (listar/crear ramas, 1.5.21)
- [x] !git checkout <rama-local> (cambio protegido, 1.5.21)
- [ ] !git checkout <commit> (HEAD separado)
- [x] !git restore <archivo> [--staged] [--source <ref>] (diff, aprobacion y
      checkpoint previo; boton Revertir en el modal Git)
- [ ] !git log [--oneline] [--graph]
- [x] !git diff [--staged] [<ref>] (texto UTF-8, binarios solo aviso)
- [x] Politica de checkout: bloquear si hay cambios sin confirmar
- [x] Checkout nunca descarta cambios automaticamente (sin --force)
- [ ] .gitignore por defecto sensato
- [x] Sin remoto por defecto

Criterio de salida: cerrar y reabrir navegador, recuperar repo,
verificar hashes de archivos confirmados.

## FASE 2 - Motor transaccional y recuperacion

- [x] Concepto: candidato vs vigente (temporal + hash)
- [ ] Flujo: preparar -> validar -> diff -> aprobar -> commit
      (editor ya prepara/diff/aprueba; validadores y commit integrado pendientes)
- [ ] Escritura atomica (temp + rename). OPFS no tiene rename atomico: hoy el
      temporal verificado + journal hace de copia de recuperacion
- [x] Registro persistente de operaciones (journal basico; errores aun ocultos)
- [x] Validacion de rutas (splitPath normaliza `.`, rechaza `..`)
- [ ] Manejo de errores sin dejar archivos a medias (cubierto en editor,
      propuestas y write; no en cp/mv/import/rm)
- [x] Recuperacion tras cierre inesperado (1.5.34: `!recover` y al iniciar;
      PREPARED > 2 min se completa, revierte o guarda `.recuperado-<id>`;
      verificado en chat.deepseek.com real, incluido el caso de conflicto)
- [x] Checkpoint persistente manual por archivo y restore aprobado (1.5.16)
- [x] Checkpoint previo automatico al restore que sobrescribe archivo existente
      (no aplica a todas las ediciones/importaciones/borrados)
- [ ] Inventario antes/despues (creados, modificados, eliminados)
- [x] Hash de contenido, no solo fecha/tamano

Criterio de salida: si la operacion falla o se interrumpe, el
original queda intacto o el sistema recupera estado consistente.

## FASE 3 - Primera edicion segura

- [x] Edicion por bloque literal con diff/aprobacion (propose + editor)
- [x] !replace <file> <old> <new> (1.5.13; bloque unico o --all)
- [ ] !replace --regex <file> <pat> <rep>
- [x] !replace --dry-run (por defecto ON; solo Aplicar confirmado escribe)
- [ ] !sed -i 's/.../.../g' <file>
- [ ] !patch <file> < diff.patch
- [ ] !jq '<expr>' <file> (subconjunto seguro)
- [x] Contador de sustituciones (replace y reemplazo manual del editor)
- [x] Integracion con Git: edicion -> working tree -> diff, staging/commit manual

Criterio de salida: el usuario ve numero de sustituciones, diff
y validacion antes de aplicar. Validacion actual: texto, tamano, hash y
coincidencia exacta; NO validacion de sintaxis/semantica por lenguaje.
Fase parcialmente cubierta; regex/sed/patch/jq y validadores pendientes.

## FASE 4 - Observabilidad

- [x] Modal con vista de diff (git diff integrado; "Ver cambios" y revision de commit)
- [ ] Grafo de Git (git log --graph --all)
- [x] Estado de archivos (working, staged, committed; barra Git y `!git status`)
- [ ] Progreso de operaciones en vivo
- [ ] Eventos y errores en tiempo real
- [ ] Hash antes/despues en cada edicion
- [ ] Historial por archivo (git log -- <file>)

Criterio de salida: el usuario reconstruye que cambio, cuando,
por que y que resultado produjo cada operacion.

## FASE 5 - Canal del plugin (parcial) y ramas (pendientes)

### 5A - Canal local y propuestas

- [x] Canal separado del chat IA general (panel local)
- [x] Protocolo estructurado de propuestas JSON con hash (propose)
- [ ] Solo comandos de edicion/ejecucion
- [ ] Muestra salida en vivo
- [ ] Errores como entrada del siguiente paso
- [ ] Validacion de sintaxis antes de enviar
- [x] Propuestas revisables en editor, aplicacion solo confirmada

### 5C - Otros sitios de chat

- [x] ChatGPT: adaptador experimental (1.5.38)
- [x] Gemini: adaptador experimental (ver seccion especifica)
- [x] Claude: adaptador experimental (1.5.40, ver seccion especifica)
- [ ] Confirmar ChatGPT, Gemini y Claude con cuenta real
- [x] Textos de interfaz: "DeepSeek" se sustituye por el sitio actual (1.5.40)

### 5B - Bifurcacion (no implementada)

- [ ] Bifurcacion: probar en rama sin destruir la vigente

Criterio de salida: una propuesta puede ejecutarse, rechazarse
o probarse en otra rama sin destruir la solucion vigente.

## FASE 6 - Validadores como extensiones

Interfaz comun: detect / validate / format / lint / test.
Cada extension declara dependencias, memoria, formatos, permisos.

- [ ] !validate <file> (detecta tipo y lanza validador)
- [ ] JSON / YAML -> parser + schema opcional
- [ ] JS/TS -> validador WASM compatible
- [ ] Python -> validador WASM compatible
- [ ] Shell -> shellcheck WASM
- [ ] Markdown -> lint basico
- [ ] Si el motor no esta disponible, decirlo honestamente

Criterio de salida: el entorno no finge que ejecuto una prueba
que no puede ejecutar.

## FASE 7 - Formateadores

> Estado: APARCADA salvo Prettier opcional; ver plan priorizado.

- [ ] !format <file> (detecta lenguaje)
- [ ] Prettier (JS/TS/JSON/CSS/MD)
- [ ] Black (Python)
- [ ] gofmt (Go)
- [ ] rustfmt (Rust)
- [ ] shfmt (Shell)
- [ ] Modo --check (solo reporta)

Criterio de salida: formatear produce candidato, no sobrescribe.

## FASE 8 - Linters

> Estado: APARCADA; ver plan priorizado.

- [ ] !lint <file> (detecta lenguaje)
- [ ] ESLint (JS/TS)
- [ ] Ruff (Python)
- [ ] Clippy (Rust)
- [ ] shellcheck (Shell)
- [ ] Resultados con severidad y ubicacion
- [ ] Auto-fix cuando el linter lo soporte

Criterio de salida: problemas visibles en el modal con linea/col.

## FASE 9 - Tests

> Estado: REFORMULADA como `!test` minimo para JS; ver plan priorizado.

- [ ] !test (detecta framework y ejecuta)
- [ ] Jest / Vitest (JS/TS)
- [ ] pytest (Python)
- [ ] cargo test (Rust)
- [ ] go test (Go)
- [ ] Resultados con check/cross por test
- [ ] Integracion con arbol: que rama pasa tests

Criterio de salida: dos ramas comparables por resultado de tests.

## FASE 10 - Arbol de decisiones

> Estado: solo se conserva la vista de ramas en texto; experimentos y recetas, aparcados (ver plan priorizado).

Va mas alla del grafo de Git.

- [x] checkpoint/restore persistente por archivo (1.5.16)
- [x] checkpoint delete <ID> y prune (1.5.22; confirmados, ultima copia protegida)
- [x] checkpoint show/diff, filtros file/tag y listado reciente primero (1.5.22)
- [ ] Visualizacion de ramas (git log --graph --all)
- [ ] Ramas muertas marcadas
- [ ] Navegacion entre commits
- [ ] Bifurcacion desde cualquier commit
- [ ] Comparacion entre ramas (git diff branch1..branch2)
- [ ] Experimentos: hipotesis + pruebas + resultado
- [ ] Recetas: comando + commit + diff reproducibles
- [ ] Registro de ideas por paso, no solo comandos

Criterio de salida: el arbol conserva el conocimiento operativo
de cada experimento, no solo el grafo.

## FASE 11 - Git remoto opcional

> Estado: solo viable desde la extension, con permisos opcionales (ver plan priorizado, punto 16).

No implementado en 1.5.23. Primero estabilizar Git local.
Los nombres/emails de commits no autentican contra ningun servidor.

- [ ] !git remote add origin <url>
- [ ] !git push / !git pull
- [ ] Elegir PAT en memoria u OAuth; no son el mismo flujo
- [ ] OAuth GitHub / GitLab (device flow, scope minimo)
- [ ] Credenciales solo en memoria por defecto, nunca en historial/log/chat
- [ ] Entrada dedicada para token; no usar `!git auth <token>` en texto libre
- [ ] Cliente HTTP y callbacks onAuth/onAuthFailure
- [ ] Verificar CORS por proveedor; no enviar credenciales a proxy publico
- [ ] Confirmacion explicita antes de push
- [ ] Sin submodulos, sin hooks automaticos
- [ ] El usuario decide si sale de "100% local"

Criterio de salida: sin remoto, todo funciona. Con remoto, es opt-in.

## FASE 12 - Descarga y exportacion

- [x] Consultar texto de HEAD/version historica con git show ref:archivo
      (1.5.17; lectura, no descarga exacta)
- [x] Descargar archivo actual del working tree con boton (bytes exactos, 1.5.18)
- [x] Exportar/importar disco completo como ZIP, con `.git` y checkpoints (1.5.38)
- [ ] Descargar version confirmada HEAD con bytes exactos
- [ ] Descargar version historica (git show <commit>:<file>)
- [ ] Descargar repo completo (git archive)
- [ ] Exportar receta reproducible (comando + commit + diff)

Criterio de salida: el usuario obtiene el resultado sin friccion.

## FASE 13 - Aprendizaje compartido

> Estado: APARCADA; ver plan priorizado.

- [ ] Historial de ideas surgidas en cada paso
- [ ] Modo exploracion (no solo ejecucion)
- [ ] Pausa + bifurcacion sin perder contexto
- [ ] Resumen de sesion (que aprendimos)
- [ ] Preferencias del usuario guardadas localmente
- [ ] La IA recibe contexto cuando se necesita

Criterio de salida: el sistema no solo ejecuta, ensena.

## Riesgos a gestionar

1. "100% local" no es automatico: el userscript puede adjuntar
   resultados a la IA. Niveles de privacidad explicitos.
2. Perdida de datos: motor transaccional + Git + registro.
3. Streaming vs memoria: hashes incrementales, limites claros.
4. Deteccion de cambios: no confiar en fecha/tamano. Hashes.
5. Codigo ejecutable: separar modulos autorizados de datos.
6. Git checkout: nunca descartar cambios sin confirmar.
7. Validadores WASM: no fingir que existen si no estan.

## Prioridad sugerida

Sustituida por el [plan priorizado](#plan-priorizado-revision-2026-10-16): primero
estabilidad y confianza (pruebas de navegador, diagnostico, papelera, i18n, licencia),
luego el bucle con la IA (patch, validacion, multiarchivo, compartir con
instruccion, Git para revisar) y, al final, lo que depende del uso real.

## Estado actual

| Fase  | Estado |
| ----- | ------ |
| 0     | ✅ Base local probada; WASM solo en laboratorio |
| 0.5   | 🟡 Interfaces documentadas; falta modelo comando/commit/experimento/receta y prueba de cierre/reapertura |
| 1     | 🟡 Git local: init, add, commit, log, diff, show, branch, checkout, restore; faltan checkout de commit, `log --graph` y `.gitignore` |
| 2     | 🟡 Candidato, hash, journal y recuperacion al iniciar; faltan rename atomico, inventario y cobertura de cp/mv/import/rm |
| 3     | 🟡 propose/replace con diff y aprobacion; faltan regex/sed/patch/jq y validadores |
| 4     | 🟡 Diff y estado Git en modal; faltan grafo, historial por archivo y progreso en vivo |
| 5     | 🟡 Panel dual, protocolo `dv` y boton de revision (DeepSeek verificado; ChatGPT, Gemini y Claude experimentales); falta bifurcacion |
| 6-9   | ⏳ Aparcadas o reformuladas (validacion basica en el plan, punto 7) |
| 10    | 🟡 Checkpoints (show/diff/prune); faltan arbol de ramas, experimentos y recetas |
| 11    | ⏳ Remoto y autenticacion no implementados |
| 12    | 🟡 Descarga actual y ZIP completo; faltan version historica exacta y `git archive` |
| 13    | ⏳ Aparcada |

## La frase que resume

Dos mentes en bucle, cada parada una bifurcacion, cada bifurcacion
un camino nuevo, cada camino reversible. Git es la columna vertebral,
el motor transaccional la red, el registro la memoria. El archivo es
el pretexto; el conocimiento compartido es el producto.

Universal por diseno: sirve para codigo, datos, texto y bio, sin
casarse con ninguno.
