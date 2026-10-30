import {useEffect,useState} from 'react'
import {api} from './api'
import {Login,Dashboard} from './Admin'
import Nav from './Header'
import GlassBubbles from './GlassBubbles'

const MASSAGE_URL=import.meta.env.VITE_MASSAGE_URL||'https://www.fresha.com/th'
const iso=d=>d.toLocaleDateString('sv-SE')
const toMin=t=>{const [h,m]=String(t).split(':');return +h*60+ +m}
const hhmm=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`
const fmt=(v,o)=>new Date(v+'T00:00').toLocaleDateString('th-TH',o)
const SLOTS=[...Array(24)].map((_,i)=>`${String(8+(i>>1)).padStart(2,'0')}:${i%2?'30':'00'}`)
// ใส่รูปที่ image เช่น '/img/massage.jpg' (วางไฟล์ไว้ใน public/img/) — ว่างไว้ = กล่องเปล่า
const contactText=st=>st?.phone?`โปรดติดต่อเบอร์ร้าน ${st.phone}`:'โปรดติดต่อร้านโดยตรง'
const cache={staff:{},svc:{}} // แคชฝั่งเบราว์เซอร์: ผลเช็กพนักงานและรายการบริการ (โหลดล่วงหน้า)
const CATS=[
 {type:'MASSAGE',title:'ร้านนวด',image:'/MASSAGE.PNG'},
 {type:'NAIL',title:'ร้านทำเล็บ',image:'/NAIL.jpg'},
 {type:'HAIR',title:'ร้านเสริมสวย',image:'/HAIR.jpg'}]


function ClosedNotice({info,onClose}){
 useEffect(()=>{const k=e=>e.key==='Escape'&&onClose();addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[])
 return(<div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" onClick={onClose}>
  <div role="alertdialog" aria-modal="true" aria-labelledby="closed-title" className="card w-full max-w-md text-center" onClick={e=>e.stopPropagation()}>
   <h2 id="closed-title" className="text-2xl">{info.error?'ตรวจสอบสถานะร้านไม่สำเร็จ':'ร้านปิดให้บริการ'}</h2>
   <p className="mb-5 mt-3 text-ink/80">{info.error?info.error:`${info.name} ยังไม่เปิดรับจองในขณะนี้ (ร้านยังไม่ได้ระบุพนักงาน) ${contactText({phone:info.phone})}`}</p>
   <button className="btn px-8" autoFocus onClick={onClose}>ตกลง</button></div></div>)}

function Back(){return <button type="button" onClick={()=>history.back()} className="btn btn-o mb-5 min-h-0 whitespace-nowrap px-5 py-1.5 text-sm xl:absolute xl:right-full xl:top-1/2 xl:mb-0 xl:mr-4 xl:-translate-y-1/2 xl:px-4">← ย้อนกลับ</button>}

function Steps({n}){return(
 <ol className="mb-7 flex flex-wrap gap-2.5 text-sm">{['บริการ','วัน-เวลา','ข้อมูล & ยืนยัน'].map((t,i)=>
  <li key={t} className={`rounded-full px-5 py-2 ${i+1===n?'bg-forest font-semibold text-lime':'bg-mist text-ink/70'}`}>{i+1} · {t}</li>)}</ol>)}

function Summary({s,children}){return(
 <aside className="card sticky top-4">
  <h3 className="mb-3 text-lg">สรุปการจอง</h3>
  <p className="text-ink/70">{s.store?.store_name}</p>
  {s.service&&<div className="flex justify-between border-b border-mist py-3"><span>{s.service.service_name}</span><span className="text-ink/70">{s.service.duration_minutes} นาที</span></div>}
  {s.date&&s.time&&<p className="py-3">{fmt(s.date,{weekday:'short',day:'numeric',month:'short'})} · {s.time}–{hhmm(toMin(s.time)+(s.service?.duration_minutes||60))}</p>}
  <p className="flex justify-between py-2 font-semibold"><span>จำนวน</span><span>{s.service?.count||0} บริการ</span></p>
  {children}
 </aside>)}

const FAN=['w-[38%] -mr-6 z-10 -rotate-6 translate-y-6','w-[42%] z-20 -translate-y-2','w-[38%] -ml-6 z-10 rotate-6 translate-y-6']
function Home({stores,err,pick}){return(
  <div className="relative overflow-hidden bg-linear-to-b from-white to-[#e4f3e8]">
  <GlassBubbles/>
  <section className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pb-20 pt-14 text-center">
    
    <h1 className="text-4xl font-bold text-balance text-[#114728] md:text-6xl">คุณอยากจอง<span className="ml-2 inline-block rounded-2xl bg-[#114728] px-4 text-[#2fbf58] shadow-[0_0_32px_rgba(47,191,88,.45)]">อะไร?</span></h1>
    <p className="mt-5 max-w-md text-balance text-lg text-[#114728]/80">เลือกประเภทร้านที่ต้องการ</p>
    <div className="mt-12 flex w-full max-w-2xl items-center justify-center">
    {CATS.map((c,i)=>{const s=stores.find(x=>x.store_type===c.type)
      const cls=`relative aspect-4/5 shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-mist shadow-xl outline outline-black/10 transition duration-500 starting:translate-y-10 starting:opacity-0 hover:z-30 hover:-translate-y-3 hover:rotate-0 focus-visible:z-30 focus-visible:ring-4 focus-visible:ring-forest disabled:cursor-not-allowed disabled:opacity-60 ${FAN[i]}`
      const body=<>{c.image&&<img src={c.image} alt="" className="size-full object-cover"/>}<span className="absolute inset-x-0 bottom-0 bg-forest px-2 py-3 text-sm font-semibold text-white md:text-lg">{c.title}</span></>
      return c.type==='MASSAGE'
      ?<a key={c.type} className={cls} href={MASSAGE_URL} target="_blank" rel="noopener" aria-label={c.title+' (เปิดเว็บ Fresha)'}>{body}</a>
      :<button key={c.type} className={cls} disabled={!s} onClick={()=>pick(s)} aria-label={c.title}>{body}</button>})}
    </div>
    {err&&<p role="alert" className="mt-8 text-red-800">โหลดรายชื่อร้านไม่สำเร็จ: {err}</p>}
  </section></div>)}

function Services({s,set,go}){
 const [list,setList]=useState(cache.svc[s.store.store_id]||null),[err,setErr]=useState('')
 useEffect(()=>{api('getServices',{store_id:s.store.store_id}).then(r=>{cache.svc[s.store.store_id]=r.services;setList(r.services)}).catch(e=>setErr(e.message))},[s.store])
 const picked=s.picked||[]
 function toggle(v){
  const ids=picked.includes(v.service_id)?picked.filter(x=>x!==v.service_id):[...picked,v.service_id]
  const ch=(list||[]).filter(x=>ids.includes(x.service_id))
  set({picked:ids,time:'',service:ch.length?{service_id:ch.map(x=>x.service_id).join(','),service_name:ch.map(x=>x.service_name).join(' + '),duration_minutes:ch.reduce((a,x)=>a+(Number(x.duration_minutes)||0),0),count:ch.length}:undefined})}
 return(<div className="mx-auto max-w-5xl px-6 py-9"><div className="relative"><Back/><Steps n={1}/></div>
  <div className="grid items-start gap-8 md:grid-cols-[1fr_340px]"><div>
   <h1 className="text-3xl">เลือกบริการ</h1><p className="mb-1 text-ink/70">{s.store.store_name}</p><p className="mb-4 text-sm text-ink/70">เลือกได้หลายบริการพร้อมกัน ระบบจะรวมระยะเวลาและล็อกช่วงเวลาให้ต่อเนื่อง</p>
   <div className="card py-2">
    {!list&&!err&&<p className="py-4">กำลังโหลด…</p>}{err&&<p role="alert" className="py-4 text-red-800">{err}</p>}
    {list?.map(v=><label key={v.service_id} className="flex cursor-pointer items-center justify-between gap-4 border-b border-mist py-4 last:border-0">
     <span className="flex items-center gap-3"><input type="checkbox" className="size-5 accent-forest" checked={picked.includes(v.service_id)} onChange={()=>toggle(v)}/>
      <span><b>{v.service_name}</b><br/><span className="text-ink/70">{v.duration_minutes} นาที</span></span></span><b>1 บริการ</b></label>)}
   </div></div>
   <Summary s={s}><button className="btn mt-2 w-full" disabled={!s.service} onClick={()=>go('datetime')}>ต่อไป: เลือกวัน-เวลา</button></Summary>
  </div></div>)}

const MAX_DAYS=7 // จองล่วงหน้าได้ไม่เกินกี่วัน
function Calendar({value,onPick,closed=[],open}){
 const [off,setOff]=useState(0),now=new Date()
 const m=new Date(now.getFullYear(),now.getMonth()+off,1),today=iso(now)
 const last=new Date();last.setDate(last.getDate()+MAX_DAYS);const maxIso=iso(last)
 const n=new Date(m.getFullYear(),m.getMonth()+1,0).getDate()
 const cells=[...Array(m.getDay()).fill(null),...Array.from({length:n},(_,i)=>iso(new Date(m.getFullYear(),m.getMonth(),i+1)))]
 return(<div className="card mb-7 max-w-md">
  <div className="mb-3 flex items-center justify-between">
   <button type="button" aria-label="เดือนก่อนหน้า" className="chip px-4 no-underline" disabled={off<=0} onClick={()=>setOff(off-1)}>‹</button>
   <b className="font-display">{m.toLocaleDateString('th-TH',{month:'long',year:'numeric'})}</b>
   <button type="button" aria-label="เดือนถัดไป" className="chip px-4 no-underline" disabled={iso(new Date(m.getFullYear(),m.getMonth()+1,1))>maxIso} onClick={()=>setOff(off+1)}>›</button></div>
  <div className="grid grid-cols-7 gap-1 text-center">
   {['อา','จ','อ','พ','พฤ','ศ','ส'].map(d=><span key={d} className="py-1 text-sm text-ink/70">{d}</span>)}
   {cells.map((d,i)=>d?<button key={d} type="button" className="chip aspect-square px-0 no-underline" disabled={d<today||d>maxIso||[0,6].includes(new Date(d+'T00:00').getDay())||closed.includes(d)||(open&&!open.includes(d))} aria-pressed={value===d} onClick={()=>onPick(d)}>{+d.slice(8)}</button>:<span key={'x'+i}/>)}
  </div>
  <p className="mt-3 text-sm text-ink/70">จองได้เฉพาะวันจันทร์–ศุกร์ ไม่รวมวันหยุดนักขัตฤกษ์ และจองล่วงหน้าได้ไม่เกิน {MAX_DAYS} วัน · วันที่ร้านยังไม่ได้ระบุพนักงานจะกดไม่ได้</p></div>)}

function DateTime({s,set,go}){
 const today=iso(new Date())
 const [slots,setSlots]=useState(null),[err,setErr]=useState(''),[hol,setHol]=useState([]),[holErr,setHolErr]=useState(false),[msg,setMsg]=useState('')
 useEffect(()=>{const to=new Date();to.setDate(to.getDate()+MAX_DAYS);api('getHolidays',{from:today,to:iso(to)}).then(r=>{setHol(r.holidays);if(r.warning)setHolErr(true)}).catch(()=>setHolErr(true))},[])
 useEffect(()=>{if(!s.date)return;setSlots(null);setErr('');api('getAvailableSlots',{store_id:s.store.store_id,date:s.date,service_id:s.service.service_id}).then(setSlots).catch(e=>setErr(e.message))},[s.date,s.store.store_id,s.service.service_id])
 const now=new Date().toTimeString().slice(0,5),dur=s.service.duration_minutes||60
 const closed=!!slots&&!slots.open
 const why=t=>{if(!slots)return'loading';if(closed)return'closed';if(s.date===today&&t<=now)return'past';const st=slots.slots[t];return st==='short'?'short':st==='full'?'taken':''}
 const note=(t,r)=>r==='past'?'เวลานี้ผ่านไปแล้ว':r==='taken'?'ช่วงเวลานี้ไม่มีพนักงานว่าง (คิวเต็มหรืออยู่นอกเวลางานของพนักงาน) กรุณาเลือกเวลาอื่น':`ไม่สามารถจองได้เนื่องจากเวลาไม่เพียงพอ: เริ่ม ${t} ต้องใช้ ${dur} นาที (ถึง ${hhmm(toMin(t)+dur)} น.) ${toMin(t)+dur>1200?'เกินเวลาปิด 20:00 น.':'พนักงานที่ว่างมีเวลาไม่พอสำหรับบริการนี้'} กรุณาเลือกเวลาอื่น`
 return(<div className="mx-auto max-w-5xl px-6 py-9"><div className="relative"><Back/><Steps n={2}/></div>
  <div className="grid items-start gap-8 md:grid-cols-[1fr_340px]"><div>
   <h1 className="mb-4 text-3xl">เลือกวันและเวลา</h1>
   {holErr&&<p role="alert" className="mb-3 text-sm text-red-800">โหลดวันหยุดไม่สำเร็จ ระบบจะตรวจสอบอีกครั้งตอนยืนยันการจอง</p>}<Calendar value={s.date} onPick={d=>{setMsg('');set({date:d,time:''})}} closed={hol} open={s.openDates}/>
   <h2 className="mb-1 text-lg">เวลาที่ว่าง</h2><p className="mb-3 text-sm text-ink/70">บริการนี้ใช้เวลา {dur} นาที ระบบจะล็อกช่วงเวลาต่อเนื่องให้ตามระยะเวลาบริการ</p>{err&&<p role="alert" className="text-red-800">{err}</p>}
   {s.date?<>{closed&&<p role="alert" className="mb-3 rounded-2xl bg-[#fde4e1] px-4 py-3 font-semibold text-[#6b1a12]">ร้านปิดในวันที่เลือก เนื่องจากยังไม่ได้ระบุพนักงานประจำวัน {contactText(s.store)}</p>}{slots?.open&&<p className="mb-3 text-sm text-ink/70">พนักงานประจำวัน {slots.staff} คน · จองเวลาเดียวกันได้ตามจำนวนพนักงานที่ว่าง</p>}{msg&&<p role="alert" className="mb-3 rounded-2xl bg-[#fde4e1] px-4 py-3 font-semibold text-[#6b1a12]">{msg}</p>}{s.time&&<p className="mb-3 font-semibold text-[#12392c]">ช่วงที่ล็อกให้คุณ: {s.time}–{hhmm(toMin(s.time)+dur)} น. ({dur} นาที)</p>}
   <div className="grid grid-cols-3 gap-2.5 md:grid-cols-4">{SLOTS.map(t=>{const r=why(t),cov=s.time&&s.time!==t&&toMin(t)>=toMin(s.time)&&toMin(t)<toMin(s.time)+dur
    return <button key={t} type="button" className={`chip aria-disabled:cursor-not-allowed aria-disabled:border-[#e9ece7] aria-disabled:bg-[#e9ece7] aria-disabled:text-[#5f6b66] ${r&&r!=='short'?'aria-disabled:line-through':''} ${cov?'border-forest bg-forest text-lime':''}`} aria-pressed={s.time===t} aria-disabled={!!r} aria-label={cov?`${t} อยู่ในช่วงเวลาที่เลือก`:undefined} onClick={()=>{if(r){if(r!=='loading'&&r!=='closed')setMsg(note(t,r));return}setMsg('');set({time:t})}}>{t}</button>})}</div></>:<p className="text-ink/70">เลือกวันก่อน แล้วเวลาที่ว่างจะแสดงที่นี่</p>}
  </div>
  <Summary s={s}><button className="btn mt-2 w-full" disabled={!s.date||!s.time} onClick={()=>go('details')}>ต่อไป: กรอกข้อมูล</button></Summary>
 </div></div>)}

