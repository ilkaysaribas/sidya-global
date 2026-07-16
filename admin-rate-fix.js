(function(){
  "use strict";
  if(window.__sidyaRateFixV5)return;
  window.__sidyaRateFixV5=true;
  window.__sidyaRateFixV4=false;
  window.__sidyaRateFixV3=false;

  var STORAGE_KEY='sidya-admin-valid-exchange-rates';
  var CODES=['USD','EUR','RUB','GEL'];
  var lastPayload=null;
  var rendering=false;
  var observer=null;

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

  function formatTime(value){
    var d=value?new Date(value):new Date();
    if(!isFinite(d.getTime()))d=new Date();
    return d.toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }

  function expectedText(payload){
    if(!payload||!validRates(payload.rates))return '';
    return ['USD '+money(payload.rates.USD),'EUR '+money(payload.rates.EUR),'RUB '+money(payload.rates.RUB),'GEL '+money(payload.rates.GEL)].join('|');
  }

  function stripLooksCorrect(el,payload){
    if(!el||!payload||!validRates(payload.rates))return false;
    var text=el.textContent||'';
    return CODES.every(function(code){return text.indexOf(code+' '+money(payload.rates[code]))>-1});
  }

  function findAnchor(){
    return document.getElementById('globalStatus')||document.querySelector('.admin-header')||document.querySelector('.topbar')||document.querySelector('.main');
  }

  function ensureStrip(){
    var el=document.getElementById('exchangeRateStrip');
    var anchor=findAnchor();
    if(!el&&anchor&&anchor.parentNode){
      el=document.createElement('section');
      el.id='exchangeRateStrip';
      anchor.parentNode.insertBefore(el,anchor.nextSibling);
    }
    return el;
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

  function render(payload){
    var el=ensureStrip();
    if(!el)return;
    rendering=true;
    el.className='exchange-rate-strip';
    el.setAttribute('data-sidya-rate-fix','v5');
    if(!payload||!validRates(payload.rates)){
      el.innerHTML='<b>Canlı Kur Bilgisi</b><span>TCMB kuru alınamadı</span><button id="refreshExchangeRatesButton" type="button">Kuru yenile</button>';
      rendering=false;
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
    rendering=false;
  }

  function publish(payload){
    if(!payload||!validRates(payload.rates))return;
    lastPayload=payload;
    writeCache(payload);
    window.SIDYA_ADMIN_EXCHANGE_RATES=payload.rates;
    window.SIDYA_ADMIN_EXCHANGE_PAYLOAD=payload;
    render(payload);
    updateProfitRateInputs(payload);
    try{window.dispatchEvent(new CustomEvent('sidya:exchange-rates-ready',{detail:payload}))}catch(e){}
  }

  async function load(){
    if(!app())return;
    try{
      var res=await fetch('/api/exchange-rates?adminStripV5='+Date.now(),{cache:'no-store',headers:{Accept:'application/json'}});
      if(!res.ok)throw new Error('Kur API '+res.status);
      var data=await res.json();
      publish(normalizePayload(data));
    }catch(error){
      console.warn('Canlı kur bilgisi alınamadı.',error);
      var cached=readCache();
      if(cached){cached.warning='TCMB kuru alınamadı. Son geçerli kur gösteriliyor.';publish(cached);return;}
      render(null);
    }
  }

  function installObserver(){
    if(observer)return;
    observer=new MutationObserver(function(){
      if(rendering||!lastPayload||!validRates(lastPayload.rates))return;
      var el=document.getElementById('exchangeRateStrip');
      if(!stripLooksCorrect(el,lastPayload))setTimeout(function(){render(lastPayload);updateProfitRateInputs(lastPayload)},0);
    });
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  }

  document.addEventListener('click',function(event){
    if(event.target&&event.target.closest&&event.target.closest('#refreshExchangeRatesButton')){
      event.preventDefault();
      event.stopPropagation();
      setTimeout(load,20);
    }
  },true);

  document.addEventListener('DOMContentLoaded',function(){installObserver();load()});
  window.addEventListener('load',function(){installObserver();load()});

  var boot=setInterval(function(){
    if(app()){
      load();
      installObserver();
    }
  },1000);
  setTimeout(function(){clearInterval(boot)},90000);
  setInterval(function(){if(app())load()},1800000);
})();
