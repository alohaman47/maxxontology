/* ============================================================
   ADAPTER — แก้ไฟล์นี้ไฟล์เดียวตอนต่อข้อมูลจริง
   ไฟล์อื่นทั้งหมดอ่านผ่าน loadData() เท่านั้น ไม่ต้องแตะ
   ============================================================ */

export const PORTFOLIO = {
  equity: 11840,
  riskPerTradePct: 1.0,     // ความเสี่ยงต่อไม้
  maxHeatR: 4,              // เพดานความร้อนรวม
  killDDPct: 25,            // เส้นตายกองทุน
  maxSpreadOfAtrPct: 18,    // สเปรดสูงสุดเทียบ ATR
  maxAdvPct: 1.0,           // ขนาดไม้สูงสุดเทียบวอลุ่มวัน (หุ้น)
  earnBlackoutDays: 5,      // ห้ามเข้ากี่วันก่อนประกาศงบ
  cooldownMin: 30,          // พักหลังขาดทุนบนสินค้าเดิม
  dailyEntryCap: 6,
  minEvidenceN: 30,         // ตัวอย่างขั้นต่ำก่อนใช้เงินจริง
  maxBuzzZ: 1.5             // เพดานกระแสโซเชียล
};

/* --- สินค้าที่ซื้อขายได้ ---------------------------------------
   จาก MT5: SymbolInfoDouble(BID) / iATR / iADX
   tv = มูลค่าต่อ 1 point ต่อ 1 lot  ← ต้องดึงจาก SYMBOL_TRADE_TICK_VALUE จริง
------------------------------------------------------------- */
const TRADABLES = [
  {id:'XAUUSD',klass:'Metal',cluster:'METALS',bid:4087.20,point:0.01,digits:2,tv:1.00,spreadPt:14,
   atrM15:3.85,atrD1:48.6,atrPct:58,adx:26,slope:0.22,ret1d:0.48},
  {id:'NAS100',klass:'Index',cluster:'US_EQ',bid:29850.5,point:0.1,digits:1,tv:0.10,spreadPt:12,
   atrM15:42.0,atrD1:380,atrPct:62,adx:29,slope:0.48,ret1d:1.15},
  {id:'US30',klass:'Index',cluster:'US_EQ',bid:54090.0,point:0.1,digits:1,tv:0.10,spreadPt:25,
   atrM15:55.0,atrD1:520,atrPct:55,adx:27,slope:0.31,ret1d:1.71},
  {id:'SPX500',klass:'Index',cluster:'US_EQ',bid:7736.50,point:0.1,digits:2,tv:0.10,spreadPt:5,
   atrM15:8.20,atrD1:78.0,atrPct:60,adx:28,slope:0.41,ret1d:1.79},
  {id:'US2000',klass:'Index',cluster:'US_EQ',bid:3037.00,point:0.1,digits:1,tv:0.10,spreadPt:6,
   atrM15:6.80,atrD1:52.0,atrPct:48,adx:22,slope:0.18,ret1d:1.85},
  {id:'EURUSD',klass:'FX',cluster:'USD',bid:1.15320,point:0.00001,digits:5,tv:1.00,spreadPt:8,
   atrM15:0.00062,atrD1:0.0075,atrPct:38,adx:16,slope:0.08,ret1d:0.18}
];

