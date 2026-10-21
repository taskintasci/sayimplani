import { skuDogrulukSayilari } from './analizUtils'

// Not: sayım sonucu çıktılarında "Onay Durumu" hücresi `res.status` boşken
// miktar doluysa 'Sayıldı' olarak türetilir. 2026-09-01'den önce bu damgayı
// yalnızca sayımcı kartı yazıyordu (bkz. useStore.updateResult); o tarihten
// önce yönetici ekranından girilmiş satırlar Firestore'da durumsuz duruyor ve
// düzeltme geriye dönük veri güncellemesi yapmıyor — çıktıda burada telafi
// ediliyor.

// ── Sayım numarası damgası ─────────────────────────────────────────────────
// Oturuma bağlı her Excel evrakında (sonuç, mutabakat, analiz, log) her
// sayfanın EN ÜSTÜNE sayım no + künye satırı eklenir, dosya adı numarayla
// başlar. Sayfalar kendi düzenini (başlık satırı 1) kurduktan sonra, yazmadan
// hemen önce çağrılır; insertRow birleşik hücreleri ve stilleri aşağı kaydırır,
// dondurma ve otomatik filtre burada bir satır kaydırılır.
function sayimNoDamgala(workbook, session = {}) {
  const no = session?.sayimNo
  if (!no) return
  const tarih = session.tarih ? new Date(session.tarih).toLocaleDateString('tr-TR') : ''
  const kunye = [`SAYIM NO: ${no}`, session.type, session.depoAdi, tarih].filter(Boolean).join('   ·   ')
  workbook.title   = `Sayım ${no}`
  workbook.subject = kunye
  workbook.eachSheet(ws => {
    const sutun = Math.max(ws.columnCount, 1)
    ws.insertRow(1, [kunye])
    if (sutun > 1) ws.mergeCells(1, 1, 1, sutun)
    const c = ws.getCell(1, 1)
    c.font      = { bold: true, size: 11, color: { argb: 'FF1D4ED8' } }
    c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
    c.alignment = { vertical: 'middle', horizontal: 'left' }
    ws.getRow(1).height = 22
    ws.views = (ws.views || []).map(v => (v.state === 'frozen' ? { ...v, ySplit: (v.ySplit || 0) + 1 } : v))
    if (ws.autoFilter && typeof ws.autoFilter === 'object' && ws.autoFilter.from) {
      ws.autoFilter = {
        from: { ...ws.autoFilter.from, row: ws.autoFilter.from.row + 1 },
        to:   { ...ws.autoFilter.to,   row: ws.autoFilter.to.row + 1 },
      }
    }
    // Yazdırıldığında her kâğıt sayfasının üst bilgisinde de görünsün
    ws.headerFooter = { ...(ws.headerFooter || {}), oddHeader: `&L&8Sayım No: ${no}&R&8&P / &N` }
  })
}

const dosyaOnEki = (firma = {}, session = {}) =>
  `${session?.sayimNo ? session.sayimNo + '_' : ''}${firma.ad ? firma.ad + '_' : ''}`

