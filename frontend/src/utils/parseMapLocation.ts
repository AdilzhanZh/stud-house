import type { LatLng } from '../features/dormitories/DormitoryMap'

export type ParsedMapLocation =
  | { kind: 'ok'; position: LatLng }
  | { kind: 'short_link' }
  | { kind: 'invalid' }

const NUM = '(-?\\d{1,3}(?:\\.\\d+)?)'

// Share links redirect to the real URL, which the browser can't follow for us
// (cross-origin), so they hold no coordinates we could read.
const SHORT_LINK = /^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl|go\.2gis\.com)(\/|$)/i

// Tried in order; the first match wins. In Google's URLs !3d!4d is the place
// itself while @ is only the centre of the view, so @ has to come after it.
// 2GIS writes longitude first everywhere, Google latitude first.
const LAT_FIRST = [
  new RegExp(`!3d${NUM}!4d${NUM}`),
  new RegExp(`[?&](?:q|query|ll|center|destination)=${NUM},${NUM}(?:[&#]|$)`),
  new RegExp(`/@${NUM},${NUM}`),
]
const LNG_FIRST_2GIS = [new RegExp(`/${NUM},${NUM}(?:[/?#]|$)`), new RegExp(`[?&]m=${NUM},${NUM}`)]
const PLAIN_COORDINATES = new RegExp(`^${NUM}[,;\\s]\\s*${NUM}$`)

function toPosition(lat: number, lng: number): ParsedMapLocation {
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { kind: 'invalid' }
  return { kind: 'ok', position: { lat, lng } }
}

// Reads a point from what a user can copy out of Google Maps or 2GIS: plain
// "lat, lng" coordinates or a full URL from the browser's address bar.
export function parseMapLocation(input: string): ParsedMapLocation {
  const text = input.trim()
  if (SHORT_LINK.test(text)) return { kind: 'short_link' }

  const plain = text.match(PLAIN_COORDINATES)
  if (plain) return toPosition(Number(plain[1]), Number(plain[2]))

  let decoded: string
  try {
    decoded = decodeURIComponent(text)
  } catch {
    decoded = text
  }

  if (/^(https?:\/\/)?([\w-]+\.)*2gis\./i.test(decoded)) {
    for (const pattern of LNG_FIRST_2GIS) {
      const m = decoded.match(pattern)
      if (m) return toPosition(Number(m[2]), Number(m[1]))
    }
    return { kind: 'invalid' }
  }
  if (/^(https?:\/\/)?([\w-]+\.)*google\.[^/]+\/maps|^(https?:\/\/)?maps\.google\./i.test(decoded)) {
    for (const pattern of LAT_FIRST) {
      const m = decoded.match(pattern)
      if (m) return toPosition(Number(m[1]), Number(m[2]))
    }
  }
  return { kind: 'invalid' }
}
