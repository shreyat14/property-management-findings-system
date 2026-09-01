import { useCallback, useEffect, useState } from 'react'

export function useApiResource(loader) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setState((current) => ({ ...current, error: null, loading: true }))

      try {
        const data = await loader({ signal: controller.signal })
        setState({ data, error: null, loading: false })
      } catch (error) {
        if (error.name !== 'AbortError') {
          setState({ data: null, error, loading: false })
        }
      }
    }

    load()
    return () => controller.abort()
  }, [loader, reloadKey])

  const reload = useCallback(() => setReloadKey((current) => current + 1), [])
  return { ...state, reload }
}
