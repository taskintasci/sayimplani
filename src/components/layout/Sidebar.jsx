import { useShallow } from 'zustand/react/shallow'
import useStore from '../../store/useStore'
import { SABLON } from '../../constants'
import UserMenu from './UserMenu'
import Logo from './Logo'

function NavBtn({ item, activePage, onNavigate }) {
  const active = activePage === item.id
  return (
    <button
      onClick={() => onNavigate(item.id)}
      className={
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[13px] transition-all ' +
        (active
          ? 'bg-blue-50 text-blue-700 font-semibold'
          : 'text-slate-600 hover:bg-slate-50 font-normal')
      }
    >
      <span className="ms" style={{ fontSize: 17 }}>{item.icon}</span>
      <span className="leading-tight">{item.label}</span>
    </button>
  )
}

function Divider() {
  return <div className="my-1.5 border-t border-slate-100" />
}

const YON      = ['yonetici', 'superadmin']
const YON_KONT = ['yonetici', 'kontrolcu', 'superadmin']

// Menü öğeleri — her birinin hangi rollere ve hangi firma şablonuna
// görüneceği tanımlı. sablon belirtilmemişse şablondan bağımsız (paylaşılan).
const MENU = [
  { id: 'panel',        icon: 'grid_view',      label: 'Panel',                   roles: YON_KONT, sablon: [SABLON.STANDART] },
  { divider: true,      roles: YON_KONT },
  { id: 'sayim',        icon: 'fact_check',     label: 'Tüm Stok Sayımı',         roles: YON, sablon: [SABLON.STANDART] },
  { id: 'analiz',       icon: 'monitoring',     label: 'Tüm Stok Sayım Analizi',  roles: YON_KONT, sablon: [SABLON.STANDART] },
  { id: 'rapor',        icon: 'analytics',      label: 'Tüm Stok Rapor',          roles: YON_KONT, sablon: [SABLON.STANDART] },
  { divider: true,      roles: YON_KONT },
  { id: 'skuliste',     icon: 'checklist',      label: 'SKU Listesi',             roles: YON, sablon: [SABLON.STANDART] },
  { id: 'kor',          icon: 'visibility_off', label: 'Kör Stok Sayımı',         roles: YON, sablon: [SABLON.STANDART] },
  { id: 'koranaliz',    icon: 'query_stats',    label: 'Kör Stok Sayım Analizi',  roles: YON_KONT, sablon: [SABLON.STANDART] },
  { id: 'korrapor',     icon: 'summarize',      label: 'Kör Stok Sayım Raporu',   roles: YON_KONT, sablon: [SABLON.STANDART] },
  { divider: true,      roles: YON },
  { id: 'hareketlilik', icon: 'trending_up',    label: 'Hareketlilik Sayımı',     roles: YON, sablon: [SABLON.STANDART] },
  { id: 'membran',      icon: 'layers',         label: 'Membran Sayımı',          roles: YON, sablon: [SABLON.STANDART] },
  { divider: true,      roles: YON_KONT },
  { id: 'antrepopanel',     icon: 'grid_view',       label: 'Panel',                  roles: YON_KONT, sablon: [SABLON.WMS31] },
  { id: 'antreposayim',     icon: 'fact_check',      label: 'Stok Sayımı',            roles: YON, sablon: [SABLON.WMS31] },
  { id: 'antrepoanaliz',    icon: 'monitoring',      label: 'Sayım Analizi',          roles: YON_KONT, sablon: [SABLON.WMS31] },
  { id: 'antreporapor',     icon: 'analytics',       label: 'Sayım Raporu',           roles: YON_KONT, sablon: [SABLON.WMS31] },
  { id: 'antreposkuliste',  icon: 'checklist',       label: 'SKU Listesi',            roles: YON, sablon: [SABLON.WMS31] },
  { id: 'antrepokor',       icon: 'visibility_off',  label: 'Kör Sayımı',             roles: YON, sablon: [SABLON.WMS31] },
  { id: 'antrepokoranaliz', icon: 'query_stats',     label: 'Kör Sayım Analizi',      roles: YON_KONT, sablon: [SABLON.WMS31] },
  { id: 'antrepokorrapor',  icon: 'summarize',       label: 'Kör Sayım Raporu',       roles: YON_KONT, sablon: [SABLON.WMS31] },
  { divider: true,      roles: YON_KONT },
  { id: 'redbullpanel',     icon: 'grid_view',       label: 'Panel',                  roles: YON_KONT, sablon: [SABLON.WMS_REDBULL] },
  { id: 'redbullsayim',     icon: 'fact_check',      label: 'Tüm Stok Sayımı',        roles: YON, sablon: [SABLON.WMS_REDBULL] },
  { id: 'redbullanaliz',    icon: 'monitoring',      label: 'Sayım Analizi',          roles: YON_KONT, sablon: [SABLON.WMS_REDBULL] },
  { id: 'redbullrapor',     icon: 'analytics',       label: 'Sayım Raporu',           roles: YON_KONT, sablon: [SABLON.WMS_REDBULL] },
  { id: 'redbullskuliste',  icon: 'checklist',       label: 'SKU Listesi',            roles: YON, sablon: [SABLON.WMS_REDBULL] },
  { id: 'redbullkor',       icon: 'visibility_off',  label: 'Kör Sayım',              roles: YON, sablon: [SABLON.WMS_REDBULL] },
  { id: 'redbullkoranaliz', icon: 'query_stats',     label: 'Kör Sayım Analizi',      roles: YON_KONT, sablon: [SABLON.WMS_REDBULL] },
  { id: 'redbullkorrapor',  icon: 'summarize',       label: 'Kör Sayım Raporu',       roles: YON_KONT, sablon: [SABLON.WMS_REDBULL] },
  { divider: true,      roles: YON_KONT },
  { id: 'sayimciekran', icon: 'swipe',          label: 'Sayımcı Ekranı',          roles: YON_KONT },
]

