"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { getMapsLoader } from "@/lib/google-maps-loader";
import { cn } from "@/lib/utils";

export interface MapMarker {
  lat: number;
  lng: number;
  /** Shown as a hover tooltip on the pin. */
  label?: string;
  /** Optional custom marker icon (URL or google.maps.Symbol). */
  icon?: string;
}

interface GoogleMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  className?: string;
  onMapReady?: (map: google.maps.Map) => void;
}

/** A clean, desaturated map theme — subtle, not the default garish Google look. */
export const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f4f2" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8276" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f4f2" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#dde7dd" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#ece9e4" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#e4ded5" }],
  },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#cdd8df" }],
  },
];

export function GoogleMap({
  center,
  zoom = 13,
  markers = [],
  className,
  onMapReady,
}: GoogleMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerObjs = useRef<google.maps.Marker[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Initialise the map once the SDK is loaded.
  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let cancelled = false;

    getMapsLoader(apiKey)
      .importLibrary("maps")
      .then(({ Map }) => {
        if (cancelled || !containerRef.current) return;
        const map = new Map(containerRef.current, {
          center,
          zoom,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          styles: MAP_STYLE,
          gestureHandling: "cooperative",
        });
        mapRef.current = map;
        setStatus("ready");
        onMapReady?.(map);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // Only re-init if the key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Keep the viewport in sync when the centre/zoom props change.
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setCenter(center);
      mapRef.current.setZoom(zoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, zoom]);

  // (Re)draw markers whenever they change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || typeof google === "undefined") return;

    markerObjs.current.forEach((m) => m.setMap(null));
    markerObjs.current = markers.map(
      (mk) =>
        new google.maps.Marker({
          position: { lat: mk.lat, lng: mk.lng },
          map,
          title: mk.label,
          icon: mk.icon ?? {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#064e3b",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        }),
    );

    return () => {
      markerObjs.current.forEach((m) => m.setMap(null));
      markerObjs.current = [];
    };
  }, [markers, status]);

  // No key configured — show a friendly placeholder instead of a broken map.
  if (!apiKey) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-center",
          className,
        )}
      >
        <MapPin className="h-6 w-6 text-stone-400" />
        <p className="text-sm font-medium text-stone-500">Map unavailable</p>
        <p className="max-w-xs text-xs text-stone-400">
          Set NEXT_PUBLIC_GOOGLE_MAPS_KEY to show the live map.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div ref={containerRef} className="h-full w-full" />

      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
          <div className="h-full w-full animate-pulse bg-stone-200/70" />
          <MapPin className="absolute h-6 w-6 animate-bounce text-stone-400" />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-stone-50 text-center">
          <MapPin className="h-6 w-6 text-stone-400" />
          <p className="text-sm font-medium text-stone-500">
            Couldn&apos;t load the map
          </p>
        </div>
      )}
    </div>
  );
}
