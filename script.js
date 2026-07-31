// v0.17 - Dashboard + localStorage
let sonVeriler = [];
let vtHamVeriler = [];

// Sayfa geçişi
function sayfaGoster(sayfa) {
    document.querySelectorAll(".sayfa").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
    document.getElementById("sayfa-" + sayfa).classList.add("active");
    event.target.classList.add("active");
    if (sayfa === "dashboard") dashboardGuncelle();
}

// localStorage yardımcı
function gecmisiGetir() {
    return JSON.parse(localStorage.getItem("bloodeye_gecmis") || "[]");
}
function gecmiseEkle(kayit) {
    const gecmis = gecmisiGetir();
    gecmis.push(kayit);
    const birHaftaOnce = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const filtrelenmis = gecmis.filter(k => k.tarih > birHaftaOnce);
    localStorage.setItem("bloodeye_gecmis", JSON.stringify(filtrelenmis));
}

// Dashboard güncelle
function dashboardGuncelle() {
    const gecmis = gecmisiGetir();
    const simdi = Date.now();
    const son24s = simdi - 24 * 60 * 60 * 1000;

    // Toplam tarama
    document.getElementById("istToplam").textContent = gecmis.length;

    // Temiz / Şüpheli
    const temiz = gecmis.filter(k => !k.supheli).length;
    const supheli = gecmis.filter(k => k.supheli).length;
    document.getElementById("istTemiz").textContent = temiz;
    document.getElementById("istSupheli").textContent = supheli;

    // Saldırı seviyesi (24s)
    const son24Kayit = gecmis.filter(k => k.tarih > son24s);
    const son24Supheli = son24Kayit.filter(k => k.supheli).length;
    const oran = son24Kayit.length > 0 ? Math.round((son24Supheli / son24Kayit.length) * 100) : 0;

    const gauge = document.getElementById("gaugeCircle");
    const gaugeText = document.getElementById("gaugeText");
    gaugeText.textContent = "%" + oran;
    document.getElementById("gaugeDetay").textContent = `${son24Supheli}/${son24Kayit.length} IP`;

    if (oran >= 70) gauge.style.borderColor = "#ff4444";
    else if (oran >= 40) gauge.style.borderColor = "#ffaa00";
    else gauge.style.borderColor = "#44ff44";

    // Kritik IP listesi
    const kritikIPs = [...new Set(gecmis.filter(k => k.supheli).map(k => k.ip))];
    let kritikHtml = "";
    if (kritikIPs.length === 0) {
        kritikHtml = '<p class="bos">Henüz kritik IP yok</p>';
    } else {
        kritikIPs.slice(0, 10).forEach(ip => {
            const adet = gecmis.filter(k => k.ip === ip && k.supheli).length;
            kritikHtml += `<div class="kritik-item"><span>${ip}</span><span>${adet}x</span></div>`;
        });
    }
    document.getElementById("kritikList").innerHTML = kritikHtml;

    // Haftalık grafik (basit bar)
    haftalikGrafikCiz(gecmis);
}

function haftalikGrafikCiz(gecmis) {
    const gunler = [];
    for (let i = 6; i >= 0; i--) {
        const gun = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        gunler.push(gun.toLocaleDateString("tr-TR", { weekday: "short" }));
    }

    const veri = [0,0,0,0,0,0,0];
    const supheliVeri = [0,0,0,0,0,0,0];
    const simdi = Date.now();

    gecmis.forEach(k => {
        const gunFarki = Math.floor((simdi - k.tarih) / (24 * 60 * 60 * 1000));
        if (gunFarki < 7) {
            veri[6 - gunFarki]++;
            if (k.supheli) supheliVeri[6 - gunFarki]++;
        }
    });

    const max = Math.max(...veri, 1);
    const canvas = document.getElementById("chartHaftalik");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.parentElement.clientWidth - 20;
    canvas.height = 180;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = canvas.width / 18;
    const gap = barWidth * 0.4;

    for (let i = 0; i < 7; i++) {
        const x = i * (barWidth * 2 + gap) + 30;
        const h = (veri[i] / max) * 130;
        const sh = (supheliVeri[i] / max) * 130;

        // Temiz bar
        ctx.fillStyle = "#44ff44";
        ctx.fillRect(x, 150 - h, barWidth, h);

        // Şüpheli bar
        ctx.fillStyle = "#ff4444";
        ctx.fillRect(x + barWidth, 150 - sh, barWidth, sh);

        // Gün yazısı
        ctx.fillStyle = "#aaa";
        ctx.font = "10px Segoe UI";
        ctx.textAlign = "center";
        ctx.fillText(gunler[i], x + barWidth, 170);

        // Sayı
        ctx.fillText(veri[i], x + barWidth, 145 - h);
    }
}