export async function exportRaporFarklar(discrepancies, session, manualRows = [], firma = {}) {
  const { default: ExcelJS } = await import('exceljs')

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sayım Planı'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Mutabakat Raporu')

  ws.columns = [
    { header: 'Sıra No.',        key: 'siraNo',   width: 8  },
    { header: 'Kod',             key: 'kod',      width: 16 },
    { header: 'Ad',              key: 'ad',       width: 35 },
    { header: 'Adres',           key: 'adres',    width: 14 },
    { header: 'Parti',           key: 'parti',    width: 14 },
    { header: 'Statü',           key: 'durum',    width: 12 },
    { header: 'Sistem Mikt.',    key: 'sayim',    width: 14 },
    { header: 'Sayılan',         key: 'sayilan',  width: 14 },
    { header: 'Fark',            key: 'fark',     width: 12 },
    { header: 'Birim',           key: 'birim',    width: 8  },
    { header: 'Not',             key: 'not',      width: 25 },
  ]

  ws.getRow(1).eachCell(cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1C1E' } }
    cell.font      = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  ws.getRow(1).height = 18

  discrepancies.forEach((row, i) => {
    const sistem  = row.sayim  !== '' ? Number(String(row.sayim).replace(',', '.'))   : null
    const sayilan = row.sayilan !== undefined ? Number(String(row.sayilan).replace(',', '.')) : null
    const fark    = sayilan !== null && sistem !== null ? sayilan - sistem : null

    const wsRow = ws.addRow({
      siraNo: row.siraNo, kod: row.kod, ad: row.ad, adres: row.adres,
      parti: row.parti, durum: row.durum, sayim: sistem, sayilan, fark, birim: row.birim,
      not: row.not,
    })

    wsRow.eachCell(cell => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 1 ? 'FFF3F4F6' : 'FFFFFFFF' } }
      cell.alignment = { vertical: 'middle' }
    })
    const farkCell = wsRow.getCell('fark')
    farkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fark !== null && fark < 0 ? 'FFFFF3CD' : fark > 0 ? 'FFD4EDDA' : 'FFF3F4F6' } }
    farkCell.font = { bold: true, color: { argb: fark < 0 ? 'FF991B1B' : 'FF166534' } }
  })

  // ── Manuel eklenen kalemler (sistemde bulunmayan) ──────────────────────────
  if (manualRows.length > 0) {
    ws.addRow([])
    const sepRow = ws.addRow(['SİSTEMDE BULUNMAYAN KALEMLER (MANUEL EKLENDİ)'])
    sepRow.getCell(1).font      = { bold: true, size: 10, color: { argb: 'FF92400E' } }
    sepRow.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
    sepRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    ws.mergeCells(`A${sepRow.number}:K${sepRow.number}`)
    sepRow.height = 18

    manualRows.forEach((row, i) => {
      const miktar = parseFloat(row.miktar) || 0
      const wsRow  = ws.addRow({
        siraNo: i + 1, kod: row.kod, ad: row.ad, adres: row.adres,
        parti: row.parti, durum: row.durum, sayim: 0, sayilan: miktar, fark: miktar,
        birim: row.birim, not: row.not,
      })
      wsRow.eachCell(cell => {
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 1 ? 'FFFFF8E8' : 'FFFFFDF5' } }
        cell.alignment = { vertical: 'middle' }
      })
      wsRow.getCell('fark').font = { bold: true, color: { argb: 'FF166534' } }
    })
  }

  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const tarih = session?.tarih ? new Date(session.tarih).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  sayimNoDamgala(workbook, session)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `${dosyaOnEki(firma, session)}Mutabakat_Raporu_${tarih}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportAntrepoRaporFarklar(discrepancies, session, manualRows = [], firma = {}) {
  const { default: ExcelJS } = await import('exceljs')

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sayım Planı'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Mutabakat Raporu')

  ws.columns = [
    { header: 'Sıra No.',        key: 'siraNo',   width: 8  },
    { header: 'Stok Kodu',       key: 'kod',      width: 16 },
    { header: 'Stok Adı',        key: 'ad',       width: 35 },
    { header: 'Adres',           key: 'adres',    width: 14 },
    { header: 'Beyanname',       key: 'parti',    width: 20 },
    { header: 'Depo Kalan Stok', key: 'sayim',    width: 14 },
    { header: 'Sayılan',         key: 'sayilan',  width: 14 },
    { header: 'Fark',            key: 'fark',     width: 12 },
    { header: 'Birim Adı',       key: 'birim',    width: 8  },
    { header: 'Not',             key: 'not',      width: 25 },
  ]

  ws.getRow(1).eachCell(cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1C1E' } }
    cell.font      = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  ws.getRow(1).height = 18

  discrepancies.forEach((row, i) => {
    const sistem  = row.sayim  !== '' ? Number(String(row.sayim).replace(',', '.'))   : null
    const sayilan = row.sayilan !== undefined ? Number(String(row.sayilan).replace(',', '.')) : null
    const fark    = sayilan !== null && sistem !== null ? sayilan - sistem : null

    const wsRow = ws.addRow({
      siraNo: row.siraNo, kod: row.kod, ad: row.ad, adres: row.adres,
      parti: row.parti, sayim: sistem, sayilan, fark, birim: row.birim,
      not: row.not,
    })

    wsRow.eachCell(cell => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 1 ? 'FFF3F4F6' : 'FFFFFFFF' } }
      cell.alignment = { vertical: 'middle' }
    })
    const farkCell = wsRow.getCell('fark')
    farkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fark !== null && fark < 0 ? 'FFFFF3CD' : fark > 0 ? 'FFD4EDDA' : 'FFF3F4F6' } }
    farkCell.font = { bold: true, color: { argb: fark < 0 ? 'FF991B1B' : 'FF166534' } }
  })

  // ── Manuel eklenen kalemler (sistemde bulunmayan) ──────────────────────────
  if (manualRows.length > 0) {
    ws.addRow([])
    const sepRow = ws.addRow(['SİSTEMDE BULUNMAYAN KALEMLER (MANUEL EKLENDİ)'])
    sepRow.getCell(1).font      = { bold: true, size: 10, color: { argb: 'FF92400E' } }
    sepRow.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
    sepRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    ws.mergeCells(`A${sepRow.number}:J${sepRow.number}`)
    sepRow.height = 18

    manualRows.forEach((row, i) => {
      const miktar = parseFloat(row.miktar) || 0
      const wsRow  = ws.addRow({
        siraNo: i + 1, kod: row.kod, ad: row.ad, adres: row.adres,
        parti: row.parti, sayim: 0, sayilan: miktar, fark: miktar,
        birim: row.birim, not: row.not,
      })
      wsRow.eachCell(cell => {
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 1 ? 'FFFFF8E8' : 'FFFFFDF5' } }
        cell.alignment = { vertical: 'middle' }
      })
      wsRow.getCell('fark').font = { bold: true, color: { argb: 'FF166534' } }
    })
  }

  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const tarih = session?.tarih ? new Date(session.tarih).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  sayimNoDamgala(workbook, session)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `${dosyaOnEki(firma, session)}Mutabakat_Raporu_${tarih}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportAnalizi(rows, results, session, firma = {}) {
  const { default: ExcelJS } = await import('exceljs')

  // --- hesaplamalar ---
  const counted = rows.filter(r => results[r.id]?.miktar !== undefined && results[r.id]?.miktar !== '')
  const discrepancies = rows.filter(r => {
    const m = results[r.id]?.miktar
    return m !== undefined && m !== '' && String(m) !== String(r.sayim)
  })
  const hatasizLokasyon = counted.length - discrepancies.length
  const hataliLokasyon  = discrepancies.length

  const adresPct = counted.length > 0 ? +(hatasizLokasyon / counted.length * 100).toFixed(4) : 0

  const sistemToplam = rows.reduce((s, r) => s + (parseFloat(String(r.sayim).replace(',', '.')) || 0), 0)
  const fizikiToplam = rows.reduce((s, r) => {
    const m = results[r.id]?.miktar
    return s + (m !== undefined && m !== '' ? parseFloat(String(m).replace(',', '.')) || 0 : 0)
  }, 0)
  const stokFark     = fizikiToplam - sistemToplam
  const stokMuafiyet = sistemToplam * 0.001
  const stokPct      = sistemToplam > 0 ? +(fizikiToplam / sistemToplam * 100).toFixed(4) : 0
  const muafiyetKullanim = stokMuafiyet > 0 ? +(stokFark / stokMuafiyet / 1000 * 100).toFixed(4) : 0

  const { tamamlananSku, hatasizSku } = skuDogrulukSayilari(rows, results)
  const hataliSku = tamamlananSku - hatasizSku
  const skuPct    = tamamlananSku > 0 ? +(hatasizSku / tamamlananSku * 100).toFixed(4) : 0
  const genelPct  = +((adresPct + stokPct + skuPct) / 3).toFixed(4)

  // --- workbook ---
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sayım Planı'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Sayım Analizi')

  const DARK   = 'FF1A1C1E'
  const WHITE  = 'FFFFFFFF'
  const YELLOW = 'FFFFFF00'
  const RED    = 'FFFFE0E0'

  const headers = [
    { header: 'Depo Adı',                              key: 'depo',            width: 14 },
    { header: 'Müşteri Adı',                           key: 'musteri',         width: 14 },
    { header: 'Sayılan\nLokasyon',                     key: 'sayilan',         width: 12 },
    { header: 'Hatalı\nLokasyon',                      key: 'hatali',          width: 12 },
    { header: 'Hatasız\nLokasyon',                     key: 'hatasiz',         width: 12 },
    { header: 'Adres\nDoğruluk',                       key: 'adresPct',        width: 12 },
    { header: 'Toplam Sistem\nAdet/Kg/Litre',          key: 'sistem',          width: 20 },
    { header: 'Fiziki Sayılan\nAdet/Kg/Litre',         key: 'fiziki',          width: 20 },
    { header: 'Stok Sayım\nMuafiyeti * (%0,1)',        key: 'muafiyet',        width: 18 },
    { header: 'Stok Farkı',                            key: 'fark',            width: 16 },
    { header: 'Stok Muafiyeti\nKullanma Oranı',        key: 'muafiyetKull',    width: 18 },
    { header: 'Sayım\nDoğruluk',                       key: 'stokPct',         width: 12 },
    { header: 'Sayılan\nSKU',                          key: 'sayilanSku',      width: 10 },
    { header: 'Hatalı\nSKU',                           key: 'hataliSku',       width: 10 },
    { header: 'Hatasız\nSKU',                          key: 'hatasizSku',      width: 10 },
    { header: 'SKU Sayım\nDoğruluk Oranı',             key: 'skuPct',          width: 16 },
    { header: 'Sayım Genel\nDoğruluk',                 key: 'genelPct',        width: 14 },
  ]
  ws.columns = headers

  // başlık satırı
  const hRow = ws.getRow(1)
  hRow.height = 30
  hRow.eachCell(cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } }
    cell.font      = { color: { argb: WHITE }, bold: true, size: 9 }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border    = { bottom: { style: 'thin', color: { argb: 'FF444444' } } }
  })

  // veri satırı
  const dataRow = ws.addRow({
    depo:         session.depoAdi   || '',
    musteri:      session.musteriAdi || firma.ad || '',
    sayilan:      counted.length,
    hatali:       hataliLokasyon,
    hatasiz:      hatasizLokasyon,
    adresPct:     adresPct / 100,
    sistem:       sistemToplam,
    fiziki:       fizikiToplam,
    muafiyet:     stokMuafiyet,
    fark:         stokFark,
    muafiyetKull: muafiyetKullanim / 100,
    stokPct:      stokPct / 100,
    sayilanSku:   tamamlananSku,
    hataliSku:    hataliSku,
    hatasizSku:   hatasizSku,
    skuPct:       skuPct / 100,
    genelPct:     genelPct / 100,
  })
  dataRow.height = 22
  dataRow.eachCell({ includeEmpty: true }, cell => {
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border    = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
  })

  // sayı formatları
  const pctFmt  = '0.00%'
  const numFmt  = '#,##0.000'
  const intFmt  = '#,##0'
  ;['adresPct','stokPct','skuPct','genelPct','muafiyetKull'].forEach(k => {
    dataRow.getCell(headers.findIndex(h => h.key === k) + 1).numFmt = pctFmt
  })
  ;['sistem','fiziki','muafiyet','fark'].forEach(k => {
    dataRow.getCell(headers.findIndex(h => h.key === k) + 1).numFmt = numFmt
  })
  ;['sayilan','hatali','hatasiz','sayilanSku','hataliSku','hatasizSku'].forEach(k => {
    dataRow.getCell(headers.findIndex(h => h.key === k) + 1).numFmt = intFmt
  })

  // sarı vurgu: Adres%, SKU%, Genel%
  ;['adresPct','skuPct','genelPct'].forEach(k => {
    const cell = dataRow.getCell(headers.findIndex(h => h.key === k) + 1)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } }
    cell.font = { bold: true, size: 10 }
  })
  // kırmızı vurgu: Stok Farkı (negatifse)
  if (stokFark < 0) {
    const farkCell = dataRow.getCell(headers.findIndex(h => h.key === 'fark') + 1)
    farkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } }
    farkCell.font = { bold: true, color: { argb: 'FF990000' }, size: 10 }
  }

  // dipnot
  ws.addRow([])
  const noteRow = ws.addRow(['(*) Sözleşme Gereği Sayım muafiyeti toplam stok oranının %0,1\'idir.'])
  noteRow.getCell(1).font      = { italic: true, size: 9, color: { argb: 'FF666666' } }
  noteRow.getCell(1).alignment = { horizontal: 'left' }
  ws.mergeCells(`A${noteRow.number}:Q${noteRow.number}`)

  ws.views = [{ state: 'frozen', ySplit: 1 }]

  sayimNoDamgala(workbook, session)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `${dosyaOnEki(firma, session)}Sayim_Analizi_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportResults(rows, results, session, firma = {}, manualRows = []) {
  const { default: ExcelJS } = await import('exceljs')

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sayım Planı'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Sayım Sonuçları')

  ws.columns = [
    { header: 'Sıra No.',     key: 'siraNo',   width: 8 },
    { header: 'Adres',        key: 'adres',    width: 14 },
    { header: 'Kod',          key: 'kod',      width: 16 },
    { header: 'Ad',           key: 'ad',       width: 35 },
    { header: 'Parti',        key: 'parti',    width: 14 },
    { header: 'Statü',        key: 'durum',    width: 10 },
    { header: 'Adet1',        key: 'adet1',    width: 8 },
    { header: 'Ambalaj',      key: 'ambalaj',  width: 12 },
    { header: 'Sistem Mikt.', key: 'sayim',    width: 12 },
    { header: 'Sayılan',      key: 'sayilan',  width: 12 },
    { header: 'Fark',         key: 'fark',     width: 10 },
    { header: 'Birim',        key: 'birim',    width: 8 },
    { header: 'Durum',        key: 'status',   width: 12 },
    { header: 'Not',          key: 'notlar',   width: 25 },
  ]

  ws.getRow(1).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1C1E' } }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  ws.getRow(1).height = 18

  rows.forEach((row, i) => {
    const res    = results[row.id] || {}
    const sayilan = res.miktar !== undefined && res.miktar !== '' ? Number(res.miktar) : null
    const sistem  = row.sayim !== '' ? Number(String(row.sayim).replace(',', '.')) : null
    const fark    = sayilan !== null && sistem !== null ? sayilan - sistem : null

    const wsRow = ws.addRow({
      siraNo: row.siraNo, adres: row.adres, kod: row.kod, ad: row.ad,
      parti: row.parti, durum: row.durum, adet1: row.adet1, ambalaj: row.ambalaj,
      sayim: sistem, sayilan, fark, birim: row.birim,
      status: res.status || (sayilan !== null ? 'Sayıldı' : ''), notlar: res.notlar || '',
    })

    const rowNum = wsRow.number
    if (fark !== null && fark !== 0) {
      ws.getRow(rowNum).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }
      })
    } else if (res.status === 'Onaylandı') {
      ws.getRow(rowNum).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } }
      })
    } else if (i % 2 === 1) {
      ws.getRow(rowNum).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
      })
    }
  })

  appendManualSection(ws, manualRows, (row, i, miktar) => ({
    siraNo: i + 1, adres: row.adres, kod: row.kod, ad: row.ad,
    parti: row.parti, durum: row.durum, adet1: '', ambalaj: '',
    sayim: 0, sayilan: miktar, fark: miktar, birim: row.birim,
    status: '', notlar: row.not,
  }))

  ws.views = [{ state: 'frozen', ySplit: 1 }]

  sayimNoDamgala(workbook, session)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `${dosyaOnEki(firma, session)}Sayim_Sonuclari_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

