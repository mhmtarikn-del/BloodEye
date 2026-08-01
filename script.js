// v0.17 - Dashboard + localStorage + tooltip + turkuaz
let sonVeriler = [];
let vtHamVeriler = [];

function sayfaGoster(sayfa) {
    document.querySelectorAll(".sayfa").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
    document.getElementById("sayfa-" + sayfa).classList.add("active");
    event.target.classList.add("active");
    if (sayfa === "dashboard") dashboardGuncelle();
}

// localStorage
function gecmisiGetir() {
    return JSON.parse(localStorage.getItem("bloodeye_gecmis") || "[]");
}
function gecmiseEkle(kayit) {
    const gecmis = gecmisiGetir();
    const puan = Math.max(kayit.abusePuan || 0, kayit.infoPuan || 0);
    if (puan >= 21) kayit.seviye = "kritik";
    else if (puan >= 15) kayit.seviye = "supheli";
    else kayit.seviye = "temiz";
    gecmis.push(kayit);
    const birHaftaOnce = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const filtrelenmis = gecmis.filter(k => k.tarih > birHaftaOnce);
    localStorage.setItem("bloodeye_gecmis", JSON.stringify(filtrelenmis));
}

// Dashboard
function dashboardGuncelle() {
    const gecmis = gecmisiGetir();
    const simdi = Date.now();
    const son24s = simdi - 24 * 60 * 60 * 1000;

        document.getElementById("istToplam").textContent = gecmis.length;
    const temizSayi = gecmis.filter(k => k.seviye === "temiz").length;
    const supheliSayi = gecmis.filter(k => k.seviye === "supheli").length;
    const kritikSayi = gecmis.filter(k => k.seviye === "kritik").length;
    document.getElementById("istTemiz").textContent = temizSayi;
    document.getElementById("istSupheli").textContent = supheliSayi + kritikSayi;

    // Saldırı seviyesi
        const son24Kayit = gecmis.filter(k => k.tarih > son24s);
    const son24Tehlikeli = son24Kayit.filter(k => k.seviye === "kritik" || k.seviye === "supheli").length;
    const oran = son24Kayit.length > 0 ? Math.round((son24Tehlikeli / son24Kayit.length) * 100) : 0;
    const gauge = document.getElementById("gaugeCircle");
    document.getElementById("gaugeText").textContent = "%" + oran;
    document.getElementById("gaugeDetay").textContent = `${son24Tehlikeli}/${son24Kayit.length} IP`;
    if (oran >= 70) gauge.style.borderColor = "#ff4444";
    else if (oran >= 40) gauge.style.borderColor = "#ffaa00";
    else gauge.style.borderColor = "#40e0d0";

    // Kritik IP + 7 günlük liste
    const son7Gun = simdi - 7 * 24 * 60 * 60 * 1000;
    const son7Kayit = gecmis.filter(k => k.tarih > son7Gun);

    // Güne göre grupla
    const gunGruplari = {};
    son7Kayit.forEach(k => {
        const gun = new Date(k.tarih).toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
        if (!gunGruplari[gun]) gunGruplari[gun] = [];
        gunGruplari[gun].push(k);
    });

    let kritikHtml = "";
    const gunSirasi = Object.keys(gunGruplari).sort((a,b) => {
        return new Date(b.split(" ").slice(-2).join(" ")) - new Date(a.split(" ").slice(-2).join(" "));
    });

    if (gunSirasi.length === 0) {
        kritikHtml = '<p class="bos">Henüz veri yok</p>';
    } else {
        gunSirasi.forEach(gun => {
            const kayitlar = gunGruplari[gun];
            kritikHtml += `<div class="kritik-gun">📅 ${gun} (${kayitlar.length} IP)</div>`;
            kayitlar.forEach(k => {
                const cls = k.supheli ? "supheli" : "temiz";
                const icon = k.supheli ? "🔴" : "🟢";
                kritikHtml += `<div class="kritik-item ${cls}"><span>${icon} ${k.ip}</span><span>%${k.supheli ? k.abusePuan || k.infoPuan : 0}</span></div>`;
            });
        });
    }
    document.getElementById("kritikList").innerHTML = kritikHtml;
    // Kritik IP listesi
    const kritikIPs = [...new Set(gecmis.filter(k => k.seviye === "kritik").map(k => k.ip))];
    let kritikHtml = "";
    if (kritikIPs.length === 0) {
        kritikHtml = '<p class="bos">Kritik IP yok</p>';
    } else {
        kritikIPs.slice(0, 15).forEach(ip => {
            const adet = gecmis.filter(k => k.ip === ip && k.seviye === "kritik").length;
            kritikHtml += `<div class="kritik-item supheli"><span>🔴 ${ip}</span><span>${adet}x</span></div>`;
        });
    }
    document.getElementById("kritikList").innerHTML = kritikHtml;

    // Şüpheli IP listesi
    const supheliIPs = [...new Set(gecmis.filter(k => k.seviye === "supheli").map(k => k.ip))];
    let supheliHtml = "";
    if (supheliIPs.length === 0) {
        supheliHtml = '<p class="bos">Şüpheli IP yok</p>';
    } else {
        supheliIPs.slice(0, 15).forEach(ip => {
            const adet = gecmis.filter(k => k.ip === ip && k.seviye === "supheli").length;
            supheliHtml += `<div class="kritik-item" style="color:#ffaa00;"><span>🟠 ${ip}</span><span>${adet}x</span></div>`;
        });
    }
    document.getElementById("supheliList").innerHTML = supheliHtml;
    haftalikGrafikCiz(gecmis);
}

