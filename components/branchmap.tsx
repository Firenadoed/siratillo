"use client";

import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";

// Fix default marker icons for Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type BranchMapProps = {
  location: [number, number] | null;
  setLocation: (loc: [number, number]) => void;
};

export default function BranchMap({ location, setLocation }: BranchMapProps) {
  const [markerPos, setMarkerPos] = useState<LatLngExpression>(location || [9.308, 123.308]);

  useEffect(() => {
    if (location) setMarkerPos(location);
  }, [location]);

  function MapClickHandler() {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setMarkerPos([lat, lng]);
        setLocation([lat, lng]);
      },
    });
    return null;
  }

  return (
    <div className="w-full h-64 rounded-md overflow-hidden">
      <MapContainer center={markerPos} zoom={16} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler />
        <Marker
          position={markerPos}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              const position = marker.getLatLng();
              setMarkerPos([position.lat, position.lng]);
              setLocation([position.lat, position.lng]);
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
