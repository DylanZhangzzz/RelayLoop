"use strict";

const fs = require("node:fs");
const path = require("node:path");

const CORE_ROLES = new Set(["pm", "dev", "test", "version", "review", "research", "ux", "fw", "ml"]);
const MODES = new Set(["task", "goal", "review"]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const RESULTS = new Set(["pass", "fail", "blocked"]);
const REQUIRES_RESPONSE = new Set(["yes", "no"]);
const WORKSPACE_MODES = new Set(["coordinator", "worktree", "readonly"]);
const ADAPTERS = new Set(["codex", "claude-code"]);
const PROGRESS_STATES = new Set([
  "planned",
  "assigned_dev",
  "dev_done",
  "review_testing",
  "changes_requested",
  "approved",
  "versioning",
  "committed_or_ready",
  "reported",
]);
const EVENT_FILES = {
  "messages.ndjson": "message",
  "commits.ndjson": "commit",
  "decisions.ndjson": "decision",
};
const ROLE_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const ENVELOPE_HEADER_FIELDS = [
  "project",
  "mode",
  "from_role",
  "to_role",
  "message_id",
  "requires_response",
  "response_to",
  "priority",
];

function newReport(target) {
  return { target, errors: [], warnings: [] };
}

function err(report, where, problem) {
  report.errors.push({ where, problem });
}

function warn(report, where, problem) {
  report.warnings.push({ where, problem });
}

function checkRole(report, where, field, value) {
  if (typeof value !== "string" || !ROLE_PATTERN.test(value)) {
    err(report, where, `${field} must match ${ROLE_PATTERN} (got ${JSON.stringify(value)})`);
    return;
  }
  if (!CORE_ROLES.has(value)) {
    warn(report, where, `${field} '${value}' is not a core role; expected an imported specialist id`);
  }
}

// --- RELAYLOOP_MESSAGE v1 text envelope ---------------------------------

function parseEnvelope(text) {
  const lines = text.split(/\r?\n/);
  const message = { fields: {}, sections: {} };
  const problems = [];

  let index = 0;
  while (index < lines.length && lines[index].trim() === "") {
    index += 1;
  }
  if ((lines[index] || "").trim() !== "RELAYLOOP_MESSAGE v1") {
    problems.push("first line must be exactly 'RELAYLOOP_MESSAGE v1'");
  } else {
    index += 1;
  }

  const trailing = lines.map((line) => line.trim()).filter((line) => line !== "");
  if (trailing[trailing.length - 1] !== "END_RELAYLOOP_MESSAGE") {
    problems.push("last line must be 'END_RELAYLOOP_MESSAGE'");
  }

  // Header: key: value pairs until the first blank line.
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") {
      break;
    }
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!match) {
      problems.push(`unrecognized header line: ${JSON.stringify(line.trim())}`);
      continue;
    }
    message.fields[match[1]] = match[2].trim();
  }

  // Sections: "Name:" markers followed by text/bullets.
  const sectionNames = ["Context", "Task", "Acceptance", "Return Format"];
  let current = null;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed === "END_RELAYLOOP_MESSAGE") {
      break;
    }
    const marker = sectionNames.find((name) => trimmed === `${name}:`);
    if (marker) {
      current = marker;
      message.sections[current] = [];
      continue;
    }
    if (current && trimmed !== "") {
      message.sections[current].push(trimmed.replace(/^-\s*/, ""));
    }
  }

  return { message, problems };
}

function normalizeEnvelope(text) {
  const { message, problems } = parseEnvelope(text);
  const normalized = {
    protocol: "RELAYLOOP_MESSAGE v1",
    ...message.fields,
  };
  if (message.sections.Context) {
    normalized.context = message.sections.Context.join("\n");
  }
  if (message.sections.Task) {
    normalized.task = message.sections.Task.join("\n");
  }
  if (message.sections.Acceptance) {
    normalized.acceptance = message.sections.Acceptance;
  }
  if (message.sections["Return Format"]) {
    normalized.return_format = message.sections["Return Format"];
  }
  return { normalized, problems };
}

