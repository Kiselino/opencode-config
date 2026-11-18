---
name: opencode-config
description: Author and modify OpenCode config in this repository — opencode.jsonc, agents, skills, commands, permissions. Use when editing opencode.jsonc, adding or changing an agent, writing a skill or command, adjusting model routing/permissions, or the task mentions "opencode config", "agent prompt", "SKILL.md", "command", or "permission".
---

# OpenCode Config Authoring
For generic opencode config shapes, see the built-in `customize-opencode` skill;
this file only covers this repository's local conventions.

## Repository layout
| Path | Role |
| --- | --- |
| `opencode.jsonc` | Global config: permissions, plugins, commands, compaction |
| `AGENTS.md` | Global rules auto-loaded into every agent's context |
| `agents/<name>.md` | One custom agent per file (frontmatter + system prompt) |
| `skills/<name>/SKILL.md` | On-demand skills, auto-discovered from the config dir |
| `scripts/validate-jsonc.js` | JSONC syntax check — run it after every config edit |

A project may carry its own `.opencode/agents/` plus `opencode.jsonc`; those load
on top of this config and win on conflict (last-match-wins). `default_agent`,
`permissions` and `commands` are commonly overridden there.

## Hard constraints
- Do NOT pin a model unless the user explicitly asks: leave the top-level
  `model`/`small_model` and every per-agent `model` unset so OpenCode follows the
  model selected in the UI.
- Match the key shape this file already uses (v2-native, see below) instead of
  rewriting a block to the other spelling for style.

## Version reality (verified on this machine, 2026-09-22)
Only **opencode 2.0.14** runs here. It reads the **v2-native** spellings this
config uses — `permissions` (ordered array of `{action, resource, effect}`),
`plugins`, `attachments`, `commands`, `compaction.keep.tokens` /
`compaction.buffer` — and the classic spellings still work through the compat
layer. Confirmed live: `opencode debug agents` shows the global permission rules
merged into every agent's resolved ruleset, and `opencode api command.list`
returns the configured commands.

| Concern | v2-native (used here) | classic spelling (also accepted) |
| --- | --- | --- |
| Permissions | `permissions`: array of `{action, resource, effect}` | `permission`: map `action → {resource: effect}` |
| Plugins / attachments / commands | `plugins`, `attachments`, `commands` | `plugin`, `attachment`, `command` |
| Compaction | `keep.tokens`, `buffer` (+ `auto`, `prune`) | `preserve_recent_tokens`, `reserved`, `tail_turns` |
| Subagent nesting | `experimental.subagent_depth` (default 1) | top-level `subagent_depth` — write both only if a classic runtime also reads the file |
| Skill sources | `skills`: array of paths / URLs | `skills.paths` / `skills.urls` |

Gotchas that already cost us time:

- **Unknown keys are dropped silently.** A mistyped key yields a config that looks
  fine and does nothing. `opencode debug config` echoes each source document, but
  its `info` is the raw parse — it does not flag a bad key. There is no schema
  error to catch it, so verify behavior instead.
- **`bash` and `shell` are one action under two names.** Agent frontmatter `bash:`
  renders as `action: "shell"` in `opencode debug agents`, while a config array
  written as `"action": "bash"` keeps that spelling; the UI groups both as
  `execute`. Write both spellings when a rule must hold on either path.
- **`subagent_depth` defaults to 1** — subagents cannot spawn subagents unless the
  limit is raised deliberately.
- **`--standalone` does not load project config.** `opencode api <op>.list
  --standalone` in a project directory returns empty lists; that is not evidence
  that discovery failed. Use `opencode debug agents` (reads the cwd) for agents,
  and the connected service for globally configured commands.
- Agent and subagent `.md` files are discovered from the project's
  `.opencode/agents/` as well as the config dir's `agents/`; frontmatter
  `permission:` there uses the classic map form (`task`/`skill`/`edit`/`bash`
  keys) and is appended after the config-level rules.

## Agent frontmatter (`agents/<name>.md`)
| Key | Convention |
| --- | --- |
| `name` | kebab-case, matches filename |
| `description` | When to use this agent (drives routing + @-menu) |
| `mode` | `primary` \| `subagent` |
| `model` | omitted by default — OpenCode follows the UI-selected model; add only on explicit user request |
| `steps` | step budget; heavier agents get more |
| `color` | "#RRGGBB" |
| `hidden` | optional: hide from @-menu |
| `permission` | optional tool locks. Read-only agents must set `edit: deny`; shell-limited agents should deny `bash: "*"` first and then allow explicit commands (last-match-wins). |

- Each prompt references `AGENTS.md` (not restating it); do not embed model-tier notes in agent prompts.

## Skill file format (`skills/<name>/SKILL.md`)
- One folder per skill; file must be `SKILL.md` (uppercase).
- Frontmatter requires `name` (kebab-case, matches folder) and `description` stating **what** and **when**, front-loading trigger keywords.
- Names must be unique across all skill sources; check collisions before naming.
- A skill is loaded on demand and costs nothing until used; a skill that
  duplicates a document that is already the authority for a rule creates a second
  source that will drift. Keep skills to orchestration + pointers.

## Commands (`opencode.jsonc` → `commands`)
```jsonc
"commands": {
  "name": {
    "description": "Shown in the command menu",
    "agent": "<agent name>",
    "template": "Instruction sent as the user message."
  }
}
```

- `!`…`` shell expansion inside `template` is a classic-runtime feature; v2 does
  not port it (the installed build was not confirmed to expand it). Write
  templates as plain instructions that tell the agent which command to run
  instead of relying on injection.

## Permissions (`opencode.jsonc` → `permissions`)
- Ordered array, **last match wins** — put the catch-all `*` rule first and every
  specific rule after it.
- Default-allow, deny the dangerous: `read` denies for `.env*` and for credential
  directories (`local/secrets/**`, `**/secrets/**`, `*.pem`, `*.key`); `ask` on
  destructive shell (`rm *`, `sudo *`, `git reset --hard*`, `git push -f*`, …).
  Cover both Unix and Windows spellings so guards cannot be bypassed.
- A `deny` on `read` does not stop a CLI the agent shells out to from reading the
  same file — the guard is about what enters the model context.

## Before you finish
1. Re-read every changed file end-to-end.
2. `node scripts/validate-jsonc.js <file>…` — must print VALID for each file
   (this catches the JSONC syntax class of errors; it does not catch unknown keys).
3. Confirm behavior, not just syntax: `opencode debug agents` for agent/permission
   changes, `opencode api command.list` for commands, and a TUI invocation for
   anything user-facing.
4. Confirm no model was pinned and no new dependency/plugin slipped in without
   justification.
