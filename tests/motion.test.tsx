import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {MotionProvider,STORAGE_KEY} from '../components/motion-context';
import {HeroVideo} from '../components/hero-video';
import {ScrollStory} from '../components/scroll-story';
import {frameIndex} from '../lib/scroll';
function mediaQuery(reduced:boolean,desktop:boolean){vi.mocked(window.matchMedia).mockImplementation(query=>({matches:query.includes('prefers-reduced')?reduced:desktop,media:query,onchange:null,addEventListener:vi.fn(),removeEventListener:vi.fn(),addListener:vi.fn(),removeListener:vi.fn(),dispatchEvent:vi.fn()}));}
// `navigator.connection` does not exist in jsdom by default (matching real Safari, which never
// implements it either) — tests that need it define it here and must delete it afterwards so it
// does not leak into unrelated tests (see the local `afterEach` in the describe blocks that use it).
function mockConnection(overrides:{saveData?:boolean;effectiveType?:string}){
 Object.defineProperty(window.navigator,'connection',{configurable:true,value:{saveData:false,addEventListener:vi.fn(),removeEventListener:vi.fn(),...overrides}});
}
function deleteConnection(){delete (window.navigator as {connection?:unknown}).connection;}
// `motion-context.tsx` caches the resolved preference in a MODULE-level variable (not per-render
// state), so clearing `localStorage` between tests (see tests/setup.ts) is not enough on its own —
// the cache itself survives. The module already resets that cache on a `storage` event (its
// cross-tab sync path); reusing it here, through a throwaway mounted provider, forces every test
// in this file to start from a genuinely fresh 'unset' preference, regardless of what an earlier
// test in the same file toggled.
function resetMotionPreference(){
 const {unmount}=render(<MotionProvider><></></MotionProvider>);
 fireEvent(window,new StorageEvent('storage',{key:STORAGE_KEY,newValue:null}));
 unmount();
}
beforeEach(resetMotionPreference);
afterEach(()=>vi.clearAllMocks());
describe('motion and data safeguards',()=>{
 afterEach(deleteConnection);
 it('clamps scroll frames to existing assets',()=>{expect(frameIndex(-1)).toBe(0);expect(frameIndex(.5)).toBe(22);expect(frameIndex(2)).toBe(44);expect(frameIndex(NaN)).toBe(0);});
 // Superseded by "hero video network gate" below: the video used to be gated on `desktop`, so
 // mobile never autoplayed regardless of network. The real cost is the 2.4MB download, not CPU
 // (decode is hardware-accelerated on any phone), so the gate is network quality now, not viewport
 // width — inverted here, like other regression guards in this file, so reintroducing the old
 // `desktop` gate fails a test instead of silently shipping.
 it('autoplays background video on mobile when the connection is good',()=>{mediaQuery(false,false);const {container}=render(<MotionProvider><HeroVideo/></MotionProvider>);expect(container.querySelector('video')).not.toBeNull();});
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
 afterEach(deleteConnection);
 // Inverted from the pre-fix version of this test (which asserted the video unloaded here): the
 // viewport is no longer part of the video's eligibility at all, only `reduced`/`saveData`/network
 // are — see "hero video network gate" below for the gate that actually replaced it.
 it('keeps playing the background video when the viewport shrinks to mobile mid-session',async()=>{
  const listeners=new Map<string,()=>void>();let desktop=true;
  vi.mocked(window.matchMedia).mockImplementation(query=>({get matches(){return query.includes('prefers-reduced')?false:desktop;},media:query,onchange:null,addEventListener:(_event:string,listener:EventListenerOrEventListenerObject)=>listeners.set(query,listener as ()=>void),removeEventListener:vi.fn(),addListener:vi.fn(),removeListener:vi.fn(),dispatchEvent:vi.fn()}));
  const {container}=render(<MotionProvider><HeroVideo/></MotionProvider>);expect(container.querySelector('video')).not.toBeNull();
  desktop=false;const {act}=await import('@testing-library/react');act(()=>listeners.get('(min-width: 701px)')?.());
  expect(container.querySelector('video')).not.toBeNull();
 });
});

