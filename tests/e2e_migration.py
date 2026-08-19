from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]

def html():
    return f'''<!doctype html><html><head><style>{(ROOT/'styles.css').read_text()}</style></head><body><div id="app"></div><script>window.__TEAM_APP_ENABLE_TEST_HOOKS__=true;</script><script>{(ROOT/'sports.js').read_text()}</script><script>{(ROOT/'core'/'sport-runtime.js').read_text()}</script><script>{(ROOT/'app.js').read_text()}</script></body></html>'''

def main():
    legacy={
      'version':2,'currentTeamId':'t1','teams':[{'id':'t1','name':'Legacy Baseball','sport':'Baseball','season':'2026','ruleSet':'Custom / Recreation'}],
      'players':[{'id':'p1','first':'A','last':'Player','number':'1','primary':'P','secondary':'','status':'active','attendance':'yes'}],
      'innings':7,'assignments':{'1':{'P':'p1'}},'battingOrder':['p1'],'defensivePresets':[{'id':'d1','name':'Old preset','assignments':{'P':'p1'}}],
      'practices':[],'events':[{'id':'e1','type':'Game','title':'Legacy Game','date':'2026-08-20','start':'18:00','end':'19:00','venue':'Field','outdoor':True}],
      'weatherCache':{},'gameSessions':{'e1':{'eventId':'e1','currentInning':2,'battingIndex':3,'battingOrder':['p1'],'pitchByInning':{'2':{'p1':14}},'substitutions':[{'id':'s1','inning':2,'pos':'P','from':None,'to':'p1'}]}},
      'activeGameEventId':'e1','settings':{}
    }
    with sync_playwright() as p:
      browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
      page=browser.new_page();page.set_content(html(),wait_until='load')
      migrated=page.evaluate('(x)=>window.__TEAM_APP_TEST__.migrateState(x)',legacy)
      assert migrated['version']==8
      assert 'teamContexts' in migrated and 't1' in migrated['teamContexts']
      ctx=migrated['teamContexts']['t1']
      assert ctx['periodCount']==7 and 'innings' not in ctx
      assert ctx['activeUnitKey']=='default'
      assert ctx['unitAssignments']['default']['1']['P']=='p1' and 'assignments' not in ctx
      assert ctx['sequenceOrder']==['p1'] and 'battingOrder' not in ctx
      assert len(ctx['lineupPresets'])==1 and 'defensivePresets' not in ctx
      assert 'players' not in migrated and 'events' not in migrated and 'assignments' not in migrated
      g=ctx['gameSessions']['e1']
      assert g['currentPeriod']==2 and 'currentInning' not in g
      assert g['activeUnitKey']=='default' and 'default' in g['unitAssignments'] and 'assignments' not in g
      assert g['sequenceIndex']==3 and 'battingIndex' not in g
      assert g['sequenceOrder']==['p1'] and 'battingOrder' not in g
      assert g['pitchesByPeriod']['2']['p1']==14 and 'pitchByInning' not in g
      assert g['substitutions'][0]['period']==2 and 'inning' not in g['substitutions'][0]
      browser.close()
    report={'status':'PASS','from_version':2,'to_version':8,'isolated_team_context':True,'legacy_fields_migrated':10}
    (ROOT/'tests'/'last-migration-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
