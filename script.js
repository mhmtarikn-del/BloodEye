// v0.41 - temiz
let sonVeriler = [];
let sorguAktif = false;
window.addEventListener("beforeunload", (e) => {
    if (sorguAktif) {
        e.preventDefault();
    }
});
let vtHamVeriler = [];
let vtIptal = false;
let haritaObj = null;

function sayfaGoster(sayfa) {
    document.querySelectorAll(".sayfa").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
    document.getElementById("sayfa-" + sayfa).classList.add("active");
    event.target.classList.add("active");
    if (sayfa === "dashboard") dashboardGuncelle();
        if (sayfa === "hashdetector") setTimeout(() => hashGecmisiGoster(), 200);
            if (sayfa === "urldetector") setTimeout(() => urlGecmisiGoster(), 200);
    if (sayfa === "tehdit") {
        setTimeout(() => {
            tehditAnaliziGuncelle();
            if (haritaObj) setTimeout(() => haritaObj.invalidateSize(), 500);
        }, 300);
    }
}

// localStorage
async function gecmisiGetir() {
    try {
        const res = await fetch("https://bloodeye-proxy.onrender.com/gecmis/ip");
        return await res.json();
    } catch(e) { return []; }
}
async function gecmiseEkle(kayit) {
    const puan = Math.max(kayit.abusePuan || 0, kayit.infoPuan || 0);
    if (puan >= getEsikKritik()) kayit.seviye = "kritik";
    else if (puan >= getEsikSupheli()) kayit.seviye = "supheli";
    else kayit.seviye = "temiz";
        kayit.vtDetay = kayit.vtDetay || null;
    try {
        await fetch("https://bloodeye-proxy.onrender.com/gecmis/ip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([kayit])
        });
    } catch(e) {}
}

// Dashboard
async function dashboardGuncelle() {
    const gecmis = await gecmisiGetir();
    const simdi = Date.now();
    const son24s = simdi - 24 * 60 * 60 * 1000;

    document.getElementById("istToplam").textContent = gecmis.length;
    const temizSayi = gecmis.filter(k => k.seviye === "temiz").length;
    const supheliSayi = gecmis.filter(k => k.seviye === "supheli").length;
    const kritikSayi = gecmis.filter(k => k.seviye === "kritik").length;
    document.getElementById("istTemiz").textContent = temizSayi;
    document.getElementById("istSupheli").textContent = supheliSayi + kritikSayi;

    const son24Kayit = gecmis.filter(k => k.tarih > son24s);
    const son24Tehlikeli = son24Kayit.filter(k => k.seviye === "kritik" || k.seviye === "supheli").length;
    const oran = son24Kayit.length > 0 ? Math.round((son24Tehlikeli / son24Kayit.length) * 100) : 0;
    //document.getElementById("gaugeDetay").textContent = `${son24Tehlikeli}/${son24Kayit.length} IP`;
        gaugeCiz(oran, "gaugeIP");

    const kritikIPs = [...new Set(gecmis.filter(k => k.seviye === "kritik").map(k => k.ip))];
    let kritikHtml = "";
    if (kritikIPs.length === 0) kritikHtml = '<p class="bos">Kritik IP yok</p>';
    else kritikIPs.slice(0, 15).forEach(ip => {
        const adet = gecmis.filter(k => k.ip === ip && k.seviye === "kritik").length;
        kritikHtml += `<div class="kritik-item supheli"><span>🔴 ${ip}</span><span>${adet}x</span></div>`;
    });
    document.getElementById("kritikList").innerHTML = kritikHtml;

    const supheliIPs = [...new Set(gecmis.filter(k => k.seviye === "supheli").map(k => k.ip))];
    let supheliHtml = "";
    if (supheliIPs.length === 0) supheliHtml = '<p class="bos">Şüpheli IP yok</p>';
    else supheliIPs.slice(0, 15).forEach(ip => {
        const adet = gecmis.filter(k => k.ip === ip && k.seviye === "supheli").length;
        supheliHtml += `<div class="kritik-item" style="color:#ffaa00;"><span>🟠 ${ip}</span><span>${adet}x</span></div>`;
    });
    document.getElementById("supheliList").innerHTML = supheliHtml;

    aylikGrafikCiz(gecmis);
        // Hash gauge
    const hashGecmis = await hashGecmisiGetir();
    const hash24 = hashGecmis.filter(k => k.tarih > son24s);
    const hashKritik = hash24.filter(k => k.malicious > 0).length;
    const hashOran = hash24.length > 0 ? Math.round((hashKritik / hash24.length) * 100) : 0;
    gaugeCiz(hashOran, "gaugeHash");

    // URL gauge
        const urlGecmis = await urlGecmisiGetir();
    const url24 = urlGecmis.filter(k => k.tarih > son24s);
    const urlKritik = url24.filter(k => k.malicious > 0).length;
    const urlOran = url24.length > 0 ? Math.round((urlKritik / url24.length) * 100) : 0;
    gaugeCiz(urlOran, "gaugeURL");
}


