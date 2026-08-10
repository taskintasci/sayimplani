import { forwardRef } from 'react'

const ROWS_PER_PAGE = 25

const RedbullPrintSheet = forwardRef(function RedbullPrintSheet(
  { rows, results, session, mode = 'sayim', hideSayilan = false, sayimTuru = '', firmaUnvani = '' },
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

  const flatItems = rows

  // Sayfalara böl
  const pages = []
  for (let i = 0; i < flatItems.length; i += ROWS_PER_PAGE) {
    pages.push(flatItems.slice(i, i + ROWS_PER_PAGE))
  }
  if (pages.length === 0) pages.push([])
  const totalPages = pages.length

  const dataRowCount = rows.length

  let globalDataIdx = 0

  return (
    <div ref={ref} id="print-area">
      {pages.map((pageItems, pageIdx) => (
        <div
          key={pageIdx}
          style={{ pageBreakAfter: pageIdx < totalPages - 1 ? 'always' : 'auto' }}
        >
          {/* ── Sayfa başlığı ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 4, marginBottom: 4, borderBottom: '1.5px solid #1e293b' }}>
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
            <div style={{ textAlign: 'right', minWidth: 90 }}>
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
                <th style={thStyle({ textAlign: 'center', width: 20 })}>#</th>
                <th style={thStyle({ textAlign: 'left',   width: 90 })}>ADRES</th>
                <th style={thStyle({ textAlign: 'left',   width: 85 })}>STOK KODU</th>
                <th style={thStyle({ textAlign: 'left',   width: 200 })}>STOK ADI</th>
                <th style={thStyle({ textAlign: 'center', width: 110 })}>SSCC</th>
                <th style={thStyle({ textAlign: 'center', width: 90 })}>LOT</th>
                <th style={thStyle({ textAlign: 'left',   width: 90 })}>ALISAN STATU</th>
                <th style={thStyle({ textAlign: 'right',  width: 50 })}>PALET ADETİ</th>
                <th style={thStyle({ textAlign: 'center', width: 65, background: '#1d4ed8' })}>SAYIM MİKTARI</th>
                <th style={thStyle({ textAlign: 'center', width: 55 })}>BİRİM</th>
                <th style={thStyle({ textAlign: 'left'               })}>NOT</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item, i) => {
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
                    <td style={{ padding: '2px 4px', textAlign: 'center', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '5.5pt', color: '#94a3b8' }}>{item.sscc}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'center', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '6pt', color: '#64748b' }}>{item.parti}</td>
                    <td style={{ padding: '2px 4px', border: '1px solid #e2e8f0', fontSize: '6pt', color: '#64748b' }}>{item.durum}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'right', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '6pt', color: '#64748b' }}>{item.paletAdeti}</td>
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
                    <td style={{ padding: '2px 4px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '6pt', color: '#94a3b8' }}>{notlar}</td>
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

export default RedbullPrintSheet
