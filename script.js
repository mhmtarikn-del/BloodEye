// v0.41 - temiz
let sonVeriler = [];
let vtHamVeriler = [];
let vtIptal = false;
let haritaObj = null;

function sayfaGoster(sayfa) {
    document.querySelectorAll(".sayfa").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
    document.getElementById("sayfa-" + sayfa).classList.add("active");
    event.target.classList.add("active");
    if (sayfa === "dashboard") dashboardGuncelle();
    if (sayfa === "tehdit") {
        setTimeout(() => {
            tehditAnaliziGuncelle();
            if (haritaObj) setTimeout(() => haritaObj.invalidateSize(), 500);
        }, 300);
    }
}

// localStorage
function gecmisiGetir() {
    const ham = JSON.parse(localStorage.getItem("bloodeye_gecmis") || "[]");
    const temiz = ham.filter(k => k.seviye && k.tarih);
    if (temiz.length !== ham.length) localStorage.setItem("bloodeye_gecmis", JSON.stringify(temiz));
    return temiz;
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

    const son24Kayit = gecmis.filter(k => k.tarih > son24s);
    const son24Tehlikeli = son24Kayit.filter(k => k.seviye === "kritik" || k.seviye === "supheli").length;
    const oran = son24Kayit.length > 0 ? Math.round((son24Tehlikeli / son24Kayit.length) * 100) : 0;
    document.getElementById("gaugeDetay").textContent = `${son24Tehlikeli}/${son24Kayit.length} IP`;
    gaugeCiz(oran);

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

    const barWidth = canvas.width / 30;
    const gap = barWidth * 0.3;

    let tooltipDiv = document.getElementById("chartTooltip");
    if (!tooltipDiv) {
        tooltipDiv = document.createElement("div");
        tooltipDiv.id = "chartTooltip";
        tooltipDiv.style.cssText = "position:absolute;background:#0d1730;border:1px solid #c62828;padding:8px 12px;border-radius:6px;font-size:12px;pointer-events:none;display:none;z-index:100;white-space:nowrap;";
        canvas.parentElement.appendChild(tooltipDiv);
    }

    canvas.onmousemove = function(e) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        let found = false;
        for (let i = 0; i < 7; i++) {
            const x = i * (barWidth * 3 + gap) + 30;
            if (mx >= x && mx <= x + barWidth * 3) {
                tooltipDiv.style.display = "block";
                tooltipDiv.style.left = (rect.left + x + barWidth * 1.5) + "px";
                tooltipDiv.style.top = (rect.top + my - 60) + "px";
                tooltipDiv.innerHTML = `<b>${gunler[i]}</b><br><span style="color:#40e0d0;">● Temiz: ${veri[i] - supheliVeri[i] - kritikVeri[i]}</span><br><span style="color:#ffaa00;">● Şüpheli: ${supheliVeri[i]}</span><br><span style="color:#c62828;">● Kritik: ${kritikVeri[i]}</span>`;
                found = true;
                break;
            }
        }
        if (!found) tooltipDiv.style.display = "none";
    };
    canvas.onmouseleave = function() { tooltipDiv.style.display = "none"; };

    for (let i = 0; i < 7; i++) {
        const x = i * (barWidth * 3 + gap) + 30;
        const temizH = ((veri[i] - supheliVeri[i] - kritikVeri[i]) / max) * 140;
        const supheliH = (supheliVeri[i] / max) * 140;
        const kritikH = (kritikVeri[i] / max) * 140;

        ctx.fillStyle = "#40e0d0";
        ctx.fillRect(x, 150 - temizH, barWidth, temizH);
        ctx.fillStyle = "#ffaa00";
        ctx.fillRect(x + barWidth + 2, 150 - supheliH, barWidth, supheliH);
        ctx.fillStyle = "#c62828";
        ctx.fillRect(x + (barWidth + 2) * 2, 150 - kritikH, barWidth, kritikH);

        ctx.fillStyle = "#aaa";
        ctx.font = "10px Segoe UI";
        ctx.textAlign = "center";
        ctx.fillText(gunler[i], x + barWidth * 1.5, 170);
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

    const gecmisData = gecmisiGetir();
    const son24s = Date.now() - 24 * 60 * 60 * 1000;
    const son24IPler = new Set(gecmisData.filter(k => k.tarih > son24s).map(k => k.ip));
    const filtrelenmisIP = benzersizIP.filter(ip => !son24IPler.has(ip));

    if (filtrelenmisIP.length === 0) {
        sonucDiv.innerHTML = '<p class="hata">Tüm IP\'ler son 24 saat içinde sorgulanmış.</p>';
        return;
    }

    vtIptal = true;
    btn.disabled = true;
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
    btn.disabled = false;
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
        // VT sonucunu hemen kaydet
        const gecmis = gecmisiGetir();
        for (let j = gecmis.length - 1; j >= 0; j--) {
            if (gecmis[j].ip === v.ip) {
                gecmis[j].vtSonuc = v.vtSonuc || "-";
                break;
            }
        }
        localStorage.setItem("bloodeye_gecmis", JSON.stringify(gecmis));
        gecmisiGoster();
        
        await new Promise(r => setTimeout(r, 15000));
    }
    durum.textContent = `Tamamlandı (${veriler.length} IP)`;
           // VT sonuçlarını localStorage'a kaydet
    //const gecmis = gecmisiGetir();
    //console.log("VT bitti, güncelleme başlıyor. veriler:", veriler.length);
    //for (let i = 0; i < veriler.length; i++) {
    //    const v = veriler[i];
    //    console.log(`IP: ${v.ip}, vtSonuc: ${v.vtSonuc}`);
    //    if (!v.vtSonuc) continue;
    //    for (let j = gecmis.length - 1; j >= 0; j--) {
    //        if (gecmis[j].ip === v.ip && !gecmis[j].vtSonuc) {
    //            gecmis[j].vtSonuc = v.vtSonuc;
    //            console.log(`Güncellendi: ${v.ip} -> ${v.vtSonuc}`);
   //             break;
   //         }
    //    }
   // }
    //localStorage.setItem("bloodeye_gecmis", JSON.stringify(gecmis));
    gecmisiGoster();
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

