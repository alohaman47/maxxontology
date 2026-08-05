/* ============================================================
   UI — สี่หน้า หนึ่งแผ่นรายละเอียด
   ทุกหน้าอ่านจาก ontology + compute เท่านั้น ไม่มีข้อมูลฝังอยู่ที่นี่
   ============================================================ */
import { DB, OBJECT_TYPES, neighbours, byId, AUDIT, log } from './ontology.js';
import { PORTFOLIO as PF } from './adapter.js';
import * as C from './compute.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const nf  = (n,d=2) => (!isFinite(n) ? '—' : Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}));
const sg  = (n,d=2) => (n>0?'+':'')+nf(n,d);
const cls = n => n>0?'up':n<0?'dn':'mute';

export const ROUTES = [
  ['board',   'ตลาด'],
  ['stocks',  'หุ้น'],
  ['signals', 'สัญญาณ'],
  ['risk',    'ความเสี่ยง']
];
let SYNTHETIC = true;
export const setSynthetic = v => SYNTHETIC = v;

/* ---------------- nav ---------------- */
export function renderNav(active){
  $('#nav').innerHTML = ROUTES.map(([k,l]) =>
    `<a href="#/${k}"${k===active?' aria-current="page"':''}>${l}</a>`).join('');
}

/* ---------------- router ---------------- */
export function renderRoute(route){
  const view = $('#view');
  const page = {board, stocks, signals, risk}[route] || board;
  view.innerHTML = page();
  window.scrollTo(0,0);
  wire();
}

/* ---------------- 1 · ตลาด ---------------- */
function board(){
  const rows = DB.Instrument.map(i=>{
    const rg = C.regimeOf(i);
    const live = DB.Signal.filter(s=>s.instrumentId===i.id && s.status==='CANDIDATE').length;
    return `<button class="row" data-open="Instrument|${i.id}">
      <span class="name">${i.id}</span>
      <span class="val ${cls(i.ret1d)}">${sg(i.ret1d)}%</span>
      <span class="sub">${C.REGIME_TH[rg]} · ${i.cluster}${live?` · ${live} สัญญาณ`:''}</span>
      <span class="val-sub">${nf(i.bid, i.digits)}</span>
    </button>`;
  }).join('');

  const h = C.heat();
  return `
  ${SYNTHETIC?syntheticNote():''}
  <div class="stats">
    <div class="stat"><div class="k">ความร้อนรวม</div><div class="v">${nf(h,1)}R</div>
      <div class="bar"><i class="${h/PF.maxHeatR>=0.9?'warn':''}" style="width:${Math.min(100,h/PF.maxHeatR*100)}%"></i></div></div>
    <div class="stat"><div class="k">เปิดเพิ่มได้</div><div class="v">${nf(PF.maxHeatR-h,1)}R</div></div>
    <div class="stat"><div class="k">ไม้ที่ถือ</div><div class="v">${DB.Position.filter(p=>p.open).length}</div></div>
    <div class="stat"><div class="k">เงินต่อ 1R</div><div class="v">${nf(PF.equity*PF.riskPerTradePct/100,0)}</div></div>
  </div>
  <div class="label"><span>สินค้า</span><span>${DB.Instrument.length}</span></div>
  <div class="rows">${rows}</div>
  <div class="foot">สภาพตลาดคำนวณสดจาก ADX + ATR percentile + ความชัน WMA</div>`;
}