// Sayım sonucu Excel'lerinin EN SONUNA "sistemde bulunmayan" manuel kalemleri
// ekler (Panel'den alınan çıktılarda kullanılıyor). Mutabakat raporundaki
// (exportRaporFarklar vb.) aynı desenin paylaşılan hali; her şablonun sütun
// anahtarları farklı olduğu için satır nesnesini `mapper` üretir.
function appendManualSection(ws, manualRows, mapper) {
  if (!manualRows || manualRows.length === 0) return

  ws.addRow([])
  const sepRow = ws.addRow(['SİSTEMDE BULUNMAYAN KALEMLER (MANUEL EKLENDİ)'])
  sepRow.getCell(1).font      = { bold: true, size: 10, color: { argb: 'FF92400E' } }
  sepRow.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
  sepRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
  ws.mergeCells(sepRow.number, 1, sepRow.number, ws.columns.length)
  sepRow.height = 18

  manualRows.forEach((row, i) => {
    const miktar = parseFloat(row.miktar) || 0
    const wsRow  = ws.addRow(mapper(row, i, miktar))
    wsRow.eachCell(cell => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 1 ? 'FFFFF8E8' : 'FFFFFDF5' } }
      cell.alignment = { vertical: 'middle' }
    })
    wsRow.getCell('fark').font = { bold: true, color: { argb: 'FF166534' } }
  })
}

function downloadWorkbook(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportSkuMasterdataTemplate() {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sayım Planı'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('SKU Masterdata')
  ws.columns = [
    { header: 'Kod',   key: 'kod',   width: 20 },
    { header: 'Ad',    key: 'ad',    width: 40 },
    { header: 'Birim', key: 'birim', width: 12 },
  ]
  ws.getRow(1).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1C1E' } }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  ws.getRow(1).height = 18
  ws.addRow({ kod: 'ORNEK001', ad: 'Örnek Ürün Adı', birim: 'KG' })
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await workbook.xlsx.writeBuffer()
  downloadWorkbook(buffer, 'SKU_Masterdata_Sablon.xlsx')
}

export async function exportLokasyonMasterdataTemplate() {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sayım Planı'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Lokasyonlar')
  ws.columns = [{ header: 'Lokasyon', key: 'lokasyon', width: 20 }]
  ws.getRow(1).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1C1E' } }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  ws.getRow(1).height = 18
  ws.addRow({ lokasyon: '1-A-01-1' })
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await workbook.xlsx.writeBuffer()
  downloadWorkbook(buffer, 'Lokasyon_Sablon.xlsx')
}

