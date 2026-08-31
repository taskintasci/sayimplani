import { useShallow } from 'zustand/react/shallow'
import useStore from '../../store/useStore'

const PAGE_NAMES = {
  giris: 'Sayımlar',
  panel: 'Panel',
  upload: 'Excel Yükle',
  sayim: 'Stok Sayımı',
  skuliste: 'SKU Listesi',
  rafliste: 'Raf Listesi',
  kor: 'Kör Sayım',
  rapor: 'Rapor',
  analiz: 'Sayım Analizi',
  ayarlar: 'Ayarlar',
  koranaliz: 'Kör Sayım Analizi',
  korrapor: 'Kör Sayım Raporu',
  koridorsayim: 'Kör Raf Sayımı',
  koridoranaliz: 'Kör Raf Sayım Analizi',
  koridorrapor: 'Kör Raf Sayım Raporu',
  hareketlilik: 'Hareketlilik Sayımı',
  membran: 'Membran Sayımı',
  sayimciekran: 'Sayımcı Ekranı',
  antrepopanel: 'Panel',
  antreposayim: 'Stok Sayımı',
  antrepoanaliz: 'Sayım Analizi',
  antreporapor: 'Sayım Raporu',
  antreposkuliste: 'SKU Listesi',
  antreporafliste: 'Raf Listesi',
  antrepokor: 'Kör Sayım',
  antrepokoranaliz: 'Kör Sayım Analizi',
  antrepokorrapor: 'Kör Sayım Raporu',
  antrepokoridorsayim: 'Kör Raf Sayımı',
  antrepokoridoranaliz: 'Kör Raf Sayım Analizi',
  antrepokoridorrapor: 'Kör Raf Sayım Raporu',
  redbullpanel: 'Panel',
  redbullsayim: 'Tüm Stok Sayımı',
  redbullanaliz: 'Sayım Analizi',
  redbullrapor: 'Sayım Raporu',
  redbullskuliste: 'SKU Listesi',
  redbullrafliste: 'Raf Listesi',
  redbullkor: 'Kör Sayım',
  redbullkoranaliz: 'Kör Sayım Analizi',
  redbullkorrapor: 'Kör Sayım Raporu',
  redbullkoridorsayim: 'Kör Raf Sayımı',
  redbullkoridoranaliz: 'Kör Raf Sayım Analizi',
  redbullkoridorrapor: 'Kör Raf Sayım Raporu',
}

export default function TopBar({ activePage, onMenu }) {
  const { session, activeSessionId } = useStore(
    useShallow(s => ({ session: s.session, activeSessionId: s.activeSessionId }))
  )
  const pageName = PAGE_NAMES[activePage] || activePage
  const aktifSayim = activeSessionId ? (session || {}) : {}

  return (
    <header className="h-10 shrink-0 bg-white border-b border-slate-200 flex items-center px-3 md:px-5 gap-2 text-sm text-slate-500 min-w-0">
      <button
        onClick={onMenu}
        className="md:hidden w-10 h-10 -ml-2 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 shrink-0"
        aria-label="Menüyü aç"
      >
        <span className="ms" style={{ fontSize: 20 }}>menu</span>
      </button>
      <span className="text-slate-800 font-semibold whitespace-nowrap">{pageName}</span>
      {aktifSayim.type && (
        <>
          <span className="text-slate-300">·</span>
          <span className="truncate">{aktifSayim.type}</span>
        </>
      )}
      {aktifSayim.tarih && (
        <>
          <span className="text-slate-300 hidden sm:inline">·</span>
          <span className="mono text-xs hidden sm:inline">{aktifSayim.tarih}</span>
        </>
      )}
      {aktifSayim.depoAdi && (
        <>
          <span className="text-slate-300 hidden sm:inline">·</span>
          <span className="hidden sm:inline truncate">{aktifSayim.depoAdi}</span>
        </>
      )}
    </header>
  )
}