function sifirlaPopup() {
    let h=`<div class="popup-overlay" onclick="this.remove()"><div class="popup popup-reset" onclick="event.stopPropagation()"><h2>⚠️ Tüm Verileri Sıfırla</h2><p>Dashboard verileri ve tarama geçmişi kalıcı olarak silinecek.</p><div class="btn-group"><button class="btn-tamam" onclick="sifirlaOnay()">Tamam</button><button class="btn-iptal" onclick="document.querySelector('.popup-overlay').remove()">İptal</button></div></div></div>`;
    document.body.insertAdjacentHTML("beforeend", h);
}
function sifirlaOnay() { localStorage.removeItem("bloodeye_gecmis"); localStorage.removeItem("bloodeye_konum"); location.reload(); }

function gecmisiGoster() {
    const gecmis=gecmisiGetir(), son24s=Date.now()-24*60*60*1000, sonKayitlar=gecmis.filter(k=>k.tarih>son24s).sort((a,b)=>b.tarih-a.tarih);
    const panel=document.getElementById("gecmisPanel"); if(!panel)return;
    if(sonKayitlar.length===0){panel.style.display="none";return;}
    panel.style.display="block";
    let html="<table><tr><th>IP</th><th>Tarih</th><th>Durum</th><th>Abuse</th><th>ipinfo</th><th>VT</th></tr>";
    sonKayitlar.forEach(k=>{ const tarih=new Date(k.tarih).toLocaleString("tr-TR"), puan=Math.max(k.abusePuan||0,k.infoPuan||0); let durum=''; if(puan>=21)durum='<span style="color:#c62828;">🔴 Kritik</span>'; else if(puan>=15)durum='<span style="color:#ffaa00;">🟠 Şüpheli</span>'; else durum='<span style="color:#40e0d0;">🟢 Temiz</span>'; html+=`<tr><td>${k.ip}</td><td>${tarih}</td><td>${durum}</td><td>%${k.abusePuan||0}</td><td>%${k.infoPuan||0}</td><td>${k.vtSonuc||"-"}</td></tr>`; });
    html+="</table>"; document.getElementById("gecmisTablo").innerHTML=html;
}

