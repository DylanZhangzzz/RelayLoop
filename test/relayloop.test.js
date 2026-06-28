const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "bin", "relayloop.js");
const pinnedRef = "0123456789abcdef0123456789abcdef01234567";

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });
}

test("package metadata exposes only the relayloop bin", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));

  assert.equal(packageJson.name, "relayloop");
  assert.equal(packageJson.private, undefined);
  assert.deepEqual(packageJson.bin, { relayloop: "bin/relayloop.js" });
  assert.match(packageJson.description, /RelayLoop/);
  assert.equal(fs.existsSync(path.join(repoRoot, "bin", `team${"loop"}.js`)), false);
});

function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "relayloop-test-"));
  const teamLoopDir = path.join(root, "team-loop");
  fs.mkdirSync(teamLoopDir, { recursive: true });
  const profileFile = path.join(root, "security.md");
  fs.writeFileSync(
    profileFile,
    [
      "---",
      "name: Security Engineer",
      "---",
      "",
      "# Security Engineer",
      "",
      "Review threat models and implementation risk.",
      "",
    ].join("\n"),
  );
  return { root, teamLoopDir, profileFile };
}

function importArgs(workspace, extra = []) {
  return [
    "specialists",
    "import",
    "--team-loop-dir",
    workspace.teamLoopDir,
    "--profile-file",
    workspace.profileFile,
    "--id",
    "security-engineer",
    "--display-name",
    "Security Engineer",
    "--source-name",
    "agency-agents",
    "--source-repo",
    "https://github.com/msitarzewski/agency-agents",
    "--source-ref",
    pinnedRef,
    "--source-path",
    "engineering/security-engineer.md",
    "--license",
    "MIT",
    "--approved-by",
    "Dylan",
    ...extra,
  ];
}

function withoutOption(args, optionName) {
  const index = args.indexOf(optionName);
  assert.notEqual(index, -1, `missing ${optionName} in test args`);
  return args.toSpliced(index, 2);
}

test("specialists import dry-run prints a plan and writes no files", () => {
  const workspace = makeWorkspace();

  const result = runCli(importArgs(workspace));

  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.dryRun, true);
  assert.equal(plan.specialist.id, "security-engineer");
  assert.equal(fs.existsSync(path.join(workspace.teamLoopDir, "specialists.json")), false);
  assert.equal(
    fs.existsSync(path.join(workspace.teamLoopDir, "agent-profiles", "specialists", "security-engineer.md")),
    false,
  );
  assert.equal(fs.existsSync(path.join(workspace.teamLoopDir, "vendor", "agency-agents.lock.json")), false);
});

test("specialists import dry-run does not require Dylan approval", () => {
  const workspace = makeWorkspace();

  const result = runCli(withoutOption(importArgs(workspace), "--approved-by"));

  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.dryRun, true);
  assert.equal(plan.specialist.source.importedBy, null);
});

test("specialists import --write creates specialists registry, wrapped profile, and metadata lock", () => {
  const workspace = makeWorkspace();

  const result = runCli(importArgs(workspace, ["--write"]));

  assert.equal(result.status, 0, result.stderr);
  const registryPath = path.join(workspace.teamLoopDir, "specialists.json");
  const wrappedPath = path.join(workspace.teamLoopDir, "agent-profiles", "specialists", "security-engineer.md");
  const lockPath = path.join(workspace.teamLoopDir, "vendor", "agency-agents.lock.json");

  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  assert.equal(registry.schema, "relayloop.specialists.v1");
  assert.equal(registry.specialists.length, 1);
  assert.equal(registry.specialists[0].schema, "relayloop.specialist-profile.v1");
  assert.equal(registry.specialists[0].workspaceMode, "readonly");
  assert.deepEqual(registry.specialists[0].allowedModes, ["task", "goal", "review"]);
  assert.equal(registry.specialists[0].requiresRelayLoopEnvelope, true);
  assert.equal(registry.specialists[0].source.ref, pinnedRef);
  assert.match(registry.specialists[0].source.contentHash, /^[a-f0-9]{64}$/);
  assert.equal(registry.specialists[0].source.importedBy, "Dylan");

  const wrapped = fs.readFileSync(wrappedPath, "utf8");
  assert.match(wrapped, /RELAYLOOP_MESSAGE v1/);
  assert.match(wrapped, /Summary, Files changed, Commands run, Risks\/blockers, and Next recommended action/);
  assert.match(wrapped, /Review threat models and implementation risk/);
  assert.match(wrapped, /Do not install dependencies, run external scripts/);

  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  assert.equal(lock.schema, "relayloop.specialist-lock.v1");
  assert.equal(lock.source.name, "agency-agents");
  assert.equal(lock.source.scriptReview, "not-run");
});

