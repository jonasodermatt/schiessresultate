import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = process.env.PGLITE_TEST_MODULE
  ? require(process.env.PGLITE_TEST_MODULE) : await import('@electric-sql/pglite');
const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const db = new PGlite();
let checks = 0, serial = 1;
const uuid = () => `10000000-0000-4000-8000-${String(serial++).padStart(12, '0')}`;
const A = uuid(), B = uuid();
const quote = v => v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v instanceof Date ? v.toISOString() : v).replaceAll("'", "''")}'`;
const ident = v => '"' + v.replaceAll('"', '""') + '"';
const query = async sql => (await db.query(sql)).rows;
const count = async sql => Number((await query(sql))[0].n);
const ok = (condition, message) => { assert.ok(condition, message); checks++; };
const login = async user => { await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub',${quote(user ?? '')},false);`); };
const admin = async () => db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false);");
const insert = async (table, values) => {
  values = { id: uuid(), ...values };
  await db.exec(`INSERT INTO public.${ident(table)} (${Object.keys(values).map(ident)}) VALUES (${Object.values(values).map(quote)});`);
  return values.id;
};
async function denied(sql, label, codes = ['42501','23503','23514','P0001']) {
  let error;
  await db.exec('SAVEPOINT rejected_operation');
  try { await db.exec(sql); } catch(e) { error=e; }
  await db.exec('ROLLBACK TO SAVEPOINT rejected_operation; RELEASE SAVEPOINT rejected_operation');
  ok(error && codes.includes(error.code), `${label}: expected rejection, got ${error?.code ?? 'success'} (${error?.message ?? ''})`);
}
async function transaction(fn) { await db.exec('BEGIN'); try { await fn(); } finally { await db.exec('ROLLBACK'); } }

await db.exec(read('schema-before.sql'));
await db.exec(`INSERT INTO auth.users VALUES (${quote(A)}),(${quote(B)});`);
const club = await insert('clubs',{name:'Test club'});
const weapon = await insert('competition_weapons',{name:'Test weapon'});
const program = await insert('shooting_programs',{name:'Test program',code:'TEST',scoring_type:'A10',single_shots:10,ranking_type:'total'});

async function tree(label) {
  const t={};
  const add = async (table,values) => t[table] = await insert(table,values);
  const shooter = await add('shooters',{first_name:label,last_name:'Test'});
  const event = await add('shooting_events',{name:label,club_id:club,event_date:'2026-10-17'});
  const category=await add('shooting_event_categories',{shooting_event_id:event,code:'E',name:'Test',min_age:0});
  const registration=await add('shooting_event_registrations',{shooting_event_id:event,shooter_id:shooter,category_id:category,weapon_id:weapon});
  const stitch=await add('shooting_event_stitches',{shooting_event_id:event,code:'KUNST',name:'Test',scoring_type:'A10',ranking_mode:'total',program_id:program,max_passes:50,shots_per_pass:15});
  const block=await add('shooting_event_stitch_blocks',{event_stitch_id:stitch,block_number:1,block_type:'series',shot_count:15});
  const registrationStitch=await add('shooting_event_registration_stitches',{registration_id:registration,event_stitch_id:stitch,status:'completed'});
  const pass=await add('shooting_event_stitch_passes',{registration_stitch_id:registrationStitch,pass_number:1,status:'completed'});
  const shot=await add('shooting_event_stitch_shots',{pass_id:pass,block_id:block,shot_number:1,score:10});
  for(let s=2;s<=5;s++) await insert('shooting_event_stitch_shots',{pass_id:pass,block_id:block,shot_number:s,score:10});
  const group=await add('shooting_event_groups',{shooting_event_id:event,name:'Test group'});
  await add('shooting_event_group_members',{group_id:group,registration_id:registration});
  const combination=await add('shooting_event_combinations',{shooting_event_id:event,name:'Test combination',tie_break_stitch_id:stitch});
  await add('shooting_event_combination_stitches',{combination_id:combination,event_stitch_id:stitch});
  await add('shooting_event_payouts',{shooting_event_id:event,event_stitch_id:stitch,combination_id:combination,rank_from:1,rank_to:1,amount_chf:10});
  const rule=await add('shooting_event_stitch_instant_payout_rules',{event_stitch_id:stitch,score:10,first_amount_chf:10,repeat_amount_chf:5});
  await add('shooting_event_stitch_instant_payouts',{event_stitch_id:stitch,registration_id:registration,pass_id:pass,shot_id:shot,rule_id:rule,score:10,occurrence:1,amount_chf:10});
  await add('shooting_event_stitch_payout_settlements',{event_stitch_id:stitch,registration_id:registration,rank:1,total_payout_chf:10});
  await db.exec(`UPDATE shooting_events SET group_ranking_stitch_id=${quote(stitch)} WHERE id=${quote(event)};`);
  // Each ranking view gets a positive control, not merely an empty-result test.
  for(const [code,shots] of [['JM',10],['MILITAER',4],['SEKTION',8],['GLUECK',2],['NACHDOPPEL',5],['RUETLI',15]]) {
    const s=await insert('shooting_event_stitches',{shooting_event_id:event,code,name:code,scoring_type:'A10',ranking_mode:'total',program_id:program,max_passes:50,shots_per_pass:15});
    const rs=await insert('shooting_event_registration_stitches',{registration_id:registration,event_stitch_id:s,status:'completed'});
    const p=await insert('shooting_event_stitch_passes',{registration_stitch_id:rs,pass_number:1,status:'completed'});
    for(let n=1;n<=shots;n++) await insert('shooting_event_stitch_shots',{pass_id:p,shot_number:n,score:10});
  }
  return t;
}

