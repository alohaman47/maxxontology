/* ============================================================
   COMPUTE — ค่าที่คำนวณสด ไม่มีอะไรถูกเก็บไว้
   แก้งบไตรมาสเดียว ทุกตัวเลขในแอปขยับตาม
   ============================================================ */
import { DB } from './ontology.js';
import { PORTFOLIO as PF } from './adapter.js';

const MIN=60e3, DAY=864e5;
export const now = () => Date.now();

/* ---------- helpers ---------- */
export const mean = a => a.reduce((x,y)=>x+y,0)/a.length;
export const sd = a => { const m=mean(a); return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/a.length) };
let seed = 20260804;
const rnd = () => { seed|=0; seed=seed+0x6D2B79F5|0;
  let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296 };

/* ---------- งบ → อัตราส่วน (derived) ---------- */
const ttm = (c,k) => c.q.reduce((s,q)=>s+q[k],0);
export const FUND = {
  mktCap:      c => c.px*c.shares,
  peTTM:       c => FUND.mktCap(c)/ttm(c,'ni'),
  evEbit:      c => (FUND.mktCap(c)+c.debt-c.cash)/ttm(c,'ebit'),
  fcf:         c => ttm(c,'ocf')-ttm(c,'capex'),
  fcfYield:    c => FUND.fcf(c)/FUND.mktCap(c)*100,
  opMargin:    c => ttm(c,'ebit')/ttm(c,'rev')*100,
  roic:        c => ttm(c,'ebit')*0.79/(c.debt+c.equity-c.cash)*100,
  netDebtEbitda: c => (c.debt-c.cash)/(ttm(c,'ebit')*1.15),
  revGrowth:   c => (c.q[0].rev/c.q[3].rev-1)*100*4/3,
  accrual:     c => (ttm(c,'ni')-ttm(c,'ocf'))/c.assets*100,
  peVsBand:    c => (FUND.peTTM(c)-c.pe5[0])/(c.pe5[1]-c.pe5[0])*100
};
export function redFlags(c){
  const f=[];
  if(FUND.fcf(c)<=0)               f.push('FCF ติดลบ');
  if(FUND.netDebtEbitda(c)>3.5)    f.push('หนี้สูง');
  if(c.dilPct>2)                   f.push('เจือจาง');
  if(FUND.accrual(c)>4)            f.push('กำไรกระดาษ');
  if(FUND.peVsBand(c)>90)          f.push('P/E ปลายบนกรอบ');
  if(c.surprisePct<-3)             f.push('พลาดเป้า');
  return f;
}
/* คะแนนรวมปัจจัย: z ข้ามจักรวาล */
let Z=null;
function buildZ(){
  const zs=(fn,inv)=>{ const v=DB.Company.map(fn), m=mean(v), s=sd(v)||1, o={};
    DB.Company.forEach((c,i)=>o[c.id]=(inv?-1:1)*(v[i]-m)/s); return o };
  Z={ value:zs(FUND.evEbit,true), quality:zs(FUND.roic), growth:zs(FUND.revGrowth),
      safety:zs(FUND.netDebtEbitda,true), cash:zs(FUND.fcfYield) };
}
export function composite(c){
  if(!Z) buildZ();
  return (Z.quality[c.id]*1.1 + Z.value[c.id]*0.9 + Z.cash[c.id]*0.9
        + Z.safety[c.id]*0.7 + Z.growth[c.id]*0.6)/4.2;
}

/* ---------- สภาพตลาด ---------- */
export function regimeOf(i){
  if(i.atrPct<25) return 'COMPRESSION';
  if(i.adx>=25 && i.slope> 0.1) return 'TREND_UP';
  if(i.adx>=25 && i.slope<-0.1) return 'TREND_DOWN';
  if(i.atrPct>80) return 'EXPANSION';
  return 'RANGE';
}
export const REGIME_TH = {TREND_UP:'เทรนด์ขึ้น',TREND_DOWN:'เทรนด์ลง',RANGE:'ออกข้าง',
  COMPRESSION:'บีบตัว',EXPANSION:'ขยายตัว'};
export const spreadOfAtrPct = i => (i.spreadPt*i.point)/i.atrM15*100;