function haftalikGrafikCiz(gecmis) {
    const gunler = [];
    for (let i = 6; i >= 0; i--) {
        const gun = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const gunAdi = gun.getDate().toString().padStart(2,"0");
        const ayAdi = gun.toLocaleDateString("tr-TR", { month: "short" }).toUpperCase();
        const yil = gun.getFullYear();
        gunler.push(`${gunAdi} ${ayAdi} ${yil}`);
    }

        const veri = [0,0,0,0,0,0,0];
    const supheliVeri = [0,0,0,0,0,0,0];
    const kritikVeri = [0,0,0,0,0,0,0];
    const simdi = Date.now();

    gecmis.forEach(k => {
        const gunFarki = Math.floor((simdi - k.tarih) / (24 * 60 * 60 * 1000));
        if (gunFarki < 7) {
            veri[6 - gunFarki]++;
            if (k.seviye === "supheli") supheliVeri[6 - gunFarki]++;
            if (k.seviye === "kritik") kritikVeri[6 - gunFarki]++;
        }
    });

    const max = Math.max(...veri, 1);
    const canvas = document.getElementById("chartHaftalik");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.parentElement.clientWidth - 20;
    canvas.height = 200;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = canvas.width / 18;
    const gap = barWidth * 0.4;

    let tooltipDiv = document.getElementById("chartTooltip");
    if (!tooltipDiv) {
        tooltipDiv = document.createElement("div");
        tooltipDiv.id = "chartTooltip";
        tooltipDiv.style.cssText = "position:absolute;background:#0d1730;border:1px solid #e94560;padding:8px 12px;border-radius:6px;font-size:12px;pointer-events:none;display:none;z-index:100;white-space:nowrap;";
        canvas.parentElement.appendChild(tooltipDiv);
    }

    canvas.onmousemove = function(e) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        let found = false;

        for (let i = 0; i < 7; i++) {
            const x = i * (barWidth * 2 + gap) + 30;
            if (mx >= x && mx <= x + barWidth * 2) {
                tooltipDiv.style.display = "block";
                tooltipDiv.style.left = (rect.left + x + barWidth) + "px";
                tooltipDiv.style.top = (rect.top + my - 50) + "px";
                                tooltipDiv.innerHTML = `<b>${gunler[i]}</b><br><span style="color:#40e0d0;">● Temiz: ${veri[i] - supheliVeri[i] - kritikVeri[i]}</span><br><span style="color:#ffaa00;">● Şüpheli: ${supheliVeri[i]}</span><br><span style="color:#ff4444;">● Kritik: ${kritikVeri[i]}</span>`;
                                found = true;
                break;
            }
        }
        if (!found) tooltipDiv.style.display = "none";
    };
    canvas.onmouseleave = function() { tooltipDiv.style.display = "none"; };

    for (let i = 0; i < 7; i++) {
        const x = i * (barWidth * 2 + gap) + 30;
               const temizH = ((veri[i] - supheliVeri[i] - kritikVeri[i]) / max) * 140;
        const supheliH = (supheliVeri[i] / max) * 140;
        const kritikH = (kritikVeri[i] / max) * 140;

        ctx.fillStyle = "#40e0d0";
        ctx.fillRect(x, 150 - temizH, barWidth, temizH);
        ctx.fillStyle = "#ffaa00";
        ctx.fillRect(x, 150 - temizH - supheliH, barWidth, supheliH);
        ctx.fillStyle = "#ff4444";
        ctx.fillRect(x, 150 - temizH - supheliH - kritikH, barWidth, kritikH);

        ctx.fillStyle = "#aaa";
        ctx.font = "10px Segoe UI";
        ctx.textAlign = "center";
        ctx.fillText(gunler[i], x + barWidth, 170);
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

        sonuclar.forEach(v => {
        const ap = abuseSusPuan(v);
        const ip = infoSusPuan(v);
        gecmiseEkle({ ip: v.ip, tarih: Date.now(), abusePuan: ap, infoPuan: ip });
    });

    tabloOlustur(sonuclar);
    btn.disabled = false;
        gecmisiGoster();
    btn.textContent = "Sorgula";
    exportBtn.style.display = "block";
    if (vtDetayBtn) vtDetayBtn.style.display = "block";
    vtOtomatikBaslat(sonuclar);
}