export default function Sidebar({ activePage, onNavigate, className = 'flex' }) {
  const { activeSessionId, setActiveSession, userRole, firmaProfile } = useStore(
    useShallow(s => ({
      activeSessionId: s.activeSessionId, setActiveSession: s.setActiveSession, userRole: s.userRole,
      firmaProfile: s.firmaProfile,
    }))
  )

  const currentSablon = firmaProfile?.sablon

  function handleLogoClick() {
    setActiveSession(null)
    onNavigate('giris')
  }

  // Rol + şablon + oturum-bağımlılığı filtrelemesi, ardından ardışık/baştaki divider'ları temizle
  const visible = MENU.filter(m =>
    m.roles.includes(userRole) &&
    (!m.sablon || !currentSablon || m.sablon.includes(currentSablon)) &&
    (m.sessionless || activeSessionId)
  )
  const cleaned = visible.filter((m, i) => {
    if (!m.divider) return true
    const prev = visible[i - 1]
    return prev && !prev.divider   // baştaki ve ardışık divider'ları at
  })

  return (
    <aside className={`w-56 shrink-0 bg-white border-r border-slate-200 ${className} flex-col h-full`}>
      {/* Logo — tıklanınca aktif oturumdan çıkıp Sayımlar listesine döner */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <Logo onClick={handleLogoClick} />
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
        {cleaned.map((m, i) =>
          m.divider
            ? <Divider key={'d' + i} />
            : <NavBtn key={m.id} item={m} activePage={activePage} onNavigate={onNavigate} />
        )}
      </nav>

      {/* Kullanıcı */}
      <div className="px-5 pb-3 pt-3 border-t border-slate-100">
        <UserMenu variant="sidebar" />

        {/* Ayarlar linki — yönetici/kontrolcü/süper yönetici (kontrolcü sadece
            kendi Profil sekmesini görür, Kullanıcılar/Masterdata/Firma
            Yönetimi Ayarlar içinde zaten ayrıca role-gated) */}
        {(userRole === 'yonetici' || userRole === 'kontrolcu' || userRole === 'superadmin') && (
          <button
            onClick={() => onNavigate('ayarlar')}
            className={
              'mt-2 w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] transition-all ' +
              (activePage === 'ayarlar'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50')
            }
          >
            <span className="ms" style={{ fontSize: 15 }}>settings</span>
            Ayarlar
          </button>
        )}
      </div>
    </aside>
  )
}
