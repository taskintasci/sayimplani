import { SABLON } from '../constants'

const FILTRE_ETIKETLERI = {
  filterSearch:   'Ara',
  filterDurum:    'Durum',
  filterKategori: 'Kategori',
  filterUrunTipi: 'Ürün Tipi',
  filterPalet:    'Palet',
  filterRaf:      'Koridor',
  filterSira:     'Sütun',
  filterKolon:    'Sıra',
  filterGoz:      'Kat',
  filterGirisGun: 'Giriş Günü',
  filterBina:     'Bina',
  filterKoridor:  'Koridor',
  filterSutun:    'Sütun',
  filterKat:      'Kat',
}

/** Sayım sayfalarındaki aktif filtreleri "Koridor: A, B · Sütun: 1" gibi okunabilir
 *  bir özete çevirir — görev atarken hangi kritere göre gönderildiğini
 *  görev kartında gösterebilmek için. Aktif filtre yoksa boş string döner. */
export function buildFiltreOzeti(filters) {
  // `filterSira` iç anahtarı 4 parçalı şemada (LOS Depo / WMS Antrepo) konum 2'dir
  // (ortak sözlükte "Sütun"), WMS Depo'nun 5 parçalı şemasında konum 4'tür ("Sıra").
  // Aynı anahtar iki farklı etikete denk geldiği için şemayı ayırt ediyoruz.
  const besParcaliSema = filters.filterKoridor !== undefined || filters.filterBina !== undefined
  const etiketler = besParcaliSema ? { ...FILTRE_ETIKETLERI, filterSira: 'Sıra' } : FILTRE_ETIKETLERI
  const parts = []
  for (const [key, label] of Object.entries(etiketler)) {
    const val = filters[key]
    if (key === 'filterSearch') {
      if (val && val.trim()) parts.push(`${label}: "${val.trim()}"`)
      continue
    }
    if (Array.isArray(val) && val.length > 0) parts.push(`${label}: ${val.join(', ')}`)
  }
  return parts.join(' · ')
}

export function parseAdres(adres) {
  const parts = String(adres || '').split('-')
  return { raf: parts[0] || '', sira: parts[1] || '', kolon: parts[2] || '', goz: parts[3] || '' }
}

/**
 * Bir adresin ait olduğu koridor anahtarı. Koridor Sayımı ailesinin (ve Raf
 * Listesi'nin) gruplama/eşleştirme birimi — şablona göre adresin farklı
 * parçasından okunur:
 *   LOS Depo / WMS Antrepo → 4 parçalı `Raf-Sıra-Kolon-Göz`      → 1. parça
 *   WMS Depo               → 5 parçalı `Bina-Koridor-Sutun-Sıra-Kat` → 2. parça
 * (Ortak sözlükte her ikisi de "Koridor" olarak gösterilir, bkz. FILTRE_ETIKETLERI.)
 */
export function getKoridor(adres, sablon) {
  return sablon === SABLON.WMS_REDBULL
    ? parseAdresRedbull(adres).koridor
    : parseAdres(adres).raf
}

const URUN_TIPI_MAP = { A: 'Ambalaj', M: 'Mamul', H: 'Hammadde', Y: 'Yardımcı Madde', N: 'Numune' }

/** Stok kodunun ilk harfine göre ürün tipini döndürür (A/M/H/Y/N). Eşleşmezse "Tanımsız". */
export function getUrunTipi(kod) {
  const harf = String(kod || '').trim().charAt(0).toUpperCase()
  return URUN_TIPI_MAP[harf] || 'Tanımsız'
}

export function sortRows(rows, sortType) {
  return [...rows].sort((a, b) => {
    const pa = parseAdres(a.adres), pb = parseAdres(b.adres)
    if (pa.raf !== pb.raf) return pa.raf.localeCompare(pb.raf)
    if (pa.sira !== pb.sira) return pa.sira.localeCompare(pb.sira)
    if (sortType === '2') {
      if (pa.goz !== pb.goz) return pa.goz.localeCompare(pb.goz)
      return pa.kolon.localeCompare(pb.kolon)
    }
    if (pa.kolon !== pb.kolon) return pa.kolon.localeCompare(pb.kolon)
    return pa.goz.localeCompare(pb.goz)
  })
}