export async function exportAntrepoResults(rows, results, session, firma = {}, manualRows = []) {
  const { default: ExcelJS } = await import('exceljs')

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sayım Planı'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Sayım Sonuçları')

  ws.columns = [
    { header: 'Sıra No.',        key: 'siraNo',       width: 8  },
    { header: 'Adres',           key: 'adres',        width: 14 },
    { header: 'Stok Kodu',       key: 'kod',          width: 16 },
    { header: 'Stok Adı',        key: 'ad',           width: 35 },
    { header: 'Beyanname',       key: 'parti',        width: 20 },
    { header: 'Statü',           key: 'durum',        width: 10 },
    { header: 'Kategori',        key: 'kategori',     width: 14 },
    { header: 'Palet Barkodu',   key: 'paletBarkodu', width: 22 },
    { header: 'Palet Adeti',     key: 'paletAdeti',   width: 10 },
    { header: 'Toplam Stok',     key: 'adet1',        width: 12 },
    { header: 'Rezerve Adet',    key: 'rezerveAdet',  width: 12 },
    { header: 'Depo Kalan Stok', key: 'sayim',        width: 14 },
    { header: 'Sayılan',         key: 'sayilan',      width: 12 },
    { header: 'Fark',            key: 'fark',         width: 10 },
    { header: 'Birim Adı',       key: 'birim',        width: 8  },
    { header: 'Onay Durumu',     key: 'status',       width: 12 },
    { header: 'Not',             key: 'notlar',       width: 25 },
  ]

  ws.getRow(1).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1C1E' } }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  ws.getRow(1).height = 18

  rows.forEach((row, i) => {
    const res    = results[row.id] || {}
    const sayilan = res.miktar !== undefined && res.miktar !== '' ? Number(res.miktar) : null
    const sistem  = row.sayim !== '' ? Number(String(row.sayim).replace(',', '.')) : null
    const fark    = sayilan !== null && sistem !== null ? sayilan - sistem : null

    const wsRow = ws.addRow({
      siraNo: row.siraNo, adres: row.adres, kod: row.kod, ad: row.ad,
      parti: row.parti, durum: row.durum, kategori: row.kategori,
      paletBarkodu: row.paletBarkodu, paletAdeti: row.paletAdeti,
      adet1: row.adet1, rezerveAdet: row.rezerveAdet,
      sayim: sistem, sayilan, fark, birim: row.birim,
      status: res.status || (sayilan !== null ? 'Sayıldı' : ''), notlar: res.notlar || '',
    })

    const rowNum = wsRow.number
    if (fark !== null && fark !== 0) {
      ws.getRow(rowNum).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }
      })
    } else if (res.status === 'Onaylandı') {
      ws.getRow(rowNum).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } }
      })
    } else if (i % 2 === 1) {
      ws.getRow(rowNum).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
      })
    }
  })

  appendManualSection(ws, manualRows, (row, i, miktar) => ({
    siraNo: i + 1, adres: row.adres, kod: row.kod, ad: row.ad,
    parti: row.parti, durum: row.durum, kategori: '',
    paletBarkodu: '', paletAdeti: '',
    adet1: '', rezerveAdet: '',
    sayim: 0, sayilan: miktar, fark: miktar, birim: row.birim,
    status: '', notlar: row.not,
  }))

  ws.views = [{ state: 'frozen', ySplit: 1 }]

  sayimNoDamgala(workbook, session)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `${dosyaOnEki(firma, session)}Sayim_Sonuclari_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportRedbullRaporFarklar(discrepancies, session, manualRows = [], firma = {}) {
  const { default: ExcelJS } = await import('exceljs')

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sayım Planı'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Mutabakat Raporu')

  ws.columns = [
    { header: 'Sıra No.',     key: 'siraNo',     width: 8  },
    { header: 'Stok Kodu',    key: 'kod',        width: 16 },
    { header: 'Stok Adı',     key: 'ad',         width: 35 },
    { header: 'SSCC',         key: 'sscc',       width: 22 },
    { header: 'Lot',          key: 'parti',      width: 16 },
    { header: 'SKT',          key: 'skt',        width: 12 },
    { header: 'Alisan Statu', key: 'durum',      width: 18 },
    { header: 'Palet Adeti',  key: 'paletAdeti', width: 12 },
    { header: 'Adres',        key: 'adres',      width: 16 },
    { header: 'Sistem',       key: 'sayim',      width: 14 },
    { header: 'Sayılan',      key: 'sayilan',    width: 14 },
    { header: 'Fark',         key: 'fark',       width: 12 },
    { header: 'Birim',        key: 'birim',      width: 8  },
    { header: 'Not',          key: 'not',        width: 25 },
  ]

  ws.getRow(1).eachCell(cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1C1E' } }
    cell.font      = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  ws.getRow(1).height = 18

  discrepancies.forEach((row, i) => {
    const sistem  = row.sayim  !== '' ? Number(String(row.sayim).replace(',', '.'))   : null
    const sayilan = row.sayilan !== undefined ? Number(String(row.sayilan).replace(',', '.')) : null
    const fark    = sayilan !== null && sistem !== null ? sayilan - sistem : null

    const wsRow = ws.addRow({
      siraNo: row.siraNo, kod: row.kod, ad: row.ad, sscc: row.sscc, adres: row.adres,
      parti: row.parti, skt: row.skt, durum: row.durum, paletAdeti: row.paletAdeti,
      sayim: sistem, sayilan, fark, birim: row.birim, not: row.not,
    })

    wsRow.eachCell(cell => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 1 ? 'FFF3F4F6' : 'FFFFFFFF' } }
      cell.alignment = { vertical: 'middle' }
    })
    const farkCell = wsRow.getCell('fark')
    farkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fark !== null && fark < 0 ? 'FFFFF3CD' : fark > 0 ? 'FFD4EDDA' : 'FFF3F4F6' } }
    farkCell.font = { bold: true, color: { argb: fark < 0 ? 'FF991B1B' : 'FF166534' } }
  })

  // ── Manuel eklenen kalemler (sistemde bulunmayan) ──────────────────────────
  if (manualRows.length > 0) {
    ws.addRow([])
    const sepRow = ws.addRow(['SİSTEMDE BULUNMAYAN KALEMLER (MANUEL EKLENDİ)'])
    sepRow.getCell(1).font      = { bold: true, size: 10, color: { argb: 'FF92400E' } }
    sepRow.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
    sepRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    ws.mergeCells(sepRow.number, 1, sepRow.number, ws.columns.length)
    sepRow.height = 18

    manualRows.forEach((row, i) => {
      const miktar = parseFloat(row.miktar) || 0
      const wsRow  = ws.addRow({
        siraNo: i + 1, kod: row.kod, ad: row.ad, sscc: row.sscc, adres: row.adres,
        parti: row.parti, skt: row.skt, durum: row.durum, sayim: 0, sayilan: miktar, fark: miktar,
        birim: row.birim, not: row.not,
      })
      wsRow.eachCell(cell => {
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 1 ? 'FFFFF8E8' : 'FFFFFDF5' } }
        cell.alignment = { vertical: 'middle' }
      })
      wsRow.getCell('fark').font = { bold: true, color: { argb: 'FF166534' } }
    })
  }

  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const tarih = session?.tarih ? new Date(session.tarih).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  sayimNoDamgala(workbook, session)
  const buffer = await workbook.xlsx.writeBuffer()
  downloadWorkbook(buffer, `${dosyaOnEki(firma, session)}Mutabakat_Raporu_${tarih}.xlsx`)
}

export async function exportRedbullResults(rows, results, session, firma = {}, manualRows = []) {
  const { default: ExcelJS } = await import('exceljs')

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sayım Planı'
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Sayım Sonuçları')

  ws.columns = [
    { header: 'Sıra No.',     key: 'siraNo',     width: 8  },
    { header: 'Adres',        key: 'adres',      width: 16 },
    { header: 'Stok Kodu',    key: 'kod',        width: 16 },
    { header: 'Stok Adı',     key: 'ad',         width: 35 },
    { header: 'SSCC',         key: 'sscc',       width: 22 },
    { header: 'Lot',          key: 'parti',      width: 16 },
    { header: 'SKT',          key: 'skt',        width: 12 },
    { header: 'Alisan Statu', key: 'durum',      width: 18 },
    { header: 'Palet Adeti',  key: 'paletAdeti', width: 12 },
    { header: 'Sistem',       key: 'sayim',      width: 14 },
    { header: 'Sayılan',      key: 'sayilan',    width: 12 },
    { header: 'Fark',         key: 'fark',       width: 10 },
    { header: 'Birim',        key: 'birim',      width: 8  },
    { header: 'Onay Durumu',  key: 'status',     width: 12 },
    { header: 'Not',          key: 'notlar',     width: 25 },
  ]

  ws.getRow(1).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1C1E' } }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  ws.getRow(1).height = 18

  rows.forEach((row, i) => {
    const res    = results[row.id] || {}
    const sayilan = res.miktar !== undefined && res.miktar !== '' ? Number(res.miktar) : null
    const sistem  = row.sayim !== '' ? Number(String(row.sayim).replace(',', '.')) : null
    const fark    = sayilan !== null && sistem !== null ? sayilan - sistem : null

    const wsRow = ws.addRow({
      siraNo: row.siraNo, adres: row.adres, kod: row.kod, ad: row.ad, sscc: row.sscc,
      parti: row.parti, skt: row.skt, durum: row.durum, paletAdeti: row.paletAdeti,
      sayim: sistem, sayilan, fark, birim: row.birim,
      status: res.status || (sayilan !== null ? 'Sayıldı' : ''), notlar: res.notlar || '',
    })

    const rowNum = wsRow.number
    if (fark !== null && fark !== 0) {
      ws.getRow(rowNum).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }
      })
    } else if (res.status === 'Onaylandı') {
      ws.getRow(rowNum).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } }
      })
    } else if (i % 2 === 1) {
      ws.getRow(rowNum).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
      })
    }
  })

  appendManualSection(ws, manualRows, (row, i, miktar) => ({
    siraNo: i + 1, adres: row.adres, kod: row.kod, ad: row.ad, sscc: row.sscc,
    parti: row.parti, skt: row.skt, durum: row.durum, paletAdeti: '',
    sayim: 0, sayilan: miktar, fark: miktar, birim: row.birim,
    status: '', notlar: row.not,
  }))

  ws.views = [{ state: 'frozen', ySplit: 1 }]

  sayimNoDamgala(workbook, session)
  const buffer = await workbook.xlsx.writeBuffer()
  downloadWorkbook(buffer, `${dosyaOnEki(firma, session)}Redbull_Sayim_Sonuclari_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ── Sayım işlem logu (denetim) ─────────────────────────────────────────────