/* ---------------- 2 · หุ้น ---------------- */
let stockSort = 'composite';
function stocks(){
  const cols = {
    composite: ['คะแนนรวม', c=>C.composite(c)],
    roic:      ['ROIC',     c=>C.FUND.roic(c)],
    fcfYield:  ['FCF yield',c=>C.FUND.fcfYield(c)],
    peTTM:     ['P/E',      c=>C.FUND.peTTM(c)],
    buzz:      ['กระแส',    c=>{const s=DB.Social.find(x=>x.companyId===c.id);return s?s.buzzZ:-9}]
  };
  const pills = Object.entries(cols).map(([k,[l]]) =>
    `<button class="pill" data-sort="${k}" aria-pressed="${stockSort===k}">${l}</button>`).join('');

  const rows = [...DB.Company].sort((a,b)=>cols[stockSort][1](b)-cols[stockSort][1](a)).map(c=>{
    const s = DB.Social.find(x=>x.companyId===c.id);
    const fl = C.redFlags(c);
    const div = C.divergence(c);
    return `<button class="row" data-open="Company|${c.id}">
      <span class="name">${c.id} <span class="mute" style="font-weight:400;font-size:13px">${esc(c.name)}</span></span>
      <span class="val ${cls(C.composite(c))}">${sg(C.composite(c))}</span>
      <span class="sub">ROIC ${nf(C.FUND.roic(c),0)}% · FCF y ${nf(C.FUND.fcfYield(c),1)}% · P/E ${nf(C.FUND.peTTM(c),1)}${
        fl.length?` · <span class="dn">${fl.length} ธงแดง</span>`:''}</span>
      <span class="val-sub">${s?`กระแส ${sg(s.buzzZ)}${div>1?' ⚠':''}`:''}</span>
    </button>`;
  }).join('');

  return `
  ${SYNTHETIC?syntheticNote():''}
  <p class="lede">ทุกอัตราส่วนคำนวณสดจากงบสี่ไตรมาส ไม่มีตัวเลขไหนถูกพิมพ์เก็บไว้ —
  คอลัมน์กระแสมี ⚠ เมื่อ<b>เรื่องเล่าวิ่งนำงบ</b> ซึ่งหักคะแนนสัญญาณ ไม่ใช่บวก</p>
  <div class="pills">${pills}</div>
  <div class="rows">${rows}</div>`;
}

/* ---------------- 3 · สัญญาณ ---------------- */
function signals(){
  const live = DB.Signal.filter(s=>s.status==='CANDIDATE');
  if(!live.length) return `<div class="empty">ไม่มีสัญญาณเข้าเงื่อนไขตอนนี้ — คำตอบที่ถูกต้องเหมือนกัน</div>`;
  const cards = live.slice(0,12).map(s=>{
    const i = byId('Instrument', s.instrumentId);
    const p = byId('Playbook',   s.playbookId);
    const g = C.gatesFor(s);
    const pass = g.every(x=>x.ok);
    const e = C.evidence(p);
    const t = C.ticketFor(s);
    const fails = g.filter(x=>!x.ok);
    return `<div style="padding:22px 0;border-bottom:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between;gap:14px;align-items:baseline">
        <div>
          <div style="font-size:17px;font-weight:600">${i.id}
            <span class="mute" style="font-weight:400">· ${esc(p.name)}</span>
            <span class="tag ${s.dir==='BUY'?'ok':'warn'}" style="margin-left:6px">${s.dir}</span></div>
          <div class="mute" style="font-size:12.5px;margin-top:3px">
            ${C.REGIME_TH[C.regimeOf(i)]} · หลักฐาน ${e.tier} (n=${e.n}) · ${esc(p.trigger)}</div>
        </div>
        <div class="num" style="font-size:24px">${s.score}</div>
      </div>
      <div class="gates">${g.map(x=>`<span class="gate ${x.ok?'pass':'fail'}">${x.k}</span>`).join('')}</div>
      ${fails.length ? `<div class="gate-why">${fails.map(x=>`<span>${x.k} — ${esc(x.why)}</span>`).join('')}</div>` : `
      <div class="ticket">
        <div><div class="k">${t.isEq?'จำนวนหุ้น':'ล็อต'}</div><div class="v">${nf(t.size,t.isEq?0:2)}</div></div>
        <div><div class="k">ขนาด</div><div class="v">${t.mult}R</div></div>
        <div><div class="k">เข้า</div><div class="v">${nf(t.entry,t.digits)}</div></div>
        <div><div class="k">SL</div><div class="v dn">${nf(t.sl,t.digits)}</div></div>
        <div><div class="k">TP ${t.tpR}R</div><div class="v up">${nf(t.tp,t.digits)}</div></div>
        <div><div class="k">เสี่ยง</div><div class="v">$${nf(t.riskUsd,0)}</div></div>
      </div>`}
      <div class="btnrow">
        <button class="btn" data-arm="${s.id}" ${pass?'':'disabled'}>ยิงไม้</button>
        <button class="btn quiet" data-skip="${s.id}">ข้าม + บันทึกเหตุผล</button>
      </div>
    </div>`;
  }).join('');
  return `
  ${SYNTHETIC?syntheticNote():''}
  <p class="lede">ด่านแรกคือ <b>EVIDENCE</b> — ก่อนถามว่าสัญญาณสวยไหม ระบบถามก่อนว่าตำรานี้พิสูจน์ตัวเองแล้วหรือยัง
  ตั๋วจะปรากฏต่อเมื่อผ่านครบทุกด่าน</p>
  <div class="label"><span>สัญญาณที่ยังมีชีวิต</span>
    <span>${live.length} · ผ่านครบ ${live.filter(s=>C.gatesFor(s).every(g=>g.ok)).length}</span></div>
  ${cards}`;
}

