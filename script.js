// v16 - VT detay paneli
document.getElementById("sorguBtn").addEventListener("click", sorgula);
document.getElementById("exportBtn").addEventListener("click", exportCSV);

let sonVeriler = [];
let vtHamVeriler = [];

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
    tabloOlustur(sonuclar);
    btn.disabled = false;
    btn.textContent = "Sorgula";
    exportBtn.style.display = "block";

    const vtDetayBtnEl = document.getElementById("vtDetayBtn");
    if (vtDetayBtnEl) vtDetayBtnEl.style.display = "block";

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

    let blackIPs = [];
    let whiteIPs = [];

    veriler.forEach(v => {
        const infoPuan = infoSusPuan(v);
        const abusePuan = abuseSusPuan(v);
        if (abusePuan >= 20 || infoPuan >= 20) {
            blackIPs.push(v.ip);
        } else {
            whiteIPs.push(v.ip);
        }
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
                    document.getElementById(satirId).textContent = `${v.ip} → ${malicious}/${total} ⚠️ ŞÜPHELİ`;
                } else {
                    document.getElementById(`vt-${i}`).style.color = "#44ff44";
                    document.getElementById(satirId).className = "vt-satir vt-temiz";
                    document.getElementById(satirId).textContent = `${v.ip} → ${malicious}/${total} ✅ Temiz`;
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
        const ip = v.ip;

        html += `<div class="vt-detay-kart">`;
        html += `<div class="vt-detay-baslik" onclick="this.nextElementSibling.classList.toggle('acik')">`;

        if (vtData && vtData.data) {
            const stats = vtData.data.attributes.last_analysis_stats;
            const malicious = stats.malicious || 0;
            const total = Object.values(stats).reduce((a,b) => a+b, 0);
            const renk = malicious > 0 ? "#ff4444" : "#44ff44";
            html += `<span class="vt-detay-ip">${ip}</span>`;
            html += `<span class="vt-detay-ozet">`;
            html += `<span style="color:${renk}">${malicious}/${total} zararlı</span>`;
            html += `<span style="font-size:11px;color:#aaa;">▼</span>`;
            html += `</span>`;
        } else {
            html += `<span class="vt-detay-ip">${ip}</span>`;
            html += `<span style="color:#ffaa00;">Veri yok</span>`;
        }

        html += `</div>`;

        html += `<div class="vt-detay-icerik">`;

        if (vtData && vtData.data) {
            const attr = vtData.data.attributes;
            const stats = attr.last_analysis_stats;
            const results = attr.last_analysis_results || {};
            const total = Object.values(stats).reduce((a,b) => a+b, 0);

            html += `<div class="vt-bilgi-satir"><span>Toplam motor:</span><span>${total}</span></div>`;
            html += `<div class="vt-bilgi-satir"><span>Zararlı:</span><span style="color:#ff4444;font-weight:bold;">${stats.malicious || 0}</span></div>`;
            html += `<div class="vt-bilgi-satir"><span>Şüpheli:</span><span style="color:#ffaa00;">${stats.suspicious || 0}</span></div>`;
            html += `<div class="vt-bilgi-satir"><span>Temiz:</span><span style="color:#44ff44;">${stats.harmless || 0}</span></div>`;
            html += `<div class="vt-bilgi-satir"><span>Tespit edilemedi:</span><span>${stats.undetected || 0}</span></div>`;
            if (attr.last_analysis_date) {
                html += `<div class="vt-bilgi-satir"><span>Son tarama:</span><span>${new Date(attr.last_analysis_date * 1000).toLocaleString("tr-TR")}</span></div>`;
            }

            const maliciousEngines = Object.entries(results).filter(([k,v]) => v.category === "malicious");
            if (maliciousEngines.length > 0) {
                html += `<h4 style="color:#ff4444;margin-top:10px;">⚠️ Zararlı Tespit Eden Motorlar:</h4>`;
                maliciousEngines.forEach(([motor, detay]) => {
                    html += `<span class="vt-etiket">${motor}: ${detay.result || "zararlı"}</span>`;
                });
            }

            const suspiciousEngines = Object.entries(results).filter(([k,v]) => v.category === "suspicious");
            if (suspiciousEngines.length > 0) {
                html += `<h4 style="color:#ffaa00;margin-top:10px;">⚠️ Şüpheli Tespit Eden Motorlar:</h4>`;
                suspiciousEngines.forEach(([motor, detay]) => {
                    html += `<span class="vt-etiket">${motor}: ${detay.result || "şüpheli"}</span>`;
                });
            }

        } else {
            html += `<p style="color:#ffaa00;">VT verisi henüz alınamadı veya hata oluştu.</p>`;
        }

        html += `</div>`;
        html += `</div>`;
    });

    html += `</div></div>`;
    document.body.insertAdjacentHTML("beforeend", html);
}

