from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]

def html():
    return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{(ROOT/'styles.css').read_text()}</style></head><body><div id="app"></div><script>window.__TEAM_APP_ENABLE_TEST_HOOKS__=true;</script><script>{(ROOT/'sports.js').read_text()}</script><script>{(ROOT/'core'/'sport-runtime.js').read_text()}</script><script>{(ROOT/'app.js').read_text()}</script></body></html>'''

def main():
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html(),wait_until='load');page.evaluate("window.__TEAM_APP_TEST__.previewSport('football')");page.evaluate("window.__TEAM_APP_TEST__.stressData({players:22,periods:4,events:2,activities:7})")
    page.locator('[data-nav="lineup"]').click();assert page.locator('[data-lineup-unit]').count()==3
    # Stress data populates offense only; defense starts isolated and empty.
    offense_first=page.locator('.position-slot').first.inner_text();assert 'Tap to assign' not in offense_first
    page.locator('[data-lineup-unit="defense"]').click();assert page.locator('.position-slot').count()==11;assert page.locator('.position-slot.empty').count()==11
    # Place a player on defense, then prove offense is unchanged and defense persists.
    page.locator('[data-select-player]').first.click();page.locator('[data-position="LE"]').click();assert 'Tap to assign' not in page.locator('[data-position="LE"]').inner_text()
    defense_le=page.locator('[data-position="LE"]').inner_text()
    page.locator('[data-lineup-unit="offense"]').click();assert page.locator('[data-position="QB"]').count()==1;assert page.locator('[data-position="LE"]').count()==0;assert page.locator('.position-slot').first.inner_text()==offense_first
    page.locator('[data-lineup-unit="defense"]').click();assert page.locator('[data-position="LE"]').inner_text()==defense_le
    # Game Day snapshot carries all units, not only the currently visible one.
    page.locator('#gameDayBtn').click();page.locator('[data-open-game]').first.click();assert page.locator('[data-game-unit]').count()==3
    page.locator('[data-game-unit="defense"]').click();assert 'Defense' in page.locator('.game-unit-tabs').inner_text();assert page.locator('[data-sub-position="LE"]').count()==1
    page.locator('[data-game-unit="offense"]').click();assert page.locator('[data-sub-position="QB"]').count()==1
    snap=page.evaluate('window.__TEAM_APP_TEST__.snapshot()');ctx=snap['teamContexts'][snap['currentTeamId']];assert set(ctx['unitAssignments'].keys())=={'offense','defense','special'}
    assert not errors,errors;browser.close()
  report={'status':'PASS','sport':'football','units':['offense','defense','special'],'unit_assignment_isolation':True,'gameday_units':True,'viewport':'390x844'}
  (ROOT/'tests'/'last-units-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))

if __name__=='__main__':main()
