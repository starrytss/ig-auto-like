(() => {
 'use strict';
 if(globalThis.__eggFeedV07)return;globalThis.__eggFeedV07=true;
 const C=globalThis.EggFeedCore,D=globalThis.EggFeedDOM;
 let run=null,generation=0,seen={},bar=null,label=null,toggleButton=null,countdownValue=null,countdownNote=null,timerState=null,likeValue=null,refreshValue=null,roundLabel=null,loopBusy=false,launching=false,lastReportKey='',lastReportAt=0,refreshTimer=null,tickToken=null,uiTimer=null,controlBusy=false,uiReady=false,statusText='準備開始';
 let ui={showOverlay:true,settings:{maxLikesPerRefresh:1}};
 const OVERLAY_CSS=":host{all:initial;position:fixed;top:24px;right:24px;bottom:auto;width:320px;height:300px;max-width:calc(100vw - 32px);z-index:2147483647;color-scheme:dark;contain:layout style}:host([hidden]){display:none!important}*{box-sizing:border-box}.panel{width:100%;height:100%;padding:16px;display:grid;grid-template-rows:36px 34px 62px 56px 36px;gap:10px;border:1px solid #2d3c3c;border-radius:20px;background-color:#111b20;background-image:radial-gradient(#ffffff08 .7px,transparent .7px);background-size:14px 14px;color:#e8f0ef;box-shadow:0 18px 48px #0005;font:13px/1.5 system-ui,-apple-system,\"Microsoft JhengHei\",sans-serif}.header{display:flex;align-items:center;min-width:0;gap:9px}.overlay-logo{width:34px;height:34px;flex:0 0 34px;border-radius:9px}.brand{min-width:0;flex:1}.brand-name{display:block;font-weight:750;font-size:13px;letter-spacing:.02em;white-space:nowrap}.brand-sub{display:block;color:#78bfa7;font:10px/1.4 ui-monospace,monospace;letter-spacing:.07em}.close-button{width:28px;height:28px;flex:0 0 28px;border:0;border-radius:8px;background:#ffffff08;color:#9badab;font:22px/1 system-ui;cursor:pointer}.close-button:hover{background:#ffffff12;color:#fff}.status{height:34px;min-height:34px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:#9fb5b0;font-size:11px;line-height:17px;overflow-wrap:anywhere}.timer{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ffffff10;padding-bottom:8px}.timer-copy{min-width:0}.timer-title{display:block;font-size:11px;color:#8baca1}.timer-state{display:block;margin-top:4px;font-size:10px;color:#607c73}.countdown{display:flex;align-items:baseline;gap:5px;min-width:100px;justify-content:flex-end}.countdown-value{font:600 42px/1 ui-monospace,SFMono-Regular,monospace;font-variant-numeric:tabular-nums;letter-spacing:-.065em;color:#f1faf7}.countdown-note{color:#79b59e;font-size:11px;white-space:nowrap}.stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}.stat{display:flex;align-items:center;justify-content:space-between;border:1px solid #ffffff0d;border-radius:11px;padding:8px 10px;background:#0a12174d}.stat-label{font-size:10px;color:#91aaa1}.stat-value{font:600 20px/1 ui-monospace,SFMono-Regular,monospace;font-variant-numeric:tabular-nums;color:#d7ebe3}.actions{display:flex;align-items:center;gap:12px}.round-label{flex:1;font-size:10px;color:#78998b;font-variant-numeric:tabular-nums;white-space:nowrap}.toggle-button{height:36px;width:132px;flex:0 0 132px;border:1px solid #0fa472;border-radius:10px;background:#047857;color:#effff7;font:700 12px system-ui;cursor:pointer;letter-spacing:.04em}.toggle-button:hover:not(:disabled){background:#059669}.toggle-button[data-running=true]{background:#172c25;border-color:#365949;color:#b1d9c6}.toggle-button:disabled{cursor:wait;opacity:.6}button:focus-visible{outline:2px solid #6ee7b7;outline-offset:3px}@media(max-width:380px){:host{right:16px;top:16px}.panel{padding:16px}}";
 const worker=async(type,extra={})=>{const r=await chrome.runtime.sendMessage({target:'egg-feed-worker',type,...extra});if(!r?.ok)throw new Error(r?.error||'無法連接控制器');return r;};
 const active=g=>run?.enabled&&g===generation;
 const wait=(ms,g)=>new Promise(resolve=>{const end=Date.now()+ms;function tick(){if(!active(g)||Date.now()>=end)resolve();else setTimeout(tick,Math.min(250,end-Date.now()));}tick();});
 const limit=()=>Number.isInteger(run?.maxLikesPerRefresh)?run.maxLikesPerRefresh:Number.isInteger(ui.settings?.maxLikesPerRefresh)?ui.settings.maxLikesPerRefresh:1;
 function createPanel(){
  if(bar)return;
  bar=document.createElement('div');bar.setAttribute('aria-label','山姆蛋 IG 浮動控制面板');
  const shadow=bar.attachShadow({mode:'closed'}),style=document.createElement('style');style.textContent=OVERLAY_CSS;
  const box=document.createElement('section');box.className='panel';
  const head=document.createElement('header');head.className='header';
  const logo=document.createElement('img');logo.className='overlay-logo';logo.src=chrome.runtime.getURL('assets/lab-mark.svg');logo.alt='';logo.width=34;logo.height=34;
  const brand=document.createElement('div');brand.className='brand';
  const name=document.createElement('strong');name.className='brand-name';name.textContent='山姆蛋實驗室';
  const sub=document.createElement('span');sub.className='brand-sub';sub.textContent='SamEgg Lab / IG v0.7';
  brand.append(name,sub);
  const close=document.createElement('button');close.className='close-button';close.type='button';close.textContent='×';close.setAttribute('aria-label','隱藏浮動面板');close.title='隱藏面板 功能會繼續執行';close.addEventListener('click',()=>void hidePanel());
  head.append(logo,brand,close);
  label=document.createElement('div');label.className='status';
  const timerBox=document.createElement('div');timerBox.className='timer';
  const timerCopy=document.createElement('div');timerCopy.className='timer-copy';
  const timerTitle=document.createElement('span');timerTitle.className='timer-title';timerTitle.textContent='下次刷新';
  timerState=document.createElement('span');timerState.className='timer-state';
  timerCopy.append(timerTitle,timerState);
  const countdown=document.createElement('div');countdown.className='countdown';
  countdownValue=document.createElement('strong');countdownValue.className='countdown-value';
  countdownNote=document.createElement('span');countdownNote.className='countdown-note';
  countdown.append(countdownValue,countdownNote);timerBox.append(timerCopy,countdown);
  const stats=document.createElement('div');stats.className='stats';
  function statistic(title,className){const cell=document.createElement('div');cell.className='stat';const caption=document.createElement('span');caption.className='stat-label';caption.textContent=title;const value=document.createElement('strong');value.className='stat-value '+className;cell.append(caption,value);stats.append(cell);return value;}
  likeValue=statistic('已按讚','like-value');refreshValue=statistic('已刷新','refresh-value');
  const actions=document.createElement('div');actions.className='actions';
  roundLabel=document.createElement('span');roundLabel.className='round-label';
  toggleButton=document.createElement('button');toggleButton.type='button';toggleButton.className='toggle-button';toggleButton.addEventListener('click',()=>void toggle());
  actions.append(roundLabel,toggleButton);box.append(head,label,timerBox,stats,actions);shadow.append(style,box);document.documentElement.append(bar);
 }
 function clearUiTimer(){if(uiTimer!==null){clearTimeout(uiTimer);uiTimer=null;}}
 function renderPanel(){
  clearUiTimer();
  if(!uiReady||!ui.showOverlay||!D.inspect().home){if(bar)bar.hidden=true;return;}
  createPanel();bar.hidden=false;
  label.textContent=statusText;label.title=statusText;
  likeValue.textContent=String(run?.likedCount||0);refreshValue.textContent=String(run?.refreshes||0);
  roundLabel.textContent='本輪 '+(run?.roundLikedCount||0)+'／'+limit()+' 篇';
  const running=!!run?.enabled;
  countdownValue.textContent=running&&Number.isFinite(run.nextRefreshAt)?String(Math.max(0,Math.ceil((run.nextRefreshAt-Date.now())/1000))):'—';
  countdownNote.textContent=running?'秒':run?.paused?'已暫停':'待開始';
  timerState.textContent=running?'定時刷新運作中':run?.paused?'點擊開始即可繼續':'按開始啟動監看';
  toggleButton.textContent=controlBusy?'處理中':running?'暫停':'開始';toggleButton.disabled=controlBusy;toggleButton.setAttribute('data-running',String(running));
  toggleButton.setAttribute('aria-label',running?'暫停自動刷新與按讚':'開始自動刷新與按讚');
  uiTimer=setTimeout(()=>{uiTimer=null;renderPanel();},1000);
 }
 function display(text){statusText=text||run?.note||'準備開始';renderPanel();}
 function applyUi(value){ui={...ui,...value,showOverlay:value?.showOverlay!==false,settings:{...ui.settings,...value?.settings}};renderPanel();}
 async function hidePanel(){
  ui.showOverlay=false;renderPanel();
  try{const result=await worker('setUi',{patch:{showOverlay:false}});if(result.ui)applyUi(result.ui);}catch{}
 }
 async function toggle(){
  if(controlBusy)return;controlBusy=true;renderPanel();
  try{
   if(run?.enabled){
    const id=run.runId;halt();display('正在暫停');
    const result=await worker('pause',{runId:id});if(result.run)run=result.run;display(result.run?.note||'已暫停');
   }else{
    display('正在開始');
    const result=await worker('startFromPage');
    if(result.run?.enabled){
     if(!(run?.enabled&&run.runId===result.run.runId)){run={...result.run,enabled:false};await resume();}
     else renderPanel();
    }else if(result.run){run=result.run;display(result.run.note||'尚未開始');}
   }
  }catch(e){display(e.message||'操作失敗 請稍後再試');}
  finally{controlBusy=false;renderPanel();}
 }
 async function initialize(){
  if(!D.inspect().home)return;
  try{
   const state=await worker('pageState');if(state.ui)ui={...ui,...state.ui,showOverlay:state.ui.showOverlay!==false};uiReady=true;
   if(state.run?.enabled){
    if(!run?.enabled)run={...state.run,enabled:false};
    display('正在載入首頁貼文');await resume();
   }else if(!run?.enabled){run=state.run||{enabled:false};display(run.note||(run.paused?'已暫停':'準備開始'));}
  }catch(e){uiReady=true;display(e.message||'無法連接控制器');}
 }
 function clearRefreshTimer(){if(refreshTimer!==null){clearTimeout(refreshTimer);refreshTimer=null;}}
 function refreshDue(){return Number.isFinite(run?.nextRefreshAt)&&Date.now()>=run.nextRefreshAt;}
 function armRefresh(g,retryMs){
  clearRefreshTimer();if(!active(g)||!Number.isFinite(run.nextRefreshAt))return;
  const delay=retryMs??Math.max(1,run.nextRefreshAt-Date.now());
  refreshTimer=setTimeout(()=>{refreshTimer=null;void requestRefresh(g);},delay);
 }
 async function requestRefresh(g){
  if(!active(g)||tickToken?.g===g)return;
  const token={g,runId:run.runId,roundId:run.roundId};tickToken=token;
  try{
   const result=await worker('tick',{runId:token.runId,roundId:token.roundId});
   if(!active(g))return;
   if(result?.stopped){halt();display(result.run?.note||'舊頁面已停止');return;}
   if(result?.run&&(result.run.runId!==token.runId||result.run.roundId!==token.roundId||!result.run.enabled)){
    halt();display(result.run.enabled?'正在刷新首頁':result.run.note||'已停止');return;
   }
   updateRun(result,g);if(active(g))armRefresh(g,refreshDue()?500:undefined);
  }catch(e){if(active(g)){display('刷新連線重試中');armRefresh(g,1000);}}
  finally{if(tickToken===token)tickToken=null;}
 }
 function halt(){generation++;clearRefreshTimer();tickToken=null;if(run)run.enabled=false;}
 async function stop(note){const id=run?.runId;halt();display(note);if(id){const result=await worker('stop',{runId:id,note}).catch(()=>null);if(result?.run&&result.run.runId===id){run=result.run;renderPanel();}}}
 function guard(){const info=D.inspect();if(info.restriction)return info.restriction;if(info.viewer!==run?.viewer)return '登入帳號已改變，已停止';if(!info.home)return '已離開IG 首頁，已停止';return '';}
 function updateRun(result,g){
  if(!active(g)||!result?.run||result.run.runId!==run.runId||result.run.roundId!==run.roundId)return false;
  run=result.run;return true;
 }
 function eligible(p){return C.candidate(p,{viewer:run.viewer,startedAt:run.startedAt,now:Date.now(),homeVerified:D.inspect().home,includeUnfollowed:run.includeUnfollowed===true,includeExisting:run.includeExisting===true,history:seen});}
 function orderedPosts(){
  return D.posts().slice().sort((a,b)=>{
   const ar=a.article?.getBoundingClientRect?.(),br=b.article?.getBoundingClientRect?.();
   const ay=Number.isFinite(ar?.top)?ar.top:Number.isFinite(a.index)?a.index:0,by=Number.isFinite(br?.top)?br.top:Number.isFinite(b.index)?b.index:0;
   return ay-by||((a.index||0)-(b.index||0));
  });
 }
 function countsFor(rows){const counts=new Map();for(const p of rows)if(p.id)counts.set(p.id,(counts.get(p.id)||0)+1);return counts;}
 function locate(item){const rows=D.posts().filter(p=>p.id===item.id);if(rows.length!==1)return null;const p=rows[0];return p.author===item.author&&p.publishedAt===item.publishedAt&&!eligible(p)?p:null;}
 async function dropQueued(item,g){
  const result=await worker('skipQueued',{runId:run.runId,roundId:run.roundId,id:item.id});
  updateRun(result,g);
 }
 async function report(rows,counts,g){
  const reasons={},samples=[];let eligibleCount=0;
  for(const p of rows){
   const reason=counts.get(p.id)>1?'同一貼文出現多次':eligible(p);
   if(reason){reasons[reason]=(reasons[reason]||0)+1;if(samples.length<5)samples.push({author:p.author||'',reason});}
   else eligibleCount++;
  }
  const diagnostics={total:rows.length,eligible:eligibleCount,reasons,samples};
  const key=JSON.stringify(diagnostics);
  if(key!==lastReportKey||Date.now()-lastReportAt>=10000){
   const result=await worker('report',{runId:run.runId,roundId:run.roundId,diagnostics});
   updateRun(result,g);if(!active(g))return;
   lastReportKey=key;lastReportAt=Date.now();
  }
  const mainReason=Object.entries(reasons).sort((a,b)=>b[1]-a[1])[0];
  if(run.roundPlanned&&!run.roundQueue?.length)display('本輪已完成｜等待下次刷新');
  else display(rows.length?'找到'+rows.length+' 篇｜本輪待處理'+(run.roundQueue?.length||0)+' 篇'+(mainReason?'｜'+mainReason[0]+' '+mainReason[1]+' 篇':''):'尚未找到可辨識貼文｜請查看控制面板');
 }
 async function action(item,g){
  if(refreshDue()){await requestRefresh(g);return;}
  let p=locate(item);if(!p){await dropQueued(item,g);return;}
  p.button.scrollIntoView({block:'center',behavior:'instant'});await wait(750,g);if(!active(g))return;
  const problem=guard();if(problem){await stop(problem);return;}p=locate(item);if(!p){await dropQueued(item,g);return;}
  if(refreshDue()){await requestRefresh(g);return;}
  const {article,button,...clean}=p;
  const actionRunId=run.runId;
  const reservation=await worker('reserve',{runId:actionRunId,roundId:run.roundId,viewer:run.viewer,homeVerified:true,item:clean});
  if(!active(g)){
   if(reservation.allowed)await worker('finish',{runId:actionRunId,opId:reservation.opId,status:'skipped'}).catch(()=>{});
   return;
  }
  updateRun(reservation,g);if(!active(g)){display(run?.note||'已停止');return;}
  if(!reservation.allowed){
   if(reservation.refreshDue){await requestRefresh(g);}
   else if(reservation.stopped){halt();display('已停止');}
   else if(reservation.quota){display('本輪已達按讚上限｜等待刷新');await wait(2000,g);}
   else if(reservation.skip){seen[item.id]='skipped';await dropQueued(item,g);}
   else {display('等待按讚間隔｜約'+Math.ceil((reservation.waitMs||2000)/1000)+' 秒');await wait(Math.min(reservation.waitMs||2000,10000),g);}
   return;
  }
  const opId=reservation.opId,runId=actionRunId;
  let clicked=false,status='skipped';
  try{
   const permission=await worker('permit',{runId,opId});
   if(!active(g)||guard())return;
   if(permission.refreshDue||refreshDue()){await requestRefresh(g);return;}
   if(!permission.allowed)return;
   p=locate(item);if(!p||!p.button.isConnected)return;
   clicked=true;status='uncertain';seen[item.id]='pending';p.button.click();
   const until=Date.now()+8000;
   while(active(g)&&Date.now()<until){
    await wait(250,g);if(!active(g)||guard())break;
    const matches=D.posts().filter(x=>x.id===item.id&&x.author===item.author);
    if(matches.length===1&&matches[0].liked){status='confirmed';break;}
   }
  }finally{
   const result=await worker('finish',{runId,opId,status}).catch(()=>null);
   if(g===generation){
    seen[item.id]=status;updateRun(result,g);
    if(clicked&&status!=='confirmed'){halt();display('按讚結果待確認，已停止');}
    else if(result?.run?.enabled===false){halt();display(result.run.note||'已停止');}
    else if(active(g))display(run.roundQueue?.length?'本輪還有'+run.roundQueue.length+' 篇待處理':'本輪已完成｜等待下次刷新');
   }
  }
 }
 async function loop(g){
  if(loopBusy)return;loopBusy=true;
  try{
   const readyUntil=Date.now()+20000;
   while(active(g)&&Date.now()<readyUntil){if(!guard()&&D.posts().length)break;await wait(500,g);}
   if(!active(g))return;
   const problem=guard();if(problem){await stop(problem);return;}
   if(!run.roundPlanned){
    window.scrollTo?.({top:0,behavior:'instant'});await wait(500,g);if(!active(g))return;
    if(refreshDue()){await requestRefresh(g);return;}
    const rows=orderedPosts(),counts=countsFor(rows);
    const items=rows.filter(p=>counts.get(p.id)===1&&!eligible(p)).slice(0,limit()).map(p=>{const {article,button,...clean}=p;return clean;});
    const result=await worker('plan',{runId:run.runId,roundId:run.roundId,items});
    if(!updateRun(result,g)||!active(g))return;
    if(result.refreshDue){await requestRefresh(g);return;}
   }
   display('每'+run.refreshSeconds+' 秒刷新｜本輪最多'+limit()+' 篇');
   while(active(g)){
    if(refreshDue()){await requestRefresh(g);await wait(250,g);continue;}
    const reason=guard();if(reason){await stop(reason);return;}
    const rows=orderedPosts(),counts=countsFor(rows);
    await report(rows,counts,g);if(!active(g))return;
    const next=run.roundQueue?.[0];
    if(next){await action(next,g);await wait(250,g);continue;}
    await wait(2000,g);
   }
  }catch(e){if(active(g))await stop(e.message||'頁面操作失敗，已停止');}
  finally{loopBusy=false;}
 }
 async function resume(){
  if(launching||run?.enabled)return;launching=true;
  try{
   const until=Date.now()+15000;while(loopBusy&&Date.now()<until)await new Promise(r=>setTimeout(r,100));
   if(loopBusy)throw new Error('前一輪仍在結束中，請稍後重新開始');
   const result=await worker('resume');if(!result.run?.enabled)return;
   run=result.run;seen=result.seen||{};lastReportKey='';lastReportAt=0;const g=++generation;display('正在載入首頁貼文');armRefresh(g);void loop(g);
  }catch(e){display(e.message);}finally{launching=false;}
 }
 chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m?.target!=='egg-feed-page')return;
  if(m.type==='inspect'){reply(D.inspect());return;}
  if(m.type==='prepare'){reply(D.inspect());return;}
  if(m.type==='kick'){reply({ok:true});void resume();return;}
  if(m.type==='halt'){if(!m.runId||m.runId===run?.runId){halt();if(m.run)run=m.run;display(m.note||m.run?.note||'已停止');}reply({ok:true});return;}
  if(m.type==='reloadCheck'){const info=D.inspect();halt();display('正在刷新首頁');reply(info);return;}
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&run?.enabled)void stop('已按Esc 停止');});
 chrome.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes.eggFeedUiPrefs?.newValue)applyUi(changes.eggFeedUiPrefs.newValue);});
 void initialize();
})();
