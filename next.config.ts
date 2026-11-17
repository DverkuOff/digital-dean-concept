import type { NextConfig } from "next";

// cacheComponents выключен осознанно: почти все страницы персональные (сессия),
// классический динамический рендеринг проще и прозрачнее для проверки доступа.
// См. docs/decisions.md, 2026-11-17.
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@node-rs/argon2"],
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
