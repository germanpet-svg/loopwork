// ============================================================
  // EDITOR PROFESIONAL INTEGRADO (CÓDIGO COMPLETO MEJORADO)
  // Sustituir la función openCodeEditor por la siguiente versión:
  // ============================================================

  let editorOpen = false;
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

      const host = h('div', { id: 'dv-code-editor' });
      const shadow = host.attachShadow({ mode: 'closed' });
      let saving = false, approvedCandidate = null;

      // Elementos del área de código
      const gutter = h('pre', { class: 'gutter', 'aria-hidden': 'true' });
      const code = h('textarea', { class: 'code', spellcheck: 'false', wrap: 'off', 'aria-label': t`Código de ${path}` });
      const minimapContent = h('pre', { class: 'minimap-content', 'aria-hidden': 'true' });
      const minimapSlider = h('div', { class: 'minimap-slider' });
      const minimap = h('div', { class: 'minimap' }, minimapContent, minimapSlider);
      const diff = h('pre', { class: 'diff', 'aria-label': t('Diferencias propuestas'), style: 'display:none' });

      // Estado inicial
      const normalized = snapshot.text.replace(/\r\n?/g, '\n');
      const baseline = normalized;
      code.value = (proposal ? proposal.candidate : snapshot.text).replace(/\r\n?/g, '\n');
      const initialDraft = code.value;

      const candidate = () => proposal && code.value === initialDraft ? proposal.candidate :
        code.value === baseline ? snapshot.text :
        snapshot.text.includes('\r\n') && !snapshot.text.replace(/\r\n/g, '').includes('\n')
          ? code.value.replace(/\n/g, '\r\n') : code.value;

      // Barra de estado inferior
      const statusPos = h('span', {}, 'Ln 1, Col 1');
      const statusLines = h('span', {}, 'Líneas: 1');
      const statusBytes = h('span', {}, '0 B');
      const statusMsg = h('span', { class: 'status-msg', role: 'status' });
      const report = (text, error = false) => {
        statusMsg.textContent = text;
        statusMsg.style.color = error ? '#f87171' : '#93c5fd';
      };

      const updateCursorPos = () => {
        const pos = code.selectionStart;
        const textBefore = code.value.slice(0, pos);
        const line = textBefore.split('\n').length;
        const lastNewLine = textBefore.lastIndexOf('\n');
        const col = pos - (lastNewLine === -1 ? 0 : lastNewLine + 1) + 1;
        const selLen = Math.abs(code.selectionEnd - code.selectionStart);
        statusPos.textContent = `Ln ${line}, Col ${col}${selLen > 0 ? ` (${selLen} sel)` : ''}`;
      };

      const sync = () => {
        const linesArr = code.value.split('\n');
        gutter.textContent = Array.from({ length: linesArr.length }, (_, i) => i + 1).join('\n');
        minimapContent.textContent = code.value;
        statusLines.textContent = `Líneas: ${linesArr.length}`;
        statusBytes.textContent = fmtBytes(new TextEncoder().encode(code.value).length);
        approvedCandidate = null;
        applyBtn.disabled = snapshot.isNew ? !code.value : true;
        diff.style.display = 'none';
        updateCursorPos();
        updateMinimapSlider();
      };

      const updateMinimapSlider = () => {
        const codeScrollRatio = code.scrollTop / (code.scrollHeight - code.clientHeight || 1);
        const maxSliderTop = minimap.clientHeight - minimapSlider.clientHeight;
        minimapSlider.style.top = Math.max(0, Math.min(maxSliderTop, codeScrollRatio * maxSliderTop)) + 'px';
        const sliderHeight = Math.max(20, (code.clientHeight / (code.scrollHeight || 1)) * minimap.clientHeight);
        minimapSlider.style.height = `${sliderHeight}px`;
      };

      code.addEventListener('input', sync);
      code.addEventListener('click', updateCursorPos);
      code.addEventListener('keyup', updateCursorPos);
      code.addEventListener('scroll', () => {
        gutter.scrollTop = code.scrollTop;
        minimapContent.style.transform = `translateY(-${code.scrollTop * 0.12}px)`;
        updateMinimapSlider();
      });

      // Arrastre e interacción en el minimapa
      let isDraggingMinimap = false;
      minimap.addEventListener('pointerdown', (e) => {
        isDraggingMinimap = true;
        minimap.setPointerCapture(e.pointerId);
        const rect = minimap.getBoundingClientRect();
        const clickRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        code.scrollTop = clickRatio * (code.scrollHeight - code.clientHeight);
      });
      minimap.addEventListener('pointermove', (e) => {
        if (!isDraggingMinimap) return;
        const rect = minimap.getBoundingClientRect();
        const clickRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        code.scrollTop = clickRatio * (code.scrollHeight - code.clientHeight);
      });
      const endMinimapDrag = () => { isDraggingMinimap = false; };
      minimap.addEventListener('pointerup', endMinimapDrag);
      minimap.addEventListener('pointercancel', endMinimapDrag);

      // Widget Flotante de Buscar y Reemplazar
      const findInput = h('input', { type: 'text', class: 'fw-input', placeholder: 'Buscar...' });
      const replaceInput = h('input', { type: 'text', class: 'fw-input', placeholder: 'Reemplazar con...' });
      const matchCountBadge = h('span', { class: 'fw-badge' }, '0/0');
      const toggleCaseBtn = h('button', { class: 'fw-toggle', title: 'Coincidir mayúsculas y minúsculas (Alt+C)' }, 'Aa');
      const toggleRegexBtn = h('button', { class: 'fw-toggle', title: 'Usar expresión regular (Alt+R)' }, '.*');
      const replaceRow = h('div', { class: 'fw-row', style: 'display:none;' });

      let caseSensitive = false, isRegex = false;
      toggleCaseBtn.addEventListener('click', () => {
        caseSensitive = !caseSensitive;
        toggleCaseBtn.classList.toggle('active', caseSensitive);
        refreshMatches();
      });
      toggleRegexBtn.addEventListener('click', () => {
        isRegex = !isRegex;
        toggleRegexBtn.classList.toggle('active', isRegex);
        refreshMatches();
      });

      const getMatches = () => {
        const query = findInput.value;
        if (!query) return [];
        const text = code.value;
        const matches = [];
        try {
          if (isRegex) {
            const re = new RegExp(query, (caseSensitive ? 'g' : 'gi'));
            let m;
            while ((m = re.exec(text)) !== null) {
              matches.push({ start: m.index, end: m.index + m[0].length, len: m[0].length });
              if (re.lastIndex === m.index) re.lastIndex++;
            }
          } else {
            const target = caseSensitive ? text : text.toLowerCase();
            const q = caseSensitive ? query : query.toLowerCase();
            let idx = 0;
            while ((idx = target.indexOf(q, idx)) !== -1) {
              matches.push({ start: idx, end: idx + q.length, len: q.length });
              idx += q.length;
            }
          }
        } catch { /* regex error */ }
        return matches;
      };

      let activeMatchIdx = -1;
      const refreshMatches = () => {
        const matches = getMatches();
        if (!matches.length) {
          matchCountBadge.textContent = '0/0';
          activeMatchIdx = -1;
          return;
        }
        const selStart = code.selectionStart;
        activeMatchIdx = matches.findIndex(m => m.start >= selStart);
        if (activeMatchIdx === -1) activeMatchIdx = 0;
        matchCountBadge.textContent = `${activeMatchIdx + 1}/${matches.length}`;
      };

      const goToMatch = (direction = 1) => {
        const matches = getMatches();
        if (!matches.length) {
          matchCountBadge.textContent = '0/0';
          report('Sin coincidencias.', true);
          return;
        }
        if (direction === 1) {
          activeMatchIdx = (activeMatchIdx + 1) % matches.length;
        } else {
          activeMatchIdx = (activeMatchIdx - 1 + matches.length) % matches.length;
        }
        const targetMatch = matches[activeMatchIdx];
        code.focus();
        code.setSelectionRange(targetMatch.start, targetMatch.end);
        const line = code.value.slice(0, targetMatch.start).split('\n').length;
        code.scrollTop = Math.max(0, (line - 4) * 20);
        gutter.scrollTop = code.scrollTop;
        matchCountBadge.textContent = `${activeMatchIdx + 1}/${matches.length}`;
        report(t`Coincidencia en línea ${line}`);
        updateCursorPos();
      };

      findInput.addEventListener('input', refreshMatches);
      findInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          goToMatch(e.shiftKey ? -1 : 1);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          floatingWidget.style.display = 'none';
          code.focus();
        }
      });

      const applySingleReplace = () => {
        const matches = getMatches();
        if (!matches.length || activeMatchIdx === -1) return;
        const target = matches[activeMatchIdx];
        const repVal = replaceInput.value;
        code.value = code.value.slice(0, target.start) + repVal + code.value.slice(target.end);
        sync();
        findInput.focus();
        refreshMatches();
        if (getMatches().length) goToMatch(0);
      };

      const applyAllReplace = () => {
        const query = findInput.value;
        if (!query) return;
        const repVal = replaceInput.value;
        try {
          if (isRegex) {
            const re = new RegExp(query, (caseSensitive ? 'g' : 'gi'));
            code.value = code.value.replace(re, repVal);
          } else {
            const parts = code.value.split(caseSensitive ? query : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
            code.value = parts.join(repVal);
          }
          sync();
          refreshMatches();
          report('Reemplazo completado en todo el documento.');
        } catch (e) { report(e.message, true); }
      };

      replaceInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          applySingleReplace();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          floatingWidget.style.display = 'none';
          code.focus();
        }
      });

      const toggleReplaceBar = () => {
        const isOpen = replaceRow.style.display !== 'none';
        replaceRow.style.display = isOpen ? 'none' : 'flex';
        toggleRepViewBtn.textContent = isOpen ? '▶' : '▼';
        if (!isOpen) replaceInput.focus();
      };

      const toggleRepViewBtn = h('button', { class: 'fw-btn', title: 'Desplegar barra de reemplazo' }, '▶');
      toggleRepViewBtn.addEventListener('click', toggleReplaceBar);

      const floatingWidget = h('div', { class: 'floating-search', style: 'display:none;' },
        h('div', { class: 'fw-row' },
          toggleRepViewBtn,
          findInput,
          matchCountBadge,
          toggleCaseBtn,
          toggleRegexBtn,
          h('button', { class: 'fw-btn', title: 'Anterior (Shift+Enter)', onclick: () => goToMatch(-1) }, '▲'),
          h('button', { class: 'fw-btn', title: 'Siguiente (Enter)', onclick: () => goToMatch(1) }, '▼'),
          h('button', { class: 'fw-btn', title: 'Cerrar (Esc)', onclick: () => { floatingWidget.style.display = 'none'; code.focus(); } }, '✕')
        ),
        replaceRow
      );

      replaceRow.append(
        h('span', { style: 'width:18px;' }),
        replaceInput,
        h('button', { class: 'fw-btn', title: 'Reemplazar este', onclick: applySingleReplace }, '1x'),
        h('button', { class: 'fw-btn', title: 'Reemplazar todos', onclick: applyAllReplace }, 'Todos')
      );

      const openSearch = (withReplace = false) => {
        floatingWidget.style.display = 'flex';
        if (withReplace) {
          replaceRow.style.display = 'flex';
          toggleRepViewBtn.textContent = '▼';
          replaceInput.focus();
        } else {
          findInput.focus();
          findInput.select();
        }
        refreshMatches();
      };

      // Atajos de Teclado del Editor
      code.addEventListener('keydown', (e) => {
        if (code.readOnly) return;

        // Búsqueda y Reemplazo (Ctrl+F / Ctrl+H)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
          e.preventDefault();
          openSearch(false);
          return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H')) {
          e.preventDefault();
          openSearch(true);
          return;
        }

        // Ir a Línea (Ctrl+G)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) {
          e.preventDefault();
          const targetStr = prompt('Ir a la línea número:');
          const targetNum = parseInt(targetStr, 10);
          if (Number.isInteger(targetNum) && targetNum > 0) {
            const linesArr = code.value.split('\n');
            const safeLine = Math.min(targetNum, linesArr.length);
            let charIndex = 0;
            for (let i = 0; i < safeLine - 1; i++) charIndex += linesArr[i].length + 1;
            code.focus();
            code.setSelectionRange(charIndex, charIndex);
            code.scrollTop = Math.max(0, (safeLine - 4) * 20);
            updateCursorPos();
          }
          return;
        }

        // Tab y Shift+Tab (Sangría)
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = code.selectionStart, end = code.selectionEnd;
          if (e.shiftKey) {
            // Desindentar 2 espacios si existen al inicio de línea
            const textBefore = code.value.slice(0, start);
            const lineStart = textBefore.lastIndexOf('\n') + 1;
            if (code.value.slice(lineStart, lineStart + 2) === '  ') {
              code.value = code.value.slice(0, lineStart) + code.value.slice(lineStart + 2);
              code.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, end - 2));
              sync();
            }
          } else {
            // Insertar 2 espacios
            if (!document.execCommand?.('insertText', false, '  ')) {
              code.value = code.value.slice(0, start) + '  ' + code.value.slice(end);
              code.setSelectionRange(start + 2, start + 2);
              sync();
            }
          }
          return;
        }

        // Mover Línea Arriba / Abajo (Alt+Up / Alt+Down)
        if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          const linesArr = code.value.split('\n');
          const pos = code.selectionStart;
          const textBefore = code.value.slice(0, pos);
          const currentLineIdx = textBefore.split('\n').length - 1;

          if (e.key === 'ArrowUp' && currentLineIdx > 0) {
            const prevLine = linesArr[currentLineIdx - 1];
            linesArr[currentLineIdx - 1] = linesArr[currentLineIdx];
            linesArr[currentLineIdx] = prevLine;
            code.value = linesArr.join('\n');
            const newPos = pos - (prevLine.length + 1);
            code.setSelectionRange(newPos, newPos);
            sync();
          } else if (e.key === 'ArrowDown' && currentLineIdx < linesArr.length - 1) {
            const nextLine = linesArr[currentLineIdx + 1];
            linesArr[currentLineIdx + 1] = linesArr[currentLineIdx];
            linesArr[currentLineIdx] = nextLine;
            code.value = linesArr.join('\n');
            const newPos = pos + (nextLine.length + 1);
            code.setSelectionRange(newPos, newPos);
            sync();
          }
          return;
        }

        // Comentar / Descomentar línea (Ctrl+/)
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
          e.preventDefault();
          const isHtml = /\.html?$/i.test(path);
          const isPy = /\.(py|sh|bash)$/i.test(path);
          const start = code.selectionStart;
          const textBefore = code.value.slice(0, start);
          const lineStart = textBefore.lastIndexOf('\n') + 1;
          let lineEnd = code.value.indexOf('\n', start);
          if (lineEnd === -1) lineEnd = code.value.length;
          const lineText = code.value.slice(lineStart, lineEnd);

          let newLine = '';
          if (isHtml) {
            if (lineText.trim().startsWith('<!--') && lineText.trim().endsWith('-->')) {
              newLine = lineText.replace('<!--', '').replace('-->', '');
            } else {
              newLine = `<!-- ${lineText} -->`;
            }
          } else if (isPy) {
            newLine = lineText.trim().startsWith('#') ? lineText.replace(/^(\s*)#\s?/, '$1') : lineText.replace(/^(\s*)/, '$1# ');
          } else {
            newLine = lineText.trim().startsWith('//') ? lineText.replace(/^(\s*)\/\/\s?/, '$1') : lineText.replace(/^(\s*)/, '$1// ');
          }
          code.value = code.value.slice(0, lineStart) + newLine + code.value.slice(lineEnd);
          code.setSelectionRange(lineStart + newLine.length, lineStart + newLine.length);
          sync();
          return;
        }

        // Auto-cierre de parejas: ( ), [ ], { }, " ", ' ', ` `
        const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
        if (pairs[e.key] && code.selectionStart === code.selectionEnd) {
          const char = e.key;
          const closeChar = pairs[char];
          const pos = code.selectionStart;
          code.value = code.value.slice(0, pos) + char + closeChar + code.value.slice(pos);
          code.setSelectionRange(pos + 1, pos + 1);
          e.preventDefault();
          sync();
          return;
        }

        // Auto-indentación inteligente en Enter
        if (e.key === 'Enter') {
          const pos = code.selectionStart;
          const textBefore = code.value.slice(0, pos);
          const currentLine = textBefore.slice(textBefore.lastIndexOf('\n') + 1);
          const matchIndent = currentLine.match(/^\s*/);
          let indent = matchIndent ? matchIndent[0] : '';
          const trimmed = currentLine.trim();
          if (trimmed.endsWith('{') || trimmed.endsWith('[')) {
            indent += '  ';
          }
          if (indent.length > 0) {
            e.preventDefault();
            const insertText = '\n' + indent;
            code.value = code.value.slice(0, pos) + insertText + code.value.slice(code.selectionEnd);
            code.setSelectionRange(pos + insertText.length, pos + insertText.length);
            sync();
          }
        }
      });

      // Botones de acción del Toolbar
      const applyBtn = h('button', { class: 'top-btn primary', disabled: true }, snapshot.isNew ? t('Crear archivo') : t('Aplicar cambios'));
      const previewBtn = h('button', { class: 'top-btn', onclick: async () => {
        if (saving) return;
        const proposed = candidate();
        try {
          validateEditorCandidate(snapshot, proposed);
          const engine = await getDiff();
          const patch = engine.createTwoFilesPatch(`a/${path}`, `b/${path}`, snapshot.text, proposed, '', '', { context: 3, timeout: 2000 });
          if (patch === undefined) throw new Error(t('diff excedió el tiempo límite'));
          diff.textContent = patch;
          diff.style.display = 'block';
          approvedCandidate = proposed;
          applyBtn.disabled = candidate() !== proposed;
          report(t('Revisa el diff completo; Aplicar comprueba la versión original.'));
        } catch (e) { approvedCandidate = null; applyBtn.disabled = true; report(e.message, true); }
      } }, t('Revisar diff'));

      const copyAllBtn = h('button', { class: 'top-btn', title: 'Copiar todo al portapapeles', onclick: async () => {
        try {
          await navigator.clipboard.writeText(code.value);
          report('¡Código copiado al portapapeles!');
        } catch { report('No se pudo acceder al portapapeles.', true); }
      } }, 'Copiar');

      const pasteBtn = h('button', { class: 'top-btn', title: 'Pegar desde el portapapeles', onclick: async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (!text) return;
          const start = code.selectionStart, end = code.selectionEnd;
          code.value = code.value.slice(0, start) + text + code.value.slice(end);
          code.setSelectionRange(start + text.length, start + text.length);
          sync();
          report('Texto pegado con éxito.');
        } catch { report('Permiso de portapapeles denegado.', true); }
      } }, 'Pegar');

      const downloadBtn = h('button', { class: 'top-btn', title: 'Descargar borrador a la PC', onclick: () => {
        const blob = new Blob([code.value], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = path.split('/').pop() || 'codigo.txt';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        report('Descarga del borrador iniciada.');
      } }, 'Descargar');

      release = () => { host.remove(); editorOpen = false; ui?.updateState?.(); };
      const closeBtn = h('button', { class: 'top-btn', onclick: () => {
        if (saving) return;
        if (candidate() !== snapshot.text && !confirm(t('¿Descartar el borrador sin guardar?'))) return;
        release();
      } }, t('Cerrar'));

      applyBtn.addEventListener('click', async () => {
        const created = snapshot.isNew;
        if (created) {
          if (saving || busy) { report(t('Revisa de nuevo el diff o espera a que termine la operación.'), true); return; }
          approvedCandidate = candidate();
        } else {
          if (saving || busy || approvedCandidate === null || candidate() !== approvedCandidate) {
            report(t('Revisa de nuevo el diff o espera a que termine la operación.'), true); return;
          }
          if (!confirm(t`¿Aplicar el diff revisado a "${path}"? ${snapshot.checkpointBeforeSave ?
            t('Se creará y verificará un checkpoint previo; si falla, no se guarda.') :
            t('No crea backup automático.')} No crea commit.`)) return;
        }
        saving = true; setBusy(true); code.readOnly = true; applyBtn.disabled = true;
        try {
          snapshot = await saveEditorCandidate(snapshot, approvedCandidate);
          uiLog(created ? t`Editor: creado y verificado ${path} (SHA256 ${snapshot.hash.slice(0, 8)}). Usa Ejecutar para verlo y Guardar en Git para versionarlo.` :
            t`Editor: guardado y verificado ${path} (SHA256 ${snapshot.hash.slice(0, 8)}). Revisa git diff.`, 'info');
          release();
        } catch (e) { report(e.message, true); }
        finally {
          saving = false; setBusy(false); code.readOnly = false;
          if (snapshot.isNew) applyBtn.disabled = !code.value;
          await ui?.refresh();
        }
      });

      // Estilos CSS Integrados para el Editor Profesional
      shadow.append(h('style', {}, `
        :host { all: initial; }
        .editor {
          position: fixed; inset: 2%; z-index: 1000001; background: #1e1e1e; color: #ddd;
          border: 1px solid #3f3f46; border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,0.8);
          display: flex; flex-direction: column; overflow: hidden; font: 12px system-ui, sans-serif;
        }
        .header-bar {
          background: #252526; padding: 6px 12px; display: flex; justify-content: space-between;
          align-items: center; border-bottom: 1px solid #333; user-select: none;
        }
        .file-title { font-weight: 600; color: #f4f4f5; display: flex; align-items: center; gap: 8px; }
        .tools-group { display: flex; gap: 6px; align-items: center; }
        .top-btn {
          background: #333; color: #f4f4f5; border: 1px solid #444; border-radius: 4px;
          padding: 4px 10px; cursor: pointer; font-size: 11px; font-weight: 500;
        }
        .top-btn:hover { background: #444; }
        .top-btn.primary { background: #0284c7; border-color: #0369a1; }
        .top-btn.primary:hover { background: #0369a1; }
        .top-btn:disabled { opacity: .4; cursor: default; }

        .editor-workspace {
          position: relative; flex: 1; display: flex; overflow: hidden; background: #1e1e1e;
        }
        .gutter {
          background: #1e1e1e; color: #858585; text-align: right; padding: 10px 8px;
          margin: 0; min-width: 45px; border-right: 1px solid #2d2d30; user-select: none;
          font: 13px/20px Consolas, 'Courier New', monospace; overflow: hidden; box-sizing: border-box;
        }
        .code {
          flex: 1; min-width: 0; background: transparent; color: #d4d4d4; border: 0;
          outline: none; resize: none; white-space: pre; font: 13px/20px Consolas, 'Courier New', monospace;
          padding: 10px 10px; margin: 0; tab-size: 2; box-sizing: border-box;
        }
        .minimap {
          width: 70px; background: #252526; border-left: 1px solid #2d2d30; position: relative;
          overflow: hidden; user-select: none; cursor: pointer;
        }
        .minimap-content {
          position: absolute; top: 0; left: 0; width: 500px; margin: 0; padding: 4px;
          font: 11px/12px monospace; color: #71717a; transform-origin: top left;
          transform: scale(0.12); pointer-events: none; white-space: pre;
        }
        .minimap-slider {
          position: absolute; left: 0; right: 0; top: 0; height: 30px;
          background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2);
          pointer-events: none;
        }

        /* Floating Search & Replace Bar */
        .floating-search {
          position: absolute; top: 10px; right: 85px; z-index: 20; background: #252526;
          border: 1px solid #454545; border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.6);
          padding: 6px; display: flex; flex-direction: column; gap: 4px;
        }
        .fw-row { display: flex; align-items: center; gap: 4px; }
        .fw-input {
          background: #3c3c3c; border: 1px solid #555; color: #fff; padding: 3px 6px;
          font: 11px system-ui; border-radius: 3px; outline: none; width: 140px;
        }
        .fw-input:focus { border-color: #0284c7; }
        .fw-badge { font-size: 10px; color: #a1a1aa; min-width: 32px; text-align: center; }
        .fw-btn {
          background: #333; color: #ccc; border: 1px solid #444; border-radius: 3px;
          padding: 2px 6px; cursor: pointer; font-size: 10px;
        }
        .fw-btn:hover { background: #444; color: #fff; }
        .fw-toggle {
          background: transparent; color: #71717a; border: 1px solid transparent; border-radius: 3px;
          padding: 2px 5px; cursor: pointer; font-size: 10px; font-weight: bold;
        }
        .fw-toggle.active { background: #094771; color: #fff; border-color: #0284c7; }

        .diff {
          margin: 0; padding: 10px; background: #111; color: #b5cea8; overflow: auto;
          max-height: 25vh; font: 12px/18px monospace; border-top: 1px solid #333; white-space: pre;
        }
        .status-bar {
          background: #007acc; color: #fff; padding: 2px 10px; display: flex;
          justify-content: space-between; align-items: center; font-size: 11px; user-select: none;
        }
        .status-group { display: flex; gap: 12px; align-items: center; }
        .status-msg { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 45vw; }
      `));

      const dialog = h('section', { class: 'editor', role: 'dialog', 'aria-label': snapshot.isNew ? t`Nuevo archivo · ${path}` : t`Editor de ${path}` },
        h('div', { class: 'header-bar' },
          h('div', { class: 'file-title' },
            h('span', {}, snapshot.isNew ? '📝 [Nuevo]' : '📄'),
            h('span', {}, path)
          ),
          h('div', { class: 'tools-group' },
            h('button', { class: 'top-btn', title: 'Buscar (Ctrl+F)', onclick: () => openSearch(false) }, '🔍 Buscar'),
            copyAllBtn, pasteBtn, downloadBtn, previewBtn, applyBtn, closeBtn
          )
        ),
        h('div', { class: 'editor-workspace' },
          gutter, code, minimap, floatingWidget
        ),
        diff,
        h('div', { class: 'status-bar' },
          h('div', { class: 'status-group' }, statusPos, statusLines, statusBytes),
          h('div', { class: 'status-group' }, statusMsg, h('span', {}, 'UTF-8'))
        )
      );

      dialog.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          (applyBtn.disabled ? previewBtn : applyBtn).click();
        } else if (e.key === 'Escape' && floatingWidget.style.display === 'none') {
          e.preventDefault();
          closeBtn.click();
        }
      });

      shadow.append(dialog);
      for (const type of ['keydown', 'keyup', 'keypress']) host.addEventListener(type, (e) => e.stopPropagation());
      document.body.append(host);
      sync();

      report(snapshot.isNew ? t`Archivo nuevo ${path} · Ctrl+S crea · Tab sangra · Ctrl+F busca · Esc cierra` :
        t`SHA256: ${snapshot.hash.slice(0, 8)} · Ctrl+S guarda · Ctrl+F busca · Alt+↑/↓ mueve líneas`);

      if (proposal) previewBtn.click();
      else code.focus?.();

      return true;
    } catch (e) {
      if (release) release(); else editorOpen = false;
      ui?.updateState?.();
      uiLog(t`❌ Editor: ${e.message}`, 'err');
      return false;
    }
  }