import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {MotionProvider} from '../components/motion-context';
import {HeroVideo} from '../components/hero-video';
import {ScrollStory} from '../components/scroll-story';
import {frameIndex} from '../lib/scroll';
function mediaQuery(reduced:boolean,desktop:boolean){vi.mocked(window.matchMedia).mockImplementation(query=>({matches:query.includes('prefers-reduced')?reduced:desktop,media:query,onchange:null,addEventListener:vi.fn(),removeEventListener:vi.fn(),addListener:vi.fn(),removeListener:vi.fn(),dispatchEvent:vi.fn()}));}
afterEach(()=>vi.clearAllMocks());
describe('motion and data safeguards',()=>{
 it('clamps scroll frames to existing assets',()=>{expect(frameIndex(-1)).toBe(0);expect(frameIndex(.5)).toBe(22);expect(frameIndex(2)).toBe(44);expect(frameIndex(NaN)).toBe(0);});
 it('does not load background video on mobile',()=>{mediaQuery(false,false);const {container}=render(<MotionProvider><HeroVideo/></MotionProvider>);expect(container.querySelector('video')).toBeNull();expect(screen.getByRole('button',{name:'Reproducir video de fondo'})).toBeInTheDocument();});
 it('keeps the poster when reduced motion is requested',()=>{mediaQuery(true,true);const {container}=render(<MotionProvider><HeroVideo/></MotionProvider>);expect(container.querySelector('video')).toBeNull();expect(screen.getByRole('img')).toHaveAttribute('src','/media/coast-poster.jpg');});
 it('pauses and resumes desktop motion explicitly',async()=>{mediaQuery(false,true);render(<MotionProvider><HeroVideo/></MotionProvider>);await userEvent.click(screen.getByRole('button',{name:'Pausar movimiento'}));expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();expect(screen.getByRole('button',{name:'Reanudar movimiento'})).toHaveAttribute('aria-pressed','true');await userEvent.click(screen.getByRole('button',{name:'Reanudar movimiento'}));expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();});
 // WCAG 2.2.2: a reduced-motion visitor who manually starts the fallback video must still be able
 // to stop it. `tier` stays 'none' here (reduced motion is never overridden by a manual video
 // start), so the pause control has to key off the video's own manual/running state too, not just
 // `tier`.
 it('gives a reduced-motion visitor a way to stop the video they manually started',async()=>{mediaQuery(true,true);render(<MotionProvider><HeroVideo/></MotionProvider>);await userEvent.click(screen.getByRole('button',{name:'Reproducir video de fondo'}));const pauseButton=screen.getByRole('button',{name:'Pausar movimiento'});expect(pauseButton).toBeInTheDocument();await userEvent.click(pauseButton);expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();expect(screen.getByRole('button',{name:'Reanudar movimiento'})).toHaveAttribute('aria-pressed','true');});
 it('retains a poster when video fails',async()=>{mediaQuery(false,true);const {container}=render(<MotionProvider><HeroVideo/></MotionProvider>);fireEvent.error(container.querySelector('video')!);await waitFor(()=>expect(container.querySelector('video')).toBeNull());expect(screen.getByRole('img')).toBeInTheDocument();});
 it('does not construct frame requests on mobile',()=>{mediaQuery(false,false);const image=vi.spyOn(window,'Image');render(<MotionProvider><ScrollStory/></MotionProvider>);expect(image).not.toHaveBeenCalled();image.mockRestore();});
});

describe('responsive media policy',()=>{
 it('unloads automatic video when the viewport becomes mobile',async()=>{
  const listeners=new Map<string,()=>void>();let desktop=true;
  vi.mocked(window.matchMedia).mockImplementation(query=>({get matches(){return query.includes('prefers-reduced')?false:desktop;},media:query,onchange:null,addEventListener:(_event:string,listener:EventListenerOrEventListenerObject)=>listeners.set(query,listener as ()=>void),removeEventListener:vi.fn(),addListener:vi.fn(),removeListener:vi.fn(),dispatchEvent:vi.fn()}));
  const {container}=render(<MotionProvider><HeroVideo/></MotionProvider>);expect(container.querySelector('video')).not.toBeNull();
  desktop=false;const {act}=await import('@testing-library/react');act(()=>listeners.get('(min-width: 701px)')?.());
  await waitFor(()=>expect(container.querySelector('video')).toBeNull());
 });
});
