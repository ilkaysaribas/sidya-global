(() => {
  const importState = () => {
    state.invoiceImport = state.invoiceImport || { file: null, header: {}, lines: [], warnings: [], parsed: false };
    return state.invoiceImport;
  };
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const txt = (v) => safeText(v ?? "");
  const html = (v) => escapeHtml(v ?? "");
  const num = (v) => {
    if (typeof parseNumberFlexible === "function") {
      const parsed = parseNumberFlexible(v);
      if (Number.isFinite(Number(parsed))) return Number(parsed);
    }
    const raw = String(v ?? "").trim().replace(/\s/g, "");
    if (!raw) return 0;
    const normalized = raw.includes(",") && raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(",", ".");
    const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const key = (v) => txt(v).toLocaleLowerCase("tr").replace(/[ıİ]/g, "i").replace(/[^a-z0-9]+/g, "");
  const read = (row, aliases) => {
    if (typeof readCell === "function") return readCell(row, aliases);
    const map = Object.fromEntries(Object.keys(row || {}).map((k) => [key(k), row[k]]));
    for (const alias of aliases) if (map[key(alias)] !== undefined && map[key(alias)] !== "") return map[key(alias)];
    return "";
  };
  const dateLoose = (v) => {
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    const raw = txt(v);
    const iso = raw.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
    const tr = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    return tr ? `${tr[3]}-${String(tr[2]).padStart(2, "0")}-${String(tr[1]).padStart(2, "0")}` : "";
  };
  const currency = (v, fallback = "TRY") => { try { return normalizeCurrency(v || fallback, fallback); } catch { return fallback; } };
  const normalizeTextLine = (value) => txt(value).replace(/\s+/g, " ").trim();
  const loadPdfJs = async () => {
    if (window.pdfjsLib?.getDocument) return window.pdfjsLib;
    const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";
    window.pdfjsLib = pdfjs;
    return pdfjs;
  };
  const extractPdfText = async (file) => {
    setProgress("PDF metni okunuyor...", 35);
    const pdfjs = await loadPdfJs();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer(), useWorkerFetch: true }).promise;
    const pages = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const rows = new Map();
      content.items.forEach((item) => {
        const y = Math.round(item.transform?.[5] || 0);
        const x = item.transform?.[4] || 0;
        const row = rows.get(y) || [];
        row.push({ x, text: item.str || "" });
        rows.set(y, row);
      });
      pages.push(Array.from(rows.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([, row]) => normalizeTextLine(row.sort((a, b) => a.x - b.x).map((cell) => cell.text).join(" ")))
        .filter(Boolean)
        .join("\n"));
    }
    return pages.join("\n");
  };
  const loadTesseract = async () => {
    if (window.Tesseract?.recognize) return window.Tesseract;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("OCR kütüphanesi yüklenemedi."));
      document.head.appendChild(script);
    });
    if (!window.Tesseract?.recognize) throw new Error("OCR kütüphanesi başlatılamadı.");
    return window.Tesseract;
  };
  const extractImageText = async (file) => {
    setProgress("Görsel OCR ile taranıyor...", 35);
    const tesseract = await loadTesseract();
    const result = await tesseract.recognize(file, "tur+eng", {
      logger: (m) => {
        if (m?.status === "recognizing text") setProgress("OCR taranıyor... %" + Math.round((m.progress || 0) * 100), 35 + (m.progress || 0) * 30);
      }
    });
    return result?.data?.text || "";
  };
  const textValueAfter = (text, patterns) => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return normalizeTextLine(match[1]);
    }
    return "";
  };
  const parseInvoiceText = (text, file, sourceLabel) => {
    const clean = String(text || "").replace(/\u00A0/g, " ");
    const rawLines = clean.split(/\r?\n/).map(normalizeTextLine).filter(Boolean);
    const joined = rawLines.join("\n");
    const header = {
      invoice_type: /sat[ıi]ş|satis|sales/i.test(joined) ? "sale" : "purchase",
      invoice_no: textValueAfter(joined, [/(?:Fatura\s*(?:No|Numarası)|Invoice\s*(?:No|Number)|Belge\s*No)\s*[:#-]?\s*([A-Z0-9][A-Z0-9./_-]+)/i, /\b(E[A-Z0-9]{3,}[\d-]{4,})\b/i]),
      invoice_date: dateLoose(textValueAfter(joined, [/(?:Fatura\s*Tarihi|Tarih|Issue\s*Date)\s*[:#-]?\s*([0-9./-]{8,10})/i])),
      due_date: dateLoose(textValueAfter(joined, [/(?:Vade\s*Tarihi|Due\s*Date)\s*[:#-]?\s*([0-9./-]{8,10})/i])),
      document_number: textValueAfter(joined, [/(?:ETTN|UUID|Belge\s*Numarası)\s*[:#-]?\s*([A-Z0-9-]{8,})/i]),
      raw_tax_number: textValueAfter(joined, [/(?:VKN|TCKN|Vergi\s*(?:No|Numarası)|Tax\s*(?:No|Number))\s*[:#-]?\s*([0-9]{10,11})/i]),
      raw_customer_name: textValueAfter(joined, [/(?:Sayın|Cari|Alıcı|Satıcı|Müşteri|Tedarikçi|Customer|Supplier)\s*[:#-]?\s*([^\n]{3,100})/i]),
      currency: currency(textValueAfter(joined, [/\b(TRY|TL|USD|EUR|GEL|LARI|RUB|RUBLE)\b/i]), "TRY"),
      subtotal: num(textValueAfter(joined, [/(?:Ara\s*Toplam|Mal\s*Hizmet\s*Toplam|Matrah|Subtotal)\s*[:#-]?\s*([0-9.,]+)/i])),
      tax_total: num(textValueAfter(joined, [/(?:Toplam\s*KDV|KDV\s*Toplamı|VAT\s*Total)\s*[:#-]?\s*([0-9.,]+)/i])),
      grand_total: num(textValueAfter(joined, [/(?:Genel\s*Toplam|Vergiler\s*Dahil\s*Toplam|Grand\s*Total)\s*[:#-]?\s*([0-9.,]+)/i])),
      payable_total: num(textValueAfter(joined, [/(?:Ödenecek\s*Tutar|Payable\s*Amount)\s*[:#-]?\s*([0-9.,]+)/i])),
      source_file_name: file?.name || ""
    };
    const moneyToken = "[0-9]{1,3}(?:[.\\s][0-9]{3})*(?:,[0-9]{1,4})?|[0-9]+(?:\\.[0-9]{1,4})?";
    const lineRegex = new RegExp("^(?:(\\d{8,14})\\s+)?(.{3,}?)\\s+(" + moneyToken + ")\\s*(adet|ad|pcs|kg|lt|koli|paket|pk|\\w{1,5})?\\s+(" + moneyToken + ")\\s+(?:%?\\s*([0-9]{1,2}))?\\s*(" + moneyToken + ")$", "i");
    const skip = /fatura|invoice|toplam|kdv|matrah|ödenecek|odenecek|vergi|subtotal|total|tarih|adres|vkn|tckn|ettn|uuid/i;
    const lines = [];
    rawLines.forEach((line) => {
      if (skip.test(line) || line.length < 12) return;
      const match = line.match(lineRegex);
      if (!match) return;
      const quantity = num(match[3]);
      const unitPrice = num(match[5]);
      const vatRate = num(match[6]);
      const lineTotal = num(match[7]);
      if (!quantity || !unitPrice || !lineTotal) return;
      lines.push(lineCalc({
        row_index: lines.length + 1,
        raw_barcode: match[1] || "",
        raw_product_name: normalizeTextLine(match[2]),
        quantity,
        unit: match[4] || "adet",
        unit_price: unitPrice,
        vat_rate: vatRate,
        line_total: lineTotal,
        line_subtotal: vatRate ? lineTotal / (1 + vatRate / 100) : quantity * unitPrice,
        raw_payload: { source: sourceLabel, text: line }
      }));
    });
    const warnings = [];
    if (!clean.trim()) warnings.push(sourceLabel + " içinden metin alınamadı. Belge taranmış veya korumalı olabilir.");
    if (clean.trim() && !lines.length) warnings.push(sourceLabel + " metni okundu ancak ürün satırı otomatik ayrıştırılamadı. Ön izleme alanından manuel satır ekleyebilir veya XML/Excel yükleyebilirsiniz.");
    return { header, lines, warnings };
  };
  const setProgress = (label, value = 0, hidden = false) => {
    const box = q("#invoiceImportProgress"); if (!box) return;
    box.hidden = hidden;
    const s = q("span", box); const p = q("progress", box);
    if (s) s.textContent = repairText(label || "");
    if (p) p.value = Math.max(0, Math.min(100, Number(value || 0)));
  };
  const setImportStatus = (message, error = false) => {
    const el = q("#invoiceImportStatus"); if (!el) return;
    el.textContent = repairText(message || "");
    el.classList.toggle("error", !!error);
    el.classList.toggle("success", !!message && !error);
  };
  const lineCalc = (line) => {
    const qty = Math.max(0, num(line.quantity));
    const price = Math.max(0, num(line.unit_price));
    const gross = qty * price;
    const discountRate = Math.max(0, num(line.discount_rate));
    const discountAmount = Math.max(num(line.discount_amount), discountRate ? gross * discountRate / 100 : 0);
    const net = Math.max(0, num(line.line_subtotal) || gross - discountAmount);
    const vatRate = Math.max(0, num(line.vat_rate));
    const vatAmount = Math.max(0, num(line.vat_amount) || net * vatRate / 100);
    return { ...line, quantity: qty, unit_price: price, discount_rate: discountRate, discount_amount: discountAmount, vat_rate: vatRate, vat_amount: vatAmount, line_subtotal: net, line_total: num(line.line_total) || net + vatAmount, unit: txt(line.unit || "adet") || "adet" };
  };
  const splitCsv = (line, delimiter) => {
    const cells = []; let current = ""; let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i += 1; continue; }
      if (ch === '"') { quoted = !quoted; continue; }
      if (ch === delimiter && !quoted) { cells.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    cells.push(current.trim()); return cells;
  };
  const csvRows = (text) => {
    const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return [];
    const delimiter = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
    const headers = splitCsv(lines[0], delimiter);
    return lines.slice(1).map((line) => Object.fromEntries(headers.map((h, i) => [h, splitCsv(line, delimiter)[i] ?? ""])));
  };
  const workbookRows = async (file) => {
    if (!window.XLSX) throw new Error("Excel okuyucu yüklenemedi. Sayfayı yenileyip tekrar deneyin.");
    const wb = window.XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    return window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  };
  const localNodes = (root, name) => Array.from(root?.getElementsByTagName("*") || []).filter((n) => String(n.localName || n.nodeName).toLowerCase() === String(name).toLowerCase());
  const firstText = (root, names) => {
    const wanted = names.map((n) => String(n).toLowerCase());
    const found = Array.from(root?.getElementsByTagName("*") || []).find((n) => wanted.includes(String(n.localName || n.nodeName).toLowerCase()));
    return txt(found?.textContent || "");
  };
  const parseXml = (text, file) => {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("XML formatı geçersiz veya okunamadı.");
    const root = doc.documentElement;
    const supplier = localNodes(root, "AccountingSupplierParty")[0] || root;
    const partyName = localNodes(supplier, "PartyName")[0] || supplier;
    const legalTotal = localNodes(root, "LegalMonetaryTotal")[0] || root;
    const taxTotal = localNodes(root, "TaxTotal")[0] || root;
    const header = {
      invoice_type: "purchase",
      invoice_no: firstText(root, ["ID"]),
      invoice_date: dateLoose(firstText(root, ["IssueDate"])),
      document_number: firstText(root, ["UUID"]),
      raw_customer_name: firstText(partyName, ["Name"]) || firstText(supplier, ["RegistrationName"]),
      raw_tax_number: firstText(supplier, ["CompanyID", "ID"]),
      tax_office: firstText(supplier, ["TaxScheme", "Name"]),
      address: firstText(supplier, ["StreetName"]),
      currency: currency(firstText(root, ["DocumentCurrencyCode"]), "TRY"),
      subtotal: num(firstText(legalTotal, ["LineExtensionAmount", "TaxExclusiveAmount"])),
      tax_total: num(firstText(taxTotal, ["TaxAmount"])),
      grand_total: num(firstText(legalTotal, ["TaxInclusiveAmount", "PayableAmount"])),
      payable_total: num(firstText(legalTotal, ["PayableAmount"])),
      source_file_name: file?.name || ""
    };
    const lines = localNodes(root, "InvoiceLine").map((node, index) => {
      const item = localNodes(node, "Item")[0] || node;
      const price = localNodes(node, "Price")[0] || node;
      const tax = localNodes(node, "TaxTotal")[0] || node;
      const quantityNode = localNodes(node, "InvoicedQuantity")[0] || localNodes(node, "CreditedQuantity")[0];
      return lineCalc({
        row_index: index + 1,
        raw_product_name: firstText(item, ["Name", "Description"]),
        raw_barcode: firstText(item, ["ID"]),
        raw_product_code: firstText(item, ["SellersItemIdentification", "BuyersItemIdentification"]),
        description: firstText(item, ["Description"]),
        quantity: num(quantityNode?.textContent),
        unit: txt(quantityNode?.getAttribute("unitCode") || "adet"),
        unit_price: num(firstText(price, ["PriceAmount"])),
        vat_rate: num(firstText(node, ["Percent"])),
        vat_amount: num(firstText(tax, ["TaxAmount"])),
        line_subtotal: num(firstText(node, ["LineExtensionAmount"])),
        raw_payload: {}
      });
    });
    return { header, lines, warnings: lines.length ? [] : ["XML içinde fatura satırı bulunamadı. Manuel satır ekleyebilirsiniz."] };
  };
  const parseRows = (rows, file) => {
    const first = rows[0] || {};
    const header = {
      invoice_type: key(read(first, ["Fatura Türü", "Fatura Tipi", "Tür"])).includes("sat") ? "sale" : "purchase",
      invoice_no: txt(read(first, ["Fatura No", "Fatura Numarası", "Belge No", "Invoice No"])),
      invoice_date: dateLoose(read(first, ["Fatura Tarihi", "Tarih", "Invoice Date"])),
      document_number: txt(read(first, ["Belge Numarası", "Belge No", "UUID"])),
      raw_customer_name: txt(read(first, ["Cari", "Cari Ünvanı", "Firma", "Tedarikçi", "Müşteri", "Company"])),
      raw_tax_number: txt(read(first, ["Vergi No", "Vergi Numarası", "TCKN", "VKN", "Tax Number"])),
      tax_office: txt(read(first, ["Vergi Dairesi"])),
      address: txt(read(first, ["Adres"])),
      phone: txt(read(first, ["Telefon", "Phone"])),
      email: txt(read(first, ["E-posta", "Email"])),
      currency: currency(read(first, ["Para Birimi", "Currency"]), "TRY"),
      due_date: dateLoose(read(first, ["Vade Tarihi", "Due Date"])),
      payment_method: txt(read(first, ["Ödeme Şekli", "Payment"])),
      order_no: txt(read(first, ["Sipariş No", "Order No"])),
      notes: txt(read(first, ["Açıklama", "Not", "Notes"])),
      subtotal: num(read(first, ["Ara Toplam", "Matrah", "Subtotal"])),
      total_discount: num(read(first, ["Toplam İskonto", "İskonto", "Discount"])),
      tax_total: num(read(first, ["KDV Toplamı", "Toplam KDV", "VAT Total"])),
      grand_total: num(read(first, ["Genel Toplam", "Toplam", "Grand Total"])),
      payable_total: num(read(first, ["Ödenecek Tutar", "Payable"])),
      source_file_name: file?.name || ""
    };
    const lines = rows.map((row, i) => lineCalc({
      row_index: i + 1,
      raw_barcode: read(row, ["Barkod", "Barcode", "GTIN"]),
      raw_product_code: read(row, ["Ürün Kodu", "SKU", "Stok Kodu", "Product Code"]),
      seller_product_code: read(row, ["Satıcı Ürün Kodu", "Tedarikçi Ürün Kodu", "Supplier Code"]),
      raw_product_name: read(row, ["Ürün Adı", "Mal Hizmet", "Mal/Hizmet", "Product", "Description"]),
      description: read(row, ["Açıklama", "Description"]),
      unit: read(row, ["Birim", "Unit"]),
      quantity: read(row, ["Miktar", "Quantity", "Adet"]),
      unit_price: read(row, ["Birim Fiyat", "Unit Price", "Fiyat"]),
      discount_rate: read(row, ["İskonto Oranı", "İskonto %", "Discount Rate"]),
      discount_amount: read(row, ["İskonto Tutarı", "Discount Amount"]),
      vat_rate: read(row, ["KDV Oranı", "KDV", "VAT"]),
      vat_amount: read(row, ["KDV Tutarı", "VAT Amount"]),
      line_subtotal: read(row, ["Satır Ara Toplam", "Matrah", "Line Subtotal"]),
      line_total: read(row, ["Satır Toplam", "Line Total"]),
      lot_number: read(row, ["Lot", "Parti", "Parti No"]),
      expiry_date: dateLoose(read(row, ["Son Kullanma Tarihi", "SKT", "Expiry"])),
      raw_payload: row
    })).filter((l) => l.raw_product_name || l.raw_barcode || l.raw_product_code || l.quantity || l.unit_price);
    return { header, lines, warnings: lines.length ? [] : ["Dosyada okunabilir ürün satırı bulunamadı."] };
  };
  const matchCustomer = (h) => {
    const tax = key(h.raw_tax_number), name = key(h.raw_customer_name), phone = key(h.phone), email = txt(h.email).toLowerCase();
    const list = state.customers || [];
    let m = tax ? list.find((c) => key(c.tax_number) === tax) : null;
    if (!m && name) m = list.find((c) => key(c.company) === name);
    if (!m && phone) m = list.find((c) => key(c.phone) === phone);
    if (!m && email) m = list.find((c) => txt(c.email).toLowerCase() === email);
    if (!m && name) m = list.find((c) => key(c.company).includes(name) || name.includes(key(c.company)));
    h.customer_id = m?.id || h.customer_id || ""; h.customer_match_status = m ? "matched" : "unmatched"; return m;
  };
  const matchProduct = (line) => {
    const list = state.products || [];
    const barcode = key(line.raw_barcode), code = key(line.raw_product_code || line.seller_product_code), name = key(line.raw_product_name);
    let p = barcode ? list.find((x) => key(x.barcode) === barcode || key(x.sku) === barcode) : null; let type = p ? "barcode" : "none";
    if (!p && code) { p = list.find((x) => key(x.sku) === code || key(x.product_code) === code || key(x.barcode) === code); type = p ? "product_code" : type; }
    if (!p && name) { p = list.find((x) => key(x.name) === name); type = p ? "name" : type; }
    if (!p && name) { p = list.find((x) => key(x.name).includes(name) || name.includes(key(x.name))); type = p ? "similar_name" : type; }
    line.matched_product_id = p?.id || line.matched_product_id || "";
    line.match_type = p ? type : "none"; line.match_confidence = p ? (type === "similar_name" ? 70 : 100) : 0;
    line.matching_status = p ? (type === "similar_name" ? "partial" : "matched") : "unmatched";
    return p;
  };
  const totals = () => {
    const lines = importState().lines || [];
    const totalNet = lines.reduce((s, l) => s + Number(l.line_subtotal || 0), 0);
    const totalVat = lines.reduce((s, l) => s + Number(l.vat_amount || 0), 0);
    const totalGross = lines.reduce((s, l) => s + Number(l.line_total || 0), 0);
    const vatGroups = lines.reduce((g, l) => { const r = String(Number(l.vat_rate || 0)); g[r] = g[r] || { base: 0, vat: 0 }; g[r].base += Number(l.line_subtotal || 0); g[r].vat += Number(l.vat_amount || 0); return g; }, {});
    const docTotal = Number(importState().header?.grand_total || importState().header?.payable_total || 0);
    return { totalNet, totalVat, totalGross, docTotal, diff: docTotal ? docTotal - totalGross : 0, vatGroups };
  };
  const productOptions = (selected) => '<option value="">Ürün seç</option>' + (state.products || []).slice().sort((a, b) => txt(a.name).localeCompare(txt(b.name), "tr")).map((p) => `<option value="${html(p.id)}" ${p.id === selected ? "selected" : ""}>${html([p.brand, p.name, p.grammage, p.barcode || p.sku].filter(Boolean).join(" | "))}</option>`).join("");
  const renderPreview = () => {
    const box = q("#invoiceImportPreview"); if (!box) return;
    const s = importState(); if (!s.parsed) { box.hidden = true; box.innerHTML = ""; return; }
    const h = s.header || {}; const t = totals();
    const customerOptions = (state.customers || []).map((c) => `<option value="${html(c.id)}" ${c.id === h.customer_id ? "selected" : ""}>${html(c.company || c.email || c.id)}</option>`).join("");
    const warnings = [...(s.warnings || [])];
    if (!h.customer_id) warnings.push("Tanımsız cari: Mevcut cariden seçin veya manuel fatura girişinde yeni cari oluşturun.");
    if ((state.invoices || []).some((inv) => txt(inv.document_number) && txt(inv.document_number) === txt(h.invoice_no || h.document_number) && (!h.customer_id || inv.customer_id === h.customer_id))) warnings.push("Aynı fatura numarası bu cari için daha önce kaydedilmiş olabilir. Mükerrer kontrol edin.");
    box.innerHTML = `
      ${warnings.length ? `<div class="invoice-import-warning">${warnings.map(html).join("<br />")}</div>` : ""}
      <div class="invoice-import-section"><h4>Fatura bilgileri</h4><div class="invoice-import-grid">
        <label>Fatura türü<select data-import-header="invoice_type"><option value="purchase" ${h.invoice_type !== "sale" ? "selected" : ""}>Alış</option><option value="sale" ${h.invoice_type === "sale" ? "selected" : ""}>Satış</option></select></label>
        <label>Fatura no<input data-import-header="invoice_no" value="${html(h.invoice_no || "")}" /></label>
        <label>Fatura tarihi<input type="date" data-import-header="invoice_date" value="${html(h.invoice_date || "")}" /></label>
        <label>Vade tarihi<input type="date" data-import-header="due_date" value="${html(h.due_date || "")}" /></label>
        <label class="wide">Cari<select data-import-header="customer_id"><option value="">Tanımsız cari / sonra eşleştir</option>${customerOptions}</select></label>
        <label>Vergi no<input data-import-header="raw_tax_number" value="${html(h.raw_tax_number || "")}" /></label>
        <label>Para birimi<input data-import-header="currency" value="${html(h.currency || "TRY")}" /></label>
        <label class="wide">Cari unvanı<input data-import-header="raw_customer_name" value="${html(h.raw_customer_name || "")}" /></label>
        <label class="wide">Açıklama<textarea data-import-header="notes">${html(h.notes || "")}</textarea></label>
      </div></div>
      <div class="invoice-import-section"><h4>Ürün eşleştirme</h4><div class="invoice-import-table"><table><thead><tr><th>Durum</th><th>Faturadaki ürün</th><th>Barkod / Kod</th><th>Sistem ürünü</th><th>Mevcut stok</th><th>Miktar</th><th>Yeni stok</th><th>Birim fiyat</th><th>KDV %</th><th>Satır toplamı</th></tr></thead><tbody>
      ${(s.lines || []).map((l, i) => {
        const p = (state.products || []).find((x) => x.id === l.matched_product_id); const type = h.invoice_type || "purchase";
        const stock = Number(p?.stock_quantity || 0); const delta = p ? stockQuantityFor(l.quantity, /koli/i.test(l.unit) ? "koli" : "adet", p.units_per_carton) : 0;
        const next = p ? stock + (type === "sale" ? -delta : delta) : 0;
        const cls = l.matching_status === "matched" ? "matched" : l.matching_status === "partial" ? "partial" : "unmatched";
        const label = l.matching_status === "matched" ? "Eşleşti" : l.matching_status === "partial" ? "Kısmi eşleşti" : "Tanımsız ürün";
        return `<tr><td><span class="match-badge ${cls}">${label}</span><small>${html(l.match_type || "")}</small></td><td class="raw-cell"><strong>${html(l.raw_product_name || "-")}</strong><small>${html(l.description || "")}</small></td><td>${html(l.raw_barcode || l.raw_product_code || "-")}</td><td class="product-cell"><select data-import-line-product="${i}">${productOptions(l.matched_product_id)}</select></td><td>${p ? number(stock) : "-"}</td><td><input data-import-line-field="quantity" data-index="${i}" type="number" min="0" step="0.001" value="${Number(l.quantity || 0)}" /></td><td>${p ? number(next) : "-"}</td><td><input data-import-line-field="unit_price" data-index="${i}" type="number" min="0" step="0.0001" value="${Number(l.unit_price || 0)}" /></td><td><input data-import-line-field="vat_rate" data-index="${i}" type="number" min="0" step="0.01" value="${Number(l.vat_rate || 0)}" /></td><td>${money(l.line_total, h.currency || "TRY")}</td></tr>`;
      }).join("")}</tbody></table></div></div>
      <div class="invoice-import-section"><h4>Vergi ve toplam kontrolü</h4><div class="tax-summary-grid">
        <article><span>Vergiler hariç toplam</span><strong>${money(t.totalNet, h.currency || "TRY")}</strong></article>
        <article><span>Toplam KDV</span><strong>${money(t.totalVat, h.currency || "TRY")}</strong></article>
        <article><span>Sistem genel toplam</span><strong>${money(t.totalGross, h.currency || "TRY")}</strong></article>
        <article><span>Fatura toplamı / fark</span><strong>${money(t.docTotal, h.currency || "TRY")} / ${money(t.diff, h.currency || "TRY")}</strong></article>
        ${Object.entries(t.vatGroups).map(([r, g]) => `<article><span>%${html(r)} KDV matrah / tutar</span><strong>${money(g.base, h.currency || "TRY")} / ${money(g.vat, h.currency || "TRY")}</strong></article>`).join("")}
      </div></div>`;
    box.hidden = false;
  };
  const readPreview = () => {
    const box = q("#invoiceImportPreview"); if (!box || !importState().parsed) return;
    qa("[data-import-header]", box).forEach((f) => { importState().header[f.dataset.importHeader] = f.value; });
    qa("[data-import-line-product]", box).forEach((f) => { const l = importState().lines[Number(f.dataset.importLineProduct)]; if (!l) return; l.matched_product_id = f.value; l.matching_status = f.value ? "matched" : "unmatched"; l.match_type = f.value ? "manual" : "none"; l.match_confidence = f.value ? 100 : 0; l.manual_entry = !!f.value; });
    qa("[data-import-line-field]", box).forEach((f) => { const l = importState().lines[Number(f.dataset.index)]; if (!l) return; l[f.dataset.importLineField] = num(f.value); Object.assign(l, lineCalc(l)); });
  };
  const parseFile = async (file) => {
    if (!file) { setImportStatus("Önce bir fatura dosyası seçin.", true); return; }
    setProgress("Belge okunuyor...", 20); setImportStatus("");
    const ext = (file.name.split(".").pop() || "").toLowerCase(); let parsed;
    if (["xml", "ubl"].includes(ext) || /xml/i.test(file.type)) parsed = parseXml(await file.text(), file);
    else if (["xls", "xlsx"].includes(ext)) parsed = parseRows(await workbookRows(file), file);
    else if (ext === "csv" || /csv|text/i.test(file.type)) parsed = parseRows(csvRows(await file.text()), file);
    else if (ext === "pdf" || /pdf/i.test(file.type)) {
      try {
        parsed = parseInvoiceText(await extractPdfText(file), file, "PDF");
      } catch (error) {
        parsed = { header: { invoice_type: "purchase", currency: "TRY", source_file_name: file.name }, lines: [], warnings: [
          "PDF otomatik okuma başarısız: " + (error?.message || "metin çıkarılamadı") + ". Belge taranmışsa görsel OCR veya XML/Excel yükleme kullanın; manuel giriş açık kalır."
        ] };
      }
    }
    else if (["jpg", "jpeg", "png"].includes(ext) || /image/i.test(file.type)) {
      try {
        parsed = parseInvoiceText(await extractImageText(file), file, "Görsel OCR");
      } catch (error) {
        parsed = { header: { invoice_type: "purchase", currency: "TRY", source_file_name: file.name }, lines: [], warnings: [
          "Görsel OCR başarısız: " + (error?.message || "metin çıkarılamadı") + ". Manuel kontrol alanı açık bırakıldı; XML/e-Fatura veya Excel yüklerseniz satırlar otomatik okunur."
        ] };
      }
    }
    else throw new Error("Desteklenmeyen fatura dosyası türü.");
    setProgress("Cari ve ürün eşleştiriliyor...", 70);
    parsed.header.currency = currency(parsed.header.currency, "TRY"); matchCustomer(parsed.header);
    parsed.lines = (parsed.lines || []).map((l) => { const c = lineCalc(l); matchProduct(c); return c; });
    state.invoiceImport = { file, header: parsed.header, lines: parsed.lines, warnings: parsed.warnings || [], parsed: true, savedImportId: null };
    renderPreview(); setProgress("Ön izleme hazır.", 100, true);
    setImportStatus(`${parsed.lines.length} satır okundu. Eşleşen: ${parsed.lines.filter((l) => l.matched_product_id).length}, tanımsız: ${parsed.lines.filter((l) => !l.matched_product_id).length}.`);
    q("#invoiceApplyImportButton")?.removeAttribute("disabled"); q("#invoiceClearImportButton")?.removeAttribute("disabled");
  };
  const saveDraft = async () => {
    if (!client || !importState().parsed) return null;
    const h = importState().header || {};
    try {
      const [draft] = await query(client.from("invoice_imports").insert({
        file_name: importState().file?.name || h.source_file_name || null,
        file_type: importState().file?.type || null,
        invoice_type: h.invoice_type || "purchase",
        invoice_no: h.invoice_no || h.document_number || null,
        invoice_date: h.invoice_date || null,
        due_date: h.due_date || null,
        customer_id: h.customer_id || null,
        raw_customer_name: h.raw_customer_name || null,
        raw_tax_number: h.raw_tax_number || null,
        currency: h.currency || "TRY",
        subtotal: Number(h.subtotal || 0),
        total_discount: Number(h.total_discount || 0),
        tax_total: Number(h.tax_total || 0),
        grand_total: Number(h.grand_total || 0),
        payable_total: Number(h.payable_total || h.grand_total || 0),
        parsing_status: "previewed",
        raw_payload: h,
        warnings: importState().warnings || []
      }).select("id"));
      const id = draft?.id;
      if (id && importState().lines.length) await query(client.from("invoice_import_lines").insert(importState().lines.map((l) => ({
        invoice_import_id: id, row_no: l.row_index, raw_product_name: l.raw_product_name, raw_barcode: l.raw_barcode,
        raw_product_code: l.raw_product_code, matched_product_id: l.matched_product_id || null, match_type: l.match_type,
        match_confidence: l.match_confidence, quantity: l.quantity, unit: l.unit, unit_price: l.unit_price,
        discount_rate: l.discount_rate, discount_amount: l.discount_amount, vat_rate: l.vat_rate, vat_amount: l.vat_amount,
        line_subtotal: l.line_subtotal, line_total: l.line_total, lot_number: l.lot_number || null,
        expiry_date: l.expiry_date || null, matching_status: l.matching_status, manual_entry: l.manual_entry,
        stock_processed: false, raw_payload: l.raw_payload || {}
      }))));
      importState().savedImportId = id || null; return id;
    } catch (err) {
      console.warn("Invoice import draft could not be stored. Run supabase/invoice-import.sql if persistence is needed.", err);
      return null;
    }
  };
  const applyImport = async () => {
    readPreview(); const s = importState(); const h = s.header || {};
    const matched = (s.lines || []).filter((l) => l.matched_product_id);
    if (!matched.length) { setImportStatus("Aktarım için en az bir satırı sistem ürünüyle eşleştirin. Tanımsız satırlar ön izlemede korunuyor.", true); return; }
    await saveDraft();
    setInvoiceMode(h.invoice_type === "sale" ? "sale" : "purchase");
    const form = q("#invoiceForm");
    setFormFieldValue(form, "customer_id", h.customer_id || "");
    setFormFieldValue(form, "invoice_date", h.invoice_date || today());
    setFormFieldValue(form, "due_date", h.due_date || "");
    setFormFieldValue(form, "document_number", h.invoice_no || h.document_number || "");
    setFormFieldValue(form, "scenario", "domestic");
    setFormFieldValue(form, "currency", h.currency || "TRY");
    const unmatched = (s.lines || []).filter((l) => !l.matched_product_id);
    const tt = totals();
    const notes = [h.notes, s.file ? `Yüklenen belge: ${s.file.name}` : "", unmatched.length ? `Tanımsız ürün satırları: ${unmatched.map((l) => `${l.row_index}. ${l.raw_product_name || l.raw_barcode || "Satır"} (${money(l.line_total, h.currency || "TRY")})`).join("; ")}` : "", Math.abs(tt.diff) > 0.01 ? `Hesap farkı: ${money(tt.diff, h.currency || "TRY")}` : ""].filter(Boolean).join("\n");
    setFormFieldValue(form, "notes", notes);
    state.invoiceLines = matched.map((l) => {
      const p = state.products.find((x) => x.id === l.matched_product_id) || {};
      const selectedUnit = /koli/i.test(l.unit) ? "koli" : "adet";
      const units = Math.max(Number(p.units_per_carton || 1), 1);
      return {
        product_id: p.id, barcode: p.barcode || l.raw_barcode, product_code: p.sku || l.raw_product_code,
        description: p.name || l.raw_product_name, available_stock: Number(p.stock_quantity || 0), quantity: Number(l.quantity || 0),
        selected_unit: selectedUnit, stock_quantity: stockQuantityFor(l.quantity, selectedUnit, units), units_per_carton: units,
        current_unit_price: productUnitPrice(p, h.invoice_type || "purchase", selectedUnit), requested_unit_price: Number(l.unit_price || 0),
        unit_price: Number(l.unit_price || 0), currency: h.currency || p.currency || "TRY", discount_1: Number(l.discount_rate || 0),
        discount_2: 0, discount_3: 0, tax_rate: Number(l.vat_rate || p.vat_rate || 20)
      };
    });
    renderInvoiceLines(); q("#invoiceDialog")?.showModal(); setImportStatus("Fatura satırları manuel fatura formuna aktarıldı. Kontrol edip Kaydet'e basın.");
  };
  const clearImport = () => {
    state.invoiceImport = { file: null, header: {}, lines: [], warnings: [], parsed: false, savedImportId: null };
    const input = q("#invoiceImportFile"); if (input) input.value = "";
    const preview = q("#invoiceImportPreview"); if (preview) { preview.hidden = true; preview.innerHTML = ""; }
    setProgress("", 0, true); setImportStatus("");
    q("#invoiceApplyImportButton")?.setAttribute("disabled", "disabled"); q("#invoiceClearImportButton")?.setAttribute("disabled", "disabled");
  };
  q("#invoiceImportFile")?.addEventListener("change", safely(async (event) => { const file = event.currentTarget.files?.[0]; importState().file = file || null; if (file) await parseFile(file); }));
  q("#invoiceScanButton")?.addEventListener("click", safely(async () => parseFile(importState().file || q("#invoiceImportFile")?.files?.[0])));
  q("#invoiceRescanButton")?.addEventListener("click", safely(async () => parseFile(importState().file || q("#invoiceImportFile")?.files?.[0])));
  q("#invoiceApplyImportButton")?.addEventListener("click", safely(applyImport));
  q("#invoiceManualEntryButton")?.addEventListener("click", () => setInvoiceMode("purchase"));
  q("#invoiceClearImportButton")?.addEventListener("click", clearImport);
  q("#invoiceImportPreview")?.addEventListener("change", (event) => {
    if (event.target.matches("[data-import-header], [data-import-line-product], [data-import-line-field]")) { readPreview(); renderPreview(); }
  });
})();
