import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

// ─── Constants ────────────────────────────────────────────────
const HOUR_HEIGHT = 64;
const START_HOUR  = 6;
const END_HOUR    = 23;
const DAYS_PT     = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
const DAYS_FULL   = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"];
const DURATION_OPTIONS = [
  {label:"15 min",value:15},{label:"30 min",value:30},{label:"45 min",value:45},
  {label:"1 hora",value:60},{label:"1h 30min",value:90},{label:"2 horas",value:120},
  {label:"3 horas",value:180},{label:"4 horas",value:240},
];
const RECURRENCE_OPTIONS = [
  {label:"Não repetir",value:"none"},
  {label:"Todo dia",value:"daily"},
  {label:"Toda semana",value:"weekly"},
  {label:"Dias úteis (Seg–Sex)",value:"weekdays"},
  {label:"Fins de semana",value:"weekends"},
];
const RECURRENCE_LABELS = {
  none:null,daily:"Todo dia",weekly:"Semanal",weekdays:"Dias úteis",weekends:"Fins de semana",
};
const PC = {
  high:   {label:"Alta",  color:"#EF4444",bg:"#FEE2E2",text:"#991B1B",light:"#FEF2F2"},
  medium: {label:"Média", color:"#F59E0B",bg:"#FEF3C7",text:"#92400E",light:"#FFFBEB"},
  low:    {label:"Baixa", color:"#22C55E",bg:"#DCFCE7",text:"#14532D",light:"#F0FDF4"},
};

// ─── Helpers ──────────────────────────────────────────────────
function getWeekStart(date) {
  const d = new Date(date), day = d.getDay();
  d.setDate(d.getDate() - day + (day===0?-6:1));
  d.setHours(0,0,0,0); return d;
}
const fmtDate     = d => d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
const fmtDateFull = d => d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"});
const fmtH        = h => `${String(Math.floor(h)).padStart(2,"0")}:${String(Math.round((h%1)*60)).padStart(2,"0")}`;
const fmtDur      = m => m<60?`${m}min`:`${Math.floor(m/60)}h${m%60?` ${m%60}min`:""}`;

function getRecurringDays(r) {
  if (r==="daily")    return [0,1,2,3,4,5,6];
  if (r==="weekdays") return [0,1,2,3,4];
  if (r==="weekends") return [5,6];
  return null;
}

// ─── CSS ──────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#F5F5F7;--sf:#fff;--sf2:#FAFAFA;--bd:#E4E4E7;--bd2:#F0F0F2;
  --tx:#18181B;--tx2:#52525B;--tx3:#A1A1AA;
  --ac:#2563EB;--ach:#1D4ED8;--acl:#EFF6FF;
  --sh:0 1px 2px rgba(0,0,0,.06);--shm:0 4px 12px rgba(0,0,0,.08);--shl:0 16px 32px rgba(0,0,0,.14);
  --r:10px;--font:'Inter',sans-serif;
  --hdr:52px;--bot:64px;
}
html,body{height:100%;overflow:hidden}
body{font-family:var(--font);background:var(--bg);color:var(--tx);-webkit-font-smoothing:antialiased}
.app{display:flex;flex-direction:column;height:100vh;overflow:hidden}

/* ── Header ── */
.hdr{display:flex;align-items:center;justify-content:space-between;padding:0 16px;height:var(--hdr);background:var(--sf);border-bottom:1px solid var(--bd);flex-shrink:0;z-index:20;gap:10px}
.logo{display:flex;align-items:center;gap:8px;user-select:none;flex-shrink:0}
.logo-ic{width:28px;height:28px;background:var(--ac);border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.logo-tx{font-size:15px;font-weight:700;color:var(--tx);letter-spacing:-.4px}
.logo-tx em{color:var(--ac);font-style:normal}
/* Desktop nav in header */
.hdr-nav{display:flex;align-items:center;gap:4px}
.nav-btn{padding:5px 12px;border-radius:6px;border:none;background:transparent;font-family:var(--font);font-size:12.5px;font-weight:500;color:var(--tx2);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:5px;white-space:nowrap}
.nav-btn:hover{background:var(--bg);color:var(--tx)}
.nav-btn.active{background:var(--acl);color:var(--ac);font-weight:600}
.wk-nav{display:flex;align-items:center;gap:5px}
.wk-lbl{font-size:12px;font-weight:500;min-width:148px;text-align:center;font-variant-numeric:tabular-nums;color:var(--tx2)}
.ib{width:28px;height:28px;border:1px solid var(--bd);background:var(--sf);border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--tx3);transition:all .15s;font-size:14px;flex-shrink:0}
.ib:hover{background:var(--bg);color:var(--tx)}
.today-b{width:auto;padding:0 10px;font-size:11px;font-weight:600;font-family:var(--font);color:var(--tx2)}
.sync-lbl{font-size:10.5px;color:var(--tx3);white-space:nowrap;flex-shrink:0}

/* ── Body ── */
.body{display:flex;flex:1;overflow:hidden;min-height:0}

