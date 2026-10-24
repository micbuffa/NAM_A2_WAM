import {createInstrumentRecommendationPanel} from './InstrumentRecommendationPanel.js';
import {benchmarkSummary,benchmarkMatrix} from './ModelBenchmark.js';
import {REFERENCE_BENCHMARK,GUITAR_RANKING} from './ModelPerformanceData.js';
import {preferredModel} from './BackendPolicy.js';
export function readBenchmarkReport(storage){try{const r=JSON.parse((storage||globalThis.localStorage).getItem('nam-model-benchmark.v1'));if(r?.protocol===REFERENCE_BENCHMARK.protocol&&Array.isArray(r.runs))return r;}catch{}return null;}
export function createModelComparisonPanel({models,capabilities,onRecommend,onRefresh,doc=document,storage}={}){
 const candidate=readBenchmarkReport(storage),local=benchmarkSummary(candidate,models).length?candidate:null,report=local||REFERENCE_BENCHMARK,summary=benchmarkSummary(report,models);
 const el=(tag,text)=>{const e=doc.createElement(tag);if(text)e.textContent=text;return e;};
 const panel=el('section');panel.className='model-comparison';panel.setAttribute('aria-label','Comparaison des modèles');
 panel.append(el('h3','Choisir selon votre priorité'));
 const label=el('label','Priorité '),goal=el('select');goal.setAttribute('aria-label','Priorité de la recommandation');
 for(const [value,text] of [['speed','Terminer le plus vite'],['first','Commencer à écouter tôt'],['guitar','Obtenir une piste guitare dédiée']]){const o=el('option',text);o.value=value;goal.append(o);}label.append(goal);
 const suggestion=el('p'),apply=el('button','Utiliser la recommandation');apply.type='button';
 const update=()=>{const m=preferredModel(models,capabilities,'guitar',{objective:goal.value,report});suggestion.textContent=m?`${m.label} · ${capabilities.webgpu&&m.backends.includes('webgpu')?'GPU':'CPU / WASM'}${summary.length?' · mesures et politique de repli ci-dessous':' · choix provisoire, mesure locale conseillée'}`:'Aucun modèle compatible.';apply.disabled=!m;};
 goal.onchange=update;apply.onclick=()=>onRecommend?.(preferredModel(models,capabilities,'guitar',{objective:goal.value,report}));update();panel.append(label,apply,suggestion,el('small','Le choix automatique utilise les mesures seulement si toutes les configurations du backend ont été testées (les échecs sont exclus du choix). Sinon : choix provisoire Demucs Qualité sur GPU, Demucs 6 pistes sur CPU. Le modèle reste modifiable manuellement.'));
 panel.append(createInstrumentRecommendationPanel({models,capabilities,onRecommend,doc,storage}));
 panel.append(el('h3','Temps de calcul · même extrait de 6 secondes'));
 panel.append(el('p',`${local?'Mesures de ce navigateur':'Mesures de référence sur la machine de développement'} · ${report.date?.slice(0,10)||'non mesuré'} · médiane des essais. Cache, initialisation/préchauffage et séparation inclus ; téléchargement et décodage exclus. Sessions neuves, caches driver conservés. ONNX CPU monothread. Les résultats varient selon la machine et la durée du morceau.`));
 const metricLabel=el('label','Afficher '),metric=el('select');metric.setAttribute('aria-label','Mesure du graphique');
 for(const [v,t] of [['totalMs','Temps total'],['firstReadyMs','Attente avant le premier bloc (préparation incluse)']]){const o=el('option',t);o.value=v;metric.append(o);}metricLabel.append(metric);const filters=el('div');filters.className='model-chart-filters';filters.append(metricLabel);panel.append(filters);
 const backendLabel=el('label','Backend '),backendFilter=el('select');backendFilter.setAttribute('aria-label','Backend du graphique');for(const [v,t] of [['all','CPU et GPU'],['webgpu','GPU'],['wasm','CPU / WASM']]){const o=el('option',t);o.value=v;backendFilter.append(o);}backendLabel.append(backendFilter);filters.append(backendLabel);panel.append(el('small','Plus court = plus rapide. Barres à partir de zéro, échelle commune au filtre choisi.'));
 const chart=el('div');chart.className='model-bars';chart.setAttribute('aria-label','Performances CPU et GPU');panel.append(chart);
 const draw=()=>{chart.replaceChildren();const max=Math.max(1,...summary.filter(s=>backendFilter.value==='all'||s.backend===backendFilter.value).map(s=>s[metric.value]));
  for(const {model,backend} of benchmarkMatrix(models,true).sort((a,b)=>(summary.find(s=>s.modelId===a.model.id&&s.backend===a.backend)?.[metric.value]??Infinity)-(summary.find(s=>s.modelId===b.model.id&&s.backend===b.backend)?.[metric.value]??Infinity))){if(backendFilter.value!=='all'&&backend!==backendFilter.value)continue;const s=summary.find(x=>x.modelId===model.id&&x.backend===backend),row=el('div');row.className='model-bar-row';
   const text=`${({'htdemucs_6s':'Demucs · 6 instruments','htdemucs_ft':'Demucs FT · 4 pistes','htdemucs_4s_onnx':'Demucs Qualité · 4 pistes','htdemucs_4s_preview':'Demucs Aperçu · 4 pistes','bs_roformer_sw_6s':'Roformer SW · 6 instruments'}[model.id]||model.label)} · ${backend==='webgpu'?'GPU':'CPU'}`;row.append(el('span',text));
   if(s){const bar=el('meter');bar.min=0;bar.max=max/1000;bar.value=s[metric.value]/1000;bar.setAttribute('aria-label',text);bar.className=backend;row.append(bar,el('strong',`${(s[metric.value]/1000).toFixed(2)} s · n=${s.count}`));}
   else {const last=(report.runs||[]).filter(r=>r?.modelId===model.id&&r.backend===backend).at(-1);row.append(el('small',last?.status==='error'?`Échec : ${last.error}`:last?.status==='missing'?'Modèle non installé':'Non mesuré / essai non abouti'));}chart.append(row);
  }
 };metric.onchange=backendFilter.onchange=draw;draw();
 const listening=el('a','Comparer à l’écoute · guitare et basse');listening.href=new URL('./instrument-comparison.html',import.meta.url);listening.target='_blank';listening.rel='noopener';panel.append(listening,el('br'));
 const lab=el('a','Comparer sur cette machine (nouvel onglet)');lab.href=new URL('./model-benchmark.html',import.meta.url);lab.target='_blank';lab.rel='noopener';const refresh=el('button','Actualiser les mesures');refresh.type='button';refresh.disabled=!onRefresh;refresh.onclick=()=>onRefresh?.();panel.append(lab,refresh,el('small',' · Aucun calcul ni téléchargement automatique. Réouvrez Settings ou actualisez les mesures après une comparaison ; Utiliser la recommandation reste une action explicite.'));
 panel.append(el('h3','Qualité guitare · références MVSep'),el('p',`${GUITAR_RANKING.note} Consulté le ${GUITAR_RANKING.checked}.`));
 const quality=el('div');quality.className='model-bars';
 for(const e of [...GUITAR_RANKING.entries].sort((a,b)=>b.score-a.score)){const row=el('div');row.className='model-bar-row';const name=`${e.rank?`#${e.rank} `:''}${e.name}${e.hostModel?' · famille intégrée':' · référence externe'}`;row.append(el('span',name));const bar=el('meter');bar.min=0;bar.max=10;bar.value=e.score;bar.setAttribute('aria-label',name);row.append(bar,el('strong',`${e.score.toFixed(3)} dB`));if(e.source){const source=el('a','Source Demucs 6s');source.href=e.source;source.target='_blank';source.rel='noopener';row.append(source);}quality.append(row);}panel.append(quality);
 const link=el('a','Classement guitare complet et protocole MVSep');link.href=GUITAR_RANKING.source;link.target='_blank';link.rel='noopener';panel.append(link,el('p','Demucs 4 pistes / FT / Aperçu : guitare mélangée dans « Autres », pas de score d’isolation guitare comparable. Les scores des familles Demucs 6 et Roformer ne valident pas nos conversions, réglages et découpages navigateur.'));
 return panel;
}