// IP Dedektörü
document.getElementById("sorguBtn").addEventListener("click", sorgula);
document.getElementById("exportBtn").addEventListener("click", exportCSV);

async function sorgula() {
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

    btn.disabled = true;
    btn.textContent = "Sorgulanıyor...";
    exportBtn.style.display = "none";
    if (vtDetayBtn) vtDetayBtn.style.display = "none";
    document.getElementById("listeler").style.display = "none";
    document.getElementById("vtPanel").style.display = "none";
    sonucDiv.innerHTML = '<p class="loading">ipinfo + AbuseIPDB sorgulanıyor...</p>';

    const sonuclar = [];

    for (let i = 0; i < benzersizIP.length; i++) {
        const ip = benzersizIP[i];
        sonucDiv.innerHTML = `<p class="loading">Sorgulanıyor: ${i+1}/${benzersizIP.length} - ${ip}</p>`;

        let ipInfoData = null;
        let abuseData = null;

        try { ipInfoData = await fetch(`https://bloodeye-proxy.onrender.com/ipinfo?ip=${ip}`).then(r => r.json()); } catch(e) {}
        try { abuseData = await fetch(`https://bloodeye-proxy.onrender.com/abuse?ip=${ip}`).then(r => r.json()); } catch(e) {}

        sonuclar.push({ ip, ipInfo: ipInfoData, abuse: abuseData });
    }

    sonVeriler = sonuclar;
    vtHamVeriler = new Array(sonuclar.length).fill(null);

    // Geçmişe kaydet
    sonuclar.forEach(v => {
        const abusePuan = abuseSusPuan(v);
        const infoPuan = infoSusPuan(v);
        gecmiseEkle({
            ip: v.ip,
            tarih: Date.now(),
            supheli: (abusePuan >= 20 || infoPuan >= 20),
            abusePuan,
            infoPuan
        });
    });

    tabloOlustur(sonuclar);
    btn.disabled = false;
    btn.textContent = "Sorgula";
    exportBtn.style.display = "block";
    if (vtDetayBtn) vtDetayBtn.style.display = "block";
    vtOtomatikBaslat(sonuclar);
}

