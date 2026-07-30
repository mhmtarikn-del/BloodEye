// v15 - hizli panel + vt arka planda
document.getElementById("sorguBtn").addEventListener("click", sorgula);
document.getElementById("exportBtn").addEventListener("click", exportCSV);

let sonVeriler = [];

async function sorgula() {
    const input = document.getElementById("ipInput").value.trim();
    const sonucDiv = document.getElementById("sonuc");
    const btn = document.getElementById("sorguBtn");
    const exportBtn = document.getElementById("exportBtn");

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
    tabloOlustur(sonuclar);
    btn.disabled = false;
    btn.textContent = "Sorgula";
    exportBtn.style.display = "block";
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

    vtOtomatikBaslat(veriler);
}

async function vtOtomatikBaslat(veriler) {
    const panel = document.getElementById("vtPanel");
    const durum = document.getElementById("vtDurum");
    const sonucDiv = document.getElementById("vtSonuc");

    panel.style.display = "block";
    sonucDiv.innerHTML = "";

    let count = 0;
    let sira = 1;

    for (let i = 0; i < veriler.length; i++) {
        const v = veriler[i];
        durum.textContent = `Taranıyor: ${sira}/${veriler.length}`;

        const satirId = `vtsatir-${i}`;
        sonucDiv.insertAdjacentHTML("beforeend", `<div id="${satirId}" class="vt-satir vt-bekliyor">${v.ip} → Bekleniyor...</div>`);

        try {
            const res = await fetch(`https://bloodeye-proxy.onrender.com/vt?ip=${v.ip}`).then(r => r.json());
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

        sira++;
        count++;
        await new Promise(r => setTimeout(r, 15000));
    }

    durum.textContent = `Tamamlandı (${veriler.length} IP)`;
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