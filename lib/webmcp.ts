import {validateInquiry,type Inquiry} from './contact';
import {eventTypes} from './site-content';
export type InquiryTool = {name:string;title:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>unknown};
type ModelDocument = Document & {modelContext?:{registerTool:(tool:InquiryTool,options:{signal:AbortSignal})=>void|Promise<void>}};
export function parseInquiry(input:unknown):Inquiry {
 if(!input||typeof input!=='object')throw new Error('Se requieren los datos del evento.');
 const value=input as Record<string,unknown>;
 if(Object.keys(value).some(key=>!['eventType','date','dateUndecided','location'].includes(key)))throw new Error('La consulta contiene campos no admitidos.');
 if(typeof value.eventType!=='string'||typeof value.date!=='string'||typeof value.dateUndecided!=='boolean'||typeof value.location!=='string')throw new Error('Formato de datos no válido.');
 const inquiry:Inquiry={eventType:value.eventType,date:value.date,dateUndecided:value.dateUndecided,location:value.location};
 const errors=validateInquiry(inquiry);if(Object.keys(errors).length)throw new Error(Object.values(errors).join(' '));return inquiry;
}
export function registerInquiryTool(onPrepared:(inquiry:Inquiry)=>void) {
 const context=(document as ModelDocument).modelContext;
 if(!context?.registerTool)return()=>{};
 const lifecycle=new AbortController();
 try{void Promise.resolve(context.registerTool({name:'prepare_event_inquiry',title:'Preparar consulta de evento',description:'Prepara los datos y muestra el resumen de contacto. No envía mensajes ni reserva el evento.',inputSchema:{type:'object',properties:{eventType:{type:'string',enum:[...eventTypes]},date:{type:'string',description:'YYYY-MM-DD o vacío si está por definir'},dateUndecided:{type:'boolean'},location:{type:'string',maxLength:180}},required:['eventType','date','dateUndecided','location'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){const inquiry=parseInquiry(input);onPrepared(inquiry);document.getElementById('contacto')?.scrollIntoView({behavior:'instant'});return {status:'prepared',sent:false};}},{signal:lifecycle.signal})).catch(()=>{});}catch{/* Browsers without a working registry retain the regular contact flow. */}
 return()=>lifecycle.abort();
}