function Details({s,set,go,employee}){
 const [code,setCode]=useState(employee?.emp_id||''),[emp,setEmp]=useState(employee||null),[phone,setPhone]=useState(''),[phoneHadInvalid,setPhoneHadInvalid]=useState(false)
 const [chk,setChk]=useState(false),[busy,setBusy]=useState(false),[err,setErr]=useState('')
 const phoneInvalid=phone.length>0&&phone.length!==10
 const ok=emp&&/^\d{10}$/.test(phone)
 async function verify(){if(!code.trim())return;setChk(true);setErr('');setEmp(null)
  try{const r=await api('verifyEmployee',{emp_id:code.trim()});setEmp(r.employee)}catch(x){setErr(x.message)}setChk(false)}
 async function submit(e){e.preventDefault();if(!ok)return;setBusy(true);setErr('')
  try{const r=await api('createBooking',{store_id:s.store.store_id,emp_id:emp.emp_id,phone,service_id:s.service.service_id,service_name:s.service.service_name,duration_minutes:s.service.duration_minutes,booking_date:s.date,booking_time:s.time})
   set({booking_id:r.booking_id,customer:{name:emp.full_name,phone,email:emp.email}});go('success')}catch(x){setErr(x.message)}setBusy(false)}
 return(<div className="mx-auto max-w-5xl px-6 py-9"><div className="relative"><Back/><Steps n={3}/></div>
  <form onSubmit={submit} className="grid items-start gap-8 md:grid-cols-[1fr_340px]">
   <div className="card"><h1 className="mb-5 text-3xl">ข้อมูลผู้จอง</h1>
    <label className="lbl">รหัสพนักงาน
     <span className="mt-1.5 flex gap-2"><input className="field mt-0" required value={code} placeholder="กรอกรหัสพนักงาน" onChange={e=>{setCode(e.target.value);setEmp(null);setErr('')}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();verify()}}}/>
      <button type="button" className="btn shrink-0" disabled={!code.trim()||chk} onClick={verify}>{chk?'กำลังตรวจสอบ…':'ตรวจสอบ'}</button></span></label>
    {emp&&<div className="mb-4 rounded-2xl bg-sage p-4"><p className="mb-1 font-semibold text-[#12392c]">✓ ตรวจสอบแล้ว เป็นพนักงาน</p>
     {[['บริษัท',emp.company],['ชื่อ-นามสกุล',emp.full_name],['ฝ่าย (Division)',emp.division],['แผนก (Department)',emp.department],['อีเมล',emp.email]].map(([k,v])=>
      <p key={k} className="flex justify-between gap-4 border-t border-mist py-2"><span className="text-ink/70">{k}</span><span className="break-all text-right">{v||'-'}</span></p>)}</div>}
    {emp&&<label className="lbl">เบอร์โทรศัพท์ (กรอกเอง เผื่อเปลี่ยนเบอร์)<input className="field" required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="0812345678" value={phone} onChange={e=>{const raw=e.target.value;setPhoneHadInvalid(/\D/.test(raw));setPhone(raw.replace(/\D/g,'').slice(0,10))}}/>{(phoneHadInvalid||phoneInvalid)&&<span role="alert" className="mt-1 block text-sm text-red-800">{phoneHadInvalid?'กรอกได้เฉพาะตัวเลขเท่านั้น':'กรุณากรอกหมายเลขโทรศัพท์ให้ครบ 10 หลัก'}</span>}</label>}
    {!emp&&!err&&<p className="text-sm text-ink/70">กรอกรหัสพนักงานแล้วกด "ตรวจสอบ" เพื่อดำเนินการต่อ</p>}
    {err&&<p role="alert" className="text-red-800">{err}</p>}</div>
   <Summary s={s}><button className="btn mt-2 w-full" disabled={!ok||busy}>{busy?'กำลังจอง…':'ยืนยันการจอง'}</button></Summary>
  </form></div>)}

