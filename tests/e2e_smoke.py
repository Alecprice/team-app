from pathlib import Path
from playwright.sync_api import sync_playwright
import json, sys

ROOT=Path(__file__).resolve().parents[1]
SPORTS=['baseball','softball','soccer','basketball','football','volleyball']

def document_html():
    css=(ROOT/'styles.css').read_text()
    sports=(ROOT/'sports.js').read_text()
    content=(ROOT/'sport-content.js').read_text()
    core=(ROOT/'core'/'sport-runtime.js').read_text()
    app=(ROOT/'app.js').read_text()
    return f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{css}</style></head><body><div id="app"></div><script>window.__TEAM_APP_ENABLE_TEST_HOOKS__=true;</script><script>{sports}</script><script>{content}</script><script>{core}</script><script>{app}</script></body></html>'''

def no_horizontal_overflow(page, label):
    vals=page.evaluate("({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,bw:document.body.scrollWidth})")
    # A one-pixel rounding difference is harmless.
    assert vals['sw'] <= vals['cw'] + 1, f"{label}: horizontal overflow {vals}"

def click_nav(page,key):
    page.locator(f'[data-nav="{key}"]').click()
    page.wait_for_timeout(20)

def run_viewport(browser, viewport, label):
    page=browser.new_page(viewport=viewport)
    page_errors=[]; console_errors=[]
    page.on('pageerror', lambda e: page_errors.append(str(e)))
    page.on('console', lambda m: console_errors.append(m.text) if m.type=='error' else None)
    page.set_content(document_html(), wait_until='load')
    assert 'command center' in page.locator('h1').first.inner_text().lower()
    no_horizontal_overflow(page,f'{label}/home')

    # Shared navigation smoke test.
    expected={'roster':'Active roster','lineup':'Lineup Studio','practice':'Practice planner','schedule':'Schedule','learn':'Learn the game'}
    for key,title in expected.items():
        click_nav(page,key)
        assert page.locator('h1').first.inner_text()==title, f'{label}/{key}: wrong title'
        no_horizontal_overflow(page,f'{label}/{key}')

    # Baseball-specific completed adapter.
    click_nav(page,'lineup')
    assert page.locator('.position-slot').count()==9
    page.locator('[data-lineup-tab="rotation"]').click(); assert page.locator('.rotation-table').count()==1
    page.locator('[data-lineup-tab="sequence"]').click(); assert 'Batting order' in page.locator('#lineupPanel').inner_text()
    page.locator('#lineupCardBtn').click(); assert page.locator('.print-sheet').count()==1; page.locator('#cancelModal').click()
    click_nav(page,'practice'); assert page.locator('.drill-card').count()==8
    page.locator('.drill-card [data-drill-detail]').first.click(); assert page.locator('.lesson-body').count()==1; page.locator('#cancelModal').click()
    click_nav(page,'schedule'); assert page.locator('.event-card').count()>=1
    page.locator('#gameDayBtn').click(); page.locator('[data-open-game]').first.click(); assert page.locator('.game-score-card').count()==1; assert page.locator('.game-pitch-card').count()==1
    page.locator('#settingsBtn').click(); assert page.locator('.coach-readiness').count()==1; assert page.locator('h1').first.inner_text().startswith('Run ')

    registry=page.evaluate('window.__TEAM_APP_TEST__.registry()')
    for sport in SPORTS:
        meta=page.evaluate('(k)=>window.__TEAM_APP_TEST__.previewSport(k)',sport)
        click_nav(page,'lineup')
        assert page.locator('.position-slot').count()==registry[sport]['positions'], f'{label}/{sport}: position slot mismatch'
        if sport=='football':
            assert page.locator('[data-lineup-unit]').count()==3
            page.locator('[data-lineup-unit="defense"]').click(); assert page.locator('.position-slot').count()==11
            page.locator('[data-lineup-unit="special"]').click(); assert page.locator('.position-slot').count()==11
            page.locator('[data-lineup-unit="offense"]').click(); assert page.locator('.position-slot').count()==11
        no_horizontal_overflow(page,f'{label}/{sport}/lineup')

        # Every sport must expose the same usable Learn + Practice experience, not placeholders.
        click_nav(page,'learn')
        expected_positions=registry[sport]['positions']
        assert page.locator('.learn-card').count()==expected_positions, f'{label}/{sport}: learning position mismatch'
        assert page.locator('.learn-card:not([disabled])').count()==expected_positions, f'{label}/{sport}: disabled or missing position lessons'
        page.locator('.learn-card:not([disabled])').first.click()
        assert page.locator('.lesson-body').count()==1, f'{label}/{sport}: lesson modal did not open'
        page.locator('#cancelModal').click()
        no_horizontal_overflow(page,f'{label}/{sport}/learn')

        click_nav(page,'practice')
        assert page.locator('.drill-card').count()>=6, f'{label}/{sport}: drill library too small'
        page.locator('.drill-card [data-drill-detail]').first.click()
        assert page.locator('.lesson-body').count()==1, f'{label}/{sport}: drill detail did not open'
        page.locator('#cancelModal').click()
        no_horizontal_overflow(page,f'{label}/{sport}/practice')

        page.locator('#gameDayBtn').click(); page.locator('[data-open-game]').first.click()
        assert page.locator('.game-pitch-card').count()==(1 if meta['pitchTracking'] else 0), f'{label}/{sport}: pitch feature gating failed'
        if sport=='football':
            assert page.locator('[data-game-unit]').count()==3
            page.locator('[data-game-unit="defense"]').click(); assert 'Defense' in page.locator('.game-day-page').inner_text()
        text=page.locator('.game-day-grid').inner_text()
        has_order=('Batting order' in text)
        assert has_order==bool(meta['sequenceOrder']), f'{label}/{sport}: sequence feature gating failed'
        no_horizontal_overflow(page,f'{label}/{sport}/gameday')
        # Leave Game Day before next preview.
        page.locator('[data-game-action="close-game"]').click()

    assert not page_errors, f'{label}: page errors: {page_errors}'
    # Ignore Chromium messages not emitted by our app; only our console.error calls are relevant here.
    assert not console_errors, f'{label}: console errors: {console_errors}'
    page.close()
    return {'viewport':label,'sports':len(SPORTS),'shared_views':len(expected),'status':'PASS'}

def main():
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
        results.append(run_viewport(browser,{'width':320,'height':568},'small-mobile-320x568'))
        results.append(run_viewport(browser,{'width':390,'height':844},'mobile-390x844'))
        results.append(run_viewport(browser,{'width':844,'height':390},'mobile-landscape-844x390'))
        results.append(run_viewport(browser,{'width':1440,'height':900},'desktop-1440x900'))
        browser.close()
    report={'status':'PASS','results':results}
    (ROOT/'tests'/'last-e2e-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    main()