function aylikGrafikCiz(gecmis) {
    const gunler = [];
    for (let i = 29; i >= 0; i--) {
        const gun = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        gunler.push({
            gunSayi: gun.getDate(),
            ayAd: gun.toLocaleDateString("tr-TR", { month: "short" }).toUpperCase(),
            tam: gun.toLocaleDateString("tr-TR")
        });
    }

    const veri = new Array(30).fill(0);
    const supheliVeri = new Array(30).fill(0);
    const kritikVeri = new Array(30).fill(0);
    const simdi = Date.now();

    gecmis.forEach(k => {
        const gunFarki = Math.floor((simdi - k.tarih) / (24 * 60 * 60 * 1000));
        if (gunFarki >= 0 && gunFarki < 30) {
            veri[29 - gunFarki]++;
            if (k.seviye === "supheli") supheliVeri[29 - gunFarki]++;
            if (k.seviye === "kritik") kritikVeri[29 - gunFarki]++;
        }
    });

    const max = Math.max(...veri, 5); // Grafik tavanını normalize etmek için min max 5
    const container = document.getElementById("chartHaftalik");
        if (!container) return;
    let html = '<div class="chart-30-container">';

    for (let i = 29; i >= 0; i--) {
        const temiz = veri[i] - supheliVeri[i] - kritikVeri[i];
        
        // Yükseklik hesaplaması (En az 2px referans çizgisi görünür)
        const temH = Math.max((temiz / max) * 130, temiz > 0 ? 4 : 2);
        const supH = Math.max((supheliVeri[i] / max) * 130, supheliVeri[i] > 0 ? 4 : 2);
        const kriH = Math.max((kritikVeri[i] / max) * 130, kritikVeri[i] > 0 ? 4 : 2);

        const tooltip = `${gunler[i].tam}&#10;🟢 Temiz: ${temiz}&#10;🟠 Şüpheli: ${supheliVeri[i]}&#10;🔴 Kritik: ${kritikVeri[i]}`;

        html += `
            <div class="chart-col" title="${tooltip}" onclick="gunlukDetayGoster('${gunler[i].tam}')" style="cursor:pointer;">
                <div class="bars-track">
                    <div class="bar bar-temiz" style="height:${temH}px; opacity:${temiz > 0 ? '1' : '0.15'};"></div>
                    <div class="bar bar-supheli" style="height:${supH}px; opacity:${supheliVeri[i] > 0 ? '1' : '0.15'};"></div>
                    <div class="bar bar-kritik" style="height:${kriH}px; opacity:${kritikVeri[i] > 0 ? '1' : '0.15'};"></div>
                </div>
                <div class="col-label">
                    <span class="lbl-day">${gunler[i].gunSayi}</span>
                    <span class="lbl-month">${gunler[i].ayAd}</span>
                </div>
            </div>`;
    }
    // Trend çizgisi
    let svgPoints = "";
    veri.forEach((v, i) => {
        const px = i * 41 + 17;
        const py = 150 - ((v / max) * 140);
        svgPoints += `${px},${py} `;
    });
    
   
html += '</div>';
    container.innerHTML = html;
    container.scrollLeft = 9999;
}
async function gunlukDetayGoster(tarihStr) {
    const parts = tarihStr.split(".");
    const tarih = `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
    
    try {
        const res = await fetch(`https://bloodeye-proxy.onrender.com/gunluk-log/${tarih}`);
        const data = await res.json();
        
        document.getElementById("gunlukDetayBaslik").textContent = `📅 ${tarihStr}`;
        
        let html = "";
        
        // IP Tablosu
        html += `<h3>🔍 IP Taramaları <button class="copyBtn" onclick="gunlukIPKopyala()" style="width:auto;font-size:11px;">📋 IP Kopyala</button></h3>`;
        html += `<div id="gunlukIPData" style="display:none;">${data.ip.map(k => k.ip).join("\n")}</div>`;
        if (data.ip.length === 0) {
            html += `<p class="bos">IP taranmamıştır</p>`;
        } else {
            html += `<table><tr><th>IP</th><th>Saat</th><th>Durum</th><th>Abuse</th><th>ipinfo</th><th>VT</th><th></th></tr>`;
            data.ip.forEach(k => {
                const saat = new Date(k.tarih).toLocaleTimeString("tr-TR");
                const durum = k.seviye === "kritik" ? "🔴 Kritik" : k.seviye === "supheli" ? "🟠 Şüpheli" : "🟢 Temiz";
                const vtSonuc = k.vtSonuc || "-";
                const hasDetay = k.vtDetay ? true : false;
                html += `<tr><td>${k.ip}</td><td>${saat}</td><td>${durum}</td><td>%${k.abusePuan||0}</td><td>%${k.infoPuan||0}</td><td>${vtSonuc}</td><td>${hasDetay ? `<button class="detayBtn" onclick="event.stopPropagation();gunlukVTDetay('${k.ip}','${tarih}')">VT Detay</button>` : "-"}</td></tr>`;
            });
            html += `</table>`;
        }
        
        // Hash Tablosu
        html += `<h3 style="margin-top:20px;">🔐 Hash Taramaları</h3>`;
        if (data.hash.length === 0) {
            html += `<p class="bos">Hash taranmamıştır</p>`;
        } else {
            html += `<table><tr><th>Hash</th><th>Saat</th><th>Zararlı</th><th>Temiz</th></tr>`;
            data.hash.forEach(k => {
                const saat = new Date(k.tarih).toLocaleTimeString("tr-TR");
                const kisa = k.hash.length > 20 ? k.hash.substring(0,8)+"..."+k.hash.substring(k.hash.length-8) : k.hash;
                html += `<tr><td title="${k.hash}">${kisa}</td><td>${saat}</td><td>${k.malicious||0}</td><td>${k.harmless||0}</td></tr>`;
            });
            html += `</table>`;
        }
        
        // URL Tablosu
        html += `<h3 style="margin-top:20px;">🌐 URL Taramaları</h3>`;
        if (data.url.length === 0) {
            html += `<p class="bos">URL taranmamıştır</p>`;
        } else {
            html += `<table><tr><th>URL</th><th>Saat</th><th>Zararlı</th><th>Temiz</th></tr>`;
            data.url.forEach(k => {
                const saat = new Date(k.tarih).toLocaleTimeString("tr-TR");
                const kisa = k.url.length > 50 ? k.url.substring(0,47)+"..." : k.url;
                html += `<tr><td title="${k.url}">${kisa}</td><td>${saat}</td><td>${k.malicious||0}</td><td>${k.harmless||0}</td></tr>`;
            });
            html += `</table>`;
        }
        
        document.getElementById("gunlukDetayIcerik").innerHTML = html;
        document.getElementById("gunlukDetayPopup").style.display = "flex";
    } catch(e) {}
}

function gunlukIPKopyala() {
    const data = document.getElementById("gunlukIPData").textContent;
    navigator.clipboard.writeText(data);
    alert("IP'ler kopyalandı!");
}
async function gunlukVTDetay(ip, tarih) {
    try {
        const res = await fetch(`https://bloodeye-proxy.onrender.com/gunluk-log/${tarih}`);
        const data = await res.json();
        const kayit = data.ip.find(k => k.ip === ip && k.vtDetay);
        if (!kayit || !kayit.vtDetay) { alert("VT detayı bulunamadı."); return; }
        const d = kayit.vtDetay;
        let h = `<div class="popup-overlay" onclick="this.remove()"><div class="popup popup-vt" onclick="event.stopPropagation()">`;
        h += `<h2>🛡️ VT Detay - ${ip}</h2><button class="popup-close" onclick="document.querySelector('.popup-overlay').remove()">✕</button>`;
        h += `<div class="vt-bilgi-satir"><span>Toplam:</span><span>${d.total}</span></div>`;
        h += `<div class="vt-bilgi-satir"><span>Zararlı:</span><span style="color:#c62828;">${d.malicious}</span></div>`;
        h += `<div class="vt-bilgi-satir"><span>Şüpheli:</span><span style="color:#ffaa00;">${d.suspicious}</span></div>`;
        h += `<div class="vt-bilgi-satir"><span>Temiz:</span><span style="color:#40e0d0;">${d.harmless}</span></div>`;
        if (d.engines && d.engines.length > 0) {
            h += `<h4 style="color:#c62828;margin-top:10px;">⚠️ Tespit Eden Motorlar:</h4>`;
            d.engines.forEach(e => { h += `<span class="vt-etiket">${e.name}: ${e.result || e.category}</span>`; });
        }
        h += `</div></div>`;
        document.body.insertAdjacentHTML("beforeend", h);
    } catch(e) {}
}
// IP Dedektörü
document.getElementById("sorguBtn").addEventListener("click", sorgula);
document.getElementById("exportBtn").addEventListener("click", exportCSV);

