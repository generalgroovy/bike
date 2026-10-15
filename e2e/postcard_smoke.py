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

    def test_first_call_teaches_preview_confirm_start_then_gets_out_of_the_way(self):
        self.start()
        expect(self.page.locator('#first-call-coach')).to_have_attribute('data-step', 'preview')
        before = self.dispatch_snapshot()
        self.page.locator('#first-call-action').click()
        expect(self.page.locator('[data-radio="open"]')).to_be_focused()
        self.assertEqual(self.dispatch_snapshot(), before)
        self.page.keyboard.press('Enter')
        expect(self.page.locator('#first-call-coach')).to_have_attribute('data-step', 'confirm')
        self.assertEqual(self.game('g.radioUsed()'), 0)
        self.page.keyboard.press('Enter')
        expect(self.page.locator('#first-call-coach')).to_have_attribute('data-step', 'start')
        self.assertTrue(self.game("g.couriers.every(c=>c.phase==='idle')"))
        self.page.locator('#first-call-action').click()
        expect(self.page.locator('#pause')).to_be_focused()
        self.page.keyboard.press('Enter')
        self.wait_rider_acceptance()
        expect(self.page.locator('#delivery-target')).to_have_text('1 / 6 delivered', timeout=45000)
        expect(self.page.locator('#first-call-coach')).to_be_hidden()
        self.page.locator('#pause').click()
        REPORTS.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=str(REPORTS / 'first-delivery.png'))

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
