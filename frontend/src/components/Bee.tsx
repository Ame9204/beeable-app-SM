// BeeAble's bee, drawn top-down (head up). One SVG string so Leaflet markers (which need HTML) and
// React (the map key, route alerts) show the exact same bee. Decorative: always paired with text.
const INK = "#0d0a05";
const YELLOW = "#ffc414";

export const BEE_SVG = `<svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true" focusable="false">
  <ellipse cx="12.5" cy="17" rx="7" ry="9.5" transform="rotate(-28 12.5 17)" fill="#ffffff" fill-opacity="0.95" stroke="${INK}" stroke-width="2"/>
  <ellipse cx="27.5" cy="17" rx="7" ry="9.5" transform="rotate(28 27.5 17)" fill="#ffffff" fill-opacity="0.95" stroke="${INK}" stroke-width="2"/>
  <path d="M18 33.5 20 38l2-4.5Z" fill="${INK}"/>
  <ellipse cx="20" cy="24" rx="8.5" ry="11" fill="${YELLOW}" stroke="${INK}" stroke-width="2.5"/>
  <path d="M12.2 21.5h15.6M11.6 27h16.8" stroke="${INK}" stroke-width="3.2"/>
  <circle cx="20" cy="11.5" r="5" fill="${INK}"/>
  <path d="M18 7.5c-1-2.5-3-3.8-5-3.8M22 7.5c1-2.5 3-3.8 5-3.8" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

/** The bee as a React element (same drawing as the map marker). */
export function Bee({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      className={className ? `bee ${className}` : "bee"}
      style={{ width: size, height: size }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: BEE_SVG }}
    />
  );
}
