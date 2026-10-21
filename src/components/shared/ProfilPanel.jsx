import { useState } from 'react'
import useStore from '../../store/useStore'

// Ad Soyad + şifre değiştirme — hem Ayarlar → Profil sekmesinde (yönetici/
// kontrolcü/süper yönetici) hem SayimciEkran'daki Profil modalında (sayımcı)
// aynı bileşen kullanılıyor.
export default function ProfilPanel() {
  const { userProfile, updateOwnProfile, changeOwnPassword } = useStore()

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '')
  const [savingName, setSavingName]   = useState(false)
  const [nameMsg, setNameMsg]         = useState('')
  const [nameErr, setNameErr]         = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [newPassword2, setNewPassword2]       = useState('')
  const [savingPass, setSavingPass]           = useState(false)
  const [passMsg, setPassMsg]                 = useState('')
  const [passErr, setPassErr]                 = useState('')

  async function handleSaveName(e) {
    e.preventDefault()
    setNameErr(''); setNameMsg('')
    if (!displayName.trim()) { setNameErr('Ad soyad boş olamaz.'); return }
    setSavingName(true)
    try {
      await updateOwnProfile({ displayName })
      setNameMsg('Kaydedildi.')
      setTimeout(() => setNameMsg(''), 2000)
    } catch {
      setNameErr('Kaydedilemedi, tekrar deneyin.')
    } finally {
      setSavingName(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPassErr(''); setPassMsg('')
    if (newPassword.length < 6) { setPassErr('Yeni şifre en az 6 karakter olmalı.'); return }
    if (newPassword !== newPassword2) { setPassErr('Yeni şifreler eşleşmiyor.'); return }
    setSavingPass(true)
    try {
      await changeOwnPassword({ currentPassword, newPassword })
      setPassMsg('Şifreniz güncellendi.')
      setCurrentPassword(''); setNewPassword(''); setNewPassword2('')
      setTimeout(() => setPassMsg(''), 2500)
    } catch (err) {
      const code = err?.code || ''
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') setPassErr('Mevcut şifre yanlış.')
      else if (code === 'auth/weak-password') setPassErr('Yeni şifre çok zayıf (en az 6 karakter).')
      else if (code === 'auth/too-many-requests') setPassErr('Çok fazla deneme yapıldı, birkaç dakika sonra tekrar deneyin.')
      else setPassErr('Şifre güncellenemedi, tekrar deneyin.')
    } finally {
      setSavingPass(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {/* Ad Soyad */}
      <form onSubmit={handleSaveName} className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <span className="ms text-blue-500" style={{ fontSize: 18 }}>badge</span>
          Ad Soyad
        </h3>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Ad Soyad"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
          />
          {nameErr && <div className="text-red-600 text-xs">{nameErr}</div>}
          {nameMsg && <div className="text-emerald-600 text-xs">{nameMsg}</div>}
          <button
            type="submit"
            disabled={savingName}
            className="self-start px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {savingName ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </form>

      {/* Şifre Değiştir */}
      <form onSubmit={handleChangePassword} className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <span className="ms text-blue-500" style={{ fontSize: 18 }}>lock_reset</span>
          Şifre Değiştir
        </h3>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Mevcut Şifre</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Yeni Şifre</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="En az 6 karakter"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Yeni Şifre (Tekrar)</label>
            <input
              type="password"
              value={newPassword2}
              onChange={e => setNewPassword2(e.target.value)}
              autoComplete="new-password"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
            />
          </div>
          {passErr && <div className="text-red-600 text-xs">{passErr}</div>}
          {passMsg && <div className="text-emerald-600 text-xs">{passMsg}</div>}
          <button
            type="submit"
            disabled={savingPass || !currentPassword || !newPassword || !newPassword2}
            className="self-start px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {savingPass ? 'Güncelleniyor…' : 'Şifreyi Güncelle'}
          </button>
        </div>
      </form>
    </div>
  )
}
