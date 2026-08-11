import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Toast from './components/shared/Toast.jsx'

// Material Symbols font gerçekten yüklenince ms-loaded ekle.
// fonts.load() font kayıtlı değilse hemen resolve ettiği için polling kullanıyoruz.
function waitForMsFont() {
  if (document.fonts.check('20px "Material Symbols Rounded"')) {
    document.body.classList.add('ms-loaded')
  } else {
    requestAnimationFrame(waitForMsFont)
  }
}
requestAnimationFrame(waitForMsFont)
// 5 saniye sonra her halükarda göster (offline / yavaş ağ güvencesi)
setTimeout(() => document.body.classList.add('ms-loaded'), 5000)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {/* App'in dışında: tüm ekranlarda (sayımcı ekranı, modal açıkken de) aynı
        yerde görünen sabit bildirim katmanı — layout'u etkilemez. */}
    <Toast />
  </StrictMode>,
)