function infoSusPuan(v) {
    let puan = 0;
    const ipInfo = v.ipInfo;
    if (!ipInfo) return 0;
    if (ipInfo.org) {
        const orgLower = ipInfo.org.toLowerCase();
        if (orgLower.includes("hosting") || orgLower.includes("vps") || orgLower.includes("server") || orgLower.includes("cloud")) puan += 30;
        if (orgLower.includes("vpn") || orgLower.includes("proxy") || orgLower.includes("tor")) puan += 30;
    }
    if (ipInfo.country) {
        const riskliUlkeler = ["RU", "CN", "KP", "IR", "NG"];
        if (riskliUlkeler.includes(ipInfo.country)) puan += 15;
    }
    return Math.min(puan, 100);
}

function abuseSusPuan(v) {
    const abuse = v.abuse;
    if (!abuse || !abuse.data) return 0;
    return abuse.data.abuseConfidenceScore;
}

function detayGoster(index) {
    const v = sonVeriler[index];

    let detayHtml = `<div class="popup-overlay" onclick="this.remove()">`;
    detayHtml += `<div class="popup" onclick="event.stopPropagation()">`;
    detayHtml += `<h2>${v.ip} - Ham Veri</h2>`;
    detayHtml += `<button class="popup-close" onclick="document.querySelector('.popup-overlay').remove()">✕</button>`;

    detayHtml += `<h3>ipinfo.io</h3>`;
    detayHtml += `<pre>${v.ipInfo ? JSON.stringify(v.ipInfo, null, 2) : "Veri alınamadı"}</pre>`;

    detayHtml += `<h3>AbuseIPDB</h3>`;
    detayHtml += `<pre>${v.abuse ? JSON.stringify(v.abuse, null, 2) : "Veri alınamadı"}</pre>`;

    detayHtml += `<h3>Manuel Sorgu Linkleri</h3>`;
    detayHtml += `<div class="link-list">`;
    detayHtml += `<a href="https://ipinfo.io/${v.ip}" target="_blank">ipinfo.io</a>`;
    detayHtml += `<a href="https://www.abuseipdb.com/check/${v.ip}" target="_blank">AbuseIPDB</a>`;
    detayHtml += `<a href="https://www.virustotal.com/gui/ip-address/${v.ip}" target="_blank">VirusTotal</a>`;
    detayHtml += `<a href="https://whatismyipaddress.com/ip/${v.ip}" target="_blank">WhatIsMyIP</a>`;
    detayHtml += `</div>`;

    detayHtml += `</div></div>`;

    document.body.insertAdjacentHTML("beforeend", detayHtml);
}

function exportCSV() {
    let html = "<table>";
    html += "<tr><th>IP</th><th>Ülke</th><th>ISP/Org</th><th>ipinfo Puan</th><th>AbuseIPDB Puan</th><th>VT</th></tr>";

    sonVeriler.forEach((v, i) => {
        const infoPuan = infoSusPuan(v);
        const abusePuan = abuseSusPuan(v);
        const vtHucre = document.getElementById(`vt-${i}`);
        const vtDeger = vtHucre ? vtHucre.textContent : "-";
        html += `<tr><td>${v.ip}</td><td>${(v.ipInfo && v.ipInfo.country) || "-"}</td><td>${(v.ipInfo && v.ipInfo.org) || "-"}</td><td>%${infoPuan}</td><td>%${abusePuan}</td><td>${vtDeger}</td></tr>`;
    });

    html += "</table>";

    const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "ip_sorgu_sonuc.xls";
    link.click();
}

function kopyala(id) {
    const textarea = document.getElementById(id);
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(textarea.value);

    const btn = textarea.parentElement.querySelector(".copyBtn");
    const original = btn.textContent;
    btn.textContent = "✅ Kopyalandı!";
    setTimeout(() => { btn.textContent = original; }, 1500);
}