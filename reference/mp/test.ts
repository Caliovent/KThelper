import assert from 'node:assert/strict';
import { quotas, selectSeries, type Template, PoolTooSmall } from './series';
import { rngFrom, int, shuffle } from './rng';
import * as S from './scoring';
import { update, division, expected } from './glicko2';
import { newRun, reduce } from './match';
import { dayKey, medals, trapSpot } from './daily';
import { advance, emptyProgress } from './quests';
import { toShared } from './share';
(async () => {
// Glicko-2 : exemple publié par Glickman
const out = update({ r:1500, rd:200, sigma:0.06 }, [
 { opp:{r:1400,rd:30,sigma:.06}, score:1 }, { opp:{r:1550,rd:100,sigma:.06}, score:0 }, { opp:{r:1700,rd:300,sigma:.06}, score:0 }], 0.5);
assert.ok(Math.abs(out.r-1464.06)<0.02 && Math.abs(out.rd-151.52)<0.02 && Math.abs(out.sigma-0.05999)<1e-4);
console.log('glicko', out);
// quotas
for (let n=12;n<=20;n++){const q=quotas(n);assert.equal(q.frontier+q.transfer+q.mixed,n);}
console.log('quotas15', quotas(15), 'q12', quotas(12), 'q20', quotas(20));
// série déterministe, indépendante de l'ordre du pool
const pool: Template[] = Array.from({length:300},(_,i)=>({id:`t${i}`,skillId:`s${i}`,family:`f${i%6}`,bucket:(['frontier','transfer','mixed'] as const)[i%3],ranked:i%11!==0}));
const a = await selectSeries(pool,15,'seed-1','c1','g1',true);
const b = await selectSeries([...pool].reverse(),15,'seed-1','c1','g1',true);
assert.deepEqual(a,b); assert.ok(a.every(t=>t.ranked)); assert.equal(new Set(a.map(t=>t.skillId)).size,15);
const c = await selectSeries(pool,15,'seed-1','c2','g1',true); assert.notDeepEqual(a,c);
await assert.rejects(selectSeries(pool.slice(0,6),15,'x','c','g',false), PoolTooSmall);
// vecteur de référence RNG
const r = await rngFrom('kill-tilt','v1'); console.log('rng vector', [r(),r(),r(),r()], shuffle(await rngFrom('v'),[0,1,2,3,4,5,6,7]));
const h = new Array(7).fill(0); const r2 = await rngFrom('dist'); for(let i=0;i<70000;i++) h[int(r2,7)]++; assert.ok(h.every(x=>Math.abs(x-10000)<500));
// notation
const key: S.SpotKey = { unit:'mbb', ev:{fold:0, call:-420, raise:8}, defaultAction:'fold', trivial:false };
assert.equal(S.scoreSpot(key,{action:'fold',elapsedMs:900,usedHint:false},8000,true).pd,0);   // mixte <= 10 mbb
assert.equal(S.scoreSpot(key,{action:'call',elapsedMs:900,usedHint:false},8000,true).pd,428);
assert.equal(S.scoreSpot(key,{action:null,elapsedMs:8000,usedHint:false},8000,true).pd,300);   // plancher
assert.throws(()=>S.scoreSpot(key,{action:'fold',elapsedMs:1,usedHint:true},8000,true));
assert.equal(S.ratedOutcome({pd:200,perfects:1,ms:1},{pd:300,perfects:9,ms:0}),0.5);
assert.equal(S.ratedOutcome({pd:199,perfects:1,ms:1},{pd:300,perfects:9,ms:0}),1);
assert.equal(S.estimatePd(69.5,68.9),0); assert.equal(S.funnelPd({AK:1},{AK:1}),0); assert.equal(S.funnelPd({QQ:1},{AK:1}),1000);
// divisions
assert.equal(division(1750,{mastery:70,bossValidated:true,retention7dVerified:true}),'grinder');
assert.equal(division(2100,{mastery:95,bossValidated:true,retention7dVerified:false}),'master');
// machine à états
let m = newRun([4000,4000]);
m = reduce(m,{t:'ANSWER',i:0,action:'x',now:1}); assert.equal(m.locked.length,0);
m = reduce(m,{t:'OPEN',i:0,now:1000}); m = reduce(m,{t:'OPEN',i:0,now:3000});
m = reduce(m,{t:'ANSWER',i:0,action:'push',now:2500}); m = reduce(m,{t:'ANSWER',i:0,action:'fold',now:2600});
assert.deepEqual(m.locked,[{i:0,action:'push',elapsedMs:1500}]);
m = reduce(m,{t:'OPEN',i:1,now:5000}); m = reduce(m,{t:'TICK',now:9401}); assert.equal(m.phase.s,'done'); assert.equal(m.locked[1].action,null);
// daily, quêtes
assert.equal(dayKey(Date.parse('2026-11-27T00:30:00+01:00')),'daily-2026-11-26');
assert.deepEqual(medals(Array(15).fill({loss:0,pd:0,perfect:true,timeout:false,countedMs:2000})),['chirurgien','eclair']);
assert.equal(trapSpot([{spotIndex:1,answers:10,meanPd:900},{spotIndex:2,answers:40,meanPd:100}])!.spotIndex,2);
const q={id:'zt',skillPrefix:'pre.',target:20,maxMeanPd:1000,criticalPd:150,consecutive:true};
let p=emptyProgress(); for(let i=0;i<19;i++) p=advance(q,p,{eventId:''+i,skillId:'pre.a',variantSeed:''+i,pd:0,usedHint:false,firstSeen:true});
p=advance(q,p,{eventId:'0',skillId:'pre.a',variantSeed:'0',pd:0,usedHint:false,firstSeen:true}); assert.equal(p.done,false);
p=advance(q,p,{eventId:'19',skillId:'pre.a',variantSeed:'19',pd:151,usedHint:false,firstSeen:true}); assert.equal(p.window.length,0);
// partage
const src:any={bigBlind:0.02,playedAtMs:0,buttonSeat:2,hero:'SecretHero',heroCards:['As','5s'],board:['Ks','7d','2c'],
 seats:[{seat:1,name:'Alpha_Real',stack:2},{seat:2,name:'SecretHero',stack:2.11},{seat:3,name:'Gamma_Real',stack:1.5}],
 actions:[{street:'preflop',player:'Alpha_Real',type:'raise',amount:0.03,to:0.05,allIn:false,raw:'Alpha_Real raises'}],raw:'HandId #123',handId:'123'};
const sh=toShared(src,2*864e5); const j=JSON.stringify(sh); assert.ok(!/Real|Secret|123|raw|played/.test(j)); assert.equal(sh.heroLabel,'BTN');
assert.throws(()=>toShared(src,3600e3));
// vérification de l'exemple du cahier des charges
const weak={r:1200,rd:60,sigma:.06}, strong={r:1500,rd:60,sigma:.06};
console.log('E weak', expected(weak,strong).toFixed(3), 'delta if S=.48', (update(weak,[{opp:strong,score:.48 as any}]).r-1200).toFixed(2));
console.log('ALL OK');
})();
