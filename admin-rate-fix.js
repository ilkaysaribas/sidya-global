(function(){
  "use strict";
  if(window.__sidyaRateFixV3)return;
  window.__sidyaRateFixV3=true;

  var STORAGE_KEY='sidya-admin-valid-exchange-rates';
  var CODES=['USD','EUR','RUB','GEL'];

  function app(){var s=document.getElementById('appShell');return !!(s&&!s.hidden)}
  function num(v){var n=Number(String(v==null?'':v).replace(/\s/g,'').replace(',','.'));return isFinite(n)&&n>0?n:0}
  function money(v){try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',minimumFractionDigits:2,maximumFractionDigits:4}).format(num(v))}catch(e){return '₺'+num(v).toFixed(4)}}
  function safeJson(value){try{return JSON.parse(value)}catch(e){return null}}

  function validRates(rates){
    if(!rates)return false;
    var usd=num(rates.USD),eur=num(rates.EUR),rub=num(rates.RUB),gel=num(rates.GEL);
    if(!(usd&&eur&&rub&&gel))return false;
    if(usd<5||usd>250)return false;
    if(eur<5||eur>300)return false;
    if(eur<usd*.5)return false;
    if(rub<.01||rub>10)return false;
    if(gel<.5||gel>100)return false;
    return true;
  }

  function getRateMap(data){
    var out={};
    if(data&&data.rates&&typeof data.rates==='object'&&!Array.isArray(data.rates)){
      CODES.forEach(function(code){var value=num(data.rates[code]);if(value)out[code]=value});
    }
    var list=Array.isArray(data&&data.rateList)?data.rateList:(Array.isArray(data&&data.rates)?data.rates:[]);
    list.forEach(function(item){
      var code=String(item.code||item.currency||'').toUpperCase();
      if(code==='USDTRY')code='USD';
      if(code==='EURTRY')code='EUR';
      if(code==='RUBTRY')code='RUB';
      if(code==='GELTRY')code='GEL';
      var value=num(item.value||item.rate||item.try||item.TRY);
      if(CODES.indexOf(code)>-1&&value)out[code]=value;
    });
    if(!validRates(out))throw new Error('Kur doğrulaması başarısız');
    return out;
  }

  function readCache(){
    var cached=safeJson(localStorage.getItem(STORAGE_KEY)||'');
    if(cached&&validRates(cached.rates))return cached;
    return null;
  }

  function writeCache(payload){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(payload))}catch(e){}
  }

  function normalizePayload(data){
    var rates=getRateMap(data);
    return {
      rates: rates,
      source: data.source||'TCMB',
      date: data.date||'',
      updatedAt: data.updatedAt||data.fetched_at||new Date().toISOString(),
      warning: data.warning||data.error||''
    };
  }

  function updateProfitRateInputs(payload){
    var form=document.getElementById('profitTopForm');
    if(!form||!payload||!validRates(payload.rates))return;
    var map={usd_rate:'USD',eur_rate:'EUR',rub_rate:'RUB',gel_rate:'GEL'};
    Object.keys(map).forEach(function(name){
      var input=form.elements&&form.elements[name];
      if(input&&!input.matches(':focus'))input.value=String(payload.rates[map[name]]);
    });
    var meta=document.getElementById('profitRateMeta');
    if(meta)meta.textContent='Kur kaynağı: '+(payload.source||'TCMB')+' · Güncelleme: '+formatTime(payload.updatedAt)+(payload.warning?' · '+payload.warning:'');
  }

  function formatTime(value){
    var d=value?new Date(value):new Date();
    if(!isFinite(d.getTime()))d=new Date();
    return d.toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }

  function render(payload){
    var el=document.getElementById('exchangeRateStrip');
    var anchor=document.getElementById('globalStatus')||document.querySelector('.admin-header')||document.querySelector('.topbar');
    if(!el&&anchor){el=document.createElement('section');el.id='exchangeRateStrip';anchor.parentNode.insertBefore(el,anchor.nextSibling)}
    if(!el)return;
    el.className='exchange-rate-strip';
    if(!payload||!validRates(payload.rates)){
      el.innerHTML='<b>Canlı Kur Bilgisi</b><span>TCMB kuru alınamadı</span><button id="refreshExchangeRatesButton" type="button">Kuru yenile</button>';
      return;
    }
    el.innerHTML='<b>Canlı Kur Bilgisi</b>'+
      '<span>USD '+money(payload.rates.USD)+'</span>'+
      '<span>EUR '+money(payload.rates.EUR)+'</span>'+
      '<span>RUB '+money(payload.rates.RUB)+'</span>'+
      '<span>GEL '+money(payload.rates.GEL)+'</span>'+
      '<span>Kaynak: '+String(payload.source||'TCMB')+'</span>'+
      '<span>Güncelleme: '+formatTime(payload.updatedAt)+'</span>'+
      (payload.warning?'<span>Son geçerli kur gösteriliyor</span>':'')+
      '<button id="refreshExchangeRatesButton" type="button">Kuru yenile</button>';
  }

  async function load(){
    if(!app())return;
    try{
      var res=await fetch('/api/exchange-rates?adminStrip='+Date.now(),{cache:'no-store',headers:{Accept:'application/json'}});
      if(!res.ok)throw new Error('Kur API '+res.status);
      var data=await res.json();
      var payload=normalizePayload(data);
      writeCache(payload);
      window.SIDYA_ADMIN_EXCHANGE_RATES=payload.rates;
      render(payload);
      updateProfitRateInputs(payload);
    }catch(error){
      console.warn('Canlı kur bilgisi alınamadı.',error);
      var cached=readCache();
      if(cached){cached.warning='TCMB kuru alınamadı. Son geçerli kur gösteriliyor.';render(cached);updateProfitRateInputs(cached);return;}
      render(null);
    }
  }

  document.addEventListener('click',function(event){
    if(event.target&&event.target.closest&&event.target.closest('#refreshExchangeRatesButton'))setTimeout(load,50);
  },true);
  var timer=setInterval(function(){if(app()){clearInterval(timer);load();setInterval(load,1800000)}},500);
  document.addEventListener('DOMContentLoaded',load);
})();