/* ---------- กระแสโซเชียล ---------- */
export function buildSocial(raw){
  const lr = raw.map(s=>Math.log(s.m24/s.base));
  const m=mean(lr), s0=sd(lr)||1;
  return raw.map((s,idx)=>{
    const buzzZ=+((lr[idx]-m)/s0).toFixed(2);
    const conc=1-s.uniq/s.m24;
    const botRisk=+Math.min(1, s.newAcc*1.5 + Math.max(0,conc-0.6)*1.2 + Math.max(0,buzzZ-1.5)*0.15).toFixed(2);
    return {id:s.id, companyId:s.id, mentions:s.m24, baseline:s.base, buzzZ,
      sentiment:s.sent, velocityPct:+((s.m24/s.base-1)*100).toFixed(0),
      newAccountPct:+(s.newAcc*100).toFixed(0), botRisk, daysElevated:s.daysElevated, zone:''};
  });
}
export function zoneOf(s){
  const c = DB.Company.find(x=>x.id===s.companyId);
  if(!c) return '—';
  const f = composite(c);
  return s.buzzZ>=0.6 ? (f>=0?'กระแสมีของรองรับ':'กระแสล้วน')
                      : (f>=0?'ของเงียบพื้นฐานดี':'ไม่มีอะไร');
}
export const divergence = c => {
  const s = DB.Social.find(x=>x.companyId===c.id);
  return s ? s.buzzZ - composite(c) : 0;
};
/* จัดอันดับแบบต้องมีของรองรับ ไม่ใช่แค่มาแรง */
export const attentionScore = c => {
  const s = DB.Social.find(x=>x.companyId===c.id);
  if(!s) return -9;
  return s.buzzZ*0.55 + composite(c)*0.85 + s.sentiment*0.35
       - s.botRisk*0.9 - Math.max(0,s.daysElevated-10)/10*0.5;
};

/* ---------- หลักฐาน: bootstrap CI ของค่าคาดหวัง ---------- */
export const EV = {};
function bootstrapCI(arr, iters=400){
  if(arr.length<5) return [NaN,NaN];
  const ms=[];
  for(let b=0;b<iters;b++){ let s=0;
    for(let i=0;i<arr.length;i++) s+=arr[Math.floor(rnd()*arr.length)];
    ms.push(s/arr.length); }
  ms.sort((a,b)=>a-b);
  return [ms[Math.floor(iters*0.05)], ms[Math.floor(iters*0.95)]];
}
/* ปั้นสมุดผลจำลองจาก n/wr — ของจริงให้แทนด้วย trades จาก MT5 */
export function buildEvidence(playbooks){
  playbooks.forEach(p=>{
    const taken=[], skipped=[];
    for(let k=0;k<p.n;k++){
      const win = rnd()<p.wr;
      let r = win ? p.tpR*(0.55+rnd()*0.75) : -(0.75+rnd()*0.45);
      r = +r.toFixed(2);
      (rnd()>0.22 ? taken : skipped).push(r);
    }
    const n=taken.length, wins=taken.filter(r=>r>0);
    const gp=wins.reduce((a,b)=>a+b,0);
    const gl=Math.abs(taken.filter(r=>r<=0).reduce((a,b)=>a+b,0));
    const [ciLo,ciHi]=bootstrapCI(taken);
    let tier='NO_EVIDENCE';
    if(n>=PF.minEvidenceN && ciLo>0) tier = n>=100 ? 'ESTABLISHED' : 'THIN';
    else if(n>=PF.minEvidenceN) tier='THIN';
    EV[p.id]={ n, exp:n?mean(taken):0, pf:gl?gp/gl:NaN, wr:n?wins.length/n*100:0,
      ciLo, ciHi, net:taken.reduce((a,b)=>a+b,0),
      skipNet:skipped.reduce((a,b)=>a+b,0), nSkip:skipped.length,
      tier, riskMult: tier==='ESTABLISHED'?1 : (tier==='THIN'&&ciLo>0)?0.5 : 0 };
  });
}
export const evidence = p => EV[p.id] || {n:0,tier:'NO_EVIDENCE',riskMult:0,ciLo:NaN};

/* ---------- ความเสี่ยงแบบลำดับชั้น ---------- */
const clusterOf = instId => {
  const i = DB.Instrument.find(x=>x.id===instId);
  return i ? i.cluster : null;
};
const kids = c => DB.Cluster.filter(x=>x.parent===c.id);
export function clusterRisk(c){
  let r = DB.Position.filter(p=>p.open && clusterOf(p.instrumentId)===c.id)
                     .reduce((s,p)=>s+p.riskR,0);
  kids(c).forEach(k => r += clusterRisk(k)*Math.abs(k.rhoParent||1));
  return r;
}
export const ancestors = c => { const o=[]; let x=c;
  while(x.parent){ x=DB.Cluster.find(y=>y.id===x.parent); o.push(x); } return o };
export const heat = () => DB.Position.filter(p=>p.open).reduce((s,p)=>s+p.riskR,0);
export const entriesToday = () => DB.Position.filter(p=>p.openedMs>now()-DAY).length;

