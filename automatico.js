/* LB Nutrition V7: motor automático, catálogo ilustrativo de porções.
   Valores aproximados por porção, não dados certificados. */
const AUTO_FOODS={
 ovos:['Ovos','proteina',144,13,1,10,'2 ovos','Ovos'],frango:['Frango grelhado','proteina',198,37,0,4,'1 bife grande (~120 g cozinhado)','Frango/peru'],peru:['Peru grelhado','proteina',180,36,0,3,'1 bife grande (~120 g)','Frango/peru'],pescada:['Pescada','proteina',125,27,0,2,'1 filete grande (~130 g)','Pescada/salmão'],salmao:['Salmão','proteina',250,27,0,15,'1 posta média (~130 g)','Pescada/salmão'],atum:['Atum ao natural','proteina',116,25,0,1,'1 lata escorrida','Atum'],sardinha:['Sardinhas','proteina',210,26,0,11,'1 porção (~120 g)','Sardinhas/cavala'],tofu:['Tofu firme','proteina',180,20,4,10,'1 porção (~160 g)','Tofu'],iogurte:['Iogurte tipo skyr natural','proteina',120,20,8,0,'1 embalagem (~200 g)','Iogurtes proteicos'],queijo:['Queijo fresco magro','proteina',110,17,4,3,'1 embalagem (~150 g)','Queijo fresco'],
 arroz:['Arroz cozido','hidrato',195,4,43,1,'1 chávena (~150 g)','Arroz'],batata:['Batata cozida','hidrato',155,4,35,0,'2 batatas pequenas (~180 g)','Batata'],massa:['Massa cozida','hidrato',235,8,46,2,'1 prato pequeno (~150 g)','Massa'],pao:['Pão de mistura','hidrato',165,6,31,2,'2 fatias (~65 g)','Pão de mistura'],aveia:['Flocos de aveia','hidrato',190,7,32,4,'5 colheres de sopa (~50 g)','Aveia'],cuscuz:['Cuscuz cozido','hidrato',170,6,35,0,'1 chávena (~150 g)','Cuscuz'],
 brocolos:['Brócolos cozidos','vegetal',50,4,8,1,'1 taça (~150 g)','Brócolos/couves'],cenoura:['Cenoura','vegetal',55,1,12,0,'1 cenoura grande','Cenoura'],salada:['Salada mista','vegetal',45,2,8,0,'1 taça generosa','Salada/tomate'],curgete:['Curgete salteada','vegetal',50,2,7,2,'1 taça (~150 g)','Curgete'],espinafre:['Espinafres','vegetal',40,4,5,0,'1 taça (~150 g)','Espinafres'],
 banana:['Banana','fruta',105,1,27,0,'1 banana média','Bananas'],maca:['Maçã','fruta',85,0,22,0,'1 maçã média','Maçãs'],pera:['Pera','fruta',95,1,25,0,'1 pera média','Peras'],kiwi:['Kiwi','fruta',55,1,13,0,'1 kiwi','Kiwis'],laranja:['Laranja','fruta',65,1,16,0,'1 laranja','Laranjas'],
 azeite:['Azeite','gordura',90,0,0,10,'1 colher de sopa rasa','Azeite'],nozes:['Nozes','gordura',130,3,3,13,'1 punhado pequeno (~20 g)','Nozes'],amendoim:['Manteiga de amendoim','gordura',95,4,3,8,'1 colher de sopa (~16 g)','Manteiga de amendoim']
};
const AUTO_KEYS=['Pequeno-almoço','Almoço','Lanche','Jantar'];
const AUTO_HOURS=['07:30','13:00','17:00','20:30'];
const AUTO_WEIGHTS=[.225,.305,.185,.285];
const AUTO_PROT=[30,40,30,40];
const AUTO_CHOICES=[
 {p:['ovos','iogurte','queijo','kefir'],c:['pao','aveia'],v:[],f:['banana','maca','kiwi','pera','laranja','pessego','ameixa','morangos','mirtilos','manga','melao','melancia','uvas','tangerina'],g:['nozes','amendoas','cajus','amendoim','avelas']},
 {p:['frango','peru','pescada','salmao','atum','sardinha','cavala','bacalhau','tofu'],c:['arroz','batata','massa','cuscuz','lentilhas','grao','feijao'],v:['brocolos','cenoura','salada','curgete','espinafre'],f:['maca','pera','laranja','kiwi','pessego','ameixa','melao','melancia','tangerina','diospiro'],g:['azeite']},
 {p:['iogurte','queijo','ovos','kefir'],c:['pao','aveia'],v:[],f:['banana','maca','pera','kiwi','pessego','morangos','mirtilos','melao','uvas'],g:['nozes','amendoas','cajus','amendoim','avelas']},
 {p:['frango','peru','pescada','salmao','atum','sardinha','cavala','bacalhau','tofu'],c:['arroz','batata','massa','cuscuz','lentilhas','grao','feijao'],v:['brocolos','cenoura','salada','curgete','espinafre'],f:['kiwi','maca','pera','laranja','pessego','romã','tangerina','uvas'],g:['azeite']}
];
function autoDb(){db.autoMeals??={};return db.autoMeals}
function autoToday(){return dateKey()}
function autoIsTrain(){return db.training[autoToday()]!==false}
function autoTraining(v){let k=autoToday();if(db.training[k]===v)return; if(Object.values(autoDb()[k]||{}).some(x=>x.done)){alert('Já registaste refeições hoje. Desmarca-as antes de alterar o tipo de dia.');return;} db.training[k]=v;save();autoGenerateAll();autoFeedback('Tipo de dia atualizado.');}
function autoTarget(){return autoIsTrain()?2450:2250}
function autoSum(parts){let r={kcal:0,p:0,c:0,f:0};for(let item of parts){let a=AUTO_FOODS[item.id],q=item.q;r.kcal+=a[2]*q;r.p+=a[3]*q;r.c+=a[4]*q;r.f+=a[5]*q}return r}
function autoPick(i,excluded=[],pantryFirst=false){let choices=AUTO_CHOICES[i],target=autoTarget()*AUTO_WEIGHTS[i],pTarget=AUTO_PROT[i],best=null;const inStock=id=>(db.stock||[]).some(s=>s.name===AUTO_FOODS[id][7]&&s.qty>0);
for(let n=0;n<65;n++){let parts=[];for(let category of ['p','c','v','f','g']){let arr=choices[category];if(!arr.length)continue;let id=arr[Math.floor(Math.random()*arr.length)];parts.push({id,q:1})}
// Ajustar porções em passos realistas, não maximizar só a proteína.
for(let k=0;k<18;k++){let sum=autoSum(parts),old=Math.abs(sum.kcal-target)/target*2+Math.abs(sum.p-pTarget)/Math.max(pTarget,1)*1.3;let changed=false;for(let j=0;j<parts.length;j++){for(let delta of [-.25,.25]){let q=parts[j].q+delta;if(q<.5||q>2.5)continue;let trial=parts.map(x=>({...x}));trial[j].q=q;let t=autoSum(trial),score=Math.abs(t.kcal-target)/target*2+Math.abs(t.p-pTarget)/Math.max(pTarget,1)*1.3;if(score+0.015<old){parts=trial;old=score;changed=true}}}if(!changed)break}
let sum=autoSum(parts),score=Math.abs(sum.kcal-target)/target*2+Math.abs(sum.p-pTarget)/pTarget*1.3;score+=parts.filter(x=>!inStock(x.id)).length*(pantryFirst?.8:.035);score+=parts.filter(x=>excluded.includes(x.id)).length*.4;if(!best||score<best.score)best={parts,score};}
return best.parts}
function autoGenerateAll(){let k=autoToday();if(Object.values(autoDb()[k]||{}).some(x=>x.done)&&!confirm('Existem refeições automáticas já registadas. Substituir todas as sugestões deste dia?'))return;let used=[];autoDb()[k]={};for(let i=0;i<4;i++){let parts=autoPick(i,used);autoDb()[k][i]={parts,done:false};used.push(...parts.map(x=>x.id))}save();autoRender();autoFeedback('Plano do dia criado. Podes trocar qualquer refeição.')}
function autoPantry(i){let k=autoToday();if(autoDb()[k]?.[i]?.done)return alert('Desmarca primeiro a refeição.');let others=Object.entries(autoDb()[k]||{}).filter(([j])=>+j!==i).flatMap(([,v])=>v.parts.map(x=>x.id));autoDb()[k][i]={parts:autoPick(i,others,true),done:false};save();autoRender();autoFeedback('Alternativa com prioridade à despensa. Confirma os ingredientes em falta.');}
function autoSwap(i){let k=autoToday();if(autoDb()[k]?.[i]?.done)return alert('Desmarca primeiro a refeição.');let others=Object.entries(autoDb()[k]||{}).filter(([j])=>+j!==i).flatMap(([,v])=>v.parts.map(x=>x.id));autoDb()[k][i]={parts:autoPick(i,others),done:false};save();autoRender();autoFeedback('Nova sugestão criada.')}
function autoDone(i){let v=autoDb()[autoToday()]?.[i];if(!v)return;v.done=!v.done;save();autoRender();autoFeedback(v.done?'Refeição registada.':'Registo desfeito.')}
function autoBackup(){exportData()}
function autoFeedback(message){let el=document.getElementById('autoFeedback');if(el)el.textContent=message}
function autoRender(){let k=autoToday();if(!autoDb()[k]){autoDb()[k]={};let used=[];for(let i=0;i<4;i++){let parts=autoPick(i,used);autoDb()[k][i]={parts,done:false};used.push(...parts.map(x=>x.id))}save()}
document.getElementById('autoDay').textContent=autoIsTrain()?'Dia de treino':'Dia de descanso';document.getElementById('autoTrain').classList.toggle('selected',autoIsTrain());document.getElementById('autoRest').classList.toggle('selected',!autoIsTrain());let total={kcal:0,p:0,c:0,f:0},doneTotal={kcal:0,p:0,c:0,f:0};let html='';for(let i=0;i<4;i++){let meal=autoDb()[k][i];if(!meal)continue;let m=autoSum(meal.parts);for(let x of Object.keys(total)){total[x]+=m[x];if(meal.done)doneTotal[x]+=m[x]};let missing=meal.parts.filter(x=>!(db.stock||[]).some(s=>s.name===AUTO_FOODS[x.id][7]&&s.qty>0)).map(x=>AUTO_FOODS[x.id][0]);html+=`<article class="card meal ${meal.done?'auto-done':''}"><div class="row"><span class="eyebrow">${AUTO_KEYS[i]}</span><span class="muted">${AUTO_HOURS[i]}</span></div><div class="auto-food">${meal.parts.map(x=>`<div>${escapeHtml(AUTO_FOODS[x.id][0])} · ${x.q===1?escapeHtml(AUTO_FOODS[x.id][6]):`${x.q} × ${escapeHtml(AUTO_FOODS[x.id][6])}`}</div>`).join('')}</div><p class="auto-macros">≈ ${Math.round(m.kcal)} kcal · ${Math.round(m.p)} g proteína · ${Math.round(m.c)} g hidratos · ${Math.round(m.f)} g gordura</p>${missing.length?`<p class="auto-warning">Para comprar: ${missing.map(escapeHtml).join(', ')}</p>`:'<p class="stock-ready">✓ Alimentos identificados na despensa</p>'}<div class="actions"><button class="btn light" onclick="autoDone(${i})">${meal.done?'✓ Consumida · desfazer':'✓ Registar consumida'}</button><button class="btn outline" onclick="autoSwap(${i})">↻ Outra sugestão</button><button class="btn outline" onclick="autoPantry(${i})">⌂ Da despensa</button></div></article>`}
document.getElementById('autoMeals').innerHTML=html;document.getElementById('autoSummary').innerHTML=[['Plano',Math.round(total.kcal)+' kcal'],['Proteína',Math.round(total.p)+' / 140 g'],['Consumido',Math.round(doneTotal.kcal)+' kcal']].map(([k,v])=>`<div><strong>${v}</strong><span>${k}</span></div>`).join('')}
const autoOriginalTab=tab;tab=function(name){autoOriginalTab(name);if(name==='auto')autoRender()};
try{autoRender()}catch(e){console.error('Motor automático',e)}

// Expor explicitamente os comandos aos botões HTML.
for (const name of ['autoTraining','autoGenerateAll','autoBackup','autoSwap','autoDone','autoPantry']) {
  const fn = ({autoTraining,autoGenerateAll,autoBackup,autoSwap,autoDone,autoPantry})[name];
  window[name] = (...args) => {
    try { return fn(...args); }
    catch (err) {
      console.error('LB Nutrition:',name,err);
      autoFeedback('Não foi possível concluir a operação. Tenta novamente.');
    }
  };
}