async function sorgula() {
        if (sorguAktif) return;
        window.onbeforeunload = () => "Sorgu devam ediyor. Sayfayı yenilemek istediğinize emin misiniz?";
    const input = document.getElementById("ipInput").value.trim();
    const sonucDiv = document.getElementById("sonuc");
    const btn = document.getElementById("sorguBtn");
    const exportBtn = document.getElementById("exportBtn");
    const vtDetayBtn = document.getElementById("vtDetayBtn");

    if (!input) {
        sonucDiv.innerHTML = '<p class="hata">Lütfen en az bir IP adresi girin.</p>';
        return;
    }

    const ipRegex = /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g;
    const ipListesi = input.match(ipRegex) || [];
    const benzersizIP = [...new Set(ipListesi)];

    if (benzersizIP.length === 0) {
        sonucDiv.innerHTML = '<p class="hata">Geçerli IP adresi bulunamadı.</p>';
        return;
    }

    const gecmisData = await gecmisiGetir();
    const son24s = Date.now() - 24 * 60 * 60 * 1000;
    const son24IPler = new Set(gecmisData.filter(k => k.tarih > son24s).map(k => k.ip));
    const filtrelenmisIP = benzersizIP.filter(ip => !son24IPler.has(ip));

    if (filtrelenmisIP.length === 0) {
        sonucDiv.innerHTML = '<p class="hata">Tüm IP\'ler son 24 saat içinde sorgulanmış.</p>';
        return;
    }

    vtIptal = true;
    btn.disabled = true;
    sorguAktif = true;
        window.onbeforeunload = () => "Sorgu devam ediyor. Sayfayı yenilemek istediğinize emin misiniz?";
    btn.textContent = "Sorgulanıyor...";
    exportBtn.style.display = "none";
    if (vtDetayBtn) vtDetayBtn.style.display = "none";
    document.getElementById("listeler").style.display = "none";
    document.getElementById("vtPanel").style.display = "none";
    sonucDiv.innerHTML = '<p class="loading">ipinfo + AbuseIPDB sorgulanıyor...</p>';

    const sonuclar = [];

    for (let i = 0; i < filtrelenmisIP.length; i++) {
        const ip = filtrelenmisIP[i];
        sonucDiv.innerHTML = `<p class="loading">Sorgulanıyor: ${i+1}/${filtrelenmisIP.length} - ${ip}</p>`;

        let ipInfoData = null;
        let abuseData = null;
        try { ipInfoData = await fetch(`https://bloodeye-proxy.onrender.com/ipinfo?ip=${ip}`).then(r => r.json()); } catch(e) {}
        try { abuseData = await fetch(`https://bloodeye-proxy.onrender.com/abuse?ip=${ip}`).then(r => r.json()); } catch(e) {}
        sonuclar.push({ ip, ipInfo: ipInfoData, abuse: abuseData });
    }

    sonVeriler = sonuclar;
    vtHamVeriler = new Array(sonuclar.length).fill(null);

    sonuclar.forEach(v => {
        const ap = abuseSusPuan(v);
        const ip = infoSusPuan(v);
        gecmiseEkle({ ip: v.ip, tarih: Date.now(), abusePuan: ap, infoPuan: ip });
    });

     tabloOlustur(sonuclar);
    
    const a = ayarlariGetir();
    console.log("Ses test:", a.sesliUyari, "Kritik var mı:", sonuclar.some(v => abuseSusPuan(v) >= getEsikKritik() || infoSusPuan(v) >= getEsikKritik()));
    
    if (a.sesliUyari && sonuclar.some(v => abuseSusPuan(v) >= getEsikKritik() || infoSusPuan(v) >= getEsikKritik())) {
        try {
            const beep = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
            beep.volume = 0.8;
            beep.play().catch(()=>{});
        } catch(e) {}
    }
        // Tarayıcı bildirimi
        const ayar = ayarlariGetir();
    if (ayar.tarayiciBildirim && Notification.permission === "granted") {
        const kritikSayi = sonuclar.filter(v => abuseSusPuan(v) >= getEsikKritik() || infoSusPuan(v) >= getEsikKritik()).length;
        try {
            new Notification("SUZGECH", { body: `${kritikSayi} kritik IP bulundu` });
            console.log("Bildirim basarili");
        } catch(e) {
            console.log("Bildirim hatasi:", e.message);
        }
    }
    btn.disabled = false;
    sorguAktif = false;
        window.onbeforeunload = null;
    btn.textContent = "Sorgula";
    exportBtn.style.display = "block";
    if (vtDetayBtn) vtDetayBtn.style.display = "block";
    vtOtomatikBaslat(sonuclar);
    gecmisiGoster();
}

function tabloOlustur(veriler) {
    let html = "<table><tr><th>IP</th><th>Ülke</th><th>ISP/Org</th><th>ipinfo</th><th>AbuseIPDB</th><th>VT</th><th></th></tr>";
    veriler.forEach((v, index) => {
        const ip = infoSusPuan(v);
        const ap = abuseSusPuan(v);
        const is = ip >= 70 ? "sus-yuksek" : ip >= 40 ? "sus-orta" : "sus-dusuk";
        const as = ap >= 70 ? "sus-yuksek" : ap >= 40 ? "sus-orta" : "sus-dusuk";
        html += `<tr><td>${v.ip}</td><td>${(v.ipInfo && v.ipInfo.country) || "-"}</td><td>${(v.ipInfo && v.ipInfo.org) || "-"}</td><td class="${is}">%${ip}</td><td class="${as}">%${ap}</td><td id="vt-${index}" class="vt-bekliyor">...</td><td><button class="detayBtn" onclick="detayGoster(${index})">Detay</button></td></tr>`;
    });
    html += "</table>";
    document.getElementById("sonuc").innerHTML = html;

    let blackIPs = [], whiteIPs = [];
    veriler.forEach(v => {
        if (abuseSusPuan(v) >= 20 || infoSusPuan(v) >= 20) blackIPs.push(v.ip);
        else whiteIPs.push(v.ip);
    });
    document.getElementById("blacklist").value = blackIPs.join("\n");
    document.getElementById("whitelist").value = whiteIPs.join("\n");
    document.getElementById("listeler").style.display = "flex";
}

async function vtOtomatikBaslat(veriler) {
    vtIptal = false;
    sorguAktif = true;
    window.onbeforeunload = () => "VT taraması devam ediyor...";
    const panel = document.getElementById("vtPanel");
    const durum = document.getElementById("vtDurum");
    const sonucDiv = document.getElementById("vtSonuc");
    panel.style.display = "block";
    sonucDiv.innerHTML = "";

    for (let i = 0; i < veriler.length; i++) {
        if (vtIptal) break;
        const v = veriler[i];
        durum.textContent = `Taranıyor: ${i+1}/${veriler.length}`;
        const sid = `vtsatir-${i}`;
        sonucDiv.insertAdjacentHTML("beforeend", `<div id="${sid}" class="vt-satir vt-bekliyor">${v.ip} → Bekleniyor...</div>`);
        try {
            const res = await fetch(`https://bloodeye-proxy.onrender.com/vt?ip=${v.ip}`).then(r => r.json());
            vtHamVeriler[i] = res;
            if (res.data) {
                const stats = res.data.attributes.last_analysis_stats;
                const mal = stats.malicious || 0;
                const tot = Object.values(stats).reduce((a,b) => a+b, 0);
                document.getElementById(`vt-${i}`).textContent = `${mal}/${tot}`;
                v.vtSonuc = `${mal}/${tot}`;
                v.vtDetay = { total: tot, malicious: mal, suspicious: stats.suspicious || 0, harmless: stats.harmless || 0, engines: Object.entries(res.data.attributes.last_analysis_results || {}).filter(([k,v]) => v.category === "malicious" || v.category === "suspicious").map(([k,v]) => ({ name: k, result: v.result, category: v.category })) };
                if (mal > 0) {
                    document.getElementById(`vt-${i}`).style.color = "#c62828";
                    document.getElementById(`vt-${i}`).style.fontWeight = "bold";
                    document.getElementById(sid).className = "vt-satir vt-supheli";
                    document.getElementById(sid).textContent = `${v.ip} → ${mal}/${tot} ⚠️`;
                } else {
                    document.getElementById(`vt-${i}`).style.color = "#40e0d0";
                    v.vtSonuc = `${mal}/${tot}`;
                    document.getElementById(sid).className = "vt-satir vt-temiz";
                    document.getElementById(sid).textContent = `${v.ip} → ${mal}/${tot} ✅`;
                }
            }
        } catch(e) {
            document.getElementById(`vt-${i}`).textContent = "Hata";
            v.vtSonuc = "Hata";
            document.getElementById(sid).textContent = `${v.ip} → Hata`;
        }
        gecmisiGoster();
        await new Promise(r => setTimeout(r, 15000));
    }


    console.log("VT bitti, veriler:", veriler.length, "vtSonuc:", veriler.filter(v => v.vtSonuc).length);
    
    const vtGuncellemeler = veriler.filter(v => v.vtSonuc && v.vtSonuc !== "Hata").map(v => ({
        ip: v.ip,
        vtSonuc: v.vtSonuc,
        vtDetay: v.vtDetay || null
    }));
    
    console.log("Gonderilecek:", vtGuncellemeler.length);
    if (vtGuncellemeler.length > 0) {
        try {
            const res = await fetch("https://bloodeye-proxy.onrender.com/gecmis/vt-toplu-guncelle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(vtGuncellemeler)
            });
            console.log("VT guncelleme cevap:", res.status);
            // Kayıt başarılı olduktan sonra arayüzü ve verileri hemen tazele
            await gecmisiGoster();
            await dashboardGuncelle();
        } catch(e) { 
            console.log("VT hata:", e.message); 
        }
    }
    sorguAktif = false;
    window.onbeforeunload = null;
    durum.textContent = `Tamamlandı (${veriler.length} IP)`;
    sorguAktif = false;
    window.onbeforeunload = null;
    durum.textContent = `Tamamlandı (${veriler.length} IP)`;
        await dashboardGuncelle();
    gecmisiGoster();
        dashboardGuncelle();
}

