export function Hanko({
  size = 64,
  label = "食",
}: {
  size?: number;
  label?: string;
}) {
  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className="absolute inset-0"
      >
        <rect x="2" y="2" width="60" height="60" rx="3" fill="var(--seal)" />
        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="3"
          fill="none"
          stroke="var(--seal)"
          strokeWidth="1.2"
          opacity="0.6"
        />
        <rect
          x="6"
          y="10"
          width="1.5"
          height="3"
          fill="var(--seal)"
          opacity="0.4"
        />
        <rect
          x="55"
          y="40"
          width="2"
          height="2"
          fill="var(--seal)"
          opacity="0.5"
        />
        <rect
          x="20"
          y="56"
          width="3"
          height="1"
          fill="var(--seal)"
          opacity="0.3"
        />
      </svg>
      <span
        className="relative font-display"
        style={{
          color: "var(--bg)",
          fontSize: size * 0.55,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}
