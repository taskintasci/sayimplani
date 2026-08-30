import useStore from '../../store/useStore'
import { exportAnalizi } from '../../utils/excelExport'
import { SABLON } from '../../constants'

function AccBar({ pct }) {
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: Math.min(pct, 100) + '%', background: 'linear-gradient(90deg, #3b82f6, #2563eb)' }}
      />
    </div>
  )
}

export default function KoridorSayimAnalizi({ onNavigate }) {
  const { koridorMatched, results, session, koridorManualRows: manualRows, firmaProfile } = useStore()

  const rows = koridorMatched

  // Bu bileşen 3 şablonda paylaşılıyor (koridoranaliz / antrepokoridoranaliz /
  // redbullkoridoranaliz) — "Sayfaya Git" hedefi aktif şablona göre değişmeli.
  const sayimRoute = firmaProfile?.sablon === SABLON.WMS31 ? 'antrepokoridorsayim'
    : firmaProfile?.sablon === SABLON.WMS_REDBULL ? 'redbullkoridorsayim'
    : 'koridorsayim'

  const counted = rows.filter(r => results[r.id]?.miktar !== undefined && results[r.id]?.miktar !== '')
  const discrepancies = rows.filter(r => {
    const m = results[r.id]?.miktar
    return m !== undefined && m !== '' && String(m) !== String(r.sayim)
  })

  const manuelFiziki    = manualRows.reduce((sum, r) => sum + (parseFloat(r.miktar) || 0), 0)
  const manuelUniqueSku = [...new Set(manualRows.map(r => r.kod))].length
  const totalCounted    = counted.length + manualRows.length

  const hatasizLokasyon = counted.length - discrepancies.length
  const hataliLokasyon  = discrepancies.length + manualRows.length
  const adresPct        = totalCounted > 0 ? +(hatasizLokasyon / totalCounted * 100).toFixed(2) : 0

  const sistemToplam = rows.reduce((sum, r) => sum + (parseFloat(String(r.sayim).replace(',', '.')) || 0), 0)
  const fizikiToplam = rows.reduce((sum, r) => {
    const m = results[r.id]?.miktar
    return sum + (m !== undefined && m !== '' ? parseFloat(String(m).replace(',', '.')) || 0 : 0)
  }, 0) + manuelFiziki
  const stokFark     = fizikiToplam - sistemToplam
  const stokMuafiyet = sistemToplam * 0.001
  const stokPct      = sistemToplam > 0 ? +(fizikiToplam / sistemToplam * 100).toFixed(2) : 0

  const uniqueSkuSistem  = [...new Set(rows.map(r => r.kod))].length
  const uniqueSkuHatasiz = [...new Set(
    rows.filter(r => {
      const m = results[r.id]?.miktar
      return m !== undefined && m !== '' && String(m) === String(r.sayim)
    }).map(r => r.kod)
  )].length
  const uniqueSkuToplam = uniqueSkuSistem + manuelUniqueSku
  const hataliSku       = (uniqueSkuSistem - uniqueSkuHatasiz) + manuelUniqueSku
  const skuPct          = uniqueSkuToplam > 0 ? +(uniqueSkuHatasiz / uniqueSkuToplam * 100).toFixed(2) : 0

  const genelPct = +((adresPct + stokPct + skuPct) / 3).toFixed(2)

  const tarihStr = session.tarih
    ? new Date(session.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const fmt = (n) => n.toLocaleString('tr', { maximumFractionDigits: 2 })

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Koridor Stok Sayım Analizi</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Koridor sayım listesi henüz oluşturulmadı</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <span className="ms text-slate-300 mb-3 block" style={{ fontSize: 48 }}>view_week</span>
          <div className="text-[14px] font-semibold text-slate-700 mb-1">Analiz için veri yok</div>
          <div className="text-[13px] text-slate-400 mb-4">Raf Listesi'nden koridor seçerek liste oluşturun</div>
          <button onClick={() => onNavigate(sayimRoute)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700">
            <span className="ms" style={{ fontSize: 16 }}>view_week</span> Koridor Sayımı Sayfasına Git
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 print-content print-content-analiz">
      {/* Başlık */}
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Koridor Stok Sayım Analizi</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {session.type || 'Sayım'}{session.depoAdi ? ` · ${session.depoAdi}` : ''}{tarihStr ? ` · ${tarihStr}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-slate-50">
            <span className="ms" style={{ fontSize: 16 }}>print</span> Yazdır
          </button>
          <button onClick={() => exportAnalizi(rows, results, session, firmaProfile)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[13px] font-bold hover:bg-emerald-700">
            <span className="ms" style={{ fontSize: 16 }}>download</span> Excel İndir
          </button>
        </div>
      </div>

      {/* Genel Doğruluk — Büyük Kart */}
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-8">
        <div className="shrink-0">
          <p className="text-blue-200 text-[12px] mono uppercase tracking-widest mb-1">Koridor Sayım Genel Doğruluk</p>
          <p className="text-white font-black leading-none" style={{ fontSize: 52 }}>%{genelPct.toLocaleString('tr', { maximumFractionDigits: 2 })}</p>
          <p className="text-blue-300 text-[12px] mt-1">AVERAGE(Adres%, Stok%, SKU%)</p>
        </div>
        <div className="hidden md:block w-px bg-blue-600 self-stretch mx-2" />
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-blue-200 text-[11px] mono uppercase tracking-wide mb-2">Adres Doğruluk</p>
            <p className="text-white text-2xl font-bold">%{adresPct.toLocaleString('tr', { maximumFractionDigits: 2 })}</p>
            <div className="mt-2 h-1 bg-blue-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-300 rounded-full" style={{ width: Math.min(adresPct, 100) + '%' }} />
            </div>
            <p className="text-blue-300 text-[11px] mono mt-1">{fmt(hatasizLokasyon)} / {fmt(totalCounted)} lokasyon</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-blue-200 text-[11px] mono uppercase tracking-wide mb-2">Stok Doğruluk</p>
            <p className="text-white text-2xl font-bold">%{stokPct.toLocaleString('tr', { maximumFractionDigits: 2 })}</p>
            <div className="mt-2 h-1 bg-blue-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-300 rounded-full" style={{ width: Math.min(stokPct, 100) + '%' }} />
            </div>
            <p className="text-blue-300 text-[11px] mono mt-1">Muafiyet kapsamında</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-blue-200 text-[11px] mono uppercase tracking-wide mb-2">SKU Doğruluk</p>
            <p className="text-white text-2xl font-bold">%{skuPct.toLocaleString('tr', { maximumFractionDigits: 2 })}</p>
            <div className="mt-2 h-1 bg-blue-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-300 rounded-full" style={{ width: Math.min(skuPct, 100) + '%' }} />
            </div>
            <p className="text-blue-300 text-[11px] mono mt-1">{fmt(uniqueSkuHatasiz)} / {fmt(uniqueSkuToplam)} SKU</p>
          </div>
        </div>
      </div>

      {/* 3 Detay Kartı */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <span className="ms text-slate-500" style={{ fontSize: 18 }}>location_on</span>
            <p className="text-[13px] font-semibold text-slate-700">Lokasyon Analizi</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <p className="text-[12.5px] text-slate-500">Sayılan Lokasyon</p>
              <p className="text-[13px] font-bold mono text-slate-800">{fmt(totalCounted)}</p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <p className="text-[12.5px] text-slate-500">Hatasız Lokasyon</p>
              <p className="text-[13px] font-bold mono text-emerald-700">{fmt(hatasizLokasyon)}</p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <p className="text-[12.5px] text-slate-500">Hatalı Lokasyon</p>
              <p className="text-[13px] font-bold mono text-red-600">{fmt(hataliLokasyon)}</p>
            </div>
            <div className="pt-1">
              <div className="flex justify-between items-center mb-1.5">
                <p className="text-[12px] text-slate-500">Adres Doğruluk</p>
                <p className="text-[13px] font-black mono text-blue-700">%{adresPct.toLocaleString('tr', { maximumFractionDigits: 2 })}</p>
              </div>
              <AccBar pct={adresPct} />
              <p className="text-[10.5px] mono text-slate-400 mt-1">= Hatasız / Sayılan</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <span className="ms text-slate-500" style={{ fontSize: 18 }}>scale</span>
            <p className="text-[13px] font-semibold text-slate-700">Stok Miktarı Analizi</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <p className="text-[12.5px] text-slate-500">Toplam Sistem (Kg/Lt/Ad/Mt)</p>
              <p className="text-[13px] font-bold mono text-slate-800">{fmt(sistemToplam)}</p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <p className="text-[12.5px] text-slate-500">Fiziki Sayılan (Kg/Lt/Ad/Mt)</p>
              <p className="text-[13px] font-bold mono text-slate-800">{fmt(fizikiToplam)}</p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <p className="text-[12.5px] text-slate-500">Stok Farkı</p>
              <p className={`text-[13px] font-bold mono ${stokFark < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {stokFark >= 0 ? '+' : ''}{fmt(stokFark)}
              </p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <div>
                <p className="text-[12.5px] text-slate-500">Sayım Muafiyeti <span className="text-blue-600">*</span></p>
                <p className="text-[10.5px] mono text-slate-400">Sistem × %0,1</p>
              </div>
              <p className="text-[13px] font-bold mono text-slate-600">±{fmt(stokMuafiyet)}</p>
            </div>
            <div className="pt-1">
              <div className="flex justify-between items-center mb-1.5">
                <p className="text-[12px] text-slate-500">Stok Doğruluk</p>
                <p className="text-[13px] font-black mono text-blue-700">%{stokPct.toLocaleString('tr', { maximumFractionDigits: 2 })}</p>
              </div>
              <AccBar pct={stokPct} />
              <p className="text-[10.5px] mono text-slate-400 mt-1">= Fiziki / Sistem</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <span className="ms text-slate-500" style={{ fontSize: 18 }}>inventory_2</span>
            <p className="text-[13px] font-semibold text-slate-700">SKU Analizi</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <p className="text-[12.5px] text-slate-500">Sayılan SKU</p>
              <p className="text-[13px] font-bold mono text-slate-800">{fmt(uniqueSkuToplam)}</p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <p className="text-[12.5px] text-slate-500">Hatasız SKU</p>
              <p className="text-[13px] font-bold mono text-emerald-700">{fmt(uniqueSkuHatasiz)}</p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <p className="text-[12.5px] text-slate-500">Hatalı SKU</p>
              <p className="text-[13px] font-bold mono text-red-600">{fmt(hataliSku)}</p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <p className="text-[12.5px] text-slate-500">Muafiyet Kullanım</p>
              <p className={`text-[13px] font-bold mono ${stokFark < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {stokMuafiyet > 0 ? '%' + (stokFark / stokMuafiyet / 1000 * 100).toFixed(4) : '—'}
              </p>
            </div>
            <div className="pt-1">
              <div className="flex justify-between items-center mb-1.5">
                <p className="text-[12px] text-slate-500">SKU Doğruluk</p>
                <p className="text-[13px] font-black mono text-blue-700">%{skuPct.toLocaleString('tr', { maximumFractionDigits: 2 })}</p>
              </div>
              <AccBar pct={skuPct} />
              <p className="text-[10.5px] mono text-slate-400 mt-1">= Hatasız SKU / Sayılan SKU</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
