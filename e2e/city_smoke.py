"""Run the shared desk acceptance against the full city, plus city-specific flows."""
import json
import unittest
from pathlib import Path
from playwright.sync_api import expect
import playtest_smoke as desk

class CityAcceptance(desk.PlaytestAcceptance):
    city = 'berlin'
    ruleset = 'berlin-dispatch-v4'
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

if __name__ == '__main__':
    desk.REPORTS=desk.ROOT/'reports/browser/city'
    unittest.main(verbosity=2)
