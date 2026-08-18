/** Inline SVG flags for language toggle (not emoji). */

export function FlagUk({ className = 'h-4 w-6', title = 'English' }) {
  return (
    <svg
      viewBox="0 0 60 40"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#C8102E" strokeWidth="5" />
      <path d="M30 0 V40 M0 20 H60" stroke="#fff" strokeWidth="13" />
      <path d="M30 0 V40 M0 20 H60" stroke="#C8102E" strokeWidth="7" />
    </svg>
  );
}

/** Malawi national flag used for Chichewa locale. */
export function FlagMalawi({ className = 'h-4 w-6', title = 'Chichewa' }) {
  return (
    <svg
      viewBox="0 0 60 40"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <rect width="60" height="40" fill="#000" />
      <rect y="13.33" width="60" height="13.34" fill="#CE1126" />
      <rect y="26.67" width="60" height="13.33" fill="#339E35" />
      <g fill="#CE1126" transform="translate(30 8)">
        <circle r="3.2" />
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <rect
            key={deg}
            x="-0.55"
            y="-7.2"
            width="1.1"
            height="4.2"
            transform={`rotate(${deg})`}
          />
        ))}
      </g>
    </svg>
  );
}
