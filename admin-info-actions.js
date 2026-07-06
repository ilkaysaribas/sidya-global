(function(){
  "use strict";
  if(window.__sidyaInfoActionsV1)return;
  window.__sidyaInfoActionsV1=true;
  function app(){var s=document.getElementById('appShell');return !!(s&&!s.hidden)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})}
  function setBox(message,type){var box=document.getElementById('infoActionStatus');if(!box)return;box.hidden=false;box.className='info-action-status '+(type||'');box.innerHTML=message}
  function ensure(){
    if(!app())return;
    var receive=document.getElementById('receiveSiteDataButton'),send=document.getElementById('sendSiteDataButton'),topbar=document.querySelector('.topbar');
    if(!receive||!send||!topbar)return;
    receive.textContent='Bilgi Al';receive.title='Site kataloğundaki ürün bilgilerini yönetim paneline aktarır. Stok adetlerini silmez.';
    send.textContent='Bilgi Gönder';send.title='Yönetim panelindeki aktif ürün, fiyat ve stok bilgilerini site yayın tablosuna gönderir.';
    if(!document.getElementById('infoActionHelp')){var help=document.createElement('section');help.id='infoActionHelp';help.className='info-action-help';help.innerHTML='<div><strong>Bilgi Al</strong><span>Site kataloğunu yönetim paneline çeker. Ürün kartlarını günceller, stok adetlerini silmez.</span></div><div><strong>Bilgi Gönder</strong><span>Yönetim panelindeki aktif ürün, fiyat ve stok bilgisini siteye yayınlar.</span></div><div id="infoActionStatus" class="info-action-status" hidden></div>';var gs=document.getElementById('globalStatus');(gs&&gs.parentNode?gs.parentNode:topbar.parentNode).insertBefore(help,gs||topbar.nextSibling)}
  }
  function wrap(button,kind){
    if(!button||button.dataset.infoActionWrapped)return;button.dataset.infoActionWrapped='1';
    button.addEventListener('click',function(){
      var label=kind==='receive'?'Bilgi Al':'Bilgi Gönder';
      var doing=kind==='receive'?'Site kataloğu yönetim paneline alınıyor; ürün kartları kontrol ediliyor.':'Aktif ürün, stok ve fiyat bilgileri site yayın tablosuna gönderiliyor.';
      button.disabled=true;button.dataset.oldText=button.textContent;button.textContent='İşleniyor...';setBox('<strong>'+label+'</strong><span>'+doing+'</span>','working');
      setTimeout(function(){var gs=document.getElementById('globalStatus');var msg=gs&&gs.textContent?gs.textContent.trim():'';if(msg){var err=/hata|yetki|gerek|kurulmamış|alınamadı|başarısız|silme|iptal/i.test(msg);setBox('<strong>'+label+' sonucu</strong><span>'+esc(msg)+'</span>',err?'error':'ok')}else setBox('<strong>'+label+'</strong><span>İşlem başlatıldı. Sonuç mesajı burada görünecek.</span>','working');button.disabled=false;button.textContent=button.dataset.oldText||label},1800);
    },true);
  }
  function style(){if(document.getElementById('infoActionStyle'))return;var s=document.createElement('style');s.id='infoActionStyle';s.textContent='.info-action-help{display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:10px;margin:8px 0 12px;padding:10px 12px;border:1px solid #d8e1ec;border-radius:10px;background:#f8fafc}.info-action-help div{display:flex;flex-direction:column;gap:3px}.info-action-help strong{font-size:12px;color:#0f172a}.info-action-help span{font-size:12px;color:#64748b;line-height:1.35}.info-action-status{grid-column:1/-1;padding:9px 10px;border-radius:8px;border:1px solid #d8e1ec;background:#fff}.info-action-status.working{border-color:#bae6fd;background:#f0f9ff}.info-action-status.ok{border-color:#bbf7d0;background:#f0fdf4}.info-action-status.error{border-color:#fecaca;background:#fff1f2}.topbar-user #receiveSiteDataButton,.topbar-user #sendSiteDataButton{min-height:38px}.topbar-user #receiveSiteDataButton::after{content:"site → panel";display:block;font-size:9px;font-weight:500;color:#64748b;line-height:1}.topbar-user #sendSiteDataButton::after{content:"panel → site";display:block;font-size:9px;font-weight:500;color:rgba(255,255,255,.82);line-height:1}@media(max-width:900px){.info-action-help{grid-template-columns:1fr}}';document.head.appendChild(s)}
  function boot(){style();ensure();wrap(document.getElementById('receiveSiteDataButton'),'receive');wrap(document.getElementById('sendSiteDataButton'),'send')}
  var timer=setInterval(function(){if(app())boot()},500);document.addEventListener('DOMContentLoaded',boot);
})();
