/* V16 - one inventory and 4-meal daily planner. Estimated nutrition per portion. */
(function(){
'use strict';
const F=AUTO_FOODS, keys=AUTO_KEYS, hours=AUTO_HOURS;
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const stock=()=>db.stock||[];
const find=id=>stock().find(s=>norm(s.name)===norm(F[id][7]));
const daily=()=>{db.autoMeals??={};return db.autoMeals};
const date=()=>autoToday();
const sum=parts=>autoSum(parts);
const esc=x=>escapeHtml(String(x));
// Household unit conversions. 'Doses' and 'porções' are the displayed food portion.
function capacity(id){
 const s=find(id);if(!s||!(Number(s.qty)>0))return 0;
 const q=Number(s.qty),u=norm(s.unit),desc=F[id][6];
 const m=desc.match(/~\s*(\d+)\s*(g|ml)/i),g=m?Number(m[1]):null;
 if(u==='g'&&g)return q/g;
 if(u==='kg'&&g)return q*1000/g;
 if(u==='ml'&&g)return q/g;
 if(u==='l'&&g)return q*1000/g;
 if(['un.','unidades','unidade'].includes(u))return id==='ovos'?q/2:q;
 if(u==='garrafas'&&id==='azeite')return q*25; // conservative 250ml bottle, 10ml/serving; estimate
 if(u==='latas')return q;
 if(u==='bifes')return q;
 if(u==='doses'||u==='porcoes'||u==='porção'||u==='porções')return q;
 return q;
}
function usage(id,q){let s=find(id),cap=capacity(id);return s&&cap>0?q*Number(s.qty)/cap:Infinity}
function available(id,usageMap,need){
 const cap=capacity(id);if(cap<need+(usageMap[id]||0)-1e-7)return false;
 // Shared inventory aliases: chicken/turkey and hake/salmon share one stock entry.
 const name=norm(F[id][7]);let total=need;
 for(const [other,n] of Object.entries(usageMap))if(norm(F[other][7])===name)total+=n;
 return total<=cap+1e-7;
}
const pool=(cat,meal)=>{
 const allowed={
  p:meal===0||meal===2?['ovos','iogurte','queijo','kefir','triangulo']:['frango','peru','pescada','salmao','atum','sardinha','cavala','bacalhau','tofu','ovos','queijo'],
  c:meal===0||meal===2?['pao','aveia','banana']:['arroz','massa','batata','cuscuz','lentilhas','grao','feijao','pao','aveia'],
  v:['brocolos','cenoura','salada','curgete','espinafre','cogumelos'],
  f:['banana','maca','pera','kiwi','laranja','pessego','ameixa','morangos','mirtilos','manga','melao','melancia','uvas','tangerina','diospiro','romã'],
  g:meal===0||meal===2?['nozes','amendoas','cajus','amendoim','avelas']:['azeite','nozes','amendoas']
 }[cat];
 return allowed.filter(id=>F[id]&&capacity(id)>=.25);
};
function mealScore(parts,i){
 const n=sum(parts),target=autoTarget()*AUTO_WEIGHTS[i],prot=AUTO_PROT[i],fat=AUTO_FAT[i];
 return 2.2*Math.abs(n.kcal-target)/target+1.6*Math.abs(n.p-prot)/prot+.45*Math.abs(n.f-fat)/Math.max(10,fat);
}
function make(i,used){
 const proteins=pool('p',i),carbs=pool('c',i),fruit=pool('f',i),veg=pool('v',i),fats=pool('g',i);
 if(!proteins.length||!carbs.length)return null;
 let best=null;
 for(let attempt=0;attempt<90;attempt++){
  let trial=[];const usedLocal={...used};
  const groups=[proteins,carbs];
  if(i===0||i===2){if(fruit.length&&Math.random()<.92)groups.push(fruit);if(fats.length&&Math.random()<.55)groups.push(fats)}
  else {if(veg.length&&Math.random()<.95)groups.push(veg);if(fats.length&&Math.random()<.9)groups.push(fats);if(fruit.length&&Math.random()<.35)groups.push(fruit)}
  let good=true;
  for(const ids of groups){
   const possible=ids.filter(id=>available(id,usedLocal,.25));
   if(!possible.length){if(groups.indexOf(ids)<2){good=false;break}continue}
   const id=possible[Math.floor(Math.random()*possible.length)];
   const initial=.5;
   if(!available(id,usedLocal,initial)){if(groups.indexOf(ids)<2){good=false;break}continue}
   trial.push({id,q:initial});usedLocal[id]=(usedLocal[id]||0)+initial;
  }
  if(!good||trial.length<2)continue;
  for(let round=0;round<10;round++){
   let improvement=null,score=mealScore(trial,i);
   for(let j=0;j<trial.length;j++)for(const delta of [-.25,.25]){
    const t=trial.map(x=>({...x}));t[j].q=+(t[j].q+delta).toFixed(2);
    if(t[j].q<.25||t[j].q>3)continue;
    const map={...used};let okay=true;
    for(const x of t){if(!available(x.id,map,x.q)){okay=false;break}map[x.id]=(map[x.id]||0)+x.q}
    if(!okay)continue;
    const n=mealScore(t,i);if(n<score-.008){score=n;improvement=t}
   }
   if(!improvement)break;trial=improvement;
  }
  const score=mealScore(trial,i);
  if(!best||score<best.score)best={parts:trial,score};
 }
 return best?.parts||null;
}
function totalUsed(day,exclude=-1){let used={};for(const [index,m] of Object.entries(day||{})){
 if(+index===exclude||!m||m.done)continue;
 for(const x of m.parts||[])used[x.id]=(used[x.id]||0)+x.q;
 }return used}
function isValid(day){
 if(!day||[0,1,2,3].some(i=>!day[i]?.parts?.length))return false;
 let used={};for(let i=0;i<4;i++)for(const x of day[i].parts){if(!F[x.id]||!available(x.id,used,x.q))return false;used[x.id]=(used[x.id]||0)+x.q}
 return true;
}
function generate(){
 const k=date(),previous=daily()[k]||{};
 if(Object.values(previous).some(m=>m.done)){alert('Há refeições consumidas. Desfaz os registos antes de gerar um novo plano.');return}
 let best=null;
 // Search several full-day combinations instead of locking the first meal choice.
 for(let attempt=0;attempt<10;attempt++){
  let day={},used={},score=0,valid=true;
  for(const i of [1,3,0,2]){
   const parts=make(i,used);if(!parts){valid=false;break}
   day[i]={parts,done:false};score+=mealScore(parts,i);
   for(const x of parts)used[x.id]=(used[x.id]||0)+x.q;
  }
  if(valid&&(!best||score<best.score))best={day,score};
  if(best?.score<.85)break;
 }
 if(!best){
  // A partial plan is NOT a valid daily plan. Preserve existing meals and explain.
  feedback('Não foi possível formar as quatro refeições. Confirma unidades e quantidades dos alimentos; o plano anterior foi mantido.');
  render();return;
 }
 daily()[k]=best.day;save();render();feedback('Quatro refeições criadas com os alimentos disponíveis. Valores nutricionais estimados.');
}
function feedback(msg){const el=document.getElementById('autoFeedback');if(el)el.textContent=msg}
function nutritionLine(n){return `≈ ${Math.round(n.kcal)} kcal · ${Math.round(n.p)} g proteína · ${Math.round(n.c)} g hidratos · ${Math.round(n.f)} g gordura`}
function render(){
 const k=date(),day=daily()[k]||{};
 const t=autoIsTrain();for(const [id,on] of [['autoTrain',t],['autoRest',!t]]){const el=document.getElementById(id);if(el){el.classList.toggle('selected',on);el.setAttribute('aria-pressed',String(on))}}
 const heading=document.getElementById('autoDay');if(heading)heading.textContent=t?'Dia de treino':'Dia de descanso';
 const el=document.getElementById('autoMeals');if(!el)return;
 let total={kcal:0,p:0,c:0,f:0},consumed={kcal:0,p:0,c:0,f:0};
 let html='';
 for(let i=0;i<4;i++){
  const m=day[i];if(!m?.parts?.length){html+=`<article class="card meal"><div class="row"><b>${keys[i]}</b><span>${hours[i]}</span></div><p class="auto-warning">Refeição por gerar. Carrega em Novo Plano Alimentar.</p></article>`;continue}
  const n=sum(m.parts);for(const key of Object.keys(total)){total[key]+=n[key];if(m.done)consumed[key]+=n[key]}
  html+=`<article class="card meal"><div class="row"><b>${keys[i]}</b><span>${hours[i]}</span></div><div class="v12-foods">${m.parts.map((x,j)=>`<div class="v12-food"><div><b>${esc(F[x.id][0])}</b><div class="muted">${x.q} × ${esc(F[x.id][6])}</div></div><button type="button" class="btn outline" ${m.done?'disabled':''} onclick="v16Swap(${i},${j})">↻ Substituir</button></div><div class="v12-alternatives" id="v16-alt-${i}-${j}" hidden></div>`).join('')}</div><p class="auto-macros">${nutritionLine(n)}</p><button class="btn v12-consume" onclick="v16Record(${i})">${m.done?'✓ Consumida · desfazer':'✓ Registar refeição consumida'}</button></article>`;
 }
 el.innerHTML=html;
 const summary=document.getElementById('autoSummary');if(summary)summary.innerHTML=[['Energia',Math.round(total.kcal)+' / '+autoTarget()+' kcal'],['Proteína',Math.round(total.p)+' / 140 g'],['Hidratos',Math.round(total.c)+' g'],['Gordura',Math.round(total.f)+' g'],['Consumido',Math.round(consumed.kcal)+' kcal']].map(([a,b])=>`<div><strong>${b}</strong><span>${a}</span></div>`).join('');
 const complete=[0,1,2,3].every(i=>day[i]?.parts?.length);
 if(complete){const delta=Math.abs(total.kcal-autoTarget())/autoTarget();if(delta>.12)feedback('Plano completo, mas a energia fica afastada da meta. Confirma as quantidades reais e ajusta o stock. Valores aproximados.');}
}
function swap(i,j){
 const m=daily()[date()]?.[i];if(!m||m.done)return;
 const old=m.parts[j],used=totalUsed(daily()[date()],i);
 for(const [index,x] of m.parts.entries())if(index!==j)used[x.id]=(used[x.id]||0)+x.q;
 const cat=F[old.id][1],target=sum([old]);let opts=[];
 const ids=Object.keys(F).filter(id=>id!==old.id&&F[id][1]===cat&&F[id][1]!=='sobremesa'&&capacity(id)>.25);
 for(const id of ids){let best=null;for(let q=.25;q<=2.5;q+=.25){if(!available(id,used,q))continue;
  const n=sum([{id,q}]),d=2*Math.abs(n.kcal-target.kcal)/Math.max(40,target.kcal)+Math.abs(n.p-target.p)/Math.max(6,target.p)+.5*Math.abs(n.c-target.c)/Math.max(8,target.c)+.5*Math.abs(n.f-target.f)/Math.max(5,target.f);
  if(!best||d<best.d)best={id,q,d,n};}
  if(best)opts.push(best);
 }
 opts.sort((a,b)=>a.d-b.d);const panel=document.getElementById(`v16-alt-${i}-${j}`);if(!panel)return;
 panel.innerHTML=opts.length?opts.slice(0,5).map(o=>`<button type="button" class="v12-alt" onclick="v16Replace(${i},${j},'${o.id}',${o.q})"><b>${esc(F[o.id][0])}</b><small>${o.q} × ${esc(F[o.id][6])} · ${nutritionLine(o.n)} · ${Math.round((o.n.kcal-target.kcal))>=0?'+':''}${Math.round(o.n.kcal-target.kcal)} kcal face ao original</small></button>`).join(''):'<p class="muted">Não há alternativas desta categoria em quantidade suficiente.</p>';
 panel.hidden=false;
}
function replace(i,j,id,q){const day=daily()[date()]||{},m=day[i];if(!m||m.done||!F[id])return;
 const used=totalUsed(day,i);for(const [idx,x] of m.parts.entries())if(idx!==j)used[x.id]=(used[x.id]||0)+x.q;
 if(!available(id,used,q))return alert('Stock insuficiente para esta alternativa.');
 m.parts[j]={id,q};save();render();feedback('Substituído apenas um alimento. Valores nutricionais recalculados.');
}
function record(i){
 const day=daily()[date()]||{},m=day[i];if(!m)return;
 db.autoStockLedger??={};const key=date()+':'+i;
 if(m.done){
  for(const x of db.autoStockLedger[key]||[]){const s=stock().find(s=>s.name===x.name);if(s)s.qty=+(Number(s.qty)+x.qty).toFixed(3)}
  delete db.autoStockLedger[key];m.done=false;save();window.render?.();render();return;
 }
 const ledger=[];for(const x of m.parts){const s=find(x.id),q=usage(x.id,x.q);if(!s||!Number.isFinite(q))return alert('Não é possível converter o stock de '+F[x.id][0]);
  const line=ledger.find(v=>v.name===s.name);if(line)line.qty+=q;else ledger.push({name:s.name,qty:q});
 }
 if(ledger.some(x=>Number(stock().find(s=>s.name===x.name)?.qty||0)+1e-7<x.qty))return alert('Stock insuficiente para registar esta refeição.');
 for(const x of ledger){const s=stock().find(s=>s.name===x.name);s.qty=+(Number(s.qty)-x.qty).toFixed(3)}
 db.autoStockLedger[key]=ledger;m.done=true;save();window.render?.();render();
}
function training(v){if(autoIsTrain()===v)return;const day=daily()[date()]||{};if(Object.values(day).some(m=>m.done))return alert('Desfaz primeiro as refeições consumidas.');db.training[date()]=v;save();generate()}
window.v16Swap=swap;window.v16Replace=replace;window.v16Record=record;
window.autoGenerateAll=generate;window.autoTraining=training;window.v12RefreshMeals=render;
// Regenerate only incomplete, unconsumed legacy plans. Preserve consumed history.
const old=daily()[date()]||{};
if(!Object.values(old).some(m=>m.done)&&!isValid(old))generate();else render();
})();
