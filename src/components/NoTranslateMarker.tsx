"use client";

import { useEffect } from "react";

// Browser translators (Chrome) must leave names, asset symbols, prices and figures alone. Most are
// marked in the markup (translate="no"); figures are rendered in many small elements, so every
// element that carries tabular figures, or data-nt, is marked here and again when the page changes.
const SELECTOR = ".tabular-nums:not([translate]), [data-nt]:not([translate])";

// Asset symbols (BTC, XAUUSD, EUR/USD, ETH/USDT) and plain figures ("+12.4%", "$1,250.00") are
// recognised by their text, wherever the page happens to render them.
const TICKER = /^[A-Z0-9]{2,10}(?:[/-][A-Z0-9]{2,10})?$/;
const FIGURE = /^[+\-−–]?[$€£]?\s?[\d.,\s]+\s?(?:%|USDT|USD|x)?$/;

function mark(root: Document) {
  root.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => el.setAttribute("translate", "no"));
  const walker = root.createTreeWalker(root.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue?.trim();
    const el = node.parentElement;
    if (!text || !el || text.length > 24 || el.hasAttribute("translate")) continue;
    if (TICKER.test(text) || (/\d/.test(text) && FIGURE.test(text))) el.setAttribute("translate", "no");
  }
}

export function NoTranslateMarker() {
  useEffect(() => {
    mark(document);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => mark(document), 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);
  return null;
}
