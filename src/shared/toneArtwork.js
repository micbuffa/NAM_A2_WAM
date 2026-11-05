// Normalize the image shapes returned by catalogue, search and OAuth responses.
// Keep only network images; never interpolate arbitrary schemes into host cards.
export function getToneImageUrl(tone) {
  const images=Array.isArray(tone?.images)?tone.images:[];
  const candidates=[...images,tone?.image_url,tone?.imageUrl,tone?.image];
  for(const image of candidates){
    const value=typeof image==='string'?image:image?.url||image?.image_url||image?.src;
    if(typeof value!=='string'||!value.trim())continue;
    try{const url=new URL(value.trim(),'https://www.tone3000.com');if(['https:','http:'].includes(url.protocol))return url.href;}catch{}
  }
  return '';
}
