(() => {
  if (window.__sidyaAiAdmin) return;
  window.__sidyaAiAdmin = true;
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt = (value) => value ? new Date(value).toLocaleString("tr-TR") : "-";
  let leads = [], selected = null, session = null;
  function styles() {
    if ($("#sidyaAiAdminStyles")) return;
    const node=document.createElement("style");node.id="sidyaAiAdminStyles";node.textContent=".ai-admin-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}.ai-admin-metrics article{border:1px solid #dfe3e8;border-radius:10px;background:#fff;padding:14px}.ai-admin-metrics span{display:block;color:#667085;font-size:12px}.ai-admin-metrics strong{font-size:24px}.ai-admin-tools{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:12px}.ai-admin-tools input,.ai-admin-tools select{border:1px solid #d8e1ec;border-radius:8px;padding:10px;background:#fff}.ai-priority{display:inline-flex;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:800}.ai-priority.urgent{background:#fee2e2;color:#991b1b}.ai-priority.high{background:#ffedd5;color:#9a3412}.ai-priority.normal{background:#e0f2fe;color:#075985}.ai-priority.low{background:#f1f5f9;color:#475569}.ai-admin-table tr{cursor:pointer}.ai-admin-table tr:hover{background:#f8fafc}.ai-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ai-detail-card{border:1px solid #e1e5ea;border-radius:10px;padding:12px;background:#fff}.ai-detail-card.full{grid-column:1/-1}.ai-detail-card dt{color:#667085;font-size:11px;margin-top:7px}.ai-detail-card dd{margin:2px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}.ai-conversation{display:grid;gap:7px;max-height:320px;overflow:auto}.ai-conversation p{margin:0;padding:9px;border-radius:9px;background:#f5f6f7}.ai-conversation p.user{background:#111;color:#fff;margin-left:10%}.ai-admin-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.ai-admin-actions label{display:grid;gap:5px}.ai-admin-actions select,.ai-admin-actions textarea{border:1px solid #d8e1ec;border-radius:8px;padding:9px}.ai-admin-note{display:grid;grid-template-columns:1fr auto;gap:8px}.ai-admin-note textarea{min-height:70px}.ai-files{display:flex;gap:8px;flex-wrap:wrap}.ai-files button{border:1px solid #d8e1ec;background:#fff;border-radius:8px;padding:8px}.ai-empty{padding:24px;text-align:center;color:#667085}@media(max-width:1000px){.ai-admin-metrics{grid-template-columns:1fr 1fr}.ai-detail-grid{grid-template-columns:1fr}.ai-detail-card.full{grid-column:auto}}@media(max-width:650px){.ai-admin-metrics{grid-template-columns:1fr}.ai-admin-tools>*{width:100%}}";document.head.appendChild(node);
  }
  function client() {
    const cfg=window.SIDYA_BACKEND||{};
    if(!window.supabase||!cfg.supabaseUrl||!(cfg.supabaseAnonKey||cfg.supabasePublishableKey))return null;
    if(!window.__sidyaAiAdminClient)window.__sidyaAiAdminClient=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey||cfg.supabasePublishableKey);
    return window.__sidyaAiAdminClient;
  }
  async function token() {
    const c=client();if(!c)throw new Error("Supabase bağlantısı yok.");
    const result=await c.auth.getSession();session=result.data?.session;
    if(!session?.access_token)throw new Error("Admin oturumu bulunamadı.");
    return session.access_token;
  }
  async function api(action,options={}) {
    const response=await fetch("/api/ai-assistant?action="+encodeURIComponent("admin-"+action)+(options.query||""),{method:options.method||"GET",headers:{"Content-Type":"application/json",Authorization:"Bearer "+await token()},body:options.body?JSON.stringify(options.body):undefined});
    const result=await response.json().catch(()=>({}));if(!response.ok||result.ok===false)throw new Error(result.error||"İşlem başarısız.");return result;
  }
  function install() {
    const nav=$("#mainNav"),main=$(".main");if(!nav||!main)return false;
    styles();
    if(!nav.querySelector('[data-view="ai-assistant"]'))nav.insertAdjacentHTML("beforeend","<button data-view='ai-assistant'>AI Asistan Talepleri <span class='nav-count' id='aiLeadCount'>0</span></button>");
    if(!main.querySelector('[data-view-panel="ai-assistant"]'))main.insertAdjacentHTML("beforeend",view());
    nav.addEventListener("click",(event)=>{const button=event.target.closest('[data-view="ai-assistant"]');if(!button)return;event.preventDefault();showView();load();});
    $("#aiLeadRefresh")?.addEventListener("click",load);
    ["#aiLeadSearch","#aiLeadStatus","#aiLeadPriority"].forEach((s)=>$(s)?.addEventListener(s.includes("Search")?"input":"change",render));
    $("#aiLeadRows")?.addEventListener("click",(event)=>{const row=event.target.closest("[data-ai-lead]");if(row)open(row.dataset.aiLead);});
    return true;
  }
  function view() {
    return "<section class='view' data-view-panel='ai-assistant'><div class='ai-admin-metrics'><article><span>Toplam talep</span><strong id='aiMetricTotal'>0</strong></article><article><span>Yeni</span><strong id='aiMetricNew'>0</strong></article><article><span>Yüksek / Acil</span><strong id='aiMetricHigh'>0</strong></article><article><span>Teklife dönüşen</span><strong id='aiMetricQuote'>0</strong></article><article><span>En çok ülke</span><strong id='aiMetricCountry'>-</strong></article><article><span>En çok kategori</span><strong id='aiMetricCategory'>-</strong></article><article><span>Dil dağılımı</span><strong id='aiMetricLanguage'>-</strong></article><article><span>Ort. görüşme</span><strong id='aiMetricDuration'>0 sn</strong></article></div><div class='panel'><div class='panel-heading'><div><p class='eyebrow'>MÜŞTERİ İLETİŞİMİ</p><h2>AI Asistan Talepleri</h2></div><button class='primary' id='aiLeadRefresh'>Yenile</button></div><div class='ai-admin-tools'><input id='aiLeadSearch' type='search' placeholder='Firma, ülke, ürün veya kişi ara'><select id='aiLeadStatus'><option value=''>Tüm durumlar</option><option value='new'>Yeni</option><option value='contacted'>İletişime geçildi</option><option value='quote_preparing'>Teklif hazırlanıyor</option><option value='won'>Sonuçlandı</option><option value='lost'>Kaybedildi</option></select><select id='aiLeadPriority'><option value=''>Tüm öncelikler</option><option value='urgent'>Acil</option><option value='high'>Yüksek</option><option value='normal'>Normal</option><option value='low'>Düşük</option></select></div><div class='table-wrap ai-admin-table'><table><thead><tr><th>Tarih</th><th>Öncelik</th><th>Talep türü</th><th>Firma</th><th>Ülke</th><th>Ürün</th><th>Miktar</th><th>Yetkili</th><th>Telefon</th><th>E-posta</th><th>Durum</th><th>Atanan</th><th>İşlemler</th></tr></thead><tbody id='aiLeadRows'></tbody></table></div></div><dialog id='aiLeadDialog' class='wide-dialog'><div class='dialog-form'><div class='dialog-heading'><div><p class='eyebrow'>AI ASİSTAN TALEBİ</p><h2 id='aiLeadDialogTitle'>Talep</h2></div><button type='button' data-ai-close>×</button></div><div id='aiLeadDetail' class='ai-empty'>Yükleniyor...</div><div class='dialog-actions'><button type='button' data-ai-close>Kapat</button></div></div></dialog></section>";
  }
  function showView() {
    $$("#mainNav [data-view]").forEach((b)=>b.classList.toggle("active",b.dataset.view==="ai-assistant"));
    $$("[data-view-panel]").forEach((p)=>p.classList.toggle("active",p.dataset.viewPanel==="ai-assistant"));
    const title=$("#pageTitle");if(title)title.textContent="AI Asistan Talepleri";
  }
  const most=(key)=>{const counts={};leads.forEach((x)=>{const v=x[key]||"";if(v)counts[v]=(counts[v]||0)+1;});return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||"-";};
  function metrics() {
    $("#aiMetricTotal").textContent=leads.length;$("#aiMetricNew").textContent=leads.filter((x)=>x.lead_status==="new").length;$("#aiMetricHigh").textContent=leads.filter((x)=>["high","urgent"].includes(x.priority)).length;$("#aiMetricQuote").textContent=leads.filter((x)=>x.converted_to_quote||x.lead_status==="quote_preparing").length;$("#aiMetricCountry").textContent=most("country");$("#aiMetricCategory").textContent=most("product_category");$("#aiMetricLanguage").textContent=most("language");$("#aiMetricDuration").textContent=Math.round(leads.reduce((s,x)=>s+Number(x.duration_seconds||0),0)/Math.max(leads.length,1))+" sn";$("#aiLeadCount").textContent=leads.filter((x)=>x.lead_status==="new").length;
  }
  function filtered() {
    const q=($("#aiLeadSearch")?.value||"").toLowerCase(),status=$("#aiLeadStatus")?.value||"",priority=$("#aiLeadPriority")?.value||"";
    return leads.filter((x)=>{const hay=[x.company_name,x.country,x.product_name,x.full_name,x.email,x.phone,x.lead_number].join(" ").toLowerCase();return(!q||hay.includes(q))&&(!status||x.lead_status===status)&&(!priority||x.priority===priority);});
  }
  function render() {
    metrics();const rows=$("#aiLeadRows"),items=filtered();
    rows.innerHTML=items.length?items.map((x)=>"<tr data-ai-lead='"+esc(x.id)+"'><td>"+esc(fmt(x.created_at))+"</td><td><span class='ai-priority "+esc(x.priority)+"'>"+esc(x.priority)+"</span></td><td>"+esc(x.lead_type)+"</td><td>"+esc(x.company_name||"-")+"</td><td>"+esc(x.country||"-")+"</td><td>"+esc(x.product_name||"-")+"</td><td>"+esc((x.quantity||"-")+" "+(x.quantity_unit||""))+"</td><td>"+esc(x.full_name||"-")+"</td><td>"+esc(x.phone||x.whatsapp||"-")+"</td><td>"+esc(x.email||"-")+"</td><td>"+esc(x.lead_status)+"</td><td>"+esc(x.assigned_to?"Atandı":"-")+"</td><td><button type='button'>Aç</button></td></tr>").join(""):"<tr><td colspan='13' class='ai-empty'>Talep bulunamadı.</td></tr>";
  }
  async function load() {
    try{const result=await api("list");leads=result.leads||[];render();}catch(error){$("#aiLeadRows").innerHTML="<tr><td colspan='13' class='ai-empty'>"+esc(error.message)+"</td></tr>";}
  }
  async function open(id) {
    const dialog=$("#aiLeadDialog"),detail=$("#aiLeadDetail");dialog.showModal();detail.innerHTML="Yükleniyor...";
    try{const result=await api("detail",{query:"&id="+encodeURIComponent(id)});selected=result.lead;if(!selected)throw new Error("Talep bulunamadı.");$("#aiLeadDialogTitle").textContent=selected.lead_number+" · "+(selected.company_name||selected.full_name||"Talep");detail.innerHTML=detailHtml(result);bindDetail(result);}catch(error){detail.textContent=error.message;}
  }
  function details(values) {return Object.entries(values).map(([k,v])=>"<dt>"+esc(k)+"</dt><dd>"+esc(v||"-")+"</dd>").join("");}
  function detailHtml(result) {
    const x=result.lead,conversation=Array.isArray(x.conversation_json)?x.conversation_json:[],wa=String(x.whatsapp||x.phone||"").replace(/\D/g,"");
    return "<div class='ai-detail-grid'><section class='ai-detail-card'>"+details({"Talep no":x.lead_number,"Kaynak":x.source,"Tarih":fmt(x.created_at),"Öncelik":x.priority,"Durum":x.lead_status,"Dil":x.language})+"</section><section class='ai-detail-card'>"+details({"Firma":x.company_name,"Yetkili":x.full_name,"Ülke / Şehir":(x.country||"-")+" / "+(x.city||"-"),"E-posta":x.email,"Telefon":x.phone,"WhatsApp":x.whatsapp})+"</section><section class='ai-detail-card'>"+details({"Talep türü":x.lead_type,"Ürün":x.product_name,"Kategori":x.product_category,"Miktar":(x.quantity||"-")+" "+(x.quantity_unit||""),"Teslimat":(x.destination_country||"-")+" / "+(x.destination_city||x.destination_port||"-"),"Incoterm":x.incoterm,"Tarih":x.requested_delivery_date,"Hedef fiyat":x.target_price})+"</section><section class='ai-detail-card'>"+details({"Özel marka":x.private_label_request,"Sertifika":x.certificate_requirement,"Lojistik":x.logistics_type,"Tercih edilen iletişim":x.preferred_contact_method,"Açık rıza":x.consent_given?"Evet":"Hayır","Sayfa":x.page_url})+"</section><section class='ai-detail-card full'><h3>Yapay zekâ özeti</h3><p>"+esc(x.conversation_summary||"-")+"</p><h3>Açıklama</h3><p>"+esc(x.message||x.product_details||"-")+"</p></section><section class='ai-detail-card full'><h3>Konuşma geçmişi</h3><div class='ai-conversation'>"+conversation.map((m)=>"<p class='"+esc(m.role)+"'><strong>"+esc(m.role==="assistant"?"Sidya AI":"Ziyaretçi")+":</strong> "+esc(m.content)+"</p>").join("")+"</div></section><section class='ai-detail-card full'><h3>Yüklenen dosyalar</h3><div class='ai-files'>"+((result.files||[]).map((f)=>"<button type='button' data-ai-file='"+esc(f.id)+"'>"+esc(f.original_name)+"</button>").join("")||"Dosya yok.")+"</div></section><section class='ai-detail-card full'><div class='ai-admin-actions'><label>Durum<select id='aiEditStatus'><option value='new'>Yeni</option><option value='contacted'>İletişime geçildi</option><option value='quote_preparing'>Teklif hazırlanıyor</option><option value='won'>Sonuçlandı</option><option value='lost'>Kaybedildi</option></select></label><label>Öncelik<select id='aiEditPriority'><option>low</option><option>normal</option><option>high</option><option>urgent</option></select></label><label>Atama<select id='aiEditAssigned'><option value=''>Atanmamış</option><option value='me'>Kendime ata</option></select></label><label><input id='aiEditQuote' type='checkbox'> Teklife dönüştü</label><button class='primary' id='aiSaveLead' type='button'>Kaydet</button><a href='mailto:"+esc(x.email||"")+"'>E-posta gönder</a>"+(wa?"<a href='https://wa.me/"+esc(wa)+"' target='_blank' rel='noopener'>WhatsApp</a>":"")+"</div></section><section class='ai-detail-card full'><h3>Notlar</h3><div>"+((result.notes||[]).map((n)=>"<p>"+esc(n.note)+" <small>"+esc(fmt(n.created_at))+"</small></p>").join("")||"Henüz not yok.")+"</div><form class='ai-admin-note' id='aiNoteForm'><textarea name='note' placeholder='İç not ekle' required></textarea><button type='submit'>Notu ekle</button></form></section></div>";
  }
  function bindDetail(result) {
    $("#aiEditStatus").value=selected.lead_status;$("#aiEditPriority").value=selected.priority;$("#aiEditAssigned").value=selected.assigned_to?"me":"";$("#aiEditQuote").checked=Boolean(selected.converted_to_quote);
    $("#aiSaveLead").addEventListener("click",async()=>{try{await api("update",{method:"PATCH",body:{id:selected.id,lead_status:$("#aiEditStatus").value,priority:$("#aiEditPriority").value,assigned_to:$("#aiEditAssigned").value==="me"?session?.user?.id:null,converted_to_quote:$("#aiEditQuote").checked,last_contacted_at:$("#aiEditStatus").value==="contacted"?new Date().toISOString():selected.last_contacted_at}});await load();await open(selected.id);}catch(error){alert(error.message);}});
    $("#aiNoteForm").addEventListener("submit",async(event)=>{event.preventDefault();try{await api("note",{method:"POST",body:{lead_id:selected.id,note:new FormData(event.currentTarget).get("note")}});await open(selected.id);}catch(error){alert(error.message);}});
    $$("[data-ai-file]").forEach((button)=>button.addEventListener("click",async()=>{try{const r=await api("file-url",{query:"&id="+encodeURIComponent(button.dataset.aiFile)});window.open(r.url,"_blank","noopener");}catch(error){alert(error.message);}}));
  }
  document.addEventListener("click",(event)=>{if(event.target.closest("[data-ai-close]"))$("#aiLeadDialog")?.close();});
  const timer=setInterval(()=>{const shell=$("#appShell");if(shell&&!shell.hidden&&window.SIDYA_BACKEND&&install()){clearInterval(timer);load();}},500);
})();