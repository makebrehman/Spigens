'use client'

import { useUIStore } from '@/stores/uiStore'
import { RenderifyHost } from '@/components/RenderifyHost'

export interface DateSeparatorProps {
  label: string
}

export function DateSeparator(props: DateSeparatorProps) {
  const { label } = props
  const componentSources = useUIStore(state => state.componentSources)
  const dateSeparatorSource = componentSources?.dateSeparator ?? null

  return (
    <RenderifyHost
      code={dateSeparatorSource}
      storeActions={{ label }}
    />
  )
}
