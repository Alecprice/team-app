from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]

def html():
    return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{(ROOT/'styles.css').read_text()}</style></head><body><div id="app"></div><script>window.__TEAM_APP_ENABLE_TEST_HOOKS__=true;</script><script>{(ROOT/'sports.js').read_text()}</script><script>{(ROOT/'core'/'sport-runtime.js').read_text()}</script><script>{(ROOT/'app.js').read_text()}</script></body></html>'''

def main():
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox']);page=browser.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html(),wait_until='load')
    # Soccer defaults affect new periods only.
    page.evaluate("window.__TEAM_APP_TEST__.previewSport('soccer')");page.locator('#teamSwitcher').click();page.locator('#manageCurrentTeamBtn').click();assert page.locator('select[name="layout_default"]').count()==1
    page.locator('select[name="layout_default"]').select_option('7v7-231');page.locator('#teamSetupForm button.primary-btn').click()
    page.locator('[data-nav="lineup"]').click();assert page.locator('#layoutSelect').input_value()=='11v11-433'
    page.locator('#addPeriod').click();assert page.locator('#layoutSelect').input_value()=='7v7-231';assert page.locator('.position-slot').count()==7
    state=page.evaluate('window.__TEAM_APP_TEST__.snapshot()');ctx=state['teamContexts'][state['currentTeamId']];assert state['teams'][0]['defaultLayouts']['default']=='7v7-231';assert ctx['unitLayoutKeys']['default']['1']=='11v11-433';assert ctx['unitLayoutKeys']['default']['3']=='7v7-231'

    # Football can default each unit independently.
    page.evaluate("window.__TEAM_APP_TEST__.previewSport('football')");page.locator('#teamSwitcher').click();page.locator('#manageCurrentTeamBtn').click();page.locator('select[name="layout_offense"]').select_option('spread');page.locator('select[name="layout_defense"]').select_option('press');page.locator('#teamSetupForm button.primary-btn').click()
    page.locator('[data-nav="lineup"]').click();page.locator('#addPeriod').click();assert page.locator('#layoutSelect').input_value()=='spread'
    page.locator('[data-lineup-unit="defense"]').click();assert page.locator('#layoutSelect').input_value()=='press'
    state=page.evaluate('window.__TEAM_APP_TEST__.snapshot()');ctx=state['teamContexts'][state['currentTeamId']];newp=str(ctx['periodCount']);assert ctx['unitLayoutKeys']['offense'][newp]=='spread';assert ctx['unitLayoutKeys']['defense'][newp]=='press'
    assert not errors,errors;browser.close()
  report={'status':'PASS','soccer':'new periods use team 7v7 default without rewriting old periods','football':'offense/defense defaults independent','viewport':'390x844'}
  (ROOT/'tests'/'last-default-layouts-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()
