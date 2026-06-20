import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 仓库根下还有一个家目录 lockfile，显式锁定 tracing root 避免误判 workspace。
  outputFileTracingRoot: __dirname,
  // tree-sitter WASM 运行时不参与打包，运行时按路径加载 .wasm。
  serverExternalPackages: ["web-tree-sitter"],
};

export default nextConfig;
