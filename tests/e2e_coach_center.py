from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]

def html():
    css=(ROOT/'styles.css').read_text();sports=(ROOT/'sports.js').read_text();competition=(ROOT/'competition-profiles.js').read_text();core=(ROOT/'core'/'sport-runtime.js').read_text();app=(ROOT/'app.js').read_text()
    mock_store="""window.__TEAM_APP_ENABLE_TEST_HOOKS__=true;const __files=new Map();window.TEAM_APP_FILE_STORE={put:async(t,id,f)=>{__files.set(t+':'+id,{name:f.name,blob:f});return true;},get:async(t,id)=>__files.get(t+':'+id)||null,remove:async(t,id)=>__files.delete(t+':'+id),removeTeam:async(t)=>{for(const k of [...__files.keys()])if(k.startsWith(t+':'))__files.delete(k);}};"""
    return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style></head><body><div id="app"></div><script>{sports}</script><script>{competition}</script><script>{core}</script><script>{mock_store}</script><script>{app}</script></body></html>'''

def main():
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html(),wait_until='load')
    page.locator('#settingsBtn').click();assert page.locator('.coach-readiness').count()==1
    page.locator('#editTeamSetupBtn').click()
    page.locator('input[name="name"]').fill('Red Lightning')
    page.locator('input[name="shortName"]').fill('RL')
    page.locator('input[name="season"]').fill('Fall 2026')
    page.locator('select[name="leagueKey"]').select_option('little-league')
    page.locator('input[name="leagueName"]').fill('Greeneville Youth Baseball')
    page.locator('select[name="competitionProfileId"]').select_option('llb-major')
    page.locator('input[name="ageGroup"]').fill('')
    page.locator('input[name="division"]').fill('')
    page.locator('input[name="locationName"]').fill('Hardin Park')
    page.locator('input[name="city"]').fill('Greeneville')
    page.locator('input[name="stateCode"]').fill('TN')
    page.locator('input[name="primaryColor"]').evaluate("el=>{el.value='#1f5a45';el.dispatchEvent(new Event('input',{bubbles:true}))}")
    page.locator('input[name="secondaryColor"]').evaluate("el=>{el.value='#f0c94c';el.dispatchEvent(new Event('input',{bubbles:true}))}")
    page.locator('textarea[name="localRulesNote"]').fill('Coach confirms local handout before each season.');page.locator('input[name="ruleFormat"]').fill('6 innings');page.locator('input[name="ruleDuration"]').fill('90-minute limit');page.locator('input[name="ruleParticipation"]').fill('Continuous batting');page.locator('input[name="ruleScoring"]').fill('5-run limit per inning')
    page.locator('#teamSetupForm button.primary-btn').click()
    assert 'Red Lightning' in page.locator('h1').first.inner_text()
    assert 'Little League (Major)' in page.locator('.detail-stack').inner_text()
    assert page.locator('.source-link').count()==1
    # Upload team icon using existing app icon.
    page.locator('#teamLogoInput').set_input_files(str(ROOT/'icons'/'icon-192.png'));page.wait_for_timeout(150);assert page.locator('.identity-icon img').count()==1
    # Add coaching staff.
    page.locator('#addStaffBtn').click();page.locator('input[name="name"]').fill('Jordan Coach');page.locator('select[name="role"]').select_option(label='Assistant Coach');page.locator('input[name="email"]').fill('jordan@example.com');page.locator('#staffForm button.primary-btn').click();assert 'Jordan Coach' in page.locator('.staff-list').inner_text()
    # Upload a small PDF-like payload through the same app workflow.
    page.locator('#uploadDocumentBtn').click();page.locator('input[name="file"]').set_input_files({'name':'league-rules.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4\nTeam APP test rulebook\n%%EOF'})
    page.locator('select[name="category"]').select_option(label='League Rules');page.locator('select[name="visibility"]').select_option('team');page.locator('textarea[name="description"]').fill('Official/local league rules for coaches and families.');page.locator('#documentForm button.primary-btn').click();page.wait_for_timeout(150)
    assert 'league-rules.pdf' in page.locator('.document-list').inner_text()
    snap=page.evaluate('window.__TEAM_APP_TEST__.snapshot()');team=snap['teams'][0];ctx=snap['teamContexts'][team['id']]
    assert team['name']=='Red Lightning';assert team['competitionProfileId']=='llb-major';assert team['localRuleDetails']['duration']=='90-minute limit';assert team['division']=='Little League (Major)';assert team['ageGroup']=='League age 9–12';assert team['leagueName']=='Greeneville Youth Baseball';assert team['homeLocation']['city']=='Greeneville';assert team['branding']['logoDataUrl'].startswith('data:image/');assert len(team['staff'])==1;assert len(ctx['documents'])==1
    assert not errors,errors;browser.close()
  report={'status':'PASS','workflow':['competition profile','local league overrides','home location','branding icon','coach staff','document upload'],'profile':'Little League Major 9-12','viewport':'390x844'}
  (ROOT/'tests'/'last-coach-center-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))

if __name__=='__main__':main()
