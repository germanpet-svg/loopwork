// ==UserScript==
// @name         DeepSeek Disco Virtual (Dual-Channel OPFS + Git)
// @namespace    local.disk
// @version      1.5.29
// @description  Entorno local OPFS con doble canal: panel soberano (0 tokens) + atajo en chat mitigado
// @match        https://chat.deepseek.com/*
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
    VERSION: '1.5.29',
    MAX_RUN_BYTES: 256 * 1024,
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
    WASM_TIMEOUT_MS: 10 * 60 * 1000,
    HISTORY_MAX: 200,
    SETTINGS_KEY: 'dv.settings.v4',
    WELCOME_KEY: 'dv.welcome.v1',
    HOST_ID: 'dv-host',
  };

  const dvLog = (...a) => console.log('[DV]', ...a);

  // ============================================================
  // UTILIDADES
  // ============================================================
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitFor(fn, timeout = 3000, step = 100) {
    const t0 = Date.now();
    for (;;) {
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
    s.length > n ? s.slice(0, n) + `\n... (truncado, ${s.length - n} caracteres más)` : s;

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
    if (!Number.isInteger(n) || n < 0) throw new Error(`valor no válido para ${flag}: ${v}`);
    return n;
  }

  function makeRegex(pattern, { ignoreCase = false, fixed = false } = {}) {
    try {
      const src = fixed ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : pattern;
      return new RegExp(src, ignoreCase ? 'i' : '');
    } catch (e) {
      throw new Error(`regex no válida: ${e.message}`);
    }
  }

  // ============================================================
  // AJUSTES
  // ============================================================
  const settings = { prefix: '!' };
  const PREFIX_RE = /^[!#$%&*+=;:~^?@]{1,2}$/;

  function loadSettings() {
    try {
      const o = JSON.parse(localStorage.getItem(CFG.SETTINGS_KEY) || '{}');
      if (typeof o.prefix === 'string' && PREFIX_RE.test(o.prefix)) settings.prefix = o.prefix;
    } catch { /* defaults */ }
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
    dvLog('OPFS listo');
    return true;
  }

  function splitPath(p) {
    if (typeof p !== 'string' || !p) throw new Error('ruta vacía');
    const parts = p.replaceAll('\\', '/').split('/').filter(Boolean);
    for (const s of parts) {
      if (s === '..') throw new Error(`ruta no permitida: ${p}`);
      if (BAD_NAME.test(s)) throw new Error(`nombre no válido: ${s}`);
      if (s.length > 200) throw new Error(`nombre demasiado largo: ${s.slice(0, 20)}…`);
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
    if (!h) throw Object.assign(new Error(`no existe: ${path}`), { name: 'NotFoundError' });
    if (h.kind !== 'file') throw Object.assign(new Error(`es una carpeta: ${path}`), { code: 'EISDIR' });
    return h;
  }

  async function parentOf(path, create) {
    const parts = splitPath(path);
    if (!parts.length) throw new Error('ruta no válida');
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
    if (!parts.length) throw new Error('no se puede borrar la raíz');
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
    if (pos.length !== 2) throw new Error(`uso: ${command} <origen> <destino> (solo archivos)`);
    const paths = pos.map((path) => {
      const parts = splitPath(path);
      if (!parts.length || isInternalPath(path)) throw new Error('raíz y metadatos internos no permitidos');
      return parts.join('/');
    });
    const [sourcePath, targetPath] = paths;
    if (sourcePath === targetPath) throw new Error('origen y destino son el mismo archivo');
    const sourceHandle = await requireFile(sourcePath);
    const sourceFile = await sourceHandle.getFile();
    if (sourceFile.size > CFG.MAX_HASH_BYTES) throw new Error(`archivo demasiado grande para verificar: máximo ${fmtBytes(CFG.MAX_HASH_BYTES)}`);
    const targetHandle = await getHandle(targetPath);
    if (targetHandle?.kind === 'directory') throw new Error('destino es una carpeta; indica la ruta completa del archivo');
    if (move || targetHandle) {
      const action = move ? `Mover "${sourcePath}" a "${targetPath}" y borrar el origen` : `Reemplazar "${targetPath}" con "${sourcePath}"`;
      if (!confirm(`¿${action}?${targetHandle ? ' El destino existente será reemplazado.' : ''} No hay deshacer automático.`)) {
        throw new Error(`${command} cancelado; no se ha modificado nada`);
      }
    }
    const sourceHash = await copyVerifiedFile(sourceFile, targetPath, targetHandle);
    if (move) {
      const currentSource = await (await requireFile(sourcePath)).getFile();
      if (currentSource.size !== sourceFile.size ||
          await computeSha256(await currentSource.arrayBuffer()) !== sourceHash) {
        throw new Error('el origen cambió durante la copia; no se ha borrado y el destino contiene la versión copiada');
      }
      try { await removePath(sourcePath, false); }
      catch (e) { throw new Error(`copia verificada en "${targetPath}", pero no se pudo borrar "${sourcePath}": ${e.message}`); }
      if (await getHandle(sourcePath)) throw new Error(`copia verificada, pero el origen sigue existiendo: ${sourcePath}`);
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
          throw new Error(`copia fallida: ${e.message}; no se pudo retirar el destino incompleto "${targetPath}": ${cleanupError.message}`);
        }
      }
      throw e;
    }
    const copiedFile = await (await requireFile(targetPath)).getFile();
    if (copiedFile.size !== sourceFile.size ||
        await computeSha256(await copiedFile.arrayBuffer()) !== sourceHash) {
      throw new Error(`verificación de copia fallida: ${targetPath}; el origen se conserva`);
    }
    return sourceHash;
  }

  async function importLocalFiles(files) {
    if (busy) { uiLog('⏳ Hay una operación en curso; vuelve a seleccionar los archivos al terminar.', 'err'); return; }
    setBusy(true);
    let imported = 0, skipped = 0;
    try {
      for (const file of files) {
        const parts = splitPath(file.name);
        if (parts.length !== 1 || parts[0] !== file.name || isInternalPath(file.name)) {
          throw new Error(`nombre de archivo no permitido: ${file.name}`);
        }
        if (file.size > CFG.MAX_HASH_BYTES) throw new Error(`${file.name}: supera el máximo verificable de ${fmtBytes(CFG.MAX_HASH_BYTES)}`);
        const target = await getHandle(file.name);
        if (target?.kind === 'directory') throw new Error(`${file.name}: ya existe una carpeta con ese nombre`);
        if (target && !confirm(`¿Reemplazar "${file.name}" en el disco virtual (${fmtBytes(file.size)})? No hay deshacer automático.`)) {
          skipped++;
          uiLog(`Omitido sin cambios: ${file.name}`, 'info');
          continue;
        }
        const hash = await copyVerifiedFile(file, file.name, target);
        imported++;
        uiLog(`Importado localmente: ${file.name} (${fmtBytes(file.size)}, SHA256: ${hash.slice(0, 8)}...)`, 'info');
      }
      uiLog(`Importación terminada: ${imported} archivo(s), ${skipped} omitido(s). Nada enviado a DeepSeek.`, 'info');
    } catch (e) {
      uiLog(`❌ Importación detenida: ${e.message}. ${imported} archivo(s) importados y ${skipped} omitidos; los anteriores se conservan.`, 'err');
    } finally {
      setBusy(false);
      await ui?.refresh();
    }
  }

  async function openWriter(path, { append = false } = {}) {
    const gz = /\.gz$/i.test(path);
    if (gz && append) throw new Error('no se puede añadir (>>) a un .gz');
    const ws = await openRawWriter(path, { append });
    const enc = new TextEncoder();
    let target = ws, gzWriter = null, pipe = null;
    if (gz) {
      const cs = new CompressionStream('gzip');
      pipe = cs.readable.pipeTo(ws);
      pipe.catch(() => {});
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

  async function appendJournal(entry) {
    const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
    try {
      const w = await openWriter('.dv/journal.jsonl', { append: true });
      await w.write(line);
      await w.close();
    } catch (e) { uiLog(`Auditoría no guardada: ${e.message}`, 'err'); }
  }

  async function atomicWrite(targetPath, newContent, { expectedHash = null } = {}) {
    const enc = new TextEncoder();
    const candidateBytes = typeof newContent === 'string' ? enc.encode(newContent) : newContent;
    const candidateHash = await computeSha256(candidateBytes);

    let prevHash = null;
    try {
      const h = await getHandle(targetPath);
      if (h && h.kind === 'file') {
        const file = await h.getFile();
        prevHash = await computeSha256(await file.arrayBuffer());
      }
    } catch {}

    const tmpPath = `.dv_tmp/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.tmp`;
    await writeBytes(tmpPath, candidateBytes);

    const writtenTmp = await (await requireFile(tmpPath)).getFile();
    const writtenTmpHash = await computeSha256(await writtenTmp.arrayBuffer());
    if (writtenTmpHash !== candidateHash) {
      await removePath(tmpPath, false);
      throw new Error('Integridad de temporal comprometida.');
    }

    if (expectedHash !== null && (await editorSnapshot(targetPath)).hash !== expectedHash) {
      await removePath(tmpPath, false);
      throw new Error('archivo cambió durante la preparación; no se sobrescribió');
    }
    await writeBytes(targetPath, candidateBytes);
    await removePath(tmpPath, false);

    const finalFile = await (await requireFile(targetPath)).getFile();
    const finalHash = await computeSha256(await finalFile.arrayBuffer());
    if (finalHash !== candidateHash) {
      throw new Error('Verificación post-escritura fallida.');
    }

    await appendJournal({
      type: 'atomic_write',
      path: targetPath,
      prevHash,
      newHash: finalHash,
      bytes: candidateBytes.length,
      status: 'COMMITTED',
    });

    return { hash: finalHash, bytes: candidateBytes.length };
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
        if (!h) throw Object.assign(new Error('no existe: ' + path), { name: 'NotFoundError' });
        if (h.kind !== 'directory') throw Object.assign(new Error('no es dir'), { name: 'TypeMismatchError' });
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
        if (!h) throw Object.assign(new Error('no existe: ' + path), { name: 'NotFoundError' });
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
      async readlink() { throw Object.assign(new Error('no symlinks'), { code: 'ENOSYS' }); },
      async symlink() { throw Object.assign(new Error('no symlinks'), { code: 'ENOSYS' }); },
      async chmod() {}, async utimes() {}, async fsync() {}
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
    uiLog('Cargando isomorphic-git...', 'info');
    const mod = await import('https://esm.sh/isomorphic-git@1.32.1');
    gitInstance = mod.default || mod;
    gitFs = makeFs();
    return { git: gitInstance, fs: gitFs };
  }

  let diffInstance = null;
  async function getDiff() {
    if (!diffInstance) diffInstance = await import('https://esm.sh/diff@7.0.0');
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
    if (!Number.isFinite(timestamp)) return 'sin fecha: timestamp ausente o no válido';
    const date = new Date(timestamp * 1000);
    if (!Number.isFinite(date.getTime())) return 'sin fecha: timestamp fuera de rango';
    return iso ? date.toISOString() : date.toLocaleTimeString();
  }

  function gitChangeDescription(head, work, stage) {
    const states = [];
    if (head === 0 && stage === 0) states.push('untracked');
    else {
      if (head !== stage) states.push(stage === 0 ? 'deleted (staged)' : head === 0 ? 'added (staged)' : 'modified (staged)');
      if (work !== stage) states.push(work === 0 ? 'deleted (unstaged)' : stage === 0 ? 'untracked' : 'modified (unstaged)');
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
    if (repository.kind !== 'directory') throw new Error('.git no es una carpeta; revisa el repositorio');
    const { git, fs } = await getGit();
    const matrix = await git.statusMatrix({ fs, dir: '.' });
    if (matrix.some(([path, head, , stage]) => isInternalPath(path) && (head !== 0 || stage !== 0))) {
      throw new Error('Git contiene metadatos internos versionados; revisa el repositorio antes de guardar');
    }
    const rows = matrix.filter(([path]) => !isInternalPath(path));
    const changes = rows.filter(([, head, work, stage]) => head !== work || work !== stage)
      .map(([path, head, work, stage]) => ({ path, head, work, stage, description: gitChangeDescription(head, work, stage) }));
    const branch = await git.currentBranch({ fs, dir: '.' });
    const head = await gitHeadOid(git, fs);
    const state = { initialized: true, changes, branch, head };
    if (!capture) return state;
    if (!branch) throw new Error('guardar con botón requiere una rama local activa; revisa git branch');
    const working = [];
    for (const [path, , work] of rows) {
      let hash = null;
      if (work !== 0) {
        const file = await (await requireFile(path)).getFile();
        if (file.size > CFG.MAX_HASH_BYTES) throw new Error(`Git: archivo demasiado grande para verificar: ${path}`);
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
    if (busy || editorOpen) throw new Error('cierra el editor o espera a que termine la operación antes de versionar');
    if (typeof message !== 'string' || !message.trim()) throw new Error('escribe un mensaje de commit');
    if (!review?.initialized || !review.signature || !review.changes.length) throw new Error('actualiza la revisión de cambios antes de guardar');
    setBusy(true);
    let staged = false;
    try {
      const current = await getGitStatus({ capture: true });
      if (current.signature !== review.signature) throw new Error('repositorio cambió desde la revisión; actualiza la lista antes de guardar');
      const { git, fs } = await getGit();
      staged = true;
      await stageAllGitFiles(git, fs);
      const ready = await getGitStatus({ capture: true });
      if (ready.workSignature !== review.workSignature || ready.changes.some(c => c.work !== c.stage)) {
        throw new Error('archivos o rama cambiaron durante staging; no se hizo commit');
      }
      if (!ready.changes.some(c => c.head !== c.stage)) {
        throw new Error('la versión actual coincide con HEAD; staging actualizado, no hay cambios para un commit');
      }
      const oid = await git.commit({ fs, dir: '.', message: message.trim(),
        author: { name: 'DV User', email: 'user@local.lan' } });
      if (await gitHeadOid(git, fs) !== oid) throw new Error(`commit ${oid} creado, pero HEAD cambió; revisa git log y git status`);
      const commit = await git.readCommit({ fs, dir: '.', oid });
      if ((review.head && !commit.commit.parent.includes(review.head)) ||
          !review.head && commit.commit.parent.length) throw new Error(`commit ${oid} creado con historial inesperado; revisa git log`);
      if (JSON.stringify(await gitBlobOids(git, fs, git.TREE({ ref: oid }))) !== JSON.stringify(ready.stagedOids)) {
        throw new Error(`commit ${oid} creado, pero su contenido no coincide con el staging revisado; revisa git show`);
      }
      const final = await getGitStatus();
      uiLog(`[${review.branch} ${oid.slice(0, 7)}] ${message.trim()}. Git local; nada enviado al chat ni a un servidor.`, 'info');
      if (final.changes.length) uiLog('Hay cambios pendientes posteriores al commit; revisa el estado Git.', 'err');
      return oid;
    } catch (e) {
      throw new Error(`${e.message}${staged ? '. El staging puede haber cambiado; revisa git status. Sin rollback automático.' : ''}`);
    } finally {
      setBusy(false);
      await ui?.refresh();
    }
  }

  async function checkoutBranch(git, fs, ref) {
    const branches = await git.listBranches({ fs, dir: '.' });
    if (!branches.includes(ref)) throw new Error('checkout: rama local no existe; créala con git branch <nombre>');
    const oid = await git.resolveRef({ fs, dir: '.', ref: `refs/heads/${ref}` });
    await git.walk({
      fs, dir: '.', trees: [git.TREE({ ref: oid })],
      map: async (path, [entry]) => {
        if (path === '.' || !entry) return;
        if (isInternalPath(path)) throw new Error(`checkout: rama contiene metadatos protegidos: ${path}`);
        if (splitPath(path).join('/') !== path) throw new Error(`checkout: ruta no válida en rama: ${path}`);
        const type = await entry.type();
        if (!['tree', 'blob'].includes(type) || type === 'blob' && ![0o100644, 0o100755].includes(await entry.mode())) {
          throw new Error(`checkout: tipo no soportado en rama: ${path}`);
        }
      }
    });
    const inspect = async () => {
      const matrix = await git.statusMatrix({ fs, dir: '.' });
      const dirty = matrix.filter(([path, head, work, stage]) => !isInternalPath(path) &&
        (head !== work || work !== stage));
      if (dirty.length) throw new Error(`checkout bloqueado: cambios pendientes en ${dirty.length} archivo(s). Revisa git status y confirma o conserva tus archivos.`);
      const tracked = new Set(await git.listFiles({ fs, dir: '.' }));
      if ([...tracked].some(isInternalPath)) throw new Error('checkout bloqueado: staging contiene metadatos protegidos; revisa el repositorio');
      if (matrix.some(([path, head]) => head !== 0 && isInternalPath(path))) {
        throw new Error('checkout bloqueado: commit actual contiene metadatos protegidos');
      }
      const files = (await listFiles()).filter(f => !isInternalPath(f.path));
      const untracked = files.filter(f => !tracked.has(f.path));
      if (untracked.length) throw new Error(`checkout bloqueado: ${untracked.length} archivo(s) sin seguimiento o ignorados. No se descartan automáticamente.`);
      const hashes = [];
      for (const f of files) {
        if (f.size > CFG.MAX_HASH_BYTES) throw new Error('checkout: archivo demasiado grande para verificar');
        hashes.push([f.path, await computeSha256(await (await (await requireFile(f.path)).getFile()).arrayBuffer())]);
      }
      return JSON.stringify({ head: await gitHeadOid(git, fs),
        branch: await git.currentBranch({ fs, dir: '.' }), hashes });
    };
    const before = await inspect();
    if (await git.currentBranch({ fs, dir: '.' }) === ref) return `Ya estás en la rama ${ref}; working tree limpio.`;
    if (!confirm(`¿Cambiar a la rama local "${ref}" (${oid.slice(0, 7)})?\nWorking tree y staging limpios. Se reemplazarán archivos por la versión confirmada de esa rama.\nSin --force, sin descarte automático. Checkpoints conservados.`)) {
      throw new Error('checkout cancelado; rama y archivos intactos');
    }
    if (await inspect() !== before || await git.resolveRef({ fs, dir: '.', ref: `refs/heads/${ref}` }) !== oid) {
      throw new Error('checkout: repositorio cambió durante confirmación; no se cambió de rama');
    }
    try {
      await git.checkout({ fs, dir: '.', ref, force: false });
      const matrix = await git.statusMatrix({ fs, dir: '.' });
      if (await git.currentBranch({ fs, dir: '.' }) !== ref ||
          await gitHeadOid(git, fs) !== oid ||
          matrix.some(([path, head, work, stage]) => !isInternalPath(path) && (head !== work || work !== stage))) {
        throw new Error('estado final no coincide con la rama o no está limpio');
      }
    } catch (e) {
      throw new Error(`checkout no completado/verificado: ${e.message}. Revisa git status y git branch; no hay rollback automático.`);
    }
    return `Rama activa: ${ref} (${oid.slice(0, 7)}). Working tree y staging verificados limpios.`;
  }

  async function gitShow(git, fs, args) {
    if (args.length > 1) throw new Error('uso: git show [ref|ref:archivo]');
    const spec = args[0] || 'HEAD';
    const colon = spec.indexOf(':');
    const ref = colon < 0 ? spec : spec.slice(0, colon);
    if (!ref || ref.startsWith('-')) throw new Error('referencia Git no válida; usa HEAD, nombre de referencia o SHA completo');
    let path = null;
    if (colon >= 0) {
      path = spec.slice(colon + 1);
      if (!path || !splitPath(path).length || isInternalPath(path)) throw new Error('archivo histórico no permitido');
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
    if (blob.length > CFG.MAX_RUN_BYTES) throw new Error('git show: máximo 256 KB por archivo histórico');
    if (blob.includes(0)) throw new Error('git show requiere texto UTF-8 sin NUL; exportación binaria pendiente');
    try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(blob); }
    catch (e) { if (e.name === 'TypeError') throw new Error('git show requiere texto UTF-8 válido'); throw e; }
  }

  async function gitDiff(git, fs, args) {
    const { flags, pos } = parseArgs(args, { staged: 'b' });
    if (pos.length > 1) throw new Error('uso: git diff [--staged] [ref]');
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
          if (file.size > CFG.MAX_COLLECT_CHARS) throw new Error(`archivo demasiado grande para diff: ${path}`);
          newBytes = new Uint8Array(await file.arrayBuffer());
        }
      }
      total += oldBytes.length + newBytes.length;
      if (total > CFG.MAX_COLLECT_CHARS) throw new Error('diff demasiado grande para procesar en memoria');
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
        patches.push(`Binary files ${JSON.stringify(oldName)} and ${JSON.stringify(newName)} differ (${oldBytes.length} -> ${newBytes.length} B)`);
      } else {
        const patch = createTwoFilesPatch(JSON.stringify(oldName), JSON.stringify(newName),
          oldText, newText, '', '', { context: 3, timeout: 2000 });
        if (patch === undefined) throw new Error(`diff excedió el tiempo límite: ${path}`);
        patches.push(patch);
      }
    }
    return patches.join('\n') || 'Sin diferencias. Los archivos sin seguimiento se muestran en git status.';
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
      for (;;) {
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
    throw new Error('falta fichero o entrada por pipe');
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
    if (q) throw new Error('comillas sin cerrar');
    push(str.length);
    return out;
  }

  function runFromExplorer(path) {
    const quotedPath = path.split("'").map((part) => `'${part}'`).join(`"'"`);
    return handleExecution(`run ${quotedPath}`, { origin: 'panel', forceShare: false });
  }

  async function downloadUserFile(path) {
    if (busy) { uiLog('⏳ Hay una operación en curso; reintenta la descarga al terminar.', 'err'); return; }
    setBusy(true);
    let url = null, link = null;
    try {
      const parts = splitPath(path);
      if (!parts.length || isInternalPath(path)) throw new Error('archivo a descargar no permitido');
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
      uiLog(`Descarga solicitada: ${path} (${fmtBytes(file.size)}). Comprueba las descargas del navegador; nada enviado al chat.`, 'info');
    } catch (e) {
      uiLog(`❌ Descarga: ${e.message}`, 'err');
    } finally {
      link?.remove();
      if (url) URL.revokeObjectURL(url);
      setBusy(false);
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
        if (share) throw new Error('--share repetido');
        share = true;
      } else if (!token.quoted && !literal && token.v === '--share-file') {
        if (file !== null) throw new Error('--share-file repetido');
        const next = tokens[++i];
        if (!next || next.t !== 'w' || !next.v || (!next.quoted && next.v.startsWith('--'))) {
          throw new Error('--share-file requiere una ruta: --share-file "archivo.txt"');
        }
        if (!splitPath(next.v).length || isInternalPath(next.v)) throw new Error('archivo a compartir no permitido');
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
        if (!cur.argv.length) throw new Error('pipe sin comando');
        if (cur.redirect) throw new Error('la redirección solo puede ir en el último comando');
        segs.push(cur);
        cur = { argv: [], redirect: null };
        continue;
      }
      const nx = toks[i + 1];
      if (!nx || nx.t !== 'w') throw new Error(`falta fichero tras ${t.v}`);
      if (cur.redirect) throw new Error('solo una redirección por comando');
      cur.redirect = { mode: t.v, file: nx.v };
      i++;
    }
    if (!cur.argv.length) throw new Error('comando vacío');
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
        if (!(key in spec)) throw new Error(`opción desconocida: ${a}`);
        if (spec[key] === 'v') {
          if (k + 1 >= args.length) throw new Error(`falta valor para ${a}`);
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
    REG.set(name, { name, group, usage, desc, run });
  }

  let lastResult = '';
  const panelHistory = [];
  const chatHistory = [];

  async function editorSnapshot(path) {
    if (isInternalPath(path)) throw new Error('no se editan metadatos internos');
    const file = await (await requireFile(path)).getFile();
    if (file.size > CFG.MAX_RUN_BYTES) throw new Error('editor: máximo 256 KB');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.includes(0)) throw new Error('el editor requiere texto, no binarios');
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch (e) { if (e.name === 'TypeError') throw new Error('el editor requiere UTF-8 válido'); throw e; }
    return { path, text, hash: await computeSha256(bytes) };
  }

  function replaceEditorText(text, search, replacement, all) {
    if (!search) throw new Error('escribe un texto para buscar');
    const index = text.indexOf(search);
    if (index < 0) throw new Error('no se encontró el texto exacto');
    if (!all) return { text: text.slice(0, index) + replacement + text.slice(index + search.length), count: 1 };
    const parts = text.split(search);
    return { text: parts.join(replacement), count: parts.length - 1 };
  }

  async function fileSnapshot(path) {
    const parts = splitPath(path);
    if (!parts.length || isInternalPath(path)) throw new Error('checkpoint: raíz y metadatos internos no permitidos');
    path = parts.join('/');
    const file = await (await requireFile(path)).getFile();
    if (file.size > CFG.MAX_RUN_BYTES) throw new Error('checkpoint/restore: máximo 256 KB por archivo');
    const bytes = new Uint8Array(await file.arrayBuffer());
    return { path, bytes, hash: await computeSha256(bytes) };
  }

  async function createCheckpoint(path, label = '') {
    const snapshot = await fileSnapshot(path);
    const id = crypto.randomUUID();
    const base = `.dv/checkpoints/${id}`;
    if (await getHandle(`${base}.bin`) || await getHandle(`${base}.json`)) throw new Error('checkpoint: ID ya existe; no se reemplazó la copia');
    const metadata = { version: 1, id, path: snapshot.path, hash: snapshot.hash,
      size: snapshot.bytes.length, created: new Date().toISOString(), label };
    await writeBytes(`${base}.bin`, snapshot.bytes);
    const stored = await (await requireFile(`${base}.bin`)).getFile();
    if (stored.size !== metadata.size || await computeSha256(await stored.arrayBuffer()) !== metadata.hash) {
      throw new Error('checkpoint: copia no verificada; no se publicó el checkpoint');
    }
    await writeBytes(`${base}.json`, JSON.stringify(metadata));
    await readCheckpoint(id);
    return metadata;
  }

  async function readCheckpoint(id) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) throw new Error('ID de checkpoint no válido');
    const base = `.dv/checkpoints/${id}`;
    const manifest = await (await requireFile(`${base}.json`)).getFile();
    if (manifest.size > 8192) throw new Error('checkpoint: metadatos demasiado grandes');
    const metadata = JSON.parse(await manifest.text());
    if (!metadata || metadata.version !== 1 || metadata.id !== id ||
        typeof metadata.path !== 'string' || !splitPath(metadata.path).length || isInternalPath(metadata.path) ||
        splitPath(metadata.path).join('/') !== metadata.path ||
        typeof metadata.hash !== 'string' || !/^[a-f0-9]{64}$/.test(metadata.hash) ||
        !Number.isInteger(metadata.size) || metadata.size < 0 || metadata.size > CFG.MAX_RUN_BYTES ||
        typeof metadata.created !== 'string' || !Number.isFinite(Date.parse(metadata.created)) ||
        typeof metadata.label !== 'string' || metadata.label.length > 200) throw new Error('checkpoint: metadatos no válidos');
    const file = await (await requireFile(`${base}.bin`)).getFile();
    if (file.size !== metadata.size) throw new Error('checkpoint: tamaño de copia incorrecto');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (await computeSha256(bytes) !== metadata.hash) throw new Error('checkpoint: hash de copia incorrecto');
    return { metadata, bytes };
  }

  async function checkpointInventory() {
    const directory = await getHandle('.dv/checkpoints');
    if (!directory) return [];
    if (directory.kind !== 'directory') throw new Error('checkpoint: almacenamiento no es una carpeta');
    const records = [];
    for await (const [name, handle] of directory.entries()) {
      if (handle.kind !== 'file' || !name.endsWith('.json')) continue;
      records.push((await readCheckpoint(name.slice(0, -5))).metadata);
    }
    return records.sort((a, b) => Date.parse(b.created) - Date.parse(a.created) || a.id.localeCompare(b.id));
  }

  function checkpointText(bytes) {
    if (bytes.includes(0)) throw new Error('checkpoint: contenido binario; diff/content requieren texto UTF-8 sin NUL');
    try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch (e) { if (e.name === 'TypeError') throw new Error('checkpoint: contenido no es UTF-8 válido'); throw e; }
  }

  async function deleteCheckpoints(records, selected) {
    if (!selected.length) return 'No hay checkpoints eliminables; se conserva la copia más reciente de cada archivo.';
    const signature = JSON.stringify(records);
    const preview = selected.map(m => `${m.id} | ${JSON.stringify(m.path)} | ${m.created}`).join('\n');
    if (!confirm(`¿Borrar definitivamente ${selected.length} checkpoint(s)?\n${preview}\nNo hay deshacer. Se conserva la copia más reciente de cada archivo. Archivos actuales y Git no se modifican.`)) {
      throw new Error('borrado de checkpoints cancelado; copias intactas');
    }
    if (JSON.stringify(await checkpointInventory()) !== signature) throw new Error('checkpoints cambiaron durante confirmación; no se borró nada');
    let deleted = 0;
    try {
      for (const m of selected) {
        const base = `.dv/checkpoints/${m.id}`;
        await readCheckpoint(m.id);
        await removePath(`${base}.json`, false);
        await removePath(`${base}.bin`, false);
        if (await getHandle(`${base}.json`) || await getHandle(`${base}.bin`)) throw new Error(`copia sigue existiendo: ${m.id}`);
        deleted++;
      }
    } catch (e) {
      throw new Error(`limpieza detenida: ${deleted} checkpoint(s) eliminados; ${e.message}. No se revierten borrados; el ID en curso puede quedar incompleto.`);
    }
    return `Eliminados y verificados: ${deleted} checkpoint(s). Últimas copias por archivo conservadas.`;
  }

  def('checkpoint', 'Sistema', 'checkpoint <archivo> [etiqueta] | --list [--file ruta] [--tag texto] | show ID [--content] | diff ID1 ID2 | delete ID | prune <--keep N|--older-than Nd>', 'Copias locales verificadas; limpieza confirmada protege últimas versiones', async (ctx) => {
    const { pos, flags } = parseArgs(ctx.args, { list: 'b', file: 'v', tag: 'v', content: 'b', keep: 'v', 'older-than': 'v' });
    const checkFlags = (allowed) => {
      if (Object.keys(flags).some(key => !allowed.includes(key))) throw new Error('opciones incompatibles para checkpoint');
    };
    if (flags.list) {
      checkFlags(['list', 'file', 'tag']);
      if (pos.length) throw new Error('uso: checkpoint --list [--file ruta] [--tag texto]');
      const path = flags.file === undefined ? null : splitPath(flags.file).join('/');
      if (path !== null && (!path || isInternalPath(path))) throw new Error('filtro de archivo no permitido');
      return (await checkpointInventory()).filter(m =>
        (path === null || m.path === path) && (flags.tag === undefined || m.label.includes(flags.tag)))
        .map(m => `${m.id} | ${JSON.stringify(m.path)} | ${m.created} | ${m.size} B | ${JSON.stringify(m.label)}`)
        .join('\n') || 'No hay checkpoints para esos filtros.';
    }
    if (pos[0] === 'show') {
      checkFlags(['content']);
      if (pos.length !== 2) throw new Error('uso: checkpoint show ID [--content]');
      const { metadata: m, bytes } = await readCheckpoint(pos[1]);
      if (flags.content) return checkpointText(bytes);
      return `Checkpoint: ${m.id}\nArchivo: ${JSON.stringify(m.path)}\nFecha: ${m.created}\nEtiqueta: ${JSON.stringify(m.label)}\nBytes: ${m.size}\nSHA256: ${m.hash}`;
    }
    if (pos[0] === 'diff') {
      checkFlags([]);
      if (pos.length !== 3) throw new Error('uso: checkpoint diff ID1 ID2');
      const a = await readCheckpoint(pos[1]), b = await readCheckpoint(pos[2]);
      const oldText = checkpointText(a.bytes), newText = checkpointText(b.bytes);
      if (a.metadata.hash === b.metadata.hash) return 'Sin diferencias de contenido.';
      const engine = await getDiff();
      const patch = engine.createTwoFilesPatch(`${a.metadata.id}:${a.metadata.path}`,
        `${b.metadata.id}:${b.metadata.path}`, oldText, newText, '', '', { context: 3, timeout: 2000 });
      if (patch === undefined) throw new Error('checkpoint diff excedió el tiempo límite');
      return patch;
    }
    if (pos[0] === 'delete' || pos[0] === 'prune') {
      const deleting = pos[0] === 'delete';
      checkFlags(deleting ? [] : ['keep', 'older-than']);
      if (deleting ? pos.length !== 2 : pos.length !== 1 ||
          (flags.keep === undefined) === (flags['older-than'] === undefined)) {
        throw new Error('uso: checkpoint delete ID | checkpoint prune <--keep N|--older-than Nd>');
      }
      const records = await checkpointInventory();
      const latest = new Map();
      for (const m of records) if (!latest.has(m.path)) latest.set(m.path, Date.parse(m.created));
      const protectedCopy = (m) => Date.parse(m.created) === latest.get(m.path);
      let selected;
      if (deleting) {
        const record = records.find(m => m.id === pos[1]);
        if (!record) throw new Error('checkpoint no existe en inventario');
        if (protectedCopy(record)) throw new Error('no se borra el checkpoint más reciente de ese archivo (también se protegen empates de fecha)');
        selected = [record];
      } else if (flags.keep !== undefined) {
        if (!/^[1-9]\d*$/.test(flags.keep) || !Number.isSafeInteger(Number(flags.keep))) throw new Error('--keep requiere entero positivo');
        selected = records.slice(Number(flags.keep)).filter(m => !protectedCopy(m));
      } else {
        const match = /^([1-9]\d*)d$/.exec(flags['older-than']);
        const days = match ? Number(match[1]) : NaN;
        if (!Number.isSafeInteger(days) || !Number.isSafeInteger(days * 86400000)) throw new Error('--older-than requiere días enteros positivos, por ejemplo 7d');
        const cutoff = Date.now() - days * 86400000;
        selected = records.filter(m => Date.parse(m.created) < cutoff && !protectedCopy(m));
      }
      return deleteCheckpoints(records, selected);
    }
    checkFlags([]);
    if (pos.length < 1 || pos.length > 2 || (pos[1] || '').length > 200) throw new Error('uso: checkpoint <archivo> [etiqueta hasta 200 caracteres]');
    const m = await createCheckpoint(pos[0], pos[1] || '');
    return `Checkpoint: ${m.id}\nArchivo: ${JSON.stringify(m.path)} (${m.size} B)\nSHA256: ${m.hash}\nRestaurar: ${settings.prefix}restore ${m.id}`;
  });

  def('restore', 'Sistema', 'restore <ID-checkpoint>', 'Restaura ruta original con aprobación y copia previa si existe', async (ctx) => {
    if (ctx.args.length !== 1) throw new Error('uso: restore <ID-checkpoint>');
    if (editorOpen) throw new Error('cierra el editor actual antes de restaurar');
    const { metadata, bytes } = await readCheckpoint(ctx.args[0]);
    const target = await getHandle(metadata.path);
    if (target?.kind === 'directory') throw new Error('restore: destino es una carpeta');
    const current = target ? await fileSnapshot(metadata.path) : null;
    if (current?.hash === metadata.hash) return 'Sin cambios: el archivo ya coincide con el checkpoint.';
    let text = null, original = null;
    if (!bytes.includes(0) && current && !current.bytes.includes(0)) {
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
        text = decoder.decode(bytes);
        original = decoder.decode(current.bytes);
      } catch (e) { if (e.name !== 'TypeError') throw e; }
    }
    if (text !== null && original !== null) {
      ctx.openEditor({ snapshot: { path: current.path, text: original, hash: current.hash },
        candidate: text, checkpointBeforeSave: true });
      return `Restauración preparada: ${metadata.path}. Revisa el diff y confirma Aplicar; se creará checkpoint previo al guardar.`;
    }
    if (!confirm(`¿Restaurar "${metadata.path}" desde checkpoint ${metadata.id} (${metadata.size} B)?\n${current ? 'Binario/no UTF-8: sin diff de texto. Se guardará checkpoint de la versión actual.' : 'Archivo ausente: se creará con los bytes guardados.'}\nSHA256: ${metadata.hash}`)) {
      throw new Error('restauración cancelada; archivo intacto');
    }
    const fresh = await getHandle(metadata.path);
    if (current ? !fresh || (await fileSnapshot(metadata.path)).hash !== current.hash : fresh !== null) throw new Error('restore: destino cambió; no se sobrescribió');
    let backup = null;
    if (current) {
      backup = await createCheckpoint(metadata.path, `Antes de restore ${metadata.id}`);
      uiLog(`Checkpoint previo: ${backup.id}`, 'info');
      if (backup.hash !== current.hash || (await fileSnapshot(metadata.path)).hash !== current.hash) throw new Error('restore: archivo cambió; copia previa conservada');
    }
    await writeBytes(metadata.path, bytes);
    if ((await fileSnapshot(metadata.path)).hash !== metadata.hash) throw new Error(`restore: verificación fallida; checkpoint original ${metadata.id}${backup ? ` y previo ${backup.id}` : ''} conservados`);
    return `Restaurado y verificado: ${metadata.path}\nSHA256: ${metadata.hash}${backup ? `\nCheckpoint previo: ${backup.id}` : ''}\nNo se hizo staging ni commit.`;
  });

  function validateEditorCandidate(snapshot, candidate) {
    if (candidate.includes('\0')) throw new Error('candidato requiere texto sin NUL');
    if (new TextEncoder().encode(candidate).length > CFG.MAX_RUN_BYTES) throw new Error('candidato supera 256 KB');
    if (candidate === snapshot.text) throw new Error('no hay cambios para guardar; propuesta no produce cambios');
  }

  async function saveEditorCandidate(snapshot, candidate) {
    validateEditorCandidate(snapshot, candidate);
    const current = await editorSnapshot(snapshot.path);
    if (current.hash !== snapshot.hash) throw new Error('el archivo cambió desde que abriste el editor; no se sobrescribió. Conserva tu borrador y vuelve a abrirlo');
    if (snapshot.checkpointBeforeSave) {
      const backup = await createCheckpoint(snapshot.path, snapshot.checkpointLabel || 'Antes de restore desde editor');
      uiLog(`Checkpoint previo: ${backup.id}`, 'info');
      if (backup.hash !== snapshot.hash || (await editorSnapshot(snapshot.path)).hash !== snapshot.hash) throw new Error('archivo cambió; checkpoint previo conservado, no se sobrescribió');
    }
    await atomicWrite(snapshot.path, candidate, { expectedHash: snapshot.hash });
    return editorSnapshot(snapshot.path);
  }

  function validateProposalValue(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('propuesta debe ser un objeto JSON');
    const allowed = ['path', 'hash', 'operation', 'old', 'new'];
    if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error('campos desconocidos en propuesta');
    if (typeof value.path !== 'string' || typeof value.hash !== 'string' || !/^[a-f0-9]{64}$/.test(value.hash)) {
      throw new Error('propuesta requiere path y hash SHA256 completo en minúsculas');
    }
    if (!['replace', 'insert-before', 'insert-after', 'append'].includes(value.operation) ||
        typeof value.new !== 'string' || value.new.includes('\0')) throw new Error('operation/new no válidos');
    const parts = splitPath(value.path);
    if (!parts.length || isInternalPath(value.path)) throw new Error('ruta de propuesta no permitida');
    if (value.operation === 'append') {
      if ('old' in value) throw new Error('append no admite old');
    } else if (typeof value.old !== 'string' || !value.old) throw new Error('old debe ser un bloque exacto no vacío');
    return value;
  }

  async function prepareProposal(value) {
    validateProposalValue(value);
    const snapshot = await editorSnapshot(value.path);
    if (snapshot.hash !== value.hash) throw new Error('hash obsoleto; usa view y solicita una propuesta para la versión actual');
    let candidate;
    if (value.operation === 'append') {
      if ('old' in value) throw new Error('append no admite old');
      candidate = snapshot.text + value.new;
    } else {
      if (typeof value.old !== 'string' || !value.old) throw new Error('old debe ser un bloque exacto no vacío');
      const index = snapshot.text.indexOf(value.old);
      if (index < 0) throw new Error('bloque old no encontrado; no se modifica el archivo');
      if (snapshot.text.indexOf(value.old, index + 1) >= 0) throw new Error('bloque old ambiguo; debe coincidir una sola vez');
      const replacement = value.operation === 'replace' ? value.new :
        value.operation === 'insert-before' ? value.new + value.old : value.old + value.new;
      candidate = snapshot.text.slice(0, index) + replacement + snapshot.text.slice(index + value.old.length);
    }
    validateEditorCandidate(snapshot, candidate);
    return { snapshot, candidate };
  }

  def('view', 'Texto', 'view <archivo> [--from N] [--to N]', 'Código numerado y hash para propuestas de IA', async (ctx) => {
    const { pos, flags } = parseArgs(ctx.args, { from: 'v', to: 'v' });
    if (pos.length !== 1) throw new Error('uso: view <archivo> [--from N] [--to N]');
    const snapshot = await editorSnapshot(pos[0]);
    const rows = snapshot.text.replace(/\r\n?/g, '\n').split('\n');
    const from = toInt(flags.from, 1, '--from'), to = toInt(flags.to, rows.length, '--to');
    if (from < 1 || to < from || from > rows.length || to > rows.length) throw new Error('rango de líneas no válido');
    return `Archivo: ${JSON.stringify(snapshot.path)}\nSHA256: ${snapshot.hash}\nLíneas ${from}-${to} de ${rows.length}; números solo referencia, no forman parte del código.\n` +
      rows.slice(from - 1, to).map((line, i) => `${String(from + i).padStart(5)} | ${line}`).join('\n');
  });

  def('propose', 'Sistema', 'propose <propuesta.json|JSON entre comillas>', 'Prepara cambio con hash; abre editor para revisar/aprobar', async (ctx) => {
    if (ctx.args.length !== 1) throw new Error('uso: propose <propuesta.json|JSON entre comillas>');
    if (editorOpen) throw new Error('cierra el editor actual antes de proponer otro cambio');
    const input = ctx.args[0].trim();
    const json = input.startsWith('{') ? input : (await editorSnapshot(input)).text;
    let value;
    try { value = JSON.parse(json); }
    catch (e) { throw new Error(`JSON de propuesta no válido: ${e.message}`); }
    const proposal = await prepareProposal(value);
    ctx.openEditor(proposal);
    return `Propuesta preparada: ${proposal.snapshot.path}. Archivo intacto; revisa el diff y confirma Aplicar.`;
  });

  def('replace', 'Texto', 'replace <archivo> <old> <new> [--all] [--hash SHA256] [--dry-run]', 'Reemplazo literal con contador, diff y aprobación; nunca guarda directamente', async (ctx) => {
    const { pos, flags } = parseArgs(ctx.args, { all: 'b', hash: 'v', 'dry-run': 'b' });
    if (pos.length !== 3) throw new Error('uso: replace <archivo> <old> <new> [--all] [--hash SHA256] [--dry-run]');
    if (editorOpen) throw new Error('cierra el editor actual antes de proponer otro cambio');
    const snapshot = await editorSnapshot(pos[0]);
    const hash = flags.hash === undefined ? snapshot.hash : flags.hash;
    let proposal, count;
    if (flags.all) {
      if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('hash SHA256 completo en minúsculas requerido');
      if (hash !== snapshot.hash) throw new Error('hash obsoleto; usa view para la versión actual');
      const result = replaceEditorText(snapshot.text, pos[1], pos[2], true);
      validateEditorCandidate(snapshot, result.text);
      proposal = { snapshot, candidate: result.text };
      count = result.count;
    } else {
      proposal = await prepareProposal({ path: snapshot.path, hash, operation: 'replace', old: pos[1], new: pos[2] });
      count = 1;
    }
    ctx.openEditor(proposal);
    return `${count} sustitución(es) propuesta(s): ${snapshot.path}. Archivo intacto (dry-run); revisa el diff y confirma Aplicar.`;
  });

  let editorOpen = false;
  async function openCodeEditor(path, proposal = null) {
    if (busy || editorOpen) { uiLog('Ya hay una operación o editor abierto.', 'err'); return false; }
    editorOpen = true;
    ui?.updateState?.();
    let release;
    try {
      let snapshot = await editorSnapshot(path);
      if (proposal && snapshot.hash !== proposal.snapshot.hash) throw new Error('archivo cambió antes de abrir la propuesta; usa view de nuevo');
      if (proposal?.checkpointBeforeSave) snapshot.checkpointBeforeSave = true;
      if (proposal?.checkpointLabel) snapshot.checkpointLabel = proposal.checkpointLabel;
      const host = h('div', { id: 'dv-code-editor' });
      const shadow = host.attachShadow({ mode: 'closed' });
      let saving = false, approvedCandidate = null;
      const status = h('div', { class: 'status', role: 'status' });
      const report = (text, error = false) => { status.textContent = text; status.style.color = error ? '#f87171' : '#93c5fd'; };
      const gutter = h('pre', { class: 'gutter', 'aria-hidden': 'true' });
      const code = h('textarea', { class: 'code', spellcheck: 'false', wrap: 'off', 'aria-label': `Código de ${path}` });
      const normalized = snapshot.text.replace(/\r\n?/g, '\n');
      const baseline = normalized;
      code.value = (proposal ? proposal.candidate : snapshot.text).replace(/\r\n?/g, '\n');
      const initialDraft = code.value;
      const candidate = () => proposal && code.value === initialDraft ? proposal.candidate :
        code.value === baseline ? snapshot.text :
        snapshot.text.includes('\r\n') && !snapshot.text.replace(/\r\n/g, '').includes('\n')
          ? code.value.replace(/\n/g, '\r\n') : code.value;
      const diff = h('pre', { class: 'diff', 'aria-label': 'Diferencias propuestas', style: 'display:none' });
      const apply = h('button', { disabled: true }, 'Aplicar cambios');
      const sync = () => {
        gutter.textContent = Array.from({ length: code.value.split('\n').length }, (_, i) => i + 1).join('\n');
        approvedCandidate = null; apply.disabled = true; diff.style.display = 'none';
        report('Borrador local · aún no guardado');
      };
      code.addEventListener('input', sync);
      code.addEventListener('scroll', () => { gutter.scrollTop = code.scrollTop; });
      const search = h('textarea', { class: 'query', rows: '2', 'aria-label': 'Buscar texto exacto', placeholder: 'Buscar texto o función (literal)' });
      const replacement = h('textarea', { class: 'query', rows: '2', 'aria-label': 'Reemplazar por', placeholder: 'Código de reemplazo' });
      const find = h('button', { onclick: () => {
        if (!search.value) { report('Escribe un texto para buscar.', true); return; }
        const from = code.selectionEnd;
        let index = code.value.indexOf(search.value, from);
        if (index < 0) index = code.value.indexOf(search.value);
        if (index < 0) { report('Sin coincidencias.', true); return; }
        code.focus(); code.setSelectionRange(index, index + search.value.length);
        const line = code.value.slice(0, index).split('\n').length;
        code.scrollTop = Math.max(0, (line - 3) * 20); gutter.scrollTop = code.scrollTop;
        report(`Coincidencia en línea ${line}`);
      } }, 'Buscar siguiente');
      const replace = (all) => {
        if (saving) return;
        try {
          const result = replaceEditorText(code.value, search.value, replacement.value, all);
          code.value = result.text; sync(); report(`${result.count} reemplazo(s) en el borrador. Revisa el diff.`);
        } catch (e) { report(e.message, true); }
      };
      const preview = h('button', { onclick: async () => {
        if (saving) return;
        const proposed = candidate();
        try {
          validateEditorCandidate(snapshot, proposed);
          const engine = await getDiff();
          const patch = engine.createTwoFilesPatch(`a/${path}`, `b/${path}`, snapshot.text, proposed, '', '', { context: 3, timeout: 2000 });
          if (patch === undefined) throw new Error('diff excedió el tiempo límite');
          diff.textContent = patch; diff.style.display = 'block';
          approvedCandidate = proposed;
          apply.disabled = candidate() !== proposed;
          report('Revisa el diff completo; Aplicar comprueba la versión original.');
        } catch (e) { approvedCandidate = null; apply.disabled = true; report(e.message, true); }
      } }, 'Revisar diff');
      release = () => { host.remove(); editorOpen = false; ui?.updateState?.(); };
      const close = h('button', { onclick: () => {
        if (saving) return;
        if (candidate() !== snapshot.text && !confirm('¿Descartar el borrador sin guardar?')) return;
        release();
      } }, 'Cerrar');
      apply.addEventListener('click', async () => {
        if (saving || busy || approvedCandidate === null || candidate() !== approvedCandidate) {
          report('Revisa de nuevo el diff o espera a que termine la operación.', true); return;
        }
        if (!confirm(`¿Aplicar el diff revisado a "${path}"? ${snapshot.checkpointBeforeSave ?
          'Se creará y verificará un checkpoint previo; si falla, no se guarda.' :
          'No crea backup automático.'} No crea commit.`)) return;
        saving = true; setBusy(true); code.readOnly = true; apply.disabled = true;
        try {
          snapshot = await saveEditorCandidate(snapshot, approvedCandidate);
          uiLog(`Editor: guardado y verificado ${path} (SHA256 ${snapshot.hash.slice(0, 8)}). Revisa git diff.`, 'info');
          release();
        } catch (e) { report(e.message, true); }
        finally { saving = false; setBusy(false); code.readOnly = false; await ui?.refresh(); }
      });
      shadow.append(h('style', {}, `
        :host{all:initial} .editor{position:fixed;inset:4%;z-index:1000001;background:#1e1e1e;color:#ddd;border:1px solid #555;border-radius:10px;box-shadow:0 15px 60px #0009;display:flex;flex-direction:column;padding:16px;gap:10px;font:13px system-ui}
        .toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center} button{background:#094771;color:white;border:1px solid #38617e;border-radius:5px;padding:7px 12px;cursor:pointer} button:disabled{opacity:.4;cursor:default}
        .queries{display:flex;gap:8px}.query{width:50%;background:#252526;color:#eee;border:1px solid #555;padding:8px;font:12px monospace;resize:vertical}
        .source{display:flex;flex:1;min-height:120px;border:1px solid #444;overflow:hidden}.gutter,.code{font:13px/20px Consolas,monospace;padding:10px 8px;margin:0;box-sizing:border-box;tab-size:2}
        .gutter{background:#252526;color:#858585;text-align:right;overflow:hidden;min-width:55px}.code{flex:1;min-width:0;background:#1e1e1e;color:#d4d4d4;border:0;resize:none;outline:none;white-space:pre}
        .diff{margin:0;padding:10px;background:#111;color:#b5cea8;overflow:auto;max-height:30vh;font:12px/18px monospace;white-space:pre}.status{font-size:12px;overflow-wrap:anywhere}
      `));
      shadow.append(h('section', { class: 'editor', role: 'dialog', 'aria-label': `Editor de ${path}` },
        h('div', { class: 'toolbar' }, h('strong', {}, `Editor local · ${path}`), preview, apply, close),
        h('div', { class: 'queries' }, search, replacement),
        h('div', { class: 'toolbar' }, find,
          h('button', { onclick: () => replace(false) }, 'Reemplazar primero'),
          h('button', { onclick: () => replace(true) }, 'Reemplazar todos')),
        h('div', { class: 'source' }, gutter, code), diff, status));
      for (const type of ['keydown', 'keyup', 'keypress']) host.addEventListener(type, (e) => e.stopPropagation());
      document.body.append(host); sync(); report(`SHA256 original: ${snapshot.hash} · UTF-8 · pega o edita funciones`);
      if (proposal) preview.click();
      return true;
    } catch (e) {
      if (release) release(); else editorOpen = false;
      ui?.updateState?.();
      uiLog(`❌ Editor: ${e.message}`, 'err');
      return false;
    }
  }

  async function deleteUserFiles(path = null) {
    if (busy) {
      uiLog('⏳ Hay una operación en curso; no se ha borrado nada.', 'err');
      return;
    }
    setBusy(true);
    let deleted = 0;
    try {
      let paths;
      if (path !== null) {
        if (isInternalPath(path)) throw new Error('no se pueden borrar metadatos internos');
        await requireFile(path);
        paths = [splitPath(path).join('/')];
      } else {
        paths = (await listFiles()).filter((file) => !isInternalPath(file.path)).map((file) => file.path);
      }
      if (!paths.length) { uiLog('No hay archivos de usuario para eliminar.', 'info'); return; }
      const preview = paths.slice(0, 15).join('\n') + (paths.length > 15 ? `\n... y ${paths.length - 15} más` : '');
      if (!confirm(`¿Eliminar ${paths.length} archivo(s) de usuario?\n${preview}\nSe conservan .git, .dv y .dv_tmp. No hay deshacer automático.`)) {
        uiLog('Borrado cancelado; no se ha eliminado nada.', 'info');
        return;
      }
      for (const target of paths) {
        await requireFile(target);
        await removePath(target, false);
        if (await getHandle(target)) throw new Error(`el archivo sigue existiendo: ${target}`);
        deleted++;
      }
      uiLog(`Eliminados ${deleted} archivo(s). Git y journal conservados; revisa git status.`, 'info');
    } catch (e) {
      uiLog(`❌ Borrado detenido tras ${deleted} archivo(s): ${e.message}. No se revierten los borrados anteriores.`, 'err');
    } finally {
      setBusy(false);
      await ui?.refresh();
    }
  }

  function staticPreviewDocument(source) {
    const template = document.createElement('template');
    template.innerHTML = source;
    template.content.querySelectorAll('script, iframe, frame, object, embed, base, meta[http-equiv], link').forEach((el) => el.remove());
    template.content.querySelectorAll('a, area, form').forEach((el) => {
      el.removeAttribute('href');
      el.removeAttribute('action');
    });
    const doc = document.implementation.createHTMLDocument('Vista previa estática');
    const policy = doc.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    policy.content = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'";
    doc.head.prepend(policy);
    doc.body.append(template.content);
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
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
      if (entry.path !== path && !entry.path.startsWith(path + '/')) continue;
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
      const html = staticPreviewDocument(snapshot.text);
      if (htmlPreviews.get(entry.path) !== entry || revision !== entry.revision) return;
      entry.channel.postMessage({ type: 'render', html, hash: snapshot.hash });
    } catch (e) {
      if (htmlPreviews.get(entry.path) !== entry || revision !== entry.revision) return;
      entry.channel.postMessage({ type: 'error', text: e.message });
      uiLog(`Vista previa ${entry.path}: ${e.message}`, 'err');
    }
  }

  function htmlPreviewShell(path, channelName, nonce) {
    const encode = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; frame-src about:; connect-src 'none'; base-uri 'none'; form-action 'none'">
      <meta name="referrer" content="no-referrer"><title>DV · Vista previa HTML</title>
      <style>html,body{height:100%;margin:0;font:13px system-ui;background:#18181b;color:#f4f4f5}
      body{display:flex;flex-direction:column}header{padding:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      button{padding:7px 12px;background:#2563eb;color:white;border:0;border-radius:5px;cursor:pointer}
      button:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}
      #status{padding:0 10px 8px;overflow-wrap:anywhere}iframe{flex:1;width:100%;border:0;background:white;min-height:0}</style></head>
      <body><header><strong id="path"></strong><button id="refresh" type="button">Actualizar desde disco</button>
      <span>HTML estático · sin scripts ni red</span></header><div id="status" role="status" aria-live="polite">Conectando con el panel...</div>
      <iframe sandbox="" referrerpolicy="no-referrer" title="Vista previa HTML aislada"></iframe>
      <script nonce="${nonce}">
      'use strict';
      const path = ${encode(path)}, name = ${encode(channelName)};
      document.title = 'DV · ' + path;
      document.getElementById('path').textContent = path;
      const status = document.getElementById('status'), frame = document.querySelector('iframe');
      let channel, timer;
      const request = () => {
        clearTimeout(timer);
        status.textContent = 'Leyendo la versión guardada en OPFS...';
        channel.postMessage({type:'refresh'});
        timer = setTimeout(() => {
          frame.removeAttribute('srcdoc');
          status.textContent = 'El panel no responde. Mantén DeepSeek abierto. Si lo recargaste, vuelve a pulsar Ejecutar allí.';
        }, 5000);
      };
      try {
        channel = new BroadcastChannel(name);
        channel.onmessage = ({data}) => {
          if (!data || typeof data !== 'object') return;
          if (data.type === 'render' && typeof data.html === 'string' && /^[a-f0-9]{64}$/.test(data.hash)) {
            clearTimeout(timer);
            frame.srcdoc = data.html;
            status.textContent = 'Actualizado: ' + new Date().toLocaleTimeString() + ' · SHA256 ' + data.hash.slice(0, 8) +
              ' · Solo cambios guardados. Actualización automática mientras el panel esté abierto.';
          } else if (data.type === 'error' && typeof data.text === 'string') {
            clearTimeout(timer); frame.removeAttribute('srcdoc');
            status.textContent = 'No se pudo actualizar: ' + data.text;
          }
        };
        document.getElementById('refresh').addEventListener('click', request);
        request();
        addEventListener('pagehide', () => { clearTimeout(timer); channel.close(); });
      } catch (error) {
        status.textContent = 'No se pudo conectar la vista previa: ' + error.message;
      }
      </script></body></html>`;
  }

  async function openHTMLPreview(path) {
    path = splitPath(path).join('/');
    if (!confirm(`¿Abrir "${path}" en una pestaña de vista previa HTML estática?\nSin scripts, red ni recursos externos. Se actualizará al guardar; requiere mantener DeepSeek abierto.`)) {
      throw new Error('ejecución cancelada');
    }
    if (typeof BroadcastChannel !== 'function') throw new Error('el navegador no admite BroadcastChannel para conectar la vista previa');
    const previous = htmlPreviews.get(path);
    if (previous && !previous.tab.closed) {
      previous.tab.focus();
      await updateHTMLPreview(previous);
      return `Vista previa HTML actualizada en su pestaña: ${path}.`;
    }
    if (previous) closeHTMLPreview(previous);
    let entry = null, channel = null, url = null, tab = null;
    try {
      const channelName = 'dv-preview-' + crypto.randomUUID();
      channel = new BroadcastChannel(channelName);
      const nonce = crypto.randomUUID().replaceAll('-', '');
      url = URL.createObjectURL(new Blob([htmlPreviewShell(path, channelName, nonce)], { type: 'text/html;charset=utf-8' }));
      // Navigate in the initial trusted click; detaching opener first prevents later navigation.
      tab = window.open(url, '_blank');
      if (!tab) throw new Error('el navegador bloqueó la pestaña; permite ventanas emergentes para DeepSeek y reintenta');
      tab.opener = null;
      entry = { path, tab, channel, url, revision: 0, timer: null, watch: null };
      htmlPreviews.set(path, entry);
      channel.onmessage = ({ data }) => {
        if (data?.type === 'refresh') return updateHTMLPreview(entry);
      };
      await editorSnapshot(path);
      entry.watch = setInterval(() => {
        if (tab.closed) closeHTMLPreview(entry);
      }, 5000);
      return `Vista previa HTML abierta en pestaña: ${path}. Actualización automática al guardar y botón Actualizar desde disco; F5 vuelve a leer OPFS mientras el panel siga abierto. Sin scripts, red ni recursos OPFS relativos.`;
    } catch (e) {
      if (entry) closeHTMLPreview(entry, { closeTab: true });
      else { channel?.close(); if (url) URL.revokeObjectURL(url); tab?.close(); }
      throw e;
    }
  }

  function consoleRunnerDocument(source, token) {
    const workerSource = `
      const format = value => {
        if (typeof value === 'string') return value;
        try { return JSON.stringify(value) ?? String(value); }
        catch { return '[valor no serializable]'; }
      };
      let count = 0, chars = 0;
      for (const level of ['log','info','warn','error','debug']) {
        console[level] = (...args) => {
          const text = args.map(format).join(' ').slice(0, 4000);
          if (++count > 100 || (chars += text.length) > 20000) throw new Error('limite de salida excedido');
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
      try {
        url = URL.createObjectURL(new Blob([${encoded}], {type:'text/javascript'}));
        worker = new Worker(url);
        worker.onmessage = event => { emit(event.data); if(event.data.type !== 'log') stop(); };
        worker.onerror = event => { emit({type:'error',text:event.message || 'error de sintaxis o arranque del Worker'}); stop(); };
        timer = setTimeout(() => { emit({type:'error',text:'tiempo limite de 3 segundos excedido'}); stop(); }, ${CFG.RUN_TIMEOUT_MS});
        addEventListener('pagehide', stop);
      } catch(error) { emit({type:'error',text:String(error.message)}); stop(); }
      </script>`;
  }

  async function runFile(args) {
    const { pos } = parseArgs(args, {});
    if (pos.length !== 1) throw new Error('uso: run <archivo.html|archivo.js>');
    const path = pos[0];
    if (isInternalPath(path)) throw new Error('no se ejecutan metadatos internos');
    if (!/\.(html?|js)$/i.test(path)) throw new Error('motor no disponible; run admite HTML estático y JavaScript de consola, no Node/Python/shell');
    if (/\.html?$/i.test(path)) return openHTMLPreview(path);
    const file = await (await requireFile(path)).getFile();
    if (file.size > CFG.MAX_RUN_BYTES) throw new Error('archivo supera 256 KB para run');
    let source;
    try { source = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
    catch (e) { if (e.name === 'TypeError') throw new Error('run requiere texto UTF-8 válido'); throw e; }
    if (!confirm(`¿Abrir "${path}" (${fmtBytes(file.size)}) en modo ${/\.js$/i.test(path) ? 'JavaScript de consola aislado, máximo 3 segundos' : 'vista previa HTML sin scripts'}? Sin acceso al disco, sesión ni red.`)) {
      throw new Error('ejecución cancelada');
    }
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', /\.js$/i.test(path) ? 'allow-scripts' : '');
    frame.referrerPolicy = 'no-referrer';
    frame.style.display = 'none';
    const token = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const output = [];
      let count = 0, chars = 0;
      const finish = (error) => {
        clearTimeout(timer);
        window.removeEventListener('message', receive);
        frame.remove();
        if (error) reject(new Error(`${path}: ${error}\n${output.join('\n')}`));
        else resolve(`Ejecutado: ${path}\n${output.join('\n') || '(sin salida)'}\n[fin]`);
      };
      const receive = (event) => {
        if (event.source !== frame.contentWindow || event.data?.token !== token) return;
        const data = event.data;
        if (data.type === 'log' && typeof data.text === 'string') {
          if (++count > 100 || (chars += data.text.length) > 21000) { finish('limite de salida excedido'); return; }
          const text = data.text.slice(0, 4100);
          output.push(text);
          uiLog(text);
        } else if (data.type === 'error') finish(String(data.text).slice(0, 4000));
        else if (data.type === 'done') finish();
      };
      const timer = setTimeout(() => finish('no respondió el entorno aislado dentro del límite'), CFG.RUN_TIMEOUT_MS + 1500);
      window.addEventListener('message', receive);
      frame.srcdoc = consoleRunnerDocument(source, token);
      document.body.append(frame);
    });
  }

  def('run', 'Sistema', 'run <archivo.html|archivo.js>', 'HTML estático o consola JS aislada (sin Node/red/OPFS)', (ctx) => runFile(ctx.args));

  // Ficheros & Transacciones
  def('ls', 'Ficheros', 'ls [-R] [ruta]', 'Lista archivos', async (ctx) => {
    const { flags, pos } = parseArgs(ctx.args, { R: 'b' });
    if (pos.length > 1) throw new Error('uso: ls [-R] [ruta]');
    const h = pos[0] ? await getHandle(pos[0]) : rootDir;
    if (!h) throw new Error(`no existe: ${pos[0]}`);
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
    return rows.join('\n') || '(carpeta vacía)';
  });

  def('rm', 'Ficheros', 'rm [-r] <ruta>', 'Elimina una ruta tras confirmación (sin deshacer)', async (ctx) => {
    const { flags, pos } = parseArgs(ctx.args, { r: 'b' });
    if (pos.length !== 1) throw new Error('uso: rm [-r] <ruta>');
    const parts = splitPath(pos[0]);
    if (!parts.length) throw new Error('no se puede borrar la raíz');
    if (['.git', '.dv', '.dv_tmp'].includes(parts[0])) throw new Error('no se pueden borrar metadatos internos con rm');
    const path = parts.join('/');
    const handle = await getHandle(path);
    if (!handle) throw new Error(`no existe: ${path}`);
    if (handle.kind === 'directory' && !flags.r) throw new Error('para borrar una carpeta usa rm -r');
    if (!confirm(`¿Eliminar "${path}"${handle.kind === 'directory' ? ' y todo su contenido' : ''}? Esta operación no tiene deshacer automático.`)) {
      throw new Error('borrado cancelado; no se ha eliminado nada');
    }
    await removePath(path, !!flags.r);
    if (await getHandle(path)) throw new Error(`no se pudo verificar el borrado: ${path}`);
    return `Eliminado: ${path}`;
  });

  def('cp', 'Ficheros', 'cp <origen> <destino>', 'Copia archivo y verifica SHA256; confirma reemplazo', (ctx) => copyOrMove(ctx.args, false));
  def('mv', 'Ficheros', 'mv <origen> <destino>', 'Copia verificada + borrado confirmado del origen', (ctx) => copyOrMove(ctx.args, true));

  def('write', 'Ficheros', 'write <file> <texto...>', 'Escritura atómica segura (Capa 2)', async (ctx) => {
    if (ctx.args.length < 2) throw new Error('uso: write <file> <texto...>');
    const res = await atomicWrite(ctx.args[0], ctx.args.slice(1).join(' '));
    return `[Tx OK] ${ctx.args[0]} (${fmtBytes(res.bytes)}, SHA256: ${res.hash.slice(0, 8)}...)`;
  });

  def('save', 'Ficheros', 'save <file>', 'Guarda último resultado atómicamente', async (ctx) => {
    if (!ctx.args[0]) throw new Error('uso: save <file>');
    if (!lastResult) throw new Error('no hay resultado previo');
    const res = await atomicWrite(ctx.args[0], lastResult);
    return `[Tx OK] Guardado ${ctx.args[0]} (${fmtBytes(res.bytes)})`;
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
    if (pos.length < 1 || pos.length > 2) throw new Error('uso: grep [-i] [-n] [-F] <patrón> [archivo]');
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
        return `[${j.timestamp.slice(11, 19)}] ${j.type} -> ${j.path} (${j.bytes || 0} B, hash:${(j.newHash || '').slice(0, 7)})`;
      }).join('\n');
    } catch { return '(registro de auditoría vacío)'; }
  });

  // Git Local
  def('git', 'Git', 'git <init|status|add|commit|log|diff|show|branch|checkout> [args]', 'Control de versiones local (sin remoto)', async (ctx) => {
    if (!ctx.args.length) throw new Error('uso: git <init|status|add|commit|log|diff|show|branch|checkout>');
    const sub = ctx.args[0].toLowerCase();
    const subArgs = ctx.args.slice(1);
    const { git, fs } = await getGit();
    if (['status', 'add', 'commit', 'log', 'diff', 'show', 'branch', 'checkout'].includes(sub)) {
      const repository = await getHandle('.git');
      if (!repository) throw new Error('no hay repositorio Git. Usa: git init');
      if (repository.kind !== 'directory') throw new Error('.git no es una carpeta; revisa el repositorio');
    }

    switch (sub) {
      case 'init':
        await git.init({ fs, dir: '.', defaultBranch: 'main' });
        return 'Repositorio Git local inicializado (rama: main).';
      case 'status': {
        const matrix = await git.statusMatrix({ fs, dir: '.' });
        const rows = [];
        for (const [filepath, head, workdir, stage] of matrix) {
          if (isInternalPath(filepath) || (head === workdir && workdir === stage)) continue;
          rows.push(`${gitChangeDescription(head, workdir, stage).padEnd(18)} ${filepath}`);
        }
        return rows.length ? rows.join('\n') : 'Working tree limpio. Nada pendiente de confirmar.';
      }
      case 'add':
        if (!subArgs[0]) throw new Error('uso: git add <ruta|--all>');
        if (subArgs[0] === '--all' || subArgs[0] === '.') {
          const c = await stageAllGitFiles(git, fs);
          return `${c} archivos añadidos al staging area.`;
        }
        if (isInternalPath(subArgs[0])) throw new Error('no se pueden versionar metadatos internos');
        await git.add({ fs, dir: '.', filepath: splitPath(subArgs[0]).join('/') });
        return `Añadido al staging: ${subArgs[0]}`;
      case 'commit': {
        const { flags } = parseArgs(subArgs, { m: 'v' });
        if (!flags.m) throw new Error('uso: git commit -m "mensaje"');
        const matrix = await git.statusMatrix({ fs, dir: '.' });
        if (!matrix.some(([path, head, , stage]) => !isInternalPath(path) && head !== stage)) {
          throw new Error('nada nuevo en staging. Usa: git add <archivo> o git add --all');
        }
        const oid = await git.commit({
          fs, dir: '.', message: flags.m,
          author: { name: 'DV User', email: 'user@local.lan' }
        });
        const branch = await git.currentBranch({ fs, dir: '.' });
        return `[${branch || 'detached HEAD'} ${oid.slice(0, 7)}] ${flags.m}`;
      }
      case 'branch': {
        if (subArgs.length > 1 || subArgs[0]?.startsWith('-')) throw new Error('uso: git branch [nombre] (sin borrar, renombrar ni --force)');
        if (!subArgs.length) {
          const current = await git.currentBranch({ fs, dir: '.' });
          const branches = await git.listBranches({ fs, dir: '.' });
          const rows = branches.map(name => `${name === current ? '*' : ' '} ${name}`);
          if (current && !branches.includes(current)) rows.unshift(`* ${current} (sin commits)`);
          return rows.join('\n') || '(sin ramas locales; HEAD separado)';
        }
        if (!await gitHeadOid(git, fs)) throw new Error('crea el primer commit antes de crear otra rama');
        await git.branch({ fs, dir: '.', ref: subArgs[0] });
        return `Rama creada: ${subArgs[0]}. No se cambió de rama; usa git checkout ${JSON.stringify(subArgs[0])}.`;
      }
      case 'checkout':
        if (subArgs.length !== 1 || subArgs[0].startsWith('-')) throw new Error('uso: git checkout <rama-local> (sin --force ni checkout de archivos/commits)');
        if (editorOpen) throw new Error('cierra el editor antes de cambiar de rama');
        return checkoutBranch(git, fs, subArgs[0]);
      case 'log': {
        if (!await gitHeadOid(git, fs)) return 'Sin commits aún en esta rama.';
        const commits = await git.log({ fs, dir: '.', depth: 10 });
        return commits.map(c => `${c.oid.slice(0, 7)} - ${c.commit.message.trim()} (${formatGitDate(c.commit.author?.timestamp)})`).join('\n');
      }
      case 'diff':
        return gitDiff(git, fs, subArgs);
      case 'show':
        return gitShow(git, fs, subArgs);
      default:
        throw new Error(`subcomando no implementado: ${sub}`);
    }
  });

  def('help', 'Sistema', 'help', 'Muestra ayuda de comandos', async () => {
    const groups = ['Ficheros', 'Git', 'Texto', 'Auditoría', 'Sistema'];
    const p = settings.prefix;
    const out = ['COMANDOS DISCO VIRTUAL (100% Local por defecto):'];
    for (const g of groups) {
      out.push('', `[${g.toUpperCase()}]`);
      for (const c of REG.values()) {
        if (c.group === g) out.push(`  ${(p + c.usage).padEnd(36)} ${c.desc}`);
      }
    }
    out.push('',
      'PIPES Y REDIRECCIONES:',
      '  cat entrada.txt | head -n 10 > salida.txt',
      '  > reemplaza; >> añade; .gz se comprime (sin >>).',
      '  rm pide confirmación y no ofrece deshacer automático.',
      '  Explorador: Eliminar por archivo o Eliminar todos (conserva Git/journal).',
      '  Editar: código numerado, buscar/reemplazar literal y diff antes de Aplicar.',
      '  Ejecutar junto a Editar: mismo run local con confirmación, HTML estático o consola JS.',
      '  Primeros pasos prepara ejemplos sin ejecutarlos; Ampliar/Reducir conserva el comando escrito.',
      '  Descargar por archivo: bytes originales a la PC (también binarios/gzip), sin chat ni staging.',
      '  El navegador decide guardar/preguntar; descarga solicitada no confirma guardado en la PC.',
      '  checkpoint archivo [etiqueta]: copia bytes/hash hasta 256 KB; checkpoint --list muestra IDs.',
      '  restore ID: ruta original; texto existente en editor/diff, binario o ausente con confirmación.',
      '  Restore conserva checkpoint previo si sobrescribe; no hace staging/commit ni elimina copias.',
      '  checkpoint --list [--file ruta] [--tag texto]: recientes primero; tag busca literal en etiqueta.',
      '  checkpoint show ID [--content] / diff ID1 ID2: consulta sin restaurar; contenido/diff solo UTF-8.',
      '  checkpoint delete ID / prune --keep N / prune --older-than 7d: borrado confirmado.',
      '  Limpieza protege más reciente por archivo y empates; --keep N cuenta globalmente, conserva además esas copias.',
      '  Editor UTF-8 hasta 256 KB; sin corrector automático ni commit automático.',
      '  view archivo --from 1 --to 40: líneas + hash; --share requiere confirmación.',
      '  propose propuesta.json o propose JSON entre comillas: candidato, diff y aprobación.',
      '  replace archivo "old" "new": bloque literal único; --all reemplaza todas las coincidencias no solapadas.',
      '  replace siempre prepara sin guardar (también --dry-run); --hash SHA256 exige esa versión.',
      '  Para bloques multilínea o propuestas IA usa propose con hash y JSON.',
      '  Chat: bloque dv con JSON puro o !propose inline; Revisar parche en DV abre diff, nunca ejecuta otros comandos.',
      '  Aprobar parche del chat crea checkpoint previo y valida hash; no envía nada ni hace commit.',
      '  Compartir archivo incluye SHA256 y protocolo dv; no comparte archivos automáticamente.',
      '  grep [-i] [-n] [-F] patrón [archivo]: regex/literal, números de línea y pipes.',
      '  POSIBLE FUGA: solo correlaciona un intento manual reciente (5 s) con el comando exacto en el DOM.',
      '  Ignora carga automática sin intento; no verifica tráfico ni recepción del servidor.',
      '  JSON: path, hash completo, operation, old (bloque único), new (texto exacto).',
      '  operation: replace, insert-before, insert-after, append (sin old).',
      '  Saltos dentro del JSON: \\n o \\r\\n; no se añaden saltos automáticamente.',
      '  Explorar / Importar: elige archivos del equipo; guarda bytes en la raíz OPFS.',
      '  Importación local, máximo 512 MB por archivo; confirma reemplazos, sin staging.',
      '  cp/mv: solo archivos, destino completo; preservan bytes (también .gz).',
      '  cp confirma reemplazos; mv siempre confirma. Máximo verificable: 512 MB.',
      '  mv no es rename atómico: copia y verifica antes de borrar el origen.',
      '  run: HTML estático (sin scripts/recursos relativos); JS de consola aislado.',
      '  HTML abre pestaña conectada: autoactualiza al guardar, Actualizar desde disco y F5; mantén DeepSeek abierto.',
      '  JS: máximo 3 segundos, 100 mensajes/20 KB; usa await para trabajo asíncrono.',
      '  Sin DOM, Node, dependencias, red ni OPFS; salida disponible para save/--share.',
      '  git diff: staging vs archivos; git diff --staged: HEAD vs staging.',
      '  git diff [--staged] <ref>: referencia vs archivos o staging.',
      '  Diff unificado UTF-8; binarios solo informan cambio; sin seguimiento: git status.',
      '  git show [ref]: datos del commit (HEAD por defecto), no su diff.',
      '  git show ref:archivo: texto histórico UTF-8 hasta 256 KB; sin checkout ni restauración.',
      '  Referencias de commit: HEAD, nombre de rama o SHA completo; sin HEAD~N ni SHA abreviado.',
      '  El log resume 800 caracteres; git show HEAD:archivo | head -n 20 permite ver un fragmento.',
      '  Redirigir show guarda texto, no exporta bytes exactos (saltos/BOM pueden cambiar).',
      '  Git remoto todavía no está implementado.',
      '  Guardar cambios en Git: revisa lista y mensaje; confirma add --all + commit local, incluidos borrados.',
      '  El botón usa los archivos actuales, reemplaza staging anterior y excluye metadatos; no elimina comandos.',
      '  Ver cambios muestra estado, diff sin staging y diff staged; sin revertir automático.',
      '  git branch [nombre]: lista/crea ramas locales; * indica activa; crear no cambia de rama.',
      '  git checkout rama: confirma cambio; bloquea staging/cambios/archivos ignorados o sin seguimiento.',
      '  Sin --force, borrado de ramas, HEAD separado ni restauración Git de archivos.',
      '',
      'CANALES DE USO:',
      '  1. Panel Soberano: Entrada robusta y privada (0 tokens consumidos).',
      '  2. Atajo en Chat: Escribe !cmd directamente (se ejecuta local y no va al chat).',
      '  3. Compartir con IA:',
      `     - Añade --share para enviar el resumen del comando al chat.`,
      `     - Añade --share-file <ruta> para transferir el archivo completo tras confirmación.`,
      '     - Vista previa y confirmación antes de enviar; no se reemplazan borradores.',
      '     - Archivos UTF-8 sin NUL, máximo 64 KB; metadatos internos excluidos.',
      '     - "--share" entre comillas es texto literal; -- termina las opciones.',
      '     - Usa los botones correspondientes en el panel.');
    return out.join('\n');
  });

  // ============================================================
  // EJECUTOR DEL PIPELINE
  // ============================================================
  async function execute(raw) {
    try {
      const segs = parsePipeline(Array.isArray(raw) ? raw : tokenize(raw.trim()));
      if (segs.some(seg => seg.argv[0].toLowerCase() === 'git' && seg.argv[1]?.toLowerCase() === 'checkout') &&
          (segs.length !== 1 || segs[0].redirect)) throw new Error('git checkout no admite pipes ni redirecciones');
      const editorCommand = segs.find((seg) => ['propose', 'replace', 'checkpoint', 'restore'].includes(seg.argv[0].toLowerCase()));
      if (editorCommand && (segs.length !== 1 || segs[0].redirect)) {
        throw new Error(`${editorCommand.argv[0]} no admite pipes ni redirecciones`);
      }
      let editorRequest = null;
      for (const seg of segs) {
        if (!REG.has(seg.argv[0].toLowerCase())) throw new Error(`comando no reconocido: ${seg.argv[0]}`);
      }
      const redirect = segs[segs.length - 1].redirect;
      if (redirect) {
        if (!splitPath(redirect.file).length || isInternalPath(redirect.file)) throw new Error('destino de redirección no permitido');
        if (redirect.mode === '>>' && /\.gz$/i.test(redirect.file)) throw new Error('no se puede añadir (>>) a un .gz');
      }
      let stream = null;
      for (const seg of segs) {
        const cmd = REG.get(seg.argv[0].toLowerCase());
        if (!cmd) throw new Error(`comando no reconocido: ${seg.argv[0]}`);
        const ctx = { args: seg.argv.slice(1), stdin: stream, warn: (m) => uiLog(`⚠ ${m}`, 'err'),
          openEditor: (proposal) => { editorRequest = proposal; } };
        stream = normalize(await cmd.run(ctx));
      }
      let text;
      if (redirect) {
        const writer = await openWriter(redirect.file, { append: redirect.mode === '>>' });
        try {
          for await (const l of stream) await writer.write(l + '\n');
          const bytes = await writer.close();
          text = `Guardado: ${redirect.file} (${fmtBytes(bytes)} de texto)`;
        } catch (e) {
          await writer.abort();
          throw e;
        }
      } else {
        const parts = [];
        let chars = 0;
        for await (const l of stream) {
          chars += l.length + (parts.length ? 1 : 0);
          if (chars > CFG.MAX_COLLECT_CHARS) throw new Error('salida demasiado grande; usa head o redirige a un archivo');
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

  const adapter = {
    getInput() {
      const all = [...document.querySelectorAll('textarea')].filter(visible);
      return all[0] || document.querySelector('textarea');
    },
    getText: (el) => el.value ?? '',
    setText(el, text) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    findSend(input) {
      let n = input.parentElement;
      for (let d = 0; n && d < 8; d++, n = n.parentElement) {
        const btns = [...n.querySelectorAll('button, [role="button"]')].filter((b) => b.querySelector('svg') && visible(b));
        if (btns.length) return btns[btns.length - 1];
      }
      return null;
    },
    async sendToChat(text) {
      if (chatSending) throw new Error('hay otro envío al chat en curso');
      // Textarea values normalize CRLF/CR to LF, including files created on Windows.
      text = normalizeChatText(text);
      const el = this.getInput();
      if (!el || !visible(el)) throw new Error('no se encontró una entrada de chat visible');
      const previous = this.getText(el);
      if (previous !== '') throw new Error('hay un borrador en el chat; consérvalo o vacía la entrada antes de compartir');
      chatSending = true;
      try {
        this.setText(el, text);
        await sleep(150);
        const btn = await waitFor(() => {
          if (!el.isConnected || this.getInput() !== el || this.getText(el) !== text) {
            throw new Error('la entrada del chat cambió; envío cancelado');
          }
          const b = this.findSend(el);
          return b && isEnabled(b) ? b : null;
        }, CFG.SEND_TIMEOUT_MS);
        if (!btn) throw new Error('no se encontró un botón de envío habilitado; no se envió el mensaje');
        if (!el.isConnected || this.getInput() !== el || this.getText(el) !== text || !isEnabled(btn)) {
          throw new Error('la entrada o el botón del chat cambió; envío cancelado');
        }
        btn.click();
        const cleared = await waitFor(() => this.getInput() && this.getText(this.getInput()) === '', CFG.SEND_TIMEOUT_MS);
        if (!cleared) throw new Error('no se pudo verificar el envío; comprueba el chat antes de reintentar');
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
    if (!splitPath(path).length || isInternalPath(path)) throw new Error('archivo a compartir no permitido');
    const file = await (await requireFile(path)).getFile();
    if (file.size > CFG.MAX_SHARE_FILE_BYTES) throw new Error('archivo supera 64 KB; comparte un resumen con head');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.includes(0)) throw new Error('no se comparten archivos binarios; usa un resumen de texto');
    let content;
    try { content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch (e) {
      if (e.name === 'TypeError') throw new Error('el archivo no es texto UTF-8 válido');
      throw e;
    }
    const fence = safeFence(content);
    const hash = await computeSha256(bytes);
    return `[Archivo OPFS: ${JSON.stringify(path)}; ${fmtBytes(file.size)}]\nSHA256: ${hash}\n${fence}\n${content}\n${fence}\n` +
      'Analiza este archivo. Si propones una corrección, devuelve un bloque Markdown con lenguaje dv y un único objeto JSON puro, sin comandos ni comillas de shell.\n' +
      `Usa path=${JSON.stringify(path)} y hash="${hash}" exactamente; no inventes ni recalcules el hash.\n` +
      'Campos: path, hash, operation, old, new. operation: replace, insert-before, insert-after o append (sin old).\n' +
      'old debe ser texto exacto y coincidir una sola vez; new es texto exacto, no un diff ni código con puntos suspensivos. ' +
      'Escapa saltos como \\n (o \\r\\n si el original los usa). Una propuesta por bloque y archivo. ' +
      'Si falta contexto, pídelo; no supongas acceso al disco. El usuario revisará el diff y aprobará antes de guardar.';
  }

  async function sendWithPreview(message, { confirmSend = true } = {}) {
    message = normalizeChatText(message);
    const input = adapter.getInput();
    if (!input || !visible(input)) throw new Error('no se encontró una entrada de chat visible');
    if (adapter.getText(input) !== '') throw new Error('hay un borrador en el chat; no se ha reemplazado');
    if (confirmSend && !confirm(`¿Compartir con DeepSeek (${message.length} caracteres)?\nVista previa:\n${truncate(message, CFG.ATTACH_PREVIEW_CHARS)}`)) {
      throw new Error('envío cancelado; no se ha compartido nada');
    }
    await adapter.sendToChat(message);
    uiLog('📤 El chat vació la entrada tras solicitar el envío; comprueba la respuesta de DeepSeek.', 'info');
  }

  async function shareFile(path) {
    if (busy) { uiLog('⏳ Hay una operación en curso; reintenta al terminar.', 'err'); return; }
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
      uiLog('⏳ Hay una operación en curso...', 'err');
      return;
    }

    let cmd = rawCommand.trim();
    if (cmd.startsWith(settings.prefix)) cmd = cmd.slice(settings.prefix.length).trim();
    if (!cmd.length) {
      uiLog('⚠ Comando vacío', 'err');
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
        uiLog(`$ ${cleanCmd}  [ejecutado localmente, no enviado al chat]`, 'cmd');
      } else {
        uiLog(`$ ${cleanCmd}`, 'cmd');
      }

      const res = await execute(parsed.tokens);
      editorRequest = res.editor || null;
      uiLog(truncate(res.text || '(sin salida)', 800), res.ok ? '' : 'err');

      const messages = [];
      if (parsed.share || options.forceShare) {
        const summary = truncate(res.text, 1200), fence = safeFence(summary);
        messages.push(`[Diagnóstico DV: ${cleanCmd}]\n${fence}\n${summary}\n${fence}\nAnaliza este resultado.`);
      }
      if (parsed.file) {
        if (!res.ok) throw new Error('el comando falló; no se compartió el archivo');
        messages.push(await fileShareMessage(parsed.file));
      }
      if (messages.length) {
        const directSummary = options.origin === 'panel' && options.forceShare === true &&
          options.directShare === true && !parsed.file;
        await sendWithPreview(messages.join('\n\n'), { confirmSend: !directSummary });
      }
    } catch (e) {
      uiLog(`❌ Error: ${e.message}`, 'err');
    } finally {
      setBusy(false);
      ui?.refresh();
      if (editorRequest) await openCodeEditor(editorRequest.snapshot.path, editorRequest);
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
    if (text.length > CFG.MAX_RUN_BYTES * 12) throw new Error('bloque de propuesta demasiado grande');
    let json = text;
    if (!text.startsWith('{')) {
      const prefixes = [...new Set([settings.prefix, '!'])];
      const prefix = prefixes.find((p) => text.startsWith(p + 'propose'));
      if (!prefix) throw new Error('solo se admite JSON dv o !propose con JSON inline');
      const segs = parsePipeline(tokenize(text.slice(prefix.length)));
      const seg = segs[0];
      if (segs.length !== 1 || seg.redirect || seg.argv.length !== 2 || seg.argv[0] !== 'propose' ||
          !seg.argv[1].trim().startsWith('{')) throw new Error('chat: solo propose con un JSON inline, sin pipes, archivos ni opciones');
      json = seg.argv[1];
    }
    let value;
    try { value = JSON.parse(json); }
    catch (e) { throw new Error(`JSON de propuesta no válido: ${e.message}`); }
    return validateProposalValue(value);
  }

  async function prepareChatProposal(text) {
    if (busy || editorOpen) throw new Error('cierra el editor o espera a que termine la operación antes de revisar otro parche');
    const proposal = await prepareProposal(parseChatProposal(text));
    if (busy || editorOpen) throw new Error('se abrió otra operación durante la preparación; reintenta al terminar');
    return { ...proposal, checkpointBeforeSave: true, checkpointLabel: 'Antes de parche desde chat' };
  }

  function installChatCodeActions() {
    const actions = new Map();
    const scan = () => {
      for (const [pre, action] of actions) {
        if (!pre.isConnected || !action.code.isConnected || isInsidePanel(pre)) {
          action.bar.remove(); actions.delete(pre);
        }
      }
      for (const code of document.querySelectorAll('pre code')) {
        const pre = code.closest('pre');
        if (!pre || isInsidePanel(code)) continue;
        const text = code.textContent.trim();
        const userMessage = code.closest('[data-message-role="user"], [data-role="user"]');
        const assistantMessage = code.closest('[data-message-role="assistant"], [data-role="assistant"], .ds-markdown');
        const marked = code.classList.contains('language-dv') || pre.classList.contains('language-dv') ||
          code.getAttribute('data-language') === 'dv' || pre.getAttribute('data-language') === 'dv';
        const command = [settings.prefix, '!'].some((prefix) => text.startsWith(prefix + 'propose'));
        const eligible = !userMessage && assistantMessage && (marked || command);
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
          button.textContent = 'Revisar parche en DV';
          button.style.cssText = 'padding:6px 10px;background:#047857;color:white;border:1px solid #065f46;border-radius:5px;cursor:pointer';
          const status = document.createElement('span');
          status.setAttribute('role', 'status');
          bar.append(button, status);
          pre.before(bar);
          action = { bar, button, status, code, text: null, pending: false };
          actions.set(pre, action);
          button.addEventListener('click', async (e) => {
            e.preventDefault(); e.stopPropagation();
            if (action.pending) return;
            action.pending = true; button.disabled = true;
            try {
              if (!code.isConnected) throw new Error('el bloque ya no está en el chat');
              const proposal = await prepareChatProposal(code.textContent);
              status.textContent = `Propuesta: ${proposal.snapshot.path}. Revisa el diff; aún no guardada.`;
              uiLog(`Parche desde chat: ${proposal.snapshot.path}. Archivo intacto; aprobación y checkpoint requeridos.`, 'info');
              if (!(await openCodeEditor(proposal.snapshot.path, proposal))) {
                throw new Error('no se pudo abrir el editor; consulta el error en el panel. Archivo intacto.');
              }
            } catch (error) {
              status.textContent = `No se preparó: ${error.message}`;
              uiLog(`Parche desde chat: ${error.message}`, 'err');
            } finally {
              action.pending = false; action.text = null; scan();
            }
          });
        }
        if (action.pending || action.text === text) continue;
        const changed = action.text !== null;
        action.text = text;
        try {
          parseChatProposal(text);
          action.button.disabled = false;
          action.button.title = 'Abrir diff local; al aprobar se crea checkpoint. No ejecuta código ni envía mensajes.';
          if (changed || !action.status.textContent) action.status.textContent = 'Revisión local con hash y checkpoint.';
        } catch (e) {
          action.button.disabled = true;
          action.button.title = e.message;
          action.status.textContent = `Propuesta incompleta o inválida: ${e.message}`;
        }
      }
    };
    let scheduled = false;
    const observer = new MutationObserver((mutations) => {
      const relevant = mutations.some((m) => {
        const target = m.target.nodeType === Node.ELEMENT_NODE ? m.target : m.target.parentElement;
        if (!target || isInsidePanel(target) || target.closest('.dv-chat-patch-actions')) return false;
        return target.closest('pre') || (m.type === 'attributes' && target.querySelector('pre code')) ||
          [...(m.addedNodes || []), ...(m.removedNodes || [])].some((n) =>
            n.nodeType === Node.ELEMENT_NODE && (n.matches('pre, code') || n.querySelector('pre code')));
      });
      if (!relevant || scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; scan(); }, 150);
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true,
      attributes: true, attributeFilter: ['class', 'data-language', 'data-role', 'data-message-role'] });
    scan();
  }

  function installInterceptors() {
    if (!document.body) throw new Error('no hay document.body; no se pueden instalar interceptores ni detector');
    let attempted = null;
    const rememberAttempt = (input) => {
      const text = normalizeChatText(adapter.getText(input)).trim();
      attempted = isRegisteredCommand(text) ? { text, expires: Date.now() + 5000 } : null;
    };
    const checkAndSubmit = (input) => {
      const txt = adapter.getText(input).trim();
      if (!isRegisteredCommand(txt)) return false;
      const body = txt.slice(settings.prefix.length).trim();

      if (busy) {
        uiLog('⏳ Hay una operación en curso... El comando permanece en la entrada.', 'err');
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
      if (!input || e.target !== input) return;
      rememberAttempt(input);
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (input && e.target === input && checkAndSubmit(input)) {
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
      if (e.isTrusted && e.target === adapter.getInput()) attempted = null;
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
                `⚠ POSIBLE FUGA: Tras intentar enviar, apareció el comando exacto (${text.slice(0, 15)}...) fuera del panel. ` +
                `Comprueba el chat; el DOM no confirma un envío al servidor.`,
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
    .git-overlay { position:fixed;inset:0;z-index:1000002;background:#0009;display:none;align-items:center;justify-content:center;padding:16px;box-sizing:border-box; }
    .git-modal { width:min(860px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:#18181b;color:#f4f4f5;border:1px solid #52525b;border-radius:10px;padding:18px;box-sizing:border-box;font:13px system-ui; }
    .git-modal pre { max-height:35vh;overflow:auto;background:#09090b;padding:10px;white-space:pre-wrap;overflow-wrap:anywhere;font:12px monospace; }
    .git-modal input { width:100%;box-sizing:border-box;background:#09090b;color:white;border:1px solid #52525b;border-radius:5px;padding:8px;margin:6px 0; }
    .git-modal ul { max-height:25vh;overflow:auto;padding-left:20px;overflow-wrap:anywhere; }
    .git-badge { font-size:11px;overflow-wrap:anywhere; }
    .git-save { max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
  `;

  function buildPanel() {
    const host = document.createElement('div');
    host.id = CFG.HOST_ID;
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.append(h('style', {}, PANEL_CSS));

    const logEl = h('div', { id: 'log' });
    const filesEl = h('ul', { id: 'files' });
    const localFileInput = h('input', {
      type: 'file', multiple: true, hidden: true,
      'aria-label': 'Seleccionar archivos para importar al disco virtual',
      onchange: async () => {
        const files = [...localFileInput.files];
        localFileInput.value = '';
        if (files.length) await importLocalFiles(files);
      }
    });
    const btnImport = h('button', { class: 'btn btn-secondary', title: 'Elegir archivos de la PC y copiarlos al disco local; no se comparten', onclick: () => {
      if (busy) { uiLog('⏳ Hay una operación en curso; espera antes de importar.', 'err'); return; }
      localFileInput.click();
    } }, 'Explorar / Importar archivos…');
    const cmdInput = h('textarea', {
      class: 'input-cmd',
      'aria-label': 'Comando local',
      placeholder: 'Comandos locales... (Enter ejecuta, Shift+Enter nueva línea)\nEj: !git status · !ls · !write f.txt "hola"'
    });
    const stateEl = h('span', { class: 'badge-local', role: 'status', 'aria-live': 'polite' }, 'Listo · local');
    let gitState = null, gitReview = null, gitLoading = false, refreshGeneration = 0;
    const gitBadge = h('span', { class: 'git-badge', role: 'status', 'aria-live': 'polite' }, 'Git: consultando...');
    const gitNotice = h('p', { role: 'status', 'aria-live': 'polite' });
    const gitPaths = h('ul', { 'aria-label': 'Archivos incluidos en el commit' });
    const gitDiffText = h('pre', { 'aria-label': 'Estado y diferencias Git', style: 'display:none' });
    const gitMessage = h('input', { id: 'dv-git-message', type: 'text', 'aria-label': 'Mensaje del commit' });
    const closeGit = () => {
      if (busy || gitLoading) return;
      gitOverlay.style.display = 'none'; panel.inert = false; gitReview = null; btnGitSave.focus();
    };
    const loadGitReview = async () => {
      if (busy || editorOpen || gitLoading) {
        uiLog('Cierra el editor o espera antes de revisar Git.', 'err'); return;
      }
      gitLoading = true; gitReview = null; updateState();
      gitOverlay.style.display = 'flex';
      panel.inert = true;
      gitNotice.textContent = 'Verificando archivos y staging...';
      gitPaths.replaceChildren(); gitDiffText.style.display = 'none';
      setBusy(true);
      try {
        const review = await getGitStatus({ capture: true });
        if (!review.initialized) throw new Error('Git no está inicializado; cierra y pulsa Inicializar Git local');
        gitReview = review;
        for (const change of review.changes) gitPaths.append(h('li', {}, `${change.path} — ${change.description}`));
        gitNotice.textContent = `Rama: ${review.branch}. ${review.changes.length} archivo(s). ` +
          'Se guardan las versiones actuales y los borrados de esta lista. El staging anterior se reemplaza por esos archivos actuales. ' +
          'Los archivos ignorados sin seguimiento y metadatos internos se excluyen. No sube nada a un servidor.';
        if (!gitMessage.value.trim()) gitMessage.value = review.changes.length === 1 ?
          `${review.changes[0].path}: cambios` : `Guardar ${review.changes.length} archivos`;
      } catch (e) {
        gitNotice.textContent = `No se pudo preparar: ${e.message}`;
        uiLog(`Git: ${e.message}`, 'err');
      } finally {
        gitLoading = false; setBusy(false); updateState();
        if (gitReview) gitMessage.focus(); else btnGitClose.focus();
      }
    };
    const btnGitSave = h('button', { class: 'btn git-save', disabled: true,
      title: 'Revisar todos los cambios y confirmar un commit Git local; no sube archivos ni elimina comandos',
      onclick: async () => {
        if (busy || editorOpen || gitLoading) { uiLog('Espera o cierra el editor antes de versionar.', 'err'); return; }
        if (gitState && !gitState.initialized) {
          setBusy(true);
          try {
            const result = await execute('git init');
            if (!result.ok) throw new Error(result.text);
            uiLog(result.text, 'info');
          } catch (e) { uiLog(`Git: ${e.message}`, 'err'); return; }
          finally { setBusy(false); await refresh(); }
        }
        gitMessage.value = '';
        await loadGitReview();
      }
    }, 'Guardar cambios en Git');
    const btnGitDiff = h('button', { class: 'btn btn-secondary', disabled: true, onclick: async () => {
      await loadGitReview();
      if (gitReview) await showGitDiff();
    } }, 'Ver cambios');
    const confirmGit = h('button', { class: 'btn', disabled: true, onclick: async () => {
      try {
        const oid = await saveGitChanges(gitReview, gitMessage.value);
        gitNotice.textContent = `Commit local verificado: ${oid.slice(0, 7)}.`;
        gitReview = null; gitOverlay.style.display = 'none'; panel.inert = false; btnGitSave.focus();
      } catch (e) {
        gitNotice.textContent = `No se completó el guardado: ${e.message}`;
        uiLog(`Git: ${e.message}`, 'err');
        gitReview = null;
      } finally { updateState(); }
    } }, 'Confirmar commit local');
    gitMessage.addEventListener('input', () => updateState());
    const btnGitRefresh = h('button', { class: 'btn btn-secondary', onclick: loadGitReview }, 'Actualizar lista');
    const btnGitReviewDiff = h('button', { class: 'btn btn-secondary', onclick: () => showGitDiff() }, 'Ver diferencias');
    const btnGitClose = h('button', { class: 'btn btn-secondary', onclick: closeGit }, 'Cancelar');
    async function showGitDiff() {
      if (busy || gitLoading || !gitReview) return;
      gitLoading = true; setBusy(true);
      try {
        const { git, fs } = await getGit();
        gitDiffText.textContent = 'Archivos nuevos sin seguimiento: consulta la lista (no aparecen en git diff).\n\n' +
          'WORKING TREE vs STAGING:\n' + await gitDiff(git, fs, []) +
          '\n\nSTAGING vs HEAD:\n' + await gitDiff(git, fs, ['--staged']);
        gitDiffText.style.display = 'block';
      } catch (e) { gitNotice.textContent = `No se pudo mostrar el diff: ${e.message}`; uiLog(`Git diff: ${e.message}`, 'err'); }
      finally { gitLoading = false; setBusy(false); }
    }
    const gitOverlay = h('div', { class: 'git-overlay' },
      h('section', { class: 'git-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Guardar cambios en Git local' },
        h('h2', {}, 'Guardar cambios en Git local'),
        gitNotice, gitPaths, gitDiffText,
        h('label', { for: 'dv-git-message' }, 'Mensaje del commit'), gitMessage,
        h('div', { class: 'row' }, btnGitRefresh, btnGitReviewDiff, confirmGit, btnGitClose)));
    gitOverlay.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); closeGit(); }
      if (e.key === 'Tab') {
        const controls = [gitMessage, btnGitRefresh, btnGitReviewDiff, confirmGit, btnGitClose].filter(el => !el.disabled);
        const first = controls[0], last = controls.at(-1);
        if (e.shiftKey && e.target === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && e.target === last) { e.preventDefault(); first.focus(); }
      }
    });
    for (const type of ['keyup', 'keypress']) gitOverlay.addEventListener(type, (e) => e.stopPropagation());
    const toggleEl = h('button', { class: 'btn btn-secondary', 'aria-label': 'Contraer panel', 'aria-expanded': 'true' }, 'Contraer');
    const expandEl = h('button', { class: 'btn btn-secondary', 'aria-label': 'Ampliar panel', 'aria-pressed': 'false' }, 'Ampliar');
    const headerEl = h('div', { id: 'header' },
      h('div', {},
        h('span', {}, `💾 DV v${CFG.VERSION} `),
        h('span', { class: 'badge-local' }, 'Panel Soberano')
      ),
      h('div', { class: 'row' }, stateEl, expandEl, toggleEl),
      h('div', { class: 'row', style: 'width:100%;cursor:default' }, gitBadge, btnGitSave, btnGitDiff)
    );

    let histIdx = -1;
    const submitPanel = (forceShare = false) => {
      const val = cmdInput.value.trim();
      if (!val) return;
      if (busy) {
        uiLog('⏳ Hay una operación en curso... El comando permanece en la entrada.', 'err');
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

    const btnExec = h('button', { class: 'btn', title: 'Ejecutar el comando en el navegador sin enviarlo a la IA', onclick: () => submitPanel() }, 'Ejecutar');

    const btnShare = h('button', { class: 'btn btn-share', title: 'Ejecutar y enviar directamente el resumen a DeepSeek, sin vista previa; no reemplaza borradores del chat', onclick: () => submitPanel(true) }, 'Ejecutar + Compartir');

    // DIÁLOGO INTEGRADO PARA COMPARTIR ARCHIVO
    const fileSelect = h('select', { 'aria-label': 'Archivo a compartir' });
    const shareNotice = h('div', { style: 'font-size:11px; margin:6px 0;' },
      'Máximo 64 KB por archivo; solo texto UTF-8. Los archivos mayores se muestran deshabilitados.');
    const confirmFileShare = h('button', { class: 'btn btn-share', title: 'Enviar directamente el archivo seleccionado a DeepSeek, sin confirmación adicional; no reemplaza borradores del chat', onclick: async () => {
      const path = fileSelect.value;
      if (!path || fileSelect.selectedOptions[0]?.disabled) {
        uiLog('Selecciona un archivo de hasta 64 KB; para uno mayor comparte un resumen con head.', 'err');
        return;
      }
      fileDialog.style.display = 'none';
      await shareFile(path);
    } }, 'Enviar archivo a DeepSeek');
    const fileDialog = h('div', { class: 'file-dialog' },
      h('div', { style: 'font-size:11px; margin-bottom:4px;' }, 'Selecciona archivo a compartir:'),
      fileSelect, shareNotice,
      h('div', { style: 'display:flex; justify-content:flex-end; gap:6px;' },
        h('button', { class: 'btn btn-secondary', onclick: () => { fileDialog.style.display = 'none'; } }, 'Cancelar'),
        confirmFileShare
      )
    );

    function populateShareFiles(files) {
        const previous = fileSelect.value;
        fileSelect.replaceChildren();
        if (!files.length) {
          fileDialog.style.display = 'none';
          uiLog('No hay archivos de usuario para compartir.', 'err');
          return;
        }
        for (const f of files) {
          const oversized = f.size > CFG.MAX_SHARE_FILE_BYTES;
          fileSelect.append(h('option', { value: f.path, disabled: oversized },
            `${f.path} (${fmtBytes(f.size)}, ${f.size} B)${oversized ? ' — supera 64 KB; comparte un resumen' : ''}`));
        }
        const available = files.find((f) => f.path === previous && f.size <= CFG.MAX_SHARE_FILE_BYTES) ||
          files.find((f) => f.size <= CFG.MAX_SHARE_FILE_BYTES);
        fileSelect.value = available?.path || '';
        confirmFileShare.disabled = !available;
        shareNotice.textContent = available
          ? 'Enviar archivo a DeepSeek comparte directamente el texto completo, sin confirmación adicional. Máximo 64 KB; solo UTF-8. Los mayores aparecen deshabilitados. Para un resumen: head -n 30 "archivo" --share.'
          : 'Todos los archivos superan 64 KB. No se ocultan: comparte un resumen con head -n 30 "archivo" --share.';
        fileDialog.style.display = 'block';
    }

    const btnOpenShareDialog = h('button', { class: 'btn btn-secondary', onclick: async () => {
      try {
        populateShareFiles((await listFiles()).filter((f) => !isInternalPath(f.path)));
      } catch (e) {
        uiLog(`❌ No se pudieron listar archivos: ${e.message}`, 'err');
      }
    } }, 'Compartir archivo...');

    const helpText = h('pre', { style: 'white-space:pre-wrap; overflow-wrap:anywhere; max-height:260px; overflow:auto; font:11px monospace;' });
    const helpDialog = h('div', {
      class: 'file-dialog', role: 'region', 'aria-label': 'Ayuda de comandos'
    },
      h('div', {}, 'Comandos disponibles (ejecución local por defecto)'),
      helpText,
      h('button', { class: 'btn btn-secondary', onclick: () => { helpDialog.style.display = 'none'; } }, 'Cerrar ayuda')
    );
    const btnHelp = h('button', { class: 'btn btn-secondary', onclick: async () => {
      try {
        helpText.textContent = await REG.get('help').run();
        helpDialog.style.display = 'block';
        helpDialog.scrollIntoView({ block: 'nearest' });
      } catch (e) { uiLog(`❌ No se pudo mostrar ayuda: ${e.message}`, 'err'); }
    } }, 'Ayuda');

    const prepareExample = (command) => {
      if (cmdInput.value && !confirm('¿Reemplazar el comando que estás preparando?')) return;
      cmdInput.value = command;
      histIdx = -1;
      cmdInput.focus();
    };
    const welcome = h('section', {
      class: 'file-dialog', role: 'region', 'aria-label': 'Primeros pasos'
    },
      h('strong', {}, 'Bienvenido a loopwork'),
      h('p', {}, 'Importa un archivo o prepara un ejemplo. Nada se ejecuta ni se comparte por abrir esta guía.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-secondary', title: 'Preparar !ls para listar archivos; luego pulsa Ejecutar', onclick: () => prepareExample('!ls') }, 'Ver archivos: !ls'),
        h('button', { class: 'btn btn-secondary', title: 'Preparar consulta del estado Git; requiere git init previo', onclick: () => prepareExample('!git status') }, 'Estado: !git status'),
        h('button', { class: 'btn btn-secondary', title: 'Preparar el comando de ayuda, sin ejecutarlo', onclick: () => prepareExample('!help') }, 'Comandos: !help')),
      h('p', {}, 'Editar → revisar diff → aprobar. Descarga copias importantes: borrar datos del sitio también elimina el disco y Git.'),
      h('button', { class: 'btn', onclick: () => {
        welcome.style.display = 'none';
        try { localStorage.setItem(CFG.WELCOME_KEY, 'seen'); }
        catch (e) { uiLog(`No se pudo guardar la preferencia de bienvenida: ${e.message}`, 'err'); }
      } }, 'Entendido')
    );
    const showWelcome = () => {
      welcome.style.display = 'block';
      welcome.scrollIntoView({ block: 'nearest' });
    };
    const btnWelcome = h('button', { class: 'btn btn-secondary', onclick: showWelcome }, 'Primeros pasos');
    helpDialog.append(h('button', { class: 'btn btn-secondary', onclick: showWelcome }, 'Ver introducción'));

    const bodyEl = h('div', { id: 'body' },
      h('div', { style: 'display:flex; justify-content:space-between; margin-bottom:4px;' },
        h('span', { style: 'color:#a1a1aa; font-size:11px;' }, 'Explorador OPFS'),
        h('button', { class: 'btn btn-secondary', style: 'padding:2px 6px; font-size:10px;', onclick: () => deleteUserFiles() }, 'Eliminar todos'),
        h('button', { class: 'btn btn-secondary', style: 'padding:2px 6px; font-size:10px;', onclick: () => logEl.replaceChildren() }, 'Limpiar log')
      ),
      h('div', { class: 'row' }, btnImport, btnHelp, btnWelcome, localFileInput),
      welcome,
      helpDialog,
      filesEl,
      logEl,
      cmdInput,
      h('div', { class: 'row' }, btnExec, btnShare, btnOpenShareDialog),
      fileDialog
    );

    const panel = h('div', { id: 'panel' }, headerEl, bodyEl);

    let collapsed = false;
    let expanded = false;
    const showBody = () => {
      bodyEl.style.display = collapsed ? 'none' : 'block';
      toggleEl.textContent = collapsed ? 'Abrir' : 'Contraer';
      toggleEl.setAttribute('aria-label', collapsed ? 'Abrir panel' : 'Contraer panel');
      toggleEl.setAttribute('aria-expanded', String(!collapsed));
      toggleEl.title = collapsed ? 'Mostrar el contenido del panel' : 'Ocultar el contenido sin borrar borradores';
    };
    toggleEl.addEventListener('click', () => {
      collapsed = !collapsed;
      showBody();
    });
    expandEl.addEventListener('click', () => {
      expanded = !expanded;
      panel.classList.toggle('expanded', expanded);
      expandEl.textContent = expanded ? 'Reducir' : 'Ampliar';
      expandEl.setAttribute('aria-label', expanded ? 'Reducir panel' : 'Ampliar panel');
      expandEl.setAttribute('aria-pressed', String(expanded));
      expandEl.title = expanded ? 'Volver al tamaño y posición anteriores' : 'Ampliar el panel dentro de la ventana';
      if (expanded) { collapsed = false; showBody(); }
    });

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
        if (!files.length) filesEl.append(h('li', { style: 'color:#a1a1aa' }, 'Tu disco está vacío. Usa Explorar / Importar archivos para empezar.'));
        for (const f of files.slice(0, 50)) {
          filesEl.append(h('li', {},
            h('span', { title: f.path, style: 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap;' }, f.path),
            h('span', { style: 'color:#a1a1aa' }, fmtBytes(f.size)),
            h('button', {
              class: 'btn btn-secondary', 'aria-label': `Editar ${f.path}`, title: 'Editar localmente y revisar el diff antes de guardar',
              style: 'padding:2px 6px; font-size:10px;',
              onclick: () => openCodeEditor(f.path)
            }, 'Editar'),
            h('button', {
              class: 'btn btn-secondary', 'aria-label': `Ejecutar ${f.path}`, title: 'HTML en pestaña con actualización al guardar; JS en consola aislada. Requiere confirmación',
              style: 'padding:2px 6px; font-size:10px; margin-left:6px;',
              onclick: () => runFromExplorer(f.path)
            }, 'Ejecutar'),
            h('button', {
              class: 'btn btn-secondary', 'aria-label': `Descargar ${f.path}`, title: 'Guardar los bytes originales en la PC, sin enviarlos al chat',
              style: 'padding:2px 6px; font-size:10px; margin-left:6px;',
              onclick: () => downloadUserFile(f.path)
            }, 'Descargar'),
            h('button', {
              class: 'btn btn-secondary',
              style: 'padding:2px 6px; font-size:10px; margin-left:6px;',
              'aria-label': `Eliminar ${f.path}`, title: 'Borrar este archivo tras confirmar; sin deshacer automático',
              onclick: () => deleteUserFiles(f.path)
            }, 'Eliminar')
          ));
        }
        if (files.length > 50) filesEl.append(h('li', {}, `Mostrando 50 de ${files.length}; Eliminar todos incluye la lista completa.`));
      } catch (e) { panelLog(`❌ ${e.message}`, 'err'); }
      try {
        const state = await getGitStatus();
        if (generation !== refreshGeneration) return;
        gitState = state;
        gitBadge.textContent = !state.initialized ? 'Git local: sin inicializar' :
          `${state.branch || 'HEAD separado'} · ${state.changes.length ? `${state.changes.length} cambios pendientes` : 'Working tree limpio'}`;
        gitBadge.style.color = state.changes.length ? '#facc15' : '#6ee7b7';
        btnGitSave.textContent = !state.initialized ? 'Inicializar Git local' :
          state.changes.length === 0 ? 'Todo guardado en Git' :
          state.changes.length === 1 ? `Guardar ${state.changes[0].path} en Git` : `Guardar ${state.changes.length} cambios en Git`;
        updateState();
      } catch (e) {
        if (generation !== refreshGeneration) return;
        gitState = null; gitBadge.textContent = 'Git: error de consulta'; gitBadge.style.color = '#f87171';
        btnGitSave.textContent = 'Revisar Git';
        panelLog(`Git: ${e.message}`, 'err'); updateState();
      }
    }

    const updateState = () => {
      stateEl.textContent = busy ? 'Operación en curso' : editorOpen ? 'Editor abierto' : 'Listo · local';
      panel.setAttribute('aria-busy', String(busy));
      for (const button of [btnExec, btnShare, btnImport, btnOpenShareDialog]) button.disabled = busy;
      btnGitSave.disabled = busy || editorOpen || gitLoading || gitState?.initialized && !gitState.changes.length;
      btnGitDiff.disabled = busy || editorOpen || gitLoading || !gitState?.initialized;
      confirmGit.disabled = busy || editorOpen || gitLoading || !gitReview?.changes.length || !gitMessage.value.trim();
      btnGitRefresh.disabled = busy || editorOpen || gitLoading;
      btnGitReviewDiff.disabled = busy || editorOpen || gitLoading || !gitReview;
      btnGitClose.disabled = busy || gitLoading;
      gitMessage.disabled = busy || gitLoading;
    };
    updateState();
    try { if (localStorage.getItem(CFG.WELCOME_KEY) !== 'seen') welcome.style.display = 'block'; }
    catch (e) {
      welcome.style.display = 'block';
      panelLog(`No se pudo leer la preferencia de bienvenida: ${e.message}`, 'err');
    }
    refresh();
    panelLog(`Panel Soberano v${CFG.VERSION} activo. 100% local por defecto.`, 'info');
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
          entry.channel.postMessage({ type: 'error', text: 'DeepSeek se cerró o recargó; vuelve a abrir la vista previa desde Ejecutar.' });
          closeHTMLPreview(entry);
        }
      });
      loadSettings();
      if (!(await initOPFS())) throw new Error('OPFS no está disponible; no se puede montar el panel');
      const body = await waitFor(() => document.body, 20000, 200);
      if (!body) throw new Error('no se encontró document.body; no se puede montar el panel');
      ui = buildPanel();
      installInterceptors();
      installChatCodeActions();
    } catch (e) {
      console.error('[DV] Error de arranque:', e);
    }
  })();
})();