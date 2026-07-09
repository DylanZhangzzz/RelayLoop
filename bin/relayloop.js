#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { validateEnvelopeText, validateMessageObject, validateWorkspace, newReport } = require("../lib/validate.js");

const REQUIRED_IMPORT_OPTIONS = [
  "relay-loop-dir",
  "profile-file",
  "id",
  "display-name",
  "source-name",
  "source-repo",
  "source-ref",
  "source-path",
  "license",
];

function printRootHelp() {
  console.log(`relayloop

Usage:
  relayloop --help
  relayloop validate --help
  relayloop validate [options]
  relayloop specialists --help
  relayloop specialists import --help
  relayloop specialists import [options]

Commands:
  relayloop validate             Check a workspace or message against the RelayLoop protocol.
  relayloop specialists import   Import approved local Markdown into RelayLoop.

RelayLoop stores project state in a project-local \`relay-loop/\` workspace.
Legacy \`team-loop/\` workspaces remain supported via --team-loop-dir.`);
}

function printSpecialistsHelp() {
  console.log(`relayloop specialists

Usage:
  relayloop specialists import [options]

Commands:
  import   Import an approved local Markdown specialist profile.`);
}

function printImportHelp() {
  console.log(`relayloop specialists import

Imports approved local Markdown into RelayLoop only. It does not fetch remote content,
does not run upstream scripts, and does not install Codex agents.

Usage:
  relayloop specialists import \\
    --relay-loop-dir <path> \\
    --profile-file <local .md/.markdown path> \\
    --id <specialist-id> \\
    --display-name <name> \\
    --source-name <name> \\
    --source-repo <url> \\
    --source-ref <40-char-hex-sha> \\
    --source-path <path> \\
    --license <license> \\
    [--approved-by Dylan] \\
    [--write] [--force]

Options:
  --write              Write project-local RelayLoop files. Default is dry-run.
  --force              Replace an existing specialist with the same id.
  --approved-by Dylan  Required exactly for --write in v1.
  --team-loop-dir      Deprecated alias of --relay-loop-dir for legacy workspaces.

Writes only:
  relay-loop/specialists.json
  relay-loop/agent-profiles/specialists/<id>.md
  relay-loop/vendor/<source-name>.lock.json`);
}

function fail(message) {
  console.error(message);
  return 2;
}

function printValidateHelp() {
  console.log(`relayloop validate

Checks RelayLoop artifacts against the v1 protocol. Validates:
  - agents.json      (relayloop.agents.v1: project fields, roles, PM presence)
  - progress.md      (required sections and loop state)
  - *.ndjson logs    (relayloop.event.v1: per-line JSON, actor/summary, event types)
  - proof gate       (a message event with result 'pass' must carry evidence)
  - message envelope (RELAYLOOP_MESSAGE v1 headers plus Task/Acceptance sections)

The JSON Schema files this enforces live in schemas/.

Usage:
  relayloop validate --relay-loop-dir <path> [--json] [--strict]
  relayloop validate --message-file <path>  [--json] [--strict]

Options:
  --relay-loop-dir <path>  Validate a RelayLoop workspace directory.
  --team-loop-dir <path>   Deprecated alias of --relay-loop-dir for legacy workspaces.
  --message-file <path>    Validate one RELAYLOOP_MESSAGE v1 envelope: .txt/.md as
                           envelope text, .json as the normalized JSON form.
  --json                   Print a machine-readable JSON report.
  --strict                 Treat warnings as errors.

Exit codes: 0 valid, 1 validation errors found, 2 usage error.`);
}

function printReport(report, asJson, strict) {
  const failed = report.errors.length > 0 || (strict && report.warnings.length > 0);
  if (asJson) {
    console.log(JSON.stringify({ ok: !failed, target: report.target, errors: report.errors, warnings: report.warnings }, null, 2));
  } else {
    console.log(`RelayLoop validate: ${report.target}`);
    for (const item of report.errors) {
      console.log(`  ERROR  ${item.where}: ${item.problem}`);
    }
    for (const item of report.warnings) {
      console.log(`  WARN   ${item.where}: ${item.problem}`);
    }
    console.log(`Result: ${report.errors.length} error(s), ${report.warnings.length} warning(s)${failed ? "" : " - OK"}`);
  }
  return failed ? 1 : 0;
}

