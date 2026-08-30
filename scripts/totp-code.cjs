// Одноразовый помощник для e2e-теста админки: печатает текущий TOTP-код.
// Секрет читается из stdin и никогда не выводится.
const crypto = require("node:crypto");

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of input.trim().replace(/=+$/, "").toUpperCase()) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function totp(secret, step) {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigInt64BE(BigInt(step));
  const hash = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  const secret = raw.trim();
  if (!secret) {
    console.error("empty secret");
    process.exit(1);
  }
  const step = Math.floor(Date.now() / 1000 / 30);
  process.stdout.write(totp(secret, step) + "\n");
});
