import React, { useEffect, useState } from 'react'
import { resolveLocationImage } from '../utils/locationImages'

// Identity image for a city / district: verified photo, auto-resolved photo, or a branded
// placeholder — never an unrelated picture. Shows provenance (landmark, source, licence) so a
// photograph is never mistaken for a measurement. Sizes: 'hero' (panoramic), 'chip' (header).
export default function LocationImage({ city, district, state, size = 'chip', showCaption = true }) {
  const [img, setImg] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    setImg(null); setFailed(false)
    resolveLocationImage({ city, district, state }).then(r => { if (live) setImg(r) })
    return () => { live = false }
  }, [city, district, state])

  const name = city || district || state || ''
  const hero = size === 'hero'
  const box = hero
    ? { position: 'relative', width: '100%', height: 150, borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(135deg, #0B1325 0%, #101D2C 60%, #0B1325 100%)', border: '1px solid #1F2937' }
    : { position: 'relative', width: 44, height: 32, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(135deg, #0B1325, #101D2C)', border: '1px solid #1F2937', flex: '0 0 auto' }
  const ok = img && img.src && !failed
  return (
    <div style={box} data-testid={`location-image-${size}`} data-status={img?.status || 'loading'} title={ok ? `${img.landmark || name} · ${img.source}${img.licence ? ` · ${img.licence}` : ''}${img.author ? ` · ${img.author}` : ''}` : `${name}: no verified photograph`}>
      {ok && <img src={img.src} alt={img.alt} onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />}
      {!ok && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: hero ? 'flex-start' : 'center', justifyContent: hero ? 'flex-end' : 'center', padding: hero ? 14 : 0, color: '#93A4B8', fontSize: hero ? 11 : 10 }}>
          <span aria-hidden="true" style={{ fontSize: hero ? 22 : 14, opacity: 0.6 }}>▦</span>
          {hero && <span>{img?.status === 'loading' || !img ? 'Resolving location image…' : 'No verified photograph for this location yet — placeholder shown, never an unrelated image.'}</span>}
        </div>
      )}
      {hero && (
        <div style={{ position: 'absolute', inset: 0, background: ok ? 'linear-gradient(90deg, rgba(6,11,20,0.85) 0%, rgba(6,11,20,0.35) 55%, rgba(6,11,20,0.1) 100%)' : 'none', pointerEvents: 'none' }} />
      )}
      {hero && ok && showCaption && (
        <div style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 9, color: '#93A4B8', background: 'rgba(6,11,20,0.6)', padding: '2px 6px', borderRadius: 4 }}>
          {img.landmark || name} · {img.source}{img.licence ? ` · ${img.licence}` : ''}{img.status === 'auto' ? ' · auto-resolved, not hand-verified' : ''} · photo, not a measurement
        </div>
      )}
    </div>
  )
}
