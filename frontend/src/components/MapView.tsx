import { useEffect } from "react";
import { AttributionControl, CircleMarker, GeoJSON, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { CATEGORIES } from "../config";
import { divIcon, latLngBounds, type PathOptions } from "leaflet";
import type { Feature, LineString } from "geojson";
import "leaflet/dist/leaflet.css";
import { DEFAULT_ZOOM, PRECINCT_CENTER } from "../config";
import { useT, type TKey } from "../i18n";
import type { Report, RouteResponse, SegmentProps } from "../types";
import { BEE_SVG } from "./Bee";

// Colours are paired with dash patterns + the text legend; never colour alone.
export const ROUTE_COLOR = "#0F766E";
export const SHORTEST_COLOR = "#6B6153";
export const ALT_COLOR = "#6D28D9";
const SHORTEST_STYLE: PathOptions = { color: SHORTEST_COLOR, weight: 4, opacity: 0.85, dashArray: "2 8", lineCap: "round" };
// The route not chosen: dash-dot (its own pattern, not just its own colour), thick enough to tap.
const ALT_STYLE: PathOptions = { color: ALT_COLOR, weight: 6, opacity: 0.8, dashArray: "14 6 2 6", lineCap: "round" };
// White casing under the recommended route so it stands out on busy OSM tiles.
const CASING_STYLE: PathOptions = { color: "#ffffff", weight: 11, opacity: 0.9, lineCap: "round" };

function recommendedStyle(feature?: Feature<LineString, SegmentProps>): PathOptions {
  const unknown = !feature?.properties.surveyed;
  // Unknown segments render dashed — never treat unknown as safe.
  return { color: ROUTE_COLOR, weight: 7, opacity: 0.95, lineCap: "round", dashArray: unknown ? "10 10" : undefined };
}

const CATEGORY_KEYS = Object.fromEntries(CATEGORIES.map((c) => [`cat.${c.id}`, true]));

// Small SVG strings for Leaflet divIcons (Leaflet needs HTML, not React elements).
const svg = (d: string, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const GLYPH = {
  alert: "M12 4 2 20h20L12 4Zm0 6v4m0 3h.01",
  question: "M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14m0 3h.01",
  bang: "M12 6v8m0 4h.01",
  wrench: "M14 6a4 4 0 0 0 5 5l-9 9a2 2 0 0 1-3-3l9-9a4 4 0 0 1-2-2Z",
  clinic: "M4 21V7l8-4 8 4v14H4Zm8-11v6m-3-3h6",
  mosque: "M4 21v-8h16v8H4Zm2-8a6 6 0 0 1 12 0M12 3v4",
  bus: "M5 17V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11H5Zm0-6h14M8 20v-3m8 3v-3",
  pin: "M12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
};
const POI_GLYPH: Record<string, string> = {
  clinic: GLYPH.clinic,
  mosque_surau: GLYPH.mosque,
  bus_stop: GLYPH.bus,
  library: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm0 16a2 2 0 0 1 2-2h13v2H6",
  food: "M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V8Zm11 1h2a2 2 0 0 1 0 4h-2",
  residence: "M4 11 12 4l8 7v9H4v-9Zm6 9v-5h4v5",
  sport: "M5 21V4m0 0h11l-2 4 2 4H5",
  building: "M5 21V4h10v17M15 9h4v12M3 21h18",
};

// Barriers on either route get a hazard-striped warning marker with text in the popup, not just a colour.
const BARRIER_ICON = divIcon({
  className: "barrier-icon",
  html: `<span class="barrier-badge">${svg(GLYPH.bang, 18)}</span>`,
  iconSize: [34, 34],
});
// "You are here" is a bee with a soft pulsing halo.
const ORIGIN_ICON = divIcon({
  className: "origin-icon",
  html: `<span class="bee-halo"></span><span class="bee-body">${BEE_SVG}</span>`,
  iconSize: [44, 44],
  popupAnchor: [0, -18],
});
const destinationIcon = (type?: string) =>
  divIcon({
    className: "dest-marker",
    html: `<span>${svg(POI_GLYPH[type ?? ""] ?? GLYPH.pin, 18)}</span>`,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    popupAnchor: [0, -38],
  });

function barrierSegments(route: RouteResponse) {
  const seen = new Map<string, { at: [number, number]; text: string; impassable: boolean }>();
  for (const f of [...route.shortest.features, ...route.recommended.features, ...(route.alternative?.route.features ?? [])]) {
    const p = f.properties;
    if (!p.barrier || seen.has(p.edge_id)) continue;
    const c = f.geometry.coordinates;
    const [lng, lat] = c[Math.floor(c.length / 2)];
    seen.set(p.edge_id, { at: [lat, lng], text: p.barrier, impassable: Boolean(p.impassable) });
  }
  return [...seen.entries()];
}

/** Zoom to the route, leaving room for the bottom sheet on phones. */
function FitRoute({ route, routeKey }: { route: RouteResponse | null; routeKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (!route) return;
    const pts = [...route.shortest.features, ...route.recommended.features, ...(route.alternative?.route.features ?? [])].flatMap((f) =>
      f.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    );
    if (!pts.length) return;
    const phone = window.innerWidth < 900;
    map.fitBounds(latLngBounds(pts), {
      paddingTopLeft: phone ? [24, 24] : [440, 24],
      paddingBottomRight: phone ? [24, Math.round(window.innerHeight * 0.55)] : [24, 24],
      maxZoom: 18,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);
  return null;
}

// Report markers: each status has its own glyph and shape as well as a colour.
const REPORT_ICONS: Record<string, ReturnType<typeof divIcon>> = {
  unverified: divIcon({ className: "report-icon report-unverified", html: svg(GLYPH.question, 14), iconSize: [26, 26] }),
  verified: divIcon({ className: "report-icon report-verified", html: svg(GLYPH.bang, 14), iconSize: [26, 26] }),
  in_progress: divIcon({ className: "report-icon report-in_progress", html: svg(GLYPH.wrench, 13), iconSize: [26, 26] }),
};

// A little personality in the popups (map.headline.<status>); the plain status still follows underneath.

/** Pan to a point whenever `focus.key` changes (locate-me, a report picked on the dashboard). */
function FlyTo({ focus }: { focus?: MapFocus }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.setView(focus.at, Math.max(map.getZoom(), 18), { animate: !reduce });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);
  return null;
}

export interface MapFocus {
  at: [number, number];
  key: number;
}

function Highlight({ report }: { report?: Report }) {
  if (!report) return null;
  return (
    <CircleMarker center={[report.lat, report.lng]} radius={20} interactive={false} pathOptions={{ color: "#1C1408", weight: 3, fill: false, dashArray: "4 4" }} />
  );
}

interface Props {
  route: RouteResponse | null;
  reports: Report[];
  origin?: [number, number];
  destination?: [number, number] | null;
  destinationType?: string;
  focus?: MapFocus;
  /** Report to emphasise (e.g. the one picked on the dashboard). */
  highlightId?: string;
  /** Changes whenever the route request changes; GeoJSON layers don't re-render on new data otherwise. */
  routeKey?: string;
  /** Tapping the alternative line picks it (omitted during a journey). */
  onPickAlternative?: () => void;
}

export function MapView({
  route, reports, origin, destination, destinationType, focus, highlightId, routeKey = "route", onPickAlternative,
}: Props) {
  const { t } = useT();
  const statusText = (r: Report) =>
    r.status === "verified" && r.verified_by === "ai" ? t("status.verifiedAi") : t(`status.${r.status}`);
  const categoryText = (c: string) => (`cat.${c}` in CATEGORY_KEYS ? t(`cat.${c}` as TKey) : c.replaceAll("_", " "));
  return (
    <MapContainer
      center={PRECINCT_CENTER}
      zoom={DEFAULT_ZOOM}
      className="map"
      aria-label={t("map.aria")}
      attributionControl={false}
    >
      <AttributionControl position="topright" prefix={false} />
      <FitRoute route={route} routeKey={routeKey} />
      <FlyTo focus={focus} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {route && (
        <>
          <GeoJSON key={`s-${routeKey}`} data={route.shortest} style={SHORTEST_STYLE} />
          {route.alternative && (
            <GeoJSON
              key={`a-${routeKey}`}
              data={route.alternative.route}
              style={ALT_STYLE}
              interactive={!!onPickAlternative}
              eventHandlers={onPickAlternative ? { click: onPickAlternative } : undefined}
            >
              {/* The route card's radio buttons do the same for keyboard and screen-reader users. */}
              {onPickAlternative && <Tooltip sticky>{t("map.altTitle")}</Tooltip>}
            </GeoJSON>
          )}
          <GeoJSON key={`c-${routeKey}`} data={route.recommended} style={CASING_STYLE} />
          <GeoJSON key={`r-${routeKey}`} data={route.recommended} style={recommendedStyle as never} />
          {barrierSegments(route).map(([id, b]) => (
            <Marker key={`${routeKey}-${id}`} position={b.at} icon={BARRIER_ICON} title={t("map.barrierTitle", { t: b.text })}>
              <Popup>
                <span className="pop-title">{t("map.obstacleHere")}</span>
                {b.text}
                {b.impassable && <span className="pop-note">{t("map.impassable")}</span>}
              </Popup>
            </Marker>
          ))}
        </>
      )}
      {origin && (
        <Marker position={origin} icon={ORIGIN_ICON} title={t("map.startTitle")}>
          <Popup>
            <span className="pop-title">{t("map.youAreHere")}</span>
            {t("map.buzzing")}
          </Popup>
        </Marker>
      )}
      {destination && (
        <Marker position={destination} icon={destinationIcon(destinationType)} title={t("map.destination")}>
          <Popup>{t("map.destination")}</Popup>
        </Marker>
      )}
      {reports
        .filter((r) => r.status in REPORT_ICONS)
        .map((r) => (
          <Marker
            key={r.id}
            position={[r.lat, r.lng]}
            icon={REPORT_ICONS[r.status]}
            title={t("map.reportTitle", { ref: r.reference_number, status: statusText(r) })}
            zIndexOffset={r.id === highlightId ? 1000 : 0}
          >
            {/* No reporter identity is ever shown. */}
            <Popup>
              <span className="pop-title">{t(`map.headline.${r.status as "unverified" | "verified" | "in_progress"}`)}</span>
              <strong className="pop-cat">{categoryText(r.ai.category)}</strong>
              {t("map.status", { s: statusText(r) })}
              <br />
              {t("map.source", { s: t(`source.${r.source}`) })}
            </Popup>
          </Marker>
        ))}
      {highlightId && <Highlight report={reports.find((r) => r.id === highlightId)} />}
    </MapContainer>
  );
}
