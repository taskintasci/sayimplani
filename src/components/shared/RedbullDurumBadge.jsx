export default function RedbullDurumBadge({ durum }) {
  if (!durum) return <span className="badge badge-normal">—</span>
  if (durum === 'Normal') return <span className="badge badge-normal">{durum}</span>
  return <span className="badge badge-bloke">{durum}</span>
}
