import React, { useState, useRef } from 'react'
import Icon from './Icon'

const ACTIVATION_KEYS = [' ', 'Spacebar', 'Enter']
const TICKS = [25, 50, 75]

const keepFocusAway = (e) => {
  e.preventDefault()
}

const releaseFocus = () => {
  const active = document.activeElement
  if (active && active !== document.body && typeof active.blur === 'function') active.blur()
}

const blockNativeActivation = (e) => {
  if (ACTIVATION_KEYS.includes(e.key)) e.preventDefault()
}

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const parseDuration = (durationStr) => {
  if (!durationStr || durationStr === 'STATIC' || typeof durationStr !== 'string') return 0
  const parts = durationStr.split(':')
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2])
  }
  return 0
}

const Timer = ({ currentItem, isPlaying, serverElapsed = 0, editMode = false, onToggleEditMode, onSeek }) => {
  const [dragPct, setDragPct] = useState(null)
  const [hoverPct, setHoverPct] = useState(null)
  const barRef = useRef(null)
  const dragRef = useRef(false)
  const currentTime = Math.floor(serverElapsed)

  const totalTime = currentItem ? parseDuration(currentItem.duration_formatted || currentItem.duration) : 0
  const remaining = Math.max(0, totalTime - currentTime)
  const baseProgress = totalTime > 0 ? (currentTime / totalTime) * 100 : 0
  const isVideo = currentItem && currentItem.type === 'video' && totalTime > 0
  const canScrub = editMode && isVideo
  const progress = Math.min(100, dragPct !== null ? dragPct * 100 : baseProgress)
  const countsDown = isPlaying && totalTime > 0 && !(currentItem && currentItem.loop && currentItem.type === 'video')
  const tone = countsDown && remaining <= 5 ? 'danger' : (countsDown && remaining <= 10 ? 'warning' : 'accent')
  const hoverVisible = canScrub && dragPct === null && hoverPct !== null

  const seekHint = !editMode
    ? ''
    : !isVideo
      ? 'Seeking works on video clips only'
      : dragPct !== null
        ? `Release to seek to ${formatTime(Math.floor(dragPct * totalTime))}`
        : hoverPct !== null
          ? `Click to seek to ${formatTime(Math.floor(hoverPct * totalTime))}`
          : 'Drag or click the bar to seek'

  const pctFromClientX = (clientX) => {
    const el = barRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  const trackHover = (e) => {
    if (!canScrub || dragRef.current) return
    setHoverPct(pctFromClientX(e.clientX))
  }

  const startScrub = (e) => {
    if (!canScrub || dragRef.current || e.button !== 0) return
    e.preventDefault()

    const target = e.currentTarget
    const pointerId = e.pointerId
    const itemId = currentItem ? currentItem.id : null
    dragRef.current = true
    setHoverPct(null)
    setDragPct(pctFromClientX(e.clientX))

    const detach = () => {
      dragRef.current = false
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onCancel)
      try {
        target.releasePointerCapture(pointerId)
      } catch (error) {}
      setDragPct(null)
    }

    const onMove = (ev) => {
      if (ev.buttons === 0) {
        detach()
        return
      }
      setDragPct(pctFromClientX(ev.clientX))
    }

    const onUp = (ev) => {
      const pct = pctFromClientX(ev.clientX)
      detach()
      if (onSeek) onSeek(pct * totalTime, itemId)
    }

    const onCancel = () => detach()

    try {
      target.setPointerCapture(pointerId)
    } catch (error) {}
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onCancel)
  }

  return (
    <div style={styles.container}>
      <div style={styles.timeDisplay}>
        <div style={styles.timeLabel}>Remaining</div>
        <div style={{ ...timeValueBase, color: TONE_COLORS[tone] }}>{formatTime(remaining)}</div>
        <button
          className="transport-btn"
          tabIndex={-1}
          onMouseDown={keepFocusAway}
          onFocus={releaseFocus}
          onKeyDown={blockNativeActivation}
          onKeyUp={blockNativeActivation}
          style={editMode ? styles.editToggleActive : styles.editToggle}
          onClick={() => {
            releaseFocus()
            if (onToggleEditMode) onToggleEditMode(!editMode)
          }}
          aria-pressed={editMode}
          title={editMode
            ? 'Lock the timeline again'
            : 'Unlock the timeline to seek inside the clip on air (locked by default to prevent accidental changes)'}
        >
          <Icon name={editMode ? 'unlock' : 'lock'} size={14} />
          EDIT TIMELINE
        </button>
      </div>

      <div
        style={canScrub ? styles.barHitScrub : styles.barHit}
        onPointerDown={startScrub}
        onPointerMove={trackHover}
        onPointerLeave={() => setHoverPct(null)}
      >
        <div ref={barRef} style={canScrub ? styles.trackEdit : styles.track}>
          <div
            style={{
              ...styles.fill,
              ...FILL_TONES[tone],
              width: `${progress}%`,
              ...(dragPct !== null ? { transition: 'none' } : {})
            }}
          />
          {TICKS.map(tick => (
            <div key={tick} style={{ ...styles.tick, left: `${tick}%` }} />
          ))}
          {hoverVisible && <div style={{ ...styles.hoverMarker, left: `${hoverPct * 100}%` }} />}
          {canScrub && <div style={{ ...styles.scrubThumb, left: `${progress}%` }} />}
        </div>
      </div>

      <div style={styles.timeInfo}>
        <span style={styles.infoStart}>{formatTime(currentTime)} elapsed</span>
        <span style={styles.seekHint}>{seekHint}</span>
        <span style={styles.infoEnd}>{formatTime(totalTime)} total</span>
      </div>
    </div>
  )
}