function tabloOlustur(veriler) {
    let html = "<table>";
    html += "<tr><th>IP</th><th>Ülke</th><th>ISP/Org</th><th>ipinfo</th><th>AbuseIPDB</th><th>VT</th><th></th></tr>";

    veriler.forEach((v, index) => {
        const ip = infoSusPuan(v);
        const ap = abuseSusPuan(v);
                const hataVar = (ip === 0 && ap === 0);
        const is = ip >= 70 ? "sus-yuksek" : ip >= 40 ? "sus-orta" : "sus-dusuk";
        const as = ap >= 70 ? "sus-yuksek" : ap >= 40 ? "sus-orta" : "sus-dusuk";

        html += "<tr>";
        html += `<td>${v.ip}</td>`;
        html += `<td>${(v.ipInfo && v.ipInfo.country) || "-"}</td>`;
        html += `<td>${(v.ipInfo && v.ipInfo.org) || "-"}</td>`;
        html += `<td class="${is}">%${ip}</td>`;
        html += `<td class="${as}">%${ap}</td>`;
        html += `<td id="vt-${index}" class="vt-bekliyor">...</td>`;
        html += `<td><button class="detayBtn" onclick="detayGoster(${index})">Detay</button></td>`;
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
                if (mal > 0) {
                    document.getElementById(`vt-${i}`).style.color = "#ff4444";
                    document.getElementById(`vt-${i}`).style.fontWeight = "bold";
                    document.getElementById(sid).className = "vt-satir vt-supheli";
                    document.getElementById(sid).textContent = `${v.ip} → ${mal}/${tot} ⚠️`;
                } else {
                    document.getElementById(`vt-${i}`).style.color = "#40e0d0";
                    document.getElementById(sid).className = "vt-satir vt-temiz";
                    document.getElementById(sid).textContent = `${v.ip} → ${mal}/${tot} ✅`;
                }
            }
                } catch(e) {
            document.getElementById(`vt-${i}`).textContent = "Hata";
            document.getElementById(satirId).textContent = `${v.ip} → Hata`;
            const tdBtn = document.getElementById(`td-${i}`);
            if (tdBtn) tdBtn.style.display = "inline-block";
        }
        await new Promise(r => setTimeout(r, 15000));
    }
    durum.textContent = `Tamamlandı (${veriler.length} IP)`;
}

