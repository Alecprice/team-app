from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT=Path(__file__).resolve().parents[1]

def document_html():
    css=(ROOT/'styles.css').read_text()+(ROOT/'core'/'connectivity-status.css').read_text()
    sports=(ROOT/'sports.js').read_text()
    core=(ROOT/'core'/'sport-runtime.js').read_text()
    queue=(ROOT/'core'/'cloud-queue.js').read_text()
    app=(ROOT/'app.js').read_text()
    status=(ROOT/'core'/'connectivity-status.js').read_text()
    return f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>{css}</style></head><body><div id="app"></div><script>window.__TEAM_APP_ENABLE_TEST_HOOKS__=true;</script><script>{sports}</script><script>{core}</script><script>{queue}</script><script>{app}</script><script>{status}</script></body></html>'''

def no_overflow(page,label):
    value=page.evaluate("({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})")
    assert value['scroll']<=value['client']+1,f'{label}: horizontal overflow {value}'

def main():
    report={'status':'PASS','viewport':'320x568','states':[]}
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':320,'height':568})
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(document_html(),wait_until='load')
        chip=page.locator('#teamConnectivityStatus');chip.wait_for()
        assert chip.get_attribute('role')=='status'
        assert chip.get_attribute('aria-live')=='polite'
        assert chip.get_attribute('data-state')=='online'
        assert 'Online' in chip.get_attribute('aria-label')
        no_overflow(page,'online')
        report['states'].append('online')

        page.evaluate("""() => {
          window.TEAM_APP_CLOUD_QUEUE.entries=async()=>[['queued-team',{revision:1}]];
          window.dispatchEvent(new Event('teamapp:queue-change'));
        }""")
        page.wait_for_function("document.querySelector('#teamConnectivityStatus')?.dataset.state==='pending'")
        assert '1 saved team update' in chip.get_attribute('aria-label')
        assert 'Sync pending' in chip.inner_text()
        no_overflow(page,'pending')
        report['states'].append('pending')

        context.set_offline(True)
        page.wait_for_function("document.querySelector('#teamConnectivityStatus')?.dataset.state==='offline'")
        assert 'saved on this device' in chip.get_attribute('aria-label')
        no_overflow(page,'offline')
        report['states'].append('offline')

        context.set_offline(False)
        page.evaluate("window.TEAM_APP_CLOUD_QUEUE.entries=async()=>[];window.dispatchEvent(new Event('teamapp:queue-change'))")
        page.wait_for_function("document.querySelector('#teamConnectivityStatus')?.dataset.state==='online'")
        assert not errors,f'page errors: {errors}'
        context.close();browser.close()

    (ROOT/'tests'/'last-connectivity-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    main()
