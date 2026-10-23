import {test} from 'node:test';import assert from 'node:assert/strict';
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);},emit(...a){return Promise.all(this.listeners.map(f=>f(...a)));}});
const storage=()=>({data:{},async get(k){return {[k]:structuredClone(this.data[k])};},async set(v){Object.assign(this.data,structuredClone(v));}});
test('worker handles bursts, restores URLs, expires tabs and locks sponsor limits',async()=>{
 let all=[{id:1,windowId:1,url:'https://one.example'},{id:2,windowId:1,url:'https://two.example'}];let next=3;const alarms=new Map();
 globalThis.chrome={runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:event()},storage:{local:storage(),session:storage()},windows:{get:async()=>({type:'normal'})},action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},commands:{onCommand:event()},alarms:{onAlarm:event(),create:async(n,a)=>alarms.set(n,a),clear:async n=>alarms.delete(n)},tabs:{onCreated:event(),onUpdated:event(),onRemoved:event(),onReplaced:event(),query:async()=>structuredClone(all),get:async id=>{const t=all.find(t=>t.id===id);if(!t)throw Error('Missing tab');return t;},update:async(id,patch)=>Object.assign(all.find(t=>t.id===id),patch),remove:async id=>{all=all.filter(t=>t.id!==id);chrome.tabs.onRemoved.emit(id);},create:async opts=>{const t={id:next++,windowId:1,...opts};all.push(t);chrome.tabs.onCreated.emit(t);return t;}}};
 await chrome.storage.local.set({settings:{limit:2,minutes:15,paired:true,endpoint:'https://legacy.example',token:'legacy-secret'}});await import('../extension/background.js');
 const send=(type,data={},tab)=>new Promise(resolve=>chrome.runtime.onMessage.listeners[0]({type,...data},{id:'test',tab:tab?{id:tab}:undefined},resolve));await send('view');assert.equal(chrome.storage.local.data.settings.paired,false);assert.equal(chrome.storage.local.data.legacySponsorSettings.token,'legacy-secret');assert.equal(chrome.storage.local.data.settings.endpoint,undefined);
 const a=await chrome.tabs.create({url:'https://three.example'}),b=await chrome.tabs.create({url:'https://four.example'});let v=(await send('view')).data;assert.deepEqual(Object.keys(v.blocked),[String(a.id),String(b.id)]);assert.equal(all.find(t=>t.id===a.id).url,'chrome-extension://test/gate.html');assert.equal((await send('release',{},a.id)).ok,false);
 assert.equal((await send('release',{strategy:'fifo'},a.id)).ok,true);assert.equal(all.find(t=>t.id===a.id).url,'https://three.example');assert.ok(!all.some(t=>t.id===1));assert.equal((await send('release',{},b.id)).ok,false);
 await send('timer',{id:a.id,minutes:1});v=(await send('view')).data;assert.ok(v.meta[a.id].expires);assert.ok(alarms.has(`expire:${a.id}`));await send('cancelTimer',{id:a.id});assert.ok(!alarms.has(`expire:${a.id}`));
 chrome.storage.session.data.state.meta[a.id].expires=Date.now()-1;await chrome.alarms.onAlarm.emit({name:`expire:${a.id}`});await send('view');assert.ok(!all.some(t=>t.id===a.id));await send('release',{},b.id);assert.equal(all.find(t=>t.id===b.id).url,'https://four.example');
 await chrome.storage.local.set({settings:{limit:2,minutes:15,paired:true}});await send('settings',{limit:50,minutes:20});assert.equal(chrome.storage.local.data.settings.limit,2);
 const options=await chrome.tabs.create({url:'chrome-extension://test/settings.html'});v=(await send('view')).data;assert.ok(!v.tabs.some(t=>t.id===options.id));assert.ok(!v.blocked[options.id]);
});

