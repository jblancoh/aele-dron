'use client';
import {createContext,useContext,useState,useSyncExternalStore} from 'react';
type Connection = {saveData?:boolean;addEventListener?:(event:string,callback:()=>void)=>void;removeEventListener?:(event:string,callback:()=>void)=>void};
function connection(){return (navigator as Navigator&{connection?:Connection}).connection;}
function subscribe(callback:()=>void){
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');const desktop=window.matchMedia('(min-width: 768px)');const network=connection();
 reduced.addEventListener('change',callback);desktop.addEventListener('change',callback);network?.addEventListener?.('change',callback);
 return()=>{reduced.removeEventListener('change',callback);desktop.removeEventListener('change',callback);network?.removeEventListener?.('change',callback);};
}
function snapshot(){return (window.matchMedia('(prefers-reduced-motion: reduce)').matches?1:0)|(window.matchMedia('(min-width: 768px)').matches?2:0)|(connection()?.saveData?4:0);}
const MotionContext=createContext({paused:false,reduced:true,desktop:false,saveData:false,toggle:()=>{}});
export function MotionProvider({children}:{children:React.ReactNode}){
 const [paused,setPaused]=useState(false);const policy=useSyncExternalStore(subscribe,snapshot,()=>1);
 return <MotionContext.Provider value={{paused,reduced:!!(policy&1),desktop:!!(policy&2),saveData:!!(policy&4),toggle:()=>setPaused(value=>!value)}}>{children}</MotionContext.Provider>;
}
export const useMotion=()=>useContext(MotionContext);
