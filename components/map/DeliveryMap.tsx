"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { MAP_STYLE } from "@/components/map/GoogleMap";
import { getMapsLoader } from "@/lib/google-maps-loader";
import { cn } from "@/lib/utils";

interface LatLng {
  lat: number;
  lng: number;
}

interface DeliveryMapProps {
  /** The drop-off point (required). */
  destination: LatLng;
  /** The runner's live location — shows the pulsing emerald pin (requester view). */
  runner?: (LatLng & { heading?: number | null }) | null;
  /** The viewer's own location — shows the blue "you are here" dot (runner view). */
  self?: LatLng | null;
  /** The pickup hub — shows a distinct amber marker. */
  collectionPoint?: (LatLng & { label?: string }) | null;
  className?: string;
}

/** Imperative handle for the custom HTML runner overlay. */
interface RunnerOverlayHandle {
  moveTo: (lat: number, lng: number) => void;
  setHeading: (deg: number | null) => void;
  destroy: () => void;
}

/** Build the pulsing emerald runner marker as a Google Maps OverlayView. */
function createRunnerOverlay(
  map: google.maps.Map,
  lat: number,
  lng: number,
): RunnerOverlayHandle {
  class Overlay extends google.maps.OverlayView {
    pos = new google.maps.LatLng(lat, lng);
    div: HTMLDivElement | null = null;
    arrow: HTMLElement | null = null;
    raf = 0;

    onAdd() {
      const div = document.createElement("div");
      div.style.position = "absolute";
      div.style.transform = "translate(-50%, -50%)";
      div.innerHTML = `
        <span class="relative flex h-7 w-7 items-center justify-center">
          <span class="absolute inline-flex h-7 w-7 animate-ping rounded-full bg-emerald-400 opacity-60"></span>
          <span class="relative flex h-6 w-6 items-center justify-center rounded-full bg-brand-900 text-white shadow-lg ring-2 ring-white">
            <svg data-arrow viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2 4.8 20.2a.9.9 0 0 0 1.3 1.1L12 18l5.9 3.3a.9.9 0 0 0 1.3-1.1L12 2Z"/></svg>
          </span>
        </span>`;
      this.div = div;
      this.arrow = div.querySelector("[data-arrow]");
      this.getPanes()?.overlayMouseTarget.appendChild(div);
    }

    draw() {
      if (!this.div) return;
      const p = this.getProjection()?.fromLatLngToDivPixel(this.pos);
      if (p) {
        this.div.style.left = `${p.x}px`;
        this.div.style.top = `${p.y}px`;
      }
    }

    onRemove() {
      this.div?.remove();
      this.div = null;
    }

    moveTo(toLat: number, toLng: number) {
      cancelAnimationFrame(this.raf);
      const fromLat = this.pos.lat();
      const fromLng = this.pos.lng();
      const startedAt = performance.now();
      const DURATION = 800;
      const tick = (now: number) => {
        const t = Math.min(1, (now - startedAt) / DURATION);
        this.pos = new google.maps.LatLng(
          fromLat + (toLat - fromLat) * t,
          fromLng + (toLng - fromLng) * t,
        );
        this.draw();
        if (t < 1) this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }

    setHeading(deg: number | null) {
      if (this.arrow) {
        this.arrow.style.transform = deg == null ? "" : `rotate(${deg}deg)`;
      }
    }

    destroy() {
      cancelAnimationFrame(this.raf);
      this.setMap(null);
    }
  }

  const overlay = new Overlay();
  overlay.setMap(map);
  return overlay;
}

export function DeliveryMap({
  destination,
  runner,
  self,
  collectionPoint,
  className,
}: DeliveryMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const destMarker = useRef<google.maps.Marker | null>(null);
  const hubMarker = useRef<google.maps.Marker | null>(null);
  const selfMarker = useRef<google.maps.Marker | null>(null);
  const runnerOverlay = useRef<RunnerOverlayHandle | null>(null);
  const polyline = useRef<google.maps.Polyline | null>(null);
  const fitted = useRef(false);
  const runnerPos = useRef<LatLng | null>(null);
  const selfPos = useRef<LatLng | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  // Re-draw the dashed connector from the tracked point to the destination.
  function updatePolyline() {
    const map = mapRef.current;
    if (!map || typeof google === "undefined") return;
    const from = runnerPos.current ?? selfPos.current;
    if (!from) return;
    const path = [from, destination];
    if (polyline.current) {
      polyline.current.setPath(path);
    } else {
      polyline.current = new google.maps.Polyline({
        map,
        path,
        geodesic: true,
        strokeOpacity: 0,
        icons: [
          {
            icon: {
              path: "M 0,-1 0,1",
              strokeOpacity: 0.9,
              strokeColor: "#064e3b",
              scale: 3,
            },
            offset: "0",
            repeat: "12px",
          },
        ],
      });
    }
  }

  // Fit the viewport to all present points (once).
  function fitOnce() {
    const map = mapRef.current;
    if (!map || fitted.current || typeof google === "undefined") return;
    const pts: LatLng[] = [destination];
    if (runnerPos.current) pts.push(runnerPos.current);
    if (selfPos.current) pts.push(selfPos.current);
    if (collectionPoint) pts.push(collectionPoint);
    if (pts.length < 2) return;
    const bounds = new google.maps.LatLngBounds();
    pts.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 64);
    fitted.current = true;
  }

  // Initialise the map + destination marker once.
  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let cancelled = false;
    getMapsLoader(apiKey)
      .importLibrary("maps")
      .then(({ Map }) => {
        if (cancelled || !containerRef.current) return;
        const map = new Map(containerRef.current, {
          center: destination,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          styles: MAP_STYLE,
          gestureHandling: "cooperative",
        });
        mapRef.current = map;
        destMarker.current = new google.maps.Marker({
          position: destination,
          map,
          title: "Delivery address",
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // BUG FIX: tear everything down on unmount. Without this the runner overlay's
  // requestAnimationFrame loop (from moveTo) could keep firing against a map
  // whose container React has already removed when you navigate away.
  useEffect(() => {
    return () => {
      runnerOverlay.current?.destroy();
      runnerOverlay.current = null;
      destMarker.current?.setMap(null);
      hubMarker.current?.setMap(null);
      selfMarker.current?.setMap(null);
      polyline.current?.setMap(null);
    };
  }, []);

  // Runner pin (requester view) — create, move smoothly, or remove.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    if (runner) {
      runnerPos.current = { lat: runner.lat, lng: runner.lng };
      if (!runnerOverlay.current) {
        runnerOverlay.current = createRunnerOverlay(
          mapRef.current,
          runner.lat,
          runner.lng,
        );
      } else {
        runnerOverlay.current.moveTo(runner.lat, runner.lng);
      }
      runnerOverlay.current.setHeading(runner.heading ?? null);
      updatePolyline();
      fitOnce();
    } else if (runnerOverlay.current) {
      runnerOverlay.current.destroy();
      runnerOverlay.current = null;
      runnerPos.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, runner?.lat, runner?.lng, runner?.heading]);

  // Self dot (runner view) — the standard blue "you are here" marker.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    if (self) {
      selfPos.current = { lat: self.lat, lng: self.lng };
      if (!selfMarker.current) {
        selfMarker.current = new google.maps.Marker({
          position: self,
          map: mapRef.current,
          title: "You",
          zIndex: 999,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
      } else {
        selfMarker.current.setPosition(self);
      }
      updatePolyline();
      fitOnce();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, self?.lat, self?.lng]);

  // Pickup hub marker — a distinct amber square.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    if (collectionPoint) {
      if (!hubMarker.current) {
        hubMarker.current = new google.maps.Marker({
          position: collectionPoint,
          map: mapRef.current,
          title: collectionPoint.label ?? "Pickup point",
          icon: {
            path: "M -8,-8 8,-8 8,8 -8,8 z",
            scale: 1,
            fillColor: "#b45309",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
      } else {
        hubMarker.current.setPosition(collectionPoint);
      }
      fitOnce();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, collectionPoint?.lat, collectionPoint?.lng]);

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
          Set NEXT_PUBLIC_GOOGLE_MAPS_KEY to show live tracking.
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
