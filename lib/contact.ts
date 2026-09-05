import { eventTypes } from './site-content';
export type Inquiry = { eventType:string; date:string; dateUndecided:boolean; location:string };
export type InquiryErrors = Partial<Record<'eventType'|'date'|'location',string>>;
export const emptyInquiry: Inquiry = {eventType:'',date:'',dateUndecided:false,location:''};
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function validateInquiry(inquiry:Inquiry, today = localToday()): InquiryErrors {
  const errors:InquiryErrors = {};
  if (!eventTypes.some(type=>type===inquiry.eventType)) errors.eventType='Selecciona el tipo de evento.';
  if (!inquiry.dateUndecided) {
    const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(inquiry.date);
    const parsed = new Date(`${inquiry.date}T12:00:00Z`);
    if (!validFormat || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10)!==inquiry.date) errors.date='Indica una fecha válida o selecciona “Por definir”.';
    else if(inquiry.date<today) errors.date='Elige hoy o una fecha futura.';
  }
  if(!inquiry.location.trim()) errors.location='Cuéntanos dónde será el evento.';
  else if(inquiry.location.trim().length>180) errors.location='Usa un máximo de 180 caracteres.';
  return errors;
}
export function formatDate(date:string) {
  return new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
}
export function formatInquiry(inquiry:Inquiry) {
  return `Hola, AELE. Me gustaría cotizar la cobertura de mi evento.\n\nEvento: ${inquiry.eventType}\nFecha: ${inquiry.dateUndecided?'Por definir':formatDate(inquiry.date)}\nLugar: ${inquiry.location.trim()}\n\n¿Podemos platicar sobre el proyecto?`;
}
export function buildWhatsAppUrl(number:string,inquiry:Inquiry) {
  if(!/^\+?[\d\s()-]+$/.test(number)) return null;
  const digits=number.replace(/\D/g,'');
  if(!/^[1-9]\d{7,14}$/.test(digits) || Object.keys(validateInquiry(inquiry)).length) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(formatInquiry(inquiry))}`;
}
