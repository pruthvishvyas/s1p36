# s1p36

An interactive dashboard for the analysis in `../backend/output`: key numbers and charts, findings and recommendations, a what-if tool, a forecast, a Predict page, goal progress, alerts, a filterable explorer, a built-in guide and a data health page.

## Run it locally

Node 22 or newer is required.

```
npm install
npm run check
npm run dev
```

Open http://localhost:5173. Every feature works locally with no Cloudflare account or login. `npm run dev:worker` runs the production runtime and security headers on http://localhost:8787.

Local settings go in `.dev.vars` (see `.dev.vars.example`). To try the MCP endpoint, set `MCP_MODE=open` in `.dev.vars`, restart, and run:

```
curl -X POST http://localhost:5173/mcp -H "content-type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Remote assistants cannot reach localhost, so connecting one requires the published address.

## Update after the backend is re-run

Run `npm run deploy`. It refreshes the data, checks it, builds and publishes.

## Publish

```
npx wrangler login
npm run deploy
```

Wrangler prints the address.

## Protecting the site

The data files are public to anyone who can open the site. For real client data, put the address behind a Cloudflare Access policy. Synthetic portfolio data can stay open.

## Optional MCP access

The `/mcp` route is read-only and controlled by `MCP_MODE` in `wrangler.toml`:

- `off` (default): the route answers 404.
- `token`: set a secret with `npx wrangler secret put MCP_TOKEN`; clients send `Authorization: Bearer <token>`.
- `open`: no token; suitable only for synthetic data.

## The data folder

`public/data` is a copy of `backend/output`, refreshed by `npm run check`, `npm run dev` and `npm run build`. `npm run check` reads every file the pages use, runs it through the same readers the pages use and reports OK, UNAVAILABLE, MISSING or INVALID for each, so problems show up before the site is published.

## Folder map

- `src/` the React app (components, hooks, utils, styles)
- `worker/index.js` the `/api` and `/mcp` routes
- `public/` static files and the data copy
- `scripts/` data refresh and data check
