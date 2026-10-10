// Verify streaming works end-to-end (non-stream + stream)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nonStream() {
  const res = await fetch("http://localhost:3000/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "1文で自己紹介" }],
      stream: false,
    }),
  });
  const j = await res.json();
  console.log("[non-stream]", res.status, j.ok ? "OK" : "FAIL", "-", j.text?.slice(0, 40));
}

async function stream() {
  const res = await fetch("http://localhost:3000/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "岡山を1文で" }],
      stream: true,
    }),
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let acc = "";
  const start = Date.now();
  let deltas = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    acc += decoder.decode(value, { stream: true });
    if (acc.includes('"text-delta"')) deltas++;
  }
  console.log(`[stream] ${res.status} OK, ${deltas} deltas, ${Date.now() - start}ms, ${acc.length} bytes`);
}

(async () => {
  await sleep(8000); // wait for dev server
  await nonStream();
  await stream();
})();
