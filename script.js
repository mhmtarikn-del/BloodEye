const IPINFO_TOKEN = "ac4265c4327807";
const IPQS_TOKEN = "zxegJoVhkQjvJqr4qKBB7NCHLH5FOeNl";

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

    const ipListesi = input.split("\n").map(ip => ip.trim()).filter(ip => ip !== "");

    btn.disabled = true;
    btn.textContent = "Sorgulanıyor...";
    exportBtn.style.display = "none";
    sonucDiv.innerHTML = '<p class="loading">3 API sorgulanıyor... (Her IP ~1 saniye)</p>';

    const sonuclar = [];

    for (let i = 0; i < ipListesi.length; i++) {
        const ip = ipListesi[i];
        sonucDiv.innerHTML = `<p class="loading">Sorgulanıyor: ${i+1}/${ipListesi.length} - ${ip}</p>`;

        const [ipApi, ipInfo, ipqs] = await Promise.allSettled([
            fetch(`https://ip-api.com/json/${ip}?fields=66846719`).then(r => r.json()),
            fetch(`https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`).then(r => r.json()),
            fetch(`https://ipqualityscore.com/api/json/ip/${IPQS_TOKEN}/${ip}`).then(r => r.json())
        ]);

        sonuclar.push({
            ip: ip,
            ipApi: ipApi.status === "fulfilled" ? ipApi.value : null,
            ipInfo: ipInfo.status === "fulfilled" ? ipInfo.value : null,
            ipqs: ipqs.status === "fulfilled" ? ipqs.value : null
        });

        await new Promise(r => setTimeout(r, 200));
    }

    sonVeriler = sonuclar;
    tabloOlustur(sonuclar);
    btn.disabled = false;
    btn.textContent = "Sorgula";
    exportBtn.style.display = "block";
}

function tabloOlustur(veriler) {
    let html = "<table>";
    html += "<tr><th>IP</th><th>Ülke</th><th>ISP</th><th>ip-api</th><th>ipinfo</th><th>IPQS</th><th></th></tr>";

    veriler.forEach((v, index) => {
        const ipApi = v.ipApi;
        const ipInfo = v.ipInfo;
        const ipqs = v.ipqs;

        const apiPuan = apiSusPuan(v);
        const infoPuan = infoSusPuan(v);
        const ipqsPuan = ipqsSusPuan(v);

        const apiSinif = apiPuan >= 70 ? "sus-yuksek" : apiPuan >= 40 ? "sus-orta" : "sus-dusuk";
        const infoSinif = infoPuan >= 70 ? "sus-yuksek" : infoPuan >= 40 ? "sus-orta" : "sus-dusuk";
        const ipqsSinif = ipqsPuan >= 70 ? "sus-yuksek" : ipqsPuan >= 40 ? "sus-orta" : "sus-dusuk";

        html += "<tr>";
        html += `<td>${v.ip}</td>`;
        html += `<td>${(ipApi && ipApi.country) || (ipInfo && ipInfo.country) || "-"}</td>`;
        html += `<td>${(ipApi && ipApi.isp) || (ipInfo && ipInfo.org) || "-"}</td>`;
        html += `<td class="${apiSinif}">%${apiPuan}</td>`;
        html += `<td class="${infoSinif}">%${infoPuan}</td>`;
        html += `<td class="${ipqsSinif}">%${ipqsPuan}</td>`;
        html += `<td><button class="detayBtn" onclick="detayGoster(${index})">Detay</button></td>`;
        html += "</tr>";
    });

    html += "</table>";
    document.getElementById("sonuc").innerHTML = html;
}

