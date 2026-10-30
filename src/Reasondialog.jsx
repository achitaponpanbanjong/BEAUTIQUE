import {useEffect,useState} from 'react'

// กล่องถามเหตุผลการยกเลิก (ใช้ทั้งฝั่งผู้จองและเจ้าของร้าน)
export default function ReasonDialog({title,desc,confirmLabel,onConfirm,onClose}){
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('')
 useEffect(()=>{const k=e=>e.key==='Escape'&&!busy&&onClose();addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[busy])
 async function submit(e){e.preventDefault();if(!reason.trim())return;setBusy(true);setErr('')
  try{await onConfirm(reason.trim())}catch(x){setErr(x.message);setBusy(false)}}
 return(<div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-4" onClick={()=>!busy&&onClose()}>
  <form role="dialog" aria-modal="true" aria-labelledby="reason-title" onSubmit={submit} onClick={e=>e.stopPropagation()} className="card w-full max-w-md">
   <h2 id="reason-title" className="text-2xl">{title}</h2>{desc&&<p className="mt-1 text-ink/70">{desc}</p>}
   <label className="lbl mt-4">เหตุผลการยกเลิก<textarea className="field min-h-24 py-2" required autoFocus maxLength={300} value={reason} onChange={e=>setReason(e.target.value)} placeholder="เช่น ติดประชุม / เปลี่ยนแผน"/></label>
   {err&&<p role="alert" className="mb-3 text-red-800">{err}</p>}
   <div className="flex justify-end gap-2"><button type="button" className="btn btn-o px-4" disabled={busy} onClick={onClose}>ไม่ยกเลิก</button><button className="btn px-4" disabled={!reason.trim()||busy}>{busy?'กำลังบันทึก…':confirmLabel}</button></div>
  </form></div>)}