function vtDetayPanel() {
    let h = `<div class="popup-overlay" onclick="this.remove()"><div class="popup popup-vt" onclick="event.stopPropagation()"><h2>🛡️ Virustotal Detay Raporu</h2><button class="popup-close" onclick="document.querySelector('.popup-overlay').remove()">✕</button>`;
    sonVeriler.forEach((v,i) => {
        const vd = vtHamVeriler[i];
        h += `<div class="vt-detay-kart"><div class="vt-detay-baslik" onclick="this.nextElementSibling.classList.toggle('acik')">`;
        if (vd && vd.data) {
            const s = vd.data.attributes.last_analysis_stats;
            const mal = s.malicious || 0;
            const tot = Object.values(s).reduce((a,b) => a+b, 0);
            h += `<span class="vt-detay-ip">${v.ip}</span><span class="vt-detay-ozet"><span style="color:${mal>0?'#c62828':'#40e0d0'}">${mal}/${tot}</span><span>▼</span></span>`;
        } else h += `<span class="vt-detay-ip">${v.ip}</span><span style="color:#ffaa00;">Veri yok</span>`;
        h += `</div><div class="vt-detay-icerik">`;
        if (vd && vd.data) {
            const attr = vd.data.attributes, s = attr.last_analysis_stats, res = attr.last_analysis_results || {};
            h += `<div class="vt-bilgi-satir"><span>Toplam:</span><span>${Object.values(s).reduce((a,b)=>a+b,0)}</span></div>`;
            h += `<div class="vt-bilgi-satir"><span>Zararlı:</span><span style="color:#c62828;">${s.malicious||0}</span></div>`;
            h += `<div class="vt-bilgi-satir"><span>Şüpheli:</span><span style="color:#ffaa00;">${s.suspicious||0}</span></div>`;
            h += `<div class="vt-bilgi-satir"><span>Temiz:</span><span style="color:#40e0d0;">${s.harmless||0}</span></div>`;
            const malE = Object.entries(res).filter(([k,v])=>v.category==="malicious");
            if (malE.length) { h += `<h4 style="color:#c62828;margin-top:10px;">⚠️ Zararlı:</h4>`; malE.forEach(([m,d]) => h += `<span class="vt-etiket">${m}: ${d.result||"zararlı"}</span>`); }
        } else h += `<p style="color:#ffaa00;">VT verisi henüz alınamadı.</p>`;
        h += `</div></div>`;
    });
    h += `</div></div>`;
    document.body.insertAdjacentHTML("beforeend", h);
}

function infoSusPuan(v) { let p=0; const ip=v.ipInfo; if(!ip)return 0; if(ip.org){ const o=ip.org.toLowerCase(); if(o.includes("hosting")||o.includes("vps")||o.includes("server")||o.includes("cloud"))p+=30; if(o.includes("vpn")||o.includes("proxy")||o.includes("tor"))p+=30; } if(ip.country&&["RU","CN","KP","IR","NG"].includes(ip.country))p+=15; return Math.min(p,100); }
function abuseSusPuan(v) { const a=v.abuse; if(!a||!a.data)return 0; return a.data.abuseConfidenceScore; }

function detayGoster(index) {
    const v=sonVeriler[index];
    let h=`<div class="popup-overlay" onclick="this.remove()"><div class="popup" onclick="event.stopPropagation()"><h2>${v.ip} - Ham Veri</h2><button class="popup-close" onclick="document.querySelector('.popup-overlay').remove()">✕</button>`;
    h+=`<h3>ipinfo.io</h3><pre>${v.ipInfo?JSON.stringify(v.ipInfo,null,2):"Yok"}</pre>`;
    h+=`<h3>AbuseIPDB</h3><pre>${v.abuse?JSON.stringify(v.abuse,null,2):"Yok"}</pre>`;
    h+=`<h3>Linkler</h3><div class="link-list"><a href="https://ipinfo.io/${v.ip}" target="_blank">ipinfo.io</a><a href="https://www.abuseipdb.com/check/${v.ip}" target="_blank">AbuseIPDB</a><a href="https://www.virustotal.com/gui/ip-address/${v.ip}" target="_blank">VirusTotal</a></div></div></div>`;
    document.body.insertAdjacentHTML("beforeend", h);
}

