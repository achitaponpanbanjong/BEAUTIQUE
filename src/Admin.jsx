import {useEffect,useState} from 'react'
import {api} from './api'
import Nav from './Header'
import GlassBubbles from './GlassBubbles'

const ST={CONFIRMED:['ยืนยันแล้ว','bg-[#cfe8dc] text-[#12392c]'],PENDING:['รอยืนยัน','bg-[#fbe9c4] text-[#5c3d00]'],COMPLETED:['เสร็จสิ้น','bg-mist text-ink'],CANCELLED:['ยกเลิก','bg-[#f6d4d0] text-[#6b1a12]']}
const EM={SENT:'ส่งแล้ว',FAILED:'ส่งไม่สำเร็จ',PENDING:'รอส่ง'}
const ACT={PENDING:[['CONFIRMED','ยืนยัน'],['CANCELLED','ยกเลิก']],CONFIRMED:[['COMPLETED','เสร็จสิ้น'],['CANCELLED','ยกเลิก']]}

const PX=72,HOURS=Array.from({length:12},(_,i)=>8+i)
const BOX={PENDING:'bg-[#fff3d6] border-[#f2c66d] text-[#5c3d00]',CONFIRMED:'bg-[#dcfce7] border-[#86efac] text-[#14532d]',COMPLETED:'bg-[#e0f0ff] border-[#9cc9f0] text-[#0c3b66]',CANCELLED:'bg-[#fde4e1] border-[#f0a9a2] text-[#6b1a12]'}
const toMin=t=>{const [h,m]=String(t).split(':');return +h*60+ +m}
const hhmm=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`

export function Login({setUser,setEmployee,go}){
 const [mode,setMode]=useState('choose'),[f,setF]=useState({username:'',password:''}),[empId,setEmpId]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
 async function submitOwner(e){e.preventDefault();setBusy(true);setErr('')
  try{const r=await api('login',f);setUser({...r.user,password:f.password})}catch(x){setErr(x.message)}setBusy(false)}
 async function submitEmployee(e){e.preventDefault();setBusy(true);setErr('')
  try{const r=await api('verifyEmployee',{emp_id:empId.trim()});setEmployee(r.employee);go('my-bookings')}catch(x){setErr(x.message)}setBusy(false)}
 return(<div className="relative min-h-screen overflow-hidden bg-linear-to-b from-white to-[#e4f3e8]"><GlassBubbles/>
  <div className="relative z-10"><Nav go={go} hideOwner/>
   <main className="mx-auto max-w-3xl px-6 py-16">{mode==='choose'?<><div className="mb-8 text-center"><h1 className="text-3xl">เข้าสู่ระบบ</h1><p className="mt-1 text-ink/70">เลือกประเภทผู้ใช้งานที่ต้องการ</p></div><div className="grid gap-5 md:grid-cols-2"><button className="card flex flex-col items-center text-center transition hover:-translate-y-1 hover:shadow-lg" onClick={()=>{setMode('employee');setErr('')}}><img src="/user.png" alt="" className="size-18 object-contain"/><h2 className="mt-4 text-2xl">พนักงาน BJC BigC</h2><p className="mt-2 text-ink/70">เข้าสู่ระบบด้วยรหัสพนักงาน เพื่อดูคิวที่จองไว้และจองคิวเพิ่ม</p><span className="btn mt-5 px-5 text-center">เข้าสู่ระบบพนักงาน</span></button><button className="card flex flex-col items-center text-center transition hover:-translate-y-1 hover:shadow-lg" onClick={()=>{setMode('owner');setErr('')}}><img src="/store.png" alt="" className="size-18 object-contain"/><h2 className="mt-4 text-2xl">เจ้าของร้าน</h2><p className="mt-2 text-ink/70">เข้าสู่ระบบเพื่อจัดการตารางคิว พนักงาน และข้อมูลการจองของร้าน</p><span className="btn mt-5 px-5 text-center">เข้าสู่ระบบเจ้าของร้าน</span></button></div></>:<form onSubmit={mode==='employee'?submitEmployee:submitOwner} className="card mx-auto max-w-md"><button type="button" className="mb-4 text-sm underline" onClick={()=>{setMode('choose');setErr('')}}>← เลือกประเภทผู้ใช้งาน</button><h1 className="text-3xl">{mode==='employee'?'สำหรับพนักงาน BJC BigC':'สำหรับเจ้าของร้าน'}</h1><p className="mb-6 mt-1 text-ink/70">{mode==='employee'?'ใช้รหัสพนักงานเพื่อดูและจัดการคิวของคุณ':'เข้าสู่ระบบเพื่อจัดการคิวของร้าน'}</p>{mode==='employee'?<label className="lbl">รหัสพนักงาน<input className="field" required autoFocus inputMode="numeric" value={empId} onChange={e=>setEmpId(e.target.value)}/></label>:<><label className="lbl">ชื่อผู้ใช้<input className="field" required autoComplete="username" value={f.username} onChange={e=>setF({...f,username:e.target.value})}/></label><label className="lbl">รหัสผ่าน<input className="field" required type="password" autoComplete="current-password" value={f.password} onChange={e=>setF({...f,password:e.target.value})}/></label></>}{err&&<p role="alert" className="mb-3 text-red-800">{err}</p>}<button className="btn w-full" disabled={busy}>{busy?'กำลังตรวจสอบ…':'เข้าสู่ระบบ'}</button></form>}<button type="button" className="mx-auto mt-5 block text-sm underline" onClick={()=>go('home')}>กลับหน้าแรก</button></main></div></div>)}

const SLOT_OPTS=Array.from({length:25},(_,i)=>{const m=480+i*30;return `${String(Math.floor(m/60)).padStart(2,'0')}:${m%60?'30':'00'}`})

const ADVANCE_DAYS=7 // ต้องตรงกับ MAX_DAYS ใน App.jsx และ MAX_ADVANCE_DAYS ใน Code.gs
const bookableDates=(todayIso,hol)=>{const out=[];for(let i=0;i<=ADVANCE_DAYS;i++){const d=new Date(todayIso+'T00:00');d.setDate(d.getDate()+i);const s=d.toLocaleDateString('sv-SE'),w=d.getDay();if(w!==0&&w!==6&&!hol.includes(s))out.push(s)}return out}
const groupStaff=rows=>{const m={};rows.forEach(x=>{(m[x.date]=m[x.date]||[]).push({name:x.name,start:x.start,end:x.end,store_id:x.store_id||''})});return m}
const dayLabel=d=>new Date(d+'T00:00').toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short'})

function StaffDialog({dates,byDate,onSave,onClose,today}){
 const [cur,setCur]=useState(today&&dates.includes(today)?today:dates[0])
 const [rows,setRows]=useState(()=>(byDate[cur]?.length?byDate[cur]:[{name:'',start:'08:00',end:'20:00'}]).map(x=>({...x})))
 const [busy,setBusy]=useState(false),[err,setErr]=useState(''),[ok,setOk]=useState('')
 useEffect(()=>{const k=e=>e.key==='Escape'&&onClose();addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[onClose])
 const upd=(i,k,v)=>setRows(r=>r.map((x,j)=>j===i?{...x,[k]:v}:x))
 const badTime=rows.some(x=>x.start>=x.end),valid=rows.every(x=>x.name.trim())&&!badTime
 const pick=d=>{setCur(d);setErr('');setOk('');if(byDate[d]?.length)setRows(byDate[d].map(x=>({...x})))}
 async function save(ds){if(!valid)return;setBusy(true);setErr('');setOk('')
  try{await onSave(ds,rows.map(x=>({name:x.name.trim(),start:x.start,end:x.end})));setOk(`บันทึกแล้ว ${ds.length} วัน`)}catch(x){setErr(x.message)}setBusy(false)}
 return(<div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
  <form role="dialog" aria-modal="true" aria-labelledby="staff-title" onSubmit={e=>{e.preventDefault();save([cur])}} className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto">
   <div className="flex items-start justify-between gap-3"><div><h2 id="staff-title" className="text-2xl">มีพนักงานกี่คนในแต่ละวัน?</h2><p className="mb-3 mt-1 text-ink/70">กรอกชื่อและช่วงเวลาที่ทำงาน วันนี้ต้องมีข้อมูลก่อนเปิดรับจอง ส่วนวันถัดไปกรอกเมื่อพร้อมได้</p></div><button type="button" aria-label="ปิด" className="text-2xl leading-none text-ink/70 hover:text-ink" onClick={onClose}>×</button></div>
   <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="เลือกวัน">{dates.map(d=><button type="button" key={d} className="chip" aria-pressed={cur===d} onClick={()=>pick(d)}>{dayLabel(d)}{byDate[d]?.length?' ✓':''}</button>)}</div>
   <p className="mb-3 font-semibold">วัน{new Date(cur+'T00:00').toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long'})} · ตอนนี้ {rows.length} คน</p>
   {rows.map((x,i)=><div key={i} className="mb-3 grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_120px_120px_auto]">
    <label className="lbl col-span-2 mb-0 sm:col-span-1">ชื่อพนักงานคนที่ {i+1}<input className="field" autoFocus={i===0} value={x.name} onChange={e=>upd(i,'name',e.target.value)}/></label>
    <label className="lbl mb-0">เริ่มงาน<select className="field" value={x.start} onChange={e=>upd(i,'start',e.target.value)}>{SLOT_OPTS.map(o=><option key={o}>{o}</option>)}</select></label>
    <label className="lbl mb-0">เลิกงาน<select className="field" value={x.end} onChange={e=>upd(i,'end',e.target.value)}>{SLOT_OPTS.map(o=><option key={o}>{o}</option>)}</select></label>
    <button type="button" aria-label={`ลบพนักงานคนที่ ${i+1}`} disabled={rows.length===1} className="chip col-span-2 sm:col-span-1" onClick={()=>setRows(r=>r.filter((_,j)=>j!==i))}>ลบ</button></div>)}
   <button type="button" className="btn btn-o mb-4 px-4" onClick={()=>setRows(r=>[...r,{name:'',start:r[r.length-1].start,end:r[r.length-1].end}])}>+ เพิ่มพนักงาน</button>
   {badTime&&<p role="alert" className="mb-3 text-red-800">เวลาเลิกงานต้องหลังเวลาเริ่มงาน</p>}
   {err&&<p role="alert" className="mb-3 text-red-800">{err}</p>}
   {ok&&<p role="status" className="mb-3 font-semibold text-[#12392c]">✓ {ok}</p>}
   <div className="flex justify-end border-t border-mist pt-4"><button className="btn px-6" disabled={!valid||busy}>{busy?'กำลังบันทึก…':`บันทึก ${dayLabel(cur)}`}</button></div>
  </form></div>)}

export function Dashboard({user,stores,logout}){
 const auth={username:user.username,password:user.password}
 const isSuper=user.role==='SUPER_ADMIN'
 const iso=d=>d.toLocaleDateString('sv-SE'),todayIso=iso(new Date())
 const [shop,setShop]=useState(''),[date,setDate]=useState(todayIso),[tab,setTab]=useState('ALL'),[off,setOff]=useState(0),[q,setQ]=useState(''),[searchOpen,setSearchOpen]=useState(false),[showAllMatches,setShowAllMatches]=useState(false)
 const [list,setList]=useState([]),[sel,setSel]=useState(null),[err,setErr]=useState(''),[busy,setBusy]=useState(''),[statusDraft,setStatusDraft]=useState('')
 const name=id=>stores.find(x=>x.store_id===id)?.store_name||id
 useEffect(()=>{setErr('');api('getBookings',{...auth,store_id:shop}).then(r=>setList(r.bookings)).catch(e=>setErr(e.message))},[shop])
 const [byDate,setByDate]=useState({}),[dates,setDates]=useState([]),[staffLoaded,setStaffLoaded]=useState(false),[staffOpen,setStaffOpen]=useState(false)
 const liveDates=dates.filter(d=>d>=todayIso) // วันที่ผ่านไปแล้วไม่ต้องกรอก/ไม่ต้องเตือน
 const staffForDay=d=>(byDate[d]||[]).filter(x=>!isSuper||!shop||x.store_id===shop)
 useEffect(()=>{
  const to=new Date();to.setDate(to.getDate()+ADVANCE_DAYS)
  Promise.all([api('getHolidays',{from:todayIso,to:iso(to)}).then(r=>r.holidays).catch(()=>[]),api('getStaff',auth)])
   .then(([hol,r])=>{const ds=bookableDates(todayIso,hol),m=groupStaff(r.rows);setDates(ds);setByDate(m);setStaffLoaded(true);if(!isSuper&&ds.includes(todayIso)&&!(m[todayIso]||[]).length)setStaffOpen(true)}).catch(e=>setErr(e.message))},[])
 useEffect(()=>{if(!sel)return;const k=e=>e.key==='Escape'&&setSel(null);addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[sel])
 const patch=(id,o)=>setList(l=>l.map(x=>x.booking_id===id?{...x,...o}:x))
 async function setStatus(b,status){setBusy(b.booking_id);setErr('')
  try{await api('updateStatus',{...auth,booking_id:b.booking_id,status});patch(b.booking_id,{status})}catch(x){setErr(x.message)}setBusy('')}
 async function resend(b){setBusy(b.booking_id);setErr('')
  try{await api('resendEmail',{...auth,booking_id:b.booking_id});patch(b.booking_id,{confirmation_email:'SENT'})}catch(x){setErr(x.message);patch(b.booking_id,{confirmation_email:'FAILED'})}setBusy('')}
 const now=new Date(),m=new Date(now.getFullYear(),now.getMonth()+off,1)
 const n=new Date(m.getFullYear(),m.getMonth()+1,0).getDate()
 const cells=[...Array(m.getDay()).fill(null),...Array.from({length:n},(_,i)=>iso(new Date(m.getFullYear(),m.getMonth(),i+1)))]
 const byDay={};list.forEach(b=>{if(b.status==='CANCELLED')return;const d=byDay[b.booking_date]||(byDay[b.booking_date]={n:0,p:0});d.n++;if(b.status==='PENDING')d.p++})
 const day=list.filter(b=>b.booking_date===date),cnt=k=>day.filter(b=>b.status===k).length
 const live=day.length-cnt('CANCELLED'),needle=q.trim().toLowerCase()
 const matchesSearch=b=>[b.customer_name,b.phone,b.booking_id,b.service_name,b.emp_id,b.company,b.division,b.department,b.email,b.store_id,name(b.store_id),b.booking_date,b.booking_time,b.status].filter(Boolean).join(' ').toLowerCase().includes(needle)
 const searchMatches=needle?list.filter(matchesSearch):[]
 const rows=day.filter(b=>(tab==='ALL'?b.status!=='CANCELLED':b.status===tab)&&(!needle||matchesSearch(b)))
 const ends=[],arr=rows.map(b=>({b,s:toMin(b.booking_time),e:toMin(b.booking_time)+(b.duration_minutes||60)})).filter(p=>p.s>=480&&p.s<1200).sort((x,y)=>x.s-y.s)
 arr.forEach(p=>{let c=ends.findIndex(e=>e<=p.s);if(c<0){c=ends.length;ends.push(0)}ends[c]=p.e;p.c=c})
 const cols=Math.max(1,ends.length),cur=list.find(b=>b.booking_id===sel)
 useEffect(()=>setStatusDraft(cur?.status||''),[cur?.booking_id,cur?.status])
 return(<div className="min-h-screen">
  <header className="flex items-center justify-between border-b-4 border-[#114728] bg-white px-6 py-3 md:px-12">
   <img src="/bjc-bigc.png" alt="โลโก้ [ชื่อแบรนด์]" className="h-10 w-auto"/>
   <span className="flex items-center gap-4 text-sm text-ink/70"><span className="hidden sm:inline">{isSuper?'ทุกร้าน':name(user.store_id)}</span><span>{user.username} · {user.role}</span><button className="underline" onClick={logout}>ออกจากระบบ</button></span></header>
  <main className="mx-auto max-w-7xl px-6 py-8">
   <h1 className="text-3xl md:text-4xl">ตารางปฏิทินและคิวการจอง</h1>
   <p className="mb-6 mt-1 text-ink/70">เลือกวันที่บนปฏิทินเพื่อดูและจัดการคิวของวันนั้น</p>
   <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
    {[['คิวทั้งหมด',live,''],['ยืนยันแล้ว',cnt('CONFIRMED'),'text-[#14532d]'],['เสร็จสิ้น',cnt('COMPLETED'),'text-[#0c3b66]'],['รอยืนยัน',cnt('PENDING'),'text-[#92400e]'],['ยกเลิก',cnt('CANCELLED'),'text-[#9f1239]']].map(([l,v,c])=>
     <div key={l} className="card px-5 py-4"><p className="text-sm text-ink/70">{l}</p><p className={`font-display text-4xl font-bold ${c}`}>{v}</p></div>)}</div>
   {err&&<p role="alert" className="mb-3 text-red-800">{err}</p>}
   <div className="grid items-start gap-6 lg:grid-cols-12">
    <div className="grid gap-4 lg:col-span-5">
     <section className="card" aria-label="ปฏิทิน">
      <div className="mb-3 flex items-center justify-between gap-2">
       <button className="chip px-4 no-underline" aria-label="เดือนก่อนหน้า" onClick={()=>setOff(off-1)}>‹</button>
       <b className="font-display text-lg">{m.toLocaleDateString('th-TH',{month:'long',year:'numeric'})}</b>
       <button className="chip px-4 no-underline" aria-label="เดือนถัดไป" onClick={()=>setOff(off+1)}>›</button></div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
       {['อา','จ','อ','พ','พฤ','ศ','ส'].map(d=><span key={d} className="py-1 text-sm text-ink/70">{d}</span>)}
       {cells.map((d,i)=>d?<button key={d} aria-pressed={date===d} aria-label={`${+d.slice(8)} ${m.toLocaleDateString('th-TH',{month:'long'})} ${byDay[d]?.n||0} คิว`}
         className={`relative aspect-square cursor-pointer rounded-2xl border-2 p-1 text-left font-semibold hover:bg-sage aria-pressed:border-forest aria-pressed:bg-forest aria-pressed:text-lime ${d===todayIso?'border-[#2fbf58]':'border-transparent'}`} onClick={()=>setDate(d)}>
         <span>{+d.slice(8)}</span>
         {byDay[d]&&<span className={`absolute bottom-1 right-1 min-w-6 rounded-full px-1.5 text-center text-xs font-bold ${byDay[d].p?'bg-[#fbe9c4] text-[#5c3d00]':'bg-[#cfe8dc] text-[#12392c]'}`}>{byDay[d].n}</span>}
        </button>:<span key={'x'+i}/>)}</div>
      <div className="mt-4 flex items-center justify-between border-t border-mist pt-3 text-sm text-ink/70"><span>ตัวเลข = จำนวนคิว · เหลือง = มีคิวรอยืนยัน</span>
       <button className="underline" onClick={()=>{setOff(0);setDate(todayIso)}}>วันนี้</button></div>
     </section>
     {!isSuper&&staffLoaded&&<section className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div><p className="text-sm text-ink/70">พนักงานประจำวันที่เปิดให้จอง</p>
       {byDate[todayIso]?.length?<p className="font-semibold text-[#12392c]">✓ บันทึกพนักงานวันนี้แล้ว</p>:<p className="font-semibold text-[#92400e]">ยังไม่ได้กรอกพนักงานสำหรับวันนี้</p>}
       {byDate[todayIso]?.length>0&&<p className="text-sm text-ink/70">วันนี้ {byDate[todayIso].length} คน: {byDate[todayIso].map(x=>`${x.name} (${x.start}–${x.end})`).join(', ')}</p>}</div>
      <button className="btn btn-o px-4" onClick={()=>setStaffOpen(true)}>{byDate[todayIso]?.length?'แก้ไข':'กรอกตอนนี้'}</button></section>}
     {isSuper&&<section className="card"><p className="mb-3 font-semibold">กรองตามร้าน</p><div className="flex flex-wrap gap-2">
      {[{store_id:'',store_name:'ทุกร้าน'},...stores].map(x=><button key={x.store_id} className="chip" aria-pressed={shop===x.store_id} onClick={()=>setShop(x.store_id)}>{x.store_name}</button>)}</div></section>}
     {isSuper&&staffLoaded&&<section className="card"><p className="mb-1 font-semibold">พนักงานประจำวัน</p><p className="mb-3 text-sm text-ink/70">{dayLabel(date)}</p>{shop?<>{(()=>{const staff=staffForDay(date);return <div><p className="font-semibold">{name(shop)} · {staff.length} คน</p>{staff.length?<ul className="mt-1 text-sm text-ink/70">{staff.map((x,i)=><li key={`${x.name}-${i}`}>{x.name} ({x.start}–{x.end})</li>)}</ul>:<p className="mt-1 text-sm text-ink/70">ยังไม่ได้ระบุพนักงาน</p>}</div>})()}</>:<div className="space-y-3">{stores.map(store=>{const staff=(byDate[date]||[]).filter(x=>x.store_id===store.store_id);return <div key={store.store_id} className="border-b border-mist pb-3 last:border-0 last:pb-0"><p className="font-semibold">{store.store_name} · {staff.length} คน</p>{staff.length?<ul className="mt-1 text-sm text-ink/70">{staff.map((x,i)=><li key={`${x.name}-${i}`}>{x.name} ({x.start}–{x.end})</li>)}</ul>:<p className="mt-1 text-sm text-ink/70">ยังไม่ได้ระบุพนักงาน</p>}</div>})}</div>}</section>}
    </div>
    <section className="grid gap-4 lg:col-span-7" aria-live="polite">
     <div className="card">
      <h2 className="text-xl">คิววัน{new Date(date+'T00:00').toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h2>
      <p className="mb-3 text-ink/70">{live} รายการ · เวลาทำการ 08:00 – 20:00 น.</p>
      <div className="flex flex-wrap items-center gap-2">{['ALL',...Object.keys(ST)].map(k=><button key={k} className="chip" aria-pressed={tab===k} onClick={()=>setTab(k)}>{k==='ALL'?'ทั้งหมด':ST[k][0]} ({k==='ALL'?live:cnt(k)})</button>)}</div>
      <label className="lbl relative mb-0 mt-3">ค้นหาคิว<input className="field" placeholder="ชื่อลูกค้า รหัสพนักงาน เบอร์ รหัสคิว บริการ หรือแผนก" value={q} onFocus={()=>setSearchOpen(true)} onChange={e=>{setQ(e.target.value);setSearchOpen(true);setShowAllMatches(false)}} onKeyDown={e=>{if(e.key==='Escape')setSearchOpen(false)}} />
       {searchOpen&&needle&&<div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-mist bg-white shadow-lg">{searchMatches.length?<><div className="max-h-72 overflow-y-auto">{searchMatches.slice(0,showAllMatches?undefined:5).map(b=><button type="button" key={b.booking_id} className="flex w-full items-center justify-between gap-3 border-b border-mist px-4 py-3 text-left hover:bg-sage" onMouseDown={e=>e.preventDefault()} onClick={()=>{setDate(b.booking_date);setTab('ALL');setQ('');setSearchOpen(false);setShowAllMatches(false)}}><span><b className="block">{b.customer_name||b.emp_id||b.booking_id}</b><span className="text-xs text-ink/70">{b.booking_id} · {b.booking_date} {b.booking_time} · {b.service_name}</span></span><span aria-hidden="true" className="text-xl">›</span></button>)}</div>{searchMatches.length>5&&!showAllMatches&&<button type="button" className="w-full bg-sage px-4 py-3 text-left font-semibold hover:bg-mist" onMouseDown={e=>e.preventDefault()} onClick={()=>setShowAllMatches(true)}>ดูทั้งหมด {searchMatches.length} คิว ›</button>}</>:<p className="px-4 py-3 text-sm text-ink/70">ไม่พบคิวที่ตรงกับคำค้น</p>}</div>}</label>
     </div>
     <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto"><div className="relative min-w-[520px]" style={{height:HOURS.length*PX}}>
       {HOURS.map(h=><div key={h} className="flex border-b border-mist" style={{height:PX}}><span className="w-16 shrink-0 border-r border-mist bg-white pr-3 pt-2 text-right font-mono text-xs font-bold text-ink/70">{String(h).padStart(2,'0')}:00</span></div>)}
       <div className="absolute inset-y-0 left-16 right-2">
        {!arr.length&&<p className="absolute inset-x-0 top-24 text-center text-ink/70">ไม่มีคิวในวันที่เลือก</p>}
        {arr.map(p=><button key={p.b.booking_id} onClick={()=>setSel(p.b.booking_id)} className={`absolute overflow-hidden rounded-xl border p-2 text-left shadow-xs hover:shadow-md ${BOX[p.b.status]||''}`}
          style={{top:(p.s-480)/60*PX+2,height:Math.max(40,(p.e-p.s)/60*PX-4),left:`calc(${p.c/cols*100}% + 2px)`,width:`calc(${100/cols}% - 4px)`}}>
         <span className="flex items-center justify-between gap-2"><b className="truncate text-sm">{p.b.customer_name}</b><span className="shrink-0 text-xs font-semibold">{ST[p.b.status]?.[0]}</span></span>
         <span className="block truncate text-xs">{hhmm(p.s)}–{hhmm(p.e)} · {p.b.service_name}{isSuper&&` · ${name(p.b.store_id)}`}</span></button>)}
       </div></div></div>
      <div className="flex flex-wrap gap-4 border-t border-mist bg-sage px-4 py-3 text-xs text-ink/70">{Object.entries(ST).map(([k,v])=><span key={k} className="flex items-center gap-1.5"><span className={`size-3 rounded border ${BOX[k]}`}/>{v[0]}</span>)}</div>
     </div>
    </section>
   </div></main>
  {staffOpen&&<StaffDialog dates={liveDates} byDate={byDate} today={todayIso} onClose={()=>setStaffOpen(false)} onSave={async(ds,rows)=>{const r=await api('saveStaff',{...auth,dates:ds,staff:rows});const m=groupStaff(r.rows);setByDate(m)}}/>}
  {cur&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" onClick={()=>setSel(null)}>
   <div role="dialog" aria-modal="true" aria-label="รายละเอียดคิว" className="card max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto" onClick={e=>e.stopPropagation()}>
    <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-sm text-ink/70">{cur.booking_id}</p><h2 className="text-2xl">{cur.customer_name}</h2></div>
     <span className={`rounded-full px-3 py-1 text-sm font-semibold ${ST[cur.status]?.[1]}`}>{ST[cur.status]?.[0]||cur.status}</span></div>
    {[['เวลา',`${cur.booking_date} · ${cur.booking_time}–${hhmm(toMin(cur.booking_time)+(cur.duration_minutes||60))}`],['บริการ',cur.service_name],['พนักงานที่รับคิว',cur.staff_name],['ร้าน',name(cur.store_id)],['รหัสพนักงาน',cur.emp_id],['บริษัท',cur.company],['ฝ่าย',cur.division],['แผนก',cur.department],['เบอร์',cur.phone],['อีเมล',cur.email],['จองเมื่อ',cur.created_at],['อีเมลยืนยัน',EM[cur.confirmation_email]||cur.confirmation_email],['อีเมลเตือน',EM[cur.reminder_email]||cur.reminder_email]].filter(([,v])=>v).map(([k,v])=><p key={k} className="flex justify-between gap-3 border-b border-mist py-2"><span className="text-ink/70">{k}</span><span className="break-all text-right">{v}</span></p>)}
    <label className="lbl mt-4">เปลี่ยนสถานะ<select className="field" disabled={busy===cur.booking_id} value={statusDraft} onChange={e=>setStatusDraft(e.target.value)}>{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v[0]}</option>)}</select></label>
    <div className="flex flex-wrap justify-end gap-2"><button className="btn btn-o px-4" disabled={busy===cur.booking_id} onClick={()=>resend(cur)}>ส่งอีเมลยืนยันอีกครั้ง</button><button className="btn btn-o px-4" disabled={busy===cur.booking_id||statusDraft===cur.status} onClick={()=>setStatus(cur,statusDraft)}>{busy===cur.booking_id?'กำลังบันทึก…':'บันทึกสถานะ'}</button><button className="btn px-4" onClick={()=>setSel(null)}>ปิด</button></div>
   </div></div>}
 </div>)}