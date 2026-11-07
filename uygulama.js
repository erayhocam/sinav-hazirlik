// Sınava Hazırlık Soruları: sınıf + ders seç → sınav → bölüm bölüm cevap anahtarı. Veri: veri.js (uret.py üretir).
const DERSLER = { ingilizce: 'İngilizce', secmeli: 'Seçmeli İngilizce' };
const SINIFLAR = [5, 6, 7, 8];
const kok = document.getElementById('uygulama');
const harf = i => String.fromCharCode(97 + i);
const dersAdi = s => `${s.sinif}. Sınıf ${DERSLER[s.ders]}`;
const sinavBul = kod => SINAVLAR.find(s => s.kod === kod);

function kaydir() { window.scrollTo({ top: 0 }); }

// ---------------- ana sayfa ----------------
function anaSayfa(sinif, ders) {
  document.title = 'Sınava Hazırlık Soruları — İngilizce';
  const hap = (etiket, yol, secili) =>
    `<button class="hap" aria-pressed="${secili}" onclick="location.hash='${yol}'">${etiket}</button>`;
  // yalnız sınavı olan sınıf/ders seçenekleri gösterilir
  const dersler = n => Object.keys(DERSLER).filter(k => SINAVLAR.some(s => s.sinif === n && s.ders === k));
  if (sinif && !dersler(sinif).includes(ders)) ders = dersler(sinif)[0];
  const sinifHaplari = SINIFLAR.map(n => hap(`${n}. Sınıf`, `#/${n}/${dersler(n).includes(ders) ? ders : dersler(n)[0]}`, sinif === n)).join('');
  const dersBolumu = sinif && dersler(sinif).length > 1
    ? `<h2>Ders</h2><div class="grup">${dersler(sinif).map(k => hap(DERSLER[k], `#/${sinif}/${k}`, ders === k)).join('')}</div>` : '';

  let sonuc = '<div class="yakinda">Önce sınıfını seç; ardından sınavlara ulaşabilirsin.</div>';
  if (sinif) {
    const liste = SINAVLAR.filter(s => s.sinif === sinif && s.ders === ders).sort((a, b) => a.deneme - b.deneme);
    sonuc = `<div class="kartlar-liste">${liste.map(kartHtml).join('')}</div>`;
  }
  kok.innerHTML = `<h1>Sınava Hazırlık Soruları</h1>
    <p class="alt-baslik">Sınıfını seç; yazılı sınav formatındaki hazırlık sorularını çöz, ardından cevap anahtarından kendini kontrol et.</p>
    <section class="secim"><h2>Sınıf</h2><div class="grup">${sinifHaplari}</div>${dersBolumu}</section>${sonuc}`;
}

function kartHtml(s) {
  const adet = s.sorular.length;
  const kaz = s.kazanimlar.map(k => `<span class="etiket">${esc(k.kod.replace(/^ENG\./, ''))}${k.adet > 1 ? ' ×' + k.adet : ''}</span>`).join('');
  return `<a class="sinav-kart" href="#/sinav/${s.kod}">
    <div class="k-baslik">Deneme ${s.deneme}</div>
    <div class="k-alt"><b>${esc(dersAdi(s))}</b><br>${esc(s.donem)} · Senaryo ${s.senaryo}</div>
    <div class="k-alt">${adet} soru · 100 puan</div>
    <div class="etiketler">${kaz}</div>
    <div class="k-git">Soruları aç →</div></a>`;
}

// ---------------- sınav sayfası ----------------
function cevapHtml(a, tablo, j) {
  const kabul = (a.kabul || []).filter(k => k && k !== a.cevap);
  const et = tablo ? `${j + 1}.` : `${harf(j)})`;
  return `<div class="a-satir"><div class="a-et">${et}</div><div>
    <div class="a-cevap"><span class="a-etiket">Cevap:</span> ${esc(a.cevap)}</div>
    ${kabul.length ? `<div class="a-kabul">Kabul edilen diğer cevaplar: ${kabul.map(esc).join(' · ')}</div>` : ''}
    ${a.aciklama ? `<div class="a-acik"><b>Nasıl bulunur?</b> ${esc(a.aciklama)}</div>` : ''}</div></div>`;
}

function anahtarKutu(s) {
  const tablo = s.cevap_bicimi === 'tablo';
  return `${s.alt_sorular.map((a, j) => cevapHtml(a, tablo, j)).join('')}
    ${s.puanlama ? `<div class="a-puan"><b>Puanlama ve çözüm yolu:</b> ${esc(s.puanlama)}</div>` : ''}`;
}

// soruyu cevapları yerinde (kırmızı) gösteren kopya: kabul listesi satıra dökülmez
function cevapliHtml(no, q, puan) {
  const kopya = Object.assign({}, q, { alt_sorular: q.alt_sorular.map(a => Object.assign({}, a, { kabul: [] })) });
  return Kagit.soruHtml(no, kopya, puan, 'cevapli');
}

