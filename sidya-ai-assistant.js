(() => {
  if (window.__sidyaAiAssistant) return;
  window.__sidyaAiAssistant = true;
  const API = "/api/ai-assistant";
  const STORAGE_KEY = "sidya_ai_assistant_v2";
  const SESSION_NOTICE = "sidya_ai_notice_closed";
  const SUPPORTED = ["tr","en","ar","ru","ka","az"];
  const TYPES = [
    ["product","Ürün arıyorum"],["quote","Fiyat teklifi almak istiyorum"],["sourcing","Türkiye'den tedarik yapmak istiyorum"],
    ["export","İhracat yapmak istiyorum"],["logistics","Lojistik desteği istiyorum"],["distributorship","Distribütörlük veya bayilik"],
    ["order_status","Siparişimin durumunu öğrenmek istiyorum"],["sales_rep","Satış temsilcisiyle görüşmek istiyorum"],["other","Diğer"]
  ];
  const I18N = {
    tr:{title:"Sidya AI Asistanı",online:"İhracat ve tedarik desteği",launcher:"Sidya AI",placeholder:"Mesajınızı yazın...",send:"Gönder",welcome:"Merhaba, Sidya Global AI Asistanı'na hoş geldiniz. Türkiye'den ürün tedariki, ihracat, lojistik, distribütörlük veya fiyat teklifi konularında size hızlıca yardımcı olabilirim. Size nasıl yardımcı olabilirim?",teaser:"Türkiye'den ürün tedariki, ihracat veya fiyat teklifi mi arıyorsunuz? Sidya AI Asistanı size hemen yardımcı olabilir.",start:"Sohbete Başla",close:"Kapat",unknown:"Henüz belli değil",privacy:"Gönderdiğiniz bilgiler, talebinizin değerlendirilmesi ve sizinle iletişime geçilmesi amacıyla işlenecektir.",consent:"Bilgilerimin talebimin değerlendirilmesi amacıyla işlenmesini kabul ediyorum.",submit:"Talebi Kaydet",success:"Teşekkür ederiz. Talebiniz başarıyla kaydedildi. Sidya Global ekibi verdiğiniz bilgiler üzerinden talebinizi inceleyerek sizinle iletişime geçecektir.",leadNo:"Talep Numaranız",newLead:"Yeni bir talep oluştur",whatsapp:"WhatsApp üzerinden devam et",email:"E-posta gönder",attach:"Dosya ekle",retry:"Şu anda yanıt oluşturulamadı. Talebinizi yine de kaydedebilir veya doğrudan iletişim bilgilerinizi bırakabilirsiniz.",human:"Elbette. Sizi doğru temsilciye yönlendirebilmem için adınızı, firmanızı, ülkenizi ve telefon veya WhatsApp numaranızı paylaşır mısınız?",invalidEmail:"Lütfen geçerli bir e-posta adresi yazın.",invalidPhone:"Lütfen ülke koduyla birlikte geçerli bir telefon veya WhatsApp numarası yazın."},
    en:{title:"Sidya AI Assistant",online:"Export and sourcing support",launcher:"Sidya AI",placeholder:"Type your message...",send:"Send",welcome:"Hello, welcome to the Sidya Global AI Assistant. I can quickly help with sourcing from Türkiye, exports, logistics, distributorships and quotation requests. How can I help you?",teaser:"Looking for sourcing from Türkiye, exports or a quote? Sidya AI can help right away.",start:"Start Chat",close:"Close",unknown:"Not decided yet",privacy:"Your information will be processed to evaluate your request and contact you.",consent:"I agree that my information may be processed to evaluate my request.",submit:"Save Request",success:"Thank you. Your request has been saved successfully. The Sidya Global team will review it and contact you.",leadNo:"Request Number",newLead:"Create a new request",whatsapp:"Continue on WhatsApp",email:"Send email",attach:"Attach file",retry:"A response could not be created right now. You can still save your request or leave your contact details.",human:"Of course. Please share your name, company, country and phone or WhatsApp number so I can direct you to the right representative.",invalidEmail:"Please enter a valid email address.",invalidPhone:"Please enter a valid phone or WhatsApp number including the country code."},
    ar:{title:"مساعد Sidya AI",online:"دعم التصدير والتوريد",launcher:"Sidya AI",placeholder:"اكتب رسالتك...",send:"إرسال",welcome:"مرحباً بكم في مساعد Sidya Global الذكي. يمكنني مساعدتكم في التوريد من تركيا والتصدير والخدمات اللوجستية والتوزيع وطلبات الأسعار. كيف يمكنني مساعدتكم؟",teaser:"هل تبحثون عن التوريد من تركيا أو التصدير أو عرض سعر؟ يمكن لمساعد Sidya AI مساعدتكم فوراً.",start:"ابدأ المحادثة",close:"إغلاق",unknown:"غير محدد بعد",privacy:"ستتم معالجة معلوماتكم لتقييم طلبكم والتواصل معكم.",consent:"أوافق على معالجة معلوماتي لغرض تقييم طلبي.",submit:"حفظ الطلب",success:"شكراً لكم. تم تسجيل طلبكم بنجاح. سيقوم فريق Sidya Global بمراجعته والتواصل معكم.",leadNo:"رقم الطلب",newLead:"إنشاء طلب جديد",whatsapp:"المتابعة عبر واتساب",email:"إرسال بريد",attach:"إرفاق ملف",retry:"تعذر إنشاء الرد حالياً. لا يزال بإمكانكم حفظ الطلب أو ترك بيانات الاتصال.",human:"بالطبع. يرجى مشاركة الاسم والشركة والبلد ورقم الهاتف أو واتساب لتوجيهكم إلى الممثل المناسب.",invalidEmail:"يرجى إدخال بريد إلكتروني صالح.",invalidPhone:"يرجى إدخال رقم هاتف أو واتساب صالح مع رمز الدولة."},
    ru:{title:"Ассистент Sidya AI",online:"Экспорт и снабжение",launcher:"Sidya AI",placeholder:"Введите сообщение...",send:"Отправить",welcome:"Здравствуйте! Добро пожаловать в Sidya Global AI. Я помогу с поставками из Турции, экспортом, логистикой, дистрибуцией и запросами цен. Чем могу помочь?",teaser:"Ищете поставки из Турции, экспорт или коммерческое предложение? Sidya AI поможет прямо сейчас.",start:"Начать чат",close:"Закрыть",unknown:"Пока не определено",privacy:"Ваши данные будут обработаны для оценки запроса и связи с вами.",consent:"Я согласен на обработку данных для оценки моего запроса.",submit:"Сохранить запрос",success:"Спасибо. Ваш запрос успешно сохранен. Команда Sidya Global рассмотрит его и свяжется с вами.",leadNo:"Номер запроса",newLead:"Создать новый запрос",whatsapp:"Продолжить в WhatsApp",email:"Отправить email",attach:"Прикрепить файл",retry:"Сейчас не удалось создать ответ. Вы всё равно можете сохранить запрос или оставить контакты.",human:"Конечно. Сообщите имя, компанию, страну и телефон или WhatsApp, чтобы я направил вас к специалисту.",invalidEmail:"Введите корректный адрес электронной почты.",invalidPhone:"Введите корректный телефон или WhatsApp с кодом страны."},
    ka:{title:"Sidya AI ასისტენტი",online:"ექსპორტისა და მომარაგების მხარდაჭერა",launcher:"Sidya AI",placeholder:"დაწერეთ შეტყობინება...",send:"გაგზავნა",welcome:"გამარჯობა, კეთილი იყოს თქვენი მობრძანება Sidya Global AI ასისტენტში. დაგეხმარებით თურქეთიდან მომარაგებაში, ექსპორტში, ლოჯისტიკაში, დისტრიბუციასა და ფასის მოთხოვნაში. როგორ დაგეხმაროთ?",teaser:"გაინტერესებთ თურქეთიდან მომარაგება, ექსპორტი ან შეთავაზება? Sidya AI დაგეხმარებათ.",start:"ჩატის დაწყება",close:"დახურვა",unknown:"ჯერ არ არის განსაზღვრული",privacy:"თქვენი ინფორმაცია დამუშავდება მოთხოვნის შეფასებისა და თქვენთან დასაკავშირებლად.",consent:"ვეთანხმები ჩემი ინფორმაციის დამუშავებას მოთხოვნის შეფასების მიზნით.",submit:"მოთხოვნის შენახვა",success:"გმადლობთ. თქვენი მოთხოვნა წარმატებით შეინახა. Sidya Global-ის გუნდი განიხილავს და დაგიკავშირდებათ.",leadNo:"მოთხოვნის ნომერი",newLead:"ახალი მოთხოვნა",whatsapp:"WhatsApp-ში გაგრძელება",email:"ელფოსტის გაგზავნა",attach:"ფაილის დამატება",retry:"პასუხის შექმნა ახლა ვერ მოხერხდა. მოთხოვნის შენახვა ან კონტაქტის დატოვება მაინც შეგიძლიათ.",human:"რა თქმა უნდა. მოგვწერეთ სახელი, კომპანია, ქვეყანა და ტელეფონი ან WhatsApp.",invalidEmail:"შეიყვანეთ სწორი ელფოსტა.",invalidPhone:"შეიყვანეთ სწორი ტელეფონი ან WhatsApp ქვეყნის კოდით."},
    az:{title:"Sidya AI Assistent",online:"İxrac və tədarük dəstəyi",launcher:"Sidya AI",placeholder:"Mesajınızı yazın...",send:"Göndər",welcome:"Salam, Sidya Global AI Assistentinə xoş gəlmisiniz. Türkiyədən tədarük, ixrac, logistika, distribütorluq və qiymət təklifi mövzularında kömək edə bilərəm. Sizə necə kömək edim?",teaser:"Türkiyədən tədarük, ixrac və ya qiymət təklifi axtarırsınız? Sidya AI dərhal kömək edə bilər.",start:"Söhbətə başla",close:"Bağla",unknown:"Hələ məlum deyil",privacy:"Məlumatlarınız sorğunuzun qiymətləndirilməsi və sizinlə əlaqə üçün işlənəcək.",consent:"Məlumatlarımın sorğumun qiymətləndirilməsi üçün işlənməsinə razıyam.",submit:"Sorğunu saxla",success:"Təşəkkür edirik. Sorğunuz uğurla qeydə alındı. Sidya Global komandası onu nəzərdən keçirib sizinlə əlaqə saxlayacaq.",leadNo:"Sorğu nömrəsi",newLead:"Yeni sorğu yarat",whatsapp:"WhatsApp ilə davam et",email:"E-poçt göndər",attach:"Fayl əlavə et",retry:"Hazırda cavab yaradıla bilmədi. Sorğunuzu saxlaya və ya əlaqə məlumatlarınızı buraxa bilərsiniz.",human:"Əlbəttə. Sizi uyğun nümayəndəyə yönləndirmək üçün ad, şirkət, ölkə və telefon və ya WhatsApp nömrənizi paylaşın.",invalidEmail:"Düzgün e-poçt ünvanı yazın.",invalidPhone:"Ölkə kodu ilə düzgün telefon və ya WhatsApp nömrəsi yazın."}
  };
  const LABELS = {
    product_name:["ürün adı","product name","اسم المنتج","название товара","პროდუქტის სახელი","məhsul adı"],
    product_category:["ürün kategorisi","product category","فئة المنتج","категория товара","პროდუქტის კატეგორია","məhsul kateqoriyası"],
    product_details:["teknik özellik, marka, ambalaj veya kalite beklentisi","technical, brand, packaging or quality details","المواصفات والعلامة والتغليف أو الجودة","технические требования, бренд, упаковка или качество","ტექნიკური, ბრენდის, შეფუთვის ან ხარისხის დეტალები","texniki, marka, qablaşdırma və keyfiyyət tələbləri"],
    quantity:["tahmini miktar","estimated quantity","الكمية التقريبية","примерное количество","სავარაუდო რაოდენობა","təxmini miqdar"],
    quantity_unit:["miktar birimi (adet, koli, palet, kg veya ton)","quantity unit (unit, carton, pallet, kg or ton)","وحدة الكمية","единица количества","რაოდენობის ერთეული","miqdar vahidi"],
    destination_country:["teslimat ülkesi","destination country","بلد التسليم","страна доставки","მიწოდების ქვეყანა","çatdırılma ölkəsi"],
    destination_city:["teslimat şehri","destination city","مدينة التسليم","город доставки","მიწოდების ქალაქი","çatdırılma şəhəri"],
    destination_port:["teslimat limanı (varsa)","destination port, if any","ميناء التسليم إن وجد","порт доставки, если есть","მიწოდების პორტი, თუ არის","çatdırılma limanı, varsa"],
    requested_delivery_date:["talep edilen teslim veya satın alma tarihi","requested delivery or purchase date","تاريخ التسليم أو الشراء المطلوب","желаемая дата поставки или покупки","სასურველი მიწოდების ან შესყიდვის თარიღი","istənilən çatdırılma və ya alış tarixi"],
    incoterm:["Incoterm tercihi (EXW, FOB, CIF, DAP veya DDP)","preferred Incoterm","شرط Incoterm المفضل","предпочтительный Incoterm","სასურველი Incoterm","Incoterm seçimi"],
    target_price:["hedef fiyat ve para birimi (varsa)","target price and currency, if any","السعر المستهدف والعملة إن وجد","целевая цена и валюта, если есть","სამიზნე ფასი და ვალუტა, თუ არის","hədəf qiymət və valyuta, varsa"],
    private_label_request:["özel marka talebi","private label request","طلب علامة خاصة","требование private label","კერძო ბრენდის მოთხოვნა","özəl marka tələbi"],
    certificate_requirement:["sertifika ihtiyacı","certificate requirements","متطلبات الشهادات","требования к сертификатам","სერტიფიკატის მოთხოვნები","sertifikat tələbi"],
    logistics_type:["yük tipi, araç tipi ve komple/parsiyel bilgisi","cargo, vehicle and full/partial load details","تفاصيل نوع الحمولة والمركبة","тип груза, транспорта и полная/частичная загрузка","ტვირთის, მანქანის და სრული/ნაწილობრივი დატვირთვის დეტალები","yük, nəqliyyat və tam/qismən məlumatı"],
    loading_country:["yükleme ülkesi","loading country","بلد التحميل","страна погрузки","დატვირთვის ქვეყანა","yükləmə ölkəsi"],
    loading_city:["yükleme şehri","loading city","مدينة التحميل","город погрузки","დატვირთვის ქალაქი","yükləmə şəhəri"],
    website:["firma web sitesi","company website","موقع الشركة","сайт компании","კომპანიის ვებსაიტი","şirkət saytı"],
    business_type:["üretici veya distribütör bilgisi","manufacturer or distributor status","مصنع أم موزع","производитель или дистрибьютор","მწარმოებელი თუ დისტრიბუტორი","istehsalçı və ya distribütor"],
    current_markets:["mevcut ihracat ülkeleri","current export markets","أسواق التصدير الحالية","текущие экспортные страны","მიმდინარე საექსპორტო ბაზრები","mövcud ixrac ölkələri"],
    target_markets:["hedef ülkeler","target countries","الدول المستهدفة","целевые страны","სამიზნე ქვეყნები","hədəf ölkələr"],
    capacity:["üretim veya yıllık satın alma kapasitesi","production or annual purchasing capacity","الطاقة الإنتاجية أو الشرائية السنوية","производственная или годовая закупочная мощность","წარმოების ან წლიური შესყიდვის შესაძლებლობა","istehsal və ya illik alış gücü"],
    sales_network:["mevcut satış ağı ve kanal sayısı","sales network and channel count","شبكة المبيعات وعدد القنوات","сеть продаж и количество каналов","გაყიდვების ქსელი და არხების რაოდენობა","satış şəbəkəsi və kanal sayı"],
    message:["talebinizin kısa açıklaması","a short description of your request","وصفاً مختصراً لطلبكم","краткое описание запроса","მოთხოვნის მოკლე აღწერა","sorğunuzun qısa təsviri"],
    full_name:["adınız ve soyadınız","your full name","الاسم الكامل","имя и фамилия","სახელი და გვარი","ad və soyad"],
    company_name:["firma adınız","your company name","اسم الشركة","название компании","კომპანიის სახელი","şirkət adı"],
    country:["bulunduğunuz ülke","your country","الدولة","страна","ქვეყანა","ölkə"],
    city:["bulunduğunuz şehir","your city","المدينة","город","ქალაქი","şəhər"],
    email:["e-posta adresiniz","your email address","البريد الإلكتروني","адрес электронной почты","ელფოსტის მისამართი","e-poçt ünvanı"],
    phone:["telefon veya WhatsApp numaranız","your phone or WhatsApp number","رقم الهاتف أو واتساب","телефон или WhatsApp","ტელეფონი ან WhatsApp","telefon və ya WhatsApp"],
    preferred_contact_method:["tercih ettiğiniz iletişim yöntemi (e-posta, telefon veya WhatsApp)","preferred contact method (email, phone or WhatsApp)","طريقة التواصل المفضلة","предпочтительный способ связи","სასურველი საკონტაქტო მეთოდი","üstünlük verilən əlaqə üsulu"]
  };
  const FLOW = {
    product:["product_name","quantity","destination_country","destination_city","product_details","requested_delivery_date"],
    quote:["product_name","product_details","quantity","quantity_unit","destination_country","destination_city","destination_port","incoterm","requested_delivery_date","target_price"],
    sourcing:["product_name","product_category","product_details","quantity","destination_country","private_label_request","certificate_requirement","requested_delivery_date"],
    export:["company_name","website","business_type","product_name","current_markets","target_markets","capacity","certificate_requirement"],
    logistics:["loading_country","loading_city","destination_country","destination_city","product_name","quantity","logistics_type","requested_delivery_date"],
    distributorship:["company_name","country","city","product_category","sales_network","capacity","website"],
    order_status:["message"], sales_rep:[], other:["message"]
  };
  const CONTACT = ["full_name","company_name","country","city","email","phone","preferred_contact_method"];
  const langIndex = (lang) => ({tr:0,en:1,ar:2,ru:3,ka:4,az:5}[lang] || 1);
  const language = () => {
    const html = String(document.documentElement.lang || "").slice(0,2).toLowerCase();
    if (SUPPORTED.includes(html)) return html;
    const nav = String(navigator.language || "en").slice(0,2).toLowerCase();
    return SUPPORTED.includes(nav) ? nav : "en";
  };
  const id = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const fresh = () => ({session_id:id(),conversation_id:id(),language:language(),lead_type:"",step:0,fields:{},messages:[],started_at:Date.now(),completed:false});
  let state;
  try { state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || fresh(); } catch (_) { state = fresh(); }
  if (!state.session_id) state = fresh();
  state.language = language();
  let selectedFiles = [];
  let panel, log, input, send, quick, fileName;
  const t = (key) => (I18N[state.language] || I18N.en)[key] || I18N.en[key] || key;
  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function question(field) {
    const label = (LABELS[field] || [field,field,field,field,field,field])[langIndex(state.language)];
    const starters = {tr:"Lütfen paylaşın: ",en:"Please share: ",ar:"يرجى مشاركة: ",ru:"Пожалуйста, укажите: ",ka:"გთხოვთ მიუთითოთ: ",az:"Zəhmət olmasa paylaşın: "};
    return (starters[state.language] || starters.en) + label + ".";
  }
  function add(role, content, persist = true) {
    const node = document.createElement("div");
    node.className = "sidya-ai-message " + role;
    node.textContent = content;
    log.appendChild(node);
    if (persist) {
      state.messages.push({role,content,at:new Date().toISOString()});
      state.messages = state.messages.slice(-100);
      save();
    }
    log.scrollTop = log.scrollHeight;
  }
  function renderHistory() {
    log.innerHTML = "";
    if (!state.messages.length) add("assistant",t("welcome"));
    else state.messages.forEach((m) => add(m.role,m.content,false));
    if (!state.lead_type && !state.completed) showTypes();
    if (state.completed && state.lead_number) successView();
  }
  function localizedType(label) {
    if (state.language === "tr") return label;
    const map = {
      en:["I am looking for a product","I want a quotation","I want to source from Türkiye","I want to export","I need logistics support","Distributorship or dealership","Check my order status","Talk to a sales representative","Other"],
      ar:["أبحث عن منتج","أريد عرض سعر","أريد التوريد من تركيا","أريد التصدير","أحتاج دعماً لوجستياً","توزيع أو وكالة","حالة طلبي","التحدث مع ممثل مبيعات","أخرى"],
      ru:["Ищу товар","Хочу получить предложение","Закупка из Турции","Хочу экспортировать","Нужна логистика","Дистрибуция или дилерство","Статус заказа","Связаться с менеджером","Другое"],
      ka:["ვეძებ პროდუქტს","მინდა შეთავაზება","თურქეთიდან მომარაგება","მინდა ექსპორტი","მჭირდება ლოჯისტიკა","დისტრიბუცია ან დილერობა","შეკვეთის სტატუსი","გაყიდვების წარმომადგენელი","სხვა"],
      az:["Məhsul axtarıram","Qiymət təklifi istəyirəm","Türkiyədən tədarük","İxrac etmək istəyirəm","Logistika dəstəyi","Distribütorluq və ya dilerlik","Sifariş statusu","Satış nümayəndəsi","Digər"]
    };
    const index = TYPES.findIndex((x) => x[1] === label);
    return (map[state.language] || map.en)[index];
  }
  function showTypes() {
    quick.innerHTML = "";
    TYPES.forEach(([value,label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = localizedType(label);
      button.addEventListener("click",() => selectType(value,button.textContent));
      quick.appendChild(button);
    });
  }
  function selectType(value,label) {
    state.lead_type = value;
    state.step = 0;
    state.fields = state.fields || {};
    add("user",label);
    quick.innerHTML = "";
    if (value === "sales_rep") add("assistant",t("human"));
    askNext();
  }
  function steps() {
    const all = (FLOW[state.lead_type] || FLOW.other).concat(CONTACT);
    return all.filter((field,index) => all.indexOf(field) === index && !state.fields[field]);
  }
  function askNext() {
    const remain = steps();
    if (!remain.length) return showConsent();
    const field = remain[0];
    state.current_field = field;
    add("assistant",question(field));
    quick.innerHTML = "";
    if (field === "quantity") {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = t("unknown");
      button.addEventListener("click",() => acceptAnswer(t("unknown")));
      quick.appendChild(button);
    }
    if (field === "preferred_contact_method") {
      ["E-posta","Telefon","WhatsApp"].forEach((value) => {
        const button = document.createElement("button");
        button.type = "button"; button.textContent = value;
        button.addEventListener("click",() => acceptAnswer(value));
        quick.appendChild(button);
      });
    }
    save();
  }
  function validate(field,value) {
    if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value)) return t("invalidEmail");
    if (field === "phone" && !/^\+?[0-9][0-9\s().-]{6,24}$/.test(value)) return t("invalidPhone");
    return "";
  }
  function acceptAnswer(value) {
    const field = state.current_field;
    const error = validate(field,value);
    if (error) { add("assistant",error); return; }
    add("user",value);
    state.fields[field] = value;
    if (field === "phone") state.fields.whatsapp = value;
    state.current_field = "";
    quick.innerHTML = "";
    save();
    askNext();
  }
  function showConsent() {
    state.current_field = "consent";
    const wrap = document.createElement("div");
    wrap.className = "sidya-ai-consent";
    wrap.innerHTML = "<strong>" + esc(t("privacy")) + "</strong><label><input type='checkbox'> <span>" + esc(t("consent")) + "</span></label><button type='button'>" + esc(t("submit")) + "</button>";
    quick.innerHTML = "";
    quick.appendChild(wrap);
    wrap.querySelector("button").addEventListener("click",() => {
      if (!wrap.querySelector("input").checked) { add("assistant",t("consent")); return; }
      submitLead();
    });
  }
  function typing(on) {
    document.querySelector(".sidya-ai-typing")?.remove();
    if (!on) return;
    const node = document.createElement("div");
    node.className = "sidya-ai-typing"; node.innerHTML = "<i></i><i></i><i></i>";
    log.appendChild(node); log.scrollTop = log.scrollHeight;
  }
  async function api(action,payload,options={}) {
    const response = await fetch(API + "?action=" + encodeURIComponent(action), {
      method: options.method || "POST",
      headers:{"Content-Type":"application/json",...(options.headers||{})},
      body: options.method === "GET" ? undefined : JSON.stringify(payload || {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) throw new Error(result.error || "Request failed");
    return result;
  }
  function humanIntent(value) {
    return /insan|temsilci|beni ara|whatsapp|human|representative|call me|сотрудник|позвон|человек|عاجل|موظف|واتساب|acil|urgent|təcili/i.test(value);
  }
  async function freeChat(value) {
    add("user",value);
    if (humanIntent(value) && !state.lead_type) {
      state.lead_type = "sales_rep"; add("assistant",t("human")); askNext(); return;
    }
    typing(true); send.disabled = true;
    try {
      const result = await api("chat",{message:value,language:state.language,history:state.messages.slice(-8),session_id:state.session_id,conversation_id:state.conversation_id,page_url:location.href,website:""});
      state.language = result.language || state.language;
      add("assistant",result.reply);
      if (!state.lead_type) showTypes();
    } catch (_) { add("assistant",t("retry")); if (!state.lead_type) showTypes(); }
    finally { typing(false); send.disabled = false; input.focus(); }
  }
  function payload() {
    const u = new URL(location.href);
    const f = state.fields;
    return {
      session_id:state.session_id,conversation_id:state.conversation_id,language:state.language,lead_type:state.lead_type,
      full_name:f.full_name,company_name:f.company_name,country:f.country,city:f.city,email:f.email,phone:f.phone,whatsapp:f.whatsapp,
      preferred_contact_method:f.preferred_contact_method,product_category:f.product_category,product_name:f.product_name,
      product_details:[f.product_details,f.website&&("Web: "+f.website),f.business_type,f.current_markets,f.target_markets,f.capacity,f.sales_network,f.loading_country&&("Loading: "+f.loading_country+" "+(f.loading_city||""))].filter(Boolean).join(" | "),
      quantity:f.quantity,quantity_unit:f.quantity_unit,destination_country:f.destination_country,destination_city:f.destination_city,destination_port:f.destination_port,
      requested_delivery_date:/^\d{4}-\d{2}-\d{2}$/.test(f.requested_delivery_date||"")?f.requested_delivery_date:null,incoterm:f.incoterm,target_price:f.target_price,
      private_label_request:f.private_label_request,certificate_requirement:f.certificate_requirement,logistics_type:f.logistics_type,message:f.message||f.product_details||f.product_name||state.lead_type,
      conversation_json:state.messages,page_url:location.href,referrer:document.referrer,utm_source:u.searchParams.get("utm_source")||"",utm_medium:u.searchParams.get("utm_medium")||"",utm_campaign:u.searchParams.get("utm_campaign")||"",
      consent_given:true,duration_seconds:Math.max(0,Math.round((Date.now()-state.started_at)/1000)),elapsed_ms:Date.now()-state.started_at,website:""
    };
  }
  const fileBase64 = (file) => new Promise((resolve,reject) => { const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file); });
  async function submitLead() {
    typing(true); send.disabled = true; quick.innerHTML = "";
    try {
      const result = await api("lead",payload());
      for (const file of selectedFiles) {
        try { await api("upload",{lead_id:result.id,session_id:state.session_id,file:{name:file.name,type:file.type,base64:await fileBase64(file)}}); } catch (_) {}
      }
      state.completed = true; state.lead_id = result.id; state.lead_number = result.leadNumber; save();
      add("assistant",t("success"));
      successView();
    } catch (error) { add("assistant",error.message || t("retry")); showConsent(); }
    finally { typing(false); send.disabled = false; }
  }
  function successView() {
    quick.innerHTML = "";
    const wa = document.querySelector('a[href*="wa.me"]')?.getAttribute("href") || "";
    const text = "Merhaba, Sidya Global internet sitesindeki AI Asistanı üzerinden bir talep oluşturdum. Talep numaram: " + state.lead_number;
    const waUrl = wa ? wa.split("?")[0] + "?text=" + encodeURIComponent(text) : "#";
    const node = document.createElement("div");
    node.className = "sidya-ai-success";
    node.innerHTML = "<strong>" + esc(t("leadNo")) + ": " + esc(state.lead_number) + "</strong><div class='sidya-ai-success-actions'><button type='button' data-new>" + esc(t("newLead")) + "</button><a href='" + esc(waUrl) + "' target='_blank' rel='noopener'>" + esc(t("whatsapp")) + "</a><a href='mailto:export@sidyaglobal.com?subject=" + encodeURIComponent(state.lead_number) + "'>" + esc(t("email")) + "</a><button type='button' data-close>" + esc(t("close")) + "</button></div>";
    quick.appendChild(node);
    node.querySelector("[data-new]").addEventListener("click",() => { state=fresh();selectedFiles=[];save();renderHistory(); });
    node.querySelector("[data-close]").addEventListener("click",closePanel);
  }
  function openPanel() {
    panel.hidden = false; document.querySelector(".sidya-ai-teaser")?.remove();
    document.querySelector(".sidya-ai-launcher").setAttribute("aria-expanded","true");
    setTimeout(() => input.focus(),50);
    api("event",{session_id:state.session_id,conversation_id:state.conversation_id,event_name:"opened",language:state.language,page_url:location.href}).catch(()=>{});
  }
  function closePanel() { panel.hidden = true; document.querySelector(".sidya-ai-launcher").setAttribute("aria-expanded","false"); }
  function build() {
    const root = document.createElement("div");
    root.className = "sidya-ai-root"; root.dir = state.language === "ar" ? "rtl" : "ltr";
    root.innerHTML = "<button class='sidya-ai-launcher' type='button' aria-label='" + esc(t("title")) + "' aria-expanded='false'><span class='sidya-ai-launcher-icon'>AI</span><span>" + esc(t("launcher")) + "</span></button><section class='sidya-ai-panel' role='dialog' aria-modal='false' aria-label='" + esc(t("title")) + "' hidden><header class='sidya-ai-head'><div class='sidya-ai-head-copy'><span class='sidya-ai-avatar'>SG</span><div><strong>" + esc(t("title")) + "</strong><small>" + esc(t("online")) + "</small></div></div><button class='sidya-ai-close' type='button' aria-label='" + esc(t("close")) + "'>×</button></header><div class='sidya-ai-log' aria-live='polite'></div><footer class='sidya-ai-composer'><div class='sidya-ai-quick'></div><form class='sidya-ai-form'><textarea class='sidya-ai-input' rows='1' maxlength='2000' placeholder='" + esc(t("placeholder")) + "' aria-label='" + esc(t("placeholder")) + "'></textarea><button class='sidya-ai-send' type='submit' aria-label='" + esc(t("send")) + "'>➤</button></form><div class='sidya-ai-tools'><label class='sidya-ai-file'>" + esc(t("attach")) + "<input type='file' multiple accept='.pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png,.webp'></label><span class='sidya-ai-file-name'></span></div></footer></section>";
    document.body.appendChild(root);
    panel=root.querySelector(".sidya-ai-panel");log=root.querySelector(".sidya-ai-log");input=root.querySelector(".sidya-ai-input");send=root.querySelector(".sidya-ai-send");quick=root.querySelector(".sidya-ai-quick");fileName=root.querySelector(".sidya-ai-file-name");
    root.querySelector(".sidya-ai-launcher").addEventListener("click",() => panel.hidden ? openPanel() : closePanel());
    root.querySelector(".sidya-ai-close").addEventListener("click",closePanel);
    root.querySelector("form").addEventListener("submit",(event) => {
      event.preventDefault(); const value=input.value.trim(); if(!value)return; input.value="";
      if (state.lead_type && state.current_field && state.current_field !== "consent") acceptAnswer(value); else freeChat(value);
    });
    input.addEventListener("keydown",(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();root.querySelector("form").requestSubmit();}});
    root.querySelector('input[type="file"]').addEventListener("change",(event)=>{
      selectedFiles=Array.from(event.target.files||[]).filter((file)=>file.size<=3*1024*1024).slice(0,5);
      fileName.textContent=selectedFiles.map((file)=>file.name).join(", ");
    });
    renderHistory();
    if (!sessionStorage.getItem(SESSION_NOTICE) && !state.completed) setTimeout(() => {
      if (!panel.hidden || sessionStorage.getItem(SESSION_NOTICE)) return;
      const teaser=document.createElement("div");teaser.className="sidya-ai-teaser";teaser.innerHTML="<div>"+esc(t("teaser"))+"</div><div class='sidya-ai-teaser-actions'><button class='primary' type='button'>"+esc(t("start"))+"</button><button type='button'>"+esc(t("close"))+"</button></div>";
      root.appendChild(teaser);
      teaser.querySelector(".primary").addEventListener("click",openPanel);
      teaser.querySelectorAll("button")[1].addEventListener("click",()=>{sessionStorage.setItem(SESSION_NOTICE,"1");teaser.remove();});
    },6500);
    window.addEventListener("beforeunload",()=>{if(!state.completed&&state.messages.length>1)navigator.sendBeacon(API+"?action=event",new Blob([JSON.stringify({session_id:state.session_id,conversation_id:state.conversation_id,event_name:"abandoned",language:state.language,page_url:location.href,duration_seconds:Math.round((Date.now()-state.started_at)/1000)})],{type:"application/json"}));});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",build,{once:true}); else build();
})();