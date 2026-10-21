import { useState } from 'react'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../../firebase/index'

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch {
      setError('E-posta veya şifre hatalı')
    } finally {
      setLoading(false)
    }
  }

  async function handleReset() {
    if (!email) { setError('Şifre sıfırlama için önce e-posta adresinizi girin.'); return }
    setResetLoading(true)
    setError('')
    try {
      await sendPasswordResetEmail(auth, email)
      setResetSent(true)
    } catch {
      setError('Sıfırlama e-postası gönderilemedi. E-posta adresini kontrol edin.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <span className="ms text-white" style={{ fontSize: 22 }}>warehouse</span>
          </div>
          <div className="text-slate-900 font-bold text-sm leading-tight tracking-tight">Sayım Planı</div>
        </div>

        {/* Kart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs">
          <h1 className="text-slate-800 font-semibold text-lg mb-6 text-center">Giriş Yap</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-slate-500 text-xs font-medium mb-1.5">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ornek@sirket.com"
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-3 text-slate-900 text-base placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-slate-500 text-xs font-medium mb-1.5">Şifre</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-3 text-slate-900 text-base placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            {resetSent && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-emerald-700 text-sm text-center">
                Sıfırlama bağlantısı e-posta adresinize gönderildi.
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading
                ? <span className="ms animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
                : <span className="ms" style={{ fontSize: 18 }}>login</span>
              }
              {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={resetLoading}
              className="w-full text-slate-400 hover:text-slate-600 text-xs text-center transition-colors disabled:opacity-40"
            >
              {resetLoading ? 'Gönderiliyor…' : 'Şifremi unuttum'}
            </button>
          </form>
        </div>

        <div className="flex items-start gap-2.5 mt-6 px-1">
          <span className="ms text-slate-400 shrink-0" style={{ fontSize: 18 }}>shield_lock</span>
          <p className="text-slate-400 text-xs leading-relaxed">
            <span className="font-semibold text-slate-500">Güvenlik Protokolü:</span> Bu sistem Google Firebase Authentication altyapısı ile korunmaktadır. Erişim yalnızca yetkili personelle sınırlıdır, tüm oturumlar endüstri standardı güvenlik protokolleriyle şifrelenir.
          </p>
        </div>
      </div>
    </div>
  )
}
