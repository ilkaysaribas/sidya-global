(function(){
  "use strict";
  if(window.__sidyaRateFixV2)return;
  window.__sidyaRateFixV2=true;
  function app(){var s=document.getElementById('appShell');return !!(s&&!s.hidden)}
  function num(v){var n=Number(String(v==null?'':v).replace(/\s/g,'').replace(',','.'));return isFinite(n)&&n>0?n:0}
  function money(v){try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(num(v))}catch(e){return '₺'+num(v).toFixed(2)}}
  function getRateMap(data){
    var out={};
    if(data&&data.rates&&typeof data.rates==='object'&&!Array.isArray(data.rates)){
      ['USD','EUR','GEL','RUB'].forEach(function(code){var value=num(data.rates[code]);if(value)out[code]=value});
    }
    var list=Array.isArray(data&&data.rates)?data.rates:Array.isArray(data&&data.rateList)?data.rateList:[];
    list.forEach(function(item){
      var code=String(item.code||item.currency||'').toUpperCase();
      if(code==='USDTRY')code='USD';
      var value=num(item.value||item.rate||item.try||item.TRY);
      if(['USD','EUR','GEL','RUB'].indexOf(code)>-1&&value)out[code]=value;
    });
    return out;
  }
  function formRates(){
    var f=document.getElementById('profitTopForm');
    if(!f)return null;
    var usd=num(f.usd_rate&&f.usd_rate.value),eur=num(f.eur_rate&&f.eur_rate.value),gel=num(f.gel_rate&&f.gel_rate.value),rub=num(f.rub_rate&&f.rub_rate.value);
    if(!(usd||eur||gel||rub))return null;
    return {usd:usd,eur:eur,gel:gel,rub:rub,source:'TCMB',updatedAt:new Date().toISOString(),status:'Tablo ile aynı'};
  }
  function render(payload){
    var el=document.getElementById('exchangeRateStrip');
    var anchor=document.getElementById('globalStatus')||document.querySelector('.admin-header');
    if(!el&&anchor){el=document.createElement('section');el.id='exchangeRateStrip';anchor.parentNode.insertBefore(el,anchor)}
    if(!el)return;
    el.className='exchange-rate-strip';
    if(!payload){
      el.innerHTML='<b>Canlı Kur Bilgisi</b><span>TCMB kuru alınamadı</span><button id="refreshExchangeRatesButton" type="button">Kuru yenile</button>';
      return;
    }
    var time=payload.updatedAt?new Date(payload.updatedAt).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}):new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
    el.innerHTML='<b>Canlı Kur Bilgisi</b><span>USD '+money(payload.usd)+'</span><span>EUR '+money(payload.eur)+'</span><span>GEL '+money(payload.gel)+'</span><span>RUB '+money(payload.rub)+'</span><span>Kaynak '+(payload.source||'TCMB')+'</span><span>Güncelleme '+time+'</span><button id="refreshExchangeRatesButton" type="button">Kuru yenile</button>';
  }
  async function load(forceApi){
    if(!app())return;
    var same=formRates();
    if(same&&!forceApi){render(same);return;}
    try{
      var res=await fetch('/api/exchange-rates?topStrip='+Date.now(),{cache:'no-store'});
      if(!res.ok)throw new Error('Kur API '+res.status);
      var data=await res.json();
      var map=getRateMap(data);
      var payload={usd:map.USD,eur:map.EUR,gel:map.GEL,rub:map.RUB,source:data.source||'TCMB',updatedAt:data.updatedAt||new Date().toISOString()};
      if(!(payload.usd&&payload.eur&&payload.rub))throw new Error('TCMB kur verisi eksik');
      render(payload);
    }catch(error){
      console.warn('Canlı kur bilgisi alınamadı.',error);
      var fallback=formRates();
      render(fallback||null);
    }
  }
  document.addEventListener('click',function(event){
    if(event.target&&event.target.closest&&event.target.closest('#refreshExchangeRatesButton'))setTimeout(function(){load(true)},100);
  },true);
  document.addEventListener('input',function(event){
    if(event.target&&event.target.closest&&event.target.closest('#profitTopForm [data-rate-field]'))setTimeout(function(){load(false)},50);
  },true);
  var timer=setInterval(function(){if(app()){clearInterval(timer);load(false);setInterval(function(){load(false)},60000)}},500);
  document.addEventListener('DOMContentLoaded',function(){load(false)});
})();
