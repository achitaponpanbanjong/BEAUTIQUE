const URL=import.meta.env.VITE_API_URL
// ไม่ใส่ header เพื่อให้เป็น simple request (GAS ไม่รองรับ CORS preflight)
export async function api(action,payload={}){
  const res=await fetch(URL,{method:'POST',body:JSON.stringify({action,...payload})})
  const data=await res.json()
  if(!data.success) throw new Error(data.message||'เกิดข้อผิดพลาด')
  return data
}
