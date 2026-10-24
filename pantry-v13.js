/* LB Nutrition V13: one personal catalog, one stock source, derived shopping list */
(function(){
'use strict';
const nameKey=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const esc=x=>escapeHtml(String(x));
const finite=x=>Number.isFinite(Number(x))?Number(x):0;
const list=()=>db.stock||[];
function ensure(){
 db.v13??={};db.v13.hidden??=[];db.v13.extra??=[];
 // Imported legacy stock remains personal; all other foods remain in the general catalog.
 for(const s of list()){s.qty=Math.max(0,finite(s.qty));s.min=Math.max(0,finite(s.min));s.unit=s.unit||'porções'}
}
function find(name){return list().find(s=>nameKey(s.name)===nameKey(name))}
function tracked(s){return !db.v13.hidden.some(n=>nameKey(n)===nameKey(s.name))}
function shortages(){
 ensure();
 return list().filter(tracked).filter(s=>s.qty<s.min||s.qty===0).sort((a,b)=>{
 const aa=a.qty===0?0:1,bb=b.qty===0?0:1;
 return aa-bb||a.name.localeCompare(b.name,'pt');
 });
}
function status(s){
 if(s.qty<=0)return {text:'Em falta',cls:'v13-missing'};
 if(s.qty<s.min)return {text:'A repor',cls:'v13-low'};
 return {text:'Disponível',cls:'v13-ok'};
}
function renderPantry(){
 ensure();
 const el=document.getElementById('stockList');if(!el)return;
 const q=nameKey(document.getElementById('v13StockSearch')?.value||'');
 const items=list().filter(tracked).filter(s=>nameKey(s.name).includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'pt'));
 const missing=shortages().length;
 document.getElementById('v13PantryCount').textContent=`${items.length} alimentos · ${missing} a comprar`;
 el.innerHTML=items.length?items.map(s=>{
  const i=list().indexOf(s),st=status(s);
  return `<div class="v13-item"><div class="v13-item-main"><b>${esc(s.name)}</b><span class="v13-status ${st.cls}">${st.text}</span><div class="muted">Tens <b>${s.qty}</b> ${esc(s.unit)} · mínimo ${s.min} ${esc(s.unit)}</div></div><button class="btn outline v13-edit" onclick="window.v13Edit(${i})">Alterar quantidade</button></div>`;
 }).join(''):'<p class="muted">Não foram encontrados alimentos. Procura no catálogo para adicionares um.</p>';
}
function renderShopping(){
 ensure();
 const el=document.getElementById('v13ShoppingList');if(!el)return;
 const needs=shortages();
 const extras=(db.v13.extra||[]).filter(n=>!needs.some(s=>nameKey(s.name)===nameKey(n)));
 document.getElementById('v13ShoppingCount').textContent=`${needs.length+extras.length} alimentos na lista`;
 const markup=needs.map(s=>{
  const idx=list().indexOf(s),st=status(s),diff=Math.max(0,s.min-s.qty);
  return `<div class="v13-item"><div class="v13-item-main"><b>${esc(s.name)}</b><span class="v13-status ${st.cls}">${st.text}</span><div class="muted">Tens ${s.qty} ${esc(s.unit)} · ${diff>0?`faltam ${+diff.toFixed(2)} ${esc(s.unit)}`:'sem stock'}</div></div><button class="btn outline v13-edit" onclick="window.v13Edit(${idx})">Atualizar stock</button></div>`;
 }).join('');
 const manual=extras.map(n=>`<div class="v13-item"><div class="v13-item-main"><b>${esc(n)}</b><div class="muted">Adicionado manualmente</div></div><button class="btn outline" onclick="window.v13EditName('${encodeURIComponent(n)}')">Atualizar stock</button></div>`).join('');
 el.innerHTML=markup+manual||'<p class="v13-empty">✓ Não há alimentos em falta nem abaixo do mínimo.</p>';
}
function updateStock(idx){
 const s=list()[idx];if(!s)return;
 const raw=prompt(`Quantidade atual de ${s.name} (${s.unit}):`,String(s.qty));
 if(raw===null)return;
 const q=Number(raw.replace(',','.'));
 if(!Number.isFinite(q)||q<0)return alert('Indica uma quantidade igual ou superior a zero.');
 const minraw=prompt(`Quantidade mínima desejada de ${s.name} (${s.unit}):`,String(s.min));
 if(minraw===null)return;
 const min=Number(minraw.replace(',','.'));
 if(!Number.isFinite(min)||min<0)return alert('Indica um mínimo igual ou superior a zero.');
 s.qty=q;s.min=min;db.v13.extra=db.v13.extra.filter(n=>nameKey(n)!==nameKey(s.name));
 save();refresh();
}
function updateByName(enc){
 const n=decodeURIComponent(enc);let s=find(n);
 if(!s){s={name:n,unit:'porções',qty:0,min:1};db.stock.push(s)}
 updateStock(list().indexOf(s));
}
function addPersonal(enc){
 const name=decodeURIComponent(enc);
 if(find(name)){db.v13.hidden=db.v13.hidden.filter(n=>nameKey(n)!==nameKey(name));refresh();return}
 const original=Object.entries(AUTO_FOODS).find(([id,x])=>nameKey(x[7])===nameKey(name));
 let unit='porções';
 if(original){const id=original[0];if(['ovos','banana','maca','pera','kiwi','laranja','pessego','diospiro','tangerina','triangulo'].includes(id))unit='un.'}
 db.stock.push({name,unit,qty:0,min:1});
 save();refresh();
}
function renderCatalogState(){
 document.querySelectorAll('#foodCatalogList .catalog-entry').forEach(el=>{
  const button=el.querySelector('button[data-food]');if(!button)return;
  const name=decodeURIComponent(button.dataset.food);
  const s=find(name);
  if(s&&tracked(s)){button.textContent='✓ No meu catálogo';button.disabled=true}
  else{button.textContent='+ Adicionar ao meu catálogo';button.disabled=false}
 });
}
function addManual(){
 const input=document.getElementById('v13ManualAdd');
 const name=input?.value.trim();if(!name)return;
 if(find(name)){alert('Este alimento já está no teu catálogo pessoal.');return}
 db.v13.extra??=[];if(!db.v13.extra.some(x=>nameKey(x)===nameKey(name)))db.v13.extra.push(name);
 input.value='';save();refresh();
}
function copyList(){
 const arr=shortages().map(s=>`• ${s.name}: ${s.qty===0&&s.min===0?'ver quantidade':Math.max(0,s.min-s.qty)} ${s.unit}`);
 for(const n of db.v13.extra)if(!arr.some(x=>x.includes(n)))arr.push('• '+n);
 const t=arr.join('\n')||'Sem compras pendentes';
 if(navigator.clipboard?.writeText)navigator.clipboard.writeText(t).then(()=>alert('Lista copiada.')).catch(()=>prompt('Copia a lista:',t));
 else prompt('Copia a lista:',t);
}
function refresh(){
 renderPantry();renderShopping();renderCatalogState();
 if(typeof renderMeals==='function')renderMeals();
}
window.v13Edit=updateStock;
window.v13EditName=updateByName;
window.v13AddPersonal=addPersonal;
window.v13AddManual=addManual;
window.v13Refresh=refresh;
window.v13Copy=copyList;
// Catalog button delegates to personal tracking; never adds positive stock automatically.
window.addCatalogToPantry=function(enc){addPersonal(enc)};
window.copyShopping=copyList;
// Prevent legacy "bought" checkbox from silently filling stock.
window.bought=function(enc){updateByName(enc)};
const oldRender=window.render;
window.render=function(){oldRender();refresh()};
const oldCatalog=window.renderFoodCatalog;
window.renderFoodCatalog=function(){oldCatalog();renderCatalogState()};
const oldAdd=window.addStock;
window.addStock=function(){oldAdd();refresh()};
const oldTab=window.tab;
window.tab=function(id){oldTab(id);refresh()};
ensure();refresh();
})();
