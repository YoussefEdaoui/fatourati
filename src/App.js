import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

/* ─── STYLES ─────────────────────────────────────────────────────────────── */
const GS = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;font-family:'Cairo',sans-serif}
    body{background:#f0ede8}
    ::-webkit-scrollbar{width:5px}
    ::-webkit-scrollbar-thumb{background:#0d6e6e44;border-radius:10px}
    @media print{
      .no-print{display:none!important}
      .print-only{display:block!important}
      body{background:white}
    }
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  `}</style>
);

const C = {
  teal:"#0d6e6e",tealL:"#1a9898",tealXL:"#e8f5f5",
  gold:"#c9a84c",goldL:"#f0d080",goldXL:"#fdf8ed",
  ink:"#0f1923",inkM:"#3d4f5c",muted:"#8a9aaa",
  cream:"#faf7f2",white:"#ffffff",
  border:"#e5e0d8",borderL:"#f0ece6",
  green:"#16a34a",greenXL:"#f0fdf4",
  red:"#dc2626",redXL:"#fef2f2",
};

const calc = (items,tva) => {
  const sub = items.reduce((s,i)=>s+(i.qty*i.price),0);
  const t = sub*tva/100;
  return {sub,tva:t,total:sub+t};
};
const fmt = n => n.toLocaleString("ar-MA")+" درهم";

const STATUS = {
  draft:{label:"مسودة",bg:C.borderL,color:C.inkM},
  sent:{label:"مرسلة",bg:"#dbeafe",color:"#1d4ed8"},
  paid:{label:"مدفوعة",bg:C.greenXL,color:C.green},
  overdue:{label:"متأخرة",bg:C.redXL,color:C.red},
};

/* ─── PRIMITIVES ─────────────────────────────────────────────────────────── */
const Badge = ({s}) => {
  const st = STATUS[s]||STATUS.draft;
  return <span style={{background:st.bg,color:st.color,padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:700}}>{st.label}</span>;
};

const Btn = ({children,onClick,variant="primary",small,style={},loading,disabled,...p}) => {
  const base = {border:"none",cursor:disabled||loading?"not-allowed":"pointer",fontFamily:"Cairo",
    fontWeight:700,borderRadius:10,transition:"all .18s",opacity:disabled||loading?.7:1,
    padding:small?"6px 14px":"10px 22px",fontSize:small?13:15,display:"inline-flex",
    alignItems:"center",gap:6};
  const V = {
    primary:{background:C.teal,color:"#fff",boxShadow:`0 4px 14px ${C.teal}44`},
    secondary:{background:"transparent",color:C.teal,border:`2px solid ${C.teal}`},
    gold:{background:C.gold,color:C.ink},
    ghost:{background:C.cream,color:C.inkM,border:`1px solid ${C.border}`},
    danger:{background:C.red,color:"#fff"},
    green:{background:C.green,color:"#fff"},
    whatsapp:{background:"#25D366",color:"#fff",boxShadow:"0 4px 14px #25D36644"},
  };
  return (
    <button onClick={onClick} disabled={disabled||loading} style={{...base,...V[variant],...style}} {...p}>
      {loading && <span style={{width:14,height:14,border:"2px solid rgba(255,255,255,.4)",
        borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block"}}/>}
      {children}
    </button>
  );
};

const Input = ({label,value,onChange,type="text",placeholder,req,style={}}) => (
  <div style={{marginBottom:14}}>
    {label&&<label style={{display:"block",fontSize:13,fontWeight:700,color:C.inkM,marginBottom:5}}>
      {label}{req&&<span style={{color:C.red}}> *</span>}
    </label>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{width:"100%",padding:"9px 13px",border:`1.5px solid ${C.border}`,borderRadius:9,
        fontSize:14,color:C.ink,background:C.white,outline:"none",fontFamily:"Cairo",...style}}/>
  </div>
);

const Sel = ({label,value,onChange,options}) => (
  <div style={{marginBottom:14}}>
    {label&&<label style={{display:"block",fontSize:13,fontWeight:700,color:C.inkM,marginBottom:5}}>{label}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{width:"100%",padding:"9px 13px",border:`1.5px solid ${C.border}`,borderRadius:9,
        fontSize:14,color:C.ink,background:C.white,outline:"none",fontFamily:"Cairo",cursor:"pointer"}}>
      {options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  </div>
);

const Card = ({children,style={}}) => (
  <div style={{background:C.white,borderRadius:16,border:`1px solid ${C.border}`,padding:22,...style}}>
    {children}
  </div>
);

const Modal = ({children,onClose,title,wide}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(15,25,35,.6)",zIndex:300,
    display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(6px)"}}
    onClick={onClose}>
    <div onClick={e=>e.stopPropagation()}
      style={{background:C.white,borderRadius:20,width:"100%",maxWidth:wide?920:560,
        maxHeight:"92vh",overflowY:"auto",padding:30,position:"relative",
        boxShadow:"0 28px 80px rgba(15,25,35,.22)",animation:"fadeIn .2s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <h2 style={{fontSize:19,fontWeight:900,color:C.ink}}>{title}</h2>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.muted}}>×</button>
      </div>
      {children}
    </div>
  </div>
);

const Toast = ({msg,type}) => (
  <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",
    background:type==="success"?C.green:type==="info"?"#1d4ed8":C.red,
    color:"#fff",padding:"11px 22px",borderRadius:12,fontSize:14,fontWeight:700,
    boxShadow:"0 8px 24px rgba(0,0,0,.2)",zIndex:999,animation:"fadeIn .2s ease",whiteSpace:"nowrap"}}>
    {type==="success"?"✓":type==="info"?"ℹ":"✗"} {msg}
  </div>
);

const Spinner = () => (
  <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:60}}>
    <div style={{width:36,height:36,border:`3px solid ${C.tealXL}`,borderTopColor:C.teal,
      borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
  </div>
);

/* ─── INVOICE DOCUMENT ────────────────────────────────────────────────────── */
const InvoiceDoc = ({inv,biz}) => {
  const {sub,tva,total} = calc(inv.items,inv.tvaRate);
  return (
    <div id="inv-doc" style={{fontFamily:"Cairo",padding:44,background:"#fff",direction:"rtl",minWidth:600}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",
        borderBottom:`3px solid ${C.teal}`,paddingBottom:22,marginBottom:22}}>
        <div>
          <div style={{fontSize:24,fontWeight:900,color:C.teal}}>{biz.name||"اسم الشركة"}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:3}}>{biz.address}</div>
          {biz.ice&&<div style={{fontSize:12,color:C.muted}}>ICE: {biz.ice}</div>}
          {biz.rc&&<div style={{fontSize:12,color:C.muted}}>RC: {biz.rc}</div>}
          <div style={{fontSize:12,color:C.muted}}>{biz.phone} — {biz.email}</div>
        </div>
        <div style={{textAlign:"left"}}>
          <div style={{fontSize:28,fontWeight:900,color:C.ink}}>فاتورة</div>
          <div style={{fontSize:16,fontWeight:800,color:C.teal}}>#{inv.num}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:6}}>تاريخ: {inv.date}</div>
          <div style={{fontSize:12,color:C.muted}}>الاستحقاق: {inv.due}</div>
        </div>
      </div>
      <div style={{background:C.tealXL,borderRadius:10,padding:"14px 18px",marginBottom:22}}>
        <div style={{fontSize:11,fontWeight:800,color:C.teal,marginBottom:3}}>فاتورة إلى</div>
        <div style={{fontSize:15,fontWeight:800}}>{inv.clientName}</div>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",marginBottom:22}}>
        <thead>
          <tr style={{background:C.ink,color:"#fff"}}>
            {["الخدمة / المنتج","الكمية","السعر الوحدوي","المجموع"].map(h=>(
              <th key={h} style={{padding:"9px 13px",textAlign:"right",fontSize:12}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it,i)=>(
            <tr key={i} style={{background:i%2?C.cream:C.white}}>
              <td style={{padding:"9px 13px",fontSize:13}}>{it.desc}</td>
              <td style={{padding:"9px 13px",fontSize:13,textAlign:"center"}}>{it.qty}</td>
              <td style={{padding:"9px 13px",fontSize:13}}>{it.price.toLocaleString()} درهم</td>
              <td style={{padding:"9px 13px",fontSize:13,fontWeight:700}}>{(it.qty*it.price).toLocaleString()} درهم</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <div style={{width:280}}>
          {[["المجموع الجزئي",fmt(sub)],[`TVA (${inv.tvaRate}%)`,fmt(tva)]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",
              padding:"5px 0",borderBottom:`1px solid ${C.border}`,fontSize:13}}>
              <span style={{color:C.muted}}>{k}</span>
              <span style={{fontWeight:700}}>{v}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"11px 14px",
            background:C.teal,color:"#fff",borderRadius:9,marginTop:9,fontSize:15,fontWeight:900}}>
            <span>المجموع الكلي</span><span>{fmt(total)}</span>
          </div>
        </div>
      </div>
      {inv.notes&&<div style={{marginTop:22,padding:14,background:C.goldXL,borderRadius:9,fontSize:12,color:C.inkM}}>
        <strong>ملاحظات: </strong>{inv.notes}
      </div>}
      {biz.rib&&<div style={{marginTop:14,padding:14,background:C.cream,borderRadius:9,fontSize:12,color:C.inkM,border:`1px dashed ${C.border}`}}>
        <strong>معلومات الدفع — </strong>RIB: {biz.rib} | {biz.bank}
      </div>}
      <div style={{marginTop:28,textAlign:"center",fontSize:11,color:C.muted,
        borderTop:`1px solid ${C.border}`,paddingTop:14}}>
        شكراً لثقتكم — {biz.name} — {biz.phone} — تم الإنشاء بواسطة فاتوراتي
      </div>
    </div>
  );
};

/* ─── PDF + WHATSAPP ACTIONS ─────────────────────────────────────────────── */
const useInvoiceActions = (biz) => {
  const [loading, setLoading] = useState({pdf:false,wa:false});
  const [toast, setToast] = useState(null);
  const showToast = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  const downloadPDF = async (inv) => {
    setLoading(l=>({...l,pdf:true}));
    try {
      const {sub,tva,total} = calc(inv.items,inv.tvaRate);
      const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>فاتورة #${inv.num}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box;font-family:'Cairo',sans-serif}body{padding:40px;background:#fff;color:#0f1923}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0d6e6e;padding-bottom:20px;margin-bottom:20px}
.logo{font-size:22px;font-weight:900;color:#0d6e6e}.meta{text-align:left}.meta h1{font-size:26px;font-weight:900}
.meta .num{color:#0d6e6e;font-size:15px;font-weight:800}.meta p{font-size:11px;color:#8a9aaa;margin-top:4px}
.biz-info{font-size:11px;color:#8a9aaa;margin-top:3px}
.client-box{background:#e8f5f5;border-radius:8px;padding:12px 16px;margin-bottom:20px}
.client-box small{font-size:10px;font-weight:800;color:#0d6e6e}.client-box p{font-size:14px;font-weight:800}
table{width:100%;border-collapse:collapse;margin-bottom:20px}thead tr{background:#0f1923;color:#fff}
th,td{padding:8px 12px;text-align:right;font-size:12px}tbody tr:nth-child(even){background:#faf7f2}
.totals{display:flex;justify-content:flex-end}.totals-box{width:260px}
.totals-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #e5e0d8;font-size:12px}
.totals-row .label{color:#8a9aaa}
.total-final{display:flex;justify-content:space-between;padding:10px 14px;background:#0d6e6e;color:#fff;border-radius:8px;margin-top:8px;font-size:14px;font-weight:900}
.footer{margin-top:28px;text-align:center;font-size:10px;color:#8a9aaa;border-top:1px solid #e5e0d8;padding-top:12px}
</style></head><body>
<div class="header"><div><div class="logo">${biz.name||"اسم الشركة"}</div>
${biz.ice?`<div class="biz-info">ICE: ${biz.ice}</div>`:""}
<div class="biz-info">${biz.phone||""} ${biz.email?`— ${biz.email}`:""}</div></div>
<div class="meta"><h1>فاتورة</h1><div class="num">#${inv.num}</div><p>تاريخ: ${inv.date}</p><p>الاستحقاق: ${inv.due}</p></div></div>
<div class="client-box"><small>فاتورة إلى</small><p>${inv.clientName}</p></div>
<table><thead><tr><th>الخدمة / المنتج</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr></thead>
<tbody>${inv.items.map((it,i)=>`<tr><td>${it.desc}</td><td style="text-align:center">${it.qty}</td><td>${it.price.toLocaleString()} درهم</td><td style="font-weight:700">${(it.qty*it.price).toLocaleString()} درهم</td></tr>`).join("")}</tbody></table>
<div class="totals"><div class="totals-box">
<div class="totals-row"><span class="label">المجموع الجزئي</span><span style="font-weight:700">${fmt(sub)}</span></div>
<div class="totals-row"><span class="label">TVA (${inv.tvaRate}%)</span><span style="font-weight:700">${fmt(tva)}</span></div>
<div class="total-final"><span>المجموع الكلي</span><span>${fmt(total)}</span></div></div></div>
${inv.notes?`<div style="margin-top:16px;padding:12px;background:#fdf8ed;border-radius:8px;font-size:11px"><strong>ملاحظات: </strong>${inv.notes}</div>`:""}
<div class="footer">شكراً لثقتكم — ${biz.name||""} — تم الإنشاء بواسطة فاتوراتي</div></body></html>`;
      const win = window.open("","_blank","width=800,height=900");
      if(!win){showToast("يرجى السماح بالنوافذ المنبثقة","info");setLoading(l=>({...l,pdf:false}));return;}
      win.document.write(html); win.document.close();
      win.onload = () => { setTimeout(()=>{ win.focus(); win.print(); },800); };
      showToast("تم فتح الفاتورة — اختر 'حفظ كـ PDF'");
    } catch(e){ showToast("حدث خطأ أثناء إنشاء PDF","error"); }
    setLoading(l=>({...l,pdf:false}));
  };

  const sendWhatsApp = (inv, clientPhone) => {
    setLoading(l=>({...l,wa:true}));
    const {total} = calc(inv.items,inv.tvaRate);
    const phone = (clientPhone||"").replace(/\D/g,"");
    const intlPhone = phone.startsWith("0") ? "212"+phone.slice(1) : phone;
    const msg = encodeURIComponent(`السلام عليكم 👋\n\nنرسل إليكم فاتورتكم رقم *#${inv.num}*\n\n📋 *تفاصيل الفاتورة:*\n${inv.items.map(it=>`• ${it.desc}: ${(it.qty*it.price).toLocaleString()} درهم`).join("\n")}\n\n💰 *المجموع الكلي: ${fmt(total)}*\n📅 تاريخ الاستحقاق: ${inv.due}\n\nشكراً لتعاملكم معنا 🙏\n${biz.name||""}\n${biz.phone||""}`);
    const url = intlPhone ? `https://wa.me/${intlPhone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(url,"_blank");
    showToast("تم فتح واتساب مع رسالة الفاتورة ✓","success");
    setTimeout(()=>setLoading(l=>({...l,wa:false})),1000);
  };

  return {downloadPDF, sendWhatsApp, loading, toast};
};

/* ─── INVOICE VIEW MODAL ─────────────────────────────────────────────────── */
const InvoiceViewModal = ({inv,biz,clients,onClose,onStatusChange,onDelete}) => {
  const {downloadPDF,sendWhatsApp,loading,toast} = useInvoiceActions(biz);
  const client = clients.find(c=>c.id===inv.client_id);
  return (
    <Modal onClose={onClose} title={`فاتورة رقم #${inv.num}`} wide>
      {toast&&<Toast {...toast}/>}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",
        padding:"14px 16px",background:C.cream,borderRadius:12,border:`1px solid ${C.border}`}}>
        <Btn variant="primary" loading={loading.pdf} onClick={()=>downloadPDF(inv)}>📥 تحميل PDF</Btn>
        <Btn variant="whatsapp" loading={loading.wa} onClick={()=>sendWhatsApp(inv, client?.phone)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.374 0 0 5.373 0 12c0 2.117.554 4.103 1.523 5.826L.057 23.986l6.305-1.544A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.641-.52-5.148-1.424l-.367-.218-3.813.934.975-3.718-.24-.381A9.959 9.959 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
          إرسال واتساب
        </Btn>
        <Sel value={inv.status} onChange={v=>onStatusChange(inv.id,v)}
          options={[{v:"draft",l:"مسودة"},{v:"sent",l:"مرسلة"},{v:"paid",l:"مدفوعة ✓"},{v:"overdue",l:"متأخرة"}]}/>
        {inv.status!=="paid" && <Btn variant="green" small onClick={()=>onStatusChange(inv.id,"paid")}>✓ تأكيد الدفع</Btn>}
        <Btn variant="danger" small onClick={()=>{onDelete(inv.id);onClose();}}>حذف</Btn>
      </div>
      {client?.phone && (
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
          background:C.greenXL,borderRadius:10,marginBottom:16,border:`1px solid ${C.green}33`}}>
          <span style={{fontSize:18}}>📱</span>
          <div>
            <div style={{fontSize:12,color:C.green,fontWeight:800}}>هاتف العميل</div>
            <div style={{fontSize:14,fontWeight:700}}>{client.phone}</div>
          </div>
          <Btn variant="whatsapp" small style={{marginRight:"auto"}} onClick={()=>sendWhatsApp(inv,client.phone)}>فتح واتساب</Btn>
        </div>
      )}
      <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",maxHeight:480,overflowY:"auto"}}>
        <InvoiceDoc inv={inv} biz={biz}/>
      </div>
      <div style={{marginTop:14,padding:"10px 14px",background:C.tealXL,borderRadius:10,fontSize:12,color:C.teal,fontWeight:600}}>
        💡 عند الضغط على "تحميل PDF" — سيفتح نافذة طباعة. اختر <strong>"حفظ كـ PDF"</strong> كالطابعة لتحميل الملف.
      </div>
    </Modal>
  );
};

