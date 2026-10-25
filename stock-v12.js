
/* LB Nutrition V12 — pantry-only meal planning and ingredient swaps.
   All nutrient figures remain estimates; stock in household units. */
(function(){
'use strict';
const A=window;
const foods=AUTO_FOODS,choices=AUTO_CHOICES;
const categories=['p','c','v','f','g'];
const allowed=new Set(Object.values(choices).flatMap(x=>Object.values(x).flat()));
const keys=Object.keys(foods);
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const stockFor=id=>(db.stock||[]).find(s=>norm(s.name)===norm(foods[id][7]));
const servingGrams=id=>{let txt=foods[id][6],m=txt.match(/~\s*(\d+)\s*(g|ml)/i);return m?Number(m[1]):null};
const countInServing=id=>id==='ovos'?2:id==='triangulo'?1:1;
function stockCapacity(id){
 const s=stockFor(id);if(!s||!Number.isFinite(+s.qty)||+s.qty<=0)return 0;
 const unit=norm(s.unit),qty=+s.qty,grams=servingGrams(id);
 if(unit==='kg'&&grams)return qty*1000/grams;
 if((unit==='g'||unit==='gramas')&&grams)return qty/grams;
 if(unit==='l'&&grams)return qty*1000/grams;
 if((unit==='ml'||unit==='mililitros')&&grams)return qty/grams;
 if((unit==='un.'||unit==='unidades'||unit==='unidade')&&id==='ovos')return qty/2;
 if(unit==='un.'||unit==='unidades'||unit==='unidade')return qty/countInServing(id);
 if(unit.includes('pacote')||unit.includes('embalagem')){
  const m=unit.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml)/);
  if(m&&grams){let mult=(m[2]==='kg'||m[2]==='l')?1000:1;return qty*Number(m[1].replace(',','.'))*mult/grams}
  return qty; // package without size: treat as a single household serving, flag as estimate
 }
 return qty; // "porções", "taças", "latas" etc. = one recipe serving each
}
function stockUsed(id,q){
 const s=stockFor(id);if(!s)return 0;const cap=stockCapacity(id);return cap>0?(+s.qty)*q/cap:Infinity;
}
function committed(){
 let out={};for(const [key,meal] of Object.entries(autoDb()[autoToday()]||{})){
  if(!meal||meal.done)continue;
  for(const part of meal.parts||[])out[part.id]=(out[part.id]||0)+part.q;
 }return out;
}
function remaining(id,excludeMeal=-1){
 const day=autoDb()[autoToday()]||{};
 let reserved=0;
 for(const [index,m] of Object.entries(day)){
  if(+index===excludeMeal||m.done)continue;
  for(const part of m.parts||[])if(part.id===id)reserved+=part.q;
 }
 return Math.max(0,stockCapacity(id)-reserved);
}
function valid(parts,excludeMeal=-1){
 const count={};for(const x of parts){count[x.id]=(count[x.id]||0)+x.q;if(!allowed.has(x.id))return false}
 return Object.entries(count).every(([id,q])=>remaining(id,excludeMeal)+1e-6>=q);
}
function nutrientScore(parts,i){
 const n=autoSum(parts),energy=autoTarget()*AUTO_WEIGHTS[i],protein=AUTO_PROT[i],fat=AUTO_FAT[i];
 return 2*Math.abs(n.kcal-energy)/energy+1.3*Math.abs(n.p-protein)/protein+.4*Math.abs(n.f-fat)/fat;
}
function makeMeal(i){
 // Proteína + hidrato são the core of a meal. Fruit, vegetables and fats are optional
 // if unavailable. Never require an ingredient merely to satisfy a rigid template.
 const groups=choices[i];
 const pool={};for(const cat of categories)pool[cat]=(groups[cat]||[]).filter(id=>foods[id]&&remaining(id,i)>=.25);
 const existing=Object.values(autoDb()[autoToday()]||{}).flatMap(m=>(m.parts||[]).map(x=>x.id));
 const core=['p','c'];
 // If one group is unavailable, build the best feasible partial meal and mark it
 // nutritionally incomplete, instead of claiming the whole pantry is empty.
 const present=core.filter(cat=>pool[cat].length);
 if(!present.length)return null;
 let best=null;
 for(let n=0;n<200;n++){
  let parts=[];
  for(const cat of categories){
   if(!pool[cat].length)continue;
   if(cat==='v'||cat==='f'||cat==='g'){
    // Include when stock allows; never block the main meal for lack of olive oil or fruit.
    if(Math.random()<.13)continue;
   }
   const id=pool[cat][Math.floor(Math.random()*pool[cat].length)];
   parts.push({id,q:.25});
  }
  if(!valid(parts,i))continue;
  for(let k=0;k<24;k++){
   let candidate=null,old=nutrientScore(parts,i);
   for(let j=0;j<parts.length;j++)for(const delta of [-.25,.25]){
    const q=+(parts[j].q+delta).toFixed(2);
    if(q<.25||q>3)continue;
    const trial=parts.map(x=>({...x}));trial[j].q=q;
    if(!valid(trial,i))continue;
    const score=nutrientScore(trial,i);
    if(score<old-.005){old=score;candidate=trial}
   }
   if(!candidate)break;parts=candidate;
  }
  const score=nutrientScore(parts,i)+parts.filter(x=>existing.includes(x.id)).length*.08+
   (pool.p.length&&!parts.some(x=>foods[x.id][1]==='proteina')?4:0)+
   (pool.c.length&&!parts.some(x=>foods[x.id][1]==='hidrato')?4:0);
  if(!best||score<best.score)best={parts,score};
 }
 return best?.parts||null;
}
function regenerate(){
 const k=autoToday(),day=autoDb()[k]||{};
 if(Object.values(day).some(m=>m.done)){
  alert('Existem refeições já consumidas. Desfaz primeiro os registos para criar um novo plano.');return;
 }
 autoDb()[k]={};
 let missing=[];
 for(let i=0;i<4;i++){
  const parts=makeMeal(i);
  if(parts)autoDb()[k][i]={parts,done:false};
  else missing.push(AUTO_KEYS[i]);
 }
 save();renderMeals();
 if(missing.length)autoFeedback('Não há proteína nem acompanhamento compatível em stock para: '+missing.join(', ')+'. Verifica as quantidades na despensa.');
 else autoFeedback('Plano criado apenas com alimentos disponíveis na despensa.');
}
function train(v){
 const k=autoToday();if(Object.values(autoDb()[k]||{}).some(x=>x.done)){alert('Desfaz primeiro as refeições consumidas.');return}
 db.training[k]=v;save();regenerate();
}
function alternatives(i,j){
 const meal=autoDb()[autoToday()]?.[i];if(!meal||meal.done)return [];
 const old=meal.parts[j],group=foods[old.id][1],current=autoSum([old]),target=autoSum(meal.parts);
 let arr=[];
 for(const id of (Object.values(choices[i]).flat())){
  if(id===old.id||foods[id][1]!==group)continue;
  let best=null;
  for(let q=.25;q<=2.5;q+=.25){
   q=+q.toFixed(2);
   if(remaining(id,i)<q)continue;
   const alt=autoSum([{id,q}]),newMeal=autoSum([...meal.parts.filter((_,k)=>k!==j),{id,q}]);
   const dist=2*Math.abs(alt.kcal-current.kcal)/Math.max(40,current.kcal)+
    Math.abs(alt.p-current.p)/Math.max(5,current.p)+
    .6*Math.abs(alt.c-current.c)/Math.max(10,current.c)+
    .6*Math.abs(alt.f-current.f)/Math.max(5,current.f);
   if(!best||dist<best.dist)best={id,q,dist,alt,newMeal};
  }
  if(best)arr.push(best);
 }
 return arr.sort((a,b)=>a.dist-b.dist).slice(0,6);
}
function selectSwap(i,j){
 const options=alternatives(i,j);
 const panel=document.getElementById('v12Alternatives-'+i+'-'+j);
 if(!panel)return;
 if(!options.length){panel.innerHTML='<span class="muted">Não há alternativa equivalente disponível na despensa.</span>';panel.hidden=false;return}
 panel.innerHTML='<div class="muted">Alternativas disponíveis · valores estimados</div>'+options.map(x=>{
  const original=autoSum([autoDb()[autoToday()][i].parts[j]]);
  const kcal=Math.round(x.alt.kcal-original.kcal),prot=(x.alt.p-original.p).toFixed(1);
  return `<button type="button" class="v12-alt" onclick="window.v12Replace(${i},${j},'${x.id}',${x.q})"><b>${escapeHtml(foods[x.id][0])}</b><small>${x.q} × ${escapeHtml(foods[x.id][6])} · ${kcal>=0?'+':''}${kcal} kcal · ${prot>=0?'+':''}${prot} g proteína</small></button>`;
 }).join('')+'<button class="btn outline" type="button" onclick="this.parentElement.hidden=true">Cancelar</button>';
 panel.hidden=false;
}
function replace(i,j,id,q){
 const m=autoDb()[autoToday()]?.[i];if(!m||m.done)return;
 const options=alternatives(i,j);
 if(!options.some(x=>x.id===id&&x.q===q))return alert('Alternativa já não disponível.');
 const parts=m.parts.map(x=>({...x}));parts[j]={id,q};
 if(!valid(parts,i))return alert('Stock insuficiente.');
 m.parts=parts;save();renderMeals();autoFeedback('Substituído apenas um ingrediente. Os restantes foram mantidos.');
}
function record(i){
 const day=autoDb()[autoToday()]||{},m=day[i];if(!m)return;
 db.autoStockLedger??={};
 const key=autoToday()+':'+i;
 if(m.done){
  for(const item of db.autoStockLedger[key]||[]){const s=db.stock.find(x=>x.name===item.name);if(s)s.qty=+(+s.qty+item.qty).toFixed(3)}
  delete db.autoStockLedger[key];m.done=false;save();render();renderMeals();autoFeedback('Registo desfeito e stock reposto.');return;
 }
 if(!valid(m.parts,i))return alert('A quantidade disponível já não é suficiente para esta porção.');
 const amounts={};
 for(const part of m.parts){
  const s=stockFor(part.id),qty=stockUsed(part.id,part.q);
  if(!s||!Number.isFinite(qty))return alert('Confirma a unidade e a quantidade do stock de '+foods[part.id][0]);
  amounts[s.name]=(amounts[s.name]||0)+qty;
 }
 if(Object.entries(amounts).some(([name,q])=>(db.stock.find(s=>s.name===name)?.qty||0)+1e-6<q))return alert('Stock insuficiente para registar esta refeição.');
 db.autoStockLedger[key]=[];
 for(const [name,q] of Object.entries(amounts)){
  const s=db.stock.find(x=>x.name===name);s.qty=+(s.qty-q).toFixed(3);
  db.autoStockLedger[key].push({name,qty:q});
 }
 m.done=true;save();render();renderMeals();autoFeedback('Refeição consumida. Quantidades descontadas da despensa.');
}
function renderMeals(){
 const k=autoToday(),day=autoDb()[k]||{};
 const active=autoIsTrain();
 for(const [id,v] of [['autoTrain',active],['autoRest',!active]]){
  const el=document.getElementById(id);if(el){el.classList.toggle('selected',v);el.setAttribute('aria-pressed',String(v))}
 }
 document.getElementById('autoDay').textContent=active?'Dia de treino':'Dia de descanso';
 let total={kcal:0,p:0,c:0,f:0},consumed={kcal:0,p:0,c:0,f:0};
 let html='';
 for(let i=0;i<4;i++){
  const meal=day[i];
  if(!meal){html+=`<article class="card meal"><div class="row"><b>${AUTO_KEYS[i]}</b><span>${AUTO_HOURS[i]}</span></div><p class="auto-warning">Não existem alimentos suficientes na despensa para esta refeição.</p><button class="btn outline" type="button" onclick="tab('pantry')">Abrir despensa</button></article>`;continue}
  const sum=autoSum(meal.parts);
  for(const field of Object.keys(total)){total[field]+=sum[field];if(meal.done)consumed[field]+=sum[field]}
  const ok=valid(meal.parts,i)||meal.done;
  html+=`<article class="card meal ${meal.done?'auto-done':''}"><div class="row"><span class="eyebrow">${AUTO_KEYS[i]}</span><span class="muted">${AUTO_HOURS[i]}</span></div>
  <div class="v12-foods">${meal.parts.map((part,j)=>`<div class="v12-food"><div><b>${escapeHtml(foods[part.id][0])}</b><div class="muted">${part.q} × ${escapeHtml(foods[part.id][6])}</div></div><button type="button" class="btn outline" ${meal.done?'disabled':''} onclick="window.v12Alternatives(${i},${j})">↻ Substituir</button></div><div class="v12-alternatives" id="v12Alternatives-${i}-${j}" hidden></div>`).join('')}</div>
  <p class="auto-macros">≈ ${Math.round(sum.kcal)} kcal · ${Math.round(sum.p)} g proteína · ${Math.round(sum.c)} g hidratos · ${Math.round(sum.f)} g gordura</p>
  ${!ok?'<p class="auto-warning">Stock insuficiente. Ajusta a despensa ou substitui o ingrediente.</p>':'<p class="stock-ready">✓ Ingredientes disponíveis na despensa</p>'}
  <button class="btn v12-consume" type="button" onclick="window.v12Record(${i})">${meal.done?'✓ Consumida · desfazer registo':'✓ Registar refeição consumida'}</button></article>`;
 }
 document.getElementById('autoMeals').innerHTML=html;
 document.getElementById('autoSummary').innerHTML=[['Plano',Math.round(total.kcal)+' kcal'],['Proteína',Math.round(total.p)+' / 140 g'],['Gordura',Math.round(total.f)+' g'],['Hidratos',Math.round(total.c)+' g'],['Consumido',Math.round(consumed.kcal)+' kcal']].map(([a,b])=>`<div><strong>${b}</strong><span>${a}</span></div>`).join('');
}
function syncShopping(){
 const extra=db.v12Shopping??[];
 const existing=new Set((db.stock||[]).filter(s=>s.qty<=0||s.qty<s.min).map(s=>s.name));
 const absent=keys.filter(id=>allowed.has(id)&&!stockFor(id)).map(id=>foods[id][7]);
 // No automatic shopping of entire catalog: explicit requests only.
 const items=[...new Set([...extra,...Array.from(existing)])];
 const target=document.getElementById('v12Shopping');if(!target)return;
 target.innerHTML=items.length?items.map(name=>`<div class="v12-shopitem"><span>${escapeHtml(name)}</span><button class="btn outline" onclick="window.v12Purchased('${encodeURIComponent(name)}')">✓ Tenho este alimento</button></div>`).join(''):'<p class="muted">Sem compras pendentes.</p>';
}
function buy(encoded){
 const name=decodeURIComponent(encoded),str=prompt('Quantas porções/unidades tens agora de '+name+'?','1');
 if(str===null)return;const qty=Number(str.replace(',','.'));
 if(!Number.isFinite(qty)||qty<=0)return alert('Indica uma quantidade superior a zero.');
 let s=db.stock.find(x=>x.name===name);
 if(s)s.qty=qty;else db.stock.push({name,unit:'porções',qty,min:0});
 db.v12Shopping=(db.v12Shopping||[]).filter(n=>n!==name);
 save();render();renderMeals();syncShopping();
}
function addToShopping(id){
 const name=foods[id]?.[7];if(!name)return;
 db.v12Shopping??=[];if(!db.v12Shopping.includes(name))db.v12Shopping.push(name);
 save();syncShopping();autoFeedback('Alimento acrescentado à lista de compras.');
}
A.v12RefreshMeals=renderMeals;A.v12Replace=replace;A.v12Alternatives=selectSwap;A.v12Record=record;A.v12Purchased=buy;A.v12ShoppingAdd=addToShopping;
A.autoGenerateAll=regenerate;A.autoTraining=train;
A.autoSwap=()=>alert('Agora podes substituir cada alimento individualmente.');
A.autoPantry=()=>alert('O plano já utiliza exclusivamente a despensa.');
// Preserve existing meals on upgrade, but mark shortages; never silently change consumed meals.
if(!db.autoStockLedger)db.autoStockLedger={};
if(!db.autoMeals||!db.autoMeals[autoToday()]||Object.keys(db.autoMeals[autoToday()]).length===0)regenerate();
else {
 const day=autoDb()[autoToday()];
 if(!Object.values(day).some(m=>m.done)&&Object.entries(day).some(([i,m])=>m&&!valid(m.parts,+i))){regenerate();}
 else renderMeals();
}
const oldTab=window.tab;
window.tab=function(id){oldTab(id);if(id==='auto')renderMeals();if(id==='shopping')syncShopping()};
const oldRender=window.render;
window.render=function(){oldRender();syncShopping()};
syncShopping();
})();
