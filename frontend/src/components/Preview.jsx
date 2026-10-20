import React, { useState, useEffect } from 'react'
import AudioStrip from './AudioStrip'

const AUDIO_THROTTLE_MS = 120
const AUDIO_STEP = 4
const OUTPUT_AUDIO_TIMEOUT_MS = 2000
const OUTPUT_AUDIO_CHECK_MS = 500
const ACTIVE_CONVERSION = ['queued', 'running']

const isPreparing = (item) => {
  const conversion = item.conversion
  return item.playability === 'preparing' ||
    !!(conversion && typeof conversion === 'object' && ACTIVE_CONVERSION.includes(conversion.status))
}

const getBitrateTag = (bitrate) => {
  const mbpsMatch = bitrate.match(/(\d+(\.\d+)?)\s*Mbps/i)
  const kbpsMatch = bitrate.match(/(\d+(\.\d+)?)\s*kbps/i)

  let mbps = 0
  if (mbpsMatch) {
    mbps = parseFloat(mbpsMatch[1])
  } else if (kbpsMatch) {
    mbps = parseFloat(kbpsMatch[1]) / 1000
  } else {
    return null
  }

  if (mbps <= 5) return { label: ' [LOW]', color: 'var(--text-tertiary)' }
  if (mbps <= 15) return { label: ' [GOOD]', color: 'var(--text-secondary)' }
  return { label: ' [HIGH]', color: 'var(--warning-text)' }
}

const getStatus = (item) => {
  if (!item) return { text: '-', color: 'var(--text-tertiary)', title: '' }

  const issues = Array.isArray(item.issues) ? item.issues : []
  const reason = issues.length > 0 ? issues[0].message : ''
  const title = issues.map(issue => issue.message).join(' • ')

  if (item.status === 'corrupted') {
    return { text: 'CORRUPTED', color: 'var(--danger)', title: title }
  }
  if (item.status === 'validating') {
    return { text: 'VALIDATING', color: 'var(--accent)', title: '' }
  }
  if (isPreparing(item)) {
    return { text: 'PREPARING • skipped on air until ready', color: 'var(--accent)', title: title }
  }
  if (item.playability === 'unsupported') {
    return { text: reason ? `UNSUPPORTED • ${reason}` : 'UNSUPPORTED', color: 'var(--danger)', title: title }
  }
  if (item.playability === 'warn') {
    return { text: reason ? `WARNING • ${reason}` : 'WARNING', color: 'var(--warning-text)', title: title }
  }
  return { text: 'OK', color: 'var(--success)', title: '' }
}

