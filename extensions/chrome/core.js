(() => { 'use strict';
const USER=/^[a-z0-9._]{1,30}$/;
const RESERVED=new Set(['p','reel','reels','explore','direct','accounts','stories','about','legal','privacy','challenge']);
  function username(value) {
    if (typeof value !== "string") return null;
    let s=value.trim().toLowerCase();
    if (/^https?:\/\//.test(s)) {
      try { const u=new URL(s); if (!["instagram.com","www.instagram.com"].includes(u.hostname) || u.search || u.hash) return null; s=u.pathname.replace(/^\/|\/$/g,""); } catch { return null; }
    }
    s=s.replace(/^@/,"");
    return USER.test(s) && !RESERVED.has(s) ? s : null;
  }

  function postLink(href) {
    try { const u=new URL(href,"https://www.instagram.com"); const m=u.pathname.match(/^\/(?:p|reel)\/([A-Za-z0-9_-]+)\/?$/);
      return ["instagram.com","www.instagram.com"].includes(u.hostname) && m ? {id:m[1],url:"https://www.instagram.com"+u.pathname.replace(/\/?$/,"/")} : null;
    } catch { return null; }
  }

function candidate(p,c) {
 if(!c.homeVerified)return '尚未確認IG 首頁';
 if(!p.id)return '貼文網址不明';
 if(!p.author||p.ambiguous)return '作者或貼文身分不明';
 if(p.author===c.viewer)return '自己的貼文';
 if(p.advertisement)return '廣告';
 if(!c.includeUnfollowed&&(p.suggested||p.followButton))return '未追蹤或推薦貼文（未勾選）';
 if(p.liked)return '已按讚';
 if(!p.hasButton)return '主要按讚按鈕不明';
 if(c.history?.[p.id])return '已處理過';
 const zoned=/(?:Z|[+-]\d{2}:\d{2})$/.test(p.publishedAt||'');
 const at=zoned?Date.parse(p.publishedAt):NaN;
 if(Number.isFinite(at)&&at>c.now+60000)return '發佈時間異常';
 if(!c.includeExisting) {
  if(!Number.isFinite(at))return '發佈時間不明';
  if(at<c.startedAt)return '開始前的貼文';
 }
 return '';
}
function matchingRun(s,tabId,runId,documentId){return !!s?.enabled&&s.tabId===tabId&&s.runId===runId&&(!documentId||s.documentId===documentId);}
globalThis.EggFeedCore={username,postLink,candidate,matchingRun};
})();