function runValidate(args) {
  if (args.includes("--help")) {
    printValidateHelp();
    return 0;
  }
  let options;
  try {
    options = parseOptions(args, ["json", "strict", "help"]);
  } catch (error) {
    return fail(error.message);
  }
  if (options["team-loop-dir"] && !options["relay-loop-dir"]) {
    options["relay-loop-dir"] = options["team-loop-dir"];
  }
  const dir = options["relay-loop-dir"];
  const messageFile = options["message-file"];
  if ((dir && messageFile) || (!dir && !messageFile)) {
    return fail("Pass exactly one of --relay-loop-dir or --message-file. See relayloop validate --help.");
  }

  let report;
  if (dir) {
    report = validateWorkspace(path.resolve(dir));
  } else {
    const filePath = path.resolve(messageFile);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return fail(`Message file does not exist: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, "utf8");
    if (/\.json$/i.test(filePath)) {
      report = newReport(filePath);
      try {
        validateMessageObject(JSON.parse(content), report, path.basename(filePath));
      } catch (error) {
        report.errors.push({ where: path.basename(filePath), problem: `invalid JSON: ${error.message}` });
      }
    } else {
      report = validateEnvelopeText(content, path.basename(filePath));
    }
  }
  return printReport(report, Boolean(options.json), Boolean(options.strict));
}

function parseOptions(args, flagNames = ["write", "force", "help"]) {
  const options = {};
  const flags = new Set(flagNames);
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (!item.startsWith("--")) {
      throw new Error(`Unexpected argument: ${item}`);
    }
    const name = item.slice(2);
    if (flags.has(name)) {
      options[name] = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }
    options[name] = value;
    index += 1;
  }
  return options;
}

function requireImportOptions(options) {
  const missing = REQUIRED_IMPORT_OPTIONS.filter((name) => !options[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required options: ${missing.map((name) => `--${name}`).join(", ")}`);
  }
}

function assertSafeId(id) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(id)) {
    throw new Error("--id must use lowercase letters, numbers, dots, underscores, or hyphens");
  }
}

function assertMarkdownProfileFile(filePath) {
  if (!/\.(md|markdown)$/i.test(filePath)) {
    throw new Error("--profile-file must end in .md or .markdown");
  }
}

function safeSourceName(name) {
  const safe = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!safe) {
    throw new Error("--source-name must contain at least one letter or number");
  }
  return safe;
}

function readJsonObject(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Expected JSON object in ${filePath}`);
  }
  return parsed;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function wrappedProfile(profileContent, specialist) {
  const source = specialist.source;
  const body = profileContent.trimEnd();
  return `# ${specialist.displayName} Specialist

## RelayLoop Contract

You are an optional Specialist Agent inside RelayLoop. Respond only to \`RELAYLOOP_MESSAGE v1\` tasks from PM.

Return Summary, Files changed, Commands run, Risks/blockers, and Next recommended action.

Return:

- Summary
- Files changed
- Commands run
- Risks/blockers
- Next recommended action

Default to read-only unless PM explicitly grants edit scope.

## Source Metadata

- Source name: ${source.name}
- Source repository: ${source.repository}
- Pinned ref: ${source.ref}
- Source path: ${source.path}
- License: ${source.license}
- Source format: ${source.sourceFormat}
- Script review: ${source.scriptReview}
- Content hash: ${source.contentHash}
- Imported by: ${source.importedBy}
- Imported at: ${source.importedAt}

## Original Specialist Profile

${body}

## RelayLoop Footer

Do not install dependencies, run external scripts, edit files, or contact external services unless PM explicitly assigns that scope and Dylan approval covers it.
`;
}

function buildSpecialist(options, profileContent, importedAt, workspaceDirname) {
  const sourceName = safeSourceName(options["source-name"]);
  const contentHash = crypto.createHash("sha256").update(profileContent).digest("hex");
  return {
    schema: "relayloop.specialist-profile.v1",
    id: options.id,
    displayName: options["display-name"],
    source: {
      name: sourceName,
      type: "github",
      repository: options["source-repo"],
      ref: options["source-ref"],
      path: options["source-path"],
      license: options.license,
      sourceFormat: "markdown",
      scriptReview: "not-run",
      contentHash,
      importedAt,
      importedBy: options["approved-by"] || null,
    },
    workspaceMode: "readonly",
    allowedModes: ["task", "goal", "review"],
    profilePath: `${workspaceDirname}/agent-profiles/specialists/${options.id}.md`,
    requiresRelayLoopEnvelope: true,
    status: "available",
  };
}

