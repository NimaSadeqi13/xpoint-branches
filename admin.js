import {categories,normalize,parsePin,makeBranch,changesFrom} from './admin-data.js?v=22';
const $=id=>document.getElementById(id),clone=value=>structuredClone(value),fa=value=>new Intl.NumberFormat('fa-IR').format(value);
const endpoint='https://api.github.com/repos/XpointShops/Map/contents/branches.json';
let token='',base=null,draft=null,sha='',features=[],busy=false,editingId='',confirmAction=null;
function message(text,type=''){ $('message').textContent=text;$('message').className='admin-message '+type; }
function dirty(){return base&&draft?changesFrom(base,draft):[];}
function text(tag,value,className){const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;}
function updateButtons(){const changed=dirty().length>0; $('add').disabled=!draft||busy;$('publish').disabled=!changed||!token||busy;$('discard').disabled=!changed||busy;$('reload').disabled=busy;$('connect').disabled=busy;$('disconnect').disabled=busy;document.querySelectorAll('#admin-list button').forEach(b=>b.disabled=busy);}
function render(){
 if(!draft){updateButtons();return;}
 const changes=dirty();$('total').textContent=fa(draft.branches.length);$('active').textContent=fa(draft.branches.filter(b=>b.status==='فعال').length);$('province-count').textContent=fa(new Set(draft.branches.map(b=>b.province)).size);$('pending-count').textContent=fa(changes.length);
 $('pending-title').textContent=changes.length?fa(changes.length)+' تغییر آماده انتشار':'اطلاعات به‌روز است';
 $('pending-description').textContent=changes.length?(token?'این تغییرات با انتشار روی سایت اعمال می‌شوند.':'تغییرات آماده‌اند؛ برای انتشار، از بخش بالا وارد مدیریت شوید.'):'تغییرات را بررسی کنید و سپس منتشر کنید.';
 $('changes-list').replaceChildren(...changes.map(c=>text('li',c.type+': '+c.name)));$('changes-list').hidden=!changes.length;
 const q=normalize($('admin-search').value),category=$('admin-category').value;
 const rows=draft.branches.filter(b=>(!category||b.category===category)&&(!q||normalize([b.name,b.city,b.province,b.address].join(' ')).includes(q)));
 $('admin-list').replaceChildren();$('list-empty').hidden=rows.length>0;
 for(const b of rows){
  const row=document.createElement('tr'),identity=document.createElement('td');identity.append(text('strong',b.name),text('small',b.province+' / '+b.city));row.append(identity);
  const type=document.createElement('td');type.append(text('span',categories[b.category]||b.category,'table-tag '+b.category));row.append(type,text('td',b.phone||'—','table-phone'),text('td',b.status||'—'));
  const actions=document.createElement('td'),group=text('div','','table-actions');
  for(const [label,action,cls] of [['ویرایش',()=>openEditor(b.id),''],['حذف',()=>confirm('حذف '+b.name+'؟','این شعبه از فهرست تغییرات حذف می‌شود. حذف نهایی پس از «انتشار روی سایت» انجام می‌شود.',()=>{draft.branches=draft.branches.filter(x=>x.id!==b.id);render();message('حذف شعبه در فهرست تغییرات ثبت شد.');}),'delete']]){
   const button=text('button',label,cls);button.type='button';button.setAttribute('aria-label',label+' '+b.name);button.addEventListener('click',action);group.append(button);
  }actions.append(group);row.append(actions);$('admin-list').append(row);
 }updateButtons();
}
function confirm(title,copy,action){$('confirm-title').textContent=title;$('confirm-copy').textContent=copy;confirmAction=action;$('confirmation').showModal();}
$('confirm-cancel').addEventListener('click',()=>{$('confirmation').close();confirmAction=null;});
$('confirmation').addEventListener('cancel',()=>{confirmAction=null;});
$('confirm-yes').addEventListener('click',()=>{const action=confirmAction;confirmAction=null;$('confirmation').close();action?.();});
function validateData(data){if(!data||!Array.isArray(data.branches)||data.branches.some(b=>!b||typeof b.id!=='string'||typeof b.name!=='string')||new Set(data.branches.map(b=>b.id)).size!==data.branches.length)throw Error('ساختار اطلاعات شعب معتبر نیست.');return data;}
function encode(value){return btoa(Array.from(new TextEncoder().encode(value),b=>String.fromCharCode(b)).join(''));}
function decode(value){return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\s/g,'')),c=>c.charCodeAt(0)));}
async function api(url,options={}){
 let response;try{response=await fetch(url,{...options,cache:'no-store',redirect:'error',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10',...(token?{Authorization:'Bearer '+token}:{}),...(options.body?{'Content-Type':'application/json'}:{})}});}catch{throw Error('ارتباط با گیت‌هاب برقرار نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.');}
 if(!response.ok){
  if(response.status===401){token='';connection();throw Error('کلید معتبر نیست یا منقضی شده است. دوباره وارد مدیریت شوید.');}
  if(response.status===403||response.status===404)throw Error('دسترسی به مخزن تأیید نشد. دسترسی کلید به XpointShops/Map و مجوز Contents را بررسی کنید.');
  if(response.status===409)throw Error('اطلاعات سایت هم‌زمان تغییر کرده است. تغییرات شما حفظ شده؛ برای ادامه، نسخه جدید را دریافت و تغییرات را دوباره ثبت کنید.');
  if(response.status===422)throw Error('گیت‌هاب انتشار را نپذیرفت. مجوز نوشتن و محدودیت‌های شاخه main را بررسی کنید.');
  throw Error('دریافت یا ثبت اطلاعات انجام نشد. دوباره تلاش کنید.');
 }return response.json();
}
async function repoFile(){const file=await api(endpoint+'?ref=main');if(file.encoding!=='base64'||!file.sha)throw Error('فایل اطلاعات شعب دریافت نشد.');return {data:validateData(JSON.parse(decode(file.content))),sha:file.sha};}
function connection(){const connected=!!token;$('connect-form').hidden=connected;$('disconnect').hidden=!connected;$('connection-state').textContent=connected?'متصل به مخزن شعب؛ انتشار تغییرات در دسترس است.':'برای انتشار تغییرات، به حساب گیت‌هاب متصل شوید.';updateButtons();}
async function load(connected=false){
 busy=true;updateButtons();
 try{
  if(!features.length){const response=await fetch('assets/provinces.json');if(!response.ok)throw Error('نقشه استان‌ها دریافت نشد.');features=(await response.json()).features;const names=features.map(f=>f.properties['name:fa']).sort((a,b)=>a.localeCompare(b,'fa'));for(const name of names){const o=text('option',name);o.value=name;$('form-province').append(o);}}
  if(connected){const result=await repoFile();base=clone(result.data);sha=result.sha;}
  else {const response=await fetch('branches.json',{cache:'no-store'});if(!response.ok)throw Error('اطلاعات شعب دریافت نشد. دوباره تلاش کنید.');base=validateData(await response.json());sha='';}
  draft=clone(base);message('اطلاعات '+fa(base.branches.length)+' شعبه دریافت شد.','success');render();return true;
 }catch(error){message(error.message,'error');return false;}finally{busy=false;updateButtons();}
}
$('connect-form').addEventListener('submit',async e=>{
 e.preventDefault();const next=$('token').value.trim();$('token').value='';if(!next)return;
 busy=true;updateButtons();token=next;
 try{const result=await repoFile();
  if(dirty().length&&sha&&sha!==result.sha)throw Error('نسخه سایت تغییر کرده است. تغییرات فعلی را بررسی و سپس با «دریافت دوباره» نسخه جدید را دریافت کنید.');
  if(dirty().length&&JSON.stringify(base.branches)!==JSON.stringify(result.data.branches))throw Error('نسخه سایت تغییر کرده است. ابتدا نسخه جدید را دریافت و تغییرات خود را دوباره ثبت کنید.');
  if(!dirty().length){base=clone(result.data);draft=clone(result.data);}sha=result.sha;connection();message('ورود مدیر انجام شد. می‌توانید تغییرات را منتشر کنید.','success');render();
 }catch(error){token='';connection();message(error.message,'error');}finally{busy=false;updateButtons();}
});
$('disconnect').addEventListener('click',()=>{token='';sha='';connection();message('از مدیریت خارج شدید. تغییرات منتشرنشده فقط تا زمان باز بودن صفحه باقی می‌مانند.');});
$('reload').addEventListener('click',()=>{const action=()=>load(!!token);if(dirty().length)confirm('دریافت نسخه جدید؟','تغییرات منتشرنشده کنار گذاشته می‌شوند و آخرین اطلاعات سایت دریافت می‌شود.',action);else action();});
function openEditor(id=''){
 editingId=id;$('branch-form').reset();$('form-error').textContent='';$('editor-title').textContent=id?'ویرایش شعبه':'شعبه جدید';
 const b=draft.branches.find(b=>b.id===id);
 // Some existing source statuses differ from the form's common choices.
 if(b){const field=$('branch-form').elements.namedItem('status');if(![...field.options].some(o=>o.value===b.status)){const o=text('option',b.status);o.value=b.status;field.append(o);}for(const [key,value] of Object.entries(b)){const field=$('branch-form').elements.namedItem(key);if(field&&typeof value!=='object')field.value=String(value);}}
 $('editor').showModal();
}
$('add').addEventListener('click',()=>openEditor());
for(const id of ['close-editor','cancel-editor'])$(id).addEventListener('click',()=>$('editor').close());
$('map-link').addEventListener('input',()=>{const value=$('map-link').value.trim();if(!value){$('form-error').textContent='';return;}const pin=parsePin(value);if(pin){$('branch-form').elements.latitude.value=pin[0];$('branch-form').elements.longitude.value=pin[1];$('form-error').textContent='';}else $('form-error').textContent='این لینک مختصات پین را ندارد. مختصات دقیق را در کادرهای زیر وارد کنید؛ مرکز نمای نقشه استفاده نمی‌شود.';});
$('branch-form').addEventListener('submit',e=>{
 e.preventDefault();if(busy)return;
 try{const values=Object.fromEntries(new FormData(e.currentTarget));const previous=draft.branches.find(b=>b.id===editingId);const b=makeBranch(values,previous,features);
  if(draft.branches.some(x=>x.id!==editingId&&normalize(x.name)===normalize(b.name)&&x.province===b.province&&normalize(x.city)===normalize(b.city)&&normalize(x.address)===normalize(b.address)))throw Error('این شعبه با همین نام و آدرس در فهرست وجود دارد.');
  if(previous)draft.branches[draft.branches.findIndex(x=>x.id===editingId)]=b;
  else {const maxId=Math.max(0,...base.branches.map(x=>Number(x.id.replace(/^branch-/,''))||0),...draft.branches.map(x=>Number(x.id.replace(/^branch-/,''))||0));const next=Math.max(Number(draft.nextBranchNumber)||0,maxId+1);b.id='branch-'+String(next).padStart(3,'0');draft.nextBranchNumber=next+1;draft.branches.push(b);}
  $('editor').close();$('deploy-link').hidden=true;render();message('تغییر شعبه ثبت شد. برای نمایش عمومی، «انتشار روی سایت» را بزنید.');
 }catch(error){$('form-error').textContent=error.message;}
});
$('admin-search').addEventListener('input',render);$('admin-category').addEventListener('change',render);
$('discard').addEventListener('click',()=>confirm('لغو تغییرات؟','تمام تغییرات منتشرنشده کنار گذاشته می‌شوند.',()=>{draft=clone(base);render();message('تغییرات منتشرنشده لغو شدند.');}));
async function publish(){
 if(busy||!token||!dirty().length)return;
 busy=true;updateButtons();message('در حال بررسی نسخه سایت و انتشار تغییرات…');
 try{
  const latest=await repoFile();if(latest.sha!==sha)throw Error('نسخه سایت تغییر کرده است؛ برای جلوگیری از پاک‌شدن تغییرات دیگران، انتشار متوقف شد. تغییرات شما حفظ شده است. نسخه جدید را دریافت و تغییرات را دوباره ثبت کنید.');
  const changes=dirty();draft.updatedAt=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const result=await api(endpoint,{method:'PUT',body:JSON.stringify({message:'Update branches from management dashboard ('+changes.length+' changes)',content:encode(JSON.stringify(draft,null,2)+'\n'),sha,branch:'main'})});
  if(!result.content?.sha)throw Error('پاسخ انتشار دریافت نشد؛ پیش از تلاش مجدد، نسخه سایت را بررسی کنید.');
  sha=result.content.sha;base=clone(draft);render();$('deploy-link').hidden=false;message('تغییرات در گیت‌هاب ثبت شد. نسخه عمومی پس از پایان انتشار گیت‌هاب به‌روز می‌شود.','success');
 }catch(error){message(error.message,'error');}finally{busy=false;updateButtons();}
}
$('publish').addEventListener('click',()=>{const changes=dirty();if(!token||!changes.length)return;confirm('انتشار '+fa(changes.length)+' تغییر؟',changes.map(c=>c.type+': '+c.name).join('\n')+'\n\nاین تغییرات روی سایت عمومی اعمال می‌شوند.',publish);});
window.addEventListener('beforeunload',e=>{if(dirty().length){e.preventDefault();e.returnValue='';}});
// Escape dismisses dialogs natively. No credential or draft is written to storage.
connection();load();
