import { useState, useRef, useMemo, useEffect } from 'react'
import { useReactToPrint } from 'react-to-print'
import useStore from '../../store/useStore'
import { sortRows, computeFilterOptions, parseAdres, getUrunTipi, buildFiltreOzeti } from '../../utils/adresUtils'
import { exportResults } from '../../utils/excelExport'
import PrintSheet from '../print/PrintSheet'
import MultiSelect from '../shared/MultiSelect'
import GorevAtaModal from './GorevAtaModal'

function DurumBadge({ durum }) {
  return (
    <span className={
      'badge ' +
      (durum === 'Normal' ? 'badge-normal' : durum === 'Bloke' ? 'badge-bloke' : durum === 'SKTG' ? 'badge-sktg' : 'badge-normal')
    }>
      {durum || '—'}
    </span>
  )
}

function PaletStatusBadge({ counted, total, hasDiff }) {
  if (counted === 0) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10.5px] font-medium">Bekliyor</span>
  }
  if (counted < total) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10.5px] font-medium">{counted}/{total} sayıldı</span>
  }
  if (hasDiff) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10.5px] font-medium"><span className="ms" style={{ fontSize: 12 }}>warning</span> Fark Var</span>
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10.5px] font-medium"><span className="ms" style={{ fontSize: 12 }}>check_circle</span> Tamamlandı</span>
}

