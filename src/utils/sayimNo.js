// Sayım numarası: YYYYMMDD + firma kısa kodu + sıra (6 hane).
// Örn. 20260911EPS000001. Tarih kısmı oturumun SAYIM tarihidir (session.tarih),
// oluşturulma tarihi değil. Sıra firma kodu bazında KESİNTİSİZ artar (günlük
// sıfırlanmaz — kullanıcı kararı 2026-10-21): sayimNoSayac/{KOD} sayacından
// transaction ile alınır (bkz. useStore.sayimNoAta), iki sayım asla aynı
// numarayı alamaz.

const TR_ASCII = { Ç: 'C', Ğ: 'G', İ: 'I', I: 'I', Ö: 'O', Ş: 'S', Ü: 'U' }

// Firma kısa kodu: Firma Yönetimi'nde girilen `kisaKod`, yoksa firma adının
// ilk 3 harfi (Türkçe karakterler ASCII'ye çevrilir: "Akkim" → "AKK").
export function firmaKisaKod(firma) {
  const temizle = s => String(s || '')
    .toLocaleUpperCase('tr-TR')
    .replace(/[ÇĞİIÖŞÜ]/g, c => TR_ASCII[c] || c)
    .replace(/[^A-Z0-9]/g, '')
  const kod = temizle(firma?.kisaKod)
  if (kod) return kod.slice(0, 5)
  return temizle(firma?.ad).slice(0, 3) || 'SYM'
}

export const kisaKodGecerli = kod => /^[A-Z0-9]{2,5}$/.test(kod || '')

// 'YYYY-MM-DD' (veya Date) → 'YYYYMMDD'
export function tarihParcasi(tarih) {
  if (typeof tarih === 'string' && /^\d{4}-\d{2}-\d{2}/.test(tarih)) return tarih.slice(0, 10).replace(/-/g, '')
  const d = tarih instanceof Date ? tarih : new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

export const sayacId = (kod) => kod

export const sayimNoOlustur = (kod, tarih, sira) => `${tarihParcasi(tarih)}${kod}${String(sira).padStart(6, '0')}`
