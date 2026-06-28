#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_IMPORT_OPTIONS = [
  "team-loop-dir",
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
  console.log(`teamloop

Usage:
  teamloop --help
  teamloop specialists --help
  teamloop specialists import --help
  teamloop specialists import [options]

Commands:
  teamloop specialists import   Import approved local Markdown into Team Loop.

This CLI works with project-local Team Loop files only.`);
}

function printSpecialistsHelp() {
  console.log(`teamloop specialists

Usage:
  teamloop specialists import [options]

Commands:
  import   Import an approved local Markdown specialist profile.`);
}

function printImportHelp() {
  console.log(`teamloop specialists import

Imports approved local Markdown into Team Loop only. It does not fetch remote content,
does not run upstream scripts, and does not install Codex agents.

Usage:
  teamloop specialists import \\
    --team-loop-dir <path> \\
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
  --write              Write project-local Team Loop files. Default is dry-run.
  --force              Replace an existing specialist with the same id.
  --approved-by Dylan  Required exactly for --write in v1.

Writes only:
  team-loop/specialists.json
  team-loop/agent-profiles/specialists/<id>.md
  team-loop/vendor/<source-name>.lock.json`);
}

function fail(message) {
  console.error(message);
  return 2;
}

function parseOptions(args) {
  const options = {};
  const flags = new Set(["write", "force", "help"]);
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

## Team Loop Contract

You are an optional Specialist Agent inside Dylan Team Loop. Respond only to \`TEAMLOOP_MESSAGE v1\` tasks from PM.

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

## Team Loop Footer

Do not install dependencies, run external scripts, edit files, or contact external services unless PM explicitly assigns that scope and Dylan approval covers it.
`;
}

function buildSpecialist(options, profileContent, importedAt) {
  const sourceName = safeSourceName(options["source-name"]);
  const contentHash = crypto.createHash("sha256").update(profileContent).digest("hex");
  return {
    schema: "dylan-team-loop.specialist-profile.v1",
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
    profilePath: `team-loop/agent-profiles/specialists/${options.id}.md`,
    requiresTeamLoopEnvelope: true,
    status: "available",
  };
}

function buildPlan(options) {
  requireImportOptions(options);
  assertSafeId(options.id);

  const teamLoopDir = path.resolve(options["team-loop-dir"]);
  const profileFile = path.resolve(options["profile-file"]);
  assertMarkdownProfileFile(profileFile);
  if (!fs.existsSync(teamLoopDir) || !fs.statSync(teamLoopDir).isDirectory()) {
    throw new Error(`Team Loop directory does not exist: ${teamLoopDir}`);
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
  const specialist = buildSpecialist(options, profileContent, importedAt);
  const registryPath = path.join(teamLoopDir, "specialists.json");
  const wrappedProfilePath = path.join(teamLoopDir, "agent-profiles", "specialists", `${options.id}.md`);
  const lockPath = path.join(teamLoopDir, "vendor", `${specialist.source.name}.lock.json`);
  const registry = readJsonObject(registryPath, {
    schema: "dylan-team-loop.specialists.v1",
    specialists: [],
  });
  if (registry.schema !== "dylan-team-loop.specialists.v1") {
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
    schema: "dylan-team-loop.specialist-lock.v1",
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
