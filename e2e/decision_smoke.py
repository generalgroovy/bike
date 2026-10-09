"""Focused browser acceptance for readable, read-only dispatch consequences.

Run with the same Python + Playwright installation as city_smoke.py. Fixtures
prepare paused situations; the actual preview/confirmation always uses the UI.
"""
import math
import unittest

from playwright.sync_api import expect
import playtest_smoke as desk


class DecisionAcceptance(unittest.TestCase):
    city = 'berlin'
    # Reuse the local/offline server and error guard without inheriting the older
    # acceptance tests and running the complete city suite a second time.
    setUpClass = classmethod(desk.PlaytestAcceptance.setUpClass.__func__)
    tearDownClass = classmethod(desk.PlaytestAcceptance.tearDownClass.__func__)
    setUp = desk.PlaytestAcceptance.setUp
    tearDown = desk.PlaytestAcceptance.tearDown
    network_guard = desk.PlaytestAcceptance.network_guard
    game = desk.PlaytestAcceptance.game
    start = desk.PlaytestAcceptance.start
    wait_instance = desk.PlaytestAcceptance.wait_instance

    def snapshot(self):
        # The map renderer asks routeBetween for display paths while paused and
        # increments only these two diagnostic counters. Forecast purity at the
        # model layer (without that renderer) is tested separately and strictly.
        return self.game('''({tick:g.tick,elapsed:g.elapsed,rng:g.rng,cash:g.cash,
            radio:g.radioUsed(),record:g.exportRun(),riders:g.couriers,
            jobs:g.deliveries,
            stats:Object.fromEntries(Object.entries(g.runStats).filter(([key])=>!['routeCacheHits','routeCacheMisses'].includes(key))),
            log:g.dispatchLog})''')

    def render_tick(self):
        self.page.evaluate('()=>new Promise(resolve=>setTimeout(resolve,180))')

    def select_job(self, job_id):
        # Selection is presentation state, and intentionally excluded from the
        # snapshot. Use the existing queue button rather than dispatching work.
        self.page.locator(f'.job-select').filter(has_text=job_id.upper()).first.click()

    def preview(self, channel='open'):
        self.page.locator(f'[data-radio="{channel}"]').click()
        expect(self.page.locator('#broadcast-preview')).to_be_visible()

    @staticmethod
    def clock(value):
        value = max(0, math.ceil(value))
        return f'{value // 60}:{value % 60:02d}'

    def assert_impact(self, impact, selector='#forecast-consequences'):
        self.assertTrue(impact['feasible'])
        panel = self.page.locator(selector)
        energy, load = impact['endurance'], impact['load']
        expect(panel.locator('[data-impact="margin"]')).to_contain_text(f"{self.clock(impact['margin'])} spare")
        expect(panel.locator('[data-impact="endurance"]')).to_contain_text(f"{energy['current']} → {energy['projected']} / {energy['max']}")
        expect(panel.locator('[data-impact="load"]')).to_contain_text(f"{load['currentKg']:g} → {load['peakKg']:g} / {load['capacityKg']:g} kg")
        if impact['baselineTourSeconds'] > 0:
            expect(panel.locator('[data-impact="tour"]')).to_contain_text('+' + self.clock(impact['addedTourSeconds']))
        else:
            expect(panel.locator('[data-impact="tour"]')).to_contain_text(self.clock(impact['tourSeconds']) + ' total')

    def forecast_impact(self, job_id='d0', channel='open'):
        return self.game(f'''(()=>{{const d=g.deliveryById('{job_id}'), f=g.broadcastForecast(d,'{channel}');
            return g.offerConsequences(f.rider,{{...d,called:true,channel:'{channel}'}});}})()''')

    def test_preview_is_read_only_and_keyboard_confirmation_keeps_riders_free(self):
        self.start()
        before = self.snapshot()
        button = self.page.locator('[data-radio="open"]')
        button.focus()
        self.page.keyboard.press('Space')
        expect(self.page.locator('#broadcast-preview')).to_be_visible()
        expect(self.page.locator('#forecast-confirm')).to_contain_text('Riders still choose')
        self.assertEqual(self.snapshot(), before)
        self.page.keyboard.press('Enter')
        self.assertEqual(self.game('g.radioUsed()'), 1)
        self.assertEqual(self.game('g.actions'), [{'tick': 0, 'type': 'radio', 'jobId': 'd0', 'channel': 'open'}])
        self.assertEqual(self.game('g.rng'), before['rng'])
        self.assertTrue(self.game('g.couriers.every(c=>c.phase==="idle"&&!c.deliveryId&&c.stops.length===0)'))
        self.assertIsNone(self.game('g.deliveries[0].courierId'))

    def test_route_preview_fits_phone_and_desktop_and_matches_the_projection(self):
        self.start()
        before = self.snapshot()
        self.preview()
        impact = self.forecast_impact()
        self.assert_impact(impact)
        route = self.page.locator('#forecast-route')
        self.assertFalse(route.evaluate('(el)=>el.open'), 'Detailed itinerary should start folded')
        route.locator('summary').click()
        stops = route.locator('.itinerary-stops li')
        expect(stops).to_have_count(len(impact['itinerary']))
        for index, stop in enumerate(impact['itinerary']):
            expect(stops.nth(index)).to_have_attribute('data-job', stop['jobId'])
            expect(stops.nth(index)).to_have_attribute('data-kind', stop['kind'])
        for width in [1280, 1440, 390, 320]:
            with self.subTest(width=width):
                self.page.set_viewport_size({'width': width, 'height': 900 if width > 500 else 844})
                self.render_tick()
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width)
                geometry = self.page.locator('#broadcast-preview, #desk-focus, [data-radio], #forecast-consequences [data-impact]').evaluate_all('''els=>els.map(el=>({
                    selector:el.id||el.dataset.impact||el.dataset.radio,
                    left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,
                    clipped:el.scrollWidth>el.clientWidth+1}))''')
                for box in geometry:
                    self.assertGreaterEqual(box['left'], -1, box)
                    self.assertLessEqual(box['right'], width + 1, box)
                    self.assertFalse(box['clipped'], box)
                self.page.screenshot(path=str(desk.REPORTS / f'decision-preview-{width}.png'), full_page=True)
        self.assertEqual(self.snapshot(), before)

    def test_compare_all_riders_explains_differences_without_inviting_anyone(self):
        self.start()
        before = self.snapshot()
        self.page.locator('#decision-details > summary').click()
        choices = self.page.locator('.inspect-rider')
        expect(choices).to_have_count(3)
        for rider_id in ['c0', 'c1', 'c2']:
            button = self.page.locator(f'.inspect-rider[data-rider="{rider_id}"]')
            button.click()
            expect(button).to_have_attribute('aria-pressed', 'true')
            name = self.game(f"g.courierById('{rider_id}').name")
            expect(self.page.locator('#comparison-rider')).to_contain_text(name)
            impact = self.game(f"g.offerConsequences(g.courierById('{rider_id}'),{{...g.deliveries[0],called:true,channel:'open'}})")
            self.assert_impact(impact, '#comparison-consequences')
            self.assertIsNone(self.game('g.deliveries[0].preferredRiderId'))
            self.assertEqual(self.snapshot(), before)

    def test_second_job_preview_explains_load_and_waiting_for_a_delivery_window(self):
        self.start()
        extra = self.game('''(()=>{const c=g.couriers[0],d=g.deliveries[0];
            d.deliverAfter=70;d.deadlineAt=125;
            for(const other of g.couriers.slice(1))other.radioOn=false;
            g.dispatch({type:'radio',jobId:d.id,channel:'open'});
            if(!g.claim(c,d))throw Error('Fixture first job could not be claimed');
            g.paused=false;for(let i=0;i<120;i++)g.update(1/60);g.paused=true;
            if(!d.pickedUp)throw Error('Fixture must have collected its first parcel');
            if(!g.spawnDelivery({pickupId:d.pickupId,dropoffId:d.dropoffId,typeKey:'document',weightKg:1}))throw Error('Fixture second job unavailable');
            return g.deliveries.at(-1).id;})()''')
        self.render_tick()
        self.select_job(extra)
        before = self.snapshot()
        self.preview()
        impact = self.forecast_impact(extra)
        self.assert_impact(impact)
        self.assertEqual(impact['load']['currentKg'], .5)
        self.assertEqual(impact['load']['peakKg'], 1.5)
        self.assertEqual(len(impact['commitments']), 1)
        self.assertLess(abs(impact['commitments'][0]['delaySeconds']), 1)
        self.assertTrue(any(stop['waitSeconds'] > 0 for stop in impact['itinerary']))
        expect(self.page.locator('#forecast-consequences .commitment-impact')).to_contain_text('Existing deliveries keep their timing')
        self.page.locator('#forecast-route summary').click()
        stops = self.page.locator('#forecast-route .itinerary-stops li')
        expect(stops).to_have_count(len(impact['itinerary']))
        waiting_index = next(i for i, stop in enumerate(impact['itinerary']) if stop['waitSeconds'] > 0)
        expect(stops.nth(waiting_index)).to_contain_text('Wait')
        self.assertEqual(self.snapshot(), before)
        self.page.locator('[data-radio="open"]').click()
        self.assertTrue(self.game(f"g.deliveryById('{extra}').called"))
        self.assertIsNone(self.game(f"g.deliveryById('{extra}').courierId"))
        self.assertEqual(self.game('g.riderJobs(g.couriers[0]).length'), 1)
        self.game('''(()=>{g.paused=false;for(let i=0;i<180;i++)g.update(1/60);g.paused=true;return true;})()''')
        self.render_tick()
        self.assertEqual(self.game('g.riderJobs(g.couriers[0]).length'), 2)
        accepted = self.page.locator('#accepted-tour')
        expect(accepted).to_be_visible()
        self.assertFalse(accepted.evaluate('(el)=>el.open'))
        accepted.locator('summary').click()
        tour = self.game('g.riderTour(g.couriers[0])')
        remaining_stops = accepted.locator('.itinerary-stops li')
        expect(remaining_stops).to_have_count(len(tour['itinerary']))
        for index, stop in enumerate(tour['itinerary']):
            expect(remaining_stops.nth(index)).to_have_attribute('data-job', stop['jobId'])
            expect(remaining_stops.nth(index)).to_have_attribute('data-kind', stop['kind'])
        current = self.snapshot()
        accepted.locator('summary').click()
        self.assertEqual(self.snapshot(), current, 'Inspecting the accepted tour must not reroute the rider')

    def test_context_cue_selects_a_tight_job_without_spending_or_broadcasting(self):
        self.start()
        self.game('''(()=>{const d=g.deliveries[0],best=g.deliveryFeasibility(d).best;
            d.deadlineAt=g.elapsed+best.finishIn+9;return true;})()''')
        self.render_tick()
        focus = self.page.locator('#desk-focus')
        expect(focus).to_have_attribute('data-tone', 'urgent')
        expect(self.page.locator('#focus-title')).to_contain_text('estimated buffer')
        expect(self.page.locator('#focus-detail')).to_contain_text('client call')
        before = self.snapshot()
        focus.click()
        expect(self.page.locator('#contract-title')).to_have_text('Job D0')
        self.assertEqual(self.snapshot(), before)
        self.assertFalse(self.game('g.deliveries[0].called'))

    def test_new_rider_commitment_requires_review_before_broadcasting(self):
        self.start()
        self.game('''(()=>{const d=g.deliveries[0];d.deliverAfter=70;d.deadlineAt=125;
            for(const c of g.couriers.slice(1))c.radioOn=false;return true;})()''')
        self.render_tick()
        self.preview()
        leader = self.game('g.broadcastForecast(g.deliveries[0]).rider.id')
        self.game('''(()=>{const d=g.deliveries[0],c=g.couriers[0];
            if(!g.spawnDelivery({pickupId:d.pickupId,dropoffId:d.dropoffId,typeKey:'document',weightKg:1}))throw Error('Fixture second job unavailable');
            const extra=g.deliveries.at(-1);g.dispatch({type:'radio',jobId:extra.id,channel:'open'});
            if(!g.claim(c,extra))throw Error('Fixture could not accept another commitment');
            g.selectedDeliveryId=d.id;return true;})()''')
        self.render_tick()
        self.assertEqual(self.game('g.broadcastForecast(g.deliveries[0]).rider.id'), leader)
        expect(self.page.locator('#broadcast-preview')).to_have_attribute('data-changed', 'true')
        expect(self.page.locator('#forecast-confirm')).to_contain_text('outlook changed')
        before = self.snapshot()
        self.page.locator('[data-radio="open"]').click()
        self.assertEqual(self.snapshot(), before, 'A changed tour must be reviewed before any call is sent')
        self.assertFalse(self.game('g.deliveries[0].called'))
        self.page.locator('[data-radio="open"]').click()
        self.assertTrue(self.game('g.deliveries[0].called'))


if __name__ == '__main__':
    desk.REPORTS = desk.ROOT / 'reports/browser/decisions'
    unittest.main(verbosity=2)
