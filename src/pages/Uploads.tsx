import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

const BASE = `${import.meta.env.VITE_BACKEND_URL}/api/multipart-uploads`

const storageKey = (file: File) => `upload:${file.name}:${file.size}:${file.lastModified}`

// const PART_SIZE = 5 * 1024 * 1024 // S3 minimum for all but the last part

export default function Uploads() {
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const currentRef = useRef<{ uploadId: string; key: string } | null>(null)

  const onFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // re-selecting the same file re-fires onChange (this is how resume is triggered)
    if (!file) return
    const key = storageKey(file)
    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller
    setUploading(true)

    try {
      // resume if this file has an interrupted upload from a previous attempt
      let uploadId = localStorage.getItem(key)
      let partSize = 0
      let partCount = 0
      let uploadedParts: number[] = []

      if (uploadId) {
        const res = await fetch(`${BASE}/${uploadId}/status`, { signal })
        const s = res.ok ? await res.json() : null
        if (s?.status === 'INITIATED') {
          ;({ partSize, partCount, uploadedParts } = s)
        } else {
          localStorage.removeItem(key) // completed, aborted, or unknown — start over
          uploadId = null
        }
      }

      if (!uploadId) {
        const init = await fetch(`${BASE}/initiate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, fileSize: file.size, contentType: file.type }),
          signal,
        })
        if (!init.ok) throw new Error(`initiate: HTTP ${init.status}`)
        ;({ uploadId, partSize, partCount } = await init.json())
        localStorage.setItem(key, uploadId!)
      }

      currentRef.current = { uploadId: uploadId!, key }

      const done = new Set(uploadedParts)
      for (let partNumber = 1; partNumber <= partCount; partNumber++) {
        if (done.has(partNumber)) continue
        setStatus(`uploading part ${partNumber}/${partCount}`)
        // presigned URLs expire after 15 min, so fetch each part's URL just before use
        const urlRes = await fetch(`${BASE}/${uploadId}/part-urls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ partNumbers: [partNumber] }),
          signal,
        })
        if (!urlRes.ok) throw new Error(`part-urls: HTTP ${urlRes.status}`)
        const [{ url }] = await urlRes.json()
        const start = (partNumber - 1) * partSize
        const res = await fetch(url, { method: 'PUT', body: file.slice(start, start + partSize), signal })
        if (!res.ok) throw new Error(`part ${partNumber}: HTTP ${res.status}`)
      }

      setStatus('completing…')
      const doneRes = await fetch(`${BASE}/${uploadId}/complete`, { method: 'PUT', signal })
      if (!doneRes.ok) throw new Error(`complete: HTTP ${doneRes.status}`)
      localStorage.removeItem(key)
      currentRef.current = null
      setStatus('done')
    } catch (err) {
      if (controller.signal.aborted) return // cancel handler owns status + cleanup
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
      abortRef.current = null
    }
  }

  const onCancel = async () => {
    abortRef.current?.abort()
    const current = currentRef.current
    if (!current) return
    currentRef.current = null
    localStorage.removeItem(current.key)
    await fetch(`${BASE}/${current.uploadId}`, { method: 'DELETE' })
    setStatus('cancelled')
  }

  return (
    <main>
      <h1>Uploads</h1>
      <input type="file" onChange={onFileSelected} disabled={uploading} />
      {uploading && <button onClick={onCancel}>Cancel</button>}
      <p>{status}</p>
    </main>
  )
}

// export default function Uploads() {
//   const [status, setStatus] = useState('')

//   const onFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0]
//     e.target.value = '' // re-selecting the same file re-fires onChange (matters for resume later)
//     if (!file) return
//     try {
//       const partCount = Math.ceil(file.size / PART_SIZE)
//       const init = await fetch(`${BASE}/initiate`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           filename: file.name,
//           contentType: file.type,
//           partCount,
//         }),
//       }).then((r) => r.json())

//       const parts: { partNumber: number; eTag: string }[] = []
//       for (const { partNumber, url } of init.partUrls) {
//         setStatus(`uploading part ${partNumber}/${partCount}`)
//         const start = (partNumber - 1) * PART_SIZE
//         const res = await fetch(url, { method: 'PUT', body: file.slice(start, start + PART_SIZE) })
//         if (!res.ok) throw new Error(`part ${partNumber}: HTTP ${res.status}`)
//         const eTag = res.headers.get('ETag')
//         if (!eTag) throw new Error('no ETag — check bucket CORS ExposeHeaders')
//         parts.push({ partNumber, eTag })
//       }

//       setStatus('completing…')
//       const done = await fetch(`${BASE}/complete`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ key: init.key, uploadId: init.uploadId, parts }),
//       })
//       setStatus(done.ok ? 'done' : `complete failed: HTTP ${done.status}`)
//     } catch (err) {
//       setStatus(err instanceof Error ? err.message : String(err))
//     }
//   }

//   return (
//     <main>
//       <h1>Uploads</h1>
//       <input type="file" onChange={onFileSelected} />
//       <p>{status}</p>
//     </main>
//   )
// }
