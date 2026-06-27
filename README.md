# Dylan Team Loop

Codex skill for PM-led multi-agent project loops.

## What It Does

Dylan talks to a PM Agent. The PM Agent coordinates Dev, Test, Review, Version, Research, UX, and optional FW Agents through `TEAMLOOP_MESSAGE v1`, records thread IDs and logs, and can run automatic Dev -> Review/Test -> Dev -> Version loops after Dylan approves the plan.

## Install Locally

```bash
mkdir -p ~/.codex/skills/dylan-team-loop
rsync -a ./ ~/.codex/skills/dylan-team-loop/
```

## Initialize A Project

```bash
python3 ~/.codex/skills/dylan-team-loop/scripts/init_team_loop.py \
  --project-name ExampleProject \
  --project-path /path/to/project
```

For firmware, embedded, or hardware projects:

```bash
python3 ~/.codex/skills/dylan-team-loop/scripts/init_team_loop.py \
  --project-name ExampleFirmware \
  --project-path /path/to/project \
  --project-type firmware
```