/* --- บริษัท + งบ 4 ไตรมาส --------------------------------------
   ของจริง: SEC XBRL companyfacts (ฟรี)
   https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json
   หน่วย: ล้านดอลลาร์
------------------------------------------------------------- */
const COMPANIES = [
  {id:'AAPL',name:'Apple',sector:'TECH',px:309.40,shares:15200,advUsdM:11800,
   debt:104600,cash:61800,equity:66900,assets:352600,pe5:[21,34],dilPct:-2.6,
   earnInDays:23,surprisePct:2.8,divYieldPct:0.44,foreignRevPct:58,
   q:[{rev:94800,ebit:28914,ni:24458,ocf:28371,capex:2749},
      {rev:93250,ebit:28353,ni:23984,ocf:27821,capex:2704},
      {rev:91800,ebit:27882,ni:23684,ocf:27473,capex:2662},
      {rev:90400,ebit:27672,ni:23303,ocf:27032,capex:2622}]},
  {id:'MSFT',name:'Microsoft',sector:'TECH',px:485.20,shares:7430,advUsdM:9200,
   debt:97800,cash:75500,equity:268500,assets:512200,pe5:[24,38],dilPct:0.2,
   earnInDays:31,surprisePct:4.1,divYieldPct:0.72,foreignRevPct:50,
   q:[{rev:64700,ebit:28856,ni:22969,ocf:28481,capex:13587},
      {rev:62400,ebit:27830,ni:22152,ocf:27468,capex:13104},
      {rev:60100,ebit:26804,ni:21335,ocf:22455,capex:12621},
      {rev:58000,ebit:25868,ni:20590,ocf:21673,capex:12180}]},
  {id:'NVDA',name:'Nvidia',sector:'TECH',px:214.50,shares:24500,advUsdM:38000,
   debt:9700,cash:34800,equity:58200,assets:85200,pe5:[28,92],dilPct:0.9,
   earnInDays:9,surprisePct:6.2,divYieldPct:0.02,foreignRevPct:56,
   q:[{rev:30040,ebit:18655,ni:16612,ocf:16280,capex:721},
      {rev:26040,ebit:16171,ni:14400,ocf:14112,capex:625},
      {rev:22100,ebit:13724,ni:12221,ocf:11977,capex:530},
      {rev:18120,ebit:11253,ni:10020,ocf:9820,capex:435}]},
  {id:'XOM',name:'Exxon Mobil',sector:'ENERGY',px:114.20,shares:4430,advUsdM:2400,
   debt:41600,cash:26500,equity:277800,assets:453500,pe5:[9,22],dilPct:3.1,
   earnInDays:41,surprisePct:-1.8,divYieldPct:3.32,foreignRevPct:62,
   q:[{rev:93060,ebit:11912,ni:8934,ocf:12686,capex:5956},
      {rev:91800,ebit:11750,ni:8813,ocf:12514,capex:5875},
      {rev:90500,ebit:11584,ni:8688,ocf:12336,capex:5792},
      {rev:92100,ebit:11789,ni:8842,ocf:12555,capex:5894}]},
  {id:'JPM',name:'JPMorgan',sector:'FIN',px:212.70,shares:2870,advUsdM:2900,
   debt:391000,cash:435000,equity:337000,assets:4143000,pe5:[8,14],dilPct:-2.1,
   earnInDays:52,surprisePct:5.6,divYieldPct:2.32,foreignRevPct:26,
   q:[{rev:50990,ebit:19835,ni:14838,ocf:13058,capex:561},
      {rev:49200,ebit:19139,ni:14317,ocf:12599,capex:541},
      {rev:47800,ebit:18594,ni:13910,ocf:12241,capex:526},
      {rev:46600,ebit:18127,ni:13561,ocf:11934,capex:513}]},
  {id:'COST',name:'Costco',sector:'STAPLES',px:882.10,shares:444,advUsdM:1600,
   debt:9100,cash:11200,equity:23600,assets:69800,pe5:[32,58],dilPct:0.3,
   earnInDays:16,surprisePct:1.4,divYieldPct:0.52,foreignRevPct:27,
   q:[{rev:58520,ebit:2165,ni:1697,ocf:2342,capex:1120},
      {rev:57100,ebit:2113,ni:1656,ocf:2285,capex:1085},
      {rev:55800,ebit:2065,ni:1618,ocf:2233,capex:1060},
      {rev:54300,ebit:2009,ni:1575,ocf:2174,capex:1032}]}
];

/* --- กระแสโซเชียล 24 ชม. -------------------------------------
   ของจริง: StockTwits / Reddit API — นับ mention + sentiment
------------------------------------------------------------- */
const SOCIAL = [
  {id:'NVDA', m24:184000,base:52000,sent: 0.72,uniq:41000,newAcc:0.34,daysElevated:14},
  {id:'AAPL', m24: 96000,base:61000,sent: 0.31,uniq:38000,newAcc:0.09,daysElevated:22},
  {id:'MSFT', m24: 41000,base:28000,sent: 0.44,uniq:19000,newAcc:0.07,daysElevated:18},
  {id:'COST', m24: 22400,base: 9800,sent: 0.55,uniq: 9600,newAcc:0.12,daysElevated:9},
  {id:'XOM',  m24:  5100,base: 8600,sent: 0.08,uniq: 3100,newAcc:0.04,daysElevated:0},
  {id:'JPM',  m24:  7800,base: 8100,sent: 0.22,uniq: 4400,newAcc:0.05,daysElevated:1}
];

/* --- กลุ่มความเสี่ยง (ลำดับชั้น) ------------------------------ */
const CLUSTERS = [
  {id:'US_EQ',   name:'US Equity beta', parent:null,    budgetR:2.5, rho:0.89},
  {id:'EQ_TECH', name:'US Tech',        parent:'US_EQ', budgetR:1.2, rho:0.82, rhoParent:0.91},
  {id:'EQ_ENERGY',name:'US Energy',     parent:'US_EQ', budgetR:1.0, rho:0.74, rhoParent:0.52},
  {id:'EQ_FIN',  name:'US Financials',  parent:'US_EQ', budgetR:1.0, rho:0.79, rhoParent:0.80},
  {id:'EQ_STAPLES',name:'US Staples',   parent:'US_EQ', budgetR:1.0, rho:0.70, rhoParent:0.58},
  {id:'USD',     name:'USD bloc',       parent:null,    budgetR:2.0, rho:0.72},
  {id:'METALS',  name:'Real asset',     parent:null,    budgetR:1.5, rho:0.40}
];
const SECTOR_CLUSTER = {TECH:'EQ_TECH',ENERGY:'EQ_ENERGY',FIN:'EQ_FIN',STAPLES:'EQ_STAPLES'};

