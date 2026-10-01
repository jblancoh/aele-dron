import {describe,it,expect} from 'vitest';
import {frameBlend,easeToward} from '../lib/scroll';
describe('scroll sequence interpolation',()=>{
 it('blends between the two frames surrounding a fractional position',()=>{
  expect(frameBlend(0,45)).toEqual({from:0,to:1,mix:0});
  expect(frameBlend(1,45)).toEqual({from:44,to:44,mix:0});
  const middle=frameBlend(0.5/44,45);
  expect(middle.from).toBe(0);expect(middle.to).toBe(1);expect(middle.mix).toBeCloseTo(0.5);
 });
 it('clamps out-of-range and invalid progress',()=>{
  expect(frameBlend(-1,45)).toEqual({from:0,to:1,mix:0});
  expect(frameBlend(2,45)).toEqual({from:44,to:44,mix:0});
  expect(frameBlend(Number.NaN,45)).toEqual({from:0,to:1,mix:0});
 });
 it('eases a fraction of the remaining distance and snaps when settled',()=>{
  const step=easeToward(0,1,16);
  expect(step).toBeGreaterThan(0);expect(step).toBeLessThan(0.25);
  expect(easeToward(0.9999,1,16)).toBe(1);
  expect(easeToward(0.5,0.5,16)).toBe(0.5);
 });
 it('is frame-rate independent',()=>{
  const twoSmall=easeToward(easeToward(0,1,8),1,8);
  expect(easeToward(0,1,16)).toBeCloseTo(twoSmall,6);
 });
});
