import { ROUTE_COLOR, SHORTEST_COLOR } from "./MapView";
import { Icon } from "./Icon";

export function RouteLegend() {
  return (
    <ul className="legend" aria-label="Map legend">
      <li>
        <svg width="36" height="12" aria-hidden="true">
          <line x1="2" y1="6" x2="34" y2="6" stroke="#fff" strokeWidth="11" strokeLinecap="round" />
          <line x1="2" y1="6" x2="34" y2="6" stroke={ROUTE_COLOR} strokeWidth="6" strokeLinecap="round" />
        </svg>
        BeeAble route (surveyed)
      </li>
      <li>
        <svg width="36" height="12" aria-hidden="true">
          <line x1="2" y1="6" x2="34" y2="6" stroke={ROUTE_COLOR} strokeWidth="6" strokeDasharray="8 6" />
        </svg>
        BeeAble route (not surveyed — unknown)
      </li>
      <li>
        <svg width="36" height="12" aria-hidden="true">
          <line x1="2" y1="6" x2="34" y2="6" stroke={SHORTEST_COLOR} strokeWidth="4" strokeDasharray="2 6" strokeLinecap="round" />
        </svg>
        Shortest route
      </li>
      <li>
        <span className="barrier-icon legend-icon" aria-hidden="true">
          <Icon name="alert" size={16} />
        </span>
        Known barrier on a route (tap for details)
      </li>
      <li>
        <span className="report-icon report-unverified legend-icon" aria-hidden="true">
          <Icon name="question" size={16} />
        </span>
        Reported, not yet checked by staff
      </li>
      <li>
        <span className="report-icon report-verified legend-icon" aria-hidden="true">
          <Icon name="alert" size={14} />
        </span>
        Barrier confirmed by staff
      </li>
      <li>
        <span className="report-icon report-in_progress legend-icon" aria-hidden="true">
          <Icon name="wrench" size={14} />
        </span>
        Being fixed
      </li>
    </ul>
  );
}
