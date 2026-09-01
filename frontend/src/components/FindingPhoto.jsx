import { useEffect, useState } from 'react'
import { getFindingPhoto } from '../api/findingsApi.js'

export function FindingPhoto({ findingId, issue }) {
  const [source, setSource] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl = ''

    getFindingPhoto(findingId, { signal: controller.signal }).then((blob) => {
      objectUrl = URL.createObjectURL(blob)
      setSource(objectUrl)
    }).catch((error) => {
      if (error.name !== 'AbortError') setFailed(true)
    })

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [findingId])

  if (failed) return <div className="finding-photo finding-photo--unavailable">Photo unavailable</div>
  if (!source) return <div className="finding-photo finding-photo--loading">Loading photo…</div>
  return <img className="finding-photo" src={source} alt={`Inspection finding: ${issue}`} />
}
