import { useState, useMemo } from 'react'
import useStore from '../../store/useStore'
import { exportRedbullRaporFarklar } from '../../utils/excelExport'
import ComboBox from '../shared/ComboBox'

function RedbullDurumBadge({ durum }) {
  if (!durum) return <span className="badge badge-normal">—</span>
  if (durum === 'Normal') return <span className="badge badge-normal">{durum}</span>
  return <span className="badge badge-bloke">{durum}</span>
}

const EMPTY_FORM = { kod: '', ad: '', adres: '', parti: '', miktar: '', birim: '', not: '' }

export default function RedbullKorSayimRapor({ onNavigate }) {
  const { korMatched, results, session, setPendingKodFilter, korManualRows, addKorManualRow, removeKorManualRow, firmaProfile, userRole, skuMasterdata, lokasyonlar } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [onlyBigDiff, setOnlyBigDiff] = useState(false)

  const rows = korMatched
  const locked = session.durum === 'Tamamlandı'

  // Bir farklılık satırının kodu manuel eklenen kalemlerde de varsa
  // (aynı ürün başka bir yerde fazla bulunup manuel girilmiş olabilir) —
  // eksik/fazla birbirini tamamlıyor olabilir, önce buna bakılmalı.
  function manuelVarMi(kod) {
    return korManualRows.some(r => r.kod?.toUpperCase() === kod?.toUpperCase())
  }

  const skuOptions = useMemo(
    () => skuMasterdata.map(s => ({ value: s.kod, label: s.ad ? `${s.kod} — ${s.ad}` : s.kod })),
    [skuMasterdata]
  )
  const lokasyonOptions = useMemo(() => lokasyonlar.map(l => ({ value: l, label: l })), [lokasyonlar])
  const matchedSku = useMemo(
    () => skuMasterdata.find(s => s.kod.toUpperCase() === form.kod.trim().toUpperCase()),
    [skuMasterdata, form.kod]
  )
  const adresGecerli = form.adres.trim() === '' ||
    lokasyonlar.some(l => l.toUpperCase() === form.adres.trim().toUpperCase())

  function selectSku(opt) {
    const sku = skuMasterdata.find(s => s.kod === opt.value)
    setForm(f => ({ ...f, kod: sku.kod, ad: sku.ad, birim: sku.birim }))
  }

  function handleAddManual(e) {
    e.preventDefault()
    if (!matchedSku || form.miktar === '' || !adresGecerli) return
    addKorManualRow({
      kod:    matchedSku.kod,
      ad:     matchedSku.ad,
      adres:  form.adres.trim(),
      parti:  form.parti.trim(),
      durum:  '',
      miktar: form.miktar,
      birim:  matchedSku.birim,
      not:    form.not.trim(),
    })
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  const counted = rows.filter(r => results[r.id]?.miktar !== undefined && results[r.id]?.miktar !== '')
  const discrepancies = rows
    .filter(r => {
      const m = results[r.id]?.miktar
      return m !== undefined && m !== '' && String(m) !== String(r.sayim)
    })
    .map(r => ({
      ...r,
      sayilan: results[r.id]?.miktar,
      fark: Number(results[r.id]?.miktar) - Number(String(r.sayim).replace(',', '.')),
    }))

  const visibleDiscrepancies = onlyBigDiff
    ? discrepancies.filter(r => {
        const sistem = Number(String(r.sayim).replace(',', '.'))
        return sistem > 0 ? Math.abs(r.fark) / sistem * 100 >= 10 : true
      })
    : discrepancies

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{firmaProfile?.unvan || firmaProfile?.ad || 'WMS Depo Sayım (Redbull)'} Kör Sayım Raporu</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Kör sayım listesi henüz oluşturulmadı</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <span className="ms text-slate-300 mb-3 block" style={{ fontSize: 48 }}>summarize</span>
          <div className="text-[14px] font-semibold text-slate-700 mb-1">Rapor Oluşturulamadı</div>
          <div className="text-[13px] text-slate-400 mb-4">Önce WMS Depo Sayım (Redbull) Kör Sayımı sayfasından liste oluşturun</div>
          <button onClick={() => onNavigate('redbullkor')} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700">
            <span className="ms" style={{ fontSize: 16 }}>visibility_off</span> Kör Sayım Sayfasına Git
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 print-content">
      {/* Başlık */}
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{firmaProfile?.unvan || firmaProfile?.ad || 'WMS Depo Sayım (Redbull)'} Kör Sayım Raporu</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Onaydan önce tüm farklılıkları inceleyin</p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-slate-50">
            <span className="ms" style={{ fontSize: 16 }}>print</span> Yazdır
          </button>
          <button
            onClick={() => exportRedbullRaporFarklar(discrepancies, session, korManualRows, firmaProfile)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          >
            <span className="ms" style={{ fontSize: 16 }}>download</span> Excel İndir
          </button>
        </div>
      </div>

      {/* 3 İstatistik Kartı */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[11px] text-slate-400 mono uppercase tracking-wide mb-2">Sayılan Toplam</p>
          <p className="text-3xl font-bold text-slate-900">{counted.length.toLocaleString('tr')}</p>
          <p className="text-[12px] text-slate-400 mt-1">{rows.length.toLocaleString('tr')} kalem arasından</p>
        </div>
        <div className={discrepancies.length > 0 ? 'bg-red-50 rounded-xl border border-red-200 p-4' : 'bg-white rounded-xl border border-slate-200 p-4'}>
          <p className={`text-[11px] mono uppercase tracking-wide mb-2 ${discrepancies.length > 0 ? 'text-red-400' : 'text-slate-400'}`}>Fark Analizi</p>
          <p className={`text-3xl font-bold ${discrepancies.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>{discrepancies.length}</p>
          <p className={`text-[12px] mt-1 ${discrepancies.length > 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {discrepancies.length > 0 ? 'Sistem ile uyuşmuyor' : 'Fark yok'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[11px] text-slate-400 mono uppercase tracking-wide mb-2">Sayılmayan</p>
          <p className="text-3xl font-bold text-slate-900">{(rows.length - counted.length).toLocaleString('tr')}</p>
          <p className="text-[12px] text-slate-400 mt-1">Bekliyor</p>
        </div>
      </div>

      {/* Farklılıklar Tablosu */}
      {discrepancies.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <span className="ms text-green-500 mb-3 block" style={{ fontSize: 48 }}>check_circle</span>
          <div className="text-[14px] font-semibold text-slate-700">Farklılık bulunamadı</div>
          <div className="text-[13px] text-slate-400 mt-1">
            {counted.length === 0
              ? 'Henüz sayım yapılmamış. Kör Sayım sayfasından başlayın.'
              : 'Tüm sayılan kalemler sistem miktarıyla eşleşiyor.'}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-slate-700">
              Farklılıklar <span className="badge bg-red-50 text-red-600 ml-1">{visibleDiscrepancies.length}</span>
              {onlyBigDiff && discrepancies.length !== visibleDiscrepancies.length && (
                <span className="text-[11px] text-slate-400 ml-2">({discrepancies.length} toplamdan)</span>
              )}
            </p>
            <label className="flex items-center gap-2 text-[12px] text-slate-500 cursor-pointer no-print">
              <input type="checkbox" className="rounded" checked={onlyBigDiff} onChange={e => setOnlyBigDiff(e.target.checked)} /> Sadece büyük farklar (±%10)
            </label>
          </div>
          <div className="table-scroll">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] mono text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="px-3 py-1.5">Stok Kodu / Adı</th>
                  <th className="px-3 py-1.5">SSCC</th>
                  <th className="px-3 py-1.5">Lot</th>
                  <th className="px-3 py-1.5">Alisan Statu</th>
                  <th className="px-3 py-1.5 text-right">Palet Adeti</th>
                  <th className="px-3 py-1.5">Adres</th>
                  <th className="px-3 py-1.5 text-right">Sistem</th>
                  <th className="px-3 py-1.5 text-right">Sayılan</th>
                  <th className="px-3 py-1.5 text-right">Fark</th>
                  <th className="px-3 py-1.5 text-center">İşlem</th>
                </tr>
              </thead>
              <tbody className="text-[12.5px] divide-y divide-slate-50">
                {visibleDiscrepancies.map((row, i) => (
                  <tr key={row.id} className={i % 2 === 1 ? 'bg-slate-50/50 hover:bg-slate-50' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-1.5">
                      <p className="mono font-semibold text-blue-700 text-[11px]">{row.kod}</p>
                      <p className="text-slate-700">{row.ad}</p>
                    </td>
                    <td className="px-3 py-1.5 mono text-slate-400 text-[10.5px]">{row.sscc || '—'}</td>
                    <td className="px-3 py-1.5 mono text-slate-500 text-[12px]">{row.parti || '—'}</td>
                    <td className="px-3 py-1.5"><RedbullDurumBadge durum={row.durum} /></td>
                    <td className="px-3 py-1.5 text-right mono text-slate-500 text-[12px]">{row.paletAdeti || '—'}</td>
                    <td className="px-3 py-1.5 mono text-slate-500 text-[12px]">{row.adres}</td>
                    <td className="px-3 py-1.5 text-right mono font-medium">
                      {row.sayim} <span className="text-slate-400 text-[11px]">{row.birim}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right mono font-bold text-red-600">
                      {row.sayilan} <span className="text-red-400 text-[11px]">{row.birim}</span>
                    </td>
                    <td className={`px-3 py-1.5 text-right mono font-bold ${row.fark > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {row.fark > 0 ? '+' : ''}{row.fark.toLocaleString('tr', { maximumFractionDigits: 2 })} <span className="opacity-60 text-[11px]">{row.birim}</span>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {manuelVarMi(row.kod) && (
                        <div className="mb-1">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold whitespace-nowrap">
                            <span className="ms" style={{ fontSize: 11 }}>warning</span> Manuel Stok Var
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => { setPendingKodFilter(row.kod); onNavigate('redbullkor') }}
                        className="text-[12px] text-blue-600 hover:underline font-medium"
                      >İncele</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manuel Eklenen Kalemler */}
      <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-amber-100 flex items-center justify-between bg-amber-50">
          <div className="flex items-center gap-2">
            <span className="ms text-amber-600" style={{ fontSize: 18 }}>add_box</span>
            <p className="text-[13px] font-semibold text-amber-900">
              Sistemde Bulunmayan Kalemler
              {korManualRows.length > 0 && <span className="badge bg-amber-100 text-amber-700 ml-2">{korManualRows.length}</span>}
            </p>
          </div>
          {userRole !== 'kontrolcu' && !locked && (
            <button
              onClick={() => { setShowForm(f => !f); setForm(EMPTY_FORM) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[12.5px] font-semibold no-print"
            >
              <span className="ms" style={{ fontSize: 15 }}>{showForm ? 'close' : 'add'}</span>
              {showForm ? 'İptal' : 'Manuel Ekle'}
            </button>
          )}
        </div>

        {/* Ekleme Formu */}
        {showForm && (
          <form onSubmit={handleAddManual} className="px-4 py-3 border-b border-amber-100 bg-amber-50/40 no-print flex flex-col gap-2">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Stok Kodu *</label>
                <ComboBox
                  value={form.kod}
                  onChange={text => setForm(f => ({ ...f, kod: text, ad: '', birim: '' }))}
                  onSelect={selectSku}
                  options={skuOptions}
                  placeholder="Kod / Ad Ara"
                  invalid={form.kod.trim() !== '' && !matchedSku}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] text-slate-500 mb-1">Stok Adı</label>
                <input
                  type="text"
                  value={form.ad}
                  disabled
                  readOnly
                  placeholder="Kod seçilince otomatik dolar"
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg px-2.5 py-1.5 text-[12.5px] text-slate-500 placeholder-slate-400"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Adres</label>
                <ComboBox
                  value={form.adres}
                  onChange={text => setForm(f => ({ ...f, adres: text }))}
                  onSelect={opt => setForm(f => ({ ...f, adres: opt.value }))}
                  options={lokasyonOptions}
                  placeholder="4-09L-10-1-1 (opsiyonel)"
                  invalid={form.adres.trim() !== '' && !adresGecerli}
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Lot</label>
                <input
                  type="text"
                  value={form.parti}
                  onChange={e => setForm(f => ({ ...f, parti: e.target.value }))}
                  placeholder="2541388"
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-[12.5px] mono focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Sayılan Miktar *</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={form.miktar}
                    onChange={e => setForm(f => ({ ...f, miktar: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-[12.5px] mono focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    required
                  />
                  <input
                    type="text"
                    value={form.birim}
                    disabled
                    readOnly
                    placeholder="Birim"
                    className="w-16 border border-slate-200 bg-slate-50 rounded-lg px-2 py-1.5 text-[12.5px] mono text-slate-500 placeholder-slate-400"
                  />
                </div>
              </div>
              <div className="col-span-2 md:col-span-4">
                <label className="block text-[11px] text-slate-500 mb-1">Not</label>
                <input
                  type="text"
                  value={form.not}
                  onChange={e => setForm(f => ({ ...f, not: e.target.value }))}
                  placeholder="Açıklama..."
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-[12.5px] focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={!matchedSku || form.miktar === '' || !adresGecerli}
                  className="w-full px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[12.5px] font-semibold disabled:opacity-40"
                >
                  Ekle
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Manuel kayıt listesi */}
        {korManualRows.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12.5px] text-slate-400">
            Sistemde bulunmayan ürün eklemek için "Manuel Ekle" butonunu kullanın.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] mono text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="px-3 py-1.5">Stok Kodu / Adı</th>
                  <th className="px-3 py-1.5">Lot</th>
                  <th className="px-3 py-1.5">Adres</th>
                  <th className="px-3 py-1.5 text-right">Sistem</th>
                  <th className="px-3 py-1.5 text-right">Sayılan</th>
                  <th className="px-3 py-1.5 text-right">Fark</th>
                  <th className="px-3 py-1.5">Not</th>
                  <th className="px-3 py-1.5 no-print"></th>
                </tr>
              </thead>
              <tbody className="text-[12.5px] divide-y divide-slate-50">
                {korManualRows.map((row, i) => (
                  <tr key={row.id} className={i % 2 === 1 ? 'bg-amber-50/30' : ''}>
                    <td className="px-3 py-1.5">
                      <p className="mono font-semibold text-amber-700 text-[11px]">{row.kod}</p>
                      <p className="text-slate-700">{row.ad || <span className="text-slate-400 italic">—</span>}</p>
                    </td>
                    <td className="px-3 py-1.5 mono text-slate-500 text-[12px]">{row.parti || '—'}</td>
                    <td className="px-3 py-1.5 mono text-slate-500 text-[12px]">{row.adres || '—'}</td>
                    <td className="px-3 py-1.5 text-right mono text-slate-400">0</td>
                    <td className="px-3 py-1.5 text-right mono font-bold text-emerald-600">
                      +{row.miktar} <span className="text-emerald-400 text-[11px]">{row.birim}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right mono font-bold text-emerald-600">
                      +{row.miktar} <span className="opacity-60 text-[11px]">{row.birim}</span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-500 text-[12px]">{row.not || '—'}</td>
                    <td className="px-3 py-1.5 text-center no-print">
                      {userRole !== 'kontrolcu' && !locked && (
                        <button
                          onClick={() => removeKorManualRow(row.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                          title="Sil"
                        >
                          <span className="ms" style={{ fontSize: 16 }}>delete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
