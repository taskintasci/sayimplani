import { useState, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactToPrint } from 'react-to-print'
import useStore from '../../store/useStore'
import { exportResults, exportRaporFarklar } from '../../utils/excelExport'
import PrintSheet from '../print/PrintSheet'

function formatTime(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

export default function Panel({ onNavigate }) {
  const { rows, results, session, events, importFormat, clearRows, userRole, finishCounting, updateSessionNote, manualRows, firmaProfile } = useStore(
    useShallow(s => ({
      rows:        s.rows,
      results:     s.results,
      session:     s.session,
      events:      s.events,
      importFormat: s.importFormat,
      clearRows:   s.clearRows,
      userRole:    s.userRole,
      finishCounting: s.finishCounting,
      updateSessionNote: s.updateSessionNote,
      manualRows:  s.manualRows,
      firmaProfile: s.firmaProfile,
    }))
  )
  const [confirmClear, setConfirmClear] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const isYonetici = userRole === 'yonetici' || userRole === 'superadmin'
  const locked = session.durum === 'Tamamlandı'

  // Panel'den "Tüm Stok" yazdırma/Excel — filtre yok, her zaman tüm satırlar
  // (rows). Manuel eklenen kalemler (sistemde bulunmayanlar) sayfanın/
  // Excel'in EN SONUNA eklensin diye sentetik "sistem 0, sayılan miktar"
  // satır+sonuç olarak printRows/printResults'a birleştiriliyor — PrintSheet
  // bileşeninin kendisine dokunmaya gerek kalmadı.
  const printRef = useRef()
  const handlePrint = useReactToPrint({ contentRef: printRef })
  const manualAsRows = useMemo(
    () => manualRows.map(m => ({ id: m.id, adres: m.adres, kod: m.kod, ad: m.ad, parti: m.parti, durum: m.durum, birim: m.birim, sayim: 0 })),
    [manualRows]
  )
  const printRows = useMemo(() => [...rows, ...manualAsRows], [rows, manualAsRows])
  const printResults = useMemo(() => {
    if (manualRows.length === 0) return results
    const merged = { ...results }
    manualRows.forEach(m => { merged[m.id] = { miktar: m.miktar, notlar: m.not } })
    return merged
  }, [results, manualRows])

  const counted  = useMemo(() => rows.filter(r => results[r.id]?.miktar !== undefined && results[r.id]?.miktar !== ''), [rows, results])
  const diff     = useMemo(() => rows.filter(r => { const m = results[r.id]?.miktar; return m !== undefined && m !== '' && String(m) !== String(r.sayim) }), [rows, results])
  const approved = useMemo(() => rows.filter(r => results[r.id]?.status === 'Onaylandı'), [rows, results])
  const pct      = rows.length > 0 ? Math.round(counted.length / rows.length * 100) : 0

  // Sil, Yenisini Yükle sonrası satırlara yeni rastgele id atanınca Firestore'daki
  // sayım sonuçları öksüz kalıp erişilemez hale geliyor (bkz. handleClearRows) —
  // 2026-08'de mutabakat bekleyen bir sayımın tüm farkları böyle kayboldu. Silmeden
  // önce mevcut farkları Excel'e indirip son bir yedek bırakıyoruz.
  const discrepancies = useMemo(() => diff.map(r => ({
    ...r,
    sayilan: results[r.id]?.miktar,
    fark: Number(results[r.id]?.miktar) - Number(String(r.sayim).replace(',', '.')),
    not: results[r.id]?.notlar || '',
  })), [diff, results])

  async function handleClearRows() {
    if (counted.length > 0) {
      await exportRaporFarklar(discrepancies, session, manualRows, firmaProfile)
    }
    await clearRows()
    setConfirmClear(false)
  }

  async function handleFinish() {
    const ok = window.confirm('Sayım bitirilecek ve "Mutabakat Onayında Bekliyor" durumuna alınacak.\n\nDevam edilsin mi?')
    if (!ok) return
    setFinishing(true)
    try {
      await finishCounting()
    } finally {
      setFinishing(false)
    }
  }

  const tarihStr = session.tarih
    ? new Date(session.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  return (
    <div className="flex flex-col gap-5">
      {/* Başlık */}
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sayım Paneli</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {session.type}{session.depoAdi ? ` · ${session.depoAdi}` : ''}{tarihStr ? ` · ${tarihStr}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportResults(rows, results, session, firmaProfile, manualRows)}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="ms" style={{ fontSize: 15 }}>download</span> Excel'e Aktar
          </button>
          <button
            onClick={handlePrint}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="ms" style={{ fontSize: 15 }}>print</span> Yazdır
          </button>
          {isYonetici && (
            session.durum === 'Mutabakat Bekliyor' ? (
              <span className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-[13px] font-bold">
                <span className="ms" style={{ fontSize: 16 }}>hourglass_top</span>
                Mutabakat Onayında Bekliyor
              </span>
            ) : session.durum === 'Tamamlandı' ? (
              <span className="flex items-center gap-1.5 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-[13px] font-bold">
                <span className="ms" style={{ fontSize: 16 }}>check_circle</span>
                Tamamlandı
              </span>
            ) : (
              <button
                onClick={handleFinish}
                disabled={finishing || rows.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-[13px] font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="ms" style={{ fontSize: 16 }}>{finishing ? 'hourglass_empty' : 'task_alt'}</span>
                {finishing ? 'İşleniyor…' : 'Sayımı Bitir'}
              </button>
            )
          )}
        </div>
      </div>

      {/* 4 İstatistik Kartı */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Lokasyon */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 relative overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all">
          <div className="absolute top-0 left-0 w-1 h-full bg-slate-400 rounded-l-xl" />
          <div className="flex items-start justify-between mb-2">
            <p className="text-[11px] text-slate-400 mono uppercase tracking-wide">Lokasyon</p>
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
              <span className="ms text-slate-500" style={{ fontSize: 17 }}>inventory_2</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{rows.length.toLocaleString('tr')}</p>
          <p className="text-[12px] text-slate-400 mt-1">Toplam Lokasyon</p>
        </div>
        {/* Sayılan */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 relative overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-xl" />
          <div className="flex items-start justify-between mb-2">
            <p className="text-[11px] text-slate-400 mono uppercase tracking-wide">Sayılan</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <span className="ms text-blue-500" style={{ fontSize: 17 }}>fact_check</span>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold text-blue-600">{counted.length.toLocaleString('tr')}</p>
            {rows.length > 0 && <p className="text-[13px] text-slate-400 mb-1">/ {rows.length.toLocaleString('tr')}</p>}
          </div>
          {rows.length > 0 && (
            <>
              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: pct + '%' }} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">%{pct} tamamlandı</p>
            </>
          )}
        </div>
        {/* Farklılık */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 relative overflow-hidden hover:border-red-200 hover:shadow-sm transition-all">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-400 rounded-l-xl" />
          <div className="flex items-start justify-between mb-2">
            <p className="text-[11px] text-slate-400 mono uppercase tracking-wide">Farklılık</p>
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
              <span className="ms text-red-500" style={{ fontSize: 17 }}>warning</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-red-500">{diff.length.toLocaleString('tr')}</p>
          <p className="text-[12px] text-slate-400 mt-1">İncelenmeli</p>
        </div>
        {/* Onaylanan */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 relative overflow-hidden hover:border-emerald-200 hover:shadow-sm transition-all">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 rounded-l-xl" />
          <div className="flex items-start justify-between mb-2">
            <p className="text-[11px] text-slate-400 mono uppercase tracking-wide">Onaylanan</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <span className="ms text-emerald-500" style={{ fontSize: 17 }}>verified</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{approved.length.toLocaleString('tr')}</p>
          <p className="text-[12px] text-slate-400 mt-1">Mutabık</p>
        </div>
      </div>

      {/* Not — oturum kilitli olsa bile düzenlenebilir, sadece bir açıklama alanı */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-[13px] font-semibold text-slate-700 mb-2 flex items-center gap-2">
          <span className="ms text-amber-500" style={{ fontSize: 16 }}>sticky_note_2</span>
          Not
        </p>
        <textarea
          value={session.sayimNotu || ''}
          onChange={e => updateSessionNote(e.target.value)}
          placeholder="Bu sayımla ilgili not ekleyin…"
          rows={3}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
        />
      </div>

      {/* Hızlı Başlat */}
      <div>
        <p className="text-[13px] font-semibold text-slate-700 mb-3">Hızlı Başlat</p>
        <div className={`grid gap-3 ${userRole === 'kontrolcu' ? 'grid-cols-1 max-w-xs' : 'grid-cols-3'}`}>
          {userRole !== 'kontrolcu' && (
            rows.length === 0 ? (
              <button onClick={() => onNavigate('upload')} className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 transition-all group">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                  <span className="ms text-blue-600" style={{ fontSize: 22 }}>upload_file</span>
                </div>
                <p className="text-[13.5px] font-semibold text-slate-800">RAPOR5 Yükle</p>
                <p className="text-[12px] text-slate-400 mt-0.5">Excel'den stok verisi aktar</p>
              </button>
            ) : (
              <div className="bg-white rounded-xl border border-green-200 p-4 text-left">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                    <span className="ms text-green-600" style={{ fontSize: 22 }}>check_circle</span>
                  </div>
                  <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full uppercase tracking-wide">Yüklendi</span>
                </div>
                <p className="text-[13.5px] font-semibold text-slate-800">RAPOR5 Yönetimi</p>
                <p className="text-[12px] text-slate-400 mt-0.5">{rows.length.toLocaleString('tr')} kalem · {importFormat === 'rapor5' ? 'RAPOR5' : importFormat === 'sku' ? 'SKU Listesi' : 'Bilinmiyor'}</p>
                {locked ? null : !confirmClear ? (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="mt-3 flex items-center gap-1 text-[11.5px] text-red-500 hover:text-red-700 font-medium"
                  >
                    <span className="ms" style={{ fontSize: 14 }}>delete</span>
                    Sil, Yenisini Yükle
                  </button>
                ) : (
                  <div className="mt-3">
                    {counted.length > 0 && (
                      <div className="mb-2 px-2.5 py-2 bg-red-50 border border-red-200 rounded-lg text-[11.5px] text-red-700 leading-snug">
                        <span className="font-bold">Dikkat:</span> {counted.length.toLocaleString('tr')} sayılan kalem{diff.length > 0 ? ` (${diff.length.toLocaleString('tr')} farklılık dahil)` : ''} bu dosyayla ilişkili. Devam ederseniz mevcut Mutabakat Raporu otomatik indirilecek, ardından bu sayım sonuçları KALICI olarak silinecek.
                        {session.durum === 'Mutabakat Bekliyor' && ' Bu oturum şu an mutabakat onayı bekliyor.'}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleClearRows}
                        className="flex items-center gap-1 px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-[11.5px] font-semibold rounded-lg"
                      >
                        <span className="ms" style={{ fontSize: 13 }}>delete</span>
                        Evet, Sil
                      </button>
                      <button
                        onClick={() => setConfirmClear(false)}
                        className="text-[11.5px] text-slate-500 hover:text-slate-700"
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
          {userRole !== 'kontrolcu' && (
            <button onClick={() => onNavigate('kor')} className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 transition-all group">
              <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center mb-3 group-hover:bg-violet-100 transition-colors">
                <span className="ms text-violet-600" style={{ fontSize: 22 }}>visibility_off</span>
              </div>
              <p className="text-[13.5px] font-semibold text-slate-800">Kör Sayım Başlat</p>
              <p className="text-[12px] text-slate-400 mt-0.5">Kod gir, liste oluştur, yazdır</p>
            </button>
          )}
          <button onClick={() => onNavigate('rapor')} className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 transition-all group">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center mb-3 group-hover:bg-emerald-100 transition-colors">
              <span className="ms text-emerald-600" style={{ fontSize: 22 }}>analytics</span>
            </div>
            <p className="text-[13.5px] font-semibold text-slate-800">Mutabakat Raporu</p>
            <p className="text-[12px] text-slate-400 mt-0.5">Fark analizi ve onay</p>
          </button>
        </div>
      </div>

      {/* Son İşlemler */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-slate-700">Son İşlemler</p>
          {events.length > 0 && (
            <span className="text-[11px] text-slate-400 mono">{events.length} kayıt</span>
          )}
        </div>
        <div className="divide-y divide-slate-50">
          {events.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3">
                <span className="ms text-slate-300" style={{ fontSize: 24 }}>history</span>
              </div>
              <p className="text-[13px] font-medium text-slate-500">Henüz işlem yok</p>
              <p className="text-[11px] text-slate-400 mt-1">Excel yükleyince burada görünür</p>
            </div>
          ) : (
            events.slice(0, 5).map((r, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <div className={'w-8 h-8 rounded-full flex items-center justify-center shrink-0 ' + r.iconBg}>
                  <span className={'ms ' + r.iconColor} style={{ fontSize: 16 }}>{r.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-700">{r.text}</p>
                  <p className="text-[11px] text-slate-400 mono">{r.sub}{r.time ? ` · ${formatTime(r.time)}` : ''}</p>
                </div>
                <span className={'badge ' + r.badgeCls}>{r.badge}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sayım ilerlemesi — sadece veri yüklüyse */}
      {rows.length > 0 && (
        <div className="flex justify-end">
          <button onClick={() => onNavigate('sayim')} className="flex items-center gap-1.5 text-[13px] font-semibold text-blue-600 hover:text-blue-700">
            Sayıma Devam Et
            <span className="ms" style={{ fontSize: 17 }}>arrow_forward</span>
          </button>
        </div>
      )}

      {/* Ekranda gizli, yalnızca "Yazdır" tetiklendiğinde kullanılır (Sayım
          sayfalarındaki mevcut desenle aynı). Manuel kalemler printRows/
          printResults'a zaten birleştirildiği için PrintSheet'e dokunmadan
          "en sonda" görünüyorlar. */}
      <div className="hidden">
        <PrintSheet ref={printRef} rows={printRows} results={printResults} session={session} mode="sayim" sayimTuru="Tüm Stok" firmaUnvani={firmaProfile?.unvan} />
      </div>
    </div>
  )
}
