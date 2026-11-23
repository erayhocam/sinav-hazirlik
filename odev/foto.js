/* Ödev fotoğrafı: aç → kâğıdı bul → köşeleri düzelt → düzleştir → kalite kontrolü → JPEG.
   Foto.isle(dosya) → Promise<{ dataUrl, uyarilar: [] } | null (vazgeçildi)>; okunamayan dosyada hata fırlatır.
   Eski Safari için ?. ve ?? kullanılmaz. */
(function () {
  'use strict';
  var KAYNAK_UZUN = 2400;   // çalışma kopyası en uzun kenar
  var CIKTI_UZUN = 1800;    // gönderilen fotoğraf en uzun kenar
  var Foto = {};

  function resimAc(dosya) {
    return new Promise(function (ok, red) {
      var url = URL.createObjectURL(dosya), img = new Image();
      img.onload = function () { ok(img); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); };
      img.onerror = function () { URL.revokeObjectURL(url); red(new Error('Bu fotoğraf açılamadı. Fotoğrafı kamerayla yeniden çek ya da JPEG olarak kaydedip seç.')); };
      img.src = url;
    });
  }
  function tuval(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function kucult(kaynak, uzun) {
    var w = kaynak.naturalWidth || kaynak.width, h = kaynak.naturalHeight || kaynak.height, k = Math.min(1, uzun / Math.max(w, h));
    var c = tuval(w * k, h * k), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high'; x.drawImage(kaynak, 0, 0, c.width, c.height); return c;
  }
  function dondur(c) {   // saat yönünde 90°
    var d = tuval(c.height, c.width), x = d.getContext('2d');
    x.translate(d.width, 0); x.rotate(Math.PI / 2); x.drawImage(c, 0, 0); return d;
  }
  function gri(c) {
    var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, g = new Float32Array(c.width * c.height);
    for (var i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
    return g;
  }

  // ---------- kâğıdı bul: Otsu eşiği + en büyük açık renkli bölge + dört uç nokta ----------
  Foto.kagitBul = function (c) {
    var k = kucult(c, 360), w = k.width, h = k.height, g = gri(k), n = w * h, i;
    var hist = new Array(256).fill(0); for (i = 0; i < n; i++) hist[g[i] | 0]++;
    var top = 0; for (i = 0; i < 256; i++) top += i * hist[i];
    var sB = 0, wB = 0, enIyi = 0, esik = 128;
    for (i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue; var wF = n - wB; if (!wF) break;
      sB += i * hist[i]; var mB = sB / wB, mF = (top - sB) / wF, ara = wB * wF * (mB - mF) * (mB - mF);
      if (ara > enIyi) { enIyi = ara; esik = i; }
    }
    var etiket = new Int32Array(n), kuyruk = new Int32Array(n), enBuyuk = 0, enEt = 0, et = 0;
    for (i = 0; i < n; i++) {
      if (etiket[i] || g[i] <= esik) continue;
      et++; var bas = 0, son = 0, alan = 0; kuyruk[son++] = i; etiket[i] = et;
      while (bas < son) {
        var p = kuyruk[bas++], x = p % w, y = (p / w) | 0; alan++;
        if (x > 0 && !etiket[p - 1] && g[p - 1] > esik) { etiket[p - 1] = et; kuyruk[son++] = p - 1; }
        if (x < w - 1 && !etiket[p + 1] && g[p + 1] > esik) { etiket[p + 1] = et; kuyruk[son++] = p + 1; }
        if (y > 0 && !etiket[p - w] && g[p - w] > esik) { etiket[p - w] = et; kuyruk[son++] = p - w; }
        if (y < h - 1 && !etiket[p + w] && g[p + w] > esik) { etiket[p + w] = et; kuyruk[son++] = p + w; }
      }
      if (alan > enBuyuk) { enBuyuk = alan; enEt = et; }
    }
    if (enBuyuk < n * 0.15 || enBuyuk > n * 0.97) return null;
    var tl = [0, 0, 1e9], tr = [0, 0, -1e9], br = [0, 0, -1e9], bl = [0, 0, 1e9];
    for (i = 0; i < n; i++) {
      if (etiket[i] !== enEt) continue;
      var xx = i % w, yy = (i / w) | 0, s = xx + yy, f = xx - yy;
      if (s < tl[2]) tl = [xx, yy, s]; if (s > br[2]) br = [xx, yy, s];
      if (f > tr[2]) tr = [xx, yy, f]; if (f < bl[2]) bl = [xx, yy, f];
    }
    var o = c.width / w;
    var q = [tl, tr, br, bl].map(function (p) { return [p[0] * o, p[1] * o]; });
    if (alanQ(q) < c.width * c.height * 0.12) return null;
    var T = tumu(c), pay = 0.05 * Math.max(c.width, c.height);   // kâğıt zaten tüm fotoğrafı dolduruyorsa eğme yapılmaz
    if (q.every(function (p, j) { return uz(p, T[j]) < pay; })) return null;
    return q;
  };
  function alanQ(q) { var a = 0; for (var i = 0; i < 4; i++) { var p = q[i], r = q[(i + 1) % 4]; a += p[0] * r[1] - r[0] * p[1]; } return Math.abs(a) / 2; }
  function tumu(c) { return [[0, 0], [c.width, 0], [c.width, c.height], [0, c.height]]; }
  function uz(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

  // ---------- düzleştirme (perspektif): hedef dikdörtgen → kaynak dörtgen eşlemesi ----------
  function homografi(src, dst) {   // dst noktasını src noktasına götüren 3x3 matris
    var A = [], b = [], i;
    for (i = 0; i < 4; i++) {
      var x = dst[i][0], y = dst[i][1], u = src[i][0], v = src[i][1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    for (var c = 0; c < 8; c++) {   // Gauss eleme
      var m = c; for (i = c + 1; i < 8; i++) if (Math.abs(A[i][c]) > Math.abs(A[m][c])) m = i;
      var t = A[c]; A[c] = A[m]; A[m] = t; t = b[c]; b[c] = b[m]; b[m] = t;
      for (i = c + 1; i < 8; i++) { var f = A[i][c] / A[c][c]; for (var j = c; j < 8; j++) A[i][j] -= f * A[c][j]; b[i] -= f * b[c]; }
    }
    var h = new Array(8);
    for (i = 7; i >= 0; i--) { var s = b[i]; for (var k = i + 1; k < 8; k++) s -= A[i][k] * h[k]; h[i] = s / A[i][i]; }
    return h;
  }
  Foto.duzlestir = function (c, q) {
    var W = Math.max(uz(q[0], q[1]), uz(q[3], q[2])), H = Math.max(uz(q[0], q[3]), uz(q[1], q[2]));
    var k = Math.min(1, CIKTI_UZUN / Math.max(W, H)); W = Math.round(W * k); H = Math.round(H * k);
    var tam = Math.abs(q[0][0]) < 1 && Math.abs(q[0][1]) < 1 && Math.abs(q[2][0] - c.width) < 1 && Math.abs(q[2][1] - c.height) < 1 && Math.abs(q[1][1]) < 1 && Math.abs(q[3][0]) < 1;
    if (tam) return kucult(c, CIKTI_UZUN);
    var h = homografi(q, [[0, 0], [W, 0], [W, H], [0, H]]);
    var sw = c.width, sh = c.height, S = c.getContext('2d').getImageData(0, 0, sw, sh).data;
    var d = tuval(W, H), dx = d.getContext('2d'), D = dx.createImageData(W, H), O = D.data;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var z = h[6] * x + h[7] * y + 1, u = (h[0] * x + h[1] * y + h[2]) / z, v = (h[3] * x + h[4] * y + h[5]) / z;
        var o = (y * W + x) * 4;
        if (u < 0 || v < 0 || u > sw - 1 || v > sh - 1) { O[o] = O[o + 1] = O[o + 2] = 255; O[o + 3] = 255; continue; }
        var x0 = u | 0, y0 = v | 0, x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1), fx = u - x0, fy = v - y0;
        var a = (y0 * sw + x0) * 4, b2 = (y0 * sw + x1) * 4, c2 = (y1 * sw + x0) * 4, e = (y1 * sw + x1) * 4;
        for (var ch = 0; ch < 3; ch++) {
          var ust = S[a + ch] + (S[b2 + ch] - S[a + ch]) * fx, alt = S[c2 + ch] + (S[e + ch] - S[c2 + ch]) * fx;
          O[o + ch] = ust + (alt - ust) * fy;
        }
        O[o + 3] = 255;
      }
    }
    dx.putImageData(D, 0, 0); return d;
  };

  // ---------- kalite: boyut, ışık, netlik, parlama, karşıtlık ----------
  Foto.kalite = function (c, ham) {   // ham: kamera fotoğrafının kendi boyutu (kırpmadan önce)
    var k = kucult(c, 900), w = k.width, h = k.height, g = gri(k), n = g.length, i;
    var top = 0, top2 = 0, parlak = 0;
    for (i = 0; i < n; i++) { top += g[i]; top2 += g[i] * g[i]; if (g[i] >= 250) parlak++; }
    var ort = top / n, ss = Math.sqrt(Math.max(0, top2 / n - ort * ort));
    // netlik: yazının bulunduğu (kenarı güçlü) yerlerde Laplace'ın ortalama gücü — boş beyaz alanlar sonucu düşürmesin
    var L = [], x, y;
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      var p = y * w + x, l = 4 * g[p] - g[p - 1] - g[p + 1] - g[p - w] - g[p + w];
      L.push(Math.abs(l));
    }
    L.sort(function (a, b) { return b - a; });
    var ust = L.slice(0, Math.max(50, (L.length * 0.01) | 0)), net = 0;   // en keskin %1'lik kenarlar
    for (i = 0; i < ust.length; i++) net += ust[i]; net /= ust.length;
    var uzun = Math.max(c.width, c.height), kaynakUzun = ham ? Math.max(ham[0], ham[1]) : uzun;
    var sonuc = { red: null, uyarilar: [], olcum: { ort: Math.round(ort), ss: Math.round(ss), net: Math.round(net), parlama: +(parlak / n).toFixed(3), uzun: uzun } };
    if (kaynakUzun < 700 || uzun < 600) sonuc.red = 'Fotoğraf çok küçük. Kâğıdı ekrana sığacak kadar yaklaşarak yeniden çek.';
    else if (ort < 55) sonuc.red = 'Fotoğraf çok karanlık. Aydınlık bir yerde, ışığı açarak yeniden çek.';
    else if (net < 22) sonuc.red = 'Fotoğraf bulanık; yazılar okunmuyor. Telefonu sabit tut, ekrandaki kâğıda dokunup netleştir ve yeniden çek.';
    else if (ss < 12) sonuc.red = 'Fotoğrafta yazı seçilemiyor. Kâğıdın tamamı görünecek şekilde yeniden çek.';
    if (!sonuc.red) {
      if (ort < 90) sonuc.uyarilar.push('Fotoğraf biraz karanlık.');
      if (net < 70) sonuc.uyarilar.push('Yazılar biraz bulanık; okunmayabilir.');
      if (parlak / n > 0.12) sonuc.uyarilar.push('Kâğıtta ışık parlaması var; parlayan yerler okunmayabilir.');
    }
    return sonuc;
  };

  Foto.jpeg = function (c) {
    var q = 0.82, d = c.toDataURL('image/jpeg', q);
    while (d.length > 3800000 && q > 0.45) { q -= 0.12; d = c.toDataURL('image/jpeg', q); }
    return d;
  };

  // ---------- kırpma ekranı: dört köşe sürüklenir ----------
  function kirpEkrani(c, q) {
    return new Promise(function (bitir) {
      var kok = document.createElement('div'); kok.className = 'kirp-kok';
      kok.innerHTML = '<div class="kirp-ust">Köşeleri kâğıdın köşelerine getir</div><div class="kirp-alan"><canvas></canvas></div>' +
        '<div class="kirp-not">Mavi noktaları sürükle. Kâğıdın dışı kesilip atılır.</div>' +
        '<div class="kirp-alt"><button class="dugme acik" data-k="iptal">✕ Vazgeç</button><button class="dugme acik" data-k="dondur">↻ Döndür</button>' +
        '<button class="dugme acik" data-k="tum">⛶ Tümü</button><button class="dugme yesil" data-k="tamam">✓ Tamam</button></div>';
      document.body.appendChild(kok); document.body.style.overflow = 'hidden';
      var alan = kok.querySelector('.kirp-alan'), cv = kok.querySelector('canvas'), x = cv.getContext('2d');
      var olcek = 1, ox = 0, oy = 0, tut = -1, dpr = window.devicePixelRatio || 1;
      function yerlestir() {
        var W = alan.clientWidth, H = alan.clientHeight, pay = 28;
        olcek = Math.min((W - 2 * pay) / c.width, (H - 2 * pay) / c.height);
        ox = (W - c.width * olcek) / 2; oy = (H - c.height * olcek) / 2;
        cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
        ciz();
      }
      function ekran(p) { return [ox + p[0] * olcek, oy + p[1] * olcek]; }
      function ciz() {
        x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
        x.drawImage(c, ox, oy, c.width * olcek, c.height * olcek);
        var e = q.map(ekran);
        x.save(); x.beginPath(); x.rect(ox, oy, c.width * olcek, c.height * olcek);
        x.moveTo(e[0][0], e[0][1]); for (var i = 3; i >= 0; i--) x.lineTo(e[i][0], e[i][1]); x.closePath();
        x.fillStyle = 'rgba(0,0,0,.5)'; x.fill('evenodd'); x.restore();
        x.beginPath(); x.moveTo(e[0][0], e[0][1]); for (i = 1; i < 4; i++) x.lineTo(e[i][0], e[i][1]); x.closePath();
        x.lineWidth = 2.5; x.strokeStyle = '#5ab0ff'; x.stroke();
        e.forEach(function (p, j) {
          x.beginPath(); x.arc(p[0], p[1], j === tut ? 17 : 14, 0, Math.PI * 2); x.fillStyle = 'rgba(90,176,255,.35)'; x.fill();
          x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke();
        });
      }
      function nokta(ev) { var r = cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
      cv.addEventListener('pointerdown', function (ev) {
        var p = nokta(ev), en = 1e9; tut = -1;
        q.forEach(function (k, j) { var e = ekran(k), d = Math.hypot(e[0] - p[0], e[1] - p[1]); if (d < en) { en = d; tut = j; } });
        if (en > 60) tut = -1; else { cv.setPointerCapture(ev.pointerId); ciz(); }
      });
      cv.addEventListener('pointermove', function (ev) {
        if (tut < 0) return; var p = nokta(ev);
        q[tut] = [Math.max(0, Math.min(c.width, (p[0] - ox) / olcek)), Math.max(0, Math.min(c.height, (p[1] - oy) / olcek))]; ciz();
      });
      function birak() { tut = -1; ciz(); }
      cv.addEventListener('pointerup', birak); cv.addEventListener('pointercancel', birak);
      window.addEventListener('resize', yerlestir);
      function kapat(s) { window.removeEventListener('resize', yerlestir); document.body.style.overflow = ''; kok.remove(); bitir(s); }
      kok.querySelector('.kirp-alt').addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return;
        var k = b.getAttribute('data-k');
        if (k === 'iptal') kapat(null);
        else if (k === 'tum') { q = tumu(c); ciz(); }
        else if (k === 'dondur') { var eskiH = c.height; c = dondur(c); q = q.map(function (p) { return [eskiH - p[1], p[0]]; }); q = [q[3], q[0], q[1], q[2]]; yerlestir(); }
        else if (k === 'tamam') {
          if (alanQ(q) < c.width * c.height * 0.03) { kok.querySelector('.kirp-not').textContent = 'Seçilen alan çok küçük. Köşeleri kâğıdın köşelerine getir.'; return; }
          kapat({ c: c, q: q });
        }
      });
      requestAnimationFrame(yerlestir);
    });
  }

  Foto.isle = function (dosya) {
    return resimAc(dosya).then(function (img) {
      var ham = [img.naturalWidth, img.naturalHeight];
      if (!ham[0] || !ham[1]) throw new Error('Bu fotoğraf açılamadı.');
      var c = kucult(img, KAYNAK_UZUN), q = Foto.kagitBul(c) || tumu(c);
      return kirpEkrani(c, q).then(function (s) {
        if (!s) return null;
        var d = Foto.duzlestir(s.c, s.q), k = Foto.kalite(d, ham);
        return { tuval: d, kalite: k, ham: ham };
      });
    });
  };
  Foto.dataUrl = function (sonuc) { return Foto.jpeg(sonuc.tuval); };
  window.Foto = Foto;
})();
