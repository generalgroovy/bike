"""Exercise the composed, subpath-hosted website and its real offline download."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import hashlib,json,sys,threading
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect

site=Path(sys.argv[1]).resolve()
reports=Path(sys.argv[2]).resolve() if len(sys.argv)>2 else Path('reports/web-publication').resolve()
reports.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    fail_file=None
    corrupt_file=None
    def log_message(self,*args): pass
    def do_GET(self):
        if self.fail_file and self.path.split('?')[0].endswith('/'+self.fail_file):
            self.send_error(503,'Offline download failure fixture');return
        if self.corrupt_file and self.path.split('?')[0].endswith('/'+self.corrupt_file):
            self.send_response(200);self.end_headers();self.wfile.write(b'integrity failure fixture');return
        super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(site.parent)))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/{site.name}/'
checks=[];errors=[]
try:
 with sync_playwright() as pw:
    browser=pw.chromium.launch()
    context=browser.new_context(viewport={'width':1280,'height':720},reduced_motion='reduce')
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+'?seed=BERLIN-1&mode=training&district=mitte#desk')
    expect(page.locator('#intro')).to_be_visible(timeout=60000)
    address=urlparse(page.url);query=parse_qs(address.query)
    assert address.path==urlparse(base+'preview/berlin/').path and address.fragment=='desk'
    assert query['seed']==['BERLIN-1'] and query['mode']==['training'] and query['district']==['mitte']
    checks.append('Default web entry loads the Windows-quality desk and preserves query and hash')
    document=site/'preview/berlin'
    pack=json.loads((document/'offline-pack.json').read_text())
    for f in pack['files']:
        assert hashlib.sha256((document/f['path']).read_bytes()).hexdigest()==f['sha256'],f['path']
    checks.append(f"All {len(pack['files'])} offline files match their published hashes")
    desktop=json.loads((document/'desktop-source.json').read_text())
    for f in desktop['files']:
        data=(document/f['path']).read_bytes()
        if f['path']=='index.html':
            data=data.decode().replace('<!-- Browser platform: shared game below is unchanged. -->\n<link rel="manifest" href="app.webmanifest">\n','').replace('<script type="module" src="web-platform.js"></script>\n','').encode()
        assert hashlib.sha256(data).hexdigest()==f['sha256'],f['path']
    checks.append('Shared game, styles, map, portraits and music match desktop source byte for byte')
    page.locator('#prepare-shift').click()
    async_game="async expression=>{const {Game}=await import(new URL('src/game.js',location.href));const g=Game.lastInstance;return eval(expression);}"
    def game(expression):return page.evaluate(async_game,expression)
    def menu():
        if not page.locator('#desk-menu').evaluate('(e)=>e.open'):page.locator('#desk-menu > summary').click()
    menu();expect(page.locator('#web-offline')).to_contain_text('Download offline',timeout=30000)
    page.locator('#web-fullscreen').click()
    page.wait_for_function('!!document.fullscreenElement')
    menu();page.locator('#web-fullscreen').click();page.wait_for_function('!document.fullscreenElement')
    checks.append('Fullscreen enters and exits without changing the game')
    before=game('JSON.stringify(g.exportRun())')
    Handler.fail_file=pack['files'][0]['path']
    menu();page.locator('#web-offline').click()
    expect(page.locator('#web-offline-status')).to_contain_text('Could not save',timeout=30000)
    assert game('JSON.stringify(g.exportRun())')==before
    assert not page.evaluate("async()=>{for(const n of await caches.keys()){if(n.startsWith('send-it-berlin-offline-')){const c=await caches.open(n);if((await c.keys()).some(r=>r.url.endsWith('__offline_ready__')))return true;}}return false;}")
    Handler.fail_file=None
    checks.append('Failed download stays unready and preserves the paused run')
    Handler.corrupt_file=pack['files'][0]['path']
    page.locator('#web-offline').click()
    expect(page.locator('#web-offline-status')).to_contain_text('changed during download',timeout=30000)
    Handler.corrupt_file=None
    checks.append('Hash mismatch rejects changed or damaged files')
    page.locator('#web-offline').click()
    expect(page.locator('#web-offline')).to_have_text('Cancel offline download')
    page.locator('#web-offline').click()
    expect(page.locator('#web-offline-status')).to_contain_text('cancelled',timeout=30000)
    checks.append('Cancellation is recoverable')
    page.locator('#web-offline').click()
    try:
        expect(page.locator('#web-offline')).to_have_text('Available offline',timeout=240000)
    except Exception:
        page.screenshot(path=str(reports/'download-failure.png'))
        print('Offline status:',page.locator('#web-offline-status').text_content(),flush=True)
        raise
    expect(page.locator('#web-offline')).to_be_disabled()
    assert game('JSON.stringify(g.exportRun())')==before
    checks.append('Complete hash-verified city download does not mutate the run')
    page.keyboard.press('Escape')
    page.screenshot(path=str(reports/'desktop.png'))
    for width,height in [(390,844),(320,740)]:
        page.set_viewport_size({'width':width,'height':height});menu()
        assert page.locator('.menu-sheet').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}')
        assert page.evaluate('document.documentElement.scrollWidth')<=width
        page.screenshot(path=str(reports/f'phone-{width}.png'))
        page.keyboard.press('Escape')
    page.set_viewport_size({'width':1280,'height':720})
    checks.append('Menu, offline status and game fit desktop, 390 px and 320 px layouts')
    await_url=base+'preview/berlin/?seed=BERLIN-1&mode=training&district=mitte'
    context.set_offline(True)
    page.goto(await_url)
    expect(page.locator('#intro')).to_be_visible(timeout=60000)
    page.locator('#prepare-shift').click()
    page.locator('#sound').click()
    assert page.evaluate("async()=>{const {DeskScore}=await import(new URL('src/playtest-score.js',location.href));return DeskScore.lastInstance.ctx.state;}")=='running'
    page.locator('[data-radio=open]').click();page.locator('#pause').click()
    expect(page.locator('#delivery-target')).to_have_text('1 / 5 delivered',timeout=45000)
    page.locator('#pause').click()
    checks.append('Offline reload loads Berlin, plays audio and completes an autonomous delivery')
    page.locator('#region-view').select_option('spandau')
    for _ in range(6):page.locator('#zoom-in').click()
    expect(page.locator('#map-detail-status')).to_contain_text('Official building footprints',timeout=30000)
    checks.append('Previously unvisited Spandau building detail loads offline')
    saved=game('JSON.stringify({tick:g.tick,seed:g.seed,cash:g.cash,completed:g.completed})')
    expect(page.locator('#save-state')).to_contain_text('Saved on this device')
    page.reload();expect(page.locator('#intro')).to_be_visible(timeout=60000)
    page.locator('#resume-saved').click()
    assert game('JSON.stringify({tick:g.tick,seed:g.seed,cash:g.cash,completed:g.completed})')==saved
    assert game('g.paused')
    checks.append('Saved run restores exactly and paused while still offline')
    page.screenshot(path=str(reports/'offline-delivery.png'))
    assert not errors,errors
    (reports/'acceptance.json').write_text(json.dumps({'checks':checks,'errors':errors,'bytes':pack['bytes'],'files':len(pack['files'])},indent=2),encoding='utf-8')
    print(json.dumps({'checks':checks,'errors':errors,'bytes':pack['bytes'],'files':len(pack['files'])}))
    context.close();browser.close()
finally:
 server.shutdown();server.server_close()
