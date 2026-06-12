// Gender sequence: m, f, f, m, m, f, f, m, m, ...
export function getGenderForPoint(i, first) {
  if (i === 0) return first
  const other = first === 'm' ? 'f' : 'm'
  return Math.floor((i - 1) / 2) % 2 === 0 ? other : first
}

export const NAME_W  = 104
export const COL_W   = 44
export const HDR_H   = 24
export const SEC_H   = 20
export const ROW_H   = 38
export const SCORE_H = 24
export const MAX_TO  = 3

export const POS = { h: 'H', c: 'C', b: 'Hy', e: 'E' }

export const O_D_LINE_STYLE = {
  O: { label: 'O', bg: 'rgba(0,229,160,0.18)', color: '#00e5a0' },
  D: { label: 'D', bg: 'rgba(240,165,0,0.2)', color: '#f0a500' },
}

export function colBg(colIdx, current, light = false) {
  if (colIdx === current) return light ? 'rgba(0,180,120,0.10)' : 'rgba(0,229,160,0.06)'
  if (colIdx < current)  return light ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.01)'
  return 'transparent'
}

export function cellFill(selected, colIdx, current, light = false) {
  if (!selected) return 'transparent'
  if (colIdx < current)   return light ? 'rgba(0,160,110,0.45)' : 'rgba(0,229,160,0.35)'
  if (colIdx === current) return light ? '#00c896' : '#00e5a0'
  return light ? 'rgba(0,160,110,0.22)' : 'rgba(0,229,160,0.18)'
}

export function buildTheme(light) {
  return light ? {
    gridBg:      '#f4f5f8',
    nameBg:      '#ffffff',
    headerBg:    '#eaecf2',
    rowBorder:   '#b8bdd0',
    nameColor:   '#1a1d28',
    injColor:    '#a06800',
    posTagBg:    '#e0e3ef',
    posTagColor: '#5060a0',
    awayBg:      'rgba(100,110,140,0.15)',
    awayColor:   '#7a8099',
    ptNumColor:  (isCur) => isCur ? '#008060' : '#8090b0',
    light:       true,
  } : {
    gridBg:      '#0f1117',
    nameBg:      '#0f1117',
    headerBg:    '#181c26',
    rowBorder:   '#252a3a',
    nameColor:   '#c8ccd8',
    injColor:    '#c8a050',
    posTagBg:    '#1f2435',
    posTagColor: '#5a6280',
    awayBg:      'rgba(74,80,104,0.35)',
    awayColor:   '#7a8099',
    ptNumColor:  (isCur) => isCur ? '#00e5a0' : '#4a5068',
    light:       false,
  }
}
