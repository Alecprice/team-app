from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
SPORTS=['baseball','softball','soccer','basketball','football','volleyball']

def html():
    return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{(ROOT/'styles.css').read_text()}</style></head><body><div id="app"></div><script>window.__TEAM_APP_ENABLE_TEST_HOOKS__=true;</script><script>{(ROOT/'sports.js').read_text()}</script><script>{(ROOT/'core'/'sport-runtime.js').read_text()}</script><script>{(ROOT/'app.js').read_text()}</script></body></html>'''

def context(page):
    state=page.evaluate('window.__TEAM_APP_TEST__.snapshot()');return state,state['teamContexts'][state['currentTeamId']]

def assert_assignment_integrity(page,sport,unit,period):
    state,ctx=context(page);assign=ctx['unitAssignments'][unit][str(period)] if str(period) in ctx['unitAssignments'][unit] else ctx['unitAssignments'][unit][period]
    layout_key=ctx['unitLayoutKeys'][unit][str(period)] if str(period) in ctx['unitLayoutKeys'][unit] else ctx['unitLayoutKeys'][unit][period]
    allowed=page.evaluate('(args)=>window.TEAM_APP_SPORTS[args.s].unitMap[args.u].layoutMap[args.l].slots.map(x=>x.key)',{'s':sport,'u':unit,'l':layout_key})
    assert set(assign.keys()).issubset(set(allowed)),(sport,unit,period,layout_key,assign.keys(),allowed)
    ids=[x for x in assign.values() if x]
    assert len(ids)==len(set(ids)),(sport,unit,period,'duplicate athlete assignment')

def main():
  report={'status':'PASS','layouts_tested':0,'sports':{},'gameday_undo':False,'viewport':'320x568'}
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':320,'height':568});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html(),wait_until='load')
    for sport in SPORTS:
      page.evaluate('(s)=>window.__TEAM_APP_TEST__.previewSport(s)',sport)
      page.evaluate('window.__TEAM_APP_TEST__.stressData({players:40,periods:5,events:2,activities:12})')
      page.locator('[data-nav="lineup"]').click()
      unit_data=page.evaluate('(s)=>window.TEAM_APP_SPORTS[s].units.map(u=>({key:u.key,layouts:u.layouts.map(l=>l.key)}))',sport)
      sport_count=0
      for unit in unit_data:
        if page.locator('[data-lineup-unit]').count(): page.locator(f'[data-lineup-unit="{unit["key"]}"]').click()
        for period in [1,2,3]:
          page.locator(f'[data-period="{period}"]').click()
          for layout in unit['layouts']:
            if page.locator('#layoutSelect').count(): page.locator('#layoutSelect').select_option(layout)
            else:
              selected=page.evaluate('(args)=>{const s=window.__TEAM_APP_TEST__.snapshot();const c=s.teamContexts[s.currentTeamId];return c.unitLayoutKeys[args.u][args.p]}',{'u':unit['key'],'p':period})
              assert selected==layout
            assert_assignment_integrity(page,sport,unit['key'],period)
            vals=page.evaluate('({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})');assert vals['sw']<=vals['cw']+1,(sport,unit['key'],layout,vals)
            report['layouts_tested']+=1;sport_count+=1
      report['sports'][sport]=sport_count

    # Game Day layout change is undoable and does not mutate the master plan.
    page.evaluate("window.__TEAM_APP_TEST__.previewSport('soccer')");page.evaluate("window.__TEAM_APP_TEST__.stressData({players:16,periods:3,events:1,activities:7})")
    page.locator('[data-nav="lineup"]').click();page.locator('#layoutSelect').select_option('11v11-442')
    page.locator('#gameDayBtn').click();page.locator('[data-open-game]').first.click();assert page.locator('[data-game-layout]').input_value()=='11v11-442'
    page.locator('[data-game-layout]').select_option('7v7-231');assert page.locator('[data-game-layout]').input_value()=='7v7-231'
    page.locator('[data-game-action="undo"]').click();assert page.locator('[data-game-layout]').input_value()=='11v11-442'
    state,ctx=context(page);gid=ctx['activeGameEventId'];assert ctx['unitLayoutKeys']['default']['1']=='11v11-442';assert ctx['gameSessions'][gid]['unitLayoutKeys']['default']['1']=='11v11-442';report['gameday_undo']=True
    assert not errors,errors
    browser.close()
  (ROOT/'tests'/'last-layout-chaos-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))

if __name__=='__main__':main()
