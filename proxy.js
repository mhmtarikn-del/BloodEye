const express = require("express");
const cors = require("cors");
const app = express();

const IPINFO_TOKEN = process.env.IPINFO_TOKEN;
const ABUSE_TOKEN = process.env.ABUSE_TOKEN;
const IPQS_TOKEN = process.env.IPQS_TOKEN;
const VT_TOKEN = process.env.VT_TOKEN;

app.use(cors());

app.get("/ipinfo", async (req, res) => {
    const ip = req.query.ip;
    if (!ip) return res.status(400).json({ error: "ip gerekli" });
    try {
        const response = await fetch(`https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`);
        const data = await response.json();
        res.json(data);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/abuse", async (req, res) => {
    const ip = req.query.ip;
    if (!ip) return res.status(400).json({ error: "ip gerekli" });
    try {
        const response = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`, {
            headers: { "Key": ABUSE_TOKEN, "Accept": "application/json" }
        });
        const data = await response.json();
        res.json(data);
    } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get("/vt", async (req, res) => {
    const ip = req.query.ip;
    const key = process.env.VT_TOKEN;
    if (!ip) return res.status(400).json({ error: "ip gerekli" });
    try {
        const response = await fetch(`https://www.virustotal.com/api/v3/ip_addresses/${ip}`, {
            headers: { "x-apikey": key, "Accept": "application/json" }
        });
        const data = await response.json();
        res.json(data);
    } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get("/vt-hash", async (req, res) => {
    const hash = req.query.hash;
    if (!hash) return res.status(400).json({ error: "hash gerekli" });
    try {
        const response = await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, {
            headers: { "x-apikey": VT_TOKEN, "Accept": "application/json" }
        });
        const data = await response.json();
        res.json(data);
    } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get("/", (req, res) => {
    res.send("BloodEye Proxy - Running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Proxy running on port " + PORT));
app.get("/vt-url", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "url gerekli" });
    try {
        const urlId = Buffer.from(url).toString("base64url");
        const response = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
            headers: { "x-apikey": VT_TOKEN, "Accept": "application/json" }
        });
        const data = await response.json();
        res.json(data);
    } catch(e) { res.status(500).json({ error: e.message }); }
});
const fs = require("fs");
const path = require("path");
const DATA_FILE = path.join(__dirname, "gecmis.json");

function veriOku() {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch(e) { return { ip: [], hash: [], url: [] }; }
}
function veriYaz(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data));
}

app.use(express.json());

app.get("/gecmis/:tip", (req, res) => {
    const data = veriOku();
    res.json(data[req.params.tip] || []);
});

app.post("/gecmis/:tip", (req, res) => {
    const data = veriOku();
    const tip = req.params.tip;
    if (!data[tip]) data[tip] = [];
    data[tip].push(...req.body);
    const birHaftaOnce = Date.now() - 7 * 24 * 60 * 60 * 1000;
    data[tip] = data[tip].filter(k => k.tarih > birHaftaOnce);
    veriYaz(data);
    res.json({ ok: true });
});

app.post("/sifirla", (req, res) => {
    if (req.body.sifre !== "suzgec2024") return res.status(403).json({ error: "Yetkisiz" });
    veriYaz({ ip: [], hash: [], url: [] });
    res.json({ ok: true });
});
app.post("/login", (req, res) => {
    if (req.body.sifre === process.env.ADMIN_SIFRE) {
        res.json({ admin: true });
    } else {
        res.json({ admin: false });
    }
});