/* ---------- ขนาดไม้ ---------- */
export function sizeFor(inst, slAtr, mult=1){
  const risk = PF.equity*PF.riskPerTradePct/100*mult;
  if(inst.klass==='Equity') return Math.max(1, Math.round(risk/(inst.atrD1*slAtr)));
  const slPoints = (inst.atrM15*slAtr)/inst.point;
  return Math.max(0.01, Math.round(risk/(slPoints*inst.tv)*100)/100);
}

/* ---------- ด่าน ---------- */
const FLOOR_FN = {
  'roic>=15':          c=>FUND.roic(c)>=15            || `ROIC ${FUND.roic(c).toFixed(1)}% ต่ำกว่า 15%`,
  'fcf>0':             c=>FUND.fcf(c)>0               || 'FCF ติดลบ',
  'netDebtEbitda<=2.5':c=>FUND.netDebtEbitda(c)<=2.5  || `หนี้สุทธิ/EBITDA ${FUND.netDebtEbitda(c).toFixed(1)}`,
  'netDebtEbitda<=3':  c=>FUND.netDebtEbitda(c)<=3    || `หนี้สุทธิ/EBITDA ${FUND.netDebtEbitda(c).toFixed(1)}`,
  'accrual<=4':        c=>FUND.accrual(c)<=4          || 'accrual สูง',
  'evEbit<=12':        c=>FUND.evEbit(c)<=12          || `EV/EBIT ${FUND.evEbit(c).toFixed(1)} เกิน 12`,
  'fcfYield>=5':       c=>FUND.fcfYield(c)>=5         || `FCF yield ${FUND.fcfYield(c).toFixed(1)}% ต่ำกว่า 5%`,
  'dilution<=1.5':     c=>c.dilPct<=1.5               || `เจือจาง ${c.dilPct.toFixed(1)}%`
};
let RECENT=[];
export const setRecentCloses = r => RECENT = r;
const lastLoss = id => {
  const l = RECENT.filter(x=>x.instrumentId===id && x.r<0).sort((a,b)=>b.tsMs-a.tsMs)[0];
  return l ? l.tsMs : 0;
};

export function gatesFor(sig){
  const i = DB.Instrument.find(x=>x.id===sig.instrumentId);
  const p = DB.Playbook.find(x=>x.id===sig.playbookId);
  const c = DB.Cluster.find(x=>x.id===i.cluster);
  const e = evidence(p);
  const isEq = i.klass==='Equity';
  const comp = isEq ? DB.Company.find(x=>x.id===i.companyId) : null;
  const g = [];
  const add = (k, ok, why) => g.push({k, ok, why: ok?'':why});

  add('EVIDENCE', e.riskMult>0,
    e.n<PF.minEvidenceN ? `มี ${e.n} ไม้ ยังไม่ถึงขั้นต่ำ ${PF.minEvidenceN} — เดินกระดาษก่อน`
                        : `ขอบล่าง 90% CI = ${e.ciLo.toFixed(2)}R ยังไม่พ้นศูนย์ พิสูจน์ไม่ได้ว่ามี edge`);
  add('REGIME', p.regimes.includes(regimeOf(i)),
    `ตำรานี้ไม่ได้ทำมาเพื่อ${REGIME_TH[regimeOf(i)]}`);

  if(isEq){
    const advPct = sizeFor(i,p.slAtr,e.riskMult||1)*i.bid/1e6/comp.advUsdM*100;
    add('LIQUIDITY', advPct<=PF.maxAdvPct, `ไม้กิน ${advPct.toFixed(2)}% ของวอลุ่มวัน`);
    add('EARNINGS', comp.earnInDays>PF.earnBlackoutDays,
      `งบจ่ออีก ${comp.earnInDays} วัน (ห้ามเข้าใน ${PF.earnBlackoutDays} วัน)`);
    const s = DB.Social.find(x=>x.companyId===comp.id);
    const crowded = s && s.buzzZ>PF.maxBuzzZ &&
      (FUND.peVsBand(comp)>75 || redFlags(comp).length>0 || s.botRisk>0.35);
    add('CROWDING', !crowded,
      `กระแส z ${s?s.buzzZ.toFixed(2):'—'} สูงพร้อมสัญญาณเสี่ยง — รูปแบบที่หางซ้ายอ้วนที่สุด`);
    if(p.floor){
      const errs = p.floor.map(k=>FLOOR_FN[k](comp)).filter(x=>x!==true);
      add('FUNDAMENTALS', errs.length===0, errs.join(' · '));
    }
  }else{
    const spr = spreadOfAtrPct(i);
    add('SPREAD', spr<=PF.maxSpreadOfAtrPct,
      `สเปรดกิน ${spr.toFixed(1)}% ของ ATR (เพดาน ${PF.maxSpreadOfAtrPct}%)`);
  }

  const cd = (now()-lastLoss(i.id))/MIN;
  add('COOLDOWN', cd>=PF.cooldownMin,
    `เพิ่งขาดทุนบน ${i.id} เมื่อ ${cd.toFixed(0)} นาทีก่อน (ต้องพัก ${PF.cooldownMin} นาที)`);
  add('DAILY CAP', entriesToday()<PF.dailyEntryCap, `เปิดครบ ${PF.dailyEntryCap} ไม้แล้ววันนี้`);

  const chain = [c, ...ancestors(c)].filter(Boolean);
  const bad = chain.find(x => clusterRisk(x)+(e.riskMult||1) > x.budgetR);
  add('CLUSTER BUDGET', !bad,
    bad ? `กลุ่ม ${bad.name} ใช้ไป ${clusterRisk(bad).toFixed(1)}R จากงบ ${bad.budgetR}R` : '');
  add('PORTFOLIO HEAT', heat()+(e.riskMult||1)<=PF.maxHeatR,
    `ความร้อนรวม ${heat().toFixed(1)}R ชนเพดาน ${PF.maxHeatR}R`);
  return g;
}

