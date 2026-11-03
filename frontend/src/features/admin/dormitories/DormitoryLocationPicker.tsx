import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Search } from 'lucide-react'
import { Alert } from '../../../components/Alert'
import { Button } from '../../../components/Button'
import { Card } from '../../../components/Card'
import { Input } from '../../../components/Input'
import { geocodeAddress, type GeocodeResult } from '../../../api/geocodeApi'
import { DormitoryMap, type LatLng } from '../../dormitories/DormitoryMap'

interface DormitoryLocationPickerProps {
  address: string
  position: LatLng | null
  onChange: (position: LatLng | null) => void
}

// Lives outside the main dormitory <form> (its search box has a form of its
// own); the chosen point is saved together with that form's Save button.
export function DormitoryLocationPicker({ address, position, onChange }: DormitoryLocationPickerProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [queryEdited, setQueryEdited] = useState(false)
  const [results, setResults] = useState<GeocodeResult[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  // Start the search from the dormitory's address until the user types their own.
  useEffect(() => {
    if (!queryEdited) setQuery(address)
  }, [address, queryEdited])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearchError(null)
    setResults(null)
    setIsSearching(true)
    try {
      const found = await geocodeAddress(query.trim())
      setResults(found)
      if (found.length === 1) onChange(found[0].position)
    } catch {
      setSearchError(t('admin.dormitories.locationSearchFailed'))
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <Card title={t('admin.dormitories.location')}>
      <p className="mb-3 text-sm text-sand-300">{t('admin.dormitories.locationHint')}</p>

      <form className="mb-3 flex items-end gap-2" onSubmit={handleSearch}>
        <div className="min-w-0 flex-1">
          <Input
            label={t('admin.dormitories.locationSearch')}
            name="location_search"
            value={query}
            onChange={(e) => {
              setQueryEdited(true)
              setQuery(e.target.value)
            }}
          />
        </div>
        <Button type="submit" variant="secondary" isLoading={isSearching} aria-label={t('admin.dormitories.locationSearch')}>
          <Search className="h-4 w-4" />
        </Button>
      </form>

      {searchError && <Alert variant="error" message={searchError} />}
      {results?.length === 0 && <p className="mb-3 text-sm text-sand-300">{t('admin.dormitories.locationNoResults')}</p>}
      {results && results.length > 1 && (
        <ul className="mb-3 flex flex-col gap-1">
          {results.map((r) => (
            <li key={`${r.position.lat},${r.position.lng}`}>
              <button
                type="button"
                onClick={() => {
                  onChange(r.position)
                  setResults(null)
                }}
                className="w-full rounded-xl bg-navy-800 px-3 py-2 text-left text-sm text-sand-200 hover:bg-navy-700"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <DormitoryMap position={position} mode="pick" onPick={onChange} className="h-80 w-full rounded-2xl md:h-96" />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        {position ? (
          <>
            <span className="inline-flex items-center gap-1.5 font-semibold text-turquoise-400">
              <MapPin className="h-4 w-4" />
              {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
            </span>
            <button type="button" onClick={() => onChange(null)} className="text-sm font-semibold text-clay-400 hover:underline">
              {t('admin.dormitories.locationClear')}
            </button>
          </>
        ) : (
          <span className="text-sand-300">{t('admin.dormitories.locationNotSet')}</span>
        )}
      </div>
    </Card>
  )
}
