// T2 generated-level qualification through actual user controls. No app-state injection.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const out=process.env.FALLLINE_OUTPUT,origin=process.env.FALLLINE_URL;
assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
const {chromium}=await import(process.env.FALLLINE_PLAYWRIGHT);
const manifest=JSON.parse(await readFile(process.env.FALLLINE_MANIFEST,'utf8'));
const allowed=new Set(['/',...manifest.map(x=>'/'+x.path)]);
const names=['G01','G02','G03','G04','G05','G06'];
const report={source:process.env.GITHUB_SHA,tier:'T2',node:process.version,origin,browserChannel:'chromium',cases:[],requests:[],errors:[],unexpected:[],passed:false,virtualMs:0};
const browsers=[],contexts=[],native=[];
const selected=new Set((process.env.FALLLINE_CASES||names.join(',')).split(','));
assert.ok(selected.size&&[...selected].every(x=>names.includes(x)));
let current,currentPage;
await mkdir(out,{recursive:true});
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
async function launch(disabled=false){
 const server=await chromium.launchServer({headless:true,channel:'chromium',args:disabled?['--disable-local-storage']:[]});
 const child=server.process(),browser=await chromium.connect(server.wsEndpoint());
 browsers.push({browser,server});native.push(child);report.browser=browser.version();
 return browser;
}
async function profile(browser,options={},corrupt=false){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:false,...options});contexts.push(ctx);
 await ctx.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  const item={method:r.method(),path:u.origin+u.pathname,query:Boolean(u.search),body:r.postDataBuffer()?.length||0};
  report.requests.push(item);
  if(u.origin!==origin||!allowed.has(u.pathname)||u.search||!['GET','HEAD'].includes(r.method())||item.body){report.unexpected.push(item);await route.abort();}else await route.continue();
 });
 ctx.on('requestfailed',r=>report.errors.push(r.url()+' '+r.failure()?.errorText));
 await ctx.addInitScript(()=>{window.addEventListener('unhandledrejection',e=>{window.__unhandled=String(e.reason);});});
 if(corrupt)await ctx.addInitScript(()=>{if(!sessionStorage.getItem('fallline-gen-negative-seeded')){localStorage.setItem('fallline.v1','{authored-corrupt');localStorage.setItem('fallline-gen-unrelated','keep');sessionStorage.setItem('fallline-gen-negative-seeded','1');}});
 const page=await ctx.newPage();page.setDefaultTimeout(8000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('websocket',s=>report.unexpected.push({websocket:s.url()}));
 await page.clock.install({time:new Date('2026-11-15T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-15T12:00:01Z'));
 await page.goto(origin,{waitUntil:'networkidle'});await advance(page,200);assert.equal(await page.locator('body').getAttribute('data-mode'),'menu');
 return {ctx,page};
}
async function advance(p,ms){assert.ok((report.virtualMs+=ms)<=1500000,'Aggregate virtual clock budget');for(let n=0;n<ms;n+=Math.min(500,ms-n))await p.clock.runFor(Math.min(500,ms-n));}
async function snap(p){
 return p.evaluate(()=>Object.fromEntries(['next-flag','speed','run-time','flags','rider-status','wind-value','penalty','ride-event','result-title','result-detail','record-message','campaign-level'].map(id=>[id,document.getElementById(id).textContent]).concat([['mode',document.body.dataset.mode]])));
}
async function readSave(p){return p.evaluate(()=>JSON.parse(localStorage.getItem('fallline.v1')));}
async function pixels(p){
 return p.evaluate(async()=>{const c=document.getElementById('slope'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const colors=new Set();for(let i=0;i<d.length;i+=Math.max(4,Math.floor(d.length/800/4)*4))colors.add(d.slice(i,i+4).join(','));return{width:c.width,height:c.height,colors:colors.size,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',d))).map(x=>x.toString(16).padStart(2,'0')).join('')};});
}
async function fit(p,selectors){
 const result=await p.evaluate(selectors=>({innerWidth,innerHeight,width:document.documentElement.scrollWidth,mountain:(()=>{const r=document.getElementById('mountain').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})(),buttons:selectors.flatMap(s=>[...document.querySelectorAll(s)]).filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.dataset.action,x:r.x,y:r.y,width:r.width,height:r.height};})}),selectors);
 assert.ok(result.width<=result.innerWidth,'No horizontal page overflow');assert.equal(result.mountain.x,0);assert.equal(result.mountain.y,0);assert.ok(result.mountain.height>=result.innerHeight-1);
 for(const b of result.buttons)assert.ok(b.x>=-1&&b.x+b.width<=result.innerWidth+1&&b.y>=-1&&b.y+b.height<=result.innerHeight+1&&b.width>=32&&b.height>=32,'Reachable control '+b.id);
 const image=await pixels(p);assert.ok(image.width>0&&image.height>0&&image.colors>=12,'Real varied Canvas pixels');return{...result,pixels:image};
}
async function screen(p,name){await p.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
async function menu(p){const mode=await p.locator('body').getAttribute('data-mode');if(mode==='riding'){await p.keyboard.press('KeyP');await p.locator('#pause-menu-button').click();}else if(mode==='paused')await p.locator('#pause-menu-button').click();else if(mode==='result')await p.locator('#result-menu-button').click();await advance(p,200);assert.equal(await p.locator('body').getAttribute('data-mode'),'menu');}
async function start(p){await p.locator('#start-button').click();await advance(p,200);assert.equal(await p.locator('body').getAttribute('data-mode'),'riding');}
async function choose(p,index){await menu(p);await p.locator('.run-option').nth(index).click();await advance(p,200);const id=await p.locator('#saved-levels').inputValue();assert.match(id,/^v2-(meadow|pines|ridge|glacier|sunset|storm)-[1-9]\d*-[1-9]\d?$/);return id;}
async function pilot(p,row){
 let previous=null,filteredVx=0;
 row.frames=[];row.virtualMs=0;
 for(let tick=0;tick<900;tick++){
  const s=await snap(p);row.frames.push(s);if(tick%25===0)await writeFile(path.join(out,'generated-browser.json'),JSON.stringify(report,null,2)+'\n');if(row.frames.length>18)row.frames.shift();if(s.mode!=='riding')break;
  const m=/^Flag (\d+) · (\d+) m ahead(?: · (\d+) m (right|left))?/.exec(s['next-flag']);
  const speed=Number.parseFloat(s.speed)/3.6,w=/Gust ([\d.]+) m\/s (→|←)/.exec(s['wind-value']),wind=w?Number(w[1])*(w[2]==='→'?1:-1):0;
  let turn=0;
  if(m){
   const error=m[3]?Number(m[3])*(m[4]==='right'?1:-1):0,distance=Number(m[2]);
   if(previous&&previous.flag===m[1]&&previous.error&&error)filteredVx=.7*filteredVx+.3*(previous.error-error)/.2;else filteredVx*=.6;
   const desired=clamp(error/Math.max(1.1,distance/Math.max(1,speed))*1.25,-7,7);
   turn=clamp(Math.asin(clamp((desired-wind*.35)/Math.max(1,speed),-.6,.6))/.68+(desired-filteredVx)*.035,-.7,.7);
   previous={flag:m[1],error};
  }
  const held=Math.abs(turn)<.045?0:Math.min(140,Math.max(17,Math.round(Math.abs(turn)*200)));
  if(held){const key=turn>0?'ArrowRight':'ArrowLeft';await p.keyboard.down(key);await advance(p,held);await p.keyboard.up(key);}
  await advance(p,200-held);row.virtualMs+=200;
 }
 for(const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyX'])await p.keyboard.up(key);
 const end=await snap(p);row.end=end;
 assert.equal(end.mode,'result','Actual ride must reach a result');assert.match(end['result-title'],/good line/,'Ordinary keyboard pilot must finish the generated course');
 const [passed,total]=(end.flags.match(/\d+/g)||[]).map(Number);assert.ok(total>=9&&passed>=Math.floor(total*.6),'Actual earned gates');
 const frozen=await p.locator('#result-overlay').textContent();await advance(p,1000);assert.equal(await p.locator('#result-overlay').textContent(),frozen);
 return{passed,total};
}
async function run(id,title,action){if(!selected.has(id))return;const row={id,title,status:'running'};report.cases.push(row);current=row;try{await action(row);row.status='passed';}catch(e){row.status='failed';row.error=e.stack;if(currentPage){try{await screen(currentPage,'failure-'+id);}catch{}}throw e;}finally{current=null;currentPage=null;await writeFile(path.join(out,'generated-browser.json'),JSON.stringify(report,null,2)+'\n');}}
try{
 const main=await launch(),desktop=await profile(main),p=desktop.page;
 await run('G01','Generated game menu, six maps, fresh terrain and native saved-level replay',async row=>{
  currentPage=p;row.maps=[];assert.equal(await p.locator('.run-option').count(),6);assert.equal(await p.locator('.field-guide').isVisible(),false);assert.equal(await p.locator('.site-footer').isVisible(),false);
  assert.equal(await p.locator('#saved-levels option').count(),1);
  for(let i=0;i<6;i++){const id=await choose(p,i);row.maps.push({id,description:await p.locator('#run-description').textContent(),pixels:await pixels(p)});}
  assert.equal(new Set(row.maps.map(x=>x.id.split('-')[1])).size,6);assert.equal(new Set(row.maps.map(x=>x.pixels.sha256)).size,6);
  const before=await p.locator('#saved-levels').inputValue();await p.locator('#new-map-button').click();await advance(p,200);const after=await p.locator('#saved-levels').inputValue();assert.notEqual(after,before);assert.equal(after.split('-')[1],before.split('-')[1]);
  const save=await readSave(p);assert.ok(save.progress.levels.includes(before)&&save.progress.levels.includes(after));assert.equal(Object.keys(save.records).length,0);
  await p.reload({waitUntil:'networkidle'});await advance(p,200);assert.equal(await p.locator('#saved-levels').inputValue(),after);
  await p.locator('#saved-levels').selectOption(before);await advance(p,200);assert.equal(await p.locator('#saved-levels').inputValue(),before);
  row.replay={before,after,restored:(await readSave(p)).runId};row.fit=await fit(p,['#start-button','#new-map-button','#free-button','.run-option']);
  await p.locator('#guide-button').click();await p.locator('#guide-dialog').waitFor({state:'visible'});await p.keyboard.press('Escape');assert.equal(await p.locator('#guide-dialog').isVisible(),false);await screen(p,'desktop-menu');
 });
 await run('G04','Faster native keyboard start, observed gust drift, landed spin and real pause freeze',async row=>{
  currentPage=p;await choose(p,0);await start(p);row.open=await snap(p);assert.ok(Number.parseFloat(row.open.speed)>=65);
  row.desktopWind=await p.evaluate(()=>{const a=document.getElementById('wind-value').getBoundingClientRect(),b=document.getElementById('ride-toolbar').getBoundingClientRect();return{wind:{x:a.x,y:a.y,width:a.width,height:a.height},toolbar:{x:b.x,y:b.y,width:b.width,height:b.height},overlap:a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y};});assert.equal(row.desktopWind.overlap,false,'Wind badge must not obscure pause controls');
  await p.keyboard.down('KeyX');await advance(p,500);row.grounded=await snap(p);assert.match(row.grounded['rider-status'],/0 PTS/);await p.keyboard.down('Space');await advance(p,500);row.air=await snap(p);assert.match(row.air['rider-status'],/AIR/);assert.match(row.air['rider-status'],/0 PTS/);await screen(p,'desktop-spin-air');
  await advance(p,3500);await p.keyboard.up('Space');await p.keyboard.up('KeyX');row.landed=await snap(p);assert.match(row.landed['rider-status'],/^RIDING/);assert.ok(Number(row.landed['rider-status'].match(/(\d+) PTS/)[1])>=100);assert.match(row.landed['wind-value'],/Gust [\d.]+ m\/s [→←]/);
  await p.keyboard.down('ArrowRight');await advance(p,200);await p.keyboard.press('KeyP');const frozen=await snap(p);await advance(p,1200);assert.deepEqual(await snap(p),frozen);assert.equal(frozen.mode,'paused');await p.keyboard.up('ArrowRight');await p.locator('#resume-button').click();await advance(p,200);assert.equal((await snap(p)).mode,'riding');row.paused=frozen;await menu(p);
 });
 await run('G05','Actual narrow native multitouch spin, release/cancellation and game menus',async row=>{
  const mobile=await profile(main,{viewport:{width:390,height:844},hasTouch:true,isMobile:true},true),m=mobile.page;currentPage=m;
  await choose(m,0);assert.equal(await m.evaluate(()=>localStorage.getItem('fallline-gen-unrelated')),'keep');await start(m);
  const cdp=await mobile.ctx.newCDPSession(m);
  async function points(actions){return Promise.all(actions.map(async(action,i)=>{const b=await m.locator('[data-action="'+action+'"]').boundingBox();assert.ok(b);return{x:b.x+b.width/2,y:b.y+b.height/2,id:i+1,radiusX:2,radiusY:2,force:1};}));}
  try{
   const touches=await points(['jump','trick']);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});await advance(m,500);row.air=await snap(m);assert.match(row.air['rider-status'],/AIR/);assert.match(row.air['rider-status'],/0 PTS/);
   await advance(m,3500);row.landed=await snap(m);assert.match(row.landed['rider-status'],/^RIDING/);assert.ok(Number(row.landed['rider-status'].match(/(\d+) PTS/)[1])>=100);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await advance(m,200);
   assert.deepEqual(await m.locator('[data-action]').evaluateAll(es=>es.filter(e=>e.dataset.held==='true').map(e=>e.dataset.action)),[]);
   const contact=await points(['brake']);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:contact});await advance(m,400);row.braked=await snap(m);assert.ok(Number.parseFloat(row.braked.speed)<Number.parseFloat(row.landed.speed));await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await advance(m,200);assert.equal(await m.locator('[data-action="brake"]').getAttribute('data-held'),'false');
   row.fit390=await fit(m,['[data-action]','#pause-button']);await screen(m,'mobile-390');
   await m.setViewportSize({width:320,height:844});await advance(m,200);row.fit320=await fit(m,['[data-action]','#pause-button']);await screen(m,'mobile-320');
   await m.locator('#pause-button').tap();await m.locator('#pause-menu-button').tap();await advance(m,200);await m.locator('#new-map-button').tap();const saved=await m.locator('#saved-levels').inputValue();await m.reload({waitUntil:'networkidle'});await advance(m,200);assert.equal(await m.locator('#saved-levels').inputValue(),saved);assert.equal(await m.evaluate(()=>localStorage.getItem('fallline-gen-unrelated')),'keep');await screen(m,'mobile-menu-320');
  }finally{await cdp.detach();}
 });
 await run('G02','Six real generated course finishes, next difficulty, exact replay and persistent earned records',async row=>{
  currentPage=p;row.courses=[];let first;
  for(let i=0;i<6;i++){
   const id=await choose(p,i),before=await readSave(p);await start(p);const attempt={id,levelBefore:before.progress.level};row.activeCourse=attempt;await pilot(p,attempt);delete row.activeCourse;const after=await readSave(p),record=after.records[id];assert.ok(record);assert.ok(record.passed+record.missed>=9);assert.ok(Math.abs(record.adjustedTime-record.time-record.missed*4)<1e-6);assert.equal(after.progress.level,before.progress.level+1);assert.ok(after.progress.completed.includes(id));attempt.record=record;attempt.levelAfter=after.progress.level;row.courses.push(attempt);
   if(i===0){
    first=id;const level=after.progress.level;await p.locator('#next-level-button').click();await advance(p,200);row.next=await snap(p);row.next.id=await p.locator('#saved-levels').inputValue();assert.equal(Number(row.next.id.split('-').at(-1)),level);assert.notEqual(row.next.id,id);await menu(p);await p.locator('#saved-levels').selectOption(id);await start(p);row.replay={id};await pilot(p,row.replay);assert.equal((await readSave(p)).progress.level,level);
   }
  }
  await menu(p);const earned=await readSave(p);await p.reload({waitUntil:'networkidle'});await advance(p,200);assert.deepEqual((await readSave(p)).records,earned.records);assert.equal((await readSave(p)).progress.level,7);assert.ok(earned.records[first]);row.persisted=earned;await screen(p,'earned-levels');
 });
 await run('G03','Changed course crash, free entry and guide/restart retain actual earned records',async row=>{
  currentPage=p;await choose(p,0);const before=await readSave(p);await start(p);await p.keyboard.down('ArrowRight');await p.keyboard.down('ArrowUp');
  for(let i=0;i<80&&(await snap(p)).mode==='riding';i++)await advance(p,500);
  await p.keyboard.up('ArrowRight');await p.keyboard.up('ArrowUp');row.crash=await snap(p);assert.equal(row.crash.mode,'result');assert.match(row.crash['result-title'],/another run/);assert.deepEqual((await readSave(p)).records,before.records);assert.equal((await readSave(p)).progress.level,before.progress.level);
  await p.locator('#again-button').click();await advance(p,200);await p.locator('#guide-button').click();const frozen=await snap(p);await advance(p,1000);assert.deepEqual(await snap(p),frozen);await p.keyboard.press('Escape');assert.equal((await snap(p)).mode,'paused');await p.locator('#restart-button').click();await advance(p,300);assert.equal((await snap(p)).mode,'riding');await menu(p);await p.locator('#free-button').click();await advance(p,2500);row.free=await snap(p);assert.equal(row.free.mode,'riding');assert.equal(row.free.penalty,'Free ride');assert.deepEqual((await readSave(p)).records,before.records);await menu(p);
 });
 // Close the five-case main profile completely before opening the isolated storage profile.
 for(const ctx of contexts)for(const p of ctx.pages())assert.equal(await p.evaluate(()=>window.__unhandled||null),null);
 const closed=[];
 for(const ctx of contexts.splice(0))await ctx.close();
 for(const item of browsers.splice(0)){
  const child=item.server.process();await item.browser.close();await item.server.close();
  let absent=false;try{process.kill(child.pid,0);}catch(e){absent=e.code==='ESRCH';}
  const row={pid:child.pid,exitCode:child.exitCode,absent};closed.push(row);
  assert.equal(row.exitCode,0,'Main native process must exit normally before storage profile');assert.equal(row.absent,true);
 }
 report.mainProfileClosure={contextsClosed:true,native:closed,closedCaseIds:report.cases.filter(c=>c.status==='passed').map(c=>c.id)};
 await writeFile(path.join(out,'generated-browser.json'),JSON.stringify(report,null,2)+'\n');
 await run('G06','Native disabled storage still permits a real completed generated course without saved claim',async row=>{
  const disabled=await launch(true),s=await profile(disabled),d=s.page;currentPage=d;
  row.native=await d.evaluate(()=>{let read=false,write=false;try{localStorage.getItem('fallline.v1');}catch{read=true;}try{localStorage.setItem('fallline.v1','never');}catch{write=true;}sessionStorage.setItem('fallline-gen-session','keep');return{readDenied:read,writeDenied:write};});assert.deepEqual(row.native,{readDenied:true,writeDenied:true});
  assert.equal(await d.locator('#storage-notice').isVisible(),true);await choose(d,0);await start(d);await pilot(d,row);assert.match(await d.locator('#record-message').textContent(),/this visit/);assert.doesNotMatch(await d.locator('#record-message').textContent(),/Saved on this device/);await d.reload({waitUntil:'networkidle'});await advance(d,200);assert.match(await d.locator('#best-note').textContent(),/first tracks/);assert.equal(await d.evaluate(()=>sessionStorage.getItem('fallline-gen-session')),'keep');
 });
 for(const ctx of contexts)for(const p of ctx.pages())assert.equal(await p.evaluate(()=>window.__unhandled||null),null);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.unexpected,[]);assert.equal(report.cases.length,selected.size);assert.ok(report.cases.every(c=>c.status==='passed'));report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{
 const failures=[];for(const ctx of contexts){try{await ctx.close();}catch(e){failures.push(String(e));}}
 for(const item of browsers){try{await item.browser.close();}catch(e){failures.push(String(e));}try{await item.server.close();}catch(e){failures.push(String(e));}}
 report.cleanup={contextsClosed:failures.length===0,failures,native:native.map(p=>{let absent=false;try{process.kill(p.pid,0);}catch(e){absent=e.code==='ESRCH';}return{pid:p.pid,exitCode:p.exitCode,absent};})};
 report.passed=report.passed&&failures.length===0&&report.errors.length===0&&report.unexpected.length===0&&report.cleanup.native.every(p=>p.absent&&p.exitCode===0);
 await writeFile(path.join(out,'generated-browser.json'),JSON.stringify(report,null,2)+'\n');if(!report.passed)process.exitCode=1;
}
