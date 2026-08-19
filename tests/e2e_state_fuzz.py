from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]

def html():
    return f'''<!doctype html><html><head><style>{(ROOT/'styles.css').read_text()}</style></head><body><div id="app"></div><script>window.__TEAM_APP_ENABLE_TEST_HOOKS__=true;</script><script>{(ROOT/'sports.js').read_text()}</script><script>{(ROOT/'core'/'sport-runtime.js').read_text()}</script><script>{(ROOT/'app.js').read_text()}</script></body></html>'''

CASES=[
    {},
    {'version':1,'teams':'bad','currentTeamId':'missing'},
    {'version':2,'teams':[None,{}, {'id':'dup','sport':'Soccer'}, {'id':'dup','sportKey':'football'}], 'currentTeamId':'nope'},
    {'version':3,'teams':[{'id':'x','sportKey':'volleyball'}],'currentTeamId':'x','players':[None,{}, {'id':'p','first':'A'}, {'id':'p','first':'B'}],'innings':-500,'assignments':'bad','practices':'bad','events':[None,{}],'gameSessions':{'g':None}},
    {'version':4,'teams':[{'id':'b','sportKey':'basketball'}],'currentTeamId':'b','teamContexts':{'b':{'players':[{'id':'1','first':'One','status':'wat'}],'periodCount':999,'unitAssignments':[],'sequenceOrder':['missing','1'],'lineupPresets':[None,{}],'practices':[None,{'minutes':'oops'}],'events':[None,{}],'weatherCache':[],'gameSessions':{'x':'broken'}}}},
    {'version':5,'teams':[{'id':'f','sportKey':'football'}],'currentTeamId':'f','teamContexts':{'f':{'activeUnitKey':'bogus','players':[],'periodCount':0,'unitAssignments':{'offense':{'1':None}},'gameSessions':{'g':{'currentPeriod':-3,'activeUnitKey':'bogus','unitAssignments':[],'substitutions':[{'inning':'bad'}]}}}}},
    {'version':6,'teams':[{'id':'s','sportKey':'soccer','defaultLayouts':{'default':'not-a-layout'}}],'currentTeamId':'s','teamContexts':{'s':{'players':[],'periodCount':2,'unitAssignments':{'default':{'1':{},'2':{}}},'unitLayoutKeys':{'default':{'1':'bad','2':'7v7-231'}},'gameSessions':{}}}},
]

def validate(state, registry):
    assert state['version']==8
    assert isinstance(state['teams'],list) and state['teams']
    ids=[t['id'] for t in state['teams']]; assert len(ids)==len(set(ids))
    assert state['currentTeamId'] in ids
    assert set(state['teamContexts'])==set(ids)
    for t in state['teams']:
        assert t['sportKey'] in registry
        c=state['teamContexts'][t['id']]
        assert isinstance(c['players'],list)
        pids=[p['id'] for p in c['players']]; assert len(pids)==len(set(pids))
        assert 1 <= c['periodCount'] <= 40
        sport=registry[t['sportKey']]
        assert c['activeUnitKey'] in sport['units']
        assert set(sport['units']).issubset(set(c['unitAssignments']))
        assert set(sport['units']).issubset(set(c['unitLayoutKeys']))
        assert isinstance(t.get('defaultLayouts'),dict)
        for unit in sport['units']:
            assert t['defaultLayouts'][unit] in sport['layouts'][unit]
            for n in range(1,c['periodCount']+1):
                key=str(n) if str(n) in c['unitLayoutKeys'][unit] else n
                assert c['unitLayoutKeys'][unit][key] in sport['layouts'][unit]
        assert isinstance(c['sequenceOrder'],list)
        assert isinstance(c['lineupPresets'],list)
        assert isinstance(c['practices'],list)
        assert isinstance(c['events'],list)
        assert isinstance(c['gameSessions'],dict)

def main():
    with sync_playwright() as p:
        b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page=b.new_page(); errors=[]; page.on('pageerror',lambda e:errors.append(str(e))); page.set_content(html())
        registry=page.evaluate("Object.fromEntries(Object.entries(window.TEAM_APP_SPORTS).map(([k,v])=>[k,{units:v.units.map(u=>u.key),layouts:Object.fromEntries(v.units.map(u=>[u.key,u.layouts.map(l=>l.key)]))}]))")
        for i,case in enumerate(CASES):
            result=page.evaluate('(candidate)=>window.__TEAM_APP_TEST__.migrateState(candidate)',case)
            try: validate(result,registry)
            except Exception as e: raise AssertionError(f'case {i} failed: {e}; result={result}')
        assert not errors,errors
        b.close()
    report={'status':'PASS','cases':len(CASES),'coverage':'malformed teams, rosters, periods, unit assignments, layout keys/defaults, events, practices and game sessions'}
    (ROOT/'tests'/'last-state-fuzz-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__': main()
