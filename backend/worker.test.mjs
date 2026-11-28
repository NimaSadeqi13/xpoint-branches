import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const initial=JSON.parse(fs.readFileSync(new URL('../branches.json',import.meta.url),'utf8'));
const provinces=JSON.parse(fs.readFileSync(new URL('../assets/provinces.json',import.meta.url),'utf8'));
let source=fs.readFileSync(new URL('worker.mjs',import.meta.url),'utf8');
source=source.replace("'./admin-data.js'",JSON.stringify(new URL('../admin-data.js',import.meta.url).href)).replace("import provinces from './provinces.json';",'const provinces='+JSON.stringify(provinces)+';').replace("import initialData from './initial-data.json';",'const initialData='+JSON.stringify(initial)+';');
const {default:worker,passwordHash}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync(new URL('schema.sql',import.meta.url),'utf8'));
const db={prepare(query){let args=[];const statement=sql.prepare(query);return {bind(...values){args=values;return this;},async first(){return statement.get(...args)||null;},async run(){const result=statement.run(...args);return {meta:{changes:Number(result.changes)}};}};},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const env={AUTH_DB:db,ADMIN_USERNAME:'admin',ADMIN_PASSWORD_SALT:'test-salt',ADMIN_PASSWORD_HASH:await passwordHash('test-password','test-salt')};
async function request(path,{body,token,origin='https://xpointshops.github.io',ip='192.0.2.1'}={}){const headers={Origin:origin,'CF-Connecting-IP':ip};if(body!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization='Bearer '+token;const response=await worker.fetch(new Request('https://admin.example'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}),env);return {status:response.status,data:await response.json()};}
test('server authenticates, validates, publishes atomically, and revokes sessions',async()=>{
 assert.equal((await request('/api/data')).status,401);
 assert.equal((await request('/api/login',{body:{username:'admin',password:'wrong'}})).status,401);
 assert.equal((await request('/api/login',{origin:'https://another.example',body:{username:'admin',password:'test-password'}})).status,403);
 const login=await request('/api/login',{body:{username:'admin',password:'test-password'}});assert.equal(login.status,200);const token=login.data.token;assert.match(token,/^[a-f0-9]{64}$/);
 const stored=sql.prepare('SELECT id FROM sessions').get();assert.notEqual(stored.id,token);
 let current=(await request('/api/data',{token})).data;assert.equal(current.data.branches.length,95);
 assert.equal((await request('/api/publish',{token,body:{sha:'wrong',data:current.data}})).status,409);
 const draft=structuredClone(current.data),b={...draft.branches.find(b=>b.id==='branch-003'),id:'branch-096',name:'آزمون شعبه جدید'};delete b.photo;draft.branches.push(b);
 let saved=await request('/api/publish',{token,body:{sha:current.sha,operations:[{type:'upsert',branch:b}]}});assert.equal(saved.status,200);assert.equal(saved.data.data.branches.length,96);assert.equal((await request('/api/branches')).data.branches.length,96);
 assert.equal((await request('/api/publish',{token,body:{sha:current.sha,data:current.data}})).status,409);
 current=saved.data;const invalid=structuredClone(current.data);invalid.branches.at(-1).latitude=0;assert.equal((await request('/api/publish',{token,body:{sha:current.sha,data:invalid}})).status,400);
 saved=await request('/api/publish',{token,body:{sha:current.sha,operations:[{type:'delete',id:'branch-096'}]}});assert.equal(saved.status,200);assert.deepEqual(saved.data.data.branches,initial.branches);assert.equal(saved.data.data.nextBranchNumber,97);
 assert.equal((await request('/api/logout',{token,body:{}})).status,200);assert.equal((await request('/api/data',{token})).status,401);
});
test('expired sessions and excessive login attempts are rejected',async()=>{
 const login=await request('/api/login',{body:{username:'admin',password:'test-password'},ip:'192.0.2.2'});assert.equal(login.status,200);sql.exec('UPDATE sessions SET expires_at=0');assert.equal((await request('/api/data',{token:login.data.token})).status,401);
 for(let i=0;i<8;i++)assert.equal((await request('/api/login',{body:{username:'admin',password:'wrong'},ip:'192.0.2.3'})).status,401);
 assert.equal((await request('/api/login',{body:{username:'admin',password:'test-password'},ip:'192.0.2.3'})).status,429);
});
