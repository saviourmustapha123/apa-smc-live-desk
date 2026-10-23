const UPSTREAM = "https://fapi.binance.com";
const ALLOWED_INTERVALS = new Set([
  "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h",
  "1d", "3d", "1w", "1M"
]);

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extra
  };
}

function response(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: corsHeaders(headers) });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return response(null, 204);
    if (request.method !== "GET") return response("Method not allowed", 405);

    const incoming = new URL(request.url);
    const allowedPaths = new Set([
      "/fapi/v1/ticker/price",
      "/fapi/v1/klines"
    ]);
    if (!allowedPaths.has(incoming.pathname)) {
      return response("Endpoint not allowed", 404);
    }

    if (incoming.searchParams.get("symbol") !== "QQQUSDT") {
      return response("Only QQQUSDT is enabled on this public data proxy", 400);
    }

    if (incoming.pathname.endsWith("/klines")) {
      const interval = incoming.searchParams.get("interval") || "1m";
      if (!ALLOWED_INTERVALS.has(interval)) {
        return response("Unsupported candle interval", 400);
      }
      const limit = Number(incoming.searchParams.get("limit") || "500");
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
        return response("limit must be an integer from 1 to 1000", 400);
      }
      for (const key of ["startTime", "endTime"]) {
        if (incoming.searchParams.has(key)) {
          const value = Number(incoming.searchParams.get(key));
          if (!Number.isSafeInteger(value) || value < 0) {
            return response(key + " must be a non-negative millisecond timestamp", 400);
          }
        }
      }
    } else if ([...incoming.searchParams.keys()].some(k => k !== "symbol")) {
      return response("Unsupported query parameter", 400);
    }

    const upstreamUrl = new URL(incoming.pathname + incoming.search, UPSTREAM);
    try {
      const upstream = await fetch(upstreamUrl.toString(), {
        method: "GET",
        headers: { "Accept": "application/json" },
        redirect: "error"
      });
      const body = await upstream.text();
      return response(body, upstream.status, {
        "Content-Type": upstream.headers.get("content-type") || "application/json"
      });
    } catch {
      return response(JSON.stringify({
        code: "UPSTREAM_UNAVAILABLE",
        message: "The proxy could not reach Binance USDⓈ-M Futures. This does not represent live market data."
      }), 502, { "Content-Type": "application/json" });
    }
  }
};