const legacy=await tree('Legacy without owner');
const tables=Object.keys(legacy);
const before=Object.fromEntries(await Promise.all(tables.map(async t=>[t,await count(`SELECT count(*) n FROM ${t}`)])));
// Schema drift must abort atomically before applying owner changes.
await db.exec('CREATE TABLE public.shooting_event_unreviewed(id uuid)');
let driftError;
try { await db.exec(read('../migrations/202610170001_event_owner_isolation.sql')); } catch(e) { driftError=e; await db.exec('ROLLBACK'); }
ok(driftError?.message.includes('inventory changed'),'unreviewed event table fails migration');
ok(await count("SELECT count(*) n FROM information_schema.columns WHERE table_name='shooting_events' AND column_name='owner_id'")===0,'failed migration has no partial owner column');
await db.exec('DROP TABLE public.shooting_event_unreviewed');
// Existing cross-event links must abort, not be silently reassigned or removed.
const badEvent=await insert('shooting_events',{name:'Conflicting reference',club_id:club,event_date:'2026-10-17'});
const badGroup=await insert('shooting_event_groups',{shooting_event_id:badEvent,name:'Bad group'});
await db.exec(`UPDATE shooting_event_group_members SET group_id=${quote(badGroup)} WHERE id=${quote(legacy.shooting_event_group_members)}`);
ok((await query(read('../audit/event-integrity-preflight.sql'))).some(r=>r.row_id===legacy.shooting_event_group_members),'preflight identifies existing conflicting reference');
let integrityError;
try { await db.exec(read('../migrations/202610170001_event_owner_isolation.sql')); } catch(e) { integrityError=e; await db.exec('ROLLBACK'); }
ok(integrityError?.code==='23503','inconsistent legacy reference aborts migration');
ok(await count("SELECT count(*) n FROM information_schema.columns WHERE table_name='shooting_events' AND column_name='owner_id'")===0,'integrity failure rolls back owner column');
await db.exec(`UPDATE shooting_event_group_members SET group_id=${quote(legacy.shooting_event_groups)} WHERE id=${quote(legacy.shooting_event_group_members)}; DELETE FROM shooting_events WHERE id=${quote(badEvent)}`);
ok((await query(read('../audit/event-integrity-preflight.sql'))).length===0,'clean inventory passes integrity preflight');
await db.exec(read('../migrations/202610170001_event_owner_isolation.sql'));
for(const t of tables) ok(await count(`SELECT count(*) n FROM ${t}`)===before[t],`${t}: migration preserves rows`);
ok((await query(`SELECT owner_id FROM shooting_events WHERE id=${quote(legacy.shooting_events)}`))[0].owner_id===null,'legacy owner is not inferred');
const views=(await query("SELECT viewname FROM pg_views WHERE schemaname='public' AND viewname LIKE 'shooting_event%'")).map(r=>r.viewname);

await login(A); const a=await tree('A'); const a2=await tree('A second event');
await login(B); const b=await tree('B');

