import {useEffect,useMemo,useRef} from 'react'

export default function GlassBubbles({count=14}){
 const blobs=useMemo(()=>Array.from({length:count},()=>({
  size:Math.random()**2*190+28,left:Math.random()*90,top:Math.random()*90,
  delay:Math.random()*-20,dur:Math.random()*15+18})),[count])
 const refs=useRef([])
 useEffect(()=>{
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const move=e=>{
   const x=e.clientX/innerWidth-.5,y=e.clientY/innerHeight-.5
   refs.current.forEach((el,i)=>{if(el)el.style.transform=`translate3d(${x*(i+1)*14}px,${y*(i+1)*14}px,0)`})}
  addEventListener('mousemove',move)
  return()=>removeEventListener('mousemove',move)
 },[])
 return(
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
   {blobs.map((b,i)=>(
    <div key={i} ref={el=>{refs.current[i]=el}} className="absolute transition-transform duration-700 ease-out" style={{left:`${b.left}%`,top:`${b.top}%`}}>
     <div className="bubble" style={{width:b.size,height:b.size,animationDelay:`${b.delay}s`,animationDuration:`${b.dur}s`}}/>
    </div>))}
  </div>)}