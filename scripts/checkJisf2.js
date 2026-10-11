const https = require("https");
const url = "https://www.jisf.or.jp/data/jikeiretsu/seisan.html";
https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
  let chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => {
    const buf = Buffer.concat(chunks);
    const text = new TextDecoder("shift_jis").decode(buf);
    const linkRe = /<a[^>]*href="([^"]+)"[^>]*>/g;
    let m;
    while ((m = linkRe.exec(text)) !== null) {
      const href = m[1];
      if (href.includes(".xls") || href.includes("documents") || href.includes(".xlsx")) {
        console.log(href);
      }
    }
  });
}).on("error", (e) => console.log("ERR: " + e.message));