function sinavSayfasi(s) {
  document.title = `Sınava Hazırlık Soruları — ${dersAdi(s)} · Deneme ${s.deneme}`;
  s.sorular.forEach(q => { q._dizin = 'img'; });
  const puanlar = Kagit.puanDagit(s.sorular);
  const sorular = s.sorular.map((q, i) => `<section class="soru-kart" id="s${i + 1}">
      <div class="akis">${Kagit.soruHtml(i + 1, q, puanlar[i], 'ogrenci')}</div>
      <button class="cevap-dugme" data-i="${i}">✔ Cevabı göster</button>
      <div class="anahtar" hidden>${anahtarKutu(q)}</div></section>`).join('');
  const kaz = s.kazanimlar.map(k => `<tr><td class="n">${esc(k.kod)}</td><td>${esc(k.metin)}</td><td class="n">${k.adet} soru</td></tr>`).join('');
  kok.innerHTML = `<h1>Sınava Hazırlık Soruları</h1>
    <p class="alt-baslik"><b>${esc(dersAdi(s))}</b> · Deneme ${s.deneme} · ${esc(s.donem)} · Senaryo ${s.senaryo} · ${s.sorular.length} soru · 100 puan</p>
    <div class="arac-cubugu">
      <button class="dugme" id="b-yazdir">🖨 Sınavı yazdır / PDF</button>
      <button class="dugme" id="b-yazdir2" title="Yazı boyutunu gerekirse küçülterek sınavı en fazla 2 sayfaya sığdırır">🖨 2 sayfaya sığdır</button>
      <button class="dugme ikincil" id="b-anahtar">📄 Cevap anahtarını yazdır</button>
      <button class="dugme ikincil" id="b-hepsi">Tüm cevapları göster</button>
    </div>
    <details class="kazanim-kutu"><summary>Bu sınavın kazanımları</summary>
      <table>${kaz}</table></details>
    ${sorular}
    <p class="baski-bilgi">Önce soruları kendin çöz, sonra “Cevabı göster” ile kontrol et.</p>`;
  document.getElementById('b-yazdir').onclick = () => yazdir(s, false);
  document.getElementById('b-yazdir2').onclick = () => yazdir(s, false, 2);
  document.getElementById('b-anahtar').onclick = () => yazdir(s, true);
  const ayarla = (kart, ac) => {
    const i = +kart.querySelector('.cevap-dugme').dataset.i;
    kart.querySelector('.akis').innerHTML = ac ? cevapliHtml(i + 1, s.sorular[i], puanlar[i])
      : Kagit.soruHtml(i + 1, s.sorular[i], puanlar[i], 'ogrenci');
    kart.querySelector('.anahtar').hidden = !ac;
    kart.querySelector('.cevap-dugme').textContent = ac ? '✔ Cevabı gizle' : '✔ Cevabı göster';
    kart.classList.toggle('acik', ac);
  };
  kok.querySelectorAll('.soru-kart').forEach(k => {
    k.querySelector('.cevap-dugme').onclick = () => ayarla(k, !k.classList.contains('acik'));
  });
  const hepsi = document.getElementById('b-hepsi');
  hepsi.onclick = () => {
    const ac = hepsi.dataset.ac !== '1';
    kok.querySelectorAll('.soru-kart').forEach(k => ayarla(k, ac));
    hepsi.dataset.ac = ac ? '1' : '0';
    hepsi.textContent = ac ? 'Tüm cevapları gizle' : 'Tüm cevapları göster';
  };
}

// ---------------- yazdırma (A4 sayfalar, Sınav Sistemi kâğıdıyla aynı çizici) ----------------
function baslikHtml(s) {
  return `<div class="kb"><div class="kb-ust"><div class="kb-yazi">
      <div class="kb-yil">${esc(s.donem.toLocaleUpperCase('tr-TR'))} · SENARYO ${s.senaryo} · DENEME ${s.deneme}</div>
      <div class="kb-okul">SINAVA HAZIRLIK SORULARI</div>
      <div class="kb-sinav">${esc(dersAdi(s).toLocaleUpperCase('tr-TR'))}</div></div>
      <div class="kb-puan">PUAN</div></div>
    <div class="kb-ogrenci"><div><b>Adı Soyadı:</b></div><div><b>Sınıf:</b></div><div><b>No:</b></div></div></div>`;
}

