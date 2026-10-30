---
name: world-vault
description: Search, create, correct, and validate entity/event files in a World Building Framework world via the `wbf` CLI, and answer questions about the world with sources. Use whenever the user wants to look up, add, change, or ask about world-building content (characters, locations, events, factions, ...) in this repo.
---

# World Vault authoring

This repo is a world built with the World Building Framework. Its content is a vault of entity/event Markdown files, named by UUID, next to a `world.config.json`. You read and write it through the `wbf` command-line tool, which prints JSON.

**Never hand-write or hand-edit a vault file.** Only `wbf create` and `wbf update` validate content before it touches disk, and only `create` generates the required UUID filename.

Run every command from the repo root as `npx wbf <command>`. That runs the framework version installed in this repo. If it reports "No vault specified", you're not in the folder that holds `world.config.json`: change into it, or pass `--vault <path>`.

Commands that take JSON input read it from stdin, or from a file with `--input <file>`. Use a file when piping is awkward in your shell.

## 1. Check the current schema before writing anything

```
npx wbf schema
```

This prints the framework's fixed fields with their shapes, this world's entity types from `world.config.json`, and example inputs. Run it whenever you're unsure which fields are valid.

**Entity types must be declared before they're used.** An entity's `entityType` can only be one of the types in `entityTypes` in `world.config.json`. A new world declares none, so `schema` says so and `create` rejects any `entityType`. When the world has no types yet, or none that fits what the user wants to add:
- Suggest types that fit their world (e.g. `character`, `location`, `faction`, or `ship`, `deity`, …) and ask the user.
- Once they agree, add them to `entityTypes` in `world.config.json`. That's a plain JSON file, not a vault file, so you edit it directly.
- Don't invent a new type silently, and don't drop `entityType` just to get past the check.

## 2. Search before creating

Search for what already exists before adding anything. That avoids duplicating an entity, and gives you the UUIDs you need to link to things:

```
npx wbf search <query terms...>
```

Each result has an `id` (the UUID you link with), `title` and `score`, and for entities `entityType` and `tags`. Add `--tags a,b` to require specific tags, and `--limit N` to cap the results.

To read a file, use `read` rather than opening `<uuid>.md` yourself:

```
npx wbf read --id <uuid>
```

Besides the file's `frontmatter` and `body`, it returns `linkedFrom`: every file linking to this one, grouped by the field the link sits in (`entities`, `home`, `supersedes`, …), and `body` for files mentioning it in their text. The file itself only shows its own links; `linkedFrom` is the other direction. Before changing something, use it to judge which of those files the change affects, and open only those. You decide what's relevant: a small change to a character rarely touches the place they live in.

## 3. Writing links

Every relation, in frontmatter or in body text, uses this link form: the target's UUID before the pipe, and its current title after it.

```
[[3af2c9d1-8b4e-4c6a-91f0-2d5e7a9b1c33|Port Kavas]]
```

Get the UUID from a search result's `id`, or from the `id` a `create` call just returned. Never write a bare `[[Display Name]]`. The vault only resolves links by UUID.

## 4. Plan, report, then write after the OK

No tool here enforces an approval step, so that's your job. For every request that writes something:

1. **Work out the whole change first**, without writing anything: what has to change, which other files it affects (check `linkedFrom` with `read`), and whether each change is a correction (`update`) or a change in the story (a new version, section 8). Validate the new or changed files (section 5) so you know they'll go through.
2. **Report the plan in plain words**, for all files at once: what you'll create or change, and why. For example: "New version of Alea Marrow (now harbour-master, caused by the new event); new event 'Alea becomes harbour-master', after 'The burning of the harbour'; Port Kavas stays as it is." Don't paste full frontmatter and bodies unless the user asks for them.
3. **Wait for the user's OK.** If they change the plan, report the new plan.
4. **Write everything** with `create` and `update`, in an order where every link points at a file that already exists.
5. **Report what was written**: the new ids, and any warnings. If a write fails, say which and stop, so the user knows what's done and what isn't.

## 5. Validate before (or instead of) creating

To check a candidate without writing it:

```
echo '{"frontmatter": {"type": "entity", "title": "Alea Vantorr", "entityType": "character"}}' | npx wbf validate --input -
```

Each issue has a `severity`:
- Fix every `"error"` (schema problems, dangling links, wrong link targets) before calling `create`.
- A `"warning"` (e.g. an event with no `entities` yet) doesn't block anything. Mention it to the user, but it's fine to proceed.

