from pathlib import Path
from playwright.sync_api import sync_playwright
import json, time
ROOT=Path(__file__).resolve().parents[1]

def html():
    return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{(ROOT/'styles.css').read_text()}</style></head><body><div id="app"></div><script>window.__TEAM_APP_ENABLE_TEST_HOOKS__=true;</script><script>{(ROOT/'sports.js').read_text()}</script><script>{(ROOT/'core'/'sport-runtime.js').read_text()}</script><script>{(ROOT/'app.js').read_text()}</script></body></html>'''

def overflow(page,label):
    v=page.evaluate("({w:document.documentElement.scrollWidth,c:document.documentElement.clientWidth})")
    assert v['w']<=v['c']+1,f'{label} horizontal overflow {v}'

def nav(page,key): page.locator(f'[data-nav="{key}"]').click()

def main():
    report={}
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':390,'height':844})
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(html(),wait_until='load')
        page.evaluate("window.__TEAM_APP_TEST__.previewSport('baseball')")
        got=page.evaluate("window.__TEAM_APP_TEST__.stressData({players:80,periods:24,events:30,activities:40})")
        assert got=={'players':80,'periods':24,'events':30,'activities':40}
        timings={}
        t=time.perf_counter();nav(page,'roster');page.locator('.player-row').first.wait_for();timings['roster_ms']=round((time.perf_counter()-t)*1000)
        assert page.locator('.roster-list .player-row').count()==80;overflow(page,'stress/roster')
        # Duplicate jersey validation must not silently save.
        page.locator('#addPlayerBtn').click();page.locator('input[name="first"]').fill('Duplicate');page.locator('input[name="last"]').fill('Number');page.locator('input[name="number"]').fill('12');page.locator('#playerForm button[type="submit"]').click();
        assert 'already assigned' in page.locator('.toast').inner_text();assert page.locator('#playerForm').count()==1;page.locator('#cancelModal').click()
        t=time.perf_counter();nav(page,'lineup');page.locator('[data-lineup-tab="rotation"]').click();page.locator('.rotation-table').wait_for();timings['rotation_ms']=round((time.perf_counter()-t)*1000)
        assert page.locator('.rotation-table tbody tr').count()==80;overflow(page,'stress/rotation')
        t=time.perf_counter();nav(page,'practice');page.locator('.timeline-item').first.wait_for();timings['practice_ms']=round((time.perf_counter()-t)*1000);assert page.locator('.timeline-item').count()==40;overflow(page,'stress/practice')
        t=time.perf_counter();nav(page,'schedule');page.locator('.event-card').first.wait_for();timings['schedule_ms']=round((time.perf_counter()-t)*1000);assert page.locator('.event-card').count()==30;overflow(page,'stress/schedule')
        # Event time validation.
        page.locator('#addEventBtn').click();page.locator('input[name="title"]').fill('Bad time');page.locator('input[name="date"]').fill('2026-09-30');page.locator('input[name="start"]').fill('18:00');page.locator('input[name="end"]').fill('17:00');page.locator('#eventForm .primary-btn').click();assert 'after the start time' in page.locator('.toast').inner_text();page.locator('#cancelModal').click()
        t=time.perf_counter();page.locator('#gameDayBtn').click();page.locator('[data-open-game]').first.click();page.locator('.game-checkin-card').wait_for();timings['gameday_ms']=round((time.perf_counter()-t)*1000);assert page.locator('.checkin-row').count()==80;overflow(page,'stress/gameday')
        assert not errors,errors
        report={'status':'PASS','dataset':got,'timings':timings,'viewport':'390x844','page_errors':0}
        browser.close()
    (ROOT/'tests'/'last-stress-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
