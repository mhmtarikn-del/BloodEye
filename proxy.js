const express = require("express");
const cors = require("cors");
const app = express();

const IPINFO_TOKEN = "ac4265c4327807";
const ABUSE_TOKEN = "389e145892cade03816f5bdeed74e6afc553c01e4f430d6a90f9f64fded05d36d2408a38dbc95c3a";

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

app.get("/", (req, res) => {
    res.send("BloodEye Proxy - Running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Proxy running on port " + PORT));