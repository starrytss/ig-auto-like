'use strict';
const $=id=>document.getElementById(id);
const SETTINGS=['refresh','like','maxLikesPerRefresh','includeUnfollowed','includeExisting'];
let tabId=null,working=false,visibilityWorking=false,current={enabled:false,paused:false},ui={showOverlay:true,settings:{}};
function note(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
async function request(type,extra={}){const r=await chrome.runtime.sendMessage({target:'egg-feed-worker',type,...extra});if(!r?.ok)throw new Error(r?.error||'無法連接控制器');return r;}
function readSettings(){
 const refreshSeconds=Number($('refresh').value),likeSeconds=Number($('like').value),maxLikesPerRefresh=Number($('maxLikesPerRefresh').value);
 if(!Number.isInteger(refreshSeconds)||refreshSeconds<5||refreshSeconds>3600||!Number.isInteger(likeSeconds)||likeSeconds<1||likeSeconds>3600)throw new Error('刷新請設5 至3600 秒 按讚間隔1 至3600 秒');
 if(!Number.isInteger(maxLikesPerRefresh)||maxLikesPerRefresh<1||maxLikesPerRefresh>20)throw new Error('每次刷新按讚上限請設1 至20 篇');
 return {refreshSeconds,likeSeconds,maxLikesPerRefresh,includeUnfollowed:$('includeUnfollowed').checked,includeExisting:$('includeExisting').checked};
}
function applySettings(settings={}){
 $('refresh').value=String(settings.refreshSeconds??60);$('like').value=String(settings.likeSeconds??2);$('maxLikesPerRefresh').value=String(settings.maxLikesPerRefresh??1);
 $('includeUnfollowed').checked=settings.includeUnfollowed!==false;$('includeExisting').checked=settings.includeExisting!==false;refreshEquivalent();
}
function refreshEquivalent(){
 const n=Number($('refresh').value);
 if(!Number.isInteger(n)||n<5||n>3600){$('refresh-equivalent').textContent='可設定5 至3600 秒';return;}
 if(n<60){$('refresh-equivalent').textContent=n+' 秒';return;}
 const minutes=Math.floor(n/60),seconds=n%60;
 $('refresh-equivalent').textContent=n+' 秒＝'+(minutes?minutes+' 分鐘':'')+(seconds?(minutes?' ':'')+seconds+' 秒':'');
}
function controls(){
 const active=!!current.enabled,paused=!!current.paused,locked=active||paused;
 $('start').disabled=working||active||tabId===null;$('stop').disabled=working||!active;
 $('start').textContent=active?'執行中':paused?'繼續執行':'開始執行';
 $('stop').textContent='暫停';$('end').hidden=!paused;$('end').disabled=working;
 for(const id of SETTINGS)$(id).disabled=working||locked;
 $('showOverlay').disabled=visibilityWorking;
 $('settings-hint').textContent=paused?'已暫停 繼續可沿用統計 結束本次後可修改設定':active?'執行中設定已鎖定 暫停後可從浮動面板繼續':'確認前一篇結果後才繼續 下一篇預設間隔2 秒';
}
function renderDiagnostics(data){
 const box=$('diagnostics');box.replaceChildren();
 const line=(text,cls='diagnostic-row')=>{const p=document.createElement('p');p.className=cls;p.textContent=text;box.append(p);};
 if(!data){$('scanSummary').textContent='尚未掃描';line('開始後顯示找到的貼文與略過原因','empty');return;}
 const total=Number.isFinite(data.total)?data.total:0,eligible=Number.isFinite(data.eligible)?data.eligible:0;
 $('scanSummary').textContent=total+' 篇／可按'+eligible+' 篇';
 line('找到'+total+' 篇｜可按讚'+eligible+' 篇','diagnostic-summary');
 if(!total)line('尚未找到可辨識的首頁貼文 請確認首頁已載入','hint');
 for(const [reason,count] of Object.entries(data.reasons||{}))if(Number(count)>0)line(reason+'：'+Number(count)+' 篇');
 for(const sample of (Array.isArray(data.samples)?data.samples:[]).slice(0,3))if(sample.reason)line((sample.author?'@'+sample.author+'｜':'')+sample.reason,'diagnostic-sample');
}
function render(run){
 current=run||{enabled:false,paused:false};if(current.viewer)$('viewer').textContent='@'+current.viewer;
 $('likes').textContent=String(current.likedCount||0);$('reloads').textContent=String(current.refreshes||0);
 const cap=current.maxLikesPerRefresh||Number($('maxLikesPerRefresh').value)||1,count=current.roundLikedCount||0;
 $('round').textContent='本輪已按讚'+count+'／'+cap+' 篇';$('roundProgress').max=cap;$('roundProgress').value=Math.min(count,cap);
 $('next').textContent=current.enabled?Math.max(0,Math.ceil((current.nextRefreshAt-Date.now())/1000))+' 秒':'—';
 $('state').textContent=current.enabled?'執行中':current.paused?'已暫停':'待命中';$('state').className='state '+(current.enabled?'running':current.paused?'paused':'idle');
 if(current.enabled||current.paused)applySettings(current);else refreshEquivalent();
 renderDiagnostics(current.diagnostics);note(current.note||'尚未開始');$('logs').replaceChildren();
 for(const row of current.logs||[]){const p=document.createElement('div');p.className='log '+row.status;p.textContent='@'+row.author+'　'+({confirmed:'已按讚',uncertain:'結果待確認',skipped:'已略過'}[row.status]||row.status);$('logs').append(p);}
 if(!current.logs?.length){const p=document.createElement('p');p.className='empty';p.textContent=current.enabled?(current.includeExisting?'正在檢查首頁未按讚貼文':'等待開始後發佈的新貼文'):current.paused?'已暫停 本次統計會保留':'尚未開始';$('logs').append(p);}controls();
}
async function saveSettings(){
 if(working||current.enabled||current.paused)return;
 try{const settings=readSettings();const result=await request('setUi',{patch:{settings}});ui=result.ui||{...ui,settings};}
 catch(e){note(e.message,true);}
}
$('refresh').addEventListener('input',refreshEquivalent);
for(const id of SETTINGS)$(id).addEventListener('change',saveSettings);
$('showOverlay').addEventListener('change',async()=>{
 const showOverlay=$('showOverlay').checked,previous=ui.showOverlay!==false;visibilityWorking=true;controls();
 try{const result=await request('setUi',{patch:{showOverlay}});ui=result.ui||{...ui,showOverlay};$('showOverlay').checked=ui.showOverlay!==false;}
 catch(e){$('showOverlay').checked=previous;note(e.message,true);}
 finally{visibilityWorking=false;controls();}
});
$('start').addEventListener('click',async()=>{
 working=true;controls();try{
  if(current.paused)render((await request('unpause')).run);
  else render((await request('begin',{tabId,...readSettings()})).run);
 }catch(e){note(e.message,true);}finally{working=false;controls();}
});
$('stop').addEventListener('click',async()=>{working=true;controls();try{render((await request('pause')).run);}catch(e){note(e.message,true);}finally{working=false;controls();}});
$('end').addEventListener('click',async()=>{working=true;controls();try{render((await request('stop')).run);}catch(e){note(e.message,true);}finally{working=false;controls();}});
chrome.storage?.onChanged?.addListener((changes,area)=>{
 if(area!=='local'||!changes.eggFeedUiPrefs?.newValue)return;
 ui=changes.eggFeedUiPrefs.newValue;$('showOverlay').checked=ui.showOverlay!==false;
});
(async()=>{
 try{
  const [uiResult,tabs]=await Promise.all([request('getUi'),chrome.tabs.query({active:true,currentWindow:true})]);
  ui=uiResult.ui||ui;applySettings(ui.settings);$('showOverlay').checked=ui.showOverlay!==false;
  const tab=tabs[0];let u;try{u=new URL(tab?.url);}catch{}
  if(u?.protocol==='https:'&&['www.instagram.com','instagram.com'].includes(u.hostname)&&u.pathname==='/'){
   tabId=tab.id;await chrome.scripting.executeScript({target:{tabId},files:['core.js','dom.js','content.js']});
   const info=await chrome.tabs.sendMessage(tabId,{target:'egg-feed-page',type:'inspect'});if(info.viewer)$('viewer').textContent='@'+info.viewer;
  }
  render((await request('get')).run);
  if(!current.enabled&&!current.paused)note(tabId===null?'請先開啟並登入IG 首頁':'準備好後按開始 即會定時刷新首頁');
  setInterval(async()=>{if(working)return;try{render((await request('get')).run);}catch(e){note(e.message,true);}},1000);
 }catch(e){note(e.message,true);}finally{controls();}
})();
