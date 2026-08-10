import { useState, useMemo, useEffect } from 'react'
import useStore from '../../store/useStore'
import { SABLON } from '../../constants'

function SortHeader({ label, col, sortBy, sortDir, onSort, align, className = '' }) {
  const active = sortBy === col
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-3 py-2.5 cursor-pointer select-none hover:bg-slate-700 transition-colors ${align === 'right' ? 'text-right' : ''} ${className}`}
    >
      <span className={'inline-flex items-center gap-1' + (align === 'right' ? ' flex-row-reverse' : '')}>
        {label}
        <span className="ms" style={{ fontSize: 14, opacity: active ? 1 : 0.25 }}>
          {active && sortDir === 'desc' ? 'arrow_downward' : 'arrow_upward'}
        </span>
      </span>
    </th>
  )
}

export default function SkuListesi({ onNavigate }) {
  const { rows, rowsLoading, korCodes, addKorCodes, firmaProfile } = useStore()
  const isWms31   = firmaProfile?.sablon === SABLON.WMS31
  const isRedbull = firmaProfile?.sablon === SABLON.WMS_REDBULL

  const [search, setSearch]     = useState('')
  const [sortBy, setSortBy]     = useState('kod')
  const [sortDir, setSortDir]   = useState('asc')
  const [selected, setSelected] = useState(() => new Set())
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(100)

  // rows (lokasyon bazlı) kod'a göre gruplanıp Kod/Ad/Miktar(sistem toplamı)/
  // Lokasyon Sayısı satırlarına indirgenir — kör sayıma kod bazlı aktarım
  // yapabilmek için (korCodes zaten kod listesi tutuyor, satır değil).
  const grouped = useMemo(() => {
    const map = new Map()
    rows.forEach(r => {
      if (!r.kod) return
      let g = map.get(r.kod)
      if (!g) {
        g = { kod: r.kod, ad: r.ad || '', miktar: 0, lokasyonSayisi: 0 }
        map.set(r.kod, g)
      }
      if (!g.ad && r.ad) g.ad = r.ad
      const m = parseFloat(String(r.sayim ?? '').replace(',', '.'))
      if (!Number.isNaN(m)) g.miktar += m
      g.lokasyonSayisi += 1
    })
    return [...map.values()]
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return grouped
    return grouped.filter(g => g.kod.toLowerCase().includes(q) || g.ad.toLowerCase().includes(q))
  }, [grouped, search])

  function handleSort(col) {
    if (sortBy === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(col); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let av = a[sortBy]
      let bv = b[sortBy]
      if (typeof av === 'string') { av = av.toLowerCase(); bv = String(bv).toLowerCase() }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [filtered, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage   = Math.min(page, totalPages)
  const paginated  = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize]
  )

  useEffect(() => { setPage(1) }, [sorted.length, pageSize])

  function toggleOne(kod) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(kod)) next.delete(kod)
      else next.add(kod)
      return next
    })
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every(g => selected.has(g.kod))
  function toggleAllFiltered() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) filtered.forEach(g => next.delete(g.kod))
      else filtered.forEach(g => next.add(g.kod))
      return next
    })
  }

  function handleAktar() {
    if (selected.size === 0) return
    addKorCodes([...selected])
    setSelected(new Set())
    onNavigate(isWms31 ? 'antrepokor' : isRedbull ? 'redbullkor' : 'kor')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Üst bar ── */}
      <div className="px-5 pt-3 pb-2 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[15px] font-bold text-slate-900">SKU Listesi</h1>
            <p className="text-[11.5px] text-slate-400 mono">
              {grouped.length.toLocaleString('tr')} farklı SKU · {rows.length.toLocaleString('tr')} kalem
              {selected.size > 0 ? ` · ${selected.size} seçili` : ''}
            </p>
          </div>
          <button
            onClick={handleAktar}
            disabled={selected.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-[12.5px] font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            <span className="ms" style={{ fontSize: 16 }}>visibility_off</span>
            Kör Sayıma Aktar{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </div>

        <div className="relative max-w-xs">
          <span className="ms absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Kod / Ad ara…"
            className="w-full pl-9 pr-7 py-1.5 border border-slate-200 rounded-lg text-[12.5px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          {search && (
            <button onClick={() => setSearch('')} className="ms absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500" style={{ fontSize: 15 }}>close</button>
          )}
        </div>
      </div>

      {/* ── Tablo ── */}
      {rowsLoading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px]">Yükleniyor…</div>
      ) : rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-4 shadow-sm">
            <span className="ms text-slate-300" style={{ fontSize: 32 }}>upload_file</span>
          </div>
          <div className="text-slate-600 font-semibold text-sm mb-1">Henüz veri yüklenmedi</div>
          <div className="text-slate-400 text-[13px]">Excel dosyası yükleyince SKU listesi burada görünür</div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse" style={{ minWidth: 700 }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-800 text-white text-[11px] mono uppercase tracking-wider">
                <th className="px-3 py-2.5 w-10 text-center">
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} className="rounded" />
                </th>
                <SortHeader label="Kod" col="kod" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="w-40" />
                <SortHeader label="Ad" col="ad" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Miktar" col="miktar" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="right" className="w-28" />
                <SortHeader label="Lokasyon Sayısı" col="lokasyonSayisi" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="right" className="w-36" />
              </tr>
            </thead>
            <tbody className="text-[12.5px]">
              {paginated.map((g, i) => {
                const inKor = korCodes.includes(g.kod)
                const isSel = selected.has(g.kod)
                return (
                  <tr
                    key={g.kod}
                    onClick={() => toggleOne(g.kod)}
                    className="border-b border-slate-100 hover:bg-blue-50/30 cursor-pointer"
                    style={isSel ? { background: '#eff6ff' } : i % 2 === 1 ? { background: '#f8fafc' } : {}}
                  >
                    <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isSel} onChange={() => toggleOne(g.kod)} className="rounded" />
                    </td>
                    <td className="px-3 py-2 mono font-medium text-blue-700">
                      {g.kod}
                      {inKor && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-semibold align-middle">
                          Kör sayımda
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800">{g.ad}</td>
                    <td className="px-3 py-2 text-right mono text-slate-600">{g.miktar.toLocaleString('tr')}</td>
                    <td className="px-3 py-2 text-right mono text-slate-500">{g.lokasyonSayisi.toLocaleString('tr')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-[11.5px] text-slate-400">Filtreye uyan kayıt yok.</div>
          )}
        </div>
      )}

      {/* ── Alt bar ── */}
      {sorted.length > 0 && (
        <div className="px-5 py-2 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11.5px] text-slate-400">{sorted.length.toLocaleString('tr')} SKU</div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            >
              <span className="ms" style={{ fontSize: 16 }}>chevron_left</span>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...')
                acc.push(p)
                return acc
              }, [])
              .map((p, idx) => p === '...'
                ? <span key={'e' + idx} className="px-1 text-[11px] text-slate-400">…</span>
                : <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={'w-7 h-7 rounded text-[11.5px] font-medium border ' +
                      (p === safePage ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
                  >{p}</button>
              )
            }
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            >
              <span className="ms" style={{ fontSize: 16 }}>chevron_right</span>
            </button>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="ml-2 fsel text-[11.5px]"
            >
              <option value={50}>50 / sayfa</option>
              <option value={100}>100 / sayfa</option>
              <option value={250}>250 / sayfa</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
