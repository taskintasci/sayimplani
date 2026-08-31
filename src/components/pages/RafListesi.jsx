import { useState, useMemo, useEffect } from 'react'
import useStore from '../../store/useStore'
import { SABLON } from '../../constants'
import { parseAdres, parseAdresRedbull, computeFilterOptions, computeFilterOptionsRedbull, getKoridor, getSutun } from '../../utils/adresUtils'
import MultiSelect from '../shared/MultiSelect'

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

// Adres boyutları — iç anahtar = etiket (birleşik model, bkz. adresUtils).
// 4 parça (LOS Depo / WMS Antrepo): Blok-Koridor-Sütun-Kat
const DIMS_4 = [
  { key: 'blok',    placeholder: 'Tüm Bloklar',    optKey: 'bloklar' },
  { key: 'koridor', placeholder: 'Tüm Koridorlar', optKey: 'koridorlar' },
  { key: 'sutun',   placeholder: 'Tüm Sütunlar',   optKey: 'sutunlar' },
  { key: 'kat',     placeholder: 'Tüm Katlar',     optKey: 'katlar' },
]
// 5 parça (WMS Depo): Bina-Blok-Koridor-Sütun-Kat
const DIMS_RB = [
  { key: 'bina',    placeholder: 'Tüm Binalar',    optKey: 'binalar' },
  { key: 'blok',    placeholder: 'Tüm Bloklar',    optKey: 'bloklar' },
  { key: 'koridor', placeholder: 'Tüm Koridorlar', optKey: 'koridorlar' },
  { key: 'sutun',   placeholder: 'Tüm Sütunlar',   optKey: 'sutunlar' },
  { key: 'kat',     placeholder: 'Tüm Katlar',     optKey: 'katlar' },
]

const filterKey = k => `filter${k[0].toUpperCase()}${k.slice(1)}`

