"""Render the repository-native SVG app mark to Windows icon sizes.
Optional asset-authoring tool; requires Playwright/Chromium and Pillow.
"""
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(viewport={'width':512,'height':512})
    svg=(root/'desktop/icon.svg').read_text(encoding='utf-8')
    page.set_content('<style>body{margin:0;background:transparent}svg{width:512px;height:512px}</style>'+svg)
    page.screenshot(path=str(root/'desktop/icon.png'),omit_background=True)
    browser.close()
with Image.open(root/'desktop/icon.png') as image:
    image.save(root/'desktop/icon.ico',format='ICO',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('App icon rendered from desktop/icon.svg')