// Kaynak: sessions/{id}/sayimLog (useStore.updateResult / fillFromSistem /
// clearMiktarlar / add*ManualRow yazar). Amaç, sayımcının kalemleri gerçekten
// sayıp saymadığını görmek: kart modundaki "Onayla" sistem miktarını tek
// dokunuşla yazdığı için, art arda birkaç saniye arayla gelen onaylar
// fiziksel sayım yapılmadığına işaret eder.
const HIZLI_ONAY_SN = 3          // bundan kısa aralıkla gelen "Onayla" = hızlı onay
const MOLA_SN       = 10 * 60    // bundan uzun ara aktif süreye sayılmaz (mola/yürüme dışı)

const LOG_EYLEM = {
  onayla:          'Onayla (sistem miktarı)',
  duzenle:         'Eksik/Fazla (elle miktar)',
  elle:            'Tablodan miktar girişi',
  sil:             'Miktar silindi',
  geriAl:          'Geri Al',
  sistemdenDoldur: 'Sistemden Doldur (toplu)',
  topluTemizle:    'Toplu Temizle',
  manuelEkle:      'Manuel fazla stok',
}
const LOG_EKRAN = { kart: 'Sayımcı kartı', liste: 'Sayımcı listesi', tablo: 'Sayım tablosu', manuel: 'Manuel ekleme' }
const LOG_ROL   = { sayimci: 'Sayımcı', yonetici: 'Yönetici', superadmin: 'Süper Yönetici', kontrolcu: 'Kontrolcü' }
const SAYIM_EYLEMLERI = new Set(['onayla', 'duzenle', 'elle'])

const logSayi = v => {
  if (v === undefined || v === null || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

// ExcelJS tarihi UTC olarak yazar; Excel'de cihazın yerel saati görünsün diye kaydırılır.
const excelTarih = d => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000) : null)

