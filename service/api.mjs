// Runtime helpers are injected by the shared host; this module owns only TRADE business data.
export function createTradeRoutes(h){
 const {check,str,num,choice,date,id,uuid,requireCompany,scoped,fail}=h;
 function input(b){
  const expires_on=date(b.expires_on);check(expires_on>=new Date().toISOString().slice(0,10),'expiry_in_past');
  const details={currency:choice(b.currency||'EUR',['EUR','USD']),price_min:b.price_min==null?null:num(b.price_min,0,1e12),price_max:b.price_max==null?null:num(b.price_max,0,1e12),moq:b.moq==null?null:num(b.moq,0,1e9),certificates:str(b.certificates||'',0,500),incoterms:choice(b.incoterms||'EXW',['EXW','FCA','FOB','CIF','DAP','DDP']),payment:str(b.payment||'',0,180),references:str(b.references||'',0,1500)};
  check(details.price_min==null || details.price_max==null || details.price_min<=details.price_max,'price_range');
  return {title:str(b.title,3,180),direction:choice(b.direction,['offer','wanted']),partnership:choice(b.partnership,['export','import','distribution','logistics','investment']),description:str(b.description,10,8000),sector:str(b.sector,2,100),country:choice(b.country,['BG','CN']),region:str(b.region,2,100),language:choice(b.language,['bg','en','zh']),expires_on,details,status:choice(b.status||'draft',['draft','published','closed'])};
 }
 async function log(c,u,action,entity){await c.query('INSERT INTO trade.audit(company_id,actor_id,action,entity_id) VALUES($1,$2,$3,$4)',[u.company_id,u.id,action,entity]);}
 return async ctx=>{
  const p=ctx.url.pathname,method=ctx.req.method,{trade,identity,body}=ctx;
  if(!p.startsWith('/api/trade/'))return;
  const cid=ctx.user?.company_active?ctx.user.company_id:null;
  if(p==='/api/trade/listings' && method==='GET'){
   const own=ctx.url.searchParams.get('mine')==='1';if(own)requireCompany(ctx);
   const q=str(ctx.url.searchParams.get('q')||'',0,100),country=ctx.url.searchParams.get('country')||'',sector=str(ctx.url.searchParams.get('sector')||'',0,100),direction=ctx.url.searchParams.get('direction')||'';
   const approved=(await identity.query("SELECT id,name_native,name_latin,profile FROM identity.companies WHERE status='verified'")).rows;
   const companies=new Map(approved.map(c=>[c.id,c]));
   const records=await scoped(trade,cid||'',async c=>(await c.query(`SELECT * FROM trade.listings WHERE (($8::boolean AND company_id=$1) OR (NOT $8::boolean AND status='published' AND expires_on>=CURRENT_DATE AND company_id=ANY($7::uuid[]))) AND ($2='' OR (title||' '||description||' '||sector) ILIKE '%'||$2||'%') AND ($3='' OR country=$3) AND ($4='' OR sector=$4) AND ($5='' OR direction=$5) AND status<>'removed' ORDER BY created_at DESC LIMIT $6`,[cid,q,country,sector,direction,100,approved.map(c=>c.id),own])).rows);
   const registered=ctx.user?.company_active && ctx.user.company_status==='verified';
   return {items:records.map(r=>own? r:registered?{...r,company:{id:r.company_id,name:companies.get(r.company_id).name_native,contact:companies.get(r.company_id).profile}}:{id:r.id,title:r.title,direction:r.direction,sector:r.sector,country:r.country,region:r.region}),visibility:own?'company':registered?'registered':'product_only'};
  }
  const listing=p.match(/^\/api\/trade\/listings(?:\/([\w-]+))?$/);
  if(listing && ['POST','PUT','DELETE'].includes(method)){
   const u=requireCompany(ctx,'trade');const listingId=listing[1]?id(listing[1]):uuid();check(method==='POST'?!listing[1]:!!listing[1],'method_not_allowed',405);
   const data=method==='DELETE'?null:input(body);if(data?.status==='published')requireCompany(ctx,'trade',true);
   return scoped(trade,u.company_id,async c=>{
    if(method==='POST'){await c.query('INSERT INTO trade.listings(id,company_id,title,direction,partnership,description,sector,country,region,language,expires_on,details,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[listingId,u.company_id,...['title','direction','partnership','description','sector','country','region','language','expires_on','details','status'].map(k=>data[k])]);ctx.status=201;}
    else {const existing=(await c.query('SELECT * FROM trade.listings WHERE id=$1 AND company_id=$2 FOR UPDATE',[listingId,u.company_id])).rows[0];check(existing && existing.status!=='removed','not_found',404);check(body.version===existing.version,'version_conflict',409);
     if(method==='DELETE')await c.query("UPDATE trade.listings SET status='removed',version=version+1,updated_at=now() WHERE id=$1",[listingId]);
     else await c.query('UPDATE trade.listings SET title=$2,direction=$3,partnership=$4,description=$5,sector=$6,country=$7,region=$8,language=$9,expires_on=$10,details=$11,status=$12,version=version+1,updated_at=now() WHERE id=$1',[listingId,...['title','direction','partnership','description','sector','country','region','language','expires_on','details','status'].map(k=>data[k])]);
    }
    await log(c,u,`listing.${method.toLowerCase()}`,listingId);return {id:listingId};
   });
  }
  if(p==='/api/trade/inquiries' && method==='GET'){
   const u=requireCompany(ctx);return scoped(trade,u.company_id,async c=>({items:(await c.query('SELECT * FROM trade.inquiries ORDER BY created_at DESC LIMIT 100')).rows}));
  }
  if(p==='/api/trade/inquiries' && method==='POST'){
   const u=requireCompany(ctx,'trade',true),inquiryId=uuid();return scoped(trade,u.company_id,async c=>{
    const listing=(await c.query("SELECT * FROM trade.listings WHERE id=$1 AND status='published' AND expires_on>=CURRENT_DATE",[id(body.listing_id)])).rows[0];check(listing,'not_found',404);check(listing.company_id!==u.company_id,'own_listing',409);
    const target=(await identity.query("SELECT id FROM identity.companies WHERE id=$1 AND status='verified'",[listing.company_id])).rows[0];check(target,'not_found',404);
    await c.query('INSERT INTO trade.inquiries(id,listing_id,sender_id,recipient_id,subject,message) VALUES($1,$2,$3,$4,$5,$6)',[inquiryId,listing.id,u.company_id,listing.company_id,str(body.subject,3,180),str(body.message,10,4000)]);await log(c,u,'inquiry.created',inquiryId);ctx.status=201;return {id:inquiryId};
   });
  }
  const inquiry=p.match(/^\/api\/trade\/inquiries\/([\w-]+)(?:\/(messages))?$/);
  if(inquiry){const u=requireCompany(ctx),iid=id(inquiry[1]);return scoped(trade,u.company_id,async c=>{
   const record=(await c.query('SELECT * FROM trade.inquiries WHERE id=$1',[iid])).rows[0];check(record,'not_found',404);
   if(method==='GET')return {...record,messages:(await c.query('SELECT * FROM trade.messages WHERE inquiry_id=$1 ORDER BY created_at,id',[iid])).rows};
   requireCompany(ctx,'trade',true);
   if(method==='POST' && inquiry[2]){await c.query('INSERT INTO trade.messages(id,inquiry_id,company_id,body) VALUES($1,$2,$3,$4)',[uuid(),iid,u.company_id,str(body.message,1,4000)]);await c.query("UPDATE trade.inquiries SET status='answered' WHERE id=$1 AND status='open'",[iid]);await log(c,u,'inquiry.replied',iid);ctx.status=201;return {ok:true};}
   if(method==='PATCH' && !inquiry[2]){await c.query('UPDATE trade.inquiries SET status=$2 WHERE id=$1',[iid,choice(body.status,['open','closed'])]);await log(c,u,'inquiry.updated',iid);return {ok:true};}
   fail(405,'method_not_allowed');
  });}
  fail(404,'not_found');
 };
}
