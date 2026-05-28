"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";

import { getMapsLoader } from "@/lib/google-maps-loader";
import { cn } from "@/lib/utils";

/** Centre of the Southampton area — predictions are biased around here. */
const SOTON = { lat: 50.9354, lng: -1.3964 };
const BIAS_RADIUS_M = 5000;

export interface SelectedAddress {
  address: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  label?: string;
  value: string;
  /** Raw text changes (typing). */
  onChange: (value: string) => void;
  /** Fired when a suggestion with coordinates is chosen. */
  onSelect: (address: SelectedAddress) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

/**
 * Address input backed by Google Places autocomplete, biased to Southampton.
 * Returns the full address + lat/lng on selection. If the Maps key is missing
 * (or the SDK fails to load) it degrades to a plain controlled text input.
 */
export function AddressAutocomplete({
  label,
  value,
  onChange,
  onSelect,
  placeholder,
  error,
  hint,
  required,
}: AddressAutocompleteProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const fieldId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const acService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ready, setReady] = useState(false);
  const [predictions, setPredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);
  const [openList, setOpenList] = useState(false);
  const [loadingPreds, setLoadingPreds] = useState(false);

  // Load the Places services lazily.
  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    getMapsLoader(apiKey)
      .importLibrary("places")
      .then((places) => {
        if (cancelled) return;
        acService.current = new places.AutocompleteService();
        placesService.current = new places.PlacesService(
          document.createElement("div"),
        );
        token.current = new places.AutocompleteSessionToken();
        setReady(true);
      })
      .catch(() => {
        // Stay in plain-input mode.
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpenList(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function handleInput(next: string) {
    onChange(next);
    if (!ready || !acService.current || next.trim().length < 3) {
      setPredictions([]);
      setOpenList(false);
      return;
    }
    setLoadingPreds(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      acService.current?.getPlacePredictions(
        {
          input: next,
          sessionToken: token.current ?? undefined,
          location: new google.maps.LatLng(SOTON.lat, SOTON.lng),
          radius: BIAS_RADIUS_M,
          componentRestrictions: { country: "gb" },
        },
        (preds) => {
          setLoadingPreds(false);
          setPredictions(preds ?? []);
          setOpenList((preds?.length ?? 0) > 0);
        },
      );
    }, 250);
  }

  function choose(pred: google.maps.places.AutocompletePrediction) {
    setOpenList(false);
    setPredictions([]);
    onChange(pred.description);

    placesService.current?.getDetails(
      {
        placeId: pred.place_id,
        fields: ["formatted_address", "geometry"],
        sessionToken: token.current ?? undefined,
      },
      (place) => {
        // Start a fresh session token after a details lookup (billing).
        if (typeof google !== "undefined") {
          token.current = new google.maps.places.AutocompleteSessionToken();
        }
        const address = place?.formatted_address ?? pred.description;
        const loc = place?.geometry?.location;
        onChange(address);
        if (loc) onSelect({ address, lat: loc.lat(), lng: loc.lng() });
      },
    );
  }

  return (
    <div className="w-full" ref={wrapRef}>
      {label && (
        <label
          htmlFor={fieldId}
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id={fieldId}
          type="text"
          autoComplete="off"
          required={required}
          aria-invalid={error ? true : undefined}
          value={value}
          placeholder={placeholder}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => predictions.length > 0 && setOpenList(true)}
          className={cn(
            "block h-11 w-full rounded-lg border bg-white pl-9 pr-9 text-sm text-slate-900 shadow-sm transition-colors",
            "placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30",
            error ? "border-rose-400" : "border-slate-300",
          )}
        />
        {loadingPreds && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}

        {openList && predictions.length > 0 && (
          <ul className="absolute z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-soft-lg">
            {predictions.map((pred) => {
              const main =
                pred.structured_formatting?.main_text ?? pred.description;
              const secondary =
                pred.structured_formatting?.secondary_text ?? "";
              return (
                <li key={pred.place_id}>
                  <button
                    type="button"
                    onClick={() => choose(pred)}
                    className="press flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-stone-50"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-stone-900">
                        {main}
                      </span>
                      {secondary && (
                        <span className="block truncate text-xs text-stone-500">
                          {secondary}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error ? (
        <p className="mt-1.5 text-sm text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