function anahtarBaskiBloklari(s, puanlar) {
  return [`<div class="ak-baslik">Sınava Hazırlık Soruları — ${esc(dersAdi(s))} · Deneme ${s.deneme} — Cevap Anahtarı</div>`,
    ...s.sorular.map((q, i) => {
      const tablo = q.cevap_bicimi === 'tablo';
      const satir = q.alt_sorular.map((a, j) => {
        const kabul = (a.kabul || []).filter(k => k && k !== a.cevap);
        return `<div class="ak-satir"><b>${tablo ? (j + 1) + '.' : harf(j) + ')'}</b> ${a.soru ? `<span class="kbl">${esc(a.soru)} →</span> ` : ''}<b>${esc(a.cevap)}</b>` +
          (kabul.length ? ` <span class="kbl">/ ${kabul.map(esc).join(' / ')}</span>` : '') +
          (a.aciklama ? `<div class="ak-not">${esc(a.aciklama)}</div>` : '') + '</div>';
      }).join('');
      return `<div class="ak-blok"><div class="ak-ust"><b>Question ${i + 1}</b><span class="kazanim">${esc(q.kazanim)}</span></div>${satir}` +
        (q.puanlama ? `<div class="ak-not"><b>Puanlama:</b> ${esc(q.puanlama)}</div>` : '') + '</div>';
    })];
}

async function yazdir(s, anahtar, sayfa) {   // sayfa: verilirse o sayfa sayısına sığdırır (yazı küçülür)
  const baski = document.getElementById('baski');
  baski.hidden = false;
  const puanlar = Kagit.puanDagit(s.sorular);
  const bloklar = anahtar ? anahtarBaskiBloklari(s, puanlar)
    : [baslikHtml(s), ...s.sorular.map((q, i) => Kagit.soruHtml(i + 1, q, puanlar[i], 'ogrenci'))];
  await Kagit.diz(baski, bloklar, { sayfa: sayfa || 'oto', yay: false, altBilgi: `Sınava Hazırlık Soruları · ${dersAdi(s)} · Deneme ${s.deneme}` });
  document.body.classList.add('yazdiriyor');
  const bitir = () => { document.body.classList.remove('yazdiriyor'); baski.hidden = true; baski.innerHTML = ''; };
  window.addEventListener('afterprint', bitir, { once: true });
  window.print();
}

// ---------------- yönlendirme ----------------
function geriAyarla(hedef) {   // sol üstteki GERİ düğmesi: sınav → sınıf listesi → ana sayfa
  const d = document.getElementById('geri-dugme');
  d.hidden = !hedef;
  d.onclick = () => { location.hash = hedef; };
}

function yonlendir() {
  const p = location.hash.replace(/^#\/?/, '').split('/');
  const sinav = p[0] === 'sinav' ? sinavBul(p[1]) : null;
  geriAyarla(sinav ? `#/${sinav.sinif}/${sinav.ders}` : SINIFLAR.includes(+p[0]) ? '#/' : '');
  if (p[0] === 'sinav' && sinavBul(p[1])) sinavSayfasi(sinavBul(p[1]));
  else if (SINIFLAR.includes(+p[0])) anaSayfa(+p[0], p[1] || 'ingilizce');
  else anaSayfa(null, null);
  kaydir();
  sayac();
}

// GoatCounter: sayfa adresi #/... olduğundan her sayfa geçişi elle sayılır (betik gecikmeli yüklenebilir)
function sayac(deneme) {
  try {
    const yol = '/' + (location.hash.replace(/^#\/?/, '') || '');
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: yol, title: document.title });
    else if ((deneme || 0) < 20) setTimeout(() => sayac((deneme || 0) + 1), 500);
  } catch (e) { /* sayaç hatası siteyi etkilemesin */ }
}
// renk teması (varsayılan Frost); seçim bu cihazda hatırlanır
function tonAyarla(ton) {
  if (ton === 'frost') document.documentElement.removeAttribute('data-ton'); else document.documentElement.setAttribute('data-ton', ton);
  document.querySelectorAll('.ton').forEach(b => b.setAttribute('aria-pressed', b.dataset.ton === ton ? 'true' : 'false'));
  try { localStorage.setItem('hazirlik-ton', ton); } catch (e) { /* kayıt yoksa da çalışır */ }
}
(function () {
  let ton = 'frost';
  try { ton = localStorage.getItem('hazirlik-ton') || 'frost'; } catch (e) {}
  if (!['frost', 'aurora', 'ocean', 'sunset'].includes(ton)) ton = 'frost';
  tonAyarla(ton);
  document.querySelectorAll('.ton').forEach(b => { b.onclick = () => tonAyarla(b.dataset.ton); });
})();
window.addEventListener('hashchange', yonlendir);
try {
  yonlendir();
  kok.setAttribute('data-hazir', '1');
} catch (e) {
  kok.innerHTML = '<p class="yukleme-hata"><b>Sayfa açılırken bir sorun oluştu.</b><br>Sayfayı yenileyin ya da tarayıcınızı güncelleyin.</p>';
}
