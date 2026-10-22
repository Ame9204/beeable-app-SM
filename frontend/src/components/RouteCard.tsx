import { useEffect, useRef } from "react";
import { WALK_SPEED_MPS } from "../config";
import { plural, useT } from "../i18n";
import { chooseRoute, type RouteChoice } from "../routeChoice";
import type { PathCost, RouteResponse } from "../types";
import { Bee } from "./Bee";
import { Icon, type IconName } from "./Icon";

const minutes = (m: number) => Math.max(1, Math.round(m / WALK_SPEED_MPS / 60));

export function RouteCard({
  route,
  choice,
  onChoose,
}: {
  /** The server's response, as it came (the card swaps in the chosen route itself). */
  route: RouteResponse;
  choice: RouteChoice;
  onChoose: (c: RouteChoice) => void;
}) {
  const { t, lang } = useT();
  const ref = useRef<HTMLElement>(null);
  // On phones the card can start below the fold of the sheet; bring each new route into view.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [route]);
  const isAlt = choice === "alternative" && !!route.alternative;
  const shown = chooseRoute(route, choice);
  const rec = shown.costs.recommended;
  const surveyed = Math.round(shown.surveyed_share * 100);

  // Never call a route "accessible" — see CLAUDE.md.
  // A playful headline, then the plain facts (the facts carry the meaning, not the joke or the colour).
  const barriers = rec.known_barriers ?? 0;
  let status: { tone: string; icon: IconName; title: string; text: string } = {
    tone: "ok",
    icon: "check",
    title: t("card.okTitle"),
    text: t("card.okText"),
  };
  if (rec.least_bad) {
    status = { tone: "danger", icon: "alert", title: t("card.leastBadTitle"), text: t("card.leastBadText", { b: rec.blocked_by ?? "" }) };
  } else if (rec.blocked_by) {
    status = { tone: "danger", icon: "alert", title: t("card.blockedTitle"), text: t("card.blockedText", { b: rec.blocked_by }) };
  } else if (barriers > 0) {
    status = { tone: "warn", icon: "alert", title: t("card.warnTitle"), text: plural(lang, isAlt ? "card.warnAlt" : "card.warn", barriers) };
  }

  return (
    <article ref={ref} className="route-card" aria-label={t(isAlt ? "card.alternativeAria" : "card.recommendedAria")}>
      {route.alternative && <RouteOptions route={route} choice={choice} onChoose={onChoose} />}

      <div className="route-head">
        <p className="route-time">
          ~{minutes(rec.length_m)} <span>{t("card.min")}</span>
        </p>
        <p className="route-dist">
          {rec.length_m} m · {t(isAlt ? "card.alternative" : "card.beeable")}
        </p>
      </div>

      <div className={`bee-alert status-${status.tone}`} role={status.tone === "danger" ? "alert" : undefined}>
        <Bee size={44} className={status.tone === "ok" ? "bee-hover" : "bee-wiggle"} />
        <p>
          <strong className="bee-alert-title">
            <Icon name={status.icon} size={18} /> {status.title}
          </strong>
          <span>{status.text}</span>
        </p>
      </div>

      {/* Shown once the team has surveyed paths on this route; hidden while nothing is surveyed yet.
          This is the only place the checked share shows: the map draws the route as one solid line. */}
      {surveyed > 0 && (
        <div className="meter-row">
          <div className="meter" aria-hidden="true">
            <span style={{ width: `${surveyed}%` }} />
          </div>
          <p className="meter-label">
            <strong>{surveyed}%</strong> {t("card.surveyed")}
          </p>
        </div>
      )}

      <Compare shortest={shown.costs.shortest} recommended={rec} />

      <details className="why" open>
        <summary>
          <Icon name="info" size={20} /> {t("card.why")}
        </summary>
        <ul>
          {shown.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}

/** The BeeAble route or the alternative: a radio pair, so it works with a screen reader and keyboard. */
function RouteOptions({ route, choice, onChoose }: { route: RouteResponse; choice: RouteChoice; onChoose: (c: RouteChoice) => void }) {
  const { t } = useT();
  const options: { id: RouteChoice; label: string; cost: PathCost }[] = [
    { id: "recommended", label: t("card.beeable"), cost: route.costs.recommended },
    { id: "alternative", label: t("card.alternative"), cost: route.alternative!.costs },
  ];
  return (
    <fieldset className="segmented compact route-options">
      <legend className="visually-hidden">{t("card.options")}</legend>
      {options.map((o) => (
        <label key={o.id} className="segment">
          <input type="radio" name="route-choice" value={o.id} checked={choice === o.id} onChange={() => onChoose(o.id)} />
          <span className="segment-body">
            <span className="segment-icon">
              <Icon name={o.id === "recommended" ? "route" : "map"} size={20} />
            </span>
            <span className="segment-label">{o.label}</span>
            <span className="segment-hint">{t("card.optionMeta", { m: o.cost.length_m, n: minutes(o.cost.length_m) })}</span>
            <span className="segment-check">
              <Icon name="check" size={16} />
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** One line on how the plain shortest path compares, so "the shortest has steps" is clear without the map. */
function Compare({ shortest, recommended }: { shortest: PathCost; recommended: PathCost }) {
  const { t, lang } = useT();
  if (shortest.length_m === recommended.length_m && !shortest.blocked_by) {
    return <p className="compare">{t("card.alsoShortest")}</p>;
  }
  let issue = t("card.noKnown");
  if (shortest.blocked_by) issue = t("card.passes", { b: shortest.blocked_by });
  else if ((shortest.known_barriers ?? 0) > 0) issue = plural(lang, "card.known", shortest.known_barriers!);
  const extra = recommended.length_m - shortest.length_m;
  return (
    <p className="compare">
      <span className="compare-swatch" aria-hidden="true" />
      <span>
        <strong>{t("card.shortest")}</strong> {shortest.length_m} m, {issue}.
        {extra > 0 && ` ${t("card.adds", { m: extra, n: minutes(extra) })}`}
      </span>
    </p>
  );
}

export function RouteSkeleton() {
  return (
    <div className="route-card skeleton" aria-hidden="true">
      <span className="sk sk-lg" />
      <span className="sk" />
      <span className="sk" />
      <span className="sk sk-short" />
    </div>
  );
}
