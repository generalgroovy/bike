// The build replaces this token. Every offline pack belongs to one tested build.
const VERSION = '__SEND_IT_BUILD__';
const ROOT = new URL('./', self.location.href);
const PREFIX = 'send-it-berlin-offline-' + encodeURIComponent(ROOT.pathname) + '-';
const CACHE = PREFIX + VERSION;
const READY = new URL('__offline_ready__', ROOT).href;
let downloading = null;
let downloadFinished = Promise.resolve();
async function report(port, data) {
  // Notifications must not turn a completed cache transaction into a failure
  // when a tab closes while we are reporting the result.
  try { port.postMessage(data); } catch {}
  try {
    for (const client of await self.clients.matchAll()) client.postMessage({kind:'send-it-offline-status',...data});
  } catch {}
}

async function readyCache() {
  const names = (await caches.keys()).filter(name => name.startsWith(PREFIX));
  // Use an entire completed pack, never a mixture of partial versions.
  for (const name of [CACHE, ...names.reverse().filter(name => name !== CACHE)]) {
    if (!names.includes(name)) continue;
    const cache = await caches.open(name);
    if (await cache.match(READY)) return cache;
  }
  return null;
}
async function manifest(signal) {
  const response = await fetch(new URL(`offline-pack.json?v=${VERSION}`, ROOT), {cache:'no-store', signal});
  if (!response.ok) throw new Error('Could not read the offline download list. Try again online.');
  const pack = await response.json();
  if (pack.version !== VERSION || !Array.isArray(pack.files) || !pack.files.length) throw new Error('The website updated. Close other game tabs and reload before downloading.');
  for (const entry of pack.files) {
    const url = new URL(entry.path, ROOT);
    if (url.origin !== ROOT.origin || !url.href.startsWith(ROOT.href) || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Invalid offline file list.');
  }
  return pack;
}
async function status() {
  const cache = await readyCache();
  if (cache) {
    const saved = await (await cache.match(READY)).json();
    return {type:'status',ready:true,current:saved.version===VERSION,busy:!!downloading,bytes:saved.bytes};
  }
  const pack = await manifest(AbortSignal.timeout(15000));
  return {type:'status',ready:false,busy:!!downloading,bytes:pack.bytes};
}
self.addEventListener('install', () => { /* An active run keeps its current worker until every game tab closes. */ });
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  event.respondWith((async () => {
    const cache = await readyCache();
    if (cache) {
      // Share links retain their query in the address bar; the static document is identical.
      const key = new URL(url); key.search = ''; key.hash = '';
      if (key.pathname === ROOT.pathname) key.pathname += 'index.html';
      const saved = await cache.match(key.href);
      if (saved) return saved;
    }
    return fetch(event.request);
  })());
});
self.addEventListener('message', event => {
  const port = event.ports[0]; if (!port) return;
  event.waitUntil((async () => {
    try {
      if (event.data.type === 'cancel') {
        downloading?.abort();
        await downloadFinished;
        const result = await status();
        port.postMessage(result.current ? result : {...result,error:'Download cancelled. Online play and saved shifts are unchanged.'});
        return;
      }
      if (event.data.type !== 'download' || downloading) { port.postMessage(await status()); return; }
      // Lock before the first await: two tabs must never write the same pack concurrently.
      const controller = new AbortController();
      downloading = controller;
      const signal = controller.signal;
      let finished;
      downloadFinished = new Promise(resolve => { finished = resolve; });
      try {
        let existing = await caches.open(CACHE);
        if (await existing.match(READY)) { port.postMessage({...await status(),busy:false}); return; }
        // Reclaim any incomplete pack left by a closed tab before quota checking.
        await caches.delete(CACHE); existing = await caches.open(CACHE);
        const pack = await manifest(signal);
        const estimate = await navigator.storage.estimate();
        if (estimate.quota && estimate.quota - (estimate.usage || 0) < pack.bytes * 1.15) throw new Error('Not enough browser storage for the full city. Free space and retry.');
        let cursor = 0, done = 0, lastProgress = 0;
        const jobs = Array.from({length:4}, async () => {
          while (cursor < pack.files.length) {
            signal.throwIfAborted();
            const entry = pack.files[cursor++], url = new URL(entry.path, ROOT);
            const response = await fetch(url, {cache:'no-store', signal});
            if (!response.ok) throw new Error(`Could not save ${entry.path}. Retry when connected.`);
            const bytes = await response.clone().arrayBuffer();
            const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2,'0')).join('');
            if (hash !== entry.sha256) throw new Error('The website changed during download. Reload and try again.');
            signal.throwIfAborted();
            await existing.put(url.href, response);
            done++;
            if (Date.now()-lastProgress>200 || done===pack.files.length) {
              lastProgress=Date.now(); port.postMessage({type:'progress',done,total:pack.files.length});
            }
          }
        });
        try { await Promise.all(jobs); }
        catch (error) { controller.abort(); await Promise.allSettled(jobs); throw error; }
        signal.throwIfAborted();
        await existing.put(READY, new Response(JSON.stringify({version:VERSION,bytes:pack.bytes})));
        for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
        if (downloading === controller) downloading = null;
        finished();
        await report(port,{type:'status',ready:true,current:true,busy:false,bytes:pack.bytes});
      } catch (error) {
        await caches.delete(CACHE);
        if (downloading === controller) downloading = null;
        finished();
        await report(port,{type:'status',ready:!!(await readyCache()),busy:false,bytes:0,error:error.name === 'AbortError' ? 'Download cancelled. Online play and saved shifts are unchanged.' : error.message});
      } finally { if (downloading === controller) downloading = null; finished(); }
    } catch (error) { port.postMessage({type:'status',ready:!!(await readyCache()),busy:!!downloading,bytes:0,error:error.message}); }
  })());
});
