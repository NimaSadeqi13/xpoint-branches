import {makeBranch} from './admin-data.js';
import provinces from './provinces.json';
import initialData from './initial-data.json';
const ORIGIN='https://xpointshops.github.io';
const encoder=new TextEncoder();
const provinceFeatures=(typeof provinces==='string'?JSON.parse(provinces):provinces).features;
const seed=typeof initialData==='string'?JSON.parse(initialData):initialData;
const hex=buffer=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
const hash=async text=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
function reply(data,status=200){return Response.json(data,{status,headers:{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'}});}
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
async function body(request,limit){const raw=await request.text();if(encoder.encode(raw).length>limit)throw new HttpError(413,'حجم درخواست بیش از حد مجاز است.');try{return JSON.parse(raw);}catch{throw new HttpError(400,'اطلاعات درخواست معتبر نیست.');}}
async function throttle(db,key,max,seconds){const now=Math.floor(Date.now()/1000);const row=await db.prepare('INSERT INTO attempts (id,count,reset_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at<=? THEN ? ELSE reset_at END RETURNING count').bind(key,now+seconds,now,now,now+seconds).first();if(row.count>max)throw new HttpError(429,'تعداد تلاش‌ها زیاد است. چند دقیقه بعد دوباره تلاش کنید.');}
async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256));}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
async function session(request,env){const value=request.headers.get('Authorization')||'';if(!/^Bearer [a-f0-9]{64}$/.test(value))throw new HttpError(401,'برای ادامه، وارد حساب مدیریت شوید.');const id=await hash(value.slice(7));const row=await env.AUTH_DB.prepare('SELECT id,expires_at FROM sessions WHERE id=? AND expires_at>?').bind(id,Math.floor(Date.now()/1000)).first();if(!row)throw new HttpError(401,'نشست منقضی شده است. دوباره وارد شوید.');return row;}
async function file(env){
 let row=await env.AUTH_DB.prepare('SELECT content,revision FROM documents WHERE id=?').bind('branches').first();
 if(!row){await env.AUTH_DB.prepare('INSERT OR IGNORE INTO documents(id,content,revision) VALUES (?,?,1)').bind('branches',JSON.stringify(seed)).run();row=await env.AUTH_DB.prepare('SELECT content,revision FROM documents WHERE id=?').bind('branches').first();}
 let data=JSON.parse(row.content);if(typeof data==='string'){data=JSON.parse(data);await env.AUTH_DB.prepare('UPDATE documents SET content=? WHERE id=? AND revision=?').bind(JSON.stringify(data),'branches',row.revision).run();}
 return {sha:String(row.revision),data};
}
function validatePublication(input,current){
 if(!input||input.sha!==current.sha)throw new HttpError(409,'نسخه سایت تغییر کرده است؛ تغییرات شما حفظ شده است. نسخه جدید را دریافت کنید.');
 let incoming=input.data;
 if(Array.isArray(input.operations)){
  if(input.operations.length>500)throw new HttpError(400,'تعداد تغییرات در هر بار انتشار بیش از حد مجاز است.');
  const records=new Map(current.data.branches.map(b=>[b.id,b])),seen=new Set();
  for(const op of input.operations){const id=op?.type==='upsert'?op.branch?.id:op?.id;if(typeof id!=='string'||seen.has(id))throw new HttpError(400,'شناسه تغییر معتبر یا یکتا نیست.');seen.add(id);if(op.type==='delete'){if(!records.has(id))throw new HttpError(400,'شعبه موردنظر برای حذف وجود ندارد.');records.delete(id);}else if(op.type==='upsert'&&op.branch&&typeof op.branch==='object')records.set(id,op.branch);else throw new HttpError(400,'نوع تغییر معتبر نیست.');}
  incoming={...current.data,branches:[...records.values()]};
 }
 if(!incoming||!Array.isArray(incoming.branches)||incoming.branches.length>2000)throw new HttpError(400,'فهرست شعب معتبر نیست.');
 const ids=new Set(),originals=new Map(current.data.branches.map(b=>[b.id,b]));
 const highest=Math.max(0,...current.data.branches.map(b=>Number(b.id.slice(7))||0));
 const floor=Math.max(highest+1,Number(current.data.nextBranchNumber)||1);
 let next=floor;
 const branches=incoming.branches.map(b=>{
  if(!b||typeof b.id!=='string'||!/^branch-\d{3,8}$/.test(b.id)||ids.has(b.id))throw new HttpError(400,'شناسه شعبه معتبر یا یکتا نیست.');ids.add(b.id);
  const previous=originals.get(b.id);const number=Number(b.id.slice(7));if(!previous&&number<floor)throw new HttpError(400,'شناسه شعبه قبلاً استفاده شده است.');next=Math.max(next,number+1);
  for(const key of ['name','category','status','province','city','address','phone','hours'])if(typeof b[key]!=='string'||b[key].length>2000)throw new HttpError(400,'اطلاعات شعبه کامل نیست.');
  if(!['فعال','در حال بازسازی','غیرفعال','طراحی مجدد'].includes(b.status))throw new HttpError(400,'وضعیت شعبه معتبر نیست.');
  if(previous&&JSON.stringify(b)===JSON.stringify(previous))return previous;
  try{return {...makeBranch(b,previous,provinceFeatures),id:b.id};}catch(error){throw new HttpError(400,b.name+': '+error.message);}
 });
 return {...current.data,branches,nextBranchNumber:next,updatedAt:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())};
}
export default {async fetch(request,env){
 try{
  const path=new URL(request.url).pathname;
  if(path==='/health'&&request.method==='GET')return reply({ok:true});
  if(path==='/api/branches'&&request.method==='GET')return reply((await file(env)).data);
  if(request.headers.get('Origin')!==ORIGIN)return reply({error:'مبدأ درخواست مجاز نیست.'},403);
  if(request.method==='OPTIONS')return reply({ok:true});
  if(path==='/api/login'&&request.method==='POST'){
   const ip=await hash(request.headers.get('CF-Connecting-IP')||'unknown');await throttle(env.AUTH_DB,'login:'+ip,8,900);
   const input=await body(request,2048);if(typeof input.username!=='string'||typeof input.password!=='string'||input.password.length>256)throw new HttpError(400,'نام کاربری و رمز را وارد کنید.');
   const actual=await passwordHash(input.password,env.ADMIN_PASSWORD_SALT);
   if(!equal(actual,env.ADMIN_PASSWORD_HASH)||!equal(input.username,env.ADMIN_USERNAME))throw new HttpError(401,'نام کاربری یا رمز عبور درست نیست.');
   const token=hex(crypto.getRandomValues(new Uint8Array(32))),now=Math.floor(Date.now()/1000),expires=now+8*3600;
   await env.AUTH_DB.batch([env.AUTH_DB.prepare('DELETE FROM attempts WHERE id=? OR reset_at<=?').bind('login:'+ip,now),env.AUTH_DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now),env.AUTH_DB.prepare('INSERT INTO sessions(id,expires_at) VALUES (?,?)').bind(await hash(token),expires)]);
   return reply({token,expiresAt:expires,username:env.ADMIN_USERNAME});
  }
  const auth=await session(request,env);
  if(path==='/api/logout'&&request.method==='POST'){await env.AUTH_DB.prepare('DELETE FROM sessions WHERE id=?').bind(auth.id).run();return reply({ok:true});}
  if(path==='/api/data'&&request.method==='GET')return reply(await file(env));
  if(path==='/api/publish'&&request.method==='POST'){
   await throttle(env.AUTH_DB,'publish:'+auth.id,20,60);
   const input=await body(request,1500000),current=await file(env),data=validatePublication(input,current);
   const result=await env.AUTH_DB.prepare('UPDATE documents SET content=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(data),'branches',Number(current.sha)).run();
   if(!result.meta.changes)throw new HttpError(409,'اطلاعات هم‌زمان تغییر کرده است؛ نسخه جدید را دریافت کنید.');
   return reply({sha:String(Number(current.sha)+1),data});
  }
  return reply({error:'مسیر درخواست پیدا نشد.'},404);
 }catch(error){return reply({error:error instanceof HttpError?error.message:'خطای موقت سرور؛ دوباره تلاش کنید.'},error instanceof HttpError?error.status:500);}
}};
export {passwordHash,validatePublication};
