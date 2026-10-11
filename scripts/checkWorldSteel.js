const https = require("https");
const urls = [
  "https://www.jisf.or.jp/data/iisi/index.html",
  "https://worldsteel.org/data/",
  "https://worldsteel.org/production/",
  "https://worldsteel.org/en/data/",
];
Promise.all(urls.map((u) => new Promise((resolve) => {
  https.get(u, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
    let chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => {
      const buf = Buffer.concat(chunks);
      const text = new TextDecoder("shift_jis").decode(buf);
      const title = text.match(/<title>([^<]*)<\/title>/);
      console.log(u + ": " + res.statusCode + " title=" + (title ? title[1].trim() : "?"));
      resolve();
    });
  }).on("error", (e) => { console.log(u + ": ERR " + e.message); resolve(); });
}))).then(() => console.log("done"));
