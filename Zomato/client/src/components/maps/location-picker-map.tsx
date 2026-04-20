import { useEffect } from "react";
import { divIcon } from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { cn } from "@/utils/cn";
import "leaflet/dist/leaflet.css";

type LocationCoordinates = {
  latitude: number;
  longitude: number;
};

const pinIcon = divIcon({
  className: "",
  html: '<div style="width:20px;height:20px;border-radius:999px;background:#8b1e24;border:3px solid #ffffff;box-shadow:0 10px 24px rgba(15,23,42,0.22);"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const SyncMapView = ({ position }: { position?: LocationCoordinates | null }) => {
  const map = useMap();

  useEffect(() => {
    if (!position) {
      return;
    }

    map.setView([position.latitude, position.longitude], Math.max(map.getZoom(), 14), {
      animate: true,
    });
  }, [map, position]);

  return null;
};

const PickerMarker = ({
  position,
  onChange,
}: {
  position: LocationCoordinates;
  onChange: (coordinates: LocationCoordinates) => void;
}) => {
  useMapEvents({
    click(event) {
      onChange({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  return (
    <Marker
      position={[position.latitude, position.longitude]}
      icon={pinIcon}
      draggable
      eventHandlers={{
        dragend(event) {
          const nextPosition = event.target.getLatLng();
          onChange({
            latitude: nextPosition.lat,
            longitude: nextPosition.lng,
          });
        },
      }}
    />
  );
};

export const LocationPickerMap = ({
  className,
  value,
  onChange,
}: {
  className?: string;
  value: LocationCoordinates;
  onChange: (coordinates: LocationCoordinates) => void;
}) => {
  return (
    <div className={cn("overflow-hidden rounded-[1.75rem] border border-accent/10", className)}>
      <MapContainer center={[value.latitude, value.longitude]} zoom={14} scrollWheelZoom={false} className="h-[320px] w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <SyncMapView position={value} />
        <PickerMarker position={value} onChange={onChange} />
      </MapContainer>
    </div>
  );
};
