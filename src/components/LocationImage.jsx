import React, { useEffect, useRef, useState } from 'react'
import { resolveLocationImage, AUTO_LABEL } from '../utils/locationImages'

// Identity image for a city / district: verified photo, auto-resolved photo (Wikimedia Commons,
// then Openverse), or a branded placeholder — never an unrelated picture. Shows provenance
// (landmark, creator, licence, source page) so a photograph is never mistaken for a measurement
// and every licence's attribution terms are met. If an image URL fails to load, the next source
// is tried before falling back to the placeholder. Sizes: 'hero' (panoramic), 'chip' (header).
export default function LocationImage({ city, district, state, size = 'chip', showCaption = true }) {
  const [img, setImg] = useState(null)
  const skip = useRef(new Set())
  const run = useRef(0)
  const resolve = () => {
    const id = ++run.current
    resolveLocationImage({ city, district, state, skip: skip.current }).then(r => { if (id === run.current) setImg(r) }).catch(() => {})
  }
  useEffect(() => { skip.current = new Set(); setImg(null); resolve(); return () => { run.current++ } }, [city, district, state]) // eslint-disable-line react-hooks/exhaustive-deps
  const onError = () => { if (img?.src) { skip.current.add(img.src); setImg(null); resolve() } }

  const name = city || district || state || ''
  const hero = size === 'hero'
  const box = hero
    ? { position: 'relative', width: '100%', height: 150, borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(135deg, #0B1325 0%, #101D2C 60%, #0B1325 100%)', border: '1px solid #1F2937' }
    : { position: 'relative', width: 44, height: 32, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(135deg, #0B1325, #101D2C)', border: '1px solid #1F2937', flex: '0 0 auto' }
  const ok = img && img.src
  const auto = img?.status === 'auto'
  const credit = ok ? [img.landmark || (auto ? null : name), img.author ? `© ${img.author}` : null, img.licence, img.source].filter(Boolean).join(' · ') : ''
  return (
    <div style={box} data-testid={`location-image-${size}`} data-status={img?.status || 'loading'} data-provider={img?.provider || ''}
      title={ok ? `${img.attribution || credit}${auto ? ` · ${AUTO_LABEL}` : ''}` : `${name}: no verified photograph`}>
      {ok && <img src={img.src} alt={img.alt} onError={onError} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />}
      {!ok && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: hero ? 'flex-start' : 'center', justifyContent: hero ? 'flex-end' : 'center', padding: hero ? 14 : 0, color: '#93A4B8', fontSize: hero ? 11 : 10 }}>
          <span aria-hidden="true" style={{ fontSize: hero ? 22 : 14, opacity: 0.6 }}>▦</span>
          {hero && <span>{!img ? 'Resolving location image…' : 'No verified photograph for this location yet — placeholder shown, never an unrelated image.'}</span>}
        </div>
      )}
      {hero && (
        <div style={{ position: 'absolute', inset: 0, background: ok ? 'linear-gradient(90deg, rgba(6,11,20,0.85) 0%, rgba(6,11,20,0.35) 55%, rgba(6,11,20,0.1) 100%)' : 'none', pointerEvents: 'none' }} />
      )}
      {hero && ok && (showCaption || auto) && (
        <div data-testid="image-credit" style={{ position: 'absolute', right: 10, bottom: 8, maxWidth: '92%', fontSize: 9, color: '#93A4B8', background: 'rgba(6,11,20,0.7)', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {auto && <b data-testid="image-auto-label" style={{ color: '#F59E0B' }}>{AUTO_LABEL} · </b>}
          {img.sourcePage ? <a href={img.sourcePage} target="_blank" rel="noopener noreferrer" style={{ color: '#93A4B8' }}>{credit}</a> : credit}
          {img.licenceUrl && <> · <a href={img.licenceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#93A4B8' }}>licence</a></>} · photo, not a measurement
        </div>
      )}
    </div>
  )
}
