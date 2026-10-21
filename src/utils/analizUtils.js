// Analiz sayfalarının (Stok Sayım / Kör Sayım / Kör Raf Sayım) ve
// exportAnalizi'nin paylaştığı SKU doğruluk hesabı.

// Bir stok kodu, ancak sistemdeki TÜM satırları sayılmışsa değerlendirmeye
// girer (henüz sayılmamış satırı olan kodlar ne hatasız ne hatalı — sayım
// tamamlanana kadar hesaba hiç katılmaz, ne payda ne paya girer). Tamamlanan
// bir kod, yanlış satırları TOPLAM satır sayısının YARISINI GEÇMİYORSA
// (tam yarısı dahil) hatasız sayılır; yarısından fazlası yanlışsa hatalı.
//
// Geçmiş: önce "en az bir doğru satırı varsa hatasız" mantığı vardı — aynı
// SKU birden çok adreste durduğunda bir adreste fark olsa bile SKU hatasız
// görünüyordu (kullanıcı 2026-09-01'de 15 SKU'nun 1'i hatalıyken analizin
// 15/15 doğru raporladığını bildirdi). Sonra "TÜM satırlar doğru olmalı"
// mantığına geçildi — bu kez tam tersi sorun çıktı: çok adresli bir SKU'da
// TEK bir hatalı/sayılmamış satır tüm SKU'yu hatalı yapıyor, SKU Yüzdesi'ni
// (ve ona bağlı Genel Doğruluk'u) gerçek hata oranından çok daha fazla
// düşürüyordu (kullanıcı 2026-09-16'da bildirdi). Kullanıcı kararıyla eşik
// "yarısından fazlası yanlış" oldu — tek bir adres farkı artık koca bir SKU'yu
// hatalı yapmıyor, ama gerçekten çoğunluğu yanlış sayılan SKU'lar yine
// hatalı raporlanıyor.
export function skuDogrulukSayilari(rows, results) {
  const kodBilgi = new Map()   // kod → { toplam, sayilan, yanlis }
  rows.forEach(r => {
    const m = results[r.id]?.miktar
    const sayildi = m !== undefined && m !== ''
    const yanlis = sayildi && String(m) !== String(r.sayim)
    const mevcut = kodBilgi.get(r.kod) ?? { toplam: 0, sayilan: 0, yanlis: 0 }
    mevcut.toplam++
    if (sayildi) mevcut.sayilan++
    if (yanlis) mevcut.yanlis++
    kodBilgi.set(r.kod, mevcut)
  })
  let tamamlananSku = 0
  let hatasizSku = 0
  kodBilgi.forEach(({ toplam, sayilan, yanlis }) => {
    if (sayilan !== toplam) return   // henüz tamamen sayılmadı, hesaba katma
    tamamlananSku++
    if (yanlis <= toplam / 2) hatasizSku++   // tam yarısı dahil hatasız
  })
  return { tamamlananSku, hatasizSku }
}