function validateMessageObject(normalized, report, where = "message") {
  if (normalized.protocol !== "RELAYLOOP_MESSAGE v1") {
    err(report, where, `protocol must be 'RELAYLOOP_MESSAGE v1' (got ${JSON.stringify(normalized.protocol)})`);
  }
  for (const field of ENVELOPE_HEADER_FIELDS) {
    const value = normalized[field];
    if (typeof value !== "string" || value.trim() === "") {
      err(report, where, `missing required header field '${field}'`);
    }
  }
  if (normalized.mode !== undefined && !MODES.has(normalized.mode)) {
    err(report, where, `mode must be one of task|goal|review (got ${JSON.stringify(normalized.mode)})`);
  }
  if (normalized.priority !== undefined && !PRIORITIES.has(normalized.priority)) {
    err(report, where, `priority must be one of low|normal|high|urgent (got ${JSON.stringify(normalized.priority)})`);
  }
  if (normalized.requires_response !== undefined && !REQUIRES_RESPONSE.has(normalized.requires_response)) {
    err(report, where, `requires_response must be yes|no (got ${JSON.stringify(normalized.requires_response)})`);
  }
  if (normalized.from_role !== undefined) {
    checkRole(report, where, "from_role", normalized.from_role);
  }
  if (normalized.to_role !== undefined) {
    checkRole(report, where, "to_role", normalized.to_role);
  }
  if (typeof normalized.task !== "string" || normalized.task.trim() === "") {
    err(report, where, "missing Task section: every dispatch must state the concrete request");
  }
  if (!Array.isArray(normalized.acceptance) || normalized.acceptance.length === 0) {
    err(report, where, "missing Acceptance section: RelayLoop is proof-gated, every dispatch must define acceptance criteria");
  }
  if (!Array.isArray(normalized.return_format) || normalized.return_format.length === 0) {
    warn(report, where, "no Return Format section; replies may omit Result/Evidence fields");
  }
}

function validateEnvelopeText(text, target = "envelope") {
  const report = newReport(target);
  const { normalized, problems } = normalizeEnvelope(text);
  for (const problem of problems) {
    err(report, target, problem);
  }
  validateMessageObject(normalized, report, target);
  return report;
}

// --- NDJSON logs ----------------------------------------------------------

function validateEvent(event, report, where, expectedType) {
  if (typeof event !== "object" || event === null || Array.isArray(event)) {
    err(report, where, "event must be a JSON object");
    return;
  }
  if (event.schema === undefined) {
    warn(report, where, "missing 'schema' field (expected relayloop.event.v1)");
  } else if (event.schema !== "relayloop.event.v1") {
    warn(report, where, `unknown event schema ${JSON.stringify(event.schema)}`);
  }
  if (event.eventType !== expectedType) {
    err(report, where, `eventType must be '${expectedType}' in this file (got ${JSON.stringify(event.eventType)})`);
  }
  for (const field of ["actor", "summary"]) {
    if (typeof event[field] !== "string" || event[field].trim() === "") {
      err(report, where, `missing required field '${field}'`);
    }
  }
  if (typeof event.timestamp !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(event.timestamp)) {
    warn(report, where, "timestamp missing or not ISO-8601");
  }
  if (event.mode !== undefined && !MODES.has(event.mode)) {
    err(report, where, `mode must be one of task|goal|review (got ${JSON.stringify(event.mode)})`);
  }
  if (event.result !== undefined) {
    if (!RESULTS.has(event.result)) {
      err(report, where, `result must be one of pass|fail|blocked (got ${JSON.stringify(event.result)})`);
    } else if (event.result === "pass" && expectedType === "message") {
      const evidence = event.evidence;
      const hasEvidence =
        (typeof evidence === "string" && evidence.trim() !== "") ||
        (Array.isArray(evidence) && evidence.length > 0);
      if (!hasEvidence) {
        err(report, where, "proof gate: a 'pass' result must include non-empty 'evidence'");
      }
    }
  }
}