function apiSusPuan(v) {
    let puan = 0;
    const ipApi = v.ipApi;
    if (!ipApi || ipApi.status === "fail") return 0;
    if (ipApi.proxy) puan += 30;
    if (ipApi.vpn) puan += 30;
    if (ipApi.hosting) puan += 25;
    if (ipApi.tor) puan += 25;
    const riskliUlkeler = ["RU", "CN", "KP", "IR", "NG"];
    if (riskliUlkeler.includes(ipApi.countryCode)) puan += 15;
    return Math.min(puan, 100);
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
    if (ipInfo.privacy) {
        if (ipInfo.privacy.vpn) puan += 25;
        if (ipInfo.privacy.proxy) puan += 25;
        if (ipInfo.privacy.tor) puan += 25;
        if (ipInfo.privacy.hosting) puan += 20;
    }
    return Math.min(puan, 100);
}

function ipqsSusPuan(v) {
    let puan = 0;
    const ipqs = v.ipqs;
    if (!ipqs || !ipqs.success) return 0;
    if (ipqs.fraud_score) puan += ipqs.fraud_score;
    if (ipqs.proxy) puan += 25;
    if (ipqs.vpn) puan += 25;
    if (ipqs.tor) puan += 25;
    if (ipqs.active_vpn) puan += 15;
    if (ipqs.active_tor) puan += 15;
    if (ipqs.is_crawler) puan += 10;
    const riskliUlkeler = ["RU", "CN", "KP", "IR", "NG"];
    if (ipqs.country_code && riskliUlkeler.includes(ipqs.country_code)) puan += 10;
    return Math.min(puan, 100);
}

function detayGoster(index) {
    const v = sonVeriler[index];
    const ipApi = v.ipApi;
    const ipInfo = v.ipInfo;
    const ipqs = v.ipqs;

    let html = `<div class="popup-overlay" onclick="this.remove()">`;
    html += `<div class="popup" onclick="event.stopPropagation()">`;
    html += `<h2>${v.ip} - Ham Veri</h2>`;
    html += `<button class="popup-close" onclick="document.querySelector('.popup-overlay').remove()">✕</button>`;

    html += `<h3>ip-api.com</h3>`;
    html += `<pre>${ipApi ? JSON.stringify(ipApi, null, 2) : "Veri alınamadı"}</pre>`;

    html += `<h3>ipinfo.io</h3>`;
    html += `<pre>${ipInfo ? JSON.stringify(ipInfo, null, 2) : "Veri alınamadı"}</pre>`;

    html += `<h3>IPQualityScore</h3>`;
    html += `<pre>${ipqs ? JSON.stringify(ipqs, null, 2) : "Veri alınamadı"}</pre>`;

    html += `<h3>Manuel Sorgu Linkleri</h3>`;
    html += `<div class="link-list">`;
    html += `<a href="https://ip-api.com/${v.ip}" target="_blank">ip-api.com</a>`;
    html += `<a href="https://ipinfo.io/${v.ip}" target="_blank">ipinfo.io</a>`;
    html += `<a href="https://www.abuseipdb.com/check/${v.ip}" target="_blank">AbuseIPDB</a>`;
    html += `<a href="https://www.virustotal.com/gui/ip-address/${v.ip}" target="_blank">VirusTotal</a>`;
    html += `<a href="https://whatismyipaddress.com/ip/${v.ip}" target="_blank">WhatIsMyIP</a>`;
    html += `</div>`;

    html += `</div></div>`;

    document.body.insertAdjacentHTML("beforeend", html);
}

function exportCSV() {
    let csv = "IP,Ülke,ISP,ip-api Puan,ipinfo Puan,IPQS Puan\n";

    sonVeriler.forEach(v => {
        const ipApi = v.ipApi;
        const ipInfo = v.ipInfo;
        const apiPuan = apiSusPuan(v);
        const infoPuan = infoSusPuan(v);
        const ipqsPuan = ipqsSusPuan(v);

        csv += `${v.ip},${(ipApi && ipApi.country) || (ipInfo && ipInfo.country) || "-"},${(ipApi && ipApi.isp) || (ipInfo && ipInfo.org) || "-"},%${apiPuan},%${infoPuan},%${ipqsPuan}\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "ip_sorgu_sonuc.csv";
    link.click();
}