# QQQUSDT market-data CORS proxy

The GitHub Pages app requests public exchange data directly from the visitor's browser. Some browsers, networks or regional routes can block these calls with a Network/CORS error. This Cloudflare Worker is a read-only proxy for the public QQQUSDT perpetual ticker and candle endpoints on **Bybit and Binance**.

## Deploy or update the Worker

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Create a Worker, or open the Worker you already deployed for APA SMC Live Desk.
3. Open [`proxy/qqqusdt-worker.js`](./qqqusdt-worker.js), copy its complete current contents, and paste them into the Cloudflare Worker editor.
4. **Deploy the updated Worker.** Updating this GitHub file alone does not update a Worker in your Cloudflare account.
5. Copy the Worker HTTPS URL, for example `https://apa-qqqusdt-feed.YOUR-SUBDOMAIN.workers.dev`.
6. Open the APA SMC Live Desk website, go to **Settings**, paste the URL into **QQQUSDT CORS proxy**, and select **Save & reconnect**.
7. Select QQQUSDT and use **Settings → Test feed**. The test must return a valid quote and candles before treating the feed as live.

The app routes Bybit requests through the Worker when a proxy URL is configured and routes Binance requests through it as well. The Worker validates the allowed paths, QQQUSDT symbol, category, intervals and limits. It contains no API keys and does not place trades. If the selected exchange route is unavailable, the updated Worker tries the other public exchange and converts the response into the requested API shape. It returns HTTP 502 with both upstream errors if neither route works; it never generates synthetic prices. Run `node --test scripts/qqqusdt-worker.test.mjs` to verify the fallback mappings locally in CI.

## Important

- This is a read-only public market-data proxy, not a trading endpoint.
- The app and Worker still require internet access.
- Do not enter passwords, API keys or trading credentials into the Worker or website.
- The Worker is a separate Cloudflare deployment. GitHub now has a deployment workflow, but it can deploy only when the repository has the required Cloudflare credentials configured.

## Enable automatic Worker deployment

1. In Cloudflare, create an API token with permission to edit Workers and note your Cloudflare account ID.
2. In this GitHub repository, open **Settings → Secrets and variables → Actions → Secrets**.
3. Add repository secrets named `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Never paste either value into source files or chat.
4. The workflow **Deploy QQQUSDT Cloudflare Worker** deploys `proxy/qqqusdt-worker.js` when that file changes. It also supports manual runs from **Actions**.
5. Verify the Worker endpoint and then run **APA SMC background health check**. A successful GitHub deployment alone is not proof that both upstream exchanges are reachable.

If you do not want to configure GitHub secrets, use the manual Cloudflare editor steps above after every Worker source change.

## Enable the same QQQUSDT feed in background GitHub Actions

The browser's saved proxy setting is local to that browser and is not visible to GitHub Actions. The production-history workflow defaults to the known Worker URL; you may override it for a different Worker:

1. Open **Settings → Secrets and variables → Actions → Variables**.
2. Create or update the repository variable `QQQ_PROXY_URL` with the Worker HTTPS URL. Do not include query parameters or credentials.
3. Run **APA SMC background paper trader** and **APA SMC production history backtest** from the Actions tab. Their reports will show whether exact QQQUSDT futures data is reachable.

The Worker proxies public market data only. It does not place orders. If the Worker cannot reach an exchange, the report marks QQQUSDT unavailable instead of substituting QQQ ETF prices as exact-contract data.
