(function (root, factory) {
  var value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  root.SIDYA_RFQ_CURRENCIES = value;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var currencies = [
    ["TRY", "Turkish Lira", "₺", 2, true, 10],
    ["USD", "US Dollar", "$", 2, true, 20],
    ["EUR", "Euro", "€", 2, true, 30],
    ["GEL", "Georgian Lari", "₾", 2, true, 40],
    ["RUB", "Russian Ruble", "₽", 2, true, 50],
    ["AZN", "Azerbaijani Manat", "₼", 2, true, 60],
    ["GBP", "British Pound", "£", 2, true, 70],
    ["CNY", "Chinese Yuan", "¥", 2, true, 80],
    ["AED", "UAE Dirham", "د.إ", 2, true, 90],
    ["SAR", "Saudi Riyal", "﷼", 2, true, 100],
    ["QAR", "Qatari Riyal", "ر.ق", 2, true, 110],
    ["KWD", "Kuwaiti Dinar", "د.ك", 3, true, 120],
    ["IQD", "Iraqi Dinar", "ع.د", 0, true, 130],
    ["KZT", "Kazakhstani Tenge", "₸", 2, true, 140],
    ["UAH", "Ukrainian Hryvnia", "₴", 2, true, 150],
    ["MDL", "Moldovan Leu", "L", 2, true, 160],
    ["AMD", "Armenian Dram", "֏", 2, true, 170],
    ["IRR", "Iranian Rial", "﷼", 0, true, 180]
  ].map(function (row) {
    return {
      currency_code: row[0],
      code: row[0],
      currency_name: row[1],
      name: row[1],
      currency_symbol: row[2],
      symbol: row[2],
      decimal_places: row[3],
      active: row[4],
      display_order: row[5]
    };
  });
  var byCode = currencies.reduce(function (acc, item) {
    acc[item.code] = item;
    return acc;
  }, {});
  function normalizeCurrency(value, fallback) {
    var code = String(value || fallback || "USD").trim().toUpperCase();
    if (code === "TL" || code === "TRL" || code === "₺") code = "TRY";
    return byCode[code] ? code : String(fallback || "USD").toUpperCase();
  }
  function activeCurrencies() {
    return currencies.filter(function (item) { return item.active; }).sort(function (a, b) { return a.display_order - b.display_order; });
  }
  return { currencies: currencies, byCode: byCode, normalizeCurrency: normalizeCurrency, activeCurrencies: activeCurrencies };
});