function exportCSV() {
    let html="<table><tr><th>IP</th><th>Ülke</th><th>ISP/Org</th><th>ipinfo</th><th>AbuseIPDB</th><th>VT</th></tr>";
    sonVeriler.forEach((v,i)=>{ const vt=document.getElementById(`vt-${i}`); html+=`<tr><td>${v.ip}</td><td>${(v.ipInfo&&v.ipInfo.country)||"-"}</td><td>${(v.ipInfo&&v.ipInfo.org)||"-"}</td><td>%${infoSusPuan(v)}</td><td>%${abuseSusPuan(v)}</td><td>${vt?vt.textContent:"-"}</td></tr>`; });
    html+="</table>";
    const blob=new Blob(["\uFEFF"+html],{type:"application/vnd.ms-excel;charset=utf-8;"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="ip_sorgu_sonuc.xls"; a.click();
}

function kopyala(id) { const t=document.getElementById(id); t.select(); t.setSelectionRange(0,99999); navigator.clipboard.writeText(t.value); const btn=t.parentElement.querySelector(".copyBtn"); btn.textContent="✅"; setTimeout(()=>{btn.textContent="📋";},1500); }
function loginPopup() {
    let h = `<div class="popup-overlay" onclick="this.remove()"><div class="popup popup-reset" onclick="event.stopPropagation()">`;
    h += `<h2>🔑 Admin Girişi</h2>`;
    h += `<input type="password" id="adminSifre" placeholder="Admin şifresi" style="width:100%;padding:8px;margin-bottom:15px;background:#16213e;color:#eee;border:1px solid #0f3460;border-radius:4px;">`;
    h += `<div class="btn-group"><button class="btn-tamam" onclick="adminGiris()">Giriş</button><button class="btn-iptal" onclick="document.querySelector('.popup-overlay').remove()">İptal</button></div>`;
    h += `</div></div>`;
    document.body.insertAdjacentHTML("beforeend", h);
}

async function adminGiris() {
        const sifre = document.getElementById("adminSifre").value;
    document.getElementById("adminSifre").value = ""; // hemen temizle
    try {
        const res = await fetch("https://bloodeye-proxy.onrender.com/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sifre })
        });
        const data = await res.json();
        if (data.admin) {
            localStorage.setItem("suzgec_admin", "true");
            document.querySelectorAll(".popup-overlay").forEach(p => p.remove());
            adminDurumGuncelle();
        } else {
            alert("Yanlış şifre!");
        }
    } catch(e) { alert("Bağlantı hatası!"); }
}

function adminCikis() {
    localStorage.removeItem("suzgec_admin");
    adminDurumGuncelle();
}

function adminDurumGuncelle() {
    const admin = localStorage.getItem("suzgec_admin") === "true";
    document.getElementById("loginBtn").textContent = admin ? "🔓 Çıkış" : "🔑 Giriş";
    document.getElementById("loginBtn").onclick = admin ? adminCikis : loginPopup;
    document.getElementById("adminBadge").style.display = admin ? "block" : "none";
    const kart = document.getElementById("adminSifirlaKart");
    if (kart) kart.style.display = admin ? "block" : "none";
}
function sifirlaPopup() {
        if (localStorage.getItem("suzgec_admin") !== "true") {
        alert("Bu işlem için admin yetkisi gerekli!");
        return;
    }
    let h=`<div class="popup-overlay" onclick="this.remove()"><div class="popup popup-reset" onclick="event.stopPropagation()"><h2>⚠️ Tüm Verileri Sıfırla</h2><p>Dashboard verileri kalıcı olarak silinecek.</p><input type="password" id="sifreInput" placeholder="Admin şifresi" style="width:100%;padding:8px;margin-bottom:15px;background:#16213e;color:#eee;border:1px solid #0f3460;border-radius:4px;"><div class="btn-group"><button class="btn-tamam" onclick="sifirlaOnay()">Tamam</button><button class="btn-iptal" onclick="document.querySelector('.popup-overlay').remove()">İptal</button></div></div></div>`;
    document.body.insertAdjacentHTML("beforeend", h);
}
async function sifirlaOnay() {
        const sifre = document.getElementById("sifreInput").value;
    document.getElementById("sifreInput").value = "";
    try {
        const res = await fetch("https://bloodeye-proxy.onrender.com/sifirla", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sifre })
        });
        if (res.ok) { location.reload(); }
        else { alert("Yetkisiz!"); }
    } catch(e) { alert("Bağlantı hatası!"); }
}
async function gecmisiGoster() {
    const gecmis=await gecmisiGetir(), son24s=Date.now()-24*60*60*1000, sonKayitlar=gecmis.filter(k=>k.tarih>son24s).sort((a,b)=>b.tarih-a.tarih);
    const panel=document.getElementById("gecmisPanel"); if(!panel)return;
    if(sonKayitlar.length===0){panel.style.display="none";return;}
    panel.style.display="block";
    let html="<table><tr><th>IP</th><th>Tarih</th><th>Durum</th><th>Abuse</th><th>ipinfo</th><th>VT</th></tr>";
    sonKayitlar.forEach(k=>{ const tarih=new Date(k.tarih).toLocaleString("tr-TR"), puan=Math.max(k.abusePuan||0,k.infoPuan||0); let durum=''; if(puan>=21)durum='<span style="color:#c62828;">🔴 Kritik</span>'; else if(puan>=15)durum='<span style="color:#ffaa00;">🟠 Şüpheli</span>'; else durum='<span style="color:#40e0d0;">🟢 Temiz</span>'; html+=`<tr><td>${k.ip}</td><td>${tarih}</td><td>${durum}</td><td>%${k.abusePuan||0}</td><td>%${k.infoPuan||0}</td><td>${k.vtSonuc||"-"}</td></tr>`; });
    html+="</table>"; document.getElementById("gecmisTablo").innerHTML=html;
}

function ulkeKoduEmoji(kod) { if(!kod||kod.length!==2)return"🏳️"; return String.fromCodePoint(kod.charCodeAt(0)+127397,kod.charCodeAt(1)+127397); }

function gaugeCiz(oran, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 240 * dpr;
    canvas.height = 180 * dpr;
    canvas.style.width = "240px";
    canvas.style.height = "180px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const w = 240, h = 180, cx = w/2, cy = h - 10, r = 100;
    ctx.clearRect(0, 0, w, h);
    
    // Arka plan halka
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 22;
    ctx.stroke();
    
    // Renk
    let renk = "#40e0d0";
    if (oran >= 70) renk = "#c62828";
    else if (oran >= 40) renk = "#ffaa00";
    
    // Dolu kısım
    const aci = Math.PI + (Math.PI * oran / 100);
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, aci);
    ctx.strokeStyle = renk;
    ctx.lineWidth = 20;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.lineCap = "butt";
    
    // Yüzde - tam ortada
    ctx.fillStyle = renk;
    ctx.font = "bold 28px 'Segoe UI'";
    ctx.textAlign = "center";
    ctx.fillText("%" + oran, cx, cy - 55);
    
    // Uç nokta
    const ex = cx + r * Math.cos(aci);
    const ey = cy + r * Math.sin(aci);
    ctx.beginPath();
    ctx.arc(ex, ey, 6, 0, Math.PI * 2);
    ctx.fillStyle = renk;
    ctx.fill();
}

// Tehdit Analizi
async function tehditAnaliziGuncelle() {
    const gecmis = await gecmisiGetir();
    const simdi = Date.now();
    const son7Gun = simdi - 7 * 24 * 60 * 60 * 1000;
    const son1Saat = simdi - 60 * 60 * 1000;
    const son7Kayit = gecmis.filter(k => k.tarih > son7Gun);
    const son1SaatKayit = gecmis.filter(k => k.tarih > son1Saat);

    const kritik = son7Kayit.filter(k => k.seviye === "kritik").length;
    const supheli = son7Kayit.filter(k => k.seviye === "supheli").length;
    const temiz = son7Kayit.filter(k => k.seviye === "temiz").length;
    const toplam = son7Kayit.length || 1;
    pastaCiz(temiz, supheli, kritik, toplam);

    const konumCache = JSON.parse(localStorage.getItem("bloodeye_konum") || "{}");
    const ulkeListe = [], islenenIPler = new Set();
    for (const k of son7Kayit.filter(k => k.seviye === "kritik")) {
        if (islenenIPler.has(k.ip)) continue;
        islenenIPler.add(k.ip);
        const cached = konumCache[k.ip], ulke = cached?.country || "??";
        const ulkeKodu = cached?.country || "??";
        const bayrak = ulkeKodu !== "??" ? ulkeKoduEmoji(ulkeKodu) : "🏳️";
        ulkeListe.push({ ip: k.ip, ulke: ulkeKodu, bayrak, adet: son7Kayit.filter(x => x.ip === k.ip && x.seviye === "kritik").length });
    }
    const ulkeSirali = ulkeListe.sort((a,b) => b.adet - a.adet).slice(0, 5);
    let ulkeHtml = ulkeSirali.length === 0 ? '<p class="bos">Veri yok</p>' : ulkeSirali.map(u => `<div class="ulke-item"><span>${u.bayrak} ${u.ip}</span><span>${u.adet}x</span></div>`).join("");
    document.getElementById("ulkeListesi").innerHTML = ulkeHtml;

    const s1Kritik = son1SaatKayit.filter(k => k.seviye === "kritik").length;
    const s1Supheli = son1SaatKayit.filter(k => k.seviye === "supheli").length;
    const s1Temiz = son1SaatKayit.filter(k => k.seviye === "temiz").length;
    const s1Toplam = son1SaatKayit.length;
    const s1Oran = s1Toplam > 0 ? Math.round((s1Temiz / s1Toplam) * 100) : 100;
    const guvenlikRengi = s1Oran >= 80 ? '#40e0d0' : s1Oran >= 50 ? '#ffaa00' : '#c62828';
    document.getElementById("saatOzet").innerHTML = `<div class="buyuk-sayi" style="color:${guvenlikRengi};">%${s1Oran}</div><div>Temiz oranı</div><div class="alt-bilgi">${s1Toplam} tarama: ${s1Temiz} temiz, ${s1Supheli} şüpheli, ${s1Kritik} kritik</div>`;

    setTimeout(() => haritaGuncelle(son7Kayit.filter(k => k.seviye === "kritik")), 500);
}

