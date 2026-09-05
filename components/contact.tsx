/* oxlint-disable next/no-img-element -- Assets are precompressed locally with explicit dimensions; no runtime image optimizer is deployed. */
'use client';
import {useRef,useState,useEffect} from 'react';
import {flushSync} from 'react-dom';
import {ArrowLeft,ArrowUpRight,ArrowRight,Check} from 'lucide-react';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
import {Checkbox} from '@/components/ui/checkbox';
import {site,eventTypes} from '@/lib/site-content';
import {emptyInquiry,validateInquiry,localToday,formatDate,buildWhatsAppUrl,type Inquiry,type InquiryErrors} from '@/lib/contact';
import {useMotion} from './motion-context';
import {registerInquiryTool} from '@/lib/webmcp';
export function Contact(){
 const [inquiry,setInquiry]=useState<Inquiry>(emptyInquiry);const [step,setStep]=useState(0);const [errors,setErrors]=useState<InquiryErrors>({});
 const title=useRef<HTMLHeadingElement>(null);const camera=useRef<HTMLDivElement>(null);const {paused,reduced}=useMotion();
 useEffect(()=>registerInquiryTool(value=>{flushSync(()=>{setInquiry(value);setStep(2);setErrors({});});title.current?.focus();}),[]);
 const move=(next:number)=>{setStep(next);setErrors({});requestAnimationFrame(()=>title.current?.focus());};
 const next=()=>{const all=validateInquiry(inquiry);const relevant=step===0?{eventType:all.eventType}:{date:all.date,location:all.location};const active=Object.fromEntries(Object.entries(relevant).filter(([,message])=>message));setErrors(active);if(!Object.keys(active).length)move(step+1);};
 const url=buildWhatsAppUrl(site.whatsappNumber,inquiry);
 const update=<K extends keyof Inquiry>(key:K,value:Inquiry[K])=>setInquiry(old=>({...old,[key]:value}));
 return <section id="contacto" className="contact-section section-shell" onPointerMove={event=>{if(paused||reduced||event.pointerType==='touch'||!camera.current)return;const rect=event.currentTarget.getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width-.5;const y=(event.clientY-rect.top)/rect.height-.5;camera.current.style.setProperty('--camera-x',`${x*14}deg`);camera.current.style.setProperty('--camera-y',`${-y*10}deg`);}} onPointerLeave={()=>{camera.current?.style.setProperty('--camera-x','0deg');camera.current?.style.setProperty('--camera-y','0deg');}}>
  <div className="contact-intro"><p className="eyebrow">04 / TU PRÓXIMA HISTORIA</p><h2>Todo empieza<br/>con un <em>hola.</em></h2><p>Cuéntanos qué estás imaginando.<br/>Nosotros ponemos la perspectiva.</p>
   <div className={`camera-scene ${paused||reduced?'camera-still':''}`} ref={camera} aria-hidden="true"><span className="camera-cross camera-cross-one">+</span><img src="/media/drone-gimbal.webp" width="1100" height="734" loading="lazy" alt=""/><span className="camera-cross camera-cross-two">+</span><span className="camera-caption">LISTOS PARA ENFOCAR TU HISTORIA</span></div>
  </div>
  <div className="contact-form-panel">
   <ol className="step-track" aria-label="Pasos de cotización">{['Tu evento','Los detalles','Hablemos'].map((label,index)=><li key={label} className={index===step?'current':index<step?'complete':''} aria-current={index===step?'step':undefined}><span>{index<step?<Check size={12}/>:index+1}</span>{label}</li>)}</ol>
   <form onSubmit={event=>{event.preventDefault();if(step<2)next();}} noValidate>
    <h3 ref={title} tabIndex={-1}>{['¿Qué vamos a capturar?','Pongámosle fecha y lugar.','Una gran historia en camino.'][step]}</h3>
    {step===0&&<><p className="form-help">Selecciona el tipo de evento.</p><RadioGroup className="event-options" value={inquiry.eventType} onValueChange={value=>update('eventType',String(value))} aria-label="Tipo de evento" aria-invalid={!!errors.eventType} aria-describedby={errors.eventType?'event-error':undefined}>{eventTypes.map((type,index)=><label className={`event-option ${inquiry.eventType===type?'selected':''}`} key={type} htmlFor={`event-${index}`}><RadioGroupItem id={`event-${index}`} value={type}/><span>{type}</span><ArrowUpRight size={15}/></label>)}</RadioGroup>{errors.eventType&&<p className="form-error" role="alert" id="event-error">{errors.eventType}</p>}<button type="submit" className="pill pill-white continue">Continuar <ArrowRight size={17}/></button></>}
    {step===1&&<><p className="form-help">No necesitas tenerlo todo resuelto todavía.</p><label className="field-label" htmlFor="event-date">Fecha del evento</label><input id="event-date" type="date" value={inquiry.date} min={localToday()} disabled={inquiry.dateUndecided} onChange={event=>update('date',event.target.value)} aria-invalid={!!errors.date} aria-describedby={errors.date?'date-error':undefined}/><label className="check-label" htmlFor="date-undecided"><Checkbox id="date-undecided" checked={inquiry.dateUndecided} onCheckedChange={checked=>update('dateUndecided',checked)}/>Por definir</label>{errors.date&&<p className="form-error" id="date-error" role="alert">{errors.date}</p>}<label className="field-label" htmlFor="event-location">Lugar del evento</label><input id="event-location" type="text" autoComplete="off" maxLength={180} placeholder="Ciudad, recinto o lugar por definir" value={inquiry.location} onChange={event=>update('location',event.target.value)} aria-invalid={!!errors.location} aria-describedby={errors.location?'location-error':undefined}/>{errors.location&&<p className="form-error" id="location-error" role="alert">{errors.location}</p>}<div className="form-actions"><button type="button" className="back-button" onClick={()=>move(0)}><ArrowLeft size={17}/>Atrás</button><button type="submit" className="pill pill-white">Revisar <ArrowRight size={17}/></button></div></>}
    {step===2&&<><p className="form-help">Este es el mensaje que prepararemos para AELE.</p><dl className="inquiry-summary"><div><dt>EVENTO</dt><dd>{inquiry.eventType}</dd></div><div><dt>FECHA</dt><dd>{inquiry.dateUndecided?'Por definir':formatDate(inquiry.date)}</dd></div><div><dt>LUGAR</dt><dd>{inquiry.location.trim()}</dd></div></dl>{url?<><a className="pill pill-white continue" href={url} target="_blank" rel="noreferrer">Abrir WhatsApp <ArrowUpRight size={17}/></a><p className="privacy-note">Se abrirá WhatsApp. Tú revisas y envías el mensaje; no se envía automáticamente.</p></>:<div className="contact-pending"><strong>WhatsApp pendiente de configurar</strong><p>Mientras tanto, puedes escribirnos por Instagram. No hemos enviado ni guardado tus datos.</p><a className="text-link" href={site.instagram} target="_blank" rel="noreferrer">Escribir a @aele.dron <ArrowUpRight size={16}/></a></div>}<button type="button" className="back-button" onClick={()=>move(1)}><ArrowLeft size={17}/>Editar detalles</button></>}
   </form>
   <p className="privacy-note form-privacy">Sin compromisos. Solo el comienzo de algo increíble.</p>
  </div>
 </section>;
}
