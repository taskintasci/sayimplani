import { create } from 'zustand'
import {
  collection, collectionGroup, doc, addDoc, getDoc, getDocs, updateDoc, setDoc, deleteDoc,
  onSnapshot, orderBy, query, where, serverTimestamp, writeBatch, limit,
  arrayUnion, arrayRemove, runTransaction,
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword, signOut as secondarySignOut,
  updateProfile, reauthenticateWithCredential, EmailAuthProvider, updatePassword,
} from 'firebase/auth'
import { auth, db, getSecondaryAuth } from '../firebase/index'
import { parseExcelFile } from '../utils/excelImport'
import {
  uploadRows, downloadRows,
  uploadSkuMasterdata, downloadSkuMasterdata,
  uploadLokasyonlar, downloadLokasyonlar,
} from '../firebase/rowStorage'
import { matchesKoridorKapsam } from '../utils/adresUtils'
import { firmaKisaKod, sayacId, sayimNoOlustur } from '../utils/sayimNo'

// ─── Dev-only error logger — prod'da hassas hata detayı loglanmaz ─────────
const devErr = (msg, err) => { if (import.meta.env.DEV) console.error(msg, err) }

// ─── Debounce map: keystroke → Firestore write ────────────────────────────
const writeTimers = new Map()

// ─── Sayım işlem logu (sessions/{id}/sayimLog) ────────────────────────────
// Sayımcının gerçekten sayıp saymadığını denetlemek için her miktar girişi
// ayrı, salt-ekleme bir log dokümanı olarak yazılır (results dokümanı yalnız
// SON yazanı tutuyor, geçmişi ve "Onayla mı / elle mi" ayrımını tutmuyor).
// updateResult debounce'lu olduğu için bir satırın yazım penceresi boyunca
// ilk görülen (önceki) miktar ve son eylem bilgisi burada bekletilir.
const logBekleyen = new Map()   // rowId → { onceki, eylem, ekran, gorevId, zaman }

const yazSayimLog = (sessionId, { zaman, ...entry }) => {
  const { currentUser, userProfile, userRole } = useStore.getState()
  if (!sessionId || !currentUser?.uid) return
  addDoc(collection(db, 'sessions', sessionId, 'sayimLog'), {
    ...entry,
    uid:   currentUser.uid,
    ad:    userProfile?.displayName || currentUser.email || '',
    rol:   userRole || '',
    istemciZamani: zaman || new Date(),   // işlemin cihazdaki anı (offline'da da doğru)
    sunucuZamani:  serverTimestamp(),     // sunucuya ulaştığı an
  }).catch(err => devErr('Sayım logu yazılamadı:', err))
}

// ─── Real-time unsubscribe handle'ları ────────────────────────────────────
// results: sessions/{id}/results alt koleksiyonu (sayım miktarları)
// sessionDoc: sessions/{id} dokümanının KENDİSİ — manuel kalemler
// (manualRows/korManualRows), kör sayım kod listesi ve durum burada tutuluyor;
// dinlenmediği sürece başka bir cihazın/tarayıcının eklediği manuel satır
// mevcut sekmede hiç görünmüyordu (sadece setActiveSession anında okunuyordu).
let resultsUnsub = null
let sessionUnsub = null
const stopSessionListeners = () => {
  if (resultsUnsub) { resultsUnsub(); resultsUnsub = null }
  if (sessionUnsub) { sessionUnsub(); sessionUnsub = null }
}

// Manuel satır id'si: aynı milisaniyede iki cihazdan eklenen satırların
// çakışmaması için zaman damgasına rastgele son ek — id çakışması silmede
// yanlış satırın uçmasına yol açardı.
const manualId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

// ─── Sayım numarası (bkz. utils/sayimNo.js) ───────────────────────────────
// Sayaç artırma + oturuma numara yazma TEK transaction'da: iki yönetici aynı
// anda sayım açsa/eski listeyi açsa bile aynı numara iki kez verilemez.
// `yeniData` verilirse oturum dokümanı numarasıyla birlikte OLUŞTURULUR;
// verilmezse mevcut dokümana (henüz numarası yoksa) numara eklenir.
const sayimNoAta = (sessionRef, { kod, tarih, yeniData = null }) =>
  runTransaction(db, async (tx) => {
    if (!yeniData) {
      const sSnap = await tx.get(sessionRef)
      if (!sSnap.exists()) return null
      if (sSnap.data().sayimNo) return sSnap.data().sayimNo
    }
    const sayacRef = doc(db, 'sayimNoSayac', sayacId(kod))
    const cSnap = await tx.get(sayacRef)
    const sira = (cSnap.exists() ? cSnap.data().son || 0 : 0) + 1
    const sayimNo = sayimNoOlustur(kod, tarih, sira)
    tx.set(sayacRef, { son: sira, guncelleme: serverTimestamp() })
    if (yeniData) tx.set(sessionRef, { ...yeniData, sayimNo })
    else tx.update(sessionRef, { sayimNo })
    return sayimNo
  })

let numaralamaSuruyor = null   // devam eden geriye dönük numaralama (promise)
const tarihOf = s => s.tarih || (s.createdAt?.toDate ? s.createdAt.toDate() : new Date())

// ─── Toast (sayfa altındaki kısa bildirim) zamanlayıcısı ──────────────────
let toastTimer = null

