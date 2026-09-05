/* oxlint-disable next/no-img-element -- Assets are precompressed locally with explicit dimensions; no runtime image optimizer is deployed. */
'use client';
import {useState} from 'react';
import {ArrowUpRight,Play,X} from 'lucide-react';
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription,DialogClose} from '@/components/ui/dialog';
import {portfolio,type PortfolioItem} from '@/lib/site-content';
function Film({item,index}:{item:PortfolioItem;index:number}){
 const [open,setOpen]=useState(false);const [failed,setFailed]=useState(false);const [attempt,setAttempt]=useState(0);
 return <article className={`film film-${item.aspect} film-${index}`}>
  <Dialog open={open} onOpenChange={value=>{setOpen(value);if(value)setFailed(false);}}>
   <DialogTrigger className="film-trigger" aria-label={`Ver ${item.title}`}>
    <img src={item.poster} alt="" width="1280" height="720" loading="lazy" decoding="async"/>
    <span className="film-vignette"/><span className="film-index">0{index+1}</span>
    {item.demo&&<span className="sample-tag film-sample">MUESTRA</span>}
    <span className="film-play"><Play size={18} fill="currentColor"/><span>VER VIDEO</span></span>
    <span className="film-image-caption">{item.category}<ArrowUpRight size={22}/></span>
   </DialogTrigger>
   <DialogContent className="film-dialog" showCloseButton={false}>
    <div className="player-heading"><DialogTitle>{item.title}</DialogTitle><DialogClose className="icon-button" aria-label="Cerrar video"><X size={23}/></DialogClose></div>
    <DialogDescription>{item.demo?'Video de muestra de Mixkit. No es un proyecto realizado por AELE.':item.description}</DialogDescription>
    {open&&(failed?<div className="player-error"><img src={item.poster} alt="Vista previa del video"/><p role="alert">No pudimos cargar el video. Puedes intentarlo de nuevo.</p><button className="pill" onClick={()=>{setAttempt(n=>n+1);setFailed(false);}}>Reintentar</button></div>:<video key={attempt} className="catalog-video" src={item.video} poster={item.poster} muted playsInline controls preload="metadata" aria-label={item.title} onError={()=>setFailed(true)}/>)}
    {item.demo&&<a className="source-link" href={item.source} target="_blank" rel="noreferrer">Fuente y licencia del video <ArrowUpRight size={14}/></a>}
   </DialogContent>
  </Dialog>
  <div className="film-caption"><div><h3>{item.title}</h3><p>{item.description}</p></div><span>0{index+1} / 0{portfolio.length}</span></div>
 </article>;
}
export function Catalog(){return <div className="film-grid">{portfolio.map((item,index)=><Film item={item} index={index} key={item.id}/>)}</div>;}
