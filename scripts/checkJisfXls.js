const https = require("https");
const fs = require("fs");
const XLSX = require("xlsx");

const url = "https://www.jisf.or.jp/data/jikeiretsu/documents/seisan_s_2607.xls";

https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
  let chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => {
    const buf = Buffer.concat(chunks);
    const tmpPath = require("path").join(__dirname, "jisf_seisan.xls");
    fs.writeFileSync(tmpPath, buf);
    console.log("Downloaded " + buf.length + " bytes");

    const wb = XLSX.readFile(tmpPath);
    console.log("Sheet names: " + JSON.stringify(wb.SheetNames));

    // Read first sheet
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log("Total rows: " + data.length);

    // Print first 20 rows to understand structure
    for (let i = 0; i < Math.min(25, data.length); i++) {
      const row = data[i];
      const cells = row.slice(0, 10).map((c) => String(c ?? "").substring(0, 15));
      console.log("Row " + i + ": " + cells.join(" | "));
    }
  });
}).on("error", (e) => console.log("ERR: " + e.message));
