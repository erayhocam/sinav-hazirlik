// Sınav kâğıdı çizici: soru blokları (onizleme.py ile aynı düzen), başlık, cevap anahtarı, sayfalama, sığdırma ve yayma.
const Kagit = (() => {
  const harf = i => String.fromCharCode(97 + i);

  function ipucu(metin) { // 'g _ _ _ _' gibi harf ipuçlu boşluklar kalın ve aralıklı
    return esc(metin).replace(/(^|[^A-Za-z])([A-Za-z])((?: _){2,})/g,
      (m, on, h, b) => `${on}<span class="ipucu">${h}${b.replace(/ /g, '&nbsp;')}</span>`);
  }
  const resim = (dizin, f) => f ? `<img src="${dizin}/${encodeURIComponent(f)}" alt="">` : '';

  function cevapMetni(a, tam = true) {
    const kabul = (a.kabul || []).filter(k => k && k !== a.cevap);
    if (!tam || !kabul.length) return esc(a.cevap);
    return `${esc(a.cevap)} <span class="kbl">/ ${kabul.map(esc).join(' / ')}</span>`;
  }
  const cvp = (a, mod) => mod === 'cevapli' ? `<span class="cvp">${cevapMetni(a)}</span>` : '';

  function hucre(h, s, mod) {
    if (h && typeof h === 'object') {
      if ('ornek' in h) return `<td class="ornek">${esc(h.ornek)}</td>`;
      if ('bosluk' in h) {
        const a = s.alt_sorular[h.bosluk - 1];
        return `<td class="bos"><span class="bn">${h.bosluk}.</span> ${a ? cvp(a, mod) : ''}</td>`;
      }
      if (h.isaret) return '<td class="isaret">✓</td>';
    }
    return `<td>${esc(h)}</td>`;
  }

  function blok(u, s, mod) {
    const d = s._dizin;
    switch (u.tur) {
      case 'metin': {
        const b = u.baslik ? `<div class="mb">${esc(u.baslik)}</div>` : '';
        const g = ipucu(u.metin).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
        return `<div class="uyaran">${b}${g}</div>`;
      }
      case 'diyalog': // "bosluk": n olan konuşma cevap yeridir (eksik diyalog); ayrıca alt soru satırı açılmaz
        return `<div class="uyaran"><table class="diyalog">${u.konusmalar.map(k =>
          `<tr><td class="kisi">${esc(k.kisi)}:</td><td>${k.bosluk ? `<span class="bn">${k.bosluk}.</span> ` +
            (k.ipucu ? `<i class="dip">${esc(k.ipucu)}</i> ` : '') +
            `<span class="dsat">${s.alt_sorular[k.bosluk - 1] ? cvp(s.alt_sorular[k.bosluk - 1], mod) : ''}</span>`
            : esc(k.soz)}</td></tr>`).join('')}</table></div>`;
      case 'metinler':
        return `<div class="metinler" style="grid-template-columns:repeat(${u.ogeler.length},1fr)">${u.ogeler.map(o =>
          `<div class="kisa">${o.foto ? `<div class="kf">${resim(d, o.foto)}</div>` : ''}` +
          `<div class="km"><b>${esc(o.kisi)}</b><br>${esc(o.metin).replace(/\n/g, '<br>')}</div></div>`).join('')}</div>`;
      case 'kartlar':
        return `<div class="kartlar">${u.kartlar.map(k =>
          `<div class="kart"><div class="kb">${esc(u.baslik)}</div>` + (k.foto ? `<div class="foto">${resim(d, k.foto)}</div>` : '') +
          u.alanlar.map(a => `<div class="alan"><b>${esc(a)}</b>: ${esc(k[a])}</div>`).join('') + '</div>').join('')}</div>`;
      case 'tablo': {
        const bas = (u.basliklar || []).some(Boolean) ? `<tr>${u.basliklar.map(b => `<th>${esc(b)}</th>`).join('')}</tr>` : '';
        const b = u.baslik ? `<div class="mb">${esc(u.baslik)}</div>` : '';
        return `<div>${b}<table class="tablo">${bas}${u.satirlar.map(r => `<tr>${r.map(h => hucre(h, s, mod)).join('')}</tr>`).join('')}</table></div>`;
      }
    }
    return '';
  }

  function puanYazisi(puan, n) {
    const p = +puan || 0;
    const ad = p === 1 ? 'point' : 'points';
    if (n > 1 && p && (p * 2) % n === 0) return `${p} ${ad} (${n}×${p / n})`;
    return `${p} ${ad}`;
  }

  // mod: 'ogrenci' | 'cevapli'; arac: ekranda düzenleme düğmeleri
  function soruHtml(no, s, puan, mod, arac = '') {
    const g = s.gorsel || {};
    const bicim = s.cevap_bicimi || 'satir';
    const uyaranlar = Array.isArray(s.uyaran) ? s.uyaran : (s.uyaran ? [s.uyaran] : []);
    const resimAlti = g.yerlesim === 'sira' && bicim === 'satir' && !s.alt_sorular.some(a => a.soru);
    let sira = '';
    if (g.yerlesim === 'sira') {
      sira = `<div class="sira">${s.alt_sorular.map((a, i) =>
        `<div class="so"><div class="sf">${resim(s._dizin, a.foto)}</div><b>${harf(i)})</b>` +
        (resimAlti ? `<div class="cizgi alt-cizgi">${mod === 'cevapli' ? cvp(a, mod) : ''}</div>` : '') + '</div>').join('')}</div>`;
    }
    const yanResim = g.dosya && !['kart', 'oge', 'sira'].includes(g.yerlesim) ? `<div class="gorsel">${resim(s._dizin, g.dosya)}</div>` : '';
    const ornek = s.ornek ? `<div class="ornek-satir"><i>${s.ornek_etiketi === false ? '0)' : 'Example:'}</i> ${esc(s.ornek)}</div>` : '';
    let alt = '';
    if (bicim === 'bosluklu') {
      alt = `<ol class="alt">${s.alt_sorular.map((a, i) =>
        `<li class="bl"><span class="s">${harf(i)})</span> ${ipucu(a.soru)}${cvp(a, mod)}</li>`).join('')}</ol>`;
    } else if (bicim !== 'tablo' && !resimAlti) {
      alt = `<ol class="alt">${s.alt_sorular.map((a, i) =>
        `<li><span class="s">${harf(i)})</span> ${esc(a.soru)}<div class="cizgi">${a.baslangic && mod !== 'cevapli' ? `<b class="bas">${esc(a.baslangic)}</b>` : ''}${cvp(a, mod)}</div></li>`).join('')}</ol>`;
    }
    const ub = uyaranlar.map(u => blok(u, s, mod)).join('');
    const govde = ub || yanResim ? `<div class="govde${g.yerlesim === 'ust' ? ' ust-resim' : ''}">${ub ? `<div class="ub">${ub}</div>` : ''}${yanResim}</div>` : '';
    return `<div class="soru" data-id="${esc(s.id)}">${arac}
  <div class="ust"><div class="no">${no}</div><div class="yonerge">${esc(s.yonerge)}</div>
    <div class="sag"><span class="puan">${puanYazisi(puan, s.alt_sorular.length)}</span><span class="kazanim">${esc(s.kazanim)}</span></div></div>
  ${govde}${sira}${ornek}${alt}</div>`;
  }

  // kâğıt İngilizce: 1 → 1ST, 2 → 2ND ...
  const sira = n => n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n] || 'th');
  const dersAdi = a => a.ders === 'secmeli' ? 'Elective English' : 'English';
  const sinavAdi = (a, sinif) => `Grade ${sinif} ${dersAdi(a)} ${sira(+a.donem)} Term ${sira(+a.sinav)} Written Exam`;

  function baslikHtml(a, sinif, ogrenci) {
    const tr = t => t.toLocaleUpperCase('tr-TR');
    return `<div class="kb">
  <div class="kb-ust"><img class="meb" src="img/meb-logo.png" alt="">
    <div class="kb-yazi"><div class="kb-yil">${esc(a.yil)} ACADEMIC YEAR</div>
      <div class="kb-okul">${esc(tr(a.okul || ''))}</div>
      <div class="kb-sinav">${esc(sinavAdi(a, sinif).toUpperCase())}</div></div>
    <div class="kb-puan">SCORE</div></div>
  <div class="kb-ogrenci">
    <div><b>Name &amp; Surname:</b> <span class="dolu">${ogrenci ? esc(ogrenci[1]) : ''}</span></div>
    <div><b>Class:</b> <span class="dolu">${ogrenci ? esc(ogrenci.sube || '') : ''}</span></div>
    <div><b>Number:</b> <span class="dolu">${ogrenci ? esc(ogrenci[0]) : ''}</span></div>
  </div></div>`;
  }

  function anahtarBloklari(sorular, puanlar, a, sinif) {
    const bas = `<div class="ak-baslik">${esc(sinavAdi(a, sinif))} — Answer Key</div>`;
    return [bas, ...sorular.map((s, i) => {
      const tablo = s.cevap_bicimi === 'tablo';
      const satir = s.alt_sorular.map((x, j) => `<div class="ak-satir"><b>${tablo ? (j + 1) + '.' : harf(j) + ')'}</b> ${cevapMetni(x)}</div>`).join('');
      return `<div class="ak-blok"><div class="ak-ust"><b>Question ${i + 1}</b><span>${puanYazisi(puanlar[i], s.alt_sorular.length)}</span>
        <span class="kazanim">${esc(s.kazanim)}</span></div>${satir}${s.puanlama ? `<div class="ak-not">${esc(s.puanlama)}</div>` : ''}</div>`;
    })];
  }

  // 100 puanı alt soru sayısıyla orantılı böler. Önce her sorunun puanı alt soru sayısının katı olacak biçimde
  // (her alt soru tam sayı puan alsın) orantıya en yakın dağıtım aranır; bulunamazsa en büyük kalan yöntemi.
  function puanDagit(sorular) {
    if (!sorular.length) return [];
    const w = sorular.map(s => s.alt_sorular.length);
    const W = w.reduce((a, b) => a + b, 0);
    const ham = w.map(x => 100 * x / W);
    const n = w.length, SONSUZ = 1e9;
    let dp = Array(101).fill(SONSUZ); dp[0] = 0;
    const geri = [];
    for (let i = 0; i < n; i++) {
      const yeni = Array(101).fill(SONSUZ), sec = Array(101).fill(-1);
      const k0 = Math.max(1, Math.floor(ham[i] / w[i]) - 2), k1 = Math.ceil(ham[i] / w[i]) + 2;
      for (let t = 0; t <= 100; t++) {
        if (dp[t] === SONSUZ) continue;
        for (let k = k0; k <= k1; k++) {
          const p = k * w[i], u = t + p;
          if (u > 100) break;
          if (Math.abs(p - ham[i]) > Math.max(1.5, 0.15 * ham[i])) continue; // orantıdan çok sapmasın
          const c = dp[t] + (p - ham[i]) ** 2;
          if (c < yeni[u]) { yeni[u] = c; sec[u] = p; }
        }
      }
      dp = yeni; geri.push(sec);
    }
    if (dp[100] < SONSUZ) {
      const p = []; let t = 100;
      for (let i = n - 1; i >= 0; i--) { p[i] = geri[i][t]; t -= p[i]; }
      return p;
    }
    const p = ham.map(Math.floor);
    let kalan = 100 - p.reduce((a, b) => a + b, 0);
    ham.map((x, i) => [x - p[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (kalan > 0) { p[i]++; kalan--; } });
    return p;
  }

  // ---------------- sayfalama ----------------
  const resimlerYuklensin = kap => Promise.all([...kap.querySelectorAll('img')].map(im =>
    im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));

  function olcuSayfasi(kok) {
    const s = document.createElement('div');
    s.className = 'sayfa';
    s.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;height:auto;';
    kok.appendChild(s);
    return s;
  }

  function yukseklikler(olcu) {
    return [...olcu.children].map(el => {
      const st = getComputedStyle(el);
      return el.offsetHeight + parseFloat(st.marginTop) + parseFloat(st.marginBottom);
    });
  }

  function icYukseklik(kok) {
    const s = document.createElement('div');
    s.className = 'sayfa'; s.style.cssText = 'position:absolute;left:-10000px;visibility:hidden;';
    kok.appendChild(s);
    const st = getComputedStyle(s);
    const h = s.clientHeight - parseFloat(st.paddingTop) - parseFloat(st.paddingBottom);
    s.remove();
    return h;
  }

  function aclgozluYerlestir(h, H) { // sırayı bozmadan, bloklar bölünmeden
    const sayfalar = [[]]; let dolu = 0;
    h.forEach((x, i) => {
      if (dolu + x > H && sayfalar[sayfalar.length - 1].length) { sayfalar.push([]); dolu = 0; }
      sayfalar[sayfalar.length - 1].push(i); dolu += x;
    });
    return sayfalar;
  }

  function dengeli(h, P, H) { // P sayfaya sıra korunarak en dengeli bölme (en dolu sayfayı en aza indir)
    const n = h.length, on = [0];
    h.forEach(x => on.push(on[on.length - 1] + x));
    const T = (i, j) => on[j] - on[i];
    const en = Array.from({ length: P + 1 }, () => Array(n + 1).fill(Infinity));
    const kes = Array.from({ length: P + 1 }, () => Array(n + 1).fill(0));
    en[0][0] = 0;
    for (let p = 1; p <= P; p++) for (let j = 1; j <= n; j++) for (let i = p - 1; i < j; i++) {
      const v = Math.max(en[p - 1][i], T(i, j));
      if (v < en[p][j] && T(i, j) <= H + 0.5) { en[p][j] = v; kes[p][j] = i; }
    }
    if (en[P][n] === Infinity) return null;
    const s = []; let j = n;
    for (let p = P; p > 0; p--) { const i = kes[p][j]; s.unshift([...Array(j - i).keys()].map(k => i + k)); j = i; }
    return s;
  }

  // bloklar: HTML dizesi listesi; secenek: {sayfa: 'oto' | 1..4, yay: bool, altBilgi: str}
  async function diz(kok, bloklar, secenek) {
    kok.innerHTML = '';
    const olcu = olcuSayfasi(kok);
    olcu.innerHTML = bloklar.join('');
    await resimlerYuklensin(olcu);
    const H = icYukseklik(kok);
    const olc = o => { kok.style.setProperty('--o', o); return yukseklikler(olcu); };

    let o = 1, h = olc(1), sayfalar = aclgozluYerlestir(h, H);
    const hedef = secenek.sayfa === 'oto' ? null : +secenek.sayfa;
    if (hedef && sayfalar.length !== hedef) {
      if (sayfalar.length > hedef) { // küçült: hedefe sığan en büyük ölçek
        let a = 0.5, b = 1;
        for (let k = 0; k < 9; k++) { const m = (a + b) / 2; if (aclgozluYerlestir(olc(m), H).length <= hedef) a = m; else b = m; }
        o = a;
      } else { // sayfa sayısı istenenden azsa ölçeği büyütme (yazı büyümesin), yaymayla doldurulur
        o = 1;
      }
      h = olc(o); sayfalar = aclgozluYerlestir(h, H);
    }
    const P = Math.max(hedef && hedef > sayfalar.length && secenek.yay ? Math.min(hedef, bloklar.length) : 0, sayfalar.length);
    if (secenek.yay) sayfalar = dengeli(h, P, H) || sayfalar;
    olcu.remove();

    sayfalar.forEach((idx, i) => {
      const s = document.createElement('div');
      s.className = 'sayfa' + (secenek.yay ? ' yay' : '');
      s.innerHTML = idx.map(k => bloklar[k]).join('') +
        `<div class="alt-bilgi"><span>${esc(secenek.altBilgi || '')}</span><span>Page ${i + 1} / ${sayfalar.length}</span></div>`;
      kok.appendChild(s);
    });
    if (secenek.yay) {
      for (const s of kok.querySelectorAll('.sayfa')) { // boşluğu cevap satırlarına paylaştır, taşırma
        const ic = () => [...s.children].filter(c => !c.classList.contains('alt-bilgi')).reduce((t, c) => t + c.offsetHeight, 0);
        let a = 0, b = 60;
        for (let k = 0; k < 9; k++) { const m = (a + b) / 2; s.style.setProperty('--y', m + 'px'); if (ic() <= H * 0.94) a = m; else b = m; }
        s.style.setProperty('--y', a + 'px');
      }
    }
    return { sayfa: sayfalar.length, olcek: o };
  }

  return { soruHtml, baslikHtml, anahtarBloklari, puanDagit, diz, cevapMetni };
})();
