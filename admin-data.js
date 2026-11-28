export const categories={xpoint:'ایکس‌پوینت',maadiran:'مادیران',kanon:'کانون',xvision:'ایکس‌ویژن‌شاپ'};
export const normalize=value=>String(value??'').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200e\u200f]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
export function digits(value){return String(value??'').replace(/[۰-۹٠-٩]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.includes(c)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(c):'٠١٢٣٤٥٦٧٨٩'.indexOf(c));}
export function parsePin(value){
 const s=digits(value).trim();
 const pairs=[...s.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)];
 if(pairs.length)return pairs.at(-1).slice(1).map(Number);
 const route=s.match(/https:\/\/neshan\.org\/maps\/routing\/car\/destination\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
 if(route)return route.slice(1).map(Number);
 if(/^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(s))return s.split(',').map(Number);
 return null;
}
export function parsePhones(value){
 return digits(value).split(/[،,;؛\n/]+/).map(p=>p.replace(/[^\d+]/g,'')).filter(Boolean).map(p=>p.startsWith('+98')?'0'+p.slice(3):p.startsWith('0098')?'0'+p.slice(4):p);
}
function inRing([x,y],ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;}return inside;}
export function inProvince(lat,lon,feature){const polygons=feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[feature.geometry.coordinates];return polygons.some(rings=>inRing([lon,lat],rings[0])&&!rings.slice(1).some(r=>inRing([lon,lat],r)));}
export function makeBranch(values,previous,features){
 const name=String(values.name||'').trim(),city=String(values.city||'').trim(),address=String(values.address||'').trim();
 if(!name||!city||!address)throw Error('نام شعبه، شهر و آدرس را کامل کنید.');
 if(!Object.hasOwn(categories,values.category))throw Error('نوع فروشگاه را انتخاب کنید.');
 const feature=features.find(f=>f.properties['name:fa']===values.province);if(!feature)throw Error('استان را انتخاب کنید.');
 const latText=digits(values.latitude).trim(),lonText=digits(values.longitude).trim();
 if(!latText||!lonText)throw Error('پین دقیق شعبه یا هر دو مختصات را وارد کنید.');
 const latitude=Number(latText),longitude=Number(lonText);
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<24||latitude>40||longitude<44||longitude>64)throw Error('مختصات خارج از محدوده ایران است.');
 if(!inProvince(latitude,longitude,feature))throw Error('پین داخل استان انتخاب‌شده نیست؛ استان و مختصات را بررسی کنید.');
 const unchangedPhone=previous&&digits(values.phone).trim()===digits(previous.phone).trim()&&Array.isArray(previous.phones);
 const phones=unchangedPhone?[...previous.phones]:parsePhones(values.phone);if(!phones.length||phones.some(p=>!/^0\d{10}$/.test(p)))throw Error('شماره تماس را با کد شهر و صفر ابتدایی وارد کنید؛ هر شماره باید ۱۱ رقم باشد.');
 const result={...previous,name,category:values.category,status:String(values.status||'فعال'),province:values.province,city,address,phone:digits(values.phone).trim(),phones:[...new Set(phones)],hours:String(values.hours||'').trim(),latitude,longitude};
 if(!previous||previous.latitude!==latitude||previous.longitude!==longitude){result.locationMethod='user_provided_map_pin';delete result.locationCode;}
 result.neshanUrl=`https://neshan.org/maps/routing/car/destination/${latitude},${longitude}`;
 return result;
}
export function changesFrom(base,draft){
 const old=new Map(base.branches.map(b=>[b.id,b])),current=new Map(draft.branches.map(b=>[b.id,b]));const changes=[];
 for(const b of draft.branches){if(!old.has(b.id))changes.push({type:'اضافه',name:b.name});else if(JSON.stringify(b)!==JSON.stringify(old.get(b.id)))changes.push({type:'ویرایش',name:b.name});}
 for(const b of base.branches)if(!current.has(b.id))changes.push({type:'حذف',name:b.name});
 return changes;
}
