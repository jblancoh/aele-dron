/* oxlint-disable next/no-img-element -- Assets are precompressed locally with explicit dimensions; no runtime image optimizer is deployed. */
'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowDown} from 'lucide-react';
import {FRAME_COUNT,frameIndex} from '@/lib/scroll';
import {useMotion} from './motion-context';
const phrases=[['Cambia el ángulo.','Descubre lo que no se ve desde abajo.'],['Amplía la emoción.','El lugar. Las personas. Todo lo que importa.'],['Conserva el momento.','Una historia que puedes volver a vivir.']];
export function ScrollStory(){
 const section=useRef<HTMLElement>(null),canvas=useRef<HTMLCanvasElement>(null);const {paused,reduced,desktop,saveData}=useMotion();const eligible=desktop&&!reduced&&!saveData;const [chapter,setChapter]=useState(0);const [frame,setFrame]=useState(0);
 useEffect(()=>{
  if(!eligible||paused)return;
  const element=section.current,surface=canvas.current;if(!element||!surface)return;
  const context=surface.getContext('2d');if(!context)return;
  let disposed=false,active=false,loading=false,nextFrame=0,raf=0,last=-1;const frames=new Map<number,HTMLImageElement>();
  const draw=()=>{raf=0;if(disposed||!active||document.hidden)return;const bounds=element.getBoundingClientRect();const progress=Math.max(0,Math.min(1,-bounds.top/Math.max(1,bounds.height-window.innerHeight)));const index=frameIndex(progress);setChapter(Math.min(2,Math.floor(progress*3)));setFrame(index);const image=frames.get(index);if(!image||last===index)return;context.drawImage(image,0,0,surface.width,surface.height);surface.style.opacity='1';last=index;};
  const schedule=()=>{if(!raf&&active)raf=requestAnimationFrame(draw);};
  const load=async()=>{if(loading||disposed||!active||document.hidden)return;loading=true;while(nextFrame<FRAME_COUNT&&!disposed&&active&&!document.hidden){const start=nextFrame;nextFrame+=5;await Promise.all(Array.from({length:Math.min(5,FRAME_COUNT-start)},(_,offset)=>new Promise<void>(resolve=>{const index=start+offset;const image=new Image();image.onload=()=>{if(!disposed){frames.set(index,image);schedule();}resolve();};image.onerror=()=>resolve();image.src=`/media/frames/coast-${String(index+1).padStart(2,'0')}.jpg`;})));}loading=false;};
  const onVisibility=()=>{if(!document.hidden){void load();schedule();}};
  const observer=new IntersectionObserver(entries=>{active=entries[0].isIntersecting;if(active){void load();schedule();}},{rootMargin:'250px'});observer.observe(element);window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);document.addEventListener('visibilitychange',onVisibility);
  return()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);document.removeEventListener('visibilitychange',onVisibility);frames.clear();surface.style.opacity='0';};
 },[paused,eligible]);
 return <section className={`scroll-story ${!eligible?'static-story':''}`} ref={section} aria-label="Una nueva perspectiva">
  <div className="story-sticky"><img className="story-image" src="/media/coast-poster.jpg" width="1280" height="720" alt="Paisaje aéreo de muestra" loading="lazy"/><canvas ref={canvas} className="story-canvas" width="960" height="540" aria-hidden="true"/><div className="story-shade"/><div className="story-eyebrow eyebrow">02 / UNA NUEVA PERSPECTIVA</div><div className="story-copy"><p className="eyebrow">MIRA MÁS ALLÁ</p><h2>{phrases[chapter][0]}</h2><p>{phrases[chapter][1]}</p></div><div className="story-bottom"><span><ArrowDown size={16}/> SIGUE EXPLORANDO</span><div className="story-progress" aria-hidden="true"><i style={{transform:`scaleX(${(frame+1)/FRAME_COUNT})`}}/></div><span className="sample-tag">SECUENCIA DE MUESTRA</span></div></div>
 </section>;
}
