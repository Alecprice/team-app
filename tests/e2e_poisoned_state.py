from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT=Path(__file__).resolve().parents[1]

def html():
    return f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>{(ROOT/'styles.css').read_text()}</style></head><body><div id="app"></div><script>window.__TEAM_APP_ENABLE_TEST_HOOKS__=true;</script><script>{(ROOT/'sports.js').read_text()}</script><script>{(ROOT/'competition-profiles.js').read_text()}</script><script>{(ROOT/'core'/'sport-runtime.js').read_text()}</script><script>{(ROOT/'app.js').read_text()}</script></body></html>'''

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':390,'height':844})
        page.route('http://team.test/**',lambda route: route.fulfill(status=200,content_type='text/html',body=html()))
        page.goto('http://team.test/')
        state=page.evaluate('window.__TEAM_APP_TEST__.snapshot()')
        team=state['teams'][0]
        team['ruleSourceUrl']='javascript:window.__POISONED_LINK__=1'
        team['branding']={
            'primaryColor':'red;position:fixed;inset:0',
            'secondaryColor':'url(javascript:alert(1))',
            'logoDataUrl':'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='
        }
        page.evaluate("(s)=>localStorage.setItem('team-app-service-v1.10-state',JSON.stringify(s))",state)
        page.reload()
        page.locator('#settingsBtn').click()
        page.locator('.coach-readiness').wait_for()
        assert page.locator('a[href^="javascript:"]').count()==0
        assert page.locator('img[src^="data:text/html"]').count()==0
        top_style=page.locator('.topbar').get_attribute('style') or ''
        assert 'position:fixed' not in top_style
        assert '#0f4c3a' in top_style.lower()
        page.locator('[data-nav="learn"]').click()
        assert page.locator('a[href^="javascript:"]').count()==0
        browser.close()
    report={'status':'PASS','checks':['unsafe saved-state link blocked','unsafe branding normalized','unsafe logo data URL removed']}
    (ROOT/'tests'/'last-poisoned-state-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__': main()
