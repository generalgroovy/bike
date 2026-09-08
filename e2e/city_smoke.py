"""Run the shared desk acceptance against the full city, plus city-specific flows."""
import json
import unittest
from pathlib import Path
from playwright.sync_api import expect
import playtest_smoke as desk

class CityAcceptance(desk.PlaytestAcceptance):
    city = 'berlin'
    ruleset = 'berlin-dispatch-v5'
    map_asset = 'berlin-city.json.gz'
    node_count = json.loads((Path(__file__).resolve().parents[1]/'generated/berlin-city-sources.json').read_text(encoding='utf-8'))['nodes']

    def test_outer_locality_starts_and_rider_location_preserve_geography(self):
        expect(self.page.locator('#start-region')).to_be_visible()
        self.assertEqual(self.page.locator('#start-region option').count(), 98)
        self.page.locator('#start-region').select_option('spandau')
        self.start('standard')
        self.assertEqual(self.game('g.startRegion'), 'spandau')
        self.assertTrue(self.game("g.couriers.every(c=>g.nodeById(c.nodeId).districtId==='spandau')"))
        before = self.game('g.couriers.map(c=>[c.x,c.y])')
        self.page.locator('#region-view').select_option('koepenick')
        self.page.locator('.rider-locate').first.click()
        self.assertEqual(self.game('g.couriers.map(c=>[c.x,c.y])'), before)
        self.assertGreater(self.camera('r.zoom'), 5)
        self.assertEqual(self.game('g.selectedCourierId'), 'c0')
        self.assertIsNone(self.game('g.selectedDeliveryId'))
        self.assertIsNone(self.camera('r.focusRegionId'))
        self.page.locator('#fit-map').click()
        self.assertEqual(self.camera('r.zoom'), 1)

    def test_citywide_start_has_three_real_bases_and_local_work(self):
        self.page.locator('#start-region').select_option('citywide')
        self.start('standard')
        self.assertEqual(self.game('g.startRegion'), 'citywide')
        self.assertEqual(self.game('g.couriers.map(c=>g.nodeById(c.nodeId).districtId)'), ['mitte','spandau','koepenick'])
        self.assertGreater(self.game('Math.max(...g.couriers.map(a=>Math.hypot(a.x-g.couriers[0].x,a.y-g.couriers[0].y)))'), 1000)
        self.assertTrue(self.game('g.deliveries.every(d=>g.couriers.some(c=>g.offerMargin(c,d)>0))'))

    def test_saved_shift_survives_reload_and_resumes_paused(self):
        self.start()
        self.page.locator('.quick-call').click()
        self.page.locator('#pause').click()
        expect(self.page.locator('.job-status')).to_contain_text('is on it', timeout=8000)
        self.page.locator('#pause').click()
        before=self.game('({tick:g.tick,seed:g.seed,jobs:g.deliveries.map(d=>[d.id,d.status]),positions:g.couriers.map(c=>[c.x,c.y]),cash:g.cash})')
        expect(self.page.locator('#save-state')).to_contain_text('Saved on this device')
        self.page.reload()
        expect(self.page.locator('#resume-saved')).to_be_visible()
        self.page.locator('#resume-saved').click()
        expect(self.page.locator('#intro')).to_be_hidden()
        after=self.game('({tick:g.tick,seed:g.seed,jobs:g.deliveries.map(d=>[d.id,d.status]),positions:g.couriers.map(c=>[c.x,c.y]),cash:g.cash})')
        self.assertEqual(after,before)
        self.assertTrue(self.game('g.paused'))
        self.assertTrue(self.game('g.actions.at(-1).paused'))
        self.page.locator('#pause').click()
        self.assertFalse(self.game('g.paused'))

    def test_invalid_saved_record_does_not_block_a_fresh_shift(self):
        self.game("(localStorage.setItem('send-it:shift:'+g.cityData.metadata.id,JSON.stringify({city:g.cityData.metadata.id,ticks:2,mode:'training',version:999,review:{outcome:null}})),true)")
        self.page.reload()
        expect(self.page.locator('#resume-saved')).to_be_visible()
        self.page.locator('#resume-saved').click()
        expect(self.page.locator('#resume-note')).to_contain_text('could not be restored')
        self.start()
        self.assertEqual(self.game('g.tick'),0)
        self.assertTrue(self.game('g.paused'))

    def test_client_negotiation_and_rider_outlook_explain_the_tradeoff(self):
        self.start()
        before=self.game('({tick:g.tick,fee:g.deliveries[0].reward,deadline:g.deliveries[0].deadlineAt,positions:g.couriers.map(c=>[c.x,c.y,c.deliveryId])})')
        self.page.locator('#decision-details summary').click()
        expect(self.page.locator('#rider-outlook .outlook-row')).to_have_count(3)
        expect(self.page.locator('#channel-effects')).to_contain_text('Travel time is unchanged')
        expect(self.page.locator('#selected-handling')).to_contain_text('collection')
        self.page.locator('#client-call').click()
        expect(self.page.locator('#client-call')).to_be_disabled()
        expect(self.page.locator('#client-call-detail')).to_contain_text('fee reduced')
        self.assertEqual(self.game('g.deliveries[0].deadlineAt'),before['deadline']+20)
        self.assertLess(self.game('g.deliveries[0].reward'),before['fee'])
        self.assertEqual(self.game('g.couriers.map(c=>[c.x,c.y,c.deliveryId])'),before['positions'])
        self.assertEqual(self.game('g.tick'),before['tick'])

    def test_handoffs_are_visible_and_delivery_receipt_is_readable_while_muted(self):
        self.start()
        self.page.locator('.quick-call').click();self.page.locator('#pause').click()
        expect(self.page.locator('.job-timing')).to_contain_text('Collecting',timeout=15000)
        self.assertTrue(self.game("g.couriers.some(c=>c.phase==='loading')"))
        expect(self.page.locator('.job-timing')).to_contain_text('Handing over',timeout=25000)
        expect(self.page.locator('#delivery-receipt')).to_be_visible(timeout=10000)
        expect(self.page.locator('#receipt-result')).to_contain_text('+€')
        expect(self.page.locator('#sound')).to_have_text('Sound off')
        self.page.locator('#pause').click()
        for width in [390,320]:
            self.page.set_viewport_size({'width':width,'height':844})
            self.page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
            self.assertTrue(self.page.evaluate("()=>{const receipt=document.querySelector('#delivery-receipt').getBoundingClientRect(),guide=document.querySelector('#coach-panel').getBoundingClientRect(),controls=document.querySelector('.map-controls').getBoundingClientRect();return receipt.bottom<=guide.top&&controls.bottom<=receipt.top&&receipt.left>=0&&receipt.right<=innerWidth;}"),'phone receipt must clear its guide and map controls')

    def test_score_preview_mix_volume_and_mute_do_not_change_the_simulation(self):
        self.start()
        before=self.game('({tick:g.tick,positions:g.couriers.map(c=>[c.x,c.y]),cash:g.cash})')
        self.page.locator('#open-sound-studio').click()
        expect(self.page.locator('#sound-dialog')).to_be_visible()
        score=lambda expr:self.page.evaluate("async()=>{const {DeskScore}=await import('/src/playtest-score.js');const s=DeskScore.lastInstance;return ("+expr+");}")
        self.assertIsNone(score('s.ctx'))
        for rider in ['Kira','Mauro','Brian']:
            self.page.locator(f'[data-listen="{rider}"]').click()
            self.assertTrue(score('s.enabled'))
            self.assertGreater(score('s.voices.size'),0)
            self.assertLessEqual(score('s.voices.size'),54)
        for rhythm in range(4):
            self.page.locator(f'[data-rhythm="{rhythm}"]').click()
            self.assertGreater(score('s.voices.size'),0)
            self.assertLessEqual(score('s.voices.size'),54)
        self.page.locator('#task-rhythms').uncheck()
        self.assertFalse(score('s.rhythms'))
        self.assertEqual(score('s.taskVoices.size'),0)
        self.page.locator('#task-rhythms').check()
        self.page.locator('#sound-mix').select_option('events')
        self.assertEqual(score('s.mix'),'events')
        self.page.locator('#sound-volume').press('Home')
        for _ in range(20):self.page.locator('#sound-volume').press('ArrowRight')
        self.assertAlmostEqual(score('s.master.gain.value'),.2,places=5)
        self.page.locator('#studio-toggle').click()
        self.assertFalse(score('s.enabled'));self.assertEqual(score('s.master.gain.value'),0)
        self.assertEqual(score('s.voices.size'),0)
        self.page.locator('#close-sound').click()
        self.assertEqual(self.game('({tick:g.tick,positions:g.couriers.map(c=>[c.x,c.y]),cash:g.cash})'),before)

    def test_live_pressure_uses_the_offer_forecast_and_resolves_after_delivery(self):
        self.start()
        score=lambda expr:self.page.evaluate("async()=>{const {DeskScore}=await import('/src/playtest-score.js');const s=DeskScore.lastInstance;return ("+expr+");}")
        self.game('(g.deliveries[0].deadlineAt=8,true)')
        self.page.locator('#sound').click();self.page.locator('#pause').click()
        self.page.wait_for_function("async()=>{const {DeskScore}=await import('/src/playtest-score.js');return DeskScore.lastInstance.listened[0]?.division==='1/16';}")
        expect(self.page.locator('#listening-now')).to_contain_text('D0 · 1/16')
        self.page.locator('#pause').click();self.page.locator('#client-call').click()
        self.page.locator('.quick-call').click();self.page.locator('#pause').click()
        self.page.wait_for_function("async()=>{const {DeskScore}=await import('/src/playtest-score.js');return DeskScore.lastInstance.listened[0]?.pressure<3;}")
        expect(self.page.locator('.job-status')).to_contain_text('is on it',timeout=8000)
        expect(self.page.locator('#delivery-receipt')).to_be_visible(timeout=25000)
        self.page.locator('#pause').click()
        self.assertFalse(score("s.taskVoices.has('d0')"))
        self.assertGreater(score('s.stats.pulses'),0)
        self.assertLessEqual(score('s.voices.size'),54)
        self.page.locator('#sound').click()
        self.assertEqual(score('s.voices.size'),0)

    def test_official_footprint_tiles_load_with_bounded_cache_and_preserve_game_state(self):
        self.start('standard')
        before=self.game('JSON.stringify(g.exportRun())')
        self.page.locator('.rider-locate').first.click()
        self.page.wait_for_function("async()=>{const {Renderer}=await import('/src/render.js');const d=Renderer.lastInstance.buildingDetails;return d?.cache.size>0&&d.pending.size===0&&d.queue.length===0;}",timeout=30000)
        self.assertGreater(self.camera('r.buildingDetails.cache.size'),0)
        self.assertLessEqual(self.camera('r.buildingDetails.cache.size'),48)
        self.assertEqual(self.camera('r.buildingDetails.index.city'),self.game('g.cityData.metadata.id'))
        expect(self.page.locator('#map-detail-status')).to_contain_text('Official building footprints')
        self.assertEqual(self.game('JSON.stringify(g.exportRun())'),before)

    def test_optional_building_detail_failure_keeps_street_game_playable(self):
        self.context.route('**/berlin-buildings/index.json',lambda route:route.abort())
        self.page.goto(self.base+'/index.html?city=berlin&mode=training&seed=BERLIN-1')
        expect(self.page.locator('#intro')).to_be_visible(timeout=30000)
        self.start()
        while self.camera('r.scale')<2:self.page.locator('#zoom-in').click()
        expect(self.page.locator('#map-detail-status')).to_contain_text('Building detail unavailable',timeout=10000)
        expect(self.page.locator('#fatal-error')).to_be_hidden()
        self.page.locator('.quick-call').click();self.page.locator('#pause').click()
        expect(self.page.locator('#delivery-target')).to_have_text('1 / 5 delivered',timeout=30000)
        self.page.locator('#pause').click()

if __name__ == '__main__':
    desk.REPORTS=desk.ROOT/'reports/browser/city'
    unittest.main(verbosity=2)
