"""Acceptance for visible rider wellbeing and its actual dispatch consequences.

Fixtures shorten long waiting periods; departures and recovery still pass through
the production update/offer flow. The saved-run case uses only recorded actions.
"""
import unittest

from playwright.sync_api import expect
import playtest_smoke as desk


class WellbeingAcceptance(unittest.TestCase):
    city = 'berlin'
    setUpClass = classmethod(desk.PlaytestAcceptance.setUpClass.__func__)
    tearDownClass = classmethod(desk.PlaytestAcceptance.tearDownClass.__func__)
    setUp = desk.PlaytestAcceptance.setUp
    tearDown = desk.PlaytestAcceptance.tearDown
    network_guard = desk.PlaytestAcceptance.network_guard
    game = desk.PlaytestAcceptance.game
    start = desk.PlaytestAcceptance.start
    wait_instance = desk.PlaytestAcceptance.wait_instance
    broadcast = desk.PlaytestAcceptance.broadcast
    open_offer_options = desk.PlaytestAcceptance.open_offer_options

    def render_tick(self):
        self.page.evaluate('()=>new Promise(resolve=>setTimeout(resolve,180))')

    def wellbeing(self, rider_id='c0'):
        return self.game(f"g.riderWellbeing(g.courierById('{rider_id}'))")

    def snapshot(self):
        return self.game('''({tick:g.tick,elapsed:g.elapsed,rng:g.rng,cash:g.cash,
            wellbeing:g.couriers.map(c=>({id:c.id,state:c.wellbeing,offDuty:c.offDuty,
                view:g.riderWellbeing(c)})),record:g.exportRun()})''')

    def advance_fixture(self, seconds):
        # Only used by explicitly synthetic warning fixtures, never save/replay.
        self.game(f'''(()=>{{g.paused=false;for(let i=0;i<{round(seconds*60)};i++)g.update(1/60);
            g.paused=true;return g.elapsed;}})()''')
        self.render_tick()

    def waiting_warning(self):
        self.game('''(()=>{const c=g.couriers[0],w=g.riderWellbeing(c);
            c.wellbeing.satisfaction=24;c.wellbeing.idleSeconds=w.graceSeconds+1;
            c.wellbeing.warningRemaining=null;return true;})()''')
        self.advance_fixture(1/60)
        self.assertIsNotNone(self.wellbeing()['leaveIn'])

    def test_cards_distinguish_first_tour_waiting_and_show_ranges_without_advancing_time(self):
        self.start()
        self.assertTrue(self.game('g.wellbeing'))
        for index in range(3):
            rider = self.page.locator(f'.rider[data-rider="c{index}"]')
            value = self.wellbeing(f'c{index}')
            expect(rider.locator('.rider-satisfaction')).to_contain_text(f"{value['satisfaction']} / {value['max']}")
            expect(rider.locator('.rider-waiting')).to_contain_text('Waiting for first tour')
            expect(rider).to_have_attribute('data-wellbeing', 'content')
            self.assertIsNone(value['lastTourAgo'])
        before = self.snapshot()
        self.page.locator('.wellbeing-toggle').first.focus()
        self.page.keyboard.press('Enter')
        dialog = self.page.locator('#rider-wellbeing-dialog')
        expect(dialog).to_be_visible()
        for boundary in ['70', '45', '25']:
            expect(dialog).to_contain_text(boundary)
        expect(dialog.locator('.wellbeing-detail')).not_to_be_empty()
        self.page.locator('#close-rider-wellbeing').click()
        inspected = self.snapshot()
        self.assertEqual({k:v for k,v in inspected.items() if k!='record'},
                         {k:v for k,v in before.items() if k!='record'})
        self.assertTrue(all(action['type']=='pause' and action['paused']
                            for action in inspected['record']['actions'][len(before['record']['actions']):]))
        self.advance_fixture(6)
        value = self.wellbeing()
        self.assertAlmostEqual(value['idleSeconds'], 6, places=4)
        self.assertIsNone(value['lastTourAgo'])
        expect(self.page.locator('.rider[data-rider=c0] .rider-waiting')).to_contain_text('0:06')
        paused = self.snapshot()
        self.game('(()=>{for(let i=0;i<600;i++)g.update(1/60);return true;})()')
        self.render_tick()
        self.assertEqual(self.snapshot(), paused, 'Paused inspection must freeze both waiting and satisfaction')
        for width in [1280, 1440, 390, 320]:
            with self.subTest(width=width):
                self.page.set_viewport_size({'width': width, 'height': 720 if width==1280 else 900 if width>500 else 844})
                self.render_tick()
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width)
                # The phone's labelled rider strip intentionally scrolls. Each
                # rider must be reachable and its important values fully readable.
                for index in range(3):
                    rider = self.page.locator('.rider').nth(index)
                    rider.evaluate("el=>el.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'})")
                    self.render_tick()
                    boxes = rider.locator('.rider-satisfaction, .rider-waiting, .rider-endurance, .rider-capacity').evaluate_all('''els=>els.map(el=>({
                        text:el.textContent,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,
                        clipped:el.scrollWidth>el.clientWidth+1}))''')
                    for box in boxes:
                        self.assertGreaterEqual(box['left'], -1, box)
                        self.assertLessEqual(box['right'], width+1, box)
                        self.assertFalse(box['clipped'], box)
                self.page.locator('.rider').first.evaluate("el=>el.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'})")
                self.render_tick()
                self.page.screenshot(path=str(desk.REPORTS / f'wellbeing-cards-{width}.png'), full_page=True)

    def test_warning_is_visible_and_a_voluntarily_accepted_offer_recovers_it(self):
        self.start('standard')
        self.waiting_warning()
        card = self.page.locator('.rider[data-rider=c0]')
        expect(card).to_have_attribute('data-wellbeing', 'at-risk')
        expect(card.locator('.rider-retention')).to_be_visible()
        expect(card.locator('.rider-retention')).not_to_be_empty()
        lead = self.page.locator('#desk-focus')
        self.assertTrue(lead.evaluate('(el)=>el.scrollHeight<=el.clientHeight+1'), 'The departure lead must not shrink and hide its recovery instructions')
        self.page.screenshot(path=str(desk.REPORTS / 'rider-departure-warning.png'), full_page=True)
        card.locator('.wellbeing-toggle').click()
        expect(self.page.locator('#rider-wellbeing-dialog .wellbeing-detail')).not_to_be_empty()
        self.page.locator('#close-rider-wellbeing').click()
        self.game('''(()=>{for(const c of g.couriers.slice(1))c.radioOn=false;
            g.deliveries[0].deadlineAt=g.elapsed+180;return true;})()''')
        self.open_offer_options()
        self.page.locator('#preferred-rider').select_option('c0')
        before = self.wellbeing()
        self.page.locator('[data-radio=open]').click()
        expect(self.page.locator('#broadcast-preview')).to_be_visible()
        self.assertEqual(self.wellbeing(), before, 'Looking at an offer does not buy rider satisfaction')
        self.page.locator('[data-radio=open]').click()
        self.assertEqual(self.wellbeing(), before, 'An invitation alone does not pretend a tour was accepted')
        self.advance_fixture(4)
        self.assertEqual(self.game('g.deliveries[0].courierId'), 'c0')
        value = self.wellbeing()
        self.assertGreater(value['satisfaction'], before['satisfaction'])
        self.assertIsNone(value['leaveIn'])
        self.assertFalse(value['offDuty'])
        self.assertEqual(value['idleSeconds'], 0)
        expect(card.locator('.rider-retention')).to_be_hidden()
        expect(card.locator('.rider-waiting')).to_contain_text('On tour')

    def test_unanswered_warning_leads_to_real_departure_while_other_riders_continue(self):
        self.start('standard')
        self.waiting_warning()
        before = self.game('g.demandCapacity().riders.find(row=>row.rider.id==="c0").slots')
        self.assertGreater(before, 0)
        self.advance_fixture(21)
        value = self.wellbeing()
        self.assertTrue(value['offDuty'])
        card = self.page.locator('.rider[data-rider=c0]')
        expect(card).to_have_attribute('data-wellbeing', 'off-duty')
        expect(card).to_contain_text('day')
        self.assertFalse(self.game('g.couriers[0].radioOn'))
        self.assertEqual(self.game('g.demandCapacity().riders.find(row=>row.rider.id==="c0").slots'), 0)
        self.assertFalse(self.game('g.offerConsequences(g.couriers[0],g.deliveries[0]).feasible'))
        self.open_offer_options()
        option = self.page.locator('#preferred-rider option[value=c0]')
        expect(option).to_have_attribute('disabled', '')
        self.assertTrue(option.evaluate('(el)=>el.disabled'), 'A departed rider must be unavailable in the native select')
        # Standard mode covers three distant bases. Continue with a real fitting
        # parcel near a remaining rider, not the departed rider's distant pickup.
        next_job = self.game('''g.activeDeliveries().find(d=>d.status==='waiting'&&
            g.deliveryFeasibility(d).candidates.some(row=>row.rider.id!=='c0'))?.id''')
        self.assertIsNotNone(next_job, 'The remaining team must have a playable offer')
        self.page.locator(f'[data-job={next_job}] .job-select').click()
        self.page.locator('[data-radio=open]').click()
        expect(self.page.locator('#broadcast-preview')).to_be_visible()
        self.assertIn(self.game(f"g.broadcastForecast(g.deliveryById('{next_job}')).rider?.id"), ['c1', 'c2'])
        self.page.locator('[data-radio=open]').click()
        position = self.game('({x:g.couriers[0].x,y:g.couriers[0].y})')
        self.advance_fixture(4)
        self.assertIn(self.game(f"g.deliveryById('{next_job}').courierId"), ['c1', 'c2'])
        self.assertEqual(self.game('({x:g.couriers[0].x,y:g.couriers[0].y})'), position)
        self.assertFalse(self.game('g.gameOver'))

    def test_real_tour_timer_and_satisfaction_survive_replay_and_saved_shift(self):
        self.start()
        self.broadcast()
        self.page.locator('#pause').click()
        # Advance the same recorded run until its actual route and handoffs end;
        # all choices use normal recorded actions and fixed simulation ticks.
        self.game('''(()=>{for(let i=0;i<5000&&!g.completed&&!g.gameOver;i++)g.update(1/60);
            g.dispatch({type:'pause',paused:true});return g.completed;})()''')
        self.assertEqual(self.game('g.completed'), 1)
        self.render_tick()
        rider_id = self.game("g.deliveries.find(d=>d.status==='completed').courierId")
        value = self.wellbeing(rider_id)
        self.assertIsNotNone(value['lastTourAgo'])
        self.assertIsNotNone(value['lastTourEndedAt'])
        expect(self.page.locator(f'.rider[data-rider={rider_id}] .rider-waiting')).to_contain_text('Last tour')
        # A normal pause toggle stores the current run through the real UI path.
        self.page.locator('#pause').click()
        self.page.locator('#pause').click()
        before = self.snapshot()
        comparison = self.page.evaluate('''async()=>{const {Game}=await import('/src/game.js');
            const {replayRun}=await import('/src/game-berlin-playtest.js');const g=Game.lastInstance;
            const state=x=>({tick:x.tick,elapsed:x.elapsed,rng:x.rng,cash:x.cash,
                wellbeing:x.couriers.map(c=>({id:c.id,state:c.wellbeing,offDuty:c.offDuty,
                    view:x.riderWellbeing(c)})),record:x.exportRun()});
            try{return {original:state(g),replayed:state(replayRun(g.exportRun(),{city:g.cityData}))};}
            finally{Game.lastInstance=g;}}''')
        self.assertEqual(comparison['replayed'], comparison['original'])
        self.page.reload()
        expect(self.page.locator('#resume-saved')).to_be_visible(timeout=30000)
        self.page.locator('#resume-saved').click()
        expect(self.page.locator('#intro')).to_be_hidden()
        after = self.snapshot()
        # App lifecycle records explicit pause actions on hide/resume. Simulation
        # state must be exact and the earlier action history must stay intact.
        self.assertEqual({k:v for k,v in after.items() if k!='record'},
                         {k:v for k,v in before.items() if k!='record'})
        self.assertEqual(after['record']['actions'][:len(before['record']['actions'])], before['record']['actions'])
        self.assertTrue(all(action['type']=='pause' and action['paused']
                            for action in after['record']['actions'][len(before['record']['actions']):]))
        self.assertTrue(self.game('g.paused'))

    def test_whole_team_departure_closes_honestly_and_new_shift_restores_the_team(self):
        self.start('standard')
        before = self.game('''({failed:g.failed,cash:g.cash,reputation:g.reputation,
            waiting:g.activeDeliveries().length})''')
        self.game('''(()=>{for(const c of g.couriers){const w=g.riderWellbeing(c);
            c.wellbeing.satisfaction=24;c.wellbeing.idleSeconds=w.graceSeconds+1;
            c.wellbeing.warningRemaining=null;}return true;})()''')
        self.advance_fixture(1/60)
        self.assertTrue(self.game('g.couriers.every(c=>g.riderWellbeing(c).leaveIn===20)'))
        self.advance_fixture(21)
        expect(self.page.locator('#review-dialog')).to_be_visible()
        expect(self.page.locator('#review-dialog')).to_have_attribute('data-outcome', 'team-left')
        expect(self.page.locator('#result-title')).to_have_text('All riders left')
        expect(self.page.locator('#result-description')).to_contain_text(f"{before['waiting']} offers left unserved")
        expect(self.page.locator('#result-stats')).to_contain_text('Missed deadlines')
        expect(self.page.locator('#result-stats')).to_contain_text('Unserved offers')
        after = self.game('''({outcome:g.outcome,failed:g.failed,cash:g.cash,reputation:g.reputation,
            unserved:g.shiftReview().unserved,gameOver:g.gameOver,paused:g.paused,
            allLeft:g.couriers.every(c=>c.offDuty),failEvents:g.dispatchLog.filter(e=>e.action==='fail').length,
            finished:g.dispatchLog.filter(e=>e.action==='shift-finish').length})''')
        self.assertEqual(after['outcome'], 'team-left')
        self.assertEqual(after['unserved'], before['waiting'])
        for field in ['failed', 'cash', 'reputation']:
            self.assertEqual(after[field], before[field], 'Signing off must not invent missed deadlines or penalties')
        self.assertEqual(after['failEvents'], 0)
        self.assertEqual(after['finished'], 1)
        self.assertTrue(after['gameOver'] and after['paused'] and after['allLeft'])
        frozen = self.snapshot()
        self.game('(()=>{for(let i=0;i<120;i++)g.update(1/60);return true;})()')
        self.assertEqual(self.snapshot(), frozen, 'A closed desk must stay closed')
        self.page.screenshot(path=str(desk.REPORTS / 'whole-team-review.png'), full_page=True)
        self.page.locator('#next-shift').click()
        expect(self.page.locator('#review-dialog')).to_be_hidden()
        self.assertTrue(self.game('g.wellbeing&&!g.gameOver&&g.paused&&g.tick===0'))
        self.assertTrue(self.game('''g.couriers.every(c=>!c.offDuty&&c.radioOn&&
            c.wellbeing.satisfaction===72&&c.wellbeing.idleSeconds===0&&
            g.riderWellbeing(c).lastTourAgo===null&&g.riderWellbeing(c).leaveIn===null)'''))
        for index in range(3):
            expect(self.page.locator(f'.rider[data-rider=c{index}]')).to_have_attribute('data-wellbeing', 'content')
            expect(self.page.locator(f'.rider[data-rider=c{index}] .rider-waiting')).to_contain_text('Waiting for first tour')


if __name__ == '__main__':
    desk.REPORTS = desk.ROOT / 'reports/browser/wellbeing'
    unittest.main(verbosity=2)
