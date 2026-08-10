import { useState, useEffect } from 'react'
import useStore from '../../store/useStore'
import { SABLON } from '../../constants'
import FirmaMasterdataModal from './FirmaMasterdataModal'

const SABLON_OPTIONS = [
  { id: SABLON.STANDART,    label: 'LOS Sayım',                desc: 'Tüm Stok Sayımı, Kör Sayım, Hareketlilik, Membran sayfa ailesi (RAPOR5 / SKU)' },
  { id: SABLON.WMS31,       label: 'WMS Antrepo Sayım',        desc: 'Palet barkodu / beyanname bazlı depo sayım sayfa ailesi (WMS_Rapor_31)' },
  { id: SABLON.WMS_REDBULL, label: 'WMS Depo Sayım (Redbull)', desc: 'Bina/Koridor/Sutun/Sıra/Kat adres bazlı depo sayım sayfa ailesi' },
]

const EMPTY_FORM = { ad: '', unvan: '', sablon: SABLON.STANDART }

export default function FirmaYonetimi() {
  const { firmalar, loadFirmalar, createFirma, updateFirma } = useStore()
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [masterdataFirmaId, setMasterdataFirmaId] = useState(null)

  useEffect(() => { loadFirmalar().finally(() => setLoading(false)) }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    if (!form.ad.trim()) { setError('Firma adı gerekli.'); return }
    setSaving(true)
    try {
      const id = await createFirma({ ad: form.ad.trim(), unvan: form.unvan.trim(), sablon: form.sablon })
      setForm(EMPTY_FORM)
      // Yeni firma için SKU Masterdata + Lokasyon yüklemesi zorunlu — süper
      // yönetici oluşturduktan hemen sonra bu adıma yönlendirilir.
      setMasterdataFirmaId(id)
    } catch (err) {
      setError('Firma oluşturulamadı: ' + (err?.message || ''))
    } finally {
      setSaving(false)
    }
  }

  function startEdit(f) {
    setEditingId(f.id)
    setEditForm({ ad: f.ad || '', unvan: f.unvan || '', sablon: f.sablon || SABLON.STANDART })
    setEditError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError('')
  }

  async function handleEditSave(id) {
    setEditError('')
    if (!editForm.ad.trim()) { setEditError('Firma adı gerekli.'); return }
    setEditSaving(true)
    try {
      await updateFirma(id, { ad: editForm.ad.trim(), unvan: editForm.unvan.trim(), sablon: editForm.sablon })
      setEditingId(null)
    } catch (err) {
      setEditError('Kaydedilemedi: ' + (err?.message || ''))
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div>

      {/* Yeni firma formu */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <span className="ms text-blue-500" style={{ fontSize: 18 }}>add_business</span>
          Yeni Firma Ekle
        </h3>
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Firma Adı</label>
            <input type="text" value={form.ad}
              onChange={e => setForm(f => ({ ...f, ad: e.target.value }))}
              placeholder="Örn: Yeni Firma A.Ş."
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Yasal Unvan (yazdırma/export'ta kullanılır)</label>
            <input type="text" value={form.unvan}
              onChange={e => setForm(f => ({ ...f, unvan: e.target.value }))}
              placeholder="Örn: YENİ FİRMA SAN. TİC. A.Ş."
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sayım Şablonu</label>
            <div className="flex flex-col gap-2">
              {SABLON_OPTIONS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, sablon: s.id }))}
                  className={
                    'flex items-center gap-3 p-3 rounded-xl border text-left transition-all ' +
                    (form.sablon === s.id
                      ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400'
                      : 'bg-white border-slate-200 hover:border-slate-300')
                  }
                >
                  <div className="flex-1">
                    <div className="text-slate-800 text-sm font-medium">{s.label}</div>
                    <div className="text-slate-400 text-xs">{s.desc}</div>
                  </div>
                  {form.sablon === s.id && <span className="ms text-blue-500" style={{ fontSize: 18 }}>check_circle</span>}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="col-span-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">{error}</div>}
          <div className="col-span-2">
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors">
              <span className={'ms ' + (saving ? 'animate-spin' : '')} style={{ fontSize: 18 }}>
                {saving ? 'progress_activity' : 'add'}
              </span>
              {saving ? 'Oluşturuluyor…' : 'Firma Oluştur'}
            </button>
          </div>
        </form>
      </div>

      {/* Firma listesi */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <span className="ms text-slate-400" style={{ fontSize: 18 }}>domain</span>
          <span className="text-sm font-semibold text-slate-700">Firmalar</span>
          <span className="badge bg-slate-100 text-slate-500">{firmalar.length}</span>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
            <span className="ms animate-spin" style={{ fontSize: 18 }}>progress_activity</span> Yükleniyor…
          </div>
        ) : firmalar.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">Henüz firma yok.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-2.5 text-left font-semibold">Firma Adı</th>
                <th className="px-5 py-2.5 text-left font-semibold">Unvan</th>
                <th className="px-5 py-2.5 text-left font-semibold">Şablon</th>
                <th className="px-5 py-2.5 text-right font-semibold">Durum</th>
                <th className="px-5 py-2.5 text-right font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {firmalar.map(f => editingId === f.id ? (
                <tr key={f.id} className="bg-blue-50/40">
                  <td className="px-5 py-3">
                    <input type="text" value={editForm.ad}
                      onChange={e => setEditForm(x => ({ ...x, ad: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" />
                  </td>
                  <td className="px-5 py-3">
                    <input type="text" value={editForm.unvan}
                      onChange={e => setEditForm(x => ({ ...x, unvan: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" />
                  </td>
                  <td className="px-5 py-3">
                    <select value={editForm.sablon}
                      onChange={e => setEditForm(x => ({ ...x, sablon: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200">
                      {SABLON_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-slate-300">—</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => handleEditSave(f.id)} disabled={editSaving}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[11px] font-semibold rounded-md">
                        {editSaving ? 'Kaydediliyor…' : 'Kaydet'}
                      </button>
                      <button onClick={cancelEdit} className="px-2.5 py-1 text-slate-400 hover:text-slate-600 text-[11px] rounded-md">İptal</button>
                    </div>
                    {editError && <div className="mt-1 text-[11px] text-red-600 text-right">{editError}</div>}
                  </td>
                </tr>
              ) : (
                <tr key={f.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-800">{f.ad}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{f.unvan || '—'}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{SABLON_OPTIONS.find(s => s.id === f.sablon)?.label || f.sablon}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => updateFirma(f.id, { aktif: !(f.aktif !== false) })}
                      className={
                        'text-xs font-semibold rounded-full px-3 py-1 transition-colors ' +
                        (f.aktif !== false ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')
                      }
                    >
                      {f.aktif !== false ? 'Aktif' : 'Pasif'}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setMasterdataFirmaId(f.id)}
                        title="SKU Masterdata / Lokasyonlar"
                        className={
                          'w-7 h-7 inline-flex items-center justify-center rounded-lg transition-colors ' +
                          (!f.skuMasterdataSayisi || !f.lokasyonSayisi
                            ? 'text-red-500 hover:bg-red-50'
                            : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50')
                        }
                      >
                        <span className="ms" style={{ fontSize: 16 }}>inventory_2</span>
                      </button>
                      <button onClick={() => startEdit(f)}
                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <span className="ms" style={{ fontSize: 16 }}>edit</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="px-5 py-3 text-[11px] text-slate-400 border-t border-slate-50">
          Not: Pasif firmalar Firma Seçimi ekranında görünmez ama mevcut verileri korunur. Kalıcı silme desteklenmiyor.
        </p>
      </div>

      {masterdataFirmaId && (
        <FirmaMasterdataModal firmaId={masterdataFirmaId} onClose={() => setMasterdataFirmaId(null)} />
      )}
    </div>
  )
}
