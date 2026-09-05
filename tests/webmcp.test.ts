import {describe,it,expect,vi,afterEach} from 'vitest';
import {registerInquiryTool,type InquiryTool} from '../lib/webmcp';
const input={eventType:'Boda',date:'',dateUndecided:true,location:'Villahermosa'};
afterEach(()=>{delete (document as Document&{modelContext?:unknown}).modelContext;});
describe('inquiry tool contract',()=>{
 it('registers a prepare-only tool and validates both paths',()=>{let captured!:InquiryTool,signal:AbortSignal|undefined;Object.assign(document,{modelContext:{registerTool:(tool:InquiryTool,options:{signal:AbortSignal})=>{captured=tool;signal=options.signal;}}});const update=vi.fn();const cleanup=registerInquiryTool(update);expect(captured.name).toBe('prepare_event_inquiry');expect((captured.annotations as {readOnlyHint:boolean}).readOnlyHint).toBe(false);expect((captured.inputSchema as {required:string[]}).required).toEqual(['eventType','date','dateUndecided','location']);expect(captured.execute(input)).toEqual({status:'prepared',sent:false});expect(update).toHaveBeenCalledWith(input);expect(()=>captured.execute({...input,location:''})).toThrow();expect(update).toHaveBeenCalledTimes(1);cleanup();expect(signal!.aborted).toBe(true);});
 it('does not require WebMCP support for the contact flow',()=>{expect(()=>registerInquiryTool(vi.fn())()).not.toThrow();});
 it('rejects unexpected properties rather than silently accepting them',()=>{let captured!:InquiryTool;Object.assign(document,{modelContext:{registerTool:(tool:InquiryTool)=>{captured=tool;}}});const update=vi.fn();registerInquiryTool(update);expect(()=>captured.execute({...input,send:true})).toThrow();expect(update).not.toHaveBeenCalled();});
});
