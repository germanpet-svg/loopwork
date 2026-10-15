'use strict';

(function (root) {
  const MAX_BYTES = 20 * 1024 * 1024;

  function resolvePath(base, reference) {
    const value = reference.trim();
    if (!value || value.startsWith('#')) return null;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) throw new Error('Recurso externo no admitido: ' + value);
    const pathname = decodeURIComponent(value.split(/[?#]/)[0]);
    if (/[\\\u0000-\u001f]/.test(pathname)) throw new Error('Ruta no valida: ' + value);
    const parts = pathname.startsWith('/') ? [] : base.split('/').slice(0, -1);
    for (const part of pathname.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (!parts.length) throw new Error('La ruta sale de la carpeta seleccionada: ' + value);
        parts.pop();
      } else parts.push(part);
    }
    return parts.join('/');
  }

  function collectFiles(files) {
    const result = new Map();
    let total = 0;
    for (const file of files) {
      const relative = file.webkitRelativePath;
      if (!relative || !relative.includes('/')) throw new Error('Selecciona una carpeta completa.');
      const path = relative.slice(relative.indexOf('/') + 1);
      if (result.has(path)) throw new Error('Ruta duplicada: ' + path);
      total += file.size;
      if (total > MAX_BYTES) throw new Error('La carpeta supera 20 MB. Selecciona un proyecto mas pequeno.');
      result.set(path, file);
    }
    return result;
  }

  async function build(files, entry, { document, DOMParser, URL, Blob }) {
    const urls = [];
    const cache = new Map();
    const resolvedStyles = new WeakSet();
    const revoke = () => { for (const url of urls) URL.revokeObjectURL(url); };
    const fileAt = path => {
      const file = files.get(path);
      if (!file) throw new Error('Falta el archivo local: ' + path);
      return file;
    };
    const read = async path => {
      const bytes = await fileAt(path).arrayBuffer();
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    };
    const asset = async (base, reference) => {
      if (reference.trim().startsWith('data:')) return reference;
      const path = resolvePath(base, reference);
      if (!path) return reference;
      if (!cache.has(path)) {
        const type = /\.png$/i.test(path) ? 'image/png' : /\.jpe?g$/i.test(path) ? 'image/jpeg' :
          /\.gif$/i.test(path) ? 'image/gif' : /\.webp$/i.test(path) ? 'image/webp' :
          /\.svg$/i.test(path) ? 'image/svg+xml' : /\.woff2$/i.test(path) ? 'font/woff2' :
          /\.woff$/i.test(path) ? 'font/woff' : 'application/octet-stream';
        const bytes = new Uint8Array(await fileAt(path).arrayBuffer());
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 8192) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
        }
        cache.set(path, 'data:' + type + ';base64,' + btoa(binary));
      }
      return cache.get(path);
    };
    const css = async (text, path) => {
      if (/@import\b/i.test(text)) throw new Error('CSS @import no admitido: ' + path + '. Usa enlaces stylesheet en el HTML.');
      const pattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi;
      let result = '', end = 0;
      for (const match of text.matchAll(pattern)) {
        result += text.slice(end, match.index) + 'url("' + await asset(path, match[1] ?? match[2] ?? match[3]) + '")';
        end = match.index + match[0].length;
      }
      return result + text.slice(end);
    };
    try {
      const doc = new DOMParser().parseFromString(await read(entry), 'text/html');
      doc.querySelectorAll('base, meta[http-equiv], iframe, frame, object, embed').forEach(el => el.remove());
      for (const script of doc.querySelectorAll('script')) {
        if (['module', 'importmap'].includes(script.type.trim().toLowerCase())) {
          throw new Error('Modulos ES/importmap no admitidos. Usa scripts clasicos o un servidor local.');
        }
        if (script.hasAttribute('src')) {
          const path = resolvePath(entry, script.getAttribute('src'));
          if (!path || !/\.js$/i.test(path)) throw new Error('El script local debe ser un archivo .js.');
          if (script.hasAttribute('async')) throw new Error('Scripts async no admitidos. Usa defer o scripts clasicos sin async.');
          const encoded = JSON.stringify(await read(path)).replace(/</g, '\\u003c');
          const install = `const node=document.createElement('script');node.textContent=${encoded};document.head.append(node);node.remove();`;
          script.textContent = script.hasAttribute('defer') ?
            `addEventListener('DOMContentLoaded',()=>{${install}},{once:true});` : `{${install}}`;
          script.removeAttribute('src');
          script.removeAttribute('defer');
          script.removeAttribute('integrity');
          script.removeAttribute('crossorigin');
        }
      }
      for (const link of doc.querySelectorAll('link')) {
        if (link.rel.toLowerCase() !== 'stylesheet') { link.remove(); continue; }
        const path = resolvePath(entry, link.getAttribute('href') || '');
        if (!path) throw new Error('Hoja de estilos sin ruta.');
        const style = doc.createElement('style');
        style.textContent = await css(await read(path), path);
        resolvedStyles.add(style);
        link.replaceWith(style);
      }
      for (const style of doc.querySelectorAll('style')) {
        // Linked sheets were already resolved against their own directories.
        if (resolvedStyles.has(style)) continue;
        style.textContent = await css(style.textContent, entry);
      }
      for (const el of doc.querySelectorAll('*')) {
        if (el.hasAttribute('style')) el.setAttribute('style', await css(el.getAttribute('style'), entry));
        if (el.hasAttribute('srcset')) throw new Error('srcset no admitido. Usa una sola imagen con src.');
        if (el.hasAttribute('src') && el.tagName !== 'SCRIPT') el.setAttribute('src', await asset(entry, el.getAttribute('src')));
        if (el.tagName === 'FORM') { el.removeAttribute('action'); el.removeAttribute('target'); }
        if (el.tagName === 'A' || el.tagName === 'AREA') {
          if (!(el.getAttribute('href') || '').startsWith('#')) el.removeAttribute('href');
          el.removeAttribute('target'); el.removeAttribute('ping');
        }
      }
      const policy = doc.createElement('meta');
      policy.httpEquiv = 'Content-Security-Policy';
      policy.content = "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src blob: data:; font-src blob: data:; media-src blob: data:; connect-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
      doc.head.prepend(policy);
      const charset = doc.createElement('meta'); charset.setAttribute('charset', 'utf-8'); doc.head.prepend(charset);
      const url = URL.createObjectURL(new Blob(['<!doctype html>\n' + doc.documentElement.outerHTML], { type: 'text/html;charset=utf-8' }));
      urls.push(url);
      return { url, revoke };
    } catch (error) { revoke(); throw error; }
  }

  const api = { resolvePath, collectFiles, build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DVProjectPreview = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
