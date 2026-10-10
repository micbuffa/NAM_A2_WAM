// Register fonts on the document: @font-face inside a shadow root is not reliably loaded.
// Unique names avoid collisions with the original WAP host and other WAM editors.
const definitions = {
  blues:[['VastShadow','HennyPenny-Regular.ttf'],['Bellerose','Bellerose.ttf']],
  cleanfull:[['shady_laneregular','shadylane-webfont.woff2']],
  modernmetal:[['metalfont2','fonts/Frijole-Regular.ttf'],['metalfont','fonts/metalfont.ttf']],
};
const pending = new Map();
export async function prepareFonts(slug,baseURL,template) {
  await Promise.all(definitions[slug].map(async ([family,path])=>{
    const name=`wap2-${slug}-${family}`,url=new URL(`assets/${path}`,baseURL).href,key=name+url;
    if(!pending.has(key))pending.set(key,(async()=>{
      const face=await new FontFace(name,`url(${JSON.stringify(url)})`).load();
      document.fonts.add(face);
    })().catch(error=>{pending.delete(key);throw error;}));
    await pending.get(key);
  }));
  for(const [family] of definitions[slug]) {
    const name=`wap2-${slug}-${family}`;
    template=template.replaceAll(`'${family}'`,`'${name}'`).replaceAll(`"${family}"`,`"${name}"`);
  }
  return template;
}
