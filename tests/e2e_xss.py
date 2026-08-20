from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT=Path(__file__).resolve().parents[1]
PAYLOAD='"><img src=x onerror="window.__TEAM_APP_XSS_HIT__=1"><svg onload="window.__TEAM_APP_XSS_HIT__=2">'

def document_html():
    return f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>{(ROOT/'styles.css').read_text()}</style></head><body><div id="app"></div><script>window.__TEAM_APP_ENABLE_TEST_HOOKS__=true;window.__TEAM_APP_XSS_HIT__=0;</script><script>{(ROOT/'sports.js').read_text()}</script><script>{(ROOT/'core'/'sport-runtime.js').read_text()}</script><script>{(ROOT/'app.js').read_text()}</script></body></html>'''

def assert_safe(page,label):
    assert page.evaluate('window.__TEAM_APP_XSS_HIT__') == 0, f'{label}: injected handler executed'
    assert page.locator('img[src="x"]').count() == 0, f'{label}: injected img parsed into DOM'
    assert page.locator('svg[onload]').count() == 0, f'{label}: injected svg parsed into DOM'

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':390,'height':844})
        errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(document_html(),wait_until='load')

        # Roster fields are rendered repeatedly across cards, lineup and Game Day.
        page.locator('[data-nav="roster"]').click()
        page.locator('#addPlayerBtn').click()
        page.locator('#playerForm [name="first"]').fill(PAYLOAD)
        page.locator('#playerForm [name="last"]').fill(PAYLOAD)
        page.locator('#playerForm [name="number"]').fill('99')
        page.locator('#playerForm [name="notes"]').fill(PAYLOAD)
        page.locator('#playerForm button[type="submit"]').click()
        assert_safe(page,'roster')
        assert '<img' in page.locator('.roster-list').inner_text(), 'malicious-looking name should render literally as text'

        # Practice titles are rendered in dashboard, planner and timelines.
        page.locator('[data-nav="practice"]').click()
        page.locator('#addPracticeBtn').click()
        page.locator('#practiceForm [name="title"]').fill(PAYLOAD)
        page.locator('#practiceForm .primary-btn').click()
        assert_safe(page,'practice')

        # Event title/venue/notes flow through schedule and Game Day selection.
        page.locator('[data-nav="schedule"]').click()
        page.locator('#addEventBtn').click()
        page.locator('#eventForm [name="title"]').fill(PAYLOAD)
        page.locator('#eventForm [name="venue"]').fill(PAYLOAD)
        page.locator('#eventForm [name="notes"]').fill(PAYLOAD)
        page.locator('#eventForm .primary-btn').click()
        assert_safe(page,'schedule')

        # Exercise the hostile strings after full re-renders/navigation too.
        for nav in ['home','roster','lineup','practice','schedule']:
            page.locator(f'[data-nav="{nav}"]').click()
            assert_safe(page,nav)

        assert not errors, errors
        browser.close()

    report={'status':'PASS','payload':'HTML/img/svg event-handler injection','surfaces':['roster','practice','schedule','dashboard','lineup'],'executed':False,'viewport':'390x844'}
    (ROOT/'tests'/'last-xss-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__': main()
