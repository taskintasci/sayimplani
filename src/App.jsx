import { lazy, Suspense, useState, useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { useShallow } from 'zustand/react/shallow'
import { auth } from './firebase/index'
import useStore from './store/useStore'
import { SABLON } from './constants'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import GirisHeader from './components/layout/GirisHeader'
import FirmaMasterdataPanel from './components/pages/FirmaMasterdataPanel'

const Login           = lazy(() => import('./components/pages/Login'))
const Giris           = lazy(() => import('./components/pages/Giris'))
const Panel           = lazy(() => import('./components/pages/Panel'))
const ExcelYukle      = lazy(() => import('./components/pages/ExcelYukle'))
const StokSayim       = lazy(() => import('./components/pages/StokSayim'))
const KorSayim        = lazy(() => import('./components/pages/KorSayim'))
const SkuListesi      = lazy(() => import('./components/pages/SkuListesi'))
const Rapor           = lazy(() => import('./components/pages/Rapor'))
const SayimAnalizi    = lazy(() => import('./components/pages/SayimAnalizi'))
const KorSayimAnalizi = lazy(() => import('./components/pages/KorSayimAnalizi'))
const KorSayimRapor       = lazy(() => import('./components/pages/KorSayimRapor'))
const HareketlilikSayim   = lazy(() => import('./components/pages/HareketlilikSayim'))
const MembranSayim        = lazy(() => import('./components/pages/MembranSayim'))
const Ayarlar             = lazy(() => import('./components/pages/Ayarlar'))
const SayimciEkran        = lazy(() => import('./components/pages/SayimciEkran'))
const AntrepoPanel        = lazy(() => import('./components/pages/AntrepoPanel'))
const AntrepoSayim        = lazy(() => import('./components/pages/AntrepoSayim'))
const AntrepoRapor        = lazy(() => import('./components/pages/AntrepoRapor'))
const AntrepoKorSayim     = lazy(() => import('./components/pages/AntrepoKorSayim'))
const AntrepoKorSayimRapor = lazy(() => import('./components/pages/AntrepoKorSayimRapor'))
const RedbullPanel        = lazy(() => import('./components/pages/RedbullPanel'))
const RedbullSayim        = lazy(() => import('./components/pages/RedbullSayim'))
const RedbullRapor        = lazy(() => import('./components/pages/RedbullRapor'))
const RedbullKorSayim     = lazy(() => import('./components/pages/RedbullKorSayim'))
const RedbullKorSayimRapor = lazy(() => import('./components/pages/RedbullKorSayimRapor'))

// Oturum seçilmeden de erişilebilen sayfalar (Sidebar/TopBar kabuğu içinde)
const SESSIONLESS = ['giris', 'ayarlar']

const HEPSI = ['yonetici', 'kontrolcu', 'sayimci']
const YON       = ['yonetici', 'superadmin']              // yönetici yetkisi (süper yönetici her firmayı yönetebilir)
const YON_KONT  = ['yonetici', 'kontrolcu', 'superadmin']  // yönetici + kontrolcü yetkisi

// sablon: hangi firma şablonunda görünür (belirtilmemişse şablondan bağımsız/paylaşılan sayfa)
const PAGES = {
  giris:     { Component: Giris,            fullHeight: true,  roles: YON_KONT },
  panel:     { Component: Panel,            fullHeight: false, roles: YON_KONT, sablon: [SABLON.STANDART] },
  upload:    { Component: ExcelYukle,       fullHeight: false, roles: YON },
  sayim:     { Component: StokSayim,        fullHeight: true,  roles: YON, sablon: [SABLON.STANDART] },
  analiz:    { Component: SayimAnalizi,     fullHeight: false, roles: YON_KONT, sablon: [SABLON.STANDART] },
  rapor:     { Component: Rapor,            fullHeight: false, roles: YON_KONT, sablon: [SABLON.STANDART] },
  skuliste:  { Component: SkuListesi,       fullHeight: true,  roles: YON, sablon: [SABLON.STANDART] },
  kor:       { Component: KorSayim,         fullHeight: true,  roles: YON, sablon: [SABLON.STANDART] },
  koranaliz: { Component: KorSayimAnalizi,  fullHeight: false, roles: YON_KONT, sablon: [SABLON.STANDART] },
  korrapor:      { Component: KorSayimRapor,      fullHeight: false, roles: YON_KONT, sablon: [SABLON.STANDART] },
  hareketlilik:  { Component: HareketlilikSayim,  fullHeight: true,  roles: YON, sablon: [SABLON.STANDART] },
  membran:       { Component: MembranSayim,       fullHeight: true,  roles: YON, sablon: [SABLON.STANDART] },
  ayarlar:       { Component: Ayarlar,            fullHeight: false, roles: YON_KONT },
  sayimciekran:  { Component: SayimciEkran,       fullHeight: true,  roles: [...HEPSI, 'superadmin'] },
  antrepopanel:     { Component: AntrepoPanel,         fullHeight: false, roles: YON_KONT, sablon: [SABLON.WMS31] },
  antreposayim:     { Component: AntrepoSayim,         fullHeight: true,  roles: YON, sablon: [SABLON.WMS31] },
  antrepoanaliz:    { Component: SayimAnalizi,         fullHeight: false, roles: YON_KONT, sablon: [SABLON.WMS31] },
  antreporapor:     { Component: AntrepoRapor,         fullHeight: false, roles: YON_KONT, sablon: [SABLON.WMS31] },
  antreposkuliste:  { Component: SkuListesi,           fullHeight: true,  roles: YON, sablon: [SABLON.WMS31] },
  antrepokor:       { Component: AntrepoKorSayim,      fullHeight: true,  roles: YON, sablon: [SABLON.WMS31] },
  antrepokoranaliz: { Component: KorSayimAnalizi,      fullHeight: false, roles: YON_KONT, sablon: [SABLON.WMS31] },
  antrepokorrapor:  { Component: AntrepoKorSayimRapor, fullHeight: false, roles: YON_KONT, sablon: [SABLON.WMS31] },
  redbullpanel:     { Component: RedbullPanel,         fullHeight: false, roles: YON_KONT, sablon: [SABLON.WMS_REDBULL] },
  redbullsayim:     { Component: RedbullSayim,         fullHeight: true,  roles: YON, sablon: [SABLON.WMS_REDBULL] },
  redbullanaliz:    { Component: SayimAnalizi,         fullHeight: false, roles: YON_KONT, sablon: [SABLON.WMS_REDBULL] },
  redbullrapor:     { Component: RedbullRapor,         fullHeight: false, roles: YON_KONT, sablon: [SABLON.WMS_REDBULL] },
  redbullskuliste:  { Component: SkuListesi,           fullHeight: true,  roles: YON, sablon: [SABLON.WMS_REDBULL] },
  redbullkor:       { Component: RedbullKorSayim,      fullHeight: true,  roles: YON, sablon: [SABLON.WMS_REDBULL] },
  redbullkoranaliz: { Component: KorSayimAnalizi,      fullHeight: false, roles: YON_KONT, sablon: [SABLON.WMS_REDBULL] },
  redbullkorrapor:  { Component: RedbullKorSayimRapor, fullHeight: false, roles: YON_KONT, sablon: [SABLON.WMS_REDBULL] },
}

function ErisimYok() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
      <span className="ms text-slate-300" style={{ fontSize: 56 }}>lock</span>
      <h2 className="text-slate-700 font-semibold text-lg mt-4">Erişim Yetkiniz Yok</h2>
      <p className="text-slate-400 text-sm mt-1">Bu sayfayı görüntüleme yetkiniz bulunmuyor.</p>
    </div>
  )
}