`create` runs these same checks, so `valid: true` here means `create` will succeed.

## 6. Creating a file

```
echo '{"frontmatter": {...}, "body": "..."}' | npx wbf create
```

- **Required fields:** `type` and `title`. Everything else depends on whether it's an entity or an event; see `npx wbf schema`.
- **On success** it prints `{"written": true, "id": "...", "path": "..."}`, plus an `issues` list if there were warnings. Tell the user the new `id`, since anything that links to this file needs that UUID.
- **If any link points at an id that doesn't exist**, nothing is written, and the error is reported instead.

## 7. Correcting an existing file

For a **correction** (a typo, a wrong tag, a missing link, badly written text), replace the file in place:

```
echo '{"frontmatter": {...}, "body": "..."}' | npx wbf update --id <uuid>
```

- **Send the complete content.** The input is the file's whole new content, not just the changed fields. Read the current file (`npx wbf read --id <uuid>`) first, change what needs changing, and send all of it (`frontmatter` and `body`, not `linkedFrom`). Any field you leave out is removed.
- **Same checks as `create`**, and `type` can't change.
- **Include it in your plan** (section 4) before calling it, as with `create`.

Changing a `title` also changes **other files**:
- Every link elsewhere written as `[[<uuid>|<old title>]]` is rewritten to show the new title.
- Links with different display text, like `[[<uuid>|the old harbour]]`, are left alone.
- When proposing a rename, tell the user other files will be updated too. Search the vault for `[[<uuid>|<old title>]]` to say which ones.
- The result lists them under `relinked`. Any file under `relinkFailed` is already invalid on its own and kept the old name; report it to the user.

`update` is only for things that were wrong. If something changed **in the story**, use section 8 instead.

## 8. Recording a change to an existing entity: never edit it in place

When an event changes something about an entity (it looks different, its status changed, and so on), that's **not** an edit to the existing file. Create a **new** entity file with these two fields:
- `supersedes`: a link to the entity's current file. That's its **latest** version, not the anchor, unless the anchor is the only version so far. A "Fork in the version chain" warning almost always means you pointed at an older version. Tell the user and fix it with `update`, unless they deliberately want a story branch.
- `causedBy`: a link to the event that caused the change.

Both fields are required together. The vault keeps every version, and the published wiki shows the whole history. Never overwrite an entity file's body to reflect an in-world change; that erases history the vault is designed to keep.

Other files always link to an entity's **original, first-ever** file (its anchor), never to a later version. If you're not sure which id is the anchor, follow the file's `supersedes` chain back. Or reuse whatever id you already have for that entity: that's always the anchor once created.

## 9. Secrets: each wiki shows whole files

A world can publish several wikis (build variants in `world.config.json`, e.g. a player wiki and a GM wiki). They filter by **file**, using its `tags` and, for events, its date. Everything inside a file that's included is shown, body text and all.

- Before writing, check which wikis the file will appear in: compare its `tags` with each variant's `tags` in `world.config.json`.
- Keep anything meant for fewer readers (a GM secret, a later plot twist) out of files the wider audience sees. Put it in its own file with narrower tags, and link to it from there.
- A link to a file a wiki leaves out turns into plain text, so its title still shows. Give secret files titles that don't give the secret away.

## 10. Answering questions about the world

(For timeline pages, use the world-timelines skill.)

When the user asks about the world ("Who leads the Tidewardens?", "What happened in Port Kavas after the storm?"), answer from the files, not from memory or invention:

1. **Find** the starting files with `npx wbf search`.
2. **Read** them with `npx wbf read --id <uuid>`, and follow the links that matter for the question: the file's own links, and `linkedFrom` for the other direction (the events an entity appears in, who has it as `leader`, its later versions). You decide which ones are relevant.
3. **Answer with sources:** name the file each statement comes from (its title and id), so the user can check it.

Rules:
- **Only what the files say.** If the world doesn't establish something, say so ("not established in this world") instead of filling the gap. You may suggest ideas, but mark them clearly as suggestions, never as fact.
- **Time and versions.** An entity can change over time through versions (section 8). Say which point in time your answer is about, e.g. "before the burning of the harbour (year 151) Port Kavas was built on stilts; afterwards it was rebuilt in stone".
- **The audience.** For "what do the players know?" or anything meant for one wiki, use only files that wiki includes: check its tags and date range in `world.config.json` (each entry under `buildVariants`). Leave out everything else, so you don't give away a secret.
