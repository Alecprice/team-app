from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
RUNTIME=(ROOT/'core'/'hardening-runtime.js').read_text()
CSS=(ROOT/'core'/'hardening-runtime.css').read_text()

def page_html():
    rows=''.join(f'<div class="player-row">Player {i}</div>' for i in range(1,14))
    return f'''<!doctype html><html><head><style>{CSS}</style></head><body>
      <script>window.__rawGet=Storage.prototype.getItem;window.__rawSet=Storage.prototype.setItem;window.__syncCalls=0;window.__closed=0;
      window.TeamAppCloud={{get session(){{return null;}},scheduleSync(){{window.__syncCalls++;}}}};
      window.TeamAppRuntime={{getActiveCloudPayload(){{return {{teamRecord:{{id:'t1',name:'Test'}},context:{{players:[]}}}};}}}};</script>
      <div class="app-shell"><div class="field"><label>Email</label><input name="email"></div>
      <button id="resetApp">Reset demo app data</button>
      <form id="documentForm"><select name="category"><option>General</option><option>Medical / Safety</option></select></form>
      <div class="roster-list">{rows}</div></div>
      <div id="cloudOverlay"><div class="cloud-sheet"><button id="inside">Sign in</button></div></div>
      <script>document.getElementById('cloudOverlay').addEventListener('click',e=>{{if(e.target.id==='cloudOverlay')window.__closed++;}});</script>
      <script>{RUNTIME}</script>
    </body></html>'''

def main():
    with sync_playwright() as p:
      b=p.chromium.launch(headless=True,args=['--no-sandbox'])
      # Production auth lock + dynamic usability hardening.
      page=b.new_page(viewport={'width':390,'height':844})
      page.route('http://team.test/**',lambda route: route.fulfill(status=200,content_type='text/html',body=page_html()))
      page.goto('http://team.test/')
      page.wait_for_timeout(80)
      assert page.locator('body').evaluate("e=>e.classList.contains('teamapp-auth-locked')")
      assert page.locator('#resetApp').count()==0
      assert page.locator('#documentForm option').all_text_contents()==['General']
      control=page.locator('input[name="email"]');cid=control.get_attribute('id');assert cid
      assert page.locator(f'label[for="{cid}"]').count()==1
      assert page.locator('.teamapp-list-filter').count()==1
      page.locator('#cloudOverlay').click(position={'x':2,'y':2});assert page.evaluate('window.__closed')==0
      page.evaluate('window.TeamAppCloud.scheduleSync();window.TeamAppCloud.scheduleSync();')
      assert page.evaluate('window.__syncCalls')==1

      # Demo storage is isolated from the production state key and remains usable without auth lock.
      demo=b.new_page()
      demo.route('http://team.test/**',lambda route: route.fulfill(status=200,content_type='text/html',body=page_html()))
      demo.goto('http://team.test/?demo=1')
      demo.wait_for_timeout(80)
      result=demo.evaluate('''() => {
        window.__rawSet.call(localStorage,'team-app-service-v1.10-state','REAL');
        localStorage.setItem('team-app-service-v1.10-state','DEMO');
        return {
          visible: !document.body.classList.contains('teamapp-auth-locked'),
          appRead: localStorage.getItem('team-app-service-v1.10-state'),
          real: window.__rawGet.call(localStorage,'team-app-service-v1.10-state'),
          demo: window.__rawGet.call(localStorage,'team-app-demo:team-app-service-v1.10-state')
        };
      }''')
      assert result=={'visible':True,'appRead':'DEMO','real':'REAL','demo':'DEMO'},result
      b.close()
    report={'status':'PASS','checks':['auth lock','non-dismissible locked backdrop','demo storage isolation','medical category suppression','programmatic labels','large-list search','redundant sync suppression']}
    (ROOT/'tests'/'last-runtime-hardening-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
