export const FRAME_COUNT=45;
export function frameIndex(progress:number,count=FRAME_COUNT){return Math.round(Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0))*(count-1));}