// Exercise both directions with real PostgreSQL RLS roles and JWT subject settings.
for(const [user,own,other] of [[A,a,b],[B,b,a]]) {
  await login(user);
  await transaction(async()=>{
    for(const t of tables) {
      ok(await count(`SELECT count(*) n FROM ${t} WHERE id=${quote(own[t])}`)===1,`${t}: own SELECT`);
      ok(await count(`SELECT count(*) n FROM ${t} WHERE id IN (${quote(other[t])},${quote(legacy[t])})`)===0,`${t}: foreign/legacy SELECT hidden`);
      ok((await query(`UPDATE ${t} SET id=id WHERE id=${quote(own[t])} RETURNING id`)).length===1,`${t}: own UPDATE`);
      ok((await query(`UPDATE ${t} SET id=id WHERE id=${quote(other[t])} RETURNING id`)).length===0,`${t}: foreign UPDATE hidden`);
      ok((await query(`DELETE FROM ${t} WHERE id=${quote(other[t])} RETURNING id`)).length===0,`${t}: foreign DELETE hidden`);
      ok((await query(`UPDATE ${t} SET id=id WHERE id=${quote(legacy[t])} RETURNING id`)).length===0,`${t}: legacy UPDATE hidden`);
      ok((await query(`DELETE FROM ${t} WHERE id=${quote(legacy[t])} RETURNING id`)).length===0,`${t}: legacy DELETE hidden`);
    }
    for(const v of views) {
      ok(await count(`SELECT count(*) n FROM ${v} WHERE shooting_event_id=${quote(own.shooting_events)}`)>0,`${v}: own positive result`);
      ok(await count(`SELECT count(*) n FROM ${v} WHERE shooting_event_id IN (${quote(other.shooting_events)},${quote(legacy.shooting_events)})`)===0,`${v}: foreign and legacy hidden`);
    }
    await denied(`UPDATE shooting_events SET owner_id=${quote(user===A?B:A)} WHERE id=${quote(own.shooting_events)}`,'owner transfer');
    await denied(`UPDATE shooting_events SET owner_id=NULL WHERE id=${quote(own.shooting_events)}`,'owner removal');
    ok((await query(`UPDATE shooting_events SET owner_id=${quote(user)} WHERE id=${quote(legacy.shooting_events)} RETURNING id`)).length===0,'cannot claim legacy event');
    await denied(`INSERT INTO shooting_events (club_id,name,event_date,owner_id) VALUES (${quote(club)},'spoof','2026-10-17',${quote(user===A?B:A)})`,'foreign owner insert');
    await denied(`INSERT INTO shooting_events (club_id,name,event_date,owner_id) VALUES (${quote(club)},'null','2026-10-17',NULL)`,'null owner insert');
    await denied(`SELECT delete_shooting_event(${quote(other.shooting_events)})`,'foreign RPC');
    await denied(`SELECT delete_shooting_event(${quote(legacy.shooting_events)})`,'legacy RPC');
    await denied(`INSERT INTO shooting_event_registrations(shooting_event_id,shooter_id) VALUES (${quote(own.shooting_events)},${quote(other.shooters)})`,'guessed shooter cannot grant read access');
    ok(await count(`SELECT count(*) n FROM shooters WHERE id=${quote(other.shooters)}`)===0,'shooter remains hidden after attack');
  });
}

await admin();
const foreignRows={};
for(const t of tables) foreignRows[t]=(await query(`SELECT * FROM ${t} WHERE id=${quote(b[t])}`))[0];
const links=await query(`SELECT c.conrelid::regclass::text AS child,a.attname AS column,c.confrelid::regclass::text AS parent
 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
 WHERE c.contype='f' AND cardinality(c.conkey)=1 AND c.conrelid IN (${tables.map(t=>`${quote(t)}::regclass`)})
 AND c.confrelid IN (${tables.map(t=>`${quote(t)}::regclass`)})`);
await login(A);
await transaction(async()=>{
  for(const t of tables) {
    const row={...foreignRows[t],id:uuid()};
    // Remove irrelevant uniqueness collisions to ensure an actual access rejection.
    if(t==='shooters') row.master_number=900000+serial;
    const columns=Object.keys(row).filter(k=>k!=='created_at'&&k!=='finalized_at'&&k!=='updated_at'&&k!=='completed_at');
    await denied(`INSERT INTO ${t} (${columns.map(ident)}) VALUES (${columns.map(c=>quote(row[c]))})`,`${t}: foreign INSERT`);
    row.id=b[t];
    await denied(`INSERT INTO ${t} (${columns.map(ident)}) VALUES (${columns.map(c=>quote(row[c]))}) ON CONFLICT(id) DO UPDATE SET id=EXCLUDED.id`,`${t}: foreign UPSERT`);
  }
  for(const link of links) {
    if(link.parent==='shooters') continue; // tested separately with shooter access trigger
    for(const target of [a2,b]) {
      await denied(`UPDATE ${link.child} SET ${ident(link.column)}=${quote(target[link.parent])} WHERE id=${quote(a[link.child])}`,
        `${link.child}.${link.column}: cross-event reference (${target===a2?'same owner':'foreign owner'})`);
    }
  }
});

