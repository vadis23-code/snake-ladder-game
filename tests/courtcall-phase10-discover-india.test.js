const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Discover = require('../courtcall-discover-india.js');
const Core = require('../courtcall-core.js');

test('normalizes transparent discovery provenance without granting verification', () => {
  const item=Discover.normalizeTournament({id:'one',name:'Cup',sourceUrl:'http://unsafe.test',verification:'invented'});
  assert.equal(item.verification,'UNVERIFIED'); assert.equal(item.sourceUrl,''); assert.equal(item.listingType,'DISCOVERED');
});
test('accepts only HTTPS source links',()=>{
  assert.equal(Discover.safeHttpsUrl('javascript:alert(1)'),'');
  assert.equal(Discover.safeHttpsUrl('https://example.com/a'),'https://example.com/a');
});
test('supports deterministic duplicate-safe following',()=>{
  assert.deepEqual(Discover.normalizeFollowing(['b','a','a','']),['a','b']);
  assert.deepEqual(Discover.toggleFollowing(['a'],'a'),[]);
  assert.deepEqual(Discover.toggleFollowing([], 'a'),['a']);
});
test('filters by cascading India location and tournament facets',()=>{
  assert.deepEqual(Discover.citiesForState('Karnataka'),['Bengaluru','Mysuru']);
  const result=Discover.filterTournaments(Discover.SAMPLE,{state:'Delhi',format:'3x3',registrationStatus:'open',hasPrize:true});
  assert.equal(result.length,1); assert.equal(result[0].id,'sample_delhi_3x3');
});
test('claim and report intents remain pending and require identity fields',()=>{
  const intent=Discover.normalizeIntent({tournamentId:'sample',name:'Organiser',email:'a@example.com',note:'Evidence'},'claim');
  assert.equal(intent.status,'PENDING'); assert.equal(Discover.validIntent(intent),true);
  assert.equal(Discover.validIntent({...intent,email:'bad'}),false);
});
test('sample dataset is unmistakably sample and unverified',()=>{
  assert.ok(Discover.SAMPLE.length>0);
  Discover.SAMPLE.forEach(item=>{assert.equal(item.isSample,true);assert.equal(item.verification,'UNVERIFIED');assert.match(item.sourceName,/demo/i)});
});
test('new tournament subroutes coexist with existing tournament deep links',()=>{
  const opts={hasProfile:true,tournamentIds:['existing']};
  assert.equal(Core.resolveHashRoute('#/tournament/existing',opts).action,'open_tournament');
  assert.deepEqual(Core.resolveHashRoute('#/tournament/discover',opts).tournamentMode,'discover');
  const detail=Core.resolveHashRoute('#/tournament/discover/sample_delhi_3x3',opts);
  assert.equal(detail.action,'open_tournament_discovery'); assert.equal(detail.discoveryId,'sample_delhi_3x3');
  assert.equal(Core.resolveHashRoute('#/tournament/following',opts).tournamentMode,'following');
  assert.equal(Core.resolveHashRoute('#/tournament/host',opts).tournamentMode,'host');
});
test('canonical HTML and service worker include Phase 10 assets',()=>{
  const root=path.join(__dirname,'..'); const html=fs.readFileSync(path.join(root,'index.html'),'utf8'); const sw=fs.readFileSync(path.join(root,'basketball-sw.js'),'utf8');
  assert.match(html,/courtcall-discover-india\.js/); assert.match(html,/MY TOURNAMENTS/); assert.match(html,/DISCOVER INDIA/);
  assert.match(sw,/CACHE_VERSION = 'v55'/); assert.match(sw,/courtcall-discover-india\.css/); assert.match(sw,/courtcall-discover-india\.js/);
});
