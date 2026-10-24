'use strict';
importScripts('core.js');
const C=globalThis.EggFeedCore, KEY='eggFeedRun', HISTORY='eggFeedHistory', ALARM='eggFeedRefresh', UI_KEY='eggFeedUiPrefs';
let serial=Promise.resolve();
const enqueue=fn=>{const p=serial.then(fn,fn);serial=p.catch(()=>{});return p;};
const readRun=async()=>(await chrome.storage.session.get(KEY))[KEY]||{enabled:false,note:'尚未開始'};
const save=async s=>{await chrome.storage.session.set({[KEY]:s});return s;};
const DEFAULT_SETTINGS={refreshSeconds:60,likeSeconds:2,maxLikesPerRefresh:1,includeUnfollowed:true,includeExisting:true};
function settingsPatch(patch,base=DEFAULT_SETTINGS,strict=true){
 if(!patch||typeof patch!=='object'||Array.isArray(patch)){if(strict)throw new Error('設定格式不明');return {...base};}
 const next={...base};
 for(const [key,[min,max]] of Object.entries({refreshSeconds:[5,3600],likeSeconds:[1,3600],maxLikesPerRefresh:[1,20]})){
  if(!Object.prototype.hasOwnProperty.call(patch,key))continue;
  const value=Number(patch[key]);
  if(!Number.isInteger(value)||value<min||value>max){if(strict)throw new Error('設定值超出範圍：'+key);continue;}
  next[key]=value;
 }
 for(const key of ['includeUnfollowed','includeExisting']){
  if(!Object.prototype.hasOwnProperty.call(patch,key))continue;
  if(typeof patch[key]!=='boolean'){if(strict)throw new Error('勾選設定格式不明');continue;}
  next[key]=patch[key];
 }
 return next;
}
async function readUi(){
 const saved=(await chrome.storage.local.get(UI_KEY))[UI_KEY];
 return {showOverlay:typeof saved?.showOverlay==='boolean'?saved.showOverlay:true,settings:settingsPatch(saved?.settings||{},DEFAULT_SETTINGS,false)};
}
async function writeUi(ui){await chrome.storage.local.set({[UI_KEY]:ui});return ui;}
const readHistory=async()=>(await chrome.storage.local.get(HISTORY))[HISTORY]||{};
async function writeHistory(history){const rows=Object.entries(history).sort((a,b)=>b[1].at-a[1].at).slice(0,4000);await chrome.storage.local.set({[HISTORY]:Object.fromEntries(rows)});}
const home=url=>{try{const u=new URL(url);return u.protocol==='https:'&&['www.instagram.com','instagram.com'].includes(u.hostname)&&u.pathname==='/';}catch{return false;}};
const page=async(tabId,type,extra={})=>chrome.tabs.sendMessage(tabId,{target:'egg-feed-page',type,...extra});
const schedule=s=>chrome.alarms.create(ALARM,{when:Math.max(Date.now()+1000,s.nextRefreshAt)});
async function disable(s,note){s.enabled=false;s.paused=false;s.note=note;await save(s);await chrome.alarms.clear(ALARM);if(s.tabId)page(s.tabId,'halt',{runId:s.runId,run:s,note}).catch(()=>{});return s;}
const pageSender=sender=>sender.frameId===0&&Number.isInteger(sender.tab?.id)&&home(sender.url)&&(!sender.documentLifecycle||sender.documentLifecycle==='active');
const ownerControl=(s,m,sender)=>pageSender(sender)&&sender.tab.id===s.tabId&&m.runId===s.runId&&(!s.enabled||!s.documentId||sender.documentId===s.documentId);
function senderMatches(s,sender,runId){return sender.frameId===0&&(!sender.documentLifecycle||sender.documentLifecycle==='active')&&C.matchingRun(s,sender.tab?.id,runId,sender.documentId);}
const sameRound=(s,m,sender)=>senderMatches(s,sender,m.runId)&&m.roundId===s.roundId;
const monitorNote=s=>s.roundPlanned&&!s.roundQueue?.length?'本輪已完成 等待定時刷新':'監看首頁貼文中';
async function dispatch(m,sender,internalPageStart=false){
 let s=await readRun();
 if(m.type==='get')return {run:s};
 if(m.type==='tick'){
  if(!sameRound(s,m,sender))return {accepted:false,stopped:true,run:s};
  if(Date.now()<s.nextRefreshAt)return {accepted:false,run:s};
  await refresh();return {accepted:true,run:await readRun()};
 }
 const popup=!sender.tab&&sender.url===chrome.runtime.getURL('popup.html');
 if(m.type==='getUi'){
  if(!popup&&!pageSender(sender))throw new Error('無法讀取浮動面板設定');
  return {ui:await readUi()};
 }
 if(m.type==='setUi'){
  if(!popup&&!pageSender(sender))throw new Error('無法修改浮動面板設定');
  const patch=m.patch;
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new Error('設定格式不明');
  const ui=await readUi();
  if(Object.prototype.hasOwnProperty.call(patch,'showOverlay')){
   if(typeof patch.showOverlay!=='boolean')throw new Error('顯示設定格式不明');
   ui.showOverlay=patch.showOverlay;
  }
  if(Object.prototype.hasOwnProperty.call(patch,'settings'))ui.settings=settingsPatch(patch.settings,ui.settings);
  await writeUi(ui);return {ui};
 }
 if(m.type==='pageState'){
  if(!pageSender(sender))throw new Error('請在IG 首頁使用浮動面板');
  return {tabId:sender.tab.id,run:s.tabId===sender.tab.id?s:{enabled:false,paused:false,note:'尚未開始'},ui:await readUi()};
 }
 if(m.type==='startFromPage'){
  if(!pageSender(sender))throw new Error('請在IG 首頁開始');
  if(s.enabled){
   if(s.tabId===sender.tab.id)return {run:s};
   throw new Error('其他IG 分頁正在執行 請先暫停');
  }
  if(s.paused){
   if(s.tabId!==sender.tab.id)throw new Error('請回到原本的IG 分頁繼續');
   return dispatch({type:'unpause',runId:s.runId},sender);
  }
  const ui=await readUi();
  return dispatch({type:'begin',tabId:sender.tab.id,...ui.settings},sender,true);
 }
 if(m.type==='pause'){
  if(!popup&&!ownerControl(s,m,sender))throw new Error('這個分頁沒有執行中的工作');
  if(!s.enabled){if(s.paused)return {run:s};throw new Error('目前沒有執行中的工作');}
  s.enabled=false;s.paused=true;s.note='已暫停';
  if(s.tabId)page(s.tabId,'halt',{runId:s.runId,run:s,note:s.note}).catch(()=>{});
  await chrome.alarms.clear(ALARM);
  if(s.inFlight){
   const op=s.inFlight,history=await readHistory();
   history[s.viewer+':'+op.id]={id:op.id,author:op.author,status:'uncertain',at:Date.now()};
   await writeHistory(history);
   s.logs=[{author:op.author,status:'uncertain',at:Date.now(),reason:'暫停時未確認 不重試'},...(s.logs||[])].slice(0,30);
   s.roundQueue=(s.roundQueue||[]).filter(item=>item.id!==op.id);s.inFlight=null;
  }
  await save(s);return {run:s};
 }
 if(m.type==='unpause'){
  if(!popup&&!ownerControl(s,m,sender))throw new Error('請回到原本的IG 分頁繼續');
  if(!s.paused)throw new Error('目前沒有暫停的工作');
  const tab=await chrome.tabs.get(s.tabId);if(!home(tab.url))throw new Error('請先開啟IG 首頁');
  const info=await page(s.tabId,'prepare');
  if(info?.restriction)throw new Error(info.restriction);
  if(!info?.home||!info.viewer||info.viewer!==s.viewer)throw new Error('無法確認原本的登入帳號 請重新開始');
  s.enabled=true;s.paused=false;s.documentId=null;s.nextRefreshAt=Date.now()+s.refreshSeconds*1000;s.note='已繼續執行';
  await save(s);await schedule(s);page(s.tabId,'kick').catch(()=>{});return {run:s};
 }
 if(m.type==='stop'){
  if(!popup&&!ownerControl(s,m,sender))throw new Error('這個分頁沒有執行中的工作');
  return {run:await disable(s,m.note||'已停止')};
 }
 if(m.type==='begin'){
  if(!popup&&!(internalPageStart&&pageSender(sender)&&m.tabId===sender.tab.id))throw new Error('請從控制面板開始');
  if(s.enabled)throw new Error('已在執行中，請先停止');
  const tab=await chrome.tabs.get(m.tabId);if(!home(tab.url))throw new Error('請先開啟IG 首頁');
  const info=await page(m.tabId,'prepare');
  if(info.restriction)throw new Error(info.restriction);
  if(!info.viewer)throw new Error('無法辨識目前登入帳號，尚未開始');
  if(!info.home)throw new Error('請先開啟IG 首頁，再按開始');
  const refreshSeconds=Number(m.refreshSeconds??60),likeSeconds=Number(m.likeSeconds??2),maxLikesPerRefresh=Number(m.maxLikesPerRefresh??1);
  if(!Number.isInteger(refreshSeconds)||refreshSeconds<5||refreshSeconds>3600||!Number.isInteger(likeSeconds)||likeSeconds<1||likeSeconds>3600)throw new Error('刷新請設5 至3600 秒，按讚間隔1 至3600 秒');
  if(!Number.isInteger(maxLikesPerRefresh)||maxLikesPerRefresh<1||maxLikesPerRefresh>20)throw new Error('每次刷新按讚上限請設1 至20 篇');
  const now=Date.now();s={enabled:true,paused:false,runId:crypto.randomUUID(),tabId:tab.id,viewer:info.viewer,documentId:null,startedAt:now,refreshSeconds,likeSeconds,maxLikesPerRefresh,roundId:crypto.randomUUID(),roundLikedCount:0,roundReservedCount:0,roundQueue:[],roundPlanned:false,includeUnfollowed:m.includeUnfollowed!==false,includeExisting:m.includeExisting!==false,diagnostics:null,nextRefreshAt:now+refreshSeconds*1000,nextLikeAt:now,inFlight:null,note:'正在掃描首頁貼文',likedCount:0,refreshes:0,logs:[]};
  const ui=await readUi();ui.settings={refreshSeconds,likeSeconds,maxLikesPerRefresh,includeUnfollowed:s.includeUnfollowed,includeExisting:s.includeExisting};await writeUi(ui);
  await save(s);await schedule(s);page(tab.id,'kick').catch(()=>{});return {run:s};
 }
 if(m.type==='resume'){
  if(!s.enabled||sender.frameId!==0||sender.tab?.id!==s.tabId)return {run:{enabled:false}};
  if(!home(sender.url)||!sender.documentId||sender.documentLifecycle&&sender.documentLifecycle!=='active')throw new Error('無法確認執行分頁');
  if(s.documentId!==sender.documentId&&s.inFlight){await disable(s,'頁面在按讚待確認時被重新整理，已停止且不重試');return {run:s};}
  s.documentId=sender.documentId;await save(s);
  const history=await readHistory();const seen=Object.fromEntries(Object.entries(history).filter(([key])=>key.startsWith(s.viewer+':')).map(([key,row])=>[key.slice(s.viewer.length+1),row.status]));
  return {run:s,seen};
 }
 if(m.type==='plan'){
  if(!sameRound(s,m,sender))return {accepted:false,run:s};
  if(Date.now()>=s.nextRefreshAt)return {accepted:false,refreshDue:true,run:s};
  if(s.roundPlanned)return {accepted:true,run:s};
  const history=await readHistory(),items=Array.isArray(m.items)?m.items:[],ids=new Set(),queue=[];
  for(const item of items.slice(0,100)){
   if(queue.length>=s.maxLikesPerRefresh)break;
   if(!/^[A-Za-z0-9_-]+$/.test(item?.id||'')||ids.has(item.id))continue;
   const reason=C.candidate(item,{viewer:s.viewer,startedAt:s.startedAt,now:Date.now(),homeVerified:true,includeUnfollowed:s.includeUnfollowed===true,includeExisting:s.includeExisting===true,history:history[s.viewer+':'+item.id]?{[item.id]:true}:{}});
   if(reason)continue;
   ids.add(item.id);queue.push({id:item.id,author:item.author,publishedAt:item.publishedAt??null});
  }
  s.roundQueue=queue;s.roundPlanned=true;s.note=monitorNote(s);
  await save(s);return {accepted:true,run:s};
 }
 if(m.type==='skipQueued'){
  if(!sameRound(s,m,sender)||s.inFlight?.id===m.id)return {accepted:false,run:s};
  s.roundQueue=s.roundQueue.filter(item=>item.id!==m.id);s.note=monitorNote(s);
  await save(s);return {accepted:true,run:s};
 }
 if(m.type==='report'){
  if(!senderMatches(s,sender,m.runId))return {accepted:false};
  const d=m.diagnostics||{},count=n=>Number.isInteger(n)&&n>=0?Math.min(n,10000):0;
  const reasons=Object.fromEntries(Object.entries(d.reasons||{}).slice(0,20).filter(([k,v])=>typeof k==='string'&&Number.isInteger(v)&&v>=0).map(([k,v])=>[k.slice(0,120),count(v)]));
  const samples=Array.isArray(d.samples)?d.samples.slice(0,5).map(p=>({author:typeof p.author==='string'?p.author.slice(0,30):'',reason:typeof p.reason==='string'?p.reason.slice(0,120):''})):[];
  s.diagnostics={total:count(d.total),eligible:Math.min(count(d.eligible),count(d.total)),reasons,samples,at:Date.now()};
  if(!s.inFlight)s.note=s.diagnostics.total?monitorNote(s):'尚未找到可辨識的首頁貼文';
  await save(s);return {accepted:true,run:s};
 }
 if(m.type==='reserve'){
  if(!sameRound(s,m,sender))return {allowed:false,stopped:true};
  if(m.viewer!==s.viewer||!m.homeVerified){await disable(s,'帳號或首頁狀態已改變，已停止');return {allowed:false,stopped:true};}
  if(Date.now()>=s.nextRefreshAt)return {allowed:false,refreshDue:true,run:s};
  if(s.inFlight)return {allowed:false,waitMs:1000};
  if(s.roundReservedCount>=s.maxLikesPerRefresh)return {allowed:false,quota:true,run:s};
  if(!s.roundPlanned||!s.roundQueue.some(p=>p.id===m.item?.id&&p.author===m.item?.author))return {allowed:false,skip:true,reason:'不在本輪固定批次中',run:s};
  if(Date.now()<s.nextLikeAt)return {allowed:false,waitMs:s.nextLikeAt-Date.now()};
  const history=await readHistory(), id=m.item?.id;
  if(!/^[A-Za-z0-9_-]+$/.test(id||''))throw new Error('貼文短碼不明');
  const reason=C.candidate(m.item,{viewer:s.viewer,startedAt:s.startedAt,now:Date.now(),homeVerified:true,includeUnfollowed:s.includeUnfollowed===true,includeExisting:s.includeExisting===true,history:history[s.viewer+':'+id]?{[id]:true}:{}});
  if(reason)return {allowed:false,skip:true,reason};
  const opId=crypto.randomUUID(),at=Date.now();
  history[s.viewer+':'+id]={id,author:m.item.author,status:'pending',at};
  await writeHistory(history);
  s.roundReservedCount++;s.inFlight={id,author:m.item.author,opId,documentId:sender.documentId,roundId:s.roundId,at};s.nextLikeAt=at+s.likeSeconds*1000;
  s.note='正在替 @'+m.item.author+' 的貼文按讚';await save(s);
  return {allowed:true,opId,run:s};
 }
 if(m.type==='permit')return {allowed:senderMatches(s,sender,m.runId)&&s.inFlight?.opId===m.opId&&Date.now()<s.nextRefreshAt,refreshDue:Date.now()>=s.nextRefreshAt};
 if(m.type==='finish'){
  if(s.runId!==m.runId||sender.tab?.id!==s.tabId||sender.documentId!==s.inFlight?.documentId||s.inFlight?.opId!==m.opId)return {accepted:false};
  const op=s.inFlight,status=['confirmed','skipped'].includes(m.status)?m.status:'uncertain';
  const history=await readHistory();history[s.viewer+':'+op.id]={id:op.id,author:op.author,status,at:Date.now()};await writeHistory(history);
  s.inFlight=null;s.logs=[{author:op.author,status,at:Date.now()},...(s.logs||[])].slice(0,30);
  s.roundQueue=s.roundQueue.filter(item=>item.id!==op.id);
  if(status==='confirmed'){s.likedCount++;s.roundLikedCount++;}
  else if(status==='skipped')s.roundReservedCount=Math.max(0,s.roundReservedCount-1);
  if(status==='uncertain')await disable(s,'按讚結果待確認，已停止且不重試');
  else {if(s.enabled)s.note=monitorNote(s);await save(s);}
  return {accepted:true,run:s};
 }
 throw new Error('不支援的操作');
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 if(m?.target!=='egg-feed-worker')return;
 enqueue(()=>dispatch(m,sender)).then(data=>reply({ok:true,...data})).catch(e=>reply({ok:false,error:e.message}));return true;
});
async function refresh(){
 const s=await readRun();if(!s.enabled){await chrome.alarms.clear(ALARM);return;}
 if(Date.now()<s.nextRefreshAt){await schedule(s);return;}
 try{
  const tab=await chrome.tabs.get(s.tabId);if(!home(tab.url)){await disable(s,'已離開IG 首頁，已停止');return;}
  let info=null;
  try{info=await page(s.tabId,'reloadCheck');}catch{}
  if(info?.restriction||info?.viewer&&info.viewer!==s.viewer||info?.home===false){
   await disable(s,info?.restriction||'無法確認帳號或IG 首頁，已停止');return;
  }
  if(s.inFlight){
   const op=s.inFlight,history=await readHistory();
   history[s.viewer+':'+op.id]={id:op.id,author:op.author,status:'uncertain',at:Date.now()};
   await writeHistory(history);
   s.logs=[{author:op.author,status:'uncertain',at:Date.now(),reason:'到期刷新時未確認 不重試'},...(s.logs||[])].slice(0,30);
   s.inFlight=null;
  }
  s.documentId=null;s.refreshes++;s.roundId=crypto.randomUUID();s.roundLikedCount=0;s.roundReservedCount=0;s.roundQueue=[];s.roundPlanned=false;s.diagnostics=null;s.nextRefreshAt=Date.now()+s.refreshSeconds*1000;s.note='時間已到 正在刷新首頁';
  await save(s);await schedule(s);await chrome.tabs.reload(s.tabId);
 }catch{await disable(s,'分頁無法連接，已停止');}
}
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM)enqueue(refresh).catch(()=>{});});
chrome.tabs.onRemoved.addListener(tabId=>enqueue(async()=>{const s=await readRun();if((s.enabled||s.paused)&&s.tabId===tabId)await disable(s,'IG 分頁已關閉');}));
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(change.url&&!home(change.url))enqueue(async()=>{const s=await readRun();if((s.enabled||s.paused)&&s.tabId===tabId)await disable(s,'已離開IG 首頁，已停止');});});
chrome.runtime.onStartup.addListener(()=>enqueue(async()=>{await chrome.storage.session.remove(KEY);await chrome.alarms.clear(ALARM);}));
chrome.runtime.onInstalled.addListener(()=>enqueue(async()=>{await chrome.storage.session.remove(KEY);await chrome.alarms.clear(ALARM);}));