/* --- ตำรา + สมุดผลย้อนหลัง -----------------------------------
   n / wr ใช้ปั้นสมุดผลจำลอง — ของจริงให้แทน trades ด้วย export จาก MT5/PTJ
------------------------------------------------------------- */
const PLAYBOOKS = [
  {id:'FALSE_BREAK',name:'False Break PDH/PDL',horizon:'INTRADAY',
   regimes:['RANGE','COMPRESSION'],classes:['FX','Index','Metal'],slAtr:1.2,tpR:2.0,
   trigger:'ทะลุ PDH/PDL แล้วปิดกลับในแท่งเดียว',n:214,wr:0.46},
  {id:'FVG_CONT',name:'FVG Continuation',horizon:'INTRADAY',
   regimes:['TREND_UP','TREND_DOWN','EXPANSION'],classes:['Index','Metal'],slAtr:1.5,tpR:2.5,
   trigger:'เติมช่องว่าง 50% แล้วไปต่อตามเทรนด์แม่',n:148,wr:0.41},
  {id:'COMPRESS_BRK',name:'Compression Breakout',horizon:'INTRADAY',
   regimes:['COMPRESSION'],classes:['FX','Index'],slAtr:1.0,tpR:3.0,
   trigger:'ATR percentile ต่ำกว่า 25 แล้วมีแท่งขยายตัวออกกรอบ',n:44,wr:0.33},
  {id:'QUALITY',name:'Quality Compounder',horizon:'INVESTING',
   regimes:['TREND_UP','RANGE','COMPRESSION'],classes:['Equity'],slAtr:2.5,tpR:4.0,
   trigger:'ธุรกิจคุณภาพย่อลงหาเส้นค่าเฉลี่ยโดยพื้นฐานไม่เสีย',n:58,wr:0.49,
   floorText:'ROIC ≥ 15% · FCF บวก · หนี้สุทธิ/EBITDA ≤ 2.5',
   floor:['roic>=15','fcf>0','netDebtEbitda<=2.5','accrual<=4']},
  {id:'DEEP_VALUE',name:'Deep Value + Cash',horizon:'INVESTING',
   regimes:['RANGE','COMPRESSION','TREND_DOWN'],classes:['Equity'],slAtr:3.0,tpR:5.0,
   trigger:'ถูกจริงและคืนเงินสดจริง ไม่ใช่ถูกเพราะกำลังพัง',n:23,wr:0.39,
   floorText:'EV/EBIT ≤ 12 · FCF yield ≥ 5% · ไม่เจือจาง',
   floor:['evEbit<=12','fcfYield>=5','netDebtEbitda<=3','dilution<=1.5']}
];

/* --- สถานะที่ถืออยู่ ------------------------------------------ */
const POSITIONS = [
  {id:'P-01',instrumentId:'NAS100',dir:'BUY',size:0.30,riskR:1.00,openedMs:Date.now()-6*3600e3},
  {id:'P-02',instrumentId:'SPX500',dir:'BUY',size:0.40,riskR:1.00,openedMs:Date.now()-4*3600e3},
  {id:'P-03',instrumentId:'XAUUSD',dir:'BUY',size:0.08,riskR:0.80,openedMs:Date.now()-22*3600e3}
];

/* --- ไม้ที่ปิดไปแล้ววันนี้ (ให้ด่าน COOLDOWN มีของจับ) --------- */
const RECENT_CLOSES = [
  {instrumentId:'NAS100',tsMs:Date.now()-8*60e3,  r:-1.0},
  {instrumentId:'XAUUSD',tsMs:Date.now()-48*60e3, r:-1.0}
];

/* ============================================================
   loadData() — จุดเดียวที่ไฟล์อื่นเรียก
   ตอนต่อของจริง เปลี่ยนเป็น async fetch แล้วคืนรูปร่างเดิม เช่น
     const r = await fetch('./data/snapshot.json'); return r.json();
   ============================================================ */
export async function loadData(){
  return {
    tradables: TRADABLES,
    companies: COMPANIES,
    social: SOCIAL,
    clusters: CLUSTERS,
    sectorCluster: SECTOR_CLUSTER,
    playbooks: PLAYBOOKS,
    positions: POSITIONS,
    recentCloses: RECENT_CLOSES,
    synthetic: true   // ตั้ง false เมื่อเป็นข้อมูลจริง — แถบเตือนจะหายไป
  };
}