function Spinner() {
  return (
    <div className="h-screen flex items-center justify-center bg-slate-100">
      <span className="ms text-blue-400 animate-spin" style={{ fontSize: 40 }}>progress_activity</span>
    </div>
  )
}

function AuthErrorScreen({ message }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center text-center p-10 bg-slate-100 gap-4">
      <span className="ms text-slate-300" style={{ fontSize: 56 }}>error</span>
      <div>
        <h2 className="text-slate-700 font-semibold text-lg">Giriş Yapılamadı</h2>
        <p className="text-slate-400 text-sm mt-1 max-w-sm">{message}</p>
      </div>
      <button
        onClick={() => signOut(auth)}
        className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
      >
        Çıkış Yap
      </button>
    </div>
  )
}

function MasterdataEksikScreen({ userRole, firmaProfile }) {
  // Yönetici kendi firmasının masterdata'sını yükleyebildiği için burada
  // doğrudan yükleme paneli gösterilir (dead-end mesaj yerine) — sayaçlar
  // güncellenince firmaProfile reaktif olarak değişir ve bu ekran otomatik
  // kapanır. Kontrolcü/sayımcının bu yetkisi yok, sade mesaj görürler.
  if (userRole === 'yonetici' && firmaProfile) {
    return (
      <div className="h-screen overflow-y-auto bg-slate-100 flex flex-col items-center p-6 md:p-10">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <span className="ms text-amber-500" style={{ fontSize: 48 }}>inventory_2</span>
            <h2 className="text-slate-800 font-bold text-lg mt-2">Firma Kurulumu Tamamlanmadı</h2>
            <p className="text-slate-500 text-sm mt-1">
              Devam etmeden önce SKU Masterdata ve Lokasyon listelerini yükleyin.
            </p>
          </div>
          <FirmaMasterdataPanel firma={firmaProfile} />
          <button
            onClick={() => signOut(auth)}
            className="w-full mt-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
          >
            Çıkış Yap
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center text-center p-10 bg-slate-100 gap-4">
      <span className="ms text-slate-300" style={{ fontSize: 56 }}>inventory_2</span>
      <div>
        <h2 className="text-slate-700 font-semibold text-lg">Firma Kurulumu Tamamlanmadı</h2>
        <p className="text-slate-400 text-sm mt-1 max-w-sm">
          Bu firma için SKU Masterdata ve/veya Lokasyon listesi henüz yüklenmedi.
          Lütfen süper yöneticinizden bu dosyaları yüklemesini isteyin.
        </p>
      </div>
      <button
        onClick={() => signOut(auth)}
        className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
      >
        Çıkış Yap
      </button>
    </div>
  )
}

export default function App() {
  // undefined = henüz kontrol edilmedi, null = giriş yok, object = giriş yapılmış
  const [firebaseUser, setFirebaseUser] = useState(undefined)
  const {
    setCurrentUser, loadUserProfile, userRole, profileLoading, authError,
    activeSessionId, rows, rowsLoading, firmaProfile,
  } = useStore(
    useShallow(s => ({
      setCurrentUser:  s.setCurrentUser,
      loadUserProfile: s.loadUserProfile,
      userRole:        s.userRole,
      profileLoading:  s.profileLoading,
      authError:       s.authError,
      activeSessionId: s.activeSessionId,
      rows:            s.rows,
      rowsLoading:     s.rowsLoading,
      firmaProfile:    s.firmaProfile,
    }))
  )
  const [activePage, setActivePage] = useState('panel')
  const [menuOpen, setMenuOpen] = useState(false)

  function handleNavigate(page) { setActivePage(page); setMenuOpen(false) }

  useEffect(() => {
    return onAuthStateChanged(auth, user => {
      setFirebaseUser(user)
      setCurrentUser(user)
      loadUserProfile(user)
    })
  }, [])

  // Oturum değiştiğinde satır yoksa upload sayfasına yönlendir (yalnızca yönetici)
  useEffect(() => {
    if (userRole === 'sayimci') return
    if (!activeSessionId) return
    if (rowsLoading) return
    if (rows.length === 0 && (userRole === 'yonetici' || userRole === 'superadmin')) {
      setActivePage('upload')
    }
  }, [activeSessionId, rowsLoading, rows.length, userRole])

  // Aktif firmanın şablonu değiştiğinde (ilk yükleme veya süper yönetici
  // firma değiştirdiğinde), geçerli olmayan bir sayfadaysak o şablonun
  // varsayılan paneline yönlendir.
  useEffect(() => {
    if (!firmaProfile) return
    const pageDef = PAGES[activePage]
    const uygun = pageDef && (!pageDef.sablon || pageDef.sablon.includes(firmaProfile.sablon))
    if (!uygun) setActivePage(
      firmaProfile.sablon === SABLON.WMS31 ? 'antrepopanel' :
      firmaProfile.sablon === SABLON.WMS_REDBULL ? 'redbullpanel' : 'panel'
    )
  }, [firmaProfile?.sablon])

  // Auth durumu henüz belli değil
  if (firebaseUser === undefined) return <Spinner />

  // Giriş yapılmamış: doğrudan giriş ekranı — firma seçimi yok, hesap
  // hangi firmaya kayıtlıysa giriş sonrası o açılır (bkz. loadUserProfile).
  if (!firebaseUser) {
    return (
      <Suspense fallback={<Spinner />}>
        <Login />
      </Suspense>
    )
  }

  // Profil yüklenemedi (ör. hesap için bir admin tarafından oluşturulmuş
  // profil yok) — sonsuz spinner yerine net bir mesaj + çıkış imkanı göster.
  if (!profileLoading && authError) return <AuthErrorScreen message={authError} />

  // Profil/rol henüz yükleniyor
  if (profileLoading || !userRole) return <Spinner />

  // Firma için SKU Masterdata veya Lokasyon listesi yüklenmemişse (zorunlu
  // kurulum adımı) — süper yönetici hariç herkes engellenir, o Firma
  // Yönetimi'nden yükleyip düzeltebilir.
  if (userRole !== 'superadmin' && firmaProfile &&
      (!firmaProfile.skuMasterdataSayisi || !firmaProfile.lokasyonSayisi)) {
    return <MasterdataEksikScreen userRole={userRole} firmaProfile={firmaProfile} />
  }

  // Sayımcı: oturum seçimi ve sidebar yok — doğrudan tam ekran sayım akışı
  if (userRole === 'sayimci') {
    return (
      <Suspense fallback={<Spinner />}>
        <SayimciEkran mode="self" />
      </Suspense>
    )
  }

  // Aktif oturum yoksa (henüz seçilmemiş veya "Sayım Değiştir"/firma switcher
  // ile temizlenmiş) ve oturum gerektirmeyen bir sayfada değilsek, render
  // sırasında güvenli varsayılan (Sayımlar listesi) sayfaya düşülür. Bu bir
  // effect değil türetilmiş bir değerdir — state effect'i içinde setState
  // çağırıp ekstra bir render turu yaratmaz. Sidebar/GirisHeader'daki asıl
  // geçişler zaten onNavigate('giris') çağırıyor; bu sadece güvenlik ağıdır.
  const effectivePage = (!activeSessionId && !SESSIONLESS.includes(activePage)) ? 'giris' : activePage

  const page = PAGES[effectivePage] || PAGES.giris
  const { Component: PageComponent, fullHeight, roles, sablon } = page
  const sablonUygun = !sablon || !firmaProfile || sablon.includes(firmaProfile.sablon)
  const sessionUygun = SESSIONLESS.includes(effectivePage) || !!activeSessionId
  const yetkili = roles.includes(userRole) && sablonUygun && sessionUygun

  const icerik = (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-400 text-[13px]">Yükleniyor…</div>}>
      {!yetkili ? (
        <ErisimYok />
      ) : fullHeight ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          <PageComponent onNavigate={handleNavigate} mode="preview" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <PageComponent onNavigate={handleNavigate} />
          </div>
        </div>
      )}
    </Suspense>
  )

  // Aktif sayım oturumu yok: tam Sidebar yerine sade bir üst bilgi çubuğu
  // (Sayımlar listesi/Ayarlar'da oturuma özel menü öğelerine gerek yok).
  if (!activeSessionId) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-slate-100">
        <GirisHeader activePage={effectivePage} onNavigate={handleNavigate} />
        <div className="flex-1 flex flex-col overflow-hidden">
          {icerik}
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden bg-slate-100">
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 shadow-xl">
            <Sidebar activePage={effectivePage} onNavigate={handleNavigate} />
          </div>
        </div>
      )}
      <Sidebar activePage={effectivePage} onNavigate={handleNavigate} className="hidden md:flex" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar activePage={effectivePage} onMenu={() => setMenuOpen(true)} />
        {icerik}
      </div>
    </div>
  )
}
