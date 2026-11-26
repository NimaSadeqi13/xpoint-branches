'use strict';
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const normalize = s => String(s || '').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200f\u200e]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
const fa = n => new Intl.NumberFormat('fa-IR').format(n);
let features = [], branches = [], selected = '', activeBranch = '', query = '', fullBounds, dataFailed = false;
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
  if(updateHash) { const hash=selected?'#province='+encodeURIComponent(selected):'';if(location.hash!==hash)history.pushState(null,'',location.pathname+location.search+hash); }
  $('province-crumb').textContent=selected;
  $('reset').hidden=!selected;
  $('map-title').textContent=selected ? 'استان '+selected : 'از کجای ایران همراه مایید؟';
  $('map-subtitle').textContent=selected ? 'نقشه استان و اطلاعات شعب' : 'برای دیدن نقشه هر استان، آن را انتخاب کنید.';
  $('map').setAttribute('aria-label',selected?'نقشه استان '+selected:'نقشه تعاملی استان‌های ایران');
  $('caspian').hidden=!!selected; $('gulf').hidden=!!selected;
  $('map-caption').textContent=selected ? 'برای تغییر استان، از فهرست استفاده کنید.' : 'همه استان‌های ایران';
  $('tooltip').classList.remove('visible');
  drawMap();renderResults();
}
function drawMap() {
  const feature=features.find(f=>provinceName(f)===selected);
  const fit=transform(feature?bounds([feature]):fullBounds);
  $('regions').replaceChildren(); $('pins').replaceChildren();
  for(const f of feature?[feature]:features) {
    const name=provinceName(f);
    const path=svgNode('path',{d:rings(f).map(r=>r.map((p,i)=>{const [x,y]=fit(project(p));return (i?'L':'M')+x.toFixed(2)+','+y.toFixed(2)}).join('')+'Z').join(''),class:'region'+(name===selected?' selected':''),role:'button',tabindex:'0','aria-label':'انتخاب استان '+name,'aria-pressed':String(name===selected),'data-province':name});
    const title=svgNode('title',{});title.textContent=name;path.append(title);
    path.addEventListener('click',()=>setProvince(name));
    path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setProvince(name)}});
    path.addEventListener('pointermove',e=>{const rect=$('map-stage').getBoundingClientRect();$('tooltip').textContent=name;$('tooltip').style.left=(e.clientX-rect.left)+'px';$('tooltip').style.top=(e.clientY-rect.top)+'px';$('tooltip').classList.add('visible')});
    path.addEventListener('pointerleave',()=>$('tooltip').classList.remove('visible'));
    $('regions').append(path);
  }
  for(const b of branches.filter(b=>!selected||b.province===selected)) {
    if(!validCoordinates(b))continue;
    const [x,y]=fit(project([b.longitude,b.latitude]));
    const pin=svgNode('circle',{cx:x,cy:y,r:selected?8:5,class:'pin'+(b.id===activeBranch?' active':''),role:'button',tabindex:'0','aria-label':b.name});
    const choose=()=>{if(!selected){setProvince(b.province)}activeBranch=b.id;renderResults();drawMap();const card=document.getElementById('branch-'+b.id);card?.scrollIntoView({block:'nearest',behavior:'smooth'});card?.focus({preventScroll:true})};
    pin.addEventListener('click',choose);pin.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}});$('pins').append(pin);
  }
}
function validCoordinates(b){return typeof b.latitude==='number'&&typeof b.longitude==='number'&&b.latitude>=-90&&b.latitude<=90&&b.longitude>=-180&&b.longitude<=180}
function renderResults() {
  const list=$('result-list');list.replaceChildren();
  $('results-title').textContent=selected?'شعب استان '+selected:'مقصدتان را انتخاب کنید';
  const matchingBranches=branches.filter(b=>(!selected||b.province===selected)&&(!query||normalize([b.name,b.city,b.province,b.address].join(' ')).includes(query)));
  if(matchingBranches.length){
    $('status').textContent=fa(matchingBranches.length)+' شعبه';
    for(const b of matchingBranches)list.append(branchCard(b));
    return;
  }
  if(!selected){
    const provinces=features.map(provinceName).filter(name=>!query||normalize(name).includes(query)).sort((a,b)=>a.localeCompare(b,'fa'));
    $('status').textContent=provinces.length ? fa(provinces.length)+' استان · برای ادامه انتخاب کنید' : 'نتیجه‌ای پیدا نشد';
    for(const name of provinces){const button=node('button',{class:'province-option',type:'button'},name);button.append(node('span',{'aria-hidden':'true'},'←'));button.addEventListener('click',()=>{query='';$('search').value='';$('clear-search').hidden=true;setProvince(name)});list.append(button)}
    if(provinces.length)return;
  }else $('status').textContent=query?'نتیجه جست‌وجو در '+selected:'اطلاعات شعب';
  const empty=node('div',{class:'empty'});empty.append(node('div',{class:'empty-icon','aria-hidden':'true'},'⌖'));
  const hasProvinceData=branches.some(b=>b.province===selected);
  const title=dataFailed?'اطلاعات شعب دریافت نشد':query?'نتیجه‌ای پیدا نشد':hasProvinceData?'شعبه‌ای با این مشخصات پیدا نشد':'اطلاعات شعب این استان در حال تکمیل است';
  const message=dataFailed?'اتصال خود را بررسی و دوباره تلاش کنید.':query?'نام دیگری جست‌وجو کنید یا استان را تغییر دهید.':'پس از تأیید اطلاعات، آدرس و شماره تماس شعب در این بخش قرار می‌گیرد.';
  empty.append(node('h3',{},title),node('p',{},message));
  if(dataFailed){const retry=node('button',{class:'retry',type:'button'},'تلاش دوباره');retry.addEventListener('click',()=>location.reload());empty.append(retry)}list.append(empty);
}
function branchCard(b){
  const card=node('article',{class:'branch-card'+(activeBranch===b.id?' active':''),id:'branch-'+b.id,tabindex:'0'});
  card.append(node('span',{class:'branch-city'},b.city||b.province),node('h3',{},b.name));
  card.append(node('p',{},b.address||'آدرس در حال تکمیل است'));
  if(b.hours)card.append(node('p',{},'ساعت کاری: '+b.hours));
  const phone=String(b.phone||'').replace(/[^+\d]/g,'');
  if(phone)card.append(node('p',{dir:'ltr'},b.phone));
  const actions=node('div',{class:'branch-actions'});
  if(phone&&/^\+?\d{7,15}$/.test(phone))actions.append(node('a',{href:'tel:'+phone,'aria-label':'تماس با '+b.name},'تماس با شعبه'));
  if(validCoordinates(b))actions.append(node('a',{href:'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(b.latitude+','+b.longitude),target:'_blank',rel:'noopener noreferrer',class:'primary'},'مسیریابی ↗'));
  card.append(actions);
  card.addEventListener('click',e=>{if(e.target.closest('a'))return;activeBranch=b.id;drawMap();document.querySelectorAll('.branch-card').forEach(c=>c.classList.toggle('active',c.id==='branch-'+b.id))});
  card.addEventListener('keydown',e=>{if(e.target===card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();card.click()}});
  return card;
}
function readHash(){let name='';try{if(location.hash.startsWith('#province='))name=decodeURIComponent(location.hash.slice(10))}catch{}setProvince(name,false)}
async function init(){
  try{
    const response=await fetch('assets/provinces.json');if(!response.ok)throw Error('Map request failed');const data=await response.json();features=data.features;
    if(!Array.isArray(features)||features.length!==31)throw Error('Invalid province map');fullBounds=bounds(features);
    try{const response=await fetch('branches.json');if(!response.ok)throw Error('Branches request failed');const data=await response.json();if(!Array.isArray(data.branches))throw Error('Invalid branch data');branches=data.branches.filter(b=>b&&typeof b.id==='string'&&typeof b.name==='string'&&features.some(f=>provinceName(f)===b.province))}catch{dataFailed=true}
    features.map(provinceName).sort((a,b)=>a.localeCompare(b,'fa')).forEach(name=>$('province-select').append(node('option',{value:name},name)));
    $('map-loading').hidden=true;readHash();
    if(branches.length&&!dataFailed){document.querySelector('.data-note').hidden=true;document.querySelector('.footer small').textContent='اکس‌پوینت · شعب و اطلاعات تماس'}
    if(dataFailed)document.querySelector('.data-note p').textContent='دریافت اطلاعات شعب با مشکل روبه‌رو شد. لطفاً دوباره تلاش کنید.';
  }catch{
    $('map-loading').textContent='نقشه دریافت نشد. لطفاً دوباره تلاش کنید.';
    const retry=node('button',{type:'button',class:'retry'},'تلاش دوباره');retry.addEventListener('click',()=>location.reload());$('map-loading').append(retry);$('status').textContent='خطا در دریافت نقشه';
  }
}
$('home').addEventListener('click',()=>setProvince(''));$('reset').addEventListener('click',()=>setProvince(''));
$('province-select').addEventListener('change',e=>{query='';$('search').value='';$('clear-search').hidden=true;setProvince(e.target.value)});
$('search').addEventListener('input',e=>{query=normalize(e.target.value);$('clear-search').hidden=!e.target.value;renderResults()});
$('clear-search').addEventListener('click',()=>{query='';$('search').value='';$('clear-search').hidden=true;renderResults();$('search').focus()});
window.addEventListener('popstate',readHash);window.addEventListener('hashchange',readHash);init();