export function ticketFor(sig){
  const i = DB.Instrument.find(x=>x.id===sig.instrumentId);
  const p = DB.Playbook.find(x=>x.id===sig.playbookId);
  const e = evidence(p), mult = e.riskMult||0;
  const isEq = i.klass==='Equity';
  const size = sizeFor(i, p.slAtr, mult||1);
  const slDist = (isEq ? i.atrD1 : i.atrM15)*p.slAtr;
  return { size, mult, isEq, digits:i.digits, tpR:p.tpR,
    entry:i.bid,
    sl: sig.dir==='BUY' ? i.bid-slDist : i.bid+slDist,
    tp: sig.dir==='BUY' ? i.bid+slDist*p.tpR : i.bid-slDist*p.tpR,
    riskUsd: PF.equity*PF.riskPerTradePct/100*mult };
}

/* ---------- คัดสัญญาณ ---------- */
export function buildSignals(){
  const out=[]; let n=0;
  DB.Instrument.forEach(i=>{
    const rg = regimeOf(i);
    DB.Playbook.forEach(p=>{
      if(!p.classes.includes(i.klass)) return;
      if(!p.regimes.includes(rg)) return;
      const dir = p.horizon==='INVESTING' ? 'BUY'
                : rg==='TREND_DOWN' ? 'SELL'
                : rg==='TREND_UP' ? 'BUY' : 'BUY';
      out.push({ id:'S-'+String(++n).padStart(3,'0'), instrumentId:i.id, playbookId:p.id,
        dir, status:'CANDIDATE', score:scoreOf(i,p,dir) });
    });
  });
  return out.sort((a,b)=>b.score-a.score);
}
/* คะแนน = หลักฐาน 30 + สภาพตลาดชัดแค่ไหน 22 + ต้นทุนเข้าออก 12
   + (หุ้น) พื้นฐาน 26 ลบด้วยส่วนที่เรื่องเล่าวิ่งนำงบ 12
   หลักฐานถ่วงหนักสุดโดยตั้งใจ — สัญญาณสวยจากตำราที่ยังไม่พิสูจน์ ไม่ควรขึ้นบนสุด */
function scoreOf(i,p,dir){
  const e = evidence(p);
  let s = 0;
  s += Math.round(30*(e.tier==='ESTABLISHED'?1:e.tier==='THIN'?0.55:0.15));

  const rg = regimeOf(i);
  const clarity = (rg==='TREND_UP'||rg==='TREND_DOWN') ? Math.min(1,(i.adx-20)/20)
                : rg==='COMPRESSION' ? Math.min(1,(25-i.atrPct)/18)
                : rg==='EXPANSION'   ? Math.min(1,(i.atrPct-70)/25)
                : 1 - Math.abs(i.slope);                       // ออกข้าง: ยิ่งเรียบยิ่งชัด
  s += Math.round(22*Math.max(0.1,Math.min(1,clarity)));

  const cost = spreadOfAtrPct(i)/PF.maxSpreadOfAtrPct;         // 0 = ฟรี, 1 = ชนเพดาน
  s += Math.round(12*Math.max(0,1-cost));

  if(i.klass==='Equity'){
    const c = DB.Company.find(x=>x.id===i.companyId);
    s += Math.round(26*Math.max(0,Math.min(1,(composite(c)+1.4)/2.8)));
    s -= Math.round(12*Math.max(0,Math.min(1,(divergence(c)-0.6)/2)));
  } else {
    s += 14;
  }
  return Math.max(0,Math.min(100,s));
}
