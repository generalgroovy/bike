// Browser-only conveniences. The shared game and saved-run format stay untouched.
const menu = document.querySelector('.menu-sheet');
if (menu) {
  const fullscreen = document.createElement('button');
  fullscreen.id = 'web-fullscreen';
  fullscreen.textContent = 'Fullscreen';
  fullscreen.hidden = !document.fullscreenEnabled;
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { status.textContent = 'Fullscreen is unavailable. You can still play in this tab.'; }
  });
  document.addEventListener('fullscreenchange', () => { fullscreen.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'; });
  const download = document.createElement('button');
  download.id = 'web-offline'; download.textContent = 'Offline play';
  download.disabled = true;
  const status = document.createElement('p');
  status.id = 'web-offline-status'; status.className = 'fine-print';
  status.style.cssText = 'margin:4px 12px 10px;line-height:1.5';
  status.setAttribute('role', 'status');
  const meta = menu.querySelector('.session-meta');
  menu.insertBefore(fullscreen, meta); menu.insertBefore(download, meta); menu.insertBefore(status, meta);
  let registration, downloading = false, ownsDownload = false, commandVersion = 0, packBytes = 0;
  const show = result => {
    if (result.bytes > 0) packBytes = result.bytes;
    if (result.type === 'progress') {
      status.textContent = `Saving Berlin offline · ${result.done} / ${result.total} files`;
      return;
    }
    downloading = result.busy === true;
    download.disabled = result.current === true && !downloading;
    download.textContent = downloading ? 'Cancel offline download' : result.current ? 'Available offline' : result.ready ? 'Update offline copy' : packBytes ? `Download offline · ${Math.ceil(packBytes / 1e6)} MB` : 'Retry offline download';
    status.textContent = result.error || (result.ready ? 'Ready offline. Reopen this game from your bookmark. Clearing site data removes the download and saved shifts.' : 'Optional: saves the full city, building detail and music on this device.');
  };
  async function send(type) {
    const command = commandVersion;
    const worker = registration?.active;
    if (!worker) throw new Error('Offline setup is not ready. Try again shortly.');
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      // A timeout ends this UI request; it never marks an incomplete download ready.
      let timer = setTimeout(() => { channel.port1.close(); reject(new Error('Offline request timed out. Reopen Menu to retry.')); }, 60000);
      channel.port1.onmessage = ({data}) => {
        clearTimeout(timer);
        if (command === commandVersion) show(data);
        if (data.type === 'progress') {
          timer = setTimeout(() => { channel.port1.close(); reject(new Error('Download stalled. Cancel and retry when connected.')); }, 60000);
        } else { channel.port1.close(); resolve(data); }
      };
      worker.postMessage({type}, [channel.port2]);
    });
  }
  download.addEventListener('click', async event => {
    // Keep progress visible in Menu; no request is made until the player chooses it.
    event.stopPropagation();
    const command = ++commandVersion;
    ownsDownload = true;
    try {
      if (downloading) await send('cancel');
      else {
        downloading = true; download.textContent = 'Cancel offline download';
        status.textContent = 'Preparing offline download…';
        await send('download');
        if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
      }
    } catch (error) {
      if (command === commandVersion) { downloading = false; status.textContent = error.message; download.textContent = 'Retry offline download'; download.disabled = false; }
    } finally { if (command === commandVersion) ownsDownload = false; }
  });
  document.querySelector('#desk-menu').addEventListener('toggle', () => {
    if (document.querySelector('#desk-menu').open && registration && !ownsDownload) send('status').catch(error => { status.textContent = error.message; });
  });
  if ('serviceWorker' in navigator && isSecureContext) {
    navigator.serviceWorker.addEventListener('message', ({data}) => { if (data?.kind === 'send-it-offline-status' && !ownsDownload) show(data); });
    navigator.serviceWorker.register('./service-worker.js', {scope:'./', updateViaCache:'none'})
      .then(() => navigator.serviceWorker.ready)
      .then(async value => { registration = value; await send('status'); })
      .catch(() => { status.textContent = 'Offline storage is unavailable here. Online play still works.'; });
  } else { status.textContent = 'Offline play requires a secure browser with service-worker support.'; }
}
