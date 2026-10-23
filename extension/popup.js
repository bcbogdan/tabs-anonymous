import {$,send,run} from './common.js';
run(async()=>{const v=await send('view');$('#count').textContent=`${v.tabs.filter(t=>!v.blocked[t.id]).length} / ${v.settings.limit} tabs`;$('#minutes').value=v.settings.minutes;$('#connection').textContent=v.settings.paired?'Your sponsor holds the budget.':'Solo mode · connect a sponsor in settings.';const commands=await chrome.commands.getAll();$('#shortcut').textContent=`${v.settings.minutes} minutes of space · ${commands.find(c=>c.name==='ephemeral')?.shortcut||'Set a shortcut in Chrome'}`;});
$('#ephemeral').onclick=()=>run(async()=>{await send('ephemeral');window.close();});
$('#timer').onclick=()=>run(async()=>{const [t]=await chrome.tabs.query({active:true,currentWindow:true});await send('timer',{id:t.id,minutes:$('#minutes').value});$('#status').textContent='Lifetime set. This tab will close automatically, including unsaved work.';});
$('#cancel').onclick=()=>run(async()=>{const [t]=await chrome.tabs.query({active:true,currentWindow:true});await send('cancelTimer',{id:t.id});$('#status').textContent='Lifetime removed.';});
$('#settings').onclick=()=>chrome.runtime.openOptionsPage();
