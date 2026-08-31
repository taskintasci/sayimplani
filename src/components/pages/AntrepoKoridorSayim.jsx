import { useState, useRef, useMemo, useEffect } from 'react'
import { useReactToPrint } from 'react-to-print'
import useStore from '../../store/useStore'
import { sortRows, computeFilterOptions, parseAdres, getUrunTipi, buildFiltreOzeti, getKoridor, matchesKoridorKapsam } from '../../utils/adresUtils'
import { exportAntrepoResults } from '../../utils/excelExport'
import AntrepoPrintSheet from '../print/AntrepoPrintSheet'
import MultiSelect from '../shared/MultiSelect'
import GorevAtaModal from './GorevAtaModal'

function AntrepoDurumBadge({ durum }) {
  if (durum === 'Normal') return <span className="badge badge-normal">{durum}</span>
  if (durum === 'Bloke')  return <span className="badge badge-bloke">{durum}</span>
  if (durum === 'Özel')   return <span className="badge" style={{ background: '#ede9fe', color: '#5b21b6' }}>{durum}</span>
  if (durum === 'Kalite') return <span className="badge" style={{ background: '#dbeafe', color: '#1e40af' }}>{durum}</span>
  return <span className="badge badge-normal">{durum || '—'}</span>
}

export default function AntrepoKoridorSayim({ onNavigate }) {
  const { rows, results, session, updateResult, fillFromSistem, clearMiktarlar, koridorlar, koridorMatched, addKoridorlar, removeKoridor, clearKoridor, pendingKodFilter, clearPendingKodFilter, firmaProfile, sortType, setSortType } = useStore()
  const printRef = useRef()
  const locked = session.durum === 'Tamamlandı'

  // Koridor sayımı kör modda yapılır: sistem miktarı baştan gizli, üstteki
  // "Sistemi Göster" ile açılabilir.
  const [hideSistem, setHideSistem]   = useState(true)
  const [hideSayilan, setHideSayilan] = useState(false)
  const [filterSearch, setFilterSearch] = useState('')
  const [filterDurum, setFilterDurum] = useState([])
  const [filterBlok, setFilterBlok]     = useState([])
  const [filterKoridor, setFilterKoridor]   = useState([])
  const [filterSutun, setFilterSutun] = useState([])
  const [filterKat, setFilterKat]     = useState([])
  const [filterKategori, setFilterKategori] = useState([])
  const [filterUrunTipi, setFilterUrunTipi] = useState([])
  const [onlyDiff, setOnlyDiff]       = useState(false)
  const [page, setPage]               = useState(1)
  const [pageSize, setPageSize]       = useState(100)
  const [gorevModal, setGorevModal]   = useState(false)

  const handlePrint = useReactToPrint({ contentRef: printRef })

  // hideSistem başlangıçta true — global 'hide-sistem' sınıfını mount'ta da uygula
  useEffect(() => {
    document.body.classList.toggle('hide-sistem', hideSistem)
    // Global body sınıfları sayfa değişince kalmasın — sonraki sayfada
    // Sistem/Sayılan kolonu görünmez kalıyordu (opacity:0 + pointer-events:none)
    return () => {
      document.body.classList.remove('hide-sistem')
      document.body.classList.remove('hide-sayilan')
    }
  }, [])

  useEffect(() => {
    if (pendingKodFilter) {
      setFilterSearch(pendingKodFilter)
      clearPendingKodFilter()
    }
  }, [pendingKodFilter])

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

  // Oturumdaki tüm koridorlar (sayım listesine eklenebilecek adaylar) ve her
  // birinin kaç kalem içerdiği — çiplerde ve ekleme listesinde gösterilir.
  const sablon = firmaProfile?.sablon
  const koridorSayilari = useMemo(() => {
    const map = {}
    rows.forEach(r => {
      const k = getKoridor(r.adres, sablon)
      if (k) map[k] = (map[k] || 0) + 1
    })
    return map
  }, [rows, sablon])

  const tumKoridorlar = useMemo(
    () => Object.keys(koridorSayilari).sort((a, b) => a.localeCompare(b, 'tr', { numeric: true })),
    [koridorSayilari]
  )

  // Çiplerdeki her kapsam anahtarı ("1-AL" veya "1-AL|05") için kalem sayısı.
  const cipSayilari = useMemo(() => {
    const map = {}
    koridorlar.forEach(k => { map[k] = rows.filter(r => matchesKoridorKapsam(r.adres, sablon, [k])).length })
    return map
  }, [koridorlar, rows, sablon])

  const filterOptions = useMemo(
    () => computeFilterOptions(koridorMatched, { filterSearch, filterDurum, filterKategori, filterUrunTipi, filterBlok, filterKoridor, filterSutun, filterKat }),
    [koridorMatched, filterSearch, filterDurum, filterKategori, filterUrunTipi, filterBlok, filterKoridor, filterSutun, filterKat]
  )

  const filteredBase = useMemo(() => {
    const q = filterSearch.trim().toLowerCase()
    let result = koridorMatched.filter(r => {
      if (q && !(
        r.kod?.toLowerCase().includes(q) ||
        r.ad?.toLowerCase().includes(q) ||
        r.parti?.toLowerCase().includes(q)
      )) return false
      if (filterDurum.length > 0    && !filterDurum.includes(r.durum))       return false
      if (filterKategori.length > 0 && !filterKategori.includes(r.kategori)) return false
      if (filterUrunTipi.length > 0 && !filterUrunTipi.includes(getUrunTipi(r.kod))) return false
      const p = parseAdres(r.adres)
      if (filterBlok.length > 0   && !filterBlok.includes(p.blok))     return false
      if (filterKoridor.length > 0  && !filterKoridor.includes(p.koridor))   return false
      if (filterSutun.length > 0 && !filterSutun.includes(p.sutun)) return false
      if (filterKat.length > 0   && !filterKat.includes(p.kat))     return false
      return true
    })
    return sortRows(result, sortType)
  }, [koridorMatched, filterSearch, filterDurum, filterKategori, filterUrunTipi, filterBlok, filterKoridor, filterSutun, filterKat, sortType])

  const filtered = useMemo(() => {
    if (!onlyDiff) return filteredBase
    return filteredBase.filter(r => {
      const m = results[r.id]?.miktar
      return m !== undefined && m !== '' && String(m) !== String(r.sayim)
    })
  }, [filteredBase, onlyDiff, results])

  // Sayaçlar aktif filtreye (filteredBase) göre — Raf Listesi'nden bir koridor
  // seçilip aktarıldığında üstteki Sayılan/Farklılık/Bekliyor yalnız o koridoru
  // yansıtsın (koridorMatched, kodun filtre dışı diğer lokasyonlarını da içerir).
  const counted   = useMemo(() => filteredBase.filter(r => results[r.id]?.miktar !== undefined && results[r.id]?.miktar !== ''), [filteredBase, results])
  const diffCount = useMemo(() => filteredBase.filter(r => { const m = results[r.id]?.miktar; return m !== undefined && m !== '' && String(m) !== String(r.sayim) }).length, [filteredBase, results])
  const waiting   = filteredBase.length - counted.length

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage   = Math.min(page, totalPages)
  const paginated  = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  )

  useEffect(() => { setPage(1) }, [filtered.length, pageSize])

  // Görev özeti: atanan (tüm filtreler uygulanmış) satırların gerçekten hangi
  // koridorlarda olduğu + koridor dışı aktif filtreler. `koridorlar` state'i
  // yerine filtered'dan türetilir ki ek filtreler daralttıysa özet de daralsın;
  // koridor boyutu (filterBlok) burada tekrar edilmez.
  const gorevOzeti = useMemo(() => {
    const kor = [...new Set(filtered.map(r => getKoridor(r.adres, sablon)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }))
    const korStr = kor.length
      ? `Koridor: ${kor.slice(0, 6).join(', ')}${kor.length > 6 ? ` +${kor.length - 6}` : ''}`
      : ''
    return [korStr, buildFiltreOzeti({ filterSearch, filterDurum, filterKategori, filterUrunTipi, filterSutun, filterKat })]
      .filter(Boolean).join(' · ')
  }, [filtered, sablon, filterSearch, filterDurum, filterKategori, filterUrunTipi, filterSutun, filterKat])

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Üst bar ── */}
      <div className="px-5 pt-3 pb-2 bg-white border-b border-slate-200 shrink-0">

        {/* Satır 1: Başlık + Aksiyon */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[15px] font-bold text-slate-900">WMS Antrepo Kör Raf Sayımı</h1>
            <p className="text-[11.5px] text-slate-400 mono">
              {filteredBase.length > 0
                ? `${filteredBase.length.toLocaleString('tr')} kalem · %${Math.round(counted.length / filteredBase.length * 100)} sayıldı${diffCount > 0 ? ` · ${diffCount} fark` : ''}`
                : koridorlar.length > 0 ? 'Filtreye uyan kalem yok' : 'Raf Listesi\'nden veya aşağıdan koridor seçin'}
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
            {!locked && koridorlar.length > 0 && (
              <button onClick={clearKoridor} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-[12.5px] font-medium hover:bg-red-100">
                <span className="ms" style={{ fontSize: 15 }}>delete_sweep</span> Temizle
              </button>
            )}
          </div>
        </div>

        {/* Satır 2: Koridor ekleme — asıl giriş noktası Raf Listesi, bu seçici
            sayfadan ayrılmadan koridor eklemek için */}
        {!locked && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11.5px] text-slate-400 font-medium">Koridor Ekle:</span>
          <MultiSelect
            placeholder={tumKoridorlar.length > 0 ? 'Koridor seçin…' : 'Önce Excel yükleyin'}
            options={tumKoridorlar.filter(k => !koridorlar.includes(k))}
            value={[]}
            onChange={secilen => { if (secilen.length > 0) addKoridorlar(secilen) }}
            style={{ borderColor: '#93c5fd' }}
          />
          <span className="text-[11px] text-slate-400">
            Toplu seçim için <button onClick={() => onNavigate('antreporafliste')} className="text-blue-600 hover:underline font-medium">Raf Listesi</button>
          </span>
        </div>
        )}

        {/* Satır 3: Seçili koridor chip listesi */}
        {koridorlar.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] text-slate-400 mono uppercase tracking-wide">Seçili Koridor</span>
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold mono min-w-[20px]">
                {koridorlar.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-[84px] overflow-y-auto">
              {koridorlar.map(k => {
                const bar = k.indexOf('|')
                const etiket = bar === -1 ? k : `${k.slice(0, bar)} › Sütun ${k.slice(bar + 1)}`
                const adet = cipSayilari[k]
                const notFound = !adet
                return (
                  <div key={k} className={`flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md border text-[11.5px] ${notFound ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>
                    <span className="mono font-semibold">{etiket}</span>
                    {adet ? <><span className="text-slate-300">·</span><span className="text-slate-500">{adet.toLocaleString('tr')} kalem</span></> : null}
                    {notFound && <span className="text-amber-500 text-[10px]">bu oturumda yok</span>}
                    <button onClick={() => removeKoridor(k)} className="ml-0.5 flex items-center justify-center w-4 h-4 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors">
                      <span className="ms" style={{ fontSize: 13 }}>close</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Satır 4: Filtreler + Sıralama */}
        <div className="flex items-center gap-2 flex-wrap no-print">
          {/* Arama */}
          <div className="relative">
            <span className="ms absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 14 }}>search</span>
            <input
              type="text"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="Stok Kodu / Ad / Beyanname ara…"
              className="pl-7 pr-7 py-1 border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-52"
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
          {filterOptions.kategoriler.length > 0 && (
            <MultiSelect placeholder="Tüm Kategoriler" options={filterOptions.kategoriler} value={filterKategori} onChange={setFilterKategori} />
          )}
          <MultiSelect placeholder="Tüm Bloklar"    options={filterOptions.bloklar}    value={filterBlok}    onChange={setFilterBlok} />
          <MultiSelect placeholder="Tüm Koridorlar" options={filterOptions.koridorlar} value={filterKoridor} onChange={setFilterKoridor} />
          <MultiSelect placeholder="Tüm Sütunlar"   options={filterOptions.sutunlar}   value={filterSutun}   onChange={setFilterSutun} />
          <MultiSelect placeholder="Tüm Katlar"     options={filterOptions.katlar}     value={filterKat}     onChange={setFilterKat} />
          <label className="flex items-center gap-1.5 text-[11.5px] text-slate-500 cursor-pointer ml-1">
            <input type="checkbox" checked={onlyDiff} onChange={e => setOnlyDiff(e.target.checked)} className="rounded" />
            Sadece farklılıklar
          </label>
          {(filterDurum.length > 0 || filterKategori.length > 0 || filterUrunTipi.length > 0 || filterBlok.length > 0 || filterKoridor.length > 0 || filterSutun.length > 0 || filterKat.length > 0 || filterSearch.trim()) && (
            <button
              onClick={() => { setFilterSearch(''); setFilterDurum([]); setFilterKategori([]); setFilterUrunTipi([]); setFilterBlok([]); setFilterKoridor([]); setFilterSutun([]); setFilterKat([]) }}
              className="flex items-center gap-1 px-2 py-1 text-[11.5px] text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              <span className="ms" style={{ fontSize: 13 }}>filter_list_off</span> Temizle
            </button>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[11.5px] text-slate-400 font-medium">Sıra:</span>
            <select className="fsel" style={{ borderColor: '#93c5fd' }} value={sortType} onChange={e => setSortType(e.target.value)}>
              <option value="1">Blok › Koridor › Sütun › Kat</option>
              <option value="2">Blok › Koridor › Kat › Sütun</option>
            </select>
          </div>
        </div>

        {/* Satır 5: Mini istatistik */}
        <div className="flex items-center gap-5 mt-2">
          <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            Sayılan: <strong className="text-slate-700 ml-0.5">{counted.length.toLocaleString('tr')}</strong>
          </div>
          <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            Farklılık: <strong className="text-red-600 ml-0.5">{diffCount.toLocaleString('tr')}</strong>
          </div>
          <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
            Bekliyor: <strong className="text-slate-700 ml-0.5">{waiting.toLocaleString('tr')}</strong>
          </div>
        </div>
      </div>

      {/* ── Tablo ── */}
      {koridorlar.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-4 shadow-sm">
            <span className="ms text-slate-300" style={{ fontSize: 32 }}>view_week</span>
          </div>
          <div className="text-slate-600 font-semibold text-sm mb-1">Kör Raf Sayımı Başlatılmadı</div>
          <div className="text-slate-400 text-[13px]">Yukarıdan koridor seçin veya Raf Listesi'nden toplu aktarın</div>
        </div>
      ) : koridorMatched.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
          <span className="ms text-slate-300 mb-3" style={{ fontSize: 40 }}>search_off</span>
          <div className="text-slate-500 font-semibold text-sm">Eşleşen kayıt bulunamadı</div>
          <div className="text-slate-400 text-xs mt-1">Seçili koridorlarda bu oturuma ait satır yok</div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse" style={{ minWidth: 1500 }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-800 text-white text-[11px] mono uppercase tracking-wider">
                <th className="px-3 py-2.5 text-center w-8">#</th>
                <th className="px-3 py-2.5 w-24">Adres</th>
                <th className="px-3 py-2.5 w-28">Stok Kodu</th>
                <th className="px-3 py-2.5">Stok Adı</th>
                <th className="px-3 py-2.5 w-28">Beyanname</th>
                <th className="px-3 py-2.5 w-20 text-center">Durum</th>
                <th className="px-3 py-2.5 w-24">Kategori</th>
                <th className="px-3 py-2.5 w-32">Palet Barkodu</th>
                <th className="px-3 py-2.5 w-16 text-right">Palet Adeti</th>
                <th className="px-3 py-2.5 w-20 text-right">Toplam Stok</th>
                <th className="px-3 py-2.5 w-20 text-right">Rezerve Adet</th>
                <th className="px-3 py-2.5 w-20 text-right sistem-col">Depo Kalan Stok</th>
                <th className="px-3 py-2.5 w-24 text-right text-blue-300 sayilan-col" style={{ background: '#1d4ed8' }}>Sayılan ▾</th>
                <th className="px-3 py-2.5 w-16">Birim Adı</th>
                <th className="px-3 py-2.5">Not</th>
              </tr>
            </thead>
            <tbody className="text-[12.5px]">
              {paginated.map((row, localI) => {
                const i        = (safePage - 1) * pageSize + localI
                const res      = results[row.id] || {}
                const hasValue = res.miktar !== undefined && res.miktar !== ''
                const isDiff   = hasValue && String(res.miktar) !== String(row.sayim)
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
                    <td className="px-3 py-2 text-center"><AntrepoDurumBadge durum={row.durum} /></td>
                    <td className="px-3 py-2 text-slate-500 text-[12px]">{row.kategori}</td>
                    <td className="px-3 py-2 mono text-slate-500 text-[11px]">{row.paletBarkodu}</td>
                    <td className="px-3 py-2 text-right mono">{row.paletAdeti}</td>
                    <td className="px-3 py-2 text-right mono text-slate-500">{row.adet1}</td>
                    <td className="px-3 py-2 text-right mono text-slate-500">{row.rezerveAdet}</td>
                    <td className="px-3 py-2 text-right mono text-slate-500 sistem-col">{row.sayim}</td>
                    <td className="px-3 py-2 text-right sayilan-col" style={{ borderLeft: '1px solid #3b82f6', background: isDiff ? undefined : hasValue ? undefined : '#eff6ff' }}>
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
          {filtered.length === 0 && koridorMatched.length > 0 && (
            <div className="p-8 text-center text-[11.5px] text-slate-400">Filtreye uyan kayıt yok.</div>
          )}
        </div>
      )}

      {/* ── Alt bar ── */}
      {koridorMatched.length > 0 && (
        <div className="px-5 py-2 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 no-print">
          <div className="flex items-center gap-2 text-[11.5px] text-slate-400">
            <span className="ms text-emerald-400" style={{ fontSize: 14 }}>cloud_done</span>
            <span>Otomatik kaydediliyor</span>
            <span className="text-slate-300">·</span>
            <span>{filtered.length.toLocaleString('tr')} kayıt</span>
          </div>

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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setGorevModal(true)}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[12.5px] font-medium disabled:opacity-40"
            >
              <span className="ms" style={{ fontSize: 15 }}>assignment_ind</span> Sayımcıya Gönder
            </button>
            <button onClick={() => exportAntrepoResults(koridorMatched, results, session, firmaProfile)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-[12.5px] font-medium text-slate-700 hover:bg-slate-50">
              <span className="ms" style={{ fontSize: 15 }}>download</span> Excel'e Aktar
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-[12.5px] font-medium text-slate-700 hover:bg-slate-50">
              <span className="ms" style={{ fontSize: 15 }}>print</span> Yazdır
            </button>
          </div>
        </div>
      )}

      <div className="hidden">
        <AntrepoPrintSheet ref={printRef} rows={filtered} results={results} session={session} mode="kor" hideSistem={hideSistem} hideSayilan={hideSayilan} sayimTuru="Kör Raf Sayım" firmaUnvani={firmaProfile?.unvan} />
      </div>

      {gorevModal && (
        <GorevAtaModal
          rows={filtered}
          onClose={() => setGorevModal(false)}
          sayimTipi="antrepokoridor"
          filtreOzeti={gorevOzeti}
        />
      )}
    </div>
  )
}
