"""Run the shared desk acceptance against the full city, plus city-specific flows."""
import json
import re
import unittest
from pathlib import Path
from playwright.sync_api import expect
import playtest_smoke as desk

class CityAcceptance(desk.PlaytestAcceptance):
    city = 'berlin'
    ruleset = 'berlin-dispatch-v8'
    map_asset = 'berlin-city.json.gz'
    training_target = 6
    training_opening = 2
    standard_opening = 4
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
        self.broadcast()
        self.page.locator('#pause').click()
        self.wait_rider_acceptance()
        self.page.locator('#pause').click()
        before=self.game('({tick:g.tick,seed:g.seed,jobs:g.deliveries.map(d=>[d.id,d.status]),positions:g.couriers.map(c=>[c.x,c.y]),cash:g.cash})')
        expect(self.page.locator('#save-state')).to_contain_text('Saved on this device')
        self.page.reload()
        expect(self.page.locator('#intro')).to_be_visible(timeout=30000)
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
        self.page.locator('#decision-details > summary').click()
        expect(self.page.locator('#rider-outlook .outlook-row')).to_have_count(3)
        self.page.locator('.parcel-details summary').click()
        expect(self.page.locator('#selected-handling')).to_contain_text('collection')
        self.open_offer_options();self.page.locator('#client-call').click()
        expect(self.page.locator('#client-call')).to_be_disabled()
        expect(self.page.locator('#client-call-detail')).to_contain_text('fee reduced')
        self.assertEqual(self.game('g.deliveries[0].deadlineAt'),before['deadline']+20)
        self.assertLess(self.game('g.deliveries[0].reward'),before['fee'])
        self.assertEqual(self.game('g.couriers.map(c=>[c.x,c.y,c.deliveryId])'),before['positions'])
        self.assertEqual(self.game('g.tick'),before['tick'])

    def test_handoffs_are_visible_and_delivery_receipt_is_readable_while_muted(self):
        self.start()
        self.broadcast();self.page.locator('#pause').click()
        expect(self.page.locator('[data-job=d0] .job-status')).to_contain_text('Collecting',timeout=25000)
        self.assertTrue(self.game("g.couriers.some(c=>c.phase==='loading')"))
        expect(self.page.locator('[data-job=d0] .job-status')).to_contain_text('Handing over',timeout=45000)
        expect(self.page.locator('#delivery-receipt')).to_be_visible(timeout=10000)
        expect(self.page.locator('#receipt-result')).to_contain_text('+€')
        expect(self.page.locator('#radio-exchange')).to_have_attribute('data-action', 'complete')
        expect(self.page.locator('#receipt-result')).to_be_hidden()
        expect(self.page.locator('#delivery-receipt .receipt-stamp')).to_be_visible()
        expect(self.page.locator('#sound')).to_have_text('Sound off')
        self.page.locator('#pause').click()
        for width in [390,320]:
            self.page.set_viewport_size({'width':width,'height':844})
            self.page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
            self.assertTrue(self.page.evaluate("()=>{const receipt=document.querySelector('#delivery-receipt').getBoundingClientRect(),controls=document.querySelector('.map-controls').getBoundingClientRect();return !document.querySelector('.city-panel #coach-panel')&&controls.bottom<=receipt.top&&receipt.left>=0&&receipt.right<=innerWidth;}"),'phone receipt must clear map controls, with the guide outside the map')
            self.page.screenshot(path=str(desk.REPORTS / f'radio-completion-{width}.png'), full_page=True)

    def test_score_preview_mix_volume_and_mute_do_not_change_the_simulation(self):
        self.start()
        before=self.game('({tick:g.tick,positions:g.couriers.map(c=>[c.x,c.y]),cash:g.cash})')
        self.page.locator('#desk-menu > summary').click()
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
        self.wait_instance('playtest-score','DeskScore',"instance.listened[0]?.division==='1/16'")
        expect(self.page.locator('#listening-now')).to_contain_text('D0 · 1/16')
        self.page.locator('#pause').click();self.open_offer_options();self.page.locator('#client-call').click()
        self.broadcast();self.page.locator('#pause').click()
        self.wait_instance('playtest-score','DeskScore','instance.listened[0]?.pressure<3')
        self.wait_rider_acceptance()
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
        # Building detail follows pixels per metre; the expanded rider strip
        # leaves less map height, so locating a rider need not cross that gate.
        while self.camera('r.scale') < 2:
            self.page.locator('#zoom-in').click()
        self.wait_instance('render','Renderer','instance.buildingDetails?.cache.size>0&&instance.buildingDetails.pending.size===0&&instance.buildingDetails.queue.length===0')
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
        self.broadcast();self.page.locator('#pause').click()
        expect(self.page.locator('#delivery-target')).to_have_text(f'1 / {self.training_target} delivered',timeout=45000)
        self.page.locator('#pause').click()

    def test_rider_bikes_preferences_endurance_and_capacity_are_visible(self):
        self.start()
        expect(self.page.locator('#team-list svg.bike-icon')).to_have_count(3)
        expect(self.page.locator('#team-list .rider-preferences')).to_have_count(3)
        for width in [1280, 390, 320]:
            with self.subTest(width=width):
                self.page.set_viewport_size({'width': width, 'height': 844})
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width)
                for index in range(3):
                    rider = self.page.locator('#team-list .rider').nth(index)
                    expect(rider.locator('.rider-preferences')).to_be_visible()
                    preference = self.game(f'g.riderProfile(g.couriers[{index}]).preferences')
                    self.assertTrue(preference)
                    expect(rider.locator('.rider-preferences')).to_have_text(preference)
                    expect(rider.locator('.rider-endurance')).to_be_visible()
                    expect(rider.locator('.rider-endurance')).to_contain_text(re.compile(r'\d+\s*/\s*\d+'))
                    expect(rider.locator('.rider-capacity')).to_be_visible()
                    expect(rider.locator('.rider-capacity .metric-value')).to_have_text(re.compile(r'\d+(?:\.\d+)?\s*/\s*\d+(?:\.\d+)?'))
                    expect(rider.locator('.rider-capacity .metric-label')).to_have_text('Load · kg')
                    expect(rider.locator('.rider-accepts')).to_be_visible()
        self.assertTrue(self.game('g.paused'))

    def test_rider_preference_influences_offer_without_assigning_or_moving(self):
        self.start()
        before = self.dispatch_snapshot()
        self.open_offer_options()
        expect(self.page.locator('#preferred-rider')).to_be_visible()
        self.page.locator('#preferred-rider').select_option('c1')
        after = self.dispatch_snapshot()
        self.assertEqual(after['riders'], before['riders'])
        self.assertEqual(after['tick'], before['tick'])
        self.assertEqual(after['rng'], before['rng'])
        self.assertEqual(after['cash'], before['cash'])
        self.assertEqual(after['radio'], 0)
        self.assertEqual(self.game('g.actions.at(-1).type'), 'prefer')
        self.assertEqual(self.game('g.deliveries[0].preferredRiderId'), 'c1')
        self.assertIsNone(self.game('g.deliveries[0].courierId'))
        self.page.locator('[data-radio="open"]').click()
        expect(self.page.locator('#broadcast-preview')).to_be_visible()
        expect(self.page.locator('#forecast-detail')).not_to_be_empty()
        self.assertEqual(self.dispatch_snapshot(), after)
        self.page.locator('[data-radio="open"]').click()
        self.assertEqual(self.game('g.actions.at(-1).type'), 'radio')
        self.assertEqual(self.game('g.radioUsed()'), 1)
        self.assertIsNone(self.game('g.deliveries[0].courierId'))
        self.assertTrue(self.game('g.paused'))

    def test_busier_shift_starts_with_actionable_work_for_the_actual_team(self):
        self.start('standard')
        self.assertEqual(self.game('g.config.target'), 26)
        expect(self.page.locator('.job-select')).to_have_count(self.standard_opening)
        self.assertEqual(self.game('g.couriers.length'), 3)
        self.assertTrue(self.game('g.deliveries.every(d=>g.deliveryFeasibility(d).candidates.some(row=>row.availableNow&&row.margin>0))'))
        self.assertEqual(self.game('g.radioUsed()'), 0)
        self.assertTrue(self.game('g.paused'))

    def test_paused_map_stays_still_with_normal_and_reduced_motion(self):
        self.page.emulate_media(reduced_motion='no-preference')
        self.start()
        self.broadcast(); self.page.locator('#pause').click()
        self.wait_rider_acceptance(timeout=10000)
        self.wait_instance('game','Game',"['pickup','dropoff'].includes(instance.courierById(instance.deliveries[0].courierId)?.phase)")
        self.page.wait_for_timeout(500)
        self.page.locator('#pause').click()
        rider_index = self.game('g.couriers.findIndex(c=>c.id===g.deliveries[0].courierId)')
        self.page.locator('.rider-locate').nth(rider_index).click()
        # Allow requested building tiles and the final layout paint to finish.
        self.wait_instance('render','Renderer',"(()=>{instance.draw();const b=instance.buildingDetails;return instance.scale<2||(b?.state==='ready'&&b.pending.size===0&&b.queue.length===0&&[...b.wanted].every(id=>b.cache.has(id)));})()")
        before = self.game('({tick:g.tick,positions:g.couriers.map(c=>[c.x,c.y,c.phase])})')
        for motion in ['no-preference', 'reduce']:
            with self.subTest(motion=motion):
                self.page.emulate_media(reduced_motion=motion)
                self.page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
                first = self.page.locator('#game-canvas').screenshot()
                self.page.wait_for_timeout(300)
                self.assertEqual(self.page.locator('#game-canvas').screenshot(), first,
                                 'Paused map must not keep cycling or pulsing')
        self.assertEqual(self.game('({tick:g.tick,positions:g.couriers.map(c=>[c.x,c.y,c.phase])})'), before)

    def test_radio_conversation_follows_confirmed_events_and_resets_with_the_shift(self):
        self.start()
        expect(self.page.locator('#radio-exchange')).to_be_hidden()
        before = self.dispatch_snapshot()
        log_before = self.game('g.dispatchLog')
        self.page.locator('[data-radio="open"]').click()
        expect(self.page.locator('#broadcast-preview')).to_be_visible()
        expect(self.page.locator('#radio-exchange')).to_be_hidden()
        self.assertEqual(self.dispatch_snapshot(), before)
        self.assertEqual(self.game('g.dispatchLog'), log_before)
        self.page.locator('[data-radio="open"]').click()
        expect(self.page.locator('#radio-exchange')).to_have_attribute('data-action', 'call')
        expect(self.page.locator('#radio-lines [data-speaker="dispatcher"]')).to_contain_text('You · dispatch')
        expect(self.page.locator('#radio-job')).to_have_text('D0')
        self.assertIsNone(self.game('g.deliveries[0].courierId'))
        self.page.locator('#pause').click()
        expect(self.page.locator('#radio-exchange')).to_have_attribute('data-action', 'claim', timeout=10000)
        rider = self.game('g.courierById(g.deliveries[0].courierId).name')
        expect(self.page.locator('#radio-lines [data-speaker="rider"]')).to_contain_text(rider)
        self.page.locator('#pause').click()
        for width, height in [(1280, 720), (390, 844), (320, 568)]:
            with self.subTest(width=width):
                self.page.set_viewport_size({'width': width, 'height': height})
                self.page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width)
                self.assertTrue(self.page.locator('#radio-exchange').evaluate('el=>{const b=el.getBoundingClientRect(),m=document.querySelector("#game-canvas").getBoundingClientRect();return b.left>=m.left&&b.right<=m.right&&b.top>=m.top&&b.bottom<=m.bottom;}'))
                self.page.screenshot(path=str(desk.REPORTS / f'radio-conversation-{width}.png'), full_page=True)
        self.page.set_viewport_size({'width':1280,'height':720})
        self.page.locator('#desk-menu > summary').click()
        self.page.locator('#open-radio-log').click()
        expect(self.page.locator('#radio-log-dialog')).to_be_visible()
        expect(self.page.locator('#radio-history [data-action="call"]')).to_have_count(1)
        expect(self.page.locator('#radio-history [data-action="claim"] [data-speaker="rider"]')).to_contain_text(rider)
        self.assertTrue(self.game('g.paused'))
        self.page.locator('#close-radio-log').click()
        self.page.locator('#desk-menu > summary').click()
        self.page.locator('#new-shift').click()
        self.start()
        expect(self.page.locator('#radio-exchange')).to_be_hidden()
        self.page.locator('#desk-menu > summary').click()
        self.page.locator('#open-radio-log').click()
        expect(self.page.locator('#radio-history [data-action="call"]')).to_have_count(0)
        expect(self.page.locator('#radio-history [data-action="claim"]')).to_have_count(0)
        self.assertEqual(self.game('g.tick'), 0)

    def test_radio_reports_new_calls_when_the_dispatch_log_rolls_over(self):
        self.start()
        # This is the production log cap, reached without changing demand or time.
        self.game('(()=>{for(let i=0;i<300;i++)g.logDispatch("phase",null,{phase:"opening"});return g.dispatchLog.length;})()')
        self.page.wait_for_timeout(250)
        self.assertEqual(self.game('g.dispatchLog.length'), 300)
        self.assertEqual(self.game('g.dispatchLog.filter(e=>e.action==="call").length'), 0)
        expect(self.page.locator('#radio-exchange')).to_be_hidden()
        self.broadcast()
        self.assertEqual(self.game('g.dispatchLog.length'), 300)
        self.assertEqual(self.game('g.dispatchLog.at(-1).action'), 'call')
        expect(self.page.locator('#radio-exchange')).to_have_attribute('data-action', 'call')
        expect(self.page.locator('#radio-lines [data-speaker="dispatcher"]')).to_contain_text('D0')
        self.page.locator('#desk-menu > summary').click()
        self.page.locator('#open-radio-log').click()
        expect(self.page.locator('#radio-history [data-action="call"]')).to_have_count(1)

if __name__ == '__main__':
    desk.REPORTS=desk.ROOT/'reports/browser/city'
    unittest.main(verbosity=2)