const TONE_COLORS = {
  accent: 'var(--accent)',
  warning: 'var(--warning)',
  danger: 'var(--danger)'
}

const FILL_TONES = {
  accent: {
    background: 'linear-gradient(90deg, color-mix(in srgb, var(--accent) 55%, #000), var(--accent))',
    boxShadow: '0 0 10px color-mix(in srgb, var(--accent) 40%, transparent)'
  },
  warning: {
    background: 'linear-gradient(90deg, color-mix(in srgb, var(--warning) 55%, #000), var(--warning))',
    boxShadow: '0 0 10px color-mix(in srgb, var(--warning) 40%, transparent)'
  },
  danger: {
    background: 'linear-gradient(90deg, color-mix(in srgb, var(--danger) 55%, #000), var(--danger))',
    boxShadow: '0 0 10px color-mix(in srgb, var(--danger) 45%, transparent)'
  }
}

const editToggleBase = {
  marginLeft: 'auto',
  padding: '0 12px',
  minHeight: '26px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '7px',
  background: 'var(--bg-layer-3)',
  border: '1px solid var(--stroke-strong)',
  borderRadius: '999px',
  color: 'var(--text-tertiary)',
  fontSize: '11px',
  fontWeight: '700',
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap',
  transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease'
}

const timeValueBase = {
  fontSize: '34px',
  fontWeight: '600',
  fontFamily: 'var(--font-mono)',
  letterSpacing: '1px',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
  minWidth: '5ch',
  transition: 'color 0.12s ease'
}

const trackBase = {
  position: 'relative',
  width: '100%',
  height: '8px',
  background: 'var(--bg-layer-3)',
  borderRadius: '999px',
  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.45)',
  transition: 'box-shadow 0.15s ease'
}

const barHitBase = {
  padding: '7px 0',
  marginBottom: '1px',
  touchAction: 'none'
}

const infoBase = {
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap'
}

const styles = {
  container: {
    background: 'var(--bg-layer-1)',
    padding: '14px 18px',
    borderBottom: '1px solid var(--stroke)'
  },
  timeDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '10px'
  },
  timeLabel: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.6px'
  },
  editToggle: editToggleBase,
  editToggleActive: {
    ...editToggleBase,
    background: 'var(--accent-soft)',
    borderColor: 'rgba(76, 194, 255, 0.5)',
    color: 'var(--accent-hover)'
  },
  barHit: barHitBase,
  barHitScrub: {
    ...barHitBase,
    cursor: 'pointer'
  },
  track: trackBase,
  trackEdit: {
    ...trackBase,
    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(76, 194, 255, 0.45)'
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: '999px',
    transition: 'width 0.3s ease, box-shadow 0.2s ease'
  },
  tick: {
    position: 'absolute',
    top: '1px',
    bottom: '1px',
    width: '1px',
    marginLeft: '-0.5px',
    background: 'rgba(255, 255, 255, 0.14)',
    pointerEvents: 'none'
  },
  hoverMarker: {
    position: 'absolute',
    top: '-4px',
    bottom: '-4px',
    width: '2px',
    marginLeft: '-1px',
    borderRadius: '1px',
    background: 'rgba(255, 255, 255, 0.55)',
    pointerEvents: 'none'
  },
  scrubThumb: {
    position: 'absolute',
    top: '50%',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: '#fff',
    border: '2px solid var(--accent)',
    transform: 'translate(-50%, -50%)',
    boxShadow: '0 0 0 3px rgba(76, 194, 255, 0.25), 0 1px 4px rgba(0, 0, 0, 0.5)',
    pointerEvents: 'none'
  },
  timeInfo: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    gap: '12px',
    fontSize: '11px',
    lineHeight: '16px',
    color: 'var(--text-tertiary)'
  },
  infoStart: infoBase,
  infoEnd: {
    ...infoBase,
    justifySelf: 'end'
  },
  seekHint: {
    color: 'var(--accent)',
    fontWeight: '600',
    whiteSpace: 'nowrap'
  }
}

export default Timer
