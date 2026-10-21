import { useShallow } from 'zustand/react/shallow'
import useStore from '../../store/useStore'
import FirmaSwitcher from './FirmaSwitcher'
import UserMenu from './UserMenu'
import Logo from './Logo'

// Aktif sayım oturumu yokken (Sayımlar listesi / Ayarlar) kullanılan sade
// üst bilgi çubuğu — bu ekranlarda oturum-bağımlı menü öğeleri olmadığından
// tam Sidebar yerine tek satırlık bir header yeterli ve daha az yer kaplar.
export default function GirisHeader({ activePage, onNavigate }) {
  const { userRole } = useStore(
    useShallow(s => ({ userRole: s.userRole }))
  )

  // Ayarlar'a erişim: yönetici/kontrolcü/süper yönetici (kontrolcü sadece
  // kendi Profil sekmesini görür, Kullanıcılar/Masterdata/Firma Yönetimi
  // Ayarlar içinde zaten ayrıca role-gated).
  const ayarlarErisebilir = userRole === 'yonetici' || userRole === 'kontrolcu' || userRole === 'superadmin'

  return (
    <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 gap-3">
      <Logo onClick={() => onNavigate('giris')} />

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <FirmaSwitcher
          onNavigate={onNavigate}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-[12px] text-slate-700 bg-white focus:outline-hidden focus:border-blue-400"
        />

        {ayarlarErisebilir && (
          <button
            onClick={() => onNavigate('ayarlar')}
            className={
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ' +
              (activePage === 'ayarlar'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50')
            }
          >
            <span className="ms" style={{ fontSize: 16 }}>settings</span>
            Ayarlar
          </button>
        )}

        <UserMenu variant="header" />
      </div>
    </header>
  )
}
