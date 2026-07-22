const IPINFO_TOKEN = "ac4265c4327807";
const ABUSE_TOKEN = "389e145892cade03816f5bdeed74e6afc553c01e4f430d6a90f9f64fded05d36d2408a38dbc95c3a";

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
    sonucDiv.innerHTML = '<p class="loading">ipinfo + AbuseIPDB sorgulanıyor... (Her IP ~1 saniye)</p>';

    const sonuclar = [];

    for (let i = 0; i < ipListesi.length; i++) {
        const ip = ipListesi[i];
        sonucDiv.innerHTML = `<p class="loading">Sorgulanıyor: ${i+1}/${ipListesi.length} - ${ip}</p>`;

        const [ipInfo, abuse] = await Promise.allSettled([
            fetch(`https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`).then(r => r.json()),
            fetch("https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`), {
                headers: { "Key": ABUSE_TOKEN, "Accept": "application/json" }
            }).then(r => r.json())
        ]);

        sonuclar.push({
            ip: ip,
            ipInfo: ipInfo.status === "fulfilled" ? ipInfo.value : null,
            abuse: abuse.status === "fulfilled" ? abuse.value : null
        });

        await new Promise(r => setTimeout(r, 1500));
    }

    sonVeriler = sonuclar;
    tabloOlustur(sonuclar);
    btn.disabled = false;
    btn.textContent = "Sorgula";
    exportBtn.style.display = "block";
}

function tabloOlustur(veriler) {
    let html = "<table>";
    html += "<tr><th>IP</th><th>Ülke</th><th>ISP/Org</th><th>ipinfo Puan</th><th>AbuseIPDB</th><th></th></tr>";

    veriler.forEach((v, index) => {
        const ipInfo = v.ipInfo;
        const abuse = v.abuse;

        const infoPuan = infoSusPuan(v);
        const abusePuan = abuseSusPuan(v);

        const infoSinif = infoPuan >= 70 ? "sus-yuksek" : infoPuan >= 40 ? "sus-orta" : "sus-dusuk";
        const abuseSinif = abusePuan >= 70 ? "sus-yuksek" : abusePuan >= 40 ? "sus-orta" : "sus-dusuk";

        html += "<tr>";
        html += `<td>${v.ip}</td>`;
        html += `<td>${(ipInfo && ipInfo.country) || "-"}</td>`;
        html += `<td>${(ipInfo && ipInfo.org) || "-"}</td>`;
        html += `<td class="${infoSinif}">%${infoPuan}</td>`;
        html += `<td class="${abuseSinif}">%${abusePuan}</td>`;
        html += `<td><button class="detayBtn" onclick="detayGoster(${index})">Detay</button></td>`;
        html += "</tr>";
    });

    html += "</table>";
    document.getElementById("sonuc").innerHTML = html;
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
    const ipInfo = v.ipInfo;
    const abuse = v.abuse;

    let html = `<div class="popup-overlay" onclick="this.remove()">`;
    html += `<div class="popup" onclick="event.stopPropagation()">`;
    html += `<h2>${v.ip} - Ham Veri</h2>`;
    html += `<button class="popup-close" onclick="document.querySelector('.popup-overlay').remove()">✕</button>`;

    html += `<h3>ipinfo.io</h3>`;
    html += `<pre>${ipInfo ? JSON.stringify(ipInfo, null, 2) : "Veri alınamadı"}</pre>`;

    html += `<h3>AbuseIPDB</h3>`;
    html += `<pre>${abuse ? JSON.stringify(abuse, null, 2) : "Veri alınamadı"}</pre>`;

    html += `<h3>Manuel Sorgu Linkleri</h3>`;
    html += `<div class="link-list">`;
    html += `<a href="https://ipinfo.io/${v.ip}" target="_blank">ipinfo.io</a>`;
    html += `<a href="https://www.abuseipdb.com/check/${v.ip}" target="_blank">AbuseIPDB</a>`;
    html += `<a href="https://www.virustotal.com/gui/ip-address/${v.ip}" target="_blank">VirusTotal</a>`;
    html += `<a href="https://whatismyipaddress.com/ip/${v.ip}" target="_blank">WhatIsMyIP</a>`;
    html += `</div>`;

    html += `</div></div>`;

    document.body.insertAdjacentHTML("beforeend", html);
}

function exportCSV() {
    let csv = "IP,Ülke,ISP/Org,ipinfo Puan,AbuseIPDB Puan\n";

    sonVeriler.forEach(v => {
        const ipInfo = v.ipInfo;
        const infoPuan = infoSusPuan(v);
        const abusePuan = abuseSusPuan(v);

        csv += `${v.ip},${(ipInfo && ipInfo.country) || "-"},${(ipInfo && ipInfo.org) || "-"},%${infoPuan},%${abusePuan}\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "ip_sorgu_sonuc.csv";
    link.click();
}