export function getUniqueAdresValues(rows) {
  const rafSet = new Set(), siraSet = new Set(), kolonSet = new Set(), gozSet = new Set()
  rows.forEach(r => {
    const p = parseAdres(r.adres)
    if (p.raf) rafSet.add(p.raf)
    if (p.sira) siraSet.add(p.sira)
    if (p.kolon) kolonSet.add(p.kolon)
    if (p.goz) gozSet.add(p.goz)
  })
  return {
    raflar: [...rafSet].sort(),
    siralar: [...siraSet].sort(),
    kolonlar: [...kolonSet].sort((a, b) => Number(a) - Number(b)),
    gozler: [...gozSet].sort((a, b) => Number(a) - Number(b)),
  }
}

/**
 * Simetrik (mutual) cascade filtre seçenekleri hesaplar.
 * Her boyutun seçenekleri, o boyutun filtresi HARİÇ diğer tüm aktif filtreler
 * uygulanmış veriden türetilir.
 *
 * filters: { filterSearch, filterDurum, filterKategori, filterUrunTipi, filterPalet?,
 *            filterRaf, filterSira, filterKolon, filterGoz, filterGirisGun? }
 */
export function computeFilterOptions(sourceRows, filters) {
  const {
    filterSearch = '',
    filterDurum = [], filterKategori = [], filterUrunTipi = [], filterPalet,
    filterRaf = [], filterSira = [], filterKolon = [], filterGoz = [],
    filterGirisGun = [],
  } = filters

  const hasPalet = filterPalet !== undefined

  function apply(rows, exclude) {
    const q = filterSearch.trim().toLowerCase()
    return rows.filter(r => {
      if (q && !(r.kod?.toLowerCase().includes(q) || r.ad?.toLowerCase().includes(q) || r.parti?.toLowerCase().includes(q))) return false
      if (exclude !== 'durum'    && filterDurum.length > 0    && !filterDurum.includes(r.durum))       return false
      if (exclude !== 'kategori' && filterKategori.length > 0 && !filterKategori.includes(r.kategori)) return false
      if (exclude !== 'urunTipi' && filterUrunTipi.length > 0 && !filterUrunTipi.includes(getUrunTipi(r.kod))) return false
      if (hasPalet && exclude !== 'palet' && filterPalet.length > 0 && !filterPalet.includes(r.partiEk)) return false
      if (exclude !== 'girisGun' && filterGirisGun.length > 0) {
        const g = Number(r.girisGun)
        const ok = filterGirisGun.some(range => {
          if (range.startsWith('0-30')   && !isNaN(g) && g > 0 && g <= 30)   return true
          if (range.startsWith('31-90')  && !isNaN(g) && g >= 31 && g <= 90)  return true
          if (range.startsWith('91-180') && !isNaN(g) && g >= 91 && g <= 180) return true
          if (range.startsWith('180+')   && !isNaN(g) && g > 180)             return true
          return false
        })
        if (!ok) return false
      }
      const p = parseAdres(r.adres)
      if (exclude !== 'raf'   && filterRaf.length > 0   && !filterRaf.includes(p.raf))     return false
      if (exclude !== 'sira'  && filterSira.length > 0  && !filterSira.includes(p.sira))   return false
      if (exclude !== 'kolon' && filterKolon.length > 0 && !filterKolon.includes(p.kolon)) return false
      if (exclude !== 'goz'   && filterGoz.length > 0   && !filterGoz.includes(p.goz))     return false
      return true
    })
  }

  const DURUM_ORDER = ['Normal', 'Bloke', 'SKTG', 'Özel', 'Kalite']
  const availDurumlar = new Set(apply(sourceRows, 'durum').map(r => r.durum).filter(Boolean))

  const URUN_TIPI_ORDER = ['Hammadde', 'Yardımcı Madde', 'Mamul', 'Ambalaj', 'Numune', 'Tanımsız']
  const availUrunTipleri = new Set(apply(sourceRows, 'urunTipi').map(r => getUrunTipi(r.kod)).filter(Boolean))

  const result = {
    durumlar:    DURUM_ORDER.filter(d => availDurumlar.has(d)),
    urunTipleri: URUN_TIPI_ORDER.filter(t => availUrunTipleri.has(t)),
    kategoriler: [...new Set(apply(sourceRows, 'kategori').map(r => r.kategori).filter(Boolean))].sort(),
    raflar:      [...new Set(apply(sourceRows, 'raf').map(r => parseAdres(r.adres).raf).filter(Boolean))].sort(),
    siralar:     [...new Set(apply(sourceRows, 'sira').map(r => parseAdres(r.adres).sira).filter(Boolean))].sort(),
    kolonlar:    [...new Set(apply(sourceRows, 'kolon').map(r => parseAdres(r.adres).kolon).filter(Boolean))].sort((a, b) => Number(a) - Number(b)),
    gozler:      [...new Set(apply(sourceRows, 'goz').map(r => parseAdres(r.adres).goz).filter(Boolean))].sort((a, b) => Number(a) - Number(b)),
  }

  if (hasPalet) {
    result.paletler = [...new Set(apply(sourceRows, 'palet').map(r => r.partiEk).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }))
  }

  return result
}

