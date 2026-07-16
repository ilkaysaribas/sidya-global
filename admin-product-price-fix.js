(function(){
  "use strict";
  if(window.__sidyaProductPriceFix)return;
  window.__sidyaProductPriceFix=true;

  var PRICE_ACTION='product_price_update';
  var lastProductContextId='';

  function config(){return window.SIDYA_BACKEND||{}}
  function supabaseUrl(){return String(config().supabaseUrl||'').replace(/\/$/,'')}
  function anonKey(){return config().supabasePublishableKey||config().supabaseAnonKey||''}
  function projectRef(){var m=supabaseUrl().match(/https:\/\/([^.]+)\.supabase\.co/i);return m?m[1]:''}
  function authToken(){
    try{
      var ref=projectRef();
      var raw=localStorage.getItem('sb-'+ref+'-auth-token');
      var parsed=raw?JSON.parse(raw):null;
      return parsed&&parsed.access_token?parsed.access_token:'';
    }catch(e){return ''}
  }
  function headers(){
    var key=anonKey();
    var token=authToken();
    return {apikey:key,Authorization:'Bearer '+(token||key),'Content-Type':'application/json'};
  }
  async function rest(path,options){
    if(!supabaseUrl()||!anonKey())throw new Error('Supabase bağlantısı yok');
    var res=await fetch(supabaseUrl()+'/rest/v1/'+path,Object.assign({headers:headers()},options||{}));
    var text=await res.text();
    var data=null;
    try{data=text?JSON.parse(text):null}catch(e){data=text}
    if(!res.ok){var err=new Error((data&&data.message)||'Supabase isteği başarısız');err.details=data;throw err}
    return data;
  }
  function num(value){
    var n=Number(String(value==null?'':value).replace(/\s/g,'').replace(',','.'));
    return Number.isFinite(n)?n:0;
  }
  function normalizeCurrency(value){
    var raw=String(value||'USD').trim().toUpperCase();
    if(['TL','TRY','TRL','₺'].indexOf(raw)>-1)return 'TRY';
    if(['USD','US$','$','DOLAR','DOLLAR'].indexOf(raw)>-1)return 'USD';
    if(['EUR','EURO','€'].indexOf(raw)>-1)return 'EUR';
    if(['RUB','RUBLE','₽'].indexOf(raw)>-1)return 'RUB';
    if(['GEL','LARI','LARİ'].indexOf(raw)>-1)return 'GEL';
    return raw||'USD';
  }
  function readRateMap(){
    var rates=window.SIDYA_ADMIN_EXCHANGE_RATES||null;
    if(!rates){
      try{var cached=JSON.parse(localStorage.getItem('sidya-admin-valid-exchange-rates')||'{}');rates=cached.rates||null}catch(e){}
    }
    rates=rates||{};
    return {TRY:1,USD:num(rates.USD)||1,EUR:num(rates.EUR)||1,RUB:num(rates.RUB)||1,GEL:num(rates.GEL)||1};
  }
  function rate(currency){return readRateMap()[normalizeCurrency(currency)]||1}
  function convertToUsd(amount,currency){return num(amount)*rate(currency)/rate('USD')}
  function convertFromUsd(usd,currency){return num(usd)*rate('USD')/rate(currency)}
  function money(value,currency){try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency:normalizeCurrency(currency),maximumFractionDigits:4}).format(num(value))}catch(e){return num(value).toFixed(4)+' '+currency}}
  function fmtDate(value){var d=value?new Date(value):new Date();return Number.isFinite(d.getTime())?d.toLocaleString('tr-TR'):'-'}

  function refreshPreview(form,field){
    var input=form&&form.elements&&form.elements[field];
    var select=form&&form.querySelector('[data-price-currency="'+field+'"]');
    var preview=document.querySelector('[data-price-preview="'+field+'"]');
    if(!input||!select||!preview)return;
    var currency=normalizeCurrency(select.value);
    var usd=convertToUsd(input.value,currency);
    preview.textContent=money(input.value,currency)+' = '+money(usd,'USD')+' ana fiyat';
  }

  function normalizeProductDialogPrices(){
    var form=document.getElementById('productForm');
    if(!form||!form.elements||!form.elements.id||!form.elements.id.value)return;
    if(form.dataset.priceFixProductId===form.elements.id.value)return;
    var purchaseInput=form.elements.purchase_price;
    var saleInput=form.elements.sale_price;
    var purchaseSelect=form.querySelector('[data-price-currency="purchase_price"]');
    var saleSelect=form.querySelector('[data-price-currency="sale_price"]');
    if(!purchaseInput||!saleInput||!purchaseSelect||!saleSelect)return;
    var originalPurchaseUsd=num(purchaseInput.value);
    var originalSaleUsd=num(saleInput.value);
    form.dataset.priceFixProductId=form.elements.id.value;
    form.dataset.originalPurchaseUsd=String(originalPurchaseUsd);
    form.dataset.originalSaleUsd=String(originalSaleUsd);
    form.dataset.originalName=form.elements.name?form.elements.name.value:'';
    var purchaseCurrency=normalizeCurrency(purchaseSelect.value||'TRY');
    var saleCurrency=normalizeCurrency(saleSelect.value||'TRY');
    purchaseInput.value=originalPurchaseUsd?String(Number(convertFromUsd(originalPurchaseUsd,purchaseCurrency).toFixed(4))):'0';
    saleInput.value=originalSaleUsd?String(Number(convertFromUsd(originalSaleUsd,saleCurrency).toFixed(4))):'0';
    refreshPreview(form,'purchase_price');
    refreshPreview(form,'sale_price');
  }

  async function writePriceAudit(form){
    if(!form||!form.elements||!form.elements.id||!form.elements.id.value)return;
    var productId=form.elements.id.value;
    var purchaseCurrency=normalizeCurrency(form.querySelector('[data-price-currency="purchase_price"]')&&form.querySelector('[data-price-currency="purchase_price"]').value);
    var saleCurrency=normalizeCurrency(form.querySelector('[data-price-currency="sale_price"]')&&form.querySelector('[data-price-currency="sale_price"]').value);
    var beforePurchaseUsd=num(form.dataset.originalPurchaseUsd);
    var beforeSaleUsd=num(form.dataset.originalSaleUsd);
    var afterPurchaseUsd=convertToUsd(form.elements.purchase_price&&form.elements.purchase_price.value,purchaseCurrency);
    var afterSaleUsd=convertToUsd(form.elements.sale_price&&form.elements.sale_price.value,saleCurrency);
    var changed=Math.abs(beforePurchaseUsd-afterPurchaseUsd)>0.0001||Math.abs(beforeSaleUsd-afterSaleUsd)>0.0001;
    if(!changed)return;
    try{
      await rest('audit_log',{method:'POST',headers:Object.assign(headers(),{Prefer:'return=minimal'}),body:JSON.stringify({
        action:PRICE_ACTION,
        entity_type:'products',
        entity_id:productId,
        before_data:{purchase_price_usd:beforePurchaseUsd,sale_price_usd:beforeSaleUsd,name:form.dataset.originalName||''},
        after_data:{purchase_price_usd:afterPurchaseUsd,sale_price_usd:afterSaleUsd,purchase_input:num(form.elements.purchase_price&&form.elements.purchase_price.value),purchase_currency:purchaseCurrency,sale_input:num(form.elements.sale_price&&form.elements.sale_price.value),sale_currency:saleCurrency,name:form.elements.name&&form.elements.name.value||''}
      })});
    }catch(error){console.warn('Fiyat geçmişi kaydedilemedi.',error)}
  }

  function ensureDialog(){
    var dialog=document.getElementById('priceHistoryDialog');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id='priceHistoryDialog';
    dialog.className='wide-dialog statement-dialog';
    dialog.innerHTML='<div class="dialog-form"><div class="dialog-heading"><div><p class="eyebrow">FİYAT GEÇMİŞİ</p><h2 id="priceHistoryTitle">Ürün fiyat değişiklikleri</h2><p id="priceHistoryMeta" class="helper"></p></div><button type="button" data-price-history-close>×</button></div><p id="priceHistoryStatus" class="form-status" role="status"></p><div class="table-wrap statement-table"><table><thead><tr><th>Tarih</th><th>Alış önce</th><th>Alış sonra</th><th>Satış önce</th><th>Satış sonra</th><th>Giriş para birimi</th></tr></thead><tbody id="priceHistoryRows"></tbody></table></div><div class="dialog-actions"><button type="button" data-price-history-close>Kapat</button></div></div>';
    document.body.appendChild(dialog);
    dialog.addEventListener('click',function(event){if(event.target.closest('[data-price-history-close]'))dialog.close()});
    return dialog;
  }

  async function openPriceHistory(productId){
    var dialog=ensureDialog();
    var title=document.getElementById('priceHistoryTitle');
    var meta=document.getElementById('priceHistoryMeta');
    var status=document.getElementById('priceHistoryStatus');
    var rows=document.getElementById('priceHistoryRows');
    if(title)title.textContent='Ürün fiyat değişiklikleri';
    if(meta)meta.textContent='Sağ tık > Fiyat geçmişi ile açıldı.';
    if(status){status.textContent='Fiyat geçmişi yükleniyor...';status.classList.remove('error')}
    if(rows)rows.innerHTML='';
    dialog.showModal();
    try{
      var data=await rest('audit_log?entity_type=eq.products&entity_id=eq.'+encodeURIComponent(productId)+'&action=eq.'+PRICE_ACTION+'&select=*&order=created_at.desc&limit=100');
      if(status)status.textContent='';
      if(!rows)return;
      rows.innerHTML=Array.isArray(data)&&data.length?data.map(function(item){
        var b=item.before_data||{};
        var a=item.after_data||{};
        return '<tr><td>'+fmtDate(item.created_at)+'</td><td>'+money(b.purchase_price_usd,'USD')+'</td><td>'+money(a.purchase_price_usd,'USD')+'</td><td>'+money(b.sale_price_usd,'USD')+'</td><td>'+money(a.sale_price_usd,'USD')+'</td><td>'+money(a.purchase_input,a.purchase_currency||'TRY')+' / '+money(a.sale_input,a.sale_currency||'TRY')+'</td></tr>';
      }).join(''):'<tr><td colspan="6" class="empty">Bu ürün için fiyat değişikliği kaydı yok. Bundan sonraki değişiklikler burada görünecek.</td></tr>';
    }catch(error){
      if(status){status.classList.add('error');status.textContent='Fiyat geçmişi alınamadı. audit_log tablosu/policy hazır olmayabilir.'}
      if(rows)rows.innerHTML='<tr><td colspan="6" class="empty">Fiyat geçmişi gösterilemedi.</td></tr>';
      console.warn('Fiyat geçmişi alınamadı.',error);
    }
  }

  document.addEventListener('click',function(event){
    if(event.target.closest('[data-product-edit], [data-context-action="product-edit"]'))setTimeout(normalizeProductDialogPrices,30);
    var btn=event.target.closest('[data-price-history-fix]');
    if(btn){event.preventDefault();openPriceHistory(btn.dataset.priceHistoryFix)}
  },true);

  document.addEventListener('contextmenu',function(event){
    var row=event.target.closest('[data-product-row]');
    if(row)lastProductContextId=row.dataset.productRow||'';
  },true);

  var observer=new MutationObserver(function(){
    var actions=document.getElementById('rowContextActions');
    if(!actions||!lastProductContextId||actions.querySelector('[data-price-history-fix]'))return;
    if(actions.querySelector('[data-context-action="product-edit"]')){
      var button=document.createElement('button');
      button.type='button';
      button.dataset.priceHistoryFix=lastProductContextId;
      button.textContent='Fiyat geçmişi';
      actions.insertBefore(button,actions.children[2]||null);
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  document.addEventListener('change',function(event){
    if(event.target.closest('#productForm [data-price-currency]')){
      var form=document.getElementById('productForm');
      if(!form)return;
      var field=event.target.getAttribute('data-price-currency');
      var original=field==='purchase_price'?num(form.dataset.originalPurchaseUsd):num(form.dataset.originalSaleUsd);
      if(form.elements[field])form.elements[field].value=original?String(Number(convertFromUsd(original,event.target.value).toFixed(4))):'0';
      refreshPreview(form,field);
    }
  },true);

  document.addEventListener('input',function(event){
    var input=event.target.closest('#productForm [name="purchase_price"], #productForm [name="sale_price"]');
    if(input)refreshPreview(document.getElementById('productForm'),input.name);
  },true);

  var productForm=document.getElementById('productForm');
  if(productForm){
    productForm.addEventListener('submit',function(event){writePriceAudit(event.currentTarget)},false);
  }
})();
