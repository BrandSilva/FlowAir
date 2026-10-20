import React, { useRef, useState } from 'react'
import Icon from './Icon'

const FINE_SCALE = 0.25
const FADER_TICKS = [0, 25, 50, 75, 100]

const clampVolume = (value) => Math.max(0, Math.min(100, value))

const AudioStrip = ({ level = 0, metering = true, active = false, volume = 100, onVolumeChange }) => {
  const railRef = useRef(null)
  const dragRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const endDrag = (target) => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    try {
      target.releasePointerCapture(drag.pointerId)
    } catch (error) {
    }
    setDragging(false)
  }

  const handlePointerDown = (e) => {
    if (e.button !== 0 || dragRef.current || !onVolumeChange) return
    const rail = railRef.current
    const height = rail ? rail.getBoundingClientRect().height : 0
    if (height <= 0) return
    e.preventDefault()
    dragRef.current = { pointerId: e.pointerId, lastY: e.clientY, value: volume, sent: volume, height }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch (error) {
    }
    setDragging(true)
  }

  const handlePointerMove = (e) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    if (e.buttons === 0) {
      endDrag(e.currentTarget)
      return
    }
    const scale = e.shiftKey ? FINE_SCALE : 1
    drag.value = clampVolume(drag.value + ((drag.lastY - e.clientY) / drag.height) * 100 * scale)
    drag.lastY = e.clientY
    const next = Math.round(drag.value)
    if (next === drag.sent) return
    drag.sent = next
    onVolumeChange(next)
  }

  const handlePointerEnd = (e) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    endDrag(e.currentTarget)
  }

  const shown = metering && active ? Math.round(clampVolume(level)) : 0
  const muted = volume === 0

  return (
    <div style={styles.strip}>
      <div
        style={muted ? styles.headMuted : styles.head}
        title={muted ? 'Output volume is at 0%: nothing is heard on air' : 'Output volume'}
      >
        <Icon name={muted ? 'mute' : 'volume'} size={16} />
        <span style={styles.headLabel}>VOL</span>
      </div>

      <div style={styles.body}>
        <div
          style={metering ? styles.meter : styles.meterOff}
          role="meter"
          aria-label="Audio level on air"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={shown}
          title={metering ? 'Audio level on air' : 'Waiting for the output window: the level shows as soon as its audio arrives'}
        >
          <div style={{ ...styles.meterFill, clipPath: `inset(${100 - shown}% 0 0 0)` }} />
          <div style={styles.meterSegments} />
        </div>

        <div
          style={dragging ? styles.faderActive : styles.fader}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onLostPointerCapture={handlePointerEnd}
          role="slider"
          aria-label="Output volume"
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={volume}
          title="Output volume: drag up or down, hold Shift for fine steps"
        >
          <div ref={railRef} style={styles.rail}>
            {FADER_TICKS.map(tick => (
              <span key={tick} style={{ ...styles.tick, bottom: `${tick}%` }} />
            ))}
            <div style={styles.groove}>
              <div style={{ ...styles.grooveFill, height: `${volume}%` }} />
            </div>
            <div style={{ ...(dragging ? styles.capActive : styles.cap), bottom: `${volume}%` }}>
              <span style={styles.capLine} />
            </div>
          </div>
        </div>
      </div>

      <div style={muted ? styles.valueMuted : styles.value}>{volume}%</div>
    </div>
  )
}

const headBase = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '3px',
  paddingTop: '2px'
}

const meterBase = {
  position: 'relative',
  width: '10px',
  margin: '8px 0',
  borderRadius: '2px',
  background: 'var(--bg-base)',
  border: '1px solid var(--stroke-strong)',
  overflow: 'hidden'
}

const faderBase = {
  position: 'relative',
  width: '32px',
  padding: '8px 0',
  cursor: 'ns-resize',
  touchAction: 'none'
}

const capBase = {
  position: 'absolute',
  left: '50%',
  width: '30px',
  height: '16px',
  transform: 'translate(-50%, 50%)',
  borderRadius: '3px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.6)'
}

const valueBase = {
  textAlign: 'center',
  fontSize: '11px',
  fontWeight: '600',
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
  paddingBottom: '2px'
}

const styles = {
  strip: {
    width: '64px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px 0',
    background: 'var(--bg-layer-1)',
    borderLeft: '1px solid var(--stroke)',
    userSelect: 'none'
  },
  head: {
    ...headBase,
    color: 'var(--text-secondary)'
  },
  headMuted: {
    ...headBase,
    color: 'var(--danger)'
  },
  headLabel: {
    fontSize: '9.5px',
    fontWeight: '700',
    letterSpacing: '0.8px'
  },
  body: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    justifyContent: 'center',
    gap: '6px'
  },
  meter: meterBase,
  meterOff: {
    ...meterBase,
    borderStyle: 'dashed',
    opacity: 0.6
  },
  meterFill: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to top, var(--success) 0%, var(--success) 60%, var(--warning) 60%, var(--warning) 80%, var(--danger) 80%)',
    transition: 'clip-path 0.08s linear'
  },
  meterSegments: {
    position: 'absolute',
    inset: 0,
    background: 'repeating-linear-gradient(to top, transparent 0 3px, rgba(0, 0, 0, 0.5) 3px 4px)'
  },
  fader: faderBase,
  faderActive: {
    ...faderBase,
    cursor: 'grabbing'
  },
  rail: {
    position: 'relative',
    height: '100%'
  },
  tick: {
    position: 'absolute',
    left: '3px',
    right: '3px',
    height: '1px',
    background: 'var(--stroke-strong)'
  },
  groove: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: '6px',
    transform: 'translateX(-50%)',
    borderRadius: '3px',
    background: 'var(--bg-base)',
    border: '1px solid var(--stroke-strong)',
    overflow: 'hidden'
  },
  grooveFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    background: 'var(--accent)'
  },
  cap: {
    ...capBase,
    background: 'linear-gradient(#ededed, #b9b9b9)'
  },
  capActive: {
    ...capBase,
    background: 'linear-gradient(#ffffff, #cfcfcf)',
    boxShadow: '0 0 0 2px var(--accent-soft), 0 1px 3px rgba(0, 0, 0, 0.6)'
  },
  capLine: {
    width: '18px',
    height: '2px',
    borderRadius: '1px',
    background: '#3a3a3a'
  },
  value: {
    ...valueBase,
    color: 'var(--text-primary)'
  },
  valueMuted: {
    ...valueBase,
    color: 'var(--danger)'
  }
}

export default AudioStrip
