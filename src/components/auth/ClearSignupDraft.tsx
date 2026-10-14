"use client";

import { useEffect } from "react";

// The signup form keeps what was typed (never the password) in this tab so Back does not lose it.
// Once the account exists the draft is not needed any more.
export function ClearSignupDraft() {
  useEffect(() => {
    try {
      sessionStorage.removeItem("cm.signup.draft");
    } catch {
      // storage unavailable: nothing to clear
    }
  }, []);
  return null;
}
