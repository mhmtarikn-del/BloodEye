const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());

app.get("/abuse", async (req, res) => {
    const ip = req.query.ip;
    const key = req.query.key;
    
    if (!ip || !key) {
        return res.status(400).json({ error: "ip ve key gerekli" });
    }

    try {
        const response = await fetch(
            `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`,
            { headers: { "Key": key, "Accept": "application/json" } }
        );
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Proxy running on port " + PORT));