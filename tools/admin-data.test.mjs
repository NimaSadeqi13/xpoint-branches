import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parsePin,parsePhones,makeBranch,changesFrom} from '../admin-data.js';
const data=JSON.parse(fs.readFileSync(new URL('../branches.json',import.meta.url),'utf8'));
const features=JSON.parse(fs.readFileSync(new URL('../assets/provinces.json',import.meta.url),'utf8')).features;
test('use explicit pin coordinates and reject viewport centers',()=>{
 assert.equal(parsePin('https://www.google.com/maps/@35.6,51.4,17z'),null);
 assert.deepEqual(parsePin('https://www.google.com/maps/data=!3d35.603271!4d51.429071'),[35.603271,51.429071]);
 assert.deepEqual(parsePin('https://neshan.org/maps/routing/car/destination/35.6,51.4'),[35.6,51.4]);
 assert.deepEqual(parsePin('۳۵.۶,۵۱.۴'),[35.6,51.4]);
});
test('normalize Iranian contact numbers',()=>{
 assert.deepEqual(parsePhones('۰۲۱-۴۱۷۰۳۰۰۰،+989123456789'),['02141703000','09123456789']);
});
test('editing any existing branch preserves its ID, photo and coordinate provenance',()=>{
 for(const branch of data.branches){const result=makeBranch({...branch,latitude:String(branch.latitude),longitude:String(branch.longitude)},branch,features);assert.equal(result.id,branch.id);assert.deepEqual(result.photo,branch.photo);assert.deepEqual(result.phones,branch.phones);assert.equal(result.locationMethod,branch.locationMethod);assert.equal(result.locationCode,branch.locationCode);}
});
test('reject missing coordinates, invalid phone and incorrect province',()=>{
 const branch=data.branches.find(b=>b.id==='branch-003');
 assert.throws(()=>makeBranch({...branch,latitude:''},branch,features),/مختصات/);
 assert.throws(()=>makeBranch({...branch,phone:'123'},branch,features),/شماره/);
 assert.throws(()=>makeBranch({...branch,province:'گیلان'},branch,features),/داخل استان/);
});
test('retain the coordinate method only when pin coordinates have not changed',()=>{
 const branch=data.branches.find(b=>b.locationCode);
 const result=makeBranch({...branch,latitude:branch.latitude+0.00001,longitude:branch.longitude+0.00001},branch,features);
 assert.equal(result.locationMethod,'user_provided_map_pin');assert.equal(result.locationCode,undefined);
});
test('change list distinguishes additions, edits and deletions',()=>{
 const original={branches:[{id:'branch-001',name:'A'},{id:'branch-002',name:'B'}]};
 const draft={branches:[{id:'branch-001',name:'A2'},{id:'branch-003',name:'C'}]};
 assert.deepEqual(changesFrom(original,draft),[{type:'ویرایش',name:'A2'},{type:'اضافه',name:'C'},{type:'حذف',name:'B'}]);
 assert.deepEqual(changesFrom(original,structuredClone(original)),[]);
});
