import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {PGlite}=process.env.PGLITE_TEST_MODULE?require(process.env.PGLITE_TEST_MODULE):await import('@electric-sql/pglite');
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const db=new PGlite();
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
await db.exec(read('schema-before.sql'));
await db.exec(read('../migrations/202610170001_event_owner_isolation.sql'));
await db.exec(`INSERT INTO auth.users VALUES('${a}'),('${b}'); INSERT INTO clubs(id,name) VALUES('${a}','Test');
 INSERT INTO shooting_events(id,club_id,name,event_date) VALUES('${a}','${a}','Legacy','2026-10-17');
 INSERT INTO shooters(id,first_name,last_name) VALUES('${a}','Legacy','Test');`);
const template=read('../audit/assign-existing-data-to-account.sql');
const apply=id=>template.replace(/DECLARE account_id uuid := .*?; -- TARGET_ACCOUNT_ID/,`DECLARE account_id uuid := ${id ? `'${id}'` : 'NULL'}::uuid; -- TARGET_ACCOUNT_ID`);
let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;};
async function rejects(sql,code) {
 let error;try{await db.exec(sql);}catch(e){error=e;await db.exec('ROLLBACK');}
 check(error?.code===code,'expected safe rejection');
 const result=await db.query('SELECT owner_id FROM shooting_events');
 check(result.rows[0].owner_id===null,'no partial event assignment');
}
await rejects(apply(null),'P0001');
await rejects(apply('10000000-0000-4000-8000-000000000099'),'23503');
await db.exec(`UPDATE shooters SET owner_id='${b}'`);
await rejects(apply(a),'P0001');
await db.exec('UPDATE shooters SET owner_id=NULL');
await db.exec(apply(a));
await db.exec(apply(a)); // repeat is harmless
for(const table of ['shooting_events','shooters']) {
 const r=await db.query(`SELECT owner_id FROM ${table}`);
 check(r.rows.length===1&&r.rows[0].owner_id===a,'all existing rows assigned, none deleted');
}
await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${a}',false);`);
check((await db.query("UPDATE shooters SET first_name='Editable' RETURNING id")).rows.length===1,'owner can edit assigned historical shooter');
await db.exec(`SELECT set_config('request.jwt.claim.sub','${b}',false);`);
for(const table of ['shooting_events','shooters'])check((await db.query(`SELECT * FROM ${table}`)).rows.length===0,'other user cannot see assigned data');
await db.close();
console.log(`PASS: ${checks} account-assignment assertions. No production connection.`);
