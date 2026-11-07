# Team setup: what to share, what never to share

Goal: three people build in parallel without waiting on each other. Each person has their
**own Atlassian site, own Forge environment and own API token**. The only shared things
are the GitHub repo, the Forge app registration, and one shared demo site for integration
and recording.

## What the owner shares

| Thing | How | Secret? |
|---|---|---|
| GitHub repo `dngvmnh/Codegeist-2026` | GitHub → Settings → Collaborators → add each teammate (Write) | No |
| Forge app (one app id) | developer.atlassian.com/console → Tether → **Contributors** → add each teammate's Atlassian email. Role: **Developer** for UI/engine, **Deployer** for whoever ships to production | No |
| App id | Committed in `manifest.yml` after `forge register` | No |
| Shared demo site `one-atlas-dscw.atlassian.net` | admin.atlassian.com → Users → invite teammates, make them **site admins** (needed to install apps) | No |
| Conventions: Jira project `PAY`, Confluence space `ENG`, label `tether-decision` | In the repo (`eval/`, `.env.example`) | No |

## What nobody shares

- **Atlassian API tokens.** Each person creates their own (id.atlassian.com → Security → API tokens) and runs `forge login` themselves.
- **`.env`.** Personal, only used by `npm run seed`. Gitignored.
- **Passwords**, and **Forge variables** such as `TETHER_EVAL_TOKEN` (each dev sets their own per environment).
- **LLM keys.** None exist: Tether uses Forge LLMs (Atlassian-hosted Claude), so there is no OpenAI/Anthropic key anywhere.

If a token is pasted in chat or committed, revoke it immediately at id.atlassian.com.

## Why your `forge install --demo-site` failed

`forge install` installs **an app**, so it must run in a folder that contains that app's
`manifest.yml`. You ran it in `SMU/` and in `Codegeist 2026/` (the parent of the empty
clone). Now that the repo has a manifest, run everything from the repo root after the app
is registered and deployed (below).

## Recommended local setup (WSL)

Forge CLI is installed in WSL. Working under `/mnt/c/...` is slow and file watching for
`forge tunnel` is unreliable there, so clone into the Linux filesystem:

```bash
mkdir -p ~/code && cd ~/code
git clone https://github.com/dngvmnh/Codegeist-2026.git && cd Codegeist-2026
nvm install 22 && nvm use 22     # runtime is nodejs22.x
npm install                      # also installs static/report
npm run check                    # typecheck + tests + eval + manifest + UI build
```

## One-time: app owner (repo owner, dngvmnh)

Only one person registers the app; their Atlassian account owns it (and is the only one who
can submit it to Marketplace or transfer it).

```bash
forge login                      # your own email + API token
forge register "Tether"          # rewrites app.id in manifest.yml
git commit -am "chore: register Forge app" && git push
npm run ui:build && forge deploy -e development
forge install -e development --demo-site --product jira
forge install -e development --demo-site --product confluence
```

Then add contributors (table above), and in the shared site create the `PAY` Jira project
and run `npm run seed` once (see below).

## One-time: every teammate

```bash
npm install -g @forge/cli && forge login        # your own token
forge site provision                             # YOUR free 90-day dev site (one per account)
git pull                                         # get the registered app.id
forge environments create                        # name it dev-<you>, e.g. dev-dat
npm run ui:build && forge deploy -e dev-<you>
forge install -e dev-<you> --site <your-site>.atlassian.net --product jira
forge install -e dev-<you> --site <your-site>.atlassian.net --product confluence
```

Seed your site with the demo decisions and tickets:

1. In Jira, create a project with key `PAY` (any template).
2. `cp .env.example .env` and fill in your site, email and token.
3. `npm run seed -- --dry-run`, then `npm run seed`.
4. In Jira → Apps → **Tether settings**, keep space `ENG`, label `tether-decision`.

## Daily loop

| Who | Fast loop | Forge loop |
|---|---|---|
| Engine | `npm run test:watch`, `npm run eval:offline` | deploy to `dev-<you>`, POST the eval web trigger (docs/EVAL.md) |
| Integration | unit tests with fake ports | `forge tunnel -e dev-<you>` + reload the issue |
| UI | `npm run ui:dev` → http://localhost:5174 (mock backend, scenario picker) | terminal 1 `npm run ui:tunnel`, terminal 2 `forge tunnel -e dev-<you>` |

Rules that keep everyone unblocked:

- **Only one tunnel per environment.** That is why everyone has their own `dev-<you>`.
- **Never deploy to `development` or `production` from a feature branch.** `development` is the shared integration env on the shared site (owner deploys from `main`).
- **Contracts first.** Anything in `src/contracts/` is a team decision: PR labelled `contract`, all three review, then `npm run fixtures`.
- **Branches:** `feat/<area>-<thing>`, small PRs, CI must be green. `main` is always deployable.
- **Manifest changes** (scopes, modules) change everyone's install: announce in chat, then everyone runs `forge deploy -e dev-<you>` and `forge install --upgrade`.
