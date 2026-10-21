import { useShallow } from 'zustand/react/shallow'
import useStore from '../../store/useStore'

// Uygulama logosu (ikon + "Sayım Planı" + aktif firma adı) — hem Sidebar
// hem GirisHeader'da aynı görsel dille kullanılıyor, tek yerden bakımı
// kolaylaştırıyor ve iki bileşen arasındaki hizalama tutarsızlığını önlüyor.
export default function Logo({ onClick }) {
  const { firmaProfile } = useStore(useShallow(s => ({ firmaProfile: s.firmaProfile })))

  return (
    <button onClick={onClick} className="flex items-center gap-2.5 min-w-0">
      <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-xs shadow-blue-600/30">
        <span className="ms text-white" style={{ fontSize: 19 }}>warehouse</span>
      </div>
      <div className="text-left leading-tight min-w-0">
        <div className="font-bold text-slate-900 text-sm truncate">Sayım Planı</div>
        {firmaProfile?.ad && (
          <div className="text-[11px] text-slate-400 truncate">{firmaProfile.ad}</div>
        )}
      </div>
    </button>
  )
}
