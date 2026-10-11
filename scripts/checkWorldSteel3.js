const https = require("https");
https.get("https://worldsteel.org/data/", { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
  let chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => {
    const buf = Buffer.concat(chunks);
    const text = new TextDecoder("utf-8").decode(buf);
    // Find production-related links
    const linkRe = /<a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g;
    let m;
    console.log("=== Production links ===");
    while ((m = linkRe.exec(text)) !== null) {
      const href = m[1];
      const label = m[2].trim();
      if (label && (label.toLowerCase().includes("production") || label.toLowerCase().includes("steel"))) {
        console.log(href + " => " + label);
      }
    }
  });
}).on("error", (e) => console.log("ERR: " + e.message));
