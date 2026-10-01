import {act,render} from '@testing-library/react';
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {ScrollStory} from '../components/scroll-story';
import {FRAME_COUNT,frameSrc} from '../lib/scroll';
const {motionState}=vi.hoisted(()=>({motionState:{paused:false,reduced:false,desktop:true,saveData:false}}));
vi.mock('../components/motion-context',()=>({useMotion:()=>motionState}));
beforeEach(()=>Object.assign(motionState,{paused:false,reduced:false,desktop:true,saveData:false}));
afterEach(()=>vi.restoreAllMocks());
describe('frame network scheduling',()=>{
 it('maps the 45 frames to the ordered Baner sequence',()=>{
  expect(FRAME_COUNT).toBe(45);
  expect(Array.from({length:FRAME_COUNT},(_,index)=>frameSrc(index))).toEqual(
   Array.from({length:45},(_,index)=>`/media/frames/baner-${String(index+1).padStart(2,'0')}.jpg`),
  );
 });

 it.each([
  ['mobile',false,false,false],
  ['reduced motion',true,true,false],
  ['Save-Data',false,true,true],
 ] as const)('keeps the Baner poster without requesting frames for %s',(_,reduced,desktop,saveData)=>{
  motionState.reduced=reduced;motionState.desktop=desktop;motionState.saveData=saveData;
  const requested:string[]=[];
  vi.stubGlobal('Image',class{set src(value:string){requested.push(value);}});
  const {container}=render(<ScrollStory/>);
  expect(container.querySelector('img')).toHaveAttribute('src','/media/baner-poster.jpg');
  expect(requested).toEqual([]);
 });

 it('suspends subsequent batches offscreen and resumes on re-entry',async()=>{
  let intersection:(entries:{isIntersecting:boolean}[])=>void=()=>{};
  vi.stubGlobal('IntersectionObserver',class{constructor(callback:typeof intersection){intersection=callback;}observe(){}disconnect(){}});
  const loaded:{onload:()=>void;src:string}[]=[];
  vi.stubGlobal('Image',class{onload=()=>{};src='';constructor(){loaded.push(this);}});
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage:vi.fn()} as unknown as CanvasRenderingContext2D);
  render(<ScrollStory/>);expect(loaded).toHaveLength(0);
  act(()=>intersection([{isIntersecting:true}]));expect(loaded).toHaveLength(5);
  await act(async()=>{intersection([{isIntersecting:false}]);loaded.forEach(image=>image.onload());await Promise.resolve();});
  expect(loaded).toHaveLength(5);
  act(()=>intersection([{isIntersecting:true}]));expect(loaded).toHaveLength(10);
 });

 it('eases toward the scroll target and crossfades neighbouring frames',async()=>{
  let intersection:(entries:{isIntersecting:boolean}[])=>void=()=>{};
  vi.stubGlobal('IntersectionObserver',class{constructor(callback:typeof intersection){intersection=callback;}observe(){}disconnect(){}});
  const images:{onload:()=>void;src:string}[]=[];
  vi.stubGlobal('Image',class{onload=()=>{};src='';constructor(){images.push(this);}});
  const callbacks:FrameRequestCallback[]=[];let now=0;
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{callbacks.push(callback);return callbacks.length;});
  vi.stubGlobal('cancelAnimationFrame',()=>{});
  const flush=()=>{now+=16;const pending=callbacks.splice(0);pending.forEach(callback=>callback(now));};
  const draws:{src:string;alpha:number}[]=[];
  const context={globalAlpha:1,drawImage(image:{src:string}){draws.push({src:image.src,alpha:context.globalAlpha});}};
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  let top=0;
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(()=>({top,height:2000+window.innerHeight} as DOMRect));
  const {container}=render(<ScrollStory/>);
  act(()=>intersection([{isIntersecting:true}]));
  await act(async()=>{images.forEach(image=>image.onload());await Promise.resolve();});
  act(()=>flush());
  draws.length=0;
  top=-(2000*0.5/44);
  act(()=>{window.dispatchEvent(new Event('scroll'));flush();});
  // The first eased step stays between frame 1 and frame 2 rather than jumping to the target.
  expect(draws.map(draw=>draw.src)).toEqual([frameSrc(0),frameSrc(1)]);
  expect(draws[1].alpha).toBeGreaterThan(0);expect(draws[1].alpha).toBeLessThan(0.5);
  for(let step=0;step<60;step++)act(()=>flush());
  expect(draws.at(-1)).toEqual({src:frameSrc(1),alpha:0.5});
  expect(container.querySelector('.story-progress i')?.getAttribute('style')).toContain('scaleX(0.02');
 });
});
