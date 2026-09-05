import {act,render} from '@testing-library/react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {ScrollStory} from '../components/scroll-story';
vi.mock('../components/motion-context',()=>({useMotion:()=>({paused:false,reduced:false,desktop:true,saveData:false})}));
afterEach(()=>vi.restoreAllMocks());
describe('frame network scheduling',()=>{
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
