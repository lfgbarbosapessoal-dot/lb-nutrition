/* LB Nutrition V14 — single stock source; no minimum quantities. */
(function(){
'use strict';
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const esc=x=>escapeHtml(String(x));
const stock=()=>db.stock||[];
const get=n=>stock().find(s=>norm(s.name)===norm(n));
const manual=()=>db.v14.shopping;
const personal=()=>stock().filter(s=>!db.v14.hidden.includes(norm(s.name)));
function init(){
 db.v14??={shopping:[],hidden:[]};
 db.v14.shopping??=[];db.v14.hidden??=[];
 // Migrate only explicitly added shopping entries from older versions.
 for(const n of (db.v14.migrated?[]:[...(db.v13?.extra||[]),...(db.v12Shopping||[])])){
  if(!db.v14.shopping.some(x=>norm(x)===norm(n)))db.v14.shopping.push(n);
 }
 db.v13&&(db.v13.extra=[]);
 db.v12Shopping=[];db.v14.migrated=true;
 for(const s of stock()){
  s.qty=Math.max(0,Number(s.qty)||0);
  s.unit=s.unit||'porções';
 }
}
function refresh(){
 init();
 const q=norm(document.getElementById('v14PantrySearch')?.value);
 const arr=personal().filter(s=>norm(s.name).includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'pt'));
 const el=document.getElementById('v14PantryList');
 if(el)el.innerHTML=arr.length?arr.map(s=>{
  const i=stock().indexOf(s);
  return `<div class="v14-line"><div class="v14-main"><b>${esc(s.name)}</b><span class="v14-mini">${s.qty===0?'Esgotado · nas Compras':s.qty+' '+esc(s.unit)}</span></div><div class="v14-actions"><button class="btn outline" onclick="v14Adjust(${i},-1)" ${s.qty<=0?'disabled':''} aria-label="Retirar uma unidade de ${esc(s.name)}">−</button><span class="v14-qty">${s.qty}</span><button class="btn outline" onclick="v14Adjust(${i},1)" aria-label="Adicionar uma unidade de ${esc(s.name)}">+</button><button class="btn outline" onclick="v14Edit(${i})">Alterar</button></div></div>`;
 }).join(''):'<p class="v14-empty">Ainda não tens alimentos aqui. Adiciona-os pelo catálogo abaixo.</p>';
 const needs=personal().filter(s=>s.qty===0);
 const all=[...needs.map(s=>s.name),...manual().filter(n=>!needs.some(s=>norm(s.name)===norm(n)))];
 const shop=document.getElementById('v14ShoppingList');
 if(shop)shop.innerHTML=all.length?all.map(name=>{
  const s=get(name),missing=!s||s.qty===0;
  return `<div class="v14-line"><div class="v14-main"><b>${esc(name)}</b><span class="v14-mini">${missing?'Esgotado':'Adicionado manualmente'}${s&&s.qty>0?' · tens '+s.qty+' '+esc(s.unit):''}</span></div><div class="v14-actions"><button class="btn v14-buy" onclick="v14Bought('${encodeURIComponent(name)}')">Comprei</button>${!missing?`<button class="btn outline" onclick="v14Remove('${encodeURIComponent(name)}')">Retirar</button>`:''}</div></div>`;
 }).join(''):'<p class="v14-empty">Não tens compras pendentes.</p>';
}
function update(idx,delta){
 const s=stock()[idx];if(!s)return;
 s.qty=Math.max(0,+(s.qty+delta).toFixed(2));
 save();refresh();window.v12RefreshMeals?.();
}
function edit(idx){
 const s=stock()[idx];if(!s)return;
 const str=prompt(`Quantidade de ${s.name} (${s.unit}):`,String(s.qty));
 if(str===null)return;
 const n=Number(str.trim().replace(',','.'));
 if(!Number.isFinite(n)||n<0)return alert('Indica uma quantidade igual ou superior a zero.');
 s.qty=n;save();refresh();window.v12RefreshMeals?.();
}
function add(name,kind){
 if(!name)return;
 if(kind==='shop'){
  if(!manual().some(n=>norm(n)===norm(name)))manual().push(name);
 }else{
  let s=get(name);
  if(!s){s={name,qty:0,unit:guessUnit(name),min:0};stock().push(s)}
  db.v14.hidden=db.v14.hidden.filter(x=>x!==norm(name));
 }
 save();refresh();catalog();shopCatalog();
}
function guessUnit(name){
 const id=Object.keys(AUTO_FOODS).find(k=>norm(AUTO_FOODS[k][7])===norm(name));
 if(id&&['ovos','banana','maca','pera','kiwi','laranja','pessego','ameixa','diospiro','tangerina','triangulo'].includes(id))return 'un.';
 return 'porções';
}
function catalogEntries(search){
 const q=norm(document.getElementById(search)?.value);
 return Object.keys(NUTRI_CATALOG).filter(n=>!q||norm(n).includes(q)).sort((a,b)=>a.localeCompare(b,'pt')).slice(0,40);
}
function catalog(){
 const el=document.getElementById('v14CatalogList');if(!el)return;
 el.innerHTML=catalogEntries('v14CatalogSearch').map(name=>{
  const s=get(name),isPersonal=s&&!db.v14.hidden.includes(norm(name));
  return `<div class="v14-line"><div class="v14-main"><b>${esc(name)}</b><span class="v14-mini">${isPersonal?'Já está na despensa':'Adicionar com stock zero'}</span></div><button class="btn outline" ${isPersonal?'disabled':''} onclick="v14Add('${encodeURIComponent(name)}','pantry')">${isPersonal?'✓ Adicionado':'+ Adicionar'}</button></div>`;
 }).join('');
}
function shopCatalog(){
 const el=document.getElementById('v14ShopCatalogList');if(!el)return;
 const q=norm(document.getElementById('v14ShopSearch')?.value);
 if(!q){el.innerHTML='<p class="v14-empty">Pesquisa um alimento para acrescentar às compras.</p>';return}
 el.innerHTML=catalogEntries('v14ShopSearch').map(name=>{
  const already=manual().some(n=>norm(n)===norm(name))||(get(name)?.qty===0&&personal().includes(get(name)));
  return `<div class="v14-line"><div class="v14-main"><b>${esc(name)}</b></div><button class="btn outline" ${already?'disabled':''} onclick="v14Add('${encodeURIComponent(name)}','shop')">${already?'✓ Na lista':'+ Compras'}</button></div>`;
 }).join('')||'<p class="v14-empty">Alimento não encontrado no catálogo.</p>';
}
function bought(enc){
 const name=decodeURIComponent(enc),s=get(name);
 const unit=s?.unit||guessUnit(name);
 const str=prompt(`Quantas ${unit} compraste de ${name}?`, '1');
 if(str===null)return;
 const q=Number(str.trim().replace(',','.'));
 if(!Number.isFinite(q)||q<=0)return alert('Indica uma quantidade comprada superior a zero.');
 if(s)s.qty=+(s.qty+q).toFixed(2);
 else stock().push({name,qty:q,unit,min:0});
 db.v14.hidden=db.v14.hidden.filter(x=>x!==norm(name));
 db.v14.shopping=manual().filter(n=>norm(n)!==norm(name));
 save();refresh();catalog();shopCatalog();
 window.v12RefreshMeals?.();
}
function remove(enc){
 const name=decodeURIComponent(enc);
 db.v14.shopping=manual().filter(n=>norm(n)!==norm(name));
 save();refresh();shopCatalog();
}
function copy(){
 const names=[...new Set([...personal().filter(s=>s.qty===0).map(s=>s.name),...manual()])];
 const str=names.map(n=>'• '+n).join('\n')||'Sem compras pendentes';
 if(navigator.clipboard?.writeText)navigator.clipboard.writeText(str).then(()=>alert('Lista copiada.')).catch(()=>prompt('Copia a lista:',str));
 else prompt('Copia a lista:',str);
}
window.v14Refresh=refresh;window.v14Adjust=update;window.v14Edit=edit;
window.v14Catalog=catalog;window.v14ShopCatalog=shopCatalog;
window.v14Add=(enc,kind)=>add(decodeURIComponent(enc),kind);
window.v14Bought=bought;window.v14Remove=remove;window.v14Copy=copy;
window.addCatalogToPantry=enc=>add(decodeURIComponent(enc),'pantry');
// Keep existing automatic meal generator and substitutions unchanged.
const oldRender=window.render;
window.render=function(){oldRender();refresh()};
const oldTab=window.tab;
window.tab=function(id){oldTab(id);if(id==='pantry')catalog();if(id==='shopping')shopCatalog();refresh()};
init();refresh();catalog();shopCatalog();save();
})();
