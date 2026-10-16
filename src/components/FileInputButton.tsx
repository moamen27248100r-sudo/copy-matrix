"use client";

import { useId, useState } from "react";
import { Paperclip } from "lucide-react";

// A file field in the platform's style: the browser's own control is kept for the form (and its
// "required" check) but visually hidden; a button opens it, and the chosen file's name shows below.
export function FileInputButton({
  name,
  label,
  accept,
  required,
  texts,
  maxMb = 8,
  error,
}: {
  name: string;
  label: string;
  accept?: string;
  required?: boolean;
  texts: { choose: string; change: string; none: string; tooLarge?: string };
  /** Largest file in MB (checked here and again on the server). */
  maxMb?: number;
  error?: string | null;
}) {
  const id = useId();
  const [fileName, setFileName] = useState<string | null>(null);
  const [tooLarge, setTooLarge] = useState(false);
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span>{label}</span>
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        required={required}
        aria-label={label}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && f.size > maxMb * 1024 * 1024) {
            e.target.value = "";
            setFileName(null);
            setTooLarge(true);
            return;
          }
          setTooLarge(false);
          setFileName(f?.name ?? null);
        }}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className="tap-44 inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 font-medium text-foreground transition hover:border-accent/60 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60"
      >
        <Paperclip className="h-4 w-4 text-accent-text" aria-hidden="true" />
        {fileName ? texts.change : texts.choose}
      </label>
      <span className={`break-all text-xs ${fileName ? "text-foreground" : "text-muted"}`} aria-live="polite">
        {fileName ? <bdi>{fileName}</bdi> : texts.none}
      </span>
      {(tooLarge || error) && (
        <p role="alert" className="text-xs text-danger">
          {tooLarge ? texts.tooLarge : error}
        </p>
      )}
    </div>
  );
}
