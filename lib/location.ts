export type LocationData = {
  lat: number;
  lng: number;
  city: string;
  neighborhood: string;
  country: string;
  countryCode: string;
};

export function getBrowserLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("no geolocation"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

const COUNTRY_TO_REGION: Record<string, string> = {
  IN: "IN",
  GB: "UK",
  IE: "UK",
  US: "US",
  CA: "US",
  AU: "AU",
  NZ: "AU",
  FR: "EU",
  DE: "EU",
  IT: "EU",
  ES: "EU",
  NL: "EU",
  BE: "EU",
  SE: "EU",
  FI: "EU",
  DK: "EU",
  NO: "EU",
};
export function regionForCountry(code: string): string {
  return COUNTRY_TO_REGION[code?.toUpperCase()] || "IN";
}
