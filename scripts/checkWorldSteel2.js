const https = require("https");
// JISF worldsteel page
https.get("https://www.jisf.or.jp/data/iisi/index.html", { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
  let chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => {
    const buf = Buffer.concat(chunks);
    const text = new TextDecoder("shift_jis").decode(buf);
    const clean = text.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    console.log("=== JISF worldsteel page ===");
    console.log(clean.substring(0, 2500));
    // find links
    const linkRe = /<a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g;
    let m;
    console.log("\n=== Links ===");
    while ((m = linkRe.exec(text)) !== null) {
      const href = m[1];
      const label = m[2].trim();
      if (label && !href.startsWith("javascript") && !href.startsWith("#")) {
        console.log(href + " => " + label);
      }
    }
  });
}).on("error", (e) => console.log("ERR: " + e.message));
