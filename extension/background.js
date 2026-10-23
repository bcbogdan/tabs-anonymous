import {loadIdentity,publicKey,fingerprint,sign,verify,processDecision} from './sponsorship.js';
import {choose, positive, destination} from './policy.js';
const gate = chrome.runtime.getURL('gate.html');
let chain = Promise.resolve();
const serial = fn => { const next=chain.then(fn); chain=next.catch(console.error); return next; };
const defaults={limit:8,minutes:15,paired:false};
let keyPromise;const keys=()=>keyPromise ||= loadIdentity();
async function social(){return (await chrome.storage.local.get('social')).social||{clients:{}};}
async function saveSocial(value){await chrome.storage.local.set({social:value});}

async function settings(){return {...defaults,...(await chrome.storage.local.get('settings')).settings};}
async function state(){return (await chrome.storage.session.get('state')).state || {meta:{},blocked:{}};}
async function save(s){await chrome.storage.session.set({state:s});}
async function tabs(){return (await chrome.tabs.query({windowType:'normal'})).filter(t=>!t.incognito && (!(t.url||t.pendingUrl||'').startsWith(chrome.runtime.getURL('')) || (t.url||t.pendingUrl)===gate));}
async function enforce(){
 const s=await state(), c=await settings(), all=await tabs(), live=new Set(all.map(t=>String(t.id)));
 for(const id of Object.keys(s.meta)) if(!live.has(id)){delete s.meta[id];delete s.blocked[id];}
 for(const t of all) s.meta[t.id] ||= {born:Date.now()};
 // Existing pages are grandfathered; only newly created tabs are gated.
 const admitted=all.filter(t=>!s.blocked[t.id]);
 await save(s);
 for(const t of all) if(s.blocked[t.id] && t.url!==gate) await chrome.tabs.update(t.id,{url:gate}).catch(()=>{});
 await chrome.action.setBadgeText({text:String(admitted.length)});
 await chrome.action.setBadgeBackgroundColor({color:'#356250'});
}
async function created(t){
 if(t.incognito || ((t.pendingUrl||t.url||'').startsWith(chrome.runtime.getURL('')) && (t.pendingUrl||t.url)!==gate) || (await chrome.windows.get(t.windowId)).type!=='normal')return;
 const s=await state(); s.meta[t.id] ||= {born:Date.now()};
 const c=await settings(), all=await tabs();
 if(all.filter(x=>!s.blocked[x.id]).length>c.limit) s.blocked[t.id]={url:destination(t.pendingUrl||t.url)};
 await save(s); await enforce();
}
async function release(id,strategy,target){
 const s=await state(), c=await settings(); if(!s.blocked[id])throw Error('This tab is no longer waiting.');
 const all=await tabs(), admitted=all.filter(t=>!s.blocked[t.id]&&t.id!==id);
 if(strategy){
 const victim=strategy==='specific'?admitted.find(t=>t.id===Number(target)):choose(admitted,s.meta,strategy);
 if(!victim)throw Error('That tab has already closed.'); await chrome.tabs.remove(victim.id);
 }
 const remaining=(await tabs()).filter(t=>!s.blocked[t.id]&&t.id!==id);
 if(remaining.length>=c.limit)throw Error('More room is needed. Close another tab or ask your sponsor.');
 const url=s.blocked[id].url; delete s.blocked[id]; await save(s); await chrome.tabs.update(id,{url});
}
async function lifetime(id,minutes){
 const n=positive(minutes,1440),s=await state(); if(!(await tabs()).some(t=>t.id===id))throw Error('Choose a tab in a normal browsing window.');
 s.meta[id] ||= {born:Date.now()}; s.meta[id].expires=Date.now()+n*60000; await save(s);
 await chrome.alarms.create(`expire:${id}`,{when:s.meta[id].expires});
}
async function handle(m,sender){
 if(sender.id!==chrome.runtime.id)throw Error('Not allowed');
 const c=await settings(),s=await state();
 switch(m.type){
 case 'view':return {settings:c,tabs:await tabs(),...s};
 case 'release':return release(sender.tab?.id,m.strategy,m.target);
 case 'timer':return lifetime(Number(m.id),m.minutes);
 case 'cancelTimer':delete s.meta[m.id]?.expires;await save(s);return chrome.alarms.clear(`expire:${m.id}`);
 case 'ephemeral':{const t=await chrome.tabs.create({url:'chrome://newtab/'});await lifetime(t.id,c.minutes);return;}
 case 'social':{const st=await social(),self=await publicKey(await keys());return {...st,self,fingerprint:await fingerprint(self)};}
 case 'card':{const k=await keys(),st=await social();const code=await sign(k,{kind:'card',signer:await publicKey(k),name:String(m.name).trim().slice(0,100),email:String(m.email).trim()});await verify(code);st.card=code;st.lastOutgoing={code};st.profile={name:String(m.name).trim(),email:String(m.email).trim()};await saveSocial(st);return {code};}
 case 'inspect':{const p=await verify(m.code);return {payload:p,fingerprint:await fingerprint(p.signer)};}
 case 'pair':{
 const st=await social();if(st.pairing?.active||st.pairing?.pending)throw Error('A sponsorship is already active or pending.');
 const sponsor=await verify(m.code);if(sponsor.kind!=='card')throw Error('Import a sponsor card.');const k=await keys(),self=await publicKey(k);if(self===sponsor.signer)throw Error('Choose another person as your sponsor.');
 const p={kind:'pair',signer:self,sponsor:sponsor.signer,pairing:crypto.randomUUID(),request:crypto.randomUUID(),name:String(m.name).trim().slice(0,100),email:String(m.email).trim()};
 const code=await sign(k,p);await verify(code);st.pairing={id:p.pairing,sponsor,sequence:0,active:false,pending:p};st.outgoing=code;st.profile={name:p.name,email:p.email};st.lastOutgoing={code,email:sponsor.email};await saveSocial(st);return {code,email:sponsor.email};}
 case 'request':{
 const st=await social();if(!st.pairing?.active)throw Error('Pair with your sponsor in settings first.');if(st.pairing.pending) return {code:st.outgoing,email:st.pairing.sponsor.email};
 const p={kind:'request',signer:await publicKey(await keys()),sponsor:st.pairing.sponsor.signer,pairing:st.pairing.id,request:crypto.randomUUID(),limit:positive(m.limit),reason:String(m.reason||'').slice(0,500)};
 st.pairing.pending=p;st.outgoing=await sign(await keys(),p);st.lastOutgoing={code:st.outgoing,email:st.pairing.sponsor.email};await saveSocial(st);return {code:st.outgoing,email:st.pairing.sponsor.email};}
 case 'decide':{
 const st=await social(),k=await keys(),self=await publicKey(k),p=await verify(m.code);
 if(!['pair','request'].includes(p.kind)||p.sponsor!==self)throw Error('This request is not addressed to you.');
 let client=st.clients[p.pairing];
 if(p.kind==='request'&&(!client||!client.active||client.participant!==p.signer))throw Error('Accept this participant’s pairing request first.');
 if(client&&client.participant!==p.signer)throw Error('Pairing identity mismatch.');
 client ||= {participant:p.signer,sequence:0,used:{},name:p.name,email:p.email};
 if(client.used[p.request])return {code:client.used[p.request],email:client.email};
 if(p.kind==='pair'&&client.sequence)throw Error('This pairing has already been decided.');
 const decision={kind:'decision',signer:self,participant:p.signer,pairing:p.pairing,request:p.request,sequence:client.sequence+1,approved:m.approved===true,limit:positive(m.limit)};
 const code=await sign(k,decision);client.sequence=decision.sequence;if(p.kind==='pair')client.active=decision.approved;client.used[p.request]=code;st.clients[p.pairing]=client;st.sponsorOutgoing=code;st.lastOutgoing={code,email:client.email};await saveSocial(st);return {code,email:client.email};}
 case 'decision':{
 const st=await social(),p=await processDecision(st,m.code,await publicKey(await keys()));
 if(p.approved){c.limit=p.limit;c.paired=true;} else if(!st.pairing.active){st.pairing=null;}
 await chrome.storage.local.set({social:st,settings:c});await enforce();return {approved:p.approved,limit:c.limit};}
 case 'settings':{
 c.minutes=positive(m.minutes,1440); if(!c.paired)c.limit=positive(m.limit);
 await chrome.storage.local.set({settings:c});await enforce();return;}
 default:throw Error('Unknown action');
 }
}
chrome.runtime.onMessage.addListener((m,sender,respond)=>{serial(()=>handle(m,sender)).then(data=>respond({ok:true,data}),e=>respond({ok:false,error:e.message}));return true;});
chrome.tabs.onCreated.addListener(t=>serial(()=>created(t)));
chrome.tabs.onUpdated.addListener((id,change)=>serial(async()=>{
 if(!change.url)return;const s=await state();if(s.blocked[id]&&change.url!==gate){s.blocked[id].url=destination(change.url);await save(s);await chrome.tabs.update(id,{url:gate});}
}));
chrome.tabs.onRemoved.addListener(id=>serial(async()=>{const s=await state();delete s.meta[id];delete s.blocked[id];await save(s);await chrome.alarms.clear(`expire:${id}`);}));
chrome.tabs.onReplaced.addListener((added,removed)=>serial(async()=>{const s=await state();if(s.meta[removed])s.meta[added]=s.meta[removed];if(s.blocked[removed])s.blocked[added]=s.blocked[removed];delete s.meta[removed];delete s.blocked[removed];await save(s);await enforce();}));
chrome.commands.onCommand.addListener(cmd=>{if(cmd==='ephemeral')serial(async()=>{const c=await settings(),t=await chrome.tabs.create({url:'chrome://newtab/'});await lifetime(t.id,c.minutes);});});
chrome.alarms.onAlarm.addListener(a=>serial(async()=>{
 if(a.name==='heartbeat') {const s=await state();for(const [id,m] of Object.entries(s.meta))if(m.expires&&m.expires<=Date.now())await chrome.tabs.remove(Number(id)).catch(()=>{});return;}
 if(a.name.startsWith('expire:')){const id=Number(a.name.slice(7)),s=await state();if(s.meta[id]?.expires<=Date.now())await chrome.tabs.remove(id).catch(()=>{});}
}));
serial(async()=>{const old=(await chrome.storage.local.get('settings')).settings;if(old?.endpoint||old?.token){await chrome.storage.local.set({legacySponsorSettings:old,settings:{limit:old.limit||8,minutes:old.minutes||15,paired:false}});}if(typeof indexedDB!=='undefined')await keys();await chrome.alarms.create('heartbeat',{periodInMinutes:0.5});await enforce();});
