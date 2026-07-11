import { create } from 'zustand'

export type Theme = 'day' | 'night'

const STORAGE_KEY = 'student-house-theme'

function readStoredTheme(): Theme {
  return localStorage.getItem(STORAGE_KEY) === 'day' ? 'day' : 'night'
}

// index.html has a tiny inline bootstrap script that sets this same
// attribute before React mounts (avoids a flash of the wrong theme); this
// just keeps localStorage and the DOM attribute in sync afterward.
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem(STORAGE_KEY, theme)
}

interface ThemeState {
  theme: Theme
  toggle: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readStoredTheme(),
  toggle: () => {
    const next: Theme = get().theme === 'night' ? 'day' : 'night'
    applyTheme(next)
    set({ theme: next })
  },
}))
