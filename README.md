# loopwork

**Taller local de archivos y código asistido por IA dentro de DeepSeek.**
Userscript basado en OPFS y Git: la IA propone, el usuario revisa y aprueba.

Versión actual: **1.5.22**. **77 pruebas Node** y validaciones aisladas en navegador.
Es un prototipo funcional, no un IDE completo ni un sistema de respaldo externo.

## Contenido

- [Qué ofrece](#qué-ofrece)
- [Instalación](#instalación)
- [Primeros pasos](#primeros-pasos)
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
- Git local: commits, staging, diff, lectura histórica y ramas protegidas.
- Checkpoints independientes de Git, incluso para archivos sin commit.
- Vista previa HTML estática y JavaScript de consola aislado.
- Compartir resultados o texto de archivos solo tras vista previa y confirmación.

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
5. Comprueba que el panel muestra **v1.5.22**.

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

O pulsa **Ejecutar** en su fila. HTML se muestra sin scripts ni recursos externos.
JavaScript de consola se ejecuta en Worker aislado y muestra logs/errores en el
panel. Ambos requieren confirmación.

**Descargar** solicita guardar el archivo actual en la PC sin convertir sus
bytes. El navegador decide la ubicación y puede bloquear la descarga; el mensaje
«Descarga solicitada» no certifica que haya terminado.

**Eliminar todos** borra archivos de usuario tras confirmación y conserva Git,
checkpoints y metadatos internos. No tiene deshacer automático: no recupera
archivos sin commit o checkpoint.

## Ciclo de corrección con IA

```text
Archivo OPFS -> compartir explícitamente -> IA propone
            -> pegar comando -> revisar diff -> aprobar
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

3. Pide una propuesta JSON. Ejemplo ilustrativo: reemplaza `HASH_REAL` por los
   64 caracteres SHA256 de la versión revisada.

   ```text
   !propose '{"path":"programa.js","hash":"HASH_REAL","operation":"replace","old":"return 1;","new":"return 2;"}'
   ```

   También puedes importar un JSON y ejecutar `!propose propuesta.json`.
   Operaciones: `replace`, `insert-before`, `insert-after`, `append`.
   `old` es obligatorio y debe coincidir exactamente una vez, salvo `append`,
   que no admite `old`. No se añaden saltos de línea automáticamente.

   En JSON usa `\n` para saltos. Si el comando inline entre comillas simples
   contiene apóstrofos, codifícalos como `\u0027` o usa un archivo JSON.
   El tokenizador no interpreta escapes de shell como `\n`.

4. Revisa el diff completo y confirma **Aplicar cambios**. La propuesta no
   escribe por sí sola; un hash obsoleto se rechaza.
5. Ejecuta y versiona cuando corresponda:

   ```text
   !run programa.js
   !git diff
   !git add --all
   !git commit -m "corrección revisada"
   ```

Compartir con la IA consume el contexto/tokens del chat. Solo las operaciones
locales del panel no invocan al modelo. El ciclo sigue siendo manual.

## Comandos

El botón **Ayuda** o `!help` muestra la ayuda del registro de comandos.

| Comando | Alcance |
|---|---|
| `!ls [-R] [ruta]` | Lista contenido del disco |
| `!cat [archivo...]` / `!head [-n N] [archivo]` | Lee texto; también aceptan entrada de pipeline |
| `!write archivo texto` | Guarda texto mediante candidato y verificación |
| `!save archivo` | Guarda el último resultado textual; no exporta bytes históricos |
| `!cp origen destino` / `!mv origen destino` | Copia bytes verificados; mv confirma y borra origen tras comprobarlo |
| `!rm [-r] ruta` | Borra una ruta tras confirmación, sin rollback |
| `!view archivo [--from N] [--to N]` | Líneas numeradas y hash completo |
| `!propose propuesta.json` | Prepara un cambio JSON para el editor |
| `!replace archivo old new [--all] [--hash SHA256] [--dry-run]` | Literal único o todas las coincidencias no solapadas; diff/aprobación obligatorios |
| `!run archivo.html` / `!run archivo.js` | HTML estático o JS de consola aislado |
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
| `--share` | Resumen revisado del resultado |
| `--share-file ruta` o selector | Texto completo del archivo, tras vista previa/confirmación |

Compartir archivos requiere UTF-8 sin NUL y máximo **65536 bytes (64 KB)**.
Los mayores aparecen deshabilitados con explicación. El selector se actualiza
al abrir y tras refresh/importación; otra pestaña puede requerir reabrirlo.
Un borrador existente del chat no se reemplaza.

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

77 pruebas cubren OPFS simulado y Git real, hashes, edición, sharing, checkpoints,
descarga y checkout protegido. Hay comprobaciones adicionales en OPFS nativo
en orígenes localhost aislados. Eso no certifica todos los flujos en DeepSeek;
las pruebas reales reportadas por el usuario se distinguen en el roadmap.
No existe aún `!test` para ejecutar frameworks sobre archivos del disco virtual.

Para reportar un fallo, incluye versión, navegador, comando/pasos, resultado
esperado y error. Usa un archivo mínimo sin credenciales ni información sensible.

## Autores y colaboradores

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
