export function RouteLegend() {
  return (
    <ul className="legend" aria-label="Map legend">
      <li>
        <svg width="36" height="10" aria-hidden="true">
          <line x1="0" y1="5" x2="36" y2="5" stroke="#1d4ed8" strokeWidth="6" />
        </svg>
        BeeAble route (surveyed)
      </li>
      <li>
        <svg width="36" height="10" aria-hidden="true">
          <line x1="0" y1="5" x2="36" y2="5" stroke="#1d4ed8" strokeWidth="6" strokeDasharray="8 6" />
        </svg>
        BeeAble route (not surveyed — unknown)
      </li>
      <li>
        <svg width="36" height="10" aria-hidden="true">
          <line x1="0" y1="5" x2="36" y2="5" stroke="#6b7280" strokeWidth="4" strokeDasharray="2 6" />
        </svg>
        Shortest route
      </li>
    </ul>
  );
}
