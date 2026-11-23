/* Ödev ve Soru Gönder — öğrenci sayfası. Sunucu: telefon kutusu Worker'ı (odev.js), giriş Öğrenci No + veli PIN'i.
   Sayfalar: #/ (giriş / ana) · #/odevler · #/gonder/<odev|serbest|soru>[/<ödevId>] · #/g/<gönderimId>
   Sonuç biçimi (öğretmen onayından sonra gelir; hepsi isteğe bağlı alanlar):
     { guclu, gelisim, adim (MEB sınıf içi ölçme kılavuzu üçlüsü), ozet (eski), maddeler (puan yok): [{ k, durum: dogru|yanlis|kismi|bos, ogrenci, dogru, aciklama }],   ← ödev / serbest
       ipucu, kural, cevap, cozum }                                                                    ← zorlandığım soru (cevap + çözüm düğmeyle açılır)
   Eski Safari için ?. ve ?? kullanılmaz. */
(function () {
  'use strict';
  var KUTU = 'https://telefon-kutusu.cudduh.workers.dev';
  try {   // yerel deneme: ?kutu=http://127.0.0.1:8799 (yalnız bu bilgisayar)
    var k = new URLSearchParams(location.search).get('kutu');
    if (k && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(k)) KUTU = k;
  } catch (e) {}
  var kok = document.getElementById('uygulama');
  var TUR = {
    odev: { ad: 'Ödev', ikon: '📘' },
    serbest: { ad: 'Serbest gönderim', ikon: '✍️' },
    soru: { ad: 'Zorlandığım soru', ikon: '❓' }
  };
  var DURUM = { inceleniyor: 'İnceleniyor', onayli: 'Sonuç hazır', geri: 'Yeniden gönder' };
  var veri = null;          // /api/odev/ben yanıtı
  var taslak = null;        // gönderme ekranındaki fotoğraflar { anahtar, fotolar: [], not }

  // ---------- küçük yardımcılar ----------
  function $(s, k) { return (k || document).querySelector(s); }
  function oturum() { try { return JSON.parse(localStorage.getItem('odev-oturum') || 'null'); } catch (e) { return null; } }
  function oturumYaz(o) { try { if (o) localStorage.setItem('odev-oturum', JSON.stringify(o)); else localStorage.removeItem('odev-oturum'); } catch (e) {} }
  function tarih(ms) {
    if (!ms) return '';
    var d = new Date(ms), bugun = new Date(), dun = new Date(Date.now() - 864e5);
    var saat = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === bugun.toDateString()) return 'Bugün ' + saat;
    if (d.toDateString() === dun.toDateString()) return 'Dün ' + saat;
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) + ' ' + saat;
  }
  function gun(ms) { return new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }); }
  function ilkHarfBuyuk(s) { return String(s || '').toLocaleLowerCase('tr-TR').replace(/(^|\s)(\S)/g, function (m, a, b) { return a + b.toLocaleUpperCase('tr-TR'); }); }

  function api(yol, govde, yontem) {
    var o = oturum(), h = { 'Content-Type': 'application/json' };
    if (o) h['X-Odev'] = o.token;
    return fetch(KUTU + yol, { method: yontem || (govde ? 'POST' : 'GET'), headers: h, body: govde ? JSON.stringify(govde) : undefined, cache: 'no-store' })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401 && j.error === 'oturum') { oturumYaz(null); veri = null; location.hash = '#/'; yonlendir(); }
          if (!r.ok) { var e = new Error(j.msg || ('Sunucu hatası (' + r.status + ')')); e.kod = j.error; throw e; }
          return j;
        });
      }, function () { throw new Error('Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip yeniden dene.'); });
  }
  function yukle() { return api('/api/odev/ben').then(function (j) { veri = j; return j; }); }

  function geriAyarla(hedef) {
    var d = document.getElementById('geri-dugme');
    d.hidden = !hedef;
    d.onclick = function () { if (taslak && taslak.fotolar.length && /^#\/gonder/.test(location.hash) && !confirm('Eklediğin fotoğraflar gönderilmedi. Çıkılsın mı?')) return; taslak = null; location.hash = hedef; };
  }
  function hataGoster(e) { kok.innerHTML = '<div class="hata">' + esc(e.message || e) + '</div><p><button class="dugme acik" onclick="location.reload()">↻ Yeniden dene</button></p>'; }

  // ---------- giriş ----------
  function girisSayfasi() {
    document.title = 'Ödev ve Soru Gönder — Giriş';
    kok.innerHTML = '<h1>Ödev ve Soru Gönder</h1><p class="alt-baslik">İngilizce ödevini ya da zorlandığın soruyu fotoğrafla gönder; öğretmenin inceleyip sana geri bildirim yazsın.</p>' +
      '<form class="beyaz giris" id="giris" autocomplete="on"><h2>Giriş</h2>' +
      '<label class="alan"><span>Öğrenci numaran</span><input id="g-no" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="username" required></label>' +
      '<label class="alan"><span>PIN kodu (veli PIN\'i)</span><input id="g-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="current-password" required></label>' +
      '<div id="g-hata"></div><button class="dugme ana tam" id="g-dugme">Giriş yap</button>' +
      '<p class="soluk kucuk">PIN kodu, Veli Portalı\'na girerken kullanılan koddur. Bilmiyorsan İngilizce öğretmenine sor.</p></form>';
    $('#giris').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var no = $('#g-no').value.trim(), pin = $('#g-pin').value.trim(), b = $('#g-dugme');
      if (!no || !pin) return;
      b.disabled = true; b.textContent = 'Giriş yapılıyor…'; $('#g-hata').innerHTML = '';
      api('/api/odev/giris', { no: no, pin: pin }).then(function (j) {
        oturumYaz({ token: j.token, ad: j.ad, sube: j.sube }); location.hash = '#/'; yonlendir();
      }).catch(function (e) {
        $('#g-hata').innerHTML = '<div class="hata">' + esc(e.message) + '</div>'; b.disabled = false; b.textContent = 'Giriş yap';
      });
    });
  }

  // ---------- ana ekran ----------
  function gonderimOge(g) {
    var t = TUR[g.tur] || TUR.serbest, od = g.odev && veri ? veri.odevler.filter(function (o) { return o.id === g.odev; })[0] : null;
    var baslik = g.tur === 'odev' ? (od ? od.baslik : 'Ödev') : t.ad;
    return '<a class="oge" href="#/g/' + esc(g.id) + '"><span class="oge-ikon">' + t.ikon + '</span><span class="oge-metin"><b>' + esc(baslik) + '</b>' +
      '<small>' + (g.onceki ? '✍️ Düzeltilmiş · ' : '') + esc(tarih(g.at)) + ' · ' + g.foto + ' fotoğraf' + (g.not ? ' · “' + esc(g.not.slice(0, 40)) + '”' : '') + '</small></span>' +
      '<span class="durum ' + esc(g.durum) + '">' + esc(DURUM[g.durum] || g.durum) + '</span></a>';
  }
  function bekleyenOdevler() {
    var gonderilen = {};
    veri.gonderimler.forEach(function (g) { if (g.odev && g.durum !== 'geri') gonderilen[g.odev] = true; });
    return veri.odevler.filter(function (o) { return !gonderilen[o.id]; });
  }
  function anaSayfa() {
    document.title = 'Ödev ve Soru Gönder';
    var o = oturum(), bek = bekleyenOdevler(), G = veri.gonderimler;
    var hazir = G.filter(function (g) { return g.durum === 'onayli' && !okundu(g.id); }).length;
    kok.innerHTML = '<div class="kullanici"><div><span class="soluk kucuk">Merhaba,</span><br><b>' + esc(ilkHarfBuyuk(o.ad)) + '</b> <span class="soluk">· ' + esc(o.sube) + '</span></div>' +
      '<button class="dugme acik" id="cikis">Çıkış</button></div>' +
      (hazir ? '<div class="bilgi">🎉 <b>' + hazir + '</b> gönderiminin sonucu hazır. Aşağıdaki listeden bakabilirsin.</div>' : '') +
      '<div class="secenekler">' +
      '<button class="secenek" onclick="location.hash=\'#/odevler\'"><span class="ikon">📘</span><b>Ödevlerim' + (bek.length ? '<span class="rozet">' + bek.length + '</span>' : '') + '</b><small>Öğretmeninin verdiği ödevi çözüp fotoğrafını gönder.</small></button>' +
      '<button class="secenek" onclick="location.hash=\'#/gonder/serbest\'"><span class="ikon">✍️</span><b>Serbest gönderim</b><small>İngilizce yazın, defterin ya da yaptığın bir çalışma.</small></button>' +
      '<button class="secenek" onclick="location.hash=\'#/gonder/soru\'"><span class="ikon">❓</span><b>Zorlandığım soru</b><small>Anlamadığın bir İngilizce soruyu gönder; önce ipucu gelsin.</small></button>' +
      '</div><h2>Gönderimlerim</h2>' +
      (G.length ? '<div class="liste">' + G.map(gonderimOge).join('') + '</div>' : '<div class="bos-liste">Henüz bir şey göndermedin.</div>');
    $('#cikis').onclick = function () {
      if (!confirm('Çıkış yapılsın mı?')) return;
      api('/api/odev/cikis', {}).catch(function () {}).then(function () { oturumYaz(null); veri = null; location.hash = '#/'; yonlendir(); });
    };
  }
  function okundu(id) { try { return (JSON.parse(localStorage.getItem('odev-okunan') || '[]')).indexOf(id) >= 0; } catch (e) { return false; } }
  function okunduYap(id) { try { var a = JSON.parse(localStorage.getItem('odev-okunan') || '[]'); if (a.indexOf(id) < 0) { a.push(id); localStorage.setItem('odev-okunan', JSON.stringify(a.slice(-300))); } } catch (e) {} }

  // ---------- ödevlerim ----------
  function odevlerSayfasi() {
    document.title = 'Ödevlerim';
    var O = veri.odevler, now = veri.now || Date.now();
    var son = {}; veri.gonderimler.forEach(function (g) { if (g.odev && !son[g.odev]) son[g.odev] = g; });
    kok.innerHTML = '<h1>Ödevlerim</h1><p class="alt-baslik">Öğretmeninin ' + esc(oturum().sube) + ' şubesine verdiği ödevler.</p>' +
      (O.length ? '<div class="liste">' + O.map(function (o) {
        var g = son[o.id], d = g ? g.durum : (o.son && o.son < now ? 'gec' : 'yeni');
        var etiket = g ? (g.durum === 'onayli' ? 'Sonuç hazır' : g.durum === 'geri' ? 'Yeniden gönder' : 'Gönderildi') : (d === 'gec' ? 'Süresi geçti' : 'Gönderilmedi');
        var cls = g ? (g.durum === 'inceleniyor' ? 'gonderildi' : g.durum) : (d === 'gec' ? 'geri' : 'yeni');
        return '<a class="oge" href="#/' + (g && g.durum !== 'geri' ? 'g/' + esc(g.id) : 'gonder/odev/' + esc(o.id)) + '"><span class="oge-ikon">📘</span><span class="oge-metin"><b>' + esc(o.baslik) + '</b>' +
          '<small>' + (o.son ? 'Son gün: ' + esc(gun(o.son)) : 'Son gün yok') + (o.aciklama ? ' · ' + esc(o.aciklama.slice(0, 60)) : '') + '</small></span>' +
          '<span class="durum ' + cls + '">' + etiket + '</span></a>';
      }).join('') + '</div>' : '<div class="bos-liste">Şu an açık bir ödevin yok. 🎉</div>');
  }

  // ---------- fotoğraf çekim rehberi ----------
  var SVG = {
    tam: '<svg viewBox="0 0 120 70"><rect x="2" y="2" width="116" height="66" rx="8" fill="#dde3f3"/><rect x="34" y="8" width="52" height="54" rx="2" fill="#fff" stroke="#12805c" stroke-width="2"/><g stroke="#7a86a8" stroke-width="2"><line x1="41" y1="18" x2="79" y2="18"/><line x1="41" y1="27" x2="74" y2="27"/><line x1="41" y1="36" x2="79" y2="36"/><line x1="41" y1="45" x2="70" y2="45"/></g></svg>',
    isik: '<svg viewBox="0 0 120 70"><rect x="2" y="2" width="116" height="66" rx="8" fill="#fff6d8"/><circle cx="100" cy="16" r="9" fill="#f6b51e"/><rect x="34" y="10" width="52" height="52" rx="2" fill="#fff" stroke="#12805c" stroke-width="2"/><g stroke="#3b4562" stroke-width="2.4"><line x1="41" y1="20" x2="79" y2="20"/><line x1="41" y1="30" x2="74" y2="30"/><line x1="41" y1="40" x2="79" y2="40"/></g></svg>',
    bulanik: '<svg viewBox="0 0 120 70"><defs><filter id="b"><feGaussianBlur stdDeviation="2.2"/></filter></defs><rect x="2" y="2" width="116" height="66" rx="8" fill="#f2dede"/><g filter="url(#b)"><rect x="34" y="8" width="52" height="54" rx="2" fill="#fff"/><g stroke="#7a86a8" stroke-width="3"><line x1="41" y1="18" x2="79" y2="18"/><line x1="41" y1="28" x2="74" y2="28"/><line x1="41" y1="38" x2="79" y2="38"/></g></g></svg>',
    golge: '<svg viewBox="0 0 120 70"><rect x="2" y="2" width="116" height="66" rx="8" fill="#f2dede"/><polygon points="20,4 100,14 92,66 28,60" fill="#fff" stroke="#c4161c" stroke-width="2"/><path d="M20 4 L70 10 L60 62 L28 60 Z" fill="rgba(40,40,60,.35)"/></svg>'
  };
  function rehber(sonra) {
    var k = document.createElement('div'); k.className = 'rehber-kok';
    k.innerHTML = '<div class="rehber"><h2>📸 Fotoğrafı nasıl çekmelisin?</h2><p class="soluk kucuk">Fotoğraf net olursa sonucun daha doğru ve hızlı gelir.</p>' +
      '<div class="ipuclari"><div class="ipucu dogru">' + SVG.tam + '<b>✓ Kâğıdın tamamı</b>Dört köşe de görünsün, kâğıt ekranı doldursun.</div>' +
      '<div class="ipucu dogru">' + SVG.isik + '<b>✓ Aydınlık yer</b>Gün ışığında ya da lamba altında çek.</div>' +
      '<div class="ipucu yanlis">' + SVG.bulanik + '<b>✗ Bulanık</b>Telefonu sabit tut; ekrana dokunup netleştir.</div>' +
      '<div class="ipucu yanlis">' + SVG.golge + '<b>✗ Gölge ve eğik</b>Telefonu kâğıdın tam üstünde tut, eğme.</div></div>' +
      '<ul class="kucuk"><li>Kâğıdı düz bir masaya koy.</li><li>Her sayfa için ayrı fotoğraf çek.</li><li>Yazın koyu ve okunaklı olsun.</li><li>Fotoğrafta yüzün ya da başka bir kişi görünmesin.</li></ul>' +
      '<button class="dugme ana tam" id="r-tamam">Anladım</button></div>';
    document.body.appendChild(k);
    $('#r-tamam', k).onclick = function () { k.remove(); try { localStorage.setItem('odev-rehber', '1'); } catch (e) {} if (sonra) sonra(); };
  }

  // ---------- gönderme ----------
  function gonderSayfasi(tur, odevId, onceki) {
    var t = TUR[tur], od = null, on = null;
    if (!t) { location.hash = '#/'; return; }
    if (odevId === '-') odevId = '';
    if (onceki) {   // ✍️ 2. deneme: geri bildirimden sonra düzeltip yeniden gönderme
      on = veri.gonderimler.filter(function (g) { return g.id === onceki; })[0];
      if (!on || on.durum !== 'onayli' || on.onceki || on.duzeltildi) { kok.innerHTML = '<div class="hata">Bu gönderim düzeltilip yeniden gönderilemez (ya zaten gönderdin ya da sonucu henüz gelmedi).</div><a class="dugme acik" href="#/">Ana sayfa</a>'; return; }
    }
    if (tur === 'odev') {
      od = veri.odevler.filter(function (o) { return o.id === odevId; })[0];
      if (!od && on) od = { id: odevId, baslik: 'Ödev', aciklama: '' };   // ödev kapanmış olsa da düzeltme gönderilebilir
      if (!od) { kok.innerHTML = '<div class="hata">Bu ödev bulunamadı ya da kapandı.</div><a class="dugme acik" href="#/odevler">Ödevlerim</a>'; return; }
    }
    var anahtar = tur + '/' + (odevId || '') + '/' + (onceki || '');
    if (!taslak || taslak.anahtar !== anahtar) taslak = { anahtar: anahtar, fotolar: [], not: '', onceki: onceki || null };
    document.title = t.ad + ' gönder';
    var s0 = on && on.sonuc || {};
    var duzeltme = on ? '<div class="kutu-adim"><b>✍️ Düzeltip yeniden gönderiyorsun</b><div class="metin">Öğretmeninin geri bildirimine göre çalışmanı düzelt, sonra yeni fotoğrafını çek.' +
      (s0.adim ? '<br><b>Bir sonraki adımın:</b> ' + esc(s0.adim) : '') + (s0.gelisim ? '<br><b>Geliştirmen gereken:</b> ' + esc(s0.gelisim) : '') + '</div></div>' : '';
    var aciklama = duzeltme + (tur === 'odev' ? '<div class="beyaz"><h2>📘 ' + esc(od.baslik) + '</h2>' + (od.aciklama ? '<p class="metin">' + esc(od.aciklama) + '</p>' : '') +
        (od.son ? '<p class="soluk kucuk">Son gün: ' + esc(gun(od.son)) + '</p>' : '') + (od.pdf ? '<p><a class="dugme acik" href="#" id="pdf-ac">📄 Ödev kâğıdını aç</a></p>' : '') + '</div>'
      : tur === 'soru' ? '<p class="alt-baslik">Zorlandığın İngilizce sorunun fotoğrafını çek. Öğretmenin önce ipucu verecek; istersen sonra cevabı da açabileceksin.</p>'
        : '<p class="alt-baslik">İngilizce yazdığın bir metni, defterini ya da yaptığın bir çalışmayı gönder; öğretmenin kontrol etsin.</p>');
    var notEtiket = tur === 'soru' ? 'Hangi soruda zorlandın? (isteğe bağlı)' : 'Öğretmenine not (isteğe bağlı)';
    var notYer = tur === 'soru' ? 'Örnek: 3. sorudaki boşluğu anlamadım.' : 'Örnek: 2. sayfa arkada.';
    kok.innerHTML = '<h1>' + t.ikon + ' ' + esc(t.ad) + '</h1>' + aciklama +
      '<div class="beyaz"><div class="satir ayri"><h2 style="margin:0">Fotoğraflar</h2><button class="bag kucuk" id="rehber-ac">📖 Nasıl çekilir?</button></div>' +
      '<div class="foto-izgara" id="izgara"></div>' +
      '<div class="foto-ekle"><button class="dugme ana" id="kamera">📷 Kamerayla çek</button><button class="dugme acik" id="galeri">🖼️ Galeriden seç</button></div>' +
      '<input type="file" accept="image/*" capture="environment" class="gizli-girdi" id="girdi-kamera"><input type="file" accept="image/*" multiple class="gizli-girdi" id="girdi-galeri">' +
      '<label class="alan" style="margin-top:1rem"><span>' + notEtiket + '</span><textarea id="not" maxlength="500" placeholder="' + esc(notYer) + '"></textarea></label>' +
      '<div id="g-durum"></div><button class="dugme yesil tam" id="gonder" disabled>Gönder</button></div>';
    $('#not').value = taslak.not;
    $('#not').oninput = function () { taslak.not = this.value; };
    $('#rehber-ac').onclick = function () { rehber(); };
    if ($('#pdf-ac')) $('#pdf-ac').onclick = function (ev) { ev.preventDefault(); pdfAc(od.id); };
    $('#kamera').onclick = function () { $('#girdi-kamera').click(); };
    $('#galeri').onclick = function () { $('#girdi-galeri').click(); };
    $('#girdi-kamera').onchange = function () { dosyalar(this); };
    $('#girdi-galeri').onchange = function () { dosyalar(this); };
    $('#gonder').onclick = function () { gonder(tur, odevId); };
    izgara();
    var gordu = false; try { gordu = localStorage.getItem('odev-rehber') === '1'; } catch (e) {}
    if (!gordu) rehber();
  }
  function pdfAc(id) {   // belge oturum başlığı ister: indirip yeni sekmede aç
    var o = oturum();
    fetch(KUTU + '/api/odev/belge?odev=' + encodeURIComponent(id), { headers: { 'X-Odev': o.token } })
      .then(function (r) { if (!r.ok) throw new Error(); return r.blob(); })
      .then(function (b) { var u = URL.createObjectURL(b); var w = window.open(u, '_blank'); if (!w) location.href = u; })
      .catch(function () { alert('Ödev kâğıdı açılamadı.'); });
  }
  function izgara() {
    var z = $('#izgara'); if (!z) return;
    z.innerHTML = taslak.fotolar.map(function (f, i) {
      return '<div class="kucuk-foto"><img src="' + f.dataUrl + '" alt="Fotoğraf ' + (i + 1) + '"><span class="no">' + (i + 1) + '</span><button class="sil" data-i="' + i + '" aria-label="Sil">✕</button></div>';
    }).join('');
    z.querySelectorAll('.sil').forEach(function (b) { b.onclick = function () { taslak.fotolar.splice(+b.getAttribute('data-i'), 1); izgara(); }; });
    var g = $('#gonder'); g.disabled = !taslak.fotolar.length;
    g.textContent = taslak.fotolar.length ? 'Gönder (' + taslak.fotolar.length + ' fotoğraf)' : 'Gönder';
    var dolu = taslak.fotolar.length >= 8; $('#kamera').disabled = dolu; $('#galeri').disabled = dolu;
  }
  function dosyalar(girdi) {
    var L = Array.prototype.slice.call(girdi.files || []); girdi.value = '';
    var bos = 8 - taslak.fotolar.length;
    if (L.length > bos) { alert('En çok 8 fotoğraf gönderebilirsin. İlk ' + bos + ' tanesi eklenecek.'); L = L.slice(0, bos); }
    (function sirayla(i) {
      if (i >= L.length) return;
      Foto.isle(L[i]).then(function (s) {
        if (!s) return sirayla(i + 1);
        kaliteSor(s, function () { sirayla(i + 1); });
      }).catch(function (e) { alert(e.message || 'Fotoğraf açılamadı.'); sirayla(i + 1); });
    })(0);
  }
  function kaliteSor(s, sonra) {
    var k = s.kalite;
    function ekle() { taslak.fotolar.push({ dataUrl: Foto.dataUrl(s), uyarilar: k.uyarilar }); izgara(); }
    if (!k.red && !k.uyarilar.length) { ekle(); sonra(); return; }
    var d = document.createElement('div'); d.className = 'kalite-sonuc';
    var on = s.tuval.toDataURL('image/jpeg', 0.6);
    d.innerHTML = '<div class="beyaz"><img src="' + on + '" alt="">' +
      (k.red ? '<div class="hata">📷 ' + esc(k.red) + '</div>' : '<div class="uyari">⚠️ ' + k.uyarilar.map(esc).join('<br>') + '<br>Daha net çekersen sonucun daha doğru olur.</div>') +
      '<div class="satir">' + (k.red ? '' : '<button class="dugme acik" data-k="ekle">Yine de ekle</button>') +
      '<button class="dugme ana" data-k="yeniden">📷 Yeniden çek</button><button class="bag" data-k="kapat">Vazgeç</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      var a = b.getAttribute('data-k'); d.remove();
      if (a === 'ekle') ekle();
      if (a === 'yeniden') { var g = $('#girdi-kamera'); if (g) g.click(); }
      sonra();
    });
  }
  function gonder(tur, odevId) {
    var b = $('#gonder'), dur = $('#g-durum');
    b.disabled = true; $('#kamera').disabled = true; $('#galeri').disabled = true;
    dur.innerHTML = '<div class="yukleme-cubuk"><i></i></div><p class="soluk kucuk" id="y-yazi">Gönderiliyor…</p>';
    var govde = JSON.stringify({ tur: tur, odev: odevId || null, onceki: taslak.onceki || null, not: taslak.not, foto: taslak.fotolar.map(function (f) { return f.dataUrl; }) });
    var x = new XMLHttpRequest();
    x.open('POST', KUTU + '/api/odev/gonder');
    x.setRequestHeader('Content-Type', 'application/json'); x.setRequestHeader('X-Odev', oturum().token);
    x.upload.onprogress = function (e) { if (e.lengthComputable) { $('.yukleme-cubuk i').style.width = Math.round(e.loaded / e.total * 100) + '%'; if (e.loaded >= e.total) $('#y-yazi').textContent = 'Kaydediliyor…'; } };
    x.onload = function () {
      var j = {}; try { j = JSON.parse(x.responseText); } catch (e) {}
      if (x.status === 200 && j.ok) {
        taslak = null;
        kok.innerHTML = '<div class="beyaz" style="text-align:center"><div style="font-size:3rem">✅</div><h2>Gönderildi!</h2>' +
          '<p>Öğretmenin inceleyince sonucu <b>Gönderimlerim</b> listesinde göreceksin.</p>' +
          '<div class="satir" style="justify-content:center"><a class="dugme ana" href="#/">Ana sayfa</a><a class="dugme acik" href="#/g/' + esc(j.id) + '">Gönderimi gör</a></div></div>';
        yukle().catch(function () {});
        return;
      }
      if (x.status === 401) { oturumYaz(null); alert('Oturum süresi doldu. Yeniden giriş yap; fotoğrafları yeniden eklemen gerekecek.'); location.hash = '#/'; yonlendir(); return; }
      dur.innerHTML = '<div class="hata">' + esc(j.msg || 'Gönderilemedi (' + x.status + '). Yeniden dene.') + '</div>'; izgara();
    };
    x.onerror = function () { dur.innerHTML = '<div class="hata">Gönderilemedi: internet bağlantını kontrol edip yeniden dene. Fotoğrafların duruyor.</div>'; izgara(); };
    x.send(govde);
  }

  // ---------- gönderim ayrıntısı ----------
  function ayrintiSayfasi(id) {
    var g = veri.gonderimler.filter(function (x) { return x.id === id; })[0];
    if (!g) { kok.innerHTML = '<div class="hata">Gönderim bulunamadı.</div><a class="dugme acik" href="#/">Ana sayfa</a>'; return; }
    var t = TUR[g.tur] || TUR.serbest, od = g.odev ? veri.odevler.filter(function (o) { return o.id === g.odev; })[0] : null, o = oturum();
    document.title = t.ad;
    var fotolar = g.foto ? '<div class="sonuc-fotolar">' + Array.apply(null, Array(g.foto)).map(function (_, i) {
      return '<img loading="lazy" src="' + KUTU + '/api/odev/foto/' + encodeURIComponent(g.id) + '/' + i + '?t=' + encodeURIComponent(o.token) + '" alt="Fotoğraf ' + (i + 1) + '">';
    }).join('') + '</div>' : '<p class="soluk kucuk">Fotoğraflar 30 gün sonra silindi.</p>';
    var govde = '';
    if (g.durum === 'inceleniyor') govde = '<div class="bilgi">⏳ Öğretmenin gönderimini inceliyor. Sonuç hazır olunca burada görünecek.</div>';
    else if (g.durum === 'geri') govde = '<div class="hata">↩️ Bu gönderim sana geri gönderildi.</div>' + notHtml(g.ogretmenNotu) +
      '<a class="dugme ana" href="#/gonder/' + esc(g.tur) + (g.odev || g.onceki ? '/' + esc(g.odev || '-') : '') + (g.onceki ? '/' + esc(g.onceki) : '') + '">📷 Yeniden gönder</a>';
    else if (g.durum === 'onayli') {
      govde = sonucHtml(g.sonuc || {}, g.tur) + notHtml(g.ogretmenNotu); okunduYap(g.id);
      // ✍️ geri bildirimi kullanıp düzelt (bir kez): puanı değiştirmez, öğretmen yeni hâlini görür
      var sonra = veri.gonderimler.filter(function (x) { return x.onceki === g.id && x.durum !== 'geri'; })[0];
      if (g.tur !== 'soru' && !g.onceki && !sonra && !g.duzeltildi && (g.sonuc || {}).maddeler && (g.sonuc.maddeler.some(function (m) { return m.durum !== 'dogru'; })))
        govde += '<div class="kutu-adim"><b>✍️ Şimdi düzelt</b><div class="metin">Geri bildirime göre yanlışlarını düzelt ve yeniden gönder. Öğretmenin düzelttiğin hâlini görecek.</div>' +
          '<a class="dugme ana" href="#/gonder/' + esc(g.tur) + '/' + esc(g.odev || '-') + '/' + esc(g.id) + '">✍️ Düzeltip yeniden gönder</a></div>';
      else if (sonra) govde += '<p class="soluk kucuk">✍️ Bu çalışmayı düzeltip yeniden gönderdin. <a href="#/g/' + esc(sonra.id) + '">Düzeltilmiş hâlini gör ›</a></p>';
    }
    if (g.onceki) govde = '<p class="soluk kucuk">✍️ Bu, düzeltip yeniden gönderdiğin hâli. <a href="#/g/' + esc(g.onceki) + '">İlk gönderimini gör ›</a></p>' + govde;
    kok.innerHTML = '<h1>' + t.ikon + ' ' + esc(od ? od.baslik : t.ad) + '</h1><p class="alt-baslik">' + esc(tarih(g.at)) + ' · <span class="durum ' + esc(g.durum) + '">' + esc(DURUM[g.durum] || g.durum) + '</span></p>' +
      '<div class="beyaz">' + govde + '</div>' +
      '<div class="beyaz"><h3 style="margin-top:0">Gönderdiğin fotoğraflar</h3>' + fotolar + (g.not ? '<p class="soluk kucuk">Notun: “' + esc(g.not) + '”</p>' : '') + '</div>';
    kok.querySelectorAll('.sonuc-fotolar img').forEach(function (im) { im.onclick = function () { buyut(im.src); }; });
    var cb = $('#cevap-ac');
    if (cb) cb.onclick = function () { $('#cevap-kutu').hidden = false; cb.remove(); };
  }
  function notHtml(n) { return n ? '<div class="ogretmen-notu"><b>👩‍🏫 Öğretmeninin notu</b><div class="metin">' + esc(n) + '</div></div>' : ''; }
  function sonucHtml(s, tur) {
    var h = '';
    // puan gösterilmez (2026-11-23): ödevler sınav değil, yalnız geri bildirim
    if (s.guclu) h += '<div class="kutu-guclu"><b>💪 Güçlü yönün</b><div class="metin">' + esc(s.guclu) + '</div></div>';
    if (s.gelisim) h += '<div class="kutu-gelisim"><b>🎯 Geliştirmen gereken</b><div class="metin">' + esc(s.gelisim) + '</div></div>';
    if (s.adim) h += '<div class="kutu-adim"><b>👣 Bir sonraki adımın</b><div class="metin">' + esc(s.adim) + '</div></div>';
    if (s.ozet) h += '<p class="metin">' + esc(s.ozet) + '</p>';
    if (s.maddeler && s.maddeler.length) {
      var IS = { dogru: '✅', yanlis: '❌', kismi: '🟡', bos: '⬜' };
      h += '<h3>Ayrıntılar</h3>' + s.maddeler.map(function (m) {
        return '<div class="madde"><span class="m-et">' + esc(m.k || '') + '</span><div><span class="m-isaret">' + (IS[m.durum] || '') + '</span> ' +
          (m.ogrenci ? '<span class="m-ogr">' + esc(m.ogrenci) + '</span>' : m.durum === 'bos' ? '<span class="soluk">(boş bırakılmış)</span>' : '') +
          (m.dogru && m.durum !== 'dogru' ? '<div class="m-dogru">Doğrusu: ' + esc(m.dogru) + '</div>' : '') +
          (m.aciklama ? '<div class="m-acik">' + esc(m.aciklama) + '</div>' : '') + '</div></div>';
      }).join('');
    }
    if (s.ipucu) h += '<div class="kutu-ipucu"><b>💡 İpucu</b><div class="metin">' + esc(s.ipucu) + '</div></div>';
    if (s.kural) h += '<div class="kutu-kural"><b>📐 Kural</b><div class="metin">' + esc(s.kural) + '</div></div>';
    if (s.cevap || s.cozum) {
      var c = '<div class="kutu-cevap"><b>✔ Cevap</b>' + (s.cevap ? '<div class="metin" style="font-weight:800">' + esc(s.cevap) + '</div>' : '') + (s.cozum ? '<div class="metin" style="margin-top:.4rem">' + esc(s.cozum) + '</div>' : '') + '</div>';
      h += (tur === 'soru' && s.ipucu) ? '<p class="soluk kucuk">Önce ipucuyla kendin dene. Takılırsan cevabı açabilirsin.</p><button class="dugme acik" id="cevap-ac">👀 Cevabı göster</button><div id="cevap-kutu" hidden>' + c + '</div>' : c;
    }
    return h || '<p>Öğretmenin gönderimini inceledi.</p>';
  }
  function buyut(src) {
    var d = document.createElement('div'); d.className = 'buyuk-foto'; d.innerHTML = '<img src="' + src + '" alt="">';
    d.onclick = function () { d.remove(); }; document.body.appendChild(d);
  }

  // ---------- yönlendirme ----------
  function yonlendir() {
    var p = location.hash.replace(/^#\/?/, '').split('/');
    if (!oturum()) { geriAyarla(''); girisSayfasi(); return; }
    var goster = function () {
      if (p[0] === 'odevler') { geriAyarla('#/'); odevlerSayfasi(); }
      else if (p[0] === 'gonder') { geriAyarla(p[3] ? '#/g/' + p[3] : p[1] === 'odev' ? '#/odevler' : '#/'); gonderSayfasi(p[1], p[2], p[3]); }
      else if (p[0] === 'g' && p[1]) { geriAyarla('#/'); ayrintiSayfasi(p[1]); }
      else { geriAyarla(''); anaSayfa(); }
      window.scrollTo(0, 0);
    };
    if (p[0] === 'gonder' && veri) { goster(); return; }   // gönderme ekranında taslak dururken yeniden yükleme yok
    if (!veri) kok.innerHTML = '<p class="yukleniyor">Yükleniyor…</p>';
    yukle().then(goster).catch(function (e) { if (oturum()) hataGoster(e); });
  }

  // renk teması (Hazırlık sitesiyle ortak seçim)
  function tonAyarla(ton) {
    if (ton === 'frost') document.documentElement.removeAttribute('data-ton'); else document.documentElement.setAttribute('data-ton', ton);
    document.querySelectorAll('.ton').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-ton') === ton ? 'true' : 'false'); });
    try { localStorage.setItem('hazirlik-ton', ton); } catch (e) {}
  }
  var ton = 'frost'; try { ton = localStorage.getItem('hazirlik-ton') || 'frost'; } catch (e) {}
  if (['frost', 'aurora', 'ocean', 'sunset'].indexOf(ton) < 0) ton = 'frost';
  tonAyarla(ton);
  document.querySelectorAll('.ton').forEach(function (b) { b.onclick = function () { tonAyarla(b.getAttribute('data-ton')); }; });

  window.addEventListener('hashchange', yonlendir);
  document.addEventListener('visibilitychange', function () {   // sayfaya dönünce durumlar tazelenir (gönderme ekranı hariç)
    if (document.visibilityState === 'visible' && oturum() && !/^#\/gonder/.test(location.hash)) yonlendir();
  });
  window.addEventListener('beforeunload', function (e) { if (taslak && taslak.fotolar.length) { e.preventDefault(); e.returnValue = ''; } });
  try { yonlendir(); kok.setAttribute('data-hazir', '1'); }
  catch (e) { kok.innerHTML = '<p class="yukleme-hata"><b>Sayfa açılırken bir sorun oluştu.</b><br>Sayfayı yenileyin ya da tarayıcınızı güncelleyin.</p>'; }
})();
