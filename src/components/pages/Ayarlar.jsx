import { useState, useEffect } from 'react'
import useStore, { ROLE_LABELS } from '../../store/useStore'
import FirmaYonetimi from './FirmaYonetimi'
import FirmaMasterdataPanel from './FirmaMasterdataPanel'
import ProfilPanel from '../shared/ProfilPanel'

// ── Kullanıcı Yönetimi ────────────────────────────────────────────────────
import { getSecondaryAuth } from '../../firebase/index'
import { createUserWithEmailAndPassword, signOut as secondarySignOut } from 'firebase/auth'

const ROLE_OPTIONS = [
  { id: 'yonetici',  label: 'Yönetici',  desc: 'Tam yetki — firmanın tüm sayfaları, kullanıcı yönetimi' },
  { id: 'kontrolcu', label: 'Kontrolcü', desc: 'Analiz ve raporları görür, sayım/yükleme yapamaz' },
  { id: 'sayimci',   label: 'Sayımcı',   desc: 'Yalnızca kendisine atanan sayım görevlerini görür' },
]
// Süper yönetici rolü yalnızca zaten süper yönetici olan kullanıcıya gösterilir
// (yetki yükseltme riskini önlemek için normal yönetici bu seçeneği göremez).
const SUPERADMIN_OPTION = { id: 'superadmin', label: 'Süper Yönetici', desc: 'Tüm firmaları görür/yönetir, yeni firma ekleyebilir' }

const ROLE_BADGE = {
  superadmin: 'bg-violet-50 text-violet-700',
  yonetici:   'bg-blue-50 text-blue-700',
  kontrolcu:  'bg-amber-50 text-amber-700',
  sayimci:    'bg-emerald-50 text-emerald-700',
}

const EMPTY_FORM = { email: '', password: '', displayName: '', rol: 'sayimci' }

