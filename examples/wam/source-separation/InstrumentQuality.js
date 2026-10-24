// A controlled pilot, not a claim about a representative music dataset.
// Bump QUALITY_PROTOCOL if the recipe, scoring definition, runtime or DSP changes.
export const QUALITY_PROTOCOL='guitar-bass-controlled-v1';
export const QUALITY_CASES=Object.freeze([
 {id:'clean',label:'Accords clairs',file:'CleanChords.mp3',sourceSha256:'c47db7c8d34099bc1a9ea9d591204f0a14e21f6728223ae23c0852396044d420',drive:0,seed:1234},
 {id:'acoustic',label:'Acoustique',file:'FolkAcousticDI.mp3',sourceSha256:'03f78e241c48fe7eb2d7d2bae5ee2a17505e2c313d2f76a9a666f1de91ecc3cf',drive:0,seed:2345},
 {id:'driven',label:'Riff saturé (tanh)',file:'ClassicRockRiff.mp3',sourceSha256:'bc2d3783196375aa948758cff7792780e1543723da765b24149d38467404b6d9',drive:3,seed:3456},
]);
export const QUALITY_FRAMES=264600;
function stereo(channels){if(channels?.length!==2||!channels[0].length||channels.some(c=>!(c instanceof Float32Array)||c.length!==channels[0].length||!c.every(Number.isFinite)))throw Error('Audio stéréo invalide.');}
function scaled(channels,rms){let sum=0;for(const c of channels)for(const x of c)sum+=x*x;const level=Math.sqrt(sum/(channels[0].length*2));if(level<1e-6)throw Error('Référence silencieuse.');const gain=rms/level;return channels.map(c=>Float32Array.from(c,x=>x*gain));}
export function controlledMixture(channels,recipe){
 stereo(channels);if(channels[0].length!==QUALITY_FRAMES||!QUALITY_CASES.some(c=>c.id===recipe.id&&c.seed===recipe.seed&&c.drive===recipe.drive))throw Error('Recette de référence invalide.');
 const guitar=scaled(channels.map(c=>Float32Array.from(c,x=>recipe.drive?Math.tanh(recipe.drive*x):x)),.08),bass=[new Float32Array(QUALITY_FRAMES),new Float32Array(QUALITY_FRAMES)],drums=bass.map(c=>new Float32Array(c.length));
 let seed=recipe.seed;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296*2-1;};
 const notes=[55,55,65.4064,73.4162,55,82.4069,73.4162,65.4064],step=.375;
 for(let i=0;i<QUALITY_FRAMES;i++){
  const t=i/44100,n=Math.floor(t/step),u=t-n*step,f=notes[n%notes.length],env=Math.min(1,u/.008)*Math.exp(-u*5);
  const b=env*(Math.sin(2*Math.PI*f*u)+.35*Math.sin(4*Math.PI*f*u)+.16*Math.sin(6*Math.PI*f*u));
  bass[0][i]=bass[1][i]=b;
  const beat=t%(.5),half=t%(.25),snare=(t+.5)%1,kick=Math.sin(2*Math.PI*(48*beat+1.6*(1-Math.exp(-beat*35))))*Math.exp(-beat*22),noise=random();
  const d=.7*kick+.25*noise*Math.exp(-snare*32)+.08*noise*Math.exp(-half*100);drums[0][i]=d;drums[1][i]=d*.95;
 }
 const refs={guitar,bass:scaled(bass,.07),drums:scaled(drums,.055)};
 const mix=[0,1].map(c=>Float32Array.from(guitar[c],(x,i)=>x+refs.bass[c][i]+refs.drums[c][i]));
 // One common gain preserves exact stem sum and relative levels; no clipping in fixture.
 let peak=0;for(const c of mix)for(const x of c)peak=Math.max(peak,Math.abs(x));const gain=peak>.9?.9/peak:1;
 for(const track of [mix,...Object.values(refs)])for(const c of track)for(let i=0;i<c.length;i++)c[i]*=gain;
 return {mix,refs};
}
// Stereo flattened with one global projection gain. No delay search or post-hoc EQ.
export function referenceMetrics(reference,estimate){
 stereo(reference);stereo(estimate);if(reference[0].length!==estimate[0].length)throw Error('Références non alignées.');
 const count=reference[0].length*2;let mr=0,me=0;for(let c=0;c<2;c++)for(let i=0;i<reference[c].length;i++){mr+=reference[c][i];me+=estimate[c][i];}mr/=count;me/=count;
 let energy=0,pred=0,dot=0,error=0;for(let c=0;c<2;c++)for(let i=0;i<reference[c].length;i++){const r=reference[c][i]-mr,e=estimate[c][i]-me;energy+=r*r;pred+=e*e;dot+=r*e;error+=(r-e)**2;}
 if(energy/count<1e-12)return {valid:false,reason:'silent-reference'};
 if(pred/count<1e-16)return {valid:false,reason:'silent-output'};
 const alpha=dot/energy;let residual=0;for(let c=0;c<2;c++)for(let i=0;i<reference[c].length;i++)residual+=((estimate[c][i]-me)-alpha*(reference[c][i]-mr))**2;
 const db=(a,b)=>Math.max(-120,Math.min(120,10*Math.log10(Math.max(a,1e-20)/Math.max(b,1e-20))));
 return {valid:true,siSdrDb:db(alpha*alpha*energy,residual),snrDb:db(energy,error),gainDb:20*Math.log10(Math.max(Math.abs(alpha),1e-6)),polarity:alpha<0?-1:1};
}
export function scoreInstrument(reference,estimate,mix){const measured=referenceMetrics(reference,estimate),baseline=referenceMetrics(reference,mix);return {...measured,improvementDb:measured.valid&&baseline.valid?measured.siSdrDb-baseline.siSdrDb:null};}
export function qualitySummary(report,models){
 if(report?.protocol!==QUALITY_PROTOCOL||report.status!=='completed'||!Array.isArray(report.runs)||!Array.isArray(report.cases)||report.cases.length!==QUALITY_CASES.length||QUALITY_CASES.some(c=>report.cases.filter(x=>x?.id===c.id&&x.sourceSha256===c.sourceSha256).length!==1))return [];
 const med=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
 return models.flatMap(model=>model.backends.flatMap(backend=>['guitar','bass'].flatMap(instrument=>{
  const runs=QUALITY_CASES.map(c=>(report.runs||[]).filter(r=>r?.caseId===c.id&&r.modelId===model.id&&r.backend===backend&&r.identity===JSON.stringify([model.version,model.files.map(f=>f.sha256)])&&r.status==='ok'&&r.frames===QUALITY_FRAMES));
  if(runs.some(a=>a.length!==1))return [];
  const scores=runs.map(a=>a[0].scores?.[instrument]);if(scores.some(s=>!s?.valid||![s.siSdrDb,s.improvementDb,s.snrDb,s.gainDb].every(Number.isFinite)))return [];
  return [{modelId:model.id,backend,instrument,count:scores.length,snrDb:med(scores.map(s=>s.snrDb)),gainDb:med(scores.map(s=>s.gainDb)),siSdrDb:med(scores.map(s=>s.siSdrDb)),improvementDb:med(scores.map(s=>s.improvementDb)),minimumDb:Math.min(...scores.map(s=>s.siSdrDb)),minimumImprovementDb:Math.min(...scores.map(s=>s.improvementDb))}];
 })));
}
