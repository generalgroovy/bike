"""Browser acceptance for the bounded Berlin ruleset. Run with Python + Playwright 1.57."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
import unittest

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / 'reports' / 'browser' / 'playtest'


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class PlaytestAcceptance(unittest.TestCase):
    city = 'inner-ring'
    node_count = 30656
    ruleset = 'berlin-dispatch-v3'
    map_asset = 'berlin-inner-ring.json'
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
        self.context = self.browser.new_context(viewport={'width': 1280, 'height': 720}, reduced_motion='reduce')
        self.addCleanup(lambda: self.context.close() if self.context.pages else None)
        self.errors, self.external, self.failed_responses = [], [], []
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('response', lambda response: self.failed_responses.append(response.url) if response.status >= 400 else None)
        self.context.route('**/*', self.network_guard)
        self.page.goto(self.base + f'/playtest.html?seed=BERLIN-1&mode=training&city={self.city}')
        expect(self.page.locator('#intro')).to_be_visible(timeout=30000)

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

    def start(self, mode='training'):
        self.page.locator(f'[data-start="{mode}"]').click()
        expect(self.page.locator('#intro')).to_be_hidden()

    def tearDown(self):
        try:
            self.page.screenshot(path=str(REPORTS / f'{self._testMethodName}.png'), full_page=True)
            (REPORTS / f'{self._testMethodName}.json').write_text(json.dumps({
                'pageErrors': self.errors, 'externalRequests': self.external, 'failedResponses': self.failed_responses
            }, indent=2), encoding='utf-8')
            self.assertEqual(self.errors, [], 'Uncaught browser errors')
            self.assertEqual(self.external, [], 'Playtest contacted an external service')
            self.assertEqual(self.failed_responses, [], 'Missing or failed local resources')
        finally:
            self.context.close()

    def test_guided_first_delivery_uses_real_time_and_shows_courier_choice(self):
        self.start()
        expect(self.page.locator('#coach')).to_contain_text('first call')
        self.page.locator('.quick-call').click()
        self.assertEqual(self.game('g.radioUsed()'), 1)
        self.assertTrue(self.game("g.couriers.every(c=>c.phase==='idle')"))
        self.page.locator('#pause').click()
        expect(self.page.locator('.job-status')).to_contain_text('is on it', timeout=8000)
        expect(self.page.locator('#coach')).to_contain_text('chose the job')
        expect(self.page.locator('#delivery-target')).to_have_text('1 / 5 delivered', timeout=25000)
        self.page.locator('#pause').click()
        self.assertTrue(self.game('g.paused'))

    def test_radio_bonus_and_keyboard_actions_are_accessible_and_do_not_assign(self):
        self.start()
        self.page.locator('.quick-call').focus()
        self.page.keyboard.press('Space')
        self.assertEqual(self.game('g.radioUsed()'), 1)
        self.assertTrue(self.game('g.paused'))
        for channel, cost in [('local', 1), ('priority', 2), ('open', 1)]:
            self.page.locator(f'[data-radio="{channel}"]').click()
            self.assertEqual(self.game('g.radioUsed()'), cost)
            self.assertTrue(self.game("g.couriers.every(c=>c.phase==='idle')"))
        fee = self.game('g.deliveries[0].reward')
        self.page.locator('#bonus').click()
        expect(self.page.locator('#cash')).to_have_text('€5')
        expect(self.page.locator('#bonus')).to_be_disabled()
        self.assertEqual(self.game('g.deliveries[0].reward'), fee)
        self.page.locator('#withdraw').click()
        expect(self.page.locator('#withdraw')).to_be_hidden()
        self.assertEqual(self.game('g.radioUsed()'), 0)

    def test_keyed_cards_keep_focus_during_updates(self):
        self.start('standard')
        self.page.locator('.job-select').first.focus()
        self.page.evaluate("window.testCard=document.querySelector('.job-card')")
        self.page.wait_for_timeout(450)
        self.assertTrue(self.page.evaluate("testCard===document.querySelector('.job-card') && document.activeElement===testCard.querySelector('.job-select')"))
        self.assertEqual(self.page.locator('.job-card').count(), 3)

    def test_responsive_layout_and_canvas_backing_store(self):
        self.start()
        for width, height in [(1440, 900), (1280, 720), (1024, 768), (850, 900), (390, 844), (360, 780), (320, 568)]:
            with self.subTest(width=width):
                self.page.set_viewport_size({'width': width, 'height': height})
                self.page.wait_for_timeout(180)
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width)
                metrics = self.camera('({css:r.canvas.getBoundingClientRect().width,view:r.viewWidth,backing:r.canvas.width,dpr:r.dpr})')
                self.assertAlmostEqual(metrics['css'], metrics['view'], delta=1)
                self.assertAlmostEqual(metrics['backing'], metrics['view'] * metrics['dpr'], delta=1)
                if width >= 1024:
                    self.assertTrue(self.page.locator('[data-radio="priority"]').evaluate('(el)=>el.getBoundingClientRect().bottom<=innerHeight'))
                if width == 390:
                    self.page.screenshot(path=str(REPORTS / 'phone-390.png'), full_page=True)
        self.page.set_viewport_size({'width': 1280, 'height': 720})

    def test_complete_shift_review_download_and_same_seed_retry(self):
        self.start('standard')
        # Accelerate only the simulation fixture; render and download use production UI.
        self.page.evaluate("""async () => {
            const {Game}=await import('/src/game.js'), {FIXED_STEP}=await import('/src/game-berlin-playtest.js');
            const g=Game.lastInstance;g.dispatch({type:'pause',paused:false});
            for(let i=0;i<34000&&!g.gameOver;i++) {
                if(g.upgradePending)g.dispatch({type:'upgrade',id:'legs'});
                if(i%60===0)for(const d of g.activeDeliveries().filter(d=>d.status==='waiting'&&!d.called))g.dispatch({type:'radio',jobId:d.id,channel:'open'});
                g.update(FIXED_STEP);
            }
        }""")
        expect(self.page.locator('#review-dialog')).to_be_visible()
        expect(self.page.locator('#result-title')).to_have_text('You kept Berlin moving.')
        self.assertEqual(self.game('g.activeDeliveries().length'), 0)
        with self.page.expect_download() as download:
            self.page.locator('#export-run').click()
        download.value.save_as(str(REPORTS / 'sample-shift.json'))
        record = json.loads((REPORTS / 'sample-shift.json').read_text(encoding='utf-8'))
        self.assertEqual(record['review']['outcome'], 'success')
        self.assertEqual(record['seed'], 'BERLIN-1')
        self.assertGreater(len(record['actions']), 20)
        self.page.locator('#retry').click()
        expect(self.page.locator('#review-dialog')).to_be_hidden()
        self.assertEqual(self.game('g.seed'), 'BERLIN-1')
        self.assertEqual(self.game('g.tick'), 0)
        self.assertTrue(self.game('g.paused'))

    def test_upgrade_pauses_and_restart_disposes_renderer(self):
        self.start()
        self.game('(g.elapsed=60,g.paused=false,g.update(1/60),g.upgradePending)')
        expect(self.page.locator('#upgrade-dialog')).to_be_visible()
        tick = self.game('g.tick')
        self.page.wait_for_timeout(250)
        self.assertEqual(self.game('g.tick'), tick)
        self.page.locator('#upgrade-list button').first.click()
        expect(self.page.locator('#upgrade-dialog')).to_be_hidden()
        self.assertEqual(self.game('g.radioSlots'), 4)
        self.camera('(window.previousRenderer=r,true)')
        self.page.locator('#new-shift').click()
        self.start('standard')
        self.assertTrue(self.page.evaluate('previousRenderer.disposed'))
        self.assertFalse(self.camera('r.disposed'))

    def test_background_event_pauses_and_zoom_and_help_work(self):
        self.start()
        self.page.locator('#zoom-in').click()
        self.assertGreater(self.camera('r.zoom'), 1)
        self.page.locator('#fit-map').click()
        self.assertEqual(self.camera('r.zoom'), 1)
        self.page.locator('#pause').click()
        self.page.locator('#help').click()
        self.assertTrue(self.game('g.paused'))
        self.page.locator('#close-help').click()
        self.assertFalse(self.game('g.paused'))
        self.page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
        tick = self.game('g.tick')
        self.assertTrue(self.game('g.paused'))
        self.page.wait_for_timeout(250)
        self.assertEqual(self.game('g.tick'), tick)
        self.page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
        expect(self.page.locator('#pause')).to_have_text('Resume')

    def test_unified_entry_region_views_and_route_focus_use_one_geographic_map(self):
        self.start('standard')
        self.assertEqual(self.game('g.nodes.length'), self.node_count)
        self.assertEqual(self.game('g.ruleset'), self.ruleset)
        before = self.game('g.deliveries.map(d=>[d.id,d.pickupId,d.dropoffId])')
        self.page.locator('#region-view').select_option('kreuzberg')
        self.assertGreater(self.camera('r.zoom'), 1)
        self.assertEqual(self.game('g.deliveries.map(d=>[d.id,d.pickupId,d.dropoffId])'), before)
        self.assertTrue(self.game('g.paused'))
        self.page.locator('#find-route').click()
        self.assertGreater(self.camera('r.zoom'), 2)
        self.page.screenshot(path=str(REPORTS / 'geographic-route.png'), full_page=True)
        self.page.locator('#fit-map').click()
        self.assertEqual(self.camera('r.zoom'), 1)
        self.assertEqual(self.page.locator('#region-view').input_value(), '')
        self.page.goto(self.base + f'/index.html?mode=standard&seed=BERLIN-1&city={self.city}')
        expect(self.page.locator('#intro')).to_be_visible()
        self.assertEqual(self.game('g.deliveries.map(d=>[d.id,d.pickupId,d.dropoffId])'), before)
        self.assertEqual(self.game('g.cityData.metadata.crs'), 'EPSG:25833')

    def test_touch_pinch_and_panel_navigation(self):
        self.start()
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.locator('.mobile-desk-nav a').first.click()
        self.page.evaluate("""() => {
            const c=document.querySelector('canvas'),r=c.getBoundingClientRect();
            // Synthetic pointer capture is a no-op; event handling is production code.
            c.setPointerCapture=()=>{};c.hasPointerCapture=()=>false;
            const send=(type,id,x,y,primary)=>c.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:primary,button:0,clientX:r.left+x,clientY:r.top+y,bubbles:true}));
            send('pointerdown',10,90,240,true);send('pointerdown',11,230,240,false);
            send('pointermove',11,310,240,false);send('pointerup',11,310,240,false);send('pointerup',10,90,240,true);
        }""")
        self.assertGreater(self.camera('r.zoom'), 1.4)
        self.assertTrue(self.game('g.paused'))
        self.page.locator('.mobile-desk-nav a').nth(1).click()
        self.assertTrue(self.page.locator('#work-title').evaluate('(el)=>el.getBoundingClientRect().top>=0&&el.getBoundingClientRect().top<innerHeight'))

    def test_map_load_failure_is_explicit_and_does_not_substitute_a_schematic(self):
        self.context.unroute('**/*', self.network_guard)
        self.context.route('**/generated/'+self.map_asset, lambda route: route.abort())
        self.page.goto(self.base + '/index.html?city='+self.city)
        expect(self.page.locator('#fatal-error')).to_be_visible()
        expect(self.page.locator('#fatal-message')).to_contain_text('Berlin map could not load')
        expect(self.page.locator('#intro')).to_be_hidden()
        self.assertIsNone(self.game('g'))

    def test_still_map_is_cached_while_riders_keep_animating(self):
        self.start()
        frames = self.camera('r.renderStats.frames')
        paints = self.camera('r.renderStats.mapRepaints')
        self.page.wait_for_timeout(250)
        self.assertGreater(self.camera('r.renderStats.frames'), frames)
        self.assertEqual(self.camera('r.renderStats.mapRepaints'), paints)

    def test_timing_advice_and_full_radio_explain_the_next_decision(self):
        self.start('standard')
        expect(self.page.locator('.job-timing').first).to_contain_text('to finish')
        self.page.locator('.quick-call').nth(0).click()
        self.page.locator('.quick-call').nth(1).click()
        self.page.locator('.quick-call').nth(2).click()
        expect(self.page.locator('#radio-hint')).to_contain_text('Radio full')
        self.game('(g.spawnDelivery(),true)')
        expect(self.page.locator('.quick-call').last).to_have_text('Radio full')
        expect(self.page.locator('.quick-call').last).to_be_disabled()
        self.page.locator('.quick-call').first.click()
        expect(self.page.locator('.quick-call').last).to_be_enabled()
        self.game('(g.deliveries[0].deadlineAt=g.elapsed+.5,true)')
        self.page.locator('.job-select').first.click()
        expect(self.page.locator('.job-timing').first).to_contain_text('Too little time')
        expect(self.page.locator('#selected-state')).to_contain_text('cannot extend the deadline')
        self.assertTrue(self.game("g.couriers.every(c=>c.phase==='idle')"))
        self.assertTrue(self.game('g.paused'))

    def test_first_route_starts_close_and_guide_can_be_collapsed(self):
        self.start()
        self.assertGreater(self.camera('r.zoom'), 2)
        self.assertEqual(self.page.locator('#region-view').input_value(), 'route')
        expect(self.page.locator('#coach')).to_be_visible()
        self.page.locator('#coach-panel summary').click()
        expect(self.page.locator('#coach')).to_be_hidden()
        self.page.locator('#coach-panel summary').click()
        expect(self.page.locator('#coach')).to_be_visible()
        self.page.locator('#fit-map').click()
        self.assertEqual(self.camera('r.zoom'), 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