// ─── WMS Depo Redbull — 5 parçalı adres şeması (Bina-Koridor-Sutun-Sıra-Kat) ──
// Akkim/Epson'un Raf-Sıra-Kolon-Göz şemasından tamamen ayrı, paralel bir
// fonksiyon seti. Yukarıdaki parseAdres/sortRows/computeFilterOptions'a
// kasıtlı olarak dokunulmadı.

export function parseAdresRedbull(adres) {
  const parts = String(adres || '').split('-')
  return {
    bina:    parts[0] || '',
    koridor: parts[1] || '',
    sutun:   parts[2] || '',
    sira:    parts[3] || '',
    kat:     parts[4] || '',
  }
}

const numCmp = (a, b) => a.localeCompare(b, 'tr', { numeric: true })

/** sortType==='2' iken Sıra/Kat önceliği değişir (Bina/Koridor/Sutun her zaman
 *  ilk üç sırada sabit) — mevcut Raf/Sıra/Kolon/Göz sortType deseniyle aynı UX. */
export function sortRowsRedbull(rows, sortType) {
  return [...rows].sort((a, b) => {
    const pa = parseAdresRedbull(a.adres), pb = parseAdresRedbull(b.adres)
    if (pa.bina !== pb.bina) return numCmp(pa.bina, pb.bina)
    if (pa.koridor !== pb.koridor) return numCmp(pa.koridor, pb.koridor)
    if (pa.sutun !== pb.sutun) return numCmp(pa.sutun, pb.sutun)
    if (sortType === '2') {
      if (pa.kat !== pb.kat) return numCmp(pa.kat, pb.kat)
      return numCmp(pa.sira, pb.sira)
    }
    if (pa.sira !== pb.sira) return numCmp(pa.sira, pb.sira)
    return numCmp(pa.kat, pb.kat)
  })
}

/**
 * computeFilterOptions'ın Redbull eşdeğeri (simetrik cascade filtre).
 * Kategori/Ürün Tipi/Palet/Giriş Günü boyutları yok — Redbull excel'inde
 * bu alanlar map edilmiyor.
 */
export function computeFilterOptionsRedbull(sourceRows, filters) {
  const {
    filterSearch = '', filterDurum = [],
    filterBina = [], filterKoridor = [], filterSutun = [], filterSira = [], filterKat = [],
  } = filters

  function apply(rows, exclude) {
    const q = filterSearch.trim().toLowerCase()
    return rows.filter(r => {
      if (q && !(r.kod?.toLowerCase().includes(q) || r.ad?.toLowerCase().includes(q) || r.parti?.toLowerCase().includes(q))) return false
      if (exclude !== 'durum' && filterDurum.length > 0 && !filterDurum.includes(r.durum)) return false
      const p = parseAdresRedbull(r.adres)
      if (exclude !== 'bina'    && filterBina.length > 0    && !filterBina.includes(p.bina))       return false
      if (exclude !== 'koridor' && filterKoridor.length > 0 && !filterKoridor.includes(p.koridor)) return false
      if (exclude !== 'sutun'   && filterSutun.length > 0   && !filterSutun.includes(p.sutun))     return false
      if (exclude !== 'sira'    && filterSira.length > 0    && !filterSira.includes(p.sira))       return false
      if (exclude !== 'kat'     && filterKat.length > 0     && !filterKat.includes(p.kat))         return false
      return true
    })
  }

  return {
    durumlar:   [...new Set(apply(sourceRows, 'durum').map(r => r.durum).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')),
    binalar:    [...new Set(apply(sourceRows, 'bina').map(r => parseAdresRedbull(r.adres).bina).filter(Boolean))].sort(numCmp),
    koridorlar: [...new Set(apply(sourceRows, 'koridor').map(r => parseAdresRedbull(r.adres).koridor).filter(Boolean))].sort(numCmp),
    sutunlar:   [...new Set(apply(sourceRows, 'sutun').map(r => parseAdresRedbull(r.adres).sutun).filter(Boolean))].sort(numCmp),
    siralar:    [...new Set(apply(sourceRows, 'sira').map(r => parseAdresRedbull(r.adres).sira).filter(Boolean))].sort(numCmp),
    katlar:     [...new Set(apply(sourceRows, 'kat').map(r => parseAdresRedbull(r.adres).kat).filter(Boolean))].sort(numCmp),
  }
}
