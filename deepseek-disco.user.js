// ==UserScript==
// @name         DeepSeek Disco Virtual (Dual-Channel OPFS + Git)
// @name:en      DeepSeek Virtual Disk (Dual-Channel OPFS + Git)
// @name:zh-CN   DeepSeek 虚拟磁盘（双通道 OPFS + Git）
// @namespace    local.disk
// @version      1.5.39
// @description  Entorno local OPFS con doble canal: panel soberano (0 tokens) + atajo en chat mitigado
// @description:en Local OPFS workspace with a private panel, Git versioning and reviewed AI patches
// @description:zh-CN 本地 OPFS 工作区，支持独立面板、Git 版本管理及经审核的 AI 补丁
// @match        https://chat.deepseek.com/*
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://gemini.google.com/*
// @require      https://cdn.jsdelivr.net/npm/isomorphic-git@1.32.1/index.umd.min.js
// @require      https://cdn.jsdelivr.net/npm/diff@7.0.0/dist/diff.min.js
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  // ============================================================
  // CONFIGURACIÓN
  // ============================================================
  const CFG = {
    VERSION: '1.5.39',
    ABOUT_URL: 'https://geeknome.com',
    MAX_RUN_BYTES: 1024 * 1024,
    RUN_TIMEOUT_MS: 3000,
    MAX_SHARE_FILE_BYTES: 64 * 1024,
    SEND_TIMEOUT_MS: 4000,
    MAX_OUTPUT_CHARS: 6000,
    ATTACH_PREVIEW_CHARS: 1500,
    MAX_COLLECT_CHARS: 8_000_000,
    MAX_SORT_LINES: 3_000_000,
    MAX_FETCH_BYTES: 2 * 1024 ** 3,
    MAX_HASH_BYTES: 512 * 1024 ** 2,
    MAX_WASM_INPUT_BYTES: 1024 ** 3,
    MAX_ZIP_BYTES: 1024 ** 3,
    WASM_TIMEOUT_MS: 10 * 60 * 1000,
    HISTORY_MAX: 200,
    SETTINGS_KEY: 'dv.settings.v4',
    WELCOME_KEY: 'dv.welcome.v1',
    LOCAL_FOLDER_CONSENT_KEY: 'dv.localFolder.consent.v1',
    HOST_ID: 'dv-host',
  };

  const I18N = {
    "\n... (truncado, {0} caracteres más)": [
      "\n... ({0} more characters truncated)",
      "\n...（已截断 {0} 个字符）"
    ],
    "valor no válido para {0}: {1}": [
      "invalid value for {0}: {1}",
      "{0} 的值无效：{1}"
    ],
    "regex no válida: {0}": [
      "invalid regex: {0}",
      "正则表达式无效：{0}"
    ],
    "OPFS listo": [
      "OPFS ready",
      "OPFS 已就绪"
    ],
    "ruta vacía": [
      "empty path",
      "路径为空"
    ],
    "ruta no permitida: {0}": [
      "path not allowed: {0}",
      "不允许的路径：{0}"
    ],
    "nombre no válido: {0}": [
      "invalid name: {0}",
      "名称无效：{0}"
    ],
    "nombre demasiado largo: {0}…": [
      "name too long: {0}…",
      "名称过长：{0}…"
    ],
    "no existe: {0}": [
      "does not exist: {0}",
      "不存在：{0}"
    ],
    "es una carpeta: {0}": [
      "is a folder: {0}",
      "是一个文件夹：{0}"
    ],
    "ruta no válida": [
      "invalid path",
      "路径无效"
    ],
    "no se puede borrar la raíz": [
      "cannot delete the root",
      "无法删除根目录"
    ],
    "uso: {0} <origen> <destino> (solo archivos)": [
      "usage: {0} <source> <destination> (files only)",
      "用法：{0} <源路径> <目标路径>（仅限文件）"
    ],
    "raíz y metadatos internos no permitidos": [
      "root and internal metadata are not allowed",
      "不允许使用根目录和内部元数据"
    ],
    "origen y destino son el mismo archivo": [
      "source and destination are the same file",
      "源文件和目标文件相同"
    ],
    "archivo demasiado grande para verificar: máximo {0}": [
      "file too large to verify: maximum {0}",
      "文件过大，无法验证：最大值为 {0}"
    ],
    "destino es una carpeta; indica la ruta completa del archivo": [
      "destination is a folder; specify the full file path",
      "目标是文件夹；请指定完整文件路径"
    ],
    "Mover \"{0}\" a \"{1}\" y borrar el origen": [
      "Move \"{0}\" to \"{1}\" and delete the source",
      "将“{0}”移动到“{1}”并删除源文件"
    ],
    "Reemplazar \"{0}\" con \"{1}\"": [
      "Replace \"{0}\" with \"{1}\"",
      "将“{0}”替换为“{1}”"
    ],
    "¿{0}?{1} No hay deshacer automático.": [
      "{0}?{1} There is no automatic undo.",
      "要{0}吗？{1} 不会自动撤销。"
    ],
    " El destino existente será reemplazado.": [
      " The existing destination will be replaced.",
      " 现有目标文件将被替换。"
    ],
    "{0} cancelado; no se ha modificado nada": [
      "{0} canceled; nothing was changed",
      "已取消{0}；未做任何更改"
    ],
    "el origen cambió durante la copia; no se ha borrado y el destino contiene la versión copiada": [
      "the source changed during copying; it was not deleted, and the destination contains the copied version",
      "复制期间源文件发生变化；未删除源文件，目标文件包含已复制的版本"
    ],
    "copia verificada en \"{0}\", pero no se pudo borrar \"{1}\": {2}": [
      "copy verified at \"{0}\", but could not delete \"{1}\": {2}",
      "已验证“{0}”中的副本，但无法删除“{1}”：{2}"
    ],
    "copia verificada, pero el origen sigue existiendo: {0}": [
      "copy verified, but the source still exists: {0}",
      "副本已验证，但源文件仍然存在：{0}"
    ],
    "copia fallida: {0}; no se pudo retirar el destino incompleto \"{1}\": {2}": [
      "copy failed: {0}; could not remove the incomplete destination \"{1}\": {2}",
      "复制失败：{0}；无法移除不完整的目标文件“{1}”：{2}"
    ],
    "verificación de copia fallida: {0}; el origen se conserva": [
      "copy verification failed: {0}; the source is preserved",
      "副本验证失败：{0}；源文件已保留"
    ],
    "⏳ Hay una operación en curso; vuelve a seleccionar los archivos al terminar.": [
      "⏳ An operation is in progress; reselect the files when it finishes.",
      "⏳ 操作正在进行；完成后请重新选择文件。"
    ],
    "nombre de archivo no permitido: {0}": [
      "file name not allowed: {0}",
      "不允许的文件名：{0}"
    ],
    "{0}: supera el máximo verificable de {1}": [
      "{0}: exceeds the verifiable maximum of {1}",
      "{0}：超过可验证的最大值 {1}"
    ],
    "{0}: ya existe una carpeta con ese nombre": [
      "{0}: a folder with that name already exists",
      "{0}：已存在同名文件夹"
    ],
    "¿Reemplazar \"{0}\" en el disco virtual ({1})? No hay deshacer automático.": [
      "Replace \"{0}\" on the virtual disk ({1})? There is no automatic undo.",
      "要替换虚拟磁盘（{1}）上的“{0}”吗？不会自动撤销。"
    ],
    "Omitido sin cambios: {0}": [
      "Skipped; unchanged: {0}",
      "已跳过，未更改：{0}"
    ],
    "Importado localmente: {0} ({1}, SHA256: {2}...)": [
      "Imported locally: {0} ({1}, SHA256: {2}...)",
      "已在本地导入：{0}（{1}，SHA256：{2}...）"
    ],
    "Importación terminada: {0} archivo(s), {1} omitido(s). Nada enviado a DeepSeek.": [
      "Import complete: {0} file(s), {1} skipped. Nothing was sent to DeepSeek.",
      "导入完成：{0} 个文件，跳过 {1} 个。未向 DeepSeek 发送任何内容。"
    ],
    "❌ Importación detenida: {0}. {1} archivo(s) importados y {2} omitidos; los anteriores se conservan.": [
      "❌ Import stopped: {0}. {1} file(s) imported and {2} skipped; earlier files are preserved.",
      "❌ 导入已停止：{0}。已导入 {1} 个文件，跳过 {2} 个；此前导入的文件已保留。"
    ],
    "no se puede añadir (>>) a un .gz": [
      "cannot append (>>) to a .gz file",
      "无法向 .gz 文件追加内容（>>）"
    ],
    "Auditoría no guardada: {0}": [
      "Audit log not saved: {0}",
      "审计日志未保存：{0}"
    ],
    "Integridad de temporal comprometida.": [
      "Temporary file integrity compromised.",
      "临时文件完整性已受损。"
    ],
    "archivo cambió durante la preparación; no se sobrescribió": [
      "file changed during preparation; it was not overwritten",
      "准备期间文件发生变化；未覆盖文件"
    ],
    "Verificación post-escritura fallida.": [
      "Post-write verification failed.",
      "写入后验证失败。"
    ],
    "no existe: ": [
      "does not exist: ",
      "不存在： "
    ],
    "no es dir": [
      "is not a directory",
      "不是目录"
    ],
    "no symlinks": [
      "no symbolic links",
      "不允许符号链接"
    ],
    "Cargando isomorphic-git...": [
      "Loading isomorphic-git...",
      "正在加载 isomorphic-git..."
    ],
    "sin fecha: timestamp ausente o no válido": [
      "no date: timestamp missing or invalid",
      "无日期：时间戳缺失或无效"
    ],
    "sin fecha: timestamp fuera de rango": [
      "no date: timestamp out of range",
      "无日期：时间戳超出范围"
    ],
    ".git no es una carpeta; revisa el repositorio": [
      ".git is not a folder; check the repository",
      ".git 不是文件夹；请检查仓库"
    ],
    "Git contiene metadatos internos versionados; revisa el repositorio antes de guardar": [
      "Git contains versioned internal metadata; check the repository before saving",
      "Git 中包含已纳入版本控制的内部元数据；保存前请检查仓库"
    ],
    "guardar con botón requiere una rama local activa; revisa git branch": [
      "saving with the button requires an active local branch; check git branch",
      "使用按钮保存需要当前存在活动的本地分支；请检查 git branch"
    ],
    "Git: archivo demasiado grande para verificar: {0}": [
      "Git: file too large to verify: {0}",
      "Git：文件过大，无法验证：{0}"
    ],
    "cierra el editor o espera a que termine la operación antes de versionar": [
      "close the editor or wait for the operation to finish before committing",
      "提交前请关闭编辑器或等待操作完成"
    ],
    "escribe un mensaje de commit": [
      "enter a commit message",
      "请输入提交说明"
    ],
    "actualiza la revisión de cambios antes de guardar": [
      "refresh the change review before saving",
      "保存前请刷新更改审查"
    ],
    "repositorio cambió desde la revisión; actualiza la lista antes de guardar": [
      "repository changed since review; refresh the list before saving",
      "审查后仓库发生变化；保存前请刷新列表"
    ],
    "archivos o rama cambiaron durante staging; no se hizo commit": [
      "files or branch changed during staging; no commit was created",
      "暂存期间文件或分支发生变化；未创建提交"
    ],
    "la versión actual coincide con HEAD; staging actualizado, no hay cambios para un commit": [
      "current version matches HEAD; staging updated, no changes to commit",
      "当前版本与 HEAD 一致；暂存区已更新，没有可提交的更改"
    ],
    "commit {0} creado, pero HEAD cambió; revisa git log y git status": [
      "commit {0} created, but HEAD changed; check git log and git status",
      "已创建提交 {0}，但 HEAD 已变化；请检查 git log 和 git status"
    ],
    "commit {0} creado con historial inesperado; revisa git log": [
      "commit {0} created with unexpected history; check git log",
      "已创建提交 {0}，但提交历史异常；请检查 git log"
    ],
    "commit {0} creado, pero su contenido no coincide con el staging revisado; revisa git show": [
      "commit {0} created, but its contents do not match the reviewed staging area; check git show",
      "已创建提交 {0}，但其内容与已审查的暂存区不一致；请检查 git show"
    ],
    "[{0} {1}] {2}. Git local; nada enviado al chat ni a un servidor.": [
      "[{0} {1}] {2}. Local Git; nothing was sent to the chat or a server.",
      "[{0} {1}] {2}。本地 Git；未向聊天或服务器发送任何内容。"
    ],
    "Hay cambios pendientes posteriores al commit; revisa el estado Git.": [
      "There are pending changes after the commit; check Git status.",
      "提交后仍有待处理的更改；请检查 Git 状态。"
    ],
    ". El staging puede haber cambiado; revisa git status. Sin rollback automático.": [
      ". The staging area may have changed; check git status. No automatic rollback.",
      "。暂存区可能已发生变化；请检查 git status。不会自动回滚。"
    ],
    "checkout: rama local no existe; créala con git branch <nombre>": [
      "checkout: local branch does not exist; create it with git branch <name>",
      "checkout：本地分支不存在；请使用 git branch <名称> 创建"
    ],
    "checkout: rama contiene metadatos protegidos: {0}": [
      "checkout: branch contains protected metadata: {0}",
      "checkout：分支包含受保护的元数据：{0}"
    ],
    "checkout: ruta no válida en rama: {0}": [
      "checkout: invalid path in branch: {0}",
      "checkout：分支中的路径无效：{0}"
    ],
    "checkout: tipo no soportado en rama: {0}": [
      "checkout: unsupported type in branch: {0}",
      "checkout：分支中的类型不受支持：{0}"
    ],
    "checkout bloqueado: cambios pendientes en {0} archivo(s). Revisa git status y confirma o conserva tus archivos.": [
      "checkout blocked: pending changes in {0} file(s). Check git status and commit or preserve your files.",
      "checkout 已阻止：{0} 个文件有未提交的更改。请检查 git status 并提交或保留文件。"
    ],
    "checkout bloqueado: staging contiene metadatos protegidos; revisa el repositorio": [
      "checkout blocked: staging area contains protected metadata; check the repository",
      "checkout 已阻止：暂存区包含受保护的元数据；请检查仓库"
    ],
    "checkout bloqueado: commit actual contiene metadatos protegidos": [
      "checkout blocked: current commit contains protected metadata",
      "checkout 已阻止：当前提交包含受保护的元数据"
    ],
    "checkout bloqueado: {0} archivo(s) sin seguimiento o ignorados. No se descartan automáticamente.": [
      "checkout blocked: {0} untracked or ignored file(s). They are not discarded automatically.",
      "checkout 已阻止：有 {0} 个未跟踪或已忽略的文件。不会自动丢弃这些文件。"
    ],
    "checkout: archivo demasiado grande para verificar": [
      "checkout: file too large to verify",
      "checkout：文件过大，无法验证"
    ],
    "Ya estás en la rama {0}; working tree limpio.": [
      "You are already on branch {0}; working tree is clean.",
      "当前已在分支 {0} 上；工作区干净。"
    ],
    "¿Cambiar a la rama local \"{0}\" ({1})?\nWorking tree y staging limpios. Se reemplazarán archivos por la versión confirmada de esa rama.\nSin --force, sin descarte automático. Checkpoints conservados.": [
      "Switch to local branch \"{0}\" ({1})?\nWorking tree and staging area are clean. Files will be replaced with that branch's committed version.\nNo --force and no automatic discarding. Checkpoints are preserved.",
      "要切换到本地分支“{0}”（{1}）吗？\n工作区和暂存区均干净。文件将替换为该分支中已提交的版本。\n不使用 --force，不会自动丢弃内容。检查点会保留。"
    ],
    "checkout cancelado; rama y archivos intactos": [
      "checkout canceled; branch and files are unchanged",
      "checkout 已取消；分支和文件均未更改"
    ],
    "checkout: repositorio cambió durante confirmación; no se cambió de rama": [
      "checkout: repository changed during confirmation; branch was not switched",
      "checkout：确认期间仓库发生变化；未切换分支"
    ],
    "estado final no coincide con la rama o no está limpio": [
      "final state does not match the branch or is not clean",
      "最终状态与分支不匹配或工作区不干净"
    ],
    "checkout no completado/verificado: {0}. Revisa git status y git branch; no hay rollback automático.": [
      "checkout not completed/verified: {0}. Check git status and git branch; there is no automatic rollback.",
      "checkout 未完成/验证：{0}。请检查 git status 和 git branch；不会自动回滚。"
    ],
    "Rama activa: {0} ({1}). Working tree y staging verificados limpios.": [
      "Active branch: {0} ({1}). Working tree and staging area verified clean.",
      "活动分支：{0}（{1}）。工作区和暂存区均已验证为干净。"
    ],
    "uso: git show [ref|ref:archivo]": [
      "usage: git show [ref|ref:file]",
      "用法：git show [ref|ref:文件]"
    ],
    "referencia Git no válida; usa HEAD, nombre de referencia o SHA completo": [
      "invalid Git reference; use HEAD, a reference name, or a full SHA",
      "Git 引用无效；请使用 HEAD、引用名称或完整 SHA"
    ],
    "archivo histórico no permitido": [
      "historical file not allowed",
      "不允许访问历史文件"
    ],
    "git show: máximo 256 KB por archivo histórico": [
      "git show: maximum 256 KB per historical file",
      "git show：每个历史文件最大 256 KB"
    ],
    "git show requiere texto UTF-8 sin NUL; exportación binaria pendiente": [
      "git show requires UTF-8 text without NUL; binary export is not supported",
      "git show 需要不含 NUL 的 UTF-8 文本；暂不支持导出二进制文件"
    ],
    "git show requiere texto UTF-8 válido": [
      "git show requires valid UTF-8 text",
      "git show 需要有效的 UTF-8 文本"
    ],
    "uso: git diff [--staged] [ref]": [
      "usage: git diff [--staged] [ref]",
      "用法：git diff [--staged] [ref]"
    ],
    "archivo demasiado grande para diff: {0}": [
      "file too large to diff: {0}",
      "文件过大，无法生成 diff：{0}"
    ],
    "diff demasiado grande para procesar en memoria": [
      "diff too large to process in memory",
      "diff 过大，无法在内存中处理"
    ],
    "diff excedió el tiempo límite: {0}": [
      "diff timed out: {0}",
      "diff 超时：{0}"
    ],
    "Sin diferencias. Los archivos sin seguimiento se muestran en git status.": [
      "No differences. Untracked files are shown in git status.",
      "没有差异。未跟踪的文件会显示在 git status 中。"
    ],
    "falta fichero o entrada por pipe": [
      "missing file or piped input",
      "缺少文件或管道输入"
    ],
    "comillas sin cerrar": [
      "unclosed quotation marks",
      "引号未闭合"
    ],
    "⏳ Hay una operación en curso; reintenta la descarga al terminar.": [
      "⏳ An operation is in progress; retry the download when it finishes.",
      "⏳ 操作正在进行；完成后请重试下载。"
    ],
    "archivo a descargar no permitido": [
      "file not allowed for download",
      "不允许下载此文件"
    ],
    "Descarga solicitada: {0} ({1}). Comprueba las descargas del navegador; nada enviado al chat.": [
      "Download requested: {0} ({1}). Check your browser downloads; nothing was sent to the chat.",
      "已请求下载：{0}（{1}）。请检查浏览器下载内容；未向聊天发送任何内容。"
    ],
    "❌ Descarga: {0}": [
      "❌ Download: {0}",
      "❌ 下载：{0}"
    ],
    "--share repetido": [
      "--share repeated",
      "--share 重复"
    ],
    "--share-file repetido": [
      "--share-file repeated",
      "--share-file 重复"
    ],
    "--share-file requiere una ruta: --share-file \"archivo.txt\"": [
      "--share-file requires a path: --share-file \"file.txt\"",
      "--share-file 需要路径：--share-file \"file.txt\""
    ],
    "archivo a compartir no permitido": [
      "file not allowed for sharing",
      "不允许分享此文件"
    ],
    "pipe sin comando": [
      "pipe without a command",
      "管道符前后缺少命令"
    ],
    "la redirección solo puede ir en el último comando": [
      "redirection can only be used in the last command",
      "重定向只能用于最后一个命令"
    ],
    "falta fichero tras {0}": [
      "missing file after {0}",
      "{0} 后缺少文件"
    ],
    "solo una redirección por comando": [
      "only one redirection per command",
      "每个命令只能有一个重定向"
    ],
    "comando vacío": [
      "empty command",
      "命令为空"
    ],
    "opción desconocida: {0}": [
      "unknown option: {0}",
      "未知选项：{0}"
    ],
    "falta valor para {0}": [
      "missing value for {0}",
      "{0} 缺少值"
    ],
    "no se editan metadatos internos": [
      "internal metadata cannot be edited",
      "无法编辑内部元数据"
    ],
    "editor: máximo 256 KB": [
      "editor: maximum 256 KB",
      "编辑器：最大 256 KB"
    ],
    "el editor requiere texto, no binarios": [
      "editor requires text, not binary data",
      "编辑器需要文本，不能处理二进制数据"
    ],
    "el editor requiere UTF-8 válido": [
      "editor requires valid UTF-8",
      "编辑器需要有效的 UTF-8"
    ],
    "escribe un texto para buscar": [
      "enter text to search for",
      "请输入要搜索的文本"
    ],
    "no se encontró el texto exacto": [
      "exact text not found",
      "未找到完全匹配的文本"
    ],
    "checkpoint: raíz y metadatos internos no permitidos": [
      "checkpoint: root and internal metadata are not allowed",
      "checkpoint：不允许使用根目录和内部元数据"
    ],
    "checkpoint/restore: máximo 256 KB por archivo": [
      "checkpoint/restore: maximum 256 KB per file",
      "checkpoint/restore：每个文件最大 256 KB"
    ],
    "checkpoint: ID ya existe; no se reemplazó la copia": [
      "checkpoint: ID already exists; the copy was not replaced",
      "checkpoint：ID 已存在；未替换副本"
    ],
    "checkpoint: copia no verificada; no se publicó el checkpoint": [
      "checkpoint: copy not verified; checkpoint was not published",
      "checkpoint：副本未经验证；未发布检查点"
    ],
    "ID de checkpoint no válido": [
      "invalid checkpoint ID",
      "检查点 ID 无效"
    ],
    "checkpoint: metadatos demasiado grandes": [
      "checkpoint: metadata too large",
      "checkpoint：元数据过大"
    ],
    "checkpoint: metadatos no válidos": [
      "checkpoint: invalid metadata",
      "checkpoint：元数据无效"
    ],
    "checkpoint: tamaño de copia incorrecto": [
      "checkpoint: incorrect copy size",
      "checkpoint：副本大小不正确"
    ],
    "checkpoint: hash de copia incorrecto": [
      "checkpoint: incorrect copy hash",
      "checkpoint：副本哈希不正确"
    ],
    "checkpoint: almacenamiento no es una carpeta": [
      "checkpoint: storage is not a folder",
      "checkpoint：存储位置不是文件夹"
    ],
    "checkpoint: contenido binario; diff/content requieren texto UTF-8 sin NUL": [
      "checkpoint: binary content; diff/content require UTF-8 text without NUL",
      "checkpoint：内容为二进制；diff/content 需要不含 NUL 的 UTF-8 文本"
    ],
    "checkpoint: contenido no es UTF-8 válido": [
      "checkpoint: content is not valid UTF-8",
      "checkpoint：内容不是有效的 UTF-8"
    ],
    "No hay checkpoints eliminables; se conserva la copia más reciente de cada archivo.": [
      "No checkpoints can be deleted; the most recent copy of each file is preserved.",
      "没有可删除的检查点；每个文件的最新副本都会保留。"
    ],
    "¿Borrar definitivamente {0} checkpoint(s)?\n{1}\nNo hay deshacer. Se conserva la copia más reciente de cada archivo. Archivos actuales y Git no se modifican.": [
      "Permanently delete {0} checkpoint(s)?\n{1}\nThis cannot be undone. The most recent copy of each file will be preserved. Current files and Git will not be changed.",
      "要永久删除 {0} 个检查点吗？\n{1}\n此操作无法撤销。每个文件的最新副本都会保留。当前文件和 Git 不会更改。"
    ],
    "borrado de checkpoints cancelado; copias intactas": [
      "checkpoint deletion canceled; copies are intact",
      "已取消删除检查点；副本保持完整"
    ],
    "checkpoints cambiaron durante confirmación; no se borró nada": [
      "checkpoints changed during confirmation; nothing was deleted",
      "确认期间检查点发生变化；未删除任何内容"
    ],
    "copia sigue existiendo: {0}": [
      "copy still exists: {0}",
      "副本仍然存在：{0}"
    ],
    "limpieza detenida: {0} checkpoint(s) eliminados; {1}. No se revierten borrados; el ID en curso puede quedar incompleto.": [
      "cleanup stopped: {0} checkpoint(s) deleted; {1}. Deletions are not rolled back; the current ID may be incomplete.",
      "清理已停止：已删除 {0} 个检查点；{1}。不会回滚已删除内容；当前 ID 可能不完整。"
    ],
    "Eliminados y verificados: {0} checkpoint(s). Últimas copias por archivo conservadas.": [
      "Deleted and verified: {0} checkpoint(s). The latest copies for each file were preserved.",
      "已删除并验证：{0} 个检查点。每个文件的最新副本均已保留。"
    ],
    "checkpoint <archivo> [etiqueta] | --list [--file ruta] [--tag texto] | show ID [--content] | diff ID1 ID2 | delete ID | prune <--keep N|--older-than Nd>": [
      "checkpoint <file> [label] | --list [--file path] [--tag text] | show ID [--content] | diff ID1 ID2 | delete ID | prune <--keep N|--older-than Nd>",
      "checkpoint <文件> [标签] | --list [--file 路径] [--tag 文本] | show ID [--content] | diff ID1 ID2 | delete ID | prune <--keep N|--older-than Nd>"
    ],
    "Copias locales verificadas; limpieza confirmada protege últimas versiones": [
      "Verified local copies; confirmed cleanup protects the latest versions",
      "本地副本已验证；确认清理会保护最新版本"
    ],
    "opciones incompatibles para checkpoint": [
      "incompatible checkpoint options",
      "checkpoint 选项不兼容"
    ],
    "uso: checkpoint --list [--file ruta] [--tag texto]": [
      "usage: checkpoint --list [--file path] [--tag text]",
      "用法：checkpoint --list [--file 路径] [--tag 文本]"
    ],
    "filtro de archivo no permitido": [
      "file filter not allowed",
      "不允许使用此文件筛选条件"
    ],
    "No hay checkpoints para esos filtros.": [
      "No checkpoints match those filters.",
      "没有符合这些筛选条件的检查点。"
    ],
    "uso: checkpoint show ID [--content]": [
      "usage: checkpoint show ID [--content]",
      "用法：checkpoint show ID [--content]"
    ],
    "uso: checkpoint diff ID1 ID2": [
      "usage: checkpoint diff ID1 ID2",
      "用法：checkpoint diff ID1 ID2"
    ],
    "Sin diferencias de contenido.": [
      "No content differences.",
      "内容没有差异。"
    ],
    "checkpoint diff excedió el tiempo límite": [
      "checkpoint diff timed out",
      "checkpoint diff 超时"
    ],
    "uso: checkpoint delete ID | checkpoint prune <--keep N|--older-than Nd>": [
      "usage: checkpoint delete ID | checkpoint prune <--keep N|--older-than Nd>",
      "用法：checkpoint delete ID | checkpoint prune <--keep N|--older-than Nd>"
    ],
    "checkpoint no existe en inventario": [
      "checkpoint does not exist in inventory",
      "清单中不存在此检查点"
    ],
    "no se borra el checkpoint más reciente de ese archivo (también se protegen empates de fecha)": [
      "the most recent checkpoint for that file is not deleted (ties are also protected)",
      "不会删除该文件的最新检查点（日期相同的检查点也会受到保护）"
    ],
    "--keep requiere entero positivo": [
      "--keep requires a positive integer",
      "--keep 需要正整数"
    ],
    "--older-than requiere días enteros positivos, por ejemplo 7d": [
      "--older-than requires a positive whole number of days, for example 7d",
      "--older-than 需要正整数天数，例如 7d"
    ],
    "uso: checkpoint <archivo> [etiqueta hasta 200 caracteres]": [
      "usage: checkpoint <file> [label up to 200 characters]",
      "用法：checkpoint <文件> [标签，最多 200 个字符]"
    ],
    "Restaura ruta original con aprobación y copia previa si existe": [
      "Restores the original path with approval and a prior copy if one exists",
      "经批准后恢复到原路径；如果文件存在，会先创建副本"
    ],
    "uso: restore <ID-checkpoint>": [
      "usage: restore <checkpoint-ID>",
      "用法：restore <检查点 ID>"
    ],
    "cierra el editor actual antes de restaurar": [
      "close the current editor before restoring",
      "恢复前请关闭当前编辑器"
    ],
    "restore: destino es una carpeta": [
      "restore: destination is a folder",
      "restore：目标是文件夹"
    ],
    "Sin cambios: el archivo ya coincide con el checkpoint.": [
      "No changes: the file already matches the checkpoint.",
      "没有更改：文件已与检查点一致。"
    ],
    "Restauración preparada: {0}. Revisa el diff y confirma Aplicar; se creará checkpoint previo al guardar.": [
      "Restore prepared: {0}. Review the diff and confirm Apply; a checkpoint will be created before saving.",
      "恢复已准备：{0}。请检查 diff 并确认“应用”；保存前会创建检查点。"
    ],
    "¿Restaurar \"{0}\" desde checkpoint {1} ({2} B)?\n{3}\nSHA256: {4}": [
      "Restore \"{0}\" from checkpoint {1} ({2} B)?\n{3}\nSHA256: {4}",
      "要从检查点 {1}（{2} B）恢复“{0}”吗？\n{3}\nSHA256：{4}"
    ],
    "Binario/no UTF-8: sin diff de texto. Se guardará checkpoint de la versión actual.": [
      "Binary/non-UTF-8: no text diff. A checkpoint of the current version will be saved.",
      "二进制/非 UTF-8：无法生成文本 diff。将保存当前版本的检查点。"
    ],
    "Archivo ausente: se creará con los bytes guardados.": [
      "File is missing: it will be created from the saved bytes.",
      "文件不存在：将根据已保存的字节创建文件。"
    ],
    "restauración cancelada; archivo intacto": [
      "restore canceled; file is unchanged",
      "已取消恢复；文件未更改"
    ],
    "restore: destino cambió; no se sobrescribió": [
      "restore: destination changed; it was not overwritten",
      "restore：目标发生变化；未覆盖"
    ],
    "Antes de restore {0}": [
      "Before restore {0}",
      "恢复 {0} 之前"
    ],
    "Checkpoint previo: {0}": [
      "Previous checkpoint: {0}",
      "之前的检查点：{0}"
    ],
    "restore: archivo cambió; copia previa conservada": [
      "restore: file changed; previous copy preserved",
      "restore：文件发生变化；之前的副本已保留"
    ],
    "restore: verificación fallida; checkpoint original {0}{1} conservados": [
      "restore: verification failed; original checkpoint {0}{1} preserved",
      "restore：验证失败；原始检查点 {0}{1} 已保留"
    ],
    " y previo {0}": [
      " and previous {0}",
      " 和之前的 {0}"
    ],
    "Restaurado y verificado: {0}\nSHA256: {1}{2}\nNo se hizo staging ni commit.": [
      "Restored and verified: {0}\nSHA256: {1}{2}\nNo staging or commit was performed.",
      "已恢复并验证：{0}\nSHA256：{1}{2}\n未执行暂存或提交。"
    ],
    "\nCheckpoint previo: {0}": [
      "\nPrevious checkpoint: {0}",
      "\n之前的检查点：{0}"
    ],
    "candidato requiere texto sin NUL": [
      "candidate must be text without NUL",
      "候选内容必须是不含 NUL 的文本"
    ],
    "candidato supera 256 KB": [
      "candidate exceeds 256 KB",
      "候选内容超过 256 KB"
    ],
    "no hay cambios para guardar; propuesta no produce cambios": [
      "no changes to save; proposal produces no changes",
      "没有要保存的更改；提案不会产生任何更改"
    ],
    "el archivo cambió desde que abriste el editor; no se sobrescribió. Conserva tu borrador y vuelve a abrirlo": [
      "file changed since you opened the editor; it was not overwritten. Keep your draft and reopen it",
      "自打开编辑器后文件已发生变化；未覆盖文件。请保留草稿并重新打开"
    ],
    "Antes de restore desde editor": [
      "Before restore from editor",
      "从编辑器恢复之前"
    ],
    "archivo cambió; checkpoint previo conservado, no se sobrescribió": [
      "file changed; previous checkpoint preserved, not overwritten",
      "文件发生变化；之前的检查点已保留，未覆盖文件"
    ],
    "propuesta debe ser un objeto JSON": [
      "proposal must be a JSON object",
      "提案必须是 JSON 对象"
    ],
    "campos desconocidos en propuesta": [
      "unknown fields in proposal",
      "提案中包含未知字段"
    ],
    "propuesta requiere path y hash SHA256 completo en minúsculas": [
      "proposal requires path and full lowercase SHA256 hash",
      "提案必须包含 path 和完整的小写 SHA256 哈希"
    ],
    "operation/new no válidos": [
      "invalid operation/new",
      "operation/new 无效"
    ],
    "ruta de propuesta no permitida": [
      "proposal path not allowed",
      "不允许使用此提案路径"
    ],
    "append no admite old": [
      "append does not accept old",
      "append 不接受 old"
    ],
    "old debe ser un bloque exacto no vacío": [
      "old must be a non-empty exact block",
      "old 必须是非空的精确文本块"
    ],
    "hash obsoleto; usa view y solicita una propuesta para la versión actual": [
      "stale hash; use view and request a proposal for the current version",
      "哈希已过期；请使用 view 查看当前版本并请求新提案"
    ],
    "bloque old no encontrado; no se modifica el archivo": [
      "old block not found; file is unchanged",
      "未找到 old 文本块；文件未更改"
    ],
    "bloque old ambiguo; debe coincidir una sola vez": [
      "old block is ambiguous; it must match exactly once",
      "old 文本块存在歧义；必须且只能匹配一次"
    ],
    "view <archivo> [--from N] [--to N]": [
      "view <file> [--from N] [--to N]",
      "view <文件> [--from N] [--to N]"
    ],
    "Código numerado y hash para propuestas de IA": [
      "Numbered code and hash for AI proposals",
      "为 AI 提案提供带行号的代码和哈希"
    ],
    "uso: view <archivo> [--from N] [--to N]": [
      "usage: view <file> [--from N] [--to N]",
      "用法：view <文件> [--from N] [--to N]"
    ],
    "rango de líneas no válido": [
      "invalid line range",
      "行范围无效"
    ],
    "Archivo: {0}\nSHA256: {1}\nLíneas {2}-{3} de {4}; números solo referencia, no forman parte del código.\n": [
      "File: {0}\nSHA256: {1}\nLines {2}-{3} of {4}; numbers are for reference only and are not part of the code.\n",
      "文件：{0}\nSHA256：{1}\n第 {2}-{3} 行，共 {4} 行；行号仅供参考，不属于代码内容。\n"
    ],
    "propose <propuesta.json|JSON entre comillas>": [
      "propose <proposal.json|quoted JSON>",
      "propose <proposal.json|带引号的 JSON>"
    ],
    "Prepara cambio con hash; abre editor para revisar/aprobar": [
      "Prepares a change with a hash; opens the editor for review/approval",
      "使用哈希准备更改；打开编辑器以供审查/批准"
    ],
    "uso: propose <propuesta.json|JSON entre comillas>": [
      "usage: propose <proposal.json|quoted JSON>",
      "用法：propose <proposal.json|带引号的 JSON>"
    ],
    "cierra el editor actual antes de proponer otro cambio": [
      "close the current editor before proposing another change",
      "提出其他更改前请关闭当前编辑器"
    ],
    "JSON de propuesta no válido: {0}": [
      "invalid proposal JSON: {0}",
      "提案 JSON 无效：{0}"
    ],
    "Propuesta preparada: {0}. Archivo intacto; revisa el diff y confirma Aplicar.": [
      "Proposal prepared: {0}. File unchanged; review the diff and confirm Apply.",
      "提案已准备：{0}。文件未更改；请检查 diff 并确认“应用”。"
    ],
    "replace <archivo> <old> <new> [--all] [--hash SHA256] [--dry-run]": [
      "replace <file> <old> <new> [--all] [--hash SHA256] [--dry-run]",
      "replace <文件> <old> <new> [--all] [--hash SHA256] [--dry-run]"
    ],
    "Reemplazo literal con contador, diff y aprobación; nunca guarda directamente": [
      "Literal replacement with count, diff, and approval; never saves directly",
      "按字面内容替换并显示计数和 diff，经批准后应用；绝不直接保存"
    ],
    "uso: replace <archivo> <old> <new> [--all] [--hash SHA256] [--dry-run]": [
      "usage: replace <file> <old> <new> [--all] [--hash SHA256] [--dry-run]",
      "用法：replace <文件> <old> <new> [--all] [--hash SHA256] [--dry-run]"
    ],
    "hash SHA256 completo en minúsculas requerido": [
      "full lowercase SHA256 hash required",
      "需要完整的小写 SHA256 哈希"
    ],
    "hash obsoleto; usa view para la versión actual": [
      "stale hash; use view for the current version",
      "哈希已过期；请使用 view 查看当前版本"
    ],
    "{0} sustitución(es) propuesta(s): {1}. Archivo intacto (dry-run); revisa el diff y confirma Aplicar.": [
      "{0} replacement(s) proposed: {1}. File unchanged (dry-run); review the diff and confirm Apply.",
      "建议替换 {0} 处：{1}。文件未更改（dry-run）；请检查 diff 并确认“应用”。"
    ],
    "Ya hay una operación o editor abierto.": [
      "An operation or editor is already open.",
      "已有操作正在进行或编辑器已打开。"
    ],
    "archivo cambió antes de abrir la propuesta; usa view de nuevo": [
      "file changed before opening the proposal; use view again",
      "打开提案前文件已发生变化；请重新使用 view"
    ],
    "Código de {0}": [
      "Code for {0}",
      "{0} 的代码"
    ],
    "Diferencias propuestas": [
      "Proposed changes",
      "建议的更改"
    ],
    "Aplicar cambios": [
      "Apply changes",
      "应用更改"
    ],
    "Borrador local · aún no guardado": [
      "Local draft · not saved yet",
      "本地草稿 · 尚未保存"
    ],
    "Buscar texto exacto": [
      "Search for exact text",
      "搜索完全匹配的文本"
    ],
    "Buscar texto o función (literal)": [
      "Search for text or function (literal)",
      "搜索文本或函数（按字面内容）"
    ],
    "Reemplazar por": [
      "Replace with",
      "替换为"
    ],
    "Código de reemplazo": [
      "Replacement code",
      "替换代码"
    ],
    "Escribe un texto para buscar.": [
      "Enter text to search for.",
      "请输入要搜索的文本。"
    ],
    "Sin coincidencias.": [
      "No matches.",
      "没有匹配项。"
    ],
    "Coincidencia en línea {0}": [
      "Match on line {0}",
      "在第 {0} 行找到匹配项"
    ],
    "Buscar siguiente": [
      "Find next",
      "查找下一个"
    ],
    "{0} reemplazo(s) en el borrador. Revisa el diff.": [
      "{0} replacement(s) in the draft. Review the diff.",
      "草稿中有 {0} 处替换。请检查 diff。"
    ],
    "diff excedió el tiempo límite": [
      "diff timed out",
      "diff 超时"
    ],
    "Revisa el diff completo; Aplicar comprueba la versión original.": [
      "Review the complete diff; Apply checks the original version.",
      "请检查完整 diff；“应用”会验证原始版本。"
    ],
    "Revisar diff": [
      "Review diff",
      "检查 diff"
    ],
    "¿Descartar el borrador sin guardar?": [
      "Discard the unsaved draft?",
      "要丢弃未保存的草稿吗？"
    ],
    "Cerrar": [
      "Close",
      "关闭"
    ],
    "Revisa de nuevo el diff o espera a que termine la operación.": [
      "Review the diff again or wait for the operation to finish.",
      "请重新检查 diff，或等待操作完成。"
    ],
    "¿Aplicar el diff revisado a \"{0}\"? {1} No crea commit.": [
      "Apply the reviewed diff to \"{0}\"? {1} No commit will be created.",
      "要将已审查的 diff 应用到“{0}”吗？{1} 不会创建提交。"
    ],
    "Se creará y verificará un checkpoint previo; si falla, no se guarda.": [
      "A prior checkpoint will be created and verified; if that fails, nothing will be saved.",
      "将创建并验证先前版本的检查点；如果失败，则不会保存。"
    ],
    "No crea backup automático.": [
      "No automatic backup is created.",
      "不会自动创建备份。"
    ],
    "Editor: guardado y verificado {0} (SHA256 {1}). Revisa git diff.": [
      "Editor: saved and verified {0} (SHA256 {1}). Review git diff.",
      "编辑器：已保存并验证 {0}（SHA256 {1}）。请检查 git diff。"
    ],
    "Reemplazar primero": [
      "Replace first",
      "替换第一个"
    ],
    "Reemplazar todos": [
      "Replace all",
      "全部替换"
    ],
    "SHA256 original: {0} · UTF-8 · pega o edita funciones": [
      "Original SHA256: {0} · UTF-8 · paste or edit functions",
      "原始 SHA256：{0} · UTF-8 · 粘贴或编辑函数"
    ],
    "❌ Editor: {0}": [
      "❌ Editor: {0}",
      "❌ 编辑器：{0}"
    ],
    "⏳ Hay una operación en curso; no se ha borrado nada.": [
      "⏳ An operation is in progress; nothing has been deleted.",
      "⏳ 操作正在进行；未删除任何内容。"
    ],
    "no se pueden borrar metadatos internos": [
      "internal metadata cannot be deleted",
      "无法删除内部元数据"
    ],
    "No hay archivos de usuario para eliminar.": [
      "There are no user files to delete.",
      "没有可删除的用户文件。"
    ],
    "\n... y {0} más": [
      "\n... and {0} more",
      "\n...以及另外 {0} 个"
    ],
    "¿Eliminar {0} archivo(s) de usuario?\n{1}\nSe conservan .git, .dv y .dv_tmp. No hay deshacer automático.": [
      "Delete {0} user file(s)?\n{1}\n.git, .dv, and .dv_tmp are preserved. There is no automatic undo.",
      "要删除 {0} 个用户文件吗？\n{1}\n.git、.dv 和 .dv_tmp 将保留。不会自动撤销。"
    ],
    "Borrado cancelado; no se ha eliminado nada.": [
      "Deletion canceled; nothing was deleted.",
      "已取消删除；未删除任何内容。"
    ],
    "el archivo sigue existiendo: {0}": [
      "file still exists: {0}",
      "文件仍然存在：{0}"
    ],
    "Eliminados {0} archivo(s). Git y journal conservados; revisa git status.": [
      "Deleted {0} file(s). Git and journal preserved; check git status.",
      "已删除 {0} 个文件。Git 和日志均已保留；请检查 git status。"
    ],
    "❌ Borrado detenido tras {0} archivo(s): {1}. No se revierten los borrados anteriores.": [
      "❌ Deletion stopped after {0} file(s): {1}. Earlier deletions are not rolled back.",
      "❌ 删除 {0} 个文件后停止：{1}。不会回滚此前的删除操作。"
    ],
    "Vista previa estática": [
      "Static preview",
      "静态预览"
    ],
    "Vista previa {0}: {1}": [
      "Preview {0}: {1}",
      "预览 {0}：{1}"
    ],
    "¿Abrir \"{0}\" en una pestaña de vista previa HTML estática?\nSin scripts, red ni recursos externos. Se actualizará al guardar; requiere mantener DeepSeek abierto.": [
      "Open \"{0}\" in a static HTML preview tab?\nNo scripts, network access, or external resources. It will update on save; DeepSeek must remain open.",
      "要在静态 HTML 预览标签页中打开“{0}”吗？\n不运行脚本，不访问网络或外部资源。保存时会更新；需保持 DeepSeek 打开。"
    ],
    "ejecución cancelada": [
      "execution canceled",
      "执行已取消"
    ],
    "el navegador no admite BroadcastChannel para conectar la vista previa": [
      "browser does not support BroadcastChannel for connecting the preview",
      "浏览器不支持使用 BroadcastChannel 连接预览"
    ],
    "Vista previa HTML actualizada en su pestaña: {0}.": [
      "HTML preview updated in its tab: {0}.",
      "HTML 预览已在其标签页中更新：{0}。"
    ],
    "dv-preview-": [
      "dv-preview-",
      "dv-preview-"
    ],
    "el navegador bloqueó la pestaña; permite ventanas emergentes para DeepSeek y reintenta": [
      "browser blocked the tab; allow pop-ups for DeepSeek and try again",
      "浏览器已阻止打开标签页；请允许 DeepSeek 弹出窗口后重试"
    ],
    "Vista previa HTML abierta en pestaña: {0}. Actualización automática al guardar y botón Actualizar desde disco; F5 vuelve a leer OPFS mientras el panel siga abierto. Sin scripts, red ni recursos OPFS relativos.": [
      "HTML preview opened in tab: {0}. Automatically updates on save and has a Refresh from disk button; F5 rereads OPFS while the panel remains open. No scripts, network access, or relative OPFS resources.",
      "HTML 预览已在标签页中打开：{0}。保存时自动更新，并提供“从磁盘刷新”按钮；只要面板仍打开，按 F5 就会重新读取 OPFS。不运行脚本，不访问网络或相对 OPFS 资源。"
    ],
    "uso: run <archivo.html|archivo.js>": [
      "usage: run <file.html|file.js>",
      "用法：run <文件.html|文件.js>"
    ],
    "no se ejecutan metadatos internos": [
      "internal metadata is not executed",
      "不会执行内部元数据"
    ],
    "motor no disponible; run admite HTML estático y JavaScript de consola, no Node/Python/shell": [
      "engine unavailable; run supports static HTML and console JavaScript, not Node/Python/shell",
      "运行引擎不可用；run 支持静态 HTML 和控制台 JavaScript，不支持 Node/Python/shell"
    ],
    "archivo supera 256 KB para run": [
      "file exceeds the 256 KB limit for run",
      "文件超过 run 的 256 KB 限制"
    ],
    "run requiere texto UTF-8 válido": [
      "run requires valid UTF-8 text",
      "run 需要有效的 UTF-8 文本"
    ],
    "¿Abrir \"{0}\" ({1}) en modo {2}? Sin acceso al disco, sesión ni red.": [
      "Open \"{0}\" ({1}) in {2} mode? No access to disk, session, or network.",
      "要以 {2} 模式打开“{0}”（{1}）吗？无法访问磁盘、会话或网络。"
    ],
    "JavaScript de consola aislado, máximo 3 segundos": [
      "Isolated console JavaScript, maximum 3 seconds",
      "隔离的控制台 JavaScript，最长 3 秒"
    ],
    "vista previa HTML sin scripts": [
      "HTML preview without scripts",
      "不运行脚本的 HTML 预览"
    ],
    "(sin salida)": [
      "(no output)",
      "（无输出）"
    ],
    "limite de salida excedido": [
      "output limit exceeded",
      "超出输出限制"
    ],
    "no respondió el entorno aislado dentro del límite": [
      "isolated environment did not respond within the time limit",
      "隔离环境未能在时限内响应"
    ],
    "run <archivo.html|archivo.js>": [
      "run <file.html|file.js>",
      "run <文件.html|文件.js>"
    ],
    "HTML estático o consola JS aislada (sin Node/red/OPFS)": [
      "Static HTML or isolated JS console (no Node/network/OPFS)",
      "静态 HTML 或隔离的 JS 控制台（不支持 Node/网络/OPFS）"
    ],
    "ls [-R] [ruta]": [
      "ls [-R] [path]",
      "ls [-R] [路径]"
    ],
    "Lista archivos": [
      "List files",
      "列出文件"
    ],
    "uso: ls [-R] [ruta]": [
      "usage: ls [-R] [path]",
      "用法：ls [-R] [路径]"
    ],
    "(carpeta vacía)": [
      "(empty folder)",
      "（空文件夹）"
    ],
    "rm [-r] <ruta>": [
      "rm [-r] <path>",
      "rm [-r] <路径>"
    ],
    "Elimina una ruta tras confirmación (sin deshacer)": [
      "Deletes a path after confirmation (cannot be undone)",
      "确认后删除路径（无法撤销）"
    ],
    "uso: rm [-r] <ruta>": [
      "usage: rm [-r] <path>",
      "用法：rm [-r] <路径>"
    ],
    "no se pueden borrar metadatos internos con rm": [
      "internal metadata cannot be deleted with rm",
      "无法使用 rm 删除内部元数据"
    ],
    "para borrar una carpeta usa rm -r": [
      "use rm -r to delete a folder",
      "请使用 rm -r 删除文件夹"
    ],
    "¿Eliminar \"{0}\"{1}? Esta operación no tiene deshacer automático.": [
      "Delete \"{0}\"{1}? This operation cannot be automatically undone.",
      "要删除“{0}”{1}吗？此操作无法自动撤销。"
    ],
    "borrado cancelado; no se ha eliminado nada": [
      "deletion canceled; nothing was deleted",
      "已取消删除；未删除任何内容"
    ],
    "no se pudo verificar el borrado: {0}": [
      "could not verify deletion: {0}",
      "无法验证删除操作：{0}"
    ],
    "cp <origen> <destino>": [
      "cp <source> <destination>",
      "cp <源路径> <目标路径>"
    ],
    "Copia archivo y verifica SHA256; confirma reemplazo": [
      "Copies a file and verifies SHA256; confirms replacement",
      "复制文件并验证 SHA256；替换前需确认"
    ],
    "mv <origen> <destino>": [
      "mv <source> <destination>",
      "mv <源路径> <目标路径>"
    ],
    "Copia verificada + borrado confirmado del origen": [
      "Verified copy + confirmed deletion of the source",
      "副本已验证 + 已确认删除源文件"
    ],
    "write <file> <texto...>": [
      "write <file> <text...>",
      "write <file> <文本...>"
    ],
    "Escritura atómica segura (Capa 2)": [
      "Safe atomic write (Layer 2)",
      "安全原子写入（第 2 层）"
    ],
    "uso: write <file> <texto...>": [
      "usage: write <file> <text...>",
      "用法：write <file> <文本...>"
    ],
    "Guarda último resultado atómicamente": [
      "Atomically saves the last result",
      "以原子方式保存上一次结果"
    ],
    "uso: save <file>": [
      "usage: save <file>",
      "用法：save <file>"
    ],
    "no hay resultado previo": [
      "no previous result",
      "没有上一个结果"
    ],
    "Muestra contenido": [
      "Show content",
      "显示内容"
    ],
    "Primeras N líneas": [
      "First N lines",
      "前 N 行"
    ],
    "grep [-i] [-n] [-F] <patrón> [archivo]": [
      "grep [-i] [-n] [-F] <pattern> [file]",
      "grep [-i] [-n] [-F] <模式> [文件]"
    ],
    "Busca regex o texto literal por líneas; acepta pipes": [
      "Searches lines using a regex or literal text; accepts pipes",
      "按行搜索正则表达式或字面文本；支持管道"
    ],
    "uso: grep [-i] [-n] [-F] <patrón> [archivo]": [
      "usage: grep [-i] [-n] [-F] <pattern> [file]",
      "用法：grep [-i] [-n] [-F] <模式> [文件]"
    ],
    "Ver registro de transacciones (.dv/journal)": [
      "View transaction log (.dv/journal)",
      "查看事务日志（.dv/journal）"
    ],
    "(registro de auditoría vacío)": [
      "(audit log is empty)",
      "（审计日志为空）"
    ],
    "Control de versiones local (sin remoto)": [
      "Local version control (no remote)",
      "本地版本控制（无远程仓库）"
    ],
    "uso: git <init|status|add|commit|log|diff|show|restore|branch|checkout>": [
      "usage: git <init|status|add|commit|log|diff|show|restore|branch|checkout>",
      "用法：git <init|status|add|commit|log|diff|show|restore|branch|checkout>"
    ],
    "no hay repositorio Git. Usa: git init": [
      "no Git repository. Use: git init",
      "没有 Git 仓库。请使用：git init"
    ],
    "Working tree limpio. Nada pendiente de confirmar.": [
      "Working tree clean. Nothing to commit.",
      "工作区干净。没有待提交的更改。"
    ],
    "uso: git add <ruta|--all>": [
      "usage: git add <path|--all>",
      "用法：git add <路径|--all>"
    ],
    "{0} archivos añadidos al staging area.": [
      "{0} file(s) added to the staging area.",
      "已将 {0} 个文件添加到暂存区。"
    ],
    "no se pueden versionar metadatos internos": [
      "internal metadata cannot be versioned",
      "无法对内部元数据进行版本控制"
    ],
    "Añadido al staging: {0}": [
      "Added to staging: {0}",
      "已添加到暂存区：{0}"
    ],
    "uso: git commit -m \"mensaje\"": [
      "usage: git commit -m \"message\"",
      "用法：git commit -m \"提交说明\""
    ],
    "nada nuevo en staging. Usa: git add <archivo> o git add --all": [
      "nothing new in staging. Use: git add <file> or git add --all",
      "暂存区没有新内容。请使用：git add <文件> 或 git add --all"
    ],
    "uso: git branch [nombre] (sin borrar, renombrar ni --force)": [
      "usage: git branch [name] (no deleting, renaming, or --force)",
      "用法：git branch [名称]（不支持删除、重命名或 --force）"
    ],
    "* {0} (sin commits)": [
      "* {0} (no commits)",
      "* {0}（无提交）"
    ],
    "(sin ramas locales; HEAD separado)": [
      "(no local branches; detached HEAD)",
      "（没有本地分支；HEAD 处于分离状态）"
    ],
    "crea el primer commit antes de crear otra rama": [
      "create the first commit before creating another branch",
      "创建其他分支前，请先创建首次提交"
    ],
    "Rama creada: {0}. No se cambió de rama; usa git checkout {1}.": [
      "Branch created: {0}. Not switched to it; use git checkout {1}.",
      "已创建分支：{0}。尚未切换到该分支；请使用 git checkout {1}。"
    ],
    "uso: git checkout <rama-local> (sin --force ni checkout de archivos/commits)": [
      "usage: git checkout <local-branch> (no --force or checkout of files/commits)",
      "用法：git checkout <本地分支>（不支持 --force 或检出文件/提交）"
    ],
    "cierra el editor antes de cambiar de rama": [
      "close the editor before switching branches",
      "切换分支前请关闭编辑器"
    ],
    "Sin commits aún en esta rama.": [
      "No commits on this branch yet.",
      "此分支尚无提交。"
    ],
    "subcomando no implementado: {0}": [
      "subcommand not implemented: {0}",
      "子命令尚未实现：{0}"
    ],
    "Muestra ayuda de comandos": [
      "Show command help",
      "显示命令帮助"
    ],
    "Ficheros": [
      "Files",
      "文件"
    ],
    "Texto": [
      "Text",
      "文本"
    ],
    "Auditoría": [
      "Audit",
      "审计"
    ],
    "Sistema": [
      "System",
      "系统"
    ],
    "PIPES Y REDIRECCIONES:": [
      "PIPES AND REDIRECTIONS:",
      "管道和重定向："
    ],
    "  > reemplaza; >> añade; .gz se comprime (sin >>).": [
      "  > replaces; >> appends; .gz is compressed (no >>).",
      "  > 替换；>> 追加；.gz 会压缩（不支持 >>）。"
    ],
    "  rm pide confirmación y no ofrece deshacer automático.": [
      "  rm asks for confirmation and offers no automatic undo.",
      "  rm 会请求确认，且不提供自动撤销。"
    ],
    "  Explorador: Eliminar por archivo o Eliminar todos (conserva Git/journal).": [
      "  Explorer: Delete a file or Delete all (preserves Git/journal).",
      "  浏览器：逐个删除文件或“全部删除”（保留 Git/journal）。"
    ],
    "  Editar: código numerado, buscar/reemplazar literal y diff antes de Aplicar.": [
      "  Edit: numbered code, literal find/replace, and diff before Apply.",
      "  编辑：显示带行号的代码，按字面内容查找/替换，并在应用前查看 diff。"
    ],
    "  Ejecutar junto a Editar: mismo run local con confirmación, HTML estático o consola JS.": [
      "  Run next to Edit: same local run with confirmation, static HTML, or JS console.",
      "  “编辑”旁的“运行”：通过确认执行相同的本地 run，支持静态 HTML 或 JS 控制台。"
    ],
    "  Primeros pasos prepara ejemplos sin ejecutarlos; Ampliar/Reducir conserva el comando escrito.": [
      "  Getting Started prepares examples without running them; Expand/Collapse preserves the entered command.",
      "  “入门”会准备示例但不会执行；展开/折叠时会保留已输入的命令。"
    ],
    "  Descargar por archivo: bytes originales a la PC (también binarios/gzip), sin chat ni staging.": [
      "  Download per file: original bytes to the PC (including binary/gzip), without chat or staging.",
      "  逐个下载文件：将原始字节保存到电脑（包括二进制/gzip），不经过聊天或暂存区。"
    ],
    "  El navegador decide guardar/preguntar; descarga solicitada no confirma guardado en la PC.": [
      "  The browser decides whether to save or ask; a requested download does not confirm it was saved to the PC.",
      "  是否保存或询问由浏览器决定；请求下载并不表示文件已保存到电脑。"
    ],
    "  checkpoint archivo [etiqueta]: copia bytes/hash hasta 256 KB; checkpoint --list muestra IDs.": [
      "  checkpoint file [label]: copies bytes/hash up to 256 KB; checkpoint --list shows IDs.",
      "  checkpoint 文件 [标签]：复制最多 256 KB 的字节/哈希；checkpoint --list 显示 ID。"
    ],
    "  restore ID: ruta original; texto existente en editor/diff, binario o ausente con confirmación.": [
      "  restore ID: original path; existing text in editor/diff, binary or missing file with confirmation.",
      "  restore ID：恢复到原路径；现有文本会在编辑器/diff 中显示，二进制或缺失文件需确认。"
    ],
    "  Restore conserva checkpoint previo si sobrescribe; no hace staging/commit ni elimina copias.": [
      "  Restore preserves a prior checkpoint when overwriting; it does not stage/commit or delete copies.",
      "  Restore 覆盖文件时会保留之前的检查点；不会暂存/提交或删除副本。"
    ],
    "  checkpoint --list [--file ruta] [--tag texto]: recientes primero; tag busca literal en etiqueta.": [
      "  checkpoint --list [--file path] [--tag text]: newest first; tag searches the label literally.",
      "  checkpoint --list [--file 路径] [--tag 文本]：按最新优先排列；tag 按字面内容搜索标签。"
    ],
    "  checkpoint show ID [--content] / diff ID1 ID2: consulta sin restaurar; contenido/diff solo UTF-8.": [
      "  checkpoint show ID [--content] / diff ID1 ID2: inspect without restoring; content/diff is UTF-8 only.",
      "  checkpoint show ID [--content] / diff ID1 ID2：仅查看，不执行恢复；内容/diff 仅支持 UTF-8。"
    ],
    "  Limpieza protege más reciente por archivo y empates; --keep N cuenta globalmente, conserva además esas copias.": [
      "  Cleanup protects the newest per file and ties; --keep N counts globally and preserves those copies too.",
      "  清理会保护每个文件的最新副本及并列最新项；--keep N 按全局计数，并额外保留这些副本。"
    ],
    "  Editor UTF-8 hasta 256 KB; sin corrector automático ni commit automático.": [
      "  UTF-8 editor up to 256 KB; no automatic correction or commit.",
      "  UTF-8 编辑器，最大 256 KB；不会自动更正或提交。"
    ],
    "  view archivo --from 1 --to 40: líneas + hash; --share requiere confirmación.": [
      "  view file --from 1 --to 40: lines + hash; --share requires confirmation.",
      "  view 文件 --from 1 --to 40：显示行和哈希；--share 需要确认。"
    ],
    "  propose propuesta.json o propose JSON entre comillas: candidato, diff y aprobación.": [
      "  propose proposal.json or propose quoted JSON: candidate, diff, and approval.",
      "  propose proposal.json 或 propose 带引号的 JSON：生成候选内容、diff 并请求批准。"
    ],
    "  replace archivo \"old\" \"new\": bloque literal único; --all reemplaza todas las coincidencias no solapadas.": [
      "  replace file \"old\" \"new\": one literal block; --all replaces all non-overlapping matches.",
      "  replace 文件 \"old\" \"new\"：替换一个字面文本块；--all 替换所有不重叠的匹配项。"
    ],
    "  replace siempre prepara sin guardar (también --dry-run); --hash SHA256 exige esa versión.": [
      "  replace always prepares without saving (including --dry-run); --hash SHA256 requires that version.",
      "  replace 始终只准备更改而不保存（包括 --dry-run）；--hash SHA256 要求指定该版本。"
    ],
    "  Para bloques multilínea o propuestas IA usa propose con hash y JSON.": [
      "  For multiline blocks or AI proposals, use propose with a hash and JSON.",
      "  对于多行文本块或 AI 提案，请使用带哈希和 JSON 的 propose。"
    ],
    "  Chat: JSON dv abre revisión; comandos ! de una línea se ejecutan al pulsar el botón.": [
      "  Chat: dv JSON opens review; single-line ! commands run when the button is clicked.",
      "  聊天：dv JSON 打开审查；点击按钮执行单行 ! 命令。"
    ],
    "  Aprobar parche del chat crea checkpoint previo y valida hash; no envía nada ni hace commit.": [
      "  Approving a chat patch creates a prior checkpoint and validates the hash; it sends nothing and does not commit.",
      "  批准聊天补丁时会创建先前版本的检查点并验证哈希；不会发送任何内容或执行提交。"
    ],
    "  Compartir archivo incluye SHA256 y protocolo dv; no comparte archivos automáticamente.": [
      "  Sharing a file includes SHA256 and the dv protocol; files are not shared automatically.",
      "  分享文件时会包含 SHA256 和 dv 协议；不会自动分享文件。"
    ],
    "  grep [-i] [-n] [-F] patrón [archivo]: regex/literal, números de línea y pipes.": [
      "  grep [-i] [-n] [-F] pattern [file]: regex/literal, line numbers, and pipes.",
      "  grep [-i] [-n] [-F] 模式 [文件]：支持正则表达式/字面文本、行号和管道。"
    ],
    "  POSIBLE FUGA: solo correlaciona un intento manual reciente (5 s) con el comando exacto en el DOM.": [
      "  POSSIBLE LEAK: only correlates a recent manual attempt (5 s) with the exact command in the DOM.",
      "  可能泄漏：仅将最近一次手动尝试（5 秒内）与 DOM 中的确切命令进行关联。"
    ],
    "  Ignora carga automática sin intento; no verifica tráfico ni recepción del servidor.": [
      "  Ignores automatic loading without an attempt; does not verify traffic or server receipt.",
      "  忽略没有尝试操作的自动加载；不验证流量或服务器是否收到内容。"
    ],
    "  JSON: path, hash completo, operation, old (bloque único), new (texto exacto).": [
      "  JSON: path, full hash, operation, old (single block), new (exact text).",
      "  JSON：path、完整 hash、operation、old（单个文本块）、new（精确文本）。"
    ],
    "  operation: replace, insert-before, insert-after, append (sin old).": [
      "  operation: replace, insert-before, insert-after, append (without old).",
      "  operation：replace、insert-before、insert-after、append（不带 old）。"
    ],
    "  Saltos dentro del JSON: \\n o \\r\\n; no se añaden saltos automáticamente.": [
      "  Line breaks in JSON: \\n or \\r\\n; line breaks are not added automatically.",
      "  JSON 中的换行：使用 \\n 或 \\r\\n；不会自动添加换行。"
    ],
    "  Explorar / Importar: elige archivos del equipo; guarda bytes en la raíz OPFS.": [
      "  Browse / Import: choose files from your computer; saves bytes to the OPFS root.",
      "  浏览/导入：从电脑中选择文件；将字节保存到 OPFS 根目录。"
    ],
    "  Importación local, máximo 512 MB por archivo; confirma reemplazos, sin staging.": [
      "  Local import, maximum 512 MB per file; replacements require confirmation, no staging.",
      "  本地导入，每个文件最大 512 MB；替换需确认，不会暂存。"
    ],
    "  cp/mv: solo archivos, destino completo; preservan bytes (también .gz).": [
      "  cp/mv: files only, full destination path; preserves bytes (including .gz).",
      "  cp/mv：仅限文件，需提供完整目标路径；保留原始字节（包括 .gz）。"
    ],
    "  cp confirma reemplazos; mv siempre confirma. Máximo verificable: 512 MB.": [
      "  cp confirms replacements; mv always requires confirmation. Verifiable maximum: 512 MB.",
      "  cp 替换前会请求确认；mv 始终需要确认。可验证的最大值：512 MB。"
    ],
    "  mv no es rename atómico: copia y verifica antes de borrar el origen.": [
      "  mv is not an atomic rename: it copies and verifies before deleting the source.",
      "  mv 不是原子重命名：会先复制并验证，然后再删除源文件。"
    ],
    "  run: HTML estático (sin scripts/recursos relativos); JS de consola aislado.": [
      "  run: static HTML (no scripts/relative resources); isolated console JS.",
      "  run：静态 HTML（不含脚本/相对资源）；隔离的控制台 JS。"
    ],
    "  HTML abre pestaña conectada: autoactualiza al guardar, Actualizar desde disco y F5; mantén DeepSeek abierto.": [
      "  HTML opens a connected tab: auto-updates on save, Refresh from disk, and F5; keep DeepSeek open.",
      "  HTML 会在已连接的标签页中打开：保存时自动更新，也可“从磁盘刷新”或按 F5；请保持 DeepSeek 打开。"
    ],
    "  JS: máximo 3 segundos, 100 mensajes/20 KB; usa await para trabajo asíncrono.": [
      "  JS: maximum 3 seconds, 100 messages/20 KB; use await for asynchronous work.",
      "  JS：最长 3 秒，最多 100 条消息/20 KB；异步任务请使用 await。"
    ],
    "  Sin DOM, Node, dependencias, red ni OPFS; salida disponible para save/--share.": [
      "  No DOM, Node, dependencies, network, or OPFS; output is available to save/--share.",
      "  不支持 DOM、Node、依赖项、网络或 OPFS；输出可用于 save/--share。"
    ],
    "  git diff: staging vs archivos; git diff --staged: HEAD vs staging.": [
      "  git diff: staging vs. files; git diff --staged: HEAD vs. staging.",
      "  git diff：比较暂存区与文件；git diff --staged：比较 HEAD 与暂存区。"
    ],
    "  git diff [--staged] <ref>: referencia vs archivos o staging.": [
      "  git diff [--staged] <ref>: reference vs. files or staging.",
      "  git diff [--staged] <ref>：比较引用与文件或暂存区。"
    ],
    "  Diff unificado UTF-8; binarios solo informan cambio; sin seguimiento: git status.": [
      "  Unified UTF-8 diff; binaries only report a change; untracked files: git status.",
      "  UTF-8 统一 diff；二进制文件仅报告是否更改；未跟踪文件请使用 git status 查看。"
    ],
    "  git show [ref]: datos del commit (HEAD por defecto), no su diff.": [
      "  git show [ref]: commit data (HEAD by default), not its diff.",
      "  git show [ref]：提交数据（默认为 HEAD），而不是 diff。"
    ],
    "  git show ref:archivo: texto histórico UTF-8 hasta 256 KB; sin checkout ni restauración.": [
      "  git show ref:file: historical UTF-8 text up to 256 KB; no checkout or restore.",
      "  git show ref:文件：最多 256 KB 的历史 UTF-8 文本；不执行 checkout 或恢复。"
    ],
    "  Referencias de commit: HEAD, nombre de rama o SHA completo; sin HEAD~N ni SHA abreviado.": [
      "  Commit references: HEAD, branch name, or full SHA; no HEAD~N or abbreviated SHA.",
      "  提交引用：HEAD、分支名称或完整 SHA；不支持 HEAD~N 或缩写 SHA。"
    ],
    "  El log resume 800 caracteres; git show HEAD:archivo | head -n 20 permite ver un fragmento.": [
      "  The log summarizes 800 characters; git show HEAD:file | head -n 20 shows a snippet.",
      "  日志摘要为 800 个字符；使用 git show HEAD:文件 | head -n 20 可查看片段。"
    ],
    "  Redirigir show guarda texto, no exporta bytes exactos (saltos/BOM pueden cambiar).": [
      "  Redirecting show saves text, not exact bytes (line endings/BOM may change).",
      "  重定向 show 会保存文本，而非精确字节（换行符/BOM 可能发生变化）。"
    ],
    "  Git remoto todavía no está implementado.": [
      "  Remote Git is not implemented yet.",
      "  尚未实现远程 Git。"
    ],
    "  Guardar cambios en Git: revisa lista y mensaje; confirma add --all + commit local, incluidos borrados.": [
      "  Save changes in Git: review the list and message; confirm add --all + local commit, including deletions.",
      "  在 Git 中保存更改：检查列表和提交说明；确认执行 add --all 并创建本地提交，包括删除项。"
    ],
    "  El botón usa los archivos actuales, reemplaza staging anterior y excluye metadatos; no elimina comandos.": [
      "  The button uses current files, replaces previous staging, and excludes metadata; it does not delete commands.",
      "  此按钮使用当前文件，替换之前的暂存内容并排除元数据；不会删除命令。"
    ],
    "  Ver cambios muestra estado, diff sin staging y diff staged; sin revertir automático.": [
      "  View changes shows status, unstaged diff, and staged diff; no automatic revert.",
      "  “查看更改”会显示状态、未暂存的 diff 和已暂存的 diff；不会自动还原。"
    ],
    "  git branch [nombre]: lista/crea ramas locales; * indica activa; crear no cambia de rama.": [
      "  git branch [name]: lists/creates local branches; * marks the active one; creation does not switch branches.",
      "  git branch [名称]：列出/创建本地分支；* 表示当前分支；创建分支不会切换分支。"
    ],
    "  git checkout rama: confirma cambio; bloquea staging/cambios/archivos ignorados o sin seguimiento.": [
      "  git checkout branch: confirms the switch; blocked by staging/changes/ignored or untracked files.",
      "  git checkout 分支：确认切换；若有暂存内容、更改、已忽略或未跟踪的文件，则会阻止切换。"
    ],
    "  Sin --force, borrado de ramas, HEAD separado ni restauración Git de archivos.": [
      "  No --force, branch deletion, detached HEAD, or Git file restore.",
      "  不支持 --force、删除分支、分离 HEAD 或使用 Git 恢复文件。"
    ],
    "CANALES DE USO:": [
      "USAGE CHANNELS:",
      "使用方式："
    ],
    "  1. Panel Soberano: Entrada robusta y privada (0 tokens consumidos).": [
      "  1. Sovereign Panel: robust, private input (0 tokens consumed).",
      "  1. 独立面板：稳定且私密的输入方式（不消耗 token）。"
    ],
    "  2. Atajo en Chat: Escribe !cmd directamente (se ejecuta local y no va al chat).": [
      "  2. Chat shortcut: type !cmd directly (runs locally and is not sent to chat).",
      "  2. 聊天快捷方式：直接输入 !cmd（在本地运行，不会发送到聊天）。"
    ],
    "  3. Compartir con IA:": [
      "  3. Share with AI:",
      "  3. 与 AI 分享："
    ],
    "     - Añade --share para enviar el resumen del comando al chat.": [
      "     - Add --share to send the command summary to chat.",
      "     - 添加 --share 可将命令摘要发送到聊天。"
    ],
    "     - Añade --share-file <ruta> para transferir el archivo completo tras confirmación.": [
      "     - Add --share-file <path> to transfer the full file after confirmation.",
      "     - 添加 --share-file <路径> 可在确认后传输完整文件。"
    ],
    "     - Vista previa y confirmación antes de enviar; no se reemplazan borradores.": [
      "     - Preview and confirm before sending; drafts are not replaced.",
      "     - 发送前可预览并确认；不会替换草稿。"
    ],
    "     - Archivos UTF-8 sin NUL, máximo 64 KB; metadatos internos excluidos.": [
      "     - UTF-8 files without NUL, maximum 64 KB; internal metadata is excluded.",
      "     - UTF-8 文件不得含 NUL，最大 64 KB；内部元数据除外。"
    ],
    "     - \"--share\" entre comillas es texto literal; -- termina las opciones.": [
      "     - Quoted \"--share\" is literal text; -- ends the options.",
      "     - 带引号的 \"--share\" 是字面文本；-- 表示选项结束。"
    ],
    "     - Usa los botones correspondientes en el panel.": [
      "     - Use the corresponding buttons in the panel.",
      "     - 请使用面板中的相应按钮。"
    ],
    "git checkout no admite pipes ni redirecciones": [
      "git checkout does not support pipes or redirections",
      "git checkout 不支持管道或重定向"
    ],
    "{0} no admite pipes ni redirecciones": [
      "{0} does not support pipes or redirections",
      "{0} 不支持管道或重定向"
    ],
    "comando no reconocido: {0}": [
      "unrecognized command: {0}",
      "无法识别的命令：{0}"
    ],
    "destino de redirección no permitido": [
      "redirection destination not allowed",
      "不允许使用此重定向目标"
    ],
    "Guardado: {0} ({1} de texto)": [
      "Saved: {0} ({1} of text)",
      "已保存：{0}（文本 {1}）"
    ],
    "salida demasiado grande; usa head o redirige a un archivo": [
      "output too large; use head or redirect to a file",
      "输出过大；请使用 head 或重定向到文件"
    ],
    "hay otro envío al chat en curso": [
      "another chat send is in progress",
      "另一个聊天发送操作正在进行"
    ],
    "no se encontró una entrada de chat visible": [
      "no visible chat input was found",
      "未找到可见的聊天输入框"
    ],
    "hay un borrador en el chat; consérvalo o vacía la entrada antes de compartir": [
      "there is a chat draft; keep it or clear the input before sharing",
      "聊天中有草稿；请先保留草稿或清空输入框，再进行分享"
    ],
    "la entrada del chat cambió; envío cancelado": [
      "chat input changed; sending canceled",
      "聊天输入内容已更改；已取消发送"
    ],
    "no se encontró un botón de envío habilitado; no se envió el mensaje": [
      "no enabled send button was found; the message was not sent",
      "未找到已启用的发送按钮；消息未发送"
    ],
    "la entrada o el botón del chat cambió; envío cancelado": [
      "chat input or button changed; sending canceled",
      "聊天输入框或按钮已更改；已取消发送"
    ],
    "no se pudo verificar el envío; comprueba el chat antes de reintentar": [
      "could not verify the send; check the chat before retrying",
      "无法验证是否已发送；重试前请检查聊天"
    ],
    "archivo supera 64 KB; comparte un resumen con head": [
      "file exceeds 64 KB; share a summary with head",
      "文件超过 64 KB；请使用 head 分享摘要"
    ],
    "no se comparten archivos binarios; usa un resumen de texto": [
      "binary files cannot be shared; use a text summary",
      "无法分享二进制文件；请使用文本摘要"
    ],
    "el archivo no es texto UTF-8 válido": [
      "file is not valid UTF-8 text",
      "文件不是有效的 UTF-8 文本"
    ],
    "Analiza este archivo. Si propones una corrección, devuelve un bloque Markdown con lenguaje dv y un único objeto JSON puro, sin comandos ni comillas de shell.\n": [
      "Analyze this file. If you propose a correction, return a Markdown block with language dv containing a single plain JSON object, with no commands or shell quotes.\n",
      "请分析此文件。如果建议修改，请返回一个语言标记为 dv 的 Markdown 代码块，其中仅包含一个纯 JSON 对象，不得包含命令或 shell 引号。\n"
    ],
    "Usa path={0} y hash=\"{1}\" exactamente; no inventes ni recalcules el hash.\n": [
      "Use path={0} and hash=\"{1}\" exactly; do not invent or recalculate the hash.\n",
      "请完全照用 path={0} 和 hash=\"{1}\"；不要编造或重新计算哈希。\n"
    ],
    "Campos: path, hash, operation, old, new. operation: replace, insert-before, insert-after o append (sin old).\n": [
      "Fields: path, hash, operation, old, new. operation: replace, insert-before, insert-after, or append (without old).\n",
      "字段：path、hash、operation、old、new。operation：replace、insert-before、insert-after 或 append（不带 old）。\n"
    ],
    "old debe ser texto exacto y coincidir una sola vez; new es texto exacto, no un diff ni código con puntos suspensivos. ": [
      "old must be exact text and match once; new is exact text, not a diff or code with ellipses. ",
      "old 必须是精确文本且只匹配一次；new 必须是精确文本，不能是 diff 或带省略号的代码。 "
    ],
    "Escapa saltos como \\n (o \\r\\n si el original los usa). Una propuesta por bloque y archivo. ": [
      "Escape line breaks as \\n (or \\r\\n if used by the original). One proposal per block and file. ",
      "将换行转义为 \\n（如果原文使用 \\r\\n，则使用 \\r\\n）。每个代码块和文件只提交一个提案。 "
    ],
    "Si falta contexto, pídelo; no supongas acceso al disco. El usuario revisará el diff y aprobará antes de guardar.": [
      "If context is missing, ask for it; do not assume access to the disk. The user will review the diff and approve before saving.",
      "如果缺少上下文，请先询问；不要假设可以访问磁盘。用户会在保存前检查 diff 并批准。"
    ],
    "hay un borrador en el chat; no se ha reemplazado": [
      "there is a chat draft; it was not replaced",
      "聊天中有草稿；未将其替换"
    ],
    "¿Compartir con el chat ({0} caracteres)?\nVista previa:\n{1}": [
      "Share with the chat ({0} characters)?\nPreview:\n{1}",
      "要与聊天分享吗（{0} 个字符）？\n预览：\n{1}"
    ],
    "envío cancelado; no se ha compartido nada": [
      "sending canceled; nothing was shared",
      "已取消发送；未分享任何内容"
    ],
    "📤 El chat vació la entrada tras solicitar el envío; comprueba la respuesta del asistente.": [
      "📤 Chat cleared the input after the send was requested; check the assistant's response.",
      "📤 请求发送后聊天输入框已清空；请检查助手的回复。"
    ],
    "⏳ Hay una operación en curso; reintenta al terminar.": [
      "⏳ An operation is in progress; try again when it finishes.",
      "⏳ 操作正在进行；完成后请重试。"
    ],
    "⏳ Hay una operación en curso...": [
      "⏳ An operation is in progress...",
      "⏳ 操作正在进行..."
    ],
    "⚠ Comando vacío": [
      "⚠ Empty command",
      "⚠ 命令为空"
    ],
    "$ {0}  [ejecutado localmente, no enviado al chat]": [
      "$ {0}  [executed locally, not sent to chat]",
      "$ {0}  [在本地执行，未发送到聊天]"
    ],
    "[Diagnóstico DV: {0}]\n{1}\n{2}\n{3}\nAnaliza este resultado.": [
      "[DV diagnostic: {0}]\n{1}\n{2}\n{3}\nAnalyze this result.",
      "[DV 诊断：{0}]\n{1}\n{2}\n{3}\n请分析此结果。"
    ],
    "el comando falló; no se compartió el archivo": [
      "command failed; file was not shared",
      "命令失败；文件未分享"
    ],
    "❌ Error: {0}": [
      "❌ Error: {0}",
      "❌ 错误：{0}"
    ],
    "bloque de propuesta demasiado grande": [
      "proposal block too large",
      "提案代码块过大"
    ],
    "solo se admite JSON dv o !propose con JSON inline": [
      "only dv JSON or !propose with inline JSON is supported",
      "仅支持 dv JSON 或带内联 JSON 的 !propose"
    ],
    "chat: solo propose con un JSON inline, sin pipes, archivos ni opciones": [
      "chat: only propose with inline JSON, no pipes, files, or options",
      "聊天：仅支持带内联 JSON 的 propose，不支持管道、文件或选项"
    ],
    "cierra el editor o espera a que termine la operación antes de revisar otro parche": [
      "close the editor or wait for the operation to finish before reviewing another patch",
      "检查其他补丁前，请关闭编辑器或等待操作完成"
    ],
    "se abrió otra operación durante la preparación; reintenta al terminar": [
      "another operation opened during preparation; try again when it finishes",
      "准备期间启动了另一项操作；完成后请重试"
    ],
    "Antes de parche desde chat": [
      "Before patch from chat",
      "应用聊天补丁之前"
    ],
    "Revisar parche en DV": [
      "Review patch in DV",
      "在 DV 中检查补丁"
    ],
    "Ejecutar en DV": [
      "Run in DV",
      "在 DV 中执行"
    ],
    "¿Ejecutar \"{0}\" en el disco virtual?": [
      "Run \"{0}\" in the virtual disk?",
      "在虚拟磁盘中执行“{0}”？"
    ],
    "Ejecución cancelada.": [
      "Execution cancelled.",
      "执行已取消。"
    ],
    "Ejecutando: {0}...": [
      "Running: {0}...",
      "正在执行：{0}..."
    ],
    "Ejecución finalizada. Revisa el panel.": [
      "Execution finished. Check the panel.",
      "执行已结束。请查看面板。"
    ],
    "Ejecutar comando local. Se mantienen las confirmaciones propias del comando. Revisa la salida en el panel.": [
      "Run a local command. Command-specific confirmations still apply. Check the output in the panel.",
      "执行本地命令。仍保留命令自身的确认。请在面板中查看输出。"
    ],
    "el bloque ya no está en el chat": [
      "block is no longer in the chat",
      "代码块已不在聊天中"
    ],
    "Propuesta: {0}. Revisa el diff; aún no guardada.": [
      "Proposal: {0}. Review the diff; not saved yet.",
      "提案：{0}。请检查 diff；尚未保存。"
    ],
    "Parche desde chat: {0}. Archivo intacto; aprobación y checkpoint requeridos.": [
      "Patch from chat: {0}. File unchanged; approval and checkpoint required.",
      "聊天补丁：{0}。文件未更改；需要批准并创建检查点。"
    ],
    "no se pudo abrir el editor; consulta el error en el panel. Archivo intacto.": [
      "could not open the editor; check the error in the panel. File unchanged.",
      "无法打开编辑器；请查看面板中的错误。文件未更改。"
    ],
    "No se preparó: {0}": [
      "Not prepared: {0}",
      "未准备：{0}"
    ],
    "Parche desde chat: {0}": [
      "Patch from chat: {0}",
      "聊天补丁：{0}"
    ],
    "Abrir diff local; al aprobar se crea checkpoint. No ejecuta código ni envía mensajes.": [
      "Opens a local diff; approval creates a checkpoint. Does not run code or send messages.",
      "打开本地 diff；批准后会创建检查点。不会运行代码或发送消息。"
    ],
    "Revisión local con hash y checkpoint.": [
      "Local review with hash and checkpoint.",
      "使用哈希和检查点进行本地审查。"
    ],
    "Propuesta incompleta o inválida: {0}": [
      "Incomplete or invalid proposal: {0}",
      "提案不完整或无效：{0}"
    ],
    "no hay document.body; no se pueden instalar interceptores ni detector": [
      "document.body is missing; interceptors and detector cannot be installed",
      "缺少 document.body；无法安装拦截器和检测器"
    ],
    "⏳ Hay una operación en curso... El comando permanece en la entrada.": [
      "⏳ An operation is in progress... The command remains in the input.",
      "⏳ 操作正在进行...命令仍保留在输入框中。"
    ],
    "⚠ POSIBLE FUGA: Tras intentar enviar, apareció el comando exacto ({0}...) fuera del panel. ": [
      "⚠ POSSIBLE LEAK: After an attempted send, the exact command ({0}...) appeared outside the panel. ",
      "⚠ 可能泄漏：尝试发送后，面板外出现了确切命令（{0}...）。 "
    ],
    "Comprueba el chat; el DOM no confirma un envío al servidor.": [
      "Check the chat; the DOM does not confirm delivery to the server.",
      "请检查聊天；DOM 无法确认内容已发送到服务器。"
    ],
    "Seleccionar archivos para importar al disco virtual": [
      "Select files to import to the virtual disk",
      "选择要导入虚拟磁盘的文件"
    ],
    "Elegir archivos de la PC y copiarlos al disco local; no se comparten": [
      "Choose files from the PC and copy them to the local disk; they are not shared",
      "从电脑中选择文件并复制到本地磁盘；不会分享这些文件"
    ],
    "⏳ Hay una operación en curso; espera antes de importar.": [
      "⏳ An operation is in progress; wait before importing.",
      "⏳ 操作正在进行；请等待后再导入。"
    ],
    "Explorar / Importar archivos…": [
      "Browse / Import files…",
      "浏览/导入文件…"
    ],
    "Comandos locales... (Enter ejecuta, Shift+Enter nueva línea)\nEj: !git status · !ls · !write f.txt \"hola\"": [
      "Local commands... (Enter runs, Shift+Enter adds a new line)\nE.g.: !git status · !ls · !write f.txt \"hello\"",
      "本地命令...（Enter 执行，Shift+Enter 换行）\n例如：!git status · !ls · !write f.txt \"你好\""
    ],
    "Listo · local": [
      "Ready · local",
      "就绪 · 本地"
    ],
    "Archivos incluidos en el commit": [
      "Files included in the commit",
      "提交中包含的文件"
    ],
    "Mensaje del commit": [
      "Commit message",
      "提交说明"
    ],
    "Cierra el editor o espera antes de revisar Git.": [
      "Close the editor or wait before reviewing Git.",
      "检查 Git 前请关闭编辑器或等待。"
    ],
    "Verificando archivos y staging...": [
      "Verifying files and staging...",
      "正在验证文件和暂存区..."
    ],
    "Git no está inicializado; cierra y pulsa Inicializar Git local": [
      "Git is not initialized; close this and click Initialize local Git",
      "Git 尚未初始化；请关闭并点击“初始化本地 Git”"
    ],
    "Rama: {0}. {1} archivo(s). ": [
      "Branch: {0}. {1} file(s). ",
      "分支：{0}。{1} 个文件。 "
    ],
    "Se guardan las versiones actuales y los borrados de esta lista. El staging anterior se reemplaza por esos archivos actuales. ": [
      "The current versions and deletions in this list will be saved. Previous staging is replaced with these current files. ",
      "将保存此列表中的当前版本和删除项。之前的暂存内容将替换为这些当前文件。 "
    ],
    "Los archivos ignorados sin seguimiento y metadatos internos se excluyen. No sube nada a un servidor.": [
      "Untracked ignored files and internal metadata are excluded. Nothing is uploaded to a server.",
      "未跟踪的忽略文件和内部元数据将被排除。不会上传任何内容到服务器。"
    ],
    "{0}: cambios": [
      "{0}: changes",
      "{0}：更改"
    ],
    "Guardar {0} archivos": [
      "Save {0} files",
      "保存 {0} 个文件"
    ],
    "No se pudo preparar: {0}": [
      "Could not prepare: {0}",
      "无法准备：{0}"
    ],
    "Revisar todos los cambios y confirmar un commit Git local; no sube archivos ni elimina comandos": [
      "Review all changes and confirm a local Git commit; does not upload files or delete commands",
      "检查所有更改并确认创建本地 Git 提交；不会上传文件或删除命令"
    ],
    "Espera o cierra el editor antes de versionar.": [
      "Wait or close the editor before committing.",
      "提交前请等待或关闭编辑器。"
    ],
    "Guardar cambios en Git": [
      "Save changes in Git",
      "在 Git 中保存更改"
    ],
    "Ver cambios": [
      "View changes",
      "查看更改"
    ],
    "No se completó el guardado: {0}": [
      "Save did not complete: {0}",
      "保存未完成：{0}"
    ],
    "Confirmar commit local": [
      "Confirm local commit",
      "确认本地提交"
    ],
    "Actualizar lista": [
      "Refresh list",
      "刷新列表"
    ],
    "Ver diferencias": [
      "View differences",
      "查看差异"
    ],
    "Cancelar": [
      "Cancel",
      "取消"
    ],
    "Archivos nuevos sin seguimiento: consulta la lista (no aparecen en git diff).\n\n": [
      "New untracked files: see the list (they do not appear in git diff).\n\n",
      "新建的未跟踪文件：请查看列表（不会显示在 git diff 中）。\n\n"
    ],
    "No se pudo mostrar el diff: {0}": [
      "Could not show the diff: {0}",
      "无法显示 diff：{0}"
    ],
    "Guardar cambios en Git local": [
      "Save changes to local Git",
      "将更改保存到本地 Git"
    ],
    "Panel Soberano": [
      "Sovereign Panel",
      "独立面板"
    ],
    "Ejecutar el comando en el navegador sin enviarlo a la IA": [
      "Run the command in the browser without sending it to AI",
      "在浏览器中运行命令，不发送给 AI"
    ],
    "Ejecutar": [
      "Run",
      "运行"
    ],
    "Ejecutar y enviar directamente el resumen al chat, sin vista previa; no reemplaza borradores del chat": [
      "Run and send the summary directly to the chat without a preview; does not replace chat drafts",
      "运行并将摘要直接发送到聊天，不提供预览；不会替换聊天草稿"
    ],
    "Ejecutar + Compartir": [
      "Run + Share",
      "运行 + 分享"
    ],
    "Máximo 64 KB por archivo; solo texto UTF-8. Los archivos mayores se muestran deshabilitados.": [
      "Maximum 64 KB per file; UTF-8 text only. Larger files are shown disabled.",
      "每个文件最大 64 KB；仅限 UTF-8 文本。较大的文件会显示为禁用状态。"
    ],
    "Enviar directamente el archivo seleccionado al chat, sin confirmación adicional; no reemplaza borradores del chat": [
      "Send the selected file directly to the chat without additional confirmation; does not replace chat drafts",
      "无需额外确认，直接将选定文件发送到聊天；不会替换聊天草稿"
    ],
    "Selecciona un archivo de hasta 64 KB; para uno mayor comparte un resumen con head.": [
      "Select a file up to 64 KB; for a larger file, share a summary with head.",
      "请选择不超过 64 KB 的文件；对于较大的文件，请使用 head 分享摘要。"
    ],
    "Enviar archivo al chat": [
      "Send file to chat",
      "将文件发送到聊天"
    ],
    "Selecciona archivo a compartir:": [
      "Select a file to share:",
      "选择要分享的文件："
    ],
    "No hay archivos de usuario para compartir.": [
      "There are no user files to share.",
      "没有可分享的用户文件。"
    ],
    " — supera 64 KB; comparte un resumen": [
      " — exceeds 64 KB; share a summary",
      " — 超过 64 KB；请分享摘要"
    ],
    "Enviar archivo al chat comparte directamente el texto completo, sin confirmación adicional. Máximo 64 KB; solo UTF-8. Los mayores aparecen deshabilitados. Para un resumen: head -n 30 \"archivo\" --share.": [
      "Send file to chat shares the full text directly, without additional confirmation. Maximum 64 KB; UTF-8 only. Larger files are disabled. For a summary: head -n 30 \"file\" --share.",
      "“将文件发送到聊天”会直接分享完整文本，无需额外确认。最大 64 KB；仅限 UTF-8。较大的文件会被禁用。要分享摘要，请使用：head -n 30 \"文件\" --share。"
    ],
    "Todos los archivos superan 64 KB. No se ocultan: comparte un resumen con head -n 30 \"archivo\" --share.": [
      "All files exceed 64 KB. They are not hidden: share a summary with head -n 30 \"file\" --share.",
      "所有文件都超过 64 KB。它们不会被隐藏；请使用 head -n 30 \"文件\" --share 分享摘要。"
    ],
    "❌ No se pudieron listar archivos: {0}": [
      "❌ Could not list files: {0}",
      "❌ 无法列出文件：{0}"
    ],
    "Compartir archivo...": [
      "Share file...",
      "分享文件..."
    ],
    "Ayuda de comandos": [
      "Command help",
      "命令帮助"
    ],
    "Comandos disponibles (ejecución local por defecto)": [
      "Available commands (local execution by default)",
      "可用命令（默认在本地执行）"
    ],
    "Cerrar ayuda": [
      "Close help",
      "关闭帮助"
    ],
    "❌ No se pudo mostrar ayuda: {0}": [
      "❌ Could not show help: {0}",
      "❌ 无法显示帮助：{0}"
    ],
    "Ayuda": [
      "Help",
      "帮助"
    ],
    "¿Reemplazar el comando que estás preparando?": [
      "Replace the command you are preparing?",
      "要替换正在准备的命令吗？"
    ],
    "Primeros pasos": [
      "Getting Started",
      "入门"
    ],
    "Bienvenido a loopwork": [
      "Welcome to loopwork",
      "欢迎使用 loopwork"
    ],
    "Importa un archivo o prepara un ejemplo. Nada se ejecuta ni se comparte por abrir esta guía.": [
      "Import a file or prepare an example. Nothing runs or is shared by opening this guide.",
      "导入文件或准备示例。打开本指南不会运行或分享任何内容。"
    ],
    "Preparar !ls para listar archivos; luego pulsa Ejecutar": [
      "Prepare !ls to list files; then click Run",
      "准备 !ls 以列出文件；然后点击“运行”"
    ],
    "Ver archivos: !ls": [
      "View files: !ls",
      "查看文件：!ls"
    ],
    "Preparar consulta del estado Git; requiere git init previo": [
      "Prepare a Git status check; requires git init first",
      "准备查询 Git 状态；需要先运行 git init"
    ],
    "Preparar el comando de ayuda, sin ejecutarlo": [
      "Prepare the help command without running it",
      "准备帮助命令，但不运行"
    ],
    "Editar → revisar diff → aprobar. Descarga copias importantes: borrar datos del sitio también elimina el disco y Git.": [
      "Edit → review diff → approve. Download important copies: deleting site data also deletes the disk and Git.",
      "编辑 → 检查 diff → 批准。请下载重要副本：删除网站数据也会删除磁盘和 Git。"
    ],
    "No se pudo guardar la preferencia de bienvenida: {0}": [
      "Could not save the welcome preference: {0}",
      "无法保存欢迎设置：{0}"
    ],
    "Entendido": [
      "Got it",
      "知道了"
    ],
    "Ver introducción": [
      "View introduction",
      "查看介绍"
    ],
    "Explorador OPFS": [
      "OPFS Explorer",
      "OPFS 浏览器"
    ],
    "Eliminar todos": [
      "Delete all",
      "全部删除"
    ],
    "Abrir": [
      "Open",
      "打开"
    ],
    "Abrir panel": [
      "Open panel",
      "打开面板"
    ],
    "Mostrar el contenido del panel": [
      "Show panel content",
      "显示面板内容"
    ],
    "Ocultar el contenido sin borrar borradores": [
      "Hide content without deleting drafts",
      "隐藏内容，但不删除草稿"
    ],
    "Volver al tamaño y posición anteriores": [
      "Restore previous size and position",
      "恢复先前的大小和位置"
    ],
    "Ampliar el panel dentro de la ventana": [
      "Expand the panel within the window",
      "在窗口内展开面板"
    ],
    "Tu disco está vacío. Usa Explorar / Importar archivos para empezar.": [
      "Your disk is empty. Use Browse / Import files to get started.",
      "磁盘为空。请使用“浏览/导入文件”开始操作。"
    ],
    "Editar {0}": [
      "Edit {0}",
      "编辑 {0}"
    ],
    "Editar localmente y revisar el diff antes de guardar": [
      "Edit locally and review the diff before saving",
      "在本地编辑并在保存前检查 diff"
    ],
    "Editar": [
      "Edit",
      "编辑"
    ],
    "Ejecutar {0}": [
      "Run {0}",
      "运行 {0}"
    ],
    "HTML en pestaña con actualización al guardar; JS en consola aislada. Requiere confirmación": [
      "HTML in a tab that updates on save; JS in an isolated console. Requires confirmation",
      "HTML 在标签页中打开并在保存时更新；JS 在隔离控制台中运行。需要确认"
    ],
    "Descargar {0}": [
      "Download {0}",
      "下载 {0}"
    ],
    "Guardar los bytes originales en la PC, sin enviarlos al chat": [
      "Save the original bytes to the PC without sending them to chat",
      "将原始字节保存到电脑，不发送到聊天"
    ],
    "Descargar": [
      "Download",
      "下载"
    ],
    "Eliminar {0}": [
      "Delete {0}",
      "删除 {0}"
    ],
    "Borrar este archivo tras confirmar; sin deshacer automático": [
      "Delete this file after confirmation; no automatic undo",
      "确认后删除此文件；不会自动撤销"
    ],
    "Eliminar": [
      "Delete",
      "删除"
    ],
    "Mostrando 50 de {0}; Eliminar todos incluye la lista completa.": [
      "Showing 50 of {0}; Delete all includes the full list.",
      "显示 {0} 项中的 50 项；“全部删除”会包含完整列表。"
    ],
    "Git local: sin inicializar": [
      "Local Git: not initialized",
      "本地 Git：尚未初始化"
    ],
    "{0} cambios pendientes": [
      "{0} pending changes",
      "{0} 项待处理更改"
    ],
    "Working tree limpio": [
      "Working tree clean",
      "工作区干净"
    ],
    "Todo guardado en Git": [
      "Everything saved in Git",
      "所有内容均已保存到 Git"
    ],
    "Guardar {0} en Git": [
      "Save {0} to Git",
      "将 {0} 保存到 Git"
    ],
    "Guardar {0} cambios en Git": [
      "Save {0} changes in Git",
      "将 {0} 项更改保存到 Git"
    ],
    "Revisar Git": [
      "Review Git",
      "检查 Git"
    ],
    "Operación en curso": [
      "Operation in progress",
      "操作正在进行"
    ],
    "No se pudo leer la preferencia de bienvenida: {0}": [
      "Could not read the welcome preference: {0}",
      "无法读取欢迎设置：{0}"
    ],
    "Panel Soberano v{0} activo. 100% local por defecto.": [
      "Sovereign Panel v{0} active. 100% local by default.",
      "独立面板 v{0} 已启用。默认 100% 在本地运行。"
    ],
    "DeepSeek se cerró o recargó; vuelve a abrir la vista previa desde Ejecutar.": [
      "DeepSeek was closed or reloaded; reopen the preview from Run.",
      "DeepSeek 已关闭或重新加载；请从“运行”重新打开预览。"
    ],
    "OPFS no está disponible; no se puede montar el panel": [
      "OPFS is unavailable; the panel cannot be mounted",
      "OPFS 不可用；无法加载面板"
    ],
    "no se encontró document.body; no se puede montar el panel": [
      "document.body was not found; the panel cannot be mounted",
      "未找到 document.body；无法加载面板"
    ],
    "Git": [
      "Git",
      "Git"
    ],
    "deleted (staged)": [
      "deleted (staged)",
      "已删除（已暂存）"
    ],
    "added (staged)": [
      "added (staged)",
      "已添加（已暂存）"
    ],
    "modified (staged)": [
      "modified (staged)",
      "已修改（已暂存）"
    ],
    "deleted (unstaged)": [
      "deleted (unstaged)",
      "已删除（未暂存）"
    ],
    "modified (unstaged)": [
      "modified (unstaged)",
      "已修改（未暂存）"
    ],
    "untracked": [
      "untracked",
      "未跟踪"
    ],
    "detached HEAD": [
      "detached HEAD",
      "分离的 HEAD"
    ]
  };
  const EXTRA_I18N = {
    'expresión regular no válida: {0}': ['invalid regular expression: {0}', '无效的正则表达式：{0}'],
    'Texto plano': ['Plain text', '纯文本'],
    'Guardar': ['Save', '保存'],
    'Cambios sin guardar': ['Unsaved changes', '未保存的更改'],
    'Ln {0}, Col {1}': ['Ln {0}, Col {1}', '第 {0} 行，第 {1} 列'],
    ' ({0} seleccionados)': [' ({0} selected)', ' (已选 {0})'],
    '{0} líneas · {1} · {2} · {3} · UTF-8': ['{0} lines · {1} · {2} · {3} · UTF-8', '{0} 行 · {1} · {2} · {3} · UTF-8'],
    'Buscar': ['Find', '查找'],
    'Reemplazar': ['Replace', '替换'],
    'regex no válida': ['invalid regex', '正则无效'],
    '{0} resultados': ['{0} results', '{0} 个结果'],
    'Sin resultados': ['No results', '无结果'],
    '1 reemplazo en línea {0}. Revisa el diff.': ['1 replacement on line {0}. Review the diff.', '已在第 {0} 行替换 1 处。请检查差异。'],
    'Coincidir mayúsculas y minúsculas': ['Match case', '区分大小写'],
    'Usar expresión regular': ['Use regular expression', '使用正则表达式'],
    'Coincidencia anterior (Shift+Enter)': ['Previous match (Shift+Enter)', '上一个匹配（Shift+Enter）'],
    'Coincidencia siguiente (Enter)': ['Next match (Enter)', '下一个匹配（Enter）'],
    'Cerrar búsqueda (Esc)': ['Close search (Esc)', '关闭搜索（Esc）'],
    'Número de línea': ['Line number', '行号'],
    'Ir a la línea': ['Go to line', '转到行'],
    'Escribe un número de línea válido.': ['Type a valid line number.', '请输入有效的行号。'],
    'Línea {0} de {1}': ['Line {0} of {1}', '第 {0} 行，共 {1} 行'],
    'Ir': ['Go', '转到'],
    'Ctrl+S: guardar (muestra el diff y confirma)': ['Ctrl+S: save (shows the diff and asks to confirm)', 'Ctrl+S：保存（显示差异并确认）'],
    'Ctrl+F / Ctrl+H: buscar / reemplazar': ['Ctrl+F / Ctrl+H: find / replace', 'Ctrl+F / Ctrl+H：查找 / 替换'],
    'Ctrl+G: ir a la línea': ['Ctrl+G: go to line', 'Ctrl+G：转到行'],
    'Ctrl+/: comentar o descomentar': ['Ctrl+/: toggle comment', 'Ctrl+/：注释或取消注释'],
    'Alt+↑/↓: mover línea · Shift+Alt+↑/↓: duplicar': ['Alt+↑/↓: move line · Shift+Alt+↑/↓: duplicate', 'Alt+↑/↓：移动行 · Shift+Alt+↑/↓：复制行'],
    'Ctrl+Shift+K: borrar línea · Tab / Shift+Tab: sangrar': ['Ctrl+Shift+K: delete line · Tab / Shift+Tab: indent', 'Ctrl+Shift+K：删除行 · Tab / Shift+Tab：缩进'],
    'Shift+Alt+F: formatear JSON · Esc: cerrar': ['Shift+Alt+F: format JSON · Esc: close', 'Shift+Alt+F：格式化 JSON · Esc：关闭'],
    'Atajos de teclado': ['Keyboard shortcuts', '键盘快捷键'],
    'Vista previa en vivo del borrador · sin scripts ni red': ['Live preview of the draft · no scripts or network', '草稿实时预览 · 无脚本、无网络'],
    'Vista previa en vivo': ['Live preview', '实时预览'],
    'Vista previa': ['Preview', '预览'],
    'Abrir el archivo guardado en una pestaña que se actualiza al guardar': ['Open the saved file in a tab that refreshes on save', '在标签页中打开已保存的文件，保存时自动刷新'],
    'Pestaña': ['Tab', '标签页'],
    'Guarda el archivo antes de abrirlo en una pestaña.': ['Save the file before opening it in a tab.', '请先保存文件再在标签页中打开。'],
    'Formatear solo está disponible para JSON.': ['Formatting is only available for JSON.', '仅 JSON 支持格式化。'],
    'JSON formateado. Revisa el diff.': ['JSON formatted. Review the diff.', 'JSON 已格式化。请检查差异。'],
    'JSON no válido: {0}': ['Invalid JSON: {0}', '无效的 JSON：{0}'],
    'Código copiado al portapapeles.': ['Code copied to the clipboard.', '代码已复制到剪贴板。'],
    'El navegador bloqueó el portapapeles; el código quedó seleccionado, usa Ctrl+C.': ['The browser blocked the clipboard; the code is selected, use Ctrl+C.', '浏览器阻止了剪贴板；代码已选中，请使用 Ctrl+C。'],
    'Pegado desde el portapapeles.': ['Pasted from the clipboard.', '已从剪贴板粘贴。'],
    'El navegador bloqueó el portapapeles; usa Ctrl+V.': ['The browser blocked the clipboard; use Ctrl+V.', '浏览器阻止了剪贴板；请使用 Ctrl+V。'],
    'Borrador descargado: {0}. El disco virtual no cambia.': ['Draft downloaded: {0}. The virtual disk is unchanged.', '草稿已下载：{0}。虚拟磁盘未更改。'],
    'Tamaño de letra: {0}px': ['Font size: {0}px', '字号：{0}px'],
    'Este tipo de archivo no admite comentarios.': ['This file type does not support comments.', '此文件类型不支持注释。'],
    'Guardado y verificado · SHA256 {0} · puedes seguir editando': ['Saved and verified · SHA256 {0} · you can keep editing', '已保存并验证 · SHA256 {0} · 可以继续编辑'],
    'Reducir tamaño de letra': ['Decrease font size', '减小字号'],
    'Aumentar tamaño de letra': ['Increase font size', '增大字号'],
    'Buscar y reemplazar (Ctrl+F)': ['Find and replace (Ctrl+F)', '查找和替换（Ctrl+F）'],
    'Ir a la línea (Ctrl+G)': ['Go to line (Ctrl+G)', '转到行（Ctrl+G）'],
    'Ir a línea': ['Go to line', '转到行'],
    'Copiar': ['Copy', '复制'],
    'Pegar': ['Paste', '粘贴'],
    'Descargar el borrador sin guardarlo en el disco virtual': ['Download the draft without saving it to the virtual disk', '下载草稿，不保存到虚拟磁盘'],
    'Formatear': ['Format', '格式化'],
    'Editor abierto': ['Editor open', '编辑器已打开'],
    'escribe un nombre de archivo': ['type a file name', '请输入文件名'],
    'Abrir editor': ['Open editor', '打开编辑器'],
    'ya existe: {0}; no se sobrescribió': ['already exists: {0}; not overwritten', '已存在：{0}；未覆盖'],
    '{0} Copia verificada conservada para recuperación (transacción {1}).': ['{0} Verified copy kept for recovery (transaction {1}).', '{0} 已保留经过验证的副本以便恢复（事务 {1}）。'],
    'entrada de registro no válida': ['invalid journal entry', '无效的日志条目'],
    'Transacción {0} descartada: {1}': ['Transaction {0} discarded: {1}', '事务 {0} 已丢弃：{1}'],
    'Transacción {0} pendiente: {1}': ['Transaction {0} still pending: {1}', '事务 {0} 仍待处理：{1}'],
    'Completada: {0} ya tenía la versión nueva verificada.': ['Completed: {0} already had the verified new version.', '已完成：{0} 已是经过验证的新版本。'],
    'Revertida: {0} conserva la versión anterior intacta.': ['Rolled back: {0} keeps its previous version intact.', '已回滚：{0} 保持原版本不变。'],
    'Descartada: {0}; la copia temporal no era válida y el archivo no se tocó.': ['Discarded: {0}; the temporary copy was invalid and the file was not touched.', '已丢弃：{0}；临时副本无效，文件未被改动。'],
    'recuperación: no se pudo verificar {0}; temporal conservado': ['recovery: could not verify {0}; temporary file kept', '恢复：无法验证 {0}；已保留临时文件'],
    'Conflicto: {0} cambió por otra vía; no se sobrescribió. Versión aprobada guardada en {1}.': ['Conflict: {0} was changed by another route; not overwritten. Approved version saved to {1}.', '冲突：{0} 已通过其他方式更改；未覆盖。已批准的版本保存到 {1}。'],
    'Temporales huérfanos eliminados: {0}.': ['Orphan temporary files removed: {0}.', '已删除孤立临时文件：{0}。'],
    'Transacciones recientes en curso (otra pestaña): {0}; se revisarán más tarde.': ['Recent transactions in progress (another tab): {0}; they will be checked later.', '进行中的近期事务（其他标签页）：{0}；稍后再检查。'],
    'Sin transacciones interrumpidas ni temporales huérfanos.': ['No interrupted transactions or orphan temporary files.', '没有中断的事务或孤立的临时文件。'],
    'uso: recover': ['usage: recover', '用法：recover'],
    'Revisa escrituras interrumpidas: completa, revierte o guarda copia; limpia temporales huérfanos': ['Checks interrupted writes: completes, rolls back or keeps a copy; removes orphan temporary files', '检查中断的写入：完成、回滚或保留副本；清理孤立临时文件'],
    'Recuperación al iniciar:\n{0}': ['Startup recovery:\n{0}', '启动恢复：\n{0}'],
    'Recuperación al iniciar no completada: {0}. Usa recover para reintentar.': ['Startup recovery not completed: {0}. Use recover to retry.', '启动恢复未完成：{0}。使用 recover 重试。'],
    'uso: edit <archivo>': ['usage: edit <file>', '用法：edit <文件>'],
    'Abre el editor; si el archivo no existe, empieza uno en blanco para pegar código': ['Opens the editor; if the file does not exist, starts a blank one to paste code', '打开编辑器；如果文件不存在，则新建空白文件以粘贴代码'],
    'Archivo nuevo: {0}. Pega o escribe el código y pulsa Crear archivo; no existe hasta guardarlo.': ['New file: {0}. Paste or type the code and click Create file; it does not exist until saved.', '新文件：{0}。粘贴或输入代码后点击“创建文件”；保存前文件不存在。'],
    'Editor abierto: {0}': ['Editor opened: {0}', '已打开编辑器：{0}'],
    'ruta no permitida para el editor': ['path not allowed for the editor', '编辑器不允许此路径'],
    'escribe o pega contenido antes de crear el archivo': ['type or paste content before creating the file', '创建文件前请输入或粘贴内容'],
    'Crear archivo': ['Create file', '创建文件'],
    'Archivo nuevo · aún no existe en el disco': ['New file · not on disk yet', '新文件 · 尚未保存到磁盘'],
    'Editor: creado y verificado {0} (SHA256 {1}). Usa Ejecutar para verlo y Guardar en Git para versionarlo.': ['Editor: created and verified {0} (SHA256 {1}). Use Run to view it and Save to Git to version it.', '编辑器：已创建并验证 {0}（SHA256 {1}）。使用“运行”查看，使用“保存到 Git”进行版本管理。'],
    'Nuevo archivo · {0}': ['New file · {0}', '新文件 · {0}'],
    'Archivo nuevo {0} · pega o escribe el código · Ctrl+S crea · Tab sangra · Esc cierra': ['New file {0} · paste or type the code · Ctrl+S creates · Tab indents · Esc closes', '新文件 {0} · 粘贴或输入代码 · Ctrl+S 创建 · Tab 缩进 · Esc 关闭'],
    'SHA256 original: {0} · UTF-8 · Ctrl+S guarda (muestra el diff y confirma) · Tab sangra · Esc cierra': ['Original SHA256: {0} · UTF-8 · Ctrl+S saves (shows the diff and asks to confirm) · Tab indents · Esc closes', '原始 SHA256：{0} · UTF-8 · Ctrl+S 保存（显示差异并确认）· Tab 缩进 · Esc 关闭'],
    'Nombre del archivo (puede incluir carpeta, ej. web/index.html):': ['File name (may include a folder, e.g. web/index.html):', '文件名（可包含文件夹，例如 web/index.html）：'],
    '{0} ya existe; se abre para editarlo.': ['{0} already exists; opening it for editing.', '{0} 已存在；将打开进行编辑。'],
    'Crear un archivo en blanco y abrirlo en el editor para pegar código': ['Create a blank file and open it in the editor to paste code', '新建空白文件并在编辑器中打开以粘贴代码'],
    'Nuevo archivo…': ['New file…', '新建文件…'],
    'Tu disco está vacío. Usa Nuevo archivo… para escribir o pegar código, o Explorar / Importar archivos.': ['Your disk is empty. Use New file… to type or paste code, or Browse / Import files.', '磁盘为空。使用“新建文件…”输入或粘贴代码，或使用“浏览 / 导入文件”。'],
    'Crea un archivo nuevo, importa uno o prepara un ejemplo. Nada se ejecuta ni se comparte por abrir esta guía.': ['Create a new file, import one or prepare an example. Opening this guide runs and shares nothing.', '新建文件、导入文件或准备示例。打开本指南不会运行或分享任何内容。'],
    '  Nuevo archivo… o edit pagina.html: editor en blanco; pega el código y pulsa Crear archivo (nunca sobrescribe).': ['  New file… or edit page.html: blank editor; paste the code and click Create file (never overwrites).', '  “新建文件…”或 edit page.html：空白编辑器；粘贴代码后点击“创建文件”（绝不覆盖）。'],
    '  Editor: Ctrl+S o 💾 Guardar muestran el diff y piden confirmación; Tab sangra (Shift+Tab sale); Esc cierra.': ['  Editor: Ctrl+S or 💾 Save shows the diff and asks to confirm; Tab indents (Shift+Tab leaves); Esc closes.', '  编辑器：Ctrl+S 或 💾 保存 会显示差异并请求确认；Tab 缩进（Shift+Tab 移出）；Esc 关闭。'],
    '  Escrituras con registro PREPARED/COMMITTED; al abrir DeepSeek se recuperan las interrumpidas (también: recover).': ['  Writes are journaled PREPARED/COMMITTED; interrupted ones are recovered when DeepSeek opens (also: recover).', '  写入以 PREPARED/COMMITTED 记录；打开 DeepSeek 时恢复中断的写入（也可用 recover）。'],
    'uso: git restore [--staged] [--source <ref>] <archivo>': ['usage: git restore [--staged] [--source <ref>] <file>', '用法：git restore [--staged] [--source <ref>] <文件>'],
    'git restore: raíz y metadatos internos no permitidos': ['git restore: root and internal metadata are not allowed', 'git restore：不允许根目录和内部元数据'],
    'git restore: {0} no está en staging ni en {1}': ['git restore: {0} is not in staging or in {1}', 'git restore：{0} 不在暂存区，也不在 {1} 中'],
    'Staging restaurado: {0} desde {1}. Tu archivo no cambió.': ['Staging restored: {0} from {1}. Your file was not changed.', '暂存区已恢复：{0}，来源 {1}。你的文件未更改。'],
    'git restore: {0} no existe en {1}; para archivos nuevos usa rm': ['git restore: {0} does not exist in {1}; use rm for new files', 'git restore：{0} 在 {1} 中不存在；新文件请使用 rm'],
    'git restore: {0} no está en staging; usa --source HEAD o rm para archivos nuevos': ['git restore: {0} is not in staging; use --source HEAD, or rm for new files', 'git restore：{0} 不在暂存区；请使用 --source HEAD，新文件请使用 rm'],
    'Sin cambios: {0} ya coincide con {1}.': ['No changes: {0} already matches {1}.', '无更改：{0} 已与 {1} 一致。'],
    'Antes de git restore desde {0}': ['Before git restore from {0}', 'git restore（来源 {0}）之前'],
    'Restauración Git preparada: {0} desde {1}. Revisa el diff y confirma Aplicar; se creará checkpoint previo al guardar.':
      ['Git restore prepared: {0} from {1}. Review the diff and confirm Apply; a checkpoint will be created before saving.', 'Git 恢复已准备：{0}，来源 {1}。请检查差异并确认“应用”；保存前将创建检查点。'],
    '¿Restaurar "{0}" desde {1} ({2} B)?\n{3}\nSHA256: {4}': ['Restore "{0}" from {1} ({2} B)?\n{3}\nSHA256: {4}', '要从 {1} 恢复“{0}”（{2} B）吗？\n{3}\nSHA256：{4}'],
    'git restore: verificación fallida{0}': ['git restore: verification failed{0}', 'git restore：验证失败{0}'],
    '; checkpoint previo {0} conservado': ['; previous checkpoint {0} kept', '；已保留之前的检查点 {0}'],
    'Restaurado desde {0} y verificado: {1}\nSHA256: {2}{3}\nNo se hizo commit.': ['Restored from {0} and verified: {1}\nSHA256: {2}{3}\nNo commit was made.', '已从 {0} 恢复并验证：{1}\nSHA256：{2}{3}\n未创建提交。'],
    'Revertir': ['Revert', '还原'],
    'Revertir…': ['Revert…', '还原…'],
    'Revertir {0} a HEAD': ['Revert {0} to HEAD', '将 {0} 还原到 HEAD'],
    'Volver a la versión del último commit: muestra el diff y crea checkpoint antes de escribir': ['Go back to the last commit version: shows the diff and creates a checkpoint before writing', '回到上次提交的版本：写入前显示差异并创建检查点'],
    'Elige en la lista qué archivo volver a la versión del último commit': ['Choose from the list which file to return to the last commit version', '从列表中选择要回到上次提交版本的文件'],
    'Pulsa Revertir junto al archivo que quieres volver a la versión del último commit. Verás el diff antes de escribir y se creará un checkpoint.':
      ['Click Revert next to the file you want to return to the last commit version. You will see the diff before writing, and a checkpoint will be created.', '点击要回到上次提交版本的文件旁的“还原”。写入前会显示差异，并创建检查点。'],
    '  git restore archivo: vuelve a la versión del staging; --source HEAD (o rama/SHA) usa un commit.':
      ['  git restore file: returns to the staged version; --source HEAD (or branch/SHA) uses a commit.', '  git restore 文件：恢复到暂存区版本；--source HEAD（或分支/SHA）使用某次提交。'],
    '  git restore muestra diff y crea checkpoint antes de escribir; --staged solo saca del staging.':
      ['  git restore shows a diff and creates a checkpoint before writing; --staged only unstages.', '  git restore 写入前显示差异并创建检查点；--staged 仅取消暂存。'],
    '  Botón Revertir…: elige un archivo y vuelve a la versión del último commit, sin escribir comandos.':
      ['  Revert… button: pick a file and return it to the last commit version without typing commands.', '  “还原…”按钮：选择文件并回到上次提交的版本，无需输入命令。'],
    'Idioma': ['Language', '语言'],
    'Acerca de': ['About', '关于'],
    'Acerca de este proyecto': ['About this project', '关于本项目'],
    'Un proyecto de Geeknome · División de Informática': ['A Geeknome project · Computing Division', 'Geeknome 项目 · 信息技术部'],
    '“La IA propone, el usuario ejecuta, ambos observan en vivo.”': ['“The AI proposes, the user executes, both observe live.”', '“AI 提出建议，用户执行，双方实时观察。”'],
    'Autor: {0}': ['Author: {0}', '作者：{0}'],
    'Visitar Geeknome (se abre en una pestaña nueva)': ['Visit Geeknome (opens in a new tab)', '访问 Geeknome（在新标签页中打开）'],
    'Cerrar': ['Close', '关闭'],
    'Actualizar desde disco': ['Refresh from disk', '从磁盘刷新'],
    'No se pudo guardar el idioma: {0}': ['Could not save the language: {0}', '无法保存语言设置：{0}'],
    'No se pudieron cargar los ajustes: {0}': ['Could not load settings: {0}', '无法加载设置：{0}'],
    'Idioma no admitido: {0}': ['Unsupported language: {0}', '不支持的语言：{0}'],
    'COMANDOS DISCO VIRTUAL (100% Local por defecto):': ['VIRTUAL DISK COMMANDS (100% local by default):', '虚拟磁盘命令（默认完全在本地运行）：'],
    'Repositorio Git local inicializado (rama: main).': ['Local Git repository initialized (branch: main).', '本地 Git 仓库已初始化（分支：main）。'],
    'Conectando con el panel...': ['Connecting to the panel...', '正在连接面板……'],
    'HTML estático · sin scripts ni red': ['Static HTML · no scripts or network', '静态 HTML · 无脚本或网络'],
    'Vista previa HTML aislada': ['Isolated HTML preview', '隔离的 HTML 预览'],
    'Leyendo la versión guardada en OPFS...': ['Reading the version saved in OPFS...', '正在读取 OPFS 中保存的版本……'],
    'El panel no responde. Mantén DeepSeek abierto. Si lo recargaste, vuelve a pulsar Ejecutar allí.':
      ['The panel is not responding. Keep DeepSeek open. If you reloaded it, click Run there again.', '面板无响应。请保持 DeepSeek 打开。如果已重新加载，请在面板中再次点击“运行”。'],
    'Actualizado: ': ['Updated: ', "已更新： "],
    ' · Solo cambios guardados. Actualización automática mientras el panel esté abierto.':
      [' · Saved changes only. Updates automatically while the panel is open.', ' · 仅显示已保存的更改。面板打开时自动更新。'],
    'No se pudo actualizar: ': ['Could not refresh: ', "无法刷新： "],
    'No se pudo conectar la vista previa: ': ['Could not connect the preview: ', "无法连接预览： "],
    'limite de salida excedido': ['output limit exceeded', '超出输出限制'],
    'tiempo limite de 3 segundos excedido': ['3-second time limit exceeded', '超过 3 秒时间限制'],
    'error de sintaxis o arranque del Worker': ['Worker syntax or startup error', 'Worker 语法或启动错误'],
    'El controlador JavaScript aislado no arrancó. El sitio puede bloquear scripts o iframes Blob con su CSP (comprobado en Gemini). No se pudo iniciar el archivo; pruébalo fuera del chat.': [
      'The isolated JavaScript controller did not start. The site may block scripts or Blob iframes through CSP (confirmed on Gemini). The file could not be started; test it outside the chat.',
      '隔离的 JavaScript 控制器未启动。网站的 CSP 可能阻止脚本或 Blob iframe（已在 Gemini 验证）。无法启动文件；请在聊天之外测试。'
    ],
    'El Worker no respondió dentro del límite. Puede estar bloqueado por CSP/Trusted Types o haber agotado el tiempo; revisa la consola del navegador o prueba fuera del chat.': [
      'The Worker did not respond within the time limit. CSP/Trusted Types may block it, or it may have timed out; check the browser console or test outside the chat.',
      'Worker 未在时限内响应。可能被 CSP/Trusted Types 阻止或已超时；请检查浏览器控制台或在聊天之外测试。'
    ],
    'El Worker no pudo arrancar: posible error de sintaxis o bloqueo CSP/Trusted Types. Revisa la consola del navegador o prueba fuera del chat.': [
      'The Worker could not start: possible syntax error or CSP/Trusted Types restriction. Check the browser console or test outside the chat.',
      'Worker 无法启动：可能存在语法错误或 CSP/Trusted Types 限制。请检查浏览器控制台或在聊天之外测试。'
    ],
    '[valor no serializable]': ['[non-serializable value]', '[无法序列化的值]'],
    'Binary files {0} and {1} differ ({2} -> {3} B)': ['Binary files {0} and {1} differ ({2} -> {3} B)', '二进制文件 {0} 与 {1} 不同（{2} -> {3} B）'],
    'Checkpoint: {0}\nArchivo: {1}\nFecha: {2}\nEtiqueta: {3}\nBytes: {4}\nSHA256: {5}':
      ['Checkpoint: {0}\nFile: {1}\nDate: {2}\nLabel: {3}\nBytes: {4}\nSHA256: {5}', '检查点：{0}\n文件：{1}\n日期：{2}\n标签：{3}\n字节：{4}\nSHA256: {5}'],
    'Checkpoint: {0}\nArchivo: {1} ({2} B)\nSHA256: {3}\nRestaurar: {4}restore {5}':
      ['Checkpoint: {0}\nFile: {1} ({2} B)\nSHA256: {3}\nRestore: {4}restore {5}', '检查点：{0}\n文件：{1}（{2} B）\nSHA256: {3}\n恢复：{4}restore {5}'],
    'Editor de {0}': ['Editor for {0}', '{0} 的编辑器'],
    'Editor local · {0}': ['Local editor · {0}', '本地编辑器 · {0}'],
    'Eliminado: {0}': ['Deleted: {0}', '已删除：{0}'],
    '[Tx OK] Guardado {0} ({1})': ['[Tx OK] Saved {0} ({1})', '[Tx OK] 已保存 {0}（{1}）'],
    '  checkpoint delete ID / prune --keep N / prune --older-than 7d: borrado confirmado.':
      ['  checkpoint delete ID / prune --keep N / prune --older-than 7d: deletion requires confirmation.', '  checkpoint delete ID / prune --keep N / prune --older-than 7d：删除前需确认。'],
    '[Archivo OPFS: {0}; {1}]\nSHA256: {2}\n{3}\n{4}\n{5}\n':
      ['[OPFS file: {0}; {1}]\nSHA256: {2}\n{3}\n{4}\n{5}\n', '[OPFS 文件：{0}；{1}]\nSHA256: {2}\n{3}\n{4}\n{5}\n'],
    'Comando local': ['Local command', '本地命令'],
    'Git: consultando...': ['Git: checking...', 'Git：正在检查……'],
    'Estado y diferencias Git': ['Git status and differences', 'Git 状态和差异'],
    'Commit local verificado: {0}.': ['Local commit verified: {0}.', '本地提交已验证：{0}。'],
    'Contraer panel': ['Collapse panel', '收起面板'],
    'Ampliar panel': ['Expand panel', '展开面板'],
    'Archivo a compartir': ['File to share', '要分享的文件'],
    'Estado: !git status': ['Status: !git status', '状态：!git status'],
    'Comandos: !help': ['Commands: !help', '命令：!help'],
    'Limpiar log': ['Clear log', '清空日志'],
    'Git: error de consulta': ['Git: status query failed', 'Git：状态查询失败'],
    'Inicializar Git local': ['Initialize local Git', '初始化本地 Git'],
    '[DV] Error de arranque:': ['[DV] Startup error:', '[DV] 启动错误：'],
    'Git: {0}': ['Git: {0}', 'Git：{0}'],
    'Git diff: {0}': ['Git diff: {0}', 'Git diff：{0}'],
    'Ampliar': ['Expand', '展开'],
    'Reducir': ['Reduce', '缩小'],
    'Contraer': ['Collapse', '收起'],
    'Reducir panel': ['Reduce panel', '缩小面板'],
    'Minimizar': ['Minimize', '最小化'],
    'Restaurar': ['Restore', '还原'],
    'Minimizar editor': ['Minimize editor', '最小化编辑器'],
    'Restaurar editor': ['Restore editor', '还原编辑器'],
    'Ampliar editor': ['Expand editor', '展开编辑器'],
    'Reducir editor': ['Reduce editor', '缩小编辑器'],
    'Arrastra la barra para mover el editor': ['Drag the title bar to move the editor', '拖动标题栏以移动编辑器'],
    'HTML y CSS del disco · Gemini bloquea JavaScript por CSP': ['Disk HTML and CSS · Gemini blocks JavaScript through CSP', '磁盘 HTML 和 CSS · Gemini 的 CSP 阻止 JavaScript'],
    'HTML, CSS y JS del disco · scripts aislados, sin red': ['Disk HTML, CSS and JS · isolated scripts, no network', '磁盘 HTML、CSS 和 JS · 隔离脚本，无网络'],
    'HTML y CSS del disco · JavaScript desactivado': ['Disk HTML and CSS · JavaScript disabled', '磁盘 HTML 和 CSS · JavaScript 已禁用'],
    '¿Habilitar JavaScript del proyecto en la vista previa aislada? Solo código revisado; sin acceso al disco ni red. Un bucle infinito puede bloquear la pestaña. Cancelar mantiene HTML y CSS sin scripts.': [
      'Enable project JavaScript in the isolated preview? Reviewed code only; no disk or network access. An infinite loop can freeze the tab. Cancel keeps HTML and CSS without scripts.',
      '在隔离预览中启用项目 JavaScript？仅运行已审查的代码；无法访问磁盘或网络。无限循环可能冻结标签页。取消将仅显示 HTML 和 CSS。'
    ],
    'Recurso de vista previa no permitido: {0}': ['Preview resource not allowed: {0}', '不允许的预览资源：{0}'],
    'La vista previa y sus recursos superan 8 MB.': ['The preview and its resources exceed 8 MB.', '预览及其资源超过 8 MB。'],
    'CSS @import no admitido; usa link stylesheet en el HTML.': ['CSS @import is not supported; use link stylesheet in HTML.', '不支持 CSS @import；请在 HTML 中使用 link stylesheet。'],
    'Hoja de estilos sin ruta.': ['Stylesheet path is missing.', '缺少样式表路径。'],
    'La vista previa admite scripts clásicos sin async; módulos ES requieren un servidor.': ['Preview supports classic scripts without async; ES modules require a server.', '预览支持不带 async 的经典脚本；ES 模块需要服务器。'],
    'Script sin ruta.': ['Script path is missing.', '缺少脚本路径。'],
    'srcset no admitido; usa imágenes con src.': ['srcset is not supported; use images with src.', '不支持 srcset；请使用带 src 的图片。'],
    '¿Abrir "{0}" con sus recursos del disco en una pestaña de vista previa?\nSin red; requiere mantener el panel abierto.': [
      'Open "{0}" with its disk resources in a preview tab?\nNo network; keep the panel open.',
      '在预览标签页中打开“{0}”及其磁盘资源？\n无网络；请保持面板打开。'
    ],
    'Vista previa del disco abierta: {0}.': ['Disk preview opened: {0}.', '已打开磁盘预览：{0}。'],

    // Editor: búsqueda, reemplazo y Ctrl+D
    'Descargar': ['Download', '下载'],
    'Reemplazar todos': ['Replace all', '全部替换'],
    'Sin coincidencias.': ['No matches.', '没有匹配项。'],
    'Coincidencia en línea {0}': ['Match on line {0}', '在第 {0} 行找到匹配项'],
    'Siguiente coincidencia en línea {0}': ['Next occurrence on line {0}', '下一个匹配项在第 {0} 行'],
    'No hay más coincidencias.': ['No more occurrences.', '没有更多匹配项。'],
    'Mostrar u ocultar reemplazar (Ctrl+H)': ['Toggle replace (Ctrl+H)', '显示或隐藏替换（Ctrl+H）'],
    'Ctrl+D: seleccionar la siguiente coincidencia': ['Ctrl+D: select next occurrence', 'Ctrl+D：选择下一个匹配项'],

    // Carpeta real (File System Access API)
    'Carpeta real: {0}': ['Real folder: {0}', '真实文件夹：{0}'],
    'Explorador OPFS (privado)': ['OPFS explorer (private)', 'OPFS 浏览器（私有）'],
    'Carpeta real reactivada: {0}': ['Real folder reactivated: {0}', '真实文件夹已重新激活：{0}'],
    'No se pudo comprobar la carpeta real guardada: {0}': ['Could not check the saved real folder: {0}', '无法检查已保存的真实文件夹：{0}'],
    'Tu navegador no admite carpetas reales (usa Chrome, Edge u otro Chromium reciente)': ['Your browser does not support real folders (use Chrome, Edge, or another recent Chromium browser)', '你的浏览器不支持真实文件夹（请使用 Chrome、Edge 或其他较新的 Chromium 浏览器）'],
    'Vas a conectar una carpeta real de tu PC. Mientras esté activa, los comandos de este panel podrán crear, modificar y borrar archivos dentro de ella. ¿Continuar?': ['You are about to connect a real folder on your PC. While it is active, this panel\'s commands can create, modify, and delete files inside it. Continue?', '你即将连接电脑上的一个真实文件夹。启用后，此面板的命令可以在其中创建、修改和删除文件。是否继续？'],
    'Conexión de carpeta cancelada': ['Folder connection cancelled', '文件夹连接已取消'],
    'Permiso de escritura denegado para la carpeta': ['Write permission for the folder was denied', '文件夹的写入权限被拒绝'],
    'No hay carpeta real guardada para reconectar': ['There is no saved real folder to reconnect', '没有可重新连接的已保存真实文件夹'],
    'Usar carpeta real…': ['Use real folder…', '使用真实文件夹…'],
    'Conectar una carpeta real de tu PC; reemplaza OPFS como almacenamiento mientras esté activa': ['Connect a real folder on your PC; it replaces OPFS as storage while active', '连接电脑上的真实文件夹；启用期间它将替代 OPFS 作为存储'],
    'Carpeta real conectada: {0}': ['Real folder connected: {0}', '真实文件夹已连接：{0}'],
    'Reconectar carpeta…': ['Reconnect folder…', '重新连接文件夹…'],
    'La carpeta real guardada perdió el permiso de escritura; reconéctala para seguir usándola': ['The saved real folder lost its write permission; reconnect it to keep using it', '已保存的真实文件夹失去了写入权限；请重新连接以继续使用'],
    'Carpeta real reconectada: {0}': ['Real folder reconnected: {0}', '真实文件夹已重新连接：{0}'],
    'Volver a OPFS': ['Switch back to OPFS', '切换回 OPFS'],
    '¿Volver a OPFS? La carpeta real deja de usarse, pero sus archivos no se borran ni se desconecta el permiso del sistema operativo.': ['Switch back to OPFS? The real folder stops being used, but its files are not deleted and the OS permission is not revoked.', '切换回 OPFS？真实文件夹将不再使用，但其文件不会被删除，操作系统权限也不会被撤销。'],
    'Carpeta real desconectada; usando OPFS de nuevo.': ['Real folder disconnected; using OPFS again.', '真实文件夹已断开；重新使用 OPFS。'],
    '⚠️ Carpeta REAL de tu PC. ': ['⚠️ REAL folder on your PC. ', '⚠️ 电脑上的真实文件夹。 '],
    '❌ Carpeta real: {0}': ['❌ Real folder: {0}', '❌ 真实文件夹：{0}'],

    // Exportar/importar disco completo como ZIP
    'Exportar disco (.zip)…': ['Export disk (.zip)…', '导出磁盘（.zip）…'],
    'Descarga todo el disco (incluye .git y checkpoints) como un .zip; nada se envía al chat': ['Download the whole disk (includes .git and checkpoints) as a .zip; nothing is sent to the chat', '将整个磁盘（含 .git 和检查点）下载为 .zip；不会发送到聊天'],
    'Importar ZIP…': ['Import ZIP…', '导入 ZIP…'],
    'Restaura un backup .zip exportado desde aquí (o un .zip con la misma estructura); reemplaza archivos existentes': ['Restore a .zip backup exported from here (or a .zip with the same structure); replaces existing files', '恢复从这里导出的 .zip 备份（或结构相同的 .zip）；会替换已存在的文件'],
    'Seleccionar archivo .zip para restaurar en el disco virtual': ['Select a .zip file to restore into the virtual disk', '选择要恢复到虚拟磁盘的 .zip 文件'],
    '⏳ Hay una operación en curso; reintenta exportar al terminar.': ['⏳ An operation is in progress; retry exporting once it finishes.', '⏳ 有操作正在进行；完成后请重试导出。'],
    'el disco está vacío; no hay nada que exportar': ['the disk is empty; there is nothing to export', '磁盘为空；没有可导出的内容'],
    'Exportado: {0} archivo(s), {1} originales, {2} en el .zip. Incluye .git y checkpoints; nada enviado al chat.': ['Exported: {0} file(s), {1} original, {2} in the .zip. Includes .git and checkpoints; nothing sent to the chat.', '已导出：{0} 个文件，原始 {1}，压缩包 {2}。包含 .git 和检查点；未发送到聊天。'],
    '❌ Exportar ZIP: {0}': ['❌ Export ZIP: {0}', '❌ 导出 ZIP：{0}'],
    'no se encontró el final del archivo ZIP (EOCD); ¿archivo corrupto o no es un .zip?': ['could not find the ZIP end-of-central-directory (EOCD); is the file corrupted or not a .zip?', '找不到 ZIP 文件的目录结束标记（EOCD）；文件是否损坏或不是 .zip？'],
    'estructura del ZIP inesperada en el directorio central': ['unexpected ZIP structure in the central directory', 'ZIP 中央目录结构异常'],
    'método de compresión no soportado ({0}); usa un .zip con store o deflate': ['unsupported compression method ({0}); use a .zip with store or deflate', '不支持的压缩方式（{0}）；请使用 store 或 deflate 格式的 .zip'],
    '⏳ Hay una operación en curso; reintenta importar el ZIP al terminar.': ['⏳ An operation is in progress; retry importing the ZIP once it finishes.', '⏳ 有操作正在进行；完成后请重试导入 ZIP。'],
    'Vas a restaurar un backup .zip: los archivos con el mismo nombre serán reemplazados sin deshacer (incluye .git y checkpoints si el ZIP los trae). ¿Continuar?': ['You are about to restore a .zip backup: files with the same name will be replaced with no undo (includes .git and checkpoints if the ZIP has them). Continue?', '你即将恢复一个 .zip 备份：同名文件将被替换且无法撤销（如果 ZIP 中包含 .git 和检查点也会恢复）。是否继续？'],
    'Importación de ZIP cancelada; no se ha modificado nada': ['ZIP import cancelled; nothing was modified', 'ZIP 导入已取消；未做任何修改'],
    'ZIP demasiado grande: máximo {0}': ['ZIP too large: maximum {0}', 'ZIP 过大：最大 {0}'],
    'CRC inválido en {0}; el ZIP podría estar corrupto': ['invalid CRC in {0}; the ZIP might be corrupted', '{0} 的 CRC 校验无效；ZIP 可能已损坏'],
    'ZIP restaurado: {0} archivo(s) escritos, {1} carpeta(s) omitidas. Nada enviado al chat.': ['ZIP restored: {0} file(s) written, {1} folder entries skipped. Nothing sent to the chat.', 'ZIP 已恢复：写入 {0} 个文件，跳过 {1} 个文件夹条目。未发送到聊天。'],
    '❌ Importar ZIP: {0}. {1} archivo(s) ya escritos se conservan.': ['❌ Import ZIP: {0}. {1} file(s) already written are kept.', '❌ 导入 ZIP：{0}。已写入的 {1} 个文件予以保留。'],
  };
  const LANGUAGES = ['es', 'en', 'zh-CN'];
  let language = 'es';

  function t(message, ...values) {
    const key = typeof message === 'string' ? message :
      message.reduce((text, part, i) => text + part + (i < values.length ? `{${i}}` : ''), '');
    const pair = Object.hasOwn(I18N, key) ? I18N[key] :
      Object.hasOwn(EXTRA_I18N, key) ? EXTRA_I18N[key] : null;
    if (language !== 'es' && !pair) throw new Error(`Missing translation: ${key}`);
    const pattern = language === 'es' ? key : pair[language === 'en' ? 0 : 1];
    return pattern.replace(/\{(\d+)\}/g, (token, index) => index < values.length ? String(values[index]) : token);
  }

  function detectLanguage(preferences) {
    for (const locale of preferences || []) {
      const base = String(locale).toLowerCase().split('-')[0];
      if (base === 'zh') return 'zh-CN';
      if (base === 'en' || base === 'es') return base;
    }
    return 'es';
  }

  function setLanguage(next) {
    if (!LANGUAGES.includes(next)) throw new Error(t`Idioma no admitido: ${next}`);
    localStorage.setItem(CFG.SETTINGS_KEY, JSON.stringify({ ...settings, language: next }));
    language = next;
    settings.language = next;
  }

  let refreshChatCodeActions = () => { };

  const dvLog = (...a) => console.log('[DV]', ...a);

  // ============================================================
  // UTILIDADES
  // ============================================================
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitFor(fn, timeout = 3000, step = 100) {
    const t0 = Date.now();
    for (; ;) {
      const v = fn();
      if (v) return v;
      if (Date.now() - t0 > timeout) return null;
      await sleep(step);
    }
  }

  const fmtBytes = (b) => {
    if (b < 1024) return b + ' B';
    if (b < 1024 ** 2) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(1) + ' MB';
    return (b / 1024 ** 3).toFixed(2) + ' GB';
  };

  const truncate = (s, n = CFG.MAX_OUTPUT_CHARS) =>
    s.length > n ? s.slice(0, n) + t`\n... (truncado, ${s.length - n} caracteres más)` : s;

  function safeFence(text) {
    let max = 2, run = 0;
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 96) { run++; if (run > max) max = run; } else run = 0;
    }
    return '`'.repeat(max + 1);
  }

  function toInt(v, dflt, flag) {
    if (v === undefined) return dflt;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) throw new Error(t`valor no válido para ${flag}: ${v}`);
    return n;
  }

  function makeRegex(pattern, { ignoreCase = false, fixed = false } = {}) {
    try {
      const src = fixed ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : pattern;
      return new RegExp(src, ignoreCase ? 'i' : '');
    } catch (e) {
      throw new Error(t`regex no válida: ${e.message}`);
    }
  }

  // ============================================================
  // AJUSTES
  // ============================================================
  const settings = { prefix: '!', language: 'es' };
  const PREFIX_RE = /^[!#$%&*+=;:~^?@]{1,2}$/;

  function loadSettings() {
    language = detectLanguage(typeof navigator === 'undefined' ? [] : navigator.languages || [navigator.language]);
    try {
      const o = JSON.parse(localStorage.getItem(CFG.SETTINGS_KEY) || '{}');
      if (typeof o.prefix === 'string' && PREFIX_RE.test(o.prefix)) settings.prefix = o.prefix;
      if (LANGUAGES.includes(o.language)) language = o.language;
    } catch (e) { console.error('[DV]', t`No se pudieron cargar los ajustes: ${e.message}`); }
    settings.language = language;
  }

  // ============================================================
  // OPFS
  // ============================================================
  let rootDir = null;
  const BAD_NAME = /[\u0000-\u001f\u007f\\|<>"*?]/;
  const isNotFound = (e) => e && e.name === 'NotFoundError';

  async function initOPFS() {
    if (!navigator.storage?.getDirectory) return false;
    rootDir = await navigator.storage.getDirectory();
    try { await navigator.storage.persist?.(); } catch { /* */ }
    dvLog(t('OPFS listo'));
    return true;
  }

  // ============================================================
  // CARPETA REAL (File System Access API, opcional sobre OPFS)
  // ============================================================
  // rootDir es un FileSystemDirectoryHandle igual en ambos casos; el resto
  // del código (getHandle, walk, writeBytes, makeFs/Git, etc.) no distingue
  // entre OPFS y una carpeta real: solo cambia qué handle apunta ahí.
  let storageMode = 'opfs'; // 'opfs' | 'local'
  let localDirName = '';
  let hasStoredLocalHandle = false;
  const HANDLE_DB_NAME = 'dv-fs-handles';
  const HANDLE_STORE_NAME = 'handles';
  const HANDLE_KEY = 'root';

  function openHandleDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(HANDLE_DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(HANDLE_STORE_NAME); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbGetHandle() {
    let db;
    try { db = await openHandleDB(); } catch { return null; }
    return new Promise((resolve) => {
      const tx = db.transaction(HANDLE_STORE_NAME, 'readonly');
      const req = tx.objectStore(HANDLE_STORE_NAME).get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  }

  async function idbSetHandle(handle) {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
      tx.objectStore(HANDLE_STORE_NAME).put(handle, HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbDeleteHandle() {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
      tx.objectStore(HANDLE_STORE_NAME).delete(HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function storageModeLabel() {
    return storageMode === 'local' ? t`Carpeta real: ${localDirName}` : t('Explorador OPFS (privado)');
  }

  // Comprueba al arrancar si hay una carpeta real guardada; solo la reactiva
  // sin preguntar si el permiso sigue concedido (queryPermission no requiere
  // gesto del usuario). Si el permiso expiró, deja hasStoredLocalHandle=true
  // para que el panel ofrezca un botón "Reconectar".
  async function restoreLocalFolderOnBoot() {
    const handle = await idbGetHandle();
    if (!handle) return;
    hasStoredLocalHandle = true;
    try {
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        rootDir = handle;
        storageMode = 'local';
        localDirName = handle.name;
        dvLog(t`Carpeta real reactivada: ${handle.name}`);
      }
    } catch (e) { dvLog(t`No se pudo comprobar la carpeta real guardada: ${e.message}`); }
  }

  async function connectLocalFolder() {
    if (typeof window.showDirectoryPicker !== 'function') {
      throw new Error(t('Tu navegador no admite carpetas reales (usa Chrome, Edge u otro Chromium reciente)'));
    }
    let consented = false;
    try { consented = localStorage.getItem(CFG.LOCAL_FOLDER_CONSENT_KEY) === 'yes'; } catch { /* */ }
    if (!consented) {
      if (!confirm(t('Vas a conectar una carpeta real de tu PC. Mientras esté activa, los comandos de este panel podrán crear, modificar y borrar archivos dentro de ella. ¿Continuar?'))) {
        throw new Error(t('Conexión de carpeta cancelada'));
      }
      try { localStorage.setItem(CFG.LOCAL_FOLDER_CONSENT_KEY, 'yes'); } catch { /* */ }
    }
    const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'dv-local-folder' });
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') throw new Error(t('Permiso de escritura denegado para la carpeta'));
    await idbSetHandle(handle);
    rootDir = handle;
    storageMode = 'local';
    localDirName = handle.name;
    hasStoredLocalHandle = true;
  }

  async function reconnectLocalFolder() {
    const handle = await idbGetHandle();
    if (!handle) throw new Error(t('No hay carpeta real guardada para reconectar'));
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') throw new Error(t('Permiso de escritura denegado para la carpeta'));
    rootDir = handle;
    storageMode = 'local';
    localDirName = handle.name;
    hasStoredLocalHandle = true;
  }

  async function disconnectLocalFolder() {
    await idbDeleteHandle();
    hasStoredLocalHandle = false;
    storageMode = 'opfs';
    localDirName = '';
    rootDir = await navigator.storage.getDirectory();
  }

  function splitPath(p) {
    if (typeof p !== 'string' || !p) throw new Error(t('ruta vacía'));
    const parts = p.replaceAll('\\', '/').split('/').filter(Boolean);
    for (const s of parts) {
      if (s === '..') throw new Error(t`ruta no permitida: ${p}`);
      if (BAD_NAME.test(s)) throw new Error(t`nombre no válido: ${s}`);
      if (s.length > 200) throw new Error(t`nombre demasiado largo: ${s.slice(0, 20)}…`);
    }
    return parts.filter((s) => s !== '.');
  }

  async function getHandle(path) {
    const parts = splitPath(path);
    if (!parts.length) return rootDir;
    let dir = rootDir;
    for (let i = 0; i < parts.length - 1; i++) {
      try { dir = await dir.getDirectoryHandle(parts[i]); }
      catch (e) { if (isNotFound(e) || e.name === 'TypeMismatchError') return null; throw e; }
    }
    const last = parts[parts.length - 1];
    try { return await dir.getFileHandle(last); }
    catch (e) { if (!(isNotFound(e) || e.name === 'TypeMismatchError')) throw e; }
    try { return await dir.getDirectoryHandle(last); }
    catch (e) { if (isNotFound(e) || e.name === 'TypeMismatchError') return null; throw e; }
  }

  async function requireFile(path) {
    const h = await getHandle(path);
    if (!h) throw Object.assign(new Error(t`no existe: ${path}`), { name: 'NotFoundError' });
    if (h.kind !== 'file') throw Object.assign(new Error(t`es una carpeta: ${path}`), { code: 'EISDIR' });
    return h;
  }

  async function parentOf(path, create) {
    const parts = splitPath(path);
    if (!parts.length) throw new Error(t('ruta no válida'));
    const name = parts.pop();
    let dir = rootDir;
    for (const p of parts) dir = await dir.getDirectoryHandle(p, { create });
    return { dir, name };
  }

  async function* walk(dir, prefix = '') {
    const ents = [];
    for await (const [name, handle] of dir.entries()) ents.push([name, handle]);
    ents.sort((a, b) => a[0].localeCompare(b[0]));
    for (const [name, handle] of ents) {
      const path = prefix + name;
      if (handle.kind === 'file') yield { path, kind: 'file', handle };
      else {
        yield { path, kind: 'dir', handle };
        yield* walk(handle, path + '/');
      }
    }
  }

  async function listFiles() {
    const out = [];
    for await (const e of walk(rootDir)) {
      if (e.kind !== 'file') continue;
      const f = await e.handle.getFile();
      out.push({ path: e.path, size: f.size, lastModified: f.lastModified });
    }
    return out;
  }

  async function removePath(path, recursive) {
    const parts = splitPath(path);
    if (!parts.length) throw new Error(t('no se puede borrar la raíz'));
    const { dir, name } = await parentOf(path, false);
    await dir.removeEntry(name, { recursive: !!recursive });
    notifyHTMLPreviews(parts.join('/'));
  }

  async function openRawWriter(path, { append = false } = {}) {
    const { dir, name } = await parentOf(path, true);
    const fh = await dir.getFileHandle(name, { create: true });
    const ws = await fh.createWritable({ keepExistingData: append });
    if (append) { const f = await fh.getFile(); await ws.seek(f.size); }
    return ws;
  }

  async function writeBytes(path, data) {
    const ws = await openRawWriter(path);
    try { await ws.write(data); await ws.close(); }
    catch (e) { try { await ws.abort(); } catch { /* */ } throw e; }
    notifyHTMLPreviews(splitPath(path).join('/'));
  }

  async function copyOrMove(args, move) {
    const command = move ? 'mv' : 'cp';
    const { pos } = parseArgs(args, {});
    if (pos.length !== 2) throw new Error(t`uso: ${command} <origen> <destino> (solo archivos)`);
    const paths = pos.map((path) => {
      const parts = splitPath(path);
      if (!parts.length || isInternalPath(path)) throw new Error(t('raíz y metadatos internos no permitidos'));
      return parts.join('/');
    });
    const [sourcePath, targetPath] = paths;
    if (sourcePath === targetPath) throw new Error(t('origen y destino son el mismo archivo'));
    const sourceHandle = await requireFile(sourcePath);
    const sourceFile = await sourceHandle.getFile();
    if (sourceFile.size > CFG.MAX_HASH_BYTES) throw new Error(t`archivo demasiado grande para verificar: máximo ${fmtBytes(CFG.MAX_HASH_BYTES)}`);
    const targetHandle = await getHandle(targetPath);
    if (targetHandle?.kind === 'directory') throw new Error(t('destino es una carpeta; indica la ruta completa del archivo'));
    if (move || targetHandle) {
      const action = move ? t`Mover "${sourcePath}" a "${targetPath}" y borrar el origen` : t`Reemplazar "${targetPath}" con "${sourcePath}"`;
      if (!confirm(t`¿${action}?${targetHandle ? t(' El destino existente será reemplazado.') : ''} No hay deshacer automático.`)) {
        throw new Error(t`${command} cancelado; no se ha modificado nada`);
      }
    }
    const sourceHash = await copyVerifiedFile(sourceFile, targetPath, targetHandle);
    if (move) {
      const currentSource = await (await requireFile(sourcePath)).getFile();
      if (currentSource.size !== sourceFile.size ||
        await computeSha256(await currentSource.arrayBuffer()) !== sourceHash) {
        throw new Error(t('el origen cambió durante la copia; no se ha borrado y el destino contiene la versión copiada'));
      }
      try { await removePath(sourcePath, false); }
      catch (e) { throw new Error(t`copia verificada en "${targetPath}", pero no se pudo borrar "${sourcePath}": ${e.message}`); }
      if (await getHandle(sourcePath)) throw new Error(t`copia verificada, pero el origen sigue existiendo: ${sourcePath}`);
    }
    return `${move ? 'Movido' : 'Copiado'}: ${sourcePath} -> ${targetPath} (${fmtBytes(sourceFile.size)}, SHA256: ${sourceHash.slice(0, 8)}...)`;
  }

  async function copyVerifiedFile(sourceFile, targetPath, targetHandle) {
    const sourceHash = await computeSha256(await sourceFile.arrayBuffer());
    try {
      const writer = await openRawWriter(targetPath);
      await sourceFile.stream().pipeTo(writer);
    } catch (e) {
      if (!targetHandle && await getHandle(targetPath)) {
        try { await removePath(targetPath, false); }
        catch (cleanupError) {
          throw new Error(t`copia fallida: ${e.message}; no se pudo retirar el destino incompleto "${targetPath}": ${cleanupError.message}`);
        }
      }
      throw e;
    }
    const copiedFile = await (await requireFile(targetPath)).getFile();
    if (copiedFile.size !== sourceFile.size ||
      await computeSha256(await copiedFile.arrayBuffer()) !== sourceHash) {
      throw new Error(t`verificación de copia fallida: ${targetPath}; el origen se conserva`);
    }
    return sourceHash;
  }

  async function importLocalFiles(files) {
    if (busy) { uiLog(t('⏳ Hay una operación en curso; vuelve a seleccionar los archivos al terminar.'), 'err'); return; }
    setBusy(true);
    let imported = 0, skipped = 0;
    try {
      for (const file of files) {
        const parts = splitPath(file.name);
        if (parts.length !== 1 || parts[0] !== file.name || isInternalPath(file.name)) {
          throw new Error(t`nombre de archivo no permitido: ${file.name}`);
        }
        if (file.size > CFG.MAX_HASH_BYTES) throw new Error(t`${file.name}: supera el máximo verificable de ${fmtBytes(CFG.MAX_HASH_BYTES)}`);
        const target = await getHandle(file.name);
        if (target?.kind === 'directory') throw new Error(t`${file.name}: ya existe una carpeta con ese nombre`);
        if (target && !confirm(t`¿Reemplazar "${file.name}" en el disco virtual (${fmtBytes(file.size)})? No hay deshacer automático.`)) {
          skipped++;
          uiLog(t`Omitido sin cambios: ${file.name}`, 'info');
          continue;
        }
        const hash = await copyVerifiedFile(file, file.name, target);
        imported++;
        uiLog(t`Importado localmente: ${file.name} (${fmtBytes(file.size)}, SHA256: ${hash.slice(0, 8)}...)`, 'info');
      }
      uiLog(t`Importación terminada: ${imported} archivo(s), ${skipped} omitido(s). Nada enviado a DeepSeek.`, 'info');
    } catch (e) {
      uiLog(t`❌ Importación detenida: ${e.message}. ${imported} archivo(s) importados y ${skipped} omitidos; los anteriores se conservan.`, 'err');
    } finally {
      setBusy(false);
      await ui?.refresh();
    }
  }

  async function openWriter(path, { append = false } = {}) {
    const gz = /\.gz$/i.test(path);
    if (gz && append) throw new Error(t('no se puede añadir (>>) a un .gz'));
    const ws = await openRawWriter(path, { append });
    const enc = new TextEncoder();
    let target = ws, gzWriter = null, pipe = null;
    if (gz) {
      const cs = new CompressionStream('gzip');
      pipe = cs.readable.pipeTo(ws);
      pipe.catch(() => { });
      gzWriter = cs.writable.getWriter();
      target = gzWriter;
    }
    let buf = '', bytes = 0;
    const flush = async () => {
      if (!buf) return;
      const b = enc.encode(buf);
      buf = '';
      bytes += b.length;
      await target.write(b);
    };
    return {
      async write(s) { buf += s; if (buf.length >= 65536) await flush(); },
      async close() {
        await flush();
        if (gzWriter) { await gzWriter.close(); await pipe; } else await ws.close();
        notifyHTMLPreviews(splitPath(path).join('/'));
        return bytes;
      },
      async abort() {
        try { if (gzWriter) await gzWriter.abort(); else await ws.abort(); } catch { /* */ }
      },
    };
  }

  // ============================================================
  // HASH Y MOTOR TRANSACCIONAL (CAPAS 2 & 3)
  // ============================================================
  async function computeSha256(data) {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function appendJournal(entry, { required = false } = {}) {
    const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
    try {
      const w = await openWriter('.dv/journal.jsonl', { append: true });
      await w.write(line);
      await w.close();
      return true;
    } catch (e) {
      if (required) throw new Error(t`Auditoría no guardada: ${e.message}`);
      uiLog(t`Auditoría no guardada: ${e.message}`, 'err');
      return false;
    }
  }

  // Other DeepSeek tabs share the same OPFS; Web Locks serialize their writes when available.
  const TX_STALE_MS = 2 * 60 * 1000;
  function withWriteLock(fn) {
    const locks = globalThis.navigator?.locks;
    return locks?.request ? locks.request('dv-atomic-write', () => fn()) : fn();
  }

  async function pathHash(path) {
    const handle = await getHandle(path);
    if (!handle) return null;
    if (handle.kind !== 'file') return 'directory';
    return computeSha256(new Uint8Array(await (await handle.getFile()).arrayBuffer()));
  }

  async function atomicWrite(targetPath, newContent, { expectedHash = null, mustNotExist = false } = {}) {
    const path = splitPath(targetPath).join('/');
    if (!path) throw new Error(t('ruta no válida'));
    const candidateBytes = typeof newContent === 'string' ? new TextEncoder().encode(newContent) : newContent;
    const candidateHash = await computeSha256(candidateBytes);
    return withWriteLock(async () => {
      const checkTarget = async (prevHash) => {
        const current = await pathHash(path);
        if (current === 'directory') throw new Error(t`es una carpeta: ${path}`);
        if (mustNotExist && current !== null) throw new Error(t`ya existe: ${path}; no se sobrescribió`);
        if (expectedHash !== null && current !== expectedHash) throw new Error(t('archivo cambió durante la preparación; no se sobrescribió'));
        if (prevHash !== undefined && current !== prevHash) throw new Error(t('archivo cambió durante la preparación; no se sobrescribió'));
        return current;
      };
      const prevHash = await checkTarget();
      const txId = crypto.randomUUID();
      const tmpPath = `.dv_tmp/${txId}.tmp`;
      const discardTmp = async () => { try { await removePath(tmpPath, false); } catch { /* */ } };

      try {
        await writeBytes(tmpPath, candidateBytes);
        if (await pathHash(tmpPath) !== candidateHash) throw new Error(t('Integridad de temporal comprometida.'));
        await appendJournal({
          type: 'atomic_write', txId, path, tmp: tmpPath, prevHash, newHash: candidateHash,
          bytes: candidateBytes.length, status: 'PREPARED'
        }, { required: true });
      } catch (e) { await discardTmp(); throw e; }

      let touched = false;
      try {
        await checkTarget(prevHash);
        touched = true;
        await writeBytes(path, candidateBytes);
        if (await pathHash(path) !== candidateHash) throw new Error(t('Verificación post-escritura fallida.'));
      } catch (e) {
        let current;
        try { current = await pathHash(path); } catch { current = undefined; }
        if (!touched || current === prevHash) {
          await appendJournal({ type: 'atomic_write', txId, path, prevHash, newHash: candidateHash, status: 'ABORTED', error: e.message });
          await discardTmp();
          throw e;
        }
        throw new Error(t`${e.message} Copia verificada conservada para recuperación (transacción ${txId.slice(0, 8)}).`);
      }

      if (await appendJournal({
        type: 'atomic_write', txId, path, prevHash, newHash: candidateHash,
        bytes: candidateBytes.length, status: 'COMMITTED'
      })) await discardTmp();
      return { hash: candidateHash, bytes: candidateBytes.length, txId };
    });
  }

  async function readJournalEntries() {
    const handle = await getHandle('.dv/journal.jsonl');
    if (!handle || handle.kind !== 'file') return [];
    const entries = [];
    for (const line of (await (await handle.getFile()).text()).split('\n')) {
      if (!line.trim()) continue;
      try { entries.push(JSON.parse(line)); } catch { /* interrupted append */ }
    }
    return entries;
  }

  async function recoverTransactions({ now = Date.now(), staleMs = TX_STALE_MS } = {}) {
    return withWriteLock(async () => {
      const report = { completed: 0, aborted: 0, conflicts: 0, cleaned: 0, waiting: 0, messages: [] };
      const pending = new Map();
      for (const entry of await readJournalEntries()) {
        if (entry?.type !== 'atomic_write' || typeof entry.txId !== 'string') continue;
        if (entry.status === 'PREPARED') pending.set(entry.txId, entry); else pending.delete(entry.txId);
      }
      const young = new Set();
      for (const tx of pending.values()) {
        const age = now - Date.parse(tx.timestamp);
        const tmpOk = typeof tx.tmp === 'string' && /^\.dv_tmp\/[\w-]+\.tmp$/.test(tx.tmp);
        if (Number.isFinite(age) && age < staleMs) { if (tmpOk) young.add(tx.tmp); report.waiting++; continue; }
        try { await recoverOne(tx, tmpOk); }
        catch (e) {
          if (tmpOk) young.add(tx.tmp);
          report.messages.push(t`Transacción ${tx.txId.slice(0, 8)} pendiente: ${e.message}`);
        }
      }
      async function recoverOne(tx, tmpOk) {
        const close = (status, extra = {}) => appendJournal({
          type: 'atomic_write', txId: tx.txId, path: tx.path,
          prevHash: tx.prevHash, newHash: tx.newHash, status, recovered: true, ...extra
        }, { required: true });
        let target;
        try {
          if (!tmpOk || isInternalPath(tx.path) || !splitPath(tx.path).length) throw new Error(t('entrada de registro no válida'));
          target = await pathHash(tx.path);
        } catch (e) {
          await close('ABORTED', { error: e.message });
          report.aborted++; report.messages.push(t`Transacción ${tx.txId.slice(0, 8)} descartada: ${e.message}`);
          return;
        }
        const tmp = await pathHash(tx.tmp);
        const removeTmp = async () => { if (tmp !== null) try { await removePath(tx.tmp, false); } catch { /* */ } };
        if (target === tx.newHash) {
          await close('COMMITTED'); await removeTmp();
          report.completed++; report.messages.push(t`Completada: ${tx.path} ya tenía la versión nueva verificada.`);
        } else if (target === tx.prevHash || tmp !== tx.newHash) {
          await close('ABORTED'); await removeTmp();
          report.aborted++;
          report.messages.push(target === tx.prevHash ? t`Revertida: ${tx.path} conserva la versión anterior intacta.` :
            t`Descartada: ${tx.path}; la copia temporal no era válida y el archivo no se tocó.`);
        } else {
          // The file differs from both versions; never overwrite it. Keep the approved bytes beside it.
          let copy = `${tx.path}.recuperado-${tx.txId.slice(0, 8)}`;
          if (await getHandle(copy)) copy = `${copy}-${now}`;
          const bytes = new Uint8Array(await (await (await requireFile(tx.tmp)).getFile()).arrayBuffer());
          await writeBytes(copy, bytes);
          if (await pathHash(copy) !== tx.newHash) throw new Error(t`recuperación: no se pudo verificar ${copy}; temporal conservado`);
          await close('CONFLICT', { recoveredPath: copy }); await removeTmp();
          report.conflicts++;
          report.messages.push(t`Conflicto: ${tx.path} cambió por otra vía; no se sobrescribió. Versión aprobada guardada en ${copy}.`);
        }
      }
      const tmpDir = await getHandle('.dv_tmp');
      if (tmpDir?.kind === 'directory') {
        for await (const [name, handle] of tmpDir.entries()) {
          if (handle.kind !== 'file' || young.has(`.dv_tmp/${name}`)) continue;
          const file = await handle.getFile();
          if (now - file.lastModified < staleMs) continue;
          try { await tmpDir.removeEntry(name); report.cleaned++; } catch { /* */ }
        }
      }
      return report;
    });
  }

  function formatRecovery(report) {
    const lines = [...report.messages];
    if (report.cleaned) lines.push(t`Temporales huérfanos eliminados: ${report.cleaned}.`);
    if (report.waiting) lines.push(t`Transacciones recientes en curso (otra pestaña): ${report.waiting}; se revisarán más tarde.`);
    return lines.length ? lines.join('\n') : t('Sin transacciones interrumpidas ni temporales huérfanos.');
  }

  // ============================================================
  // ADAPTER POSIX PARA ISOMORPHIC-GIT (CAPA 1)
  // ============================================================
  function normalizeFsError(error) {
    if (typeof error?.code === 'string') return error;
    const codes = {
      NotFoundError: 'ENOENT',
      TypeMismatchError: 'ENOTDIR',
      InvalidModificationError: 'ENOTEMPTY',
      QuotaExceededError: 'ENOSPC',
      SecurityError: 'EACCES',
      NotAllowedError: 'EACCES',
      AbortError: 'EIO'
    };
    const wrapped = new Error(error?.message || String(error));
    wrapped.name = error?.name || 'Error';
    wrapped.code = codes[error?.name] || 'EIO';
    return wrapped;
  }

  function makeFs() {
    const enc = new TextEncoder(), dec = new TextDecoder();
    const raw = {
      async readFile(path, options) {
        const h = await requireFile(path);
        const f = await h.getFile();
        const b = new Uint8Array(await f.arrayBuffer());
        const encoding = typeof options === 'string' ? options : options?.encoding;
        return encoding ? dec.decode(b) : b;
      },
      async writeFile(path, data) {
        await writeBytes(path, typeof data === 'string' ? enc.encode(data) : data);
      },
      async readdir(path) {
        const h = path ? await getHandle(path) : rootDir;
        if (!h) throw Object.assign(new Error(t('no existe: ') + path), { name: 'NotFoundError' });
        if (h.kind !== 'directory') throw Object.assign(new Error(t('no es dir')), { name: 'TypeMismatchError' });
        const out = [];
        for await (const [name] of h.entries()) out.push(name);
        return out.sort();
      },
      async stat(path) {
        const parts = path ? splitPath(path) : [];
        const now = new Date();
        if (!parts.length) {
          return { isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false, size: 0, mode: 0o40755, mtime: now, ctime: now, mtimeMs: now.getTime(), ctimeMs: now.getTime() };
        }
        const h = await getHandle(path);
        if (!h) throw Object.assign(new Error(t('no existe: ') + path), { name: 'NotFoundError' });
        if (h.kind === 'file') {
          const f = await h.getFile();
          const d = new Date(f.lastModified || Date.now());
          return { isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false, size: f.size, mode: 0o100644, mtime: d, ctime: d, mtimeMs: d.getTime(), ctimeMs: d.getTime() };
        }
        return { isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false, size: 0, mode: 0o40755, mtime: now, ctime: now, mtimeMs: now.getTime(), ctimeMs: now.getTime() };
      },
      async lstat(path) { return raw.stat(path); },
      async mkdir(path, options = {}) {
        let dir = rootDir;
        for (const s of splitPath(path)) dir = await dir.getDirectoryHandle(s, { create: true });
      },
      async unlink(path) { await removePath(path, false); },
      async rmdir(path) { await removePath(path, false); },
      async readlink() { throw Object.assign(new Error(t('no symlinks')), { code: 'ENOSYS' }); },
      async symlink() { throw Object.assign(new Error(t('no symlinks')), { code: 'ENOSYS' }); },
      async chmod() { }, async utimes() { }, async fsync() { }
    };
    const p = {};
    for (const [name, fn] of Object.entries(raw)) {
      p[name] = async (...args) => {
        try { return await fn(...args); } catch (e) { throw normalizeFsError(e); }
      };
    }
    return { promises: p, ...p, constants: { O_RDONLY: 0, O_WRONLY: 1, O_RDWR: 2, O_CREAT: 64, O_TRUNC: 512 } };
  }

  let gitInstance = null;
  let gitFs = null;

  async function getGit() {
    if (gitInstance) return { git: gitInstance, fs: gitFs };
    uiLog(t('Cargando isomorphic-git...'), 'info');
    if (typeof window.git !== 'undefined') {
      gitInstance = window.git;
    } else {
      const mod = await import('https://esm.sh/isomorphic-git@1.32.1');
      gitInstance = mod.default || mod;
    }
    gitFs = makeFs();
    return { git: gitInstance, fs: gitFs };
  }

  let diffInstance = null;
  async function getDiff() {
    if (!diffInstance) {
      if (typeof window.Diff !== 'undefined') {
        diffInstance = window.Diff;
      } else {
        diffInstance = await import('https://esm.sh/diff@7.0.0');
      }
    }
    return diffInstance;
  }

  async function gitHeadOid(git, fs) {
    const head = (await fs.promises.readFile('.git/HEAD', 'utf8')).trim();
    try {
      return await git.resolveRef({ fs, dir: '.', ref: 'HEAD' });
    } catch (e) {
      const branch = head.startsWith('ref: ') ? head.slice(5) : null;
      if (branch && e.code === 'NotFoundError' && e.data?.what === branch) return null;
      throw e;
    }
  }

  function formatGitDate(timestamp, iso = false) {
    if (!Number.isFinite(timestamp)) return t('sin fecha: timestamp ausente o no válido');
    const date = new Date(timestamp * 1000);
    if (!Number.isFinite(date.getTime())) return t('sin fecha: timestamp fuera de rango');
    return iso ? date.toISOString() : date.toLocaleTimeString(language);
  }

  function gitChangeDescription(head, work, stage) {
    const states = [];
    if (head === 0 && stage === 0) states.push(t('untracked'));
    else {
      if (head !== stage) states.push(t(stage === 0 ? 'deleted (staged)' : head === 0 ? 'added (staged)' : 'modified (staged)'));
      if (work !== stage) states.push(t(work === 0 ? 'deleted (unstaged)' : stage === 0 ? 'untracked' : 'modified (unstaged)'));
    }
    return states.join(', ');
  }

  async function stageAllGitFiles(git, fs) {
    const matrix = await git.statusMatrix({ fs, dir: '.' });
    let count = 0;
    for (const [filepath, , work] of matrix) {
      if (isInternalPath(filepath)) continue;
      if (work === 0) await git.remove({ fs, dir: '.', filepath });
      else await git.add({ fs, dir: '.', filepath });
      count++;
    }
    return count;
  }

  async function gitBlobOids(git, fs, tree) {
    const blobs = [];
    await git.walk({
      fs, dir: '.', trees: [tree],
      map: async (path, [entry]) => {
        if (path !== '.' && entry && await entry.type() === 'blob') blobs.push([path, await entry.oid()]);
      }
    });
    return blobs.sort((a, b) => a[0].localeCompare(b[0]));
  }

  async function getGitStatus({ capture = false } = {}) {
    const repository = await getHandle('.git');
    if (!repository) return { initialized: false, changes: [] };
    if (repository.kind !== 'directory') throw new Error(t('.git no es una carpeta; revisa el repositorio'));
    const { git, fs } = await getGit();
    const matrix = await git.statusMatrix({ fs, dir: '.' });
    if (matrix.some(([path, head, , stage]) => isInternalPath(path) && (head !== 0 || stage !== 0))) {
      throw new Error(t('Git contiene metadatos internos versionados; revisa el repositorio antes de guardar'));
    }
    const rows = matrix.filter(([path]) => !isInternalPath(path));
    const changes = rows.filter(([, head, work, stage]) => head !== work || work !== stage)
      .map(([path, head, work, stage]) => ({ path, head, work, stage, description: gitChangeDescription(head, work, stage) }));
    const branch = await git.currentBranch({ fs, dir: '.' });
    const head = await gitHeadOid(git, fs);
    const state = { initialized: true, changes, branch, head };
    if (!capture) return state;
    if (!branch) throw new Error(t('guardar con botón requiere una rama local activa; revisa git branch'));
    const working = [];
    for (const [path, , work] of rows) {
      let hash = null;
      if (work !== 0) {
        const file = await (await requireFile(path)).getFile();
        if (file.size > CFG.MAX_HASH_BYTES) throw new Error(t`Git: archivo demasiado grande para verificar: ${path}`);
        hash = await computeSha256(await file.arrayBuffer());
      }
      working.push([path, hash]);
    }
    const staged = await gitBlobOids(git, fs, git.STAGE());
    working.sort((a, b) => a[0].localeCompare(b[0]));
    state.stagedOids = staged;
    state.workSignature = JSON.stringify({ branch, head, working });
    state.signature = JSON.stringify({ work: state.workSignature, staged });
    return state;
  }

  async function saveGitChanges(review, message) {
    if (busy || editorOpen) throw new Error(t('cierra el editor o espera a que termine la operación antes de versionar'));
    if (typeof message !== 'string' || !message.trim()) throw new Error(t('escribe un mensaje de commit'));
    if (!review?.initialized || !review.signature || !review.changes.length) throw new Error(t('actualiza la revisión de cambios antes de guardar'));
    setBusy(true);
    let staged = false;
    try {
      const current = await getGitStatus({ capture: true });
      if (current.signature !== review.signature) throw new Error(t('repositorio cambió desde la revisión; actualiza la lista antes de guardar'));
      const { git, fs } = await getGit();
      staged = true;
      await stageAllGitFiles(git, fs);
      const ready = await getGitStatus({ capture: true });
      if (ready.workSignature !== review.workSignature || ready.changes.some(c => c.work !== c.stage)) {
        throw new Error(t('archivos o rama cambiaron durante staging; no se hizo commit'));
      }
      if (!ready.changes.some(c => c.head !== c.stage)) {
        throw new Error(t('la versión actual coincide con HEAD; staging actualizado, no hay cambios para un commit'));
      }
      const oid = await git.commit({
        fs, dir: '.', message: message.trim(),
        author: { name: 'DV User', email: 'user@local.lan' }
      });
      if (await gitHeadOid(git, fs) !== oid) throw new Error(t`commit ${oid} creado, pero HEAD cambió; revisa git log y git status`);
      const commit = await git.readCommit({ fs, dir: '.', oid });
      if ((review.head && !commit.commit.parent.includes(review.head)) ||
        !review.head && commit.commit.parent.length) throw new Error(t`commit ${oid} creado con historial inesperado; revisa git log`);
      if (JSON.stringify(await gitBlobOids(git, fs, git.TREE({ ref: oid }))) !== JSON.stringify(ready.stagedOids)) {
        throw new Error(t`commit ${oid} creado, pero su contenido no coincide con el staging revisado; revisa git show`);
      }
      const final = await getGitStatus();
      uiLog(t`[${review.branch} ${oid.slice(0, 7)}] ${message.trim()}. Git local; nada enviado al chat ni a un servidor.`, 'info');
      if (final.changes.length) uiLog(t('Hay cambios pendientes posteriores al commit; revisa el estado Git.'), 'err');
      return oid;
    } catch (e) {
      throw new Error(`${e.message}${staged ? t('. El staging puede haber cambiado; revisa git status. Sin rollback automático.') : ''}`);
    } finally {
      setBusy(false);
      await ui?.refresh();
    }
  }

  async function checkoutBranch(git, fs, ref) {
    const branches = await git.listBranches({ fs, dir: '.' });
    if (!branches.includes(ref)) throw new Error(t('checkout: rama local no existe; créala con git branch <nombre>'));
    const oid = await git.resolveRef({ fs, dir: '.', ref: `refs/heads/${ref}` });
    await git.walk({
      fs, dir: '.', trees: [git.TREE({ ref: oid })],
      map: async (path, [entry]) => {
        if (path === '.' || !entry) return;
        if (isInternalPath(path)) throw new Error(t`checkout: rama contiene metadatos protegidos: ${path}`);
        if (splitPath(path).join('/') !== path) throw new Error(t`checkout: ruta no válida en rama: ${path}`);
        const type = await entry.type();
        if (!['tree', 'blob'].includes(type) || type === 'blob' && ![0o100644, 0o100755].includes(await entry.mode())) {
          throw new Error(t`checkout: tipo no soportado en rama: ${path}`);
        }
      }
    });
    const inspect = async () => {
      const matrix = await git.statusMatrix({ fs, dir: '.' });
      const dirty = matrix.filter(([path, head, work, stage]) => !isInternalPath(path) &&
        (head !== work || work !== stage));
      if (dirty.length) throw new Error(t`checkout bloqueado: cambios pendientes en ${dirty.length} archivo(s). Revisa git status y confirma o conserva tus archivos.`);
      const tracked = new Set(await git.listFiles({ fs, dir: '.' }));
      if ([...tracked].some(isInternalPath)) throw new Error(t('checkout bloqueado: staging contiene metadatos protegidos; revisa el repositorio'));
      if (matrix.some(([path, head]) => head !== 0 && isInternalPath(path))) {
        throw new Error(t('checkout bloqueado: commit actual contiene metadatos protegidos'));
      }
      const files = (await listFiles()).filter(f => !isInternalPath(f.path));
      const untracked = files.filter(f => !tracked.has(f.path));
      if (untracked.length) throw new Error(t`checkout bloqueado: ${untracked.length} archivo(s) sin seguimiento o ignorados. No se descartan automáticamente.`);
      const hashes = [];
      for (const f of files) {
        if (f.size > CFG.MAX_HASH_BYTES) throw new Error(t('checkout: archivo demasiado grande para verificar'));
        hashes.push([f.path, await computeSha256(await (await (await requireFile(f.path)).getFile()).arrayBuffer())]);
      }
      return JSON.stringify({
        head: await gitHeadOid(git, fs),
        branch: await git.currentBranch({ fs, dir: '.' }), hashes
      });
    };
    const before = await inspect();
    if (await git.currentBranch({ fs, dir: '.' }) === ref) return t`Ya estás en la rama ${ref}; working tree limpio.`;
    if (!confirm(t`¿Cambiar a la rama local "${ref}" (${oid.slice(0, 7)})?\nWorking tree y staging limpios. Se reemplazarán archivos por la versión confirmada de esa rama.\nSin --force, sin descarte automático. Checkpoints conservados.`)) {
      throw new Error(t('checkout cancelado; rama y archivos intactos'));
    }
    if (await inspect() !== before || await git.resolveRef({ fs, dir: '.', ref: `refs/heads/${ref}` }) !== oid) {
      throw new Error(t('checkout: repositorio cambió durante confirmación; no se cambió de rama'));
    }
    try {
      await git.checkout({ fs, dir: '.', ref, force: false });
      const matrix = await git.statusMatrix({ fs, dir: '.' });
      if (await git.currentBranch({ fs, dir: '.' }) !== ref ||
        await gitHeadOid(git, fs) !== oid ||
        matrix.some(([path, head, work, stage]) => !isInternalPath(path) && (head !== work || work !== stage))) {
        throw new Error(t('estado final no coincide con la rama o no está limpio'));
      }
    } catch (e) {
      throw new Error(t`checkout no completado/verificado: ${e.message}. Revisa git status y git branch; no hay rollback automático.`);
    }
    return t`Rama activa: ${ref} (${oid.slice(0, 7)}). Working tree y staging verificados limpios.`;
  }

  async function gitShow(git, fs, args) {
    if (args.length > 1) throw new Error(t('uso: git show [ref|ref:archivo]'));
    const spec = args[0] || 'HEAD';
    const colon = spec.indexOf(':');
    const ref = colon < 0 ? spec : spec.slice(0, colon);
    if (!ref || ref.startsWith('-')) throw new Error(t('referencia Git no válida; usa HEAD, nombre de referencia o SHA completo'));
    let path = null;
    if (colon >= 0) {
      path = spec.slice(colon + 1);
      if (!path || !splitPath(path).length || isInternalPath(path)) throw new Error(t('archivo histórico no permitido'));
      path = splitPath(path).join('/');
    }
    const oid = await git.resolveRef({ fs, dir: '.', ref });
    const { commit } = await git.readCommit({ fs, dir: '.', oid });
    if (path === null) {
      return `commit ${oid}\nParents: ${commit.parent.join(' ') || '(inicial)'}\n` +
        `Author: ${commit.author.name} <${commit.author.email}>\n` +
        `Date: ${formatGitDate(commit.author?.timestamp, true)}\n\n${commit.message.trimEnd()}`;
    }
    const { blob } = await git.readBlob({ fs, dir: '.', oid, filepath: path });
    if (blob.length > CFG.MAX_RUN_BYTES) throw new Error(t('git show: máximo 256 KB por archivo histórico'));
    if (blob.includes(0)) throw new Error(t('git show requiere texto UTF-8 sin NUL; exportación binaria pendiente'));
    try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(blob); }
    catch (e) { if (e.name === 'TypeError') throw new Error(t('git show requiere texto UTF-8 válido')); throw e; }
  }

  async function gitRestore(git, fs, args, ctx) {
    const { flags, pos } = parseArgs(args, { staged: 'b', source: 'v' });
    if (pos.length !== 1) throw new Error(t('uso: git restore [--staged] [--source <ref>] <archivo>'));
    const parts = splitPath(pos[0]);
    if (!parts.length || isInternalPath(pos[0])) throw new Error(t('git restore: raíz y metadatos internos no permitidos'));
    const path = parts.join('/');
    if (flags.source !== undefined && (!flags.source || flags.source.startsWith('-'))) {
      throw new Error(t('referencia Git no válida; usa HEAD, nombre de referencia o SHA completo'));
    }
    const staged = (await gitBlobOids(git, fs, git.STAGE())).find(([p]) => p === path);

    if (flags.staged) {
      const sourceOid = flags.source ? await git.resolveRef({ fs, dir: '.', ref: flags.source }) : await gitHeadOid(git, fs);
      let inSource = false;
      if (sourceOid) {
        try { await git.readBlob({ fs, dir: '.', oid: sourceOid, filepath: path }); inSource = true; }
        catch (e) { if (e.code !== 'NotFoundError') throw e; }
      }
      if (!staged && !inSource) throw new Error(t`git restore: ${path} no está en staging ni en ${flags.source || 'HEAD'}`);
      if (sourceOid) await git.resetIndex({ fs, dir: '.', filepath: path, ref: sourceOid });
      else await git.remove({ fs, dir: '.', filepath: path });
      return t`Staging restaurado: ${path} desde ${flags.source || 'HEAD'}. Tu archivo no cambió.`;
    }

    if (editorOpen) throw new Error(t('cierra el editor actual antes de restaurar'));
    let bytes;
    const label = flags.source || 'staging';
    if (flags.source) {
      const oid = await git.resolveRef({ fs, dir: '.', ref: flags.source });
      try { ({ blob: bytes } = await git.readBlob({ fs, dir: '.', oid, filepath: path })); }
      catch (e) {
        if (e.code === 'NotFoundError') throw new Error(t`git restore: ${path} no existe en ${flags.source}; para archivos nuevos usa rm`);
        throw e;
      }
    } else {
      if (!staged) throw new Error(t`git restore: ${path} no está en staging; usa --source HEAD o rm para archivos nuevos`);
      ({ blob: bytes } = await git.readBlob({ fs, dir: '.', oid: staged[1] }));
    }
    bytes = new Uint8Array(bytes);
    if (bytes.length > CFG.MAX_RUN_BYTES) throw new Error(t('checkpoint/restore: máximo 256 KB por archivo'));
    const hash = await computeSha256(bytes);
    const target = await getHandle(path);
    if (target?.kind === 'directory') throw new Error(t('restore: destino es una carpeta'));
    const current = target ? await fileSnapshot(path) : null;
    if (current?.hash === hash) return t`Sin cambios: ${path} ya coincide con ${label}.`;
    let text = null, original = null;
    if (!bytes.includes(0) && current && !current.bytes.includes(0)) {
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
        text = decoder.decode(bytes);
        original = decoder.decode(current.bytes);
      } catch (e) { if (e.name !== 'TypeError') throw e; }
    }
    if (text !== null && original !== null) {
      ctx.openEditor({
        snapshot: { path, text: original, hash: current.hash }, candidate: text,
        checkpointBeforeSave: true, checkpointLabel: t`Antes de git restore desde ${label}`
      });
      return t`Restauración Git preparada: ${path} desde ${label}. Revisa el diff y confirma Aplicar; se creará checkpoint previo al guardar.`;
    }
    if (!confirm(t`¿Restaurar "${path}" desde ${label} (${bytes.length} B)?\n${current ? t('Binario/no UTF-8: sin diff de texto. Se guardará checkpoint de la versión actual.') : t('Archivo ausente: se creará con los bytes guardados.')}\nSHA256: ${hash}`)) {
      throw new Error(t('restauración cancelada; archivo intacto'));
    }
    const fresh = await getHandle(path);
    if (current ? !fresh || (await fileSnapshot(path)).hash !== current.hash : fresh !== null) throw new Error(t('restore: destino cambió; no se sobrescribió'));
    let backup = null;
    if (current) {
      backup = await createCheckpoint(path, t`Antes de git restore desde ${label}`);
      uiLog(t`Checkpoint previo: ${backup.id}`, 'info');
      if (backup.hash !== current.hash || (await fileSnapshot(path)).hash !== current.hash) throw new Error(t('restore: archivo cambió; copia previa conservada'));
    }
    await writeBytes(path, bytes);
    if ((await fileSnapshot(path)).hash !== hash) throw new Error(t`git restore: verificación fallida${backup ? t`; checkpoint previo ${backup.id} conservado` : ''}`);
    return t`Restaurado desde ${label} y verificado: ${path}\nSHA256: ${hash}${backup ? t`\nCheckpoint previo: ${backup.id}` : ''}\nNo se hizo commit.`;
  }

  async function gitDiff(git, fs, args) {
    const { flags, pos } = parseArgs(args, { staged: 'b' });
    if (pos.length > 1) throw new Error(t('uso: git diff [--staged] [ref]'));
    const ref = pos[0] || 'HEAD';
    const headOid = pos[0]
      ? await git.resolveRef({ fs, dir: '.', ref })
      : await gitHeadOid(git, fs);
    const matrix = await git.statusMatrix({ fs, dir: '.', ref });
    const stagedOids = new Map();
    await git.walk({
      fs, dir: '.', trees: [git.STAGE()],
      map: async (path, [entry]) => {
        if (path !== '.' && isInternalPath(path)) return null;
        if (entry && await entry.type() === 'blob') stagedOids.set(path, await entry.oid());
      }
    });
    const { createTwoFilesPatch } = await getDiff();
    const patches = [];
    let total = 0;
    for (const [path, head, workdir, stage] of matrix) {
      if (isInternalPath(path)) continue;
      if (!flags.staged && head === 0 && stage === 0) continue;
      const compareHead = flags.staged || !!pos[0];
      const oldPresent = compareHead ? head !== 0 : stage !== 0;
      const newPresent = flags.staged ? stage !== 0 : workdir !== 0;
      if (!oldPresent && !newPresent) continue;
      // Like native Git, unstaged diff excludes untracked files.
      if (!compareHead && !oldPresent) continue;
      const readStage = async () => (await git.readBlob({ fs, dir: '.', oid: stagedOids.get(path) })).blob;
      const oldBytes = oldPresent
        ? compareHead
          ? (await git.readBlob({ fs, dir: '.', oid: headOid, filepath: path })).blob
          : await readStage()
        : new Uint8Array();
      let newBytes = new Uint8Array();
      if (newPresent) {
        if (flags.staged) newBytes = await readStage();
        else {
          const file = await (await requireFile(path)).getFile();
          if (file.size > CFG.MAX_COLLECT_CHARS) throw new Error(t`archivo demasiado grande para diff: ${path}`);
          newBytes = new Uint8Array(await file.arrayBuffer());
        }
      }
      total += oldBytes.length + newBytes.length;
      if (total > CFG.MAX_COLLECT_CHARS) throw new Error(t('diff demasiado grande para procesar en memoria'));
      if (oldPresent === newPresent && oldBytes.length === newBytes.length &&
        oldBytes.every((b, i) => b === newBytes[i])) continue;
      const oldName = oldPresent ? `a/${path}` : '/dev/null';
      const newName = newPresent ? `b/${path}` : '/dev/null';
      const decode = (bytes) => {
        if (bytes.includes(0)) return null;
        try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
        catch (e) { if (e.name === 'TypeError') return null; throw e; }
      };
      const oldText = decode(oldBytes), newText = decode(newBytes);
      if (oldText === null || newText === null) {
        patches.push(t`Binary files ${JSON.stringify(oldName)} and ${JSON.stringify(newName)} differ (${oldBytes.length} -> ${newBytes.length} B)`);
      } else {
        const patch = createTwoFilesPatch(JSON.stringify(oldName), JSON.stringify(newName),
          oldText, newText, '', '', { context: 3, timeout: 2000 });
        if (patch === undefined) throw new Error(t`diff excedió el tiempo límite: ${path}`);
        patches.push(patch);
      }
    }
    return patches.join('\n') || t('Sin diferencias. Los archivos sin seguimiento se muestran en git status.');
  }

  // ============================================================
  // STREAMING & PARSING
  // ============================================================
  async function* lines(path) {
    const file = await (await requireFile(path)).getFile();
    const dec = new TextDecoder('utf-8');
    let stream = file.stream();
    if (file.size >= 2) {
      const b = new Uint8Array(await file.slice(0, 2).arrayBuffer());
      if (b[0] === 0x1f && b[1] === 0x8b) stream = stream.pipeThrough(new DecompressionStream('gzip'));
    }
    const reader = stream.getReader();
    let tail = '';
    try {
      for (; ;) {
        const { value, done } = await reader.read();
        if (done) break;
        tail += dec.decode(value, { stream: true });
        let start = 0, i;
        while ((i = tail.indexOf('\n', start)) >= 0) {
          let l = tail.slice(start, i);
          if (l.endsWith('\r')) l = l.slice(0, -1);
          yield l;
          start = i + 1;
        }
        tail = tail.slice(start);
      }
      tail += dec.decode();
      if (tail) yield tail.endsWith('\r') ? tail.slice(0, -1) : tail;
    } finally {
      try { await reader.cancel(); } catch { /* */ }
    }
  }

  async function* strLines(s) {
    if (!s) return;
    const arr = s.split('\n');
    if (arr[arr.length - 1] === '') arr.pop();
    for (const l of arr) yield l;
  }
  const normalize = (r) => (r == null ? strLines('') : typeof r === 'string' ? strLines(r) : r);

  function source(ctx, file) {
    if (file) return lines(file);
    if (ctx.stdin) return ctx.stdin;
    throw new Error(t('falta fichero o entrada por pipe'));
  }

  function tokenize(str) {
    const out = [];
    let cur = '', has = false, q = null, start = 0, quoted = false;
    const push = (end) => {
      if (has) {
        out.push({ t: 'w', v: cur, quoted, start, end });
        cur = ''; has = false; quoted = false;
      }
    };
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (q) { if (ch === q) q = null; else cur += ch; continue; }
      if (ch === '"' || ch === "'") { if (!has) start = i; q = ch; has = true; quoted = true; continue; }
      if (/\s/.test(ch)) { push(i); continue; }
      if (ch === '|') { push(i); out.push({ t: 'op', v: '|', start: i, end: i + 1 }); continue; }
      if (ch === '>') {
        push(i);
        if (str[i + 1] === '>') { out.push({ t: 'op', v: '>>', start: i, end: i + 2 }); i++; }
        else out.push({ t: 'op', v: '>', start: i, end: i + 1 });
        continue;
      }
      if (!has) start = i;
      cur += ch; has = true;
    }
    if (q) throw new Error(t('comillas sin cerrar'));
    push(str.length);
    return out;
  }

  function quoteCommandPath(path) {
    return path.split("'").map((part) => `'${part}'`).join(`"'"`);
  }

  function runFromExplorer(path) {
    return handleExecution(`run ${quoteCommandPath(path)}`, { origin: 'panel', forceShare: false });
  }

  async function downloadUserFile(path) {
    if (busy) { uiLog(t('⏳ Hay una operación en curso; reintenta la descarga al terminar.'), 'err'); return; }
    setBusy(true);
    let url = null, link = null;
    try {
      const parts = splitPath(path);
      if (!parts.length || isInternalPath(path)) throw new Error(t('archivo a descargar no permitido'));
      const file = await (await requireFile(parts.join('/'))).getFile();
      url = URL.createObjectURL(file);
      link = document.createElement('a');
      link.href = url;
      link.download = parts[parts.length - 1];
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      const pendingUrl = url;
      setTimeout(() => URL.revokeObjectURL(pendingUrl), 60000);
      url = null;
      uiLog(t`Descarga solicitada: ${path} (${fmtBytes(file.size)}). Comprueba las descargas del navegador; nada enviado al chat.`, 'info');
    } catch (e) {
      uiLog(t`❌ Descarga: ${e.message}`, 'err');
    } finally {
      link?.remove();
      if (url) URL.revokeObjectURL(url);
      setBusy(false);
    }
  }

  // ============================================================
  // ZIP MINIMO (store/deflate), sin dependencias externas
  // ============================================================
  const ZIP_CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function zipCrc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = ZIP_CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  async function zipDeflate(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function zipInflate(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function zipDosDateTime(date) {
    const d = (date instanceof Date && !Number.isNaN(+date)) ? date : new Date();
    const year = Math.max(1980, d.getFullYear());
    const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f);
    const dateVal = (((year - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
    return { time, dateVal };
  }

  function zipWriteFields(fields) {
    const size = fields.reduce((sum, [, len]) => sum + len, 0);
    const buf = new Uint8Array(size);
    const view = new DataView(buf.buffer);
    let off = 0;
    for (const [value, len] of fields) {
      if (len === 2) view.setUint16(off, value, true);
      else view.setUint32(off, value, true);
      off += len;
    }
    return buf;
  }

  function zipLocalHeader({ nameLen, method, crc, compSize, rawSize, time, dateVal }) {
    return zipWriteFields([
      [0x04034b50, 4], [20, 2], [0x0800, 2], [method, 2], [time, 2], [dateVal, 2],
      [crc, 4], [compSize, 4], [rawSize, 4], [nameLen, 2], [0, 2],
    ]);
  }

  function zipCentralHeader({ nameLen, method, crc, compSize, rawSize, time, dateVal, offset }) {
    return zipWriteFields([
      [0x02014b50, 4], [20, 2], [20, 2], [0x0800, 2], [method, 2], [time, 2], [dateVal, 2],
      [crc, 4], [compSize, 4], [rawSize, 4], [nameLen, 2], [0, 2], [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4],
    ]);
  }

  function zipEndRecord({ count, centralSize, centralOffset }) {
    return zipWriteFields([
      [0x06054b50, 4], [0, 2], [0, 2], [count, 2], [count, 2], [centralSize, 4], [centralOffset, 4], [0, 2],
    ]);
  }

  async function exportDiskAsZip() {
    if (busy) { uiLog(t('⏳ Hay una operación en curso; reintenta exportar al terminar.'), 'err'); return; }
    setBusy(true);
    let url = null, link = null;
    try {
      const encoder = new TextEncoder();
      const localChunks = [], centralChunks = [];
      let offset = 0, fileCount = 0, rawTotal = 0;
      for await (const e of walk(rootDir)) {
        if (e.kind !== 'file') continue;
        const file = await e.handle.getFile();
        const rawBytes = new Uint8Array(await file.arrayBuffer());
        const crc = zipCrc32(rawBytes);
        let method = 0, data = rawBytes;
        if (rawBytes.length) {
          const deflated = await zipDeflate(rawBytes);
          if (deflated.length < rawBytes.length) { method = 8; data = deflated; }
        }
        const nameBytes = encoder.encode(e.path);
        const { time, dateVal } = zipDosDateTime(new Date(file.lastModified));
        const fields = { nameLen: nameBytes.length, method, crc, compSize: data.length, rawSize: rawBytes.length, time, dateVal };
        const header = zipLocalHeader(fields);
        localChunks.push(header, nameBytes, data);
        centralChunks.push(zipCentralHeader({ ...fields, offset }), nameBytes);
        offset += header.length + nameBytes.length + data.length;
        fileCount++; rawTotal += rawBytes.length;
      }
      if (!fileCount) throw new Error(t('el disco está vacío; no hay nada que exportar'));
      const centralOffset = offset;
      const centralSize = centralChunks.reduce((sum, c) => sum + c.length, 0);
      const endRecord = zipEndRecord({ count: fileCount, centralSize, centralOffset });
      const blob = new Blob([...localChunks, ...centralChunks, endRecord], { type: 'application/zip' });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      url = URL.createObjectURL(blob);
      link = document.createElement('a');
      link.href = url;
      link.download = `disco-${stamp}.zip`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      const pendingUrl = url;
      setTimeout(() => URL.revokeObjectURL(pendingUrl), 60000);
      url = null;
      uiLog(t`Exportado: ${fileCount} archivo(s), ${fmtBytes(rawTotal)} originales, ${fmtBytes(blob.size)} en el .zip. Incluye .git y checkpoints; nada enviado al chat.`, 'info');
    } catch (e) {
      uiLog(t`❌ Exportar ZIP: ${e.message}`, 'err');
    } finally {
      link?.remove();
      if (url) URL.revokeObjectURL(url);
      setBusy(false);
    }
  }

  function parseZipEntries(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const EOCD_SIG = 0x06054b50;
    const minPos = Math.max(0, bytes.length - 22 - 65535);
    let eocdOffset = -1;
    for (let i = bytes.length - 22; i >= minPos; i--) {
      if (view.getUint32(i, true) === EOCD_SIG) { eocdOffset = i; break; }
    }
    if (eocdOffset < 0) throw new Error(t('no se encontró el final del archivo ZIP (EOCD); ¿archivo corrupto o no es un .zip?'));
    const entryCount = view.getUint16(eocdOffset + 10, true);
    const centralOffset = view.getUint32(eocdOffset + 16, true);
    const decoder = new TextDecoder('utf-8');
    const entries = [];
    let pos = centralOffset;
    for (let i = 0; i < entryCount; i++) {
      if (pos + 46 > bytes.length || view.getUint32(pos, true) !== 0x02014b50) {
        throw new Error(t('estructura del ZIP inesperada en el directorio central'));
      }
      const method = view.getUint16(pos + 10, true);
      const crc = view.getUint32(pos + 16, true);
      const compSize = view.getUint32(pos + 20, true);
      const rawSize = view.getUint32(pos + 24, true);
      const nameLen = view.getUint16(pos + 28, true);
      const extraLen = view.getUint16(pos + 30, true);
      const commentLen = view.getUint16(pos + 32, true);
      const localOffset = view.getUint32(pos + 42, true);
      const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
      entries.push({ name, method, crc, compSize, rawSize, localOffset });
      pos += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  async function readZipEntryData(bytes, entry) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const nameLen = view.getUint16(entry.localOffset + 26, true);
    const extraLen = view.getUint16(entry.localOffset + 28, true);
    const dataStart = entry.localOffset + 30 + nameLen + extraLen;
    const raw = bytes.subarray(dataStart, dataStart + entry.compSize);
    if (entry.method === 0) return raw;
    if (entry.method === 8) return zipInflate(raw);
    throw new Error(t`método de compresión no soportado (${entry.method}); usa un .zip con store o deflate`);
  }

  async function importZipFile(file) {
    if (busy) { uiLog(t('⏳ Hay una operación en curso; reintenta importar el ZIP al terminar.'), 'err'); return; }
    if (!confirm(t('Vas a restaurar un backup .zip: los archivos con el mismo nombre serán reemplazados sin deshacer (incluye .git y checkpoints si el ZIP los trae). ¿Continuar?'))) {
      uiLog(t('Importación de ZIP cancelada; no se ha modificado nada'), 'info');
      return;
    }
    setBusy(true);
    let restored = 0, skipped = 0;
    try {
      if (file.size > CFG.MAX_ZIP_BYTES) throw new Error(t`ZIP demasiado grande: máximo ${fmtBytes(CFG.MAX_ZIP_BYTES)}`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const entries = parseZipEntries(bytes);
      for (const entry of entries) {
        if (entry.name.endsWith('/')) { skipped++; continue; }
        const parts = splitPath(entry.name);
        const data = await readZipEntryData(bytes, entry);
        if (zipCrc32(data) !== entry.crc) throw new Error(t`CRC inválido en ${entry.name}; el ZIP podría estar corrupto`);
        await writeBytes(parts.join('/'), data);
        restored++;
      }
      uiLog(t`ZIP restaurado: ${restored} archivo(s) escritos, ${skipped} carpeta(s) omitidas. Nada enviado al chat.`, 'info');
    } catch (e) {
      uiLog(t`❌ Importar ZIP: ${e.message}. ${restored} archivo(s) ya escritos se conservan.`, 'err');
    } finally {
      setBusy(false);
      await ui?.refresh();
    }
  }

  function parseSharing(raw) {
    const tokens = tokenize(raw), clean = [];
    let share = false, file = null, literal = false, command = true, redirectTarget = false;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.t === 'op') {
        clean.push(token);
        if (token.v === '|') { literal = false; command = true; }
        else redirectTarget = true;
        continue;
      }
      if (command || redirectTarget) {
        clean.push(token); command = false; redirectTarget = false; continue;
      }
      if (!token.quoted && !literal && token.v === '--') literal = true;
      if (!token.quoted && !literal && token.v === '--share') {
        if (share) throw new Error(t('--share repetido'));
        share = true;
      } else if (!token.quoted && !literal && token.v === '--share-file') {
        if (file !== null) throw new Error(t('--share-file repetido'));
        const next = tokens[++i];
        if (!next || next.t !== 'w' || !next.v || (!next.quoted && next.v.startsWith('--'))) {
          throw new Error(t('--share-file requiere una ruta: --share-file "archivo.txt"'));
        }
        if (!splitPath(next.v).length || isInternalPath(next.v)) throw new Error(t('archivo a compartir no permitido'));
        file = next.v;
      } else clean.push(token);
    }
    parsePipeline(clean);
    return { tokens: clean, command: clean.map((t) => raw.slice(t.start, t.end)).join(' '), share, file };
  }

  function parsePipeline(toks) {
    const segs = [];
    let cur = { argv: [], redirect: null };
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.t === 'w') { cur.argv.push(t.v); continue; }
      if (t.v === '|') {
        if (!cur.argv.length) throw new Error(t('pipe sin comando'));
        if (cur.redirect) throw new Error(t('la redirección solo puede ir en el último comando'));
        segs.push(cur);
        cur = { argv: [], redirect: null };
        continue;
      }
      const nx = toks[i + 1];
      if (!nx || nx.t !== 'w') throw new Error(t`falta fichero tras ${t.v}`);
      if (cur.redirect) throw new Error(t('solo una redirección por comando'));
      cur.redirect = { mode: t.v, file: nx.v };
      i++;
    }
    if (!cur.argv.length) throw new Error(t('comando vacío'));
    segs.push(cur);
    return segs;
  }

  function parseArgs(args, spec) {
    const flags = {}, pos = [];
    for (let k = 0; k < args.length; k++) {
      const a = args[k];
      if (a === '--') { pos.push(...args.slice(k + 1)); break; }
      if (a.length > 1 && a[0] === '-' && !/^-\d/.test(a)) {
        if (/^-[A-Za-z]{2,}$/.test(a) && [...a.slice(1)].every((c) => spec[c] === 'b')) {
          for (const c of a.slice(1)) flags[c] = true;
          continue;
        }
        const key = a.replace(/^-+/, '');
        if (!(key in spec)) throw new Error(t`opción desconocida: ${a}`);
        if (spec[key] === 'v') {
          if (k + 1 >= args.length) throw new Error(t`falta valor para ${a}`);
          flags[key] = args[++k];
        } else flags[key] = true;
      } else pos.push(a);
    }
    return { flags, pos };
  }

  // ============================================================
  // COMANDOS REGISTRADOS
  // ============================================================
  const REG = new Map();
  function def(name, group, usage, desc, run) {
    REG.set(name, {
      name, group,
      get usage() { return I18N[usage] || EXTRA_I18N[usage] ? t(usage) : usage; },
      get desc() { return I18N[desc] || EXTRA_I18N[desc] ? t(desc) : desc; }, run
    });
  }

  let lastResult = '';
  const panelHistory = [];
  const chatHistory = [];

  async function editorSnapshot(path) {
    if (isInternalPath(path)) throw new Error(t('no se editan metadatos internos'));
    const file = await (await requireFile(path)).getFile();
    if (file.size > CFG.MAX_RUN_BYTES) throw new Error(t('editor: máximo 256 KB'));
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.includes(0)) throw new Error(t('el editor requiere texto, no binarios'));
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch (e) { if (e.name === 'TypeError') throw new Error(t('el editor requiere UTF-8 válido')); throw e; }
    return { path, text, hash: await computeSha256(bytes) };
  }

  async function editorTarget(input) {
    const parts = splitPath(String(input ?? '').trim() || '.');
    if (!parts.length || isInternalPath(parts.join('/'))) throw new Error(t('ruta no permitida para el editor'));
    const path = parts.join('/');
    const handle = await getHandle(path);
    if (handle?.kind === 'directory') throw new Error(t`es una carpeta: ${path}`);
    if (handle) { await editorSnapshot(path); return { path, create: false }; }
    return { path, create: true };
  }

  async function newFileSnapshot(path) {
    const target = await editorTarget(path);
    if (!target.create) throw new Error(t`ya existe: ${target.path}; no se sobrescribió`);
    return { path: target.path, text: '', hash: null, isNew: true };
  }

  function replaceEditorText(text, search, replacement, all) {
    if (!search) throw new Error(t('escribe un texto para buscar'));
    const index = text.indexOf(search);
    if (index < 0) throw new Error(t('no se encontró el texto exacto'));
    if (!all) return { text: text.slice(0, index) + replacement + text.slice(index + search.length), count: 1 };
    const parts = text.split(search);
    return { text: parts.join(replacement), count: parts.length - 1 };
  }

  async function fileSnapshot(path) {
    const parts = splitPath(path);
    if (!parts.length || isInternalPath(path)) throw new Error(t('checkpoint: raíz y metadatos internos no permitidos'));
    path = parts.join('/');
    const file = await (await requireFile(path)).getFile();
    if (file.size > CFG.MAX_RUN_BYTES) throw new Error(t('checkpoint/restore: máximo 256 KB por archivo'));
    const bytes = new Uint8Array(await file.arrayBuffer());
    return { path, bytes, hash: await computeSha256(bytes) };
  }

  async function createCheckpoint(path, label = '') {
    const snapshot = await fileSnapshot(path);
    const id = crypto.randomUUID();
    const base = `.dv/checkpoints/${id}`;
    if (await getHandle(`${base}.bin`) || await getHandle(`${base}.json`)) throw new Error(t('checkpoint: ID ya existe; no se reemplazó la copia'));
    const metadata = {
      version: 1, id, path: snapshot.path, hash: snapshot.hash,
      size: snapshot.bytes.length, created: new Date().toISOString(), label
    };
    await writeBytes(`${base}.bin`, snapshot.bytes);
    const stored = await (await requireFile(`${base}.bin`)).getFile();
    if (stored.size !== metadata.size || await computeSha256(await stored.arrayBuffer()) !== metadata.hash) {
      throw new Error(t('checkpoint: copia no verificada; no se publicó el checkpoint'));
    }
    await writeBytes(`${base}.json`, JSON.stringify(metadata));
    await readCheckpoint(id);
    return metadata;
  }

  async function readCheckpoint(id) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) throw new Error(t('ID de checkpoint no válido'));
    const base = `.dv/checkpoints/${id}`;
    const manifest = await (await requireFile(`${base}.json`)).getFile();
    if (manifest.size > 8192) throw new Error(t('checkpoint: metadatos demasiado grandes'));
    const metadata = JSON.parse(await manifest.text());
    if (!metadata || metadata.version !== 1 || metadata.id !== id ||
      typeof metadata.path !== 'string' || !splitPath(metadata.path).length || isInternalPath(metadata.path) ||
      splitPath(metadata.path).join('/') !== metadata.path ||
      typeof metadata.hash !== 'string' || !/^[a-f0-9]{64}$/.test(metadata.hash) ||
      !Number.isInteger(metadata.size) || metadata.size < 0 || metadata.size > CFG.MAX_RUN_BYTES ||
      typeof metadata.created !== 'string' || !Number.isFinite(Date.parse(metadata.created)) ||
      typeof metadata.label !== 'string' || metadata.label.length > 200) throw new Error(t('checkpoint: metadatos no válidos'));
    const file = await (await requireFile(`${base}.bin`)).getFile();
    if (file.size !== metadata.size) throw new Error(t('checkpoint: tamaño de copia incorrecto'));
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (await computeSha256(bytes) !== metadata.hash) throw new Error(t('checkpoint: hash de copia incorrecto'));
    return { metadata, bytes };
  }

  async function checkpointInventory() {
    const directory = await getHandle('.dv/checkpoints');
    if (!directory) return [];
    if (directory.kind !== 'directory') throw new Error(t('checkpoint: almacenamiento no es una carpeta'));
    const records = [];
    for await (const [name, handle] of directory.entries()) {
      if (handle.kind !== 'file' || !name.endsWith('.json')) continue;
      records.push((await readCheckpoint(name.slice(0, -5))).metadata);
    }
    return records.sort((a, b) => Date.parse(b.created) - Date.parse(a.created) || a.id.localeCompare(b.id));
  }

  function checkpointText(bytes) {
    if (bytes.includes(0)) throw new Error(t('checkpoint: contenido binario; diff/content requieren texto UTF-8 sin NUL'));
    try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch (e) { if (e.name === 'TypeError') throw new Error(t('checkpoint: contenido no es UTF-8 válido')); throw e; }
  }

  async function deleteCheckpoints(records, selected) {
    if (!selected.length) return t('No hay checkpoints eliminables; se conserva la copia más reciente de cada archivo.');
    const signature = JSON.stringify(records);
    const preview = selected.map(m => `${m.id} | ${JSON.stringify(m.path)} | ${m.created}`).join('\n');
    if (!confirm(t`¿Borrar definitivamente ${selected.length} checkpoint(s)?\n${preview}\nNo hay deshacer. Se conserva la copia más reciente de cada archivo. Archivos actuales y Git no se modifican.`)) {
      throw new Error(t('borrado de checkpoints cancelado; copias intactas'));
    }
    if (JSON.stringify(await checkpointInventory()) !== signature) throw new Error(t('checkpoints cambiaron durante confirmación; no se borró nada'));
    let deleted = 0;
    try {
      for (const m of selected) {
        const base = `.dv/checkpoints/${m.id}`;
        await readCheckpoint(m.id);
        await removePath(`${base}.json`, false);
        await removePath(`${base}.bin`, false);
        if (await getHandle(`${base}.json`) || await getHandle(`${base}.bin`)) throw new Error(t`copia sigue existiendo: ${m.id}`);
        deleted++;
      }
    } catch (e) {
      throw new Error(t`limpieza detenida: ${deleted} checkpoint(s) eliminados; ${e.message}. No se revierten borrados; el ID en curso puede quedar incompleto.`);
    }
    return t`Eliminados y verificados: ${deleted} checkpoint(s). Últimas copias por archivo conservadas.`;
  }

  def('checkpoint', 'Sistema', 'checkpoint <archivo> [etiqueta] | --list [--file ruta] [--tag texto] | show ID [--content] | diff ID1 ID2 | delete ID | prune <--keep N|--older-than Nd>', 'Copias locales verificadas; limpieza confirmada protege últimas versiones', async (ctx) => {
    const { pos, flags } = parseArgs(ctx.args, { list: 'b', file: 'v', tag: 'v', content: 'b', keep: 'v', 'older-than': 'v' });
    const checkFlags = (allowed) => {
      if (Object.keys(flags).some(key => !allowed.includes(key))) throw new Error(t('opciones incompatibles para checkpoint'));
    };
    if (flags.list) {
      checkFlags(['list', 'file', 'tag']);
      if (pos.length) throw new Error(t('uso: checkpoint --list [--file ruta] [--tag texto]'));
      const path = flags.file === undefined ? null : splitPath(flags.file).join('/');
      if (path !== null && (!path || isInternalPath(path))) throw new Error(t('filtro de archivo no permitido'));
      return (await checkpointInventory()).filter(m =>
        (path === null || m.path === path) && (flags.tag === undefined || m.label.includes(flags.tag)))
        .map(m => `${m.id} | ${JSON.stringify(m.path)} | ${m.created} | ${m.size} B | ${JSON.stringify(m.label)}`)
        .join('\n') || t('No hay checkpoints para esos filtros.');
    }
    if (pos[0] === 'show') {
      checkFlags(['content']);
      if (pos.length !== 2) throw new Error(t('uso: checkpoint show ID [--content]'));
      const { metadata: m, bytes } = await readCheckpoint(pos[1]);
      if (flags.content) return checkpointText(bytes);
      return t`Checkpoint: ${m.id}\nArchivo: ${JSON.stringify(m.path)}\nFecha: ${m.created}\nEtiqueta: ${JSON.stringify(m.label)}\nBytes: ${m.size}\nSHA256: ${m.hash}`;
    }
    if (pos[0] === 'diff') {
      checkFlags([]);
      if (pos.length !== 3) throw new Error(t('uso: checkpoint diff ID1 ID2'));
      const a = await readCheckpoint(pos[1]), b = await readCheckpoint(pos[2]);
      const oldText = checkpointText(a.bytes), newText = checkpointText(b.bytes);
      if (a.metadata.hash === b.metadata.hash) return t('Sin diferencias de contenido.');
      const engine = await getDiff();
      const patch = engine.createTwoFilesPatch(`${a.metadata.id}:${a.metadata.path}`,
        `${b.metadata.id}:${b.metadata.path}`, oldText, newText, '', '', { context: 3, timeout: 2000 });
      if (patch === undefined) throw new Error(t('checkpoint diff excedió el tiempo límite'));
      return patch;
    }
    if (pos[0] === 'delete' || pos[0] === 'prune') {
      const deleting = pos[0] === 'delete';
      checkFlags(deleting ? [] : ['keep', 'older-than']);
      if (deleting ? pos.length !== 2 : pos.length !== 1 ||
        (flags.keep === undefined) === (flags['older-than'] === undefined)) {
        throw new Error(t('uso: checkpoint delete ID | checkpoint prune <--keep N|--older-than Nd>'));
      }
      const records = await checkpointInventory();
      const latest = new Map();
      for (const m of records) if (!latest.has(m.path)) latest.set(m.path, Date.parse(m.created));
      const protectedCopy = (m) => Date.parse(m.created) === latest.get(m.path);
      let selected;
      if (deleting) {
        const record = records.find(m => m.id === pos[1]);
        if (!record) throw new Error(t('checkpoint no existe en inventario'));
        if (protectedCopy(record)) throw new Error(t('no se borra el checkpoint más reciente de ese archivo (también se protegen empates de fecha)'));
        selected = [record];
      } else if (flags.keep !== undefined) {
        if (!/^[1-9]\d*$/.test(flags.keep) || !Number.isSafeInteger(Number(flags.keep))) throw new Error(t('--keep requiere entero positivo'));
        selected = records.slice(Number(flags.keep)).filter(m => !protectedCopy(m));
      } else {
        const match = /^([1-9]\d*)d$/.exec(flags['older-than']);
        const days = match ? Number(match[1]) : NaN;
        if (!Number.isSafeInteger(days) || !Number.isSafeInteger(days * 86400000)) throw new Error(t('--older-than requiere días enteros positivos, por ejemplo 7d'));
        const cutoff = Date.now() - days * 86400000;
        selected = records.filter(m => Date.parse(m.created) < cutoff && !protectedCopy(m));
      }
      return deleteCheckpoints(records, selected);
    }
    checkFlags([]);
    if (pos.length < 1 || pos.length > 2 || (pos[1] || '').length > 200) throw new Error(t('uso: checkpoint <archivo> [etiqueta hasta 200 caracteres]'));
    const m = await createCheckpoint(pos[0], pos[1] || '');
    return t`Checkpoint: ${m.id}\nArchivo: ${JSON.stringify(m.path)} (${m.size} B)\nSHA256: ${m.hash}\nRestaurar: ${settings.prefix}restore ${m.id}`;
  });

  def('restore', 'Sistema', 'restore <ID-checkpoint>', 'Restaura ruta original con aprobación y copia previa si existe', async (ctx) => {
    if (ctx.args.length !== 1) throw new Error(t('uso: restore <ID-checkpoint>'));
    if (editorOpen) throw new Error(t('cierra el editor actual antes de restaurar'));
    const { metadata, bytes } = await readCheckpoint(ctx.args[0]);
    const target = await getHandle(metadata.path);
    if (target?.kind === 'directory') throw new Error(t('restore: destino es una carpeta'));
    const current = target ? await fileSnapshot(metadata.path) : null;
    if (current?.hash === metadata.hash) return t('Sin cambios: el archivo ya coincide con el checkpoint.');
    let text = null, original = null;
    if (!bytes.includes(0) && current && !current.bytes.includes(0)) {
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
        text = decoder.decode(bytes);
        original = decoder.decode(current.bytes);
      } catch (e) { if (e.name !== 'TypeError') throw e; }
    }
    if (text !== null && original !== null) {
      ctx.openEditor({
        snapshot: { path: current.path, text: original, hash: current.hash },
        candidate: text, checkpointBeforeSave: true
      });
      return t`Restauración preparada: ${metadata.path}. Revisa el diff y confirma Aplicar; se creará checkpoint previo al guardar.`;
    }
    if (!confirm(t`¿Restaurar "${metadata.path}" desde checkpoint ${metadata.id} (${metadata.size} B)?\n${current ? t('Binario/no UTF-8: sin diff de texto. Se guardará checkpoint de la versión actual.') : t('Archivo ausente: se creará con los bytes guardados.')}\nSHA256: ${metadata.hash}`)) {
      throw new Error(t('restauración cancelada; archivo intacto'));
    }
    const fresh = await getHandle(metadata.path);
    if (current ? !fresh || (await fileSnapshot(metadata.path)).hash !== current.hash : fresh !== null) throw new Error(t('restore: destino cambió; no se sobrescribió'));
    let backup = null;
    if (current) {
      backup = await createCheckpoint(metadata.path, t`Antes de restore ${metadata.id}`);
      uiLog(t`Checkpoint previo: ${backup.id}`, 'info');
      if (backup.hash !== current.hash || (await fileSnapshot(metadata.path)).hash !== current.hash) throw new Error(t('restore: archivo cambió; copia previa conservada'));
    }
    await writeBytes(metadata.path, bytes);
    if ((await fileSnapshot(metadata.path)).hash !== metadata.hash) throw new Error(t`restore: verificación fallida; checkpoint original ${metadata.id}${backup ? t` y previo ${backup.id}` : ''} conservados`);
    return t`Restaurado y verificado: ${metadata.path}\nSHA256: ${metadata.hash}${backup ? t`\nCheckpoint previo: ${backup.id}` : ''}\nNo se hizo staging ni commit.`;
  });

  function validateEditorCandidate(snapshot, candidate) {
    if (candidate.includes('\0')) throw new Error(t('candidato requiere texto sin NUL'));
    if (new TextEncoder().encode(candidate).length > CFG.MAX_RUN_BYTES) throw new Error(t('candidato supera 256 KB'));
    if (candidate === snapshot.text) throw new Error(t('no hay cambios para guardar; propuesta no produce cambios'));
  }

  async function saveEditorCandidate(snapshot, candidate) {
    if (snapshot.isNew) {
      if (!candidate) throw new Error(t('escribe o pega contenido antes de crear el archivo'));
      validateEditorCandidate(snapshot, candidate);
      await atomicWrite(snapshot.path, candidate, { mustNotExist: true });
      return editorSnapshot(snapshot.path);
    }
    validateEditorCandidate(snapshot, candidate);
    const current = await editorSnapshot(snapshot.path);
    if (current.hash !== snapshot.hash) throw new Error(t('el archivo cambió desde que abriste el editor; no se sobrescribió. Conserva tu borrador y vuelve a abrirlo'));
    if (snapshot.checkpointBeforeSave) {
      const backup = await createCheckpoint(snapshot.path, snapshot.checkpointLabel || t('Antes de restore desde editor'));
      uiLog(t`Checkpoint previo: ${backup.id}`, 'info');
      if (backup.hash !== snapshot.hash || (await editorSnapshot(snapshot.path)).hash !== snapshot.hash) throw new Error(t('archivo cambió; checkpoint previo conservado, no se sobrescribió'));
    }
    await atomicWrite(snapshot.path, candidate, { expectedHash: snapshot.hash });
    return editorSnapshot(snapshot.path);
  }

  function validateProposalValue(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(t('propuesta debe ser un objeto JSON'));
    const allowed = ['path', 'hash', 'operation', 'old', 'new'];
    if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error(t('campos desconocidos en propuesta'));
    if (typeof value.path !== 'string' || typeof value.hash !== 'string' || !/^[a-f0-9]{64}$/.test(value.hash)) {
      throw new Error(t('propuesta requiere path y hash SHA256 completo en minúsculas'));
    }
    if (!['replace', 'insert-before', 'insert-after', 'append'].includes(value.operation) ||
      typeof value.new !== 'string' || value.new.includes('\0')) throw new Error(t('operation/new no válidos'));
    const parts = splitPath(value.path);
    if (!parts.length || isInternalPath(value.path)) throw new Error(t('ruta de propuesta no permitida'));
    if (value.operation === 'append') {
      if ('old' in value) throw new Error(t('append no admite old'));
    } else if (typeof value.old !== 'string' || !value.old) throw new Error(t('old debe ser un bloque exacto no vacío'));
    return value;
  }

  async function prepareProposal(value) {
    validateProposalValue(value);
    const snapshot = await editorSnapshot(value.path);
    if (snapshot.hash !== value.hash) throw new Error(t('hash obsoleto; usa view y solicita una propuesta para la versión actual'));
    let candidate;
    if (value.operation === 'append') {
      if ('old' in value) throw new Error(t('append no admite old'));
      candidate = snapshot.text + value.new;
    } else {
      if (typeof value.old !== 'string' || !value.old) throw new Error(t('old debe ser un bloque exacto no vacío'));
      const index = snapshot.text.indexOf(value.old);
      if (index < 0) throw new Error(t('bloque old no encontrado; no se modifica el archivo'));
      if (snapshot.text.indexOf(value.old, index + 1) >= 0) throw new Error(t('bloque old ambiguo; debe coincidir una sola vez'));
      const replacement = value.operation === 'replace' ? value.new :
        value.operation === 'insert-before' ? value.new + value.old : value.old + value.new;
      candidate = snapshot.text.slice(0, index) + replacement + snapshot.text.slice(index + value.old.length);
    }
    validateEditorCandidate(snapshot, candidate);
    return { snapshot, candidate };
  }

  def('view', 'Texto', 'view <archivo> [--from N] [--to N]', 'Código numerado y hash para propuestas de IA', async (ctx) => {
    const { pos, flags } = parseArgs(ctx.args, { from: 'v', to: 'v' });
    if (pos.length !== 1) throw new Error(t('uso: view <archivo> [--from N] [--to N]'));
    const snapshot = await editorSnapshot(pos[0]);
    const rows = snapshot.text.replace(/\r\n?/g, '\n').split('\n');
    const from = toInt(flags.from, 1, '--from'), to = toInt(flags.to, rows.length, '--to');
    if (from < 1 || to < from || from > rows.length || to > rows.length) throw new Error(t('rango de líneas no válido'));
    return t`Archivo: ${JSON.stringify(snapshot.path)}\nSHA256: ${snapshot.hash}\nLíneas ${from}-${to} de ${rows.length}; números solo referencia, no forman parte del código.\n` +
      rows.slice(from - 1, to).map((line, i) => `${String(from + i).padStart(5)} | ${line}`).join('\n');
  });

  def('propose', 'Sistema', 'propose <propuesta.json|JSON entre comillas>', 'Prepara cambio con hash; abre editor para revisar/aprobar', async (ctx) => {
    if (ctx.args.length !== 1) throw new Error(t('uso: propose <propuesta.json|JSON entre comillas>'));
    if (editorOpen) throw new Error(t('cierra el editor actual antes de proponer otro cambio'));
    const input = ctx.args[0].trim();
    const json = input.startsWith('{') ? input : (await editorSnapshot(input)).text;
    let value;
    try { value = JSON.parse(json); }
    catch (e) { throw new Error(t`JSON de propuesta no válido: ${e.message}`); }
    const proposal = await prepareProposal(value);
    ctx.openEditor(proposal);
    return t`Propuesta preparada: ${proposal.snapshot.path}. Archivo intacto; revisa el diff y confirma Aplicar.`;
  });

  def('replace', 'Texto', 'replace <archivo> <old> <new> [--all] [--hash SHA256] [--dry-run]', 'Reemplazo literal con contador, diff y aprobación; nunca guarda directamente', async (ctx) => {
    const { pos, flags } = parseArgs(ctx.args, { all: 'b', hash: 'v', 'dry-run': 'b' });
    if (pos.length !== 3) throw new Error(t('uso: replace <archivo> <old> <new> [--all] [--hash SHA256] [--dry-run]'));
    if (editorOpen) throw new Error(t('cierra el editor actual antes de proponer otro cambio'));
    const snapshot = await editorSnapshot(pos[0]);
    const hash = flags.hash === undefined ? snapshot.hash : flags.hash;
    let proposal, count;
    if (flags.all) {
      if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(t('hash SHA256 completo en minúsculas requerido'));
      if (hash !== snapshot.hash) throw new Error(t('hash obsoleto; usa view para la versión actual'));
      const result = replaceEditorText(snapshot.text, pos[1], pos[2], true);
      validateEditorCandidate(snapshot, result.text);
      proposal = { snapshot, candidate: result.text };
      count = result.count;
    } else {
      proposal = await prepareProposal({ path: snapshot.path, hash, operation: 'replace', old: pos[1], new: pos[2] });
      count = 1;
    }
    ctx.openEditor(proposal);
    return t`${count} sustitución(es) propuesta(s): ${snapshot.path}. Archivo intacto (dry-run); revisa el diff y confirma Aplicar.`;
  });

  // ============================================================
  // Editor de código: utilidades puras (resaltado, líneas, búsqueda)
  // ============================================================
  const EDITOR_LANGS = {
    js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'js', tsx: 'js', json: 'json', css: 'css',
    html: 'html', htm: 'html', svg: 'html', xml: 'html', vue: 'html', py: 'py',
    sh: 'sh', bash: 'sh', yml: 'sh', yaml: 'sh', toml: 'sh', ini: 'sh', md: 'md', markdown: 'md'
  };
  const EDITOR_LANG_NAMES = { js: 'JavaScript', json: 'JSON', css: 'CSS', html: 'HTML', py: 'Python', sh: 'Shell/YAML', md: 'Markdown' };
  const VOID_TAGS = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
  const EDITOR_PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };

  function editorLanguage(path) {
    const ext = /\.([^./]+)$/.exec(String(path).toLowerCase())?.[1] || '';
    return EDITOR_LANGS[ext] || 'text';
  }

  function lexRules(rules, flags = 'g') {
    return { re: new RegExp(rules.map(([, src]) => `(${src})`).join('|'), flags), types: rules.map(([type]) => type) };
  }

  function lexInto(lexer, text, out) {
    const { re, types } = lexer;
    const state = { depth: 0 };
    re.lastIndex = 0;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (!m[0]) { re.lastIndex++; continue; }
      if (m.index > last) out.push(['', text.slice(last, m.index)]);
      let i = 1;
      while (m[i] === undefined) i++;
      let type = types[i - 1];
      if (typeof type === 'function') type = type(m[0], text, re.lastIndex, state);
      out.push([type, m[0]]);
      last = re.lastIndex;
    }
    if (last < text.length) out.push(['', text.slice(last)]);
    return out;
  }

  const wordType = (keywords, literals) => {
    const kw = new Set(keywords.split(' ')), lit = new Set(literals.split(' '));
    return (word, text, end) => kw.has(word) ? 'keyword' : lit.has(word) ? 'literal' :
      /^\s*\(/.test(text.slice(end, end + 40)) ? 'func' : /^[A-Z][a-z]/.test(word) ? 'type' : '';
  };
  const EDITOR_STRING = String.raw`"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?`;
  const EDITOR_NUMBER = String.raw`\b(?:0[xXbBoO][\da-fA-F_]+n?|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?n?)\b`;
  const LEXERS = {};
  LEXERS.js = lexRules([
    ['comment', String.raw`\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)`],
    [(value, text, end) => /^\s*:/.test(text.slice(end, end + 30)) ? 'prop' : 'string',
    EDITOR_STRING + '|' + String.raw`\`(?:[^\`\\]|\\[\s\S])*\`?`],
    ['number', EDITOR_NUMBER],
    [wordType('break case catch class const continue debugger default delete do else export extends finally for from ' +
      'function if import in instanceof let new of return static super switch throw try typeof var void while with yield ' +
      'async await get set as interface type enum implements private public protected readonly declare namespace',
      'true false null undefined NaN Infinity this'), String.raw`[A-Za-z_$][\w$]*`]
  ]);
  LEXERS.json = LEXERS.js;
  LEXERS.css = lexRules([
    ['comment', String.raw`\/\*[\s\S]*?(?:\*\/|$)`],
    ['string', EDITOR_STRING],
    [(value, text, end, state) => { state.depth = Math.max(0, state.depth + (value === '{' ? 1 : -1)); return ''; }, '[{}]'],
    ['keyword', String.raw`@[\w-]+|!important\b`],
    [(value, text, end, state) => value[0] === '#' && !state.depth ? 'tag' : 'number',
    String.raw`#[\da-fA-F]{3,8}\b|-?(?:\d+\.?\d*|\.\d+)(?:%|[a-zA-Z]+)?`],
    [(value, text, end, state) => !state.depth ? 'tag' : /^\s*:/.test(text.slice(end, end + 30)) ? 'prop' : '',
    String.raw`[A-Za-z_-][\w-]*`]
  ]);
  LEXERS.py = lexRules([
    ['comment', '#[^\\n]*'],
    ['string', String.raw`[rRbBfFuU]{0,2}(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)`],
    ['func', String.raw`@[\w.]+`],
    ['number', EDITOR_NUMBER],
    [wordType('and as assert async await break class continue def del elif else except finally for from global if ' +
      'import in is lambda nonlocal not or pass raise return try while with yield match case', 'True False None self cls'),
    String.raw`[A-Za-z_]\w*`]
  ]);
  LEXERS.sh = lexRules([
    ['comment', String.raw`(?<![^\s;|&(])#[^\n]*`],
    ['string', EDITOR_STRING],
    ['prop', String.raw`\$(?:\{[^}\n]*\}?|[\w@#?*!$-]+)`],
    ['number', EDITOR_NUMBER],
    [wordType('if then else elif fi for while until do done case esac function in return export local readonly ' +
      'echo exit source set unset shift', 'true false null'), String.raw`[A-Za-z_][\w-]*`]
  ]);
  LEXERS.md = lexRules([
    ['string', String.raw`\`\`\`[\s\S]*?(?:\`\`\`|(?![\s\S]))`],
    ['keyword', String.raw`^#{1,6}[ \t][^\n]*`],
    ['string', String.raw`\`[^\`\n]+\``],
    ['func', String.raw`!?\[[^\]\n]*\]\([^)\n]*\)`],
    ['keyword', String.raw`\*\*[^*\n]+\*\*|__[^_\n]+__`],
    ['number', String.raw`^[ \t]*(?:[-*+]|\d+\.)(?=[ \t])`],
    ['comment', String.raw`^>[^\n]*`]
  ], 'gm');

  function lexHTML(text, out) {
    const re = /<!--[\s\S]*?(?:-->|$)|<![A-Za-z][^>]*>?|<\/?[A-Za-z][\w:.-]*|&#?\w+;/g;
    const attr = /\s+|\/?>|[^\s=>/"'<]+|=|"[^"]*"?|'[^']*'?|[\s\S]/y;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(['', text.slice(last, m.index)]);
      const value = m[0];
      last = re.lastIndex;
      if (value.startsWith('<!--')) { out.push(['comment', value]); continue; }
      if (value.startsWith('<!')) { out.push(['keyword', value]); continue; }
      if (value[0] === '&') { out.push(['number', value]); continue; }
      out.push(['tag', value]);
      attr.lastIndex = last;
      let closed = false, part;
      while ((part = attr.exec(text))) {
        const s = part[0];
        if (s === '>' || s === '/>') { out.push(['tag', s]); closed = true; break; }
        if (s === '<') { attr.lastIndex--; break; }
        out.push([/^\s+$/.test(s) || s === '=' || s === '/' ? '' : s[0] === '"' || s[0] === "'" ? 'string' : 'attr', s]);
      }
      last = part ? attr.lastIndex : text.length;
      re.lastIndex = last;
      const name = value.slice(1).toLowerCase();
      if (closed && (name === 'script' || name === 'style')) {
        const close = new RegExp(`</${name}`, 'gi');
        close.lastIndex = last;
        const found = close.exec(text);
        const stop = found ? found.index : text.length;
        if (stop > last) lexInto(name === 'script' ? LEXERS.js : LEXERS.css, text.slice(last, stop), out);
        last = stop; re.lastIndex = stop;
      }
    }
    if (last < text.length) out.push(['', text.slice(last)]);
    return out;
  }

  function highlightTokens(text, lang) {
    const out = [];
    if (lang === 'html') lexHTML(text, out);
    else if (LEXERS[lang]) lexInto(LEXERS[lang], text, out);
    else if (text) out.push(['', text]);
    return out;
  }

  function countLines(text) {
    let lines = 1, i = -1;
    while ((i = text.indexOf('\n', i + 1)) !== -1) lines++;
    return lines;
  }

  function editorLineRange(text, start, end) {
    const lineStart = start > 0 ? text.lastIndexOf('\n', start - 1) + 1 : 0;
    const stop = end > start && text[end - 1] === '\n' ? end - 1 : end;
    let lineEnd = text.indexOf('\n', stop);
    if (lineEnd < 0) lineEnd = text.length;
    return { lineStart, lineEnd };
  }

  function editorLineOffset(text, line) {
    let pos = 0;
    for (let i = 1; i < line; i++) {
      const next = text.indexOf('\n', pos);
      if (next < 0) break;
      pos = next + 1;
    }
    return pos;
  }

  function moveEditorLines(text, start, end, direction) {
    const { lineStart, lineEnd } = editorLineRange(text, start, end);
    const block = text.slice(lineStart, lineEnd);
    if (direction < 0) {
      if (lineStart === 0) return null;
      const prevStart = lineStart > 1 ? text.lastIndexOf('\n', lineStart - 2) + 1 : 0;
      const prev = text.slice(prevStart, lineStart - 1);
      const shift = prev.length + 1;
      return { from: prevStart, to: lineEnd, text: block + '\n' + prev, selStart: start - shift, selEnd: end - shift };
    }
    if (lineEnd >= text.length) return null;
    let nextEnd = text.indexOf('\n', lineEnd + 1);
    if (nextEnd < 0) nextEnd = text.length;
    const next = text.slice(lineEnd + 1, nextEnd);
    const shift = next.length + 1;
    return { from: lineStart, to: nextEnd, text: next + '\n' + block, selStart: start + shift, selEnd: end + shift };
  }

  function duplicateEditorLines(text, start, end, direction) {
    const { lineStart, lineEnd } = editorLineRange(text, start, end);
    const block = text.slice(lineStart, lineEnd);
    const shift = direction > 0 ? block.length + 1 : 0;
    return { from: lineEnd, to: lineEnd, text: '\n' + block, selStart: start + shift, selEnd: end + shift };
  }

  function deleteEditorLines(text, start, end) {
    const { lineStart, lineEnd } = editorLineRange(text, start, end);
    if (lineEnd < text.length) return { from: lineStart, to: lineEnd + 1, text: '', selStart: lineStart, selEnd: lineStart };
    const from = Math.max(0, lineStart - 1);
    const caret = from > 0 ? text.lastIndexOf('\n', from - 1) + 1 : 0;
    return { from, to: lineEnd, text: '', selStart: caret, selEnd: caret };
  }

  function indentEditorLines(text, start, end, outdent, unit = '  ') {
    const { lineStart, lineEnd } = editorLineRange(text, start, end);
    const lines = text.slice(lineStart, lineEnd).split('\n');
    let first = 0, total = 0;
    const next = lines.map((line, i) => {
      let delta = 0;
      if (outdent) {
        const lead = /^(?: {1,2}|\t)/.exec(line);
        if (lead) { delta = -lead[0].length; line = line.slice(lead[0].length); }
      } else if (line || lines.length === 1) { delta = unit.length; line = unit + line; }
      if (i === 0) first = delta;
      total += delta;
      return line;
    }).join('\n');
    return {
      from: lineStart, to: lineEnd, text: next,
      selStart: Math.max(lineStart, start + first), selEnd: Math.max(lineStart, end + total)
    };
  }

  function editorCommentStyle(text, pos, lang) {
    if (lang === 'html') {
      const before = text.slice(0, pos).toLowerCase();
      for (const [tag, style] of [['script', ['//']], ['style', ['/*', '*/']]]) {
        const open = before.lastIndexOf('<' + tag);
        if (open >= 0 && open > before.lastIndexOf('</' + tag)) return style;
      }
      return ['<!--', '-->'];
    }
    if (lang === 'css') return ['/*', '*/'];
    if (lang === 'md') return ['<!--', '-->'];
    if (lang === 'py' || lang === 'sh') return ['#'];
    if (lang === 'js') return ['//'];
    return null;
  }

  function toggleEditorComment(text, start, end, lang) {
    const style = editorCommentStyle(text, start, lang);
    if (!style) return null;
    const { lineStart, lineEnd } = editorLineRange(text, start, end);
    const block = text.slice(lineStart, lineEnd);
    let next;
    if (style.length === 2) {
      const [open, close] = style;
      const lead = /^\s*/.exec(block)[0];
      const body = block.slice(lead.length);
      const trailing = /\s*$/.exec(body)[0];
      const core = body.slice(0, body.length - trailing.length);
      if (!core) return null;
      if (core.startsWith(open) && core.endsWith(close) && core.length >= open.length + close.length) {
        let inner = core.slice(open.length, core.length - close.length);
        if (inner.startsWith(' ')) inner = inner.slice(1);
        if (inner.endsWith(' ')) inner = inner.slice(0, -1);
        next = lead + inner + trailing;
      } else next = `${lead}${open} ${core} ${close}${trailing}`;
    } else {
      const token = style[0];
      const lines = block.split('\n');
      const filled = lines.filter((line) => line.trim());
      if (!filled.length) return null;
      const commented = filled.every((line) => line.trimStart().startsWith(token));
      const indent = Math.min(...filled.map((line) => /^[ \t]*/.exec(line)[0].length));
      next = lines.map((line) => {
        if (!line.trim()) return line;
        if (commented) {
          const i = line.indexOf(token);
          return line.slice(0, i) + line.slice(i + token.length + (line[i + token.length] === ' ' ? 1 : 0));
        }
        return line.slice(0, indent) + token + ' ' + line.slice(indent);
      }).join('\n');
    }
    if (start === end) {
      const caret = Math.max(lineStart, Math.min(start + next.length - block.length, lineStart + next.length));
      return { from: lineStart, to: lineEnd, text: next, selStart: caret, selEnd: caret };
    }
    return { from: lineStart, to: lineEnd, text: next, selStart: lineStart, selEnd: lineStart + next.length };
  }

  function editorClosingTag(before, after = '') {
    const m = /<([A-Za-z][\w:.-]*)(?:\s(?:[^<>"']|"[^"]*"|'[^']*')*)?$/.exec(before);
    if (!m || before.endsWith('/') || VOID_TAGS.has(m[1].toLowerCase())) return '';
    const close = `</${m[1]}>`;
    return after.startsWith(close) ? '' : close;
  }

  function editorSearchRegex(query, { caseSensitive = false, regex = false } = {}, flags = 'g') {
    const source = regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try { return new RegExp(source, flags + (caseSensitive ? '' : 'i') + 'm'); }
    catch (e) { throw new Error(t`expresión regular no válida: ${e.message}`); }
  }

  function findEditorMatches(text, query, options = {}, limit = 10000) {
    if (!query) return [];
    const re = editorSearchRegex(query, options);
    const out = [];
    let m;
    while (out.length < limit && (m = re.exec(text))) {
      if (!m[0]) { re.lastIndex++; continue; }
      out.push([m.index, m.index + m[0].length]);
    }
    return out;
  }

  function replaceEditorMatches(text, query, replacement, options = {}, at = null) {
    const matches = findEditorMatches(text, query, options, Infinity);
    if (!matches.length) return { text, count: 0 };
    if (at === null) {
      const re = editorSearchRegex(query, options);
      return { text: options.regex ? text.replace(re, replacement) : text.replace(re, () => replacement), count: matches.length };
    }
    const [from, to] = matches.find(([a]) => a >= at) || matches[0];
    let insert = replacement;
    if (options.regex) {
      const re = editorSearchRegex(query, options, 'y');
      re.lastIndex = from;
      const next = text.replace(re, replacement);
      insert = next.slice(from, next.length - (text.length - to));
    }
    return { text: text.slice(0, from) + insert + text.slice(to), count: 1, from, to, insert };
  }

  function editorVisualColumn(line, tabSize = 2) {
    let col = 0;
    for (const ch of line) col = ch === '\t' ? col + tabSize - (col % tabSize) : col + 1;
    return col;
  }

  // ============================================================
  // Editor de código integrado
  // ============================================================
  let editorOpen = false;
  const EDITOR_FONT_KEY = 'dv-editor-font-v1';
  const EDITOR_HIGHLIGHT_LIMIT = 60000;
  async function openCodeEditor(path, proposal = null, { create = false } = {}) {
    if (busy || editorOpen) { uiLog(t('Ya hay una operación o editor abierto.'), 'err'); return false; }
    editorOpen = true;
    ui?.updateState?.();
    let release;
    try {
      let snapshot = create && !proposal ? await newFileSnapshot(path) : await editorSnapshot(path);
      path = snapshot.path;
      if (proposal && snapshot.hash !== proposal.snapshot.hash) throw new Error(t('archivo cambió antes de abrir la propuesta; usa view de nuevo'));
      if (proposal?.checkpointBeforeSave) snapshot.checkpointBeforeSave = true;
      if (proposal?.checkpointLabel) snapshot.checkpointLabel = proposal.checkpointLabel;
      const closeAfterSave = !!proposal;
      const lang = editorLanguage(path);
      const langName = EDITOR_LANG_NAMES[lang] || t('Texto plano');
      const isHTML = /\.html?$/i.test(path);
      const host = h('div', { id: 'dv-code-editor' });
      const shadow = host.attachShadow({ mode: 'closed' });
      let saving = false, approvedCandidate = null, minimized = false, maximized = false;
      let floatingRect = null, drag = null;
      let fitEditor = () => {};
      const timers = new Set();
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
      const debounce = (fn, ms) => {
        let id = null;
        return () => { if (id !== null) { clearTimeout(id); timers.delete(id); } id = later(() => { id = null; fn(); }, ms); };
      };

      const status = h('span', { class: 'status', role: 'status' });
      const report = (text, error = false) => { status.textContent = text; status.style.color = error ? '#f87171' : '#93c5fd'; };
      const position = h('span', { class: 'pos' });
      const info = h('span', { class: 'info' });
      const dirtyMark = h('span', { class: 'dirty', title: t('Cambios sin guardar') }, '●');
      const title = h('span', {}, snapshot.isNew ? t`Nuevo archivo · ${path}` : t`Editor local · ${path}`);
      const gutter = h('pre', { class: 'gutter', 'aria-hidden': 'true' });
      const hl = h('pre', { class: 'hl', 'aria-hidden': 'true' });
      const hit = h('div', { class: 'hit' });
      const code = h('textarea', { class: 'code', spellcheck: 'false', wrap: 'off', autocapitalize: 'off', autocomplete: 'off', 'aria-label': t`Código de ${path}` });
      const source = h('div', { class: 'source' });
      let baseline = snapshot.text.replace(/\r\n?/g, '\n');
      code.value = (proposal ? proposal.candidate : snapshot.text).replace(/\r\n?/g, '\n');
      const initialDraft = code.value;
      let activeProposal = proposal;
      const candidate = () => activeProposal && code.value === initialDraft ? activeProposal.candidate :
        code.value === baseline ? snapshot.text :
          snapshot.text.includes('\r\n') && !snapshot.text.replace(/\r\n/g, '').includes('\n')
            ? code.value.replace(/\n/g, '\r\n') : code.value;
      const isDirty = () => candidate() !== snapshot.text;
      const diff = h('pre', { class: 'diff', 'aria-label': t('Diferencias propuestas') });
      diff.style.display = 'none';
      const saveLabel = () => snapshot.isNew ? t('Crear archivo') : activeProposal ? t('Aplicar cambios') : '💾 ' + t('Guardar');
      const canSave = () => snapshot.isNew ? !!code.value : isDirty();
      const apply = h('button', { class: 'primary', disabled: !canSave() }, saveLabel());

      let fontSize = 13;
      try { fontSize = Math.min(24, Math.max(10, Number(localStorage.getItem(EDITOR_FONT_KEY)) || 13)); } catch { /* sin almacenamiento */ }
      const lineHeight = () => Math.round(fontSize * 1.54);
      let charWidth = fontSize * 0.6;
      const measure = () => {
        charWidth = fontSize * 0.6;
        try {
          const ctx = document.createElement('canvas').getContext?.('2d');
          if (ctx) { ctx.font = `${fontSize}px Consolas, "Cascadia Mono", "Courier New", monospace`; charWidth = ctx.measureText('M'.repeat(20)).width / 20 || charWidth; }
        } catch { /* medida aproximada */ }
      };
      const applyFont = () => {
        for (const el of [gutter, hl, code]) { el.style.fontSize = fontSize + 'px'; el.style.lineHeight = lineHeight() + 'px'; }
        measure();
      };

      let hitRange = null;
      const placeHit = () => {
        if (!hitRange) { hit.remove(); return; }
        const [a, b] = hitRange, value = code.value;
        const lineStart = a > 0 ? value.lastIndexOf('\n', a - 1) + 1 : 0;
        const line = countLines(value.slice(0, a));
        const col = editorVisualColumn(value.slice(lineStart, a));
        const width = Math.max(1, editorVisualColumn(value.slice(lineStart, b).split('\n')[0]) - col);
        hit.style.top = (10 + (line - 1) * lineHeight()) + 'px';
        hit.style.left = (12 + col * charWidth) + 'px';
        hit.style.width = (width * charWidth) + 'px';
        hit.style.height = lineHeight() + 'px';
        hl.append(hit);
      };
      const paint = () => {
        const value = code.value;
        const highlighted = lang !== 'text' && value.length <= EDITOR_HIGHLIGHT_LIMIT;
        source.classList.toggle('plain', !highlighted);
        const nodes = [];
        if (highlighted) {
          for (const [type, text] of highlightTokens(value, lang)) {
            if (!type) { nodes.push(document.createTextNode(text)); continue; }
            const span = document.createElement('span');
            span.className = 't-' + type;
            span.textContent = text;
            nodes.push(span);
          }
          nodes.push(document.createTextNode('\n '));
        }
        if (typeof document.createDocumentFragment === 'function') {
          const fragment = document.createDocumentFragment();
          for (const node of nodes) fragment.appendChild(node);
          hl.replaceChildren(fragment);
        } else hl.replaceChildren(...nodes);
        placeHit();
      };

      const mini = h('pre', { class: 'mini-text' });
      const miniView = h('div', { class: 'mini-view' });
      const minimap = h('div', { class: 'minimap', 'aria-hidden': 'true' }, mini, miniView);
      const MINI_LH = 3;
      let miniOffset = 0, miniDrag = false, gutterLines = 0;
      const updateMiniView = () => {
        const contentH = gutterLines * MINI_LH, mapH = minimap.clientHeight || 0;
        const maxScroll = Math.max(1, (code.scrollHeight || 0) - (code.clientHeight || 0));
        miniOffset = contentH > mapH ? (contentH - mapH) * Math.min(1, (code.scrollTop || 0) / maxScroll) : 0;
        const scale = MINI_LH / lineHeight();
        mini.style.transform = `translateY(${-miniOffset}px)`;
        miniView.style.top = ((code.scrollTop || 0) * scale - miniOffset) + 'px';
        miniView.style.height = Math.max(12, (code.clientHeight || 0) * scale) + 'px';
      };
      const updateMini = debounce(() => {
        mini.textContent = code.value.split('\n', 5000).map((line) => line.slice(0, 160)).join('\n');
        updateMiniView();
      }, 300);
      const miniJump = (e) => {
        const rect = minimap.getBoundingClientRect?.();
        if (!rect) return;
        const y = e.clientY - rect.top + miniOffset;
        code.scrollTop = Math.max(0, (y / MINI_LH) * lineHeight() - (code.clientHeight || 0) / 2);
        syncScroll();
      };
      minimap.addEventListener('pointerdown', (e) => { e.preventDefault(); miniDrag = true; minimap.setPointerCapture?.(e.pointerId); miniJump(e); });
      minimap.addEventListener('pointermove', (e) => { if (miniDrag) miniJump(e); });
      minimap.addEventListener('pointerup', () => { miniDrag = false; });

      const syncScroll = () => {
        gutter.scrollTop = code.scrollTop; hl.scrollTop = code.scrollTop; hl.scrollLeft = code.scrollLeft;
        updateMiniView();
      };
      const updatePosition = () => {
        const value = code.value, s = code.selectionStart ?? 0, e = code.selectionEnd ?? s;
        const lineStart = s > 0 ? value.lastIndexOf('\n', s - 1) + 1 : 0;
        position.textContent = t`Ln ${countLines(value.slice(0, s))}, Col ${s - lineStart + 1}` + (e > s ? t` (${e - s} seleccionados)` : '');
      };
      const updateInfo = debounce(() => {
        const text = candidate();
        info.textContent = t`${countLines(code.value)} líneas · ${fmtBytes(new TextEncoder().encode(text).length)} · ${langName} · ${text.includes('\r\n') ? 'CRLF' : 'LF'} · UTF-8`;
      }, 150);
      const markDirty = () => { dirtyMark.style.visibility = isDirty() ? 'visible' : 'hidden'; };

      let findOpen = false, gotoOpen = false, helpOpen = false, liveOpen = false;
      const findOptions = { caseSensitive: false, regex: false };
      let matches = [];
      const findInput = h('input', { class: 'find-q', type: 'text', spellcheck: 'false', placeholder: t('Buscar'), 'aria-label': t('Buscar') });
      const replaceInput = h('input', { class: 'find-r', type: 'text', spellcheck: 'false', placeholder: t('Reemplazar'), 'aria-label': t('Reemplazar por') });
      const countBadge = h('span', { class: 'count' });
      const runFind = () => {
        try {
          matches = findEditorMatches(code.value, findInput.value, findOptions);
          findInput.classList.toggle('bad', false);
        } catch (e) {
          matches = []; findInput.classList.toggle('bad', true);
          countBadge.textContent = t('regex no válida');
          return false;
        }
        countBadge.textContent = !findInput.value ? '' : matches.length ? t`${matches.length >= 10000 ? '10000+' : matches.length} resultados` : t('Sin resultados');
        return true;
      };
      const scheduleFind = debounce(() => { if (findOpen) runFind(); }, 200);
      const reveal = (a, b, focus = true) => {
        if (focus) code.focus?.();
        code.setSelectionRange?.(a, b);
        const value = code.value, lh = lineHeight();
        const top = (countLines(value.slice(0, a)) - 1) * lh;
        const viewH = code.clientHeight || 400;
        if (top < code.scrollTop || top > code.scrollTop + viewH - 2 * lh) code.scrollTop = Math.max(0, top - viewH / 3);
        const lineStart = a > 0 ? value.lastIndexOf('\n', a - 1) + 1 : 0;
        const x = editorVisualColumn(value.slice(lineStart, a)) * charWidth;
        const viewW = code.clientWidth || 600;
        if (x < code.scrollLeft || x > code.scrollLeft + viewW - 60) code.scrollLeft = Math.max(0, x - 80);
        syncScroll(); updatePosition();
      };
      const step = (direction) => {
        if (!runFind()) return;
        if (!matches.length) { hitRange = null; placeHit(); report(findInput.value ? t('Sin coincidencias.') : t('Escribe un texto para buscar.'), true); return; }
        const s = code.selectionStart ?? 0, e = code.selectionEnd ?? s;
        let index;
        if (direction > 0) {
          index = matches.findIndex(([a]) => a > s || (a === s && s === e));
          if (index < 0) index = 0;
        } else {
          index = -1;
          for (let i = matches.length - 1; i >= 0; i--) if (matches[i][0] < s) { index = i; break; }
          if (index < 0) index = matches.length - 1;
        }
        const [a, b] = matches[index];
        countBadge.textContent = `${index + 1}/${matches.length >= 10000 ? '10000+' : matches.length}`;
        hitRange = [a, b]; placeHit();
        reveal(a, b, false);
        report(t`Coincidencia en línea ${countLines(code.value.slice(0, a))}`);
      };

      const edit = (from, to, text, selStart = from + text.length, selEnd = selStart) => {
        if (code.readOnly || saving) return false;
        const expected = code.value.slice(0, from) + text + code.value.slice(to);
        let native = false;
        if (from !== to || text) {
          code.focus?.();
          code.setSelectionRange?.(from, to);
          try { native = !!document.execCommand?.(text ? 'insertText' : 'delete', false, text); } catch { native = false; }
        }
        if (!native || code.value !== expected) { code.value = expected; sync(); }
        code.setSelectionRange?.(selStart, selEnd);
        updatePosition();
        return true;
      };
      const applyOp = (op) => op ? edit(op.from, op.to, op.text, op.selStart, op.selEnd) : false;

      const replaceOne = () => {
        try {
          const result = replaceEditorMatches(code.value, findInput.value, replaceInput.value, findOptions, code.selectionStart ?? 0);
          if (!result.count) { report(t('Sin coincidencias.'), true); return; }
          edit(result.from, result.to, result.insert);
          report(t`1 reemplazo en línea ${countLines(code.value.slice(0, result.from))}. Revisa el diff.`);
          step(1);
        } catch (e) { report(e.message, true); }
      };
      const replaceAll = () => {
        try {
          const result = replaceEditorMatches(code.value, findInput.value, replaceInput.value, findOptions);
          if (!result.count) { report(t('Sin coincidencias.'), true); return; }
          const caret = Math.min(code.selectionStart ?? 0, result.text.length);
          edit(0, code.value.length, result.text, caret);
          hitRange = null; placeHit(); runFind();
          report(t`${result.count} reemplazo(s) en el borrador. Revisa el diff.`);
        } catch (e) { report(e.message, true); }
      };
      const toggleOption = (button, key) => () => {
        findOptions[key] = !findOptions[key];
        button.setAttribute('aria-pressed', String(findOptions[key]));
        button.classList.toggle('on', findOptions[key]);
        runFind();
      };
      const caseButton = h('button', { class: 'ghost', 'aria-pressed': 'false', 'aria-label': t('Coincidir mayúsculas y minúsculas') }, 'Aa');
      caseButton.addEventListener('click', toggleOption(caseButton, 'caseSensitive'));
      const regexButton = h('button', { class: 'ghost', 'aria-pressed': 'false', 'aria-label': t('Usar expresión regular') }, '.*');
      regexButton.addEventListener('click', toggleOption(regexButton, 'regex'));
      const replaceRow = h('div', { class: 'row' }, h('span', { class: 'indent' }), replaceInput,
        h('button', { class: 'ghost', onclick: replaceOne }, t('Reemplazar')),
        h('button', { class: 'ghost', onclick: replaceAll }, t('Reemplazar todos')));
      const replaceToggle = h('button', { class: 'ghost twist', 'aria-expanded': 'false', 'aria-label': t('Mostrar u ocultar reemplazar (Ctrl+H)') }, '▶');
      const showReplace = (open) => {
        replaceRow.style.display = open ? 'flex' : 'none';
        replaceToggle.textContent = open ? '▼' : '▶';
        replaceToggle.setAttribute('aria-expanded', String(open));
      };
      replaceToggle.addEventListener('click', () => {
        const open = replaceRow.style.display === 'none';
        showReplace(open);
        (open ? replaceInput : findInput).focus?.();
      });
      showReplace(false);
      const findBox = h('div', { class: 'find', role: 'search' },
        h('div', { class: 'row' }, replaceToggle, findInput, caseButton, regexButton, countBadge,
          h('button', { class: 'ghost', 'aria-label': t('Coincidencia anterior (Shift+Enter)'), onclick: () => step(-1) }, '▲'),
          h('button', { class: 'ghost', 'aria-label': t('Coincidencia siguiente (Enter)'), onclick: () => step(1) }, '▼'),
          h('button', { class: 'ghost', 'aria-label': t('Cerrar búsqueda (Esc)'), onclick: () => toggleFind(false) }, '✕')),
        replaceRow);
      findBox.style.display = 'none';
      const toggleFind = (open, focusReplace = false) => {
        findOpen = open;
        findBox.style.display = open ? 'flex' : 'none';
        if (open) {
          if (focusReplace) showReplace(true);
          const selected = code.value.slice(code.selectionStart ?? 0, code.selectionEnd ?? 0);
          if (selected && !selected.includes('\n') && selected.length < 200) findInput.value = selected;
          const target = focusReplace ? replaceInput : findInput;
          target.focus?.(); target.select?.();
          runFind();
        } else {
          hitRange = null; placeHit(); code.focus?.();
        }
      };
      findInput.addEventListener('input', () => {
        if (!runFind()) return;
        if (matches.length) {
          const s = code.selectionStart ?? 0;
          const [a, b] = matches.find(([x]) => x >= s) || matches[0];
          hitRange = [a, b]; placeHit(); reveal(a, b, false);
        } else { hitRange = null; placeHit(); }
      });
      findInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); } });
      replaceInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (e.ctrlKey || e.metaKey || e.altKey) replaceAll(); else replaceOne();
      });

      const gotoInput = h('input', { class: 'goto-q', type: 'number', min: '1', placeholder: t('Número de línea'), 'aria-label': t('Ir a la línea') });
      const goLine = () => {
        const line = Math.floor(Number(gotoInput.value));
        if (!Number.isFinite(line) || line < 1) { report(t('Escribe un número de línea válido.'), true); return; }
        const total = countLines(code.value);
        const pos = editorLineOffset(code.value, line);
        toggleGoto(false);
        reveal(pos, pos);
        report(t`Línea ${Math.min(line, total)} de ${total}`);
      };
      const gotoBox = h('div', { class: 'goto' }, h('div', { class: 'row' }, gotoInput,
        h('button', { class: 'ghost', onclick: goLine }, t('Ir'))));
      gotoBox.style.display = 'none';
      const toggleGoto = (open) => {
        gotoOpen = open;
        gotoBox.style.display = open ? 'flex' : 'none';
        if (open) { gotoInput.value = ''; gotoInput.focus?.(); } else code.focus?.();
      };
      gotoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); goLine(); } });

      const shortcuts = [
        t('Ctrl+S: guardar (muestra el diff y confirma)'), t('Ctrl+F / Ctrl+H: buscar / reemplazar'), t('Ctrl+G: ir a la línea'),
        t('Ctrl+D: seleccionar la siguiente coincidencia'),
        t('Ctrl+/: comentar o descomentar'), t('Alt+↑/↓: mover línea · Shift+Alt+↑/↓: duplicar'),
        t('Ctrl+Shift+K: borrar línea · Tab / Shift+Tab: sangrar'), t('Shift+Alt+F: formatear JSON · Esc: cerrar')
      ];
      const helpBox = h('div', { class: 'keys' }, h('strong', {}, t('Atajos de teclado')), ...shortcuts.map((line) => h('div', {}, line)));
      helpBox.style.display = 'none';
      const toggleHelp = (open = !helpOpen) => { helpOpen = open; helpBox.style.display = open ? 'block' : 'none'; };

      const live = isHTML ? h('div', { class: 'live' }) : null;
      const liveFrame = isHTML ? h('iframe', { sandbox: '', referrerpolicy: 'no-referrer', title: t('Vista previa HTML aislada') }) : null;
      const liveLabel = isHTML ? h('div', { class: 'live-bar' }, diskPreviewMode(false)) : null;
      let liveRevision = 0, liveScripts = false;
      if (live) { live.append(liveLabel, liveFrame); live.style.display = 'none'; }
      const renderLive = async () => {
        if (!liveOpen) return;
        const revision = ++liveRevision;
        try {
          const result = await diskPreviewDocument(code.value, path, liveScripts);
          if (revision !== liveRevision || !liveOpen || !host.isConnected) return;
          liveFrame.setAttribute('sandbox', liveScripts ? 'allow-scripts' : '');
          liveFrame.srcdoc = previewHTML(result.html);
          liveLabel.textContent = diskPreviewMode(liveScripts);
        } catch (e) {
          if (revision !== liveRevision || !liveOpen || !host.isConnected) return;
          liveFrame.removeAttribute('srcdoc'); report(e.message, true);
        }
      };
      const scheduleLiveDebounced = debounce(renderLive, 350);
      const scheduleLive = () => { liveRevision++; scheduleLiveDebounced(); };
      const liveButton = isHTML ? h('button', { class: 'ghost', 'aria-pressed': 'false', 'aria-label': t('Vista previa en vivo') }, t('Vista previa')) : null;
      liveButton?.addEventListener('click', () => {
        if (!liveOpen) liveScripts = requestPreviewScripts();
        liveOpen = !liveOpen;
        liveRevision++;
        if (!liveOpen) liveFrame.removeAttribute('srcdoc');
        live.style.display = liveOpen ? 'flex' : 'none';
        liveButton.setAttribute('aria-pressed', String(liveOpen));
        liveButton.classList.toggle('on', liveOpen);
        renderLive();
      });
      const tabButton = isHTML ? h('button', { class: 'ghost', 'aria-label': t('Abrir el archivo guardado en una pestaña que se actualiza al guardar') }, t('Pestaña')) : null;
      tabButton?.addEventListener('click', async () => {
        if (snapshot.isNew) { report(t('Guarda el archivo antes de abrirlo en una pestaña.'), true); return; }
        try { report(await openHTMLPreview(path)); } catch (e) { report(e.message, true); }
      });

      const formatJSON = () => {
        if (lang !== 'json') { report(t('Formatear solo está disponible para JSON.'), true); return; }
        try {
          const pretty = JSON.stringify(JSON.parse(code.value), null, 2);
          if (pretty !== code.value) edit(0, code.value.length, pretty, 0);
          report(t('JSON formateado. Revisa el diff.'));
        } catch (e) { report(t`JSON no válido: ${e.message}`, true); }
      };
      const copyAll = async () => {
        try { await navigator.clipboard.writeText(code.value); report(t('Código copiado al portapapeles.')); }
        catch { code.focus?.(); code.select?.(); report(t('El navegador bloqueó el portapapeles; el código quedó seleccionado, usa Ctrl+C.'), true); }
      };
      const pasteClipboard = async () => {
        try {
          const text = (await navigator.clipboard.readText()).replace(/\r\n?/g, '\n');
          const s = code.selectionStart ?? code.value.length, e = code.selectionEnd ?? s;
          edit(s, e, text);
          report(t('Pegado desde el portapapeles.'));
        } catch { code.focus?.(); report(t('El navegador bloqueó el portapapeles; usa Ctrl+V.'), true); }
      };
      const downloadDraft = () => {
        let url = null, link = null;
        try {
          const name = splitPath(path).pop() || 'archivo.txt';
          url = URL.createObjectURL(new Blob([candidate()], { type: 'text/plain;charset=utf-8' }));
          link = document.createElement('a');
          link.href = url; link.download = name; link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          const pending = url; setTimeout(() => URL.revokeObjectURL(pending), 60000); url = null;
          report(t`Borrador descargado: ${name}. El disco virtual no cambia.`);
        } catch (e) { report(e.message, true); }
        finally { link?.remove(); if (url) URL.revokeObjectURL(url); }
      };
      const changeFont = (delta) => {
        fontSize = Math.min(24, Math.max(10, fontSize + delta));
        try { localStorage.setItem(EDITOR_FONT_KEY, String(fontSize)); } catch { /* sin almacenamiento */ }
        applyFont(); placeHit(); syncScroll();
        report(t`Tamaño de letra: ${fontSize}px`);
      };

      const sync = () => {
        const lines = countLines(code.value);
        if (lines !== gutterLines) {
          gutterLines = lines;
          gutter.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n') + '\n ';
        }
        approvedCandidate = null; apply.disabled = !canSave(); diff.style.display = 'none';
        hitRange = null;
        paint(); markDirty(); updateInfo(); updateMini(); updatePosition();
        if (findOpen) scheduleFind();
        if (liveOpen) scheduleLive();
        report(snapshot.isNew ? t('Archivo nuevo · aún no existe en el disco') : t('Borrador local · aún no guardado'));
      };
      code.addEventListener('input', sync);
      code.addEventListener('scroll', syncScroll);
      for (const type of ['keyup', 'click', 'select']) code.addEventListener(type, updatePosition);
      code.addEventListener('keydown', (e) => {
        if (code.readOnly || e.isComposing) return;
        const mod = e.ctrlKey || e.metaKey, key = e.key;
        const value = code.value, s = code.selectionStart ?? 0, end = code.selectionEnd ?? s;
        if (key === 'Tab' && !mod && !e.altKey) {
          e.preventDefault();
          if (e.shiftKey || value.slice(s, end).includes('\n')) applyOp(indentEditorLines(value, s, end, e.shiftKey));
          else edit(s, end, '  ');
          return;
        }
        if (e.altKey && !mod && (key === 'ArrowUp' || key === 'ArrowDown')) {
          e.preventDefault();
          const direction = key === 'ArrowUp' ? -1 : 1;
          applyOp(e.shiftKey ? duplicateEditorLines(value, s, end, direction) : moveEditorLines(value, s, end, direction));
          return;
        }
        if (mod && !e.altKey && (key === '/' || e.code === 'NumpadDivide')) {
          e.preventDefault();
          if (!applyOp(toggleEditorComment(value, s, end, lang))) report(t('Este tipo de archivo no admite comentarios.'), true);
          return;
        }
        if (mod && e.shiftKey && !e.altKey && (key === 'K' || key === 'k')) { e.preventDefault(); applyOp(deleteEditorLines(value, s, end)); return; }
        if (mod && !e.shiftKey && !e.altKey && (key === 'd' || key === 'D')) {
          e.preventDefault();
          if (s === end) {
            // Sin selección: selecciona la palabra bajo el cursor, como VS Code.
            let a = s, b = s;
            while (a > 0 && /[\w$-]/.test(value[a - 1])) a--;
            while (b < value.length && /[\w$-]/.test(value[b])) b++;
            if (a < b) reveal(a, b);
            return;
          }
          const word = value.slice(s, end);
          const found = findEditorMatches(value, word, { caseSensitive: true });
          if (found.length < 2) { report(t('No hay más coincidencias.')); return; }
          const next = found.find(([a]) => a >= end) || found[0];
          hitRange = null; placeHit();
          reveal(next[0], next[1]);
          report(t`Siguiente coincidencia en línea ${countLines(value.slice(0, next[0]))}`);
          return;
        }
        if (mod || e.altKey) return;
        if (key === 'Enter') {
          e.preventDefault();
          const lineStart = s > 0 ? value.lastIndexOf('\n', s - 1) + 1 : 0;
          const line = value.slice(lineStart, s);
          const indent = /^[ \t]*/.exec(line)[0];
          const prev = value[s - 1] || '';
          const split = (EDITOR_PAIRS[prev] && value[end] === EDITOR_PAIRS[prev] && '([{'.includes(prev)) ||
            (lang === 'html' && prev === '>' && value.startsWith('</', end) && !!editorClosingTag(value.slice(Math.max(0, s - 2000), s - 1)));
          if (split) {
            const inner = '\n' + indent + '  ';
            edit(s, end, inner + '\n' + indent, s + inner.length);
            return;
          }
          const opens = /[{[(]\s*$/.test(line) || (lang === 'py' && /:\s*$/.test(line)) ||
            (lang === 'html' && line.endsWith('>') && !!editorClosingTag(line.slice(Math.max(0, line.length - 2000), -1)));
          edit(s, end, '\n' + indent + (opens ? '  ' : ''));
          return;
        }
        if (key === 'Backspace' && s === end && s > 0) {
          const close = EDITOR_PAIRS[value[s - 1]];
          if (close && value[s] === close && lang !== 'text') { e.preventDefault(); edit(s - 1, s + 1, ''); }
          return;
        }
        if (key.length !== 1 || lang === 'text') return;
        if (s === end && ')]}"\'`'.includes(key) && value[s] === key) {
          e.preventDefault(); code.setSelectionRange?.(s + 1, s + 1); updatePosition(); return;
        }
        if (EDITOR_PAIRS[key] && !(key === '`' && lang !== 'js' && lang !== 'md')) {
          const quote = key === '"' || key === "'" || key === '`';
          if (s !== end) { e.preventDefault(); edit(s, end, key + value.slice(s, end) + EDITOR_PAIRS[key], s + 1, end + 1); return; }
          if (lang === 'md' && key !== '`') return;
          if (!/^(?:$|[\s)\]}>;,.:])/.test(value[s] || '')) return;
          if (quote && /[\w$\\]/.test(value[s - 1] || '')) return;
          e.preventDefault(); edit(s, s, key + EDITOR_PAIRS[key], s + 1);
          return;
        }
        if (key === '>' && lang === 'html' && s === end) {
          const close = editorClosingTag(value.slice(Math.max(0, s - 2000), s), value.slice(end, end + 200));
          if (close) { e.preventDefault(); edit(s, s, '>' + close, s + 1); }
        }
      });

      const reviewDiff = async () => {
        if (saving) return false;
        const proposed = candidate();
        try {
          validateEditorCandidate(snapshot, proposed);
          const engine = await getDiff();
          const patch = engine.createTwoFilesPatch(`a/${path}`, `b/${path}`, snapshot.text, proposed, '', '', { context: 3, timeout: 2000 });
          if (patch === undefined) throw new Error(t('diff excedió el tiempo límite'));
          diff.textContent = patch; diff.style.display = 'block';
          approvedCandidate = proposed;
          apply.disabled = candidate() !== proposed || !canSave();
          report(t('Revisa el diff completo; Aplicar comprueba la versión original.'));
          return candidate() === proposed;
        } catch (e) { approvedCandidate = null; apply.disabled = true; report(e.message, true); return false; }
      };
      const preview = h('button', { onclick: () => { reviewDiff(); } }, t('Revisar diff'));
      const nextPaint = () => new Promise(resolve => {
        const raf = globalThis.requestAnimationFrame;
        if (typeof raf === 'function') raf(() => setTimeout(resolve, 0)); else setTimeout(resolve, 0);
      });
      const beforeUnload = (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } };
      let stopFocusTrap = null;
      release = () => {
        for (const id of timers) clearTimeout(id);
        timers.clear();
        window.removeEventListener?.('beforeunload', beforeUnload);
        window.removeEventListener?.('resize', fitEditor);
        liveRevision++;
        if (liveFrame) liveFrame.removeAttribute?.('srcdoc');
        stopFocusTrap?.();
        host.remove(); editorOpen = false; ui?.updateState?.();
      };
      const close = h('button', {
        class: 'ghost', onclick: () => {
          if (saving) return;
          if (isDirty() && !confirm(t('¿Descartar el borrador sin guardar?'))) return;
          release();
        }
      }, t('Cerrar'));
      apply.addEventListener('click', async () => {
        const created = snapshot.isNew;
        if (created) {
          if (saving || busy) { report(t('Revisa de nuevo el diff o espera a que termine la operación.'), true); return; }
          approvedCandidate = candidate();
        } else {
          if (saving || busy) { report(t('Revisa de nuevo el diff o espera a que termine la operación.'), true); return; }
          if (approvedCandidate === null || candidate() !== approvedCandidate) {
            // Guardar directo: muestra el diff antes de la confirmación.
            if (!(await reviewDiff())) return;
            await nextPaint();
            if (saving || busy || candidate() !== approvedCandidate) return;
          }
          if (!confirm(t`¿Aplicar el diff revisado a "${path}"? ${snapshot.checkpointBeforeSave ?
            t('Se creará y verificará un checkpoint previo; si falla, no se guarda.') :
            t('No crea backup automático.')} No crea commit.`)) return;
        }
        saving = true; setBusy(true); code.readOnly = true; apply.disabled = true;
        let saved = false;
        try {
          snapshot = await saveEditorCandidate(snapshot, approvedCandidate);
          saved = true;
          uiLog(created ? t`Editor: creado y verificado ${path} (SHA256 ${snapshot.hash.slice(0, 8)}). Usa Ejecutar para verlo y Guardar en Git para versionarlo.` :
            t`Editor: guardado y verificado ${path} (SHA256 ${snapshot.hash.slice(0, 8)}). Revisa git diff.`, 'info');
          if (closeAfterSave) release();
        } catch (e) { report(e.message, true); }
        finally {
          saving = false; setBusy(false); code.readOnly = false;
          if (saved && !closeAfterSave) {
            activeProposal = null;
            baseline = snapshot.text.replace(/\r\n?/g, '\n');
            approvedCandidate = null; diff.style.display = 'none';
            apply.replaceChildren(document.createTextNode(saveLabel()));
            if (created) title.textContent = t`Editor local · ${path}`;
            markDirty(); updateInfo();
            report(t`Guardado y verificado · SHA256 ${snapshot.hash.slice(0, 8)} · puedes seguir editando`);
          }
          apply.disabled = !canSave();
          await ui?.refresh();
        }
      });

      const fontDown = h('button', { class: 'ghost', 'aria-label': t('Reducir tamaño de letra'), onclick: () => changeFont(-1) }, 'A−');
      const fontUp = h('button', { class: 'ghost', 'aria-label': t('Aumentar tamaño de letra'), onclick: () => changeFont(1) }, 'A+');
      const tools = [
        h('button', { class: 'ghost', 'aria-label': t('Buscar y reemplazar (Ctrl+F)'), onclick: () => toggleFind(!findOpen) }, '🔍 ', t('Buscar')),
        h('button', { class: 'ghost', 'aria-label': t('Ir a la línea (Ctrl+G)'), onclick: () => toggleGoto(!gotoOpen) }, t('Ir a línea')),
        fontDown, fontUp,
        h('button', { class: 'ghost', onclick: copyAll }, t('Copiar')),
        h('button', { class: 'ghost', onclick: pasteClipboard }, t('Pegar')),
        h('button', { class: 'ghost', 'aria-label': t('Descargar el borrador sin guardarlo en el disco virtual'), onclick: downloadDraft }, t('Descargar')),
        ...(lang === 'json' ? [h('button', { class: 'ghost', onclick: formatJSON }, t('Formatear'))] : []),
        ...(isHTML ? [liveButton, tabButton] : []),
        h('button', { class: 'ghost', 'aria-label': t('Atajos de teclado'), onclick: () => toggleHelp() }, '⌨')
      ];
      const minimize = h('button', { class: 'ghost', 'aria-label': t('Minimizar editor'), 'aria-expanded': 'true' }, t('Minimizar'));
      const maximize = h('button', { class: 'ghost', 'aria-label': t('Ampliar editor'), 'aria-pressed': 'false' }, t('Ampliar'));
      const windowBar = h('div', { class: 'window-bar', title: t('Arrastra la barra para mover el editor') },
        h('strong', { class: 'title' }, title, dirtyMark), minimize, maximize, close);

      shadow.append(h('style', {}, `
        :host{all:initial}
        .editor{position:fixed;left:5vw;top:5vh;width:min(1100px,90vw);height:85dvh;min-width:min(480px,96vw);min-height:180px;max-width:100vw;max-height:100dvh;box-sizing:border-box;resize:both;z-index:1000001;background:#1e1e1e;color:#ddd;border:1px solid #555;border-radius:10px;box-shadow:0 15px 60px #0009;display:flex;flex-direction:column;font:13px system-ui,sans-serif;overflow:hidden}
        .window-bar{display:flex;gap:6px;align-items:center;padding:8px 10px;background:#181818;cursor:move;touch-action:none;user-select:none}
        .window-bar .title{flex:1;max-width:none;min-width:0}
        .editor.maximized{left:0!important;top:0!important;width:100vw!important;height:100dvh!important;resize:none;border-radius:0}
        .editor.minimized{height:auto!important;min-height:0;resize:none}
        .editor.minimized>:not(.window-bar){display:none!important}
        .bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;background:#252526;border-bottom:1px solid #333}
        .title{margin-right:auto;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42%}
        .dirty{color:#e2c08d;margin-left:6px}
        button{background:#094771;color:#fff;border:1px solid #38617e;border-radius:5px;padding:5px 10px;cursor:pointer;font:12px system-ui,sans-serif;white-space:nowrap}
        button:hover:not(:disabled){filter:brightness(1.2)} button:disabled{opacity:.4;cursor:default}
        button.ghost{background:#2d2d2d;border-color:#454545} button.primary{background:#0e7a3e;border-color:#16a34a}
        button.on{background:#0e639c;border-color:#1f8ad2}
        .main{flex:1;display:flex;min-height:0;position:relative}
        .source{flex:1;display:flex;min-width:0;min-height:0;background:#1e1e1e;position:relative}
        .twist{padding:3px 6px;font-size:10px} .indent{width:26px;flex:none}
        .gutter,.hl,.code{font-family:Consolas,"Cascadia Mono","Courier New",monospace;font-variant-ligatures:none;tab-size:2;-moz-tab-size:2;white-space:pre;letter-spacing:0;margin:0;box-sizing:border-box}
        .gutter{padding:10px 8px 60px 8px;color:#858585;text-align:right;user-select:none;overflow:hidden;min-width:3.4em;border-right:1px solid #333}
        .wrap{position:relative;flex:1;min-width:0}
        .hl,.code{position:absolute;inset:0;width:100%;height:100%;padding:10px 12px;overflow:scroll;border:0}
        .hl{pointer-events:none;color:#d4d4d4;scrollbar-color:transparent transparent}
        .code{background:transparent;color:transparent;caret-color:#aeafad;resize:none;outline:none;z-index:1;scrollbar-color:#4b4b4b #1e1e1e}
        .code::selection{background:#3a7bd566;color:transparent}
        .source.plain .code{color:#d4d4d4} .source.plain .code::selection{color:#fff}
        .t-comment{color:#6a9955}.t-string{color:#ce9178}.t-number{color:#b5cea8}.t-keyword{color:#c586c0}.t-literal{color:#569cd6}
        .t-func{color:#dcdcaa}.t-tag{color:#569cd6}.t-attr{color:#9cdcfe}.t-prop{color:#9cdcfe}.t-type{color:#4ec9b0}
        .hit{position:absolute;background:#f8d34a40;outline:1px solid #f8d34a;border-radius:2px;pointer-events:none}
        .minimap{width:84px;position:relative;overflow:hidden;border-left:1px solid #333;cursor:pointer;flex:none;touch-action:none}
        .mini-text{margin:0;padding:0 4px;font:2.4px/3px monospace;color:#8b949e;white-space:pre;pointer-events:none;overflow:hidden}
        .mini-view{position:absolute;left:0;right:0;background:#ffffff14;border-top:1px solid #ffffff2a;border-bottom:1px solid #ffffff2a;pointer-events:none}
        .find,.goto,.keys{position:absolute;top:6px;z-index:3;background:#252526;border:1px solid #454545;border-radius:6px;box-shadow:0 4px 16px #0008;padding:6px}
        .find{right:100px;flex-direction:column;gap:5px;width:min(460px,80%)} .goto{left:50%;transform:translateX(-50%);width:220px}
        .keys{right:100px;font-size:12px;line-height:1.7;padding:10px 14px} .keys strong{display:block;margin-bottom:4px}
        .row{display:flex;gap:4px;align-items:center;width:100%}
        .row input{flex:1;background:#3c3c3c;color:#eee;border:1px solid #555;border-radius:3px;padding:5px 7px;font:12px Consolas,monospace;outline:none;min-width:0}
        .row input:focus{border-color:#1f8ad2} .row input.bad{border-color:#f87171} .row button{padding:3px 8px}
        .count{font-size:11px;color:#aaa;min-width:72px;text-align:center}
        .live{width:42%;min-width:240px;flex-direction:column;border-left:1px solid #444;background:#fff}
        .live-bar{background:#252526;color:#aaa;font-size:11px;padding:5px 8px}
        .live iframe{flex:1;border:0;width:100%;background:#fff}
        .diff{margin:0;padding:10px;background:#111;color:#b5cea8;overflow:auto;max-height:30vh;font:12px/18px monospace;white-space:pre;border-top:1px solid #333}
        .statusbar{display:flex;gap:14px;align-items:center;padding:5px 10px;background:#181818;border-top:1px solid #333;font-size:11.5px;color:#aaa}
        .status{flex:1;overflow-wrap:anywhere}.pos,.info{white-space:nowrap}
        @media (max-width:900px){.minimap{display:none}.live{width:50%}.find{right:8px}.info{display:none}}
      `));
      source.append(gutter, h('div', { class: 'wrap' }, hl, code), minimap, findBox, gotoBox, helpBox);
      const dialog = h('section', { class: 'editor', role: 'dialog', 'aria-label': snapshot.isNew ? t`Nuevo archivo · ${path}` : t`Editor de ${path}` },
        windowBar, h('div', { class: 'bar' }, ...tools, preview, apply),
        h('div', { class: 'main' }, source, ...(live ? [live] : [])),
        diff, h('div', { class: 'statusbar' }, status, position, info));
      const setRect = (rect) => {
        for (const key of ['left', 'top', 'width', 'height']) dialog.style[key] = rect[key] + 'px';
      };
      fitEditor = () => {
        if (maximized) return;
        const rect = dialog.getBoundingClientRect();
        const width = Math.min(rect.width, window.innerWidth), height = Math.min(rect.height, window.innerHeight);
        dialog.style.left = Math.max(0, Math.min(rect.left, window.innerWidth - width)) + 'px';
        dialog.style.top = Math.max(0, Math.min(rect.top, window.innerHeight - height)) + 'px';
        if (!minimized) { dialog.style.width = width + 'px'; dialog.style.height = height + 'px'; }
      };
      const showWindow = () => {
        dialog.classList.toggle('minimized', minimized);
        dialog.classList.toggle('maximized', maximized && !minimized);
        minimize.textContent = minimized ? t('Restaurar') : t('Minimizar');
        minimize.setAttribute('aria-label', minimized ? t('Restaurar editor') : t('Minimizar editor'));
        minimize.setAttribute('aria-expanded', String(!minimized));
        maximize.textContent = maximized ? t('Reducir') : t('Ampliar');
        maximize.setAttribute('aria-label', maximized ? t('Reducir editor') : t('Ampliar editor'));
        maximize.setAttribute('aria-pressed', String(maximized));
        if (!minimized) code.focus?.();
        fitEditor();
      };
      minimize.addEventListener('click', () => {
        if (!minimized && !maximized) {
          const rect = dialog.getBoundingClientRect();
          floatingRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
        }
        minimized = !minimized;
        if (!minimized && !maximized && floatingRect) setRect(floatingRect);
        showWindow();
      });
      maximize.addEventListener('click', () => {
        if (!maximized && !minimized) {
          const rect = dialog.getBoundingClientRect();
          floatingRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
        }
        minimized = false; maximized = !maximized;
        if (!maximized && floatingRect) setRect(floatingRect);
        showWindow();
      });
      windowBar.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || maximized || e.target.closest('button')) return;
        e.preventDefault();
        const rect = dialog.getBoundingClientRect();
        drag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
        windowBar.setPointerCapture?.(e.pointerId);
      });
      windowBar.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const rect = dialog.getBoundingClientRect();
        const left = Math.max(0, Math.min(e.clientX - drag.dx, window.innerWidth - rect.width));
        const top = Math.max(0, Math.min(e.clientY - drag.dy, window.innerHeight - rect.height));
        dialog.style.left = left + 'px'; dialog.style.top = top + 'px';
        if (minimized && floatingRect) floatingRect = { ...floatingRect, left, top };
      });
      const stopDrag = () => { drag = null; };
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) windowBar.addEventListener(type, stopDrag);
      dialog.addEventListener('keydown', (e) => {
        if (minimized) return;
        const mod = e.ctrlKey || e.metaKey, key = String(e.key || '').toLowerCase();
        if (mod && !e.altKey && key === 's') {
          e.preventDefault();
          (apply.disabled ? preview : apply).click();
        } else if (mod && !e.altKey && !e.shiftKey && key === 'f') {
          e.preventDefault(); toggleFind(true);
        } else if (mod && !e.altKey && !e.shiftKey && key === 'h') {
          e.preventDefault(); toggleFind(true, true);
        } else if (mod && !e.altKey && !e.shiftKey && key === 'g') {
          e.preventDefault(); toggleGoto(true);
        } else if (key === 'f3') {
          e.preventDefault(); if (!findOpen) toggleFind(true); step(e.shiftKey ? -1 : 1);
        } else if (e.shiftKey && e.altKey && !mod && (key === 'f' || e.code === 'KeyF')) {
          e.preventDefault(); formatJSON();
        } else if (key === 'escape') {
          e.preventDefault();
          if (helpOpen) toggleHelp(false);
          else if (gotoOpen) toggleGoto(false);
          else if (findOpen) toggleFind(false);
          else close.click();
        }
      });
      shadow.append(dialog);
      for (const type of ['keydown', 'keyup', 'keypress']) host.addEventListener(type, (e) => e.stopPropagation());
      stopFocusTrap = installFocusTrap(host, dialog, code, () => editorOpen && !minimized);
      window.addEventListener?.('beforeunload', beforeUnload);
      window.addEventListener?.('resize', fitEditor);
      document.body.append(host);
      applyFont(); sync();
      report(snapshot.isNew ? t`Archivo nuevo ${path} · pega o escribe el código · Ctrl+S crea · Tab sangra · Esc cierra` :
        t`SHA256 original: ${snapshot.hash} · UTF-8 · Ctrl+S guarda (muestra el diff y confirma) · Tab sangra · Esc cierra`);
      if (proposal) preview.click();
      else { code.focus?.(); code.setSelectionRange?.(0, 0); }
      return true;
    } catch (e) {
      if (release) release(); else editorOpen = false;
      ui?.updateState?.();
      uiLog(t`❌ Editor: ${e.message}`, 'err');
      return false;
    }
  }

  async function createFileFromPanel(name) {
    if (busy || editorOpen) { uiLog(t('Ya hay una operación o editor abierto.'), 'err'); return false; }
    try {
      if (typeof name !== 'string' || !name.trim()) throw new Error(t('escribe un nombre de archivo'));
      const target = await editorTarget(name.trim());
      if (!target.create) uiLog(t`${target.path} ya existe; se abre para editarlo.`, 'info');
      return openCodeEditor(target.path, null, { create: target.create });
    } catch (e) {
      uiLog(t`❌ Editor: ${e.message}`, 'err');
      return false;
    }
  }

  async function deleteUserFiles(path = null) {
    if (busy) {
      uiLog(t('⏳ Hay una operación en curso; no se ha borrado nada.'), 'err');
      return;
    }
    setBusy(true);
    let deleted = 0;
    try {
      let paths;
      if (path !== null) {
        if (isInternalPath(path)) throw new Error(t('no se pueden borrar metadatos internos'));
        await requireFile(path);
        paths = [splitPath(path).join('/')];
      } else {
        paths = (await listFiles()).filter((file) => !isInternalPath(file.path)).map((file) => file.path);
      }
      if (!paths.length) { uiLog(t('No hay archivos de usuario para eliminar.'), 'info'); return; }
      const preview = paths.slice(0, 15).join('\n') + (paths.length > 15 ? t`\n... y ${paths.length - 15} más` : '');
      const realFolderWarning = storageMode === 'local' ? t('⚠️ Carpeta REAL de tu PC. ') : '';
      if (!confirm(realFolderWarning + t`¿Eliminar ${paths.length} archivo(s) de usuario?\n${preview}\nSe conservan .git, .dv y .dv_tmp. No hay deshacer automático.`)) {
        uiLog(t('Borrado cancelado; no se ha eliminado nada.'), 'info');
        return;
      }
      for (const target of paths) {
        await requireFile(target);
        await removePath(target, false);
        if (await getHandle(target)) throw new Error(t`el archivo sigue existiendo: ${target}`);
        deleted++;
      }
      uiLog(t`Eliminados ${deleted} archivo(s). Git y journal conservados; revisa git status.`, 'info');
    } catch (e) {
      uiLog(t`❌ Borrado detenido tras ${deleted} archivo(s): ${e.message}. No se revierten los borrados anteriores.`, 'err');
    } finally {
      setBusy(false);
      await ui?.refresh();
    }
  }

  function createPreviewHTMLConverter() {
    let policy;
    return (source) => {
      if (!window.trustedTypes) return source;
      if (!policy) {
        // Private sink adapter, not a sanitizer: only inert parsing and sandboxed previews use it.
        policy = window.trustedTypes.createPolicy('dv-static-preview', { createHTML: (html) => html });
      }
      return policy.createHTML(source);
    };
  }

  const previewHTML = createPreviewHTMLConverter();

  function staticPreviewDocument(source, { allowScripts = false, scriptNonce = '' } = {}) {
    const template = document.createElement('template');
    template.innerHTML = previewHTML(source);
    template.content.querySelectorAll((allowScripts ? '' : 'script, ') + 'iframe, frame, object, embed, base, meta[http-equiv], link').forEach((el) => el.remove());
    template.content.querySelectorAll('a, area, form').forEach((el) => {
      el.removeAttribute('href');
      el.removeAttribute('action');
    });
    const doc = document.implementation.createHTMLDocument(t('Vista previa estática'));
    const policy = doc.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    policy.content = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'" +
      (allowScripts ? `; script-src ${scriptNonce ? "'nonce-" + scriptNonce + "'" : "'unsafe-inline'"}; script-src-attr 'unsafe-inline'; connect-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'` : '');
    doc.head.prepend(policy);
    doc.body.append(template.content);
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  }

  function previewBlockedBySite() {
    return window.location?.hostname === 'gemini.google.com';
  }

  function diskPreviewMode(interactive) {
    return previewBlockedBySite() ?
      t('HTML y CSS del disco · Gemini bloquea JavaScript por CSP') :
      interactive ? t('HTML, CSS y JS del disco · scripts aislados, sin red') :
        t('HTML y CSS del disco · JavaScript desactivado');
  }

  function requestPreviewScripts() {
    return !previewBlockedBySite() && confirm(t('¿Habilitar JavaScript del proyecto en la vista previa aislada? Solo código revisado; sin acceso al disco ni red. Un bucle infinito puede bloquear la pestaña. Cancelar mantiene HTML y CSS sin scripts.'));
  }

  function previewResourcePath(base, reference) {
    const value = reference.trim();
    if (!value || value.startsWith('#')) return null;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) throw new Error(t`Recurso de vista previa no permitido: ${value}`);
    const pathname = decodeURIComponent(value.split(/[?#]/)[0]);
    if (/[\\\u0000-\u001f]/.test(pathname)) throw new Error(t`Recurso de vista previa no permitido: ${value}`);
    const parts = pathname.startsWith('/') ? [] : splitPath(base).slice(0, -1);
    for (const part of pathname.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (!parts.length) throw new Error(t`Recurso de vista previa no permitido: ${value}`);
        parts.pop();
      } else parts.push(part);
    }
    const path = splitPath(parts.join('/')).join('/');
    if (!path || isInternalPath(path)) throw new Error(t`Recurso de vista previa no permitido: ${value}`);
    return path;
  }

  async function diskPreviewDocument(source, path, interactive = false, scriptNonce = '') {
    interactive = interactive && !previewBlockedBySite();
    const dependencies = new Set();
    let total = new TextEncoder().encode(source).length;
    if (total > 8 * 1024 * 1024) throw new Error(t('La vista previa y sus recursos superan 8 MB.'));
    const read = async (target) => {
      dependencies.add(target);
      const file = await (await requireFile(target)).getFile();
      total += file.size;
      if (total > 8 * 1024 * 1024) throw new Error(t('La vista previa y sus recursos superan 8 MB.'));
      return new Uint8Array(await file.arrayBuffer());
    };
    const text = async (target) => new TextDecoder('utf-8', { fatal: true }).decode(await read(target));
    const assetCache = new Map();
    const asset = async (base, value) => {
      if (value.trim().startsWith('data:')) return value;
      const target = previewResourcePath(base, value);
      if (!target) return value;
      if (!assetCache.has(target)) {
        const bytes = await read(target);
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
        const type = /\.png$/i.test(target) ? 'image/png' : /\.jpe?g$/i.test(target) ? 'image/jpeg' :
          /\.svg$/i.test(target) ? 'image/svg+xml' : /\.gif$/i.test(target) ? 'image/gif' :
            /\.webp$/i.test(target) ? 'image/webp' : /\.woff2$/i.test(target) ? 'font/woff2' :
              /\.woff$/i.test(target) ? 'font/woff' : 'application/octet-stream';
        assetCache.set(target, 'data:' + type + ';base64,' + btoa(binary));
      }
      return assetCache.get(target);
    };
    const css = async (value, base) => {
      if (/@import\b/i.test(value)) throw new Error(t('CSS @import no admitido; usa link stylesheet en el HTML.'));
      const pattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi;
      let result = '', end = 0;
      for (const match of value.matchAll(pattern)) {
        result += value.slice(end, match.index) + 'url("' + await asset(base, match[1] ?? match[2] ?? match[3]) + '")';
        end = match.index + match[0].length;
      }
      return result + value.slice(end);
    };
    const template = document.createElement('template');
    template.innerHTML = previewHTML(source);
    const root = template.content;
    const resolvedStyles = new WeakSet();
    for (const link of root.querySelectorAll('link')) {
      if (link.rel.toLowerCase() !== 'stylesheet') { link.remove(); continue; }
      const target = previewResourcePath(path, link.getAttribute('href') || '');
      if (!target) throw new Error(t('Hoja de estilos sin ruta.'));
      const style = document.createElement('style');
      style.textContent = await css(await text(target), target);
      resolvedStyles.add(style);
      link.replaceWith(style);
    }
    for (const style of root.querySelectorAll('style')) {
      if (!resolvedStyles.has(style)) style.textContent = await css(style.textContent, path);
    }
    for (const script of root.querySelectorAll('script')) {
      const type = script.type.trim().toLowerCase();
      if (!interactive) {
        if (script.hasAttribute('src')) {
          const target = previewResourcePath(path, script.getAttribute('src'));
          if (target) { dependencies.add(target); await requireFile(target); }
        }
        script.remove(); continue;
      }
      if (type === 'module' || type === 'importmap' || script.hasAttribute('async')) {
        throw new Error(t('La vista previa admite scripts clásicos sin async; módulos ES requieren un servidor.'));
      }
      if (script.hasAttribute('src')) {
        const target = previewResourcePath(path, script.getAttribute('src'));
        if (!target) throw new Error(t('Script sin ruta.'));
        const encoded = JSON.stringify(await text(target)).replace(/</g, '\\u003c');
        const install = `const node=document.createElement('script');node.nonce=${JSON.stringify(scriptNonce)};node.textContent=${encoded};document.head.append(node);node.remove();`;
        script.textContent = script.hasAttribute('defer') ?
          `addEventListener('DOMContentLoaded',()=>{${install}},{once:true});` : `{${install}}`;
        for (const name of ['src', 'defer', 'integrity', 'crossorigin']) script.removeAttribute(name);
      }
      if (scriptNonce) script.setAttribute('nonce', scriptNonce);
    }
    for (const el of root.querySelectorAll('*')) {
      if (el.hasAttribute('style')) el.setAttribute('style', await css(el.getAttribute('style'), path));
      if (el.hasAttribute('srcset')) throw new Error(t('srcset no admitido; usa imágenes con src.'));
      if (el.tagName === 'IMG' && el.hasAttribute('src')) el.setAttribute('src', await asset(path, el.getAttribute('src')));
    }
    return { html: staticPreviewDocument(template.innerHTML, { allowScripts: interactive, scriptNonce }), dependencies };
  }

  const htmlPreviews = new Map();

  function closeHTMLPreview(entry, { closeTab = false } = {}) {
    clearTimeout(entry.timer);
    clearInterval(entry.watch);
    entry.channel.close();
    URL.revokeObjectURL(entry.url);
    if (htmlPreviews.get(entry.path) === entry) htmlPreviews.delete(entry.path);
    if (closeTab && !entry.tab.closed) entry.tab.close();
  }

  function notifyHTMLPreviews(path) {
    for (const entry of htmlPreviews.values()) {
      if (entry.tab.closed) { closeHTMLPreview(entry); continue; }
      if (entry.path !== path && !entry.path.startsWith(path + '/') &&
          ![...(entry.dependencies || [])].some(dep => dep === path || dep.startsWith(path + '/'))) continue;
      clearTimeout(entry.timer);
      entry.timer = setTimeout(() => updateHTMLPreview(entry), 150);
    }
  }

  async function updateHTMLPreview(entry) {
    if (htmlPreviews.get(entry.path) !== entry) return;
    if (entry.tab.closed) { closeHTMLPreview(entry); return; }
    const revision = ++entry.revision;
    try {
      const snapshot = await editorSnapshot(entry.path);
      const result = await diskPreviewDocument(snapshot.text, entry.path, entry.interactive, entry.scriptNonce);
      if (htmlPreviews.get(entry.path) !== entry || revision !== entry.revision) return;
      entry.dependencies = result.dependencies;
      entry.channel.postMessage({ type: 'render', html: result.html, hash: snapshot.hash });
    } catch (e) {
      if (htmlPreviews.get(entry.path) !== entry || revision !== entry.revision) return;
      entry.channel.postMessage({ type: 'error', text: e.message });
      uiLog(t`Vista previa ${entry.path}: ${e.message}`, 'err');
    }
  }

  function previewStrings() {
    return {
      refresh: t('Actualizar desde disco'), mode: diskPreviewMode(false), interactiveMode: diskPreviewMode(true),
      connecting: t('Conectando con el panel...'), frame: t('Vista previa HTML aislada'),
      reading: t('Leyendo la versión guardada en OPFS...'),
      offline: t('El panel no responde. Mantén DeepSeek abierto. Si lo recargaste, vuelve a pulsar Ejecutar allí.'),
      updated: t('Actualizado: '),
      saved: t(' · Solo cambios guardados. Actualización automática mientras el panel esté abierto.'),
      error: t('No se pudo actualizar: '),
      connectionError: t('No se pudo conectar la vista previa: ')
    };
  }

  function htmlPreviewShell(path, channelName, nonce, interactive = false) {
    const encode = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
    const text = previewStrings();
    return `<!doctype html><html lang="${language}"><head><meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; script-src-attr ${interactive ? "'unsafe-inline'" : "'none'"}; style-src 'unsafe-inline'; frame-src about:; connect-src 'none'; base-uri 'none'; form-action 'none'">
      <meta name="referrer" content="no-referrer"><title>DV</title>
      <style>html,body{height:100%;margin:0;font:13px system-ui;background:#18181b;color:#f4f4f5}
      body{display:flex;flex-direction:column}header{padding:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      button{padding:7px 12px;background:#2563eb;color:white;border:0;border-radius:5px;cursor:pointer}
      button:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}
      #status{padding:0 10px 8px;overflow-wrap:anywhere}iframe{flex:1;width:100%;border:0;background:white;min-height:0}</style></head>
      <body><header><strong id="path"></strong><button id="refresh" type="button">${t('Actualizar desde disco')}</button>
      <span>${diskPreviewMode(interactive)}</span></header><div id="status" role="status" aria-live="polite">${t('Conectando con el panel...')}</div>
      <iframe sandbox="${interactive ? 'allow-scripts' : ''}" referrerpolicy="no-referrer" title="${t('Vista previa HTML aislada')}"></iframe>
      <script nonce="${nonce}">
      'use strict';
      const path = ${encode(path)}, name = ${encode(channelName)}, interactive = ${interactive};
      let text = ${encode(text)}, locale = ${encode(language)};
      document.title = 'DV · ' + path;
      document.getElementById('path').textContent = path;
      const status = document.getElementById('status'), frame = document.querySelector('iframe');
      const previewHTML = (${createPreviewHTMLConverter.toString()})();
      let channel, timer;
      const request = () => {
        clearTimeout(timer);
        status.textContent = text.reading;
        channel.postMessage({type:'refresh'});
        timer = setTimeout(() => {
          frame.removeAttribute('srcdoc');
          status.textContent = text.offline;
        }, 5000);
      };
      try {
        channel = new BroadcastChannel(name);
        channel.onmessage = ({data}) => {
          if (!data || typeof data !== 'object') return;
          if (data.type === 'language' && ['es','en','zh-CN'].includes(data.locale) && data.text &&
              Object.keys(text).every(key => typeof data.text[key] === 'string')) {
            locale = data.locale; text = data.text;
            document.documentElement.lang = locale;
            document.getElementById('refresh').textContent = text.refresh;
            document.querySelector('header span').textContent = interactive ? text.interactiveMode : text.mode;
            frame.title = text.frame;
          } else if (data.type === 'render' && typeof data.html === 'string' && /^[a-f0-9]{64}$/.test(data.hash)) {
            clearTimeout(timer);
            try {
              frame.srcdoc = previewHTML(data.html);
              status.textContent = text.updated + new Date().toLocaleTimeString(locale) + ' · SHA256 ' + data.hash.slice(0, 8) + text.saved;
            } catch (error) {
              frame.removeAttribute('srcdoc');
              status.textContent = text.error + error.message;
            }
          } else if (data.type === 'error' && typeof data.text === 'string') {
            clearTimeout(timer); frame.removeAttribute('srcdoc');
            status.textContent = text.error + data.text;
          }
        };
        document.getElementById('refresh').addEventListener('click', request);
        request();
        addEventListener('pagehide', () => { clearTimeout(timer); channel.close(); });
      } catch (error) {
        status.textContent = text.connectionError + error.message;
      }
      </script></body></html>`;
  }

  async function openHTMLPreview(path) {
    path = splitPath(path).join('/');
    if (!confirm(t`¿Abrir "${path}" con sus recursos del disco en una pestaña de vista previa?\nSin red; requiere mantener el panel abierto.`)) {
      throw new Error(t('ejecución cancelada'));
    }
    if (typeof BroadcastChannel !== 'function') throw new Error(t('el navegador no admite BroadcastChannel para conectar la vista previa'));
    const previous = htmlPreviews.get(path);
    if (previous && !previous.tab.closed) {
      previous.tab.focus();
      await updateHTMLPreview(previous);
      return t`Vista previa HTML actualizada en su pestaña: ${path}.`;
    }
    if (previous) closeHTMLPreview(previous);
    const interactive = requestPreviewScripts();
    let entry = null, channel = null, url = null, tab = null;
    try {
      const channelName = t('dv-preview-') + crypto.randomUUID();
      channel = new BroadcastChannel(channelName);
      const nonce = crypto.randomUUID().replaceAll('-', '');
      url = URL.createObjectURL(new Blob([htmlPreviewShell(path, channelName, nonce, interactive)], { type: 'text/html;charset=utf-8' }));
      // Navigate in the initial trusted click; detaching opener first prevents later navigation.
      tab = window.open(url, '_blank');
      if (!tab) throw new Error(t('el navegador bloqueó la pestaña; permite ventanas emergentes para DeepSeek y reintenta'));
      tab.opener = null;
      entry = { path, tab, channel, url, interactive, scriptNonce: nonce, dependencies: new Set(), revision: 0, timer: null, watch: null };
      htmlPreviews.set(path, entry);
      channel.onmessage = ({ data }) => {
        if (data?.type === 'refresh') return updateHTMLPreview(entry);
      };
      await editorSnapshot(path);
      entry.watch = setInterval(() => {
        if (tab.closed) closeHTMLPreview(entry);
      }, 5000);
      return t`Vista previa del disco abierta: ${path}.` + ' ' + diskPreviewMode(interactive);
    } catch (e) {
      if (entry) closeHTMLPreview(entry, { closeTab: true });
      else { channel?.close(); if (url) URL.revokeObjectURL(url); tab?.close(); }
      throw e;
    }
  }

  function consoleRunnerDocument(source, token) {
    const messages = {
      unserializable: t('[valor no serializable]'), output: t('limite de salida excedido'),
      startup: t('El Worker no pudo arrancar: posible error de sintaxis o bloqueo CSP/Trusted Types. Revisa la consola del navegador o prueba fuera del chat.'), timeout: t('tiempo limite de 3 segundos excedido')
    };
    const encode = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
    const workerSource = `
      const format = value => {
        if (typeof value === 'string') return value;
        try { return JSON.stringify(value) ?? String(value); }
        catch { return ${encode(messages.unserializable)}; }
      };
      let count = 0, chars = 0;
      for (const level of ['log','info','warn','error','debug']) {
        console[level] = (...args) => {
          const text = args.map(format).join(' ').slice(0, 4000);
          if (++count > 100 || (chars += text.length) > 20000) throw new Error(${encode(messages.output)});
          postMessage({type:'log', text:'[' + level + '] ' + text});
        };
      }
      onerror = event => { postMessage({type:'error', text:event.message}); };
      onunhandledrejection = event => { postMessage({type:'error', text:String(event.reason)}); };
      (async () => { ${source}\n })().then(() => postMessage({type:'done'}), error =>
        postMessage({type:'error', text:String(error.stack || error)}));
    `;
    const encoded = JSON.stringify(workerSource).replace(/</g, '\\u003c');
    return `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; connect-src 'none'; base-uri 'none'; form-action 'none'">
      <script>
      const token = ${JSON.stringify(token)};
      const emit = data => parent.postMessage({token, ...data}, '*');
      let worker, timer, url;
      const stop = () => { clearTimeout(timer); if(worker) worker.terminate(); if(url) URL.revokeObjectURL(url); };
      emit({type:'started'});
      try {
        url = URL.createObjectURL(new Blob([${encoded}], {type:'text/javascript'}));
        worker = new Worker(url);
        worker.onmessage = event => { emit(event.data); if(event.data.type !== 'log') stop(); };
        worker.onerror = event => { emit({type:'error',text:event.message || ${encode(messages.startup)}}); stop(); };
        timer = setTimeout(() => { emit({type:'error',text:${encode(messages.timeout)}}); stop(); }, ${CFG.RUN_TIMEOUT_MS});
        addEventListener('pagehide', stop);
      } catch(error) { emit({type:'error',text:String(error.message)}); stop(); }
      </script>`;
  }

  async function runFile(args) {
    const { pos } = parseArgs(args, {});
    if (pos.length !== 1) throw new Error(t('uso: run <archivo.html|archivo.js>'));
    const path = pos[0];
    if (isInternalPath(path)) throw new Error(t('no se ejecutan metadatos internos'));
    if (!/\.(html?|js)$/i.test(path)) throw new Error(t('motor no disponible; run admite HTML estático y JavaScript de consola, no Node/Python/shell'));
    if (/\.html?$/i.test(path)) return openHTMLPreview(path);
    const file = await (await requireFile(path)).getFile();
    if (file.size > CFG.MAX_RUN_BYTES) throw new Error(t('archivo supera 256 KB para run'));
    let source;
    try { source = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
    catch (e) { if (e.name === 'TypeError') throw new Error(t('run requiere texto UTF-8 válido')); throw e; }
    if (!confirm(t`¿Abrir "${path}" (${fmtBytes(file.size)}) en modo ${/\.js$/i.test(path) ? t('JavaScript de consola aislado, máximo 3 segundos') : t('vista previa HTML sin scripts')}? Sin acceso al disco, sesión ni red.`)) {
      throw new Error(t('ejecución cancelada'));
    }
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', /\.js$/i.test(path) ? 'allow-scripts' : '');
    frame.referrerPolicy = 'no-referrer';
    frame.style.display = 'none';
    const token = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const output = [];
      let count = 0, chars = 0, finished = false, runnerUrl = null, started = false;
      const finish = (error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        window.removeEventListener('message', receive);
        frame.remove();
        if (runnerUrl) URL.revokeObjectURL(runnerUrl);
        if (error) reject(new Error(`${path}: ${error}\n${output.join('\n')}`));
        else resolve(`Ejecutado: ${path}\n${output.join('\n') || t('(sin salida)')}\n[fin]`);
      };
      const receive = (event) => {
        if (finished || event.source !== frame.contentWindow || event.data?.token !== token) return;
        const data = event.data;
        if (data.type === 'started') started = true;
        else if (data.type === 'log' && typeof data.text === 'string') {
          if (++count > 100 || (chars += data.text.length) > 21000) { finish(t('limite de salida excedido')); return; }
          const text = data.text.slice(0, 4100);
          output.push(text);
          uiLog(text);
        } else if (data.type === 'error') finish(String(data.text).slice(0, 4000));
        else if (data.type === 'done') finish();
      };
      const timer = setTimeout(() => finish(started ?
        t('El Worker no respondió dentro del límite. Puede estar bloqueado por CSP/Trusted Types o haber agotado el tiempo; revisa la consola del navegador o prueba fuera del chat.') :
        t('El controlador JavaScript aislado no arrancó. El sitio puede bloquear scripts o iframes Blob con su CSP (comprobado en Gemini). No se pudo iniciar el archivo; pruébalo fuera del chat.')), CFG.RUN_TIMEOUT_MS + 1500);
      window.addEventListener('message', receive);
      try {
        const runnerBlob = new Blob([consoleRunnerDocument(source, token)], { type: 'text/html;charset=utf-8' });
        runnerUrl = URL.createObjectURL(runnerBlob);
        frame.src = runnerUrl;
        document.body.append(frame);
      } catch (error) { finish(error.message || String(error)); }
    });
  }

  def('run', 'Sistema', 'run <archivo.html|archivo.js>', 'HTML estático o consola JS aislada (sin Node/red/OPFS)', (ctx) => runFile(ctx.args));

  // Ficheros & Transacciones
  def('ls', 'Ficheros', 'ls [-R] [ruta]', 'Lista archivos', async (ctx) => {
    const { flags, pos } = parseArgs(ctx.args, { R: 'b' });
    if (pos.length > 1) throw new Error(t('uso: ls [-R] [ruta]'));
    const h = pos[0] ? await getHandle(pos[0]) : rootDir;
    if (!h) throw new Error(t`no existe: ${pos[0]}`);
    if (h.kind === 'file') return `${pos[0]} (${fmtBytes((await h.getFile()).size)})`;
    const rows = [];
    if (flags.R) {
      for await (const e of walk(h)) {
        rows.push(e.kind === 'dir' ? `${e.path}/` : `${e.path.padEnd(30)} ${fmtBytes((await e.handle.getFile()).size)}`);
      }
    } else {
      for await (const [name, handle] of h.entries()) {
        rows.push(handle.kind === 'directory' ? `${name}/` : `${name.padEnd(30)} ${fmtBytes((await handle.getFile()).size)}`);
      }
      rows.sort((a, b) => a.localeCompare(b));
    }
    return rows.join('\n') || t('(carpeta vacía)');
  });

  def('rm', 'Ficheros', 'rm [-r] <ruta>', 'Elimina una ruta tras confirmación (sin deshacer)', async (ctx) => {
    const { flags, pos } = parseArgs(ctx.args, { r: 'b' });
    if (pos.length !== 1) throw new Error(t('uso: rm [-r] <ruta>'));
    const parts = splitPath(pos[0]);
    if (!parts.length) throw new Error(t('no se puede borrar la raíz'));
    if (['.git', '.dv', '.dv_tmp'].includes(parts[0])) throw new Error(t('no se pueden borrar metadatos internos con rm'));
    const path = parts.join('/');
    const handle = await getHandle(path);
    if (!handle) throw new Error(t`no existe: ${path}`);
    if (handle.kind === 'directory' && !flags.r) throw new Error(t('para borrar una carpeta usa rm -r'));
    if (!confirm(t`¿Eliminar "${path}"${handle.kind === 'directory' ? ' y todo su contenido' : ''}? Esta operación no tiene deshacer automático.`)) {
      throw new Error(t('borrado cancelado; no se ha eliminado nada'));
    }
    await removePath(path, !!flags.r);
    if (await getHandle(path)) throw new Error(t`no se pudo verificar el borrado: ${path}`);
    return t`Eliminado: ${path}`;
  });

  def('cp', 'Ficheros', 'cp <origen> <destino>', 'Copia archivo y verifica SHA256; confirma reemplazo', (ctx) => copyOrMove(ctx.args, false));
  def('mv', 'Ficheros', 'mv <origen> <destino>', 'Copia verificada + borrado confirmado del origen', (ctx) => copyOrMove(ctx.args, true));

  def('write', 'Ficheros', 'write <file> <texto...>', 'Escritura atómica segura (Capa 2)', async (ctx) => {
    if (ctx.args.length < 2) throw new Error(t('uso: write <file> <texto...>'));
    const res = await atomicWrite(ctx.args[0], ctx.args.slice(1).join(' '));
    return `[Tx OK] ${ctx.args[0]} (${fmtBytes(res.bytes)}, SHA256: ${res.hash.slice(0, 8)}...)`;
  });

  def('save', 'Ficheros', 'save <file>', 'Guarda último resultado atómicamente', async (ctx) => {
    if (!ctx.args[0]) throw new Error(t('uso: save <file>'));
    if (!lastResult) throw new Error(t('no hay resultado previo'));
    const res = await atomicWrite(ctx.args[0], lastResult);
    return t`[Tx OK] Guardado ${ctx.args[0]} (${fmtBytes(res.bytes)})`;
  });

  def('cat', 'Texto', 'cat [file...]', 'Muestra contenido', async function* (ctx) {
    if (!ctx.args.length) { yield* source(ctx, null); return; }
    for (const f of ctx.args) yield* lines(f);
  });

  def('head', 'Texto', 'head [-n N] [file]', 'Primeras N líneas', async function* (ctx) {
    const { flags, pos } = parseArgs(ctx.args, { n: 'v' });
    const n = toInt(flags.n, 10, '-n');
    if (n === 0) return;
    let c = 0;
    for await (const l of source(ctx, pos[0])) { yield l; if (++c >= n) return; }
  });

  def('grep', 'Texto', 'grep [-i] [-n] [-F] <patrón> [archivo]', 'Busca regex o texto literal por líneas; acepta pipes', async function* (ctx) {
    const { flags, pos } = parseArgs(ctx.args, { i: 'b', n: 'b', F: 'b' });
    if (pos.length < 1 || pos.length > 2) throw new Error(t('uso: grep [-i] [-n] [-F] <patrón> [archivo]'));
    const re = makeRegex(pos[0], { ignoreCase: !!flags.i, fixed: !!flags.F });
    let line = 0;
    for await (const text of source(ctx, pos[1])) {
      line++;
      if (re.test(text)) yield flags.n ? `${line}: ${text}` : text;
    }
  });

  def('journal', 'Auditoría', 'journal [-n N]', 'Ver registro de transacciones (.dv/journal)', async (ctx) => {
    const { flags } = parseArgs(ctx.args, { n: 'v' });
    const n = toInt(flags.n, 10, '-n');
    try {
      const h = await requireFile('.dv/journal.jsonl');
      const lines = (await (await h.getFile()).text()).trim().split('\n').filter(Boolean);
      return lines.slice(-n).map(l => {
        const j = JSON.parse(l);
        return `[${j.timestamp.slice(11, 19)}] ${j.type}${j.status ? ` ${j.status}` : ''} -> ${j.path} (${j.bytes || 0} B, hash:${(j.newHash || '').slice(0, 7)})`;
      }).join('\n');
    } catch { return t('(registro de auditoría vacío)'); }
  });

  def('recover', 'Auditoría', 'recover', 'Revisa escrituras interrumpidas: completa, revierte o guarda copia; limpia temporales huérfanos', async (ctx) => {
    if (ctx.args.length) throw new Error(t('uso: recover'));
    return formatRecovery(await recoverTransactions());
  });

  def('edit', 'Ficheros', 'edit <archivo>', 'Abre el editor; si el archivo no existe, empieza uno en blanco para pegar código', async (ctx) => {
    if (ctx.args.length !== 1) throw new Error(t('uso: edit <archivo>'));
    if (editorOpen) throw new Error(t('cierra el editor actual antes de proponer otro cambio'));
    const target = await editorTarget(ctx.args[0]);
    ctx.openEditor(target);
    return target.create ? t`Archivo nuevo: ${target.path}. Pega o escribe el código y pulsa Crear archivo; no existe hasta guardarlo.` :
      t`Editor abierto: ${target.path}`;
  });

  // Git Local
  def('git', 'Git', 'git <init|status|add|commit|log|diff|show|restore|branch|checkout> [args]', 'Control de versiones local (sin remoto)', async (ctx) => {
    if (!ctx.args.length) throw new Error(t('uso: git <init|status|add|commit|log|diff|show|restore|branch|checkout>'));
    const sub = ctx.args[0].toLowerCase();
    const subArgs = ctx.args.slice(1);
    const { git, fs } = await getGit();
    if (['status', 'add', 'commit', 'log', 'diff', 'show', 'restore', 'branch', 'checkout'].includes(sub)) {
      const repository = await getHandle('.git');
      if (!repository) throw new Error(t('no hay repositorio Git. Usa: git init'));
      if (repository.kind !== 'directory') throw new Error(t('.git no es una carpeta; revisa el repositorio'));
    }

    switch (sub) {
      case 'init':
        await git.init({ fs, dir: '.', defaultBranch: 'main' });
        return t('Repositorio Git local inicializado (rama: main).');
      case 'status': {
        const matrix = await git.statusMatrix({ fs, dir: '.' });
        const rows = [];
        for (const [filepath, head, workdir, stage] of matrix) {
          if (isInternalPath(filepath) || (head === workdir && workdir === stage)) continue;
          rows.push(`${gitChangeDescription(head, workdir, stage).padEnd(18)} ${filepath}`);
        }
        return rows.length ? rows.join('\n') : t('Working tree limpio. Nada pendiente de confirmar.');
      }
      case 'add':
        if (!subArgs[0]) throw new Error(t('uso: git add <ruta|--all>'));
        if (subArgs[0] === '--all' || subArgs[0] === '.') {
          const c = await stageAllGitFiles(git, fs);
          return t`${c} archivos añadidos al staging area.`;
        }
        if (isInternalPath(subArgs[0])) throw new Error(t('no se pueden versionar metadatos internos'));
        await git.add({ fs, dir: '.', filepath: splitPath(subArgs[0]).join('/') });
        return t`Añadido al staging: ${subArgs[0]}`;
      case 'commit': {
        const { flags } = parseArgs(subArgs, { m: 'v' });
        if (!flags.m) throw new Error(t('uso: git commit -m "mensaje"'));
        const matrix = await git.statusMatrix({ fs, dir: '.' });
        if (!matrix.some(([path, head, , stage]) => !isInternalPath(path) && head !== stage)) {
          throw new Error(t('nada nuevo en staging. Usa: git add <archivo> o git add --all'));
        }
        const oid = await git.commit({
          fs, dir: '.', message: flags.m,
          author: { name: 'DV User', email: 'user@local.lan' }
        });
        const branch = await git.currentBranch({ fs, dir: '.' });
        return `[${branch || t('detached HEAD')} ${oid.slice(0, 7)}] ${flags.m}`;
      }
      case 'branch': {
        if (subArgs.length > 1 || subArgs[0]?.startsWith('-')) throw new Error(t('uso: git branch [nombre] (sin borrar, renombrar ni --force)'));
        if (!subArgs.length) {
          const current = await git.currentBranch({ fs, dir: '.' });
          const branches = await git.listBranches({ fs, dir: '.' });
          const rows = branches.map(name => `${name === current ? '*' : ' '} ${name}`);
          if (current && !branches.includes(current)) rows.unshift(t`* ${current} (sin commits)`);
          return rows.join('\n') || t('(sin ramas locales; HEAD separado)');
        }
        if (!await gitHeadOid(git, fs)) throw new Error(t('crea el primer commit antes de crear otra rama'));
        await git.branch({ fs, dir: '.', ref: subArgs[0] });
        return t`Rama creada: ${subArgs[0]}. No se cambió de rama; usa git checkout ${JSON.stringify(subArgs[0])}.`;
      }
      case 'checkout':
        if (subArgs.length !== 1 || subArgs[0].startsWith('-')) throw new Error(t('uso: git checkout <rama-local> (sin --force ni checkout de archivos/commits)'));
        if (editorOpen) throw new Error(t('cierra el editor antes de cambiar de rama'));
        return checkoutBranch(git, fs, subArgs[0]);
      case 'log': {
        if (!await gitHeadOid(git, fs)) return t('Sin commits aún en esta rama.');
        const commits = await git.log({ fs, dir: '.', depth: 10 });
        return commits.map(c => `${c.oid.slice(0, 7)} - ${c.commit.message.trim()} (${formatGitDate(c.commit.author?.timestamp)})`).join('\n');
      }
      case 'diff':
        return gitDiff(git, fs, subArgs);
      case 'show':
        return gitShow(git, fs, subArgs);
      case 'restore':
        return gitRestore(git, fs, subArgs, ctx);
      default:
        throw new Error(t`subcomando no implementado: ${sub}`);
    }
  });

  def('help', 'Sistema', 'help', 'Muestra ayuda de comandos', async () => {
    const groups = ['Ficheros', 'Git', 'Texto', 'Auditoría', 'Sistema'];
    const p = settings.prefix;
    const out = [t('COMANDOS DISCO VIRTUAL (100% Local por defecto):')];
    for (const g of groups) {
      out.push('', `[${t(g).toUpperCase()}]`);
      for (const c of REG.values()) {
        if (c.group === g) out.push(`  ${(p + c.usage).padEnd(36)} ${c.desc}`);
      }
    }
    out.push('',
      t('PIPES Y REDIRECCIONES:'),
      '  cat entrada.txt | head -n 10 > salida.txt',
      t('  > reemplaza; >> añade; .gz se comprime (sin >>).'),
      t('  rm pide confirmación y no ofrece deshacer automático.'),
      t('  Explorador: Eliminar por archivo o Eliminar todos (conserva Git/journal).'),
      t('  Editar: código numerado, buscar/reemplazar literal y diff antes de Aplicar.'),
      t('  Nuevo archivo… o edit pagina.html: editor en blanco; pega el código y pulsa Crear archivo (nunca sobrescribe).'),
      t('  Editor: Ctrl+S o 💾 Guardar muestran el diff y piden confirmación; Tab sangra (Shift+Tab sale); Esc cierra.'),
      t('  Escrituras con registro PREPARED/COMMITTED; al abrir DeepSeek se recuperan las interrumpidas (también: recover).'),
      t('  Ejecutar junto a Editar: mismo run local con confirmación, HTML estático o consola JS.'),
      t('  Primeros pasos prepara ejemplos sin ejecutarlos; Ampliar/Reducir conserva el comando escrito.'),
      t('  Descargar por archivo: bytes originales a la PC (también binarios/gzip), sin chat ni staging.'),
      t('  El navegador decide guardar/preguntar; descarga solicitada no confirma guardado en la PC.'),
      t('  checkpoint archivo [etiqueta]: copia bytes/hash hasta 256 KB; checkpoint --list muestra IDs.'),
      t('  restore ID: ruta original; texto existente en editor/diff, binario o ausente con confirmación.'),
      t('  Restore conserva checkpoint previo si sobrescribe; no hace staging/commit ni elimina copias.'),
      t('  git restore archivo: vuelve a la versión del staging; --source HEAD (o rama/SHA) usa un commit.'),
      t('  git restore muestra diff y crea checkpoint antes de escribir; --staged solo saca del staging.'),
      t('  Botón Revertir…: elige un archivo y vuelve a la versión del último commit, sin escribir comandos.'),
      t('  checkpoint --list [--file ruta] [--tag texto]: recientes primero; tag busca literal en etiqueta.'),
      t('  checkpoint show ID [--content] / diff ID1 ID2: consulta sin restaurar; contenido/diff solo UTF-8.'),
      t('  checkpoint delete ID / prune --keep N / prune --older-than 7d: borrado confirmado.'),
      t('  Limpieza protege más reciente por archivo y empates; --keep N cuenta globalmente, conserva además esas copias.'),
      t('  Editor UTF-8 hasta 256 KB; sin corrector automático ni commit automático.'),
      t('  view archivo --from 1 --to 40: líneas + hash; --share requiere confirmación.'),
      t('  propose propuesta.json o propose JSON entre comillas: candidato, diff y aprobación.'),
      t('  replace archivo "old" "new": bloque literal único; --all reemplaza todas las coincidencias no solapadas.'),
      t('  replace siempre prepara sin guardar (también --dry-run); --hash SHA256 exige esa versión.'),
      t('  Para bloques multilínea o propuestas IA usa propose con hash y JSON.'),
      t('  Chat: JSON dv abre revisión; comandos ! de una línea se ejecutan al pulsar el botón.'),
      t('  Aprobar parche del chat crea checkpoint previo y valida hash; no envía nada ni hace commit.'),
      t('  Compartir archivo incluye SHA256 y protocolo dv; no comparte archivos automáticamente.'),
      t('  grep [-i] [-n] [-F] patrón [archivo]: regex/literal, números de línea y pipes.'),
      t('  POSIBLE FUGA: solo correlaciona un intento manual reciente (5 s) con el comando exacto en el DOM.'),
      t('  Ignora carga automática sin intento; no verifica tráfico ni recepción del servidor.'),
      t('  JSON: path, hash completo, operation, old (bloque único), new (texto exacto).'),
      t('  operation: replace, insert-before, insert-after, append (sin old).'),
      t('  Saltos dentro del JSON: \\n o \\r\\n; no se añaden saltos automáticamente.'),
      t('  Explorar / Importar: elige archivos del equipo; guarda bytes en la raíz OPFS.'),
      t('  Importación local, máximo 512 MB por archivo; confirma reemplazos, sin staging.'),
      t('  cp/mv: solo archivos, destino completo; preservan bytes (también .gz).'),
      t('  cp confirma reemplazos; mv siempre confirma. Máximo verificable: 512 MB.'),
      t('  mv no es rename atómico: copia y verifica antes de borrar el origen.'),
      t('  run: HTML estático (sin scripts/recursos relativos); JS de consola aislado.'),
      t('  HTML abre pestaña conectada: autoactualiza al guardar, Actualizar desde disco y F5; mantén DeepSeek abierto.'),
      t('  JS: máximo 3 segundos, 100 mensajes/20 KB; usa await para trabajo asíncrono.'),
      t('  Sin DOM, Node, dependencias, red ni OPFS; salida disponible para save/--share.'),
      t('  git diff: staging vs archivos; git diff --staged: HEAD vs staging.'),
      t('  git diff [--staged] <ref>: referencia vs archivos o staging.'),
      t('  Diff unificado UTF-8; binarios solo informan cambio; sin seguimiento: git status.'),
      t('  git show [ref]: datos del commit (HEAD por defecto), no su diff.'),
      t('  git show ref:archivo: texto histórico UTF-8 hasta 256 KB; sin checkout ni restauración.'),
      t('  Referencias de commit: HEAD, nombre de rama o SHA completo; sin HEAD~N ni SHA abreviado.'),
      t('  El log resume 800 caracteres; git show HEAD:archivo | head -n 20 permite ver un fragmento.'),
      t('  Redirigir show guarda texto, no exporta bytes exactos (saltos/BOM pueden cambiar).'),
      t('  Git remoto todavía no está implementado.'),
      t('  Guardar cambios en Git: revisa lista y mensaje; confirma add --all + commit local, incluidos borrados.'),
      t('  El botón usa los archivos actuales, reemplaza staging anterior y excluye metadatos; no elimina comandos.'),
      t('  Ver cambios muestra estado, diff sin staging y diff staged; sin revertir automático.'),
      t('  git branch [nombre]: lista/crea ramas locales; * indica activa; crear no cambia de rama.'),
      t('  git checkout rama: confirma cambio; bloquea staging/cambios/archivos ignorados o sin seguimiento.'),
      t('  Sin --force, borrado de ramas, HEAD separado ni restauración Git de archivos.'),
      '',
      t('CANALES DE USO:'),
      t('  1. Panel Soberano: Entrada robusta y privada (0 tokens consumidos).'),
      t('  2. Atajo en Chat: Escribe !cmd directamente (se ejecuta local y no va al chat).'),
      t('  3. Compartir con IA:'),
      t`     - Añade --share para enviar el resumen del comando al chat.`,
      t`     - Añade --share-file <ruta> para transferir el archivo completo tras confirmación.`,
      t('     - Vista previa y confirmación antes de enviar; no se reemplazan borradores.'),
      t('     - Archivos UTF-8 sin NUL, máximo 64 KB; metadatos internos excluidos.'),
      t('     - "--share" entre comillas es texto literal; -- termina las opciones.'),
      t('     - Usa los botones correspondientes en el panel.'));
    return out.join('\n');
  });

  // ============================================================
  // EJECUTOR DEL PIPELINE
  // ============================================================
  async function execute(raw) {
    try {
      const segs = parsePipeline(Array.isArray(raw) ? raw : tokenize(raw.trim()));
      if (segs.some(seg => seg.argv[0].toLowerCase() === 'git' && seg.argv[1]?.toLowerCase() === 'checkout') &&
        (segs.length !== 1 || segs[0].redirect)) throw new Error(t('git checkout no admite pipes ni redirecciones'));
      const editorCommand = segs.find((seg) => ['propose', 'replace', 'checkpoint', 'restore', 'edit', 'recover'].includes(seg.argv[0].toLowerCase()));
      if (editorCommand && (segs.length !== 1 || segs[0].redirect)) {
        throw new Error(t`${editorCommand.argv[0]} no admite pipes ni redirecciones`);
      }
      let editorRequest = null;
      for (const seg of segs) {
        if (!REG.has(seg.argv[0].toLowerCase())) throw new Error(t`comando no reconocido: ${seg.argv[0]}`);
      }
      const redirect = segs[segs.length - 1].redirect;
      if (redirect) {
        if (!splitPath(redirect.file).length || isInternalPath(redirect.file)) throw new Error(t('destino de redirección no permitido'));
        if (redirect.mode === '>>' && /\.gz$/i.test(redirect.file)) throw new Error(t('no se puede añadir (>>) a un .gz'));
      }
      let stream = null;
      for (const seg of segs) {
        const cmd = REG.get(seg.argv[0].toLowerCase());
        if (!cmd) throw new Error(t`comando no reconocido: ${seg.argv[0]}`);
        const ctx = {
          args: seg.argv.slice(1), stdin: stream, warn: (m) => uiLog(`⚠ ${m}`, 'err'),
          openEditor: (proposal) => { editorRequest = proposal; }
        };
        stream = normalize(await cmd.run(ctx));
      }
      let text;
      if (redirect) {
        const writer = await openWriter(redirect.file, { append: redirect.mode === '>>' });
        try {
          for await (const l of stream) await writer.write(l + '\n');
          const bytes = await writer.close();
          text = t`Guardado: ${redirect.file} (${fmtBytes(bytes)} de texto)`;
        } catch (e) {
          await writer.abort();
          throw e;
        }
      } else {
        const parts = [];
        let chars = 0;
        for await (const l of stream) {
          chars += l.length + (parts.length ? 1 : 0);
          if (chars > CFG.MAX_COLLECT_CHARS) throw new Error(t('salida demasiado grande; usa head o redirige a un archivo'));
          parts.push(l);
        }
        text = parts.join('\n');
      }
      lastResult = text;
      return { ok: true, text, ...(editorRequest ? { editor: editorRequest } : {}) };
    } catch (e) {
      const text = `❌ ${e.message || String(e)}`;
      lastResult = text;
      return { ok: false, text };
    }
  }

  function isInternalPath(path) {
    const first = splitPath(path)[0];
    return ['.git', '.dv', '.dv_tmp'].includes(first);
  }

  function isRegisteredCommand(text) {
    if (!text.startsWith(settings.prefix)) return false;
    const first = text.slice(settings.prefix.length).trim().split(/[\s|>]/)[0].toLowerCase();
    return REG.has(first);
  }

  // ============================================================
  // ADAPTADOR DEL SITIO (CHAT)
  // ============================================================
  const visible = (el) => el && el.getClientRects().length > 0;
  const isEnabled = (b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true' &&
    !b.classList?.contains('ds-button--disabled');
  const normalizeChatText = (text) => text.replace(/\r\n?/g, '\n');

  // Selectores conocidos de otros sitios de chat (no solo DeepSeek), usados como
  // atajo antes de caer en la heurística genérica; si no coinciden con nada no afectan.
  const KNOWN_SEND_SELECTOR = '[data-testid="send-button"], [data-composer-submit], ' +
    'button[aria-label="Send message"], button[aria-label="Send prompt"], ' +
    '.send-button-container .send-button button, button.send-button';

  const adapter = {
    getInput() {
      const gemini = [...document.querySelectorAll('rich-textarea .ql-editor[contenteditable="true"]')].find(visible);
      if (gemini) return gemini;
      // Prioriza <textarea> (DeepSeek y la mayoría de sitios); si no hay ninguna
      // visible, cae a un contenteditable (p. ej. editores tipo ProseMirror).
      const pick = (sel) => [...document.querySelectorAll(sel)].filter(visible);
      let all = pick('textarea');
      if (!all.length) all = pick('[contenteditable="true"]');
      return all[0] || document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
    },
    getText(el) {
      if (el.matches?.('rich-textarea .ql-editor')) {
        const lines = [...el.querySelectorAll('p, li')];
        const read = (node) => {
          if (node.nodeName === 'BR') return '\n';
          return node.childNodes.length ? [...node.childNodes].map(read).join('') : node.textContent;
        };
        if (lines.length) return lines.map((line) =>
          line.childNodes.length === 1 && line.firstChild.nodeName === 'BR' ? '' : read(line)).join('\n');
      }
      return el.value !== undefined ? (el.value ?? '') : (el.textContent ?? '');
    },
    setText(el, text) {
      if (el.value !== undefined || el.tagName === 'TEXTAREA') {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(el, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      // contenteditable: execCommand sigue siendo la forma fiable de que editores
      // tipo ProseMirror/Lexical registren el cambio en su propio estado interno.
      el.focus();
      document.execCommand('selectAll');
      document.execCommand(text === '' ? 'delete' : 'insertText', false, text);
      if (this.getText(el) !== text) {
        el.textContent = text;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      }
    },
    findSend(input) {
      const known = [...document.querySelectorAll(KNOWN_SEND_SELECTOR)].find(visible);
      if (known) return known;
      // Heurística genérica (sirve para DeepSeek y cualquier sitio sin selectores
      // conocidos): sube por los ancestros y toma el último botón visible con icono.
      let n = input.parentElement;
      for (let d = 0; n && d < 8; d++, n = n.parentElement) {
        const btns = [...n.querySelectorAll('button, [role="button"]')].filter((b) => b.querySelector('svg') && visible(b));
        if (btns.length) return btns[btns.length - 1];
      }
      return null;
    },
    async sendToChat(text) {
      if (chatSending) throw new Error(t('hay otro envío al chat en curso'));
      // Textarea values normalize CRLF/CR to LF, including files created on Windows.
      text = normalizeChatText(text);
      const el = this.getInput();
      if (!el || !visible(el)) throw new Error(t('no se encontró una entrada de chat visible'));
      const previous = this.getText(el);
      if (previous !== '') throw new Error(t('hay un borrador en el chat; consérvalo o vacía la entrada antes de compartir'));
      chatSending = true;
      try {
        this.setText(el, text);
        await sleep(150);
        const btn = await waitFor(() => {
          if (!el.isConnected || this.getInput() !== el || this.getText(el) !== text) {
            throw new Error(t('la entrada del chat cambió; envío cancelado'));
          }
          const b = this.findSend(el);
          return b && isEnabled(b) ? b : null;
        }, CFG.SEND_TIMEOUT_MS);
        if (!btn) throw new Error(t('no se encontró un botón de envío habilitado; no se envió el mensaje'));
        if (!el.isConnected || this.getInput() !== el || this.getText(el) !== text || !isEnabled(btn)) {
          throw new Error(t('la entrada o el botón del chat cambió; envío cancelado'));
        }
        btn.click();
        const cleared = await waitFor(() => this.getInput() && this.getText(this.getInput()) === '', CFG.SEND_TIMEOUT_MS);
        if (!cleared) throw new Error(t('no se pudo verificar el envío; comprueba el chat antes de reintentar'));
      } catch (e) {
        if (el.isConnected && this.getText(el) === text) this.setText(el, previous);
        throw e;
      } finally {
        chatSending = false;
      }
    }
  };

  let chatSending = false;

  async function fileShareMessage(path) {
    if (!splitPath(path).length || isInternalPath(path)) throw new Error(t('archivo a compartir no permitido'));
    const file = await (await requireFile(path)).getFile();
    if (file.size > CFG.MAX_SHARE_FILE_BYTES) throw new Error(t('archivo supera 64 KB; comparte un resumen con head'));
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.includes(0)) throw new Error(t('no se comparten archivos binarios; usa un resumen de texto'));
    let content;
    try { content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch (e) {
      if (e.name === 'TypeError') throw new Error(t('el archivo no es texto UTF-8 válido'));
      throw e;
    }
    const fence = safeFence(content);
    const hash = await computeSha256(bytes);
    return t`[Archivo OPFS: ${JSON.stringify(path)}; ${fmtBytes(file.size)}]\nSHA256: ${hash}\n${fence}\n${content}\n${fence}\n` +
      t('Analiza este archivo. Si propones una corrección, devuelve un bloque Markdown con lenguaje dv y un único objeto JSON puro, sin comandos ni comillas de shell.\n') +
      t`Usa path=${JSON.stringify(path)} y hash="${hash}" exactamente; no inventes ni recalcules el hash.\n` +
      t('Campos: path, hash, operation, old, new. operation: replace, insert-before, insert-after o append (sin old).\n') +
      t('old debe ser texto exacto y coincidir una sola vez; new es texto exacto, no un diff ni código con puntos suspensivos. ') +
      t('Escapa saltos como \\n (o \\r\\n si el original los usa). Una propuesta por bloque y archivo. ') +
      t('Si falta contexto, pídelo; no supongas acceso al disco. El usuario revisará el diff y aprobará antes de guardar.');
  }

  async function sendWithPreview(message, { confirmSend = true } = {}) {
    message = normalizeChatText(message);
    const input = adapter.getInput();
    if (!input || !visible(input)) throw new Error(t('no se encontró una entrada de chat visible'));
    if (adapter.getText(input) !== '') throw new Error(t('hay un borrador en el chat; no se ha reemplazado'));
    if (confirmSend && !confirm(t`¿Compartir con el chat (${message.length} caracteres)?\nVista previa:\n${truncate(message, CFG.ATTACH_PREVIEW_CHARS)}`)) {
      throw new Error(t('envío cancelado; no se ha compartido nada'));
    }
    await adapter.sendToChat(message);
    uiLog(t('📤 El chat vació la entrada tras solicitar el envío; comprueba la respuesta del asistente.'), 'info');
  }

  async function shareFile(path) {
    if (busy) { uiLog(t('⏳ Hay una operación en curso; reintenta al terminar.'), 'err'); return; }
    setBusy(true);
    try { await sendWithPreview(await fileShareMessage(path), { confirmSend: false }); }
    catch (e) { uiLog(`❌ ${e.message}`, 'err'); }
    finally { setBusy(false); }
  }

  // ============================================================
  // EJECUCIÓN CONTROLADA (CANAL DUAL)
  // ============================================================
  let busy = false;
  function setBusy(value) {
    busy = value;
    ui?.updateState?.();
  }

  async function handleExecution(rawCommand, options = { forceShare: false, origin: 'panel' }) {
    if (busy) {
      uiLog(t('⏳ Hay una operación en curso...'), 'err');
      return;
    }

    let cmd = rawCommand.trim();
    if (cmd.startsWith(settings.prefix)) cmd = cmd.slice(settings.prefix.length).trim();
    if (!cmd.length) {
      uiLog(t('⚠ Comando vacío'), 'err');
      return;
    }

    // Historial según canal
    const hist = options.origin === 'panel' ? panelHistory : chatHistory;
    hist.push(cmd);
    if (hist.length > CFG.HISTORY_MAX) hist.shift();

    let editorRequest = null;
    setBusy(true);
    try {
      const parsed = parseSharing(cmd);
      const cleanCmd = parsed.command;

      if (options.origin === 'chat') {
        uiLog(t`$ ${cleanCmd}  [ejecutado localmente, no enviado al chat]`, 'cmd');
      } else {
        uiLog(`$ ${cleanCmd}`, 'cmd');
      }

      const res = await execute(parsed.tokens);
      editorRequest = res.editor || null;
      uiLog(truncate(res.text || t('(sin salida)'), 800), res.ok ? '' : 'err');

      const messages = [];
      if (parsed.share || options.forceShare) {
        const summary = truncate(res.text, 1200), fence = safeFence(summary);
        messages.push(t`[Diagnóstico DV: ${cleanCmd}]\n${fence}\n${summary}\n${fence}\nAnaliza este resultado.`);
      }
      if (parsed.file) {
        if (!res.ok) throw new Error(t('el comando falló; no se compartió el archivo'));
        messages.push(await fileShareMessage(parsed.file));
      }
      if (messages.length) {
        const directSummary = options.origin === 'panel' && options.forceShare === true &&
          options.directShare === true && !parsed.file;
        await sendWithPreview(messages.join('\n\n'), { confirmSend: !directSummary });
      }
    } catch (e) {
      uiLog(t`❌ Error: ${e.message}`, 'err');
    } finally {
      setBusy(false);
      ui?.refresh();
      if (editorRequest) {
        if (editorRequest.snapshot) await openCodeEditor(editorRequest.snapshot.path, editorRequest);
        else await openCodeEditor(editorRequest.path, null, { create: editorRequest.create });
      }
    }
  }

  // Interceptor del Chat y detector de escape
  // Interceptor del Chat como atajo ergonómico (sin observer invasivo)
  function isInsidePanel(node) {
    for (let current = node; current; current = current.parentNode || current.host) {
      if (current.id === CFG.HOST_ID || current.id === 'dv-code-editor') return true;
    }
    return false;
  }

  function parseChatProposal(text) {
    text = text.trim();
    if (text.length > CFG.MAX_RUN_BYTES * 12) throw new Error(t('bloque de propuesta demasiado grande'));
    let json = text;
    if (!text.startsWith('{')) {
      const prefixes = [...new Set([settings.prefix, '!'])];
      const prefix = prefixes.find((p) => text.startsWith(p + 'propose'));
      if (!prefix) throw new Error(t('solo se admite JSON dv o !propose con JSON inline'));
      const segs = parsePipeline(tokenize(text.slice(prefix.length)));
      const seg = segs[0];
      if (segs.length !== 1 || seg.redirect || seg.argv.length !== 2 || seg.argv[0] !== 'propose' ||
        !seg.argv[1].trim().startsWith('{')) throw new Error(t('chat: solo propose con un JSON inline, sin pipes, archivos ni opciones'));
      json = seg.argv[1];
    }
    let value;
    try { value = JSON.parse(json); }
    catch (e) { throw new Error(t`JSON de propuesta no válido: ${e.message}`); }
    return validateProposalValue(value);
  }

  async function prepareChatProposal(text) {
    if (busy || editorOpen) throw new Error(t('cierra el editor o espera a que termine la operación antes de revisar otro parche'));
    const proposal = await prepareProposal(parseChatProposal(text));
    if (busy || editorOpen) throw new Error(t('se abrió otra operación durante la preparación; reintenta al terminar'));
    return { ...proposal, checkpointBeforeSave: true, checkpointLabel: t('Antes de parche desde chat') };
  }

  function chatCodeLanguage(pre, code) {
    for (const el of [code, pre]) {
      const cls = String(el.className || '').split(/\s+/).find((c) => c.startsWith('language-'));
      if (cls) return cls.slice(9).toLowerCase();
      if (el.getAttribute('data-language')) return el.getAttribute('data-language').toLowerCase();
    }
    const label = pre.closest('.md-code-block')?.querySelector('.md-code-block-banner span') ||
      pre.closest('code-block')?.querySelector('.code-block-decoration span');
    return label ? label.textContent.trim().toLowerCase() : '';
  }

  function installChatCodeActions() {
    const actions = new Map();
    const scan = () => {
      for (const [pre, action] of actions) {
        if (!pre.isConnected || !action.code.isConnected || isInsidePanel(pre)) {
          action.bar.remove(); actions.delete(pre);
        }
      }
      for (const pre of document.querySelectorAll('pre')) {
        if (isInsidePanel(pre)) continue;
        const code = pre.querySelector('code') || pre;
        const text = code.textContent.trim();
        const userMessage = code.closest('[data-message-role="user"], [data-role="user"], [data-message-author-role="user"], user-query');
        const assistantMessage = code.closest(
          '[data-message-role="assistant"], [data-role="assistant"], [data-message-author-role="assistant"], .ds-markdown, model-response');
        const marked = chatCodeLanguage(pre, code) === 'dv';
        const isPropose = [settings.prefix, '!'].some((prefix) => text.startsWith(prefix + 'propose'));
        const isRunCommand = text.startsWith('!') && !text.includes('\n');
        // Gemini renders unknown fence languages (including dv) as "Code snippet".
        const geminiJson = code.closest('model-response') && code.closest('code-block') && text.startsWith('{');
        const eligible = !userMessage && assistantMessage && (marked || isPropose || isRunCommand || geminiJson);
        let action = actions.get(pre);
        if (action && (action.code !== code || !action.bar.isConnected)) {
          action.bar.remove(); actions.delete(pre); action = null;
        }
        if (!eligible) {
          action?.bar.remove(); actions.delete(pre); continue;
        }
        if (!action) {
          const bar = document.createElement('div');
          bar.className = 'dv-chat-patch-actions';
          bar.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0;font:12px system-ui;flex-wrap:wrap';
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = isRunCommand ? t('Ejecutar en DV') : t('Revisar parche en DV');
          button.style.cssText = 'padding:6px 10px;background:#047857;color:white;border:1px solid #065f46;border-radius:5px;cursor:pointer';
          const status = document.createElement('span');
          status.setAttribute('role', 'status');
          bar.append(button, status);
          (pre.closest('.md-code-block, code-block') || pre).before(bar);
          action = { bar, button, status, code, text: null, pending: false };
          actions.set(pre, action);
          button.addEventListener('click', async (e) => {
            e.preventDefault(); e.stopPropagation();
            if (action.pending) return;
            action.pending = true; button.disabled = true;
            try {
              if (!code.isConnected) throw new Error(t('el bloque ya no está en el chat'));
              const content = code.textContent.trim();
              if (content.startsWith('!') && !content.includes('\n')) {
                status.textContent = t`Ejecutando: ${content.slice(0, 40)}...`;
                await handleExecution(content.slice(1), { origin: 'chat' });
                status.textContent = t('Ejecución finalizada. Revisa el panel.');
                return;
              }
              const proposal = await prepareChatProposal(code.textContent);
              status.textContent = t`Propuesta: ${proposal.snapshot.path}. Revisa el diff; aún no guardada.`;
              uiLog(t`Parche desde chat: ${proposal.snapshot.path}. Archivo intacto; aprobación y checkpoint requeridos.`, 'info');
              if (!(await openCodeEditor(proposal.snapshot.path, proposal))) {
                throw new Error(t('no se pudo abrir el editor; consulta el error en el panel. Archivo intacto.'));
              }
            } catch (error) {
              status.textContent = t`No se preparó: ${error.message}`;
              uiLog(t`Parche desde chat: ${error.message}`, 'err');
            } finally {
              action.pending = false; action.text = null; scan();
            }
          });
        }
        action.button.textContent = isRunCommand ? t('Ejecutar en DV') : t('Revisar parche en DV');
        if (action.pending || action.text === text) continue;
        const changed = action.text !== null;
        action.text = text;
        try {
          if (isRunCommand) {
            action.button.disabled = false;
            action.button.title = t('Ejecutar comando local. Se mantienen las confirmaciones propias del comando. Revisa la salida en el panel.');
            if (changed || !action.status.textContent) action.status.textContent = action.button.title;
            continue;
          }
          parseChatProposal(text);
          action.button.disabled = false;
          action.button.title = t('Abrir diff local; al aprobar se crea checkpoint. No ejecuta código ni envía mensajes.');
          if (changed || !action.status.textContent) action.status.textContent = t('Revisión local con hash y checkpoint.');
        } catch (e) {
          action.button.disabled = true;
          action.button.title = e.message;
          action.status.textContent = t`Propuesta incompleta o inválida: ${e.message}`;
        }
      }
    };
    let scheduled = false;
    const observer = new MutationObserver((mutations) => {
      const relevant = mutations.some((m) => {
        const target = m.target.nodeType === Node.ELEMENT_NODE ? m.target : m.target.parentElement;
        if (!target || isInsidePanel(target) || target.closest('.dv-chat-patch-actions')) return false;
        return target.closest('pre, code-block, .md-code-block') || (m.type === 'attributes' && target.querySelector('pre')) ||
          [...(m.addedNodes || []), ...(m.removedNodes || [])].some((n) =>
            n.nodeType === Node.ELEMENT_NODE && (n.matches('pre, code') || n.querySelector('pre')));
      });
      if (!relevant || scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; scan(); }, 150);
    });
    observer.observe(document.body, {
      childList: true, characterData: true, subtree: true,
      attributes: true, attributeFilter: ['class', 'data-language', 'data-role', 'data-message-role', 'data-message-author-role']
    });
    refreshChatCodeActions = () => {
      for (const action of actions.values()) { action.text = null; action.status.textContent = ''; }
      scan();
    };
    scan();
  }

  function installInterceptors() {
    if (!document.body) throw new Error(t('no hay document.body; no se pueden instalar interceptores ni detector'));
    let attempted = null;
    const isInputTarget = (input, target) => input && (input === target || input.contains?.(target));
    const rememberAttempt = (input) => {
      const text = normalizeChatText(adapter.getText(input)).trim();
      attempted = isRegisteredCommand(text) ? { text, expires: Date.now() + 5000 } : null;
    };
    const checkAndSubmit = (input) => {
      const txt = adapter.getText(input).trim();
      if (!isRegisteredCommand(txt)) return false;
      const body = txt.slice(settings.prefix.length).trim();

      if (busy) {
        uiLog(t('⏳ Hay una operación en curso... El comando permanece en la entrada.'), 'err');
        return true;
      }

      adapter.setText(input, '');
      handleExecution(body, { origin: 'chat' });
      return true;
    };

    document.addEventListener('keydown', (e) => {
      if (!e.isTrusted || e.key !== 'Enter' || e.shiftKey) return;
      if (e.isComposing || e.keyCode === 229) return;
      const input = adapter.getInput();
      if (!isInputTarget(input, e.target)) return;
      rememberAttempt(input);
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (checkAndSubmit(input)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);

    document.addEventListener('click', (e) => {
      if (!e.isTrusted) return;
      const input = adapter.getInput();
      if (!input) return;
      const btn = adapter.findSend(input);
      if (btn && btn.contains(e.target)) {
        rememberAttempt(input);
        if (checkAndSubmit(input)) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }
    }, true);

    document.addEventListener('submit', (e) => {
      if (!e.isTrusted) return;
      const input = adapter.getInput();
      if (input && e.target.contains(input)) rememberAttempt(input);
    }, true);

    document.addEventListener('input', (e) => {
      if (e.isTrusted && isInputTarget(adapter.getInput(), e.target)) attempted = null;
    }, true);

    const observer = new MutationObserver((mutations) => {
      // Correlate with a recent trusted send attempt, never with history hydration.
      if (!attempted) return;
      if (Date.now() > attempted.expires) { attempted = null; return; }
      for (const m of mutations) {
        if (isInsidePanel(m.target)) continue;
        const nodes = m.type === 'characterData' ? [m.target.parentNode] : [m.target, ...m.addedNodes];
        for (const n of nodes) {
          if (n?.nodeType === Node.ELEMENT_NODE && n.isConnected) {
            const host = document.getElementById(CFG.HOST_ID);
            if (isInsidePanel(n) || (host && n.contains(host))) continue;
            const candidates = [n, ...(n.querySelectorAll?.('*') || [])];
            if (candidates.some((candidate) => !isInsidePanel(candidate) &&
              normalizeChatText(candidate.textContent || '').trim() === attempted.text &&
              candidate !== adapter.getInput())) {
              const text = attempted.text;
              attempted = null;
              uiLog(
                t`⚠ POSIBLE FUGA: Tras intentar enviar, apareció el comando exacto (${text.slice(0, 15)}...) fuera del panel. ` +
                t`Comprueba el chat; el DOM no confirma un envío al servidor.`,
                'err'
              );
              return;
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }
  // ============================================================
  // UI DEL PANEL SOBERANO
  // ============================================================
  let ui = null;
  const uiLog = (m, c) => { if (ui) ui.log(m, c); };

  // Algunos chats (p. ej. ChatGPT) reenfocan su propio composer ante cualquier
  // evento cuando el foco "visible" de la página no es un campo reconocible; un
  // host de shadow DOM cerrado no lo es (document.activeElement ve el host, no
  // el control interno), así que el foco puede escapar del diálogo sin que el
  // usuario haga nada. Este guardia lo recupera: sigue el último control
  // enfocado dentro de `scopeEl` y, si el foco sale del `host` mientras
  // `isActive()` sea verdadero, lo devuelve ahí.
  function installFocusTrap(host, scopeEl, initial, isActive) {
    let last = initial;
    const onInnerFocus = (e) => { last = e.target; };
    scopeEl.addEventListener('focusin', onInnerFocus);
    const onOuterFocus = (e) => {
      if (!isActive()) return;
      const path = e.composedPath ? e.composedPath() : [e.target];
      if (path.includes(host)) return;
      last?.focus?.();
    };
    document.addEventListener('focusin', onOuterFocus, true);
    return () => {
      scopeEl.removeEventListener('focusin', onInnerFocus);
      document.removeEventListener('focusin', onOuterFocus, true);
    };
  }

  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v !== false && v != null) el.setAttribute(k, String(v));
    }
    for (const kid of kids.flat()) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    if (tag === 'button') {
      if (!el.hasAttribute('type')) el.type = 'button';
      if (!el.hasAttribute('title')) el.title = props['aria-label'] || el.textContent;
    }
    return el;
  }

  const PANEL_CSS = `
    :host { all: initial; }
    #panel {
      position: fixed; top: 75px; right: 20px; width: 540px; box-sizing: border-box;
      background: #18181b; color: #f4f4f5; border-radius: 10px; border: 1px solid #3f3f46;
      font: 13px system-ui, sans-serif; box-shadow: 0 12px 36px rgba(0,0,0,.6);
      overflow: hidden; max-width: calc(100vw - 16px); z-index: 999999;
    }
    #header {
      background: #27272a; padding: 10px 12px; cursor: move; user-select: none;
      display: flex;flex-wrap:wrap;gap:6px; justify-content: space-between; align-items: center; font-weight: 600;
      border-bottom: 1px solid #3f3f46;
    }
    #body { padding: 12px; max-height: min(600px, calc(100dvh - 150px)); overflow-y: auto; }
    #panel.expanded { inset:16px!important;width:auto;max-width:none; }
    #panel.expanded #body { max-height:calc(100dvh - 100px); }
    #panel.expanded #files { max-height:30vh; }
    #panel.expanded #log { max-height:30vh; }
    #files { list-style: none; padding: 0; margin: 6px 0; max-height: 170px; overflow-y: auto; }
    #files li { padding: 6px; border-radius: 4px; display: flex; flex-wrap:nowrap;gap:4px;align-items:center;font-size: 11px; }
    #files li > span:first-child { flex:1 1 0;min-width:40px; }
    #files li > span:nth-child(2), #files li > button { flex-shrink:0;white-space:nowrap; }
    #files li:hover { background: #27272a; }
    #log {
      background: #09090b; color: #4ade80; font: 11px monospace; padding: 8px; border-radius: 6px;
      max-height: 140px; overflow-y: auto; margin: 8px 0; white-space: pre-wrap; word-break: break-all;
    }
    #log .err { color: #f87171; } #log .info { color: #38bdf8; } #log .cmd { color: #facc15; }
    .btn { background: #3b82f6; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; }
    .btn:hover { background: #2563eb; }
    .btn:disabled { opacity:.5;cursor:wait; }
    button:focus-visible { outline:2px solid #93c5fd;outline-offset:2px; }
    .btn-secondary { background: #3f3f46; color: #e4e4e7; }
    .btn-secondary:hover { background: #52525b; }
    .btn-share { background: #8b5cf6; }
    .btn-share:hover { background: #7c3aed; }
    .row { display: flex;flex-wrap:wrap; gap: 6px; align-items: center; margin-top: 8px; }
    
    /* CAMPO DE COMANDOS COMPLETO Y MÁS ALTO */
    .input-cmd {
      width: 100%; box-sizing: border-box; min-height: 58px; max-height: 180px; resize: vertical;
      background: #09090b; color: #f4f4f5; border: 1px solid #3f3f46; border-radius: 6px;
      padding: 8px; font-family: monospace; font-size: 12px; line-height: 1.4; display: block;
    }
    .input-cmd:focus { outline: 1px solid #3b82f6; border-color: #3b82f6; }
    .badge-local { background: #064e3b; color: #6ee7b7; padding: 2px 6px; border-radius: 4px; font-size: 10px; }

    /* DIÁLOGO INTERNO DE ARCHIVOS */
    .file-dialog {
      background: #27272a; border: 1px solid #3f3f46; border-radius: 6px; padding: 8px; margin-top: 6px; display: none;
    }
    .file-dialog select {
      width: 100%; background: #09090b; color: #fff; border: 1px solid #3f3f46; padding: 4px; border-radius: 4px; margin-bottom: 6px; font-size: 11px;
    }
    .new-file-name { width:100%;box-sizing:border-box;background:#09090b;color:#f4f4f5;border:1px solid #3f3f46;border-radius:4px;padding:6px;font:12px monospace; }
    .new-file-name:focus { outline:1px solid #3b82f6;border-color:#3b82f6; }
    .git-overlay { position:fixed;inset:0;z-index:1000002;background:#0009;display:none;align-items:center;justify-content:center;padding:16px;box-sizing:border-box; }
    .git-modal { width:min(860px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:#18181b;color:#f4f4f5;border:1px solid #52525b;border-radius:10px;padding:18px;box-sizing:border-box;font:13px system-ui; }
    .git-modal pre { max-height:35vh;overflow:auto;background:#09090b;padding:10px;white-space:pre-wrap;overflow-wrap:anywhere;font:12px monospace; }
    .git-modal input { width:100%;box-sizing:border-box;background:#09090b;color:white;border:1px solid #52525b;border-radius:5px;padding:8px;margin:6px 0; }
    .git-modal ul { max-height:25vh;overflow:auto;padding-left:20px;overflow-wrap:anywhere; }
    .git-badge { font-size:11px;overflow-wrap:anywhere; }
    .git-save { max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
    .language-select { background:#18181b;color:#f4f4f5;border:1px solid #52525b;border-radius:5px;padding:4px;font:12px system-ui; }
    .about-btn { background:transparent;color:#a1a1aa;border:1px solid #3f3f46;border-radius:50%;width:22px;height:22px;padding:0;cursor:pointer;font-size:12px;line-height:1; }
    .about-btn:hover { color:#f4f4f5;border-color:#71717a; }
    .about-dialog { font-size:12px;line-height:1.5; }
    .about-dialog blockquote { margin:8px 0;padding-left:8px;border-left:3px solid #8b5cf6;color:#d4d4d8;font-style:italic; }
    .about-dialog p { margin:6px 0; }
    .about-dialog a { color:#93c5fd; }
  `;

  function buildPanel(previous = {}) {
    const host = document.createElement('div');
    host.id = CFG.HOST_ID;
    host.lang = language;
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.append(h('style', {}, PANEL_CSS));

    const logEl = h('div', { id: 'log' });
    if (previous.logs) logEl.append(...previous.logs);
    const filesEl = h('ul', { id: 'files' });
    const localFileInput = h('input', {
      type: 'file', multiple: true, hidden: true,
      'aria-label': t('Seleccionar archivos para importar al disco virtual'),
      onchange: async () => {
        const files = [...localFileInput.files];
        localFileInput.value = '';
        if (files.length) await importLocalFiles(files);
      }
    });
    const btnImport = h('button', {
      class: 'btn btn-secondary', title: t('Elegir archivos de la PC y copiarlos al disco local; no se comparten'), onclick: () => {
        if (busy) { uiLog(t('⏳ Hay una operación en curso; espera antes de importar.'), 'err'); return; }
        localFileInput.click();
      }
    }, t('Explorar / Importar archivos…'));
    // Inline form instead of prompt(): some browsers and embedded views block native dialogs.
    const newFileName = h('input', {
      type: 'text', class: 'new-file-name', spellcheck: 'false',
      'aria-label': t('Nombre del archivo (puede incluir carpeta, ej. web/index.html):'), placeholder: 'pagina.html'
    });
    const hideNewFile = () => { newFileForm.style.display = 'none'; };
    const submitNewFile = async () => {
      if (await createFileFromPanel(newFileName.value)) { hideNewFile(); newFileName.value = ''; }
    };
    newFileName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submitNewFile(); }
      else if (e.key === 'Escape') { e.preventDefault(); hideNewFile(); }
    });
    const newFileForm = h('div', { class: 'file-dialog new-file-form', role: 'group', 'aria-label': t('Nuevo archivo…') },
      h('div', { style: 'font-size:11px;color:#a1a1aa;margin-bottom:4px;' }, t('Nombre del archivo (puede incluir carpeta, ej. web/index.html):')),
      newFileName,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: submitNewFile }, t('Abrir editor')),
        h('button', { class: 'btn btn-secondary', onclick: hideNewFile }, t('Cancelar'))));
    const showNewFile = () => {
      if (busy || editorOpen) { uiLog(t('Ya hay una operación o editor abierto.'), 'err'); return; }
      newFileForm.style.display = 'block';
      if (!newFileName.value) newFileName.value = 'pagina.html';
      newFileName.focus(); newFileName.select?.();
    };
    const btnNewFile = h('button', {
      class: 'btn btn-secondary', title: t('Crear un archivo en blanco y abrirlo en el editor para pegar código'),
      onclick: showNewFile
    }, t('Nuevo archivo…'));
    const cmdInput = h('textarea', {
      class: 'input-cmd',
      'aria-label': t('Comando local'),
      placeholder: t('Comandos locales... (Enter ejecuta, Shift+Enter nueva línea)\nEj: !git status · !ls · !write f.txt "hola"')
    });
    cmdInput.value = previous.draft || '';
    const languageSelect = h('select', {
      class: 'language-select',
      'aria-label': t('Idioma'), title: t('Idioma'),
      onchange: () => {
        const next = languageSelect.value;
        if (busy || editorOpen || gitLoading || gitOverlay.style.display === 'flex') {
          languageSelect.value = language; return;
        }
        try { setLanguage(next); }
        catch (e) {
          languageSelect.value = language;
          uiLog(t`No se pudo guardar el idioma: ${e.message}`, 'err'); return;
        }
        const state = {
          draft: cmdInput.value, logs: [...logEl.childNodes], histIdx, collapsed, expanded,
          panelStyle: panel.style.cssText
        };
        host.remove();
        ui = buildPanel(state);
        refreshChatCodeActions();
        for (const entry of htmlPreviews.values()) {
          if (entry.tab.closed) { closeHTMLPreview(entry); continue; }
          entry.channel.postMessage({ type: 'language', locale: language, text: previewStrings() });
          updateHTMLPreview(entry);
        }
      }
    }, h('option', { value: 'es' }, 'Español'),
      h('option', { value: 'en' }, 'English'),
      h('option', { value: 'zh-CN' }, '简体中文'));
    languageSelect.value = language;
    const stateEl = h('span', { class: 'badge-local', role: 'status', 'aria-live': 'polite' }, t('Listo · local'));
    let gitState = null, gitReview = null, gitLoading = false, refreshGeneration = 0;
    const gitBadge = h('span', { class: 'git-badge', role: 'status', 'aria-live': 'polite' }, t('Git: consultando...'));
    const gitNotice = h('p', { role: 'status', 'aria-live': 'polite' });
    const gitPaths = h('ul', { 'aria-label': t('Archivos incluidos en el commit') });
    const gitDiffText = h('pre', { 'aria-label': t('Estado y diferencias Git'), style: 'display:none' });
    const gitMessage = h('input', { id: 'dv-git-message', type: 'text', 'aria-label': t('Mensaje del commit') });
    const closeGit = () => {
      if (busy || gitLoading) return;
      gitOverlay.style.display = 'none'; panel.inert = false; gitReview = null; btnGitSave.focus();
      updateState();
    };
    const loadGitReview = async () => {
      if (busy || editorOpen || gitLoading) {
        uiLog(t('Cierra el editor o espera antes de revisar Git.'), 'err'); return;
      }
      gitLoading = true; gitReview = null; updateState();
      gitOverlay.style.display = 'flex';
      panel.inert = true;
      gitNotice.textContent = t('Verificando archivos y staging...');
      gitPaths.replaceChildren(); gitDiffText.style.display = 'none';
      setBusy(true);
      try {
        const review = await getGitStatus({ capture: true });
        if (!review.initialized) throw new Error(t('Git no está inicializado; cierra y pulsa Inicializar Git local'));
        gitReview = review;
        for (const change of review.changes) {
          const item = h('li', {}, `${change.path} — ${change.description} `);
          if (change.head !== 0) item.append(h('button', {
            class: 'btn btn-secondary git-revert', style: 'padding:1px 6px;font-size:10px;margin-left:6px;',
            'aria-label': t`Revertir ${change.path} a HEAD`,
            title: t('Volver a la versión del último commit: muestra el diff y crea checkpoint antes de escribir'),
            onclick: () => revertGitFile(change.path)
          }, t('Revertir')));
          gitPaths.append(item);
        }
        gitNotice.textContent = t`Rama: ${review.branch}. ${review.changes.length} archivo(s). ` +
          t('Se guardan las versiones actuales y los borrados de esta lista. El staging anterior se reemplaza por esos archivos actuales. ') +
          t('Los archivos ignorados sin seguimiento y metadatos internos se excluyen. No sube nada a un servidor.');
        if (!gitMessage.value.trim()) gitMessage.value = review.changes.length === 1 ?
          t`${review.changes[0].path}: cambios` : t`Guardar ${review.changes.length} archivos`;
      } catch (e) {
        gitNotice.textContent = t`No se pudo preparar: ${e.message}`;
        uiLog(t`Git: ${e.message}`, 'err');
      } finally {
        gitLoading = false; setBusy(false); updateState();
        if (gitReview) gitMessage.focus(); else btnGitClose.focus();
      }
    };
    const btnGitSave = h('button', {
      class: 'btn git-save', disabled: true,
      title: t('Revisar todos los cambios y confirmar un commit Git local; no sube archivos ni elimina comandos'),
      onclick: async () => {
        if (busy || editorOpen || gitLoading) { uiLog(t('Espera o cierra el editor antes de versionar.'), 'err'); return; }
        if (gitState && !gitState.initialized) {
          setBusy(true);
          try {
            const result = await execute('git init');
            if (!result.ok) throw new Error(result.text);
            uiLog(result.text, 'info');
          } catch (e) { uiLog(t`Git: ${e.message}`, 'err'); return; }
          finally { setBusy(false); await refresh(); }
        }
        gitMessage.value = '';
        await loadGitReview();
      }
    }, t('Guardar cambios en Git'));
    const btnGitDiff = h('button', {
      class: 'btn btn-secondary', disabled: true, onclick: async () => {
        await loadGitReview();
        if (gitReview) await showGitDiff();
      }
    }, t('Ver cambios'));
    const btnGitRevert = h('button', {
      class: 'btn btn-secondary', disabled: true,
      title: t('Elige en la lista qué archivo volver a la versión del último commit'),
      onclick: async () => {
        await loadGitReview();
        if (gitReview) gitNotice.textContent = t('Pulsa Revertir junto al archivo que quieres volver a la versión del último commit. Verás el diff antes de escribir y se creará un checkpoint.');
        gitPaths.querySelector('.git-revert')?.focus?.();
      }
    }, t('Revertir…'));
    async function revertGitFile(path) {
      if (busy || gitLoading) return;
      gitOverlay.style.display = 'none'; panel.inert = false; gitReview = null; updateState();
      await handleExecution(`git restore --source HEAD ${quoteCommandPath(path)}`, { origin: 'panel', forceShare: false });
    }
    const confirmGit = h('button', {
      class: 'btn', disabled: true, onclick: async () => {
        try {
          const oid = await saveGitChanges(gitReview, gitMessage.value);
          gitNotice.textContent = t`Commit local verificado: ${oid.slice(0, 7)}.`;
          gitReview = null; gitOverlay.style.display = 'none'; panel.inert = false; btnGitSave.focus();
        } catch (e) {
          gitNotice.textContent = t`No se completó el guardado: ${e.message}`;
          uiLog(t`Git: ${e.message}`, 'err');
          gitReview = null;
        } finally { updateState(); }
      }
    }, t('Confirmar commit local'));
    gitMessage.addEventListener('input', () => updateState());
    const btnGitRefresh = h('button', { class: 'btn btn-secondary', onclick: loadGitReview }, t('Actualizar lista'));
    const btnGitReviewDiff = h('button', { class: 'btn btn-secondary', onclick: () => showGitDiff() }, t('Ver diferencias'));
    const btnGitClose = h('button', { class: 'btn btn-secondary', onclick: closeGit }, t('Cancelar'));
    async function showGitDiff() {
      if (busy || gitLoading || !gitReview) return;
      gitLoading = true; setBusy(true);
      try {
        const { git, fs } = await getGit();
        gitDiffText.textContent = t('Archivos nuevos sin seguimiento: consulta la lista (no aparecen en git diff).\n\n') +
          'WORKING TREE vs STAGING:\n' + await gitDiff(git, fs, []) +
          '\n\nSTAGING vs HEAD:\n' + await gitDiff(git, fs, ['--staged']);
        gitDiffText.style.display = 'block';
      } catch (e) { gitNotice.textContent = t`No se pudo mostrar el diff: ${e.message}`; uiLog(t`Git diff: ${e.message}`, 'err'); }
      finally { gitLoading = false; setBusy(false); }
    }
    const gitOverlay = h('div', { class: 'git-overlay' },
      h('section', { class: 'git-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('Guardar cambios en Git local') },
        h('h2', {}, t('Guardar cambios en Git local')),
        gitNotice, gitPaths, gitDiffText,
        h('label', { for: 'dv-git-message' }, t('Mensaje del commit')), gitMessage,
        h('div', { class: 'row' }, btnGitRefresh, btnGitReviewDiff, confirmGit, btnGitClose)));
    gitOverlay.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); closeGit(); }
      if (e.key === 'Tab') {
        const controls = [...gitPaths.querySelectorAll('.git-revert'), gitMessage, btnGitRefresh, btnGitReviewDiff, confirmGit, btnGitClose].filter(el => !el.disabled);
        const first = controls[0], last = controls.at(-1);
        if (e.shiftKey && e.target === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && e.target === last) { e.preventDefault(); first.focus(); }
      }
    });
    for (const type of ['keyup', 'keypress']) gitOverlay.addEventListener(type, (e) => e.stopPropagation());
    installFocusTrap(host, gitOverlay, gitMessage, () => gitOverlay.style.display === 'flex');
    const toggleEl = h('button', { class: 'btn btn-secondary', 'aria-label': t('Contraer panel'), 'aria-expanded': 'true' }, t('Contraer'));
    const expandEl = h('button', { class: 'btn btn-secondary', 'aria-label': t('Ampliar panel'), 'aria-pressed': 'false' }, t('Ampliar'));
    const headerEl = h('div', { id: 'header' },
      h('div', {},
        h('span', {}, `💾 DV v${CFG.VERSION} `),
        h('span', { class: 'badge-local' }, t('Panel Soberano'))
      ),
      h('div', { class: 'row' }, stateEl, languageSelect, expandEl, toggleEl),
      h('div', { class: 'row', style: 'width:100%;cursor:default' }, gitBadge, btnGitSave, btnGitDiff, btnGitRevert)
    );

    let histIdx = previous.histIdx ?? -1;
    const submitPanel = (forceShare = false) => {
      const val = cmdInput.value.trim();
      if (!val) return;
      if (busy) {
        uiLog(t('⏳ Hay una operación en curso... El comando permanece en la entrada.'), 'err');
        return;
      }
      cmdInput.value = '';
      histIdx = -1;
      handleExecution(val, { forceShare, directShare: forceShare, origin: 'panel' });
    };
    cmdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!e.isComposing && e.keyCode !== 229) submitPanel();
      } else if (e.key === 'ArrowUp' && cmdInput.selectionStart === 0) {
        if (!panelHistory.length) return;
        if (histIdx === -1) histIdx = panelHistory.length - 1;
        else if (histIdx > 0) histIdx--;
        cmdInput.value = panelHistory[histIdx] || '';
      } else if (e.key === 'ArrowDown' && cmdInput.selectionStart === cmdInput.value.length) {
        if (histIdx !== -1 && histIdx < panelHistory.length - 1) {
          histIdx++;
          cmdInput.value = panelHistory[histIdx];
        } else {
          histIdx = -1;
          cmdInput.value = '';
        }
      }
    });

    const btnExec = h('button', { class: 'btn', title: t('Ejecutar el comando en el navegador sin enviarlo a la IA'), onclick: () => submitPanel() }, t('Ejecutar'));

    const btnShare = h('button', { class: 'btn btn-share', title: t('Ejecutar y enviar directamente el resumen al chat, sin vista previa; no reemplaza borradores del chat'), onclick: () => submitPanel(true) }, t('Ejecutar + Compartir'));

    // DIÁLOGO INTEGRADO PARA COMPARTIR ARCHIVO
    const fileSelect = h('select', { 'aria-label': t('Archivo a compartir') });
    const shareNotice = h('div', { style: 'font-size:11px; margin:6px 0;' },
      t('Máximo 64 KB por archivo; solo texto UTF-8. Los archivos mayores se muestran deshabilitados.'));
    const confirmFileShare = h('button', {
      class: 'btn btn-share', title: t('Enviar directamente el archivo seleccionado al chat, sin confirmación adicional; no reemplaza borradores del chat'), onclick: async () => {
        const path = fileSelect.value;
        if (!path || fileSelect.selectedOptions[0]?.disabled) {
          uiLog(t('Selecciona un archivo de hasta 64 KB; para uno mayor comparte un resumen con head.'), 'err');
          return;
        }
        fileDialog.style.display = 'none';
        await shareFile(path);
      }
    }, t('Enviar archivo al chat'));
    const fileDialog = h('div', { class: 'file-dialog' },
      h('div', { style: 'font-size:11px; margin-bottom:4px;' }, t('Selecciona archivo a compartir:')),
      fileSelect, shareNotice,
      h('div', { style: 'display:flex; justify-content:flex-end; gap:6px;' },
        h('button', { class: 'btn btn-secondary', onclick: () => { fileDialog.style.display = 'none'; } }, t('Cancelar')),
        confirmFileShare
      )
    );

    function populateShareFiles(files) {
      const previous = fileSelect.value;
      fileSelect.replaceChildren();
      if (!files.length) {
        fileDialog.style.display = 'none';
        uiLog(t('No hay archivos de usuario para compartir.'), 'err');
        return;
      }
      for (const f of files) {
        const oversized = f.size > CFG.MAX_SHARE_FILE_BYTES;
        fileSelect.append(h('option', { value: f.path, disabled: oversized },
          `${f.path} (${fmtBytes(f.size)}, ${f.size} B)${oversized ? t(' — supera 64 KB; comparte un resumen') : ''}`));
      }
      const available = files.find((f) => f.path === previous && f.size <= CFG.MAX_SHARE_FILE_BYTES) ||
        files.find((f) => f.size <= CFG.MAX_SHARE_FILE_BYTES);
      fileSelect.value = available?.path || '';
      confirmFileShare.disabled = !available;
      shareNotice.textContent = available
        ? t('Enviar archivo al chat comparte directamente el texto completo, sin confirmación adicional. Máximo 64 KB; solo UTF-8. Los mayores aparecen deshabilitados. Para un resumen: head -n 30 "archivo" --share.')
        : t('Todos los archivos superan 64 KB. No se ocultan: comparte un resumen con head -n 30 "archivo" --share.');
      fileDialog.style.display = 'block';
    }

    const btnOpenShareDialog = h('button', {
      class: 'btn btn-secondary', onclick: async () => {
        try {
          populateShareFiles((await listFiles()).filter((f) => !isInternalPath(f.path)));
        } catch (e) {
          uiLog(t`❌ No se pudieron listar archivos: ${e.message}`, 'err');
        }
      }
    }, t('Compartir archivo...'));

    const helpText = h('pre', { style: 'white-space:pre-wrap; overflow-wrap:anywhere; max-height:260px; overflow:auto; font:11px monospace;' });
    const helpDialog = h('div', {
      class: 'file-dialog', role: 'region', 'aria-label': t('Ayuda de comandos')
    },
      h('div', {}, t('Comandos disponibles (ejecución local por defecto)')),
      helpText,
      h('button', { class: 'btn btn-secondary', onclick: () => { helpDialog.style.display = 'none'; } }, t('Cerrar ayuda'))
    );
    const btnHelp = h('button', {
      class: 'btn btn-secondary', onclick: async () => {
        try {
          helpText.textContent = await REG.get('help').run();
          helpDialog.style.display = 'block';
          helpDialog.scrollIntoView({ block: 'nearest' });
        } catch (e) { uiLog(t`❌ No se pudo mostrar ayuda: ${e.message}`, 'err'); }
      }
    }, t('Ayuda'));

    const prepareExample = (command) => {
      if (cmdInput.value && !confirm(t('¿Reemplazar el comando que estás preparando?'))) return;
      cmdInput.value = command;
      histIdx = -1;
      cmdInput.focus();
    };
    const welcome = h('section', {
      class: 'file-dialog', role: 'region', 'aria-label': t('Primeros pasos')
    },
      h('strong', {}, t('Bienvenido a loopwork')),
      h('p', {}, t('Crea un archivo nuevo, importa uno o prepara un ejemplo. Nada se ejecuta ni se comparte por abrir esta guía.')),
      h('div', { class: 'row' },
        h('button', { class: 'btn', title: t('Crear un archivo en blanco y abrirlo en el editor para pegar código'), onclick: showNewFile }, t('Nuevo archivo…')),
        h('button', { class: 'btn btn-secondary', title: t('Preparar !ls para listar archivos; luego pulsa Ejecutar'), onclick: () => prepareExample('!ls') }, t('Ver archivos: !ls')),
        h('button', { class: 'btn btn-secondary', title: t('Preparar consulta del estado Git; requiere git init previo'), onclick: () => prepareExample('!git status') }, t('Estado: !git status')),
        h('button', { class: 'btn btn-secondary', title: t('Preparar el comando de ayuda, sin ejecutarlo'), onclick: () => prepareExample('!help') }, t('Comandos: !help'))),
      h('p', {}, t('Editar → revisar diff → aprobar. Descarga copias importantes: borrar datos del sitio también elimina el disco y Git.')),
      h('button', {
        class: 'btn', onclick: () => {
          welcome.style.display = 'none';
          try { localStorage.setItem(CFG.WELCOME_KEY, 'seen'); }
          catch (e) { uiLog(t`No se pudo guardar la preferencia de bienvenida: ${e.message}`, 'err'); }
        }
      }, t('Entendido'))
    );
    const showWelcome = () => {
      welcome.style.display = 'block';
      welcome.scrollIntoView({ block: 'nearest' });
    };
    const btnWelcome = h('button', { class: 'btn btn-secondary', onclick: showWelcome }, t('Primeros pasos'));
    helpDialog.append(h('button', { class: 'btn btn-secondary', onclick: showWelcome }, t('Ver introducción')));

    const btnAboutClose = h('button', {
      class: 'btn btn-secondary', onclick: () => {
        aboutDialog.style.display = 'none'; btnAbout.setAttribute('aria-expanded', 'false'); btnAbout.focus();
      }
    }, t('Cerrar'));
    const aboutDialog = h('section', { class: 'file-dialog about-dialog', role: 'region', 'aria-label': t('Acerca de este proyecto') },
      h('strong', {}, t('Un proyecto de Geeknome · División de Informática')),
      h('blockquote', {}, t('“La IA propone, el usuario ejecuta, ambos observan en vivo.”')),
      h('p', {}, h('a', {
        href: CFG.ABOUT_URL, target: '_blank', rel: 'noopener noreferrer',
        title: t('Visitar Geeknome (se abre en una pestaña nueva)')
      }, 'geeknome.com')),
      h('p', {}, t`Autor: ${'Germán Peña'}`, ' · © 2026 Geeknome'),
      h('div', { style: 'display:flex;justify-content:flex-end;' }, btnAboutClose));
    const btnAbout = h('button', {
      class: 'about-btn', 'aria-label': t('Acerca de'), 'aria-expanded': 'false', onclick: () => {
        const open = aboutDialog.style.display !== 'block';
        aboutDialog.style.display = open ? 'block' : 'none';
        btnAbout.setAttribute('aria-expanded', String(open));
        if (open) { aboutDialog.scrollIntoView({ block: 'nearest' }); btnAboutClose.focus(); }
      }
    }, 'ⓘ');

    const storageLabelEl = h('span', { style: 'color:#a1a1aa; font-size:11px;' }, storageModeLabel());
    const btnConnectFolder = h('button', {
      class: 'btn btn-secondary', style: 'padding:2px 6px; font-size:10px;',
      title: t('Conectar una carpeta real de tu PC; reemplaza OPFS como almacenamiento mientras esté activa'),
      onclick: async () => {
        if (busy) return;
        setBusy(true);
        try { await connectLocalFolder(); uiLog(t`Carpeta real conectada: ${localDirName}`, 'info'); }
        catch (e) { uiLog(t`❌ Carpeta real: ${e.message}`, 'err'); }
        finally { setBusy(false); updateStorageUI(); await ui?.refresh(); }
      }
    }, t('Usar carpeta real…'));
    const btnReconnectFolder = h('button', {
      class: 'btn btn-secondary', style: 'padding:2px 6px; font-size:10px;',
      title: t('La carpeta real guardada perdió el permiso de escritura; reconéctala para seguir usándola'),
      onclick: async () => {
        if (busy) return;
        setBusy(true);
        try { await reconnectLocalFolder(); uiLog(t`Carpeta real reconectada: ${localDirName}`, 'info'); }
        catch (e) { uiLog(t`❌ Carpeta real: ${e.message}`, 'err'); }
        finally { setBusy(false); updateStorageUI(); await ui?.refresh(); }
      }
    }, t('Reconectar carpeta…'));
    const btnDisconnectFolder = h('button', {
      class: 'btn btn-secondary', style: 'padding:2px 6px; font-size:10px;',
      onclick: async () => {
        if (busy) return;
        if (!confirm(t('¿Volver a OPFS? La carpeta real deja de usarse, pero sus archivos no se borran ni se desconecta el permiso del sistema operativo.'))) return;
        setBusy(true);
        try { await disconnectLocalFolder(); uiLog(t('Carpeta real desconectada; usando OPFS de nuevo.'), 'info'); }
        catch (e) { uiLog(t`❌ Carpeta real: ${e.message}`, 'err'); }
        finally { setBusy(false); updateStorageUI(); await ui?.refresh(); }
      }
    }, t('Volver a OPFS'));
    function updateStorageUI() {
      storageLabelEl.textContent = storageModeLabel();
      const canPickFolder = typeof window.showDirectoryPicker === 'function';
      btnConnectFolder.style.display = storageMode === 'local' || !canPickFolder ? 'none' : '';
      btnReconnectFolder.style.display = storageMode === 'opfs' && hasStoredLocalHandle && canPickFolder ? '' : 'none';
      btnDisconnectFolder.style.display = storageMode === 'local' ? '' : 'none';
    }

    const zipFileInput = h('input', {
      type: 'file', accept: '.zip,application/zip', hidden: true,
      'aria-label': t('Seleccionar archivo .zip para restaurar en el disco virtual'),
      onchange: async () => {
        const [file] = zipFileInput.files;
        zipFileInput.value = '';
        if (file) await importZipFile(file);
      }
    });
    const btnExportZip = h('button', {
      class: 'btn btn-secondary', style: 'padding:2px 6px; font-size:10px;',
      title: t('Descarga todo el disco (incluye .git y checkpoints) como un .zip; nada se envía al chat'),
      onclick: () => exportDiskAsZip()
    }, t('Exportar disco (.zip)…'));
    const btnImportZip = h('button', {
      class: 'btn btn-secondary', style: 'padding:2px 6px; font-size:10px;',
      title: t('Restaura un backup .zip exportado desde aquí (o un .zip con la misma estructura); reemplaza archivos existentes'),
      onclick: () => {
        if (busy) { uiLog(t('⏳ Hay una operación en curso; espera antes de importar.'), 'err'); return; }
        zipFileInput.click();
      }
    }, t('Importar ZIP…'));

    const bodyEl = h('div', { id: 'body' },
      h('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; flex-wrap:wrap; gap:4px;' },
        storageLabelEl,
        h('div', { class: 'row', style: 'gap:4px;' },
          btnConnectFolder, btnReconnectFolder, btnDisconnectFolder,
          btnExportZip, btnImportZip, zipFileInput,
          h('button', { class: 'btn btn-secondary', style: 'padding:2px 6px; font-size:10px;', onclick: () => deleteUserFiles() }, t('Eliminar todos')),
          h('button', { class: 'btn btn-secondary', style: 'padding:2px 6px; font-size:10px;', onclick: () => logEl.replaceChildren() }, t('Limpiar log'))
        )
      ),
      h('div', { class: 'row' }, btnNewFile, btnImport, btnHelp, btnWelcome, localFileInput),
      newFileForm,
      welcome,
      helpDialog,
      filesEl,
      logEl,
      cmdInput,
      h('div', { class: 'row' }, btnExec, btnShare, btnOpenShareDialog),
      fileDialog,
      aboutDialog,
      h('div', { style: 'display:flex;justify-content:flex-end;margin-top:6px;' }, btnAbout)
    );

    const panel = h('div', { id: 'panel' }, headerEl, bodyEl);
    if (previous.panelStyle) panel.style.cssText = previous.panelStyle;

    let collapsed = !!previous.collapsed;
    let expanded = false;
    const showBody = () => {
      bodyEl.style.display = collapsed ? 'none' : 'block';
      toggleEl.textContent = collapsed ? t('Abrir') : t('Contraer');
      toggleEl.setAttribute('aria-label', collapsed ? t('Abrir panel') : t('Contraer panel'));
      toggleEl.setAttribute('aria-expanded', String(!collapsed));
      toggleEl.title = collapsed ? t('Mostrar el contenido del panel') : t('Ocultar el contenido sin borrar borradores');
    };
    toggleEl.addEventListener('click', () => {
      collapsed = !collapsed;
      showBody();
    });
    expandEl.addEventListener('click', () => {
      expanded = !expanded;
      panel.classList.toggle('expanded', expanded);
      expandEl.textContent = expanded ? t('Reducir') : t('Ampliar');
      expandEl.setAttribute('aria-label', expanded ? t('Reducir panel') : t('Ampliar panel'));
      expandEl.setAttribute('aria-pressed', String(expanded));
      expandEl.title = expanded ? t('Volver al tamaño y posición anteriores') : t('Ampliar el panel dentro de la ventana');
      if (expanded) { collapsed = false; showBody(); }
    });
    if (previous.expanded) expandEl.click();
    showBody();

    let drag = null;
    headerEl.addEventListener('pointerdown', (e) => {
      if (expanded || e.target.closest('button')) return;
      const r = panel.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      headerEl.setPointerCapture(e.pointerId);
    });
    headerEl.addEventListener('pointermove', (e) => {
      if (!drag) return;
      panel.style.left = Math.min(Math.max(0, e.clientX - drag.dx), window.innerWidth - 60) + 'px';
      panel.style.top = Math.min(Math.max(0, e.clientY - drag.dy), window.innerHeight - 40) + 'px';
      panel.style.right = 'auto';
    });
    const endDrag = () => { drag = null; };
    headerEl.addEventListener('pointerup', endDrag);
    headerEl.addEventListener('pointercancel', endDrag);

    for (const t of ['keydown', 'keyup', 'keypress']) panel.addEventListener(t, (e) => e.stopPropagation());

    shadow.append(panel, gitOverlay);
    document.body.appendChild(host);

    const panelLog = (msg, cls = '') => {
      const d = h('div', cls ? { class: cls } : {}, String(msg));
      logEl.append(d);
      while (logEl.childElementCount > 300) logEl.firstElementChild.remove();
      logEl.scrollTop = logEl.scrollHeight;
    };

    async function refresh() {
      const generation = ++refreshGeneration;
      filesEl.replaceChildren();
      try {
        const files = (await listFiles()).filter((file) => !isInternalPath(file.path));
        if (fileDialog.style.display === 'block') populateShareFiles(files);
        if (!files.length) filesEl.append(h('li', { style: 'color:#a1a1aa' }, t('Tu disco está vacío. Usa Nuevo archivo… para escribir o pegar código, o Explorar / Importar archivos.')));
        for (const f of files.slice(0, 50)) {
          filesEl.append(h('li', {},
            h('span', { title: f.path, style: 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap;' }, f.path),
            h('span', { style: 'color:#a1a1aa' }, fmtBytes(f.size)),
            h('button', {
              class: 'btn btn-secondary', 'aria-label': t`Editar ${f.path}`, title: t('Editar localmente y revisar el diff antes de guardar'),
              style: 'padding:2px 6px; font-size:10px;',
              onclick: () => openCodeEditor(f.path)
            }, t('Editar')),
            h('button', {
              class: 'btn btn-secondary', 'aria-label': t`Ejecutar ${f.path}`, title: t('HTML en pestaña con actualización al guardar; JS en consola aislada. Requiere confirmación'),
              style: 'padding:2px 6px; font-size:10px; margin-left:6px;',
              onclick: () => runFromExplorer(f.path)
            }, t('Ejecutar')),
            h('button', {
              class: 'btn btn-secondary', 'aria-label': t`Descargar ${f.path}`, title: t('Guardar los bytes originales en la PC, sin enviarlos al chat'),
              style: 'padding:2px 6px; font-size:10px; margin-left:6px;',
              onclick: () => downloadUserFile(f.path)
            }, t('Descargar')),
            h('button', {
              class: 'btn btn-secondary',
              style: 'padding:2px 6px; font-size:10px; margin-left:6px;',
              'aria-label': t`Eliminar ${f.path}`, title: t('Borrar este archivo tras confirmar; sin deshacer automático'),
              onclick: () => deleteUserFiles(f.path)
            }, t('Eliminar'))
          ));
        }
        if (files.length > 50) filesEl.append(h('li', {}, t`Mostrando 50 de ${files.length}; Eliminar todos incluye la lista completa.`));
      } catch (e) { panelLog(`❌ ${e.message}`, 'err'); }
      try {
        const state = await getGitStatus();
        if (generation !== refreshGeneration) return;
        gitState = state;
        gitBadge.textContent = !state.initialized ? t('Git local: sin inicializar') :
          `${state.branch || 'HEAD separado'} · ${state.changes.length ? t`${state.changes.length} cambios pendientes` : t('Working tree limpio')}`;
        gitBadge.style.color = state.changes.length ? '#facc15' : '#6ee7b7';
        btnGitSave.textContent = !state.initialized ? t('Inicializar Git local') :
          state.changes.length === 0 ? t('Todo guardado en Git') :
            state.changes.length === 1 ? t`Guardar ${state.changes[0].path} en Git` : t`Guardar ${state.changes.length} cambios en Git`;
        updateState();
      } catch (e) {
        if (generation !== refreshGeneration) return;
        gitState = null; gitBadge.textContent = t('Git: error de consulta'); gitBadge.style.color = '#f87171';
        btnGitSave.textContent = t('Revisar Git');
        panelLog(t`Git: ${e.message}`, 'err'); updateState();
      }
    }

    const updateState = () => {
      stateEl.textContent = busy ? t('Operación en curso') : editorOpen ? t('Editor abierto') : t('Listo · local');
      panel.setAttribute('aria-busy', String(busy));
      for (const button of [btnExec, btnShare, btnImport, btnOpenShareDialog, btnConnectFolder, btnReconnectFolder, btnDisconnectFolder, btnExportZip, btnImportZip]) button.disabled = busy;
      btnNewFile.disabled = busy || editorOpen;
      btnGitSave.disabled = busy || editorOpen || gitLoading || gitState?.initialized && !gitState.changes.length;
      btnGitDiff.disabled = busy || editorOpen || gitLoading || !gitState?.initialized;
      btnGitRevert.disabled = busy || editorOpen || gitLoading || !gitState?.changes?.some(c => c.head !== 0);
      for (const button of gitPaths.querySelectorAll('.git-revert')) button.disabled = busy || editorOpen || gitLoading;
      confirmGit.disabled = busy || editorOpen || gitLoading || !gitReview?.changes.length || !gitMessage.value.trim();
      btnGitRefresh.disabled = busy || editorOpen || gitLoading;
      btnGitReviewDiff.disabled = busy || editorOpen || gitLoading || !gitReview;
      btnGitClose.disabled = busy || gitLoading;
      gitMessage.disabled = busy || gitLoading;
      languageSelect.disabled = busy || editorOpen || gitLoading || gitOverlay.style.display === 'flex';
    };
    updateState();
    updateStorageUI();
    try { if (localStorage.getItem(CFG.WELCOME_KEY) !== 'seen') welcome.style.display = 'block'; }
    catch (e) {
      welcome.style.display = 'block';
      panelLog(t`No se pudo leer la preferencia de bienvenida: ${e.message}`, 'err');
    }
    refresh();
    panelLog(t`Panel Soberano v${CFG.VERSION} activo. 100% local por defecto.`, 'info');
    return { log: panelLog, refresh, updateState };
  }

  // ============================================================
  // ARRANQUE
  // ============================================================
  (async function boot() {
    try {
      if (document.getElementById(CFG.HOST_ID)) return;
      window.addEventListener('pagehide', () => {
        for (const entry of htmlPreviews.values()) {
          entry.channel.postMessage({ type: 'error', text: t('DeepSeek se cerró o recargó; vuelve a abrir la vista previa desde Ejecutar.') });
          closeHTMLPreview(entry);
        }
      });
      loadSettings();
      if (!(await initOPFS())) throw new Error(t('OPFS no está disponible; no se puede montar el panel'));
      await restoreLocalFolderOnBoot();
      const body = await waitFor(() => document.body, 20000, 200);
      if (!body) throw new Error(t('no se encontró document.body; no se puede montar el panel'));
      ui = buildPanel();
      try {
        const report = await recoverTransactions();
        if (report.messages.length || report.cleaned) {
          uiLog(t`Recuperación al iniciar:\n${formatRecovery(report)}`, report.conflicts ? 'err' : 'info');
          await ui?.refresh();
        }
      } catch (e) { uiLog(t`Recuperación al iniciar no completada: ${e.message}. Usa recover para reintentar.`, 'err'); }
      installInterceptors();
      installChatCodeActions();
    } catch (e) {
      console.error(t('[DV] Error de arranque:'), e);
    }
  })();
})();