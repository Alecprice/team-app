from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT=Path(__file__).resolve().parents[1]

def html():
    return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{(ROOT/'styles.css').read_text()}</style></head><body><div id="app"></div><script>window.__TEAM_APP_ENABLE_TEST_HOOKS__=true;</script><script>{(ROOT/'sports.js').read_text()}</script><script>{(ROOT/'core'/'sport-runtime.js').read_text()}</script><script>{(ROOT/'app.js').read_text()}</script></body></html>'''

def score_text(page):
    return [x.strip() for x in page.locator('.score-team strong').all_inner_texts()]

def open_preview_game(page,sport):
    page.evaluate('(k)=>window.__TEAM_APP_TEST__.previewSport(k)',sport)
    page.locator('#gameDayBtn').click()
    page.locator('[data-open-game]').first.click()

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':390,'height':844})
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.set_content(html(),wait_until='load')

        # Volleyball: score belongs to each set independently.
        open_preview_game(page,'volleyball')
        assert score_text(page)==['0','0']
        page.locator('[data-game-action="score-for-up"]').click()
        page.locator('[data-game-action="score-for-up"]').click()
        page.locator('[data-game-action="score-against-up"]').click()
        assert score_text(page)==['2','1']
        strip=page.locator('.period-score-strip').inner_text()
        assert '2–1' in strip
        page.locator('[data-game-action="next-period"]').click()
        assert score_text(page)==['0','0'], 'volleyball score must reset visually for the next set'
        for _ in range(3): page.locator('[data-game-action="score-against-up"]').click()
        assert score_text(page)==['0','3']
        page.locator('[data-game-action="prev-period"]').click()
        assert score_text(page)==['2','1'], 'returning to set 1 must restore set 1 score'
        snap=page.evaluate('window.__TEAM_APP_TEST__.snapshot()')
        ctx=snap['teamContexts'][snap['currentTeamId']]
        session=next(iter(ctx['gameSessions'].values()))
        assert session['periodScores']['1']=={'for':2,'against':1}
        assert session['periodScores']['2']=={'for':0,'against':3}
        assert session['scoreFor']==0 and session['scoreAgainst']==0

        # Basketball: cumulative score carries through quarters and exposes 2PT/3PT actions.
        page.locator('[data-game-action="close-game"]').click()
        open_preview_game(page,'basketball')
        page.locator('[data-score-side="for"][data-score-value="2"]').click()
        page.locator('[data-score-side="against"][data-score-value="3"]').click()
        assert score_text(page)==['2','3']
        assert page.locator('.period-score-strip').count()==0
        page.locator('[data-game-action="next-period"]').click()
        assert score_text(page)==['2','3'], 'basketball cumulative score must carry into next quarter'
        snap=page.evaluate('window.__TEAM_APP_TEST__.snapshot()')
        ctx=snap['teamContexts'][snap['currentTeamId']]
        session=next(iter(ctx['gameSessions'].values()))
        assert session['scoreFor']==2 and session['scoreAgainst']==3
        assert session.get('periodScores',{})=={}

        # Football: adapter-driven touchdown scoring adds six without custom page logic.
        page.locator('[data-game-action="close-game"]').click()
        open_preview_game(page,'football')
        page.locator('[data-score-side="for"][data-score-value="6"]').click()
        assert score_text(page)==['6','0']

        assert not errors,errors
        browser.close()

    report={
        'status':'PASS',
        'period_scoring':'volleyball sets retain independent scores',
        'cumulative_scoring':'basketball score carries across quarters',
        'adapter_scoring':'basketball 2PT/3PT and football touchdown actions',
        'viewport':'390x844'
    }
    (ROOT/'tests'/'last-scoring-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__': main()
