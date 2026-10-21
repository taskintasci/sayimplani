import { useState, useMemo, useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import useStore from '../../store/useStore'
import { getKoridor } from '../../utils/adresUtils'
import {
  MOLA_SN, LOG_ROL, SAYIM_EYLEMLERI, tsDate, sayildiMi, izGuvenilir,
  logKisiOzeti, kisiDegerlendirme, gorevOzeti, aktifSureSn, hizHesapla, saatlikKovala,
} from '../../utils/performansUtils'

const AKTIF_ESIK_DK = 15
const SAYFA_BOYUTLARI = [10, 25, 50]

const fmtInt = n => n.toLocaleString('tr')
const fmtHiz = v => (v === null ? '-' : v.toLocaleString('tr', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
const fmtSure = sn => {
  if (sn === null || sn === undefined) return '-'
  const dk = Math.round(sn / 60)
  if (dk < 60) return `${dk} dk`
  return `${Math.floor(dk / 60)} sa ${dk % 60} dk`
}
const fmtZaman = d => (d ? d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-')

// Tailwind sınıfları derleme anında taranır — dinamik birleştirme yerine tam adlar.
const RENK = {
  blue:    { bar: 'bg-blue-500',    kutu: 'bg-blue-50',    ikon: 'text-blue-500',    deger: 'text-blue-600',    kenar: 'hover:border-blue-200' },
  violet:  { bar: 'bg-violet-500',  kutu: 'bg-violet-50',  ikon: 'text-violet-500',  deger: 'text-violet-600',  kenar: 'hover:border-violet-200' },
  emerald: { bar: 'bg-emerald-500', kutu: 'bg-emerald-50', ikon: 'text-emerald-500', deger: 'text-emerald-600', kenar: 'hover:border-emerald-200' },
  amber:   { bar: 'bg-amber-500',   kutu: 'bg-amber-50',   ikon: 'text-amber-500',   deger: 'text-amber-600',   kenar: 'hover:border-amber-200' },
}

function OzetKart({ renk, etiket, ikon, deger, ek, alt, children }) {
  const c = RENK[renk]
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 relative overflow-hidden hover:shadow-xs ${c.kenar}`}>
      <div className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${c.bar}`} />
      <div className="flex items-start justify-between mb-2">
        <p className="text-[11px] text-slate-400 mono uppercase tracking-wide">{etiket}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.kutu}`}>
          <span className={`ms ${c.ikon}`} style={{ fontSize: 17 }}>{ikon}</span>
        </div>
      </div>
      <div className="flex items-end gap-2">
        <p className={`text-3xl font-bold ${c.deger}`}>{deger}</p>
        {ek && <p className="text-[13px] text-slate-400 mb-1">{ek}</p>}
      </div>
      {children}
      {alt && <p className="text-[11px] text-slate-400 mt-1">{alt}</p>}
    </div>
  )
}

function SortHeader({ label, col, sortBy, sortDir, onSort }) {
  const active = sortBy === col
  return (
    <th onClick={() => onSort(col)} className="px-3 py-2.5 cursor-pointer select-none hover:bg-slate-700 text-right">
      <span className="inline-flex items-center gap-1 flex-row-reverse">
        {label}
        <span className="ms" style={{ fontSize: 14, opacity: active ? 1 : 0.25 }}>
          {active && sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
        </span>
      </span>
    </th>
  )
}

function useGenislik() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// Bilerek animasyonsuz: transition/animate sınıfı eklemeyin.
function SaatlikGrafik({ data }) {
  const [ref, kapW] = useGenislik()
  const H = 220, pL = 40, pR = 16, pT = 14, pB = 30
  const n = data.length
  const W = Math.max(kapW, n * 32)
  const plotW = W - pL - pR, plotH = H - pT - pB
  const maxV = Math.max(1, ...data.map(d => d.value))
  const x = i => pL + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1))
  const y = v => pT + plotH - (v / maxV) * plotH
  const cokGun = n > 0 && new Date(data[0].t).toDateString() !== new Date(data[n - 1].t).toDateString()
  const etiketAdim = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(W / 56))))
  const etiket = (t, i) => {
    const d = new Date(t)
    const saat = `${String(d.getHours()).padStart(2, '0')}:00`
    if (cokGun && (i === 0 || d.getHours() === 0)) return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${saat}`
    return saat
  }
  const gridler = [0, 0.5, 1].map(f => Math.round(maxV * f))

  return (
    <div ref={ref} className="w-full overflow-x-auto">
      {kapW > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Saatlik sayılan ürün grafiği">
          {gridler.map(v => (
            <g key={v}>
              <line x1={pL} x2={W - pR} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeDasharray={v === 0 ? undefined : '3 4'} />
              <text x={pL - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#94a3b8" className="mono">{fmtInt(v)}</text>
            </g>
          ))}
          <polyline
            points={data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ')}
            fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round"
          />
          {data.map((d, i) => (
            <g key={d.t}>
              <circle cx={x(i)} cy={y(d.value)} r="3.5" fill="#3b82f6" stroke="#fff" strokeWidth="1.5">
                <title>{`${etiket(d.t, 1)} — ${fmtInt(d.value)} ürün`}</title>
              </circle>
              {i % etiketAdim === 0 && (
                <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="#94a3b8" className="mono">{etiket(d.t, i)}</text>
              )}
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}

function BosDurum({ ikon, metin }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400">
      <span className="ms text-slate-300" style={{ fontSize: 36 }}>{ikon}</span>
      <p className="text-[13px]">{metin}</p>
    </div>
  )
}

export default function SayimPerformansi() {
  const { rows, results, session, firmaProfile, activeSessionId, resultsLoading } = useStore(
    useShallow(s => ({
      rows: s.rows, results: s.results, session: s.session, firmaProfile: s.firmaProfile,
      activeSessionId: s.activeSessionId, resultsLoading: s.resultsLoading,
    }))
  )
  const sablon = firmaProfile?.sablon

  // Log ve görevler tek seferde okunur (canlı dinleyici yok); "Yenile" ile tazelenir.
  const [yenile, setYenile] = useState(0)
  const [veri, setVeri] = useState(null)
  const veriAnahtari = `${activeSessionId}:${yenile}`
  useEffect(() => {
    if (!activeSessionId) return
    let iptal = false
    const st = useStore.getState()
    Promise.all([
      st.loadSayimLog(),
      st.loadDenetimVerisi().catch(() => ({ gorevler: [], users: [] })),
    ]).then(([logs, d]) => {
      if (!iptal) setVeri({ anahtar: veriAnahtari, logs, gorevler: d.gorevler, users: d.users, zaman: new Date() })
    })
    return () => { iptal = true }
  }, [activeSessionId, veriAnahtari])
  const yukleniyor = !veri || veri.anahtar !== veriAnahtari

  const [sortBy, setSortBy]     = useState('sayilanUrun')
  const [sortDir, setSortDir]   = useState('desc')
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [seciliUid, setSeciliUid] = useState(null)

  const hesap = useMemo(() => {
    if (!veri) return null
    const counted = rows.filter(r => sayildiMi(results, r.id))

    const koridorlar = new Map()
    rows.forEach(r => {
      const k = getKoridor(r.adres, sablon)
      if (!k) return
      const g = koridorlar.get(k) || { toplam: 0, sayilan: 0 }
      g.toplam++
      if (sayildiMi(results, r.id)) g.sayilan++
      koridorlar.set(k, g)
    })
    let tamamRaf = 0
    koridorlar.forEach(g => { if (g.sayilan === g.toplam) tamamRaf++ })

    const adMap = new Map()
    veri.users.forEach(u => adMap.set(u.uid, { ad: u.displayName || u.email, rol: u.rol }))
    veri.gorevler.forEach(g => { if (g.sayimciUid && !adMap.has(g.sayimciUid)) adMap.set(g.sayimciUid, { ad: g.sayimciAd || g.sayimciEmail, rol: 'sayimci' }) })
    const kisiAd = uid => adMap.get(uid)?.ad || `Bilinmeyen (${String(uid).slice(0, 6)}…)`

    const logModu = veri.logs.some(l => SAYIM_EYLEMLERI.has(l.eylem))
    let kisiler = []
    let olaylar = []
    if (logModu) {
      const { detay, ozet } = logKisiOzeti(veri.logs)
      ozet.forEach(o => {
        if (o.kalemler.size === 0) return
        const { onayPct, hizliPct, uyarilar } = kisiDegerlendirme(o)
        kisiler.push({
          uid: o.uid, ad: o.ad || kisiAd(o.uid), rol: o.rol,
          sayilanUrun: o.kalemler.size,
          sayilanRaf: new Set([...o.adresler].map(a => getKoridor(a, sablon)).filter(Boolean)).size,
          aktifSn: o.aktifSn, hiz: hizHesapla(o.kalemler.size, o.aktifSn),
          onayPct, hizliPct, uyarilar, son: o.son,
        })
      })
      olaylar = detay.filter(l => SAYIM_EYLEMLERI.has(l.eylem) && l.istemciZamani).map(l => ({ uid: l.uid, t: l.istemciZamani.getTime() }))
    } else {
      const grup = new Map()
      counted.forEach(r => {
        const res = results[r.id]
        const t = tsDate(res.updatedAt)
        if (!res.updatedBy || !t || !izGuvenilir(res)) return
        const g = grup.get(res.updatedBy) || { satirlar: [], zamanlar: [] }
        g.satirlar.push(r)
        g.zamanlar.push(t.getTime())
        grup.set(res.updatedBy, g)
      })
      grup.forEach((g, uid) => {
        const aktifSn = aktifSureSn(g.zamanlar)
        kisiler.push({
          uid, ad: kisiAd(uid), rol: adMap.get(uid)?.rol || '',
          sayilanUrun: g.satirlar.length,
          sayilanRaf: new Set(g.satirlar.map(r => getKoridor(r.adres, sablon)).filter(Boolean)).size,
          aktifSn, hiz: hizHesapla(g.satirlar.length, aktifSn),
          onayPct: null, hizliPct: null, uyarilar: [], son: new Date(Math.max(...g.zamanlar)),
        })
        g.zamanlar.forEach(t => olaylar.push({ uid, t }))
      })
    }

    const hizlar = kisiler.map(k => k.hiz).filter(v => v !== null)
    const esik = veri.zaman.getTime() - AKTIF_ESIK_DK * 60000
    const gorevler = [...veri.gorevler]
      .sort((a, b) => (tsDate(b.createdAt) || 0) - (tsDate(a.createdAt) || 0))
      .map(g => ({ g, ad: g.sayimciAd || kisiAd(g.sayimciUid), ...gorevOzeti(g, rows, results) }))

    return {
      logModu, kisiler, olaylar, gorevler,
      sayilan: counted.length, toplam: rows.length,
      tamamRaf, toplamRaf: koridorlar.size,
      ortHiz: hizlar.length ? hizlar.reduce((a, b) => a + b, 0) / hizlar.length : null,
      sonAktif: kisiler.filter(k => k.son && k.son.getTime() >= esik).length,
    }
  }, [rows, results, veri, sablon])

  const sirali = useMemo(() => {
    if (!hesap) return []
    const yon = sortDir === 'asc' ? 1 : -1
    return [...hesap.kisiler].sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy]
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return (av - bv) * yon || a.ad.localeCompare(b.ad, 'tr')
    })
  }, [hesap, sortBy, sortDir])

  const toplamSayfa = Math.max(1, Math.ceil(sirali.length / pageSize))
  const safePage = Math.min(page, toplamSayfa)
  const sayfadaki = sirali.slice((safePage - 1) * pageSize, safePage * pageSize)

  const grafikVeri = useMemo(() => {
    if (!hesap) return []
    const kaynak = seciliUid ? hesap.olaylar.filter(o => o.uid === seciliUid) : hesap.olaylar
    return saatlikKovala(kaynak.map(o => o.t))
  }, [hesap, seciliUid])

  function handleSort(col) {
    if (sortBy === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(col); setSortDir('desc') }
    setPage(1)
  }

  if (resultsLoading || !hesap) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
        <span className="ms animate-spin" style={{ fontSize: 36 }}>progress_activity</span>
        <p className="text-[13px]">Performans verileri yükleniyor…</p>
      </div>
    )
  }

  const tarihStr = session.tarih
    ? new Date(session.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''
  const pct = hesap.toplam > 0 ? Math.round(hesap.sayilan / hesap.toplam * 100) : 0
  const seciliKisi = hesap.kisiler.find(k => k.uid === seciliUid)

  return (
    <div className="flex flex-col gap-5">
      {/* Başlık */}
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sayım Performansı</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {session.sayimNo && <span className="mono font-semibold text-blue-700 mr-1.5">{session.sayimNo}</span>}
            {session.type || 'Sayım'}{session.depoAdi ? ` · ${session.depoAdi}` : ''}{tarihStr ? ` · ${tarihStr}` : ''}
            {session.durum === 'Tamamlandı' && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-semibold">Tamamlandı</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[11.5px] text-slate-400">Son güncelleme: {veri.zaman.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
          <button
            onClick={() => setYenile(v => v + 1)}
            disabled={yukleniyor}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <span className={`ms ${yukleniyor ? 'animate-spin' : ''}`} style={{ fontSize: 16 }}>{yukleniyor ? 'progress_activity' : 'refresh'}</span>
            Yenile
          </button>
        </div>
      </div>

      {!hesap.logModu && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-[12.5px] text-amber-800">
          <span className="ms shrink-0" style={{ fontSize: 18 }}>info</span>
          <p>
            Bu oturum için işlem logu yok (log 21.10.2026'da devreye girdi). Kişi ve zaman bilgisi her kalemin <b>son giriş</b> kaydından
            tahmin edildi; onay oranı ve hızlı onay bilgisi gösterilemiyor.
          </p>
        </div>
      )}

      {/* Özet kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <OzetKart renk="blue" etiket="Sayılan Ürün" ikon="fact_check" deger={fmtInt(hesap.sayilan)} ek={hesap.toplam > 0 ? `/ ${fmtInt(hesap.toplam)}` : null} alt={`%${pct} tamamlandı`}>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: pct + '%' }} />
          </div>
        </OzetKart>
        <OzetKart
          renk="violet" etiket="Aktif Personel" ikon="groups" deger={fmtInt(hesap.kisiler.length)}
          alt={hesap.logModu ? `Son ${AKTIF_ESIK_DK} dk'da işlem yapan: ${hesap.sonAktif}` : 'En az 1 ürün sayan personel'}
        />
        <OzetKart
          renk="emerald" etiket="Tamamlanan Raf" ikon="shelves" deger={fmtInt(hesap.tamamRaf)}
          ek={hesap.toplamRaf > 0 ? `/ ${fmtInt(hesap.toplamRaf)}` : null} alt="Tüm kalemleri sayılmış koridor"
        />
        <OzetKart
          renk="amber" etiket="Ortalama Hız" ikon="speed" deger={fmtHiz(hesap.ortHiz)}
          alt={hesap.ortHiz === null ? 'Yetersiz veri' : 'Ürün / dakika (personel ortalaması)'}
        />
      </div>

      {/* Personel tablosu */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <span className="ms text-slate-500" style={{ fontSize: 18 }}>leaderboard</span>
          <p className="text-[13px] font-semibold text-slate-700">Personel Performansı</p>
          {seciliKisi && <p className="ml-auto text-[11.5px] text-blue-600">Grafik: {seciliKisi.ad} (kaldırmak için satıra tekrar tıklayın)</p>}
        </div>
        {sirali.length === 0 ? (
          <BosDurum ikon="person_search" metin="Bu oturumda henüz sayım yapan personel yok." />
        ) : (
          <>
            <div className="table-scroll overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-slate-800 text-white mono uppercase tracking-wider text-[10.5px]">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Personel</th>
                    <SortHeader label="Sayılan Ürün" col="sayilanUrun" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <th className="px-3 py-2.5 text-right">Sayılan Raf</th>
                    <th className="px-3 py-2.5 text-right">Aktif Süre</th>
                    <SortHeader label="Ort. Hız (ürün/dk)" col="hiz" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    {hesap.logModu && <th className="px-3 py-2.5 text-right">Onayla %</th>}
                    {hesap.logModu && <SortHeader label="Hızlı Onay %" col="hizliPct" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />}
                    {hesap.logModu && <th className="px-3 py-2.5 text-left">Değerlendirme</th>}
                  </tr>
                </thead>
                <tbody>
                  {sayfadaki.map((k, i) => (
                    <tr
                      key={k.uid}
                      onClick={() => setSeciliUid(u => (u === k.uid ? null : k.uid))}
                      className={'border-b border-slate-100 cursor-pointer ' + (seciliUid === k.uid ? 'bg-blue-50' : i % 2 === 1 ? 'bg-slate-50/60 hover:bg-blue-50/40' : 'hover:bg-blue-50/40')}
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-800">{k.ad}</p>
                        {k.rol && <p className="text-[11px] text-slate-400">{LOG_ROL[k.rol] || k.rol}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-right mono font-bold text-slate-900">{fmtInt(k.sayilanUrun)}</td>
                      <td className="px-3 py-2.5 text-right mono">{fmtInt(k.sayilanRaf)}</td>
                      <td className="px-3 py-2.5 text-right mono">{fmtSure(k.aktifSn)}</td>
                      <td className="px-3 py-2.5 text-right mono font-semibold text-blue-700">{fmtHiz(k.hiz)}</td>
                      {hesap.logModu && <td className="px-3 py-2.5 text-right mono">{k.onayPct === null ? '-' : `%${k.onayPct}`}</td>}
                      {hesap.logModu && (
                        <td className={'px-3 py-2.5 text-right mono ' + (k.hizliPct >= 30 ? 'text-red-600 font-bold' : '')}>
                          {k.hizliPct === null ? '-' : `%${k.hizliPct}`}
                        </td>
                      )}
                      {hesap.logModu && (
                        <td className="px-3 py-2.5">
                          {k.uyarilar.length === 0
                            ? <span className="text-slate-300">—</span>
                            : k.uyarilar.map(u => (
                              <p key={u} className="flex items-start gap-1 text-[11px] text-amber-700">
                                <span className="ms shrink-0" style={{ fontSize: 13 }}>warning</span>{u}
                              </p>
                            ))}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-200 text-[12px] text-slate-500">
              <div className="flex items-center gap-2">
                <span>Sayfa başına</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                  className="border border-slate-300 rounded px-1.5 py-0.5 bg-white text-slate-700"
                >
                  {SAYFA_BOYUTLARI.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span>· {fmtInt(sirali.length)} personel</span>
              </div>
              {toplamSayfa > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(safePage - 1)} disabled={safePage === 1} className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-40">
                    <span className="ms" style={{ fontSize: 16 }}>chevron_left</span>
                  </button>
                  <span className="mono px-1">{safePage} / {toplamSayfa}</span>
                  <button onClick={() => setPage(safePage + 1)} disabled={safePage === toplamSayfa} className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-40">
                    <span className="ms" style={{ fontSize: 16 }}>chevron_right</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Saatlik grafik */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <span className="ms text-slate-500" style={{ fontSize: 18 }}>show_chart</span>
          <p className="text-[13px] font-semibold text-slate-700">Saatlik Sayım Performansı</p>
          <p className="ml-auto text-[11.5px] text-slate-400">{seciliKisi ? seciliKisi.ad : 'Tüm personel'}</p>
        </div>
        <div className="p-4">
          {grafikVeri.length === 0
            ? <BosDurum ikon="show_chart" metin="Grafik için henüz zaman bilgisi olan sayım kaydı yok." />
            : <SaatlikGrafik data={grafikVeri} />}
        </div>
      </div>

      {/* Görev ilerlemesi */}
      {hesap.gorevler.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <span className="ms text-slate-500" style={{ fontSize: 18 }}>assignment</span>
            <p className="text-[13px] font-semibold text-slate-700">Görev İlerlemesi</p>
          </div>
          <div className="table-scroll overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-800 text-white mono uppercase tracking-wider text-[10.5px]">
                <tr>
                  <th className="px-3 py-2.5 text-left">Sayımcı</th>
                  <th className="px-3 py-2.5 text-left">Kapsam</th>
                  <th className="px-3 py-2.5 text-left">İlerleme</th>
                  <th className="px-3 py-2.5 text-left">Durum</th>
                  <th className="px-3 py-2.5 text-right">Gönderilme</th>
                  <th className="px-3 py-2.5 text-right">Bitiş</th>
                  <th className="px-3 py-2.5 text-right">Süre</th>
                  <th className="px-3 py-2.5 text-right">Sn / Kalem</th>
                </tr>
              </thead>
              <tbody>
                {hesap.gorevler.map((go, i) => {
                  const gPct = go.atanan > 0 ? Math.round(go.sayilan / go.atanan * 100) : 0
                  const bitti = go.g.durum === 'tamamlandi'
                  return (
                    <tr key={go.g.id} className={'border-b border-slate-100 hover:bg-blue-50/40 ' + (i % 2 === 1 ? 'bg-slate-50/60' : '')}>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">{go.ad}</td>
                      <td className="px-3 py-2.5 text-slate-500 max-w-[220px] truncate" title={go.g.filtreOzeti || ''}>
                        {go.g.filtreOzeti || (go.g.atananRows?.length ? `${fmtInt(go.atanan)} kalem` : 'Tüm oturum')}
                      </td>
                      <td className="px-3 py-2.5 min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={'h-full rounded-full ' + (bitti ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: gPct + '%' }} />
                          </div>
                          <span className="mono text-[11px] text-slate-500 whitespace-nowrap">{fmtInt(go.sayilan)} / {fmtInt(go.atanan)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={'inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold ' + (bitti ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                          {bitti ? 'Tamamlandı' : 'Bekliyor'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right mono text-slate-500">{fmtZaman(go.basla)}</td>
                      <td className="px-3 py-2.5 text-right mono text-slate-500">{fmtZaman(go.bitis)}</td>
                      <td className="px-3 py-2.5 text-right mono">{fmtSure(go.sureSn)}</td>
                      <td className={'px-3 py-2.5 text-right mono ' + (go.uyarilar.length ? 'text-red-600 font-bold' : '')} title={go.uyarilar.join(' · ')}>
                        {go.snKalem ?? '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-[11.5px] text-slate-400 leading-relaxed">
        <p>
          Aktif süre, aynı kişinin ardışık işlemleri arasındaki sürelerin toplamıdır; {MOLA_SN / 60} dakikadan uzun aralar mola sayılıp dışarıda bırakılır.
          Hız = sayılan ürün / aktif süre (en az 2 ürün ve 1 dakika gerekir).
        </p>
        <p>
          Raf = koridor (Raf Listesi'ndeki birim).
          {hesap.logModu
            ? ' Manuel eklenen kalemler ve "Sistemden Doldur" ile toplu doldurulan kalemler personel tablosuna ve grafiğe dahil değildir.'
            : ' Bu modda "Sistemden Doldur" ile doldurulan kalemler de dolduran kişiye yazılır.'}
        </p>
      </div>
    </div>
  )
}
