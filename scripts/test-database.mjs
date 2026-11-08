import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";

const root = resolve(import.meta.dirname, "..");
const binaries = process.env.PG_BIN ?? "C:/Program Files/PostgreSQL/18/bin";
const exe = (name) => join(binaries, name + (process.platform === "win32" ? ".exe" : ""));
const runDir = resolve(root, ".local-db-tests", `run-${randomUUID()}`);
if (
  !runDir.startsWith(resolve(root, ".local-db-tests") + (process.platform === "win32" ? "\\" : "/"))
)
  throw new Error("Test directory escaped the workspace.");
mkdirSync(runDir, { recursive: true });
const port = await new Promise((resolvePort, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => resolvePort(address.port));
  });
});
const args = [
  "-X",
  "-v",
  "ON_ERROR_STOP=1",
  "-h",
  "127.0.0.1",
  "-p",
  String(port),
  "-U",
  "postgres",
  "-d",
  "postgres",
];
const options = {
  cwd: root,
  windowsHide: true,
  encoding: "utf8",
  stdio: "pipe",
  timeout: 60_000,
  maxBuffer: 8 * 1024 * 1024,
};
const command = (name, commandArgs) =>
  execFileSync(
    exe(name),
    commandArgs,
    name === "pg_ctl" ? { ...options, stdio: "ignore" } : options,
  );
const sql = (value) => command("psql", [...args, "-At", "-c", value]);
let started = false;
try {
  command("initdb", [
    "-D",
    join(runDir, "data"),
    "-U",
    "postgres",
    "--auth=trust",
    "--locale=C",
    "--encoding=UTF8",
  ]);
  started = true;
  command("pg_ctl", [
    "-D",
    join(runDir, "data"),
    "-l",
    join(runDir, "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${port}`,
    "-w",
    "start",
  ]);
  command("psql", [...args, "-f", join(root, "supabase/tests/bootstrap.sql")]);
  for (const file of readdirSync(join(root, "supabase/migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    command("psql", [...args, "-f", join(root, "supabase/migrations", file)]);
  const output = command("psql", [...args, "-f", join(root, "supabase/tests/commitment.sql")]);
  const assertions = (output.match(/assert|expect_error/g) ?? []).length;
  const raceKey = "88888888-8888-4888-8888-888888888888";
  const raceSql = `set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false); select public.commit_claim('${raceKey}','concurrent retry',test_support.base_terms(),'private');`;
  const execute = promisify(execFile);
  const results = await Promise.all(
    Array.from({ length: 4 }, () => execute(exe("psql"), [...args, "-At", "-c", raceSql], options)),
  );
  const ids = results.map((result) => result.stdout.trim().split(/\r?\n/).at(-1));
  if (new Set(ids).size !== 1 || !/^[0-9a-f-]{36}$/.test(ids[0]))
    throw new Error("Concurrent requests did not return one stable claim ID.");
  const count = sql(
    `select count(*) from public.claim_versions v join public.claims c on c.id=v.claim_id where c.idempotency_key='${raceKey}'`,
  ).trim();
  if (count !== "1") throw new Error("Concurrent retries created duplicate versions.");
  console.log(
    `Database checks passed (${assertions} SQL assertion results plus concurrent retry verification).`,
  );
  console.log(`Disposable PostgreSQL cluster and logs retained at ${runDir}`);
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  try {
    console.error(readFileSync(join(runDir, "postgres.log"), "utf8").slice(-3000));
  } catch {
    /* Init may not have completed. */
  }
  process.exitCode = 1;
} finally {
  if (started) {
    try {
      command("pg_ctl", ["-D", join(runDir, "data"), "-m", "fast", "-w", "stop"]);
    } catch {
      console.error(`Check the disposable cluster shutdown log at ${runDir}`);
      process.exitCode = 1;
    }
  }
}
