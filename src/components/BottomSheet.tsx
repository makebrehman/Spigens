'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, ReactNode } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useLucideIcon } from '@/lib/iconLoader'

// Renders a lucide icon by name (kebab-case) into the bottom-sheet option row.
// Falls back to a blank box while the SVG loads / if the name isn't found.
function OptionIcon({ name, style }: { name: string; style?: CSSProperties }) {
  const svg = useLucideIcon(name)
  const sized = svg ? svg.replace(/width="[^"]*"/, 'width="22"').replace(/height="[^"]*"/, 'height="22"') : null
  if (!sized) return <span style={{ display: 'inline-block', width: 22, height: 22, ...style }} />
  return <span style={{ display: 'inline-flex', color: '#E8E8E8', ...style }} dangerouslySetInnerHTML={{ __html: sized }} />
}

export interface BottomSheetOption {
  id: string
  label: string
  icon?: string
  destructive?: boolean
}

export interface BottomSheetOptionIconOverride {
  iconStyle?: CSSProperties   // color, fontSize for this specific option's icon
  iconSvg?: string            // replace this option's icon with custom svg
}

export interface BottomSheetStyleOverride {
  layout?: 'list' | 'grid-2x2' | 'grid-2col' | 'horizontal'
  optionDisplay?: 'both' | 'icon-only' | 'text-only'
  optionIconOverrides?: Record<string, BottomSheetOptionIconOverride>
  backdrop?: CSSProperties
  sheet?: CSSProperties
  handle?: CSSProperties
  title?: CSSProperties
  optionItem?: CSSProperties
  optionItemDestructive?: CSSProperties
  optionIcon?: CSSProperties
  optionText?: CSSProperties
  destructiveText?: CSSProperties
}

export interface BottomSheetProps {
  sheetId: string
  isOpen: boolean
  title?: string
  options?: BottomSheetOption[]
  onClose: () => void
  onOptionSelect?: (option: BottomSheetOption) => void
  override?: BottomSheetStyleOverride
  children?: ReactNode
}

export function BottomSheet(props: BottomSheetProps) {
  const {
    sheetId,
    isOpen,
    title,
    options = [],
    onClose,
    onOptionSelect,
    override,
    children
  } = props

  const [mounted, setMounted] = useState(false)
  const allStyles = useUIStore(state => state.bottomSheetStyles)
  const s = allStyles[sheetId] ?? {}

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  if (!mounted || !isOpen) return null

  const destructiveColor = (s.destructiveText?.color ?? override?.destructiveText?.color ?? '#EF4444') as string
  const layout = s.layout ?? override?.layout ?? 'list'
  const optionDisplay = s.optionDisplay ?? override?.optionDisplay ?? 'both'

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[200]"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', ...s.backdrop, ...override?.backdrop }}
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[201] bg-[#1A1A1A] rounded-t-[20px] pt-[12px] max-h-[80vh] overflow-y-auto"
        style={{
          paddingBottom: 'calc(var(--sab, env(safe-area-inset-bottom)) + 16px)',
          ...s.sheet,
          ...override?.sheet
        }}
      >
        <div className="flex justify-center w-full">
          <div
            className="w-[36px] h-[4px] rounded-full bg-[#3A3A3A] mb-[16px]"
            style={{ ...s.handle, ...override?.handle }}
          />
        </div>
        
        {title && (
          <div
            className="text-[15px] font-semibold text-[#8A8A8A] text-center pb-[8px] border-b border-[#2A2A2A]"
            style={{ ...s.title, ...override?.title }}
          >
            {title}
          </div>
        )}

        {children ? (
          children
        ) : (
          <div 
            style={
              layout === 'grid-2x2' || layout === 'grid-2col'
                ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '8px' }
                : layout === 'horizontal'
                ? { display: 'flex', flexDirection: 'row', gap: '8px', overflowX: 'auto', padding: '8px' }
                : { display: 'flex', flexDirection: 'column' }
            }
          >
            {options.map((option, index) => {
              const iconOverride = s.optionIconOverrides?.[option.id] ?? override?.optionIconOverrides?.[option.id]
              return (
              <div
                key={option.id}
                className={
                  layout === 'list' 
                    ? "flex flex-row items-center w-full h-[52px] px-[20px] gap-[14px]"
                    : "flex flex-col items-center justify-center p-[16px] rounded-[12px] bg-[#0F0F0F] text-center gap-[8px]"
                }
                style={{
                  borderBottom: layout === 'list' && index < options.length - 1 ? '1px solid #2A2A2A' : 'none',
                  ...s.optionItem,
                  ...override?.optionItem,
                  ...(option.destructive ? { ...s.optionItemDestructive, ...override?.optionItemDestructive } : {})
                }}
                onClick={() => {
                  onOptionSelect?.(option)
                  onClose()
                }}
              >
                {optionDisplay !== 'text-only' && option.icon && (
                  iconOverride?.iconSvg && iconOverride.iconSvg.trim().length > 0 ? (
                    <span
                      className="text-[20px] text-[#E8E8E8]"
                      style={{ display: 'inline-flex', ...s.optionIcon, ...override?.optionIcon, ...iconOverride.iconStyle }}
                      dangerouslySetInnerHTML={{ __html: iconOverride.iconSvg }}
                    />
                  ) : /^[a-z][a-z0-9-]+$/.test(option.icon) ? (
                    <OptionIcon name={option.icon} style={{ ...s.optionIcon, ...override?.optionIcon, ...iconOverride?.iconStyle }} />
                  ) : (
                    <span
                      className="text-[20px] text-[#E8E8E8]"
                      style={{ ...s.optionIcon, ...override?.optionIcon, ...iconOverride?.iconStyle }}
                    >
                      {option.icon}
                    </span>
                  )
                )}
                {optionDisplay !== 'icon-only' && (
                  <div
                    className="text-[16px] font-normal"
                    style={{
                      color: option.destructive ? destructiveColor : '#E8E8E8',
                      ...s.optionText,
                      ...override?.optionText
                    }}
                  >
                    {option.label}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}
      </div>
    </>,
    document.body
  )
}
