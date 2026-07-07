export function Ship({ className = '', thrusting = false }: { className?: string; thrusting?: boolean }) {
  return (
    <div className={`animate-drift motion-reduce:animate-none ${className}`}>
      <svg width="120" height="48" viewBox="0 0 120 48" fill="none" aria-hidden="true">
        <defs>
          <radialGradient id="engine-glow" cx="0.3" cy="0.5" r="0.7">
            <stop offset="0%" stopColor="#f5ce82" stopOpacity={thrusting ? 0.95 : 0.55} />
            <stop offset="55%" stopColor="#e8b45a" stopOpacity={thrusting ? 0.5 : 0.22} />
            <stop offset="100%" stopColor="#e8b45a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c4cadb" />
            <stop offset="55%" stopColor="#9aa2ba" />
            <stop offset="100%" stopColor="#6f778f" />
          </linearGradient>
        </defs>
        {/* engine glow */}
        <ellipse cx={thrusting ? 16 : 20} cy="24" rx={thrusting ? 18 : 12} ry={thrusting ? 7 : 5} fill="url(#engine-glow)" />
        {/* hull: elongated teardrop pointing right */}
        <path
          d="M28 24c0-6 10-11 26-11 22 0 40 5.5 52 11-12 5.5-30 11-52 11-16 0-26-5-26-11z"
          fill="url(#hull)"
        />
        {/* dorsal fin */}
        <path d="M48 13.5c2-4.5 6-7.5 10-8.5-1 3-1.5 6-1.5 8.8-3-.2-5.8-.3-8.5-.3z" fill="#7d859e" />
        {/* ventral fin */}
        <path d="M48 34.5c2 4.5 6 7.5 10 8.5-1-3-1.5-6-1.5-8.8-3 .2-5.8 .3-8.5 .3z" fill="#666e86" />
        {/* canopy line */}
        <path d="M78 20.5c6 .8 11.5 2 16 3.5-4.5 1.5-10 2.7-16 3.5 1.2-2.3 1.2-4.7 0-7z" fill="#e9ebf4" opacity="0.85" />
        {/* engine nozzle */}
        <rect x="24" y="20" width="6" height="8" rx="2" fill="#565e76" />
      </svg>
    </div>
  );
}
