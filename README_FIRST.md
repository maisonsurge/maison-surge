# Claude'a nasıl verilir?

1. `CLAUDE_MASTER_PROMPT.md` dosyasının tamamını Claude'a görev olarak yapıştır veya dosya olarak ekle.
2. `PROJECT_RULES.md` dosyasını Claude'un çalışacağı **projenin kök klasörüne** koy.
3. Onayladığın Maison Surge paletini ve kuzgun logo/kimlik referans görsellerini de ekle. Görseller kod/vektör yerine geçmez; onaylı SVG varsa ayrıca ver.
4. Claude Code veya dosya yazabilen bir ortamda **tek repo içinde gerçek kodu** yazmasını iste. Sadece normal sohbet arayüzü kullanılıyorsa bilgisayarındaki klasörlere doğrudan yazamayabilir; böyle bir durumda projeyi dosya dosya ürettirmen gerekir.
5. Supabase projesi, Vercel hesabı, ödeme sağlayıcısı canlı hesap/anahtarları, işletme yasal bilgileri ve ürün fotoğraflarını gerektiğinde sağla. Gerçek secret'ları sohbet içinde veya repoda paylaşma; güvenli ortam değişkenlerine yerleştir.
6. Teslim sonunda `docs/TEST_REPORT.md` ve `docs/RELEASE_CHECKLIST.md` üzerinden hangi alanların gerçekten çalıştığını kontrol et.

**Not:** Marka renkleri ve logo referansları proje tasarımına yön verir; Claude'un gerçek ürün fotoğraflarını veya resmi şirket verilerini kendiliğinden üretip gerçeğiymiş gibi kullanmaması gerekir.
