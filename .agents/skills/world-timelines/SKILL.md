---
name: world-timelines
description: Create or change a timeline page for a World Building Framework world — a chronological list of events bounded by dates, tags, entities, or a start and end event — and check what it shows in each wiki. Use when the user wants a timeline, chronology, or "what happened when" page for part of their world.
---

# World timelines

A world's wikis can have timeline pages: the events of one part of the world, earliest first, with their dates and the entities involved. The user defines **which** events a timeline shows; the framework builds the page in every wiki on the next publish.

Two kinds exist:
- **Every entity page already has its own timeline** (the events it takes part in). Don't define one per character or place unless the user asks for a page of its own.
- **Named timelines** are defined in `world.config.json` under `timelines`. That's what this skill is for: a war, an era, a story arc, the history of one family.

Work as in the world-vault skill: plan the timeline, report it, wait for the user's OK, then write it.

## 1. Work out the boundaries

Ask yourself (or the user) what the timeline is about, and pick the boundaries that describe it. An event must pass **all** boundaries you give; leave out the ones you don't need.

| Boundary | Shows events that … | Example |
|---|---|---|
| `dateRange` | fall within these in-world dates | `{ "from": { "year": 148 }, "to": { "year": 152 } }` |
| `tags` | carry all of these tags | `["war"]` |
| `entities` | involve at least one of these entities (listed in the event's `entities`, or the cause of one of their versions) | `["[[<uuid>|Alea Marrow]]"]` |
| `from` | come at or after this event, along the `after` links | `"[[<uuid>|The founding]]"` |
| `to` | come at or before this event, along the `after` links | `"[[<uuid>|The burning]]"` |

Plus:
- `title`: the page's title. Without it, the name is used.
- `wikis`: the build variants that show this timeline. Leave it out to show it in every wiki that has some of its events.

Things to know:
- **Undated events:** `dateRange` places them by their `after` links and leaves one out whenever it *could* fall outside the range. If a timeline should include undated events, bound it with `from`/`to` instead, or suggest dating the events.
- **Entities and events are links**, `[[<uuid>|<title>]]`, never bare names. Get the ids with `npx wbf search`, and use `npx wbf read --id <uuid>` (its `linkedFrom`) to see which events an entity takes part in.
- **Secrets:** a timeline only shows events and entities a wiki includes, but its **title** shows in every wiki that has any of its events. If the title or the topic gives something away, limit it with `wikis` (e.g. `["gm-wiki"]`).
- Keep timelines focused. A timeline of everything is rarely useful in a large world; the start page already lists all events.

## 2. Write the definition

The name (the key) becomes the page's address, `timelines/<name>`, so use short lowercase words with hyphens. Add it to `world.config.json`, which is a plain JSON file you edit directly (it's not a vault file):

```json
"timelines": {
  "harbour-war": {
    "title": "The Harbour War",
    "from": "[[<uuid>|The Great Storm]]",
    "to": "[[<uuid>|The burning of the harbour]]",
    "tags": ["war"]
  }
}
```

A misspelled key (e.g. `entitys`) is an error, not ignored.

## 3. Check it

```
npx wbf timelines --name harbour-war
npx wbf timelines --name harbour-war --variant player-wiki
```

It prints the events the timeline picks, earliest first, and any `problems` (a link to a file that doesn't exist or is the wrong kind, an unknown wiki name). With `--variant`, it shows only what that wiki would show. A timeline with problems stops the next publish, so fix every problem.

Check the result against what the user wanted: missing events (undated ones left out by `dateRange`? missing tags?) or extra ones mean the boundaries need adjusting.

## 4. Report

Tell the user the timeline's title, which events it shows (in each wiki, if they differ), and which wikis show it. The page appears on the next publish.

## Without a terminal (MCP)

The `timelines` tool does what `wbf timelines` does. No tool edits `world.config.json`, so give the user the exact JSON to add, then check it with `timelines` once they have.
