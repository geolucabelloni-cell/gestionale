import type { NextConfig } from "next";

/** Intestazioni di sicurezza su tutte le pagine. */
const SICUREZZA = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SICUREZZA }];
  },
  // font e logo usati per generare i PDF lato server
  outputFileTracingIncludes: {
    "/*": ["./assets/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      // per "Compila da documento" (foto/PDF di passaporto o permesso)
      bodySizeLimit: "12mb",
    },
    // il proxy (controllo login) bufferizza il body: deve accettare lo stesso limite
    proxyClientMaxBodySize: "15mb",
  },
};

export default nextConfig;
