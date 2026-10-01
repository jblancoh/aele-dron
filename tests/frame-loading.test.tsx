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
});
