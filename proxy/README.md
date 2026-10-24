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

The app routes Bybit requests through the Worker when a proxy URL is configured and routes Binance requests through it as well. The Worker validates the allowed paths, QQQUSDT symbol, category, intervals and limits. It contains no API keys and does not place trades. Upstream errors are forwarded rather than replaced with invented prices.

## Important

- This is a read-only public market-data proxy, not a trading endpoint.
- The app and Worker still require internet access.
- Do not enter passwords, API keys or trading credentials into the Worker or website.
- Deploying the Worker is separate from GitHub because it requires access to your Cloudflare account. The repository cannot deploy into that account automatically.
