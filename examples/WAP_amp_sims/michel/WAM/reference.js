// Runs the unchanged WAP script in its own realm: its global prototype patch stays here.
const classes={blues:'BluesMachine',cleanfull:'CleanMachineFull',modernmetal:'ModernMetalMachine'};
const pending=new Set(); const errors=[];
const nativeFetch=window.fetch.bind(window);
function track(promise){pending.add(promise);promise.catch(e=>errors.push(e)).finally(()=>pending.delete(promise));return promise;}
window.referenceFixes=[];
window.fetch=(...args)=>{
  if(typeof args[0]==='string' && args[0].includes('/bluesassets/')) {
    window.referenceFixes.push({from:args[0],to:args[0].replace('/bluesassets/','/blues/assets/')});
    args[0]=args[0].replace('/bluesassets/','/blues/assets/');
  }
  return track(nativeFetch(...args).then(response=>new Proxy(response,{get(target,key){
  if(key==='arrayBuffer')return()=>track(target.arrayBuffer());
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
}})));
};
async function drain(){
  do{await Promise.allSettled([...pending]);await new Promise(resolve=>setTimeout(resolve,0));}while(pending.size);
  if(errors.length)throw errors.shift();
}
window.referenceReady=(async()=>{
  const slug=new URL(location).searchParams.get('amp');
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`../${slug}/main.js`;script.onload=resolve;script.onerror=reject;document.head.append(script);});
  return slug;
})();
window.createReference=async(context,index,defaultIndex)=>{
  const slug=await window.referenceReady;const nodes=new Set();
  const proxy=new Proxy(context,{get(target,key){
    const value=Reflect.get(target,key,target);
    if(key==='decodeAudioData')return(bytes,success,failure)=>track(target.decodeAudioData(bytes,success,failure));
    if(typeof value!=='function')return value;
    if(String(key).startsWith('create'))return(...args)=>{const node=value.apply(target,args);nodes.add(node);return node;};
    return value.bind(target);
  }});
  const engine=new window[classes[slug]](proxy,new URL(`../${slug}`,location).href);
  await drain();engine.preset=defaultIndex;engine.status='enable';await drain();
  engine.preset=index;engine.status='enable';await drain();
  return {engine,nodes,async ready(){await drain();},destroy(){for(const node of nodes)try{node.disconnect();}catch{}}};
};