function vtDetayPanel() {
    let h = `<div class="popup-overlay" onclick="this.remove()"><div class="popup popup-vt" onclick="event.stopPropagation()">`;
    h += `<h2>🛡️ Virustotal Detay Raporu</h2><button class="popup-close" onclick="document.querySelector('.popup-overlay').remove()">✕</button>`;

    sonVeriler.forEach((v,i) => {
        const vd = vtHamVeriler[i];
        h += `<div class="vt-detay-kart"><div class="vt-detay-baslik" onclick="this.nextElementSibling.classList.toggle('acik')">`;
        if (vd && vd.data) {
            const s = vd.data.attributes.last_analysis_stats;
            const mal = s.malicious || 0;
            const tot = Object.values(s).reduce((a,b) => a+b, 0);
            h += `<span class="vt-detay-ip">${v.ip}</span><span class="vt-detay-ozet"><span style="color:${mal>0?'#ff4444':'#40e0d0'}">${mal}/${tot}</span><span>▼</span></span>`;
        } else h += `<span class="vt-detay-ip">${v.ip}</span><span style="color:#ffaa00;">Veri yok</span>`;
        h += `</div><div class="vt-detay-icerik">`;
        if (vd && vd.data) {
            const attr = vd.data.attributes;
            const s = attr.last_analysis_stats;
            const res = attr.last_analysis_results || {};
            const tot = Object.values(s).reduce((a,b) => a+b, 0);
            h += `<div class="vt-bilgi-satir"><span>Toplam:</span><span>${tot}</span></div>`;
            h += `<div class="vt-bilgi-satir"><span>Zararlı:</span><span style="color:#ff4444;">${s.malicious||0}</span></div>`;
            h += `<div class="vt-bilgi-satir"><span>Şüpheli:</span><span style="color:#ffaa00;">${s.suspicious||0}</span></div>`;
            h += `<div class="vt-bilgi-satir"><span>Temiz:</span><span style="color:#40e0d0;">${s.harmless||0}</span></div>`;
            const malE = Object.entries(res).filter(([k,v])=>v.category==="malicious");
            if (malE.length) {
                h += `<h4 style="color:#ff4444;margin-top:10px;">⚠️ Zararlı:</h4>`;
                malE.forEach(([m,d]) => h += `<span class="vt-etiket">${m}: ${d.result||"zararlı"}</span>`);
            }
        } else h += `<p style="color:#ffaa00;">VT verisi henüz alınamadı.</p>`;
        h += `</div></div>`;
    });
    h += `</div></div>`;
    document.body.insertAdjacentHTML("beforeend", h);
}

function infoSusPuan(v) {
    let p = 0;
    const ip = v.ipInfo;
    if (!ip) return 0;
    if (ip.org) {
        const o = ip.org.toLowerCase();
        if (o.includes("hosting")||o.includes("vps")||o.includes("server")||o.includes("cloud")) p+=30;
        if (o.includes("vpn")||o.includes("proxy")||o.includes("tor")) p+=30;
    }
    if (ip.country && ["RU","CN","KP","IR","NG"].includes(ip.country)) p+=15;
    return Math.min(p,100);
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

dashboardGuncelle();
function sifirlaPopup() {
    let h = `<div class="popup-overlay" onclick="this.remove()">`;
    h += `<div class="popup popup-reset" onclick="event.stopPropagation()">`;
    h += `<h2>⚠️ Tüm Verileri Sıfırla</h2>`;
    h += `<p>Dashboard verileri ve tarama geçmişi kalıcı olarak silinecek. Bu işlem geri alınamaz.</p>`;
    h += `<div class="btn-group">`;
    h += `<button class="btn-tamam" onclick="sifirlaOnay()">Tamam</button>`;
    h += `<button class="btn-iptal" onclick="document.querySelector('.popup-overlay').remove()">İptal</button>`;
    h += `</div></div></div>`;
    document.body.insertAdjacentHTML("beforeend", h);
}

function sifirlaOnay() {
    localStorage.removeItem("bloodeye_gecmis");
    location.reload();
}
function gecmisiGoster() {
    const gecmis = gecmisiGetir();
    const son24s = Date.now() - 24 * 60 * 60 * 1000;
    const sonKayitlar = gecmis.filter(k => k.tarih > son24s).sort((a,b) => b.tarih - a.tarih);

    const panel = document.getElementById("gecmisPanel");
    if (sonKayitlar.length === 0) {
        panel.style.display = "none";
        return;
    }

    panel.style.display = "block";
    let html = "<table><tr><th>IP</th><th>Tarih</th><th>Durum</th><th>Abuse</th><th>ipinfo</th></tr>";

    sonKayitlar.forEach(k => {
        const tarih = new Date(k.tarih).toLocaleString("tr-TR");
                const puan = Math.max(k.abusePuan || 0, k.infoPuan || 0);
        let durum = '';
        if (puan >= 21) durum = '<span style="color:#ff4444;">🔴 Kritik</span>';
        else if (puan >= 15) durum = '<span style="color:#ffaa00;">🟠 Şüpheli</span>';
        else durum = '<span style="color:#40e0d0;">🟢 Temiz</span>';
        html += `<tr><td>${k.ip}</td><td>${tarih}</td><td>${durum}</td><td>%${k.abusePuan || 0}</td><td>%${k.infoPuan || 0}</td></tr>`;
    });

    html += "</table>";
    document.getElementById("gecmisTablo").innerHTML = html;
}
dashboardGuncelle();
gecmisiGoster();
