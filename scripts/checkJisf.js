const https = require("https");
const url = "https://www.jisf.or.jp/data/seisan/index.html";
https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
  let chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => {
    const buf = Buffer.concat(chunks);
    const text = new TextDecoder("shift_jis").decode(buf);
    const linkRe = /<a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g;
    let m;
    while ((m = linkRe.exec(text)) !== null) {
      const href = m[1];
      const label = m[2].trim();
      if (
        label.includes("生産") ||
        label.includes("時系列") ||
        label.includes("粗鋼") ||
        label.includes("銑")
      ) {
        console.log(href + " => " + label);
      }
    }
  });
}).on("error", (e) => console.log("ERR: " + e.message));
