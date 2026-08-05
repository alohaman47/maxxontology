/* ============================================================
   MAIN — โหลดข้อมูลเข้าออนโทโลยี แล้วเริ่มเราเตอร์
   ============================================================ */
import { loadData } from './adapter.js';
import { DB } from './ontology.js';
import * as C from './compute.js';
import { renderNav, renderRoute, ROUTES, setSynthetic } from './ui.js';

async function boot(){
  const d = await loadData();
  setSynthetic(!!d.synthetic);

  DB.Cluster = d.clusters.map(c=>({...c}));

  DB.Company = d.companies.map(c=>({...c}));

  /* สินค้าที่ซื้อขายได้ = FX/ดัชนี/โลหะ + หุ้นรายตัว
     หุ้นเป็น Instrument ที่ชี้ไปหา Company — ธุรกิจไม่ใช่ตั๋ว */
  DB.Instrument = [
    ...d.tradables.map(t=>({...t})),
    ...d.companies.map(c=>({
      id:c.id, companyId:c.id, klass:'Equity',
      cluster: d.sectorCluster[c.sector],
      bid:c.px, point:0.01, digits:2, tv:0.01, spreadPt:4,
      atrD1:+(c.px*0.018).toFixed(2), atrM15:+(c.px*0.003).toFixed(2),
      atrPct: 30 + (c.id.charCodeAt(0)*7)%60,
      adx:    14 + (c.id.charCodeAt(1)*3)%22,
      slope: ((c.id.charCodeAt(2)%7)-3)/10,
      ret1d: +(((c.id.charCodeAt(0)%11)-5)/4).toFixed(2)
    }))
  ];

  DB.Social = C.buildSocial(d.social);
  DB.Social.forEach(s => s.zone = C.zoneOf(s));

  DB.Playbook = d.playbooks.map(p=>({...p}));
  C.buildEvidence(DB.Playbook);

  DB.Position = d.positions.map(p=>({...p, open:true}));
  C.setRecentCloses(d.recentCloses);

  DB.Signal = C.buildSignals();

  route();
  window.addEventListener('hashchange', route);
}

function route(){
  const key = (location.hash.replace('#/','') || 'board');
  const valid = ROUTES.some(([k])=>k===key) ? key : 'board';
  renderNav(valid);
  renderRoute(valid);
}

boot().catch(err=>{
  document.getElementById('view').innerHTML =
    `<div class="empty">โหลดข้อมูลไม่สำเร็จ: ${err.message}</div>`;
  console.error(err);
});
