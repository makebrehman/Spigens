'use client'

import * as React from 'react'
import * as Babel from '@babel/standalone'
import { fetchLucideIcon } from '@/lib/iconLoader'
import { motion, AnimatePresence } from 'motion/react'

export interface RenderifyResult {
  Component: React.ComponentType | null
  error: string | null
}

// the scope available to generated code — only what we explicitly allow
function buildScope(storeActions: Record<string, any>) {
  // a component generated code can use: <Icon name="heart" size={24} color="#fff" />
  const Icon = (props: { name: string; size?: number; color?: string }) => {
    const [svg, setSvg] = React.useState<string | null>(null)
    React.useEffect(() => {
      let active = true
      fetchLucideIcon(props.name).then(result => {
        if (active) setSvg(result)
      })
      return () => { active = false }
    }, [props.name])

    if (!svg) {
      // placeholder space while loading / if not found
      return React.createElement('span', {
        style: { display: 'inline-block', width: props.size ?? 24, height: props.size ?? 24 }
      })
    }

    // size and colour the svg
    const sized = svg
      .replace(/width="[^"]*"/, `width="${props.size ?? 24}"`)
      .replace(/height="[^"]*"/, `height="${props.size ?? 24}"`)

    return React.createElement('span', {
      style: { display: 'inline-flex', color: props.color ?? 'currentColor' },
      dangerouslySetInnerHTML: { __html: sized }
    })
  }

  return {
    React,
    useState: React.useState,
    useEffect: React.useEffect,
    useRef: React.useRef,
    useMemo: React.useMemo,
    useCallback: React.useCallback,
    Icon,
    motion,
    AnimatePresence,
    // store actions the generated code can call (passed in)
    ...storeActions,
  }
}

const transformCache = new Map<string, string>()

export function preloadGenUI(codes: (string | null | undefined)[]) {
  const validCodes = codes.filter((c): c is string => typeof c === 'string' && !transformCache.has(c))
  if (!validCodes.length) return

  let i = 0
  const processNext = () => {
    if (i >= validCodes.length) return
    const code = validCodes[i++]
    if (code && !transformCache.has(code)) {
      try {
        const transformed = Babel.transform(code, {
          presets: [['react', { runtime: 'classic' }]],
        }).code
        if (transformed) {
          transformCache.set(code, transformed)
        }
      } catch (err) {
        console.error('Preload compile error:', err)
      }
    }
    // Yield to main thread to prevent jank
    setTimeout(processNext, 50)
  }
  
  // Start preloading after a short delay so initial app paint isn't blocked
  setTimeout(processNext, 1000)
}

export function compileJSX(
  code: string,
  storeActions: Record<string, any> = {}
): RenderifyResult {
  try {
    let transformed = transformCache.get(code)
    
    if (!transformed) {
      // transform JSX to plain JS using babel
      transformed = Babel.transform(code, {
        presets: [['react', { runtime: 'classic' }]],
      }).code || undefined

      if (!transformed) {
        return { Component: null, error: 'transform produced no output' }
      }
      transformCache.set(code, transformed)
    }

    const scope = buildScope(storeActions)
    const scopeKeys = Object.keys(scope)
    const scopeValues = Object.values(scope)

    // the generated code must define a component named "Component"
    // we wrap it so it returns that component
    const factoryBody = `
      ${transformed}
      return typeof Component !== 'undefined' ? Component : null;
    `

    // eslint-disable-next-line no-new-func
    const factory = new Function(...scopeKeys, factoryBody)
    const ResultComponent = factory(...scopeValues)

    if (!ResultComponent) {
      return { Component: null, error: 'generated code did not define a Component' }
    }

    return { Component: ResultComponent, error: null }
  } catch (err) {
    return {
      Component: null,
      error: err instanceof Error ? err.message : 'unknown compile error',
    }
  }
}