function MyBookings({employee,stores,go,pick,logout}){
 const [bookings,setBookings]=useState([]),[err,setErr]=useState(''),[loading,setLoading]=useState(true)
 useEffect(()=>{if(!employee)return;setLoading(true);api('getEmployeeBookings',{emp_id:employee.emp_id}).then(r=>setBookings(r.bookings||[])).catch(e=>setErr(e.message)).finally(()=>setLoading(false))},[employee])
 const storeName=id=>stores.find(x=>x.store_id===id)?.store_name||id
 const labels={CONFIRMED:'ยืนยันแล้ว',PENDING:'รอยืนยัน',COMPLETED:'เสร็จสิ้น',CANCELLED:'ยกเลิก'}
 const now=new Date()
 const startOf=b=>new Date(`${b.booking_date}T${b.booking_time||'00:00'}`).getTime()
 // คิวปัจจุบัน (ยังไม่จบบริการ) และคิวในอนาคต เรียงจากใกล้ที่สุดก่อน
 const upcoming=bookings.filter(b=>startOf(b)+(b.duration_minutes||60)*60000>now.getTime()).sort((x,y)=>startOf(x)-startOf(y))
 return <div className="min-h-screen bg-linear-to-b from-white to-[#e4f3e8]"><Nav go={go} loggedIn onLogout={logout}/><main className="mx-auto max-w-3xl px-6 py-10"><div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="text-ink/70">สวัสดี</p><h1 className="text-3xl">{employee?.full_name||employee?.emp_id}</h1><p className="mt-1 text-sm text-ink/70">รหัสพนักงาน {employee?.emp_id}</p></div><button className="btn px-5" onClick={()=>go('home')}>+ จองคิวเพิ่ม</button></div><section className="card"><h2 className="text-xl">คิวของฉัน</h2><p className="mb-4 mt-1 text-sm text-ink/70">ดูร้าน บริการ วันและเวลาของคิวปัจจุบันและอนาคต</p>{loading&&<p className="text-ink/70">กำลังโหลดคิว…</p>}{err&&<p role="alert" className="text-red-800">โหลดคิวไม่สำเร็จ: {err}</p>}{!loading&&!err&&!upcoming.length&&<div className="rounded-2xl bg-sage p-5"><p className="font-semibold">ยังไม่มีคิวปัจจุบันหรือคิวในอนาคต</p><p className="mt-1 text-sm text-ink/70">เริ่มจองคิวร้านที่ต้องการได้เลย</p><button className="btn mt-4 px-4" onClick={()=>go('home')}>จองคิวเพิ่ม</button></div>}<div className="space-y-3">{upcoming.map(b=><article key={b.booking_id} className="rounded-2xl border border-mist p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{storeName(b.store_id)}</p><p className="text-sm text-ink/70">{b.service_name}</p></div><span className="rounded-full bg-sage px-3 py-1 text-sm font-semibold text-[#12392c]">{labels[b.status]||b.status}</span></div><p className="mt-3 border-t border-mist pt-3">{fmt(b.booking_date,{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · {b.booking_time}{b.duration_minutes?`–${hhmm(toMin(b.booking_time)+Number(b.duration_minutes))}`:''} น.</p></article>)}</div></section></main></div>}

function Success({s,go}){return(
 <div className="mx-auto max-w-lg px-6 py-14 text-center">
  <svg viewBox="0 0 72 72" className="mx-auto size-18" fill="none" stroke="#0f3d33" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="36" cy="36" r="32"/><path d="M22 37l10 10 18-20"/></svg>
  <h1 className="mt-5 text-4xl">จองคิวสำเร็จ</h1><p className="mb-7 mt-2 text-ink/70">เราส่งอีเมลยืนยันไปที่ {s.customer.email} แล้ว</p>
  <div className="card text-left"><p className="text-ink/70">รหัสการจอง</p><p className="font-display text-2xl font-semibold">{s.booking_id}</p>
   {[['ร้าน',s.store.store_name],['บริการ',s.service.service_name],['วัน-เวลา',`${fmt(s.date,{weekday:'short',day:'numeric',month:'short',year:'numeric'})} · ${s.time}–${hhmm(toMin(s.time)+(s.service.duration_minutes||60))}`],['ผู้จอง',`${s.customer.name} · ${s.customer.phone}`]].map(([k,v])=>
    <p key={k} className="flex justify-between gap-4 border-t border-mist py-3"><span className="text-ink/70">{k}</span><span>{v}</span></p>)}</div>
  <button className="btn mt-6" onClick={()=>go('home')}>กลับหน้าแรก</button></div>)}

export default function App(){
 const [view,setView]=useState('home'),[stores,setStores]=useState([]),[err,setErr]=useState(''),[user,setUser]=useState(null),[employee,setEmployee]=useState(null)
 const [s,setS]=useState({}),set=p=>setS(o=>({...o,...p}))
 const go=v=>{history.pushState({v},'');setView(v)}
 useEffect(()=>{history.replaceState({v:'home'},'');const pop=e=>setView(e.state?.v||'home');addEventListener('popstate',pop);return()=>removeEventListener('popstate',pop)},[])
 useEffect(()=>{api('getStores').then(r=>setStores(r.stores)).catch(e=>setErr(e.message))},[])
 const [closedInfo,setClosedInfo]=useState(null),[picking,setPicking]=useState(false)
 const openFrom=(store,r)=>{setS({store:{...store,phone:r.phone||store.phone},openDates:r.dates});go('services')}
 const pick=async store=>{
  if(picking)return
  const c=cache.staff[store.store_id]
  if(c&&c.r.dates.length&&Date.now()-c.t<60000){openFrom(store,c.r);return} // เพิ่งเช็กไว้และร้านเปิด → เข้าทันที
  setPicking(true)
  try{const r=await api('getStoreStaff',{store_id:store.store_id});cache.staff[store.store_id]={t:Date.now(),r}
   if(!r.dates.length){setClosedInfo({name:store.store_name,phone:r.phone||store.phone||''});return}
   openFrom(store,r)
  }catch(e){setClosedInfo({error:e.message})}finally{setPicking(false)}}
 useEffect(()=>{stores.forEach(st=>{
  api('getStoreStaff',{store_id:st.store_id}).then(r=>{cache.staff[st.store_id]={t:Date.now(),r}}).catch(()=>{})
  api('getServices',{store_id:st.store_id}).then(r=>{cache.svc[st.store_id]=r.services}).catch(()=>{})})},[stores])
 const notice=<>{closedInfo&&<ClosedNotice info={closedInfo} onClose={()=>setClosedInfo(null)}/>}{picking&&<p role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-forest px-5 py-2 font-semibold text-white shadow-xl">กำลังตรวจสอบร้าน…</p>}</>
 if(view==='login'||(view==='dashboard'&&!user)||(view==='my-bookings'&&!employee)) return <Login setUser={u=>{setUser(u);go('dashboard')}} setEmployee={setEmployee} go={go}/>
 if(view==='dashboard'&&user) return <Dashboard user={user} stores={stores} logout={()=>{setUser(null);go('home')}}/>
 if(view==='my-bookings'&&employee) return <><MyBookings employee={employee} stores={stores} go={go} pick={pick} logout={()=>{setEmployee(null);go('home')}}/>{notice}</>
 return(<><Nav go={go} loggedIn={!!employee} onLogout={()=>{setEmployee(null);go('home')}}/>
  {view==='home'&&<Home stores={stores} err={err} pick={pick}/>}
  {view==='services'&&<Services s={s} set={set} go={go}/>}
  {view==='datetime'&&<DateTime s={s} set={set} go={go}/>}
  {view==='details'&&<Details s={s} set={set} go={go} employee={employee}/>}
  {view==='success'&&<Success s={s} go={go}/>}{notice}</>)}