function ulkeKoduEmoji(kod) { if(!kod||kod.length!==2)return"🏳️"; return String.fromCodePoint(kod.charCodeAt(0)+127397,kod.charCodeAt(1)+127397); }

function gaugeCiz(oran) {
    const canvas=document.getElementById("gaugeCanvas"); if(!canvas)return;
    const ctx=canvas.getContext("2d"), w=canvas.width, h=canvas.height, cx=w/2, cy=h-15, r=85;
    ctx.clearRect(0,0,w,h);
    ctx.beginPath(); ctx.arc(cx,cy,r,Math.PI,0); ctx.strokeStyle="#1a1a2e"; ctx.lineWidth=16; ctx.stroke();
    let renk="#40e0d0"; if(oran>=70)renk="#c62828"; else if(oran>=40)renk="#ffaa00";
    const aci=Math.PI+(Math.PI*oran/100);
    ctx.beginPath(); ctx.arc(cx,cy,r,Math.PI,aci); ctx.strokeStyle=renk; ctx.lineWidth=14; ctx.lineCap="round"; ctx.stroke(); ctx.lineCap="butt";
    ctx.fillStyle=renk; ctx.font="bold 22px 'Segoe UI'"; ctx.textAlign="center"; ctx.fillText("%"+oran,cx,cy-50);
    const ex=cx+r*Math.cos(aci), ey=cy+r*Math.sin(aci);
    ctx.beginPath(); ctx.arc(ex,ey,5,0,Math.PI*2); ctx.fillStyle=renk; ctx.fill();
}

// Tehdit Analizi
async function tehditAnaliziGuncelle() {
    const gecmis = gecmisiGetir();
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
        ulkeListe.push({ ip: k.ip, ulke, bayrak: ulkeKoduEmoji(ulke), adet: son7Kayit.filter(x => x.ip === k.ip && x.seviye === "kritik").length });
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
    const canvas = document.getElementById("pastaChart"); if (!canvas) return;
    const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height, cx = w/2, cy = h/2, r = 80;
    ctx.clearRect(0,0,w,h);
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

async function hashSorgula() {
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
    btn.textContent = "Hash Sorgula";
}
function hashGecmisiGetir() {
    return JSON.parse(localStorage.getItem("bloodeye_hash_gecmis") || "[]");
}

function hashGecmiseEkle(sonuclar) {
    const gecmis = hashGecmisiGetir();
    const simdi = Date.now();
    sonuclar.forEach(v => {
        gecmis.push({
            hash: v.hash,
            tarih: simdi,
            malicious: v.data?.data?.attributes?.last_analysis_stats?.malicious || 0,
            harmless: v.data?.data?.attributes?.last_analysis_stats?.harmless || 0,
            name: v.data?.data?.attributes?.meaningful_name || "-"
        });
    });
    const son24s = simdi - 24 * 60 * 60 * 1000;
    const filtrelenmis = gecmis.filter(k => k.tarih > son24s);
    localStorage.setItem("bloodeye_hash_gecmis", JSON.stringify(filtrelenmis));
}

function hashGecmisiGoster() {
    const gecmis = hashGecmisiGetir();
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
function hashTablosuOlustur(veriler) {
    let html = "<table><tr><th>Hash</th><th>Tip</th><th>Zararlı</th><th>Temiz</th><th>Popüler Ad</th></tr>";

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
        html += `<tr><td style="font-family:monospace;font-size:11px;" title="${v.hash}">${kisaHash}</td><td>${tip}</td><td ${malRengi}>${mal}</td><td style="color:#40e0d0;">${temiz}</td><td>${ad}</td></tr>`;
    });

    html += "</table>";
    document.getElementById("hashSonuc").innerHTML = html;
}
dashboardGuncelle();
gecmisiGoster();