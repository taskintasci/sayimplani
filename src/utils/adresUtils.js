import { SABLON } from '../constants'

// ─── Birleşik adres modeli ───────────────────────────────────────────────────
// 4 parça (LOS Depo / WMS Antrepo): Blok-Koridor-Sütun-Kat        (ör. 1-AL-05-3)
// 5 parça (WMS Depo / Redbull):     Bina-Blok-Koridor-Sütun-Kat   (ör. 4-09L-10-1-1)
// 5 parça = 4 parça + baştan `bina`. İç anahtarlar `blok/koridor/sutun/kat` iki
// şemada da AYNI anlama gelir.

const FILTRE_ETIKETLERI = {
  filterSearch:   'Ara',
  filterDurum:    'Durum',
  filterKategori: 'Kategori',
  filterUrunTipi: 'Ürün Tipi',
  filterPalet:    'Palet',
  filterBina:     'Bina',
  filterBlok:     'Blok',
  filterKoridor:  'Koridor',
  filterSutun:    'Sütun',
  filterKat:      'Kat',
  filterGirisGun: 'Giriş Günü',
}

/** Sayım sayfalarındaki aktif filtreleri "Koridor: A, B · Sütun: 1" gibi okunabilir
 *  bir özete çevirir — görev atarken hangi kritere göre gönderildiğini
 *  görev kartında gösterebilmek için. Aktif filtre yoksa boş string döner. */
export function buildFiltreOzeti(filters) {
  const parts = []
  for (const [key, label] of Object.entries(FILTRE_ETIKETLERI)) {
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
  return { blok: parts[0] || '', koridor: parts[1] || '', sutun: parts[2] || '', kat: parts[3] || '' }
}

/**
 * Bir adresin ait olduğu koridor anahtarı — Raf Listesi / Kör Raf Sayım
 * gruplama-eşleştirme birimi. Adresin Sütun'a kadarki ön eki:
 *   4 parça (LOS Depo / WMS Antrepo): Blok-Koridor        → "1-AL"
 *   5 parça (WMS Depo / Redbull):     Bina-Blok-Koridor   → "4-09L-10"
 */
export function getKoridor(adres, sablon) {
  const p = sablon === SABLON.WMS_REDBULL ? parseAdresRedbull(adres) : parseAdres(adres)
  return [p.bina, p.blok, p.koridor].filter(Boolean).join('-')
}

/** Bir adresin "Sütun" bileşeni (Raf Listesi'nde koridor altındaki alt kırılım). */
export function getSutun(adres, sablon) {
  const p = sablon === SABLON.WMS_REDBULL ? parseAdresRedbull(adres) : parseAdres(adres)
  return p.sutun
}

/**
 * Kör Raf Sayım kapsam eşleştirmesi. `kapsamAnahtarlari` elemanları iki biçimden:
 *   "1-AL"     → tüm koridor (blok+koridor bileşiği)
 *   "1-AL|05"  → o koridor, yalnız sütun 05   (| ayraç; adres parçalarında geçmez)
 * Adresi çözümlenemeyen (koridorsuz) satır hiçbir kapsama girmez.
 */
export function matchesKoridorKapsam(adres, sablon, kapsamAnahtarlari) {
  const kor = getKoridor(adres, sablon)
  if (!kor) return false
  let sut
  for (const k of kapsamAnahtarlari) {
    const i = k.indexOf('|')
    if (i === -1) {
      if (k === kor) return true
    } else if (k.slice(0, i) === kor) {
      if (sut === undefined) sut = getSutun(adres, sablon)
      if (k.slice(i + 1) === sut) return true
    }
  }
  return false
}

const URUN_TIPI_MAP = { A: 'Ambalaj', M: 'Mamul', H: 'Hammadde', Y: 'Yardımcı Madde', N: 'Numune' }

/** Stok kodunun ilk harfine göre ürün tipini döndürür (A/M/H/Y/N). Eşleşmezse "Tanımsız". */
export function getUrunTipi(kod) {
  const harf = String(kod || '').trim().charAt(0).toUpperCase()
  return URUN_TIPI_MAP[harf] || 'Tanımsız'
}

/** sortType==='2' iken Sütun/Kat önceliği değişir (Blok/Koridor her zaman ilk iki
 *  sırada sabit). */
export function sortRows(rows, sortType) {
  return [...rows].sort((a, b) => {
    const pa = parseAdres(a.adres), pb = parseAdres(b.adres)
    if (pa.blok !== pb.blok) return pa.blok.localeCompare(pb.blok)
    if (pa.koridor !== pb.koridor) return pa.koridor.localeCompare(pb.koridor)
    if (sortType === '2') {
      if (pa.kat !== pb.kat) return pa.kat.localeCompare(pb.kat)
      return pa.sutun.localeCompare(pb.sutun)
    }
    if (pa.sutun !== pb.sutun) return pa.sutun.localeCompare(pb.sutun)
    return pa.kat.localeCompare(pb.kat)
  })
}

export function getUniqueAdresValues(rows) {
  const blokSet = new Set(), koridorSet = new Set(), sutunSet = new Set(), katSet = new Set()
  rows.forEach(r => {
    const p = parseAdres(r.adres)
    if (p.blok) blokSet.add(p.blok)
    if (p.koridor) koridorSet.add(p.koridor)
    if (p.sutun) sutunSet.add(p.sutun)
    if (p.kat) katSet.add(p.kat)
  })
  return {
    bloklar: [...blokSet].sort(),
    koridorlar: [...koridorSet].sort(),
    sutunlar: [...sutunSet].sort((a, b) => Number(a) - Number(b)),
    katlar: [...katSet].sort((a, b) => Number(a) - Number(b)),
  }
}

/**
 * Simetrik (mutual) cascade filtre seçenekleri hesaplar.
 * Her boyutun seçenekleri, o boyutun filtresi HARİÇ diğer tüm aktif filtreler
 * uygulanmış veriden türetilir.
 *
 * filters: { filterSearch, filterDurum, filterKategori, filterUrunTipi, filterPalet?,
 *            filterBlok, filterKoridor, filterSutun, filterKat, filterGirisGun? }
 */
export function computeFilterOptions(sourceRows, filters) {
  const {
    filterSearch = '',
    filterDurum = [], filterKategori = [], filterUrunTipi = [], filterPalet,
    filterBlok = [], filterKoridor = [], filterSutun = [], filterKat = [],
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
      if (exclude !== 'blok'    && filterBlok.length > 0    && !filterBlok.includes(p.blok))       return false
      if (exclude !== 'koridor' && filterKoridor.length > 0 && !filterKoridor.includes(p.koridor)) return false
      if (exclude !== 'sutun'   && filterSutun.length > 0   && !filterSutun.includes(p.sutun))     return false
      if (exclude !== 'kat'     && filterKat.length > 0     && !filterKat.includes(p.kat))         return false
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
    bloklar:     [...new Set(apply(sourceRows, 'blok').map(r => parseAdres(r.adres).blok).filter(Boolean))].sort(),
    koridorlar:  [...new Set(apply(sourceRows, 'koridor').map(r => parseAdres(r.adres).koridor).filter(Boolean))].sort(),
    sutunlar:    [...new Set(apply(sourceRows, 'sutun').map(r => parseAdres(r.adres).sutun).filter(Boolean))].sort((a, b) => Number(a) - Number(b)),
    katlar:      [...new Set(apply(sourceRows, 'kat').map(r => parseAdres(r.adres).kat).filter(Boolean))].sort((a, b) => Number(a) - Number(b)),
  }

  if (hasPalet) {
    result.paletler = [...new Set(apply(sourceRows, 'palet').map(r => r.partiEk).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }))
  }

  return result
}

