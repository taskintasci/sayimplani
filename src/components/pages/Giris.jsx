import { useState, useEffect } from 'react'
import useStore from '../../store/useStore'
import { SABLON } from '../../constants'

const SESSION_TYPES = [
  { id: 'Yıl Sonu Sayımı', icon: 'event_available', desc: 'Yıl sonu kapanış envanteri' },
  { id: 'Ara Sayım', icon: 'find_in_page', desc: 'Dönem içi kontrol sayımı' },
  { id: 'Ön Sayım', icon: 'preview', desc: 'Hazırlık ve sınırlı alan sayımı' },
]

function StatusBadge({ durum }) {
  if (durum === 'Devam') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
        Devam
      </span>
    )
  }
  if (durum === 'Mutabakat Bekliyor') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
        Mutabakat Bekliyor
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
      Tamamlandı
    </span>
  )
}

function formatCreatedAt(createdAt) {
  if (!createdAt) return ''
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function SessionCard({ s, selectedId, setSelectedId, deletingId, setDeletingId, isYonetici, deleteSession, handleGir }) {
  const pct = s.kalemSayisi > 0 ? Math.round((s.tamamlanan / s.kalemSayisi) * 100) : 0
  const isDeleting = deletingId === s.id
  const createdLabel = formatCreatedAt(s.createdAt)
  return (
    <div
      onDoubleClick={() => handleGir(s.id)}
      className={
        'w-full text-left rounded-xl p-4 border transition-all cursor-pointer ' +
        (selectedId === s.id
          ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm')
      }
    >
      <div className="flex items-start justify-between mb-1">
        <button className="flex-1 text-left" onClick={() => { setSelectedId(s.id); setDeletingId(null) }}>
          <div className="text-slate-800 font-semibold text-sm">{s.type}</div>
        </button>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <StatusBadge durum={s.durum} />
          {isYonetici && (!isDeleting ? (
            <button
              onClick={e => { e.stopPropagation(); setDeletingId(s.id) }}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Sayımı Sil"
            >
              <span className="ms" style={{ fontSize: 15 }}>delete</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={async e => { e.stopPropagation(); await deleteSession(s.id); setDeletingId(null); if (selectedId === s.id) setSelectedId(null) }}
                className="px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white text-[11px] font-semibold rounded-md transition-colors"
              >
                Sil
              </button>
              <button
                onClick={e => { e.stopPropagation(); setDeletingId(null) }}
                className="px-2 py-0.5 text-slate-400 hover:text-slate-600 text-[11px] rounded-md transition-colors"
              >
                İptal
              </button>
            </div>
          ))}
        </div>
      </div>
      <button className="w-full text-left" onClick={() => { setSelectedId(s.id); setDeletingId(null) }}>
        <div className="text-slate-500 text-xs mb-1.5 font-medium">{s.depoAdi}</div>
        <div className="flex items-center gap-2.5 text-xs text-slate-400 mono mb-2">
          <span>{s.tarih}</span>
          <span>·</span>
          <span>{s.kalemSayisi} kalem</span>
          {s.fark > 0 && (
            <>
              <span>·</span>
              <span className="text-amber-600">{s.fark} fark</span>
            </>
          )}
        </div>
        {s.kalemSayisi > 0 && (
          <div className="w-full bg-slate-100 rounded-full h-1 mb-2">
            <div
              className="h-1 rounded-full bg-blue-500 transition-all"
              style={{ width: pct + '%' }}
            />
          </div>
        )}
        {createdLabel && (
          <div className="text-[10px] text-slate-300 mono">Oluşturuldu: {createdLabel}</div>
        )}
      </button>
      <button
        onClick={e => { e.stopPropagation(); handleGir(s.id) }}
        className="w-full mt-3 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5"
      >
        <span className="ms" style={{ fontSize: 15 }}>play_arrow</span>
        Devam Et
      </button>
    </div>
  )
}

function EmptyMini({ icon, text }) {
  return (
    <div className="text-center py-8 border border-dashed border-slate-300 rounded-xl bg-white">
      <span className="ms text-slate-300 mb-2 inline-block" style={{ fontSize: 22 }}>{icon}</span>
      <p className="text-slate-400 text-xs">{text}</p>
    </div>
  )
}

export default function Giris({ onNavigate }) {
  const { sessions, sessionsLoading, loadSessions, setActiveSession, createSession, deleteSession, userRole, firmaProfile } = useStore()
  const isYonetici = userRole === 'yonetici' || userRole === 'superadmin'
  const panelRoute =
    firmaProfile?.sablon === SABLON.WMS31 ? 'antrepopanel' :
    firmaProfile?.sablon === SABLON.WMS_REDBULL ? 'redbullpanel' : 'panel'
  const [selectedId, setSelectedId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => { loadSessions() }, [])
  const [newType, setNewType] = useState('Yıl Sonu Sayımı')
  const [depoAdi, setDepoAdi] = useState('')
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10))

  function handleGir(id) {
    setActiveSession(id)
    onNavigate(panelRoute)
  }

  async function handleCreate() {
    if (!depoAdi.trim() || creating) return
    setCreating(true)
    try {
      await createSession({ type: newType, depoAdi: depoAdi.trim(), tarih })
      setModalOpen(false)
      onNavigate(panelRoute)
    } finally {
      setCreating(false)
    }
  }

  const devamEdenler       = sessions.filter(s => s.durum === 'Devam' || !s.durum)
  const mutabakatBekleyenler = sessions.filter(s => s.durum === 'Mutabakat Bekliyor')
  const tamamlananlar      = sessions.filter(s => s.durum === 'Tamamlandı')

  const cardProps = { selectedId, setSelectedId, deletingId, setDeletingId, isYonetici, deleteSession, handleGir }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-100">
      <div className="flex-1 overflow-y-auto flex justify-center px-4 sm:px-8 py-6">
        <div className="w-full max-w-6xl">

          {/* Üst bar: başlık + Yeni Sayım Oluştur */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-slate-700 font-semibold text-sm flex items-center gap-2">
              <span className="ms text-blue-500" style={{ fontSize: 18 }}>history</span>
              Geçmiş Sayımlar
            </h2>
            {isYonetici && (
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold rounded-lg text-xs transition-all"
              >
                <span className="ms" style={{ fontSize: 16 }}>add_circle</span>
                Yeni Sayım Oluştur
              </button>
            )}
          </div>

          {sessionsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[0, 1, 2].map(col => (
                <div key={col} className="flex flex-col gap-2">
                  {[1, 2].map(i => (
                    <div key={i} className="rounded-xl p-4 border border-slate-200 bg-white">
                      <div className="h-4 bg-slate-100 rounded-md w-40 mb-2 animate-pulse" />
                      <div className="h-3 bg-slate-100 rounded-md w-28 mb-3 animate-pulse" />
                      <div className="h-1.5 bg-slate-100 rounded-full w-full animate-pulse" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-300 rounded-xl bg-white">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-3">
                <span className="ms text-slate-300" style={{ fontSize: 24 }}>folder_open</span>
              </div>
              <p className="text-slate-500 text-sm font-medium">Kayıtlı sayım yok</p>
              <p className="text-slate-400 text-xs mt-1">
                {isYonetici ? 'Yukarıdaki butonla yeni sayım oluşturun' : 'Yönetici sayım oluşturduğunda buraya eklenir'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Devam Edenler */}
              <div>
                <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Devam Edenler
                  <span className="badge bg-slate-100 text-slate-500">{devamEdenler.length}</span>
                </h3>
                <div className="flex flex-col gap-2">
                  {devamEdenler.length === 0
                    ? <EmptyMini icon="hourglass_empty" text="Devam eden sayım yok" />
                    : devamEdenler.map(s => <SessionCard key={s.id} s={s} {...cardProps} />)
                  }
                </div>
              </div>

              {/* Mutabakat Onayında Bekliyor */}
              <div>
                <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                  Mutabakat Onayında Bekliyor
                  <span className="badge bg-slate-100 text-slate-500">{mutabakatBekleyenler.length}</span>
                </h3>
                <div className="flex flex-col gap-2">
                  {mutabakatBekleyenler.length === 0
                    ? <EmptyMini icon="fact_check" text="Mutabakat bekleyen sayım yok" />
                    : mutabakatBekleyenler.map(s => <SessionCard key={s.id} s={s} {...cardProps} />)
                  }
                </div>
              </div>

              {/* Tamamlanan */}
              <div>
                <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                  Tamamlanan
                  <span className="badge bg-slate-100 text-slate-500">{tamamlananlar.length}</span>
                </h3>
                <div className="flex flex-col gap-2">
                  {tamamlananlar.length === 0
                    ? <EmptyMini icon="task_alt" text="Tamamlanan sayım yok" />
                    : tamamlananlar.map(s => <SessionCard key={s.id} s={s} {...cardProps} />)
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Yeni Sayım Oluştur — modal */}
      {modalOpen && isYonetici && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalOpen(false)}>
          <div
            className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-slate-700 font-semibold text-sm flex items-center gap-2">
                <span className="ms text-blue-500" style={{ fontSize: 18 }}>add_circle</span>
                Yeni Sayım Oluştur
              </h2>
              <button onClick={() => setModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                <span className="ms" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            {/* Type selector */}
            <div className="mb-4">
              <div className="text-slate-500 text-xs font-medium mb-2">Sayım Türü</div>
              <div className="flex flex-col gap-2">
                {SESSION_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setNewType(t.id)}
                    className={
                      'flex items-center gap-3 p-3 rounded-xl border text-left transition-all ' +
                      (newType === t.id
                        ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm')
                    }
                  >
                    <div className={
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ' +
                      (newType === t.id ? 'bg-blue-600' : 'bg-slate-100')
                    }>
                      <span className={`ms ${newType === t.id ? 'text-white' : 'text-slate-500'}`} style={{ fontSize: 16 }}>{t.icon}</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-slate-800 text-sm font-medium">{t.id}</div>
                      <div className="text-slate-400 text-xs">{t.desc}</div>
                    </div>
                    {newType === t.id && (
                      <span className="ms text-blue-500" style={{ fontSize: 18 }}>check_circle</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Depo ve tarih */}
            <div className="flex flex-col gap-3 mb-5">
              <div>
                <label className="block text-slate-500 text-xs font-medium mb-1.5">Depo Kodu / Depo Adı / Blok Numarası</label>
                <input
                  type="text"
                  value={depoAdi}
                  onChange={e => setDepoAdi(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-slate-500 text-xs font-medium mb-1.5">Sayım Tarihi</label>
                <input
                  type="date"
                  value={tarih}
                  onChange={e => setTarih(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={!depoAdi.trim() || creating}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              <span className={'ms ' + (creating ? 'animate-spin' : '')}>{creating ? 'progress_activity' : 'rocket_launch'}</span>
              {creating ? 'Oluşturuluyor…' : 'Yeni Sayım Oluştur'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
