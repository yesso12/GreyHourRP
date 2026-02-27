import { useEffect, useMemo, useState } from 'react'
import { AdminSaveBar } from '../../components/AdminSaveBar'
import type { HomeMedia } from '../../types/content'
import { DEFAULT_HOME_MEDIA, loadHomeMedia, saveHomeMedia, uploadHomeMediaVideoWithProgress } from '../api/client'

function toEmbedUrl(rawUrl: string) {
  const url = rawUrl.trim()
  if (!url) return null

  try {
    const u = new URL(url)

    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/').filter(Boolean).pop()
        if (!id) return null
        return `https://www.youtube.com/embed/${id}`
      }
      const id = u.searchParams.get('v')
      if (!id) return null
      return `https://www.youtube.com/embed/${id}`
    }

    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace('/', '').trim()
      if (!id) return null
      return `https://www.youtube.com/embed/${id}`
    }

    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop()
      if (!id) return null
      return `https://player.vimeo.com/video/${id}`
    }
  } catch {
    return null
  }

  return null
}

function looksLikeDirectVideo(url: string) {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url)
}

export function AdminHomeMedia() {
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadNote, setUploadNote] = useState<string | null>(null)
  const [data, setData] = useState<HomeMedia>(DEFAULT_HOME_MEDIA)

  useEffect(() => {
    loadHomeMedia()
      .then((loaded) => setData({ ...DEFAULT_HOME_MEDIA, ...loaded }))
      .catch(() => setData(DEFAULT_HOME_MEDIA))
      .finally(() => setLoading(false))
  }, [])

  const embedUrl = useMemo(() => toEmbedUrl(data.videoUrl), [data.videoUrl])
  const directVideo = useMemo(() => looksLikeDirectVideo(data.videoUrl), [data.videoUrl])

  function update(patch: Partial<HomeMedia>) {
    setData(prev => ({ ...prev, ...patch }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await saveHomeMedia(data)
      setDirty(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  async function uploadFile(file: File | null) {
    if (!file) return
    setUploading(true)
    setUploadProgress(0)
    setDragActive(false)
    setError(null)
    setUploadNote(null)
    try {
      const result = await uploadHomeMediaVideoWithProgress(file, setUploadProgress)
      update({ videoUrl: result.url })
      setUploadNote(`Uploaded ${result.fileName} (${Math.round(result.size / (1024 * 1024))} MB)`)
    } catch (err) {
      setError(String(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Content</div>
          <h1>Homepage Video</h1>
          <p className="admin-sub">Add a gameplay clip or trailer and show it on the public homepage.</p>
        </div>
      </div>

      {loading ? (
        <div className="admin-card">Loading video settings…</div>
      ) : (
        <div className="admin-grid two">
          <div className="admin-card">
            <label className="admin-field checkbox">
              <input
                type="checkbox"
                checked={data.enabled}
                onChange={(e) => update({ enabled: e.target.checked })}
              />
              <span>Show on homepage</span>
            </label>

            <label className="admin-field" style={{ marginTop: 10 }}>
              <span>Section title</span>
              <input
                className="admin-input"
                value={data.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="Gameplay Trailer"
              />
            </label>

            <label className="admin-field" style={{ marginTop: 10 }}>
              <span>Description</span>
              <textarea
                className="admin-textarea"
                rows={4}
                value={data.description ?? ''}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="Show players what makes Grey Hour different."
              />
            </label>

            <label className="admin-field" style={{ marginTop: 10 }}>
              <span>Video URL (YouTube, Vimeo, or direct .mp4)</span>
              <input
                className="admin-input"
                value={data.videoUrl}
                onChange={(e) => update({ videoUrl: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </label>

            <label className="admin-field" style={{ marginTop: 10 }}>
              <span>Upload video file (mp4/webm/ogg/mov, max 350MB)</span>
              <div
                className={`admin-dropzone ${dragActive ? 'active' : ''}`}
                onDragEnter={(e) => {
                  e.preventDefault()
                  if (!uploading) setDragActive(true)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (!uploading) setDragActive(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
                  setDragActive(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (uploading) return
                  const file = e.dataTransfer.files?.[0] ?? null
                  uploadFile(file)
                }}
              >
                <div className="admin-dropzone-title">
                  {uploading ? 'Uploading…' : 'Drag and drop video here'}
                </div>
                <div className="admin-dropzone-sub">or choose a file below</div>
              </div>
              <input
                className="admin-input"
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.webm,.ogg,.mov"
                onChange={(e) => uploadFile(e.currentTarget.files?.[0] ?? null)}
                disabled={uploading}
              />
            </label>
            {uploading && (
              <div className="admin-progress-wrap">
                <div className="admin-progress-bar" style={{ width: `${uploadProgress}%` }} />
                <div className="admin-progress-label">{uploadProgress}%</div>
              </div>
            )}
            {uploadNote && <div className="admin-card-sub">{uploadNote}</div>}

            <div className="admin-grid two" style={{ marginTop: 10 }}>
              <label className="admin-field">
                <span>CTA label</span>
                <input
                  className="admin-input"
                  value={data.ctaLabel ?? ''}
                  onChange={(e) => update({ ctaLabel: e.target.value })}
                  placeholder="Join the Discord"
                />
              </label>
              <label className="admin-field">
                <span>CTA URL</span>
                <input
                  className="admin-input"
                  value={data.ctaUrl ?? ''}
                  onChange={(e) => update({ ctaUrl: e.target.value })}
                  placeholder="https://discord.gg/..."
                />
              </label>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title">Preview</div>
            </div>
            {!data.videoUrl.trim() ? (
              <div className="admin-card-sub" style={{ marginTop: 10 }}>Add a URL to preview.</div>
            ) : embedUrl ? (
              <div className="home-video-frame" style={{ marginTop: 10 }}>
                <iframe
                  src={embedUrl}
                  title="Homepage video preview"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : directVideo ? (
              <div className="home-video-frame" style={{ marginTop: 10 }}>
                <video src={data.videoUrl} controls playsInline />
              </div>
            ) : (
              <div className="admin-card-sub" style={{ marginTop: 10 }}>
                URL not recognized. Use YouTube, Vimeo, or a direct .mp4 link.
              </div>
            )}
          </div>
        </div>
      )}

      <AdminSaveBar dirty={dirty} saving={saving} error={error} onSave={save} />
    </div>
  )
}