// The video used to be gated on `desktop` (a viewport check); the real cost is the 2.4MB
// `coast.mp4` download, not decode CPU (hardware-accelerated on any phone), so the gate is network
// quality instead — read from `motion-context.tsx`'s own `navigator.connection` subscription
// (see its `SLOW_NETWORK_TYPES`/`networkOk` comments) rather than a second, independent read here.
describe('hero video network gate',()=>{
 afterEach(deleteConnection);

 it('does not autoplay when Save-Data is on, even on a fast connection',()=>{
  mockConnection({saveData:true,effectiveType:'4g'});
  mediaQuery(false,true);
  const {container}=render(<MotionProvider><HeroVideo/></MotionProvider>);
  expect(container.querySelector('video')).toBeNull();
  expect(screen.getByRole('button',{name:'Reproducir video de fondo'})).toBeInTheDocument();
 });

 it.each(['slow-2g','2g','3g'])('does not autoplay on a %s connection',(effectiveType)=>{
  mockConnection({effectiveType});
  mediaQuery(false,true);
  const {container}=render(<MotionProvider><HeroVideo/></MotionProvider>);
  expect(container.querySelector('video')).toBeNull();
  expect(screen.getByRole('button',{name:'Reproducir video de fondo'})).toBeInTheDocument();
 });

 it('autoplays on a 4g connection',()=>{
  mockConnection({effectiveType:'4g'});
  mediaQuery(false,true);
  const {container}=render(<MotionProvider><HeroVideo/></MotionProvider>);
  expect(container.querySelector('video')).not.toBeNull();
 });

 // Safari never implements `navigator.connection` — treating that as "network unknown, therefore
 // acceptable" (rather than blocking) is a deliberate choice: penalising every iOS visitor for a
 // missing API would be worse than occasionally autoplaying on a slow connection.
 it('autoplays when navigator.connection does not exist at all', () => {
  deleteConnection();
  mediaQuery(false,true);
  const {container}=render(<MotionProvider><HeroVideo/></MotionProvider>);
  expect(container.querySelector('video')).not.toBeNull();
 });

 it('still blocks under reduced motion regardless of connection quality',()=>{
  mockConnection({effectiveType:'4g'});
  mediaQuery(true,true);
  const {container}=render(<MotionProvider><HeroVideo/></MotionProvider>);
  expect(container.querySelector('video')).toBeNull();
 });

 // The pause control must stay reachable in every one of the states above — WCAG 2.2.2 is not
 // limited to the desktop/good-connection case this file used to be the only one exercising.
 it('keeps the pause control reachable when the video autoplays on mobile',()=>{
  mockConnection({effectiveType:'4g'});
  mediaQuery(false,false);
  render(<MotionProvider><HeroVideo/></MotionProvider>);
  expect(screen.getByRole('button',{name:'Pausar movimiento'})).toBeInTheDocument();
 });

 it('keeps the pause control reachable when the video is blocked by a slow connection',()=>{
  mockConnection({effectiveType:'2g'});
  mediaQuery(false,true);
  render(<MotionProvider><HeroVideo/></MotionProvider>);
  // `tier` is still 'full' here (network does not affect the drone-eligibility tier), so the
  // control is reachable via `hasStoppableMotion`'s `tier !== 'none'` branch, same as always.
  expect(screen.getByRole('button',{name:'Pausar movimiento'})).toBeInTheDocument();
 });

 it('unloads the background video when the network degrades mid-session',async()=>{
  const listeners=new Map<string,()=>void>();
  let effectiveType='4g';
  Object.defineProperty(window.navigator,'connection',{configurable:true,value:{
   saveData:false,
   get effectiveType(){return effectiveType;},
   addEventListener:(_event:string,listener:EventListenerOrEventListenerObject)=>listeners.set('change',listener as ()=>void),
   removeEventListener:vi.fn(),
  }});
  mediaQuery(false,false);
  const {container}=render(<MotionProvider><HeroVideo/></MotionProvider>);
  expect(container.querySelector('video')).not.toBeNull();

  effectiveType='3g';
  const {act}=await import('@testing-library/react');
  act(()=>listeners.get('change')?.());
  await waitFor(()=>expect(container.querySelector('video')).toBeNull());
 });
});
