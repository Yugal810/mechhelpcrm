import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const NAGPUR: [number, number] = [21.1458, 79.0882];

function pinIcon(kind = "garage") {
  return L.divIcon({
    className: "mh-pin",
    html: `<div class="mh-pin-inner ${
      kind === "origin" ? "is-origin" : kind === "active" ? "is-active" : ""
    }"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 18],
  });
}

interface MapViewProps {
  origin?: { lat: number; lon: number } | null;
  garages?: any[];
  activeId?: string | null;
  isCollapsed?: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  origin,
  garages = [],
  activeId = null,
  isCollapsed = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      if ((containerRef.current as any)._leaflet_id) {
        delete (containerRef.current as any)._leaflet_id;
      }
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        center: NAGPUR,
        zoom: 12,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      const invalidate = () => {
        if (mapRef.current) {
          try {
            mapRef.current.invalidateSize();
          } catch {}
        }
      };

      invalidate();
      const t1 = setTimeout(invalidate, 100);
      const t2 = setTimeout(invalidate, 300);
      const t3 = setTimeout(invalidate, 800);

      const resizeObserver = new ResizeObserver(() => {
        invalidate();
      });
      resizeObserver.observe(containerRef.current);

      window.addEventListener("resize", invalidate);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        resizeObserver.disconnect();
        window.removeEventListener("resize", invalidate);
        if (mapRef.current) {
          try {
            map.remove();
          } catch {}
          mapRef.current = null;
        }
      };
    } catch (err) {
      console.error("MapView Leaflet error:", err);
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.invalidateSize();
    } catch {}

    const t1 = setTimeout(() => { try { map.invalidateSize(); } catch {} }, 50);
    const t2 = setTimeout(() => { try { map.invalidateSize(); } catch {} }, 200);
    const t3 = setTimeout(() => { try { map.invalidateSize(); } catch {} }, 360);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isCollapsed]);

  useEffect(() => {
    try {
      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;

      layer.clearLayers();
      const points: [number, number][] = [];

      if (origin?.lat && origin?.lon) {
        const pos: [number, number] = [origin.lat, origin.lon];
        points.push(pos);
        L.marker(pos, { icon: pinIcon("origin") }).addTo(layer);
      }

      garages.forEach((g) => {
        if (!g.lat || !g.lon) return;
        const pos: [number, number] = [g.lat, g.lon];
        points.push(pos);
        const id = `${g.garage_name}-${g.lat}`;
        L.marker(pos, {
          icon: pinIcon(id === activeId ? "active" : "garage"),
        }).addTo(layer);
      });

      map.invalidateSize();

      if (!points.length) {
        map.setView(NAGPUR, 12);
        return;
      }
      if (points.length === 1) {
        map.setView(points[0], 14);
        return;
      }
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 });
    } catch (err) {
      console.error("MapView marker update error:", err);
    }
  }, [origin, garages, activeId]);

  return (
    <div className="map-plane">
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};