export default function MembranSayim({ onNavigate }) {
  const { rows, results, session, updateResult, fillFromSistem, clearMiktarlar, pendingKodFilter, clearPendingKodFilter, firmaProfile, sortType, setSortType } = useStore()
  const printRef = useRef()
  const locked = session.durum === 'Tamamlandı'

  const [hideSistem, setHideSistem]   = useState(false)
  const [hideSayilan, setHideSayilan] = useState(false)
  const [filterSearch, setFilterSearch] = useState('')
  const [filterDurum, setFilterDurum]   = useState([])
  const [filterPalet, setFilterPalet]   = useState([])
  const [filterUrunTipi, setFilterUrunTipi] = useState([])
  const [filterRaf, setFilterRaf]       = useState([])
  const [filterSira, setFilterSira]     = useState([])
  const [filterKolon, setFilterKolon]   = useState([])
  const [filterGoz, setFilterGoz]       = useState([])
  const [gorevModal, setGorevModal]     = useState(false)
  const [expandedPallets, setExpandedPallets] = useState(null) // null = hepsi açık

  const handlePrint = useReactToPrint({ contentRef: printRef })

  useEffect(() => {
    if (pendingKodFilter) {
      setFilterSearch(pendingKodFilter)
      clearPendingKodFilter()
    }
  }, [pendingKodFilter])

  // Global body sınıfları (hide-sistem/hide-sayilan) sayfa değişince kalmasın —
  // sonraki sayfada Sistem/Sayılan kolonu görünmez kalıyordu.
  useEffect(() => () => {
    document.body.classList.remove('hide-sistem')
    document.body.classList.remove('hide-sayilan')
  }, [])

  function toggleSistem() {
    const next = !hideSistem
    setHideSistem(next)
    document.body.classList.toggle('hide-sistem', next)
  }
  function toggleSayilan() {
    const next = !hideSayilan
    setHideSayilan(next)
    document.body.classList.toggle('hide-sayilan', next)
  }

  // Yalnızca Membran kategorisi
  const membranRows = useMemo(
    () => rows.filter(r => r.kategori?.toLowerCase() === 'membran'),
    [rows]
  )

  const filterOptions = useMemo(
    () => computeFilterOptions(membranRows, { filterSearch, filterDurum, filterPalet, filterUrunTipi, filterRaf, filterSira, filterKolon, filterGoz }),
    [membranRows, filterSearch, filterDurum, filterPalet, filterUrunTipi, filterRaf, filterSira, filterKolon, filterGoz]
  )

  const filtered = useMemo(() => {
    const q = filterSearch.trim().toLowerCase()
    let result = membranRows.filter(r => {
      if (q && !(
        r.kod?.toLowerCase().includes(q) ||
        r.ad?.toLowerCase().includes(q) ||
        r.parti?.toLowerCase().includes(q)
      )) return false
      if (filterDurum.length > 0 && !filterDurum.includes(r.durum))     return false
      if (filterPalet.length > 0 && !filterPalet.includes(r.partiEk))   return false
      if (filterUrunTipi.length > 0 && !filterUrunTipi.includes(getUrunTipi(r.kod))) return false
      const p = parseAdres(r.adres)
      if (filterRaf.length > 0   && !filterRaf.includes(p.raf))         return false
      if (filterSira.length > 0  && !filterSira.includes(p.sira))       return false
      if (filterKolon.length > 0 && !filterKolon.includes(p.kolon))     return false
      if (filterGoz.length > 0   && !filterGoz.includes(p.goz))         return false
      return true
    })
    return sortRows(result, sortType)
  }, [membranRows, filterSearch, filterDurum, filterPalet, filterUrunTipi, filterRaf, filterSira, filterKolon, filterGoz, sortType])

  // Palet grupları: partiEk tek başına benzersiz değil (farklı kodlarda tekrar edebilir),
  // bu yüzden kod + partiEk birleşimi gerçek paleti belirler.
  const grouped = useMemo(() => {
    const map = new Map()
    filtered.forEach(r => {
      const paletNo = r.partiEk?.trim() || '(Palet Yok)'
      const key = [r.kod?.trim() || '', paletNo].join('||')
      if (!map.has(key)) map.set(key, { key, paletNo, items: [] })
      map.get(key).items.push(r)
    })
    return [...map.values()].sort((a, b) => a.paletNo.localeCompare(b.paletNo, 'tr', { numeric: true }) || a.key.localeCompare(b.key, 'tr', { numeric: true }))
  }, [filtered])

  // expandedPallets === null → hepsi açık; Set → yalnızca Set içindekiler açık
  const allKeys = useMemo(() => new Set(grouped.map(g => g.key)), [grouped])

  function isPaletOpen(key) {
    if (expandedPallets === null) return true
    return expandedPallets.has(key)
  }

  function togglePalet(key) {
    setExpandedPallets(prev => {
      const base = prev === null ? new Set(allKeys) : new Set(prev)
      if (base.has(key)) { base.delete(key) } else { base.add(key) }
      return base
    })
  }

  function expandAll()  { setExpandedPallets(null) }
  function collapseAll() { setExpandedPallets(new Set()) }

  const totalMembran  = membranRows.length
  const counted       = useMemo(() => membranRows.filter(r => results[r.id]?.miktar !== undefined && results[r.id]?.miktar !== '').length, [membranRows, results])
  const diffCount     = useMemo(() => membranRows.filter(r => { const m = results[r.id]?.miktar; return m !== undefined && m !== '' && String(m) !== String(r.sayim) }).length, [membranRows, results])

  let rowCounter = 0

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Üst Bar ── */}
      <div className="px-5 pt-3 pb-2 bg-white border-b border-slate-200 shrink-0">

        {/* Satır 1: Başlık + Aksiyon */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[15px] font-bold text-slate-900">Membran Sayımı</h1>
            <p className="text-[11.5px] text-slate-400 mono">
              {totalMembran.toLocaleString('tr')} kalem · {grouped.length} palet
              {counted > 0 && ` · %${totalMembran ? Math.round(counted / totalMembran * 100) : 0} sayıldı`}
              {diffCount > 0 && ` · ${diffCount} fark`}
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={expandAll}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-600 hover:bg-slate-50"
            >
              <span className="ms" style={{ fontSize: 14 }}>unfold_more</span> Tümünü Aç
            </button>
            <button
              onClick={collapseAll}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-600 hover:bg-slate-50"
            >
              <span className="ms" style={{ fontSize: 14 }}>unfold_less</span> Tümünü Kapat
            </button>
            <button onClick={toggleSistem} className={'toggle-btn ' + (hideSistem ? 'active-hide' : '')}>
              <span className="ms" style={{ fontSize: 16 }}>{hideSistem ? 'visibility_off' : 'visibility'}</span>
              <span>{hideSistem ? 'Sistemi Göster' : 'Sistemi Gizle'}</span>
            </button>
            <button onClick={toggleSayilan} className={'toggle-btn ' + (hideSayilan ? 'active-hide' : '')}>
              <span className="ms" style={{ fontSize: 16 }}>{hideSayilan ? 'edit' : 'edit_off'}</span>
              <span>{hideSayilan ? 'Sayılanı Göster' : 'Sayılanı Gizle'}</span>
            </button>
            {!locked && (() => {
              const allFilled = filtered.length > 0 && filtered.every(r => { const m = results[r.id]?.miktar; return m !== undefined && m !== '' && String(m) === String(r.sayim) })
              return (
                <button
                  onClick={() => allFilled ? clearMiktarlar(filtered) : fillFromSistem(filtered)}
                  disabled={filtered.length === 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[12.5px] font-medium disabled:opacity-40 ${allFilled ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                >
                  <span className="ms" style={{ fontSize: 15 }}>{allFilled ? 'backspace' : 'content_copy'}</span>
                  {allFilled ? 'Sayılanı Temizle' : 'Sistemden Doldur'}
                </button>
              )
            })()}
          </div>
        </div>

        {/* Satır 2: Filtreler */}
        <div className="flex items-center gap-2 flex-wrap no-print">
          <div className="relative">
            <span className="ms absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 14 }}>search</span>
            <input
              type="text"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="Kod / Ad / Parti ara…"
              className="pl-7 pr-7 py-1 border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-44"
            />
            {filterSearch && (
              <button onClick={() => setFilterSearch('')} className="ms absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500" style={{ fontSize: 14 }}>close</button>
            )}
          </div>
          <span className="text-[11.5px] text-slate-400 font-medium">Filtre:</span>
          <MultiSelect placeholder="Tüm Durumlar" options={filterOptions.durumlar} value={filterDurum} onChange={setFilterDurum} />
          {filterOptions.urunTipleri.length > 0 && (
            <MultiSelect placeholder="Tüm Ürün Tipleri" options={filterOptions.urunTipleri} value={filterUrunTipi} onChange={setFilterUrunTipi} style={{ borderColor: '#fbbf24' }} />
          )}
          {filterOptions.paletler?.length > 0 && (
            <MultiSelect placeholder="Tüm Paletler" options={filterOptions.paletler} value={filterPalet} onChange={setFilterPalet} style={{ borderColor: '#c4b5fd' }} />
          )}
          <MultiSelect placeholder="Tüm Koridorlar" options={filterOptions.raflar}   value={filterRaf}   onChange={setFilterRaf} />
          <MultiSelect placeholder="Tüm Sütunlar"   options={filterOptions.siralar}  value={filterSira}  onChange={setFilterSira} />
          <MultiSelect placeholder="Tüm Sıralar"    options={filterOptions.kolonlar} value={filterKolon} onChange={setFilterKolon} />
          <MultiSelect placeholder="Tüm Katlar"     options={filterOptions.gozler}   value={filterGoz}   onChange={setFilterGoz} />
          {(filterDurum.length > 0 || filterPalet.length > 0 || filterUrunTipi.length > 0 || filterRaf.length > 0 || filterSira.length > 0 || filterKolon.length > 0 || filterGoz.length > 0 || filterSearch.trim()) && (
            <button
              onClick={() => { setFilterSearch(''); setFilterDurum([]); setFilterPalet([]); setFilterUrunTipi([]); setFilterRaf([]); setFilterSira([]); setFilterKolon([]); setFilterGoz([]) }}
              className="flex items-center gap-1 px-2 py-1 text-[11.5px] text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              <span className="ms" style={{ fontSize: 13 }}>filter_list_off</span> Temizle
            </button>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[11.5px] text-slate-400 font-medium">Sıra:</span>
            <select className="fsel" style={{ borderColor: '#93c5fd' }} value={sortType} onChange={e => setSortType(e.target.value)}>
              <option value="1">Koridor › Sütun › Sıra › Kat</option>
              <option value="2">Koridor › Sütun › Kat › Sıra</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── İçerik ── */}
      {membranRows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-4 shadow-sm">
            <span className="ms text-slate-300" style={{ fontSize: 32 }}>layers</span>
          </div>
          <div className="text-slate-600 font-semibold text-sm mb-1">Membran ürün bulunamadı</div>
          <div className="text-slate-400 text-[13px] mb-4">Excel'de Kategori = "Membran" olan satır yok</div>
          <button onClick={() => onNavigate('upload')} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700">
            <span className="ms" style={{ fontSize: 18 }}>upload_file</span> Excel Yükle
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[12px] text-slate-400">Filtreye uyan kayıt yok.</div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse" style={{ minWidth: 1100 }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-800 text-white text-[11px] mono uppercase tracking-wider">
                <th className="px-3 py-2.5 text-center w-8">#</th>
                <th className="px-3 py-2.5 w-24">Adres</th>
                <th className="px-3 py-2.5 w-28">Kod</th>
                <th className="px-3 py-2.5">Ad</th>
                <th className="px-3 py-2.5 w-28">Parti</th>
                <th className="px-3 py-2.5 w-20 text-center">Durum</th>
                <th className="px-3 py-2.5 w-12 text-right">Adet</th>
                <th className="px-3 py-2.5 w-24">Ambalaj</th>
                <th className="px-3 py-2.5 w-20 text-right sistem-col">Sistem</th>
                <th className="px-3 py-2.5 w-24 text-right text-blue-300 sayilan-col">Sayılan ▾</th>
                <th className="px-3 py-2.5 w-12">Birim</th>
                <th className="px-3 py-2.5">Not</th>
              </tr>
            </thead>
            <tbody className="text-[12.5px]">
              {grouped.map(({ key: paletKey, paletNo, items }) => {
                const total    = items.length
                const cntd     = items.filter(r => results[r.id]?.miktar !== undefined && results[r.id]?.miktar !== '').length
                const hasDiff  = items.some(r => { const m = results[r.id]?.miktar; return m !== undefined && m !== '' && String(m) !== String(r.sayim) })
                const complete = cntd === total && total > 0
                const open     = isPaletOpen(paletKey)
                const kod      = items[0]?.kod

                let headerBg = 'bg-slate-50'
                if (complete && !hasDiff) headerBg = 'bg-emerald-50'
                else if (complete && hasDiff) headerBg = 'bg-red-50'
                else if (cntd > 0) headerBg = 'bg-amber-50'

                return [
                  // Palet başlık satırı
                  <tr
                    key={'palet-' + paletKey}
                    className={`${headerBg} border-b border-slate-200 cursor-pointer select-none`}
                    onClick={() => togglePalet(paletKey)}
                  >
                    <td colSpan={12} className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="ms text-slate-400" style={{ fontSize: 16 }}>
                          {open ? 'expand_more' : 'chevron_right'}
                        </span>
                        <span className="ms text-violet-500" style={{ fontSize: 16 }}>layers</span>
                        <span className="font-semibold text-[12.5px] text-slate-800 mono">Palet: {paletNo}</span>
                        {kod && <span className="text-[11.5px] text-blue-600 mono">{kod}</span>}
                        <span className="text-[11.5px] text-slate-400">{total} kalem</span>
                        <PaletStatusBadge counted={cntd} total={total} hasDiff={hasDiff} />
                      </div>
                    </td>
                  </tr>,

                  // Ürün satırları (açıksa)
                  ...(open ? items.map(row => {
                    rowCounter++
                    const localNum = rowCounter
                    const res      = results[row.id] || {}
                    const hasValue = res.miktar !== undefined && res.miktar !== ''
                    const isDiff   = hasValue && String(res.miktar) !== String(row.sayim)
                    return (
                      <tr
                        key={row.id}
                        className={isDiff ? 'border-b border-slate-100 hover:bg-red-50' : 'border-b border-slate-100 hover:bg-blue-50/30'}
                        style={isDiff ? { background: 'rgba(254,242,242,0.6)' } : {}}
                      >
                        <td className="px-3 py-2 text-center text-slate-400 mono text-[11px]">{localNum}</td>
                        <td className="px-3 py-2 mono text-slate-600 text-[11.5px]">{row.adres}</td>
                        <td className="px-3 py-2 mono font-medium text-blue-700 text-[11.5px]">{row.kod}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{row.ad}</td>
                        <td className="px-3 py-2 mono text-slate-500 text-[11px]">{row.parti}</td>
                        <td className="px-3 py-2 text-center"><DurumBadge durum={row.durum} /></td>
                        <td className="px-3 py-2 text-right mono">{row.adet1}</td>
                        <td className="px-3 py-2 text-slate-500 text-[12px]">{row.ambalaj}</td>
                        <td className="px-3 py-2 text-right mono text-slate-500 sistem-col">{row.sayim}</td>
                        <td className="px-3 py-2 text-right sayilan-col">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={res.miktar ?? ''}
                              onChange={e => updateResult(row.id, { miktar: e.target.value })}
                              placeholder="—"
                              disabled={locked}
                              className={'input-count ' + (isDiff ? 'input-diff' : hasValue ? 'input-ok' : '')}
                            />
                            {isDiff && <span className="ms text-red-400" style={{ fontSize: 14 }}>warning</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-400 text-[12px]">{row.birim}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={res.notlar ?? ''}
                            onChange={e => updateResult(row.id, { notlar: e.target.value })}
                            placeholder="not..."
                            disabled={locked}
                            className="w-full bg-transparent border-none text-[12px] text-slate-400 placeholder-slate-300 outline-none disabled:cursor-not-allowed"
                          />
                        </td>
                      </tr>
                    )
                  }) : [])
                ]
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Alt Bar ── */}
      {membranRows.length > 0 && (
        <div className="px-5 py-2 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 no-print">
          <div className="flex items-center gap-2 text-[11.5px] text-slate-400">
            <span className="ms text-emerald-400" style={{ fontSize: 14 }}>cloud_done</span>
            <span>Otomatik kaydediliyor</span>
            <span className="text-slate-300">·</span>
            <span>{filtered.length.toLocaleString('tr')} kayıt · {grouped.length} palet</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGorevModal(true)}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[12.5px] font-medium disabled:opacity-40"
            >
              <span className="ms" style={{ fontSize: 15 }}>assignment_ind</span> Sayımcıya Gönder
            </button>
            <button onClick={() => exportResults(membranRows, results, session, firmaProfile)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-[12.5px] font-medium text-slate-700 hover:bg-slate-50">
              <span className="ms" style={{ fontSize: 15 }}>download</span> Excel'e Aktar
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-[12.5px] font-medium text-slate-700 hover:bg-slate-50">
              <span className="ms" style={{ fontSize: 15 }}>print</span> Yazdır
            </button>
          </div>
        </div>
      )}

      <div className="hidden">
        <PrintSheet ref={printRef} rows={filtered} results={results} session={session} mode="sayim" hideSayilan={hideSayilan} sayimTuru="Membran Sayımı" paletGrouped firmaUnvani={firmaProfile?.unvan} />
      </div>

      {gorevModal && (
        <GorevAtaModal
          rows={filtered}
          onClose={() => setGorevModal(false)}
          sayimTipi="membran"
          filtreOzeti={buildFiltreOzeti({ filterSearch, filterDurum, filterPalet, filterUrunTipi, filterRaf, filterSira, filterKolon, filterGoz })}
        />
      )}
    </div>
  )
}