const Preview = ({ currentItem, isPlaying, decoding = true, lowPower = false, countdown = '', onResumePreview, audioLevelSource = null, volume = 100, onVolumeChange }) => {
  const [audioLevel, setAudioLevel] = useState(0)
  const [outputAudioLive, setOutputAudioLive] = useState(false)

  useEffect(() => {
    if (!decoding) return undefined
    let lastAt = 0
    const handleMessage = (event) => {
      if (!event.data || event.data.type !== 'flowair-audio-level') return
      const level = Math.round(event.data.level || 0)
      if (!lowPower) {
        setAudioLevel(prev => (prev === level ? prev : level))
        return
      }
      const now = Date.now()
      if (now - lastAt < AUDIO_THROTTLE_MS) return
      lastAt = now
      const stepped = Math.min(100, Math.round(level / AUDIO_STEP) * AUDIO_STEP)
      setAudioLevel(prev => (prev === stepped ? prev : stepped))
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [decoding, lowPower])

  useEffect(() => {
    setAudioLevel(0)
    setOutputAudioLive(false)
    if (decoding || !audioLevelSource) return undefined
    let lastAt = 0
    const unsubscribe = audioLevelSource.subscribe((value) => {
      lastAt = Date.now()
      const level = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
      const stepped = Math.min(100, Math.round(level / AUDIO_STEP) * AUDIO_STEP)
      setOutputAudioLive(true)
      setAudioLevel(prev => (prev === stepped ? prev : stepped))
    })
    const timer = setInterval(() => {
      if (Date.now() - lastAt < OUTPUT_AUDIO_TIMEOUT_MS) return
      setOutputAudioLive(false)
      setAudioLevel(0)
    }, OUTPUT_AUDIO_CHECK_MS)
    return () => {
      unsubscribe()
      clearInterval(timer)
    }
  }, [audioLevelSource, decoding])

  const previewAudio = !!(decoding && isPlaying && currentItem && currentItem.type === 'video')
  const meterAvailable = decoding || outputAudioLive
  const hasAudio = decoding ? previewAudio : outputAudioLive

  useEffect(() => {
    if (decoding && !previewAudio) {
      setAudioLevel(0)
    }
  }, [decoding, previewAudio])

  const status = getStatus(currentItem)
  const bitrateTag = currentItem && currentItem.bitrate ? getBitrateTag(currentItem.bitrate) : null

  return (
    <div style={styles.container}>
      <div style={styles.previewBox}>
        <div style={styles.header}>
          <span style={styles.title}>ON AIR PREVIEW</span>
          <span style={{ ...styles.headerStatus, color: isPlaying ? 'var(--live)' : 'var(--text-tertiary)' }}>
            {isPlaying ? 'LIVE' : 'IDLE'}
          </span>
        </div>

        <div style={styles.body}>
          <div style={styles.mainColumn}>
            <div style={styles.videoArea}>
              {decoding ? (
                <iframe
                  src="http://localhost:8000/player?muted=1"
                  style={styles.iframe}
                  title="Player Preview"
                  allow="autoplay"
                  tabIndex={-1}
                />
              ) : (
                <div style={styles.pausedPanel}>
                  <span style={styles.pausedBadge}>PREVIEW PAUSED - OUTPUT IS LIVE</span>
                  <span style={styles.pausedName} title={currentItem ? currentItem.name : ''}>
                    {currentItem ? currentItem.name : 'Nothing on air'}
                  </span>
                  <span style={styles.pausedCountdown}>{countdown || '--:--'}</span>
                  <span style={styles.pausedNote}>
                    This PC decodes the picture once, on the output screen. Decoding it here as well is what makes playback stutter.
                  </span>
                  <button style={styles.pausedButton} onClick={onResumePreview}>
                    Show the preview anyway
                  </button>
                </div>
              )}
            </div>

            <div style={styles.infoSection}>
              <div style={styles.infoRow}>
                <span style={styles.label}>File</span>
                <span style={styles.value} title={currentItem ? currentItem.name : ''}>
                  {currentItem ? currentItem.name : '-'}
                </span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.label}>Duration</span>
                <span style={styles.valueNum}>
                  {currentItem ? (currentItem.duration_formatted || currentItem.duration || '-') : '-'}
                </span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.label}>Size</span>
                <span style={styles.valueNum}>
                  {currentItem && currentItem.file_size ? (
                    <>
                      {currentItem.file_size}
                      {currentItem.bitrate && ` • ${currentItem.bitrate}`}
                      {bitrateTag && <span style={{ color: bitrateTag.color, fontWeight: '600' }}>{bitrateTag.label}</span>}
                    </>
                  ) : '-'}
                </span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.label}>Format</span>
                <span style={styles.value}>{currentItem && currentItem.format ? currentItem.format : '-'}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.label}>Status</span>
                <span style={{ ...styles.value, color: status.color, fontWeight: '600' }} title={status.title}>
                  {status.text}
                </span>
              </div>
            </div>
          </div>

          <AudioStrip
            level={audioLevel}
            metering={meterAvailable}
            active={hasAudio}
            volume={volume}
            onVolumeChange={onVolumeChange}
          />
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    padding: '10px',
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    background: 'var(--bg-base)'
  },
  previewBox: {
    background: '#000',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden'
  },
  header: {
    background: 'var(--bg-layer-2)',
    padding: '8px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--stroke)'
  },
  title: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px'
  },
  headerStatus: {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.6px',
    width: '34px',
    textAlign: 'right'
  },
  body: {
    display: 'flex',
    alignItems: 'stretch'
  },
  mainColumn: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column'
  },
  videoArea: {
    width: '100%',
    aspectRatio: '16/9',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '1px solid var(--stroke)',
    position: 'relative',
    overflow: 'hidden'
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none'
  },
  pausedPanel: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px 18px',
    textAlign: 'center',
    background: 'var(--bg-layer-1)'
  },
  pausedBadge: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.8px',
    color: 'var(--warning-text)',
    background: 'rgba(224, 179, 65, 0.14)',
    border: '1px solid rgba(224, 179, 65, 0.35)',
    borderRadius: '999px',
    padding: '3px 10px'
  },
  pausedName: {
    maxWidth: '100%',
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  pausedCountdown: {
    fontSize: '30px',
    fontWeight: '600',
    color: 'var(--accent)',
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '1px',
    lineHeight: 1
  },
  pausedNote: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    lineHeight: '1.45',
    maxWidth: '340px'
  },
  pausedButton: {
    padding: '5px 12px',
    background: 'var(--bg-layer-3)',
    border: '1px solid var(--stroke-strong)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    fontWeight: '600'
  },
  infoSection: {
    flex: 1,
    padding: '12px',
    background: 'var(--bg-layer-1)'
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    height: '26px',
    borderBottom: '1px solid var(--stroke-subtle)'
  },
  label: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    fontWeight: '600',
    width: '62px',
    flexShrink: 0
  },
  value: {
    flex: 1,
    minWidth: 0,
    fontSize: '12px',
    color: 'var(--text-primary)',
    fontWeight: '500',
    textAlign: 'right',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  valueNum: {
    flex: 1,
    minWidth: 0,
    fontSize: '12px',
    color: 'var(--text-primary)',
    fontWeight: '500',
    textAlign: 'right',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums'
  }
}

export default Preview