function styleHeader(ws) {
  ws.getRow(1).eachCell(cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1C1E' } }
    cell.font      = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  ws.getRow(1).height = 30
}

export async function exportSayimLogu(logs, rows, session, firma = {}) {
  const { default: ExcelJS } = await import('exceljs')
  const rowMap = new Map(rows.map(r => [r.id, r]))

  // Kullanıcı bazında, cihaz zamanına göre sıralı akış → önceki işlemden geçen süre
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

  // ── Özet ──
  const ozet = new Map()
  detay.forEach(l => {
    if (!ozet.has(l.uid)) {
      ozet.set(l.uid, {
        ad: l.ad, rol: l.rol, toplam: 0, kalemler: new Set(), onayla: 0, elle: 0, farkli: 0,
        geriAl: 0, sil: 0, toplu: 0, manuel: 0, hizli: 0, ilk: null, son: null, aktifSn: 0, araliklar: [],
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

  const medyan = arr => {
    if (arr.length === 0) return null
    const s = [...arr].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sayım Planı'
  workbook.created = new Date()

  const ws1 = workbook.addWorksheet('Sayımcı Özeti')
  ws1.columns = [
    { header: 'Kullanıcı',                       key: 'ad',       width: 24 },
    { header: 'Rol',                             key: 'rol',      width: 13 },
    { header: 'Toplam İşlem',                    key: 'toplam',   width: 10 },
    { header: 'Sayılan Kalem',                   key: 'kalem',    width: 10 },
    { header: 'Onayla (sistem miktarı)',         key: 'onayla',   width: 13 },
    { header: 'Elle Miktar Girişi',              key: 'elle',     width: 12 },
    { header: 'Sistemden Farklı Girilen',        key: 'farkli',   width: 13 },
    { header: 'Onay Oranı %',                    key: 'onayPct',  width: 10 },
    { header: `Hızlı Onay (<${HIZLI_ONAY_SN} sn)`, key: 'hizli',  width: 12 },
    { header: 'Hızlı Onay %',                    key: 'hizliPct', width: 10 },
    { header: 'Medyan İşlem Arası (sn)',         key: 'medyan',   width: 12 },
    { header: 'Aktif Süre (dk)',                 key: 'aktifDk',  width: 10 },
    { header: 'Geri Al',                         key: 'geriAl',   width: 8  },
    { header: 'Silinen Miktar',                  key: 'sil',      width: 9  },
    { header: 'Sistemden Doldur (kalem)',        key: 'toplu',    width: 12 },
    { header: 'Manuel Ekleme',                   key: 'manuel',   width: 9  },
    { header: 'İlk İşlem',                       key: 'ilk',      width: 17 },
    { header: 'Son İşlem',                       key: 'son',      width: 17 },
    { header: 'Değerlendirme',                   key: 'uyari',    width: 48 },
  ]
  styleHeader(ws1)

  ;[...ozet.values()]
    .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'))
    .forEach(o => {
      const sayimIslem = o.onayla + o.elle
      const onayPct  = sayimIslem > 0 ? Math.round(o.onayla / sayimIslem * 100) : null
      const hizliPct = o.onayla > 0 ? Math.round(o.hizli / o.onayla * 100) : null
      const uyarilar = []
      if (hizliPct !== null && hizliPct >= 30 && o.hizli >= 5) uyarilar.push(`Hızlı onay oranı %${hizliPct} (${HIZLI_ONAY_SN} sn'den kısa aralık)`)
      if (onayPct !== null && onayPct >= 98 && sayimIslem >= 20) uyarilar.push('Sistem miktarı neredeyse hep aynen onaylanmış')
      if (o.toplu > 0) uyarilar.push(`${o.toplu} kalem "Sistemden Doldur" ile dolduruldu`)

      const wsRow = ws1.addRow({
        ad: o.ad, rol: LOG_ROL[o.rol] || o.rol, toplam: o.toplam, kalem: o.kalemler.size,
        onayla: o.onayla, elle: o.elle, farkli: o.farkli, onayPct, hizli: o.hizli, hizliPct,
        medyan: medyan(o.araliklar), aktifDk: Math.round(o.aktifSn / 60),
        geriAl: o.geriAl, sil: o.sil, toplu: o.toplu, manuel: o.manuel,
        ilk: excelTarih(o.ilk), son: excelTarih(o.son), uyari: uyarilar.join(' · ') || '—',
      })
      wsRow.getCell('ilk').numFmt = 'dd.mm.yyyy hh:mm:ss'
      wsRow.getCell('son').numFmt = 'dd.mm.yyyy hh:mm:ss'
      wsRow.getCell('uyari').alignment = { wrapText: true, vertical: 'middle' }
      if (uyarilar.length > 0) {
        wsRow.getCell('uyari').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }
        wsRow.getCell('uyari').font = { bold: true, color: { argb: 'FF991B1B' } }
      }
    })

  ws1.addRow([])
  ;[
    `Oturum: ${session.type || ''}${session.depoAdi ? ' · ' + session.depoAdi : ''}${session.tarih ? ' · ' + new Date(session.tarih).toLocaleDateString('tr-TR') : ''}`,
    '"Onayla": sayımcı kartında sistem miktarını tek dokunuşla kabul etme. "Elle miktar": Eksik/Fazla ekranından veya tablodan miktar yazma.',
    `"Hızlı Onay": aynı kullanıcının bir önceki işleminden ${HIZLI_ONAY_SN} saniyeden kısa süre sonra gelen Onayla — o sürede fiziksel sayım yapılmış olması zordur.`,
    `"Aktif Süre": ardışık işlemler arasındaki süreler toplamı (${MOLA_SN / 60} dk'dan uzun aralar mola sayılıp dışarıda bırakılır).`,
    'Zamanlar işlemin yapıldığı cihazın saatidir; çevrimdışı yapılan işlemler sunucuya sonradan ulaşır (İşlem Logu → Sunucu Zamanı).',
    'Log, bu özelliğin devreye alındığı tarihten sonraki işlemleri içerir; daha önceki girişler görünmez.',
  ].forEach(t => {
    const r = ws1.addRow([t])
    r.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF475569' } }
    ws1.mergeCells(r.number, 1, r.number, ws1.columns.length)
  })
  ws1.views = [{ state: 'frozen', ySplit: 1 }]

  // ── Detay ──
  const ws2 = workbook.addWorksheet('İşlem Logu')
  ws2.columns = [
    { header: 'İşlem Zamanı (cihaz)',   key: 'zaman',  width: 19 },
    { header: 'Sunucu Zamanı',          key: 'sunucu', width: 19 },
    { header: 'Kullanıcı',              key: 'ad',     width: 22 },
    { header: 'Rol',                    key: 'rol',    width: 12 },
    { header: 'İşlem',                  key: 'eylem',  width: 24 },
    { header: 'Ekran',                  key: 'ekran',  width: 16 },
    { header: 'Adres',                  key: 'adres',  width: 14 },
    { header: 'Kod',                    key: 'kod',    width: 16 },
    { header: 'Ad',                     key: 'malzeme', width: 32 },
    { header: 'Sistem',                 key: 'sistem', width: 10 },
    { header: 'Önceki',                 key: 'onceki', width: 10 },
    { header: 'Yeni',                   key: 'yeni',   width: 10 },
    { header: 'Fark (Yeni−Sistem)',     key: 'fark',   width: 11 },
    { header: 'Önceki İşlemden (sn)',   key: 'araSn',  width: 11 },
    { header: 'Uyarı',                  key: 'uyari',  width: 16 },
  ]
  styleHeader(ws2)

  detay.forEach((l, i) => {
    const toplu = l.eylem === 'sistemdenDoldur' || l.eylem === 'topluTemizle'
    const wsRow = ws2.addRow({
      zaman: excelTarih(l.istemciZamani), sunucu: excelTarih(l.sunucuZamani), ad: l.ad, rol: LOG_ROL[l.rol] || l.rol,
      eylem: LOG_EYLEM[l.eylem] || l.eylem, ekran: LOG_EKRAN[l.ekran] || l.ekran || '',
      adres: toplu ? `${l.adet || 0} kalem` : l.adres, kod: l.kod || '',
      malzeme: rowMap.get(l.rowId)?.ad || '',
      sistem: l.sistem, onceki: logSayi(l.oncekiMiktar), yeni: l.yeni, fark: l.fark,
      araSn: l.araSn, uyari: l.hizli ? 'Hızlı onay' : toplu ? 'Toplu işlem' : '',
    })
    wsRow.getCell('zaman').numFmt  = 'dd.mm.yyyy hh:mm:ss'
    wsRow.getCell('sunucu').numFmt = 'dd.mm.yyyy hh:mm:ss'
    const renk = l.hizli || toplu ? 'FFFFF3CD' : i % 2 === 1 ? 'FFF3F4F6' : null
    if (renk) wsRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: renk } } })
    if (l.hizli || toplu) wsRow.getCell('uyari').font = { bold: true, color: { argb: 'FF991B1B' } }
  })
  ws2.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws2.columns.length } }
  ws2.views = [{ state: 'frozen', ySplit: 1 }]

  sayimNoDamgala(workbook, session)
  const buffer = await workbook.xlsx.writeBuffer()
  downloadWorkbook(buffer, `${dosyaOnEki(firma, session)}Sayim_Logu_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ── Geriye dönük sayım denetimi (sayimLog OLMAYAN eski oturumlar) ──────────
// sayimLog koleksiyonu 2026-10-21'de eklendi; daha eski oturumlarda elde
// kalan iz: results/{rowId}.updatedBy/updatedAt (satıra SON yazan + zamanı)
// ve sayimciGorevler (atanan kalemler, gönderilme/bitiş zamanı).
// Sınırlar (çıktıya da yazılır):
//  - Her satır için yalnız SON giriş bilinir, "Onayla mı / elle mi" bilinmez;
//    yerine "sayılan = sistem" oranı kullanılır.
//  - 2026-10-21 öncesi mutabakat onayı (approveSession) sayılan satırların
//    updatedBy/updatedAt'ini onaylayanla ezdi → 'Onaylandı' satırlarda (yeni
//    `onaylayan` alanı yoksa) kişi/zaman güvenilmez, kişi analizine girmez.
//  - updatedAt sunucu zamanıdır; çevrimdışı girilip toplu senkronlanan satırlar
//    aynı saniyelere yığılır ve "hızlı" görünebilir.
const tsDate = v => (v?.toDate ? v.toDate() : v instanceof Date ? v : v?.seconds ? new Date(v.seconds * 1000) : null)

export async function exportGeriyeDonukLog({ rows, results, gorevler = [], users = [], session = {}, firma = {} }) {
  const { default: ExcelJS } = await import('exceljs')

  const adMap = new Map()
  users.forEach(u => adMap.set(u.uid, u.displayName || u.email || u.uid))
  gorevler.forEach(g => { if (g.sayimciUid && !adMap.has(g.sayimciUid)) adMap.set(g.sayimciUid, g.sayimciAd || g.sayimciEmail) })
  const kisi = uid => (uid ? adMap.get(uid) || `(${String(uid).slice(0, 6)}…)` : '—')

  const sayildi = id => { const m = results[id]?.miktar; return m !== undefined && m !== '' }
  const ayni = r => {
    const s = logSayi(r.sayim), m = logSayi(results[r.id]?.miktar)
    return s !== null && m !== null && s === m
  }
  // Satır → atandığı görev(ler)in sayımcısı
  const atananKisi = new Map()
  gorevler.forEach(g => {
    const ids = (g.atananRows || []).length > 0 ? g.atananRows : rows.map(r => r.id)
    ids.forEach(id => {
      const l = atananKisi.get(id) || []
      if (!l.includes(g.sayimciUid)) l.push(g.sayimciUid)
      atananKisi.set(id, l)
    })
  })
  const izGuvenilir = res => res.status !== 'Onaylandı' || !!res.onaylayan

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sayım Planı'
  workbook.created = new Date()

  // ── 1) Görev Özeti ──
  const ws1 = workbook.addWorksheet('Görev Özeti')
  ws1.columns = [
    { header: 'Sayımcı',               key: 'ad',      width: 24 },
    { header: 'Sayım Tipi',            key: 'tip',     width: 14 },
    { header: 'Kapsam / Filtre',       key: 'filtre',  width: 30 },
    { header: 'Atanan Kalem',          key: 'atanan',  width: 10 },
    { header: 'Sayılan Kalem',         key: 'sayilan', width: 10 },
    { header: 'Sistemle Aynı (kalem)', key: 'ayni',    width: 11 },
    { header: 'Sistemle Aynı %',       key: 'ayniPct', width: 10 },
    { header: 'Farklı Girilen',        key: 'farkli',  width: 10 },
    { header: 'Görev Durumu',          key: 'durum',   width: 12 },
    { header: 'Gönderilme',            key: 'basla',   width: 17 },
    { header: 'Bitiş',                 key: 'bitis',   width: 17 },
    { header: 'Süre (dk)',             key: 'sureDk',  width: 9  },
    { header: 'Kalem Başına (sn)',     key: 'snKalem', width: 10 },
    { header: 'Değerlendirme',         key: 'uyari',   width: 48 },
  ]
  styleHeader(ws1)
  ;[...gorevler]
    .sort((a, b) => (tsDate(a.createdAt) || 0) - (tsDate(b.createdAt) || 0))
    .forEach(g => {
      const ids = (g.atananRows || []).length > 0 ? g.atananRows : rows.map(r => r.id)
      const gRows = rows.filter(r => ids.includes(r.id))
      const sayilan = gRows.filter(r => sayildi(r.id))
      const ayniSay = sayilan.filter(ayni).length
      const ayniPct = sayilan.length > 0 ? Math.round(ayniSay / sayilan.length * 100) : null
      const basla = tsDate(g.createdAt), bitis = tsDate(g.tamamlanmaZamani)
      const sureSn = basla && bitis ? Math.max(0, (bitis - basla) / 1000) : null
      const snKalem = sureSn !== null && sayilan.length > 0 ? Math.round(sureSn / sayilan.length) : null
      const uyarilar = []
      if (snKalem !== null && snKalem < 10 && sayilan.length >= 20) uyarilar.push(`Kalem başına ${snKalem} sn — fiziksel sayım için çok kısa`)
      if (ayniPct !== null && ayniPct >= 98 && sayilan.length >= 20) uyarilar.push('Sayılan miktar neredeyse hep sistemle aynı')
      if (!bitis) uyarilar.push('Bitiş zamanı yok (görev bitmemiş veya 01.09.2026 öncesi)')
      const wsRow = ws1.addRow({
        ad: g.sayimciAd || kisi(g.sayimciUid), tip: g.sayimTipi, filtre: g.filtreOzeti || (g.atananRows?.length ? '' : 'Tüm oturum'),
        atanan: gRows.length, sayilan: sayilan.length, ayni: ayniSay, ayniPct, farkli: sayilan.length - ayniSay,
        durum: g.durum, basla: excelTarih(basla), bitis: excelTarih(bitis),
        sureDk: sureSn !== null ? Math.round(sureSn / 60) : null, snKalem, uyari: uyarilar.join(' · ') || '—',
      })
      wsRow.getCell('basla').numFmt = 'dd.mm.yyyy hh:mm'
      wsRow.getCell('bitis').numFmt = 'dd.mm.yyyy hh:mm'
      wsRow.getCell('uyari').alignment = { wrapText: true, vertical: 'middle' }
      if (uyarilar.some(u => !u.startsWith('Bitiş'))) {
        wsRow.getCell('uyari').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }
        wsRow.getCell('uyari').font = { bold: true, color: { argb: 'FF991B1B' } }
      }
    })
  if (gorevler.length === 0) ws1.addRow({ ad: 'Bu oturumda sayımcı görevi bulunamadı.' })
  ws1.views = [{ state: 'frozen', ySplit: 1 }]

  // ── 2) Satır detayı + kişi bazlı ardışık süreler ──
  const detay = rows.filter(r => sayildi(r.id)).map(r => {
    const res = results[r.id] || {}
    const guvenilir = izGuvenilir(res)
    return { r, res, guvenilir, uid: guvenilir ? res.updatedBy : null, t: guvenilir ? tsDate(res.updatedAt) : null }
  })
  const sirali = detay.filter(d => d.t).sort((a, b) => a.t - b.t)
  const son = new Map()
  sirali.forEach(d => {
    const o = son.get(d.uid)
    d.araSn = o ? Math.round((d.t - o) / 1000) : null
    son.set(d.uid, d.t)
  })
  // Aynı kişinin aynı saniyedeki yazımları → toplu doldurma / offline senkron izi
  const saniyeSay = new Map()
  sirali.forEach(d => { const k = d.uid + '|' + Math.floor(d.t / 1000); saniyeSay.set(k, (saniyeSay.get(k) || 0) + 1) })

  // ── Kişi Özeti ──
  const ws2 = workbook.addWorksheet('Kişi Özeti (Son Giriş)')
  ws2.columns = [
    { header: 'Son Giren Kişi',              key: 'ad',      width: 24 },
    { header: 'Satır',                       key: 'adet',    width: 9  },
    { header: 'Sistemle Aynı %',             key: 'ayniPct', width: 10 },
    { header: 'Görevi Kendisine Ait Değil',  key: 'disari',  width: 12 },
    { header: 'Medyan Ara (sn)',             key: 'medyan',  width: 10 },
    { header: '<3 sn Ara',                   key: 'hizli',   width: 9  },
    { header: 'Toplu Yazım (aynı sn ≥5)',    key: 'toplu',   width: 12 },
    { header: 'İlk Giriş',                   key: 'ilk',     width: 17 },
    { header: 'Son Giriş',                   key: 'son',     width: 17 },
  ]
  styleHeader(ws2)
  const kisiler = new Map()
  sirali.forEach(d => {
    if (!kisiler.has(d.uid)) kisiler.set(d.uid, [])
    kisiler.get(d.uid).push(d)
  })
  kisiler.forEach((list, uid) => {
    const aralar = list.map(d => d.araSn).filter(v => v !== null && v <= MOLA_SN).sort((a, b) => a - b)
    const medyan = aralar.length ? aralar[Math.floor(aralar.length / 2)] : null
    const ws2Row = ws2.addRow({
      ad: kisi(uid), adet: list.length,
      ayniPct: Math.round(list.filter(d => ayni(d.r)).length / list.length * 100),
      disari: list.filter(d => gorevler.length > 0 && !(atananKisi.get(d.r.id) || []).includes(uid)).length,
      medyan, hizli: list.filter(d => d.araSn !== null && d.araSn < HIZLI_ONAY_SN).length,
      toplu: list.filter(d => saniyeSay.get(uid + '|' + Math.floor(d.t / 1000)) >= 5).length,
      ilk: excelTarih(list[0].t), son: excelTarih(list[list.length - 1].t),
    })
    ws2Row.getCell('ilk').numFmt = 'dd.mm.yyyy hh:mm:ss'
    ws2Row.getCell('son').numFmt = 'dd.mm.yyyy hh:mm:ss'
  })
  const guvenilmez = detay.filter(d => !d.guvenilir).length
  ws2.addRow([])
  ;[
    'Bu oturum için ayrıntılı işlem logu yok (log 21.10.2026\'da devreye girdi); rapor her satırın SON girişinden geriye dönük çıkarıldı.',
    '"Onayla" ile elle giriş ayrımı bilinmez; yerine "sayılan = sistem" oranı verilir. Kart modunda Onayla sistem miktarını aynen yazar.',
    `"<3 sn Ara": aynı kişinin iki satır girişi arasındaki süre. "Toplu Yazım": aynı saniyede ≥5 satır — Sistemden Doldur veya çevrimdışı girilip birlikte senkronlanma olabilir, tek başına kanıt değildir.`,
    guvenilmez > 0
      ? `${guvenilmez} satır mutabakat onayında onaylayan kişiyle üzerine yazıldığı için kişi/zaman analizine alınmadı (bkz. Satır Detayı → "Onayla ezildi"). Bu satırlar için Görev Özeti'ndeki süre/oran bilgisi geçerlidir.`
      : 'Tüm sayılan satırların kişi/zaman izi mevcut.',
  ].forEach(t => {
    const r = ws2.addRow([t])
    r.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF475569' } }
    ws2.mergeCells(r.number, 1, r.number, ws2.columns.length)
  })
  ws2.views = [{ state: 'frozen', ySplit: 1 }]

  // ── Satır Detayı ──
  const ws3 = workbook.addWorksheet('Satır Detayı')
  ws3.columns = [
    { header: 'Son Giriş Zamanı',  key: 'zaman',   width: 19 },
    { header: 'Son Giren',         key: 'ad',      width: 22 },
    { header: 'Atanan Sayımcı',    key: 'atanan',  width: 22 },
    { header: 'Adres',             key: 'adres',   width: 14 },
    { header: 'Kod',               key: 'kod',     width: 16 },
    { header: 'Ad',                key: 'malzeme', width: 32 },
    { header: 'Sistem',            key: 'sistem',  width: 10 },
    { header: 'Sayılan',           key: 'sayilan', width: 10 },
    { header: 'Fark',              key: 'fark',    width: 9  },
    { header: 'Sistemle Aynı',     key: 'ayni',    width: 9  },
    { header: 'Önceki Girişten (sn)', key: 'araSn', width: 11 },
    { header: 'Not',               key: 'not',     width: 24 },
    { header: 'Uyarı',             key: 'uyari',   width: 22 },
  ]
  styleHeader(ws3)
  const detaySirali = [...sirali, ...detay.filter(d => !d.t)]
  detaySirali.forEach((d, i) => {
    const sistem = logSayi(d.r.sayim), sayilan = logSayi(d.res.miktar)
    const toplu = d.t && saniyeSay.get(d.uid + '|' + Math.floor(d.t / 1000)) >= 5
    const uyari = !d.guvenilir ? 'Onayla ezildi (kişi/zaman yok)'
      : d.araSn !== null && d.araSn < HIZLI_ONAY_SN ? 'Hızlı giriş' : toplu ? 'Toplu yazım' : ''
    const wsRow = ws3.addRow({
      zaman: excelTarih(d.t), ad: d.guvenilir ? kisi(d.uid) : '—',
      atanan: (atananKisi.get(d.r.id) || []).map(kisi).join(', '),
      adres: d.r.adres, kod: d.r.kod, malzeme: d.r.ad, sistem, sayilan,
      fark: sistem !== null && sayilan !== null ? sayilan - sistem : null,
      ayni: ayni(d.r) ? 'Evet' : 'Hayır', araSn: d.araSn ?? null, not: d.res.notlar || '', uyari,
    })
    wsRow.getCell('zaman').numFmt = 'dd.mm.yyyy hh:mm:ss'
    const renk = uyari === 'Hızlı giriş' || uyari === 'Toplu yazım' ? 'FFFFF3CD' : i % 2 === 1 ? 'FFF3F4F6' : null
    if (renk) wsRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: renk } } })
  })
  ws3.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws3.columns.length } }
  ws3.views = [{ state: 'frozen', ySplit: 1 }]

  sayimNoDamgala(workbook, session)
  const buffer = await workbook.xlsx.writeBuffer()
  const tarih = session.tarih ? new Date(session.tarih).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  downloadWorkbook(buffer, `${dosyaOnEki(firma, session)}Sayim_Denetimi_${tarih}.xlsx`)
}