/* ---------------- 4 · ความเสี่ยง ---------------- */
function risk(){
  const roots = DB.Cluster.filter(c=>!c.parent);
  const bars = roots.map(c=>{
    const kids = DB.Cluster.filter(k=>k.parent===c.id);
    return [c,...kids].map((x,idx)=>{
      const used = C.clusterRisk(x), pct = Math.min(100, used/x.budgetR*100);
      return `<div class="row" style="grid-template-columns:1fr auto;cursor:default">
        <span class="name" style="font-size:14.5px;${idx?'padding-left:16px;font-weight:500':''}">${
          idx?'└ ':''}${esc(x.name)}</span>
        <span class="val">${nf(used,2)} / ${x.budgetR}R</span>
        <span class="sub" style="${idx?'padding-left:16px':''}">ρ ในกลุ่ม ${x.rho}${
          x.rhoParent?` · ρ กับแม่ ${x.rhoParent}`:''}</span>
        <span class="val-sub"><span class="bar" style="display:block;width:90px">
          <i class="${pct>=90?'warn':''}" style="width:${pct}%"></i></span></span>
      </div>`;
    }).join('');
  }).join('');

  const evRows = DB.Playbook.map(p=>{
    const e = C.evidence(p);
    const bad = !(e.ciLo>0);
    return `<button class="row" data-open="Playbook|${p.id}">
      <span class="name">${esc(p.name)}</span>
      <span class="val ${cls(e.exp)}">${sg(e.exp)}R</span>
      <span class="sub">n=${e.n} · CI ล่าง ${sg(e.ciLo)}R · <span class="${bad?'dn':'up'}">${e.tier}</span></span>
      <span class="val-sub">${e.riskMult}x</span>
    </button>`;
  }).join('');

  return `
  ${SYNTHETIC?syntheticNote():''}
  <p class="lede">งบความเสี่ยงเป็นลำดับชั้น — ถือ NAS100 อยู่แล้วซื้อหุ้นเทคเพิ่ม
  ความเสี่ยงจะถูกบวกขึ้นไปหากลุ่มแม่ตามค่า ρ เพราะมัน<b>คือเดิมพันเดิม ไม่ใช่การกระจาย</b></p>
  <div class="label"><span>งบรายกลุ่ม</span><span>ใช้ / เพดาน</span></div>
  <div class="rows">${bars}</div>
  <div class="label"><span>หลักฐานรายตำรา</span><span>ค่าคาดหวัง · ตัวคูณ</span></div>
  <div class="rows">${evRows}</div>
  <div class="note"><b>ทำไมบางตำราถึงเดินเงินจริงไม่ได้</b><br>
  ระบบ bootstrap ค่าคาดหวัง 400 รอบเพื่อหาช่วงความเชื่อมั่น 90%
  ถ้าขอบล่างยังไม่พ้นศูนย์ แปลว่ายังแยกไม่ออกว่าเป็น edge จริงหรือความบังเอิญ — ตัวคูณความเสี่ยงจึงเป็น 0
  วินเรตสวยกับตัวอย่าง 20 ไม้ไม่ใช่หลักฐาน มันคือเสียงรบกวน</div>`;
}

