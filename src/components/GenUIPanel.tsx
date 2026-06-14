'use client'

import { useState, useRef, useEffect } from 'react'

export interface GenUIPanelProps {
  isOpen: boolean
  isGenerating: boolean
  onClose: () => void
  onGenerate: (message: string) => void
  lastError?: string | null
  onUndo?: () => void
  onReset?: () => void
  canUndo?: boolean
}

export default function GenUIPanel({
  isOpen,
  isGenerating,
  onClose,
  onGenerate,
  lastError,
  onUndo,
  onReset,
  canUndo
}: GenUIPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const [confirmingReset, setConfirmingReset] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  const borderStyle = {
    backgroundSize: '300% 300%',
    animation: 'gradient-border-flow 2s ease infinite, gen-ui-pulse 1.5s ease-in-out infinite',
    zIndex: 9998,
    pointerEvents: 'none' as const,
  }

  return (
    <>
      {isGenerating && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #7C3AED, #2563EB, #10B981, #F59E0B, #EF4444, #7C3AED)',
              ...borderStyle
            }}
          />
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #7C3AED, #2563EB, #10B981, #F59E0B, #EF4444, #7C3AED)',
              ...borderStyle
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              bottom: 0,
              left: 0,
              width: '4px',
              background: 'linear-gradient(180deg, #7C3AED, #2563EB, #10B981, #F59E0B, #EF4444, #7C3AED)',
              ...borderStyle
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              bottom: 0,
              right: 0,
              width: '4px',
              background: 'linear-gradient(180deg, #7C3AED, #2563EB, #10B981, #F59E0B, #EF4444, #7C3AED)',
              ...borderStyle
            }}
          />
        </>
      )}

      <div
        onClick={() => {
          if (!isGenerating) onClose()
        }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 9990
        }}
      />

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9991,
          background: '#1A1A1A',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px calc(var(--sab) + 20px) 20px',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '4px',
            background: '#3A3A3A',
            borderRadius: '2px',
            margin: '0 auto 16px auto'
          }}
        />

        {confirmingReset ? (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#8A8A8A', marginRight: 'auto' }}>reset everything?</span>
            <button
              onClick={() => {
                setConfirmingReset(false)
                onReset?.()
              }}
              style={{
                background: '#451a1a',
                color: '#ef4444',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              yes, reset
            </button>
            <button
              onClick={() => setConfirmingReset(false)}
              style={{
                background: '#2A2A2A',
                color: '#E8E8E8',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              cancel
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={() => onUndo?.()}
              disabled={!canUndo}
              style={{
                background: '#2A2A2A',
                color: '#E8E8E8',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                cursor: canUndo ? 'pointer' : 'default',
                opacity: canUndo ? 1 : 0.4
              }}
            >
              ↶ undo
            </button>
            <button
              onClick={() => setConfirmingReset(true)}
              style={{
                background: '#2A1A1A',
                color: '#EF4444',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                cursor: 'pointer',
                marginLeft: 'auto'
              }}
            >
              reset
            </button>
          </div>
        )}

        <div style={{ fontSize: '13px', color: '#8A8A8A', marginBottom: '12px' }}>
          describe your ui change
        </div>

        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isGenerating}
          placeholder="make priya's tile a gradient... move search to bottom... make unread tiles pink..."
          style={{
            width: '100%',
            minHeight: '80px',
            maxHeight: '160px',
            background: '#0f0f0f',
            border: '1px solid #2A2A2A',
            borderRadius: '12px',
            padding: '12px',
            color: '#E8E8E8',
            fontSize: '15px',
            lineHeight: '1.4',
            resize: 'none',
            outline: 'none',
          }}
        />

        {lastError && (
          <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '12px' }}>
            {lastError}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
          <div style={{ fontSize: '11px', color: '#4A4A4A' }}>
            {inputValue.length} chars
          </div>
          <button
            onClick={() => {
              if (inputValue.trim() && !isGenerating) {
                onGenerate(inputValue)
              }
            }}
            disabled={isGenerating}
            style={isGenerating ? {
              background: '#2A2A2A',
              color: '#8A8A8A',
              height: '44px',
              borderRadius: '22px',
              padding: '0 20px',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none'
            } : {
              background: 'linear-gradient(135deg, #7C3AED, #2563EB)',
              color: 'white',
              height: '44px',
              borderRadius: '22px',
              padding: '0 20px',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {isGenerating ? 'generating...' : 'generate →'}
          </button>
        </div>
      </div>
    </>
  )
}
