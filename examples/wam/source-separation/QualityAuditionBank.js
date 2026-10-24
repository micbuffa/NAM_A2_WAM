import {listeningPair} from './InstrumentComparison.js';

// Optional listening copies, bounded in RAM. Never part of a stored report.
export class QualityAuditionBank {
 constructor({maxBytes=128*1024*1024}={}){this.maxBytes=maxBytes;this.clear();}
 clear(){this.items=new Map();this.bytes=0;}
 add(c,model,backend,stems){
  const key=JSON.stringify([c.id,model.id,backend]),pair=listeningPair(model,stems,c.target);
  const bytes=[...pair.isolated,...pair.backing].reduce((n,a)=>n+a.byteLength,0);
  if(bytes>this.maxBytes)return false;
  const previous=this.items.get(key);if(previous){this.bytes-=previous.bytes;this.items.delete(key);}
  while(this.bytes+bytes>this.maxBytes){const [id,item]=this.items.entries().next().value;this.bytes-=item.bytes;this.items.delete(id);}
  const value={caseId:c.id,modelId:model.id,backend,label:model.label,role:pair.role,
   isolated:pair.isolated.map(a=>a.slice()),backing:pair.backing,bytes};
  this.items.set(key,value);this.bytes+=bytes;return true;
 }
 forCase(id){return [...this.items.values()].filter(item=>item.caseId===id);}
}