test("specialists import rejects non-Markdown profile files before write", () => {
  const workspace = makeWorkspace();
  const textProfile = path.join(workspace.root, "security.txt");
  fs.writeFileSync(textProfile, "not markdown");
  const args = importArgs({ ...workspace, profileFile: textProfile }, ["--write"]);

  const result = runCli(args);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--profile-file must end in .md or .markdown/i);
  assert.equal(fs.existsSync(path.join(workspace.teamLoopDir, "specialists.json")), false);
});

test("specialists import --write fails on duplicate id without --force", () => {
  const workspace = makeWorkspace();
  assert.equal(runCli(importArgs(workspace, ["--write"])).status, 0);

  const duplicate = runCli(importArgs(workspace, ["--write"]));

  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /already exists/);
});

test("specialists import --write fails when wrapped profile exists without registry entry and without --force", () => {
  const workspace = makeWorkspace();
  const wrappedPath = path.join(workspace.teamLoopDir, "agent-profiles", "specialists", "security-engineer.md");
  fs.mkdirSync(path.dirname(wrappedPath), { recursive: true });
  fs.writeFileSync(wrappedPath, "stale wrapped profile");

  const result = runCli(importArgs(workspace, ["--write"]));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /wrapped profile already exists/i);
  assert.equal(fs.readFileSync(wrappedPath, "utf8"), "stale wrapped profile");
});

test("specialists import --write replaces duplicate id with --force", () => {
  const workspace = makeWorkspace();
  assert.equal(runCli(importArgs(workspace, ["--write"])).status, 0);

  fs.writeFileSync(workspace.profileFile, "# Security Engineer\n\nUpdated approved content.\n");
  const result = runCli(importArgs(workspace, ["--write", "--force"]));

  assert.equal(result.status, 0, result.stderr);
  const wrappedPath = path.join(workspace.teamLoopDir, "agent-profiles", "specialists", "security-engineer.md");
  assert.match(fs.readFileSync(wrappedPath, "utf8"), /Updated approved content/);
  const registry = JSON.parse(fs.readFileSync(path.join(workspace.teamLoopDir, "specialists.json"), "utf8"));
  assert.equal(registry.specialists.length, 1);
});

test("specialists import --write requires approval by Dylan exactly", () => {
  const workspace = makeWorkspace();
  const args = importArgs(workspace, ["--write"]).map((value) => (value === "Dylan" ? "PM" : value));

  const result = runCli(args);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--approved-by Dylan/);
});

test("specialists import --write requires a 40 character hex source ref", () => {
  const workspace = makeWorkspace();
  const args = importArgs(workspace, ["--write"]).map((value) => (value === pinnedRef ? "main" : value));

  const result = runCli(args);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /40-character hex/);
});

test("help output explains local-only import safety", () => {
  const rootHelp = runCli(["--help"]);
  assert.equal(rootHelp.status, 0, rootHelp.stderr);
  assert.match(rootHelp.stdout, /relayloop specialists import/);
  assert.match(rootHelp.stdout, /RelayLoop/);

  const importHelp = runCli(["specialists", "import", "--help"]);
  assert.equal(importHelp.status, 0, importHelp.stderr);
  assert.match(importHelp.stdout, /approved local Markdown/);
  assert.match(importHelp.stdout, /does not fetch remote content/);
  assert.match(importHelp.stdout, /does not install Codex agents/);
  assert.match(importHelp.stdout, /does not run upstream scripts/);
});
