import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
