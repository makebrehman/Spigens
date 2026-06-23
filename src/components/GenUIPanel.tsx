'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, X, ArrowUp, History, Undo2, RotateCcw, ChevronLeft, Check, Clock, Sparkles } from 'lucide-react'
import { startVoiceInput, type VoiceSession } from '@/lib/voiceInput'
import type { GenUIVersion } from '@/stores/uiStore'

export interface GenUIPanelProps {
  isOpen: boolean
  isGenerating: boolean
  onClose: () => void
  onGenerate: (message: string) => void
  lastError?: string | null
  onUndo?: () => void
  onReset?: () => void
  canUndo?: boolean
  versions?: GenUIVersion[]
  activeVersionId?: string | null
  onRestoreVersion?: (id: string) => void
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function GenUIPanel({
  isOpen,
  isGenerating,
  onClose,
  onGenerate,
  lastError,
  onUndo,
  onReset,
  canUndo,
  versions = [],
  activeVersionId = null,
  onRestoreVersion,
}: GenUIPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [view, setView] = useState<'main' | 'versions'>('main')
  const [focused, setFocused] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const voiceRef = useRef<VoiceSession | null>(null)
  const baseTextRef = useRef('')

  useEffect(() => {
    if (isOpen && view === 'main' && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen, view])

  // tear down any active voice session when closing
  useEffect(() => {
    if (!isOpen && voiceRef.current) {
      voiceRef.current.stop()
      voiceRef.current = null
      setIsListening(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }

  const toggleVoice = async () => {
    setVoiceError(null)
    if (isListening) {
      voiceRef.current?.stop()
      voiceRef.current = null
      setIsListening(false)
      return
    }
    baseTextRef.current = inputValue ? inputValue.trim() + ' ' : ''
    const session = await startVoiceInput({
      onTranscript: (text) => {
        const combined = (baseTextRef.current + text).slice(0, 2000)
        setInputValue(combined)
        if (textareaRef.current) autoGrow(textareaRef.current)
      },
      onError: (msg) => { setVoiceError(msg); setIsListening(false); voiceRef.current = null },
      onEnd: () => { setIsListening(false); voiceRef.current = null },
    })
    if (session) {
      voiceRef.current = session
      setIsListening(true)
    }
  }

  const submit = () => {
    if (inputValue.trim() && !isGenerating) {
      if (voiceRef.current) { voiceRef.current.stop(); voiceRef.current = null; setIsListening(false) }
      onGenerate(inputValue)
      setInputValue('')
    }
  }

  const borderStyle = {
    backgroundSize: '300% 300%',
    animation: 'gradient-border-flow 2s ease infinite, gen-ui-pulse 1.5s ease-in-out infinite',
    zIndex: 9998,
    pointerEvents: 'none' as const,
  }

  const accent = '#7C3AED'

  return (
    <>
      {isGenerating && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #7C3AED, #2563EB, #10B981, #F59E0B, #EF4444, #7C3AED)', ...borderStyle }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #7C3AED, #2563EB, #10B981, #F59E0B, #EF4444, #7C3AED)', ...borderStyle }} />
          <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, width: '4px', background: 'linear-gradient(180deg, #7C3AED, #2563EB, #10B981, #F59E0B, #EF4444, #7C3AED)', ...borderStyle }} />
          <div style={{ position: 'fixed', top: 0, bottom: 0, right: 0, width: '4px', background: 'linear-gradient(180deg, #7C3AED, #2563EB, #10B981, #F59E0B, #EF4444, #7C3AED)', ...borderStyle }} />
        </>
      )}

      <div
        onClick={() => { if (!isGenerating) onClose() }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', zIndex: 9990 }}
      />

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9991,
          background: 'linear-gradient(180deg, #1d1d20 0%, #161618 100%)',
          borderRadius: '24px 24px 0 0',
          padding: '10px 18px calc(var(--sab) + 18px) 18px',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderBottom: 'none',
          maxWidth: 560,
          margin: '0 auto',
        }}
      >
        <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.18)', borderRadius: '999px', margin: '0 auto 14px auto' }} />

        {view === 'main' ? (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles size={18} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#F3F4F6', lineHeight: 1.2 }}>Customize your UI</div>
                <div style={{ fontSize: 12, color: '#8A8A8A', marginTop: 1 }}>Describe a change in plain words</div>
              </div>
              <button
                onClick={() => { if (!isGenerating) onClose() }}
                style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Toolbar */}
            {confirmingReset ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#d1d5db', marginRight: 'auto' }}>Reset all customizations to default?</span>
                <button
                  onClick={() => { setConfirmingReset(false); onReset?.() }}
                  style={{ background: '#451a1a', color: '#ef4444', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >Yes, reset</button>
                <button
                  onClick={() => setConfirmingReset(false)}
                  style={{ background: '#2A2A2A', color: '#E8E8E8', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 13, cursor: 'pointer' }}
                >Cancel</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  onClick={() => setView('versions')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(124,58,237,0.14)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 9, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  <History size={15} />
                  Versions{versions.length ? ` · ${versions.length}` : ''}
                </button>
                <button
                  onClick={() => onUndo?.()}
                  disabled={!canUndo}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', color: '#E8E8E8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, padding: '7px 12px', fontSize: 13, cursor: canUndo ? 'pointer' : 'default', opacity: canUndo ? 1 : 0.4 }}
                >
                  <Undo2 size={15} />
                  Undo
                </button>
                <button
                  onClick={() => setConfirmingReset(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 9, padding: '7px 12px', fontSize: 13, cursor: 'pointer', marginLeft: 'auto' }}
                >
                  <RotateCcw size={15} />
                  Reset
                </button>
              </div>
            )}

            {/* Pro text field */}
            <div
              style={{
                background: '#0f0f10',
                border: `1.5px solid ${focused ? accent : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 16,
                padding: '12px 12px 10px 14px',
                transition: 'border-color 0.18s, box-shadow 0.18s',
                boxShadow: focused ? `0 0 0 3px rgba(124,58,237,0.15)` : 'none',
              }}
            >
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => { setInputValue(e.target.value); autoGrow(e.target) }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit() }
                }}
                disabled={isGenerating}
                rows={2}
                placeholder="e.g. make the chat tiles a purple gradient… move search to the bottom… add a bell icon to the top bar…"
                style={{
                  width: '100%',
                  minHeight: 52,
                  maxHeight: 180,
                  background: 'transparent',
                  border: 'none',
                  color: '#F3F4F6',
                  fontSize: 15,
                  lineHeight: 1.45,
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  display: 'block',
                }}
              />

              {/* Field footer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <button
                  onClick={toggleVoice}
                  disabled={isGenerating}
                  title="Voice typing"
                  style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: isGenerating ? 'default' : 'pointer',
                    background: isListening ? '#EF4444' : 'rgba(255,255,255,0.07)',
                    color: isListening ? '#fff' : '#9ca3af',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isListening ? '0 0 0 6px rgba(239,68,68,0.18)' : 'none',
                    transition: 'background 0.15s, box-shadow 0.15s',
                  }}
                >
                  <Mic size={18} />
                </button>

                <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: isListening ? '#f87171' : '#4A4A4A' }}>
                  {isListening ? 'Listening… tap mic to stop' : `${inputValue.length} chars`}
                </div>

                <button
                  onClick={submit}
                  disabled={isGenerating || !inputValue.trim()}
                  style={{
                    height: 40, minWidth: 40, borderRadius: 20, padding: inputValue.trim() ? '0 16px' : '0', border: 'none',
                    background: (isGenerating || !inputValue.trim()) ? '#2A2A2A' : 'linear-gradient(135deg, #7C3AED, #2563EB)',
                    color: (isGenerating || !inputValue.trim()) ? '#8A8A8A' : '#fff',
                    fontSize: 14, fontWeight: 700, cursor: (isGenerating || !inputValue.trim()) ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0,
                  }}
                >
                  {isGenerating ? 'Generating…' : (<><span>Generate</span><ArrowUp size={16} /></>)}
                </button>
              </div>
            </div>

            {(voiceError || lastError) && (
              <div style={{ fontSize: 12, color: '#EF4444', marginTop: 10 }}>
                {voiceError || lastError}
              </div>
            )}
          </>
        ) : (
          /* ---- Versions view ---- */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <button
                onClick={() => setView('main')}
                style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <ChevronLeft size={18} />
              </button>
              <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: '#F3F4F6' }}>Version history</div>
              <button
                onClick={() => { if (!isGenerating) onClose() }}
                style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#8A8A8A', marginBottom: 12, paddingLeft: 2 }}>
              Tap any version to switch to it. Your timeline is never lost — new changes always append to the end.
            </div>

            <div style={{ maxHeight: '52vh', overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
              {/* Default baseline entry */}
              <VersionRow
                title="Default"
                subtitle="The original, unmodified UI"
                active={!activeVersionId}
                onClick={() => { onReset?.() }}
              />

              {versions.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#5b5b5b', fontSize: 13, padding: '24px 0 8px' }}>
                  No versions yet — your first AI change will appear here.
                </div>
              ) : (
                versions.map((v, i) => (
                  <VersionRow
                    key={v.id}
                    title={v.name}
                    subtitle={`#${i + 1} · ${timeAgo(v.createdAt)}`}
                    active={activeVersionId === v.id}
                    onClick={() => onRestoreVersion?.(v.id)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

function VersionRow({ title, subtitle, active, onClick }: { title: string; subtitle: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        padding: '11px 12px', marginBottom: 8, borderRadius: 12, cursor: 'pointer',
        background: active ? 'rgba(124,58,237,0.16)' : 'rgba(255,255,255,0.035)',
        border: `1px solid ${active ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'linear-gradient(135deg, #7C3AED, #2563EB)' : 'rgba(255,255,255,0.06)', color: active ? '#fff' : '#8A8A8A' }}>
        {active ? <Check size={17} /> : <Clock size={16} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#E8E8E8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#7a7a7a', marginTop: 1 }}>{subtitle}</div>
      </div>
      {active && <span style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', flexShrink: 0 }}>CURRENT</span>}
    </button>
  )
}
