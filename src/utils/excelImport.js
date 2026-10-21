function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function norm(val) {
  return String(val ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function toNum(val) {
  if (val === undefined || val === null || val === '') return ''
  // .trim() şart: SheetJS `raw:false` ile hücreyi Excel'in kendi sayı
  // biçimine göre metne çeviriyor — muhasebe/hizalama biçimleri (ör. `_)`
  // dolgu kodları) görünmez baştaki/sondaki boşluklar üretebiliyor. Trim
  // olmadan "108" ekranda "108" gibi görünse de aslında "108 " oluyor;
  // sayım ekranındaki fark kontrolü (String(sayılan) !== String(sistem))
  // bu görünmez boşluk yüzünden DOĞRU girilen değerleri bile "farklı"
  // sayıp kırmızı uyarı gösteriyordu (Redbull "Adet" sütununda tespit
  // edildi, 2026-08-11).
  return String(val).trim().replace(',', '.')
}

// WMS_Rapor_31'deki miktar sütunları muhasebe biçiminde formatlanıyor
// (örn. " 1,000.00 " binlik ayraç virgül, sıfır için "-"). toNum()'daki tek
// virgülü noktaya çeviren mantık burada "1.000.00" gibi bozuk bir değer üretir
// (parseFloat sadece "1" okur) — bu yüzden ayrı bir temizleyici kullanılıyor.
function toNumWms31(val) {
  if (val === undefined || val === null || val === '') return ''
  const str = String(val).trim()
  if (str === '' || str === '-') return '0'
  return str.replace(/,/g, '')
}

// WMS Depo Redbull'daki "Palet" sütunu düz sayı ama SheetJS ondalıklı
// biçimlendiriyor (örn. " 1.0 "). toNumWms31 sadece binlik virgülü temizler,
// gereksiz ".0" kalır — burada tam sayıya yuvarlanmadan (ör. "1.5" bozulmadan)
// gereksiz ondalık sıfırlar ayıklanıyor.
function toNumClean(val) {
  if (val === undefined || val === null || val === '') return ''
  const str = String(val).trim()
  if (str === '' || str === '-') return '0'
  const num = Number(str.replace(',', '.'))
  return Number.isFinite(num) ? String(num) : str
}

function fmtDate(gun, ay, yil) {
  return `${String(gun).padStart(2, '0')}.${String(ay).padStart(2, '0')}.${yil}`
}

// Redbull raporundaki "Best Before Date" (SKT) hücresi dosyadan dosyaya
// değişiyor: bazen Excel'in tarih seri numarası (ör. 46023), bazen hücrenin
// kendi biçimiyle metne dönmüş hâli (SheetJS `raw:false`). Seri numarası ve
// ISO (yyyy-aa-gg) yazımı GG.AA.YYYY'ye çevriliyor; başka her yazım OLDUĞU
// GİBİ bırakılıyor — "03/04/2026" gibi bir metinde gün/ay sırası tahmin
// edilemez; yanlış çevirmektense dosyadaki görünümü korumak daha güvenli.
function toDateStr(val) {
  if (val === undefined || val === null || val === '') return ''
  const str = String(val).trim()
  if (str === '' || str === '-') return ''

  // Excel tarih seri numarası (1899-12-30 başlangıçlı)
  if (/^\d+(\.\d+)?$/.test(str)) {
    const serial = Number(str)
    if (serial > 0 && serial < 100000) {
      const d = new Date(Math.round((serial - 25569) * 86400000))
      if (!Number.isNaN(d.getTime())) return fmtDate(d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear())
    }
  }

  // ISO: 2026-12-31 / 2026-12-31T00:00:00
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return fmtDate(Number(iso[3]), Number(iso[2]), Number(iso[1]))

  return str
}

// ─── SKU_Sayım_Listesi sütun haritası ───────────────────────────────────────
const SKU_MAP = {
  'sira no.'  : 'siraNo',
  'sıra no.'  : 'siraNo',
  'adres'     : 'adres',
  'kod'       : 'kod',
  'ad'        : 'ad',
  'parti'     : 'parti',
  'durum'     : 'durum',
  'adet1'     : 'adet1',
  'adet 1'    : 'adet1',
  'ambalaj'   : 'ambalaj',
  'sayım'     : 'sayim',
  'sayim'     : 'sayim',
  'birim'     : 'birim',
  'birim 1'   : 'birim',
  'açıklama'  : 'aciklama',
  'aciklama'  : 'aciklama',
}

// ─── RAPOR5 sütun haritası ───────────────────────────────────────────────────
const RAPOR5_MAP = {
  'adres'              : 'adres',
  'kod'                : 'kod',
  'ad'                 : 'ad',
  'parti'              : 'parti',
  'durum'              : 'durum',
  'adet 1'             : 'adet1',
  'birim 1'            : 'ambalaj',
  'son kırılım miktar' : 'sayim',
  'son kirilim miktar' : 'sayim',
  'son kırılım birim'  : 'birim',
  'son kirilim birim'  : 'birim',
  'adet 2'             : 'sayim_yedek',
  'birim 2'            : 'birim_yedek',
  'barkod'             : 'aciklama',
  'giriş tarih'        : 'girisTarih',
  'giris tarih'        : 'girisTarih',
  'giriş tarihi'       : 'girisTarih',
  'giris tarihi'       : 'girisTarih',
  'giriş gün'          : 'girisGun',
  'giris gun'          : 'girisGun',
  'giriş gun'          : 'girisGun',
  'giris gün'          : 'girisGun',
  'giriş gün sayısı'   : 'girisGun',
  'giris gun sayisi'   : 'girisGun',
  'kategori'           : 'kategori',
  'ürün kategorisi'    : 'kategori',
  'urun kategorisi'    : 'kategori',
  'kategori kodu'      : 'kategori',
  'ürün grubu'         : 'kategori',
  'urun grubu'         : 'kategori',
  'parti ek'           : 'partiEk',
  'partiek'            : 'partiEk',
  'palet no'           : 'partiEk',
  'palet no.'          : 'partiEk',
}

// RAPOR5 ayırt edici başlıkları
const RAPOR5_SIGNATURES = ['depo kod', 'palet tip', 'son k', 'son kırılım', 'son kirilim']

function isRapor5(headers) {
  const norms = headers.map(norm)
  return RAPOR5_SIGNATURES.some(sig => norms.some(h => h.includes(sig)))
}

// ─── WMS Antrepo (WMS_Rapor_31 / Kalan Stok Raporu) sütun haritası ───────────
// WMS Antrepo Sayım için kullanılan WMS raporu. Parti yerine Beyanname; Ambalaj yok;
// Palet Barkodu/Palet Adeti/Toplam Stok/Rezerve Adet gibi WMS'e özgü alanlar var.
//
// 2026-09-01: Rapor "Kalan Stok Raporu (Adresli)" adıyla ve İNGİLİZCE başlıklarla
// gelmeye başladı. İki başlık ailesi de burada map'li — eski Türkçe başlıklı
// dosyalar yüklenmeye devam edebilsin diye ikisi de korunuyor.
// Yeni dosyada "Depo Kalan Stok" sütunu YOK; hesaplaDepoKalanStok() üretiyor.
const WMS31_MAP = {
  // ── Türkçe başlıklar (eski WMS_Rapor_31) ──
  'adres'            : 'adres',
  'beyanname'        : 'parti',
  'stok kodu'        : 'kod',
  'stok adı'         : 'ad',
  'stok adi'         : 'ad',
  'durum adı'        : 'durum',
  'durum adi'        : 'durum',
  'kategori'         : 'kategori',
  'palet barkodu'    : 'paletBarkodu',
  'palet adeti'      : 'paletAdeti',
  'toplam stok'      : 'adet1',
  'rezerve adet'     : 'rezerveAdet',
  'depo kalan stok'  : 'sayim',
  'birim adı'        : 'birim',
  'birim adi'        : 'birim',

  // ── İngilizce başlıklar (Kalan Stok Raporu (Adresli), 2026-09-01→) ──
  // Map edilmeyen sütunlar (Customer, Warehouse, ASN Number, Supplier Name,
  // Batch No/Ex, tarihler, COO, SAP Location Code, CBM'ler, Ready to Sell)
  // sayımda kullanılmıyor — bilinçli olarak dışarıda bırakıldı.
  'wh location'              : 'adres',
  'customs document number'  : 'parti',
  'material code'            : 'kod',
  'material description'     : 'ad',
  'category'                 : 'kategori',
  'pallet barcode'           : 'paletBarkodu',
  'pallet quantity'          : 'paletAdeti',
  'quantity 1'               : 'adet1',
  'reserved quantity'        : 'rezerveAdet',
  'durum no'                 : 'durum',
  // Başlık kaynakta "UOM 1 ( Unit of Measure)" — parantez içi baştaki boşluk
  // dosyadan dosyaya değişebiliyor, iki yazım da map'li.
  'uom 1 ( unit of measure)' : 'birim',
  'uom 1 (unit of measure)'  : 'birim',
  'uom 1'                    : 'birim',
}

// İngilizce raporda "Durum Adı" (Normal/Özel/Bloke/Kalite) sütunu YOK, sadece
// "Durum No" kodu var. Eşleşme, eski Türkçe raporun iki sütunu karşılaştırılarak
// doğrulandı (2026-09-01, 8804 satır, birebir). Kod→ad çevrilmezse sayım
// ekranındaki durum rozetleri ve durum filtresi eski dosyalarla uyumsuz kalır.
const WMS31_DURUM_KODLARI = {
  'ok': 'Normal',
  'cu': 'Özel',
  'bl': 'Bloke',
  'qa': 'Kalite',
}

// WMS Antrepo ayırt edici başlıkları (hem Türkçe hem İngilizce rapor)
const WMS31_SIGNATURES = [
  'beyanname', 'rezerve adet', 'depo kalan stok', 'palet barkodu', 'palet adeti',
  'wh location', 'customs document number', 'reserved quantity', 'pallet barcode', 'pallet quantity',
]

function isWms31(headers) {
  const norms = headers.map(norm)
  return WMS31_SIGNATURES.some(sig => norms.some(h => h.includes(sig)))
}

// ─── WMS Depo Redbull sütun haritası ──────────────────────────────────────
// Red Bull Gıda'nın kendi WMS'inden alınan "Sayıma gelecek Rapor" formatı.
// Adres alt-parça sütunları (ayrı Bina/Koridor/Sutun/Sıra/Kat) BİLİNÇLİ olarak
// map EDİLMEZ — konum verisi zaten tek parça 'Address' sütununda
// (Bina-Blok-Koridor-Sütun-Kat, tire ile ayrık, bkz. adresUtils.js
// parseAdresRedbull).
// Best Before Date (SKT) 2026-09-01'de eklendi: sayım sırasında SKT kontrolü
// de yapıldığı için kullanıcı isteğiyle artık map ediliyor (önceki karar
// "gerek yok" yönündeydi).
const REDBULL_MAP = {
  'address'            : 'adres',
  'material'           : 'kod',
  'material name'      : 'ad',
  'sscc'               : 'sscc',
  'lot'                : 'parti',
  'best before date'   : 'skt',
  'palet'              : 'paletAdeti',
  'alisan statu'       : 'durum',
  'adet'               : 'sayim',
  'birim'              : 'birim',
  'açıklama'           : 'aciklama',
  'aciklama'           : 'aciklama',
}

// WMS Depo Redbull ayırt edici başlıkları — RAPOR5_SIGNATURES/WMS31_SIGNATURES
// ile çakışmaz.
const REDBULL_SIGNATURES = ['sscc', 'alisan statu', 'best before date']

function isRedbull(headers) {
  const norms = headers.map(norm)
  return REDBULL_SIGNATURES.some(sig => norms.some(h => h.includes(sig)))
}

// Her iki format için: header adı → internal field
function buildColMap(headers, fieldMap) {
  const colMap = {}
  headers.forEach((header, colIdx) => {
    const field = fieldMap[norm(header)]
    if (field) colMap[colIdx] = field
  })
  return colMap
}

// "Depo Kalan Stok" (sayım listesinin sistem miktarı) = Toplam Stok − Rezerve Adet.
// İngilizce başlıklı yeni WMS Antrepo raporunda bu sütun hiç yok; Quantity 1 ile
// Reserved Quantity'den burada hesaplanıyor. Türkçe başlıklı eski dosyalarda
// sütun hazır geldiği için oradaki değere DOKUNULMAZ (dosya her zaman kazanır).
function hesaplaDepoKalanStok(mapped) {
  if (mapped.sayim !== undefined && mapped.sayim !== '') return
  const toplam = Number(mapped.adet1)
  if (mapped.adet1 === undefined || mapped.adet1 === '' || !Number.isFinite(toplam)) return
  const rezerve = Number(mapped.rezerveAdet)
  const kalan = toplam - (Number.isFinite(rezerve) ? rezerve : 0)
  // Ondalıklı stokta kayan nokta artığını temizle (ör. 1.2000000000000002 → 1.2)
  mapped.sayim = String(Math.round(kalan * 1e6) / 1e6)
}

function mapDataRow(rowArr, colMap, siraNo, format) {
  const mapped = { id: makeId(), siraNo }
  const isW31 = format === 'wms31'

  Object.entries(colMap).forEach(([colIdxStr, field]) => {
    const val = rowArr[Number(colIdxStr)] ?? ''

    if (field === 'sayim_yedek') {
      if (!mapped.sayim) mapped.sayim = toNum(val)
    } else if (field === 'birim_yedek') {
      if (!mapped.birim) mapped.birim = String(val)
    } else if (field === 'paletAdeti' || field === 'rezerveAdet') {
      mapped[field] = isW31 ? toNumWms31(val) : toNumClean(val)
    } else if (field === 'sayim' || field === 'adet1') {
      mapped[field] = isW31 ? toNumWms31(val) : toNum(val)
    } else if (field === 'durum') {
      const raw = String(val).trim()
      mapped.durum = isW31 ? (WMS31_DURUM_KODLARI[raw.toLowerCase()] || raw) : raw
    } else if (field === 'skt') {
      mapped.skt = toDateStr(val)
    } else if (field === 'siraNo') {
      mapped.siraNo = val ? Number(val) || siraNo : siraNo
    } else {
      mapped[field] = String(val)
    }
  })

  if (isW31) hesaplaDepoKalanStok(mapped)

  return mapped
}

export const VALID_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
]
export const MAX_FILE_SIZE = 30 * 1024 * 1024 // 30MB

// xlsx + codepage tablosunu birlikte yükle.
// SheetJS ESM build'i ($cptable) bundler ortamında codepage modülünü
// otomatik yükleyemez; Türkçe (cp1254) .xls dosyalarinda string decode
// $cptable.utils üzerinden patlayip parse'i erken kesiyordu (2168 satir).
// Resmi cozum: cpexcel.full tablosunu set_cptable ile acikca ver.
let _xlsxPromise = null
export function loadXLSX() {
  if (_xlsxPromise) return _xlsxPromise
  _xlsxPromise = (async () => {
    const [XLSX, cptable] = await Promise.all([
      import('xlsx'),
      import('xlsx/dist/cpexcel.full.mjs'),
    ])
    XLSX.set_cptable(cptable)
    return XLSX
  })()
  return _xlsxPromise
}

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error('Dosya 30MB\'dan büyük olamaz.'))
      return
    }
    if (file.type && !VALID_MIMES.includes(file.type)) {
      reject(new Error('Yalnızca Excel dosyaları (.xlsx, .xls) kabul edilir.'))
      return
    }
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const XLSX = await loadXLSX()
        const wb = XLSX.read(new Uint8Array(e.target.result), {
          type: 'array',
          cellDates: false,
          raw: false,
        })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rawArr = ws
          ? XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })
          : []

        if (rawArr.length < 2) {
          reject(new Error('Excel dosyası boş veya çok az satır içeriyor.'))
          return
        }

        // Başlık satırını bul: ilk N satır içinde en çok alan map eden satır
        let headerRowIdx = 0
        let bestScore = 0
        let bestFormat = 'sku'
        let bestFieldMap = SKU_MAP

        for (let i = 0; i < Math.min(rawArr.length, 6); i++) {
          const row = rawArr[i]
          const headers = row.map(v => norm(String(v ?? '')))

          const isW31 = isWms31(headers)
          const isR5  = !isW31 && isRapor5(headers)
          const isRB  = !isW31 && !isR5 && isRedbull(headers)
          const format = isW31 ? 'wms31' : isR5 ? 'rapor5' : isRB ? 'redbull' : 'sku'
          const fieldMap = isW31 ? WMS31_MAP : isR5 ? RAPOR5_MAP : isRB ? REDBULL_MAP : SKU_MAP

          const score = headers.filter(h => fieldMap[h]).length
          if (score > bestScore) {
            bestScore = score
            headerRowIdx = i
            bestFormat = format
            bestFieldMap = fieldMap
          }
        }

        if (bestScore === 0) {
          reject(new Error(
            'Tanınan sütun bulunamadı. Lütfen RAPOR5.xls, Sku_Sayım_Listesi.xlsx, WMS Antrepo raporu (Kalan Stok Raporu / WMS_Rapor_31) veya WMS Depo Redbull raporu yükleyin.'
          ))
          return
        }

        const headerRow = rawArr[headerRowIdx]
        const colMap = buildColMap(headerRow, bestFieldMap)

        let rowNum = 0
        const rows = rawArr
          .slice(headerRowIdx + 1)        // başlık satırından sonraki satırlar
          .map(rowArr => {
            rowNum++
            return mapDataRow(rowArr, colMap, rowNum, bestFormat)
          })
          .filter(r => r.kod && String(r.kod).trim())

        resolve({ rows, format: bestFormat })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
