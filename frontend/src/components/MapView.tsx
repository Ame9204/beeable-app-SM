import { useEffect } from "react";
import { AttributionControl, CircleMarker, GeoJSON, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { divIcon, latLngBounds, type PathOptions } from "leaflet";
import type { Feature, LineString } from "geojson";
import "leaflet/dist/leaflet.css";
import { DEFAULT_ZOOM, PRECINCT_CENTER } from "../config";
import type { Report, RouteResponse, SegmentProps } from "../types";

// Colours are paired with dash patterns + the text legend; never colour alone.
const SHORTEST_STYLE: PathOptions = { color: "#6b7280", weight: 4, opacity: 0.8, dashArray: "2 8" };
const RECOMMENDED_COLOR = "#1d4ed8";

function recommendedStyle(feature?: Feature<LineString, SegmentProps>): PathOptions {
  const unknown = !feature?.properties.surveyed;
  // Unknown segments render dashed — never treat unknown as safe.
  return { color: RECOMMENDED_COLOR, weight: 7, opacity: 0.9, dashArray: unknown ? "10 10" : undefined };
}

// Barriers on either route get a ⚠ marker with text, not just a colour.
const BARRIER_ICON = divIcon({ className: "barrier-icon", html: "⚠", iconSize: [28, 28] });

function barrierSegments(route: RouteResponse) {
  const seen = new Map<string, { at: [number, number]; text: string; impassable: boolean }>();
  for (const f of [...route.shortest.features, ...route.recommended.features]) {
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
    const pts = [...route.shortest.features, ...route.recommended.features].flatMap((f) =>
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

const STATUS_COLOR: Record<string, string> = {
  unverified: "#b45309",
  verified: "#b91c1c",
  in_progress: "#7c3aed",
};

interface Props {
  route: RouteResponse | null;
  reports: Report[];
  origin?: [number, number];
  destination?: [number, number] | null;
  /** Changes whenever the route request changes; GeoJSON layers don't re-render on new data otherwise. */
  routeKey?: string;
}

export function MapView({ route, reports, origin, destination, routeKey = "route" }: Props) {
  return (
    <MapContainer
      center={PRECINCT_CENTER}
      zoom={DEFAULT_ZOOM}
      className="map"
      aria-label="Map of the campus showing routes and reported barriers"
      attributionControl={false}
    >
      <AttributionControl position="topright" prefix={false} />
      <FitRoute route={route} routeKey={routeKey} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {route && (
        <>
          <GeoJSON key={`s-${routeKey}`} data={route.shortest} style={SHORTEST_STYLE} />
          <GeoJSON key={`r-${routeKey}`} data={route.recommended} style={recommendedStyle as never} />
          {barrierSegments(route).map(([id, b]) => (
            <Marker key={`${routeKey}-${id}`} position={b.at} icon={BARRIER_ICON} title={`Barrier: ${b.text}`}>
              <Popup>
                <strong>Barrier</strong>
                <br />
                {b.text}
                {b.impassable && (
                  <>
                    <br />
                    Impassable for your profile
                  </>
                )}
              </Popup>
            </Marker>
          ))}
        </>
      )}
      {origin && (
        <CircleMarker center={origin} radius={9} pathOptions={{ color: "#111827", fillOpacity: 1 }}>
          <Popup>You are here</Popup>
        </CircleMarker>
      )}
      {destination && (
        <CircleMarker center={destination} radius={9} pathOptions={{ color: "#047857", fillOpacity: 1 }}>
          <Popup>Destination</Popup>
        </CircleMarker>
      )}
      {reports
        .filter((r) => r.status in STATUS_COLOR)
        .map((r) => (
          <CircleMarker
            key={r.id}
            center={[r.lat, r.lng]}
            radius={8}
            pathOptions={{ color: STATUS_COLOR[r.status], fillOpacity: 0.6 }}
          >
            {/* No reporter identity is ever shown. */}
            <Popup>
              <strong>{r.ai.category.replaceAll("_", " ")}</strong>
              <br />
              Status: {r.status === "unverified" ? "Unverified (not yet checked by staff)" : r.status}
              <br />
              Source: {r.source}
            </Popup>
          </CircleMarker>
        ))}
    </MapContainer>
  );
}
