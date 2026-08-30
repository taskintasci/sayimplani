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

export default function StokSayim({ onNavigate }) {
  const { rows, results, session, updateResult, fillFromSistem, clearMiktarlar, pendingKodFilter, clearPendingKodFilter, rowsLoading, firmaProfile, sortType, setSortType } = useStore()
  const printRef = useRef()
  const locked = session.durum === 'Tamamlandı'

  const [hideSistem, setHideSistem] = useState(false)
  const [hideSayilan, setHideSayilan] = useState(false)
  const [filterSearch, setFilterSearch] = useState('')
  const [filterDurum, setFilterDurum] = useState([])
  const [filterRaf, setFilterRaf] = useState([])
  const [filterSira, setFilterSira] = useState([])
  const [filterKolon, setFilterKolon] = useState([])
  const [filterGoz, setFilterGoz] = useState([])
  const [filterKategori, setFilterKategori] = useState([])
  const [filterUrunTipi, setFilterUrunTipi] = useState([])
  const [durumFiltre, setDurumFiltre] = useState('tumu')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [gorevModal, setGorevModal] = useState(false)

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

  const filterOptions = useMemo(
    () => computeFilterOptions(rows, { filterSearch, filterDurum, filterKategori, filterUrunTipi, filterRaf, filterSira, filterKolon, filterGoz }),
    [rows, filterSearch, filterDurum, filterKategori, filterUrunTipi, filterRaf, filterSira, filterKolon, filterGoz]
  )

  const filteredBase = useMemo(() => {
    const q = filterSearch.trim().toLowerCase()
    let result = rows.filter(r => {
      if (q && !(
        r.kod?.toLowerCase().includes(q) ||
        r.ad?.toLowerCase().includes(q) ||
        r.parti?.toLowerCase().includes(q)
      )) return false
      if (filterDurum.length > 0    && !filterDurum.includes(r.durum))       return false
      if (filterKategori.length > 0 && !filterKategori.includes(r.kategori)) return false
      if (filterUrunTipi.length > 0 && !filterUrunTipi.includes(getUrunTipi(r.kod))) return false
      const p = parseAdres(r.adres)
      if (filterRaf.length > 0   && !filterRaf.includes(p.raf))     return false
      if (filterSira.length > 0  && !filterSira.includes(p.sira))   return false
      if (filterKolon.length > 0 && !filterKolon.includes(p.kolon)) return false
      if (filterGoz.length > 0   && !filterGoz.includes(p.goz))     return false
      return true
    })
    return sortRows(result, sortType)
  }, [rows, filterSearch, filterDurum, filterKategori, filterUrunTipi, filterRaf, filterSira, filterKolon, filterGoz, sortType])

  // Durum filtresi: mini istatistik rozetlerinden (Sayılan/Farklılık/Bekliyor)
  // bağımsız, ayrı bir kontrol — rozetler sadece bilgi amaçlı kalıyor.
  const filtered = useMemo(() => {
    if (durumFiltre === 'tumu') return filteredBase
    return filteredBase.filter(r => {
      const m = results[r.id]?.miktar
      const hasValue = m !== undefined && m !== ''
      if (durumFiltre === 'sayilan')   return hasValue
      if (durumFiltre === 'farklilik') return hasValue && String(m) !== String(r.sayim)
      if (durumFiltre === 'bekliyor')  return !hasValue
      return true
    })
  }, [filteredBase, durumFiltre, results])

  const counted   = useMemo(() => rows.filter(r => results[r.id]?.miktar !== undefined && results[r.id]?.miktar !== ''), [rows, results])
  const diffCount = useMemo(() => rows.filter(r => { const m = results[r.id]?.miktar; return m !== undefined && m !== '' && String(m) !== String(r.sayim) }).length, [rows, results])
  const waiting   = rows.length - counted.length
  const allFilled = useMemo(
    () => filtered.length > 0 && filtered.every(r => { const m = results[r.id]?.miktar; return m !== undefined && m !== '' && String(m) === String(r.sayim) }),
    [filtered, results]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage   = Math.min(page, totalPages)
  const paginated  = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  )

  // Filtre değişince 1. sayfaya dön
  useEffect(() => { setPage(1) }, [filtered.length, pageSize])

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Üst Bar ── */}
      <div className="px-5 pt-3 pb-2 bg-white border-b border-slate-200 shrink-0">

        {/* Satır 1: Başlık + Aksiyon Butonları */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[15px] font-bold text-slate-900">Stok Sayımı</h1>
            <p className="text-[11.5px] text-slate-400 mono">
              {rows.length.toLocaleString('tr')} kalem
              {counted.length > 0 && ` · %${rows.length ? Math.round(counted.length / rows.length * 100) : 0} sayıldı`}
              {diffCount > 0 && ` · ${diffCount} fark`}
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button onClick={toggleSistem} className={'toggle-btn ' + (hideSistem ? 'active-hide' : '')}>
              <span className="ms" style={{ fontSize: 16 }}>{hideSistem ? 'visibility_off' : 'visibility'}</span>
              <span>{hideSistem ? 'Sistemi Göster' : 'Sistemi Gizle'}</span>
            </button>
            <button onClick={toggleSayilan} className={'toggle-btn ' + (hideSayilan ? 'active-hide' : '')}>
              <span className="ms" style={{ fontSize: 16 }}>{hideSayilan ? 'edit' : 'edit_off'}</span>
              <span>{hideSayilan ? 'Sayılanı Göster' : 'Sayılanı Gizle'}</span>
            </button>
            {!locked && (
              <button
                onClick={() => allFilled ? clearMiktarlar(filtered) : fillFromSistem(filtered)}
                disabled={filtered.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[12.5px] font-medium disabled:opacity-40 ${allFilled ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
              >
                <span className="ms" style={{ fontSize: 15 }}>{allFilled ? 'backspace' : 'content_copy'}</span>
                {allFilled ? 'Sayılanı Temizle' : 'Sistemden Doldur'}
              </button>
            )}
          </div>
        </div>

        {/* Satır 2: Filtreler + Sıralama */}
        <div className="flex items-center gap-2 flex-wrap no-print">
          {/* Arama çubuğu */}
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
              <button
                onClick={() => setFilterSearch('')}
                className="ms absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                style={{ fontSize: 14 }}
              >close</button>
            )}
          </div>
          <span className="text-[11.5px] text-slate-400 font-medium">Filtre:</span>
          <MultiSelect placeholder="Tüm Durumlar" options={filterOptions.durumlar} value={filterDurum} onChange={setFilterDurum} />
          {filterOptions.urunTipleri.length > 0 && (
            <MultiSelect placeholder="Tüm Ürün Tipleri" options={filterOptions.urunTipleri} value={filterUrunTipi} onChange={setFilterUrunTipi} style={{ borderColor: '#fbbf24' }} />
          )}
          {filterOptions.kategoriler.length > 0 && (
            <MultiSelect placeholder="Tüm Kategoriler" options={filterOptions.kategoriler} value={filterKategori} onChange={setFilterKategori} />
          )}
          <MultiSelect placeholder="Tüm Koridorlar" options={filterOptions.raflar}   value={filterRaf}   onChange={setFilterRaf} />
          <MultiSelect placeholder="Tüm Sütunlar"   options={filterOptions.siralar}  value={filterSira}  onChange={setFilterSira} />
          <MultiSelect placeholder="Tüm Sıralar"    options={filterOptions.kolonlar} value={filterKolon} onChange={setFilterKolon} />
          <MultiSelect placeholder="Tüm Katlar"     options={filterOptions.gozler}   value={filterGoz}   onChange={setFilterGoz} />
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-[11.5px] text-slate-400 font-medium">Durum:</span>
            <select className="fsel" value={durumFiltre} onChange={e => setDurumFiltre(e.target.value)}>
              <option value="tumu">Tümü</option>
              <option value="sayilan">Sayılan</option>
              <option value="farklilik">Farklılık</option>
              <option value="bekliyor">Bekliyor</option>
            </select>
          </div>
          {(filterDurum.length > 0 || filterKategori.length > 0 || filterUrunTipi.length > 0 || filterRaf.length > 0 || filterSira.length > 0 || filterKolon.length > 0 || filterGoz.length > 0 || filterSearch.trim()) && (
            <button
              onClick={() => { setFilterSearch(''); setFilterDurum([]); setFilterKategori([]); setFilterUrunTipi([]); setFilterRaf([]); setFilterSira([]); setFilterKolon([]); setFilterGoz([]) }}
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

        {/* Satır 3: Mini İstatistik */}
        <div className="flex items-center gap-5 mt-2">
          <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
            Sayılan: <strong className="text-slate-700 ml-0.5">{counted.length.toLocaleString('tr')}</strong>
          </div>
          <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>
            Farklılık: <strong className="text-red-600 ml-0.5">{diffCount.toLocaleString('tr')}</strong>
          </div>
          <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block"></span>
            Bekliyor: <strong className="text-slate-700 ml-0.5">{waiting.toLocaleString('tr')}</strong>
          </div>
        </div>
      </div>

      {/* ── Tablo ── */}
      {rowsLoading ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse" style={{ minWidth: 1100 }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-800">
                {[8, 96, 112, 200, 112, 80, 48, 96, 80, 96, 48, 120].map((w, i) => (
                  <th key={i} className="px-3 py-2.5">
                    <span className="skeleton h-3 inline-block" style={{ width: w * 0.5 + 'px', opacity: 0.3 }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 18 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100" style={i % 2 === 1 ? { background: '#f8fafc' } : {}}>
                  {[8, 96, 112, 200, 112, 80, 48, 96, 80, 96, 48, 120].map((w, j) => (
                    <td key={j} className="px-3 py-2.5">
                      <span className="skeleton h-3 inline-block" style={{ width: (w * (0.4 + Math.random() * 0.4)) + 'px' }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-4 shadow-sm">
            <span className="ms text-slate-300" style={{ fontSize: 32 }}>upload_file</span>
          </div>
          <div className="text-slate-600 font-semibold text-sm mb-1">Henüz dosya yüklenmedi</div>
          <div className="text-slate-400 text-[13px] mb-4">RAPOR5.xls veya Sku_Sayım_Listesi.xlsx yükleyin</div>
          <button onClick={() => onNavigate('upload')} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all">
            <span className="ms" style={{ fontSize: 18 }}>upload_file</span> Excel Yükle
          </button>
        </div>
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
              {paginated.map((row, localI) => {
                const i = (safePage - 1) * pageSize + localI
                const res = results[row.id] || {}
                const hasValue = res.miktar !== undefined && res.miktar !== ''
                const isDiff = hasValue && String(res.miktar) !== String(row.sayim)
                return (
                  <tr
                    key={row.id}
                    className={isDiff ? 'border-b border-slate-100 hover:bg-red-50' : 'border-b border-slate-100 hover:bg-blue-50/30'}
                    style={isDiff ? { background: 'rgba(254,242,242,0.6)' } : i % 2 === 1 ? { background: '#f8fafc' } : {}}
                  >
                    <td className="px-3 py-2 text-center text-slate-400 mono text-[11px]">{i + 1}</td>
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
              })}
            </tbody>
          </table>
          {filtered.length === 0 && rows.length > 0 && (
            <div className="p-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3">
                <span className="ms text-slate-300" style={{ fontSize: 20 }}>search_off</span>
              </div>
              <p className="text-[13px] font-medium text-slate-500">Filtreye uyan kayıt yok</p>
              <p className="text-[11.5px] text-slate-400 mt-0.5">Filtreleri temizleyerek tüm kayıtları görebilirsiniz</p>
            </div>
          )}
        </div>
      )}

      {/* ── Alt Bar ── */}
      {rows.length > 0 && (
        <div className="px-5 py-2 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 no-print">
          {/* Sol: kayıt bilgisi */}
          <div className="flex items-center gap-2 text-[11.5px] text-slate-400">
            <span className="ms text-emerald-400" style={{ fontSize: 14 }}>cloud_done</span>
            <span>Otomatik kaydediliyor</span>
            <span className="text-slate-300">·</span>
            <span>{filtered.length.toLocaleString('tr')} kayıt</span>
          </div>

          {/* Orta: sayfalama */}
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
              <option value={200}>200 / sayfa</option>
            </select>
          </div>

          {/* Sağ: aksiyon butonları */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGorevModal(true)}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[12.5px] font-medium disabled:opacity-40"
            >
              <span className="ms" style={{ fontSize: 15 }}>assignment_ind</span> Sayımcıya Gönder
            </button>
            <button onClick={() => exportResults(rows, results, session, firmaProfile)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-[12.5px] font-medium text-slate-700 hover:bg-slate-50">
              <span className="ms" style={{ fontSize: 15 }}>download</span> Excel'e Aktar
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-[12.5px] font-medium text-slate-700 hover:bg-slate-50">
              <span className="ms" style={{ fontSize: 15 }}>print</span> Yazdır
            </button>
          </div>
        </div>
      )}

      <div className="hidden">
        <PrintSheet ref={printRef} rows={filtered} results={results} session={session} mode="sayim" hideSayilan={hideSayilan} sayimTuru="Tüm Stok Sayımı" firmaUnvani={firmaProfile?.unvan} />
      </div>

      {gorevModal && (
        <GorevAtaModal
          rows={filtered}
          onClose={() => setGorevModal(false)}
          sayimTipi="stok"
          filtreOzeti={buildFiltreOzeti({ filterSearch, filterDurum, filterKategori, filterUrunTipi, filterRaf, filterSira, filterKolon, filterGoz })}
        />
      )}
    </div>
  )
}
