import { forwardRef } from 'react'

const ROWS_PER_PAGE = 25

const PrintSheet = forwardRef(function PrintSheet(
  { rows, results, session, mode = 'sayim', hideSayilan = false, sayimTuru = '', paletGrouped = false, firmaUnvani = '' },
  ref
) {
  const blindMode    = mode === 'kor'
  const sayilanGizli = blindMode || hideSayilan

  const tarihStr = session.tarih
    ? new Date(session.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  const now       = new Date()
  const printDate = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  const printTime = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

  const thStyle = (extra = {}) => ({
    padding: '3px 4px',
    fontFamily: 'monospace',
    fontSize: '6.5pt',
    fontWeight: 700,
    letterSpacing: '0.04em',
    ...extra,
  })

  const sigBox = (name) => (
    <div key={name} style={{ border: '1px solid #e2e8f0', borderRadius: 3, padding: '2px 5px' }}>
      <p style={{ fontSize: '7pt', fontWeight: 700, color: '#2563eb', marginBottom: 2 }}>{name}</p>
      <p style={{ fontSize: '5.5pt', color: '#94a3b8', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 1 }}>Tarih</p>
      <div style={{ borderBottom: '1px dashed #cbd5e1', height: 7, marginBottom: 3 }} />
      <p style={{ fontSize: '5.5pt', color: '#94a3b8', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 1 }}>İmza</p>
      <div style={{ borderBottom: '1px dashed #cbd5e1', height: 7 }} />
    </div>
  )

  // Palet gruplu mod: partiEk tek başına benzersiz değil (farklı kodlarda tekrar edebilir),
  // bu yüzden kod + partiEk birleşimi gerçek paleti belirler.
  let flatItems = rows
  if (paletGrouped) {
    const map = new Map()
    ;[...rows]
      .sort((a, b) => (a.partiEk || '').localeCompare(b.partiEk || '', 'tr', { numeric: true }))
      .forEach(r => {
        const paletNo = r.partiEk?.trim() || '(Palet Yok)'
        const key = [r.kod?.trim() || '', paletNo].join('||')
        if (!map.has(key)) map.set(key, { paletNo, kod: r.kod, items: [] })
        map.get(key).items.push(r)
      })
    flatItems = []
    map.forEach(({ paletNo, kod, items }) => {
      flatItems.push({ __header: true, paletKey: paletNo, kod, count: items.length })
      items.forEach(r => flatItems.push(r))
    })
  }

  // Sayfalara böl (header'lar da slot tüketir)
  const pages = []
  for (let i = 0; i < flatItems.length; i += ROWS_PER_PAGE) {
    pages.push(flatItems.slice(i, i + ROWS_PER_PAGE))
  }
  if (pages.length === 0) pages.push([])
  const totalPages = pages.length

  // Gerçek veri satırı sayısı (header hariç)
  const dataRowCount = paletGrouped ? rows.length : rows.length

  let globalDataIdx = 0 // header satırları sayılmadan artan sayaç

  return (
    <div ref={ref} id="print-area">
      {pages.map((pageItems, pageIdx) => (
        <div
          key={pageIdx}
          style={{ pageBreakAfter: pageIdx < totalPages - 1 ? 'always' : 'auto' }}
        >
          {/* ── Sayfa başlığı ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 4, marginBottom: 4, borderBottom: '1.5px solid #1e293b' }}>
            {/* Sayım no — sol üst (sağdaki SAYFA bloğuyla aynı genişlik, başlık ortada kalsın) */}
            <div style={{ textAlign: 'left', minWidth: 130 }}>
              {session.sayimNo && (
                <>
                  <p style={{ fontSize: '6pt', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>SAYIM NO</p>
                  <p style={{ fontSize: '9pt', fontWeight: 800, color: '#1e293b', fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{session.sayimNo}</p>
                </>
              )}
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <p style={{ fontSize: '9pt', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {firmaUnvani || 'SAYIM PLANI'}
              </p>
              <p style={{ fontSize: '11pt', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 2 }}>
                {session.sayimBasligi || session.type || 'YIL SONU SAYIM'}
                {sayimTuru && <span style={{ color: '#cbd5e1', fontWeight: 300, margin: '0 7px' }}>·</span>}
                {sayimTuru && <span style={{ color: '#334155' }}>{sayimTuru}</span>}
              </p>
              <p style={{ fontSize: '7pt', color: '#94a3b8', marginTop: 3, letterSpacing: '0.02em' }}>
                {tarihStr}
                {session.depoAdi ? ` · ${session.depoAdi}` : ''}
              </p>
            </div>
            <div style={{ textAlign: 'right', minWidth: 130 }}>
              <p style={{ fontSize: '6pt', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>SAYFA</p>
              <p style={{ fontSize: '15pt', fontWeight: 800, color: '#1d4ed8', lineHeight: 1.1 }}>
                {pageIdx + 1} <span style={{ fontSize: '8.5pt', color: '#94a3b8' }}>/ {totalPages}</span>
              </p>
              <p style={{ fontSize: '6pt', color: '#94a3b8', marginTop: 3 }}>Baskı: {printDate}</p>
              <p style={{ fontSize: '6pt', color: '#94a3b8' }}>{printTime} · {dataRowCount} kalem</p>
            </div>
          </div>

          {/* ── Tablo ── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7pt' }}>
            <thead>
              <tr style={{ background: '#1e293b', color: 'white' }}>
                <th style={thStyle({ textAlign: 'center', width: 22 })}>#</th>
                <th style={thStyle({ textAlign: 'left',   width: 100 })}>ADRES</th>
                <th style={thStyle({ textAlign: 'left',   width: 100 })}>KOD</th>
                <th style={thStyle({ textAlign: 'left',   width: 300 })}>AD</th>
                <th style={thStyle({ textAlign: 'center', width: 100 })}>PARTİ</th>
                <th style={thStyle({ textAlign: 'center', width: 65 })}>DURUM</th>
                <th style={thStyle({ textAlign: 'right',  width: 65 })}>ADET</th>
                <th style={thStyle({ textAlign: 'center', width: 65 })}>AMBALAJ</th>
                <th style={thStyle({ textAlign: 'center', width: 65, background: '#1d4ed8' })}>SAYIM MİKTARI</th>
                <th style={thStyle({ textAlign: 'center', width: 65 })}>BİRİM</th>
                <th style={thStyle({ textAlign: 'left'              })}>NOT</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item, i) => {
                // Palet başlık satırı
                if (item.__header) {
                  return (
                    <tr key={'h-' + item.paletKey + '-' + pageIdx + '-' + i} style={{ background: '#f1f5f9' }}>
                      <td colSpan={11} style={{
                        padding: '3px 6px',
                        border: '1px solid #cbd5e1',
                        borderLeft: '3px solid #7c3aed',
                        fontFamily: 'monospace',
                        fontSize: '7pt',
                        fontWeight: 700,
                        color: '#3730a3',
                        letterSpacing: '0.03em',
                      }}>
                        ▶ PALET: {item.paletKey}{item.kod && ` · ${item.kod}`} <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 8 }}>{item.count} kalem</span>
                      </td>
                    </tr>
                  )
                }

                // Normal veri satırı
                const rowNum  = ++globalDataIdx
                const isEven  = rowNum % 2 === 0
                const miktar  = results?.[item.id]?.miktar
                const notlar  = results?.[item.id]?.notlar ?? ''
                const isDiff  = miktar !== undefined && miktar !== '' && String(miktar) !== String(item.sayim)
                const rowBg   = isDiff ? '#fff1f2' : isEven ? '#f8fafc' : '#ffffff'

                return (
                  <tr key={item.id || i} style={{ background: rowBg }}>
                    <td style={{ padding: '2px 4px', textAlign: 'center', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '6.5pt', color: '#94a3b8' }}>{rowNum}</td>
                    <td style={{ padding: '2px 4px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '6.5pt' }}>{item.adres}</td>
                    <td style={{ padding: '2px 4px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '6.5pt', color: '#2563eb', fontWeight: 700 }}>{item.kod}</td>
                    <td style={{ padding: '2px 4px', border: '1px solid #e2e8f0', fontSize: '6pt', fontWeight: 500 }}>{item.ad}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'center', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '6.5pt', color: '#64748b' }}>{item.parti}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'center', border: '1px solid #e2e8f0', fontSize: '6.5pt' }}>{item.durum}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'right', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>{item.adet1}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'center', border: '1px solid #e2e8f0', fontSize: '5.5pt', color: '#64748b' }}>{item.ambalaj}</td>
                    <td style={{
                      padding: '2px 4px', textAlign: 'right',
                      border: '1px solid #3b82f6',
                      background: isDiff ? '#fee2e2' : '#eff6ff',
                      fontFamily: 'monospace', fontWeight: isDiff ? 700 : 400,
                      color: isDiff ? '#dc2626' : '#1e293b',
                    }}>
                      {sayilanGizli ? ' ' : (miktar !== undefined && miktar !== '' ? miktar : ' ')}
                    </td>
                    <td style={{ padding: '2px 4px', textAlign: 'center', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '6.5pt', color: '#64748b' }}>{item.birim}</td>
                    <td style={{ padding: '2px 4px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '6pt', color: '#94a3b8' }}>{notlar || item.aciklama || ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* ── İmza kutuları ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '4mm',
            padding: '2mm 0 3mm',
            marginTop: 4,
            borderTop: '1.5px solid #e2e8f0',
          }}>
            {['Sayan 1', 'Sayan 2', 'Sistem Girişi', 'Kontrol'].map(sigBox)}
          </div>
        </div>
      ))}
    </div>
  )
})

export default PrintSheet
