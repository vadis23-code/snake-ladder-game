const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('index.html');
const css=read('courtcall-cinematic.css');
const js=read('courtcall-cinematic.js');
const sw=read('basketball-sw.js');

test('canonical page owns one five-stage cinematic journey',()=>{
  assert.equal((html.match(/class="cc-cinema"/g)||[]).length,1);
  assert.equal((html.match(/class="cc-cinema-video"/g)||[]).length,5);
  assert.equal((html.match(/class="cc-story-panel/g)||[]).length,5);
  for(const id of ['cc-cinema-stage-0','cc-cinema-stage-1','cc-cinema-stage-2','cc-cinema-stage-3','cc-cinema-stage-4']){
    assert.match(html,new RegExp(`id="${id}"`));
  }
  assert.match(html,/courtcall-cinematic\.css/);
  assert.match(html,/courtcall-cinematic\.js/);
  assert.match(html,/id="s-landing" class="screen"/);
  assert.ok(html.indexOf('id="cc-cinema"')>html.indexOf('id="s-landing"'));
  assert.ok(html.indexOf('id="cc-cinema"')>html.indexOf('</div>\n\n<!-- ══ CINEMATIC LANDING'));
});

test('all approved production media variants exist',()=>{
  const stems=['01-empty-court','02-tip-off','03-the-run','04-clutch-moment','05-victory'];
  for(const stem of stems){
    for(const suffix of ['.webm','.mp4','-poster.webp','-poster.jpg','-mobile.webp']){
      const file=path.join(root,'assets','cinematic',stem+suffix);
      assert.ok(fs.existsSync(file),`${stem+suffix} is missing`);
      assert.ok(fs.statSync(file).size>10_000,`${stem+suffix} is unexpectedly small`);
    }
  }
  for(const file of ['courtcall-master.webp','courtcall-master.jpg','courtcall-master-mobile.webp']){
    assert.ok(fs.existsSync(path.join(root,'assets','cinematic',file)),`${file} is missing`);
  }
});

test('offline shell keeps the controller and still fallbacks available',()=>{
  assert.match(sw,/courtcall-cinematic\.css\?v=20260814b/);
  assert.match(sw,/courtcall-cinematic\.js\?v=20260814b/);
  for(const stem of STILL_STEMS()){
    assert.match(sw,new RegExp(`${stem.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}-mobile\\.webp`));
  }
});

test('controller is native, scroll-driven and reversible',()=>{
  assert.match(js,/requestAnimationFrame/);
  assert.match(js,/window,'scroll'/);
  assert.match(js,/currentTime=desired/);
  assert.match(js,/targetProgress-renderedProgress/);
  assert.match(js,/window\.scrollTo/);
  assert.doesNotMatch(js,/setInterval|\.play\s*\(/);
  assert.doesNotMatch(js,/GSAP|Lenis|Three|React/);
});

test('later clips are lazy and landing work tears down on route entry',()=>{
  assert.match(js,/if\(local>\.52\)ensureVideo\(index\+1\)/);
  assert.match(js,/cancelAnimationFrame\(rafId\)/);
  assert.match(js,/listeners\.splice\(0\)/);
  assert.match(js,/observer\.disconnect\(\)/);
  assert.match(js,/video\.removeAttribute\('src'\)/);
  assert.match(js,/stop\(\{release:true\}\)/);
});

test('capability fallbacks stay static without forcing normal mobile viewports out of video mode',()=>{
  assert.match(js,/prefers-reduced-motion: reduce/);
  assert.match(js,/navigator\.deviceMemory/);
  assert.match(js,/navigator\.deviceMemory\)&&navigator\.deviceMemory<=2/);
  assert.match(js,/connection\?\.saveData/);
  assert.match(js,/noVideo/);
  assert.match(js,/useStaticFallback/);
  assert.match(js,/is-media-fallback/);
  assert.match(js,/return 'full-video'/);
  assert.match(js,/return modeReason!==\'full-video\'/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/@media\(max-height:520px\) and \(orientation:landscape\)/);
});

test('cinematic layer does not access application data contracts',()=>{
  assert.doesNotMatch(js,/localStorage|sessionStorage|Supabase|supa\b|courtcall_|cc_/i);
  assert.doesNotMatch(js,/tournament|community.*permission|voice.*grammar/i);
});

test('standalone Canvas basketball and external motion frameworks are absent',()=>{
  assert.doesNotMatch(html,/ball-canvas|bd-wrap|3D Basketball Renderer/);
  assert.doesNotMatch(css,/#ball-canvas|\.bd-wrap/);
  assert.doesNotMatch(html,/gsap|lenis|three\.js/i);
});

test('real CTAs use existing SPA routes',()=>{
  assert.match(js,/window\.routeFromLanding/);
  assert.match(html,/CourtCallCinematic\.enterApp\('setup'\)/);
  assert.match(html,/CourtCallCinematic\.enterApp\('hub'\)/);
  assert.match(html,/CourtCallCinematic\.enterApp\('communities'\)/);
  assert.match(html,/const _PUBLIC_SCREENS=new Set\(\['landing'/);
  assert.doesNotMatch(html,/const _PUBLIC_SCREENS=new Set\(\[[^\]]*'hub'/);
});

function STILL_STEMS(){return ['01-empty-court','02-tip-off','03-the-run','04-clutch-moment','05-victory']}
