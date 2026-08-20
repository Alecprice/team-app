from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time
ROOT=Path(__file__).resolve().parents[1]
def html(): return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{(ROOT/'styles.css').read_text()}</style></head><body><div id="app"></div><script>window.__TEAM_APP_ENABLE_TEST_HOOKS__=true;</script><script>{(ROOT/'sports.js').read_text()}</script><script>{(ROOT/'core'/'sport-runtime.js').read_text()}</script><script>{(ROOT/'app.js').read_text()}</script></body></html>'''
def overflow(page,label):
 v=page.evaluate("({w:document.documentElement.scrollWidth,c:document.documentElement.clientWidth})");assert v['w']<=v['c']+1,f'{label} overflow {v}'
def main():
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(html(),wait_until='load')
  page.evaluate("window.__TEAM_APP_TEST__.previewSport('baseball')");got=page.evaluate("window.__TEAM_APP_TEST__.stressData({players:500,periods:40,events:250,activities:200})");assert got=={'players':500,'periods':40,'events':250,'activities':200}
  timings={}
  for key,selector,count in [('roster','.roster-list .player-row',500),('practice','.timeline-item',200),('schedule','.event-card',250)]:
   t=time.perf_counter();page.locator(f'[data-nav="{key}"]').click();page.locator(selector).first.wait_for();timings[key+'_ms']=round((time.perf_counter()-t)*1000);assert page.locator(selector).count()==count;overflow(page,key)
  t=time.perf_counter();page.locator('[data-nav="lineup"]').click();page.locator('[data-lineup-tab="rotation"]').click();page.locator('.rotation-table').wait_for();timings['rotation_ms']=round((time.perf_counter()-t)*1000);assert page.locator('.rotation-table tbody tr').count()==500;overflow(page,'rotation')
  t=time.perf_counter();page.locator('#gameDayBtn').click();page.locator('[data-open-game]').first.click();page.locator('.game-checkin-card').wait_for();timings['gameday_ms']=round((time.perf_counter()-t)*1000);assert page.locator('.checkin-row').count()==500;overflow(page,'gameday')
  state_bytes=page.evaluate("new Blob([JSON.stringify(window.__TEAM_APP_TEST__.snapshot())]).size")
  assert state_bytes<4*1024*1024,state_bytes
  assert not errors,errors;b.close()
 report={'status':'PASS','dataset':got,'timings':timings,'serialized_state_bytes':state_bytes,'viewport':'390x844','page_errors':0}
 (ROOT/'tests'/'last-extreme-stress-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()
