import {$,send,run} from './common.js';
async function render(){const v=await send('view');const current=await chrome.tabs.getCurrent();const list=v.tabs.filter(t=>!v.blocked[t.id]&&t.id!==current.id);$('#count').textContent=`${list.length} of ${v.settings.limit} spaces in use`;$('#limit').value=v.settings.limit+1;$('#tabs').replaceChildren();
 for(const t of list){const row=document.createElement('div');row.className='tab';const info=document.createElement('div');info.className='info';const title=document.createElement('strong');title.textContent=t.title||'Untitled tab';const detail=document.createElement('small');try{detail.textContent=new URL(t.url).hostname||t.url;}catch{detail.textContent='Browser page';}if(t.pinned)detail.textContent+=' · Pinned';info.append(title,detail);const b=document.createElement('button');b.className='secondary';b.textContent='Close & use space';b.onclick=()=>run(async()=>{await send('release',{strategy:'specific',target:t.id});});row.append(info,b);$('#tabs').append(row);}}
for(const b of document.querySelectorAll('[data-strategy]'))b.onclick=()=>run(()=>send('release',{strategy:b.dataset.strategy}));
$('#continue').onclick=()=>run(()=>send('release'));
$('#refresh').onclick=()=>run(async()=>{const r=await send('decision',{code:$('#decision').value});if(!r.approved)throw Error('Your sponsor declined this request.');await send('release');});
$('#request').onsubmit=e=>{e.preventDefault();run(async()=>{const r=await send('request',{limit:$('#limit').value,reason:$('#reason').value});$('#outgoing').value=r.code;$('#status').textContent='Copy this request and send it to your sponsor. Nothing has been sent automatically.';});};
chrome.tabs.onRemoved.addListener(()=>run(render));run(render);

$('#copy').onclick=()=>run(async()=>{if(!$('#outgoing').value)throw Error('Create a request first.');await navigator.clipboard.writeText($('#outgoing').value);$('#status').textContent='Copied.';});