/* ─── SIDEBAR ────────────────────────────────────────────────────────────── */
const MENU = [
  {id:"dashboard",icon:"⊞",label:"لوحة التحكم"},
  {id:"invoices",icon:"📄",label:"الفواتير"},
  {id:"clients",icon:"👥",label:"العملاء"},
  {id:"reports",icon:"📊",label:"التقارير"},
  {id:"settings",icon:"⚙",label:"الإعدادات"},
];

const Sidebar = ({page,setPage,biz,onLogout}) => (
  <div style={{width:230,background:C.ink,minHeight:"100vh",display:"flex",flexDirection:"column",
    padding:"22px 0",flexShrink:0,position:"sticky",top:0,height:"100vh"}}>
    <div style={{padding:"0 20px 24px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
      <div style={{fontSize:21,fontWeight:900,color:"#fff"}}>فاتورا<span style={{color:C.gold}}>تي</span></div>
      <div style={{fontSize:10,color:"rgba(255,255,255,.35)",marginTop:2}}>نسخة Pro</div>
    </div>
    <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
      <div style={{width:34,height:34,background:C.teal,borderRadius:9,display:"flex",
        alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff",marginBottom:7}}>
        {(biz.name||"م")[0]}
      </div>
      <div style={{fontSize:12,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{biz.name||"شركتي"}</div>
      <div style={{fontSize:10,color:"rgba(255,255,255,.35)"}}>Pro Plan ✓</div>
    </div>
    <nav style={{flex:1,padding:"12px 10px"}}>
      {MENU.map(m=>(
        <button key={m.id} onClick={()=>setPage(m.id)}
          style={{display:"flex",alignItems:"center",gap:11,width:"100%",padding:"9px 12px",
            borderRadius:9,border:"none",cursor:"pointer",marginBottom:2,
            background:page===m.id?"rgba(13,110,110,.3)":"transparent",
            color:page===m.id?"#fff":"rgba(255,255,255,.5)",
            fontSize:13,fontWeight:page===m.id?700:400,textAlign:"right",transition:"all .15s"}}>
          <span style={{fontSize:15}}>{m.icon}</span>{m.label}
        </button>
      ))}
    </nav>
    <div style={{padding:"14px 10px",borderTop:"1px solid rgba(255,255,255,.08)"}}>
      <button onClick={onLogout} style={{display:"flex",alignItems:"center",gap:9,width:"100%",
        padding:"9px 12px",borderRadius:9,border:"none",cursor:"pointer",
        background:"transparent",color:"rgba(255,255,255,.35)",fontSize:13,textAlign:"right"}}>
        ↩ خروج
      </button>
    </div>
  </div>
);

/* ─── DASHBOARD ──────────────────────────────────────────────────────────── */
const DashPage = ({invoices,clients,setPage,openNew}) => {
  const paid = invoices.filter(i=>i.status==="paid");
  const over = invoices.filter(i=>i.status==="overdue");
  const sent = invoices.filter(i=>i.status==="sent");
  const tPaid = paid.reduce((s,i)=>s+calc(i.items,i.tva_rate).total,0);
  const tPend = sent.reduce((s,i)=>s+calc(i.items,i.tva_rate).total,0);
  const tOver = over.reduce((s,i)=>s+calc(i.items,i.tva_rate).total,0);
  const chartData = [
    {m:"يول",v:0},{m:"غشت",v:0},{m:"شت",v:0},
    {m:"أكت",v:0},{m:"نوف",v:0},{m:"دجن",v:tPaid},
  ];
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div><h1 style={{fontSize:21,fontWeight:900,color:C.ink}}>لوحة التحكم</h1>
          <p style={{fontSize:12,color:C.muted,marginTop:2}}>مرحباً — ملخص نشاطك</p></div>
        <Btn onClick={openNew}>+ فاتورة جديدة</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
        {[
          {l:"المحصّل",v:fmt(tPaid),icon:"✓",c:C.green,s:`${paid.length} فاتورة`},
          {l:"في الانتظار",v:fmt(tPend),icon:"⏳",c:C.teal,s:`${sent.length} فاتورة`},
          {l:"متأخرة",v:fmt(tOver),icon:"⚠",c:C.red,s:`${over.length} فاتورة`},
          {l:"العملاء",v:clients.length,icon:"👥",c:C.gold,s:"عميل نشيط"},
        ].map(st=>(
          <Card key={st.l} style={{display:"flex",alignItems:"flex-start",gap:14}}>
            <div style={{width:44,height:44,background:`${st.c}18`,borderRadius:11,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{st.icon}</div>
            <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:3}}>{st.l}</div>
              <div style={{fontSize:20,fontWeight:900,color:C.ink}}>{st.v}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:1}}>{st.s}</div></div>
          </Card>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:18,marginBottom:18}}>
        <Card>
          <div style={{fontSize:14,fontWeight:800,color:C.ink,marginBottom:18}}>📈 المبيعات — آخر 6 أشهر</div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={chartData}>
              <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.teal} stopOpacity={.25}/>
                <stop offset="95%" stopColor={C.teal} stopOpacity={0}/>
              </linearGradient></defs>
              <XAxis dataKey="m" tick={{fontSize:11,fontFamily:"Cairo",fill:C.muted}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip formatter={v=>[fmt(v),"المبيعات"]} contentStyle={{fontFamily:"Cairo",borderRadius:9}}/>
              <Area type="monotone" dataKey="v" stroke={C.teal} strokeWidth={2.5} fill="url(#g1)"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div style={{fontSize:14,fontWeight:800,color:C.ink,marginBottom:14}}>⚡ إجراءات سريعة</div>
          {[
            {icon:"📄",l:"فاتورة جديدة",act:openNew},
            {icon:"👥",l:"عميل جديد",act:()=>setPage("clients")},
            {icon:"📊",l:"تقرير TVA",act:()=>setPage("reports")},
          ].map(a=>(
            <button key={a.l} onClick={a.act}
              style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 12px",
                background:C.cream,border:`1px solid ${C.border}`,borderRadius:9,cursor:"pointer",
                marginBottom:7,fontSize:13,fontWeight:700,color:C.ink,textAlign:"right",transition:"all .15s"}}
              onMouseEnter={e=>{e.currentTarget.style.background=C.tealXL;e.currentTarget.style.borderColor=C.teal;}}
              onMouseLeave={e=>{e.currentTarget.style.background=C.cream;e.currentTarget.style.borderColor=C.border;}}>
              <span style={{fontSize:16}}>{a.icon}</span>{a.l}
            </button>
          ))}
        </Card>
      </div>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:800,color:C.ink}}>📋 آخر الفواتير</div>
          <Btn variant="ghost" small onClick={()=>setPage("invoices")}>عرض الكل →</Btn>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:`2px solid ${C.borderL}`}}>
            {["رقم","العميل","المبلغ","الحالة"].map(h=>(
              <th key={h} style={{padding:"7px 11px",textAlign:"right",fontSize:11,fontWeight:800,color:C.muted}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{invoices.slice(0,5).map(inv=>{
            const {total}=calc(inv.items,inv.tva_rate);
            return <tr key={inv.id} style={{borderBottom:`1px solid ${C.borderL}`}}>
              <td style={{padding:"9px 11px",fontSize:12,fontWeight:700,color:C.teal}}>#{inv.num}</td>
              <td style={{padding:"9px 11px",fontSize:12}}>{inv.client_name}</td>
              <td style={{padding:"9px 11px",fontSize:12,fontWeight:700}}>{fmt(total)}</td>
              <td style={{padding:"9px 11px"}}><Badge s={inv.status}/></td>
            </tr>;
          })}</tbody>
        </table>
      </Card>
    </div>
  );
};

/* ─── INVOICES PAGE ──────────────────────────────────────────────────────── */
const InvPage = ({invoices,setInvoices,clients,biz,openNew}) => {
  const [filter,setFilter] = useState("all");
  const [viewInv,setViewInv] = useState(null);
  const [toast,setToast] = useState(null);
  const showT = (msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000)};
  const filtered = filter==="all"?invoices:invoices.filter(i=>i.status===filter);

  const updStatus = async (id,s) => {
    const {error} = await supabase.from("invoices").update({status:s}).eq("id",id);
    if(error){showT("خطأ في التحديث","error");return;}
    setInvoices(p=>p.map(i=>i.id===id?{...i,status:s}:i));
    showT("تم تحديث الحالة");
    if(viewInv?.id===id) setViewInv(v=>({...v,status:s}));
  };

  const del = async (id) => {
    const {error} = await supabase.from("invoices").delete().eq("id",id);
    if(error){showT("خطأ في الحذف","error");return;}
    setInvoices(p=>p.filter(i=>i.id!==id));
    showT("تم الحذف","error");
  };

  return (
    <div>
      {toast&&<Toast {...toast}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div><h1 style={{fontSize:21,fontWeight:900,color:C.ink}}>الفواتير</h1>
          <p style={{fontSize:12,color:C.muted,marginTop:2}}>{invoices.length} فاتورة إجمالاً</p></div>
        <Btn onClick={openNew}>+ فاتورة جديدة</Btn>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:18,flexWrap:"wrap"}}>
        {[["all","الكل"],["draft","مسودة"],["sent","مرسلة"],["paid","مدفوعة"],["overdue","متأخرة"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)}
            style={{padding:"6px 14px",borderRadius:18,border:`1.5px solid ${filter===v?C.teal:C.border}`,
              background:filter===v?C.tealXL:"transparent",color:filter===v?C.teal:C.inkM,
              fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .15s"}}>
            {l} {v==="all"?invoices.length:invoices.filter(i=>i.status===v).length}
          </button>
        ))}
      </div>
      <Card style={{padding:0,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:C.cream}}>
            {["رقم الفاتورة","العميل","التاريخ","الاستحقاق","المبلغ","الحالة","إجراءات"].map(h=>(
              <th key={h} style={{padding:"11px 14px",textAlign:"right",fontSize:11,fontWeight:800,color:C.muted}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{filtered.map((inv,i)=>{
            const {total}=calc(inv.items,inv.tva_rate);
            return <tr key={inv.id}
              style={{borderTop:`1px solid ${C.borderL}`,background:i%2?C.cream:C.white,transition:"background .1s"}}
              onMouseEnter={e=>e.currentTarget.style.background=C.tealXL}
              onMouseLeave={e=>e.currentTarget.style.background=i%2?C.cream:C.white}>
              <td style={{padding:"10px 14px"}}>
                <span style={{fontWeight:800,color:C.teal,cursor:"pointer",fontSize:12}}
                  onClick={()=>setViewInv(inv)}>#{inv.num}</span>
              </td>
              <td style={{padding:"10px 14px",fontSize:12}}>{inv.client_name}</td>
              <td style={{padding:"10px 14px",fontSize:12,color:C.muted}}>{inv.date}</td>
              <td style={{padding:"10px 14px",fontSize:12,color:inv.status==="overdue"?C.red:C.muted}}>{inv.due}</td>
              <td style={{padding:"10px 14px",fontSize:12,fontWeight:800}}>{fmt(total)}</td>
              <td style={{padding:"10px 14px"}}><Badge s={inv.status}/></td>
              <td style={{padding:"10px 14px"}}>
                <div style={{display:"flex",gap:5}}>
                  <Btn variant="ghost" small onClick={()=>setViewInv(inv)}>عرض</Btn>
                  {inv.status!=="paid"&&<Btn variant="primary" small onClick={()=>updStatus(inv.id,"paid")}>✓</Btn>}
                </div>
              </td>
            </tr>;
          })}</tbody>
        </table>
        {!filtered.length&&<div style={{textAlign:"center",padding:40,color:C.muted,fontSize:13}}>لا توجد فواتير</div>}
      </Card>
      {viewInv&&<InvoiceViewModal inv={viewInv} biz={biz} clients={clients}
        onClose={()=>setViewInv(null)} onStatusChange={updStatus} onDelete={del}/>}
    </div>
  );
};

/* ─── NEW INVOICE MODAL ──────────────────────────────────────────────────── */
const NewInvModal = ({clients,invoices,setInvoices,biz,onClose,userId}) => {
  const today=new Date().toISOString().split("T")[0];
  const due30=new Date(Date.now()+30*864e5).toISOString().split("T")[0];
  const [cId,setCId]=useState(clients[0]?.id||"");
  const [date,setDate]=useState(today);
  const [due,setDue]=useState(due30);
  const [tva,setTva]=useState("20");
  const [notes,setNotes]=useState("");
  const [items,setItems]=useState([{desc:"",qty:1,price:0}]);
  const [saving,setSaving]=useState(false);
  const [toast,setToast]=useState(null);
  const {downloadPDF,sendWhatsApp,loading}=useInvoiceActions(biz);
  const client=clients.find(c=>c.id===cId);
  const {sub,tva:tvaAmt,total}=calc(items.filter(i=>i.desc),parseInt(tva));
  const updItem=(i,k,v)=>setItems(p=>p.map((it,idx)=>idx===i?{...it,[k]:k==="qty"||k==="price"?parseFloat(v)||0:v}:it));

  const save = async (status) => {
    const validItems = items.filter(i=>i.desc);
    if(!client||!validItems.length) return;
    setSaving(true);
    const num = String(invoices.length+1).padStart(3,"0");
    const invData = {
      user_id: userId,
      num: `2024-${num}`,
      client_id: client.id,
      client_name: client.name,
      date, due,
      items: validItems,
      tva_rate: parseInt(tva),
      status,
      notes
    };
    const {data,error} = await supabase.from("invoices").insert([invData]).select().single();
    if(error){setToast({msg:"خطأ في الحفظ",type:"error"});setSaving(false);return;}
    setInvoices(p=>[data,...p]);
    setSaving(false);
    onClose();
  };

  const saveAndSend = async () => {
    const validItems = items.filter(i=>i.desc);
    if(!client||!validItems.length) return;
    setSaving(true);
    const num = String(invoices.length+1).padStart(3,"0");
    const invData = {
      user_id: userId,
      num: `2024-${num}`,
      client_id: client.id,
      client_name: client.name,
      date, due,
      items: validItems,
      tva_rate: parseInt(tva),
      status: "sent",
      notes
    };
    const {data,error} = await supabase.from("invoices").insert([invData]).select().single();
    if(error){setToast({msg:"خطأ في الحفظ",type:"error"});setSaving(false);return;}
    setInvoices(p=>[data,...p]);
    sendWhatsApp(data, client?.phone);
    setSaving(false);
    setTimeout(onClose,800);
  };

  const previewInv={num:`2024-${String(invoices.length+1).padStart(3,"0")}`,
    clientName:client?.name||"",date,due,items:items.filter(i=>i.desc),tvaRate:parseInt(tva),notes,status:"draft"};

  return (
    <Modal onClose={onClose} title="إنشاء فاتورة جديدة" wide>
      {toast&&<Toast {...toast}/>}
      <div style={{display:"flex",gap:20}}>
        <div style={{flex:1}}>
          <Sel label="العميل" value={cId} onChange={setCId} options={clients.map(c=>({v:c.id,l:c.name}))}/>
          {client?.phone&&<div style={{fontSize:12,color:C.green,marginTop:-10,marginBottom:12,fontWeight:600}}>📱 {client.phone} — إرسال واتساب متاح</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Input label="تاريخ الفاتورة" type="date" value={date} onChange={setDate}/>
            <Input label="تاريخ الاستحقاق" type="date" value={due} onChange={setDue}/>
          </div>
          <Sel label="نسبة TVA" value={tva} onChange={setTva}
            options={[{v:"20",l:"20%"},{v:"14",l:"14%"},{v:"10",l:"10%"},{v:"7",l:"7%"},{v:"0",l:"0%"}]}/>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:13,fontWeight:700,color:C.inkM,display:"block",marginBottom:7}}>الخدمات / المنتجات</label>
            {items.map((it,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 70px 90px 30px",gap:7,marginBottom:7,alignItems:"center"}}>
                <input value={it.desc} onChange={e=>updItem(i,"desc",e.target.value)} placeholder="وصف الخدمة"
                  style={{padding:"7px 11px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:12,fontFamily:"Cairo",outline:"none"}}/>
                <input type="number" value={it.qty} onChange={e=>updItem(i,"qty",e.target.value)} min="1"
                  style={{padding:"7px 9px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:12,fontFamily:"Cairo",outline:"none",textAlign:"center"}}/>
                <input type="number" value={it.price||""} onChange={e=>updItem(i,"price",e.target.value)} placeholder="السعر"
                  style={{padding:"7px 9px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:12,fontFamily:"Cairo",outline:"none",textAlign:"center"}}/>
                <button onClick={()=>setItems(p=>p.filter((_,idx)=>idx!==i))}
                  style={{background:C.redXL,color:C.red,border:"none",borderRadius:7,cursor:"pointer",fontSize:15,height:32,width:30}}>×</button>
              </div>
            ))}
            <button onClick={()=>setItems(p=>[...p,{desc:"",qty:1,price:0}])}
              style={{fontSize:12,color:C.teal,background:"none",border:`1.5px dashed ${C.teal}66`,
                borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:"Cairo",fontWeight:700}}>+ إضافة سطر</button>
          </div>
          <Input label="ملاحظات (اختياري)" value={notes} onChange={setNotes} placeholder="ملاحظات..."/>
          <div style={{background:C.cream,borderRadius:10,padding:14,marginBottom:14}}>
            {[["المجموع الجزئي",fmt(sub)],[`TVA ${tva}%`,fmt(tvaAmt)]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0",color:C.muted}}>
                <span>{k}</span><span style={{fontWeight:700,color:C.inkM}}>{v}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:900,
              color:C.teal,borderTop:`1px solid ${C.border}`,marginTop:7,paddingTop:7}}>
              <span>المجموع الكلي</span><span>{fmt(total)}</span>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            <Btn onClick={()=>save("draft")} variant="ghost" style={{fontSize:12}} loading={saving}>حفظ مسودة</Btn>
            <Btn onClick={()=>save("sent")} style={{fontSize:12}} loading={saving}>حفظ وإرسال</Btn>
            <Btn onClick={saveAndSend} variant="whatsapp" loading={saving||loading.wa} style={{fontSize:12}}>واتساب ⚡</Btn>
          </div>
        </div>
        <div style={{width:300,flexShrink:0,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",maxHeight:500,overflowY:"auto"}}>
          <div style={{background:C.teal,color:"#fff",padding:"9px 14px",fontSize:11,fontWeight:700}}>معاينة الفاتورة</div>
          <div style={{transform:"scale(0.62)",transformOrigin:"top right",width:"161%",marginBottom:-230}}>
            <InvoiceDoc inv={previewInv} biz={biz}/>
          </div>
        </div>
      </div>
    </Modal>
  );
};

/* ─── CLIENTS PAGE ───────────────────────────────────────────────────────── */
const ClientsPage = ({clients,setClients,invoices,userId}) => {
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState({name:"",email:"",phone:"",city:"",ice:""});
  const [toast,setToast]=useState(null);
  const [search,setSearch]=useState("");
  const [saving,setSaving]=useState(false);
  const showT=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000)};

  const save = async () => {
    if(!form.name) return;
    setSaving(true);
    const {data,error} = await supabase.from("clients").insert([{...form,user_id:userId}]).select().single();
    if(error){showT("خطأ في الحفظ","error");setSaving(false);return;}
    setClients(p=>[...p,data]);
    setModal(false);
    setForm({name:"",email:"",phone:"",city:"",ice:""});
    showT("تمت الإضافة");
    setSaving(false);
  };

  const deleteClient = async (id) => {
    const {error} = await supabase.from("clients").delete().eq("id",id);
    if(error){showT("خطأ في الحذف","error");return;}
    setClients(p=>p.filter(x=>x.id!==id));
    showT("تم الحذف","error");
  };

  const filtered=clients.filter(c=>c.name.includes(search)||c.city?.includes(search));

  return (
    <div>
      {toast&&<Toast {...toast}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div><h1 style={{fontSize:21,fontWeight:900,color:C.ink}}>العملاء</h1>
          <p style={{fontSize:12,color:C.muted,marginTop:2}}>{clients.length} عميل</p></div>
        <Btn onClick={()=>setModal(true)}>+ عميل جديد</Btn>
      </div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 ابحث..."
        style={{width:"100%",maxWidth:300,padding:"9px 14px",border:`1.5px solid ${C.border}`,
          borderRadius:10,fontSize:13,fontFamily:"Cairo",outline:"none",marginBottom:18}}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
        {filtered.map(c=>{
          const cInvs=invoices.filter(i=>i.client_id===c.id);
          const total=cInvs.reduce((s,i)=>s+calc(i.items,i.tva_rate).total,0);
          return <Card key={c.id}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div style={{width:42,height:42,background:C.tealXL,borderRadius:11,display:"flex",
                alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:900,color:C.teal}}>
                {c.name[0]}</div>
              <button onClick={()=>deleteClient(c.id)}
                style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18}}>×</button>
            </div>
            <div style={{fontSize:14,fontWeight:800,color:C.ink,marginBottom:3}}>{c.name}</div>
            {c.city&&<div style={{fontSize:11,color:C.muted,marginBottom:6}}>📍 {c.city}</div>}
            {c.phone&&<div style={{fontSize:12,color:C.inkM,marginBottom:3}}>📞 {c.phone}</div>}
            {c.email&&<div style={{fontSize:12,color:C.inkM,marginBottom:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>✉ {c.email}</div>}
            <div style={{borderTop:`1px solid ${C.borderL}`,paddingTop:10,display:"flex",justifyContent:"space-between"}}>
              <div><div style={{fontSize:10,color:C.muted}}>إجمالي الفواتير</div>
                <div style={{fontSize:15,fontWeight:900,color:C.teal}}>{fmt(total)}</div></div>
              <div style={{fontSize:11,color:C.muted,alignSelf:"flex-end"}}>{cInvs.length} فاتورة</div>
            </div>
          </Card>;
        })}
      </div>
      {modal&&<Modal onClose={()=>setModal(false)} title="إضافة عميل جديد">
        <Input label="الاسم / الشركة" req value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="شركة المثال"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Input label="الهاتف" value={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))} placeholder="06XXXXXXXX"/>
          <Input label="المدينة" value={form.city} onChange={v=>setForm(p=>({...p,city:v}))} placeholder="الدار البيضاء"/>
        </div>
        <Input label="البريد الإلكتروني" type="email" value={form.email} onChange={v=>setForm(p=>({...p,email:v}))} placeholder="info@company.ma"/>
        <Input label="ICE (اختياري)" value={form.ice} onChange={v=>setForm(p=>({...p,ice:v}))} placeholder="000000000000000"/>
        <div style={{display:"flex",gap:9,marginTop:6}}>
          <Btn variant="ghost" onClick={()=>setModal(false)} style={{flex:1}}>إلغاء</Btn>
          <Btn onClick={save} style={{flex:1}} loading={saving}>إضافة</Btn>
        </div>
      </Modal>}
    </div>
  );
};

/* ─── REPORTS PAGE ───────────────────────────────────────────────────────── */
const ReportsPage = ({invoices,biz}) => {
  const paid=invoices.filter(i=>i.status==="paid");
  const tHT=paid.reduce((s,i)=>s+calc(i.items,i.tva_rate).sub,0);
  const tTVA=paid.reduce((s,i)=>s+calc(i.items,i.tva_rate).tva,0);
  const tTTC=paid.reduce((s,i)=>s+calc(i.items,i.tva_rate).total,0);
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div><h1 style={{fontSize:21,fontWeight:900,color:C.ink}}>التقارير المالية</h1>
          <p style={{fontSize:12,color:C.muted,marginTop:2}}>ملخصك الضريبي والمالي</p></div>
        <Btn variant="ghost" onClick={()=>window.print()}>🖨 طباعة</Btn>
      </div>
      <Card style={{marginBottom:18}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:18}}>
          {[["مجموع المبيعات HT",fmt(tHT),C.teal],["TVA المحصّلة",fmt(tTVA),C.gold],["مجموع TTC",fmt(tTTC),C.green]].map(([l,v,c])=>(
            <div key={l} style={{background:C.cream,borderRadius:10,padding:14,borderRight:`4px solid ${c}`}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:3}}>{l}</div>
              <div style={{fontSize:19,fontWeight:900,color:c}}>{v}</div>
            </div>
          ))}
        </div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:C.cream}}>
            {["الفاتورة","العميل","التاريخ","HT","TVA","TTC"].map(h=>(
              <th key={h} style={{padding:"9px 13px",textAlign:"right",fontSize:11,fontWeight:800,color:C.muted}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{paid.map((inv,i)=>{
            const {sub,tva:t,total}=calc(inv.items,inv.tva_rate);
            return <tr key={inv.id} style={{borderTop:`1px solid ${C.borderL}`,background:i%2?C.cream:C.white}}>
              <td style={{padding:"9px 13px",fontSize:12,fontWeight:700,color:C.teal}}>#{inv.num}</td>
              <td style={{padding:"9px 13px",fontSize:12}}>{inv.client_name}</td>
              <td style={{padding:"9px 13px",fontSize:12,color:C.muted}}>{inv.date}</td>
              <td style={{padding:"9px 13px",fontSize:12}}>{fmt(sub)}</td>
              <td style={{padding:"9px 13px",fontSize:12,color:C.gold,fontWeight:700}}>{fmt(t)}</td>
              <td style={{padding:"9px 13px",fontSize:12,fontWeight:800}}>{fmt(total)}</td>
            </tr>;
          })}</tbody>
        </table>
      </Card>
    </div>
  );
};

/* ─── SETTINGS PAGE ──────────────────────────────────────────────────────── */
const SettingsPage = ({biz,setBiz,userId}) => {
  const [form,setForm]=useState({...biz});
  const [toast,setToast]=useState(null);
  const [saving,setSaving]=useState(false);

  const save = async () => {
    setSaving(true);
    const {error} = await supabase.from("settings").upsert({...form, user_id:userId});
    if(error){setToast({msg:"خطأ في الحفظ",type:"error"});setSaving(false);return;}
    setBiz(form);
    setToast({msg:"تم الحفظ ✓",type:"success"});
    setTimeout(()=>setToast(null),3000);
    setSaving(false);
  };

  return (
    <div>
      {toast&&<Toast {...toast}/>}
      <div style={{marginBottom:22}}><h1 style={{fontSize:21,fontWeight:900,color:C.ink}}>الإعدادات</h1></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
        <Card>
          <div style={{fontSize:14,fontWeight:800,color:C.ink,marginBottom:18}}>🏢 بيانات الشركة</div>
          <Input label="اسم الشركة" req value={form.name||""} onChange={v=>setForm(p=>({...p,name:v}))}/>
          <Input label="ICE" value={form.ice||""} onChange={v=>setForm(p=>({...p,ice:v}))}/>
          <Input label="RC" value={form.rc||""} onChange={v=>setForm(p=>({...p,rc:v}))}/>
          <Input label="العنوان" value={form.address||""} onChange={v=>setForm(p=>({...p,address:v}))}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Input label="الهاتف" value={form.phone||""} onChange={v=>setForm(p=>({...p,phone:v}))}/>
            <Input label="البريد الإلكتروني" value={form.email||""} onChange={v=>setForm(p=>({...p,email:v}))}/>
          </div>
          <Btn onClick={save} loading={saving} style={{width:"100%",marginTop:4}}>💾 حفظ</Btn>
        </Card>
        <div>
          <Card style={{marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:800,color:C.ink,marginBottom:14}}>💳 معلومات الدفع</div>
            <Input label="RIB البنكي" value={form.rib||""} onChange={v=>setForm(p=>({...p,rib:v}))} placeholder="XXX XXX XXXX..."/>
            <Input label="اسم البنك" value={form.bank||""} onChange={v=>setForm(p=>({...p,bank:v}))} placeholder="Attijariwafa Bank"/>
          </Card>
          <Card>
            <div style={{fontSize:14,fontWeight:800,color:C.ink,marginBottom:12}}>📲 WhatsApp</div>
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:9,padding:12,fontSize:12,color:C.green}}>
              ✓ إرسال واتساب يعمل بدون API خارجي — مجاني 100%
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

/* ─── AUTH SCREEN ────────────────────────────────────────────────────────── */
const AuthScreen = ({onLogin}) => {
  const [tab,setTab]=useState("login");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [loading,setLoading]=useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const {error} = await supabase.auth.signInWithPassword({email,password:pass});
    if(error) alert(error.message);
    else onLogin();
    setLoading(false);
  };

  const handleRegister = async () => {
    setLoading(true);
    const {error} = await supabase.auth.signUp({email,password:pass});
    if(error) alert(error.message);
    else alert('✅ تم إنشاء الحساب! تحقق من بريدك الإلكتروني ثم ادخل');
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:C.ink,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:34,fontWeight:900,color:"#fff"}}>فاتورا<span style={{color:C.gold}}>تي</span></div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginTop:3}}>نظام الفوترة للمقاول المغربي</div>
        </div>
        <div style={{background:C.white,borderRadius:18,padding:28,boxShadow:"0 24px 70px rgba(0,0,0,.3)"}}>
          <div style={{display:"flex",background:C.cream,borderRadius:10,padding:3,marginBottom:22}}>
            {[["login","دخول"],["signup","تسجيل"]].map(([v,l])=>(
              <button key={v} onClick={()=>setTab(v)}
                style={{flex:1,padding:"7px",borderRadius:8,border:"none",cursor:"pointer",
                  fontFamily:"Cairo",fontWeight:700,fontSize:13,transition:"all .2s",
                  background:tab===v?C.teal:"transparent",color:tab===v?"#fff":C.muted}}>
                {l}
              </button>
            ))}
          </div>
          <Input label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} placeholder="you@company.ma"/>
          <Input label="كلمة المرور" type="password" value={pass} onChange={setPass} placeholder="••••••••"/>
          <Btn onClick={tab==="login"?handleLogin:handleRegister} loading={loading} style={{width:"100%",padding:"12px",fontSize:15,marginTop:4}}>
            {tab==="login"?"دخول →":"إنشاء الحساب →"}
          </Btn>
        </div>
      </div>
    </div>
  );
};

/* ─── MAIN APP ───────────────────────────────────────────────────────────── */
export default function App() {
  const [user,setUser] = useState(null);
  const [page,setPage] = useState("dashboard");
  const [invoices,setInvoices] = useState([]);
  const [clients,setClients] = useState([]);
  const [newInv,setNewInv] = useState(false);
  const [loading,setLoading] = useState(true);
  const [biz,setBiz] = useState({name:"",email:"",phone:"",address:"",ice:"",rc:"",rib:"",bank:""});

  // Check session on load
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session) setUser(session.user);
      setLoading(false);
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,session)=>{
      setUser(session?.user||null);
    });
    return ()=>subscription.unsubscribe();
  },[]);

  // Load data when user logs in
  useEffect(()=>{
    if(!user) return;
    const loadData = async () => {
      setLoading(true);
      const [clientsRes, invoicesRes, settingsRes] = await Promise.all([
        supabase.from("clients").select("*").eq("user_id",user.id).order("created_at",{ascending:false}),
        supabase.from("invoices").select("*").eq("user_id",user.id).order("created_at",{ascending:false}),
        supabase.from("settings").select("*").eq("user_id",user.id).single(),
      ]);
      if(clientsRes.data) setClients(clientsRes.data);
      if(invoicesRes.data) setInvoices(invoicesRes.data);
      if(settingsRes.data) setBiz(settingsRes.data);
      setLoading(false);
    };
    loadData();
  },[user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setClients([]);
    setInvoices([]);
    setBiz({name:"",email:"",phone:"",address:"",ice:"",rc:"",rib:"",bank:""});
  };

  if(loading) return <><GS/><div style={{minHeight:"100vh",background:C.ink,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div></>;
  if(!user) return <><GS/><AuthScreen onLogin={()=>{}}/></>;

  const renderPage=()=>{
    switch(page){
      case "dashboard": return <DashPage invoices={invoices} clients={clients} setPage={setPage} openNew={()=>setNewInv(true)}/>;
      case "invoices":  return <InvPage invoices={invoices} setInvoices={setInvoices} clients={clients} biz={biz} openNew={()=>setNewInv(true)}/>;
      case "clients":   return <ClientsPage clients={clients} setClients={setClients} invoices={invoices} userId={user.id}/>;
      case "reports":   return <ReportsPage invoices={invoices} biz={biz}/>;
      case "settings":  return <SettingsPage biz={biz} setBiz={setBiz} userId={user.id}/>;
      default: return null;
    }
  };

  return (
    <>
      <GS/>
      <div style={{display:"flex",minHeight:"100vh",background:"#f0ede8",direction:"rtl"}}>
        <Sidebar page={page} setPage={setPage} biz={biz} onLogout={handleLogout}/>
        <main style={{flex:1,padding:24,overflowY:"auto",maxHeight:"100vh"}}>
          {loading ? <Spinner/> : renderPage()}
        </main>
        {newInv&&<NewInvModal clients={clients} invoices={invoices} setInvoices={setInvoices} biz={biz} onClose={()=>setNewInv(false)} userId={user.id}/>}
      </div>
    </>
  );
}