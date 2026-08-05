/* ============================================================
   ONTOLOGY — ชั้นความหมาย
   ประกาศว่าโลกนี้มีวัตถุอะไร เชื่อกันยังไง
   หน้าจอไม่รู้จักคำว่า "หุ้น" มันรู้จักแค่ ObjectType
   ============================================================ */

export const OBJECT_TYPES = {
  Instrument: { th:'สิ่งที่ซื้อขายได้', title:o=>o.id,  sub:o=>`${o.klass} · ${o.cluster}` },
  Company:    { th:'บริษัท',            title:o=>o.id,  sub:o=>o.name },
  Cluster:    { th:'กลุ่มความเสี่ยง',    title:o=>o.name,sub:o=>o.parent?`ลูกของ ${o.parent}`:'กลุ่มแม่' },
  Playbook:   { th:'ตำรา',              title:o=>o.name,sub:o=>o.horizon },
  Signal:     { th:'สัญญาณ',            title:o=>`${o.instrumentId} · ${o.playbookId}`, sub:o=>o.dir },
  Position:   { th:'สถานะที่ถือ',        title:o=>`${o.instrumentId} ${o.dir}`, sub:o=>`${o.riskR}R` },
  Social:     { th:'กระแสโซเชียล',       title:o=>o.id,  sub:o=>o.zone }
};

/* ความสัมพันธ์แบบมีชนิด — ประกาศครั้งเดียว เดินได้สองทาง */
export const LINK_TYPES = [
  {id:'listedAs', from:'Instrument', to:'Company',    fk:'companyId',   fwd:'เป็นหุ้นของ',  back:'ตั๋วที่ซื้อขายได้'},
  {id:'inCluster',from:'Instrument', to:'Cluster',    fk:'cluster',     fwd:'อยู่ในกลุ่ม',  back:'สินค้าในกลุ่ม'},
  {id:'childOf',  from:'Cluster',    to:'Cluster',    fk:'parent',      fwd:'เป็นลูกของ',   back:'กลุ่มลูก'},
  {id:'socialOf', from:'Social',     to:'Company',    fk:'companyId',   fwd:'กระแสของ',     back:'กระแสโซเชียล'},
  {id:'sigOn',    from:'Signal',     to:'Instrument', fk:'instrumentId',fwd:'สัญญาณบน',     back:'สัญญาณที่มีชีวิต'},
  {id:'sigUses',  from:'Signal',     to:'Playbook',   fk:'playbookId',  fwd:'ใช้ตำรา',      back:'สัญญาณจากตำรา'},
  {id:'posOn',    from:'Position',   to:'Instrument', fk:'instrumentId',fwd:'ถือสินค้า',    back:'สถานะที่ถืออยู่'}
];

/* DB ถูกเติมโดย main.js */
export const DB = {
  Instrument:[], Company:[], Cluster:[], Playbook:[], Signal:[], Position:[], Social:[]
};

export const byId = (type,id) => DB[type].find(o=>o.id===id);

export function outgoing(type,obj){
  return LINK_TYPES.filter(l=>l.from===type && obj[l.fk])
    .map(l=>({label:l.fwd, type:l.to, objs:[byId(l.to,obj[l.fk])].filter(Boolean)}))
    .filter(x=>x.objs.length);
}
export function incoming(type,obj){
  return LINK_TYPES.filter(l=>l.to===type)
    .map(l=>({label:l.back, type:l.from, objs:DB[l.from].filter(o=>o[l.fk]===obj.id)}))
    .filter(x=>x.objs.length);
}
export const neighbours = (type,obj) => [...outgoing(type,obj), ...incoming(type,obj)];

/* สมุดปูม — ทุกการเปลี่ยนแปลงถูกบันทึก */
export const AUDIT = [];
export function log(action, type, id, changes, note){
  AUDIT.unshift({at:Date.now(), action, type, id, changes:changes||[], note:note||''});
}