function pastaCiz(temiz, supheli, kritik, toplam) {
    const canvas = document.getElementById("pastaChart");
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 200 * dpr;
    canvas.height = 200 * dpr;
    canvas.style.width = "200px";
    canvas.style.height = "200px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const w = 200, h = 200, cx = w/2, cy = h/2, r = 80;
    ctx.clearRect(0, 0, w, h);
    const veriler = [{ deger: temiz, renk: "#40e0d0", etiket: "Temiz" },{ deger: supheli, renk: "#ffaa00", etiket: "Şüpheli" },{ deger: kritik, renk: "#c62828", etiket: "Kritik" }];
    let baslangic = -Math.PI/2;
    veriler.forEach(v => { if(v.deger===0)return; const dilim=(v.deger/toplam)*Math.PI*2; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,baslangic,baslangic+dilim); ctx.fillStyle=v.renk; ctx.fill(); baslangic+=dilim; });
    ctx.fillStyle="#0d1117"; ctx.beginPath(); ctx.arc(cx,cy,40,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#eee"; ctx.font="bold 16px Segoe UI"; ctx.textAlign="center"; ctx.fillText(toplam,cx,cy+6);
    document.getElementById("pastaLegend").innerHTML = veriler.map(v => `<div class="pasta-legend-item"><span class="pasta-legend-dot" style="background:${v.renk};"></span> ${v.etiket}: ${v.deger} (%${Math.round((v.deger/toplam)*100)})</div>`).join("");
}

async function haritaGuncelle(kritikIPler) {
    const haritaDiv = document.getElementById("harita"); if (!haritaDiv) return;
    if (!haritaObj) {
        haritaObj = L.map("harita").setView([30, 0], 2);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>' }).addTo(haritaObj);
    }
    haritaObj.eachLayer(layer => { if (layer instanceof L.CircleMarker) haritaObj.removeLayer(layer); });
    const benzersiz = [...new Set(kritikIPler.map(k => k.ip))];
    const konumCache = JSON.parse(localStorage.getItem("bloodeye_konum") || "{}");
    const istekler = [];
    for (const ip of benzersiz) {
        if (konumCache[ip]) { istekler.push(Promise.resolve({ ip, ...konumCache[ip] })); }
        else {
            istekler.push(
                fetch(`https://bloodeye-proxy.onrender.com/ipinfo?ip=${ip}`).then(r => r.json()).then(res => {
                    if (res && res.loc) { konumCache[ip] = { loc: res.loc, city: res.city, country: res.country }; localStorage.setItem("bloodeye_konum", JSON.stringify(konumCache)); }
                    return { ip, loc: res?.loc, city: res?.city, country: res?.country };
                }).catch(() => ({ ip }))
            );
        }
    }
    const sonuclar = await Promise.all(istekler);
    sonuclar.forEach(({ ip, loc, city, country }) => {
        if (loc) {
            const [lat, lon] = loc.split(",").map(Number);
            const adet = kritikIPler.filter(k => k.ip === ip).length;
            L.circleMarker([lat, lon], { radius: Math.min(adet * 8 + 10, 40), color: "#c62828", weight: 2, fillColor: "#c62828", fillOpacity: 0.4 }).addTo(haritaObj).bindPopup(`<b>${ip}</b><br>${city || ""}, ${country || ""}<br>Kritik: ${adet}x`);
        }
    });
}
// Hash Dedektörü
let hashSonVeriler = [];
let hashVtVeriler = [];

document.getElementById("hashSorguBtn")?.addEventListener("click", hashSorgula);
document.getElementById("dosyaInput")?.addEventListener("change", async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    document.getElementById("dosyaAdi").textContent = file.name;
    document.getElementById("dosyaBtn").disabled = true;
    document.getElementById("dosyaBtn").textContent = "Hash hesaplanıyor...";
    
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2,"0")).join("");
    
    document.getElementById("hashInput").value = hashHex;
    document.getElementById("dosyaBtn").disabled = false;
    document.getElementById("dosyaBtn").textContent = "📁 Dosya Seç ve Hash Hesapla";
    document.getElementById("dosyaAdi").textContent = file.name + " (SHA256 hesaplandı)";
    
    // Otomatik sorgula
    hashSorgula();
});
async function hashSorgula() {
        window.onbeforeunload = () => "Sorgu devam ediyor. Sayfayı yenilemek istediğinize emin misiniz?";
        
    const input = document.getElementById("hashInput").value.trim();
    const sonucDiv = document.getElementById("hashSonuc");
    const btn = document.getElementById("hashSorguBtn");

    if (!input) {
        sonucDiv.innerHTML = '<p class="hata">Lütfen en az bir hash girin.</p>';
        return;
    }

    const hashRegex = /\b[a-fA-F0-9]{32}(?:[a-fA-F0-9]{8})?(?:[a-fA-F0-9]{24})?\b/g;
    const hashListesi = input.match(hashRegex) || [];
    const benzersizHash = [...new Set(hashListesi.map(h => h.toLowerCase()))];

    if (benzersizHash.length === 0) {
        sonucDiv.innerHTML = '<p class="hata">Geçerli hash bulunamadı (MD5/SHA1/SHA256).</p>';
        return;
    }

    btn.disabled = true;
    sorguAktif = true;
    window.onbeforeunload = null;
    btn.textContent = "Sorgulanıyor...";
    document.getElementById("vtHashPanel").style.display = "none";
    sonucDiv.innerHTML = '<p class="loading">Virustotal hash sorgulanıyor...</p>';

    const sonuclar = [];

    for (let i = 0; i < benzersizHash.length; i++) {
        const hash = benzersizHash[i];
        sonucDiv.innerHTML = `<p class="loading">Sorgulanıyor: ${i+1}/${benzersizHash.length} - ${hash.substring(0,16)}...</p>`;

        try {
            const res = await fetch(`https://bloodeye-proxy.onrender.com/vt-hash?hash=${hash}`).then(r => r.json());
            sonuclar.push({ hash, data: res });
        } catch(e) {
            sonuclar.push({ hash, data: null });
        }

        await new Promise(r => setTimeout(r, 15000));
    }

    hashSonVeriler = sonuclar;
    hashTablosuOlustur(sonuclar);
    hashGecmiseEkle(sonuclar);
    hashGecmisiGoster();
    btn.disabled = false;
    sorguAktif = false;
    btn.textContent = "Hash Sorgula";
}
async function hashGecmisiGetir() { 
    try {
        const res = await fetch("https://bloodeye-proxy.onrender.com/gecmis/hash");
        return await res.json();
    } catch(e) { return []; }
}

