export function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 640 420"
      className="mx-auto h-auto w-full max-w-2xl"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hi-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f6fed" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#2f6fed" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hi-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0ecb81" />
          <stop offset="100%" stopColor="#2f6fed" />
        </linearGradient>
        <filter id="hi-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="40" />
        </filter>
      </defs>

      <circle cx="140" cy="120" r="120" fill="#2f6fed" opacity="0.18" filter="url(#hi-blur)" />
      <circle cx="520" cy="300" r="130" fill="#0ecb81" opacity="0.14" filter="url(#hi-blur)" />

      <rect x="40" y="40" width="560" height="340" rx="18" fill="#1a2234" stroke="#2a3448" />

      <circle cx="70" cy="68" r="5" fill="#2a3448" />
      <circle cx="90" cy="68" r="5" fill="#2a3448" />
      <circle cx="110" cy="68" r="5" fill="#2a3448" />
      <rect x="480" y="58" width="90" height="20" rx="10" fill="#0ecb81" opacity="0.12" />
      <rect x="490" y="64" width="70" height="8" rx="4" fill="#0ecb81" opacity="0.5" />

      <line x1="64" y1="100" x2="616" y2="100" stroke="#2a3448" strokeWidth="1" />
      <line x1="64" y1="180" x2="616" y2="180" stroke="#2a3448" strokeWidth="1" />
      <line x1="64" y1="260" x2="616" y2="260" stroke="#2a3448" strokeWidth="1" />
      <line x1="64" y1="340" x2="616" y2="340" stroke="#2a3448" strokeWidth="1" />

      <path
        d="M80 300 L150 270 L210 290 L270 220 L330 240 L390 170 L450 190 L510 120 L570 140"
        fill="none"
        stroke="url(#hi-line)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M80 300 L150 270 L210 290 L270 220 L330 240 L390 170 L450 190 L510 120 L570 140 L570 340 L80 340 Z"
        fill="url(#hi-area)"
      />

      <circle cx="570" cy="140" r="7" fill="#0ecb81" />
      <circle cx="570" cy="140" r="12" fill="none" stroke="#0ecb81" strokeWidth="2" opacity="0.5" />

      <g transform="translate(80,300)">
        <rect width="34" height="34" rx="17" fill="#2f6fed" opacity="0.9" />
        <rect x="18" y="18" width="34" height="34" rx="17" fill="#0ecb81" opacity="0.9" />
        <rect x="36" y="6" width="34" height="34" rx="17" fill="#1a2234" stroke="#2a3448" strokeWidth="2" />
      </g>

      <g transform="translate(64,360)">
        <rect x="0" y="10" width="10" height="20" rx="2" fill="#2a3448" />
        <rect x="16" y="0" width="10" height="30" rx="2" fill="#0ecb81" />
        <rect x="32" y="14" width="10" height="16" rx="2" fill="#2a3448" />
        <rect x="48" y="4" width="10" height="26" rx="2" fill="#2f6fed" />
      </g>
    </svg>
  );
}
