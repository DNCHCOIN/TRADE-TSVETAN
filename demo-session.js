/* Browser-only demonstration session shared by the GitHub Pages origin.
   Not a security boundary and grants no API, company or administrative rights. */
(()=>{
 'use strict';
 const KEY='ibh_preview_session_v1',HUB='https://dnchcoin.github.io/INTERNATIONAL-BUSINESS-HUB/';
 let data=null;
 try{data=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}
 if(!data || !['nedka-admin','tsvetan-admin'].includes(data.username)||typeof data.expires!=='number'||data.expires<=Date.now())return;
 const panel=document.createElement('aside');
 panel.setAttribute('aria-label','Демонстрационна сесия');
 panel.style.cssText='position:fixed;bottom:16px;right:16px;z-index:2147483646;max-width:min(360px,calc(100vw - 32px));padding:15px 18px;background:#102337;color:white;border:1px solid #d9b67f;border-radius:8px;box-shadow:0 8px 30px #0004;font:13px/1.5 Inter,Arial,sans-serif';
 const title=document.createElement('strong');title.textContent='DEMO · '+data.username;
 const hint=document.createElement('div');hint.style.cssText='color:#cbd7e1;font-size:12px;margin:5px 0 9px';hint.textContent='Преглед без реални административни права';
 const links=document.createElement('div');links.style.cssText='display:flex;gap:14px;align-items:center;flex-wrap:wrap';
 const home=document.createElement('a');home.href=HUB;home.textContent='BUSINESS HUB';home.style.color='#e7c48a';
 const logout=document.createElement('button');logout.type='button';logout.textContent='Изход';logout.style.cssText='border:1px solid #d9b67f;background:transparent;color:white;border-radius:5px;padding:5px 10px;cursor:pointer';
 logout.addEventListener('click',()=>{try{localStorage.removeItem(KEY)}catch{}panel.remove();});
 links.append(home,logout);panel.append(title,hint,links);
 document.body.append(panel);
})();