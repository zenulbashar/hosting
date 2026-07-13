/**
 * Deployment regions. Sydney (syd1) is the flagship region — the physical
 * datacenter comes first in Australia, with the rest of the list representing
 * planned points of presence. Safe to import from client components.
 */
export type Region = {
  id: string;
  city: string;
  country: string;
  /** Full label used in build logs, e.g. "Sydney, Australia (Southeast)" */
  label: string;
  flag: string;
  available: boolean;
};

export const REGIONS: Region[] = [
  { id: "syd1", city: "Sydney", country: "Australia", label: "Sydney, Australia (Southeast)", flag: "🇦🇺", available: true },
  { id: "mel1", city: "Melbourne", country: "Australia", label: "Melbourne, Australia (South)", flag: "🇦🇺", available: false },
  { id: "sin1", city: "Singapore", country: "Singapore", label: "Singapore (Southeast Asia)", flag: "🇸🇬", available: true },
  { id: "hnd1", city: "Tokyo", country: "Japan", label: "Tokyo, Japan (Northeast Asia)", flag: "🇯🇵", available: true },
  { id: "iad1", city: "Washington, D.C.", country: "USA", label: "Washington, D.C., USA (East)", flag: "🇺🇸", available: true },
  { id: "sfo1", city: "San Francisco", country: "USA", label: "San Francisco, USA (West)", flag: "🇺🇸", available: true },
  { id: "fra1", city: "Frankfurt", country: "Germany", label: "Frankfurt, Germany (Central EU)", flag: "🇩🇪", available: true },
];

export const DEFAULT_REGION = "syd1";

export function getRegion(id: string): Region {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}
