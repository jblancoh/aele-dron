/* oxlint-disable next/no-img-element -- Assets are precompressed locally with explicit dimensions; no runtime image optimizer is deployed. */
'use client';
import { useEffect,useRef,useState } from 'react';
import { Pause,Play } from 'lucide-react';
import { useMotion } from './motion-context';
export function HeroVideo(){
 const ref=useRef<HTMLVideoElement>(null);
 const {paused,reduced,saveData,networkOk,tier,toggle}=useMotion();

 const [failed,setFailed]=useState(false);
 const [blocked,setBlocked]=useState(false);
 const [manuallyStarted,setManuallyStarted]=useState(false);
 // Autoplays on desktop AND mobile now — the real cost of `coast.mp4` is its 2.4MB download, not
 // decode CPU (hardware-accelerated on any phone), so the gate is network quality (`networkOk`),
 // not viewport width. See `motion-context.tsx`'s `SLOW_NETWORK_TYPES` for the exact thresholds.
 const allowVideo=!reduced&&!saveData&&networkOk;
 const enabled=allowVideo||manuallyStarted;
 // WCAG 2.2.2: any tier that can animate something (the hero video on any device with a good
 // connection, and the lite-tier drone) must expose a way to stop it. Once the
 // visitor has paused, the control must stay reachable regardless of tier so resuming is possible.
 // `tier` alone misses one case: a reduced-motion visitor who manually starts the fallback video.
 // Their tier stays 'none' (starting the video must not wake the global preference and, with it,
 // the drone — see the play handler below), yet the video they just started is running and needs a
 // way to be stopped. `enabled&&!failed` covers exactly that video-is-actually-running case.
 const hasStoppableMotion=tier!=='none'||(enabled&&!failed);
 const canStartVideo=(!enabled||blocked)&&!failed;
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
   {canStartVideo&&<button onClick={()=>{setManuallyStarted(true);setBlocked(false);
     // Starting the fallback video also un-pauses the single shared motion preference. Since
     // Phase 1 persists that preference to localStorage, this click now also writes 'on' to
     // storage and wakes any motion gated on it (e.g. the drone) — not just this video. That is
     // the correct behaviour under "one motion preference for the whole page", but it is a new
     // observable effect now that the preference survives a reload.
     if(paused)toggle();void ref.current?.play().catch(()=>setBlocked(true));}} aria-label="Reproducir video de fondo"><Play size={13}/> Reproducir fondo</button>}
   {(hasStoppableMotion||paused)&&<button onClick={toggle} aria-pressed={paused} aria-label={paused?'Reanudar movimiento':'Pausar movimiento'}>{paused?<Play size={13}/>:<Pause size={13}/>} {paused?'Reanudar':'Pausar'}</button>}
  </div>
 </>;
}
