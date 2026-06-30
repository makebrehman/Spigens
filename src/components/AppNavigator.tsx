'use client'

import React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavStore, Route } from '@/stores/navStore'

interface AppNavigatorProps {
  screens: Record<string, React.ComponentType<any>>
}

export function AppNavigator({ screens }: AppNavigatorProps) {
  const stack = useNavStore((state) => state.stack)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#0A0A0A' }}>
      <AnimatePresence initial={false}>
        {stack.map((route, index) => {
          const ScreenComponent = screens[route.name]
          if (!ScreenComponent) return null

          const isTop = index === stack.length - 1

          return (
            <motion.div
              key={route.id}
              initial={{ x: index === 0 ? 0 : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: index,
                background: '#0A0A0A',
              }}
            >
              <ScreenComponent {...(route.params || {})} isActive={isTop} />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