const useStore = create((set, get) => ({
  // ── Auth ──────────────────────────────────────────────────────────────────
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  // ── Kullanıcı profili & rol ───────────────────────────────────────────────
  userProfile: null,          // /users/{uid} dokümanı
  userRole: null,             // 'yonetici' | 'kontrolcu' | 'sayimci' | 'superadmin'
  profileLoading: false,
  authError: null,            // profil yüklenemediğinde kullanıcıya gösterilecek mesaj

  // ── Firma (çok kiracılı) ───────────────────────────────────────────────────
  firmalar: [],                // firmalar koleksiyonunun tamamı ({id,ad,unvan,sablon,aktif})
  firmaProfile: null,          // aktif firmanın kendi dokümanı
  activeFirma: null,           // normal kullanıcı: kendi firması; superadmin: seçtiği firma

  // Firma bazlı referans listeleri — manuel giriş doğrulaması için
  // (bkz. ManuelModal). Sadece süper yönetici (Firma Yönetimi) yükler/değiştirir.
  skuMasterdata: [],           // [{kod, ad, birim}]
  lokasyonlar: [],             // [adres, ...]

  loadFirmaMasterdata: async (firmaId) => {
    if (!firmaId) { set({ skuMasterdata: [], lokasyonlar: [] }); return }
    const [skuMasterdata, lokasyonlar] = await Promise.all([
      downloadSkuMasterdata(firmaId),
      downloadLokasyonlar(firmaId),
    ])
    set({ skuMasterdata, lokasyonlar })
  },

  // firmaId parametre alır (süper yönetici kendi activeFirma'sı dışındaki bir
  // firmayı da Firma Yönetimi'nden düzenleyebilsin diye).
  uploadFirmaSkuMasterdata: async (firmaId, items) => {
    await uploadSkuMasterdata(firmaId, items)
    await updateDoc(doc(db, 'firmalar', firmaId), { skuMasterdataSayisi: items.length })
    set(state => ({
      firmalar: state.firmalar.map(f => f.id === firmaId ? { ...f, skuMasterdataSayisi: items.length } : f),
      firmaProfile: state.firmaProfile?.id === firmaId ? { ...state.firmaProfile, skuMasterdataSayisi: items.length } : state.firmaProfile,
      skuMasterdata: state.activeFirma === firmaId ? items : state.skuMasterdata,
    }))
  },

  uploadFirmaLokasyonlar: async (firmaId, items) => {
    await uploadLokasyonlar(firmaId, items)
    await updateDoc(doc(db, 'firmalar', firmaId), { lokasyonSayisi: items.length })
    set(state => ({
      firmalar: state.firmalar.map(f => f.id === firmaId ? { ...f, lokasyonSayisi: items.length } : f),
      firmaProfile: state.firmaProfile?.id === firmaId ? { ...state.firmaProfile, lokasyonSayisi: items.length } : state.firmaProfile,
      lokasyonlar: state.activeFirma === firmaId ? items : state.lokasyonlar,
    }))
  },

  // Giriş yapan kullanıcının profilini yükle. Firma seçimi kullanıcıya
  // bırakılmaz — hesap zaten hangi firmaya kayıtlıysa o açılır (bkz. aşağıdaki
  // effectiveFirma hesaplaması).
  loadUserProfile: async (user) => {
    if (!user) {
      stopSessionListeners()
      set({
        currentUser: null, userProfile: null, userRole: null, profileLoading: false, authError: null,
        firmaProfile: null, activeFirma: null,
        users: [], usersLoading: false,
        gorevler: [], gorevlerLoading: false,
        sessions: [], activeSessionId: null, sessionsLoading: false,
        rows: [], importFormat: null, rowsLoading: false,
        results: {}, resultsLoading: false,
        korCodes: [], korMatched: [],
        koridorlar: [], koridorMatched: [],
        manualRows: [], korManualRows: [], koridorManualRows: [],
        pendingKodFilter: null,
        events: [],
        session: {
          type: 'Yıl Sonu Sayımı', depoAdi: '',
          sayimBasligi: 'YIL SONU SAYIM',
          tarih: new Date().toISOString().slice(0, 10),
          sorumlu: '', durum: 'Devam', sayimNotu: '',
        },
      })
      return
    }
    set({ profileLoading: true, authError: null })
    try {
      const ref  = doc(db, 'users', user.uid)
      const snap = await getDoc(ref)
      let firma
      let rol

      if (snap.exists()) {
        const data = snap.data()
        firma = data.firma ?? null
        rol   = data.rol || 'sayimci'
        set({ userProfile: { uid: user.uid, ...data }, userRole: rol })
      } else {
        // Bu hesap için Firestore'da bir profil yok. Kendi kendine bootstrap
        // artık YOK (bkz. firestore.rules — herkese açık Email/Şifre kaydı +
        // self-bootstrap kombinasyonu, herhangi birinin kendini bir firmanın
        // sayımcısı yapıp o firmanın verisini okumasına izin veriyordu). Bu
        // hesap bir yönetici/süper yönetici tarafından Ayarlar → Kullanıcılar
        // (veya migrasyon script'i) ile oluşturulmamış demektir.
        set({
          userProfile: null, userRole: null, profileLoading: false,
          authError: 'Bu hesap için bir kullanıcı profili bulunamadı. Lütfen yöneticinizden hesabınızı oluşturmasını isteyin.',
        })
        return
      }

      // Firma listesini ve aktif firma profilini yükle
      await get().loadFirmalar()
      const firmalar = get().firmalar
      // Süper yönetici firmaya bağlı değildir (firma:null) — bu durumda
      // alfabetik ilk (aktif) firmaya düşülür, Sidebar/GirisHeader'daki firma
      // switcher ile istediği zaman değiştirebilir. Firma-bağlı kullanıcılarda
      // (firma dolu) zaten gerçek yetki profildeki sabit 'firma' alanından gelir.
      const effectiveFirma = firma || firmalar[0]?.id || null
      set({ activeFirma: effectiveFirma })
      const firmaDoc = firmalar.find(f => f.id === effectiveFirma)
      set({ firmaProfile: firmaDoc || null })
      await get().loadFirmaMasterdata(effectiveFirma)
    } catch (err) {
      devErr('Profil yüklenemedi:', err)
      set({ userProfile: null, userRole: null, authError: 'Profiliniz yüklenirken bir hata oluştu. Lütfen tekrar deneyin.' })
    } finally {
      set({ profileLoading: false })
    }
  },

  loadFirmalar: async () => {
    try {
      const snap = await getDocs(collection(db, 'firmalar'))
      const firmalar = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'))
      set({ firmalar })
    } catch (err) {
      devErr('Firmalar yüklenemedi:', err)
    }
  },

  // Süper yönetici: hangi firma olarak "davranıldığını" değiştirir —
  // sessions/users listeleri bu firmaya göre yeniden yüklenir. Önceki
  // firmanın aktif oturum/satır/sonuç verisi tamamen temizlenir (aksi halde
  // "Aktif Sayım" kartında bir önceki firmanın son oturumu görünmeye devam eder).
  setActiveFirma: async (firmaId) => {
    stopSessionListeners()
    const firmaDoc = get().firmalar.find(f => f.id === firmaId)
    set({
      activeFirma: firmaId, firmaProfile: firmaDoc || null,
      activeSessionId: null, session: null,
      rows: [], results: {}, korCodes: [], korMatched: [], koridorlar: [], koridorMatched: [],
      manualRows: [], korManualRows: [], koridorManualRows: [], rowsLoading: false, resultsLoading: false,
    })
    await Promise.all([get().loadSessions(), get().loadFirmaMasterdata(firmaId)])
  },

  createFirma: async ({ ad, unvan, kisaKod, sablon }) => {
    const { currentUser } = get()
    const data = { ad, unvan: unvan || '', kisaKod: kisaKod || '', sablon, aktif: true, createdAt: serverTimestamp(), createdBy: currentUser?.uid || null }
    const docRef = await addDoc(collection(db, 'firmalar'), data)
    set(state => ({ firmalar: [...state.firmalar, { id: docRef.id, ...data, createdAt: new Date() }].sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr')) }))
    return docRef.id
  },

  updateFirma: async (id, patch) => {
    await updateDoc(doc(db, 'firmalar', id), patch)
    set(state => ({
      firmalar: state.firmalar.map(f => f.id === id ? { ...f, ...patch } : f),
      // Aktif firmanın profili de güncellensin (kısa kod/unvan değişikliği
      // sayfa yenilemeden yeni sayım numaralarına ve evraklara yansısın).
      firmaProfile: state.firmaProfile?.id === id ? { ...state.firmaProfile, ...patch } : state.firmaProfile,
    }))
  },

  // ── Kullanıcı yönetimi (yalnızca yönetici) ────────────────────────────────
  users: [],
  usersLoading: false,

  // Not: activeFirma, en az bir firma dokümanı var olduğu sürece süper
  // yönetici için de her zaman dolar (loadUserProfile bkz.) — bu yüzden tek
  // bir sorgu yeterli; activeFirma henüz null ise (hiç firma yokken) sorgu
  // sonucu boş döner, bu doğru/güvenli varsayılandır.
  loadUsers: async () => {
    set({ usersLoading: true })
    try {
      const { activeFirma } = get()
      const q = query(collection(db, 'users'), where('firma', '==', activeFirma), orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      set({ users: snap.docs.map(d => ({ uid: d.id, ...d.data() })) })
    } catch (err) {
      devErr('Kullanıcılar yüklenemedi:', err)
    } finally {
      set({ usersLoading: false })
    }
  },

  // Yeni kullanıcı: secondary auth ile oluştur (yöneticinin oturumu bozulmaz)
  createUserAccount: async ({ email, password, displayName, rol }) => {
    const { currentUser, activeFirma } = get()
    const secAuth = getSecondaryAuth()
    const cred = await createUserWithEmailAndPassword(secAuth, email, password)
    const uid  = cred.user.uid
    const profile = {
      email,
      displayName: displayName || email.split('@')[0],
      rol:         rol || 'sayimci',
      firma:       activeFirma,
      createdAt:   serverTimestamp(),
      createdBy:   currentUser?.uid || null,
    }
    await setDoc(doc(db, 'users', uid), profile)
    await secondarySignOut(secAuth)
    set(state => ({ users: [{ uid, ...profile, createdAt: new Date() }, ...state.users] }))
    return uid
  },

  updateUserRole: async (uid, rol) => {
    await updateDoc(doc(db, 'users', uid), { rol })
    set(state => ({ users: state.users.map(u => u.uid === uid ? { ...u, rol } : u) }))
  },

  // Not: Firebase Auth hesabı client'tan silinemez; yalnızca profili sileriz
  // (kullanıcı uygulamaya giremez çünkü rol/profil bulunmaz → erişim engellenir).
  deleteUserDoc: async (uid) => {
    await deleteDoc(doc(db, 'users', uid))
    set(state => ({ users: state.users.filter(u => u.uid !== uid) }))
  },

  // ── Kendi profilini düzenleme (Ayarlar → Profil / SayimciEkran → Profil) ──
  // Sadece displayName'e dokunur — firestore.rules'ta da kullanıcının kendi
  // dokümanında SADECE bu alanı değiştirebildiği ayrı/dar bir izin var (rol/
  // firma gibi hassas alanlara kendi kendine dokunamaz, self-lockout korumasıyla
  // çelişmez).
  updateOwnProfile: async ({ displayName }) => {
    const { currentUser } = get()
    if (!currentUser) return
    const trimmed = displayName.trim()
    if (!trimmed) throw new Error('Ad soyad boş olamaz.')
    await updateDoc(doc(db, 'users', currentUser.uid), { displayName: trimmed })
    await updateProfile(auth.currentUser, { displayName: trimmed }).catch(() => {})
    set(state => ({ userProfile: state.userProfile ? { ...state.userProfile, displayName: trimmed } : state.userProfile }))
  },

  // Firebase, uzun süredir giriş yapılmışsa şifre değişimini "recent login"
  // gerektirerek reddedebiliyor — bu yüzden mevcut şifreyle önce yeniden
  // doğrulama yapılıyor, sonra updatePassword çağrılıyor.
  changeOwnPassword: async ({ currentPassword, newPassword }) => {
    const user = auth.currentUser
    if (!user?.email) throw new Error('Oturum bilgisi bulunamadı.')
    const cred = EmailAuthProvider.credential(user.email, currentPassword)
    await reauthenticateWithCredential(user, cred)
    await updatePassword(user, newPassword)
  },

  // ── Sayımcı görevleri ─────────────────────────────────────────────────────
  gorevler: [],               // aktif kullanıcıya atanan görevler
  gorevlerLoading: false,

  // Yönetici: aktif session'daki seçili satırları bir sayımcıya ata
  assignGorev: async ({ sayimci, atananRows, sayimTipi = 'stok', filtreOzeti = '' }) => {
    const { activeSessionId, session, currentUser, activeFirma } = get()
    if (!activeSessionId) throw new Error('Aktif oturum yok')
    const data = {
      sayimciUid:   sayimci.uid,
      sayimciEmail: sayimci.email,
      sayimciAd:    sayimci.displayName || sayimci.email,
      sessionId:    activeSessionId,
      sessionType:  session.type || '',
      depoAdi:      session.depoAdi || '',
      atananRows,                       // array<rowId>
      sayimTipi:    sayimTipi || 'stok', // 'stok' | 'kor' | 'koridor' | 'hareketlilik' | 'membran' | 'antrepo' | 'antrepokor' | 'antrepokoridor' | 'redbull' | 'redbullkor' | 'redbullkoridor'
      filtreOzeti:  filtreOzeti || '',   // görev atanırken aktif filtrelerin okunabilir özeti (ör. "Koridor: A, B")
      firma:        activeFirma,
      durum:        'bekliyor',
      createdAt:    serverTimestamp(),
      createdBy:    currentUser?.uid || null,
    }
    const ref = await addDoc(collection(db, 'sessions', activeSessionId, 'sayimciGorevler'), data)
    return ref.id
  },

  // Sayımcı: kendisine atanan tüm görevleri (tüm oturumlardan) yükle
  loadMyGorevler: async (uid) => {
    if (!uid) return
    set({ gorevlerLoading: true })
    try {
      const { activeFirma } = get()
      const snap = await getDocs(
        query(collectionGroup(db, 'sayimciGorevler'), where('sayimciUid', '==', uid), where('firma', '==', activeFirma))
      )
      const all = snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }))

      // Oturumu silinmiş (yönetici "Sayımı Sil" dediğinde alt koleksiyon
      // otomatik silinmediği için öksüz kalan) görevleri ayıkla ve temizle;
      // aynı sorguda oturumun durum/tarih bilgisini de yakalayıp göreve
      // ekliyoruz (Tamamlandı oturumları listede gizlemek + başlık/tarihe
      // göre gruplamak için — ekstra bir okuma gerektirmiyor).
      const sessionIds = [...new Set(all.map(g => g.sessionId).filter(Boolean))]
      const sessionInfo = new Map()
      await Promise.all(sessionIds.map(async sid => {
        const sDoc = await getDoc(doc(db, 'sessions', sid))
        if (sDoc.exists()) sessionInfo.set(sid, sDoc.data())
      }))

      const valid   = all.filter(g => sessionInfo.has(g.sessionId))
      const orphans = all.filter(g => !sessionInfo.has(g.sessionId))
      orphans.forEach(g => deleteDoc(g.ref).catch(() => {}))

      const list = valid.map(({ ref, ...g }) => ({
        ...g,
        sessionDurum: sessionInfo.get(g.sessionId)?.durum || null,
        sessionTarih: sessionInfo.get(g.sessionId)?.tarih || null,
        sessionNo:    sessionInfo.get(g.sessionId)?.sayimNo || '',
      }))
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      set({ gorevler: list })
    } catch (err) {
      devErr('Görevler yüklenemedi:', err)
    } finally {
      set({ gorevlerLoading: false })
    }
  },

  // Yönetici/Kontrolcü önizleme: aktif oturumdaki tüm görevleri yükle
  loadSessionGorevler: async (sessionId) => {
    if (!sessionId) return
    set({ gorevlerLoading: true })
    try {
      const snap = await getDocs(
        query(collection(db, 'sessions', sessionId, 'sayimciGorevler'), orderBy('createdAt', 'desc'))
      )
      set({ gorevler: snap.docs.map(d => ({ id: d.id, ...d.data() })) })
    } catch (err) {
      devErr('Oturum görevleri yüklenemedi:', err)
    } finally {
      set({ gorevlerLoading: false })
    }
  },

  updateGorevDurum: async (sessionId, gorevId, durum) => {
    const mevcut = get().gorevler.find(g => g.id === gorevId)
    const patch = { durum }
    // Bitiş zaman damgası SADECE ilk tamamlanmada yazılır. Görevi 'tamamlandi'
    // yapan iki ayrı yol var (kart modunda ilerle(), tabloda son kalem
    // dolunca tetiklenen useEffect) ve sayımcı bir kalemi geri alıp yeniden
    // girdiğinde de buradan geçiliyor — koşul olmasa ilk bitirme anı her
    // seferinde ezilirdi.
    if (durum === 'tamamlandi' && !mevcut?.tamamlanmaZamani) {
      patch.tamamlanmaZamani = serverTimestamp()
    }
    await updateDoc(doc(db, 'sessions', sessionId, 'sayimciGorevler', gorevId), patch)
    // serverTimestamp() sentinel'i ekranda formatlanamaz (toDate()'i yok);
    // yerel kopyaya gerçek tarih konuyor, bir sonraki yüklemede sunucu
    // değeriyle değişecek.
    const yerel = patch.tamamlanmaZamani ? { ...patch, tamamlanmaZamani: new Date() } : patch
    set(state => ({ gorevler: state.gorevler.map(g => g.id === gorevId ? { ...g, ...yerel } : g) }))
  },

  // Aktif oturumdaki görevlerden kalemleri TAMAMEN sayılmış olanları
  // 'tamamlandi'ya çeker (bitiş damgası updateGorevDurum içinde yazılır).
  // Neden burada: görev durumunu şimdiye kadar yalnızca sayımcının kendi
  // ekranı (SayimciEkran, mode==='self') güncelliyordu; yönetici görevin
  // kalemlerini kendi sayım ekranından doldurduğunda kart "Bekliyor"da takılı
  // kalıyordu (2026-09-01, kullanıcı isteğiyle değişti). Sonuç yazan tek
  // merkez store olduğu için kontrol de burada — 13 sayım sayfasına ayrı ayrı
  // eklemek yerine updateResult/fillFromSistem sonrasında çağrılıyor.
  syncGorevTamamlanma: () => {
    const { gorevler, results, rows, activeSessionId, updateGorevDurum } = get()
    if (!activeSessionId || gorevler.length === 0) return
    const sayildi = id => { const m = results[id]?.miktar; return m !== undefined && m !== '' }
    gorevler.forEach(g => {
      if (g.sessionId !== activeSessionId || g.durum === 'tamamlandi') return
      // atananRows boş = "tüm oturum" görevi (SayimciEkran'daki `atanan` memo'su
      // da bunu böyle yorumluyor) — o zaman ölçüt oturumun tüm satırları.
      const ids = (g.atananRows || []).length > 0 ? g.atananRows : rows.map(r => r.id)
      if (ids.length === 0) return
      if (ids.every(sayildi)) {
        updateGorevDurum(g.sessionId, g.id, 'tamamlandi').catch(err => devErr('Görev tamamlandı işaretlenemedi:', err))
      }
    })
  },

  // Aktif oturumun sayım işlem logu (Panel → "Sayım Logu" Excel çıktısı için).
  // Zaman sıralaması istemcide yapılır: offline yazılan kayıtlarda sunucu
  // zamanı geç gelir, asıl ölçüt cihazdaki işlem anı (istemciZamani).
  loadSayimLog: async () => {
    const { activeSessionId } = get()
    if (!activeSessionId) return []
    // Kural henüz deploy edilmemişse okuma reddedilir → boş log gibi davran
    // (çağıran geriye dönük rapora düşer).
    const snap = await getDocs(collection(db, 'sessions', activeSessionId, 'sayimLog')).catch(err => {
      devErr('Sayım logu okunamadı:', err)
      return { docs: [] }
    })
    const tarih = v => (v?.toDate ? v.toDate() : v ? new Date(v) : null)
    return snap.docs
      .map(d => {
        const x = d.data()
        return { id: d.id, ...x, istemciZamani: tarih(x.istemciZamani), sunucuZamani: tarih(x.sunucuZamani) }
      })
      .sort((a, b) => (a.istemciZamani?.getTime() || 0) - (b.istemciZamani?.getTime() || 0))
  },

  // Geriye dönük denetim raporu için oturumun görevleri + firma kullanıcıları
  // (ad eşlemesi). Kullanıcı listesi yalnız yöneticiye açık; okunamazsa
  // adlar görev dokümanlarındaki sayimciAd'dan türetilir.
  loadDenetimVerisi: async () => {
    const { activeSessionId, activeFirma } = get()
    if (!activeSessionId) return { gorevler: [], users: [] }
    const [gSnap, uSnap] = await Promise.all([
      getDocs(collection(db, 'sessions', activeSessionId, 'sayimciGorevler')),
      getDocs(query(collection(db, 'users'), where('firma', '==', activeFirma))).catch(() => ({ docs: [] })),
    ])
    return {
      gorevler: gSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      users:    uSnap.docs.map(d => ({ uid: d.id, ...d.data() })),
    }
  },

  deleteGorev: async (sessionId, gorevId) => {
    await deleteDoc(doc(db, 'sessions', sessionId, 'sayimciGorevler', gorevId))
    set(state => ({ gorevler: state.gorevler.filter(g => g.id !== gorevId) }))
  },

  // ── Sessions ──────────────────────────────────────────────────────────────
  sessions: [],
  activeSessionId: null,
  sessionsLoading: false,

  loadSessions: async () => {
    set({ sessionsLoading: true })
    try {
      const { activeFirma } = get()
      const q = query(collection(db, 'sessions'), where('firma', '==', activeFirma), orderBy('createdAt', 'desc'), limit(30))
      const snap = await getDocs(q)
      set({ sessions: snap.docs.map(d => ({ id: d.id, ...d.data() })) })
      get().numarasizlariNumarala()
    } catch (err) {
      devErr('Sessions yüklenemedi:', err)
    } finally {
      set({ sessionsLoading: false })
    }
  },

  // Numara özelliğinden (2026-10-21) önce açılmış oturumlara geriye dönük
  // numara verir. Sıra kesintisiz olduğu için ekrandaki son 30 değil,
  // firmanın TÜM oturumları sayım tarihi (eşitse oluşturulma) sırasıyla
  // numaralanır — en eski sayım 000001 olur. Yalnız yönetici/süper yönetici
  // (oturumu yazabilen roller); kontrolcü/sayımcı listesi bekler.
  numarasizlariNumarala: async () => {
    const { userRole, firmaProfile, activeFirma, sessions } = get()
    if (userRole !== 'yonetici' && userRole !== 'superadmin') return
    if (!activeFirma || !sessions.some(s => !s.sayimNo)) return
    if (numaralamaSuruyor) return numaralamaSuruyor
    numaralamaSuruyor = (async () => {
      const kod = firmaKisaKod(firmaProfile)
      const tumSnap = await getDocs(query(collection(db, 'sessions'), where('firma', '==', activeFirma)))
      const tarihMs = s => { const t = tarihOf(s); return (typeof t === 'string' ? new Date(t) : t).getTime() || 0 }
      const bekleyen = tumSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => !s.sayimNo)
        .sort((a, b) => tarihMs(a) - tarihMs(b) || (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
      for (const s of bekleyen) {
        const sayimNo = await sayimNoAta(doc(db, 'sessions', s.id), { kod, tarih: tarihOf(s) })
        if (!sayimNo) continue
        set(state => ({
          sessions: state.sessions.map(x => x.id === s.id ? { ...x, sayimNo } : x),
          session: state.activeSessionId === s.id && state.session ? { ...state.session, sayimNo } : state.session,
        }))
      }
    })()
      // Kural deploy edilmemiş / çevrimdışı: kalanlar bir sonraki yüklemede denenir.
      .catch(err => devErr('Sayım numarası atanamadı:', err))
      .finally(() => { numaralamaSuruyor = null })
    return numaralamaSuruyor
  },

  // ── Excel rows (yerel bellek + Storage) ───────────────────────────────────
  rows: [],
  importFormat: null,
  rowsLoading: false,

  // ── Sayım sonuçları ───────────────────────────────────────────────────────
  results: {},
  resultsLoading: false,

  // ── Aktif session bilgisi ─────────────────────────────────────────────────
  session: {
    type: 'Yıl Sonu Sayımı',
    depoAdi: '',
    sayimBasligi: 'YIL SONU SAYIM',
    tarih: new Date().toISOString().slice(0, 10),
    sorumlu: '',
    durum: 'Devam',
    sayimNotu: '',
  },

  // ── Sıralama tercihi ────────────────────────────────────────────────────
  // Tüm sayım sayfalarında (StokSayim, KorSayim, HareketlilikSayim,
  // MembranSayim, Antrepo* karşılıkları) paylaşılan tek bir tercih — sayfa
  // bileşeninde local state olsaydı başka bir sayfaya gidip geri gelince
  // (unmount/remount) sıfırlanırdı.
  sortType: '1',
  setSortType: (v) => set({ sortType: v }),

  // ── Kör Sayım listesi (SKU kodu bazlı) ────────────────────────────────────
  korCodes: [],
  korMatched: [],

  // ── Koridor Sayımı listesi (ADRES bazlı) ──────────────────────────────────
  // Kör sayımdan farkı: seçim birimi SKU kodu değil koridor. Bu yüzden bir
  // kodun seçili koridor DIŞINDAKİ lokasyonları listeye/analize/rapora girmez.
  koridorlar: [],
  koridorMatched: [],

  // ── Manuel eklenen kalemler (sistemde olmayan) ────────────────────────────
  manualRows: [],
  korManualRows: [],
  koridorManualRows: [],

  // ── Navigation filter ──────────────────────────────────────────────────────
  pendingKodFilter: null,
  setPendingKodFilter: (kod) => set({ pendingKodFilter: kod }),
  clearPendingKodFilter: () => set({ pendingKodFilter: null }),

  // ── Toast bildirimi (sayfa altında, ~3 sn) ────────────────────────────────
  // Kalıcı "Son İşlemler" logundan (addEvent) ayrıdır: bu sadece anlık bir
  // geri bildirim (ör. manuel stok eklendi). Render'ı Toast.jsx yapıyor.
  toast: null,                  // { id, text, tone: 'success' | 'error' }
  showToast: (text, tone = 'success') => {
    const id = Date.now() + Math.random()
    set({ toast: { id, text, tone } })
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      // Arada yeni bir toast geldiyse onu erken kapatma
      set(state => (state.toast?.id === id ? { toast: null } : {}))
      toastTimer = null
    }, 3000)
  },
  hideToast: () => {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null }
    set({ toast: null })
  },

  // ── Son İşlemler event logu (in-memory) ───────────────────────────────────
  events: [],
  addEvent: (event) => set(state => ({
    events: [{ ...event, time: new Date() }, ...state.events].slice(0, 20),
  })),

  // =========================================================================
  // ACTIONS
  // =========================================================================

  setActiveSession: async (id) => {
    stopSessionListeners()

    if (!id) {
      set({ activeSessionId: null, rows: [], results: {}, korCodes: [], korMatched: [], koridorlar: [], koridorMatched: [], manualRows: [], korManualRows: [], koridorManualRows: [], rowsLoading: false, resultsLoading: false, session: null })
      return
    }

    set({ activeSessionId: id, rows: [], results: {}, korCodes: [], korMatched: [], koridorlar: [], koridorMatched: [], manualRows: [], korManualRows: [], koridorManualRows: [], rowsLoading: true, resultsLoading: true })

    // Sayımcı rolünde loadSessions hiç çağrılmaz; yerel listede yoksa doğrudan Firestore'dan çek
    let sessionData = get().sessions.find(s => s.id === id)
    if (!sessionData) {
      try {
        const snap = await getDoc(doc(db, 'sessions', id))
        if (snap.exists()) sessionData = { id: snap.id, ...snap.data() }
      } catch (err) {
        devErr('Oturum dokümanı yüklenemedi:', err)
      }
    }
    if (sessionData) {
      set({
        session: {
          type:         sessionData.type || 'Yıl Sonu Sayımı',
          depoAdi:      sessionData.depoAdi || '',
          sayimBasligi: sessionData.sayimBasligi || sessionData.type || 'YIL SONU SAYIM',
          sayimNo:      sessionData.sayimNo || '',
          tarih:        sessionData.tarih || new Date().toISOString().slice(0, 10),
          sorumlu:      '',
          durum:        sessionData.durum || 'Devam',
          sayimNotu:    sessionData.sayimNotu || '',
        },
      })

      if (sessionData.rowsUploaded) {
        const rows = await downloadRows(id)
        const korCodes = sessionData.korCodes || []
        const korMatched = korCodes.length > 0 ? rows.filter(r => korCodes.includes(r.kod)) : []
        // Koridor Sayımı adres bazlıdır: kodun tüm lokasyonları değil, YALNIZ
        // seçili koridorlardaki satırlar eşleşir (bkz. getKoridor). `sablon` yoksa
        // hangi adres parçasının koridor olduğu bilinemez → boş bırakılır (bir
        // sonraki snapshot firmaProfile dolunca doğru hesaplar).
        const sablon = get().firmaProfile?.sablon
        const koridorlar = sessionData.koridorlar || []
        const koridorMatched = koridorlar.length > 0 && sablon
          ? rows.filter(r => matchesKoridorKapsam(r.adres, sablon, koridorlar))
          : []
        const manualRows        = sessionData.manualRows        || []
        const korManualRows     = sessionData.korManualRows     || []
        const koridorManualRows = sessionData.koridorManualRows || []
        set({ rows, korCodes, korMatched, koridorlar, koridorMatched, manualRows, korManualRows, koridorManualRows })
        get().addEvent({
          icon: 'inventory_2',
          text: `Oturum açıldı: ${sessionData.type || 'Sayım'}`,
          sub: `${rows.length} kalem yüklendi`,
          badge: 'Oturum',
          badgeCls: 'bg-blue-50 text-blue-600',
          iconBg: 'bg-blue-50',
          iconColor: 'text-blue-500',
        })
      }
    }

    set({ rowsLoading: false })

    // Yönetici/süper yönetici için oturumun görevlerini de yükle: sayım
    // ekranında kalemler dolarken syncGorevTamamlanma'nın kontrol edeceği
    // liste böyle hazırlanıyor. Sayımcıda listeyi loadMyGorevler (tüm
    // oturumlardaki kendi görevleri) dolduruyor — onu ezmemek için rol
    // kontrolü şart.
    const rol = get().userRole
    if (rol === 'yonetici' || rol === 'superadmin') {
      get().loadSessionGorevler(id)
    }

    // Real-time results listener
    // MERGE ile güncelle: debounce bekleyen (writeTimers'daki) satırlar silinmez
    let firstSnapshot = true
    resultsUnsub = onSnapshot(
      collection(db, 'sessions', id, 'results'),
      (snap) => {
        const incoming = {}
        snap.forEach(d => { incoming[d.id] = d.data() })
        if (firstSnapshot) {
          firstSnapshot = false
          set({ results: incoming, resultsLoading: false })
        } else {
          set(state => {
            // Firestore'a henüz yazılmamış (timer bekleyen) satırları koru
            const merged = { ...incoming }
            for (const pendingId of writeTimers.keys()) {
              if (state.results[pendingId] !== undefined) {
                merged[pendingId] = state.results[pendingId]
              }
            }
            return { results: merged }
          })
        }
      },
      (err) => {
        devErr('Results listener hatası:', err)
        set({ resultsLoading: false })
      }
    )

    // Real-time session dokümanı listener'ı — manuel kalemler
    // (manualRows/korManualRows), kör sayım kod listesi, oturum durumu ve
    // sayım notu bu dokümanda tutuluyor. Önceden SADECE oturum açılırken bir
    // kez okunuyordu: başka bir cihazda/tarayıcıda (ör. sayımcının telefonu)
    // eklenen manuel satır, sayfa yeniden yüklenmedikçe rapor ekranında hiç
    // görünmüyordu. Snapshot yerel (henüz sunucuya gitmemiş) yazmaları da
    // anında yansıttığı için kendi eklediğin satır da kaybolmaz.
    sessionUnsub = onSnapshot(
      doc(db, 'sessions', id),
      (snap) => {
        if (!snap.exists()) return
        const d = snap.data()
        set(state => {
          const korCodes   = d.korCodes   || []
          const koridorlar = d.koridorlar || []
          const sablon     = state.firmaProfile?.sablon
          const next = {
            manualRows:        d.manualRows        || [],
            korManualRows:     d.korManualRows     || [],
            koridorManualRows: d.koridorManualRows || [],
            korCodes,
            korMatched:    korCodes.length > 0 ? state.rows.filter(r => korCodes.includes(r.kod)) : [],
            koridorlar,
            koridorMatched: koridorlar.length > 0 && sablon
              ? state.rows.filter(r => matchesKoridorKapsam(r.adres, sablon, koridorlar))
              : [],
            session: state.session ? {
              ...state.session,
              durum: d.durum || state.session.durum,
              sayimNo: d.sayimNo || state.session.sayimNo || '',
              // Not alanı debounce ile yazılıyor; kullanıcı yazmaya devam
              // ederken gelen snapshot yazdıklarını geri almasın diye
              // bekleyen bir yazma varsa yerel değer korunur.
              sayimNotu: writeTimers.has('sessionNote_' + id)
                ? state.session.sayimNotu
                : (d.sayimNotu || ''),
            } : state.session,
          }
          return next
        })
      },
      (err) => devErr('Session listener hatası:', err)
    )
  },

  createSession: async (partial) => {
    const { currentUser, activeFirma } = get()
    const data = {
      type:         partial.type || 'Yıl Sonu Sayımı',
      depoAdi:      partial.depoAdi || '',
      sayimBasligi: partial.type || 'YIL SONU SAYIM',
      tarih:        partial.tarih || new Date().toISOString().slice(0, 10),
      durum:        'Devam',
      kalemSayisi:  0,
      tamamlanan:   0,
      fark:         0,
      rowsUploaded: false,
      firma:        activeFirma,
      createdBy:    currentUser?.uid || null,
      createdAt:    serverTimestamp(),
    }

    // Kesintisiz sıra: önce eski (numarasız) oturumlar numaralansın, yoksa
    // yeni sayım onlardan küçük numarayı kapar.
    await get().numarasizlariNumarala()

    // Numara oturumla birlikte, tek transaction'da yazılır. Başarısız olursa
    // (ör. bağlantı yok) numarasız oluşturulur; numarasizlariNumarala bir
    // sonraki liste yüklemesinde tamamlar.
    const docRef = doc(collection(db, 'sessions'))
    try {
      data.sayimNo = await sayimNoAta(docRef, { kod: firmaKisaKod(get().firmaProfile), tarih: data.tarih, yeniData: data })
    } catch (err) {
      devErr('Sayım numarası alınamadı, numarasız oluşturuluyor:', err)
      await setDoc(docRef, data)
    }

    const newSession = { id: docRef.id, ...data, createdAt: new Date() }
    set(state => ({
      sessions:      [newSession, ...state.sessions],
      activeSessionId: docRef.id,
      rows:          [],
      results:       {},
      korCodes:      [],
      korMatched:    [],
      koridorlar:    [],
      koridorMatched: [],
      manualRows:    [],
      korManualRows: [],
      koridorManualRows: [],
      session: {
        type:         data.type,
        depoAdi:      data.depoAdi,
        sayimBasligi: data.sayimBasligi,
        sayimNo:      data.sayimNo || '',
        tarih:        data.tarih,
        sorumlu:      '',
      },
    }))

    return docRef.id
  },

  // ── Excel import → parse + Storage upload ─────────────────────────────────
  importRows: async (file) => {
    if (!file) {
      set({ rows: [], results: {}, importFormat: null })
      return
    }
    try {
      const { rows, format } = await parseExcelFile(file)
      set({ rows, results: {}, importFormat: format })

      get().addEvent({
        icon: 'upload_file',
        text: `Excel dosyası yüklendi`,
        sub: `${rows.length.toLocaleString('tr')} kalem · ${format || ''}`,
        badge: 'Tamamlandı',
        badgeCls: 'bg-emerald-50 text-emerald-700',
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-500',
      })

      const { activeSessionId } = get()
      if (activeSessionId) {
        await uploadRows(activeSessionId, rows)
        await updateDoc(doc(db, 'sessions', activeSessionId), {
          rowsUploaded: true,
          kalemSayisi:  rows.length,
          importFormat: format,
          updatedAt:    serverTimestamp(),
        })
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === activeSessionId
              ? { ...s, rowsUploaded: true, kalemSayisi: rows.length }
              : s
          ),
        }))
      }
    } catch (err) {
      devErr('Excel import hatası:', err)
      alert('Excel dosyası okunamadı.\nDesteklenen formatlar: RAPOR5.xls veya Sku_Sayım_Listesi.xlsx')
    }
  },

  // ── Tek satır güncelle (debounced Firestore write) ────────────────────────
  // meta (opsiyonel, sayım logu için): { eylem: 'onayla'|'duzenle'|'geriAl', ekran, gorevId }
  // Verilmezse eylem 'elle' (tablodan miktar yazıldı) kabul edilir.
  updateResult: (id, partial, meta) => {
    const bekleyen = logBekleyen.get(id) || { onceki: get().results[id]?.miktar ?? '', eylem: 'elle', ekran: 'tablo', gorevId: null }
    logBekleyen.set(id, { ...bekleyen, ...(meta || {}), zaman: new Date() })

    set(state => {
      const next = { ...state.results[id], ...partial }
      // Miktarı olan satır "Sayıldı" sayılır. Bu damgayı şimdiye kadar yalnızca
      // sayımcı kartındaki onayla() yazıyordu; yönetici miktarı sayım
      // ekranından girdiğinde durum boş kalıyor, Excel'in "Onay Durumu"
      // sütununda hiçbir şey görünmüyordu (2026-09-01 kullanıcı bildirimi:
      // 802 satırlık çıktının 103'ünde miktar dolu ama durum boştu).
      // 'Onaylandı' korunur — onay bir kez verildiyse geri alınmaz.
      if (next.status !== 'Onaylandı') {
        next.status = next.miktar !== undefined && next.miktar !== '' ? 'Sayıldı' : ''
      }
      return { results: { ...state.results, [id]: next } }
    })

    const { activeSessionId, currentUser } = get()
    if (!activeSessionId) return

    if (writeTimers.has(id)) clearTimeout(writeTimers.get(id))
    writeTimers.set(id, setTimeout(async () => {
      const result = get().results[id] || {}

      // Log, setDoc'un sunucu onayını beklemeden yazılır (offline'da setDoc
      // promise'i bağlantı gelene kadar çözülmez). Yalnız not değişikliği
      // loglanmaz; açık eylemler (Onayla aynı miktarı yeniden yazsa bile) loglanır.
      const lb = logBekleyen.get(id)
      logBekleyen.delete(id)
      const yeni = result.miktar ?? ''
      if (lb && (String(lb.onceki) !== String(yeni) || lb.eylem !== 'elle')) {
        const row = get().rows.find(r => r.id === id)
        yazSayimLog(activeSessionId, {
          eylem: lb.eylem === 'elle' && yeni === '' ? 'sil' : lb.eylem,
          ekran: lb.ekran, gorevId: lb.gorevId || null, zaman: lb.zaman,
          rowId: id, kod: row?.kod || '', adres: row?.adres || '',
          sistemMiktar: row?.sayim ?? '', oncekiMiktar: lb.onceki, yeniMiktar: yeni,
        })
      }

      await setDoc(
        doc(db, 'sessions', activeSessionId, 'results', id),
        { ...result, updatedBy: currentUser?.uid || null, updatedAt: serverTimestamp() },
        { merge: true }
      )
      writeTimers.delete(id)
      // Debounce'un içinde: her tuş vuruşunda değil, satır gerçekten
      // yazıldıktan sonra bir kez kontrol edilsin.
      get().syncGorevTamamlanma()
    }, 600))
  },

  // ── Sistem miktarından toplu doldur ───────────────────────────────────────
  fillFromSistem: async (targetRows) => {
    const { activeSessionId, currentUser } = get()

    // Sistemden doldurma da bir sayım girişi: updateResult ile aynı kuralla
    // "Sayıldı" damgası basılır (sistem miktarı boşsa damga da basılmaz).
    const damga = (r, mevcut) => mevcut?.status === 'Onaylandı'
      ? 'Onaylandı'
      : (r.sayim !== undefined && r.sayim !== '' ? 'Sayıldı' : '')

    set(state => {
      const next = { ...state.results }
      targetRows.forEach(r => { next[r.id] = { ...next[r.id], miktar: r.sayim, status: damga(r, next[r.id]) } })
      return { results: next }
    })

    if (activeSessionId && targetRows.length > 0) {
      const batch = writeBatch(db)
      const mevcutResults = get().results
      targetRows.forEach(r => {
        batch.set(
          doc(db, 'sessions', activeSessionId, 'results', r.id),
          { miktar: r.sayim, status: mevcutResults[r.id]?.status || '', updatedBy: currentUser?.uid || null, updatedAt: serverTimestamp() },
          { merge: true }
        )
      })
      // Toplu doldurma tek log kaydı; satır id'leri çok büyük listelerde
      // doküman boyutunu şişirmesin diye sınırlı tutuluyor.
      yazSayimLog(activeSessionId, {
        eylem: 'sistemdenDoldur', ekran: 'tablo', adet: targetRows.length,
        rowIds: targetRows.length <= 3000 ? targetRows.map(r => r.id) : [],
      })
      await batch.commit()
    }
    get().syncGorevTamamlanma()
  },

  // ── Toplu miktar temizle (Sistemden Doldur toggle için) ───────────────────
  clearMiktarlar: async (targetRows) => {
    const { activeSessionId, currentUser } = get()
    set(state => {
      const next = { ...state.results }
      // Miktar silinen satırda "Sayıldı" damgası da kalkar; onaylanmış satırın
      // durumu korunur (onay geri alınmaz).
      targetRows.forEach(r => {
        next[r.id] = { ...next[r.id], miktar: '', status: next[r.id]?.status === 'Onaylandı' ? 'Onaylandı' : '' }
      })
      return { results: next }
    })
    if (activeSessionId && targetRows.length > 0) {
      const batch = writeBatch(db)
      const mevcutResults = get().results
      targetRows.forEach(r => {
        batch.set(
          doc(db, 'sessions', activeSessionId, 'results', r.id),
          { miktar: '', status: mevcutResults[r.id]?.status || '', updatedBy: currentUser?.uid || null, updatedAt: serverTimestamp() },
          { merge: true }
        )
      })
      yazSayimLog(activeSessionId, {
        eylem: 'topluTemizle', ekran: 'tablo', adet: targetRows.length,
        rowIds: targetRows.length <= 3000 ? targetRows.map(r => r.id) : [],
      })
      await batch.commit()
    }
  },

  setSession: (partial) =>
    set(state => ({ session: { ...state.session, ...partial } })),

  // Panel'deki "Not" kartı — debounced Firestore write (updateResult ile aynı
  // desen). Oturum Tamamlandı olsa bile bu alan kasıtlı olarak kilitli
  // DEĞİL (bkz. firestore.rules) — onaydan sonra da açıklama eklenebilsin diye.
  updateSessionNote: (sayimNotu) => {
    set(state => ({ session: state.session ? { ...state.session, sayimNotu } : state.session }))

    const { activeSessionId, currentUser } = get()
    if (!activeSessionId) return

    const key = 'sessionNote_' + activeSessionId
    if (writeTimers.has(key)) clearTimeout(writeTimers.get(key))
    writeTimers.set(key, setTimeout(async () => {
      await updateDoc(doc(db, 'sessions', activeSessionId), {
        sayimNotu,
        updatedBy: currentUser?.uid || null,
        updatedAt: serverTimestamp(),
      })
      writeTimers.delete(key)
    }, 600))
  },

  bulkSetStatus: (ids, status) =>
    set(state => {
      const next = { ...state.results }
      ids.forEach(id => { next[id] = { ...next[id], status } })
      return { results: next }
    }),

  // korCodes de manuel satırlarla aynı "tüm diziyi yaz" desenindeydi; iki
  // cihaz aynı anda kod eklerse biri diğerini eziyordu. Atomik arrayUnion/
  // arrayRemove ile birleştiriliyor (clearKor bilinçli temizleme olduğu için
  // dizinin tamamını yazmaya devam ediyor).
  addKorCodes: (newCodes) => {
    const state   = get()
    const temiz   = newCodes.map(c => c.trim()).filter(Boolean)
    const merged  = [...new Set([...state.korCodes, ...temiz])]
    const matched = state.rows.filter(r => merged.includes(r.kod))
    set({ korCodes: merged, korMatched: matched })
    if (state.activeSessionId && temiz.length > 0)
      updateDoc(doc(db, 'sessions', state.activeSessionId), { korCodes: arrayUnion(...temiz) })
        .catch(e => devErr('korCodes güncelleme hatası:', e))
  },
  removeKorCode: (code) => {
    const state   = get()
    const updated = state.korCodes.filter(c => c !== code)
    const matched = state.rows.filter(r => updated.includes(r.kod))
    set({ korCodes: updated, korMatched: matched })
    if (state.activeSessionId)
      updateDoc(doc(db, 'sessions', state.activeSessionId), { korCodes: arrayRemove(code) })
        .catch(e => devErr('korCodes güncelleme hatası:', e))
  },
  setKorMatched: (rows) => set({ korMatched: rows }),
  clearKor: () => {
    const { activeSessionId } = get()
    set({ korCodes: [], korMatched: [] })
    if (activeSessionId)
      updateDoc(doc(db, 'sessions', activeSessionId), { korCodes: [] }).catch(e => devErr('korCodes temizleme hatası:', e))
  },

  // ── Koridor Sayımı aksiyonları ────────────────────────────────────────────
  // korCodes üçlüsünün adres bazlı eşi. Eşleştirme getKoridor() üzerinden
  // şablona duyarlı yapılır; bu yüzden her yeniden hesaplamada firmaProfile
  // okunur (LOS Depo/WMS Antrepo'da adresin 1., WMS Depo'da 2. parçası).
  addKoridorlar: (newKeys) => {
    const state   = get()
    const temiz   = newKeys.map(k => String(k).trim()).filter(Boolean)
    const merged  = [...new Set([...state.koridorlar, ...temiz])]
    const sablon  = state.firmaProfile?.sablon
    const matched = state.rows.filter(r => matchesKoridorKapsam(r.adres, sablon, merged))
    set({ koridorlar: merged, koridorMatched: matched })
    if (state.activeSessionId && temiz.length > 0)
      updateDoc(doc(db, 'sessions', state.activeSessionId), { koridorlar: arrayUnion(...temiz) })
        .catch(e => devErr('koridorlar güncelleme hatası:', e))
  },
  removeKoridor: (key) => {
    const state   = get()
    const updated = state.koridorlar.filter(k => k !== key)
    const sablon  = state.firmaProfile?.sablon
    const matched = state.rows.filter(r => matchesKoridorKapsam(r.adres, sablon, updated))
    set({ koridorlar: updated, koridorMatched: matched })
    if (state.activeSessionId)
      updateDoc(doc(db, 'sessions', state.activeSessionId), { koridorlar: arrayRemove(key) })
        .catch(e => devErr('koridorlar güncelleme hatası:', e))
  },
  clearKoridor: () => {
    const { activeSessionId } = get()
    set({ koridorlar: [], koridorMatched: [] })
    if (activeSessionId)
      updateDoc(doc(db, 'sessions', activeSessionId), { koridorlar: [] }).catch(e => devErr('koridorlar temizleme hatası:', e))
  },

  // Sayım bitince yönetici/süper yönetici Panel'den bu aksiyonu tetikler —
  // 'Devam' → 'Mutabakat Bekliyor'. Sayımcılar teknik olarak bu durumdan
  // sonra da satır girebiliyor (kasıtlı: sert bir kilit istenmedi), ama
  // Rapor sayfasındaki "Onayla" butonu artık sadece bu durumdan çalışıyor.
  finishCounting: async () => {
    const { activeSessionId } = get()
    if (!activeSessionId) return
    await updateDoc(doc(db, 'sessions', activeSessionId), {
      durum: 'Mutabakat Bekliyor',
      updatedAt: serverTimestamp(),
    })
    set(state => ({
      session: state.session ? { ...state.session, durum: 'Mutabakat Bekliyor' } : state.session,
      sessions: state.sessions.map(s => s.id === activeSessionId ? { ...s, durum: 'Mutabakat Bekliyor' } : s),
    }))
  },

  approveSession: async () => {
    const { activeSessionId, rows, results, currentUser } = get()
    if (!activeSessionId) return

    const countedRows = rows.filter(r => results[r.id]?.miktar !== undefined && results[r.id]?.miktar !== '')
    if (countedRows.length === 0) return

    const batch = writeBatch(db)
    countedRows.forEach(r => {
      batch.set(
        doc(db, 'sessions', activeSessionId, 'results', r.id),
        // updatedBy/updatedAt bilerek EZİLMİYOR: satırı kimin, ne zaman saydığı
        // geriye dönük sayım denetiminin tek izi (exportGeriyeDonukLog). Onay
        // bilgisi ayrı alanlara yazılır.
        { ...results[r.id], status: 'Onaylandı', onaylayan: currentUser?.uid || null, onayZamani: serverTimestamp() },
        { merge: true }
      )
    })
    await batch.commit()

    await updateDoc(doc(db, 'sessions', activeSessionId), {
      durum: 'Tamamlandı',
      tamamlanan: countedRows.length,
      updatedAt: serverTimestamp(),
    })

    set(state => {
      const next = { ...state.results }
      countedRows.forEach(r => { next[r.id] = { ...next[r.id], status: 'Onaylandı' } })
      return {
        results: next,
        session: state.session ? { ...state.session, durum: 'Tamamlandı' } : state.session,
        sessions: state.sessions.map(s =>
          s.id === activeSessionId ? { ...s, durum: 'Tamamlandı', tamamlanan: countedRows.length } : s
        ),
      }
    })

    get().addEvent({
      icon: 'check_circle',
      text: 'Sayım onaylandı',
      sub: `${countedRows.length} kalem onaylandı`,
      badge: 'Onaylandı',
      badgeCls: 'bg-emerald-50 text-emerald-700',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
    })
  },

  // Not: bu 4 aksiyon KASITLI olarak ağ yazmasını beklemiyor (fire-and-forget).
  // Yerel state `set()` ile anında güncellenip arayüz hemen tepki veriyor;
  // Firestore yazması arka planda tamamlanıyor. Önceden `await updateDoc(...)`
  // ile "Ekle" butonu sunucu onayı gelene kadar bekletiliyordu — depoda
  // WiFi zayıf/aralıklıysa bu "ciddi uzun bekleme" olarak yaşanıyordu.
  // `updateResult`/`updateSessionNote` zaten aynı arkaplan-yazma desenini
  // kullanıyor; veri kaybı riski yok, Firestore'un offline kuyruğu (
  // persistentLocalCache) bağlantı geri gelince senkronu garanti ediyor.
  //
  // ÖNEMLİ (2026-08-11 düzeltmesi): bu 4 aksiyon eskiden dizinin TAMAMINI
  // (`manualRows: updated`) yazıyordu. İki cihaz/sekme aynı oturumda manuel
  // kalem eklediğinde son yazan, diğerinin satırlarını sessizce siliyordu —
  // rapor ekranındaki "eksik satır" şikayetinin kök nedeni buydu. Artık
  // atomik `arrayUnion`/`arrayRemove` kullanılıyor: sunucu tarafında
  // birleştiği için eşzamanlı eklemeler birbirini ezmiyor.
  // Ayrıca yazma reddedilirse (ör. yetki hatası) hata artık sessizce
  // yutulmuyor — yerel satır geri alınıp kullanıcı uyarılıyor, aksi halde
  // ekranda duran ama sunucuya hiç ulaşmamış "hayalet" satırlar oluşuyordu.
  addManualRow: (row) => {
    const { activeSessionId, manualRows } = get()
    const newRow = { ...row, id: manualId('manual') }
    set({ manualRows: [...manualRows, newRow] })
    get().showToast(`Manuel stok eklendi: ${newRow.kod}`)
    if (activeSessionId) {
      yazSayimLog(activeSessionId, {
        eylem: 'manuelEkle', ekran: 'manuel', liste: 'manualRows', rowId: newRow.id, kod: newRow.kod || '', adres: newRow.adres || '',
        sistemMiktar: 0, oncekiMiktar: '', yeniMiktar: newRow.miktar ?? '',
      })
      updateDoc(doc(db, 'sessions', activeSessionId), {
        manualRows: arrayUnion(newRow),
        updatedAt: serverTimestamp(),
      }).catch(err => {
        devErr('Manuel satır kaydedilemedi:', err)
        set(state => ({ manualRows: state.manualRows.filter(r => r.id !== newRow.id) }))
        window.alert(`"${newRow.kod}" manuel kalemi kaydedilemedi, satır geri alındı. Lütfen tekrar deneyin.`)
      })
    }
  },

  removeManualRow: (id) => {
    const { activeSessionId, manualRows } = get()
    const target = manualRows.find(r => r.id === id)
    if (!target) return
    set({ manualRows: manualRows.filter(r => r.id !== id) })
    if (activeSessionId) {
      updateDoc(doc(db, 'sessions', activeSessionId), {
        manualRows: arrayRemove(target),
        updatedAt: serverTimestamp(),
      }).catch(err => {
        devErr('Manuel satır silinemedi:', err)
        set(state => ({ manualRows: [...state.manualRows, target] }))
        window.alert(`"${target.kod}" manuel kalemi silinemedi. Lütfen tekrar deneyin.`)
      })
    }
  },

  addKorManualRow: (row) => {
    const { activeSessionId, korManualRows } = get()
    const newRow = { ...row, id: manualId('kormanual') }
    set({ korManualRows: [...korManualRows, newRow] })
    get().showToast(`Manuel stok eklendi: ${newRow.kod}`)
    if (activeSessionId) {
      yazSayimLog(activeSessionId, {
        eylem: 'manuelEkle', ekran: 'manuel', liste: 'korManualRows', rowId: newRow.id, kod: newRow.kod || '', adres: newRow.adres || '',
        sistemMiktar: 0, oncekiMiktar: '', yeniMiktar: newRow.miktar ?? '',
      })
      updateDoc(doc(db, 'sessions', activeSessionId), {
        korManualRows: arrayUnion(newRow),
        updatedAt: serverTimestamp(),
      }).catch(err => {
        devErr('Kör manuel satır kaydedilemedi:', err)
        set(state => ({ korManualRows: state.korManualRows.filter(r => r.id !== newRow.id) }))
        window.alert(`"${newRow.kod}" manuel kalemi kaydedilemedi, satır geri alındı. Lütfen tekrar deneyin.`)
      })
    }
  },

  removeKorManualRow: (id) => {
    const { activeSessionId, korManualRows } = get()
    const target = korManualRows.find(r => r.id === id)
    if (!target) return
    set({ korManualRows: korManualRows.filter(r => r.id !== id) })
    if (activeSessionId) {
      updateDoc(doc(db, 'sessions', activeSessionId), {
        korManualRows: arrayRemove(target),
        updatedAt: serverTimestamp(),
      }).catch(err => {
        devErr('Kör manuel satır silinemedi:', err)
        set(state => ({ korManualRows: [...state.korManualRows, target] }))
        window.alert(`"${target.kod}" manuel kalemi silinemedi. Lütfen tekrar deneyin.`)
      })
    }
  },

  addKoridorManualRow: (row) => {
    const { activeSessionId, koridorManualRows } = get()
    const newRow = { ...row, id: manualId('koridormanual') }
    set({ koridorManualRows: [...koridorManualRows, newRow] })
    get().showToast(`Manuel stok eklendi: ${newRow.kod}`)
    if (activeSessionId) {
      yazSayimLog(activeSessionId, {
        eylem: 'manuelEkle', ekran: 'manuel', liste: 'koridorManualRows', rowId: newRow.id, kod: newRow.kod || '', adres: newRow.adres || '',
        sistemMiktar: 0, oncekiMiktar: '', yeniMiktar: newRow.miktar ?? '',
      })
      updateDoc(doc(db, 'sessions', activeSessionId), {
        koridorManualRows: arrayUnion(newRow),
        updatedAt: serverTimestamp(),
      }).catch(err => {
        devErr('Koridor manuel satır kaydedilemedi:', err)
        set(state => ({ koridorManualRows: state.koridorManualRows.filter(r => r.id !== newRow.id) }))
        window.alert(`"${newRow.kod}" manuel kalemi kaydedilemedi, satır geri alındı. Lütfen tekrar deneyin.`)
      })
    }
  },

  removeKoridorManualRow: (id) => {
    const { activeSessionId, koridorManualRows } = get()
    const target = koridorManualRows.find(r => r.id === id)
    if (!target) return
    set({ koridorManualRows: koridorManualRows.filter(r => r.id !== id) })
    if (activeSessionId) {
      updateDoc(doc(db, 'sessions', activeSessionId), {
        koridorManualRows: arrayRemove(target),
        updatedAt: serverTimestamp(),
      }).catch(err => {
        devErr('Koridor manuel satır silinemedi:', err)
        set(state => ({ koridorManualRows: [...state.koridorManualRows, target] }))
        window.alert(`"${target.kod}" manuel kalemi silinemedi. Lütfen tekrar deneyin.`)
      })
    }
  },

  deleteSession: async (id) => {
    // Alt koleksiyonlar (sayimciGorevler) Firestore'da oturumla birlikte
    // otomatik silinmez — önce onları temizle, yoksa sayımcıda öksüz görev kalır
    const gorevSnap = await getDocs(collection(db, 'sessions', id, 'sayimciGorevler'))
    await Promise.all(gorevSnap.docs.map(d => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'sessions', id))
    set(state => ({
      sessions: state.sessions.filter(s => s.id !== id),
    }))
  },

  clearRows: async () => {
    const { activeSessionId } = get()
    set({ rows: [], results: {}, importFormat: null })
    if (activeSessionId) {
      await updateDoc(doc(db, 'sessions', activeSessionId), {
        rowsUploaded: false,
        kalemSayisi: 0,
        updatedAt: serverTimestamp(),
      })
      set(state => ({
        sessions: state.sessions.map(s =>
          s.id === activeSessionId ? { ...s, rowsUploaded: false, kalemSayisi: 0 } : s
        ),
      }))
    }
  },

  reset: () => {
    stopSessionListeners()
    set({ rows: [], results: {}, korCodes: [], korMatched: [], koridorlar: [], koridorMatched: [] })
  },
}))

export const ROLE_LABELS = {
  superadmin: 'Süper Yönetici',
  yonetici:   'Yönetici',
  kontrolcu:  'Kontrolcü',
  sayimci:    'Sayımcı',
}

export default useStore
