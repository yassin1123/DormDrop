import { Loader } from "@googlemaps/js-api-loader";

/**
 * Shared Google Maps JS SDK loader. The SDK can only be configured once per
 * page, so the map and the address-autocomplete inputs must use the same Loader
 * instance (same apiKey + libraries).
 */
let sharedLoader: Loader | null = null;

export function getMapsLoader(apiKey: string): Loader {
  if (!sharedLoader) {
    sharedLoader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places"],
    });
  }
  return sharedLoader;
}
