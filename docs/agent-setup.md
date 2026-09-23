# Agent setup (Cloudflare, portable)

This guide is **agent-agnostic**. It works with Claude Code, OpenCode/OMP, Orca, Cursor, Windsurf, Codex, GitHub Copilot, and similar tools — not locked to any one host or plugin marketplace.

Use it whenever an AI agent works on this repo (local demo today; Workers lab in bài #2).

## Why agent-agnostic?

Cloudflare’s official tooling is skills + MCP servers that any capable agent can load. Host-specific plugins (e.g. Claude marketplace) are optional convenience only. Prefer the portable path so the same setup works across machines and agents.

## Official source of truth

Follow Cloudflare’s published prompt first; re-check it if anything below drifts:

**https://developers.cloudflare.com/agent-setup/prompt.md**

## Skills (all agents)

Install Cloudflare skills globally into `~/.agents/skills/`:

```bash
npx -y skills add cloudflare/skills --skill '*' --yes --global
```

Skills repo: https://github.com/cloudflare/skills

## MCP servers (official URLs)

Register these remote MCP endpoints in your agent’s config. OAuth usually triggers on first Cloudflare tool use (`cloudflare-docs` is public and needs no auth).

| Server | URL |
|--------|-----|
| cloudflare | `https://mcp.cloudflare.com/mcp` |
| cloudflare-docs | `https://docs.mcp.cloudflare.com/mcp` |
| cloudflare-bindings | `https://bindings.mcp.cloudflare.com/mcp` |
| cloudflare-builds | `https://builds.mcp.cloudflare.com/mcp` |
| cloudflare-observability | `https://observability.mcp.cloudflare.com/mcp` |

### Agent-specific config

Do **not** invent Cursor-only plugins as the primary path. Point each host at the official prompt for exact JSON / CLI snippets:

| Agent | Where to configure |
|-------|--------------------|
| Claude Code | Official prompt (plugin marketplace path optional) |
| OpenCode | `~/.config/opencode/opencode.jsonc` → `mcp` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` → `mcpServers` (`serverUrl`) |
| Cursor / Copilot / others | `.cursor/mcp.json`, `.vscode/mcp.json`, or your agent’s MCP file → `mcpServers` (`url`) |
| Codex | `codex mcp add …` (see prompt) |

After registering MCPs, restart the agent so servers load.

## Wrangler / Workers (later)

In-repo Wrangler and Workers deploy belong to **bài #2** (lab on Cloudflare Workers). This doc is only for any agent working on the repo today (local `npm run dev`, docs, tests).

## Lab domain (planned)

Live API demo (not GitHub Pages): **`https://lab.vovanduc.tech/stage-drop/`** on Workers. Pages at `https://vovanduc.github.io/stage-drop/` stays branch `/docs` static companion only.

## Related

- Repo README quickstart: [../README.md](../README.md)
- Cloudflare Drop (inspiration): https://www.cloudflare.com/drop/
- Drop llms.txt: https://www.cloudflare.com/drop/llms.txt