function validateNdjsonFile(filePath, expectedType, report) {
  const name = path.basename(filePath);
  if (!fs.existsSync(filePath)) {
    warn(report, name, "file does not exist (run the initializer to create it)");
    return;
  }
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  lines.forEach((line, lineIndex) => {
    if (line.trim() === "") {
      return;
    }
    const where = `${name}:${lineIndex + 1}`;
    let event;
    try {
      event = JSON.parse(line);
    } catch (error) {
      err(report, where, `invalid JSON: ${error.message}`);
      return;
    }
    validateEvent(event, report, where, expectedType);
  });
}

// --- agents.json ----------------------------------------------------------

function validateAgentsJson(filePath, report) {
  const name = path.basename(filePath);
  if (!fs.existsSync(filePath)) {
    err(report, name, "file does not exist");
    return;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    err(report, name, `invalid JSON: ${error.message}`);
    return;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    err(report, name, "expected a JSON object");
    return;
  }
  if (data.schema !== "relayloop.agents.v1") {
    err(report, name, `schema must be 'relayloop.agents.v1' (got ${JSON.stringify(data.schema)})`);
  }
  const project = data.project;
  if (typeof project !== "object" || project === null) {
    err(report, name, "missing 'project' object");
  } else {
    for (const field of ["name", "projectPath", "projectId", "createdAt"]) {
      if (typeof project[field] !== "string" || project[field].trim() === "") {
        err(report, name, `project.${field} is required`);
      }
    }
    if (project.adapter !== undefined && !ADAPTERS.has(project.adapter)) {
      err(report, name, `project.adapter must be one of codex|claude-code (got ${JSON.stringify(project.adapter)})`);
    }
  }
  const agents = data.agents;
  if (!Array.isArray(agents) || agents.length === 0) {
    err(report, name, "'agents' must be a non-empty array");
    return;
  }
  let hasPm = false;
  agents.forEach((agent, agentIndex) => {
    const where = `${name}:agents[${agentIndex}]`;
    if (typeof agent !== "object" || agent === null) {
      err(report, where, "agent entry must be an object");
      return;
    }
    if (agent.role === "pm") {
      hasPm = true;
    }
    checkRole(report, where, "role", agent.role);
    for (const field of ["name", "status", "profilePath"]) {
      if (typeof agent[field] !== "string" || agent[field].trim() === "") {
        err(report, where, `missing required field '${field}'`);
      }
    }
    if (!WORKSPACE_MODES.has(agent.workspaceMode)) {
      err(report, where, `workspaceMode must be one of coordinator|worktree|readonly (got ${JSON.stringify(agent.workspaceMode)})`);
    }
  });
  if (!hasPm) {
    err(report, name, "no PM agent registered: RelayLoop is PM-led, a 'pm' role entry is required");
  }
}

// --- progress.md ----------------------------------------------------------

function validateProgressMd(filePath, report) {
  const name = path.basename(filePath);
  if (!fs.existsSync(filePath)) {
    err(report, name, "file does not exist: the PM-maintained progress file is the single source of truth");
    return;
  }
  const text = fs.readFileSync(filePath, "utf8");
  for (const heading of ["## State", "## Loop", "## Agents", "## Next Action"]) {
    if (!text.includes(heading)) {
      err(report, name, `missing required section '${heading}'`);
    }
  }
  if (!text.includes("## Blockers")) {
    warn(report, name, "missing '## Blockers' section");
  }
  const stateMatch = text.match(/## State\s*\n+([^\n#]+)/);
  if (stateMatch) {
    const state = stateMatch[1].trim();
    if (!PROGRESS_STATES.has(state)) {
      warn(report, name, `state '${state}' is not a standard loop state (${[...PROGRESS_STATES].join(", ")})`);
    }
  }
}

// --- workspace ------------------------------------------------------------

function validateWorkspace(dir) {
  const report = newReport(dir);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    err(report, dir, "RelayLoop workspace directory does not exist");
    return report;
  }
  validateAgentsJson(path.join(dir, "agents.json"), report);
  validateProgressMd(path.join(dir, "progress.md"), report);
  for (const [fileName, expectedType] of Object.entries(EVENT_FILES)) {
    validateNdjsonFile(path.join(dir, fileName), expectedType, report);
  }
  return report;
}

module.exports = {
  normalizeEnvelope,
  validateEnvelopeText,
  validateMessageObject,
  validateWorkspace,
  newReport,
};
