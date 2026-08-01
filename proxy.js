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
