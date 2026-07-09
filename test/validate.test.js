const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "bin", "relayloop.js");

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], { cwd: repoRoot, encoding: "utf8" });
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "relayloop-validate-"));
}

function initWorkspace(projectDir) {
  const result = spawnSync(
    "python3",
    [path.join(repoRoot, "scripts", "init_relay_loop.py"), "--project-name", "ValidateDemo", "--project-path", projectDir],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  return path.join(projectDir, "relay-loop");
}

const VALID_ENVELOPE = `RELAYLOOP_MESSAGE v1
project: ValidateDemo
mode: task
from_role: pm
to_role: dev
message_id: 20260709-pm-001
requires_response: yes
response_to: none
priority: normal

Context:
Demo dispatch.

Task:
Add a --version flag to the CLI.

Acceptance:
- relayloop --version prints the package version
- npm test passes with the new flag covered

Return Format:
- Result: pass|fail|blocked
- Summary
- Evidence
END_RELAYLOOP_MESSAGE
`;

test("validate accepts a freshly initialized workspace", () => {
  const projectDir = makeTempDir();
  const workspace = initWorkspace(projectDir);

  const result = runCli(["validate", "--relay-loop-dir", workspace, "--json"]);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.deepEqual(report.errors, []);
});

test("validate flags a missing PM agent and bad workspace mode", () => {
  const projectDir = makeTempDir();
  const workspace = initWorkspace(projectDir);
  const agentsPath = path.join(workspace, "agents.json");
  const agents = JSON.parse(fs.readFileSync(agentsPath, "utf8"));
  agents.agents = agents.agents.filter((agent) => agent.role !== "pm");
  agents.agents[0].workspaceMode = "yolo";
  fs.writeFileSync(agentsPath, JSON.stringify(agents, null, 2));

  const result = runCli(["validate", "--relay-loop-dir", workspace, "--json"]);

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.problem.includes("PM-led")));
  assert.ok(report.errors.some((item) => item.problem.includes("workspaceMode")));
});

test("validate enforces the proof gate on message events", () => {
  const projectDir = makeTempDir();
  const workspace = initWorkspace(projectDir);
  const messages = [
    { schema: "relayloop.event.v1", eventType: "message", timestamp: "2026-07-09T00:00:00Z", actor: "test", summary: "acceptance run", result: "pass" },
    { schema: "relayloop.event.v1", eventType: "message", timestamp: "2026-07-09T00:01:00Z", actor: "test", summary: "acceptance run", result: "pass", evidence: "npm test output: 12 passed" },
  ];
  fs.writeFileSync(path.join(workspace, "messages.ndjson"), messages.map((event) => JSON.stringify(event)).join("\n") + "\n");

  const result = runCli(["validate", "--relay-loop-dir", workspace, "--json"]);

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  const proofErrors = report.errors.filter((item) => item.problem.includes("proof gate"));
  assert.equal(proofErrors.length, 1);
  assert.equal(proofErrors[0].where, "messages.ndjson:1");
});

test("validate reports invalid JSON lines with line numbers", () => {
  const projectDir = makeTempDir();
  const workspace = initWorkspace(projectDir);
  fs.writeFileSync(path.join(workspace, "decisions.ndjson"), '{"schema":"relayloop.event.v1"\nnot json\n');

  const result = runCli(["validate", "--relay-loop-dir", workspace, "--json"]);

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.ok(report.errors.some((item) => item.where === "decisions.ndjson:1" && item.problem.includes("invalid JSON")));
  assert.ok(report.errors.some((item) => item.where === "decisions.ndjson:2"));
});

test("validate flags a progress file missing required sections", () => {
  const projectDir = makeTempDir();
  const workspace = initWorkspace(projectDir);
  fs.writeFileSync(path.join(workspace, "progress.md"), "# Demo Progress\n\nfree-form notes\n");

  const result = runCli(["validate", "--relay-loop-dir", workspace, "--json"]);

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.ok(report.errors.some((item) => item.problem.includes("## State")));
  assert.ok(report.errors.some((item) => item.problem.includes("## Next Action")));
});

