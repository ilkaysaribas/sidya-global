import json
import re
import sys
from pathlib import Path

import pandas as pd


WORKBOOK = Path(sys.argv[1] if len(sys.argv) > 1 else "Barkodlu Dosya.xlsx")
CATALOG = Path(sys.argv[2] if len(sys.argv) > 2 else "catalog-products.generated.js")


def clean_text(value):
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() == "nan":
        return ""
    return re.sub(r"\s+", " ", text)


def normalize(value):
    text = clean_text(value).lower()
    text = text.translate(str.maketrans({"ı": "i", "İ": "i", "ğ": "g", "ü": "u", "ş": "s", "ö": "o", "ç": "c"}))
    return re.sub(r"[^a-z0-9]+", "", text)


def slug(value):
    text = clean_text(value).lower()
    text = text.translate(str.maketrans({"ı": "i", "İ": "i", "ğ": "g", "ü": "u", "ş": "s", "ö": "o", "ç": "c"}))
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "product"


def to_number(value):
    text = clean_text(value).replace(",", ".")
    if not text:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    if number.is_integer():
        return int(number)
    return round(number, 4)


def display_brand(value):
    brand = clean_text(value)
    fixed = {
        "NIVEA": "Nivea",
        "Johnson's": "Johnson's",
        "O.B.": "O.B.",
        "OFF!": "OFF!",
    }
    return fixed.get(brand, brand)


def category_for(brand, raw_category, name):
    text = f"{brand} {raw_category} {name}".lower()
    tr = str.maketrans({"ı": "i", "İ": "i", "ğ": "g", "ü": "u", "ş": "s", "ö": "o", "ç": "c"})
    key = text.translate(tr)

    food_terms = [
        "heinz",
        "fide",
        "lokman",
        "recel",
        "ton baligi",
        "sos",
        "ketcap",
        "mayonez",
        "bal",
        "pekmez",
        "tahin",
        "yaglar",
        "konserve",
        "gurme",
        "corba",
        "surup",
        "porsiyonluk",
        "surulebilir",
        "helva",
        "kozlenmis",
    ]
    medical_terms = [
        "analjezik",
        "antienflamatuar",
        "antiasit",
        "goz damlalari",
        "nikotin",
        "uyku",
        "pastil",
        "takviye edici",
        "visine",
        "ben-gay",
        "zarbee",
        "unisom",
    ]
    home_terms = [
        "macromax",
        "difas",
        "kompensan",
        "mutfak yardimcilari",
        "elbise askilari",
        "cop torbalari",
        "temizlik bezleri",
        "sunger",
        "paspas",
        "temizlik sistemleri",
        "temizlik setleri",
        "temizlik eldiveni",
    ]
    cleaning_terms = [
        "abc",
        "finish",
        "air wick",
        "glade",
        "mr muscle",
        "raid",
        "vanish",
        "marc",
        "lysol",
        "cillit bang",
        "calgon",
        "off!",
        "bulasik",
        "deterjan",
        "yumusatici",
        "camasir",
        "oda kokusu",
        "ev temizleyici",
        "leke",
        "hasere",
        "dezenfektan",
        "kirec",
        "lavabo",
        "cam temizleyici",
        "yuzey temizleyici",
        "arap sabunu",
    ]

    if any(term in key for term in food_terms):
        return "food-products"
    if any(term in key for term in medical_terms):
        return "medical-products"
    if any(term in key for term in home_terms):
        return "home-products"
    if any(term in key for term in cleaning_terms):
        return "cleaning-products"
    return "cosmetics-products"


def read_existing_products():
    if not CATALOG.exists():
        return []
    text = CATALOG.read_text(encoding="utf-8").strip()
    prefix = "window.SIDYA_CATALOG_PRODUCTS = "
    if text.startswith(prefix):
        text = text[len(prefix) :]
    if text.endswith(";"):
        text = text[:-1]
    return json.loads(text)


def product_name(product):
    names = product.get("names") or {}
    return names.get("tr") or names.get("en") or ""


def main():
    df = pd.read_excel(WORKBOOK, dtype=str).fillna("")
    products = []
    seen = set()

    for _, row in df.iterrows():
        name = clean_text(row.get("Ürün Adı"))
        if not name:
            continue

        brand = display_brand(row.get("Marka"))
        raw_category = clean_text(row.get("Kategori"))
        barcode = re.sub(r"\.0$", "", clean_text(row.get("Ürün Barkodu")))
        liter = clean_text(row.get("Birim / Gramaj"))
        units_per_carton = to_number(row.get("Koli İçi Adet"))
        cartons_per_pallet = to_number(row.get("Palet Katsayısı"))
        kg_per_carton = to_number(row.get("Net Koli Kg (Ambalaj Hariç)"))
        identity = f"barcode:{barcode}" if barcode else f"name:{normalize(brand + '|' + name + '|' + liter)}"
        if identity in seen:
            continue
        seen.add(identity)

        item = {
            "id": f"barcode-{barcode}" if barcode else f"barcoded-{slug(brand)}-{len(products) + 1:04d}",
            "brand": brand,
            "source": "barcode-excel",
            "category": category_for(brand, raw_category, name),
            "sourceCategory": raw_category,
            "barcode": barcode,
            "liter": liter,
            "names": {lang: name for lang in ["en", "tr", "az", "ka", "ru"]},
        }
        if units_per_carton is not None:
            item["unitsPerCarton"] = units_per_carton
        if cartons_per_pallet is not None:
            item["cartonsPerPallet"] = cartons_per_pallet
        if kg_per_carton is not None:
            item["kgPerCarton"] = kg_per_carton
        products.append(item)

    excel_brand_keys = {normalize(item["brand"]) for item in products}
    replaced_brand_keys = {
        "abc",
        "evyap",
        "nivea",
        "heinz",
        "sebamed",
        "sebamedmass",
        "reckitt",
        "pmcatalog",
    }

    for product in read_existing_products():
        brand_key = normalize(product.get("brand"))
        if brand_key in excel_brand_keys or brand_key in replaced_brand_keys:
            continue
        if brand_key == "pmcatalog":
            continue
        name = product_name(product)
        identity = f"legacy:{normalize(product.get('brand', '') + '|' + name + '|' + product.get('liter', ''))}"
        if identity in seen:
            continue
        seen.add(identity)
        product.pop("m3PerCarton", None)
        product.pop("m3PerPallet", None)
        products.append(product)

    output = "window.SIDYA_CATALOG_PRODUCTS = " + json.dumps(products, ensure_ascii=False, indent=2) + ";\n"
    CATALOG.write_text(output, encoding="utf-8")
    summary = {
        "excel_rows": int(len(df)),
        "excel_unique_products": len([product for product in products if product.get("source") == "barcode-excel"]),
        "excel_products_with_barcode": len([product for product in products if product.get("source") == "barcode-excel" and product.get("barcode")]),
        "legacy_products_kept": len([product for product in products if product.get("source") != "barcode-excel"]),
        "final_products": len(products),
        "brands": sorted({product.get("brand", "") for product in products}),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
