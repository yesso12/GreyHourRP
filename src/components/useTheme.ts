import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const KEY = 'ghrp_theme'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Theme | null)
    if (saved) setTheme(saved)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(KEY, theme)
  }, [theme])

  return {
    theme,
    toggle: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')),
    setTheme
  }
}
