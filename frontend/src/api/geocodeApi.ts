import type { LatLng } from '../features/dormitories/DormitoryMap'

export interface GeocodeResult {
  label: string
  position: LatLng
}

// OpenStreetMap's public geocoder. Plain fetch, not apiClient: that one would
// attach the user's access token to a third-party request. Its usage policy
// forbids search-as-you-type, so only call this on an explicit search.
export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', countrycodes: 'kz' })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
  if (!res.ok) throw new Error(`geocoder responded ${res.status}`)
  const data: { display_name: string; lat: string; lon: string }[] = await res.json()
  return data.map((r) => ({
    label: r.display_name,
    position: { lat: Number(r.lat), lng: Number(r.lon) },
  }))
}