async function hashGecmiseEkle(sonuclar) {
    const simdi = Date.now();
    const kayitlar = sonuclar.map(v => ({
        hash: v.hash,
        tarih: simdi,
        malicious: v.data?.data?.attributes?.last_analysis_stats?.malicious || 0,
        harmless: v.data?.data?.attributes?.last_analysis_stats?.harmless || 0,
        name: v.data?.data?.attributes?.meaningful_name || "-"
    }));
    try {
        await fetch("https://bloodeye-proxy.onrender.com/gecmis/hash", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(kayitlar)
        });
    } catch(e) {}
}

async function hashGecmisiGoster() { 
    const gecmis = await hashGecmisiGetir();
    const panel = document.getElementById("hashGecmisPanel");
    if (!panel) return;
    if (gecmis.length === 0) { panel.style.display = "none"; return; }
    panel.style.display = "block";

    const sirali = gecmis.sort((a,b) => b.tarih - a.tarih);
    let html = "<table><tr><th>Hash</th><th>Tarih</th><th>Zararlı</th><th>Temiz</th><th>Ad</th></tr>";
    sirali.forEach(k => {
        const tarih = new Date(k.tarih).toLocaleString("tr-TR");
        const kisa = k.hash.length > 20 ? k.hash.substring(0,8)+"..."+k.hash.substring(k.hash.length-8) : k.hash;
        const renk = k.malicious > 0 ? 'color:#c62828;font-weight:bold;' : 'color:#40e0d0;';
        html += `<tr><td style="font-family:monospace;font-size:11px;" title="${k.hash}">${kisa}</td><td>${tarih}</td><td style="${renk}">${k.malicious}</td><td style="color:#40e0d0;">${k.harmless}</td><td>${k.name}</td></tr>`;
    });
    html += "</table>";
    document.getElementById("hashGecmisTablo").innerHTML = html;
}
function hashDetayGoster(hash) {
    const v = hashSonVeriler.find(s => s.hash === hash);
    if (!v || !v.data || !v.data.data) {
        alert("Detay verisi bulunamadı.");
        return;
    }

    const attr = v.data.data.attributes;
    const stats = attr.last_analysis_stats || {};
    const results = attr.last_analysis_results || {};
    const total = Object.values(stats).reduce((a,b) => a+b, 0);

    let h = `<div class="popup-overlay" onclick="this.remove()">`;
    h += `<div class="popup popup-vt" onclick="event.stopPropagation()">`;
    h += `<h2>🛡️ VT Hash Detay</h2>`;
    h += `<button class="popup-close" onclick="document.querySelector('.popup-overlay').remove()">✕</button>`;
    h += `<p style="font-family:monospace;font-size:11px;word-break:break-all;margin-bottom:10px;">${hash}</p>`;
    h += `<div class="vt-bilgi-satir"><span>Toplam motor:</span><span>${total}</span></div>`;
    h += `<div class="vt-bilgi-satir"><span>Zararlı:</span><span style="color:#c62828;font-weight:bold;">${stats.malicious||0}</span></div>`;
    h += `<div class="vt-bilgi-satir"><span>Şüpheli:</span><span style="color:#ffaa00;">${stats.suspicious||0}</span></div>`;
    h += `<div class="vt-bilgi-satir"><span>Temiz:</span><span style="color:#40e0d0;">${stats.harmless||0}</span></div>`;
    h += `<div class="vt-bilgi-satir"><span>Tespit edilemedi:</span><span>${stats.undetected||0}</span></div>`;
    h += `<div class="vt-bilgi-satir"><span>Popüler Ad:</span><span>${attr.meaningful_name || "-"}</span></div>`;

    const maliciousEngines = Object.entries(results).filter(([k,v]) => v.category === "malicious");
    if (maliciousEngines.length > 0) {
        h += `<h4 style="color:#c62828;margin-top:10px;">⚠️ Zararlı Tespit Eden Motorlar:</h4>`;
        maliciousEngines.forEach(([motor, detay]) => {
            h += `<span class="vt-etiket">${motor}: ${detay.result || "zararlı"}</span>`;
        });
    }

    const suspiciousEngines = Object.entries(results).filter(([k,v]) => v.category === "suspicious");
    if (suspiciousEngines.length > 0) {
        h += `<h4 style="color:#ffaa00;margin-top:10px;">⚠️ Şüpheli Tespit Eden Motorlar:</h4>`;
        suspiciousEngines.forEach(([motor, detay]) => {
            h += `<span class="vt-etiket">${motor}: ${detay.result || "şüpheli"}</span>`;
        });
    }

    h += `</div></div>`;
    document.body.insertAdjacentHTML("beforeend", h);
}
function hashTablosuOlustur(veriler) {
    let html = "<table><tr><th>Hash</th><th>Tip</th><th>Zararlı</th><th>Temiz</th><th>Popüler Ad</th><th></th></tr>";

    veriler.forEach((v) => {
        const d = v.data;
        let tip = "-", mal = "-", temiz = "-", ad = "-";

        if (d && d.data) {
            const attr = d.data.attributes;
            tip = v.hash.length === 32 ? "MD5" : v.hash.length === 40 ? "SHA1" : "SHA256";
            const stats = attr.last_analysis_stats || {};
            mal = stats.malicious || 0;
            temiz = stats.harmless || 0;
            ad = attr.meaningful_name || attr.popular_threat_classification?.popular_threat_name || "-";
        } else if (d && d.error) {
            ad = "Bulunamadı";
        }

        const malRengi = mal > 0 ? 'style="color:#c62828;font-weight:bold;"' : 'style="color:#40e0d0;"';
                const kisaHash = v.hash.length > 20 ? v.hash.substring(0,8) + "..." + v.hash.substring(v.hash.length-8) : v.hash;
        html += `<tr><td style="font-family:monospace;font-size:11px;" title="${v.hash}">${kisaHash}</td><td>${tip}</td><td ${malRengi}>${mal}</td><td style="color:#40e0d0;">${temiz}</td><td>${ad}</td><td><button class="detayBtn" onclick="hashDetayGoster('${v.hash}')">VT Detay</button></td></tr>`;
    });

    html += "</table>";
    document.getElementById("hashSonuc").innerHTML = html;
        document.getElementById("hashVtDetayBtn").style.display = "block";
}
// Ayarlar
function ayarlariGetir() {
    return JSON.parse(localStorage.getItem("suzgec_ayarlar") || "{}");
}
function ayarKaydet() {
    const ayarlar = {
        sesliUyari: document.getElementById("sesliUyari")?.checked || false,
        tarayiciBildirim: document.getElementById("tarayiciBildirim")?.checked || false,
        esikSupheli: parseInt(document.getElementById("esikSupheli")?.value) || 15,
        esikKritik: parseInt(document.getElementById("esikKritik")?.value) || 21,
        tema: localStorage.getItem("suzgec_tema") || "dark"
    };
    localStorage.setItem("suzgec_ayarlar", JSON.stringify(ayarlar));
}
function ayarlariYukle() {
    const a = ayarlariGetir();
    if (document.getElementById("sesliUyari")) document.getElementById("sesliUyari").checked = a.sesliUyari || false;
    if (document.getElementById("tarayiciBildirim")) document.getElementById("tarayiciBildirim").checked = a.tarayiciBildirim || false;
    if (document.getElementById("esikSupheli")) document.getElementById("esikSupheli").value = a.esikSupheli || 15;
    if (document.getElementById("esikKritik")) document.getElementById("esikKritik").value = a.esikKritik || 21;
}

