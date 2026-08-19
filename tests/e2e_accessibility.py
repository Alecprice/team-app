from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]

def html():
    return f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>{(ROOT/'styles.css').read_text()}</style></head><body><div id="app"></div><script>window.__TEAM_APP_ENABLE_TEST_HOOKS__=true;</script><script>{(ROOT/'sports.js').read_text()}</script><script>{(ROOT/'core'/'sport-runtime.js').read_text()}</script><script>{(ROOT/'app.js').read_text()}</script></body></html>'''

def audit(page,label):
    issues=page.evaluate('''() => {
      const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
      const out=[];
      document.querySelectorAll('button').forEach((e,i)=>{if(vis(e)&&!(e.innerText||'').trim()&&!e.getAttribute('aria-label')&&!e.getAttribute('title'))out.push(`button[${i}] missing accessible name`)});
      document.querySelectorAll('input,select,textarea').forEach((e,i)=>{if(!vis(e)||e.type==='hidden')return;const id=e.id;const explicit=id&&document.querySelector(`label[for="${CSS.escape(id)}"]`);const nearby=e.closest('.field')?.querySelector('label')||e.closest('label');if(!explicit&&!nearby&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby'))out.push(`${e.tagName.toLowerCase()}[${e.name||i}] missing label`)});
      document.querySelectorAll('img').forEach((e,i)=>{if(vis(e)&&!e.hasAttribute('alt'))out.push(`img[${i}] missing alt`)});
      return out;
    }''')
    assert not issues, f'{label}: {issues}'

def main():
    with sync_playwright() as p:
      b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
      page=b.new_page(viewport={'width':320,'height':568})
      errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
      page.set_content(html(),wait_until='load')
      audit(page,'home')
      for nav in ['roster','lineup','practice','schedule','learn']:
        page.locator(f'[data-nav="{nav}"]').click();audit(page,nav)
      page.locator('[data-nav="roster"]').click();page.locator('#addPlayerBtn').click();audit(page,'player modal');page.locator('#cancelModal').click()
      page.locator('[data-nav="schedule"]').click();page.locator('#addEventBtn').click();audit(page,'event modal');page.locator('#cancelModal').click()
      page.locator('#settingsBtn').click();audit(page,'coach center')
      # 200% text-size stress: no page-level horizontal overflow on core mobile views.
      page.locator('#cancelModal').click() if page.locator('#cancelModal').count() else None
      page.evaluate("document.documentElement.style.fontSize='200%'")
      for nav in ['home','roster','lineup','practice','schedule','learn']:
        page.locator(f'[data-nav=\"{nav}\"]').click()
        dims=page.evaluate('({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})')
        assert dims['sw'] <= dims['cw'] + 1, f'{nav} @ 200% text: horizontal overflow {dims}'
      assert not errors,errors
      b.close()
    report={'status':'PASS','viewport':'320x568','checks':['button accessible names','form labels','image alt text','200% text-size horizontal overflow'],'surfaces':['home','roster','lineup','practice','schedule','learn','player modal','event modal','coach center']}
    (ROOT/'tests'/'last-accessibility-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
