'use strict';
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const normalize = s => String(s || '').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200f\u200e]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
const fa = n => new Intl.NumberFormat('fa-IR').format(n);
let features = [], branches = [], selected = '', activeBranch = '', query = '', category = '', fullBounds, dataFailed = false;
const categories = {xpoint:'ایکس‌پوینت',maadiran:'مادیران',kanon:'کانون',xvision:'ایکس‌ویژن‌شاپ'};
const matchesCategory = b => !category || b.category===category;
const matchesQuery = b => !query || normalize([b.name,b.city,b.province,b.address,categories[b.category]].join(' ')).includes(query);
function writeHash(){const params=new URLSearchParams();if(selected)params.set('province',selected);if(category)params.set('type',category);const hash=params.size?'#'+params.toString():'';if(location.hash!==hash)history.pushState(null,'',location.pathname+location.search+hash)}
function renderCategories(){
  $('category-filters').replaceChildren();
  for(const [key,label] of [['','همه'],...Object.entries(categories)]){
    const count=branches.filter(b=>(!selected||b.province===selected)&&(!key||b.category===key)).length;
    const button=node('button',{type:'button','data-category':key,'aria-pressed':String(category===key)},label+' '+fa(count));
    button.addEventListener('click',()=>{category=key;activeBranch='';writeHash();drawMap();renderResults();renderCategories()});$('category-filters').append(button);
  }
}
const project = ([lon,lat]) => [lon * Math.PI / 180, -Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];
function rings(feature) { return feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates.flat() : feature.geometry.coordinates; }
function bounds(fs) { const pts = fs.flatMap(f => rings(f).flat().map(project)); return [Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))]; }
function transform(b) { const scale = Math.min(710/(b[2]-b[0]),490/(b[3]-b[1])); return p => [400 + (p[0]-(b[0]+b[2])/2)*scale,345+(p[1]-(b[1]+b[3])/2)*scale]; }
const provinceName = f => f.properties['name:fa'];
function node(tag,attrs={},text) { const el = document.createElement(tag); Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v)); if(text!==undefined)el.textContent=text; return el; }
function svgNode(tag,attrs) { const el=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));return el; }
function setProvince(name,updateHash=true) {
  selected = features.some(f=>provinceName(f)===name) ? name : ''; activeBranch='';
  $('province-select').value=selected;
  if(updateHash) writeHash();
  $('province-crumb').textContent=selected;
  $('reset').hidden=!selected;
  $('map-title').textContent=selected ? 'استان '+selected : 'از کجای ایران همراه مایید؟';
  $('map-subtitle').textContent=selected ? 'نقشه استان و اطلاعات شعب' : 'برای دیدن نقشه هر استان، آن را انتخاب کنید.';
  $('map').setAttribute('aria-label',selected?'نقشه استان '+selected:'نقشه تعاملی استان‌های ایران');
  $('caspian').hidden=!!selected; $('gulf').hidden=!!selected;
  $('map-caption').textContent=selected ? 'برای تغییر استان، از فهرست استفاده کنید.' : 'همه استان‌های ایران';
  $('tooltip').classList.remove('visible');
  drawMap();renderResults();renderCategories();
}
function drawMap() {
  const feature=features.find(f=>provinceName(f)===selected);
  const fit=transform(feature?bounds([feature]):fullBounds);
  $('regions').replaceChildren(); $('pins').replaceChildren();
  for(const f of feature?[feature]:features) {
    const name=provinceName(f);
    const path=svgNode('path',{d:rings(f).map(r=>r.map((p,i)=>{const [x,y]=fit(project(p));return (i?'L':'M')+x.toFixed(2)+','+y.toFixed(2)}).join('')+'Z').join(''),class:'region'+(name===selected?' selected':''),role:'button',tabindex:'0','aria-label':'انتخاب استان '+name,'aria-pressed':String(name===selected),'data-province':name});
    const title=svgNode('title',{});title.textContent=name;path.append(title);
    path.style.fill='#e5e8eb';
    path.addEventListener('click',()=>setProvince(name));
    path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setProvince(name)}});
    path.addEventListener('pointermove',e=>{const rect=$('map-stage').getBoundingClientRect();$('tooltip').textContent=name;$('tooltip').style.left=(e.clientX-rect.left)+'px';$('tooltip').style.top=(e.clientY-rect.top)+'px';$('tooltip').classList.add('visible')});
    path.addEventListener('pointerleave',()=>$('tooltip').classList.remove('visible'));
    $('regions').append(path);
  }
  const visibleBranches=branches.filter(b=>(!selected||b.province===selected)&&matchesCategory(b)&&matchesQuery(b)).sort((a,b)=>Number(a.id===activeBranch)-Number(b.id===activeBranch)||Number(a.category==='xpoint')-Number(b.category==='xpoint'));
  for(const b of visibleBranches) {
    if(!validCoordinates(b))continue;
    const [x,y]=fit(project([b.longitude,b.latitude]));
    const pin=svgNode('circle',{cx:x,cy:y,r:selected?8:5,class:'pin'+(b.id===activeBranch?' active':''),'data-branch-id':b.id,'data-store-category':b.category||'','data-latitude':b.latitude,'data-longitude':b.longitude,role:'button',tabindex:'0','aria-label':b.name+'، '+(categories[b.category]||'')+'، '+(b.status||'')});
    const title=svgNode('title',{});title.textContent=b.name;pin.append(title);
    const choose=()=>{if(!selected){setProvince(b.province)}activeBranch=b.id;renderResults();drawMap();const card=document.getElementById('branch-'+b.id);card?.scrollIntoView({block:'nearest',behavior:'smooth'});card?.focus({preventScroll:true})};
    pin.addEventListener('click',choose);pin.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}});$('pins').append(pin);
  }
}
function validCoordinates(b){return typeof b.latitude==='number'&&typeof b.longitude==='number'&&b.latitude>=-90&&b.latitude<=90&&b.longitude>=-180&&b.longitude<=180}
function renderResults() {
  const list=$('result-list');list.replaceChildren();
  $('results-title').textContent=selected?'شعب استان '+selected:'مقصدتان را انتخاب کنید';
  const matchingBranches=branches.filter(b=>(!selected||b.province===selected)&&matchesCategory(b)&&matchesQuery(b)).sort((a,b)=>Number(b.status==='فعال')-Number(a.status==='فعال')||a.name.localeCompare(b.name,'fa'));
  if(matchingBranches.length&&(selected||query)){
    $('status').textContent=fa(matchingBranches.length)+' شعبه';
    for(const b of matchingBranches)list.append(branchCard(b));
    return;
  }
  if(!selected){
    const provinces=features.map(provinceName).filter(name=>(!query||normalize(name).includes(query))&&(!category||branches.some(b=>b.province===name&&matchesCategory(b)))).sort((a,b)=>a.localeCompare(b,'fa'));
    $('status').textContent=provinces.length ? fa(matchingBranches.length)+' شعبه · استان موردنظرتان را انتخاب کنید' : 'نتیجه‌ای پیدا نشد';
    for(const name of provinces){const count=branches.filter(b=>b.province===name&&matchesCategory(b)).length;const button=node('button',{class:'province-option',type:'button'},name);button.append(node('span',{},count?fa(count)+' شعبه ←':'اطلاعاتی ثبت نشده'));button.addEventListener('click',()=>{query='';$('search').value='';$('clear-search').hidden=true;setProvince(name)});list.append(button)}
    if(provinces.length)return;
  }else $('status').textContent=query?'نتیجه جست‌وجو در '+selected:'اطلاعات شعب';
  const empty=node('div',{class:'empty'});empty.append(node('div',{class:'empty-icon','aria-hidden':'true'},'⌖'));
  const hasProvinceData=branches.some(b=>b.province===selected);
  const title=dataFailed?'اطلاعات شعب دریافت نشد':query?'نتیجه‌ای پیدا نشد':hasProvinceData?'شعبه‌ای با این مشخصات پیدا نشد':'شعبه‌ای در این استان ثبت نشده است';
  const message=dataFailed?'اتصال خود را بررسی و دوباره تلاش کنید.':query||category?'جست‌وجو یا نوع فروشگاه را تغییر دهید.':'استان دیگری را انتخاب کنید.';
  empty.append(node('h3',{},title),node('p',{},message));
  if(dataFailed){const retry=node('button',{class:'retry',type:'button'},'تلاش دوباره');retry.addEventListener('click',()=>location.reload());empty.append(retry)}list.append(empty);
}
function branchCard(b){
  const card=node('article',{class:'branch-card'+(activeBranch===b.id?' active':''),id:'branch-'+b.id,tabindex:'0'});
  const meta=node('div',{class:'branch-meta'});meta.append(node('span',{class:'branch-city'},b.city||b.province),node('span',{class:'category-badge'},categories[b.category]||'شعبه'));card.append(meta,node('h3',{},b.name));
  if(b.status&&b.status!=='فعال')card.append(node('p',{class:'branch-status'},b.status+' · پیش از مراجعه تماس بگیرید'));
  card.append(node('p',{},b.address||'آدرس در حال تکمیل است'));
  if(b.hours)card.append(node('p',{},'ساعت کاری: '+b.hours));
  const phones=Array.isArray(b.phones)?b.phones:[String(b.phone||'').replace(/[^+\d]/g,'')].filter(p=>/^\+?\d{7,15}$/.test(p));
  if(b.phone)card.append(node('p',{dir:'ltr',class:'phone-number'},b.phone));
  const actions=node('div',{class:'branch-actions'});
  for(const [i,phone] of phones.entries())actions.append(node('a',{href:'tel:'+phone,'aria-label':'تماس با '+b.name+(i?'، شماره '+fa(i+1):'')},phones.length===1?'تماس با شعبه':'تماس '+fa(i+1)));
  if(validCoordinates(b))actions.append(node('a',{href:'https://neshan.org/maps/routing/car/destination/'+b.latitude+','+b.longitude,target:'_blank',rel:'noopener noreferrer',class:'primary','aria-label':'مسیریابی با نشان به '+b.name},'مسیریابی با نشان ↗'));
  else if(b.neshanUrl&&/^https:\/\/(?:nshn\.ir|neshan\.org)\//.test(b.neshanUrl))actions.append(node('a',{href:b.neshanUrl,target:'_blank',rel:'noopener noreferrer',class:'primary'},'نمایش در نشان ↗'));
  else card.append(node('p',{class:'location-note'},'موقعیت دقیق در فهرست شعب ثبت نشده است.'));
  if(b.phone&&!phones.length)card.append(node('p',{class:'location-note'},'شماره تماس نیاز به بررسی دارد.'));
  if(b.address){const copy=node('button',{type:'button',class:'copy-address'},'کپی آدرس');copy.addEventListener('click',async e=>{e.stopPropagation();try{await navigator.clipboard.writeText(b.city+'، '+b.address);copy.textContent='آدرس کپی شد'}catch{copy.textContent='برای کپی، آدرس را انتخاب کنید'}});actions.append(copy)}
  card.append(actions);
  card.addEventListener('click',e=>{if(e.target.closest('a,button'))return;activeBranch=b.id;drawMap();document.querySelectorAll('.branch-card').forEach(c=>c.classList.toggle('active',c.id==='branch-'+b.id))});
  card.addEventListener('keydown',e=>{if(e.target===card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();card.click()}});
  return card;
}
function readHash(){const params=new URLSearchParams(location.hash.slice(1));category=Object.hasOwn(categories,params.get('type'))?params.get('type'):'';setProvince(params.get('province')||'',false)}
async function init(){
  try{
    const response=await fetch('assets/provinces.json');if(!response.ok)throw Error('Map request failed');const data=await response.json();features=data.features;
    if(!Array.isArray(features)||features.length!==31)throw Error('Invalid province map');fullBounds=bounds(features);
    try{const response=await fetch('branches.json',{cache:'no-store'});if(!response.ok)throw Error('Branches request failed');const data=await response.json();if(!Array.isArray(data.branches))throw Error('Invalid branch data');branches=data.branches.filter(b=>b&&typeof b.id==='string'&&typeof b.name==='string'&&features.some(f=>provinceName(f)===b.province))}catch{dataFailed=true}
    features.map(provinceName).sort((a,b)=>a.localeCompare(b,'fa')).forEach(name=>$('province-select').append(node('option',{value:name},name)));
    $('map-loading').hidden=true;readHash();
  }catch{
    $('map-loading').textContent='نقشه دریافت نشد. لطفاً دوباره تلاش کنید.';
    const retry=node('button',{type:'button',class:'retry'},'تلاش دوباره');retry.addEventListener('click',()=>location.reload());$('map-loading').append(retry);$('status').textContent='خطا در دریافت نقشه';
  }
}
$('home').addEventListener('click',()=>setProvince(''));$('reset').addEventListener('click',()=>setProvince(''));
$('province-select').addEventListener('change',e=>{query='';$('search').value='';$('clear-search').hidden=true;setProvince(e.target.value)});
$('search').addEventListener('input',e=>{query=normalize(e.target.value);$('clear-search').hidden=!e.target.value;renderResults();if(features.length)drawMap()});
$('clear-search').addEventListener('click',()=>{query='';$('search').value='';$('clear-search').hidden=true;renderResults();if(features.length)drawMap();$('search').focus()});
window.addEventListener('popstate',readHash);window.addEventListener('hashchange',readHash);init();