function tabloOlustur(veriler) {
    let html = "<table>";
    html += "<tr><th>IP</th><th>Ülke</th><th>ISP/Org</th><th>ipinfo</th><th>AbuseIPDB</th><th>VT</th><th></th></tr>";

    veriler.forEach((v, index) => {
        const infoPuan = infoSusPuan(v);
        const abusePuan = abuseSusPuan(v);
        const infoSinif = infoPuan >= 70 ? "sus-yuksek" : infoPuan >= 40 ? "sus-orta" : "sus-dusuk";
        const abuseSinif = abusePuan >= 70 ? "sus-yuksek" : abusePuan >= 40 ? "sus-orta" : "sus-dusuk";

        html += "<tr>";
        html += `<td>${v.ip}</td>`;
        html += `<td>${(v.ipInfo && v.ipInfo.country) || "-"}</td>`;
        html += `<td>${(v.ipInfo && v.ipInfo.org) || "-"}</td>`;
        html += `<td class="${infoSinif}">%${infoPuan}</td>`;
        html += `<td class="${abuseSinif}">%${abusePuan}</td>`;
        html += `<td id="vt-${index}" class="vt-bekliyor">...</td>`;
        html += `<td><button class="detayBtn" onclick="detayGoster(${index})">Detay</button></td>`;
        html += "</tr>";
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
    const panel = document.getElementById("vtPanel");
    const durum = document.getElementById("vtDurum");
    const sonucDiv = document.getElementById("vtSonuc");
    panel.style.display = "block";
    sonucDiv.innerHTML = "";

    for (let i = 0; i < veriler.length; i++) {
        const v = veriler[i];
        durum.textContent = `Taranıyor: ${i+1}/${veriler.length}`;
        const satirId = `vtsatir-${i}`;
        sonucDiv.insertAdjacentHTML("beforeend", `<div id="${satirId}" class="vt-satir vt-bekliyor">${v.ip} → Bekleniyor...</div>`);

        try {
            const res = await fetch(`https://bloodeye-proxy.onrender.com/vt?ip=${v.ip}`).then(r => r.json());
            vtHamVeriler[i] = res;
            if (res.data) {
                const stats = res.data.attributes.last_analysis_stats;
                const malicious = stats.malicious || 0;
                const total = Object.values(stats).reduce((a,b) => a+b, 0);
                document.getElementById(`vt-${i}`).textContent = `${malicious}/${total}`;
                if (malicious > 0) {
                    document.getElementById(`vt-${i}`).style.color = "#ff4444";
                    document.getElementById(`vt-${i}`).style.fontWeight = "bold";
                    document.getElementById(satirId).className = "vt-satir vt-supheli";
                    document.getElementById(satirId).textContent = `${v.ip} → ${malicious}/${total} ⚠️`;
                } else {
                    document.getElementById(`vt-${i}`).style.color = "#44ff44";
                    document.getElementById(satirId).className = "vt-satir vt-temiz";
                    document.getElementById(satirId).textContent = `${v.ip} → ${malicious}/${total} ✅`;
                }
            }
        } catch(e) {
            document.getElementById(`vt-${i}`).textContent = "Hata";
            document.getElementById(satirId).textContent = `${v.ip} → Hata`;
        }
        await new Promise(r => setTimeout(r, 15000));
    }
    durum.textContent = `Tamamlandı (${veriler.length} IP)`;
}

function vtDetayPanel() {
    let html = `<div class="popup-overlay" onclick="this.remove()">`;
    html += `<div class="popup popup-vt" onclick="event.stopPropagation()">`;
    html += `<h2>🛡️ Virustotal Detay Raporu</h2>`;
    html += `<button class="popup-close" onclick="document.querySelector('.popup-overlay').remove()">✕</button>`;

    sonVeriler.forEach((v, i) => {
        const vtData = vtHamVeriler[i];
        html += `<div class="vt-detay-kart">`;
        html += `<div class="vt-detay-baslik" onclick="this.nextElementSibling.classList.toggle('acik')">`;
        if (vtData && vtData.data) {
            const stats = vtData.data.attributes.last_analysis_stats;
            const malicious = stats.malicious || 0;
            const total = Object.values(stats).reduce((a,b) => a+b, 0);
            const renk = malicious > 0 ? "#ff4444" : "#44ff44";
            html += `<span class="vt-detay-ip">${v.ip}</span><span class="vt-detay-ozet"><span style="color:${renk}">${malicious}/${total}</span><span>▼</span></span>`;
        } else {
            html += `<span class="vt-detay-ip">${v.ip}</span><span style="color:#ffaa00;">Veri yok</span>`;
        }
        html += `</div><div class="vt-detay-icerik">`;
        if (vtData && vtData.data) {
            const attr = vtData.data.attributes;
            const stats = attr.last_analysis_stats;
            const results = attr.last_analysis_results || {};
            const total = Object.values(stats).reduce((a,b) => a+b, 0);
            html += `<div class="vt-bilgi-satir"><span>Toplam:</span><span>${total}</span></div>`;
            html += `<div class="vt-bilgi-satir"><span>Zararlı:</span><span style="color:#ff4444;">${stats.malicious||0}</span></div>`;
            html += `<div class="vt-bilgi-satir"><span>Şüpheli:</span><span style="color:#ffaa00;">${stats.suspicious||0}</span></div>`;
            html += `<div class="vt-bilgi-satir"><span>Temiz:</span><span style="color:#44ff44;">${stats.harmless||0}</span></div>`;
            const malEngines = Object.entries(results).filter(([k,v])=>v.category==="malicious");
            if (malEngines.length > 0) {
                html += `<h4 style="color:#ff4444;margin-top:10px;">⚠️ Zararlı Tespit:</h4>`;
                malEngines.forEach(([m,d]) => html += `<span class="vt-etiket">${m}: ${d.result||"zararlı"}</span>`);
            }
        } else {
            html += `<p style="color:#ffaa00;">VT verisi henüz alınamadı.</p>`;
        }
        html += `</div></div>`;
    });
    html += `</div></div>`;
    document.body.insertAdjacentHTML("beforeend", html);
}

function infoSusPuan(v) {
    let puan = 0;
    const ipInfo = v.ipInfo;
    if (!ipInfo) return 0;
    if (ipInfo.org) {
        const o = ipInfo.org.toLowerCase();
        if (o.includes("hosting")||o.includes("vps")||o.includes("server")||o.includes("cloud")) puan+=30;
        if (o.includes("vpn")||o.includes("proxy")||o.includes("tor")) puan+=30;
    }
    if (ipInfo.country && ["RU","CN","KP","IR","NG"].includes(ipInfo.country)) puan+=15;
    return Math.min(puan,100);
}

function abuseSusPuan(v) {
    const a = v.abuse;
    if (!a||!a.data) return 0;
    return a.data.abuseConfidenceScore;
}

function detayGoster(index) {
    const v = sonVeriler[index];
    let h = `<div class="popup-overlay" onclick="this.remove()"><div class="popup" onclick="event.stopPropagation()">`;
    h += `<h2>${v.ip} - Ham Veri</h2><button class="popup-close" onclick="document.querySelector('.popup-overlay').remove()">✕</button>`;
    h += `<h3>ipinfo.io</h3><pre>${v.ipInfo?JSON.stringify(v.ipInfo,null,2):"Yok"}</pre>`;
    h += `<h3>AbuseIPDB</h3><pre>${v.abuse?JSON.stringify(v.abuse,null,2):"Yok"}</pre>`;
    h += `<h3>Linkler</h3><div class="link-list">`;
    h += `<a href="https://ipinfo.io/${v.ip}" target="_blank">ipinfo.io</a>`;
    h += `<a href="https://www.abuseipdb.com/check/${v.ip}" target="_blank">AbuseIPDB</a>`;
    h += `<a href="https://www.virustotal.com/gui/ip-address/${v.ip}" target="_blank">VirusTotal</a>`;
    h += `</div></div></div>`;
    document.body.insertAdjacentHTML("beforeend", h);
}

function exportCSV() {
    let html = "<table><tr><th>IP</th><th>Ülke</th><th>ISP/Org</th><th>ipinfo</th><th>AbuseIPDB</th><th>VT</th></tr>";
    sonVeriler.forEach((v,i) => {
        const vt = document.getElementById(`vt-${i}`);
        html += `<tr><td>${v.ip}</td><td>${(v.ipInfo&&v.ipInfo.country)||"-"}</td><td>${(v.ipInfo&&v.ipInfo.org)||"-"}</td><td>%${infoSusPuan(v)}</td><td>%${abuseSusPuan(v)}</td><td>${vt?vt.textContent:"-"}</td></tr>`;
    });
    html += "</table>";
    const blob = new Blob(["\uFEFF"+html], {type:"application/vnd.ms-excel;charset=utf-8;"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ip_sorgu_sonuc.xls";
    a.click();
}

function kopyala(id) {
    const t = document.getElementById(id);
    t.select(); t.setSelectionRange(0,99999);
    navigator.clipboard.writeText(t.value);
    const btn = t.parentElement.querySelector(".copyBtn");
    btn.textContent = "✅";
    setTimeout(()=>{btn.textContent="📋";},1500);
}

// İlk yüklemede dashboard güncelle
dashboardGuncelle();