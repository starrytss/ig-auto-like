(() => {'use strict';
if(globalThis.EggFeedDOM)return;
const C=globalThis.EggFeedCore;
const LIKE=new Set(['Like','按讚','讚','点赞','赞']),UNLIKE=new Set(['Unlike','收回讚','取消讚','取消按讚','取消点赞']);
const COMMENT=new Set(['Comment','留言','回應']);
const rect=el=>el.getBoundingClientRect();
const visible=el=>el&&rect(el).width>0&&rect(el).height>0&&getComputedStyle(el).visibility!=='hidden';
const isHome=()=>location.protocol==='https:'&&['www.instagram.com','instagram.com'].includes(location.hostname)&&location.pathname==='/';
  function viewerName() {
    const candidates=new Set();
    for(const a of document.querySelectorAll("a[href]")) {
      if(a.closest("article,main,[role=main],[role=dialog]")) continue;
      let u; try {u=new URL(a.href);} catch {continue;}
      const m=u.pathname.match(/^\/([a-zA-Z0-9._]+)\/?$/), n=m&&C.username(m[1]);
      if(!n || !["instagram.com","www.instagram.com"].includes(u.hostname)) continue;
      const labels=[a.getAttribute("aria-label"),a.textContent?.trim(),...Array.from(a.querySelectorAll("svg[aria-label]"),x=>x.getAttribute("aria-label"))];
      const explicit=labels.some(x=>/^(Profile|個人檔案|個人主頁|个人主页)$/i.test(x||""));
      const image=a.querySelector("img[alt]"), alt=image?.getAttribute("alt")||"";
      const avatar=(a.closest("nav,aside,[role=navigation]") && (alt.toLowerCase().includes(n) || /profile|大頭貼|頭像/i.test(alt)));
      if(explicit || avatar) candidates.add(n);
    }
    return candidates.size===1 ? [...candidates][0] : null;
  }

  function mainMedia(article) {
    return [...article.querySelectorAll("img,video")].filter(el=>visible(el) && rect(el).width>=180 && rect(el).height>=120).sort((a,b)=>rect(b).width*rect(b).height-rect(a).width*rect(a).height)[0]||null;
  }
  function authorRow(article,media) {
    if(!media) return {name:null,anchors:[],contains:()=>false};
    // Desktop posts may place the author row on top of the photo/video.
    // Keep the region near the media's upper edge so captions/comments cannot
    // supply an author or a Follow label for the post.
    const m=rect(media), top=Math.max(rect(article).top,m.top-160);
    const bottom=m.top+Math.min(96,m.height/4), names=new Map();
    const inRegion=el=>{
      if(!visible(el)) return false;
      const r=rect(el), y=(r.top+r.bottom)/2;
      return y>=top && y<=bottom && r.left>=m.left-24 && r.right<=m.right+24;
    };
    for(const a of article.querySelectorAll("a[href]")) {
      let u; try {u=new URL(a.href);} catch {continue;}
      if(!["www.instagram.com","instagram.com"].includes(u.hostname)) continue;
      const m=u.pathname.match(/^\/([a-zA-Z0-9._]+)\/?$/), name=m&&C.username(m[1]);
      if(!name || !inRegion(a)) continue;
      const text=(a.textContent||"").trim().toLowerCase();
      if(text===name) {
        if(!names.has(name)) names.set(name,[]);
        names.get(name).push(a);
      }
    }
    const name=names.size===1 ? [...names.keys()][0] : null;
    const anchors=name ? names.get(name) : [];
    const contains=el=>inRegion(el) && anchors.some(a=>{
      const r=rect(el), ar=rect(a), y=(r.top+r.bottom)/2;
      return y>=ar.top-28 && y<=ar.bottom+32;
    });
    return {name,anchors,contains};
  }
  function mainHeart(article,media) {
    if(!media) return null;
    const candidates=new Map(), m=rect(media);
    const iconsIn=el=>[...el.querySelectorAll('svg[aria-label],button[aria-label],[role=button][aria-label]')];
    const buttonFor=el=>el.closest('button,[role=button]');
    for(const icon of iconsIn(article)) {
      const label=icon.getAttribute('aria-label');
      if(!LIKE.has(label) && !UNLIKE.has(label)) continue;
      const button=buttonFor(icon), r=button&&rect(button), ir=rect(icon);
      if(!button || !visible(button) || ir.width<18 || ir.height<18) continue;
      // Main toolbar is adjacent to the media. Comment hearts farther below
      // cannot become candidates even if a later container has a Comment label.
      if(r.top<m.bottom-12 || r.top>m.bottom+180 || r.left<m.left-24 || r.right>m.right+24) continue;
      let group=button.parentElement, valid=false;
      for(let depth=0;group && group!==article && depth<6;depth++,group=group.parentElement) {
        const icons=iconsIn(group), hearts=new Set(icons.filter(x=>LIKE.has(x.getAttribute('aria-label'))||UNLIKE.has(x.getAttribute('aria-label'))).map(buttonFor).filter(Boolean));
        const comment=icons.some(x=>COMMENT.has(x.getAttribute('aria-label')) && Math.abs((rect(x).top+rect(x).bottom-r.top-r.bottom)/2)<=40);
        if(hearts.size===1 && hearts.has(button) && comment && rect(group).height<=180) {valid=true;break;}
      }
      if(valid) candidates.set(button,{button,liked:!!candidates.get(button)?.liked || UNLIKE.has(label)});
    }
    return candidates.size===1 ? [...candidates.values()][0] : null;
  }
  function identity(article,row) {
    const times=[...article.querySelectorAll('time[datetime]')].filter(t=>visible(t));
    const linked=times.map(time=>({time,link:C.postLink(time.closest('a[href]')?.href||'')})).filter(x=>x.link);
    const anchors=[...article.querySelectorAll('a[href]')].filter(visible).map(a=>C.postLink(a.href)).filter(Boolean);
    // An unwrapped time is common in desktop variants. Accept only one
    // shortcode across the whole article; conflicting links stay ambiguous.
    const links=[...linked.map(x=>x.link),...anchors], ids=new Set(links.map(x=>x.id));
    if(ids.size!==1) return {link:null,publishedAt:null};
    const link=links[0];
    const safeTime=time=>{
      if(time.closest('li,[role=comment]')) return false;
      const anchor=time.closest('a[href]');
      if(!anchor) return true;
      try {
        const u=new URL(anchor.href);
        return ![...u.searchParams.keys()].some(key=>/comment|reply/i.test(key)) && !/comment|reply/i.test(u.hash);
      } catch {return false;}
    };
    const relevant=linked.filter(x=>x.link.id===link.id && safeTime(x.time)).map(x=>x.time);
    const rowTimes=times.filter(t=>safeTime(t) && row.contains(t));
    // A lone unwrapped time farther down may belong to a comment. Require
    // the author row or an explicit clean post permalink, never any time.
    const choices=rowTimes.length ? rowTimes : relevant;
    const dates=new Set(choices.map(t=>t.getAttribute('datetime')).filter(Boolean));
    // Multiple different times may belong to comments. Do not attach an
    // arbitrary comment time to the post in the new-post-only mode.
    return {link,publishedAt:dates.size===1?[...dates][0]:null};
  }
  function describe(article,index) {
    const media=mainMedia(article), row=authorRow(article,media), author=row.name, heart=mainHeart(article,media);
    const primary=identity(article,row);
    const advertisement=[...article.querySelectorAll("span")].some(x=>/^(Sponsored|贊助|贊助內容|赞助)$/i.test(x.textContent?.trim()||""));
    const labels=[...article.querySelectorAll('button,[role=button],a,span')]
      .filter(row.contains).flatMap(el=>[el.getAttribute('aria-label')||'',el.textContent||''])
      .map(s=>s.trim());
    const followButton=labels.some(s=>/^(Follow|Follow back|Requested|追蹤|追蹤對方|回追|已發送追蹤邀請|已送出邀請)$/i.test(s));
    const suggested=labels.some(s=>/^(Suggested for you|Suggested post|推薦給你|為你推薦|推薦貼文|建議貼文)$/i.test(s));
    return {article,button:heart?.button, id:primary.link?.id||null,url:primary.link?.url||null,author,followButton,suggested,
      publishedAt:primary.publishedAt,liked:!!heart?.liked,hasButton:!!heart,
      ambiguous:!primary.link||!author,advertisement,index};
  }
  function collect() { return [...document.querySelectorAll("article")].filter(a=>!a.closest("[role=dialog]")&&visible(a)).map(describe); }

function restriction(){
 if(!isHome())return '已離開IG 首頁';
 if(document.querySelector('input[name=password]'))return '請先登入IG';
 const alerts=[...document.querySelectorAll('[role=alert],[role=dialog]')].filter(visible);
 if(alerts.some(el=>/Try Again Later|We restrict certain activity|We suspect automated|Confirm (?:it.s|your)|驗證|身分|稍後再試|限制某些活動|偵測到自動化/i.test(el.textContent)))return 'IG 顯示驗證或限制訊息，已停止';
 if(alerts.some(el=>el.getAttribute('role')==='dialog'))return '請先關閉IG 彈出視窗，再重新開始';
 return '';
}
function posts(){return collect();}
function inspect(){return {viewer:viewerName(),home:isHome(),restriction:restriction()};}
globalThis.EggFeedDOM={inspect,posts};
})();
