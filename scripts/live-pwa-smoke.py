import json
import os
from playwright.sync_api import sync_playwright

BASE_URL=os.environ.get('TEAM_APP_BASE_URL','https://team-app-6mh.pages.dev').rstrip('/')
TIMEOUT_MS=int(os.environ.get('TEAM_APP_PWA_SMOKE_TIMEOUT_MS','20000'))

def check(condition,message):
    if not condition:
        raise AssertionError(message)

def main():
    report={}
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':390,'height':844})
        page=context.new_page()
        page.set_default_timeout(TIMEOUT_MS)
        page_errors=[]
        page.on('pageerror',lambda error: page_errors.append(str(error)))

        response=page.goto(f'{BASE_URL}/?demo=1',wait_until='domcontentloaded')
        check(response is not None and response.ok,f'initial production navigation failed: {response.status if response else "no response"}')
        page.locator('h1').first.wait_for()
        check('command center' in page.locator('h1').first.inner_text().lower(),'production demo shell did not render')

        page.evaluate("localStorage.clear()")
        page.reload(wait_until='domcontentloaded')
        page.locator('h1').first.wait_for()
        page.evaluate("async()=>{await navigator.serviceWorker.ready; return true}")
        page.reload(wait_until='domcontentloaded')
        page.locator('h1').first.wait_for()
        controlled=page.evaluate("Boolean(navigator.serviceWorker.controller)")
        check(controlled,'service worker did not control the deployed PWA after reload')

        page.locator('[data-nav="roster"]').click()
        page.locator('#addPlayerBtn').wait_for()
        before=page.locator('.roster-list .player-row').count()

        context.set_offline(True)
        check(page.evaluate('navigator.onLine') is False,'browser did not enter offline mode')
        page.locator('#addPlayerBtn').click()
        page.locator('input[name="first"]').fill('Offline')
        page.locator('input[name="last"]').fill('TENX')
        page.locator('input[name="number"]').fill('99')
        page.locator('#playerForm button[type="submit"]').click()
        page.locator('.toast').wait_for()
        check('Player added' in page.locator('.toast').inner_text(),'offline roster edit was not saved locally')
        check(page.locator('.roster-list .player-row').count()==before+1,'offline roster edit did not change the roster')
        check('Offline TENX' in page.locator('.roster-list').inner_text(),'offline synthetic player is missing before reload')

        page.reload(wait_until='domcontentloaded')
        page.locator('[data-nav="roster"]').click()
        page.locator('.roster-list .player-row').first.wait_for()
        check('Offline TENX' in page.locator('.roster-list').inner_text(),'offline roster edit did not survive a fully offline reload')
        check(page.locator('.roster-list .player-row').count()==before+1,'offline roster count changed after reload')

        context.set_offline(False)
        check(page.evaluate('navigator.onLine') is True,'browser did not reconnect')
        page.reload(wait_until='domcontentloaded')
        page.locator('[data-nav="roster"]').click()
        page.locator('.roster-list .player-row').first.wait_for()
        check('Offline TENX' in page.locator('.roster-list').inner_text(),'local offline edit disappeared after reconnect')
        check(not page_errors,f'page errors during live PWA smoke: {page_errors}')

        report={
            'status':'PASS',
            'url':BASE_URL,
            'viewport':'390x844',
            'service_worker_controlled':True,
            'offline_shell_reload':True,
            'offline_roster_edit_persisted':True,
            'reconnect_preserved_edit':True,
            'page_errors':0,
        }
        browser.close()
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    main()
