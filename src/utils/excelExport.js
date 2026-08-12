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
    { header: 'Durum',           key: 'durum',    width: 12 },
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
  const buffer = await workbook.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `${firma.ad ? firma.ad + '_' : ''}Mutabakat_Raporu_${tarih}.xlsx`
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
  const buffer = await workbook.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `${firma.ad ? firma.ad + '_' : ''}Mutabakat_Raporu_${tarih}.xlsx`
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

  const uniqueSkuSistem  = [...new Set(rows.map(r => r.kod))].length
  const uniqueSkuHatasiz = [...new Set(
    rows.filter(r => {
      const m = results[r.id]?.miktar
      return m !== undefined && m !== '' && String(m) === String(r.sayim)
    }).map(r => r.kod)
  )].length
  const hataliSku = uniqueSkuSistem - uniqueSkuHatasiz
  const skuPct    = uniqueSkuSistem > 0 ? +(uniqueSkuHatasiz / uniqueSkuSistem * 100).toFixed(4) : 0
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
    sayilanSku:   uniqueSkuSistem,
    hataliSku:    hataliSku,
    hatasizSku:   uniqueSkuHatasiz,
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

  const buffer = await workbook.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `${firma.ad ? firma.ad + '_' : ''}Sayim_Analizi_${new Date().toISOString().slice(0, 10)}.xlsx`
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
    { header: 'Durum',        key: 'durum',    width: 10 },
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
      status: res.status || '', notlar: res.notlar || '',
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

  const buffer = await workbook.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `${firma.ad ? firma.ad + '_' : ''}Sayim_Sonuclari_${new Date().toISOString().slice(0, 10)}.xlsx`
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
    { header: 'Durum',           key: 'durum',        width: 10 },
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
      status: res.status || '', notlar: res.notlar || '',
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

  const buffer = await workbook.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `${firma.ad ? firma.ad + '_' : ''}Sayim_Sonuclari_${new Date().toISOString().slice(0, 10)}.xlsx`
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
      parti: row.parti, durum: row.durum, paletAdeti: row.paletAdeti,
      sayim: sistem, sayilan, fark, birim: row.birim,
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
    ws.mergeCells(`A${sepRow.number}:M${sepRow.number}`)
    sepRow.height = 18

    manualRows.forEach((row, i) => {
      const miktar = parseFloat(row.miktar) || 0
      const wsRow  = ws.addRow({
        siraNo: i + 1, kod: row.kod, ad: row.ad, sscc: row.sscc, adres: row.adres,
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
  const buffer = await workbook.xlsx.writeBuffer()
  downloadWorkbook(buffer, `${firma.ad ? firma.ad + '_' : ''}Mutabakat_Raporu_${tarih}.xlsx`)
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
      parti: row.parti, durum: row.durum, paletAdeti: row.paletAdeti,
      sayim: sistem, sayilan, fark, birim: row.birim,
      status: res.status || '', notlar: res.notlar || '',
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
    parti: row.parti, durum: row.durum, paletAdeti: '',
    sayim: 0, sayilan: miktar, fark: miktar, birim: row.birim,
    status: '', notlar: row.not,
  }))

  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await workbook.xlsx.writeBuffer()
  downloadWorkbook(buffer, `${firma.ad ? firma.ad + '_' : ''}Redbull_Sayim_Sonuclari_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
