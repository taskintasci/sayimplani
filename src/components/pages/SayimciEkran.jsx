import { useState, useEffect, useMemo, useRef } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../../firebase/index'
import useStore from '../../store/useStore'
import { sortRows, sortRowsRedbull } from '../../utils/adresUtils'
import ComboBox from '../shared/ComboBox'
import ProfilPanel from '../shared/ProfilPanel'

function formatGorevZamani(createdAt) {
  if (!createdAt) return ''
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function siralamaMembran(rows) {
  return [...rows].sort((a, b) => {
    const pa = (a.partiEk || '').localeCompare(b.partiEk || '', 'tr', { numeric: true })
    if (pa !== 0) return pa
    return (a.adres || '').localeCompare(b.adres || '', 'tr')
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// Swipe kart — sağa kaydır = onayla, sola kaydır = eksik/fazla gir
// ═══════════════════════════════════════════════════════════════════════════
function SwipeCard({ row, sayilanMiktar, onConfirm, onEdit, isMembran, isAntrepo, isRedbull, locked }) {
  const [dx, setDx] = useState(0)
  const startX = useRef(null)
  const TH = 90

  function onStart(clientX) { if (locked) return; startX.current = clientX }
  function onMove(clientX) {
    if (startX.current == null) return
    setDx(clientX - startX.current)
  }
  function onEnd(clientX) {
    if (startX.current == null) return
    // Fare bırakma noktasından hesaplanan fark varsa onu kullan (daha güvenilir);
    // yoksa (dokunmatikte) son bilinen state'teki dx'e düş
    const finalDx = typeof clientX === 'number' ? clientX - startX.current : dx
    if (finalDx > TH)  onConfirm()
    else if (finalDx < -TH) onEdit()
    setDx(0)
    startX.current = null
  }

  // onMove/onEnd her render'da yeniden oluşturulduğu için window'a eklenen
  // dinleyicinin her zaman güncel kapanışı çağırması için ref'te tutuluyor
  const onMoveRef = useRef(onMove)
  const onEndRef  = useRef(onEnd)
  onMoveRef.current = onMove
  onEndRef.current  = onEnd

  // Fare ile sürüklerken imleç hızlı bir hareketle kartın dışına (örn.
  // altındaki "Eksik / Fazla" butonunun üzerine) çıkarsa, kart elemanına
  // bağlı mousemove/mouseup orada tetiklenmeyip sürüklemeyi yarım bırakıyor
  // ve buton üzerinde istenmeyen bir hover görünümüne yol açıyordu. Bu yüzden
  // sürükleme boyunca dinleyiciler window'a bağlanıp imleç nereye giderse
  // gitsin doğru şekilde takip ediliyor.
  function onMouseDown(e) {
    if (locked) return
    onStart(e.clientX)
    function handleMove(ev) { onMoveRef.current(ev.clientX) }
    function handleUp(ev) {
      onEndRef.current(ev.clientX)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  const bg = dx > 40 ? 'rgba(16,185,129,0.08)' : dx < -40 ? 'rgba(245,158,11,0.08)' : '#ffffff'

  return (
    <div className="relative w-full max-w-md select-none" style={{ touchAction: 'pan-y' }}>
      <div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none">
        <span className="ms text-amber-500" style={{ fontSize: 40, opacity: dx < -40 ? 1 : 0.2 }}>edit_note</span>
        <span className="ms text-emerald-500" style={{ fontSize: 40, opacity: dx > 40 ? 1 : 0.2 }}>check_circle</span>
      </div>

      <div
        onTouchStart={e => onStart(e.touches[0].clientX)}
        onTouchMove={e => onMove(e.touches[0].clientX)}
        onTouchEnd={() => onEnd()}
        onMouseDown={onMouseDown}
        className="relative rounded-3xl border border-slate-200 shadow-md cursor-grab active:cursor-grabbing flex flex-col"
        style={{
          transform: `translateX(${dx}px) rotate(${dx * 0.03}deg)`,
          transition: startX.current == null ? 'transform 0.25s ease' : 'none',
          background: bg,
          height: 340,
          padding: '28px 28px 24px',
        }}
      >
        {/* Palet rozeti — sadece membran */}
        {isMembran && row.partiEk && (
          <div className="flex items-center gap-2 mb-2 shrink-0">
            <span className="ms text-purple-500" style={{ fontSize: 16 }}>layers</span>
            <span className="text-purple-700 font-semibold text-sm mono">{row.partiEk}</span>
          </div>
        )}

        {/* Raf / Adres */}
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <span className="ms text-blue-500" style={{ fontSize: 22 }}>shelves</span>
          <span className="text-blue-700 font-bold tracking-tight mono" style={{ fontSize: 26 }}>
            {row.adres || '—'}
          </span>
        </div>

        {/* Ürün adı */}
        <p className="text-slate-900 font-extrabold leading-tight mb-2 overflow-hidden" style={{ fontSize: 26, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {row.ad || '—'}
        </p>

        {/* Kod + parti + palet barkodu (sadece WMS Antrepo Sayım) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-3 shrink-0">
          <span className="text-slate-500 mono" style={{ fontSize: 15 }}>{row.kod}</span>
          {row.parti && <span className="text-slate-400 mono text-xs">{isAntrepo ? 'Beyanname' : isRedbull ? 'Lot' : 'Parti'}: {row.parti}</span>}
          {isAntrepo && row.paletBarkodu && <span className="text-slate-400 mono text-xs">Palet: {row.paletBarkodu}</span>}
          {isRedbull && row.sscc && <span className="text-slate-400 mono text-xs">SSCC: {row.sscc}</span>}
          {isRedbull && row.durum && <span className="text-slate-400 mono text-xs">{row.durum}</span>}
        </div>

        {/* Sistem miktarı + sayılan */}
        <div className="flex items-end justify-between bg-slate-100 rounded-2xl px-4 py-3 mt-auto shrink-0">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-0.5">Sistem</p>
            <p className="text-slate-900 font-bold" style={{ fontSize: 30 }}>
              {row.sayim ?? '—'} <span className="text-slate-400 text-base font-normal">{row.birim}</span>
            </p>
          </div>
          {sayilanMiktar !== undefined && sayilanMiktar !== '' && (
            <div className="text-right">
              <p className="text-emerald-600 text-xs uppercase tracking-wide mb-0.5">Sayılan</p>
              <p className="text-emerald-700 font-bold" style={{ fontSize: 26 }}>{sayilanMiktar}</p>
            </div>
          )}
        </div>
      </div>

      {/* Butonlar */}
      <div className="flex gap-3 mt-4 shrink-0">
        <button
          onClick={onEdit}
          disabled={locked}
          className="flex-1 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-white font-bold text-lg flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:pointer-events-none"
          style={{ minHeight: 56 }}
        >
          <span className="ms" style={{ fontSize: 24 }}>edit_note</span> Eksik / Fazla
        </button>
        <button
          onClick={onConfirm}
          disabled={locked}
          className="flex-1 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-bold text-lg flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:pointer-events-none"
          style={{ minHeight: 56 }}
        >
          <span className="ms" style={{ fontSize: 24 }}>check</span> Onayla
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
export default function SayimciEkran({ mode = 'self' }) {
  const {
    currentUser, userProfile, userRole,
    gorevler, gorevlerLoading, loadMyGorevler, loadSessionGorevler, updateGorevDurum, deleteGorev,
    activeSessionId, rows, rowsLoading, results, updateResult,
    manualRows, addManualRow, korManualRows, addKorManualRow,
    sortType, setSortType, skuMasterdata, lokasyonlar, session,
  } = useStore()

  const setActiveSession = useStore(s => s.setActiveSession)
  const locked = session.durum === 'Tamamlandı'

  const [view, setView]       = useState('gorevler')
  const [gorev, setGorev]     = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [idx, _setIdx]        = useState(0)
  const idxRef                = useRef(0)
  const confirmingRef         = useRef(false)
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')
  const [editNote, setEditNote] = useState('')
  const [manuelOpen, setManuelOpen] = useState(false)
  const [listeSearch, setListeSearch] = useState('')
  const [lastConfirmed, setLastConfirmed] = useState(null)
  const undoTimerRef = useRef(null)
  const [expandedPalets, setExpandedPalets] = useState(null)

  function setIdx(n) { idxRef.current = n; _setIdx(n) }

  useEffect(() => {
    if (mode === 'preview') loadSessionGorevler(activeSessionId)
    else if (currentUser?.uid) loadMyGorevler(currentUser.uid)
  }, [mode, currentUser?.uid, activeSessionId])

  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current) }, [])

  const isMembran = gorev?.sayimTipi === 'membran'
  const isKor     = gorev?.sayimTipi === 'kor' || gorev?.sayimTipi === 'antrepokor' || gorev?.sayimTipi === 'redbullkor'
  const isAntrepo = gorev?.sayimTipi === 'antrepo' || gorev?.sayimTipi === 'antrepokor'
  const isRedbull = gorev?.sayimTipi === 'redbull' || gorev?.sayimTipi === 'redbullkor'

  const atanan = useMemo(() => {
    if (!gorev) return []
    const ids = gorev.atananRows || []
    const base = ids.length > 0 ? rows.filter(r => ids.includes(r.id)) : rows
    if (isMembran) return siralamaMembran(base)
    if (isRedbull) return sortRowsRedbull(base, sortType)
    return sortRows(base, sortType)
  }, [gorev, rows, sortType, isMembran, isRedbull])

  const sayilanAdet = useMemo(() =>
    atanan.filter(r => { const m = results[r.id]?.miktar; return m !== undefined && m !== '' }).length,
    [atanan, results]
  )

  // Görev, tablodan (kart modu dışında) doldurulduğunda da "tamamlandı" olarak işaretlensin
  useEffect(() => {
    if (mode !== 'self' || !gorev || gorev.durum === 'tamamlandi') return
    if (atanan.length > 0 && sayilanAdet === atanan.length) {
      updateGorevDurum(gorev.sessionId, gorev.id, 'tamamlandi')
      setGorev(g => g ? { ...g, durum: 'tamamlandi' } : g)
    }
  }, [mode, gorev, atanan.length, sayilanAdet])

  const filteredAtanan = useMemo(() => {
    if (!listeSearch.trim()) return atanan
    const q = listeSearch.trim().toLowerCase()
    return atanan.filter(r =>
      r.kod?.toLowerCase().includes(q) ||
      r.ad?.toLowerCase().includes(q)
    )
  }, [atanan, listeSearch])

  const membranGruplar = useMemo(() => {
    if (!isMembran) return []
    const map = new Map()
    filteredAtanan.forEach(r => {
      const key = r.partiEk?.trim() || '(Palet Yok)'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    })
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'tr', { numeric: true }))
  }, [filteredAtanan, isMembran])

  async function openGorev(g) {
    setGorev(g)
    setIdx(0)
    if (mode === 'self' && g.sessionId !== activeSessionId) {
      await setActiveSession(g.sessionId)
    }
    setView('liste')
  }

  function basla() {
    const firstUncounted = atanan.findIndex(r => {
      const m = results[r.id]?.miktar
      return m === undefined || m === ''
    })
    if (firstUncounted === -1) { setView('ozet'); return }
    setIdx(firstUncounted)
    setView('sayim')
  }

  const current = atanan[idxRef.current]

  function ilerle() {
    setEditing(false)
    let nextIdx = -1
    for (let i = idxRef.current + 1; i < atanan.length; i++) {
      const m = results[atanan[i].id]?.miktar
      if (m === undefined || m === '') { nextIdx = i; break }
    }
    if (nextIdx === -1) {
      setView('ozet')
      if (mode === 'self' && gorev) updateGorevDurum(gorev.sessionId, gorev.id, 'tamamlandi')
    } else {
      setIdx(nextIdx)
    }
    setTimeout(() => { confirmingRef.current = false }, 80)
  }

  // Onayla/Kaydet ile bir kalemi işaretlemeden HEMEN önceki durumunu saklayıp
  // birkaç saniyeliğine "Geri Al" göstermek için — yanlışlıkla dokunmayı
  // (özellikle kart modundaki swipe/Onayla) tek dokunuşla geri almak amacıyla.
  function armUndo(item) {
    setLastConfirmed(item)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setLastConfirmed(null), 5000)
  }

  function geriAl() {
    if (!lastConfirmed || locked) return
    const { id, idx: confirmedIdx, prevResult } = lastConfirmed
    updateResult(id, {
      miktar: prevResult?.miktar ?? '',
      status: prevResult?.status ?? '',
      notlar: prevResult?.notlar ?? '',
    })
    setEditing(false)
    setIdx(confirmedIdx)
    setView('sayim')
    setLastConfirmed(null)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
  }

  // Kart modunda bir önceki kalemi (sayılmış olsa da) yeniden görüntülemek
  // için — yanlışlıkla ilerlemiş bir sayımcının manuel olarak geri dönebilmesi
  function geriGit() {
    if (idxRef.current === 0 || locked) return
    setEditing(false)
    setIdx(idxRef.current - 1)
  }

  function onayla() {
    if (!current || confirmingRef.current || locked) return
    confirmingRef.current = true
    const prevResult = results[current.id]
    updateResult(current.id, {
      miktar: current.sayim,
      status: 'Sayıldı',
      notlar: results[current.id]?.notlar || '',
    })
    armUndo({ id: current.id, idx: idxRef.current, prevResult, kod: current.kod })
    ilerle()
  }

  function editAc() {
    if (!current) return
    setEditVal(results[current.id]?.miktar ?? '')
    setEditNote(results[current.id]?.notlar ?? '')
    setEditing(true)
  }

  function editKaydet() {
    if (!current || confirmingRef.current || locked) return
    confirmingRef.current = true
    const prevResult = results[current.id]
    updateResult(current.id, {
      miktar: editVal === '' ? '' : Number(editVal),
      status: 'Sayıldı',
      notlar: editNote,
    })
    armUndo({ id: current.id, idx: idxRef.current, prevResult, kod: current.kod })
    ilerle()
  }

  const manuelAddFn  = isKor ? addKorManualRow : addManualRow
  const manuelRows   = isKor ? korManualRows    : manualRows

  // ─── GÖREV LİSTESİ ───────────────────────────────────────────────────────
  if (view === 'gorevler') {
    // Sayımcının kendi ekranında: oturumu onaylanıp Tamamlandı'ya geçmiş bir
    // görevle artık hiçbir iş kalmadığı (tüm inputlar zaten kilitli) için
    // kartı gizliyoruz. Yönetici/süper yönetici önizlemesi (mode==='preview')
    // KASITLI olarak her şeyi gösterir — oradaki amaç denetim/genel bakış.
    const gorevListesi = mode === 'self'
      ? gorevler.filter(g => g.durum !== 'tamamlandi' && g.sessionDurum !== 'Tamamlandı')
      : gorevler

    // Oturum (sayım başlığı + tarihi) bazlı gruplama
    const gruplar = []
    const grupMap = new Map()
    gorevListesi.forEach(g => {
      if (!grupMap.has(g.sessionId)) {
        const grup = { sessionId: g.sessionId, sessionType: g.sessionType, sessionTarih: g.sessionTarih, items: [] }
        grupMap.set(g.sessionId, grup)
        gruplar.push(grup)
      }
      grupMap.get(g.sessionId).items.push(g)
    })

    return (
      <Shell mode={mode} title="Sayım Görevlerim" subtitle={userProfile?.displayName || currentUser?.email}>
        {gorevlerLoading ? (
          <Loading />
        ) : gorevListesi.length === 0 ? (
          <Empty
            icon="assignment_late"
            title="Henüz görev yok"
            text={mode === 'preview'
              ? 'Bu oturumda sayımcıya atanmış görev bulunmuyor.'
              : 'Size atanmış bir sayım görevi bulunmuyor. Yöneticiniz görev atadığında burada görünür.'}
          />
        ) : (
          <div className="flex flex-col gap-6 w-full max-w-md">
            {gruplar.map(grup => (
              <div key={grup.sessionId} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="ms text-slate-400" style={{ fontSize: 16 }}>event</span>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide">
                    {grup.sessionType || 'Sayım'}
                    {grup.sessionTarih && ' — ' + new Date(grup.sessionTarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                {grup.items.map(g => {
                  const ids = g.atananRows || []
                  const counted = g.sessionId === activeSessionId
                    ? ids.filter(id => { const m = results[id]?.miktar; return m !== undefined && m !== '' }).length
                    : null
                  const isDeleting = deletingId === g.id

                  return (
                    <div key={g.id} className="rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm active:scale-[0.99] transition-all p-5">
                      {isDeleting ? (
                        <div className="flex items-center justify-between">
                          <p className="text-slate-800 text-sm font-semibold">Bu görevi silmek istediğinizden emin misiniz?</p>
                          <div className="flex items-center gap-2 ml-3 shrink-0">
                            <button
                              onClick={async () => { await deleteGorev(g.sessionId, g.id); setDeletingId(null) }}
                              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg"
                            >
                              Sil
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="px-3 py-1 text-slate-600 hover:text-slate-800 text-xs rounded-lg border border-slate-300"
                            >
                              İptal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <button className="flex-1 text-left" onClick={() => openGorev(g)}>
                              <span className="text-slate-900 font-bold text-lg">{g.depoAdi || g.sessionType || 'Sayım'}</span>
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <DurumRozet durum={g.durum} />
                              {(userRole === 'yonetici' || userRole === 'superadmin') && (
                                <button
                                  onClick={() => setDeletingId(g.id)}
                                  className="w-11 h-11 -my-2 -mr-2 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                  title="Görevi Sil"
                                >
                                  <span className="ms" style={{ fontSize: 17 }}>delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <button className="w-full text-left" onClick={() => openGorev(g)}>
                            <p className="text-slate-500 text-sm mb-1">{g.sessionType}</p>
                            {(mode === 'preview' || g.createdAt) && (
                              <p className="text-slate-400 text-xs mb-2 flex items-center gap-1 flex-wrap">
                                {mode === 'preview' && (
                                  <span className="flex items-center gap-1">
                                    <span className="ms" style={{ fontSize: 13 }}>person</span> {g.sayimciAd || g.sayimciEmail}
                                  </span>
                                )}
                                {mode === 'preview' && g.createdAt && <span className="text-slate-300">·</span>}
                                {g.createdAt && (
                                  <span className="flex items-center gap-1">
                                    <span className="ms" style={{ fontSize: 13 }}>schedule</span> Gönderildi: {formatGorevZamani(g.createdAt)}
                                  </span>
                                )}
                              </p>
                            )}
                            {g.filtreOzeti && (
                              <p className="inline-flex items-center gap-1.5 text-[11px] text-blue-600 bg-blue-50 rounded-lg px-2 py-1 mb-2">
                                <span className="ms" style={{ fontSize: 13 }}>filter_alt</span> {g.filtreOzeti}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-slate-500 text-sm">
                                <span className="ms" style={{ fontSize: 18 }}>inventory_2</span>
                                {ids.length} kalem
                                {g.sayimTipi === 'membran' && (
                                  <span className="ms text-purple-500 ml-1" style={{ fontSize: 16 }}>layers</span>
                                )}
                                {g.sayimTipi === 'kor' && (
                                  <span className="ms text-amber-500 ml-1" style={{ fontSize: 16 }}>visibility_off</span>
                                )}
                                {(g.sayimTipi === 'antrepo' || g.sayimTipi === 'antrepokor') && (
                                  <span className="ms text-blue-500 ml-1" style={{ fontSize: 16 }}>qr_code_scanner</span>
                                )}
                                {(g.sayimTipi === 'redbull' || g.sayimTipi === 'redbullkor') && (
                                  <span className="ms text-orange-500 ml-1" style={{ fontSize: 16 }}>local_shipping</span>
                                )}
                              </div>
                              {counted !== null && (
                                <span className={
                                  'text-sm font-semibold ' +
                                  (counted === ids.length ? 'text-emerald-600' : 'text-blue-600')
                                }>
                                  {counted}/{ids.length} sayıldı
                                </span>
                              )}
                            </div>
                            {counted !== null && ids.length > 0 && (
                              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-1.5 bg-emerald-500 transition-all"
                                  style={{ width: `${(counted / ids.length) * 100}%` }}
                                />
                              </div>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </Shell>
    )
  }

  // ─── ATANAN TABLO + SAYIMA BAŞLA ──────────────────────────────────────────
  if (view === 'liste') {
    let rowCounter = 0
    return (
      <div className={mode === 'preview' ? 'flex-1 flex flex-col overflow-hidden bg-white' : 'h-screen flex flex-col overflow-hidden bg-white'}>
        {/* Üst bar */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shrink-0">
          <button
            onClick={() => { setView('gorevler'); setGorev(null); setListeSearch('') }}
            className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 shrink-0"
          >
            <span className="ms" style={{ fontSize: 24 }}>arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 font-bold text-sm truncate">{gorev?.depoAdi || 'Sayım Listesi'}</p>
            <p className="text-slate-400 text-xs">{atanan.length} kalem · {sayilanAdet} sayıldı</p>
          </div>
          <button
            onClick={basla}
            disabled={atanan.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-40 text-white rounded-xl text-sm font-bold shrink-0 transition-all"
            style={{ minHeight: 44 }}
          >
            <span className="ms" style={{ fontSize: 16 }}>play_arrow</span> Kart Modu
          </button>
        </div>

        {/* İlerleme çubuğu */}
        <div className="h-1.5 bg-slate-200 shrink-0">
          <div className="h-1.5 bg-blue-500 transition-all" style={{ width: `${atanan.length > 0 ? (sayilanAdet / atanan.length) * 100 : 0}%` }} />
        </div>

        {/* Arama + membran kontroller */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 shrink-0 flex items-center gap-2">
          <div className="relative flex-1">
            <span className="ms absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 14 }}>search</span>
            <input
              type="search"
              value={listeSearch}
              onChange={e => setListeSearch(e.target.value)}
              placeholder="Kod / Ad ara…"
              className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          {!isMembran && (
            <select
              value={sortType}
              onChange={e => setSortType(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-2.5 text-xs text-slate-600 focus:outline-none focus:border-blue-400 shrink-0"
              style={{ minHeight: 44 }}
            >
              {isRedbull ? (
                <>
                  <option value="1">Bina › Koridor › Sutun › Sıra › Kat</option>
                  <option value="2">Bina › Koridor › Sutun › Kat › Sıra</option>
                </>
              ) : (
                <>
                  <option value="1">Raf › Sıra › Kolon › Göz</option>
                  <option value="2">Raf › Sıra › Göz › Kolon</option>
                </>
              )}
            </select>
          )}
          {isMembran && (
            <>
              <button onClick={() => setExpandedPalets(null)} className="flex items-center gap-1 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 shrink-0" style={{ minHeight: 44 }}>
                <span className="ms" style={{ fontSize: 14 }}>unfold_more</span> Aç
              </button>
              <button onClick={() => setExpandedPalets(new Set())} className="flex items-center gap-1 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 shrink-0" style={{ minHeight: 44 }}>
                <span className="ms" style={{ fontSize: 14 }}>unfold_less</span> Kapat
              </button>
            </>
          )}
        </div>

        {/* Tablo */}
        {rowsLoading ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 gap-2">
            <span className="ms animate-spin" style={{ fontSize: 22 }}>progress_activity</span> Yükleniyor…
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse" style={{ minWidth: 650 }}>
              <thead className="sticky top-0 z-10">
                {isMembran ? (
                  <tr className="bg-slate-100 text-slate-600 text-[11px] mono uppercase tracking-wider border-b border-slate-200">
                    <th className="px-3 py-2.5 text-center w-8">#</th>
                    <th className="px-3 py-2.5 w-24">Adres</th>
                    <th className="px-3 py-2.5 w-28">Kod</th>
                    <th className="px-3 py-2.5">Ad</th>
                    <th className="px-3 py-2.5 w-20 text-right sistem-col">Sistem</th>
                    <th className="px-3 py-2.5 w-24 text-right text-blue-600 sayilan-col">Sayılan ▾</th>
                    <th className="px-3 py-2.5">Not</th>
                  </tr>
                ) : (
                  <tr className="bg-slate-100 text-slate-600 text-[11px] mono uppercase tracking-wider border-b border-slate-200">
                    <th className="px-3 py-2.5 w-24">Adres</th>
                    <th className="px-3 py-2.5 w-28">Kod</th>
                    <th className="px-3 py-2.5">Ad</th>
                    {isRedbull && <th className="px-3 py-2.5 w-36">SSCC</th>}
                    <th className="px-3 py-2.5 w-32">{isAntrepo ? 'Beyanname Numarası' : isRedbull ? 'Lot' : 'Parti'}</th>
                    {isAntrepo && <th className="px-3 py-2.5 w-28">Palet Barkodu</th>}
                    {isRedbull && <th className="px-3 py-2.5 w-24 text-center">Alisan Statu</th>}
                    <th className="px-3 py-2.5 w-20 text-right sistem-col">Sistem</th>
                    <th className="px-3 py-2.5 w-24 text-right text-blue-600 sayilan-col">Sayılan ▾</th>
                    <th className="px-3 py-2.5 w-20">Birim</th>
                    <th className="px-3 py-2.5">Not</th>
                  </tr>
                )}
              </thead>
              <tbody className="text-[12.5px]">
                {isMembran ? (
                  membranGruplar.map(([paletKey, items]) => {
                    const total   = items.length
                    const cntd    = items.filter(r => { const m = results[r.id]?.miktar; return m !== undefined && m !== '' }).length
                    const hasDiff = items.some(r => { const m = results[r.id]?.miktar; return m !== undefined && m !== '' && String(m) !== String(r.sayim) })
                    const complete = cntd === total && total > 0
                    const open = expandedPalets === null || expandedPalets.has(paletKey)
                    let headerBg = 'bg-slate-50'
                    if (complete && !hasDiff) headerBg = 'bg-emerald-50'
                    else if (complete && hasDiff) headerBg = 'bg-red-50'
                    else if (cntd > 0) headerBg = 'bg-amber-50'
                    return [
                      <tr
                        key={'palet-' + paletKey}
                        className={`${headerBg} border-b border-slate-200 cursor-pointer select-none`}
                        onClick={() => setExpandedPalets(prev => {
                          const base = prev === null ? new Set(membranGruplar.map(([k]) => k)) : new Set(prev)
                          if (base.has(paletKey)) base.delete(paletKey); else base.add(paletKey)
                          return base
                        })}
                      >
                        <td colSpan={7} className="px-3 py-2">
                          <div className="flex items-center gap-3">
                            <span className="ms text-slate-400" style={{ fontSize: 16 }}>{open ? 'expand_more' : 'chevron_right'}</span>
                            <span className="ms text-violet-500" style={{ fontSize: 16 }}>layers</span>
                            <span className="font-semibold text-[12.5px] text-slate-800 mono">Palet: {paletKey}</span>
                            <span className="text-[11.5px] text-slate-400">{total} kalem</span>
                            <PaletSayimBadge counted={cntd} total={total} hasDiff={hasDiff} />
                          </div>
                        </td>
                      </tr>,
                      ...(open ? items.map(row => {
                        rowCounter++
                        const res = results[row.id] || {}
                        const hasValue = res.miktar !== undefined && res.miktar !== ''
                        const isDiff   = hasValue && String(res.miktar) !== String(row.sayim)
                        return (
                          <tr key={row.id}
                            className={isDiff ? 'border-b border-slate-100 hover:bg-red-50' : 'border-b border-slate-100 hover:bg-blue-50/30'}
                            style={isDiff ? { background: 'rgba(254,242,242,0.6)' } : {}}
                          >
                            <td className="px-3 py-2 text-center text-slate-400 mono text-[11px]">{rowCounter}</td>
                            <td className="px-3 py-2 mono text-slate-600 text-[11.5px]">{row.adres}</td>
                            <td className="px-3 py-2 mono font-medium text-blue-700 text-[11.5px]">{row.kod}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{row.ad}</td>
                            <td className="px-3 py-2 text-right mono text-slate-500 sistem-col">{row.sayim}</td>
                            <td className="px-3 py-2 text-right sayilan-col">
                              <div className="flex items-center justify-end gap-1">
                                <input type="number" value={res.miktar ?? ''} onChange={e => updateResult(row.id, { miktar: e.target.value })} placeholder="—" disabled={locked} className={'input-count ' + (isDiff ? 'input-diff' : hasValue ? 'input-ok' : '')} />
                                {isDiff && <span className="ms text-red-400" style={{ fontSize: 14 }}>warning</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2"><input type="text" value={res.notlar ?? ''} onChange={e => updateResult(row.id, { notlar: e.target.value })} placeholder="not..." disabled={locked} className="w-full bg-transparent border-none text-[12px] text-slate-400 placeholder-slate-300 outline-none min-w-[60px] disabled:cursor-not-allowed" /></td>
                          </tr>
                        )
                      }) : [])
                    ]
                  })
                ) : (
                  filteredAtanan.map((row, i) => {
                    const res = results[row.id] || {}
                    const hasValue = res.miktar !== undefined && res.miktar !== ''
                    const isDiff   = hasValue && String(res.miktar) !== String(row.sayim)
                    return (
                      <tr key={row.id}
                        className={isDiff ? 'border-b border-slate-100 hover:bg-red-50' : 'border-b border-slate-100 hover:bg-blue-50/30'}
                        style={isDiff ? { background: 'rgba(254,242,242,0.6)' } : i % 2 === 1 ? { background: '#f8fafc' } : {}}
                      >
                        <td className="px-3 py-2 mono text-slate-600 text-[11.5px]">{row.adres}</td>
                        <td className="px-3 py-2 mono font-medium text-blue-700 text-[11.5px]">{row.kod}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{row.ad}</td>
                        {isRedbull && <td className="px-3 py-2 mono text-slate-400 text-[10.5px]">{row.sscc}</td>}
                        <td className="px-3 py-2 mono text-slate-500 text-[11.5px]">{row.parti}</td>
                        {isAntrepo && <td className="px-3 py-2 mono text-slate-500 text-[11.5px]">{row.paletBarkodu}</td>}
                        {isRedbull && <td className="px-3 py-2 text-center text-slate-500 text-[11.5px]">{row.durum}</td>}
                        <td className="px-3 py-2 text-right mono text-slate-500 sistem-col">{row.sayim}</td>
                        <td className="px-3 py-2 text-right sayilan-col">
                          <div className="flex items-center justify-end gap-1">
                            <input type="number" value={res.miktar ?? ''} onChange={e => updateResult(row.id, { miktar: e.target.value })} placeholder="—" disabled={locked} className={'input-count ' + (isDiff ? 'input-diff' : hasValue ? 'input-ok' : '')} />
                            {isDiff && <span className="ms text-red-400" style={{ fontSize: 14 }}>warning</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 mono text-slate-500 text-[11.5px]">{row.birim}</td>
                        <td className="px-3 py-2"><input type="text" value={res.notlar ?? ''} onChange={e => updateResult(row.id, { notlar: e.target.value })} placeholder="not..." disabled={locked} className="w-full bg-transparent border-none text-[12px] text-slate-400 placeholder-slate-300 outline-none min-w-[60px] disabled:cursor-not-allowed" /></td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            {filteredAtanan.length === 0 && atanan.length > 0 && (
              <div className="p-8 text-center text-sm text-slate-400">Aramaya uyan kayıt yok.</div>
            )}
          </div>
        )}

        {/* Alt bar */}
        <div className="shrink-0 px-4 py-3 safe-bottom bg-white border-t border-slate-200 flex gap-2">
          <button
            onClick={basla}
            disabled={atanan.length === 0}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl font-bold flex items-center justify-center gap-2"
          >
            <span className="ms" style={{ fontSize: 20 }}>
              {sayilanAdet === atanan.length && atanan.length > 0 ? 'task_alt' : 'play_arrow'}
            </span>
            {sayilanAdet === atanan.length && atanan.length > 0 ? 'Özeti Gör' : sayilanAdet > 0 ? 'Kaldığı Yerden Devam Et' : 'Sayıma Başla'}
          </button>
          {!locked && (
            <button onClick={() => setManuelOpen(true)} className="px-4 py-3 border border-slate-300 rounded-xl text-slate-700 font-semibold flex items-center gap-1.5 text-sm hover:bg-slate-50">
              <span className="ms" style={{ fontSize: 18 }}>add_box</span> Manuel
            </button>
          )}
        </div>

        {!locked && manuelOpen && (
          <ManuelModal onClose={() => setManuelOpen(false)} addManualRow={manuelAddFn} manualRows={manuelRows} isKor={isKor} isRedbull={isRedbull} skuMasterdata={skuMasterdata} lokasyonlar={lokasyonlar} />
        )}
      </div>
    )
  }

  // ─── SAYIM KARTI ──────────────────────────────────────────────────────────
  if (view === 'sayim') {
    return (
      <Shell
        mode={mode}
        title={gorev?.depoAdi || 'Sayım'}
        subtitle={`${sayilanAdet} / ${atanan.length} sayıldı`}
        onBack={() => setView('liste')}
      >
        {/* İlerleme çubuğu */}
        <div className="w-full max-w-md mb-3">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-2 bg-blue-500 transition-all"
              style={{ width: `${atanan.length > 0 ? (sayilanAdet / atanan.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {idx > 0 && (
          <button
            onClick={geriGit}
            disabled={locked}
            className="w-full max-w-md flex items-center gap-1 text-slate-400 hover:text-slate-600 text-sm mb-3 disabled:opacity-40"
          >
            <span className="ms" style={{ fontSize: 16 }}>arrow_back</span> Önceki karta dön
          </button>
        )}

        {current && !editing && (
          <SwipeCard
            row={current}
            sayilanMiktar={results[current.id]?.miktar}
            onConfirm={onayla}
            onEdit={editAc}
            isMembran={isMembran}
            isAntrepo={isAntrepo}
            isRedbull={isRedbull}
            locked={locked}
          />
        )}

        {/* Eksik/Fazla + Not alanı */}
        {current && editing && (
          <div className="w-full max-w-md rounded-3xl border border-amber-300 bg-amber-50 p-7">
            <p className="text-amber-800 font-bold text-lg mb-1">{current.ad}</p>
            <p className="text-slate-500 text-sm mono mb-5">{current.adres} · {current.kod}</p>

            <label className="block text-slate-600 text-sm mb-2">Sayılan Gerçek Miktar ({current.birim})</label>
            <input
              autoFocus type="number" inputMode="decimal" value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && editKaydet()}
              placeholder={`Sistem: ${current.sayim ?? '—'}`}
              disabled={locked}
              className="w-full bg-white border border-slate-300 rounded-2xl px-5 py-4 text-slate-900 text-3xl font-bold mono text-center focus:outline-none focus:border-amber-400 mb-4 disabled:opacity-40"
            />

            <label className="block text-slate-600 text-sm mb-2">Not (opsiyonel)</label>
            <textarea
              value={editNote}
              onChange={e => setEditNote(e.target.value)}
              placeholder="Açıklama, fark nedeni..."
              rows={2}
              disabled={locked}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-amber-400 resize-none disabled:opacity-40"
            />

            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditing(false)} className="flex-1 py-4 rounded-2xl border border-slate-300 text-slate-700 font-bold">
                Vazgeç
              </button>
              <button onClick={editKaydet} disabled={locked} className="flex-1 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40">
                <span className="ms" style={{ fontSize: 22 }}>save</span> Kaydet
              </button>
            </div>
          </div>
        )}

        {!locked && (
          <button
            onClick={() => setManuelOpen(true)}
            className="mt-6 text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1.5"
          >
            <span className="ms" style={{ fontSize: 18 }}>add_box</span> Manuel fazla stok ekle
          </button>
        )}
        {!locked && manuelOpen && (
          <ManuelModal
            onClose={() => setManuelOpen(false)}
            addManualRow={manuelAddFn}
            manualRows={manuelRows}
            isKor={isKor}
            isRedbull={isRedbull}
            skuMasterdata={skuMasterdata}
            lokasyonlar={lokasyonlar}
          />
        )}
        <UndoToast item={lastConfirmed} onUndo={geriAl} />
      </Shell>
    )
  }

  // ─── ÖZET ─────────────────────────────────────────────────────────────────
  return (
    <Shell mode={mode} title="Sayım Tamamlandı" subtitle={gorev?.depoAdi}>
      <div className="flex flex-col items-center text-center w-full max-w-md">
        <span className="ms text-emerald-500 mb-4" style={{ fontSize: 72 }}>task_alt</span>
        <p className="text-slate-900 font-bold text-2xl mb-2">Tebrikler!</p>
        <p className="text-slate-600 mb-1">{atanan.length} kalem sayıldı.</p>
        {manuelRows.length > 0 && (
          <p className="text-amber-700 text-sm mb-6">+ {manuelRows.length} manuel fazla stok girişi</p>
        )}
        <button
          onClick={() => { setView('gorevler'); setGorev(null) }}
          className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg mt-4"
        >
          Görevlere Dön
        </button>
      </div>
      <UndoToast item={lastConfirmed} onUndo={geriAl} />
    </Shell>
  )
}

// ── Geri Al toast'ı — kart modunda yanlışlıkla Onayla/Kaydet'e basıldığında ─
function UndoToast({ item, onUndo }) {
  if (!item) return null
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white pl-4 pr-2 py-2.5 rounded-full shadow-xl">
      <span className="text-sm">
        <span className="mono text-slate-300">{item.kod}</span> onaylandı
      </span>
      <button
        onClick={onUndo}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-sm font-semibold"
      >
        <span className="ms" style={{ fontSize: 16 }}>undo</span> Geri Al
      </button>
    </div>
  )
}

// ── Palet durum rozeti ────────────────────────────────────────────────────
function PaletSayimBadge({ counted, total, hasDiff }) {
  if (counted === 0) return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10.5px] font-medium">Bekliyor</span>
  if (counted < total) return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10.5px] font-medium">{counted}/{total} sayıldı</span>
  if (hasDiff) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10.5px] font-medium"><span className="ms" style={{ fontSize: 12 }}>warning</span> Fark Var</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10.5px] font-medium"><span className="ms" style={{ fontSize: 12 }}>check_circle</span> Tamamlandı</span>
}

// ── Yardımcı bileşenler ────────────────────────────────────────────────────
function Shell({ children, title, subtitle, onBack, mode }) {
  const [profilOpen, setProfilOpen] = useState(false)
  return (
    <div className={`${mode === 'preview' ? 'flex-1' : 'h-screen'} flex flex-col overflow-hidden bg-slate-100`}>
      <header className="flex items-center justify-between px-5 py-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button onClick={onBack} className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 shrink-0">
              <span className="ms" style={{ fontSize: 22 }}>arrow_back</span>
            </button>
          )}
          <div className="min-w-0">
            <p className="text-slate-900 font-bold text-base truncate">{title}</p>
            {subtitle && <p className="text-slate-500 text-xs truncate">{subtitle}</p>}
          </div>
        </div>
        {mode === 'self' && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setProfilOpen(true)} className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100" title="Profil">
              <span className="ms" style={{ fontSize: 20 }}>account_circle</span>
            </button>
            <button onClick={() => signOut(auth)} className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100" title="Çıkış Yap">
              <span className="ms" style={{ fontSize: 20 }}>logout</span>
            </button>
          </div>
        )}
        {mode === 'preview' && (
          <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-xs shrink-0">Önizleme</span>
        )}
      </header>
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-5 py-6">
        {children}
      </div>
      {profilOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => setProfilOpen(false)}>
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-900 font-bold text-lg flex items-center gap-2">
                <span className="ms text-blue-500" style={{ fontSize: 22 }}>account_circle</span>
                Profil
              </h3>
              <button onClick={() => setProfilOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                <span className="ms" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <ProfilPanel />
          </div>
        </div>
      )}
    </div>
  )
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-slate-500 mt-10">
      <span className="ms animate-spin" style={{ fontSize: 22 }}>progress_activity</span> Yükleniyor…
    </div>
  )
}

function Empty({ icon, title, text }) {
  return (
    <div className="flex flex-col items-center text-center mt-12 max-w-sm">
      <span className="ms text-slate-300 mb-3" style={{ fontSize: 56 }}>{icon}</span>
      <p className="text-slate-800 font-bold text-lg mb-1">{title}</p>
      <p className="text-slate-500 text-sm">{text}</p>
    </div>
  )
}

function DurumRozet({ durum }) {
  const map = {
    bekliyor:   { cls: 'bg-slate-100 text-slate-600',     label: 'Bekliyor' },
    devam:      { cls: 'bg-blue-100 text-blue-700',        label: 'Devam' },
    tamamlandi: { cls: 'bg-emerald-100 text-emerald-700',  label: 'Tamamlandı' },
  }
  const d = map[durum] || map.bekliyor
  return <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + d.cls}>{d.label}</span>
}

const MANUEL_BOS = { kod: '', ad: '', adres: '', parti: '', durum: '', miktar: '', birim: '', not: '' }

function ManuelModal({ onClose, addManualRow, manualRows, isKor, isRedbull, skuMasterdata, lokasyonlar }) {
  const [form, setForm] = useState(MANUEL_BOS)

  // Arka plan sayfası kaydırılabilir kaldıkça mobilde bir input'a dokununca
  // klavye açılırken tarayıcı input'u görünür kılmak için sayfayı yukarı
  // kaydırıyor, bu da sabit (fixed) modalın "zıplamış" gibi görünmesine yol
  // açıyordu. Modal açıkken arka planı kaydırılamaz yapıyoruz — html/body
  // ikisinde birden (sadece body'de kilitlemek Chrome'da yetmiyor, standart
  // modda gerçek "scrolling element" genellikle <html> oluyor).
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [])

  const skuOptions = useMemo(
    () => skuMasterdata.map(s => ({ value: s.kod, label: s.ad ? `${s.kod} — ${s.ad}` : s.kod })),
    [skuMasterdata]
  )
  const lokasyonOptions = useMemo(() => lokasyonlar.map(l => ({ value: l, label: l })), [lokasyonlar])

  const matchedSku = useMemo(
    () => skuMasterdata.find(s => s.kod.toUpperCase() === form.kod.trim().toUpperCase()),
    [skuMasterdata, form.kod]
  )
  const adresGecerli = form.adres.trim() === '' ||
    lokasyonlar.some(l => l.toUpperCase() === form.adres.trim().toUpperCase())

  // Form'da girilmiş veri varken kaza sonucu (arka plana dokunma vb.) kapatma
  // olasılığına karşı onay iste — yazım sırasında yanlışlıkla dokunma kayıp
  // vermesin diye.
  const isDirty = form.kod.trim() !== '' || form.adres.trim() !== '' || form.miktar !== '' ||
    form.parti.trim() !== '' || form.durum.trim() !== '' || form.not.trim() !== ''
  function handleClose() {
    if (isDirty && !window.confirm('Girdiğiniz bilgiler kaybolacak. Kapatmak istediğinize emin misiniz?')) return
    onClose()
  }

  function selectSku(opt) {
    const sku = skuMasterdata.find(s => s.kod === opt.value)
    setForm(f => ({ ...f, kod: sku.kod, ad: sku.ad, birim: sku.birim }))
  }

  function kaydet(e) {
    e.preventDefault()
    if (!matchedSku || form.miktar === '' || !adresGecerli) return
    addManualRow({
      kod:    matchedSku.kod,
      ad:     matchedSku.ad,
      adres:  form.adres.trim(),
      parti:  form.parti.trim(),
      durum:  form.durum.trim(),
      miktar: Number(form.miktar),
      birim:  matchedSku.birim,
      not:    form.not.trim() || 'Sayımcı tarafından eklendi',
    })
    setForm(MANUEL_BOS)
    onClose()
  }

  return (
    // items-start (alttan değil üstten sabit): form uzun ve klavye sık
    // kullanıldığı için alt sayfa (bottom-sheet) deseni klavye açılınca
    // modalın "sonunu" öne çıkarıp odaklanılan alanı gizliyordu — üstten
    // sabitlemek klavye ne kadar yer kaplarsa kaplasın üst alanların
    // (ve az önce dokunulan alanın) yerinde kalmasını sağlıyor.
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 p-4 overflow-y-auto" onClick={handleClose}>
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-xl mt-8 sm:mt-0 mb-8 sm:mb-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-900 font-bold text-lg flex items-center gap-2">
            <span className="ms text-amber-500" style={{ fontSize: 22 }}>add_box</span>
            Manuel Fazla Stok
            {isKor && <span className="text-xs font-normal text-amber-700 ml-1">(Kör Sayım)</span>}
          </h3>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 shrink-0">
            <span className="ms" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>
        <p className="text-slate-500 text-xs mb-4">
          Sistemde bulunmayan ürün.
          {isKor ? ' Kör sayım raporu' : ' Stok sayım raporu'}'ndaki manuel listeye eklenir.
        </p>
        <form onSubmit={kaydet} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Ürün Kodu *</label>
            <ComboBox
              value={form.kod}
              onChange={text => setForm(f => ({ ...f, kod: text, ad: '', birim: '' }))}
              onSelect={selectSku}
              options={skuOptions}
              placeholder="Kod / Ad Ara"
              invalid={form.kod.trim() !== '' && !matchedSku}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Ürün Adı</label>
            <input value={form.ad} disabled readOnly
              placeholder="Kod seçilince otomatik dolar" className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-slate-500 placeholder-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Raf / Adres</label>
            <ComboBox
              value={form.adres}
              onChange={text => setForm(f => ({ ...f, adres: text }))}
              onSelect={opt => setForm(f => ({ ...f, adres: opt.value }))}
              options={lokasyonOptions}
              placeholder="Opsiyonel, listeden seçin"
              invalid={form.adres.trim() !== '' && !adresGecerli}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">{isRedbull ? 'Lot' : 'Parti'}</label>
              <input value={form.parti} onChange={e => setForm(f => ({ ...f, parti: e.target.value }))}
                type="text" placeholder={isRedbull ? '2541388' : 'PT240101'} className="w-full border border-slate-300 rounded-xl px-4 py-3 mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">{isRedbull ? 'Alisan Statu' : 'Durum'}</label>
              <input value={form.durum} onChange={e => setForm(f => ({ ...f, durum: e.target.value }))}
                type="text" placeholder={isRedbull ? 'Normal / İade...' : 'Serbest / KK...'} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">Sayılan Miktar *</label>
              <input value={form.miktar} onChange={e => setForm(f => ({ ...f, miktar: e.target.value }))}
                type="number" inputMode="decimal" placeholder="0" style={{ lineHeight: 1.4 }}
                className="no-spinner w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 mono placeholder-slate-400 focus:outline-none focus:border-blue-400" />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-slate-500 mb-1">Birim</label>
              <input value={form.birim} disabled readOnly
                placeholder="—" className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-3 text-slate-500 placeholder-slate-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Not (opsiyonel)</label>
            <input value={form.not} onChange={e => setForm(f => ({ ...f, not: e.target.value }))}
              type="text" placeholder="Açıklama..." className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400" />
          </div>
          <button type="submit" disabled={!matchedSku || form.miktar === '' || !adresGecerli}
            className="py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white font-bold flex items-center justify-center gap-2 mt-1">
            <span className="ms" style={{ fontSize: 20 }}>add</span>
            Ekle
          </button>
        </form>
        {manualRows.length > 0 && (
          <p className="text-slate-400 text-xs text-center mt-3">{manualRows.length} manuel kayıt eklendi</p>
        )}
      </div>
    </div>
  )
}
