// Adds a developer login: the people who run tapndine, above every restaurant.
// There is no screen for this on purpose; run it once per developer.
//
//   npm run add-developer -- <username> "<Name>" --local    (this PC's database)
//   npm run add-developer -- <username> "<Name>" --remote   (the live site)
//
// It asks for the password and never prints it. Only its PBKDF2 hash, the
// same format lib/staff.ts checks, goes into the database.

import { execFileSync } from "node:child_process";
import { webcrypto as crypto } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const [username, name, where] = process.argv.slice(2);
if (!/^[a-z0-9._-]{3,32}$/.test(username ?? "") || !name || !["--local", "--remote"].includes(where)) {
  console.error('Usage: npm run add-developer -- <username> "<Name>" --local|--remote');
  process.exit(1);
}

/** Reads a line without echoing it when typed; piped input works too. */
function askPassword() {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    if (process.stdin.isTTY) {
      process.stdout.write("Password: ");
      rl._writeToOutput = () => {};
    }
    rl.question("", (answer) => {
      rl.close();
      if (process.stdin.isTTY) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const password = await askPassword();
if (password.length < 6) {
  console.error("Password: at least 6 characters.");
  process.exit(1);
}

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, key, 256);
const hash = `pbkdf2$100000$${Buffer.from(salt).toString("base64")}$${Buffer.from(bits).toString("base64")}`;
const id = "dev_" + Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString("base64url");
const q = (s) => `'${s.replace(/'/g, "''")}'`;

// A file, not --command: the hash stays out of the process list.
const dir = mkdtempSync(join(tmpdir(), "tapndine-"));
const file = join(dir, "developer.sql");
writeFileSync(
  file,
  `INSERT INTO staff (id, business_id, username, name, role, password_hash, created_at)
   VALUES (${q(id)}, NULL, ${q(username)}, ${q(name)}, 'developer', ${q(hash)}, ${Date.now()});\n`
);
try {
  const target = where === "--local" ? ["--local", "--persist-to", ".localdb"] : ["--remote"];
  execFileSync("npx", ["wrangler", "d1", "execute", "tapndine", ...target, "--file", file], { stdio: "inherit", shell: true });
  console.log(`Developer "${username}" added. Log in at /admin/login.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
