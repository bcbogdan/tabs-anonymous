// All signed payloads use one deterministic encoding. No network dependency.
const enc=new TextEncoder();
const canonical=v=>JSON.stringify(v && typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const un64=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const alg={name:'ECDSA',namedCurve:'P-256'};
export async function identity(){return crypto.subtle.generateKey(alg,false,['sign','verify']);}
export async function publicKey(keys){return b64(await crypto.subtle.exportKey('spki',keys.publicKey));}
export async function fingerprint(key){return b64(await crypto.subtle.digest('SHA-256',enc.encode(key)));}
export async function sign(keys,payload){const p={...payload,v:1};return 'TA1.'+b64(enc.encode(JSON.stringify({payload:p,signature:b64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,enc.encode(canonical(p))))})));}
export async function verify(code){
 if(typeof code!=='string'||code.length>16000||!code.trim().startsWith('TA1.'))throw Error('Paste a complete Tabs Anonymous code.');
 let e;try{e=JSON.parse(new TextDecoder().decode(un64(code.trim().slice(4))));}catch{throw Error('Invalid exchange code.');}
 const p=e.payload; if(!p||p.v!==1||!['card','pair','request','decision'].includes(p.kind)||typeof p.signer!=='string')throw Error('Unsupported message.');
 const schemas={card:['v','kind','signer','name','email'],pair:['v','kind','signer','sponsor','pairing','request','name','email'],request:['v','kind','signer','sponsor','pairing','request','limit','reason'],decision:['v','kind','signer','participant','pairing','request','sequence','approved','limit']};
 if(Object.keys(p).sort().join()!==schemas[p.kind].sort().join())throw Error('Unexpected message fields.');
 for(const field of ['signer','sponsor','participant','pairing','request','name','email','reason'])if(field in p&&(typeof p[field]!=='string'||p[field].length>1500))throw Error('Invalid message field.');
 if('limit'in p&&(!Number.isInteger(p.limit)||p.limit<1||p.limit>500))throw Error('Invalid tab budget.');
 if(p.kind==='decision'&&(!Number.isSafeInteger(p.sequence)||p.sequence<1||typeof p.approved!=='boolean'))throw Error('Invalid decision.');
 if('email'in p&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))throw Error('Invalid email address.');
 let ok=false;try{const k=await crypto.subtle.importKey('spki',un64(p.signer),alg,false,['verify']);ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},k,un64(e.signature),enc.encode(canonical(p)));}catch{}
 if(!ok)throw Error('Signature verification failed.');return p;
}
export async function processDecision(state,code,self){
 const p=await verify(code), b=state.pairing;
 if(p.kind!=='decision'||!b||p.signer!==b.sponsor.signer||p.participant!==self||p.pairing!==b.id)throw Error('This decision is not from your paired sponsor or is for someone else.');
 if(p.sequence<=b.sequence)throw Error('This decision was already used or is older than your current decision.');
 if(!b.pending||p.request!==b.pending.request)throw Error('This decision does not match your pending request.');
 b.sequence=p.sequence;b.pending=null;if(p.approved)b.active=true;
 state.lastDecision=p;return p;
}
export async function loadIdentity(){
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('tabs-anonymous-identity',1);r.onupgradeneeded=()=>r.result.createObjectStore('keys');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const read=()=>new Promise((resolve,reject)=>{const r=db.transaction('keys').objectStore('keys').get('identity');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 let k=await read();if(!k){k=await identity();await new Promise((resolve,reject)=>{const t=db.transaction('keys','readwrite');t.objectStore('keys').put(k,'identity');t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}db.close();return k;
}
