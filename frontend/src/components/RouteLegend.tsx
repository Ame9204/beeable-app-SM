import { useT } from "../i18n";
import { ALT_COLOR, ROUTE_COLOR, SHORTEST_COLOR } from "./MapView";
import { Bee } from "./Bee";
import { Icon } from "./Icon";

export function RouteLegend() {
  const { t } = useT();
  return (
    <ul className="legend" aria-label={t("legend.aria")}>
      <li>
        <Bee size={28} className="legend-icon" />
        {t("map.youAreHere")}
      </li>
      <li>
        <svg width="36" height="12" aria-hidden="true">
          <line x1="2" y1="6" x2="34" y2="6" stroke="#fff" strokeWidth="11" strokeLinecap="round" />
          <line x1="2" y1="6" x2="34" y2="6" stroke={ROUTE_COLOR} strokeWidth="6" strokeLinecap="round" />
        </svg>
        {t("legend.surveyed")}
      </li>
      <li>
        <svg width="36" height="12" aria-hidden="true">
          <line x1="2" y1="6" x2="34" y2="6" stroke={ROUTE_COLOR} strokeWidth="6" strokeDasharray="8 6" />
        </svg>
        {t("legend.unsurveyed")}
      </li>
      <li>
        <svg width="36" height="12" aria-hidden="true">
          <line x1="2" y1="6" x2="34" y2="6" stroke={ALT_COLOR} strokeWidth="5" strokeDasharray="10 4 2 4" strokeLinecap="round" />
        </svg>
        {t("legend.alternative")}
      </li>
      <li>
        <svg width="36" height="12" aria-hidden="true">
          <line x1="2" y1="6" x2="34" y2="6" stroke={SHORTEST_COLOR} strokeWidth="4" strokeDasharray="2 6" strokeLinecap="round" />
        </svg>
        {t("legend.shortest")}
      </li>
      <li>
        <span className="barrier-icon legend-icon" aria-hidden="true">
          <span className="barrier-badge">
            <Icon name="alert" size={14} />
          </span>
        </span>
        {t("legend.obstacle")}
      </li>
      <li>
        <span className="report-icon report-unverified legend-icon" aria-hidden="true">
          <Icon name="question" size={16} />
        </span>
        {t("legend.unverified")}
      </li>
      <li>
        <span className="report-icon report-verified legend-icon" aria-hidden="true">
          <Icon name="alert" size={14} />
        </span>
        {t("legend.confirmed")}
      </li>
      <li>
        <span className="report-icon report-in_progress legend-icon" aria-hidden="true">
          <Icon name="wrench" size={14} />
        </span>
        {t("legend.fixing")}
      </li>
    </ul>
  );
}
