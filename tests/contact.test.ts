import { describe, it, expect } from 'vitest';
import { validateInquiry, buildWhatsAppUrl, formatInquiry, localToday } from '../lib/contact';
const good = { eventType:'Boda',date:'2027-05-20',dateUndecided:false,location:'Villahermosa, Tabasco' };
describe('inquiry validation',()=>{
 it('accepts an event with an undecided date',()=>expect(validateInquiry({...good,date:'',dateUndecided:true},'2026-09-05')).toEqual({}));
 it('requires an event type, date and nonblank location',()=>expect(Object.keys(validateInquiry({eventType:'',date:'',dateUndecided:false,location:'  '},'2026-09-05'))).toEqual(['eventType','date','location']));
 it('rejects an invalid calendar date and a past date',()=>{for(const date of ['2027-02-30','2026-08-01']) expect(validateInquiry({...good,date},'2026-09-05').date).toBeTruthy();});
 it('rejects unknown categories',()=>expect(validateInquiry({...good,eventType:'unsupported'},'2026-09-05').eventType).toBeTruthy());
 it('uses a local calendar date rather than UTC',()=>expect(localToday(new Date(2026,8,5,23,59))).toBe('2026-09-05'));
});
describe('WhatsApp handoff',()=>{
 it('does not invent a phone or send when unconfigured',()=>expect(buildWhatsAppUrl('',good)).toBeNull());
 it('rejects malformed phone numbers',()=>expect(buildWhatsAppUrl('https://bad.example',good)).toBeNull());
 it('encodes accents and symbols safely',()=>{const url=buildWhatsAppUrl('+52 993 123 4567',{...good,location:'Salón & Jardín #1'});expect(url).toContain('https://wa.me/529931234567?text=');expect(new URL(url!).searchParams.get('text')).toContain('Salón & Jardín #1');});
 it('formats an undecided date honestly',()=>expect(formatInquiry({...good,date:'',dateUndecided:true})).toContain('Fecha: Por definir'));
});