export default function RafListesi({ onNavigate }) {
  const { rows, rowsLoading, koridorlar, addKoridorlar, firmaProfile } = useStore()
  const sablon    = firmaProfile?.sablon
  const isWms31   = sablon === SABLON.WMS31
  const isRedbull = sablon === SABLON.WMS_REDBULL

  const DIMS    = isRedbull ? DIMS_RB : DIMS_4
  const parseFn = isRedbull ? parseAdresRedbull : parseAdres

  const [search, setSearch]           = useState('')
  const [filterDurum, setFilterDurum] = useState([])
  const [dim, setDim]                 = useState({})   // { <iç anahtar>: string[] }
  const [sortBy, setSortBy]           = useState('key')
  const [sortDir, setSortDir]         = useState('asc')
  const [selected, setSelected]       = useState(() => new Set())   // "1-AL" | "1-AL|05"
  const [acik, setAcik]               = useState(() => new Set())   // açık koridor anahtarları
  const [page, setPage]               = useState(1)
  const [pageSize, setPageSize]       = useState(100)

  const setDimVal = (k, v) => setDim(d => ({ ...d, [k]: v }))

  const filterOptions = useMemo(() => {
    const base = { filterSearch: search, filterDurum }
    DIMS.forEach(d => { base[filterKey(d.key)] = dim[d.key] || [] })
    return isRedbull ? computeFilterOptionsRedbull(rows, base) : computeFilterOptions(rows, base)
  }, [rows, search, filterDurum, dim, DIMS, isRedbull])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (q && !(r.kod?.toLowerCase().includes(q) || r.ad?.toLowerCase().includes(q) || r.parti?.toLowerCase().includes(q))) return false
      if (filterDurum.length > 0 && !filterDurum.includes(r.durum)) return false
      const p = parseFn(r.adres)
      return DIMS.every(d => !(dim[d.key]?.length) || dim[d.key].includes(p[d.key]))
    })
  }, [rows, search, filterDurum, dim, DIMS, parseFn])

  // filteredRows → koridor (Blok+Koridor bileşiği) bazında gruplanır; her grup
  // altında Sütun kırılımı. Adresi çözümlenemeyen satır hiçbir gruba girmez —
  // başlıktaki "kalem" grup toplamından (toplamKalem) türetilir.
  const groups = useMemo(() => {
    const map = new Map()
    filteredRows.forEach(r => {
      const key = getKoridor(r.adres, sablon)
      if (!key) return
      let g = map.get(key)
      if (!g) { g = { key, skuSet: new Set(), adresSet: new Set(), miktar: 0, kalemSayisi: 0, sutunMap: new Map() }; map.set(key, g) }
      g.kalemSayisi += 1
      if (r.kod) g.skuSet.add(r.kod)
      if (r.adres) g.adresSet.add(r.adres)
      const m = parseFloat(String(r.sayim ?? '').replace(',', '.'))
      if (!Number.isNaN(m)) g.miktar += m

      const sut = getSutun(r.adres, sablon) || '—'
      let sg = g.sutunMap.get(sut)
      if (!sg) { sg = { sutun: sut, skuSet: new Set(), adresSet: new Set(), miktar: 0, kalemSayisi: 0 }; g.sutunMap.set(sut, sg) }
      sg.kalemSayisi += 1
      if (r.kod) sg.skuSet.add(r.kod)
      if (r.adres) sg.adresSet.add(r.adres)
      if (!Number.isNaN(m)) sg.miktar += m
    })
    return [...map.values()].map(g => ({
      key: g.key,
      skuSayisi: g.skuSet.size,
      lokasyonSayisi: g.adresSet.size,
      kalemSayisi: g.kalemSayisi,
      miktar: g.miktar,
      inSayim: koridorlar.includes(g.key),
      sutunlar: [...g.sutunMap.values()]
        .map(s => ({ sutun: s.sutun, skuSayisi: s.skuSet.size, lokasyonSayisi: s.adresSet.size, kalemSayisi: s.kalemSayisi, miktar: s.miktar }))
        .sort((a, b) => String(a.sutun).localeCompare(String(b.sutun), 'tr', { numeric: true })),
    }))
  }, [filteredRows, sablon, koridorlar])

  const toplamKalem = useMemo(() => groups.reduce((n, g) => n + g.kalemSayisi, 0), [groups])

  function handleSort(col) {
    if (sortBy === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(col); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    const arr = [...groups]
    arr.sort((a, b) => {
      let c
      if (sortBy === 'key') c = String(a.key).localeCompare(String(b.key), 'tr', { numeric: true })
      else c = (a[sortBy] ?? 0) - (b[sortBy] ?? 0)
      return sortDir === 'asc' ? c : -c
    })
    return arr
  }, [groups, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage   = Math.min(page, totalPages)
  const paginated  = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize]
  )

  useEffect(() => { setPage(1) }, [sorted.length, pageSize])

  // ── Aç / kapa ──────────────────────────────────────────────────────────────
  function toggleAcik(key) {
    setAcik(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }
  const tumAcik = groups.length > 0 && groups.every(g => acik.has(g.key))
  function acKapaHepsi() {
    setAcik(tumAcik ? new Set() : new Set(groups.map(g => g.key)))
  }

  // ── Seçim ─────────────────────────────────────────────────────────────────
  function toggleKey(key) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  // Bir koridorun TÜM sütunları tek tek seçiliyse bare koridora indir; bare
  // seçiliyse sütun alt-anahtarlarını at. Aktar + sayaç bunu kullanır.
  const effectiveSelected = useMemo(() => {
    const bareKor = new Set()
    const korSut  = new Map()
    for (const k of selected) {
      const i = k.indexOf('|')
      if (i === -1) bareKor.add(k)
      else {
        const kor = k.slice(0, i)
        if (!korSut.has(kor)) korSut.set(kor, new Set())
        korSut.get(kor).add(k.slice(i + 1))
      }
    }
    const out = new Set(bareKor)
    for (const [kor, sutuns] of korSut) {
      if (out.has(kor)) continue
      const g = groups.find(x => x.key === kor)
      if (g && g.sutunlar.length > 0 && g.sutunlar.every(s => sutuns.has(s.sutun))) out.add(kor)
      else sutuns.forEach(s => out.add(`${kor}|${s}`))
    }
    return [...out]
  }, [selected, groups])

  const allSelected = groups.length > 0 && groups.every(g => selected.has(g.key))
  function toggleAll() {
    setSelected(prev => {
      const n = new Set(prev)
      if (allSelected) groups.forEach(g => n.delete(g.key))
      else groups.forEach(g => n.add(g.key))
      return n
    })
  }

  const filtreAktif = !!search.trim() || filterDurum.length > 0 || DIMS.some(d => dim[d.key]?.length)
  function temizle() { setSearch(''); setFilterDurum([]); setDim({}) }

  // Seçili kapsam anahtarlarını Kör Raf Sayım'a aktarır (bare koridor + sütun karışık).
  function handleAktar() {
    if (effectiveSelected.length === 0) return
    addKoridorlar(effectiveSelected)
    setSelected(new Set())
    onNavigate(isWms31 ? 'antrepokoridorsayim' : isRedbull ? 'redbullkoridorsayim' : 'koridorsayim')
  }

  const secimSayisi = effectiveSelected.length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Üst bar ── */}
      <div className="px-5 pt-3 pb-2 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[15px] font-bold text-slate-900">Raf Listesi</h1>
            <p className="text-[11.5px] text-slate-400 mono">
              {groups.length.toLocaleString('tr')} koridor · {toplamKalem.toLocaleString('tr')} kalem
              {secimSayisi > 0 ? ` · ${secimSayisi} seçili` : ''}
            </p>
          </div>
          <button
            onClick={handleAktar}
            disabled={secimSayisi === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-[12.5px] font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            <span className="ms" style={{ fontSize: 16 }}>view_week</span>
            Kör Raf Sayımına Aktar{secimSayisi > 0 ? ` (${secimSayisi})` : ''}
          </button>
        </div>

        {/* Arama + filtreler */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <span className="ms absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 15 }}>search</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Kod / Ad / Parti ara…"
              className="w-52 pl-9 pr-7 py-1.5 border border-slate-200 rounded-lg text-[12.5px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            {search && (
              <button onClick={() => setSearch('')} className="ms absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500" style={{ fontSize: 15 }}>close</button>
            )}
          </div>
          <span className="text-[11.5px] text-slate-400 font-medium">Filtre:</span>
          <MultiSelect placeholder="Tüm Durumlar" options={filterOptions.durumlar} value={filterDurum} onChange={setFilterDurum} />
          {DIMS.map(d => (
            <MultiSelect
              key={d.key}
              placeholder={d.placeholder}
              options={filterOptions[d.optKey]}
              value={dim[d.key] || []}
              onChange={v => setDimVal(d.key, v)}
            />
          ))}
          {filtreAktif && (
            <button
              onClick={temizle}
              className="flex items-center gap-1 px-2 py-1 text-[11.5px] text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              <span className="ms" style={{ fontSize: 13 }}>filter_list_off</span> Temizle
            </button>
          )}
          {groups.length > 0 && (
            <button
              onClick={acKapaHepsi}
              className="ml-auto flex items-center gap-1 px-2 py-1 text-[11.5px] text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <span className="ms" style={{ fontSize: 14 }}>{tumAcik ? 'unfold_less' : 'unfold_more'}</span>
              {tumAcik ? 'Tümünü Kapat' : 'Tümünü Aç'}
            </button>
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
          <div className="text-slate-400 text-[13px]">Excel dosyası yükleyince koridorlar burada görünür</div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse" style={{ minWidth: 640 }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-800 text-white text-[11px] mono uppercase tracking-wider">
                <th className="px-3 py-2.5 w-10 text-center">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
                </th>
                <SortHeader label="Koridor" col="key" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="w-44" />
                <SortHeader label="SKU Sayısı" col="skuSayisi" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="right" className="w-32" />
                <SortHeader label="Lokasyon" col="lokasyonSayisi" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="right" className="w-32" />
                <SortHeader label="Toplam Sistem" col="miktar" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="right" className="w-36" />
              </tr>
            </thead>
            <tbody className="text-[12.5px]">
              {paginated.map((g, i) => {
                const korSel  = selected.has(g.key)
                const kismi   = !korSel && g.sutunlar.some(s => selected.has(`${g.key}|${s.sutun}`))
                const open    = acik.has(g.key)
                return [
                  <tr
                    key={g.key}
                    onClick={() => toggleAcik(g.key)}
                    className="border-b border-slate-100 hover:bg-blue-50/30 cursor-pointer"
                    style={korSel ? { background: '#eff6ff' } : i % 2 === 1 ? { background: '#f8fafc' } : {}}
                  >
                    <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={korSel}
                        ref={el => { if (el) el.indeterminate = kismi }}
                        onChange={() => toggleKey(g.key)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-2 mono font-medium text-blue-700">
                      <span className="ms align-middle text-slate-400 mr-1" style={{ fontSize: 15 }}>
                        {open ? 'expand_more' : 'chevron_right'}
                      </span>
                      {g.key}
                      {g.inSayim && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-semibold align-middle">
                          Sayımda
                        </span>
                      )}
                      <span className="ml-1.5 text-[10px] text-slate-400 align-middle">{g.sutunlar.length} sütun</span>
                    </td>
                    <td className="px-3 py-2 text-right mono text-slate-600">{g.skuSayisi.toLocaleString('tr')}</td>
                    <td className="px-3 py-2 text-right mono text-slate-500">{g.lokasyonSayisi.toLocaleString('tr')}</td>
                    <td className="px-3 py-2 text-right mono text-slate-600">{g.miktar.toLocaleString('tr')}</td>
                  </tr>,
                  ...(open ? g.sutunlar.map(s => {
                    const sk    = `${g.key}|${s.sutun}`
                    const sSel  = selected.has(sk)
                    return (
                      <tr
                        key={sk}
                        onClick={() => { if (!korSel) toggleKey(sk) }}
                        className={'border-b border-slate-100 ' + (korSel ? '' : 'hover:bg-blue-50/30 cursor-pointer')}
                        style={sSel ? { background: '#eff6ff' } : { background: '#fafafa' }}
                      >
                        <td className="px-3 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={korSel || sSel}
                            disabled={korSel}
                            onChange={() => toggleKey(sk)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-1.5 pl-8 mono text-slate-600 text-[11.5px]">
                          <span className="ms align-middle text-slate-300 mr-1" style={{ fontSize: 14 }}>subdirectory_arrow_right</span>
                          Sütun {s.sutun}
                          {koridorlar.includes(sk) && (
                            <span className="ml-1.5 px-1 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[9px] font-semibold align-middle">Sayımda</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right mono text-slate-500 text-[11.5px]">{s.skuSayisi.toLocaleString('tr')}</td>
                        <td className="px-3 py-1.5 text-right mono text-slate-400 text-[11.5px]">{s.lokasyonSayisi.toLocaleString('tr')}</td>
                        <td className="px-3 py-1.5 text-right mono text-slate-500 text-[11.5px]">{s.miktar.toLocaleString('tr')}</td>
                      </tr>
                    )
                  }) : []),
                ]
              })}
            </tbody>
          </table>
          {groups.length === 0 && (
            <div className="p-8 text-center text-[11.5px] text-slate-400">Filtreye uyan koridor yok.</div>
          )}
        </div>
      )}

      {/* ── Alt bar ── */}
      {sorted.length > 0 && (
        <div className="px-5 py-2 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11.5px] text-slate-400">{sorted.length.toLocaleString('tr')} koridor</div>
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
