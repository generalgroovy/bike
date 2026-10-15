"""Postcard acceptance: opening, a real simulated shift, exact retry and local keepsakes."""
import json
import re
import unittest
from pathlib import Path
from playwright.sync_api import expect
import playtest_smoke as desk

REPORTS = desk.ROOT / 'reports' / 'browser' / 'postcards'


class PostcardAcceptance(unittest.TestCase):
    city = 'berlin'
    setUpClass = classmethod(desk.PlaytestAcceptance.setUpClass.__func__)
    tearDownClass = classmethod(desk.PlaytestAcceptance.tearDownClass.__func__)
    setUp = desk.PlaytestAcceptance.setUp
    tearDown = desk.PlaytestAcceptance.tearDown
    network_guard = desk.PlaytestAcceptance.network_guard
    game = desk.PlaytestAcceptance.game
    start = desk.PlaytestAcceptance.start
    wait_rider_acceptance = desk.PlaytestAcceptance.wait_rider_acceptance
    dispatch_snapshot = desk.PlaytestAcceptance.dispatch_snapshot

    def remember_prepared_desk(self):
        return self.page.evaluate('''async()=>{
            const {Game}=await import('/src/game.js');
            const {Renderer}=await import('/src/render.js');
            window.preparedDesk={Game,Renderer,game:Game.lastInstance,renderer:Renderer.lastInstance,
                record:JSON.stringify(Game.lastInstance.exportRun()),
                created:performance.getEntriesByName('send-it:game-created').length};
            return {record:Game.lastInstance.exportRun(),created:preparedDesk.created};
        }''')

    def prepared_desk_state(self):
        return self.page.evaluate('''()=>({
            sameGame:preparedDesk.Game.lastInstance===preparedDesk.game,
            sameRenderer:preparedDesk.Renderer.lastInstance===preparedDesk.renderer,
            sameRecord:JSON.stringify(preparedDesk.Game.lastInstance.exportRun())===preparedDesk.record,
            paused:preparedDesk.Game.lastInstance.paused,
            created:performance.getEntriesByName('send-it:game-created').length
        })''')

    def test_first_call_teaches_preview_confirm_start_then_gets_out_of_the_way(self):
        REPORTS.mkdir(parents=True, exist_ok=True)
        for width in [1280, 390, 320]:
            self.page.set_viewport_size({'width':width, 'height':720})
            expect(self.page.locator('#prepare-shift')).to_be_visible()
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width)
            self.page.screenshot(path=str(REPORTS / f'setup-{width}.png'))
        self.page.set_viewport_size({'width':1280, 'height':720})
        self.start()
        expect(self.page.locator('#first-call-coach')).to_have_attribute('data-step', 'preview')
        expect(self.page.locator('#first-call-action')).to_be_hidden()
        before = self.dispatch_snapshot()
        radio = self.page.locator('[data-radio="open"]')
        radio.focus()
        expect(radio).to_be_focused()
        self.assertEqual(self.dispatch_snapshot(), before)
        self.page.keyboard.press('Enter')
        expect(self.page.locator('#first-call-coach')).to_have_attribute('data-step', 'confirm')
        expect(self.page.locator('#forecast-state')).to_have_text('PREVIEW · NOT SENT')
        expect(radio.locator('strong')).to_have_text('Send call ↗')
        expect(self.page.locator('#first-call-action')).to_be_hidden()
        self.assertEqual(self.game('g.radioUsed()'), 0)
        for width in [1280, 390, 320]:
            self.page.set_viewport_size({'width':width, 'height':720})
            if width != 1280:
                # Re-open through the actual control so mobile uses its normal
                # preview reveal position, with no test-only scrolling shortcut.
                self.page.locator('#cancel-preview').click()
                radio.click()
            expect(self.page.locator('#forecast-state')).to_have_text('PREVIEW · NOT SENT')
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width)
            self.assertEqual(self.dispatch_snapshot(), before)
            self.page.screenshot(path=str(REPORTS / f'preview-{width}.png'))
        self.page.set_viewport_size({'width':1280, 'height':720})
        radio.focus()
        self.page.keyboard.press('Enter')
        expect(self.page.locator('#first-call-coach')).to_have_attribute('data-step', 'start')
        self.assertTrue(self.game("g.couriers.every(c=>c.phase==='idle')"))
        self.page.locator('#pause').focus()
        expect(self.page.locator('#pause')).to_be_focused()
        self.page.keyboard.press('Enter')
        self.wait_rider_acceptance()
        expect(self.page.locator('#radio-event-label')).to_have_text('ACCEPTED')
        owner = self.game("(()=>{const c=g.courierById(g.deliveryById('d0').courierId);return {id:c.id,name:c.name,bike:c.bikeType};})()")
        reply = self.page.locator('#radio-lines .radio-bubble[data-speaker="rider"]')
        expect(reply).to_have_attribute('data-rider', owner['id'])
        expect(reply.locator('strong')).to_contain_text(owner['name'])
        expect(reply.locator('svg.bike-icon')).to_have_count(1)
        expect(reply.locator('svg.bike-icon')).to_have_attribute('data-bike-type', owner['bike'])
        expect(self.page.locator('#delivery-target')).to_have_text('1 / 6 delivered', timeout=45000)
        expect(self.page.locator('#first-call-coach')).to_be_hidden()
        self.page.locator('#pause').click()
        REPORTS.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=str(REPORTS / 'first-delivery.png'))

    def test_unchanged_prepare_reuses_the_unopened_desk_but_new_shift_never_does(self):
        # setUp enters without a district parameter. Training's normalized
        # locality must also be selected, otherwise unchanged setup rebuilds.
        self.assertEqual(self.game('g.startRegion'), 'mitte')
        self.assertEqual(self.page.locator('#start-region').input_value(), 'mitte')
        initial = self.remember_prepared_desk()
        self.assertEqual(initial['created'], 1)
        self.start()
        reused = self.prepared_desk_state()
        self.assertEqual(reused, {
            'sameGame':True, 'sameRenderer':True, 'sameRecord':True,
            'paused':True, 'created':initial['created']
        })
        self.assertEqual(self.game('g.exportRun()'), initial['record'])
        self.page.locator('#desk-menu summary').click()
        self.page.locator('#new-shift').click()
        expect(self.page.locator('#intro')).to_be_visible()
        self.page.locator('#prepare-shift').click()
        expect(self.page.locator('#intro')).to_be_hidden()
        fresh = self.prepared_desk_state()
        self.assertFalse(fresh['sameGame'])
        self.assertFalse(fresh['sameRenderer'])
        self.assertFalse(fresh['sameRecord'])
        self.assertTrue(fresh['paused'])
        self.assertEqual(fresh['created'], initial['created'] + 1)
        self.assertEqual(self.game('g.tick'), 0)
        self.assertNotEqual(self.game('g.seed'), initial['record']['seed'])
        REPORTS.mkdir(parents=True, exist_ok=True)
        (REPORTS / 'prepare-reuse.json').write_text(json.dumps({
            'noDistrictResolvedTo':'mitte', 'unchangedPrepare':reused,
            'explicitNewShift':fresh
        }, indent=2), encoding='utf-8')
        self.page.evaluate('delete window.preparedDesk')

    def test_changed_initial_mode_or_locality_builds_the_requested_desk(self):
        for field, value, mode, locality in [
            ('#shift-length', 'standard', 'standard', 'mitte'),
            ('#start-region', 'moabit', 'training', 'moabit'),
        ]:
            with self.subTest(field=field):
                if field == '#start-region':
                    # A fresh initial setup is necessary: explicit New shift
                    # has a separate force-new rule and cannot prove this guard.
                    self.page.goto(self.base + '/?seed=BERLIN-1&mode=training&city=berlin&district=mitte')
                    expect(self.page.locator('#intro')).to_be_visible(timeout=30000)
                initial = self.remember_prepared_desk()
                self.page.locator(field).select_option(value)
                self.assertTrue(self.prepared_desk_state()['sameRecord'])
                self.page.locator('#prepare-shift').click()
                expect(self.page.locator('#intro')).to_be_hidden()
                changed = self.prepared_desk_state()
                self.assertFalse(changed['sameGame'])
                self.assertFalse(changed['sameRenderer'])
                self.assertTrue(changed['paused'])
                self.assertEqual(changed['created'], initial['created'] + 1)
                self.assertEqual(self.game('g.mode'), mode)
                self.assertEqual(self.game('g.startRegion'), locality)
                self.assertEqual(self.game('g.seed'), initial['record']['seed'])
                self.assertEqual(self.game('g.ruleset'), initial['record']['ruleset'])
                self.assertEqual(self.game('g.tick'), 0)
                self.page.evaluate('delete window.preparedDesk')

    def test_stamps_modal_holds_clock_without_recording_actions_and_fits_small_screens(self):
        self.start('standard')
        self.page.locator('#pause').click()
        self.page.locator('#postcard-progress').click()
        expect(self.page.locator('#postcard-dialog')).to_be_visible()
        before = self.dispatch_snapshot()
        self.page.wait_for_timeout(350)
        self.assertEqual(self.dispatch_snapshot(), before)
        self.assertFalse(self.game('g.paused'), 'Read-only inspection must not append a pause action')
        for width in [1280, 390, 320]:
            self.page.set_viewport_size({'width':width, 'height':720})
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width)
            boxes = self.page.locator('.postcard-stamp').evaluate_all('els=>els.map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,clip:e.scrollWidth>e.clientWidth+1}))')
            for box in boxes:
                self.assertGreaterEqual(box['left'], 0)
                self.assertLessEqual(box['right'], width)
                self.assertFalse(box['clip'])
        self.page.keyboard.press('Escape')
        expect(self.page.locator('#postcard-dialog')).to_be_hidden()
        self.page.wait_for_timeout(250)
        self.assertGreater(self.game('g.tick'), before['tick'])

    def test_completed_shift_produces_map_postcard_album_download_and_exact_retry(self):
        self.start()
        initial = self.game('({seed:g.seed,mode:g.mode,ruleset:g.ruleset,startRegion:g.startRegion,jobs:g.deliveries})')
        # Advance production fixed steps with an ordinary offer policy. No fake
        # completions, stamps, courier assignments or final outcome are injected.
        self.game("g.dispatch({type:'pause',paused:false})")
        for batch in range(12):
            finished = self.game('''(()=>{for(let i=0;i<1200&&!g.gameOver;i++){
                if(g.upgradePending)g.dispatch({type:'upgrade',id:'legs'});
                if(i%30===0){for(const d of g.activeDeliveries().filter(d=>d.status==='waiting'&&!d.called)){
                    if(g.radioUsed()>=g.radioSlots)break;
                    g.dispatch({type:'radio',jobId:d.id,channel:'open'});
                }}g.update(1/60);
            }return g.gameOver;})()''')
            if finished:
                break
        self.assertTrue(finished, 'Production shift reached its real end')
        expect(self.page.locator('#review-dialog')).to_be_visible(timeout=30000)
        expect(self.page.locator('.postcard-image')).to_be_visible()
        self.assertTrue(self.page.locator('.postcard-image').evaluate('el=>el.complete&&el.naturalWidth===960'))
        record = self.game('g.exportRun()')
        self.assertGreater(record['review']['completed'], 0)
        collection = self.page.evaluate("JSON.parse(localStorage.getItem('send-it:postcards:v1'))")
        self.assertEqual(len(collection), 1)
        self.assertEqual(collection[0]['completed'], record['review']['completed'])
        REPORTS.mkdir(parents=True, exist_ok=True)
        (REPORTS / 'full-shift.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
        self.page.screenshot(path=str(REPORTS / 'shift-review.png'), full_page=True)
        with self.page.expect_download() as received:
            self.page.locator('#download-postcard').click()
        download = received.value
        self.assertTrue(download.suggested_filename.endswith('.svg'))
        download.save_as(str(REPORTS / 'berlin-postcard.svg'))
        self.assertIn('data-stop="delivery"', (REPORTS / 'berlin-postcard.svg').read_text(encoding='utf-8'))
        self.page.locator('#copy-challenge').click()
        expect(self.page.locator('#challenge-status')).to_contain_text(re.compile('copied|Copy this link'))
        self.page.locator('#retry').click()
        self.assertEqual(self.game('({seed:g.seed,mode:g.mode,ruleset:g.ruleset,startRegion:g.startRegion,jobs:g.deliveries})'), initial)
        self.assertTrue(self.game('g.paused'))
        self.page.locator('#postcard-progress').click()
        self.page.locator('#postcard-album summary').click()
        expect(self.page.locator('#postcard-collection li')).to_have_count(1)

    def test_legacy_link_retry_and_explicit_next_shift_keep_correct_rules(self):
        self.page.goto(self.base + '/?city=berlin&district=mitte&seed=OLD-RIDE&mode=training&ruleset=berlin-dispatch-v6')
        expect(self.page.locator('#intro')).to_be_visible(timeout=30000)
        self.start()
        self.assertEqual(self.game('g.ruleset'), 'berlin-dispatch-v6')
        # End-state fixture isolates the retry/next-choice UI from shift balance.
        self.game("g.finishShift('target-missed')")
        expect(self.page.locator('#review-dialog')).to_be_visible()
        self.page.locator('#retry').click()
        self.assertEqual(self.game('g.ruleset'), 'berlin-dispatch-v6')
        self.assertEqual(self.game('g.seed'), 'OLD-RIDE')
        self.game("g.finishShift('target-missed')")
        expect(self.page.locator('#review-dialog')).to_be_visible()
        self.page.locator('#next-shift').click()
        self.page.wait_for_timeout(350)
        expect(self.page.locator('#intro')).to_be_visible()
        expect(self.page.locator('#review-dialog')).to_be_hidden()
        self.assertEqual(self.page.locator('#shift-length').input_value(), 'training')

    def test_blocked_local_storage_still_delivers_downloadable_postcard(self):
        self.start()
        self.page.evaluate("()=>{Storage.prototype.setItem=function(){throw new DOMException('blocked','SecurityError')};}")
        self.game("g.finishShift('target-missed')")
        expect(self.page.locator('#review-dialog')).to_be_visible()
        expect(self.page.locator('#postcard-save-status')).to_contain_text('storage is unavailable')
        expect(self.page.locator('#download-postcard')).to_be_enabled()
        expect(self.page.locator('.postcard-image')).to_be_visible()


if __name__ == '__main__':
    unittest.main(verbosity=2)
