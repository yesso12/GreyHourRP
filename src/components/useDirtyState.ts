import { useEffect, useRef, useState } from 'react'

export function useDirtyState<T>(initial: T) {
  const [value, setValue] = useState<T>(initial)
  const [dirty, setDirty] = useState(false)
  const initialRef = useRef<T>(initial)

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function update(v: T) {
    setValue(v)
    setDirty(true)
  }

  function markSaved(v?: T) {
    if (v !== undefined) {
      setValue(v)
      initialRef.current = v
    }
    setDirty(false)
  }

  return {
    value,
    set: update,
    dirty,
    markSaved
  }
}
