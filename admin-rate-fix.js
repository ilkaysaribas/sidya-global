(function(){
  "use strict";
  if(window.__sidyaRateFixV1)return;
  window.__sidyaRateFixV1=true;
  function app(){var s=document.getElementById('appShell');return !!(s&&!s.hidden)}
  function money(v){var n=Number(v);if(!isFinite(n))n=0;try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(n)}catch(e){return '₺'+n.toFixed(2)}}
  function rateNumber(v){var n=Number(String(v==null?'':v).replace(',','.'));return isFinite(n)?n:null}
  function getRateMap(data){
    var out={};
    var list=Array.isArray(data&&data.rates)?data.rates:[];
    list.forEach(function(item){
      var code=String(item.code||item.currency||'').toUpperCase();
      var value=rateNumber(item.value||item.rate||item.try||item.TRY);
      if(code&&value)out[code]=value;
    });
    if(!list.length&&data&&data.rates&&typeof data.rates==='object'){
      Object.keys(data.rates).forEach(function(code){var value=rateNumber(data.rates[code]);if(value)out[String(code).toUpperCase()]=value});
    }
    if(data&&typeof data==='object'){
      ['USD','USDTRY','EUR','RUB','GEL'].forEach(function(code){var value=rateNumber(data[code]||data[code.toLowerCase()]);if(value)out[code]=value});
    }
    return out;
  }
  function render(payload){
    var el=document.getElementById('exchangeRateStrip');
    var anchor=document.getElementById('globalStatus')||document.querySelector('.admin-header');
    if(!el&&anchor){el=document.createElement('section');el.id='exchangeRateStrip';anchor.parentNode.insertBefore(el,anchor)}
    if(!el)return;
    el.className='exchange-rate-strip';
    if(!payload){
      el.innerHTML='<b>Canli Kur Bilgisi</b><span>Kur alinamadi</span><button id="refreshExchangeRatesButton" type="button">Kuru yenile</button>';
      return;
    }
    var time=payload.updatedAt?new Date(payload.updatedAt).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}):new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
    el.innerHTML='<b>Canli Kur Bilgisi</b><span>USD '+money(payload.usd)+'</span><span>EUR '+money(payload.eur)+'</span><span>RUB '+money(payload.rub)+'</span><span>GEL '+money(payload.gel)+'</span><span>Guncelleme '+time+'</span><button id="refreshExchangeRatesButton" type="button">Kuru yenile</button>';
  }
  async function load(){
    if(!app())return;
    try{
      var res=await fetch('/api/exchange-rates?rateFix='+Date.now(),{cache:'no-store'});
      if(!res.ok)throw new Error('Kur API '+res.status);
      var data=await res.json();
      var map=getRateMap(data);
      var usd=map.USDTRY||map.USD;
      var eur=map.EUR;
      var rub=map.RUB;
      var gel=map.GEL;
      if(!(usd&&eur&&rub&&gel))throw new Error('Kur verisi eksik');
      render({usd:usd,eur:eur,rub:rub,gel:gel,updatedAt:data.updatedAt||data.updated_at||new Date().toISOString()});
    }catch(error){
      console.warn('Canli kur bilgisi alinamadi.',error);
      render(null);
    }
  }
  document.addEventListener('click',function(event){
    if(event.target&&event.target.closest&&event.target.closest('#refreshExchangeRatesButton')){
      setTimeout(load,100);
    }
  },true);
  var timer=setInterval(function(){if(app()){clearInterval(timer);load();setInterval(load,60000)}},500);
  document.addEventListener('DOMContentLoaded',load);
})();
