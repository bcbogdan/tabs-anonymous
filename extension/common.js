export const $=s=>document.querySelector(s);
export async function send(type,data={}){const r=await chrome.runtime.sendMessage({type,...data});if(!r.ok)throw Error(r.error);return r.data;}
export async function run(fn){try{$('#status').textContent='';await fn();}catch(e){$('#status').textContent=e.message;}}
