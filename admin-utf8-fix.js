(() => {
  if (window.__sidyaUtf8Fix) return;
  window.__sidyaUtf8Fix = true;

  const mojibakePattern = /Ã|Ä|Å|Â|â|Æ|¢|€|�/;
  const cp1252Reverse = {
    "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87,
    "ˆ": 0x88, "‰": 0x89, "Š": 0x8A, "‹": 0x8B, "Œ": 0x8C, "Ž": 0x8E,
    "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
    "˜": 0x98, "™": 0x99, "š": 0x9A, "›": 0x9B, "œ": 0x9C, "ž": 0x9E, "Ÿ": 0x9F,
  };
  const directMap = new Map([
    ["Ã§", "ç"], ["Ã‡", "Ç"], ["Ã¼", "ü"], ["Ãœ", "Ü"], ["Ã¶", "ö"], ["Ã–", "Ö"],
    ["ÄŸ", "ğ"], ["Äž", "Ğ"], ["Ä±", "ı"], ["Ä°", "İ"], ["ÅŸ", "ş"], ["Åž", "Ş"],
    ["â€™", "'"], ["â€˜", "'"], ["â€œ", '"'], ["â€�", '"'], ["â€“", "-"], ["â€”", "-"],
    ["â†", "←"], ["Ã—", "×"], ["Â·", "·"], ["Â", ""],
  ]);

  function hasMojibake(value) {
    return mojibakePattern.test(String(value ?? ""));
  }

  function score(value) {
    return (String(value ?? "").match(/Ã|Ä|Å|Â|â|Æ|¢|€|�/g) || []).length;
  }

  function decodeOnce(value) {
    const text = String(value ?? "");
    if (!hasMojibake(text) || typeof TextDecoder === "undefined") return text;
    const bytes = [];
    for (const char of text) {
      const code = char.charCodeAt(0);
      if (code <= 0xff) bytes.push(code);
      else if (cp1252Reverse[char] !== undefined) bytes.push(cp1252Reverse[char]);
      else return text;
    }
    try {
      return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
    } catch {
      return text;
    }
  }

  function repair(value) {
    let text = String(value ?? "");
    if (!hasMojibake(text)) return text;
    for (let i = 0; i < 8; i += 1) {
      const next = decodeOnce(text);
      if (next === text || score(next) > score(text)) break;
      text = next;
      if (!hasMojibake(text)) break;
    }
    directMap.forEach((good, bad) => { text = text.split(bad).join(good); });
    return text;
  }

  function patchSetter(proto, prop) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
    if (!descriptor || !descriptor.set || !descriptor.get || descriptor.set.__sidyaUtf8Patched) return;
    const originalSet = descriptor.set;
    const originalGet = descriptor.get;
    Object.defineProperty(proto, prop, {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: originalGet,
      set(value) {
        originalSet.call(this, typeof value === "string" && hasMojibake(value) ? repair(value) : value);
      },
    });
    Object.getOwnPropertyDescriptor(proto, prop).set.__sidyaUtf8Patched = true;
  }

  function repairNode(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (hasMojibake(node.nodeValue)) textNodes.push(node);
    }
    textNodes.forEach((node) => {
      const fixed = repair(node.nodeValue);
      if (fixed !== node.nodeValue) node.nodeValue = fixed;
    });
    root.querySelectorAll?.("[title],[placeholder],[aria-label],[alt]").forEach((node) => {
      ["title", "placeholder", "aria-label", "alt"].forEach((name) => {
        const value = node.getAttribute(name);
        if (value && hasMojibake(value)) node.setAttribute(name, repair(value));
      });
    });
    root.querySelectorAll?.("input,textarea,option").forEach((node) => {
      if (typeof node.value === "string" && hasMojibake(node.value) && node !== document.activeElement) node.value = repair(node.value);
      if (node.tagName === "OPTION" && hasMojibake(node.textContent)) node.textContent = repair(node.textContent);
    });
  }

  let scheduled = false;
  function scheduleRepair() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      repairNode(document.body);
    });
  }

  try {
    patchSetter(Node.prototype, "textContent");
    patchSetter(Element.prototype, "innerHTML");
    patchSetter(HTMLElement.prototype, "innerText");
    patchSetter(HTMLInputElement.prototype, "value");
    patchSetter(HTMLTextAreaElement.prototype, "value");
  } catch (error) {
    console.warn("Sidya UTF-8 guard patch warning", error);
  }

  window.SIDYA_TEXT = Object.assign({}, window.SIDYA_TEXT || {}, { repair, hasMojibake, scheduleRepair, repairNode });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleRepair, { once: true });
  else scheduleRepair();

  const observerTarget = document.documentElement || document.body;
  if (observerTarget) {
    new MutationObserver(scheduleRepair).observe(observerTarget, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["title", "placeholder", "aria-label", "alt", "value"],
    });
  }
})();