/* ---------------- แผ่นรายละเอียด ---------------- */
function openSheet(type, id){
  const o = byId(type, id);
  if(!o) return;
  const T = OBJECT_TYPES[type];
  let body = '';

  if(type==='Company'){
    const f=C.FUND, fl=C.redFlags(o), s=DB.Social.find(x=>x.companyId===o.id);
    body = `<div class="stats">
      ${stat('ROIC', nf(f.roic(o),1)+'%')}
      ${stat('FCF yield', nf(f.fcfYield(o),1)+'%')}
      ${stat('EV/EBIT', nf(f.evEbit(o),1))}
      ${stat('P/E', nf(f.peTTM(o),1), `${nf(f.peVsBand(o),0)}% ของกรอบ 5 ปี`)}
      ${stat('โตรายได้', nf(f.revGrowth(o),1)+'%')}
      ${stat('หนี้/EBITDA', nf(f.netDebtEbitda(o),1))}
      ${stat('accrual', nf(f.accrual(o),1)+'%', 'กำไรลบเงินสดจริง')}
      ${stat('คะแนนรวม', sg(C.composite(o)))}
    </div>
    ${fl.length?`<div class="gates" style="margin-top:18px">${fl.map(x=>`<span class="gate fail">${x}</span>`).join('')}</div>`:''}
    ${s?`<div class="label">กระแสโซเชียล</div>
      <div class="stats">
        ${stat('buzz z', sg(s.buzzZ))}
        ${stat('อารมณ์', sg(s.sentiment))}
        ${stat('บัญชีใหม่', s.newAccountPct+'%')}
        ${stat('เสี่ยงถูกปั่น', nf(s.botRisk,2))}
        ${stat('สูงติดกัน', s.daysElevated+' วัน')}
        ${stat('ล้ำงบ', sg(C.divergence(o)), s.zone)}
      </div>`:''}
    <div class="label">งบสี่ไตรมาสล่าสุด</div>
    <div class="rows">${o.q.map((q,idx)=>`<div class="row" style="cursor:default">
      <span class="name" style="font-size:14px;font-weight:500">ย้อนหลัง ${idx} ไตรมาส</span>
      <span class="val">${nf(q.rev,0)}</span>
      <span class="sub">กำไรสุทธิ ${nf(q.ni,0)} · เงินสด ${nf(q.ocf,0)} · ลงทุน ${nf(q.capex,0)}</span>
      <span class="val-sub ${cls(q.ocf-q.capex)}">FCF ${nf(q.ocf-q.capex,0)}</span>
    </div>`).join('')}</div>`;
  }
  else if(type==='Playbook'){
    const e = C.evidence(o), bad = !(e.ciLo>0);
    body = `<div class="stats">
      ${stat('ตัวอย่าง', e.n)}
      ${stat('ค่าคาดหวัง', sg(e.exp)+'R')}
      ${stat('CI 90%', `${sg(e.ciLo)} … ${sg(e.ciHi)}`)}
      ${stat('Profit factor', nf(e.pf))}
      ${stat('วินเรต', nf(e.wr,0)+'%')}
      ${stat('ตัวคูณเสี่ยง', e.riskMult+'x')}
      ${stat('ไม้ที่ข้าม', e.nSkip, `รวม ${sg(e.skipNet,1)}R ถ้าเข้า`)}
    </div>
    <div class="note">${bad
      ? `ขอบล่างของช่วงความเชื่อมั่นยังไม่พ้นศูนย์ — ด้วย ${e.n} ไม้ <b>ยังแยกไม่ออกว่าเป็น edge จริงหรือความบังเอิญ</b> ระบบล็อกให้เดินกระดาษ`
      : `ขอบล่างอยู่เหนือศูนย์ที่ ${sg(e.ciLo)}R — มีหลักฐานว่าค่าคาดหวังเป็นบวกจริง${e.tier==='THIN'?' แต่ตัวอย่างยังบาง จึงอนุญาตครึ่งไม้':''}`}
    </div>
    <div class="label">เงื่อนไข</div>
    <div class="rows">
      ${line('สภาพตลาดที่ใช้ได้', o.regimes.map(r=>C.REGIME_TH[r]).join(' · '))}
      ${line('ประเภทสินค้า', o.classes.join(' · '))}
      ${line('SL / TP', `${o.slAtr}× ATR → ${o.tpR}R`)}
      ${o.floorText?line('เกณฑ์พื้นฐาน', o.floorText):''}
      ${line('ทริกเกอร์', o.trigger)}
    </div>`;
  }
  else if(type==='Instrument'){
    body = `<div class="stats">
      ${stat('ราคา', nf(o.bid,o.digits))}
      ${stat('สภาพตลาด', C.REGIME_TH[C.regimeOf(o)])}
      ${stat('ATR percentile', o.atrPct)}
      ${stat('ADX', nf(o.adx,0))}
      ${stat('สเปรด', nf(C.spreadOfAtrPct(o),1)+'%', 'ของ ATR M15')}
      ${stat('ล็อตต่อ 1R', nf(C.sizeFor(o,1.5), o.klass==='Equity'?0:2))}
    </div>`;
  }

  const links = neighbours(type,o).map(g=>`
    <div class="row" style="cursor:default">
      <span class="name" style="font-size:13.5px;font-weight:500">${g.label}</span>
      <span class="val-sub" style="grid-column:2;grid-row:1/3;text-align:right">
        ${g.objs.slice(0,6).map(x=>`<button class="tag" data-open="${g.type}|${x.id}" style="margin-left:4px">${
          esc(OBJECT_TYPES[g.type].title(x))}</button>`).join('')}</span>
    </div>`).join('');

  $('#sheet-body').innerHTML = `
    <button class="close" data-close aria-label="ปิด">×</button>
    <div class="eyebrow">${type} · ${T.th}</div>
    <h2>${esc(T.title(o))}</h2>
    <div class="mute" style="font-size:13px">${esc(T.sub(o))}</div>
    ${body}
    ${links?`<div class="label">ความสัมพันธ์</div><div class="rows">${links}</div>`:''}`;
  $('#sheet').hidden = false;
  document.body.style.overflow='hidden';
  wire();
}
const stat = (k,v,h='') => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div>${h?`<div class="h">${h}</div>`:''}</div>`;
const line = (k,v) => `<div class="row" style="cursor:default"><span class="name" style="font-size:14px;font-weight:500">${k}</span>
  <span class="val-sub" style="grid-column:2;text-align:right;max-width:60vw">${esc(v)}</span></div>`;

function closeSheet(){
  $('#sheet').hidden = true;
  $('#sheet-body').innerHTML = '';
  document.body.style.overflow='';
}

const syntheticNote = () => `<div class="note" style="margin:0 0 26px">
  <b>ข้อมูลสังเคราะห์</b> — ราคา งบ กระแสโซเชียล ปั้นขึ้นเพื่อทดสอบตรรกะ ห้ามใช้ตัดสินใจลงทุน
  ต่อของจริงที่ <code>adapter.js</code> แล้วตั้ง <code>synthetic:false</code></div>`;

/* ---------------- events ---------------- */
function wire(){
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const [t,i]=b.dataset.open.split('|'); openSheet(t,i);
  });
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeSheet);
  document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{
    stockSort=b.dataset.sort; renderRoute('stocks');
  });
  document.querySelectorAll('[data-arm]').forEach(b=>b.onclick=()=>{
    const s = DB.Signal.find(x=>x.id===b.dataset.arm);
    const note = prompt('บันทึกเหตุผลที่เข้า (อย่างน้อย 10 ตัวอักษร)');
    if(!note || note.trim().length<10) return;
    const t = C.ticketFor(s);
    DB.Position.push({id:'P-'+(DB.Position.length+1), instrumentId:s.instrumentId, dir:s.dir,
      size:t.size, riskR:t.mult, openedMs:Date.now(), open:true});
    s.status='OPEN';
    log('ยิงไม้','Signal',s.id,[['status','CANDIDATE','OPEN']],note.trim());
    renderRoute('signals');
  });
  document.querySelectorAll('[data-skip]').forEach(b=>b.onclick=()=>{
    const s = DB.Signal.find(x=>x.id===b.dataset.skip);
    const note = prompt('เหตุผลที่ข้าม (ตรงๆ) — ข้อมูลนี้ใช้ปรับตำราได้จริง');
    if(!note || !note.trim()) return;
    s.status='SKIPPED';
    log('ข้าม','Signal',s.id,[['status','CANDIDATE','SKIPPED']],note.trim());
    renderRoute('signals');
  });
}

document.addEventListener('keydown', e => { if(e.key==='Escape') closeSheet(); });