test('worker signs full sponsor exchange, rejects replay and declined pairing requests',async()=>{
 const {identity,publicKey,sign,verify}=await import('../extension/sponsorship.js');
 let stored;globalThis.indexedDB={open(){const r={};queueMicrotask(()=>{r.result={close(){},transaction(){const t={objectStore(){return {get(){const q={};queueMicrotask(()=>{q.result=stored;q.onsuccess();});return q;},put(v){stored=v;queueMicrotask(()=>t.oncomplete());}};}};return t;}};r.onsuccess();});return r;}};
 const send=(type,data={})=>new Promise(resolve=>chrome.runtime.onMessage.listeners[0]({type,...data},{id:'test'},resolve));
 const ok=async(type,data={})=>{const r=await send(type,data);assert.equal(r.ok,true,r.error);return r.data;};
 await chrome.storage.local.set({settings:{limit:2,minutes:15,paired:false},social:{clients:{}}});
 const me=await ok('social'),sponsor=await identity(),sk=await publicKey(sponsor);
 const card=await sign(sponsor,{kind:'card',signer:sk,name:'Sponsor',email:'s@example.com'});
 const pair=await ok('pair',{code:card,name:'Participant',email:'p@example.com'}),p=await verify(pair.code);
 assert.equal(p.signer,me.self);assert.equal(chrome.storage.local.data.social.profile.email,'p@example.com');
 const decision={kind:'decision',signer:sk,participant:me.self,pairing:p.pairing,request:p.request,sequence:1,approved:true,limit:4};
 const approval=await sign(sponsor,decision);await ok('decision',{code:approval});assert.equal(chrome.storage.local.data.settings.limit,4);
 await ok('settings',{limit:99,minutes:10});assert.equal(chrome.storage.local.data.settings.limit,4);assert.equal((await send('decision',{code:approval})).ok,false);
 const req=await ok('request',{limit:6,reason:'Research'}),rp=await verify(req.code);assert.equal((await ok('request',{limit:9})).code,req.code);
 await ok('decision',{code:await sign(sponsor,{...decision,request:rp.request,sequence:2,approved:false})});assert.equal(chrome.storage.local.data.settings.limit,4);
 const req2=await ok('request',{limit:7}),rp2=await verify(req2.code);await ok('decision',{code:await sign(sponsor,{...decision,request:rp2.request,sequence:3,limit:7})});assert.equal(chrome.storage.local.data.settings.limit,7);
 // This installation can also act as sponsor for an independent participant.
 const other=await identity(),op=await publicKey(other),join={kind:'pair',signer:op,sponsor:me.self,pairing:'other-pair',request:'join',name:'Other',email:'o@example.com'};
 const joinCode=await sign(other,join),decline=await ok('decide',{code:joinCode,approved:false,limit:3});assert.equal((await verify(decline.code)).approved,false);
 const request=await sign(other,{kind:'request',signer:op,sponsor:me.self,pairing:'other-pair',request:'more',limit:5,reason:'More'});
 assert.equal((await send('decide',{code:request,approved:true,limit:5})).ok,false);
 const join2=await sign(other,{...join,pairing:'accepted-pair',request:'join2'});const accepted=await ok('decide',{code:join2,approved:true,limit:3});assert.equal((await verify(accepted.code)).sequence,1);
 assert.equal((await ok('decide',{code:join2,approved:true,limit:40})).code,accepted.code);
 const request2=await sign(other,{kind:'request',signer:op,sponsor:me.self,pairing:'accepted-pair',request:'more2',limit:5,reason:'More'});const approved=await ok('decide',{code:request2,approved:true,limit:5});assert.equal((await verify(approved.code)).sequence,2);
 // Initial decline on participant side permits a fresh pairing.
 await chrome.storage.local.set({social:{clients:{}},settings:{limit:2,minutes:15,paired:false}});
 const initial=await ok('pair',{code:card,name:'Participant',email:'p@example.com'}),ip=await verify(initial.code);
 await ok('decision',{code:await sign(sponsor,{...decision,pairing:ip.pairing,request:ip.request,approved:false})});assert.equal(chrome.storage.local.data.social.pairing,null);await ok('pair',{code:card,name:'Participant',email:'p@example.com'});
});
