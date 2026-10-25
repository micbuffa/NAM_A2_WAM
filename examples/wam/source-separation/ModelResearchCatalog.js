// Research references, deliberately separate from the downloadable/runnable catalogue.
// No inference option is advertised until an adapter passes host audio validation.
export const MODEL_RESEARCH_DATE = '2026-10-25';
export const MODEL_RESEARCH_CATALOG = Object.freeze([
 {id:'bs-roformer-sw',name:'BS Roformer SW · 6 stems',use:'Voix, basse, batterie, guitare, piano, autres',status:'Porté · validation audio CPU/WebGPU réussie ; disponible dans Model (expérimental).',detail:'Export tiers 336 Mo (poids FP16) ou 669 Mo (FP32). Nouveau pipeline STFT/masques/iSTFT requis. La licence des poids d’origine reste à clarifier, distincte de celle du code.',links:[['Export navigateur','https://huggingface.co/elicwhite/bs-roformer-sw-6stem-onnx'],['Code et démonstration','https://github.com/elicwhite/bs-roformer-web']]},
 {id:'scnet-xl',name:'SCNet XL / SCNet Large',use:'Quatre sources : batterie, basse, voix, autres',status:'SCNet compact : audit natif et contrat CPU/WebGPU vérifiés ; adaptateur lecteur non porté. XL/Large distincts.',detail:'Quatre sources, guitare dans Autres. Le candidat compact 10,1 M paramètres ne valide pas XL/Large. Aucun adaptateur n’est encore proposé au menu Model.',links:[['SCNet et variantes XL','https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/pretrained_models.md'],['SCNet Large ONNX','https://huggingface.co/audiojs/scnet-large']]},
 {id:'mdx-extra-q',name:'MDX Extra Q · Demucs v3',use:'Basse, batterie, autres, voix',status:'Référence native testée · ensemble de quatre réseaux ; export/adaptateur navigateur requis.',detail:'Il ne s’agit pas de MDX-Net. Ensemble de quatre modèles, fenêtre officielle 44 s. Les fichiers quantifiés PyTorch ne se chargent pas avec notre Worker HTDemucs actuel. Son entraînement inclut MUSDB test : ce corpus ne constitue pas une validation indépendante.',links:[['Configuration officielle','https://github.com/facebookresearch/demucs/blob/main/demucs/remote/mdx_extra_q.yaml']]},
]);
export function createModelResearchPanel(doc=document) {
 const panel=doc.createElement('details');panel.className='host-card model-research';panel.setAttribute('aria-label','Autres modèles à évaluer');
 const summary=doc.createElement('summary');summary.textContent='Autres modèles · étude de compatibilité';panel.append(summary);
 const intro=doc.createElement('p');intro.textContent=`Étude du ${MODEL_RESEARCH_DATE}. Sélection centrée sur la guitare et la basse ; les modèles voix/instrumental et de restauration vocale sont hors périmètre. Certaines références ne sont pas encore intégrées. Consultez le statut ; les modèles utilisables sont dans le menu Model.`;panel.append(intro);
 for(const candidate of MODEL_RESEARCH_CATALOG){
  const article=doc.createElement('article'),title=doc.createElement('strong'),use=doc.createElement('p'),status=doc.createElement('p'),detail=doc.createElement('small'),links=doc.createElement('p');
  title.textContent=candidate.name;use.textContent=candidate.use;status.textContent=candidate.status;detail.textContent=candidate.detail;
  for(const [label,url] of candidate.links){const a=doc.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}
  article.append(title,use,status,detail,links);panel.append(article);
 }
 return panel;
}
