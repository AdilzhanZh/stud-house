import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Dormitory } from '../../types/dormitories'

export interface LatLng {
  lat: number
  lng: number
}

// Where the map opens when a dormitory has no point yet (Kyzylorda).
const DEFAULT_CENTER: LatLng = { lat: 44.8488, lng: 65.5093 }
const DEFAULT_ZOOM = 13
const PINNED_ZOOM = 16

export function dormitoryPosition(d: Pick<Dormitory, 'latitude' | 'longitude'>): LatLng | null {
  return d.latitude != null && d.longitude != null ? { lat: d.latitude, lng: d.longitude } : null
}

const pinIcon = L.divIcon({
  className: 'dorm-pin',
  html: '<span class="dorm-pin-pulse"></span><span class="dorm-pin-head"></span>',
  iconSize: [34, 44],
  iconAnchor: [17, 42],
})

interface DormitoryMapProps {
  position: LatLng | null
  // static: a picture of the map (the small preview), nothing reacts.
  // view: free pan/zoom around the point (the full-screen map).
  // pick: as view, but clicking or dragging moves the point. The wheel stays
  // off here so scrolling the long dormitory form doesn't zoom the map.
  mode: 'static' | 'view' | 'pick'
  onPick?: (position: LatLng) => void
  className?: string
}

export function DormitoryMap({ position, mode, onPick, className = '' }: DormitoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  const lastPickRef = useRef<LatLng | null>(null)

  function pick(picked: LatLng) {
    lastPickRef.current = picked
    onPickRef.current?.(picked)
  }

  useEffect(() => {
    if (!containerRef.current) return
    const interactive = mode !== 'static'
    const map = L.map(containerRef.current, {
      center: position ?? DEFAULT_CENTER,
      zoom: position ? PINNED_ZOOM : DEFAULT_ZOOM,
      zoomControl: interactive,
      dragging: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      scrollWheelZoom: mode === 'view',
    })
    map.attributionControl.setPrefix(false)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(map)
    if (mode === 'pick') {
      map.on('click', (e: L.LeafletMouseEvent) => pick({ lat: e.latlng.lat, lng: e.latlng.lng }))
    }
    mapRef.current = map

    // Leaflet measures its container once; keep it right as the layout changes.
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // position is synced by the effect below; the map itself is only built once per mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!position) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    if (markerRef.current) {
      markerRef.current.setLatLng(position)
    } else {
      const marker = L.marker(position, { icon: pinIcon, draggable: mode === 'pick', interactive: mode === 'pick' }).addTo(map)
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLatLng()
        pick({ lat, lng })
      })
      markerRef.current = marker
    }
    // A point that arrived from outside (loaded from the server, address
    // search) needs flying to; one the user just placed is already in view,
    // and jumping the zoom under their cursor would be disorienting.
    if (position !== lastPickRef.current) {
      map.setView(position, PINNED_ZOOM)
    }
  }, [position?.lat, position?.lng, mode])

  // isolate: Leaflet's panes use z-indexes up to 1000, which would otherwise
  // paint over the app's header and dialogs.
  return <div ref={containerRef} className={`isolate bg-navy-800 ${className}`} />
}
