# QQQUSDT regional data proxy

The GitHub Pages app runs in the visitor's browser. It cannot bypass a Binance HTTP 451 regional restriction on its own. This Cloudflare Worker provides a small, read-only CORS proxy for the public Binance USDⓈ-M Futures endpoints needed by the app.

## Deploy once

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Create a Worker, for example `apa-qqqusdt-feed`.
3. Open the repository file [`proxy/qqqusdt-worker.js`](./qqqusdt-worker.js), copy its complete contents, and paste them into the Worker editor.
4. Deploy the Worker and copy its HTTPS URL, for example `https://apa-qqqusdt-feed.YOUR-SUBDOMAIN.workers.dev`.
5. Open the APA SMC Live Desk website, go to **Settings**, paste that URL into **QQQUSDT Binance data proxy**, and select **Save & reconnect**.
6. Select QQQUSDT and use **Settings → Test feed**. The test must return a live price and candles before trusting the feed.

The Worker allows only GET requests to the QQQUSDT ticker and kline endpoints, validates the requested interval and limits, contains no API keys, and does not place trades. It forwards upstream errors instead of manufacturing prices. If Cloudflare's outbound request also receives a Binance regional restriction, this proxy will not solve it; a market-data provider with permitted QQQUSDT perpetual coverage would then be required.

## Important

- This is a read-only public market-data proxy, not a trading endpoint.
- The app still requires internet access to the Worker, Binance and the chart library.
- Do not enter passwords, API keys or trading credentials into the Worker or website.
- Deploying the Worker is a separate step because it requires access to a Cloudflare account. The repository cannot deploy into your account automatically.