function temaDegistir() {
    const mevcut = localStorage.getItem("suzgec_tema") || "dark";
    const yeni = mevcut === "dark" ? "light" : "dark";
    localStorage.setItem("suzgec_tema", yeni);
    document.body.classList.toggle("light-theme", yeni === "light");
    const btn = document.getElementById("temaBtn");
    if (btn) btn.textContent = yeni === "dark" ? "🌙 Karanlık" : "☀️ Aydınlık";
}

// Eşik değerlerini kullanan fonksiyonları güncelle
function getEsikSupheli() {
    return parseInt(ayarlariGetir().esikSupheli) || 15;
}
function getEsikKritik() {
    return parseInt(ayarlariGetir().esikKritik) || 21;
}

// Sayfa yüklenince ayarları uygula
ayarlariYukle();
if (localStorage.getItem("suzgec_tema") === "light") {
    document.body.classList.add("light-theme");
    const temaBtn = document.getElementById("temaBtn");
    if (temaBtn) temaBtn.textContent = "☀️ Aydınlık";
}
if (Notification.permission === "default") {
    Notification.requestPermission();
}
// URL Süzgeci
let urlSonVeriler = [];

document.getElementById("urlSorguBtn")?.addEventListener("click", urlSorgula);

async function urlSorgula() {
            window.onbeforeunload = () => "Sorgu devam ediyor. Sayfayı yenilemek istediğinize emin misiniz?";
    const input = document.getElementById("urlInput").value.trim();
    const sonucDiv = document.getElementById("urlSonuc");
    const btn = document.getElementById("urlSorguBtn");

    if (!input) {
        sonucDiv.innerHTML = '<p class="hata">Lütfen en az bir URL girin.</p>';
        return;
    }

    const satirlar = input.split("\n").map(s => s.trim()).filter(s => s !== "");
    const urlListesi = satirlar.map(s => {
        if (!s.startsWith("http")) s = "https://" + s;
        return s;
    });

    if (urlListesi.length === 0) {
        sonucDiv.innerHTML = '<p class="hata">Geçerli URL bulunamadı.</p>';
        return;
    }

    btn.disabled = true;
    sorguAktif = true;
        window.onbeforeunload = null;
    btn.textContent = "Sorgulanıyor...";
    document.getElementById("vtUrlPanel").style.display = "none";
    sonucDiv.innerHTML = '<p class="loading">Virustotal URL sorgulanıyor...</p>';

    const sonuclar = [];

    for (let i = 0; i < urlListesi.length; i++) {
        const url = urlListesi[i];
        sonucDiv.innerHTML = `<p class="loading">Sorgulanıyor: ${i+1}/${urlListesi.length} - ${url.substring(0,50)}...</p>`;

        try {
            const res = await fetch(`https://bloodeye-proxy.onrender.com/vt-url?url=${encodeURIComponent(url)}`).then(r => r.json());
            sonuclar.push({ url, data: res });
        } catch(e) {
            sonuclar.push({ url, data: null });
        }

        await new Promise(r => setTimeout(r, 15000));
    }

    urlSonVeriler = sonuclar;
    urlTablosuOlustur(sonuclar);
    urlGecmiseEkle(sonuclar);
    urlGecmisiGoster();
    btn.disabled = false;
    sorguAktif = false;
    btn.textContent = "URL Sorgula";
}

function urlTablosuOlustur(veriler) {
    let html = "<table><tr><th>URL</th><th>Zararlı</th><th>Temiz</th><th>Son Tarama</th></tr>";

    veriler.forEach(v => {
        const d = v.data;
        let mal = "-", temiz = "-", tarih = "-";
        const kisaUrl = v.url.length > 60 ? v.url.substring(0,57) + "..." : v.url;

        if (d && d.data) {
            const stats = d.data.attributes.last_analysis_stats || {};
            mal = stats.malicious || 0;
            temiz = stats.harmless || 0;
            if (d.data.attributes.last_analysis_date) {
                tarih = new Date(d.data.attributes.last_analysis_date * 1000).toLocaleString("tr-TR");
            }
        } else if (d && d.error) {
            mal = "Hata";
        }

        const malRengi = mal > 0 ? 'style="color:#c62828;font-weight:bold;"' : 'style="color:#40e0d0;"';
        html += `<tr><td title="${v.url}">${kisaUrl}</td><td ${malRengi}>${mal}</td><td style="color:#40e0d0;">${temiz}</td><td>${tarih}</td></tr>`;
    });

    html += "</table>";
    document.getElementById("urlSonuc").innerHTML = html;
}

async function urlGecmisiGetir() { 
    try {
        const res = await fetch("https://bloodeye-proxy.onrender.com/gecmis/url");
        return await res.json();
    } catch(e) { return []; }
}

async function urlGecmiseEkle(sonuclar) {
    const simdi = Date.now();
    const kayitlar = sonuclar.map(v => ({
        url: v.url,
        tarih: simdi,
        malicious: v.data?.data?.attributes?.last_analysis_stats?.malicious || 0,
        harmless: v.data?.data?.attributes?.last_analysis_stats?.harmless || 0
    }));
    try {
        await fetch("https://bloodeye-proxy.onrender.com/gecmis/url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(kayitlar)
        });
    } catch(e) {}
}

async function urlGecmisiGoster() { 
    const gecmis = await urlGecmisiGetir();
    const panel = document.getElementById("urlGecmisPanel");
    if (!panel) return;
    if (gecmis.length === 0) { panel.style.display = "none"; return; }
    panel.style.display = "block";

    const sirali = gecmis.sort((a,b) => b.tarih - a.tarih);
    let html = "<table><tr><th>URL</th><th>Tarih</th><th>Zararlı</th><th>Temiz</th></tr>";
    sirali.forEach(k => {
        const tarih = new Date(k.tarih).toLocaleString("tr-TR");
        const kisa = k.url.length > 60 ? k.url.substring(0,57) + "..." : k.url;
        const renk = k.malicious > 0 ? 'color:#c62828;font-weight:bold;' : 'color:#40e0d0;';
        html += `<tr><td title="${k.url}">${kisa}</td><td>${tarih}</td><td style="${renk}">${k.malicious}</td><td style="color:#40e0d0;">${k.harmless}</td></tr>`;
    });
    html += "</table>";
    document.getElementById("urlGecmisTablo").innerHTML = html;
}
adminDurumGuncelle();
dashboardGuncelle();
urlGecmisiGoster();
gecmisiGoster();
hashGecmisiGoster();
window.addEventListener("resize", async () => {
const gecmis = await gecmisiGetir();
    if (gecmis.length > 0 && document.getElementById("chartHaftalik")) {
        aylikGrafikCiz(gecmis);
    }
    if (haritaObj) haritaObj.invalidateSize();
});