"""Real Chromium acceptance tests. No production hooks or external services.
Run: python -m pip install playwright==1.57.0
     python -m playwright install chromium
     python e2e/browser_smoke.py
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
import unittest

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / 'reports' / 'browser'


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class BrowserAcceptance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        REPORTS.mkdir(parents=True, exist_ok=True)
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
        self.context.add_init_script("""localStorage.setItem('sendit.help.v5','1');
            localStorage.setItem('sendit.basemap.v12','google');
            localStorage.setItem('sendit.googleMapsApiKey.v1','test-placeholder-not-a-key');""")
        self.errors, self.external, self.dialogs = [], [], []
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('dialog', self.dismiss_dialog)
        self.context.route('**/*', self.network_guard)
        self.page.goto(self.base + '/?seed=V13-BROWSER')
        expect(self.page.locator('.task-card').first).to_be_visible()
        self.page.keyboard.press('Space')
        self.assertTrue(self.game('g.paused'))

    def dismiss_dialog(self, dialog):
        self.dialogs.append(dialog.message)
        dialog.dismiss()

    def network_guard(self, route):
        if route.request.url.startswith(self.base + '/'):
            route.continue_()
        else:
            self.external.append(route.request.url)
            route.abort()

    def game(self, expression):
        return self.page.evaluate("async () => {const {Game}=await import('/src/game.js');const g=Game.lastInstance;return (" + expression + ");}")

    def camera(self, expression):
        return self.page.evaluate("async () => {const {Renderer}=await import('/src/render.js');const r=Renderer.lastInstance;return (" + expression + ");}")

    def tearDown(self):
        try:
            self.page.screenshot(path=str(REPORTS / f'{self._testMethodName}.png'))
            (REPORTS / f'{self._testMethodName}.json').write_text(json.dumps({
                'pageErrors': self.errors, 'externalRequests': self.external, 'dialogs': self.dialogs
            }, indent=2))
            self.assertEqual(self.errors, [], 'Uncaught browser errors')
            self.assertEqual(self.external, [], 'Native mode contacted a third party')
            self.assertEqual(self.dialogs, [], 'Unexpected modal browser prompt')
        finally:
            self.context.close()

    def test_native_default_ignores_old_google_preference(self):
        expect(self.page.locator('#map-source')).to_have_attribute('data-state', 'fallback')
        self.assertEqual(self.page.locator('#basemap-toggle, #google-map').count(), 0)
        self.page.keyboard.press('g')
        self.assertIsNone(self.page.evaluate('window.__sendItGoogleBasemap'))
        self.assertFalse(self.camera('r.disposed'))

    def test_contract_inspector_all_ten_cargo_icons_and_negative_margin(self):
        card = self.page.locator('.task-card').first
        delivery_id = card.get_attribute('data-delivery')
        card.locator('.task-select').click()
        expect(self.page.locator('#job-inspector')).to_be_visible()
        for cargo in ['food', 'parcel', 'document', 'grocery', 'fragile', 'flowers', 'keys', 'medical', 'catering', 'coldchain']:
            self.game(f"Object.assign(g.deliveryById({json.dumps(delivery_id)}),{{type:{json.dumps(cargo)},deadlineAt:g.elapsed-5}}).type")
            expect(self.page.locator('#inspect-glyph')).to_have_attribute('data-cargo', cargo)
            expect(self.page.locator('#inspect-glyph .cargo-icon.inspector-cargo-icon')).to_be_visible()
        expect(self.page.locator('#inspect-time')).to_contain_text('−')
        expect(self.page.locator('#inspect-time')).to_contain_text('ride margin')
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#job-inspector')).to_be_hidden()

    def test_radio_pointer_actions_do_not_force_a_rider(self):
        identity = self.page.locator('.task-card').first.get_attribute('data-delivery')
        card = self.page.locator(f'[data-delivery="{identity}"]')
        before = self.game('JSON.stringify(g.couriers.map(c=>[c.id,c.deliveryId,c.phase]))')
        for channel in ['open', 'off', 'local', 'off', 'priority', 'off']:
            card.locator(f'[data-channel="{channel}"]').click()
            expect(card).to_have_attribute('data-channel', channel)
            self.assertEqual(self.game('JSON.stringify(g.couriers.map(c=>[c.id,c.deliveryId,c.phase]))'), before)

    def test_keyboard_zoom_fit_and_editable_focus(self):
        original = self.camera('r.zoom')
        self.page.keyboard.press('+')
        self.assertGreater(self.camera('r.zoom'), original)
        self.page.keyboard.press('-')
        self.page.keyboard.press('0')
        self.assertEqual(self.camera('r.zoom'), 1)
        self.page.evaluate("const input=document.createElement('input');input.id='test-editor';document.body.append(input);input.focus();")
        self.page.keyboard.type('+')
        self.assertEqual(self.camera('r.zoom'), 1)
        expect(self.page.locator('#test-editor')).to_have_value('+')
        self.page.locator('#test-editor').evaluate('(el)=>el.remove()')

    def test_map_wheel_and_drag_do_not_advance_paused_simulation(self):
        box = self.page.locator('#game-canvas').bounding_box()
        x, y = box['x'] + box['width'] * .55, box['y'] + box['height'] * .55
        elapsed = self.game('g.elapsed')
        self.page.mouse.move(x, y)
        for _ in range(10):
            self.page.mouse.wheel(0, -200)
            self.page.wait_for_timeout(25)
        self.assertGreater(self.camera('r.zoom'), 1)
        before = self.camera('[r.offsetX,r.offsetY]')
        self.page.mouse.down()
        self.page.mouse.move(x + 70, y + 40, steps=8)
        self.page.mouse.up()
        self.assertNotEqual(self.camera('[r.offsetX,r.offsetY]'), before)
        self.assertEqual(self.game('g.elapsed'), elapsed)

    def test_rails_density_map_focus_and_small_desktop(self):
        html = self.page.locator('html')
        for key, attribute in [('q', 'data-left-rail'), ('r', 'data-right-rail')]:
            self.page.keyboard.press(key)
            expect(html).to_have_attribute(attribute, 'collapsed')
            self.page.keyboard.press(key)
            expect(html).to_have_attribute(attribute, 'open')
        self.page.keyboard.press('m')
        expect(html).to_have_attribute('data-map-focus', 'true')
        self.page.keyboard.press('m')
        self.page.keyboard.press('d')
        expect(html).to_have_attribute('data-density', 'compact')
        self.page.set_viewport_size({'width': 1024, 'height': 768})
        self.page.emulate_media(contrast='more', reduced_motion='reduce')
        for element in self.page.locator('.cargo-icon,.rider-portrait').all():
            box = element.bounding_box()
            if box:
                self.assertLessEqual(box['width'], 32)
                self.assertLessEqual(box['height'], 32)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 1024)
        expect(self.page.locator('#zoom-reset')).to_be_visible()

    def test_layout_reflow_keeps_canvas_sharp_and_hidden_statuses_hidden(self):
        def check_size():
            self.page.wait_for_function("""() => {
                const canvas=document.querySelector('#game-canvas');
                const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
                return Math.abs(canvas.width-rect.width*dpr)<=1 && Math.abs(canvas.height-rect.height*dpr)<=1;
            }""")
            self.assertAlmostEqual(self.camera('r.viewWidth'), self.page.locator('#game-canvas').bounding_box()['width'], delta=1)
        check_size()
        self.assertIsNone(self.game('g.currentEvent'))
        expect(self.page.locator('#event-chip')).to_be_hidden()
        expect(self.page.locator('.task-claimed').first).to_be_hidden()
        expect(self.page.locator('.task-route.drop').first).to_be_visible()
        for key in ['q', 'r', 'm', 'm', 'd']:
            self.page.keyboard.press(key)
            check_size()
            if self.page.locator('html').get_attribute('data-map-focus') == 'true':
                self.assertGreaterEqual(self.page.locator('#game-canvas').bounding_box()['width'], 1438)
        self.page.set_viewport_size({'width': 1024, 'height': 768})
        check_size()

    def test_new_shift_disposes_previous_renderer(self):
        self.page.evaluate("async()=>{window.__previousRenderer=(await import('/src/render.js')).Renderer.lastInstance;}")
        self.page.locator('#new-run').click()
        self.assertTrue(self.page.evaluate('window.__previousRenderer.disposed'))
        self.assertFalse(self.camera('r.disposed'))
        self.page.keyboard.press('Space')
        expect(self.page.locator('.task-card').first).to_be_visible()

    def test_invalid_local_asset_fails_closed_to_curated_map(self):
        self.page.route('**/generated/berlin-runtime-v2.json', lambda route: route.fulfill(status=200, content_type='application/json', body='{"version":2,"geometry":[[]],"names":[]}'))
        self.page.reload()
        expect(self.page.locator('#map-source')).to_have_attribute('data-state', 'fallback')
        self.page.keyboard.press('Space')
        self.page.locator('.task-select').first.click()
        expect(self.page.locator('#job-inspector')).to_be_visible()


if __name__ == '__main__':
    unittest.main(verbosity=2)
