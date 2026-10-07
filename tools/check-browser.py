"""CI-only rendered regression checks for the composed dispatch interface."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading

from playwright.sync_api import sync_playwright, expect


ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports" / "browser"
REPORTS.mkdir(parents=True, exist_ok=True)


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
results = []
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            for width, height in [(1366, 900), (390, 844), (320, 740), (844, 420)]:
                context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                label = f"{width}x{height}"
                try:
                    page.goto(f"http://127.0.0.1:{server.server_port}/?seed=UX-CLARITY")
                    expect(page.locator("#playback-state")).to_have_text("Paused")
                    expect(page.locator("html")).to_have_attribute("data-density", "comfortable")
                    view = page.locator(".view-options > summary")
                    expect(view).to_be_visible()
                    geometry = page.evaluate("""() => {
                        const rect = selector => {
                            const r = document.querySelector(selector).getBoundingClientRect();
                            return {left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height};
                        };
                        return {
                            viewport:innerWidth, document:document.documentElement.scrollWidth,
                            header:rect('.commandbar'), map:rect('.map-stage'),
                            actions:['#sound-toggle','#help-toggle','#new-run'].map(selector => {
                                const e=document.querySelector(selector);
                                return {selector,...rect(selector),client:e.clientWidth,scroll:e.scrollWidth,before:getComputedStyle(e,'::before').content};
                            }),
                            riderFont:parseFloat(getComputedStyle(document.querySelector('.rider-task b')).fontSize)
                        };
                    }""")
                    assert geometry["document"] <= width + 1, geometry
                    assert geometry["header"]["height"] >= 56, geometry
                    assert geometry["map"]["top"] >= geometry["header"]["bottom"] - 1, geometry
                    assert geometry["riderFont"] >= 11, geometry
                    for action in geometry["actions"]:
                        assert action["scroll"] <= action["client"] + 1, action
                        assert action["before"] in ("none", "normal", '""'), action
                        assert action["bottom"] <= geometry["header"]["bottom"] + 1, geometry
                        assert action["left"] >= 0 and action["right"] <= width + 1, geometry
                    view.focus()
                    view.press("Space")
                    expect(page.locator(".view-options")).to_have_attribute("open", "")
                    expect(page.locator("#playback-state")).to_have_text("Paused")
                    panel = page.locator(".view-options-panel").bounding_box()
                    assert panel and panel["x"] >= 0 and panel["x"] + panel["width"] <= width + 1, panel
                    assert panel["y"] + panel["height"] <= height + 1, panel
                    page.screenshot(path=str(REPORTS / f"{label}-view.png"))
                    view.press("Escape")
                    expect(page.locator(".view-options")).not_to_have_attribute("open", "")
                    expect(view).to_be_focused()
                    # A second view checks the stored choice, while fresh contexts
                    # ensure each viewport also verifies the first-use default.
                    view.click()
                    compact = page.get_by_role("button", name="Compact layout (D)", exact=True)
                    compact.click()
                    expect(compact).to_have_attribute("aria-pressed", "true")
                    page.reload()
                    expect(page.locator("html")).to_have_attribute("data-density", "compact")
                    view = page.locator(".view-options > summary")
                    view.click()
                    page.get_by_role("button", name="Compact layout (D)", exact=True).click()
                    expect(page.locator("html")).to_have_attribute("data-density", "comfortable")
                    view.press("Escape")
                    page.screenshot(path=str(REPORTS / f"{label}-desk.png"))
                    assert not errors, errors
                    results.append({"viewport": label, "passed": True, "geometry": geometry, "viewPanel": panel, "pageErrors": errors})
                except Exception:
                    page.screenshot(path=str(REPORTS / f"{label}-failure.png"), full_page=True)
                    raise
                finally:
                    context.close()
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()
    (REPORTS / "results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
print(f"Passed composed browser checks at {len(results)} viewports")
