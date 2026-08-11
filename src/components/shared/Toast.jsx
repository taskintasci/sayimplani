import useStore from '../../store/useStore'

// Sayfanın altında beliren kısa bildirim (ör. "Manuel stok eklendi").
// Global olarak main.jsx'te App'in yanında render edilir — böylece hem
// yönetici sayfalarında hem sayımcı ekranında, modal açıkken bile görünür.
// Yazdırmada gizli, ekran okuyucuya aria-live ile duyurulur.
export default function Toast() {
  const toast     = useStore(s => s.toast)
  const hideToast = useStore(s => s.hideToast)

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pointer-events-none print:hidden"
      aria-live="polite"
      aria-atomic="true"
    >
      {toast && (
        <button
          key={toast.id}
          type="button"
          onClick={hideToast}
          className={`toast-pop btn-press pointer-events-auto max-w-[92vw] flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-[13px] font-medium text-white ${
            toast.tone === 'error' ? 'bg-red-600' : 'bg-slate-900'
          }`}
        >
          <span
            className={`ms ${toast.tone === 'error' ? 'text-white' : 'text-emerald-400'}`}
            style={{ fontSize: 18 }}
          >
            {toast.tone === 'error' ? 'error' : 'check_circle'}
          </span>
          <span className="truncate">{toast.text}</span>
        </button>
      )}
    </div>
  )
}
