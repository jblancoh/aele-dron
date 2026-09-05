/* oxlint-disable next/no-img-element -- Assets are precompressed locally with explicit dimensions; no runtime image optimizer is deployed. */
'use client';
import { useEffect,useRef,useState } from 'react';
import { Pause,Play } from 'lucide-react';
import { useMotion } from './motion-context';
export function HeroVideo(){
 const ref=useRef<HTMLVideoElement>(null);
 const {paused,reduced,desktop,saveData,toggle}=useMotion();

 const [failed,setFailed]=useState(false);
 const [blocked,setBlocked]=useState(false);
 const [manuallyStarted,setManuallyStarted]=useState(false);
 const allowVideo=!reduced&&desktop&&!saveData;
 const enabled=allowVideo||manuallyStarted;
 useEffect(()=>{
  const video=ref.current;if(!video||!enabled||failed)return;
  let visible=true;
  let disposed=false;
  const sync=()=>{if(visible&&!document.hidden&&!paused&&(!reduced||manuallyStarted))void video.play().then(()=>{if(!disposed)setBlocked(false);}).catch(()=>{if(!disposed)setBlocked(true);});else video.pause();};
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.1});observer.observe(video);document.addEventListener('visibilitychange',sync);sync();
  return()=>{disposed=true;observer.disconnect();document.removeEventListener('visibilitychange',sync);video.pause();};
 },[enabled,paused,reduced,manuallyStarted,failed]);
 return <>
  <img className="hero-media" src="/media/coast-poster.jpg" width="1280" height="720" fetchPriority="high" alt="Vista aérea de una bahía tropical; imagen de muestra, no filmada por AELE"/>
  {enabled&&!failed&&<video ref={ref} className="hero-media" muted playsInline loop preload="none" poster="/media/coast-poster.jpg" src="/media/coast.mp4" aria-hidden="true" onError={()=>setFailed(true)}/>}
  <div className="motion-control">
   {(!enabled||blocked)&&!failed?<button onClick={()=>{setManuallyStarted(true);setBlocked(false);if(paused)toggle();void ref.current?.play().catch(()=>setBlocked(true));}} aria-label="Reproducir video de fondo"><Play size={13}/> Reproducir fondo</button>:<button onClick={toggle} aria-pressed={paused} aria-label={paused?'Reanudar movimiento':'Pausar movimiento'}>{paused?<Play size={13}/>:<Pause size={13}/>} {paused?'Reanudar':'Pausar'}</button>}
  </div>
 </>;
}
