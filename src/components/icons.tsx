import type { SVGProps } from "react";

// Icons. The logo and the sidebar glyphs use the vector paths exported from
// the Figma file; the rest are simple strokes drawn to match their weight.

type IconProps = SVGProps<SVGSVGElement>;

export function LogoMark({ size = 26, ...props }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true" {...props}>
      <path
        d="M86.212 77.049C80.1313 85.0478 71.6937 90.9367 62.0886 93.8859C52.4834 96.835 42.1949 96.6956 32.6732 93.4872C23.1514 90.2789 14.8766 84.1635 9.01483 76.0028C3.15307 67.8421 0 58.0477 0 48C0 37.9523 3.15307 28.1579 9.01483 19.9972C14.8766 11.8365 23.1514 5.72109 32.6732 2.51276C42.1949 -0.69556 52.4834 -0.834987 62.0886 2.11414C71.6937 5.06326 80.1313 10.9522 86.212 18.9511L74.7484 27.6657C70.4919 22.0666 64.5856 17.9443 57.862 15.8799C51.1384 13.8155 43.9364 13.9131 37.2712 16.1589C30.606 18.4048 24.8136 22.6856 20.7104 28.398C16.6072 34.1105 14.4 40.9666 14.4 48C14.4 55.0334 16.6072 61.8895 20.7104 67.602C24.8136 73.3144 30.606 77.5952 37.2712 79.8411C43.9364 82.0869 51.1384 82.1845 57.862 80.1201C64.5856 78.0557 70.4919 73.9334 74.7484 68.3343L86.212 77.049Z"
        fill="url(#clarion-logo-gradient)"
      />
      <circle cx="80.4802" cy="72.6916" r="7.2" fill="#4779F7" />
      <circle cx="80.4802" cy="23.3084" r="7.2" fill="#6166FA" />
      <path d="M48 48L71.04 33.6V62.4L48 48Z" fill="white" stroke="#3B82F6" strokeWidth="2.6" strokeLinejoin="round" />
      <defs>
        <linearGradient id="clarion-logo-gradient" x1="48" y1="0" x2="48" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6D5DFB" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function DashboardIcon(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true" {...props}>
      <rect x="1.5" y="1.5" width="6" height="6" rx="2" />
      <rect x="10.5" y="1.5" width="6" height="6" rx="2" />
      <rect x="1.5" y="10.5" width="6" height="6" rx="2" />
      <rect x="10.5" y="10.5" width="6" height="6" rx="2" />
    </svg>
  );
}

export function ClassesIcon(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true" {...props}>
      <rect x="0" y="0.9" width="18" height="3.4" rx="1.7" />
      <rect x="0" y="7.3" width="18" height="3.4" rx="1.7" />
      <rect x="0" y="13.7" width="12" height="3.4" rx="1.7" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M9 0L11.1637 6.83625L18 9L11.1637 11.1637L9 18L6.83625 11.1637L0 9L6.83625 6.83625L9 0Z" />
    </svg>
  );
}

export function DiscussionsIcon(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 19" fill="currentColor" aria-hidden="true" {...props}>
      <rect width="18" height="14" rx="5" />
      <path d="M4 13.2H10L4 18.2V13.2Z" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 17" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8.55945 0L10.94 5.72348L17.119 6.21885L12.4112 10.2515L13.8495 16.2812L8.55945 13.05L3.26938 16.2812L4.70767 10.2515L0 6.21885L6.17892 5.72348L8.55945 0Z" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true" {...props}>
      <circle cx="5.5" cy="5.5" r="4.7" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" {...props}>
      <path d="M2.5 6.2L4.9 8.6L9.5 3.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" {...props}>
      <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path d="M3 5.5H17M3 10H17M3 14.5H12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M10 3.5L5.5 8L10 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" {...props}>
      <rect x="2" y="5.2" width="8" height="5.8" rx="1.4" fill="currentColor" />
      <path d="M3.9 5.2V3.9a2.1 2.1 0 0 1 4.2 0v1.3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PaperclipIcon(props: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" {...props}>
      <path
        d="M11.6 6.6L7 11.2a3 3 0 0 1-4.2-4.2l4.8-4.8a2 2 0 0 1 2.8 2.8L5.6 9.8a1 1 0 0 1-1.4-1.4L8.4 4.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M6.8 9.2a2.8 2.8 0 0 0 4 0l2-2a2.8 2.8 0 0 0-4-4l-.7.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9.2 6.8a2.8 2.8 0 0 0-4 0l-2 2a2.8 2.8 0 0 0 4 4l.7-.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M4 1.8h5l3.2 3.2v8.2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2.8a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 1.8V5h3.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" {...props}>
      <path d="M7 9.5V2.5M4 5.2L7 2.2L10 5.2M2.5 11.8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Reward icons: 2x2 pixel grids, deliberately sharp like the badges. */
export function RewardGlyph({ kind }: { kind: "game" | "pass" | "theme" }) {
  const cells: Record<typeof kind, string> = { game: "xxxx", pass: "x.xx", theme: "xx.x" };
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      {cells[kind].split("").map((c, i) => (
        <rect
          key={i}
          x={(i % 2) * 8}
          y={Math.floor(i / 2) * 8}
          width="6"
          height="6"
          fill="currentColor"
          opacity={c === "x" ? 1 : 0.35}
        />
      ))}
    </svg>
  );
}
