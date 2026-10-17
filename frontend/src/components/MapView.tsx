import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { PathOptions } from "leaflet";
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
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {route && (
        <>
          <GeoJSON key={`s-${routeKey}`} data={route.shortest} style={SHORTEST_STYLE} />
          <GeoJSON key={`r-${routeKey}`} data={route.recommended} style={recommendedStyle as never} />
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