function KullaniciTab() {
  const { users, usersLoading, loadUsers, createUserAccount, updateUserRole, deleteUserDoc, userProfile, userRole, firmaProfile } = useStore()
  const roleOptions = userRole === 'superadmin' ? [...ROLE_OPTIONS, SUPERADMIN_OPTION] : ROLE_OPTIONS
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [okMsg, setOkMsg]       = useState('')
  const [confirmId, setConfirmId] = useState(null)

  useEffect(() => { loadUsers() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setError(''); setOkMsg('')
    if (!form.email.trim() || form.password.length < 8) {
      setError('Geçerli bir e-posta ve en az 8 karakterli şifre girin.')
      return
    }
    setSaving(true)
    try {
      await createUserAccount({
        email:       form.email.trim(),
        password:    form.password,
        displayName: form.displayName.trim(),
        rol:         form.rol,
      })
      setOkMsg(`${form.email.trim()} oluşturuldu.`)
      setForm(EMPTY_FORM)
    } catch (err) {
      const code = err?.code || ''
      if (code === 'auth/email-already-in-use') setError('Bu e-posta zaten kayıtlı.')
      else if (code === 'auth/invalid-email')   setError('Geçersiz e-posta adresi.')
      else if (code === 'auth/weak-password')    setError('Şifre çok zayıf (en az 6 karakter).')
      else setError('Kullanıcı oluşturulamadı. Lütfen tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Yeni kullanıcı formu */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
          <span className="ms text-blue-500" style={{ fontSize: 18 }}>person_add</span>
          Yeni Kullanıcı Ekle
        </h3>
        {firmaProfile?.ad && (
          <p className="text-xs text-slate-400 mb-4 ml-6">Firma: <span className="font-medium text-slate-500">{firmaProfile.ad}</span></p>
        )}
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Ad Soyad</label>
            <input type="text" value={form.displayName}
              onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
              placeholder="Örn: Ahmet Yılmaz"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-200" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">E-posta</label>
            <input type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="ornek@sirket.com" autoComplete="off"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-200" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Şifre</label>
            <input type="password" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="En az 6 karakter" autoComplete="new-password"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-200" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Rol</label>
            <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-200">
              {roleOptions.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div className="col-span-2 text-xs text-slate-400 -mt-1">
            {roleOptions.find(r => r.id === form.rol)?.desc}
          </div>
          {error && <div className="col-span-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">{error}</div>}
          {okMsg && <div className="col-span-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-emerald-700 text-sm">{okMsg}</div>}
          <div className="col-span-2">
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors">
              <span className={'ms ' + (saving ? 'animate-spin' : '')} style={{ fontSize: 18 }}>
                {saving ? 'progress_activity' : 'add'}
              </span>
              {saving ? 'Oluşturuluyor…' : 'Kullanıcı Oluştur'}
            </button>
          </div>
        </form>
      </div>

      {/* Kullanıcı listesi */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <span className="ms text-slate-400" style={{ fontSize: 18 }}>group</span>
          <span className="text-sm font-semibold text-slate-700">Kullanıcılar</span>
          <span className="badge bg-slate-100 text-slate-500">{users.length}</span>
        </div>
        {usersLoading ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
            <span className="ms animate-spin" style={{ fontSize: 18 }}>progress_activity</span> Yükleniyor…
          </div>
        ) : users.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">Henüz kullanıcı yok.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-2.5 text-left font-semibold">Ad Soyad</th>
                <th className="px-5 py-2.5 text-left font-semibold">E-posta</th>
                <th className="px-5 py-2.5 text-left font-semibold">Rol</th>
                <th className="px-5 py-2.5 text-right font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(u => {
                const isSelf = u.uid === userProfile?.uid
                return (
                  <tr key={u.uid} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-medium text-slate-800">
                      {u.displayName || '—'}
                      {isSelf && <span className="ml-2 text-[10px] text-slate-400">(siz)</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-500 mono text-xs">{u.email}</td>
                    <td className="px-5 py-3">
                      <select value={u.rol || 'sayimci'} disabled={isSelf}
                        onChange={e => updateUserRole(u.uid, e.target.value)}
                        className={
                          'text-xs font-semibold rounded-md px-2 py-1 border-0 focus:outline-hidden focus:ring-1 focus:ring-blue-300 ' +
                          (ROLE_BADGE[u.rol] || 'bg-slate-100 text-slate-600') +
                          (isSelf ? ' opacity-60 cursor-not-allowed' : ' cursor-pointer')
                        }>
                        {roleOptions.map(r => <option key={r.id} value={r.id}>{ROLE_LABELS[r.id]}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {isSelf ? (
                        <span className="text-xs text-slate-300">—</span>
                      ) : confirmId === u.uid ? (
                        <span className="inline-flex items-center gap-1.5">
                          <button onClick={async () => { await deleteUserDoc(u.uid); setConfirmId(null) }}
                            className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-[11px] font-semibold rounded-md">Sil</button>
                          <button onClick={() => setConfirmId(null)}
                            className="px-2 py-1 text-slate-400 hover:text-slate-600 text-[11px] rounded-md">İptal</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmId(u.uid)}
                          className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <span className="ms" style={{ fontSize: 16 }}>delete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <p className="px-5 py-3 text-[11px] text-slate-400 border-t border-slate-50">
          Not: Silme işlemi kullanıcının erişim profilini kaldırır. Firebase Auth hesabı gerekirse Firebase Console'dan silinmelidir.
        </p>
      </div>
    </div>
  )
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────
export default function Ayarlar() {
  const { session, setSession, userRole, activeSessionId, firmaProfile } = useStore()
  const isYonetici = userRole === 'yonetici' || userRole === 'superadmin'
  const isSuperAdmin = userRole === 'superadmin'
  // Kontrolcü'nün "kullanicilar" sekmesine erişimi yok (isYonetici gerekiyor)
  // — session yokken varsayılanı 'kullanicilar' yapmak kontrolcü için hiçbir
  // sekmenin seçili olmadığı boş bir ekrana yol açardı, bu yüzden rol bazlı.
  const [tab, setTab] = useState(() => activeSessionId ? 'sayim' : (isYonetici ? 'kullanicilar' : 'profil'))
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const tabs = [
    { id: 'profil', label: 'Profil', icon: 'person' },
    ...(activeSessionId ? [{ id: 'sayim', label: 'Sayım Ayarları', icon: 'tune' }] : []),
    ...(isYonetici ? [{ id: 'kullanicilar', label: 'Kullanıcılar', icon: 'group' }] : []),
    ...(isYonetici ? [{ id: 'masterdata', label: 'Masterdata', icon: 'inventory_2' }] : []),
    ...(isSuperAdmin ? [{ id: 'firmalar', label: 'Firma Yönetimi', icon: 'domain' }] : []),
  ]

  useEffect(() => {
    if (!activeSessionId && tab === 'sayim') setTab(isYonetici ? 'kullanicilar' : 'profil')
  }, [activeSessionId, tab, isYonetici])

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Ayarlar</h1>
      <p className="text-sm text-slate-500 mb-5">
        {tab === 'profil'
          ? 'Ad soyadınızı ve şifrenizi güncelleyin.'
          : tab === 'sayim'
          ? 'Aktif sayım oturumu bilgilerini düzenleyin.'
          : tab === 'kullanicilar'
          ? 'Kullanıcı hesapları oluşturun ve rollerini yönetin.'
          : tab === 'masterdata'
          ? 'Manuel giriş doğrulaması için kullanılan SKU ve lokasyon referans listeleri.'
          : tab === 'firmalar'
          ? 'Sisteme yeni firma ekleyin, mevcut firmaları düzenleyin.'
          : 'Bu bölüme erişmek için önce bir sayım oturumu seçin.'}
      </p>

      {/* Tab bar */}
      {tabs.length > 0 && (
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ' +
              (tab === t.id ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700')
            }>
            <span className="ms" style={{ fontSize: 16 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      )}

      {tabs.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 max-w-lg">
          Bu bölüme erişmek için önce bir sayım oturumu seçin.
        </div>
      )}

      {/* Tab içerikleri */}
      {tab === 'profil' && <ProfilPanel />}

      {tab === 'sayim' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col gap-4 max-w-lg">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Depo Kodu / Depo Adı / Blok Numarası</label>
            <input type="text" value={session.depoAdi || ''}
              onChange={e => setSession({ depoAdi: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sayım Başlığı</label>
            <input type="text" value={session.sayimBasligi || ''}
              onChange={e => setSession({ sayimBasligi: e.target.value })}
              placeholder="Örn: YIL SONU SAYIM"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sorumlu Kişi</label>
            <input type="text" value={session.sorumlu || ''}
              onChange={e => setSession({ sorumlu: e.target.value })}
              placeholder="Ad Soyad"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sayım Tarihi</label>
            <input type="date" value={session.tarih || ''}
              onChange={e => setSession({ tarih: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 mono focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-colors" />
          </div>
          <button onClick={handleSave}
            className={
              'w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ' +
              (saved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white')
            }>
            <span className="ms" style={{ fontSize: 18 }}>{saved ? 'check_circle' : 'save'}</span>
            {saved ? 'Kaydedildi!' : 'Kaydet'}
          </button>
        </div>
      )}

      {tab === 'kullanicilar' && isYonetici && <KullaniciTab />}

      {tab === 'masterdata' && isYonetici && (
        <div className="max-w-lg">
          <FirmaMasterdataPanel firma={firmaProfile} />
        </div>
      )}

      {tab === 'firmalar' && isSuperAdmin && <FirmaYonetimi />}
    </div>
  )
}
