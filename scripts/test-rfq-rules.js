const assert = require("assert");
const currencies = require("../rfq-currencies.js");

function parsePositiveInt(value) {
  if (!/^\d+$/.test(String(value))) throw new Error("integer");
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error("positive");
  return number;
}

function parseTargetPrice(value) {
  const text = String(value).replace(",", ".");
  if (!/^\d+(?:\.\d{1,4})?$/.test(text)) throw new Error("price");
  const number = Number(text);
  if (number <= 0) throw new Error("positive price");
  return number;
}

function line(cartons, price, currency) {
  const requestedCartons = parsePositiveInt(cartons);
  const targetUnitPrice = parseTargetPrice(price);
  const currencyCode = currencies.normalizeCurrency(currency, "");
  if (!currencies.byCode[currencyCode]) throw new Error("currency");
  return { requestedCartons, targetUnitPrice, currencyCode, total: Number((requestedCartons * targetUnitPrice).toFixed(4)) };
}

function totals(lines) {
  return lines.reduce((map, item) => {
    map[item.currencyCode] = Number(((map[item.currencyCode] || 0) + item.total).toFixed(4));
    return map;
  }, {});
}

const one = line(100, "2.5", "USD");
assert.strictEqual(one.total, 250);
assert.deepStrictEqual(totals([line(10, 1, "USD"), line(20, 2, "USD")]), { USD: 50 });
assert.deepStrictEqual(totals([line(10, 1, "USD"), line(20, 2, "EUR"), line(5, 3, "GEL")]), { USD: 10, EUR: 40, GEL: 15 });
assert.throws(() => line(0, 1, "USD"));
assert.throws(() => line(-1, 1, "USD"));
assert.throws(() => line("1.5", 1, "USD"));
assert.throws(() => line(1, 0, "USD"));
assert.throws(() => line(1, "1.12345", "USD"));
assert.throws(() => line(1, 1, ""));
assert.strictEqual(currencies.normalizeCurrency("usd"), "USD");
assert.strictEqual(currencies.normalizeCurrency("tr-TRY", "TRY"), "TRY");
["TRY", "USD", "EUR", "GEL", "RUB", "AZN", "GBP", "CNY", "AED", "SAR", "QAR", "KWD", "IQD", "KZT", "UAH", "MDL", "AMD", "IRR"].forEach((code) => assert(currencies.byCode[code], `${code} missing`));
assert.strictEqual(totals([line(500, "3,20", "USD")]).USD, 1600);
assert.strictEqual(totals([line(1, "0.0001", "KWD")]).KWD, 0.0001);
assert.strictEqual(currencies.activeCurrencies().length >= 18, true);
assert.notStrictEqual(totals([line(1, 1, "USD"), line(1, 1, "TRY")]).USD, totals([line(1, 1, "USD"), line(1, 1, "TRY")]).TRY + totals([line(1, 1, "USD"), line(1, 1, "TRY")]).USD);

console.log("RFQ rule tests passed");
