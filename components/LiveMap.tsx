"use client";
import { useEffect, useRef } from "react";

export function LiveMap({
  lat,
  lng,
  label,
  restaurantCount = 0,
  className = "",
}: {
  lat: number;
  lng: number;
  label?: string;
  restaurantCount?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (!document.querySelector("link[data-leaflet]")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.setAttribute("data-leaflet", "true");
        document.head.appendChild(link);
      }
      if (cancelled) return;

      const map = L.map(ref.current!, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: true,
      });
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const tileUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
      L.tileLayer(tileUrl, { maxZoom: 19, subdomains: "abcd" }).addTo(map);

      // Delivery-range ring (~1.5km)
      L.circle([lat, lng], {
        radius: 1500,
        color: "#c23a2a",
        weight: 1,
        opacity: 0.4,
        fillColor: "#c23a2a",
        fillOpacity: 0.04,
      }).addTo(map);

      // User pin — pulsing red dot
      const userIcon = L.divIcon({
        className: "pickless-user-pin",
        html: `<div style="position:relative;width:18px;height:18px;">
          <span style="position:absolute;inset:0;background:#c23a2a;border-radius:50%;opacity:0.35;animation:pl-ping 2s cubic-bezier(0,0,0.2,1) infinite;"></span>
          <span style="position:absolute;inset:4px;background:#c23a2a;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></span>
        </div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 })
        .bindTooltip(label || "you", {
          direction: "top",
          offset: [0, -10],
          className: "pickless-tip",
          permanent: false,
        })
        .addTo(map);

      mapRef.current = map;

      if (!document.querySelector("style[data-pickless-map]")) {
        const s = document.createElement("style");
        s.setAttribute("data-pickless-map", "true");
        s.textContent = `
          @keyframes pl-ping { 75%, 100% { transform: scale(2.5); opacity: 0; } }
          .pickless-tip { background: #1a1915; color: #f3ede1; border: 0; padding: 3px 7px;
            font-family: 'JetBrains Mono', monospace; font-size: 9px; text-transform: uppercase;
            letter-spacing: 0.18em; border-radius: 2px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
          .pickless-tip:before { display: none; }
          .leaflet-container { background: var(--paper, #161613); font-family: inherit; outline: none; }
        `;
        document.head.appendChild(s);
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lng, label]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={ref}
        className="w-full h-56 rounded-sm border hairline overflow-hidden"
        style={{ background: "var(--paper)" }}
      />
      {restaurantCount > 0 && (
        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-sm bg-[var(--bg)] border hairline backdrop-blur-sm flex items-center gap-2 z-[400]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-soft inline-block" />
          <span className="font-mono text-[10px] uppercase tracking-widest">
            {restaurantCount} live
          </span>
        </div>
      )}
    </div>
  );
}
