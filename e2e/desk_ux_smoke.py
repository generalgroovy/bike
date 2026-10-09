"""Compact desk acceptance: usable space and navigation, without changing play.

Synthetic states below prepare queue composition or a departure warning. All
selection, filtering, inspection and offer confirmation use production controls.
"""
import json
import re
import unittest

from playwright.sync_api import expect
import playtest_smoke as desk


class DeskUXAcceptance(unittest.TestCase):
    city = 'berlin'
    setUpClass = classmethod(desk.PlaytestAcceptance.setUpClass.__func__)
    tearDownClass = classmethod(desk.PlaytestAcceptance.tearDownClass.__func__)
    setUp = desk.PlaytestAcceptance.setUp
    tearDown = desk.PlaytestAcceptance.tearDown
    network_guard = desk.PlaytestAcceptance.network_guard
    game = desk.PlaytestAcceptance.game
    start = desk.PlaytestAcceptance.start
    wait_instance = desk.PlaytestAcceptance.wait_instance
    open_offer_options = desk.PlaytestAcceptance.open_offer_options

    def render_tick(self):
        self.page.wait_for_timeout(180)

    def snapshot(self):
        # Camera rendering may update route cache diagnostics. Pure desk views
        # must preserve the complete run, jobs, rider state and decision RNG.
        return self.game('''({tick:g.tick,elapsed:g.elapsed,rng:g.rng,cash:g.cash,
            radio:g.radioUsed(),record:g.exportRun(),riders:g.couriers,
            jobs:g.deliveries,log:g.dispatchLog,
            stats:Object.fromEntries(Object.entries(g.runStats).filter(([key])=>
                !['routeCacheHits','routeCacheMisses'].includes(key)))})''')

    def assert_unclipped(self, locator):
        for box in locator.evaluate_all('''els=>els.filter(el=>el.getClientRects().length).map(el=>({
            selector:el.id||el.className,text:el.textContent,
            left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,
            clipped:el.scrollWidth>el.clientWidth+1}))'''):
            self.assertGreaterEqual(box['left'], -1, box)
            self.assertLessEqual(box['right'], self.page.viewport_size['width']+1, box)
            self.assertFalse(box['clipped'], box)

    def test_desktop_gives_map_space_and_four_jobs_without_hiding_rider_resources(self):
        self.start('standard')
        # A quiet opening should not spend queue space repeating generic advice.
        self.game('''(()=>{for(const d of g.deliveries){d.deadlineAt=240;d.deliverAfter=0;}return true;})()''')
        self.render_tick()
        expect(self.page.locator('#desk-focus')).to_be_hidden()
        expect(self.page.locator('.job-card:visible')).to_have_count(4)
        measurements = []
        for width, height in [(1280, 720), (1024, 768), (1440, 900)]:
            with self.subTest(width=width):
                self.page.set_viewport_size({'width':width, 'height':height})
                self.render_tick()
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width)
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollHeight'), height+1)
                geometry = self.page.evaluate('''()=>{
                    const rect=sel=>{const r=document.querySelector(sel).getBoundingClientRect();
                        return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
                    const queue=document.querySelector('#work-list').getBoundingClientRect();
                    return {map:rect('.map-surface'),toolbar:rect('.desk-toolbar'),team:rect('.team-section'),
                        jobs:[...document.querySelectorAll('.job-card:not([hidden])')].map(el=>{
                            const r=el.getBoundingClientRect();return {height:r.height,bottom:r.bottom,
                                fullyVisible:r.top>=queue.top-1&&r.bottom<=Math.min(innerHeight,queue.bottom)+1};})};
                }''')
                measurements.append({'width':width, 'height':height, **geometry})
                (desk.REPORTS/'desktop-geometry.json').write_text(json.dumps(measurements,indent=2),encoding='utf-8')
                self.page.screenshot(path=str(desk.REPORTS/f'desk-{width}.png'), full_page=True)
                self.assertGreaterEqual(geometry['map']['width'], width*.4)
                self.assertGreaterEqual(geometry['map']['height'], 300)
                self.assertLessEqual(geometry['toolbar']['bottom'], 105)
                self.assertLessEqual(geometry['team']['bottom'], height+1)
                self.assertGreaterEqual(sum(job['fullyVisible'] for job in geometry['jobs']), 4)
                for index in range(3):
                    rider=self.page.locator('.rider').nth(index)
                    rider.evaluate("el=>el.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'})")
                    self.render_tick()
                    self.assert_unclipped(rider.locator('.rider-preferences, .rider-accepts, .rider-endurance, .rider-capacity, .rider-satisfaction, .rider-waiting'))
                    strip=self.page.locator('#team-list').bounding_box()
                    card=rider.bounding_box()
                    self.assertGreaterEqual(card['x'],strip['x']-1)
                    self.assertLessEqual(card['x']+card['width'],strip['x']+strip['width']+1)
                self.page.locator('.rider').first.evaluate("el=>el.scrollIntoView({block:'nearest',inline:'start',behavior:'instant'})")
                radio = self.page.locator('[data-radio=priority]').bounding_box()
                self.assertLessEqual(radio['y']+radio['height'], height)
                self.page.screenshot(path=str(desk.REPORTS/f'desk-{width}.png'), full_page=True)
        # Wider real resource values must fit, not only the initial empty bike.
        self.game('''(()=>{const c=g.couriers[2],d=g.deliveries.find(job=>
            g.offerConsequences(c,{...job,weightKg:12.5,called:true,channel:'open'}).feasible);
            if(!d)throw Error('No nearby cargo fixture was available');d.weightKg=12.5;
            g.dispatch({type:'radio',jobId:d.id,channel:'open'});
            if(!g.claim(c,d))throw Error('Cargo fixture could not be accepted');
            g.paused=false;for(let i=0;i<2000&&!d.pickedUp;i++)g.update(1/60);g.paused=true;
            if(!d.pickedUp)throw Error('Cargo fixture did not reach the real pickup');return true;})()''')
        self.render_tick()
        cargo=self.page.locator('.rider[data-rider=c2]')
        expect(cargo.locator('.rider-capacity')).to_contain_text('12.5 / 30 kg')
        for width,height in [(1280,720),(1024,768)]:
            self.page.set_viewport_size({'width':width,'height':height});self.render_tick()
            cargo.evaluate("el=>el.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'})")
            self.render_tick()
            self.page.screenshot(path=str(desk.REPORTS/f'desk-loaded-{width}.png'),full_page=True)
            self.assert_unclipped(cargo.locator('.rider-capacity,.rider-capacity .metric-value,.rider-endurance,.rider-satisfaction'))
            for metric in cargo.locator('.rider-resources .metric-value').evaluate_all('''els=>els.map(el=>{
                const range=document.createRange();range.selectNodeContents(el);
                const glyphs=range.getBoundingClientRect(),cell=el.closest('label,button').getBoundingClientRect();
                return {text:el.textContent,left:glyphs.left,right:glyphs.right,cellLeft:cell.left,cellRight:cell.right};})'''):
                self.assertGreaterEqual(metric['left'],metric['cellLeft']-1,metric)
                self.assertLessEqual(metric['right'],metric['cellRight']+1,
                    f'Resource text must not overlap its neighbour: {metric}')

    def test_queue_filters_are_pure_and_show_only_current_jobs(self):
        self.start('standard')
        # Deliberately mixed current/completed work exercises visibility. It does
        # not pretend these fixture status edits are real deliveries or a replay.
        self.game('''(()=>{const d=g.deliveries[0];g.dispatch({type:'radio',jobId:d.id,channel:'open'});
            if(!g.claim(g.couriers[0],d))throw Error('Fixture rider could not accept the opening parcel');
            g.deliveries[1].status='completed';return true;})()''')
        self.render_tick()
        before = self.snapshot()
        for filter_name, expected in [('waiting', ['d2','d3']), ('claimed',['d0']), ('all',['d0','d2','d3'])]:
            button = self.page.locator(f'[data-queue-filter={filter_name}]')
            button.focus();self.page.keyboard.press('Enter')
            expect(button).to_have_attribute('aria-pressed','true')
            actual = self.page.locator('.job-card:visible').evaluate_all('els=>els.map(el=>el.dataset.job)')
            self.assertCountEqual(actual, expected)
            expect(self.page.locator('[data-job=d1]')).to_have_count(0)
            self.assertEqual(self.snapshot(), before)
        self.page.locator('[data-queue-filter=waiting]').click()
        # New-shift entry must reset a view filter and old cards/history together.
        self.page.locator('#desk-menu > summary').click()
        self.page.locator('#new-shift').click()
        self.start('training')
        expect(self.page.locator('[data-queue-filter=all]')).to_have_attribute('aria-pressed','true')
        expect(self.page.locator('.job-card:visible')).to_have_count(2)
        self.assertTrue(self.game('g.deliveries.every(d=>d.status==="waiting")'))

    def test_folded_offer_options_reveal_actual_tradeoffs_and_keyboard_preview_stays_pure(self):
        self.start()
        options = self.page.locator('#offer-options')
        self.assertFalse(options.evaluate('el=>el.open'))
        expect(options.locator('summary')).to_contain_text('Invite')
        expect(self.page.locator('#preferred-rider')).to_be_hidden()
        before = self.snapshot()
        options.locator('summary').focus();self.page.keyboard.press('Enter')
        expect(self.page.locator('#preferred-rider')).to_be_visible()
        expect(self.page.locator('#bonus')).to_be_visible()
        expect(self.page.locator('#bonus-explanation')).to_contain_text('€5')
        expect(self.page.locator('#client-call')).to_be_visible()
        expect(self.page.locator('#client-call-detail')).to_contain_text(re.compile('fee', re.I))
        self.assertEqual(self.snapshot(), before)
        options.locator('summary').click()
        button = self.page.locator('[data-radio=open]')
        button.focus();self.page.keyboard.press('Space')
        expect(self.page.locator('#broadcast-preview')).to_be_visible()
        expect(self.page.locator('#forecast-consequences')).to_be_visible()
        for field in ['margin','endurance','load','tour']:
            expect(self.page.locator(f'#forecast-consequences [data-impact={field}]')).not_to_be_empty()
        self.assertEqual(self.snapshot(), before)
        self.page.screenshot(path=str(desk.REPORTS/'desk-preview-1280.png'),full_page=True)
        self.page.keyboard.press('Enter')
        self.assertEqual(self.game('g.radioUsed()'), 1)
        self.assertEqual(self.game('g.actions'), [{'tick':0,'type':'radio','jobId':'d0','channel':'open'}])
        self.assertIsNone(self.game('g.deliveries[0].courierId'))
        self.assertTrue(self.game('g.couriers.every(c=>c.phase==="idle")'))

    def test_mobile_shortcuts_and_job_selection_reach_controls_without_changing_play(self):
        self.start()
        before = self.snapshot()
        for width, height in [(390,844),(320,568)]:
            with self.subTest(width=width):
                self.page.set_viewport_size({'width':width,'height':height})
                self.render_tick()
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
                nav = self.page.locator('.mobile-desk-nav')
                expect(nav).to_be_visible()
                self.assert_unclipped(nav.locator('a'))
                for anchor in ['#team-title','#work-title','#contract-title','#game-canvas']:
                    link = nav.locator(f'a[href="{anchor}"]')
                    link.click();self.render_tick()
                    target = self.page.locator(anchor).bounding_box()
                    toolbar = self.page.locator('.desk-toolbar').bounding_box()
                    nav_box = nav.bounding_box()
                    self.assertGreaterEqual(target['y'],toolbar['y']+toolbar['height']-2,anchor)
                    self.assertLess(target['y'],nav_box['y'],anchor)
                    expect(link).to_have_attribute('aria-current','location')
                nav.locator('a[href="#work-title"]').click()
                self.page.locator('.job-select').first.click()
                expect(self.page.locator('#contract-title')).to_be_focused()
                button = self.page.locator('[data-radio=open]')
                button.focus();self.page.keyboard.press('Space')
                expect(self.page.locator('#broadcast-preview')).to_be_visible()
                expect(nav.locator('a[href="#contract-title"]')).to_have_attribute('aria-current','location')
                self.assert_unclipped(self.page.locator('#broadcast-preview,[data-radio],#forecast-consequences [data-impact]'))
                self.page.screenshot(path=str(desk.REPORTS/f'desk-preview-{width}.png'),full_page=True)
                self.page.screenshot(path=str(desk.REPORTS/f'desk-preview-viewport-{width}.png'))
                forecast=self.page.locator('#forecast-rider').bounding_box()
                channels=self.page.locator('.radio-choices').bounding_box()
                self.assertGreaterEqual(forecast['y'],channels['y']+channels['height'],
                    'Sticky broadcast controls must not cover the likely volunteer identity')
                self.assertLessEqual(forecast['y']+forecast['height'],nav.bounding_box()['y'])
                self.page.locator('#cancel-preview').click()
                self.open_offer_options()
                self.page.locator('#offer-options > summary').focus()
                for selector in ['#preferred-rider','#bonus','#client-call']:
                    control = self.page.locator(selector)
                    self.page.keyboard.press('Tab')
                    expect(control).to_be_focused()
                    expect(control).to_be_visible()
                    box=control.bounding_box();nav_box=nav.bounding_box()
                    toolbar=self.page.locator('.desk-toolbar').bounding_box()
                    self.assertGreaterEqual(box['height'],44,selector)
                    self.assertGreaterEqual(box['y'],toolbar['y']+toolbar['height']-1,selector)
                    self.assertLessEqual(box['y']+box['height'],nav_box['y']+1,selector)
                self.page.locator('#offer-options > summary').click()
                self.page.screenshot(path=str(desk.REPORTS/f'desk-mobile-{width}.png'), full_page=True)
                self.assertEqual(self.snapshot(), before)

    def test_departure_warning_survives_filters_and_compact_rider_cards(self):
        self.start('standard')
        self.game('''(()=>{const c=g.couriers[0],w=g.riderWellbeing(c);
            c.wellbeing.satisfaction=24;c.wellbeing.idleSeconds=w.graceSeconds+1;
            c.wellbeing.warningRemaining=null;g.paused=false;g.update(1/60);g.paused=true;return true;})()''')
        self.render_tick()
        self.page.locator('[data-queue-filter=claimed]').click()
        expect(self.page.locator('.job-card:visible')).to_have_count(0)
        expect(self.page.locator('#queue-filter-empty')).to_be_visible()
        alert = self.page.locator('#desk-focus')
        expect(alert).to_be_visible()
        expect(alert).to_have_attribute('data-tone','urgent')
        rider = self.page.locator('.rider[data-rider=c0]')
        expect(rider.locator('.rider-retention')).to_be_visible()
        expect(rider).to_have_attribute('data-wellbeing','at-risk')
        before = self.snapshot()
        for width,height in [(1280,720),(390,844),(320,568)]:
            self.page.set_viewport_size({'width':width,'height':height});self.render_tick()
            alert.scroll_into_view_if_needed()
            self.assertTrue(alert.evaluate('el=>el.scrollHeight<=el.clientHeight+1'))
            rider.evaluate("el=>el.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'})")
            self.assert_unclipped(rider.locator('.rider-retention,.rider-satisfaction,.rider-waiting'))
            self.assertEqual(self.snapshot(),before)
        self.page.screenshot(path=str(desk.REPORTS/'desk-departure-warning.png'),full_page=True)


if __name__ == '__main__':
    desk.REPORTS = desk.ROOT/'reports/browser/desk-ux'
    unittest.main(verbosity=2)