/* ── Sidebar ── */
.sidebar{width:30%;min-width:248px;max-width:320px;background:var(--sf);border-right:1px solid var(--bd);display:flex;flex-direction:column;overflow:hidden;flex-shrink:0}
.sb-top{padding:16px 14px 0;flex-shrink:0}
.sb-title{font-size:14px;font-weight:700;color:var(--tx);margin-bottom:2px}
.sb-sub{font-size:11.5px;color:var(--tx3);margin-bottom:11px}
.new-btn{width:100%;padding:10px;background:var(--ac);color:#fff;border:none;border-radius:var(--r);font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s;margin-bottom:11px}
.new-btn:hover{background:var(--ach);box-shadow:0 2px 8px rgba(37,99,235,.25)}
.sb-counts{display:flex;gap:4px;padding:0 14px 11px;flex-shrink:0;border-bottom:1px solid var(--bd2);flex-wrap:wrap}
.cnt-c{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;font-size:10.5px;font-weight:600;border:1px solid transparent;white-space:nowrap}
.cnt-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
.task-list{flex:1;overflow-y:auto;padding:8px 8px 20px;min-height:0}
.task-list::-webkit-scrollbar{width:3px}
.task-list::-webkit-scrollbar-thumb{background:var(--bd);border-radius:4px}
.tc{padding:12px 12px;background:var(--sf);border-radius:var(--r);margin-bottom:6px;cursor:grab;transition:all .15s;border:1px solid var(--bd2)}
.tc:hover{box-shadow:var(--shm);border-color:var(--bd)}
.tc.drag{opacity:.35;transform:scale(.97)}
.tc:active{cursor:grabbing}
.tc-row{display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:7px}
.tc-name{font-size:13px;font-weight:500;line-height:1.4;flex:1;word-break:break-word;color:var(--tx);cursor:pointer}
.tc-name:hover{color:var(--ac)}
.tc-del{width:20px;height:20px;border:none;background:transparent;cursor:pointer;color:var(--tx3);display:flex;align-items:center;justify-content:center;border-radius:4px;transition:all .15s;font-size:11px;flex-shrink:0}
.tc-del:hover{background:#FEE2E2;color:#EF4444}
.tc-meta{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.pb{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:20px;font-size:10.5px;font-weight:600}
.pd{width:5px;height:5px;border-radius:50%;flex-shrink:0}
.db{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:20px;font-size:10.5px;font-weight:500;background:var(--bg);color:var(--tx2);border:1px solid var(--bd)}
.rec-badge{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:500;background:#EFF6FF;color:#2563EB;border:1px solid #BFDBFE}
.desc-dot{width:6px;height:6px;border-radius:50%;background:var(--ac);flex-shrink:0;opacity:.6}
.drag-tip{font-size:11px;color:var(--tx3);text-align:center;padding:10px 8px;line-height:1.6}
.empty{text-align:center;padding:32px 20px;color:var(--tx3)}
.empty p{font-size:13px;line-height:1.7;margin-top:10px}

/* ── Calendar ── */
.cal-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;background:var(--bg)}
.cal-hdr{display:flex;background:var(--sf);border-bottom:1px solid var(--bd);flex-shrink:0}
.tg{width:48px;flex-shrink:0;border-right:1px solid var(--bd2)}
.dh{flex:1;padding:7px 3px;text-align:center;border-left:1px solid var(--bd);min-width:0;cursor:default}
.dh-n{font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--tx3)}
.dh-d{font-size:14px;font-weight:600;color:var(--tx);margin-top:1px;font-variant-numeric:tabular-nums}
.dh.today .dh-n{color:var(--ac)}
.dh.today .dh-d{background:var(--ac);color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:2px auto 0;font-size:12px}
.cal-scroll{flex:1;overflow-y:auto;overflow-x:hidden;min-height:0}
.cal-scroll::-webkit-scrollbar{width:4px}
.cal-scroll::-webkit-scrollbar-thumb{background:var(--bd);border-radius:4px}
.cal-grid{display:flex;position:relative}
.tc-col{width:48px;flex-shrink:0;background:var(--bg);border-right:1px solid var(--bd2)}
.t-lbl{display:flex;align-items:flex-start;justify-content:flex-end;padding-right:6px;font-size:9.5px;color:var(--tx3);font-weight:500;font-variant-numeric:tabular-nums;transform:translateY(-6px)}
.day-col{flex:1;border-left:1px solid var(--bd);position:relative;background:var(--sf);min-width:0}
.hs{border-bottom:1px solid var(--bd2);position:relative;transition:background .1s}
.hs::after{content:'';position:absolute;bottom:50%;left:0;right:0;border-bottom:1px dashed var(--bd2);pointer-events:none}
.hs.drop{background:var(--acl)!important}
.hs.drop::before{content:'';position:absolute;inset:0;border:1.5px dashed var(--ac);border-radius:4px;opacity:.6;pointer-events:none;z-index:1}

/* ── Cal blocks ── */
.cb{position:absolute;left:2px;right:2px;border-radius:5px;padding:3px 6px 3px;cursor:pointer;z-index:2;overflow:hidden;transition:box-shadow .15s;box-shadow:var(--sh)}
.cb:hover{z-index:4;box-shadow:var(--shm)}
.cb.done{opacity:.42}
.cb.recurring{opacity:.82}
.cb-top{display:flex;align-items:flex-start;justify-content:space-between;gap:2px}
.cb-name{font-size:11px;font-weight:600;line-height:1.3;flex:1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
.cb.done .cb-name{text-decoration:line-through;opacity:.7}
.cb-acts{display:flex;gap:2px;flex-shrink:0}
.cb-btn{width:15px;height:15px;border:none;background:rgba(0,0,0,.1);border-radius:3px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:inherit;transition:background .1s}
.cb-btn:hover{background:rgba(0,0,0,.2)}
.cb-time{font-size:9px;opacity:.65;margin-top:1px;font-variant-numeric:tabular-nums}
.cb-rec{font-size:8.5px;opacity:.55}

/* ── Now line ── */
.now-line{position:absolute;left:0;right:0;height:2px;background:var(--ac);z-index:5;pointer-events:none}
.now-line::before{content:'';position:absolute;left:-4px;top:-4px;width:10px;height:10px;border-radius:50%;background:var(--ac)}

/* ── History ── */
.hist-wrap{flex:1;overflow-y:auto;padding:20px 16px 20px;min-height:0}
.hist-wrap::-webkit-scrollbar{width:4px}
.hist-wrap::-webkit-scrollbar-thumb{background:var(--bd);border-radius:4px}
.hist-title{font-size:18px;font-weight:700;color:var(--tx);letter-spacing:-.4px;margin-bottom:3px}
.hist-sub{font-size:12.5px;color:var(--tx3);margin-bottom:16px}
.hist-filters{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
.hf-btn{padding:5px 12px;border-radius:20px;border:1.5px solid var(--bd);background:var(--sf);font-family:var(--font);font-size:12px;font-weight:500;color:var(--tx2);cursor:pointer;transition:all .15s}
.hf-btn:hover{border-color:var(--ac);color:var(--ac)}
.hf-btn.active{background:var(--acl);border-color:var(--ac);color:var(--ac);font-weight:600}
.hist-empty{text-align:center;padding:50px 20px;color:var(--tx3)}
.hist-empty p{font-size:13px;line-height:1.7;margin-top:12px}
.hist-list{display:flex;flex-direction:column;gap:7px}
.hist-card{background:var(--sf);border:1px solid var(--bd2);border-radius:var(--r);padding:13px 14px;display:flex;align-items:center;gap:10px;transition:all .15s}
.hist-card:hover{box-shadow:var(--shm);border-color:var(--bd)}
.hist-left{flex:1;min-width:0}
.hist-name{font-size:13.5px;font-weight:500;color:var(--tx2);text-decoration:line-through;margin-bottom:5px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.hist-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.hist-date{font-size:11px;color:var(--tx3)}
.hist-desc{font-size:11px;color:var(--tx3);font-style:italic;margin-top:3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.undo-btn{padding:4px 10px;border-radius:6px;border:1px solid var(--bd);background:transparent;font-family:var(--font);font-size:11.5px;font-weight:500;color:var(--tx2);cursor:pointer;transition:all .15s;flex-shrink:0}
.undo-btn:hover{border-color:var(--ac);color:var(--ac);background:var(--acl)}

/* ── Mobile bottom nav ── */
.bot-nav{display:none;position:fixed;bottom:0;left:0;right:0;height:var(--bot);background:var(--sf);border-top:1px solid var(--bd);z-index:30;padding:0 8px;align-items:center;justify-content:space-around}
.bot-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px 4px;border-radius:10px;border:none;background:transparent;cursor:pointer;color:var(--tx3);font-family:var(--font);font-size:10px;font-weight:500;transition:all .15s;max-width:80px}
.bot-btn.active{color:var(--ac)}
.bot-btn .bot-icon{font-size:20px;line-height:1}
.bot-badge{background:var(--ac);color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:10px;margin-top:-2px}

/* ── Mobile backlog full screen ── */
.mob-backlog{flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--sf);min-height:0}
.mob-bl-top{padding:20px 16px 0;flex-shrink:0}
.mob-bl-title{font-size:20px;font-weight:700;color:var(--tx);margin-bottom:3px}
.mob-bl-sub{font-size:12px;color:var(--tx3);margin-bottom:14px}

/* ── Mobile calendar (day view) ── */
.mob-cal{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0}
.mob-day-tabs{display:flex;overflow-x:auto;padding:0 12px;gap:6px;flex-shrink:0;background:var(--sf);border-bottom:1px solid var(--bd);padding-bottom:10px;padding-top:10px;-webkit-overflow-scrolling:touch}
.mob-day-tabs::-webkit-scrollbar{display:none}
.mob-day-tab{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;border-radius:10px;border:none;background:transparent;cursor:pointer;font-family:var(--font);flex-shrink:0;transition:all .15s}
.mob-day-tab .dt-n{font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px}
.mob-day-tab .dt-d{font-size:16px;font-weight:600;color:var(--tx);width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%}
.mob-day-tab.active .dt-n{color:var(--ac)}
.mob-day-tab.active .dt-d{background:var(--ac);color:#fff}
.mob-day-tab.today-tab .dt-n{color:var(--ac)}
.mob-day-col{flex:1;overflow-y:auto;position:relative;background:var(--sf)}
.mob-day-col::-webkit-scrollbar{width:3px}
.mob-day-col::-webkit-scrollbar-thumb{background:var(--bd);border-radius:4px}
.mob-grid{display:flex;position:relative;min-height:100%}
.mob-time-col{width:44px;flex-shrink:0;background:var(--bg);border-right:1px solid var(--bd2)}
.mob-col{flex:1;position:relative;min-width:0}

/* ── Overlays ── */
.ov{position:fixed;inset:0;background:rgba(0,0,0,.3);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;z-index:100;animation:fI .15s ease}
@media(min-width:640px){.ov{align-items:center}}
@keyframes fI{from{opacity:0}to{opacity:1}}

/* ── Modals ── */
.modal{background:var(--sf);border-radius:16px 16px 0 0;padding:20px 20px 32px;width:100%;max-width:100%;box-shadow:var(--shl);animation:sUp .2s ease;max-height:92vh;overflow-y:auto}
@media(min-width:640px){.modal{border-radius:14px;padding:22px;width:400px;max-height:90vh}}
@keyframes sUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.detail-modal{background:var(--sf);border-radius:16px 16px 0 0;padding:20px 20px 32px;width:100%;max-width:100%;box-shadow:var(--shl);animation:sUp .2s ease;max-height:92vh;overflow-y:auto}
@media(min-width:640px){.detail-modal{border-radius:14px;padding:24px;width:500px}}
.m-hdr{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;gap:10px}
.m-drag-handle{width:36px;height:4px;border-radius:4px;background:var(--bd);margin:0 auto 16px;flex-shrink:0}
.m-title{font-size:16px;font-weight:700;color:var(--tx);letter-spacing:-.3px}
.m-close{width:26px;height:26px;border:none;background:var(--bg);border-radius:6px;cursor:pointer;color:var(--tx3);font-size:13px;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
.m-close:hover{background:var(--bd);color:var(--tx)}
.fg{margin-bottom:12px}
.fl{display:block;font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--tx3);margin-bottom:5px}
.fi{width:100%;padding:10px 12px;border:1.5px solid var(--bd);border-radius:8px;font-family:var(--font);font-size:15px;color:var(--tx);background:var(--sf);outline:none;transition:border-color .15s}
.fi:focus{border-color:var(--ac)}
.fi::placeholder{color:var(--tx3)}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.fs{width:100%;padding:10px 12px;border:1.5px solid var(--bd);border-radius:8px;font-family:var(--font);font-size:14px;color:var(--tx);background:var(--sf);outline:none;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23A1A1AA' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:30px;transition:border-color .15s}
.fs:focus{border-color:var(--ac)}
.m-acts{display:flex;gap:8px;margin-top:16px}
.btn-c{flex:1;padding:11px;border:1.5px solid var(--bd);background:transparent;border-radius:8px;font-family:var(--font);font-size:14px;font-weight:500;color:var(--tx2);cursor:pointer;transition:all .15s}
.btn-c:hover{background:var(--bg)}
.btn-s{flex:2;padding:11px;background:var(--ac);border:none;border-radius:8px;font-family:var(--font);font-size:14px;font-weight:600;color:#fff;cursor:pointer;transition:all .15s}
.btn-s:hover{background:var(--ach)}
.btn-s:disabled{opacity:.4;cursor:not-allowed}
.divider{height:1px;background:var(--bd2);margin:14px 0}
.detail-name{font-size:17px;font-weight:700;color:var(--tx);letter-spacing:-.3px;margin-bottom:12px;line-height:1.35}
.detail-info{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.detail-info-item{display:flex;align-items:center;gap:4px;padding:5px 10px;border-radius:7px;background:var(--bg);border:1px solid var(--bd2);font-size:12px;color:var(--tx2);font-weight:500}
.detail-section{margin-top:14px}
.detail-section-title{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--tx3);margin-bottom:8px}
.detail-textarea{width:100%;min-height:100px;padding:10px 12px;border:1.5px solid var(--bd);border-radius:8px;font-family:var(--font);font-size:14px;color:var(--tx);background:var(--bg);outline:none;resize:vertical;transition:border-color .15s;line-height:1.6}
.detail-textarea:focus{border-color:var(--ac);background:#fff}
.detail-textarea::placeholder{color:var(--tx3)}
.save-row{display:flex;align-items:center;justify-content:space-between;margin-top:10px;gap:8px}
.save-ok{font-size:12px;color:#22C55E;font-weight:500}
.edit-section{margin-top:14px}

/* ── Responsive ── */
@media(max-width:767px){
  .sidebar{display:none}
  .hdr-nav{display:none}
  .wk-nav{display:none}
  .sync-lbl{display:none}
  .bot-nav{display:flex}
  .body{padding-bottom:var(--bot)}
}
@media(min-width:768px){
  .mob-backlog{display:none}
  .mob-cal{display:none}
  .bot-nav{display:none}
  .hdr-nav{display:flex}
}
`;

// ─── App ──────────────────────────────────────────────────────
export default function App() {
  const [tasks,        setTasks]        = useState([]);
  const [blocks,       setBlocks]       = useState([]);
  const [weekStart,    setWeekStart]    = useState(() => getWeekStart(new Date()));
  const [view,         setView]         = useState("dashboard");
  const [mobView,      setMobView]      = useState("backlog"); // "backlog"|"calendar"|"history"
  const [mobDay,       setMobDay]       = useState(() => { const d=new Date(); return d.getDay()===0?6:d.getDay()-1; });
  const [showModal,    setShowModal]    = useState(false);
  const [detailTaskId, setDetailTaskId] = useState(null);
  const [dragTaskId,   setDragTaskId]   = useState(null);
  const [dragBlockId,  setDragBlockId]  = useState(null);
  const [dropTarget,   setDropTarget]   = useState(null);
  const [syncStatus,   setSyncStatus]   = useState("connecting");
  const [histFilter,   setHistFilter]   = useState("all");

  // Firebase
  useEffect(() => {
    const unsub = onSnapshot(doc(db,"timeblock","data"), (snap) => {
      if (snap.exists()) { const d=snap.data(); setTasks(d.tasks||[]); setBlocks(d.blocks||[]); }
      setSyncStatus("ok");
    }, () => setSyncStatus("error"));
    return () => unsub();
  }, []);

  const save = useCallback(async (t,b) => {
    try { setSyncStatus("saving"); await setDoc(doc(db,"timeblock","data"),{tasks:t,blocks:b}); setSyncStatus("ok"); }
    catch { setSyncStatus("error"); }
  }, []);

  // Task actions
  const addTask = useCallback((t) => {
    const nt={...t,id:`t${Date.now()}`,createdAt:Date.now(),description:""};
    setTasks(p=>{const u=[...p,nt];save(u,blocks);return u;});
  }, [blocks,save]);

  const deleteTask = useCallback((id) => {
    setTasks(p=>{const uT=p.filter(t=>t.id!==id);setBlocks(pB=>{const uB=pB.filter(b=>b.taskId!==id);save(uT,uB);return uB;});return uT;});
  }, [save]);

  const updateTask = useCallback((id, fields) => {
    setTasks(p=>{const u=p.map(t=>t.id===id?{...t,...fields}:t);save(u,blocks);return u;});
  }, [blocks,save]);

  const toggleDone = useCallback((bid) => {
    setBlocks(p=>{
      const blk=p.find(b=>b.id===bid);
      const done=blk?!blk.done:false;
      const u=p.map(b=>b.id===bid?{...b,done,doneAt:done?Date.now():null}:b);
      save(tasks,u);return u;
    });
  }, [tasks,save]);

  const removeBlock = useCallback((bid) => {
    setBlocks(p=>{const u=p.filter(b=>b.id!==bid);save(tasks,u);return u;});
  }, [tasks,save]);

  const undoDone = useCallback((bid) => {
    setBlocks(p=>{const u=p.map(b=>b.id===bid?{...b,done:false,doneAt:null}:b);save(tasks,u);return u;});
  }, [tasks,save]);

  const scheduleTask = useCallback((taskId,dayIdx,startH,wkOff) => {
    setBlocks(p=>{
      const clean=p.filter(b=>!(b.taskId===taskId&&b.wkOff===wkOff&&b.dayIdx===dayIdx));
      const u=[...clean,{id:`b${Date.now()}`,taskId,dayIdx,startH,wkOff,done:false,doneAt:null}];
      save(tasks,u);return u;
    });
  }, [tasks,save]);

  // Week helpers
  const today    = new Date();
  const wkOff    = Math.round((weekStart-getWeekStart(today))/(7*86400000));
  const weekDays = Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return d;});
  const hours    = Array.from({length:END_HOUR-START_HOUR},(_,i)=>START_HOUR+i);

  // ── Sidebar: task leaves once it has a block this week (recurring too) ──
  const scheduledIdsThisWeek = new Set(blocks.filter(b=>b.wkOff===wkOff).map(b=>b.taskId));
  const sidebarTasks = tasks.filter(t => !scheduledIdsThisWeek.has(t.id));

  const getBlocksForDay = (dayIdx) => {
    const manual   = blocks.filter(b=>b.wkOff===wkOff&&b.dayIdx===dayIdx);
    const manualIds= new Set(manual.map(b=>b.taskId));
    const recurring= [];
    tasks.forEach(task=>{
      if (!task.recurrence||task.recurrence==="none") return;
      if (manualIds.has(task.id)) return;
      // Only show recurring virtual blocks if NOT already scheduled manually this week
      if (scheduledIdsThisWeek.has(task.id)) return;
      const days=getRecurringDays(task.recurrence);
      if (task.recurrence==="weekly") {
        const orig=blocks.find(b=>b.taskId===task.id);
        if (orig&&orig.dayIdx===dayIdx) recurring.push({...orig,id:`rec_${task.id}_${dayIdx}`,wkOff,dayIdx,isRecurring:true});
      } else if (days&&days.includes(dayIdx)) {
        const orig=blocks.find(b=>b.taskId===task.id);
        recurring.push({id:`rec_${task.id}_${dayIdx}`,taskId:task.id,dayIdx,startH:orig?.startH??9,wkOff,done:false,isRecurring:true});
      }
    });
    return [...manual,...recurring];
  };

  // History
  const doneBlocks   = blocks.filter(b=>b.done&&b.doneAt);
  const histFiltered = doneBlocks
    .filter(b=>histFilter==="all"||tasks.find(t=>t.id===b.taskId)?.priority===histFilter)
    .sort((a,b)=>(b.doneAt||0)-(a.doneAt||0));

  // DnD
  const onDragTask  = (e,id) => {setDragTaskId(id);setDragBlockId(null);e.dataTransfer.effectAllowed="move";};
  const onDragBlock = (e,id) => {setDragBlockId(id);setDragTaskId(null);e.dataTransfer.effectAllowed="move";};
  const onDragEnd   = () => {setDragTaskId(null);setDragBlockId(null);setDropTarget(null);};
  const onDragOver  = (e,dayIdx,h) => {e.preventDefault();setDropTarget({dayIdx,h});};
  const onDrop = (e,dayIdx,h) => {
    e.preventDefault();setDropTarget(null);
    const startH=h+((e.clientY-e.currentTarget.getBoundingClientRect().top)/HOUR_HEIGHT<0.5?0:0.5);
    if (dragTaskId){scheduleTask(dragTaskId,dayIdx,startH,wkOff);setDragTaskId(null);}
    else if (dragBlockId){
      const blk=blocks.find(b=>b.id===dragBlockId);
      if(blk){setBlocks(p=>{const c=p.filter(b=>b.id!==dragBlockId);const u=[...c,{...blk,id:`b${Date.now()}`,dayIdx,startH,wkOff}];save(tasks,u);return u;});}
      setDragBlockId(null);
    }
  };

  const cntP       = p=>sidebarTasks.filter(t=>t.priority===p).length;
  const syncLabel  = {connecting:"⏳",saving:"💾",ok:"☁ sync",error:"⚠"};
  const detailTask = tasks.find(t=>t.id===detailTaskId);

  // Shared task list renderer
  const renderTaskList = (list, showDragTip=true) => list.length===0 ? (
    <div className="empty">
      <svg width="44" height="44" fill="none" viewBox="0 0 44 44">
        <rect x="6" y="11" width="32" height="26" rx="4" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M14 22h16M14 28h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="35" cy="10" r="7" fill="#22C55E"/>
        <path d="M32 10l2.2 2.2 3.6-3.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <p>Todas as tarefas<br/>estão agendadas! 🎉</p>
    </div>
  ) : (
    <>
      {list.map(t=>(
        <div key={t.id} className={`tc${dragTaskId===t.id?" drag":""}`} draggable
          onDragStart={e=>onDragTask(e,t.id)} onDragEnd={onDragEnd}>
          <div className="tc-row">
            <span className="tc-name" onClick={e=>{e.stopPropagation();setDetailTaskId(t.id);}}>{t.name}</span>
            <button className="tc-del" onClick={e=>{e.stopPropagation();deleteTask(t.id);}}>✕</button>
          </div>
          <div className="tc-meta">
            <span className="pb" style={{background:PC[t.priority].light,color:PC[t.priority].text}}>
              <span className="pd" style={{background:PC[t.priority].color}}/>{PC[t.priority].label}
            </span>
            <span className="db">⏱ {fmtDur(t.duration)}</span>
            {t.recurrence&&t.recurrence!=="none"&&<span className="rec-badge">↻ {RECURRENCE_LABELS[t.recurrence]}</span>}
            {t.description&&<span className="desc-dot" title="Tem descrição"/>}
          </div>
        </div>
      ))}
      {showDragTip && <div className="drag-tip">Arraste uma tarefa para o calendário →</div>}
    </>
  );

  // Calendar column renderer
  const renderDayCol = (dayIdx, colKey) => {
    const dayBlocks = getBlocksForDay(dayIdx);
    const dateObj   = weekDays[dayIdx];
    const isT       = dateObj.toDateString()===today.toDateString();
    const nowMin    = isT?(today.getHours()-START_HOUR)*60+today.getMinutes():null;
    const nowTop    = nowMin!==null&&nowMin>=0?(nowMin/60)*HOUR_HEIGHT:null;
    return (
      <div key={colKey} className="day-col">
        {nowTop!==null&&<div className="now-line" style={{top:nowTop}}/>}
        {hours.map(h=>{
          const isDrop=dropTarget?.dayIdx===dayIdx&&dropTarget?.h===h;
          return <div key={h} className={`hs${isDrop?" drop":""}`} style={{height:HOUR_HEIGHT}}
            onDragOver={e=>onDragOver(e,dayIdx,h)} onDrop={e=>onDrop(e,dayIdx,h)}
            onDragLeave={()=>setDropTarget(null)}/>;
        })}
        {dayBlocks.map(blk=>{
          const task=tasks.find(t=>t.id===blk.taskId);
          if(!task) return null;
          const top=   (blk.startH-START_HOUR)*HOUR_HEIGHT;
          const height=Math.max((task.duration/60)*HOUR_HEIGHT,26);
          const p=     PC[task.priority];
          return (
            <div key={blk.id} className={`cb${blk.done?" done":""}${blk.isRecurring?" recurring":""}`}
              draggable={!blk.isRecurring}
              onDragStart={!blk.isRecurring?e=>onDragBlock(e,blk.id):undefined}
              onDragEnd={onDragEnd}
              onClick={()=>setDetailTaskId(task.id)}
              style={{top,height,background:p.bg,borderLeft:`3px solid ${p.color}`,color:p.text}}>
              <div className="cb-top">
                <span className="cb-name">{task.name}</span>
                <div className="cb-acts" onClick={e=>e.stopPropagation()}>
                  <button className="cb-btn" onClick={()=>toggleDone(blk.id)}>{blk.done?"↩":"✓"}</button>
                  {!blk.isRecurring&&<button className="cb-btn" onClick={()=>removeBlock(blk.id)}>✕</button>}
                </div>
              </div>
              {height>34&&<div className="cb-time">{fmtH(blk.startH)} – {fmtH(blk.startH+task.duration/60)}</div>}
              {height>50&&task.recurrence&&task.recurrence!=="none"&&<div className="cb-rec">↻ {RECURRENCE_LABELS[task.recurrence]}</div>}
            </div>
          );
        })}
      </div>
    );
  };

  // History view
  const historyView = (
    <div className="hist-wrap">
      <div className="hist-title">Tarefas Concluídas</div>
      <div className="hist-sub">{doneBlocks.length} tarefa{doneBlocks.length!==1?"s":""} concluída{doneBlocks.length!==1?"s":""}</div>
      <div className="hist-filters">
        {[{k:"all",l:"Todas"},{k:"high",l:"🔴 Alta"},{k:"medium",l:"🟡 Média"},{k:"low",l:"🟢 Baixa"}].map(f=>(
          <button key={f.k} className={`hf-btn${histFilter===f.k?" active":""}`} onClick={()=>setHistFilter(f.k)}>{f.l}</button>
        ))}
      </div>
      {histFiltered.length===0 ? (
        <div className="hist-empty">
          <svg width="52" height="52" fill="none" viewBox="0 0 52 52">
            <rect x="8" y="13" width="36" height="30" rx="4" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M18 28h16M18 34h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="40" cy="12" r="8" fill="#E4E4E7"/>
            <path d="M37 12l2.5 2.5 4.5-4.5" stroke="#A1A1AA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p>Nenhuma tarefa concluída.<br/>Marque ✓ no calendário!</p>
        </div>
      ) : (
        <div className="hist-list">
          {histFiltered.map(blk=>{
            const task=tasks.find(t=>t.id===blk.taskId);
            if(!task) return null;
            const p=PC[task.priority];
            const dd=blk.doneAt?new Date(blk.doneAt):null;
            return (
              <div key={blk.id} className="hist-card">
                <div style={{width:4,alignSelf:"stretch",borderRadius:4,background:p.color,flexShrink:0}}/>
                <div className="hist-left">
                  <div className="hist-name">{task.name}</div>
                  <div className="hist-meta">
                    <span className="pb" style={{background:p.light,color:p.text,fontSize:10}}>
                      <span className="pd" style={{background:p.color}}/>{p.label}
                    </span>
                    <span className="db" style={{fontSize:10}}>⏱ {fmtDur(task.duration)}</span>
                    {dd&&<span className="hist-date">✓ {fmtDateFull(dd)} · {dd.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span>}
                    {blk.dayIdx!==undefined&&<span className="hist-date">· {DAYS_FULL[blk.dayIdx]}</span>}
                  </div>
                  {task.description&&<div className="hist-desc">"{task.description}"</div>}
                </div>
                <button className="undo-btn" onClick={()=>undoDone(blk.id)}>↩ Desfazer</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* ── Header ── */}
        <header className="hdr">
          <div className="logo">
            <div className="logo-ic">
              <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
                <rect x="1" y="3" width="12" height="10" rx="2" stroke="#fff" strokeWidth="1.4"/>
                <path d="M4 1.5v3M10 1.5v3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
                <rect x="2.5" y="6.5" width="3" height="2" rx=".5" fill="#fff"/>
                <rect x="8.5" y="6.5" width="3" height="2" rx=".5" fill="rgba(255,255,255,.45)"/>
              </svg>
            </div>
            <span className="logo-tx">Time<em>Block</em></span>
          </div>

          {/* Desktop nav */}
          <div className="hdr-nav">
            <button className={`nav-btn${view==="dashboard"?" active":""}`} onClick={()=>setView("dashboard")}>📅 Semana</button>
            <button className={`nav-btn${view==="history"?" active":""}`} onClick={()=>setView("history")}>
              ✅ Concluídas{doneBlocks.length>0?` (${doneBlocks.length})`:""}
            </button>
          </div>

          {view==="dashboard" && (
            <div className="wk-nav">
              <button className="ib" onClick={()=>{const d=new Date(weekStart);d.setDate(d.getDate()-7);setWeekStart(d);}}>‹</button>
              <button className="ib today-b" onClick={()=>setWeekStart(getWeekStart(today))}>Hoje</button>
              <span className="wk-lbl">{fmtDate(weekDays[0])} – {fmtDate(weekDays[6])}</span>
              <button className="ib" onClick={()=>{const d=new Date(weekStart);d.setDate(d.getDate()+7);setWeekStart(d);}}>›</button>
            </div>
          )}

          <span className="sync-lbl">{syncLabel[syncStatus]}</span>
        </header>

        {/* ── Desktop body ── */}
        <div className="body">

          {/* Desktop dashboard */}
          {view==="dashboard" && <>
            <aside className="sidebar">
              <div className="sb-top">
                <div className="sb-title">Backlog</div>
                <div className="sb-sub">{sidebarTasks.length===0?"Nenhuma tarefa pendente":`${sidebarTasks.length} tarefa${sidebarTasks.length>1?"s":""} para agendar`}</div>
                <button className="new-btn" onClick={()=>setShowModal(true)}>
                  <svg width="11" height="11" fill="none" viewBox="0 0 11 11"><path d="M5.5 1v9M1 5.5h9" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
                  Nova Tarefa
                </button>
              </div>
              <div className="sb-counts">
                {Object.entries(PC).map(([k,p])=>(
                  <div key={k} className="cnt-c" style={{background:p.light,color:p.text,borderColor:p.bg}}>
                    <div className="cnt-dot" style={{background:p.color}}/>{cntP(k)} {p.label}
                  </div>
                ))}
              </div>
              <div className="task-list">{renderTaskList(sidebarTasks)}</div>
            </aside>

            <div className="cal-wrap">
              <div className="cal-hdr">
                <div className="tg"/>
                {weekDays.map((d,i)=>{
                  const isT=d.toDateString()===today.toDateString();
                  return (
                    <div key={i} className={`dh${isT?" today":""}`}>
                      <div className="dh-n">{DAYS_PT[i]}</div>
                      <div className="dh-d">{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              <div className="cal-scroll">
                <div className="cal-grid">
                  <div className="tc-col">{hours.map(h=><div key={h} className="t-lbl" style={{height:HOUR_HEIGHT}}>{fmtH(h)}</div>)}</div>
                  {weekDays.map((_,dayIdx)=>renderDayCol(dayIdx,dayIdx))}
                </div>
              </div>
            </div>
          </>}

          {/* Desktop history */}
          {view==="history" && historyView}

          {/* ── Mobile: Backlog ── */}
          {mobView==="backlog" && (
            <div className="mob-backlog">
              <div className="mob-bl-top">
                <div className="mob-bl-title">Backlog</div>
                <div className="mob-bl-sub">{sidebarTasks.length===0?"Nenhuma tarefa pendente":`${sidebarTasks.length} tarefa${sidebarTasks.length>1?"s":""} para agendar`}</div>
                <button className="new-btn" onClick={()=>setShowModal(true)}>
                  <svg width="11" height="11" fill="none" viewBox="0 0 11 11"><path d="M5.5 1v9M1 5.5h9" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
                  Nova Tarefa
                </button>
                <div className="sb-counts" style={{padding:"0 0 12px"}}>
                  {Object.entries(PC).map(([k,p])=>(
                    <div key={k} className="cnt-c" style={{background:p.light,color:p.text,borderColor:p.bg}}>
                      <div className="cnt-dot" style={{background:p.color}}/>{cntP(k)} {p.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="task-list">{renderTaskList(sidebarTasks,false)}</div>
            </div>
          )}

          {/* ── Mobile: Calendar ── */}
          {mobView==="calendar" && (
            <div className="mob-cal">
              <div className="mob-day-tabs">
                {weekDays.map((d,i)=>{
                  const isT=d.toDateString()===today.toDateString();
                  return (
                    <button key={i} className={`mob-day-tab${mobDay===i?" active":""}${isT?" today-tab":""}`} onClick={()=>setMobDay(i)}>
                      <span className="dt-n">{DAYS_PT[i]}</span>
                      <span className="dt-d">{d.getDate()}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mob-day-col">
                <div className="mob-grid">
                  <div className="mob-time-col">{hours.map(h=><div key={h} className="t-lbl" style={{height:HOUR_HEIGHT}}>{fmtH(h)}</div>)}</div>
                  {renderDayCol(mobDay,"mob")}
                </div>
              </div>
            </div>
          )}

          {/* ── Mobile: History ── */}
          {mobView==="history" && historyView}
        </div>

        {/* ── Mobile bottom nav ── */}
        <nav className="bot-nav">
          <button className={`bot-btn${mobView==="backlog"?" active":""}`} onClick={()=>setMobView("backlog")}>
            <span className="bot-icon">📋</span>Backlog
          </button>
          <button className={`bot-btn${mobView==="calendar"?" active":""}`} onClick={()=>setMobView("calendar")}>
            <span className="bot-icon">📅</span>Semana
          </button>
          <button className={`bot-btn${mobView==="history"?" active":""}`} onClick={()=>setMobView("history")}>
            <span className="bot-icon">✅</span>
            {doneBlocks.length>0&&<span className="bot-badge">{doneBlocks.length}</span>}
            Concluídas
          </button>
        </nav>
      </div>

      {showModal && <NewTaskModal onClose={()=>setShowModal(false)} onAdd={addTask}/>}
      {detailTask && <DetailModal task={detailTask} onClose={()=>setDetailTaskId(null)} onUpdate={updateTask}/>}
    </>
  );
}

// ─── Detail Modal (with editing) ─────────────────────────────
function DetailModal({task, onClose, onUpdate}) {
  const [desc,       setDesc]       = useState(task.description||"");
  const [priority,   setPriority]   = useState(task.priority);
  const [duration,   setDuration]   = useState(task.duration);
  const [recurrence, setRecurrence] = useState(task.recurrence||"none");
  const [saved,      setSaved]      = useState(false);
  const p = PC[priority];

  const handleSave = () => {
    onUpdate(task.id,{description:desc,priority,duration,recurrence});
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };

  return (
    <div className="ov" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="detail-modal">
        <div className="m-drag-handle"/>
        <div className="m-hdr">
          <div style={{flex:1}}>
            <div className="detail-name">{task.name}</div>
            <div className="detail-info">
              <div className="detail-info-item" style={{color:p.text,background:p.light}}>
                <span className="pd" style={{background:p.color,width:6,height:6}}/>{p.label}
              </div>
              <div className="detail-info-item">⏱ {fmtDur(duration)}</div>
              {recurrence&&recurrence!=="none"&&<div className="detail-info-item">↻ {RECURRENCE_LABELS[recurrence]}</div>}
            </div>
          </div>
          <button className="m-close" onClick={onClose}>✕</button>
        </div>

        <div className="divider"/>

        {/* Edit fields */}
        <div className="edit-section">
          <div className="detail-section-title">✏️ Editar tarefa</div>
          <div className="row2">
            <div>
              <label className="fl">⏱ Duração</label>
              <select className="fs" value={duration} onChange={e=>setDuration(Number(e.target.value))}>
                {DURATION_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="fl">⚑ Prioridade</label>
              <select className="fs" value={priority} onChange={e=>setPriority(e.target.value)}>
                <option value="high">🔴 Alta</option>
                <option value="medium">🟡 Média</option>
                <option value="low">🟢 Baixa</option>
              </select>
            </div>
          </div>
          <div className="fg">
            <label className="fl">↻ Recorrência</label>
            <select className="fs" value={recurrence} onChange={e=>setRecurrence(e.target.value)}>
              {RECURRENCE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="divider"/>

        {/* Description */}
        <div className="detail-section">
          <div className="detail-section-title">📝 Descrição / Anotações</div>
          <textarea className="detail-textarea"
            placeholder="Adicione anotações, links ou qualquer contexto sobre essa tarefa..."
            value={desc} onChange={e=>setDesc(e.target.value)}/>
        </div>

        <div className="save-row">
          {saved&&<span className="save-ok">✓ Salvo!</span>}
          <button className="btn-s" style={{flex:"none",padding:"10px 24px"}} onClick={handleSave}>
            Salvar alterações
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Task Modal ───────────────────────────────────────────
function NewTaskModal({onClose,onAdd}) {
  const [name,       setName]       = useState("");
  const [duration,   setDuration]   = useState(60);
  const [priority,   setPriority]   = useState("medium");
  const [recurrence, setRecurrence] = useState("none");

  const submit = () => {if(!name.trim()) return;onAdd({name:name.trim(),duration,priority,recurrence});onClose();};

  return (
    <div className="ov" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="m-drag-handle"/>
        <div className="m-hdr">
          <div className="m-title">Nova Tarefa</div>
          <button className="m-close" onClick={onClose}>✕</button>
        </div>
        <div className="fg">
          <label className="fl">Nome da tarefa</label>
          <input className="fi" type="text" autoFocus placeholder="Ex: Revisar relatório mensal"
            value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>
        <div className="row2">
          <div>
            <label className="fl">⏱ Duração</label>
            <select className="fs" value={duration} onChange={e=>setDuration(Number(e.target.value))}>
              {DURATION_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="fl">⚑ Prioridade</label>
            <select className="fs" value={priority} onChange={e=>setPriority(e.target.value)}>
              <option value="high">🔴 Alta</option>
              <option value="medium">🟡 Média</option>
              <option value="low">🟢 Baixa</option>
            </select>
          </div>
        </div>
        <div className="fg">
          <label className="fl">↻ Recorrência</label>
          <select className="fs" value={recurrence} onChange={e=>setRecurrence(e.target.value)}>
            {RECURRENCE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="m-acts">
          <button className="btn-c" onClick={onClose}>Cancelar</button>
          <button className="btn-s" onClick={submit} disabled={!name.trim()}>Adicionar Tarefa</button>
        </div>
      </div>
    </div>
  );
}