// ─── WMS Depo / Redbull — 5 parçalı şema (Bina-Blok-Koridor-Sütun-Kat) ────────
// 4 parçalının aynısı, baştan `bina` eklenmiş.

export function parseAdresRedbull(adres) {
  const parts = String(adres || '').split('-')
  return {
    bina:    parts[0] || '',
    blok:    parts[1] || '',
    koridor: parts[2] || '',
    sutun:   parts[3] || '',
    kat:     parts[4] || '',
  }
}

const numCmp = (a, b) => a.localeCompare(b, 'tr', { numeric: true })

/** sortType==='2' iken Sütun/Kat önceliği değişir (Bina/Blok/Koridor her zaman
 *  ilk üç sırada sabit). */
export function sortRowsRedbull(rows, sortType) {
  return [...rows].sort((a, b) => {
    const pa = parseAdresRedbull(a.adres), pb = parseAdresRedbull(b.adres)
    if (pa.bina !== pb.bina) return numCmp(pa.bina, pb.bina)
    if (pa.blok !== pb.blok) return numCmp(pa.blok, pb.blok)
    if (pa.koridor !== pb.koridor) return numCmp(pa.koridor, pb.koridor)
    if (sortType === '2') {
      if (pa.kat !== pb.kat) return numCmp(pa.kat, pb.kat)
      return numCmp(pa.sutun, pb.sutun)
    }
    if (pa.sutun !== pb.sutun) return numCmp(pa.sutun, pb.sutun)
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
    filterBina = [], filterBlok = [], filterKoridor = [], filterSutun = [], filterKat = [],
  } = filters

  function apply(rows, exclude) {
    const q = filterSearch.trim().toLowerCase()
    return rows.filter(r => {
      if (q && !(r.kod?.toLowerCase().includes(q) || r.ad?.toLowerCase().includes(q) || r.parti?.toLowerCase().includes(q))) return false
      if (exclude !== 'durum' && filterDurum.length > 0 && !filterDurum.includes(r.durum)) return false
      const p = parseAdresRedbull(r.adres)
      if (exclude !== 'bina'    && filterBina.length > 0    && !filterBina.includes(p.bina))       return false
      if (exclude !== 'blok'    && filterBlok.length > 0    && !filterBlok.includes(p.blok))       return false
      if (exclude !== 'koridor' && filterKoridor.length > 0 && !filterKoridor.includes(p.koridor)) return false
      if (exclude !== 'sutun'   && filterSutun.length > 0   && !filterSutun.includes(p.sutun))     return false
      if (exclude !== 'kat'     && filterKat.length > 0     && !filterKat.includes(p.kat))         return false
      return true
    })
  }

  return {
    durumlar:   [...new Set(apply(sourceRows, 'durum').map(r => r.durum).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')),
    binalar:    [...new Set(apply(sourceRows, 'bina').map(r => parseAdresRedbull(r.adres).bina).filter(Boolean))].sort(numCmp),
    bloklar:    [...new Set(apply(sourceRows, 'blok').map(r => parseAdresRedbull(r.adres).blok).filter(Boolean))].sort(numCmp),
    koridorlar: [...new Set(apply(sourceRows, 'koridor').map(r => parseAdresRedbull(r.adres).koridor).filter(Boolean))].sort(numCmp),
    sutunlar:   [...new Set(apply(sourceRows, 'sutun').map(r => parseAdresRedbull(r.adres).sutun).filter(Boolean))].sort(numCmp),
    katlar:     [...new Set(apply(sourceRows, 'kat').map(r => parseAdresRedbull(r.adres).kat).filter(Boolean))].sort(numCmp),
  }
}