// Every table supports legitimate DELETE, tested individually with rollback.
for(const t of tables) {
  await login(A);
  await transaction(async()=>{
    // Existing schema deliberately restricts deletion of blocks referenced by shots.
    // Clear those optional references when testing raw parent DELETE (UI uses the RPC).
    await db.exec(`UPDATE shooting_event_stitch_shots SET block_id=NULL WHERE shooting_event_id=${quote(a.shooting_events)}`);
    if(t==='shooting_event_stitch_blocks') await db.exec(`UPDATE shooting_event_stitch_shots SET block_id=NULL WHERE block_id=${quote(a[t])}`);
    if(t==='shooting_event_categories') await db.exec(`UPDATE shooting_event_registrations SET category_id=NULL WHERE category_id=${quote(a[t])}`);
    if(t==='shooters') await db.exec(`SELECT delete_shooting_event(${quote(a.shooting_events)})`);
    ok((await query(`DELETE FROM ${t} WHERE id=${quote(a[t])} RETURNING id`)).length===1,`${t}: own DELETE`);
  });
}
await login(A);
await transaction(async()=>{
  await db.exec(`SELECT delete_shooting_event(${quote(a.shooting_events)})`);
  for(const t of tables.filter(t=>t!=='shooters')) ok(await count(`SELECT count(*) n FROM ${t} WHERE id=${quote(a[t])}`)===0,`${t}: own RPC removed event data`);
  await admin();
  for(const t of tables) ok(await count(`SELECT count(*) n FROM ${t} WHERE id=${quote(b[t])}`)===1,`${t}: RPC preserved other user`);
});

await admin(); await db.exec('SET ROLE anon');
await transaction(async()=>{
  for(const t of [...tables,...views]) await denied(`SELECT * FROM ${t}`,`${t}: anon denied`,['42501']);
  await denied(`SELECT delete_shooting_event(${quote(a.shooting_events)})`,'anon RPC denied',['42501']);
});
await login(null);
for(const t of tables) ok(await count(`SELECT count(*) n FROM ${t}`)===0,`${t}: authenticated without identity sees nothing`);

// Test the actual backfill artifact, including empty/missing/duplicate/conflicting mappings.
await admin();
const backfill = read('../audit/backfill-event-owners.sql');
const mapping = (event,user) => `INSERT INTO event_owner_map VALUES (${quote(event)},${quote(user)},'Test confirmation');`;
for(const [label,mappings,code] of [
  ['empty','', 'P0001'],
  ['missing event',mapping(uuid(),A),'23503'],
  ['missing user',mapping(legacy.shooting_events,uuid()),'23503'],
  ['duplicate',mapping(legacy.shooting_events,A)+mapping(legacy.shooting_events,B),'23505'],
  ['assigned event',mapping(a.shooting_events,B),'P0001'],
]) {
  let error;
  try { await db.exec(backfill.replace('-- INSERT CONFIRMED MAPPINGS HERE',mappings)); } catch(e) { error=e; await db.exec('ROLLBACK'); }
  ok(error?.code===code,`backfill rejects ${label}: ${error?.code} ${error?.message}`);
  ok((await query(`SELECT owner_id FROM shooting_events WHERE id=${quote(legacy.shooting_events)}`))[0].owner_id===null,`${label} backfill preserves unassigned legacy event`);
}
await db.exec(backfill.replace('-- INSERT CONFIRMED MAPPINGS HERE',mapping(legacy.shooting_events,A)));
ok((await query(`SELECT owner_id FROM shooting_events WHERE id=${quote(legacy.shooting_events)}`))[0].owner_id===null,'backfill dry run rolls back');
await db.exec(backfill.replace('-- INSERT CONFIRMED MAPPINGS HERE',mapping(legacy.shooting_events,A)).replace(/ROLLBACK;\s*$/, 'COMMIT;'));
await login(A);
for(const t of tables) ok(await count(`SELECT count(*) n FROM ${t} WHERE id=${quote(legacy[t])}`)===1,`${t}: owner can read backfilled legacy data`);
await transaction(async()=>{
  ok((await query(`UPDATE shooters SET last_name=last_name WHERE id=${quote(legacy.shooters)} RETURNING id`)).length===0,'ownerless historical shooter is readable but not editable');
});
await login(B);
for(const t of tables) ok(await count(`SELECT count(*) n FROM ${t} WHERE id=${quote(legacy[t])}`)===0,`${t}: other user cannot read backfilled data`);

await admin();
ok(await count("SELECT count(*) n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname LIKE 'shooting_event%' AND c.relkind='v' AND NOT coalesce(c.reloptions @> ARRAY['security_invoker=true'],false)")===0,'all views security_invoker');
for(const t of tables) ok(!(await query(`SELECT has_table_privilege('authenticated',${quote(t)},'TRUNCATE') allowed`))[0].allowed,`${t}: no TRUNCATE bypass`);
await db.close();
console.log(`PASS: ${checks} PostgreSQL security assertions; two authenticated identities, anonymous access, all event tables and ${views.length} views. No production connection.`);
