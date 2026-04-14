import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { latLngBounds, type LatLngExpression } from "leaflet";
import { cn } from "@/utils/cn";
import "leaflet/dist/leaflet.css";

type RouteMarker = {
  id: string;
  label: string;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  color?: string;
};

const DEFAULT_COLORS = ["#8b1e24", "#d97706", "#0f766e"];

const isValidCoordinate = (value?: number | null) =>
  typeof value === "number" && Number.isFinite(value);

const FitBounds = ({ positions }: { positions: LatLngExpression[] }) => {
  const map = useMap();

  useEffect(() => {
    if (!positions.length) {
      return;
    }

    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }

    map.fitBounds(latLngBounds(positions), {
      padding: [36, 36],
    });
  }, [map, positions]);

  return null;
};

export const RouteMap = ({
  markers,
  className,
  emptyMessage = "Live map will appear as soon as location points are available.",
  interactive = true,
}: {
  markers: RouteMarker[];
  className?: string;
  emptyMessage?: string;
  interactive?: boolean;
}) => {
  const validMarkers = useMemo(
    () =>
      markers
        .map((marker, index) => ({
          ...marker,
          color: marker.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length],
        }))
        .filter(
          (marker): marker is RouteMarker & { latitude: number; longitude: number; color: string } =>
            isValidCoordinate(marker.latitude) &&
            isValidCoordinate(marker.longitude) &&
            typeof marker.color === "string",
        ),
    [markers],
  );

  const positions = useMemo<LatLngExpression[]>(
    () => validMarkers.map((marker) => [marker.latitude, marker.longitude] as LatLngExpression),
    [validMarkers],
  );

  if (!validMarkers.length) {
    return (
      <div
        className={cn(
          "flex min-h-[320px] items-center justify-center rounded-[1.75rem] border border-dashed border-accent/20 bg-white/60 px-6 py-12 text-center text-sm leading-7 text-ink-soft",
          className,
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-[1.75rem] border border-accent/10", className)}>
      <MapContainer
        center={positions[0]}
        zoom={13}
        scrollWheelZoom={false}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        boxZoom={interactive}
        keyboard={interactive}
        className="h-[320px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds positions={positions} />
        {positions.length > 1 ? (
          <Polyline positions={positions} pathOptions={{ color: "#8b1e24", weight: 4, opacity: 0.75 }} />
        ) : null}
        {validMarkers.map((marker) => (
          <CircleMarker
            key={marker.id}
            center={[marker.latitude, marker.longitude]}
            pathOptions={{
              color: marker.color,
              fillColor: marker.color,
              fillOpacity: 0.88,
            }}
            radius={10}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-ink">{marker.label}</p>
                {marker.description ? <p className="text-xs text-ink-soft">{marker.description}</p> : null}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
};
