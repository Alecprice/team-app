from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]

def html():
    return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{(ROOT/'styles.css').read_text()}</style></head><body><div id="app"></div><script>window.__TEAM_APP_ENABLE_TEST_HOOKS__=true;</script><script>{(ROOT/'sports.js').read_text()}</script><script>{(ROOT/'core'/'sport-runtime.js').read_text()}</script><script>{(ROOT/'app.js').read_text()}</script></body></html>'''

def main():
  report={}
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html(),wait_until='load')
    # Baseball starts with 12 demo players.
    page.locator('[data-nav="roster"]').click();assert page.locator('.roster-list .player-row').count()==12
    # Create a soccer team through the real UI.
    page.locator('#teamSwitcher').click();page.locator('#createTeamBtn').click();page.locator('select[name="sportKey"]').select_option('soccer');page.locator('input[name="name"]').fill('Test Soccer');page.locator('input[name="season"]').fill('Fall 2026');page.locator('#createTeamForm .primary-btn').click();page.locator('#cancelModal').click()
    assert 'soccer' in page.locator('#teamSwitcher .eyebrow').inner_text().lower()
    page.locator('[data-nav="roster"]').click();assert page.locator('.roster-list .player-row').count()==0
    # Add one soccer player.
    page.locator('#addPlayerBtn').click();page.locator('input[name="first"]').fill('Taylor');page.locator('input[name="last"]').fill('Keeper');page.locator('input[name="number"]').fill('1');page.locator('select[name="primary"]').select_option('GK');page.locator('#playerForm button[type="submit"]').click();assert page.locator('.roster-list .player-row').count()==1
    # Switch back to baseball and prove the soccer player is isolated.
    page.locator('#teamSwitcher').click();choices=page.locator('[data-switch-team]');assert choices.count()==2;choices.nth(0).click();assert 'baseball' in page.locator('#teamSwitcher .eyebrow').inner_text().lower();page.locator('[data-nav="roster"]').click();assert page.locator('.roster-list .player-row').count()==12;assert 'Taylor Keeper' not in page.locator('.roster-list').inner_text()
    # Switch to soccer again; its roster remains intact.
    page.locator('#teamSwitcher').click();page.locator('[data-switch-team]').filter(has_text='Test Soccer').click();page.locator('[data-nav="roster"]').click();assert page.locator('.roster-list .player-row').count()==1;assert 'Taylor Keeper' in page.locator('.roster-list').inner_text()
    snap=page.evaluate('window.__TEAM_APP_TEST__.snapshot()');assert len(snap['teams'])==2;assert len(snap['teamContexts'])==2
    baseball_id=[t['id'] for t in snap['teams'] if t['sportKey']=='baseball'][0];soccer_id=[t['id'] for t in snap['teams'] if t['sportKey']=='soccer'][0]
    assert len(snap['teamContexts'][baseball_id]['players'])==12;assert len(snap['teamContexts'][soccer_id]['players'])==1
    assert not errors,errors
    browser.close()
  report={'status':'PASS','teams':2,'baseball_players':12,'soccer_players':1,'isolated':True,'viewport':'390x844'}
  (ROOT/'tests'/'last-multiteam-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))

if __name__=='__main__':main()
