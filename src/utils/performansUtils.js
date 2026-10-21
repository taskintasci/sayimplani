// Sayım performansı / denetim hesapları — Sayım Performansı sayfası ile
// excelExport'taki Sayım Logu ve Geriye Dönük Denetim çıktıları aynı
// fonksiyonları kullanır; ekrandaki rakam ile Excel'deki rakam ayrışmasın diye.

export const HIZLI_ONAY_SN = 3        // bundan kısa aralıkla gelen "Onayla" = hızlı onay
export const MOLA_SN       = 10 * 60  // bundan uzun ara aktif süreye sayılmaz (mola/yürüme)

export const LOG_ROL = { sayimci: 'Sayımcı', yonetici: 'Yönetici', superadmin: 'Süper Yönetici', kontrolcu: 'Kontrolcü' }
export const SAYIM_EYLEMLERI = new Set(['onayla', 'duzenle', 'elle'])

export const logSayi = v => {
  if (v === undefined || v === null || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

export const tsDate = v => (v?.toDate ? v.toDate() : v instanceof Date ? v : v?.seconds ? new Date(v.seconds * 1000) : null)

export const medyan = arr => {
  if (arr.length === 0) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

export const sayildiMi = (results, id) => {
  const m = results[id]?.miktar
  return m !== undefined && m !== ''
}

// Mutabakat onayı eskiden updatedBy/updatedAt'ı onaylayanla eziyordu;
// `onaylayan` alanı olmayan onaylı satırın kişi/zaman izi güvenilmez.
export const izGuvenilir = res => res.status !== 'Onaylandı' || !!res.onaylayan

/** sayimLog kayıtlarını (istemciZamani'na göre sıralı) kişi bazında özetler. */
export function logKisiOzeti(logs) {
  const sonZaman = new Map()
  const detay = logs.map(l => {
    const t = l.istemciZamani
    const onceki = sonZaman.get(l.uid)
    const araSn = t && onceki ? Math.round((t - onceki) / 1000) : null
    if (t) sonZaman.set(l.uid, t)
    const sistem = logSayi(l.sistemMiktar)
    const yeni   = logSayi(l.yeniMiktar)
    const hizli  = l.eylem === 'onayla' && araSn !== null && araSn < HIZLI_ONAY_SN
    return { ...l, araSn, sistem, yeni, hizli, fark: sistem !== null && yeni !== null ? yeni - sistem : null }
  })

  const ozet = new Map()
  detay.forEach(l => {
    if (!ozet.has(l.uid)) {
      ozet.set(l.uid, {
        uid: l.uid, ad: l.ad, rol: l.rol, toplam: 0, kalemler: new Set(), adresler: new Set(),
        onayla: 0, elle: 0, farkli: 0, geriAl: 0, sil: 0, toplu: 0, manuel: 0, hizli: 0,
        ilk: null, son: null, aktifSn: 0, araliklar: [],
      })
    }
    const o = ozet.get(l.uid)
    o.toplam++
    if (l.istemciZamani) {
      if (!o.ilk || l.istemciZamani < o.ilk) o.ilk = l.istemciZamani
      if (!o.son || l.istemciZamani > o.son) o.son = l.istemciZamani
    }
    if (l.araSn !== null && l.araSn <= MOLA_SN) { o.aktifSn += l.araSn; o.araliklar.push(l.araSn) }
    if (SAYIM_EYLEMLERI.has(l.eylem)) {
      o.kalemler.add(l.rowId)
      if (l.adres) o.adresler.add(l.adres)
      if (l.eylem === 'onayla') o.onayla++
      else o.elle++
      if (l.eylem !== 'onayla' && l.fark !== null && l.fark !== 0) o.farkli++
    }
    if (l.hizli) o.hizli++
    if (l.eylem === 'geriAl') o.geriAl++
    if (l.eylem === 'sil') o.sil++
    if (l.eylem === 'sistemdenDoldur') o.toplu += l.adet || 0
    if (l.eylem === 'manuelEkle') o.manuel++
  })
  return { detay, ozet }
}

/** Kişi özetinden oranlar + Excel'deki "Değerlendirme" uyarıları. */
export function kisiDegerlendirme(o) {
  const sayimIslem = o.onayla + o.elle
  const onayPct  = sayimIslem > 0 ? Math.round(o.onayla / sayimIslem * 100) : null
  const hizliPct = o.onayla > 0 ? Math.round(o.hizli / o.onayla * 100) : null
  const uyarilar = []
  if (hizliPct !== null && hizliPct >= 30 && o.hizli >= 5) uyarilar.push(`Hızlı onay oranı %${hizliPct} (${HIZLI_ONAY_SN} sn'den kısa aralık)`)
  if (onayPct !== null && onayPct >= 98 && sayimIslem >= 20) uyarilar.push('Sistem miktarı neredeyse hep aynen onaylanmış')
  if (o.toplu > 0) uyarilar.push(`${o.toplu} kalem "Sistemden Doldur" ile dolduruldu`)
  return { onayPct, hizliPct, uyarilar }
}

/** Görevin kalem ilerlemesi + süre metrikleri (atananRows boş = tüm oturum). */
export function gorevOzeti(g, rows, results) {
  const atananSet = (g.atananRows || []).length > 0 ? new Set(g.atananRows) : null
  const gRows = atananSet ? rows.filter(r => atananSet.has(r.id)) : rows
  const sayilan = gRows.filter(r => sayildiMi(results, r.id))
  const ayniSay = sayilan.filter(r => {
    const s = logSayi(r.sayim), m = logSayi(results[r.id]?.miktar)
    return s !== null && m !== null && s === m
  }).length
  const ayniPct = sayilan.length > 0 ? Math.round(ayniSay / sayilan.length * 100) : null
  const basla = tsDate(g.createdAt), bitis = tsDate(g.tamamlanmaZamani)
  const sureSn = basla && bitis ? Math.max(0, (bitis - basla) / 1000) : null
  const snKalem = sureSn !== null && sayilan.length > 0 ? Math.round(sureSn / sayilan.length) : null
  const uyarilar = []
  if (snKalem !== null && snKalem < 10 && sayilan.length >= 20) uyarilar.push(`Kalem başına ${snKalem} sn — fiziksel sayım için çok kısa`)
  if (ayniPct !== null && ayniPct >= 98 && sayilan.length >= 20) uyarilar.push('Sayılan miktar neredeyse hep sistemle aynı')
  return { atanan: gRows.length, sayilan: sayilan.length, ayniSay, ayniPct, basla, bitis, sureSn, snKalem, uyarilar }
}

/** Bir zaman dizisinden (ms) mola hariç aktif süre (sn). */
export function aktifSureSn(zamanlar) {
  const s = [...zamanlar].sort((a, b) => a - b)
  let toplam = 0
  for (let i = 1; i < s.length; i++) {
    const ara = (s[i] - s[i - 1]) / 1000
    if (ara <= MOLA_SN) toplam += ara
  }
  return toplam
}

/** Ürün/dakika — en az 2 kalem ve 1 dk aktif süre yoksa null. */
export const hizHesapla = (kalem, aktifSn) => (kalem >= 2 && aktifSn >= 60 ? kalem / (aktifSn / 60) : null)

/** Olayları (ms zaman) takvim saatine göre kovalar; aradaki boş saatler 0. */
export function saatlikKovala(zamanlar) {
  if (zamanlar.length === 0) return []
  const SAAT = 3600000
  const kova = new Map()
  let min = Infinity, max = -Infinity
  zamanlar.forEach(t => {
    const d = new Date(t)
    d.setMinutes(0, 0, 0)
    const k = d.getTime()
    kova.set(k, (kova.get(k) || 0) + 1)
    if (k < min) min = k
    if (k > max) max = k
  })
  const out = []
  for (let k = min; k <= max; k += SAAT) out.push({ t: k, value: kova.get(k) || 0 })
  return out
}
