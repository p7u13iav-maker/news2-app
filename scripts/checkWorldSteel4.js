const https = require("https");
https.get("https://www.jisf.or.jp/data/iisi/index.html", { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
  let chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => {
    const buf = Buffer.concat(chunks);
    const text = new TextDecoder("shift_jis").decode(buf);
    // Find PDF links
    const pdfLinks = text.match(/<a[^>]*href="([^"]+\.pdf)"[^>]*>/gi) || [];
    console.log("=== PDF links ===");
    pdfLinks.forEach((l) => {
      const href = l.match(/href="([^"]+\.pdf)"/)[1];
      console.log(href);
    });
    // Also check for any data tables
    const tables = text.match(/<table[\s\S]*?<\/table>/gi) || [];
    console.log("\n=== Tables found: " + tables.length + " ===");
  });
}).on("error", (e) => console.log("ERR: " + e.message));