test("validate accepts a well-formed message envelope", () => {
  const dir = makeTempDir();
  const messagePath = path.join(dir, "dispatch.txt");
  fs.writeFileSync(messagePath, VALID_ENVELOPE);

  const result = runCli(["validate", "--message-file", messagePath, "--json"]);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).ok, true);
});

test("validate rejects an envelope without Acceptance", () => {
  const dir = makeTempDir();
  const messagePath = path.join(dir, "dispatch.txt");
  fs.writeFileSync(messagePath, VALID_ENVELOPE.replace(/Acceptance:[\s\S]*?\n\n/, ""));

  const result = runCli(["validate", "--message-file", messagePath, "--json"]);

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.ok(report.errors.some((item) => item.problem.includes("Acceptance")));
});

test("validate rejects bad envelope header values", () => {
  const dir = makeTempDir();
  const messagePath = path.join(dir, "dispatch.txt");
  fs.writeFileSync(messagePath, VALID_ENVELOPE.replace("mode: task", "mode: vibes").replace("priority: normal", "priority: asap"));

  const result = runCli(["validate", "--message-file", messagePath, "--json"]);

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.ok(report.errors.some((item) => item.problem.includes("mode")));
  assert.ok(report.errors.some((item) => item.problem.includes("priority")));
});

test("validate accepts the normalized JSON message form", () => {
  const dir = makeTempDir();
  const messagePath = path.join(dir, "dispatch.json");
  fs.writeFileSync(
    messagePath,
    JSON.stringify({
      protocol: "RELAYLOOP_MESSAGE v1",
      project: "ValidateDemo",
      mode: "review",
      from_role: "pm",
      to_role: "review",
      message_id: "20260709-pm-002",
      requires_response: "yes",
      response_to: "none",
      priority: "high",
      task: "Review the diff for regression risk.",
      acceptance: ["Result plus at least one concrete risk or an explicit none-found"],
      return_format: ["Result", "Summary", "Evidence"],
    }),
  );

  const result = runCli(["validate", "--message-file", messagePath, "--json"]);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).ok, true);
});

test("validate --strict turns warnings into a failing exit code", () => {
  const dir = makeTempDir();
  const messagePath = path.join(dir, "dispatch.txt");
  fs.writeFileSync(messagePath, VALID_ENVELOPE.replace(/Return Format:[\s\S]*?END_RELAYLOOP_MESSAGE/, "END_RELAYLOOP_MESSAGE"));

  const lax = runCli(["validate", "--message-file", messagePath, "--json"]);
  assert.equal(lax.status, 0, lax.stdout);
  assert.ok(JSON.parse(lax.stdout).warnings.length > 0);

  const strict = runCli(["validate", "--message-file", messagePath, "--json", "--strict"]);
  assert.equal(strict.status, 1);
});

test("validate requires exactly one target option", () => {
  assert.equal(runCli(["validate"]).status, 2);
  assert.equal(runCli(["validate", "--relay-loop-dir", "/tmp/x", "--message-file", "/tmp/y"]).status, 2);
});

test("schema files are valid JSON and match validator vocabularies", () => {
  const schemasDir = path.join(repoRoot, "schemas");
  const message = JSON.parse(fs.readFileSync(path.join(schemasDir, "relayloop.message.v1.schema.json"), "utf8"));
  const event = JSON.parse(fs.readFileSync(path.join(schemasDir, "relayloop.event.v1.schema.json"), "utf8"));
  const agents = JSON.parse(fs.readFileSync(path.join(schemasDir, "relayloop.agents.v1.schema.json"), "utf8"));

  assert.deepEqual(message.properties.mode.enum, ["task", "goal", "review"]);
  assert.deepEqual(message.properties.priority.enum, ["low", "normal", "high", "urgent"]);
  assert.ok(message.required.includes("task"));
  assert.ok(message.required.includes("acceptance"));
  assert.deepEqual(event.properties.result.enum, ["pass", "fail", "blocked"]);
  assert.deepEqual(event.then.required, ["evidence"]);
  assert.deepEqual(agents.properties.project.properties.adapter.enum, ["codex", "claude-code"]);
});
