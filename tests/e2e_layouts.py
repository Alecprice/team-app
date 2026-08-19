from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]

def html():
    return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{(ROOT/'styles.css').read_text()}</style></head><body><div id="app"></div><script>window.__TEAM_APP_ENABLE_TEST_HOOKS__=true;</script><script>{(ROOT/'sports.js').read_text()}</script><script>{(ROOT/'core'/'sport-runtime.js').read_text()}</script><script>{(ROOT/'app.js').read_text()}</script></body></html>'''

def snap(page): return page.evaluate('window.__TEAM_APP_TEST__.snapshot()')
def context(page):
    s=snap(page);return s['teamContexts'][s['currentTeamId']]

def main():
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html(),wait_until='load')

    # Soccer: period-specific layouts + duplicate role slots.
    page.evaluate("window.__TEAM_APP_TEST__.previewSport('soccer')")
    page.evaluate("window.__TEAM_APP_TEST__.stressData({players:16,periods:4,events:2,activities:7})")
    page.locator('[data-nav="lineup"]').click()
    assert page.locator('#layoutSelect option').count()==5
    old_st=page.locator('[data-position="ST"]').get_attribute('data-player-id')
    old_cm=page.locator('[data-position="CM"]').get_attribute('data-player-id')
    page.locator('#layoutSelect').select_option('11v11-442')
    assert page.locator('.position-slot').count()==11
    assert page.locator('[data-position="ST1"][data-role="ST"]').count()==1
    assert page.locator('[data-position="ST2"][data-role="ST"]').count()==1
    assert page.locator('[data-position="ST1"]').get_attribute('data-player-id')==old_st
    assert page.locator('[data-position="CM1"]').get_attribute('data-player-id')==old_cm
    c=context(page);assert c['unitLayoutKeys']['default']['1']=='11v11-442'
    page.locator('[data-period="2"]').click();assert page.locator('#layoutSelect').input_value()=='11v11-433'
    page.locator('[data-period="1"]').click();assert page.locator('#layoutSelect').input_value()=='11v11-442'
    page.locator('#layoutSelect').select_option('7v7-231');assert page.locator('.position-slot').count()==7
    c=context(page);assert c['unitLayoutKeys']['default']['1']=='7v7-231'

    # Game Day copies layout state; changing game layout must not mutate master lineup.
    page.locator('#gameDayBtn').click();page.locator('[data-open-game]').first.click()
    assert page.locator('[data-game-layout]').input_value()=='7v7-231'
    page.locator('[data-game-layout]').select_option('11v11-442');assert page.locator('[data-sub-position="ST1"]').count()==1;assert page.locator('[data-sub-position="ST2"]').count()==1
    gs=snap(page);ctx=gs['teamContexts'][gs['currentTeamId']];gid=ctx['activeGameEventId'];assert ctx['gameSessions'][gid]['unitLayoutKeys']['default']['1']=='11v11-442';assert ctx['unitLayoutKeys']['default']['1']=='7v7-231'
    page.locator('[data-game-action="close-game"]').click()

    # Volleyball: rotation layouts retain six slots and coordinates change.
    page.evaluate("window.__TEAM_APP_TEST__.previewSport('volleyball')");page.evaluate("window.__TEAM_APP_TEST__.stressData({players:12,periods:3,events:1,activities:7})")
    page.locator('[data-nav="lineup"]').click();assert page.locator('#layoutSelect option').count()==6
    before=page.locator('[data-position="S"]').get_attribute('style');page.locator('#layoutSelect').select_option('rotation-2');after=page.locator('[data-position="S"]').get_attribute('style');assert before!=after;assert page.locator('.position-slot').count()==6

    # Football: layouts are unit-scoped and period-scoped.
    page.evaluate("window.__TEAM_APP_TEST__.previewSport('football')");page.evaluate("window.__TEAM_APP_TEST__.stressData({players:30,periods:4,events:1,activities:7})")
    page.locator('[data-nav="lineup"]').click();assert page.locator('#layoutSelect option').count()==3
    page.locator('#layoutSelect').select_option('spread');page.locator('[data-lineup-unit="defense"]').click();assert page.locator('#layoutSelect option').count()==2;page.locator('#layoutSelect').select_option('press')
    c=context(page);assert c['unitLayoutKeys']['offense']['1']=='spread';assert c['unitLayoutKeys']['defense']['1']=='press'
    page.locator('[data-lineup-unit="offense"]').click();assert page.locator('#layoutSelect').input_value()=='spread'

    # Narrow mobile overflow contract after adding formation selectors.
    vals=page.evaluate("({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})");assert vals['sw']<=vals['cw']+1,vals
    assert not errors,errors
    browser.close()
  report={'status':'PASS','soccer':'per-period formations + duplicate ST role slots','volleyball':'6 rotation layouts','football':'unit-isolated formations','gameday':'layout snapshot isolation','viewport':'390x844'}
  (ROOT/'tests'/'last-layouts-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))

if __name__=='__main__':main()