function buildPlan(options) {
  if (options["team-loop-dir"] && !options["relay-loop-dir"]) {
    options["relay-loop-dir"] = options["team-loop-dir"];
  }
  requireImportOptions(options);
  assertSafeId(options.id);

  const relayLoopDir = path.resolve(options["relay-loop-dir"]);
  const profileFile = path.resolve(options["profile-file"]);
  assertMarkdownProfileFile(profileFile);
  if (!fs.existsSync(relayLoopDir) || !fs.statSync(relayLoopDir).isDirectory()) {
    throw new Error(`RelayLoop workspace directory does not exist: ${relayLoopDir}`);
  }
  if (!fs.existsSync(profileFile) || !fs.statSync(profileFile).isFile()) {
    throw new Error(`Profile file does not exist: ${profileFile}`);
  }
  if (options.write && options["approved-by"] !== "Dylan") {
    throw new Error("--write requires --approved-by Dylan exactly");
  }
  if (options.write && !/^[a-fA-F0-9]{40}$/.test(options["source-ref"])) {
    throw new Error("--write requires --source-ref to be a 40-character hex SHA");
  }

  const importedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const profileContent = fs.readFileSync(profileFile, "utf8");
  const specialist = buildSpecialist(options, profileContent, importedAt, path.basename(relayLoopDir));
  const registryPath = path.join(relayLoopDir, "specialists.json");
  const wrappedProfilePath = path.join(relayLoopDir, "agent-profiles", "specialists", `${options.id}.md`);
  const lockPath = path.join(relayLoopDir, "vendor", `${specialist.source.name}.lock.json`);
  const registry = readJsonObject(registryPath, {
    schema: "relayloop.specialists.v1",
    specialists: [],
  });
  if (registry.schema !== "relayloop.specialists.v1") {
    throw new Error(`Unsupported specialists registry schema in ${registryPath}`);
  }
  if (!Array.isArray(registry.specialists)) {
    throw new Error(`Expected specialists array in ${registryPath}`);
  }
  const existingIndex = registry.specialists.findIndex((item) => item && item.id === options.id);
  if (options.write && existingIndex !== -1 && !options.force) {
    throw new Error(`Specialist id already exists: ${options.id}. Use --force to replace it.`);
  }
  if (options.write && existingIndex === -1 && fs.existsSync(wrappedProfilePath) && !options.force) {
    throw new Error(`Wrapped profile already exists: ${wrappedProfilePath}. Use --force to replace it.`);
  }

  return {
    dryRun: !options.write,
    force: Boolean(options.force),
    specialist,
    writes: {
      specialistsJson: registryPath,
      wrappedProfile: wrappedProfilePath,
      lockFile: lockPath,
    },
    _registry: registry,
    _existingIndex: existingIndex,
    _wrappedProfileContent: wrappedProfile(profileContent, specialist),
  };
}

function writePlan(plan) {
  const registry = plan._registry;
  if (plan._existingIndex === -1) {
    registry.specialists.push(plan.specialist);
  } else {
    registry.specialists[plan._existingIndex] = plan.specialist;
  }
  writeJson(plan.writes.specialistsJson, registry);
  fs.mkdirSync(path.dirname(plan.writes.wrappedProfile), { recursive: true });
  fs.writeFileSync(plan.writes.wrappedProfile, plan._wrappedProfileContent, "utf8");

  const lock = readJsonObject(plan.writes.lockFile, {
    schema: "relayloop.specialist-lock.v1",
    source: {
      name: plan.specialist.source.name,
      repository: plan.specialist.source.repository,
      scriptReview: plan.specialist.source.scriptReview,
      metadataOnly: true,
    },
    imports: [],
  });
  if (!Array.isArray(lock.imports)) {
    lock.imports = [];
  }
  const importRecord = {
    id: plan.specialist.id,
    displayName: plan.specialist.displayName,
    ref: plan.specialist.source.ref,
    path: plan.specialist.source.path,
    license: plan.specialist.source.license,
    sourceFormat: plan.specialist.source.sourceFormat,
    contentHash: plan.specialist.source.contentHash,
    importedAt: plan.specialist.source.importedAt,
    importedBy: plan.specialist.source.importedBy,
  };
  const existingImportIndex = lock.imports.findIndex((item) => item && item.id === plan.specialist.id);
  if (existingImportIndex === -1) {
    lock.imports.push(importRecord);
  } else {
    lock.imports[existingImportIndex] = importRecord;
  }
  writeJson(plan.writes.lockFile, lock);
}

function publicPlan(plan) {
  return {
    dryRun: plan.dryRun,
    force: plan.force,
    specialist: plan.specialist,
    writes: plan.writes,
  };
}

function runSpecialistsImport(args) {
  if (args.includes("--help")) {
    printImportHelp();
    return 0;
  }
  let options;
  try {
    options = parseOptions(args);
    const plan = buildPlan(options);
    if (options.write) {
      writePlan(plan);
    }
    console.log(JSON.stringify(publicPlan(plan), null, 2));
    return 0;
  } catch (error) {
    return fail(error.message);
  }
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printRootHelp();
    return 0;
  }
  if (args[0] === "validate") {
    return runValidate(args.slice(1));
  }
  if (args[0] !== "specialists") {
    return fail(`Unknown command: ${args[0]}`);
  }
  if (args.length === 1 || args[1] === "--help" || args[1] === "-h") {
    printSpecialistsHelp();
    return 0;
  }
  if (args[1] !== "import") {
    return fail(`Unknown specialists command: ${args[1]}`);
  }
  return runSpecialistsImport(args.slice(2));
}

if (require.main === module) {
  process.exitCode = main(process.argv);
}

module.exports = { main };
