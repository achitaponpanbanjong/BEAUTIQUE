export default function Nav({go,hideOwner,loggedIn,onLogout}){return(
 <header className="flex items-center justify-between border-b-4 border-[#114728] bg-white px-6 py-3 md:px-12">
  <button onClick={()=>go('home')} aria-label="กลับหน้าแรก"><img src="/bjc-bigc.png" alt="โลโก้ [ชื่อแบรนด์]" className="h-10 w-auto"/></button>
  {!hideOwner&&(loggedIn
   ?<div className="flex items-center gap-4">
     <button onClick={()=>go('my-bookings')} className="btn btn-o min-h-0 px-4 py-1.5 text-sm">คิวของฉัน</button>
     <button onClick={onLogout} className="text-sm text-ink/70 underline">ออกจากระบบ</button></div>
   :<button onClick={()=>go('login')} className="text-sm text-ink/70 underline">เข้าสู่ระบบ</button>)}
 </header>)}