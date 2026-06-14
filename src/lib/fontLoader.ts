// tracks fonts already injected so we don't duplicate
const loadedFonts = new Set<string>()

/**
 * dynamically loads a google font by name at runtime.
 * e.g. loadGoogleFont("Lobster") injects the google fonts stylesheet.
 * once loaded, the font is available as fontFamily: "Lobster".
 */
export function loadGoogleFont(fontName: string): void {
  if (!fontName) return

  // normalise: trim, and skip if it's a css variable (those are pre-loaded)
  const clean = fontName.trim()
  if (clean.startsWith('var(') || clean.startsWith('-')) return

  // extract the primary font name (before any comma fallback)
  const primary = clean.split(',')[0].trim().replace(/['"]/g, '')
  if (!primary || loadedFonts.has(primary)) return

  // google fonts url format: replace spaces with +
  const familyParam = primary.replace(/\s+/g, '+')
  const href = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@400;500;600;700;800&display=swap`

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.setAttribute('data-google-font', primary)
  document.head.appendChild(link)

  loadedFonts.add(primary)
}

/**
 * scans a style/mutation object recursively for any fontFamily values
 * and loads each google font found.
 */
export function loadFontsFromMutation(obj: any): void {
  if (!obj || typeof obj !== 'object') return

  for (const [key, value] of Object.entries(obj)) {
    if (key === 'fontFamily' && typeof value === 'string') {
      loadGoogleFont(value)
    } else if (typeof value === 'object') {
      loadFontsFromMutation(value)
    } else if (typeof value === 'string' && key === 'customComponents') {
      // custom component code may contain fontFamily references
      const matches = value.match(/fontFamily:\s*['"]([^'"]+)['"]/g)
      matches?.forEach(m => {
        const font = m.match(/['"]([^'"]+)['"]/)?.[1]
        if (font) loadGoogleFont(font)
      })
    }
  }

  // also scan custom component strings for font references
  if (typeof obj === 'string') {
    const matches = obj.match(/fontFamily:\s*['"]([^'"]+)['"]/g)
    matches?.forEach(m => {
      const font = m.match(/['"]([^'"]+)['"]/)?.[1]
      if (font) loadGoogleFont(font)
    })
  }
}
