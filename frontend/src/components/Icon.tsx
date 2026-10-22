// Inline SVG icons (24x24, stroke = currentColor). Decorative only: always pair with a text label.
// Used instead of emoji, which render differently across Android versions and read oddly in TalkBack.

const PATHS = {
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14",
  camera: "M4 8h3l2-3h6l2 3h3v11H4V8Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  clipboard: "M9 4h6v3H9V4Zm-3 1h3m6 0h3v16H6V5Zm3 7h6m-6 4h4",
  wheelchair:
    "M11 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm-1 2v6h6l2 5M10 9h5M8 10.5a5.5 5.5 0 1 0 7.5 7",
  walk: "M13 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm-3 17 2-6 2 2v4m-4-14 3-1 2 4 3 1M9 8l-2 5m4-6-1 7",
  clinic: "M4 21V7l8-4 8 4v14H4Zm8-11v6m-3-3h6",
  mosque: "M4 21v-8h16v8H4Zm2-8a6 6 0 0 1 12 0M12 3v4m-6 14v-4h3v4m6 0v-4h3v4",
  bus: "M5 17V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11H5Zm0-6h14M8 20v-3m8 3v-3M8 14h.01M16 14h.01",
  pin: "M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  locate: "M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-4a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0-13v3m0 14v3M2 12h3m14 0h3",
  check: "m5 12 5 5 9-10",
  alert: "M12 4 2 20h20L12 4Zm0 6v4m0 3h.01",
  image: "M4 5h16v14H4V5Zm0 11 4-4 4 4 3-3 5 5M15 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  wrench: "M14 6a4 4 0 0 0 5 5l-9 9a2 2 0 0 1-3-3l9-9a4 4 0 0 1-2-2Z",
  chevronUp: "m6 15 6-6 6 6",
  chevronDown: "m6 9 6 6 6-6",
  chevronRight: "m9 6 6 6-6 6",
  layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
  route: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7",
  x: "M6 6l12 12M18 6 6 18",
  question: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.5-11.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14m0 3h.01",
  copy: "M8 8h12v12H8V8Zm-4 8V4h12",
  refresh: "M20 11a8 8 0 0 0-14.9-3M4 4v4h4m-4 5a8 8 0 0 0 14.9 3M20 20v-4h-4",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9h.01",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  logout: "M10 4H5v16h5m4-12 4 4-4 4m4-4H9",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2",
  stroller: "M4 4h2l2 8h10a6 6 0 0 0-6-6V4m-6 8a6 6 0 0 0 6 4h6M9 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  elderly: "M11 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm-1 3-2 6h3l-1 8m1-14 3 4 2 1m1-1v12",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z",
  arrowLeft: "M19 12H5m6-6-6 6 6 6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 5 5",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm0 16a2 2 0 0 1 2-2h13v2H6",
  cup: "M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V8Zm11 1h2a2 2 0 0 1 0 4h-2M8 3v2m3-2v2",
  home: "M4 11 12 4l8 7v9H4v-9Zm6 9v-5h4v5",
  flag: "M5 21V4m0 0h11l-2 4 2 4H5",
  building: "M5 21V4h10v17M15 9h4v12M8 8h4m-4 4h4m-4 4h4M3 21h18",
  turnLeft: "M9 5 4 10l5 5M4 10h9a6 6 0 0 1 6 6v4",
  turnRight: "m15 5 5 5-5 5m5-5h-9a6 6 0 0 0-6 6v4",
  slightLeft: "M7 4v6h6M7 10l9 9",
  slightRight: "M17 4v6h-6m6 0-9 9",
  uturn: "M8 20V9a5 5 0 0 1 10 0v4m-4-3 4 4 4-4",
  straight: "M12 20V4m-6 6 6-6 6 6",
  volume: "M4 9h4l5-4v14l-5-4H4V9Zm12 0a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12",
  mute: "M4 9h4l5-4v14l-5-4H4V9Zm12 1 5 5m0-5-5 5",
  download: "M12 4v11m-5-5 5 5 5-5M5 20h14",
  sparkle:"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 12 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z",
  shield:"M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Zm-3 9 2 2 4-4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ? `icon ${className}` : "icon"}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** BeeAble mark: bee with a wheelchair badge over a globe and dashed route (public/logo.png). */
export function Logo({ size = 30 }: { size?: number }) {
  // Decorative: it always sits next to the visible "BeeAble" name.
  return <img src="/logo.png" width={size} height={size} alt="" className="logo" />;
}

export const POI_ICON: Record<string, IconName> = {
  clinic: "clinic",
  mosque_surau: "mosque",
  bus_stop: "bus",
  library: "book",
  food: "cup",
  residence: "home",
  sport: "flag",
  building: "building",
};
export const NEED_ICON = {
  wheelchair: "wheelchair",
  stroller: "stroller",
  elderly: "elderly",
} as const satisfies Record<string, IconName>;
export const PROFILE_ICON ={ step_free: "wheelchair", easy_walking: "walk" } as const satisfies Record<string, IconName>;
