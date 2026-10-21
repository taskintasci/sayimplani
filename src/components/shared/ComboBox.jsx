import { useState, useRef, useEffect, useMemo } from 'react'

const MAX_SUGGESTIONS = 10

/**
 * Yazdıkça filtrelenen, listeden tek seçim yapılan type-ahead input.
 * options: {value, label}[] — value benzersiz anahtar, label görünen metin
 * value: string — inputta gösterilen serbest metin (henüz seçilmemiş olabilir)
 * onChange: (text) => void — her tuş vuruşunda
 * onSelect: (option) => void — bir öneriye tıklanınca/Enter ile seçilince
 * invalid: boolean — true ise input kırmızı kenarlıkla vurgulanır
 */
export default function ComboBox({ value, onChange, options, onSelect, placeholder, invalid, disabled }) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const ref = useRef()

  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Boş sorguda hiç öneri gösterilmiyor — alana dokunur dokunmaz (hiçbir şey
  // yazmadan) koca bir liste açılması hem mobilde klavye ile çakışıp sayfanın
  // "zıplamasına" katkı yapıyordu hem de kullanıcı deneyimini bozuyordu.
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return []
    return options.filter(o => o.label.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS)
  }, [value, options])

  function selectOption(opt) {
    onSelect(opt)
    setOpen(false)
  }

  function onKeyDown(e) {
    if (!open || matches.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, matches.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); selectOption(matches[highlight]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(0) }}
        onFocus={() => { setOpen(true); setHighlight(0) }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={
          'w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-hidden focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 ' +
          (invalid
            ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
            : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500/20')
        }
      />
      {open && matches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-52 overflow-y-auto">
          {matches.map((opt, i) => (
            <button
              type="button"
              key={opt.value}
              onMouseDown={e => { e.preventDefault(); selectOption(opt) }}
              className={
                'w-full text-left px-3 py-1.5 text-[12.5px] truncate ' +
                (i === highlight ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50')
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
