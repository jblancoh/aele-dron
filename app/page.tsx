/* oxlint-disable next/no-img-element -- Assets are precompressed locally with explicit dimensions; no runtime image optimizer is deployed. */
import {ArrowDown,ArrowUpRight,Play,Camera,MoveUpRight,Focus,Aperture} from 'lucide-react';
import {Catalog} from '@/components/catalog';
import {Contact} from '@/components/contact';
import {HeroVideo} from '@/components/hero-video';
import {MotionProvider} from '@/components/motion-context';
import {DroneScene} from '@/components/drone-scene';
import {ScrollStory} from '@/components/scroll-story';
import {site,portfolio} from '@/lib/site-content';

export default function Home(){
 return <MotionProvider><a className="skip-link" href="#catalogo">Saltar al catálogo</a><main id="inicio">
  <DroneScene/>
  <header className="site-header"><a className="brand" href="#inicio" aria-label="AELE, inicio"><img src="/media/aele-logo.jpg" width="104" height="104" alt="aele·dron"/></a><nav aria-label="Navegación principal"><a href="#catalogo">Catálogo</a><a href="#nosotros">Lo que hacemos</a></nav><a className="header-contact" href="#contacto">Hablemos <ArrowUpRight size={17}/></a></header>
  <section className="hero" aria-labelledby="hero-title"><HeroVideo/><div className="hero-shade"/><div className="hero-topline"><span><i/> VIDEOGRAFÍA AÉREA</span><span>VILLAHERMOSA, TABASCO · MÉXICO</span></div>
   <div className="hero-copy"><p className="eyebrow">HAY MOMENTOS QUE MERECEN MÁS.</p><h1 id="hero-title">Tu evento,<br/>desde otra<br/><span>perspectiva.</span></h1><div className="hero-actions"><a className="pill pill-white" href="#catalogo"><Play size={15} fill="currentColor"/> Explorar el catálogo</a><a className="text-link" href="#contacto">Hagamos algo increíble <ArrowUpRight size={17}/></a></div></div>
   <div className="hero-bottom"><a href="#catalogo"><ArrowDown size={16}/> DESLIZA PARA DESCUBRIR</a><span>UNA MIRADA DIFERENTE. LA MISMA EMOCIÓN.</span><span className="sample-tag">VIDEO DE MUESTRA</span></div>
  </section>
  <section id="catalogo" className="catalog-section section-shell"><div className="intro"><p className="eyebrow">01 / EL CATÁLOGO</p><h2>No es solo verlo.<br/><span className="muted">Es volver a sentirlo.</span></h2><p>Cada evento tiene una historia.<br/>Nosotros buscamos ese ángulo<br className="desktop-break"/> que la hace inolvidable.</p></div><div className="catalog-rule"><span>UNA SELECCIÓN DE PERSPECTIVAS</span><span>03 PELÍCULAS DE MUESTRA</span></div><Catalog/><div className="catalog-footnote"><p>Una primera mirada a las posibilidades. Estos clips son material de muestra, no trabajos de AELE.</p><a className="text-link" href={site.instagram} target="_blank" rel="noreferrer">Ver proyectos reales en Instagram <ArrowUpRight size={17}/></a></div></section>
  <ScrollStory/>
  <section id="nosotros" className="services section-shell"><div className="services-heading"><p className="eyebrow">03 / LO QUE HACEMOS</p><h2>Tu historia.<br/>Nuestra <em>mirada.</em></h2><p>Desde Villahermosa, Tabasco, encontramos nuevas formas de contar lo que sucede a tu alrededor.</p></div><div className="service-list">{[
   {number:'01',icon:MoveUpRight,title:'Cobertura aérea',copy:'El evento completo, desde una perspectiva que transforma la manera de recordarlo.'},
   {number:'02',icon:Focus,title:'Eventos que conectan',copy:'Celebraciones, deportes, conciertos y encuentros. La emoción es el punto de partida.'},
   {number:'03',icon:Aperture,title:'Una historia en video',copy:'Imágenes y momentos que, juntos, cuentan algo más. Videografía con una mirada propia.'},
  ].map(({number,icon:Icon,title,copy})=><div className="service-row" key={number}><span className="service-number">{number}</span><div><h3>{title}</h3><p>{copy}</p></div><Icon size={28} strokeWidth={1}/></div>)}</div></section>
  <div className="local-band"><span>DESDE TABASCO.</span><span className="local-star" aria-hidden="true">✳</span><span>PARA VER MÁS ALLÁ.</span><ArrowUpRight aria-hidden="true" size={56} strokeWidth={1}/></div>
  <Contact/>
  <footer className="site-footer"><div className="footer-top"><a className="brand" href="#inicio" aria-label="AELE, volver al inicio"><img src="/media/aele-logo.jpg" width="104" height="104" alt="aele·dron" loading="lazy"/></a><p>Una mirada diferente.<br/><span>Villahermosa, Tabasco, México.</span></p><a className="text-link" href={site.instagram} target="_blank" rel="noreferrer"><Camera size={17}/> @aele.dron <ArrowUpRight size={16}/></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} AELE · Videografía con drones</span><details className="media-credits"><summary>Créditos del material de muestra</summary><p>Videos de Mixkit bajo Stock Video Free License. No representan trabajos de AELE ni ubicaciones verificadas de Tabasco.</p>{portfolio.map(item=><a key={item.id} href={item.source} target="_blank" rel="noreferrer">{item.title} ↗</a>)}<a href="https://mixkit.co/license/#videoFree" target="_blank" rel="noreferrer">Consultar licencia ↗</a><p>Imagen conceptual de cámara generada con IA; no identifica equipo de la empresa. Logo proporcionado por AELE.</p></details><a href="#inicio">VOLVER ARRIBA ↑</a></div></footer>
 </main></MotionProvider>;
}
