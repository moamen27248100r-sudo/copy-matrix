"use client";

import { useEffect, useRef, type FormHTMLAttributes } from "react";

// A <form> that remembers what was typed in this browser tab, so the Back button, a failed
// submit or an accidental reload does not lose it. Never stored: passwords, one-time codes, files
// and anything whose name suggests an identity-document or account number.
const NEVER_STORED = /pass|otp|pin|code|token|secret|file|document|doc_|number|iban|iban|card|cvv|ssn/i;

export function DraftForm({ draftKey, children, ...rest }: { draftKey: string } & FormHTMLAttributes<HTMLFormElement>) {
  const ref = useRef<HTMLFormElement>(null);
  const storageKey = `cm.draft.${draftKey}`;

  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    const storable = (el: Element): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return false;
      if (!el.name || el.name.startsWith("$") || el.type === "hidden" || el.type === "password" || el.type === "file") return false;
      return !NEVER_STORED.test(el.name) && !NEVER_STORED.test(el.autocomplete ?? "");
    };

    let saved: Record<string, string | string[]> = {};
    try {
      saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "{}") ?? {};
    } catch {
      saved = {};
    }
    // Restore (only into fields the browser left empty / unchanged).
    for (const el of Array.from(form.elements)) {
      if (!storable(el) || !(el.name in saved)) continue;
      const v = saved[el.name];
      if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) {
        const values = Array.isArray(v) ? v : [v];
        el.checked = values.includes(el.value);
      } else if (typeof v === "string") {
        el.value = v;
      }
    }

    const save = () => {
      const out: Record<string, string | string[]> = {};
      for (const el of Array.from(form.elements)) {
        if (!storable(el)) continue;
        if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) {
          if (el.checked) out[el.name] = el.type === "checkbox" ? [...((out[el.name] as string[]) ?? []), el.value] : el.value;
        } else {
          out[el.name] = el.value;
        }
      }
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(out));
      } catch {
        // storage unavailable: the form still works, it just is not remembered
      }
    };
    form.addEventListener("input", save);
    form.addEventListener("change", save);
    return () => {
      form.removeEventListener("input", save);
      form.removeEventListener("change", save);
    };
  }, [storageKey]);

  return (
    <form ref={ref} {...rest}>
      {children}
    </form>
  );
}
