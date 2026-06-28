import type { ArchRole } from "@/types/contract";

/**
 * 模块角色推断（确定性，无 key 也可用）。
 * 先按目录名匹配（最可靠），名字不认识再看文件扩展名分布兜底。
 * 角色决定模块落在哪一层：interface（对外）→ logic（核心）→ data（存储）→ shared（公用）→ other。
 */

const ROLE_BY_NAME: Record<string, ArchRole> = {
  // interface — 系统对外的边界：界面 / 路由 / 接口
  components: "interface", component: "interface", ui: "interface",
  pages: "interface", page: "interface", views: "interface", view: "interface",
  screens: "interface", app: "interface", web: "interface", frontend: "interface",
  client: "interface", routes: "interface", route: "interface", api: "interface",
  server: "interface", http: "interface", controllers: "interface",
  controller: "interface", handlers: "interface", endpoints: "interface",
  graphql: "interface", rest: "interface", router: "interface",
  // logic — 核心规则与决策
  src: "logic", source: "logic", services: "logic", service: "logic",
  core: "logic", domain: "logic", lib: "logic", libs: "logic",
  packages: "logic", pkg: "logic", engine: "logic", business: "logic",
  logic: "logic", usecases: "logic", features: "logic", feature: "logic",
  agent: "logic", agents: "logic", workers: "logic", worker: "logic",
  jobs: "logic", processors: "logic", store: "logic", stores: "logic",
  state: "logic", hooks: "logic", commands: "logic", actions: "logic",
  // data — 存与取
  db: "data", database: "data", models: "data", model: "data",
  schema: "data", schemas: "data", prisma: "data", repositories: "data",
  repository: "data", dao: "data", entities: "data", migrations: "data",
  data: "data", sql: "data",
  // shared — 到处复用的工具/配置
  utils: "shared", util: "shared", helpers: "shared", helper: "shared",
  shared: "shared", common: "shared", config: "shared", configs: "shared",
  constants: "shared", types: "shared", type: "shared", styles: "shared",
  assets: "shared", theme: "shared", i18n: "shared", locales: "shared",
  // other — 测试 / 文档 / 脚本 / 静态
  tests: "other", test: "other", __tests__: "other", spec: "other",
  e2e: "other", docs: "other", doc: "other", scripts: "other",
  examples: "other", example: "other", public: "other", static: "other",
};

const INTERFACE_EXT = new Set(["tsx", "jsx", "vue", "svelte", "html", "css", "scss", "sass"]);
const DATA_EXT = new Set(["sql", "prisma"]);
const CODE_EXT = new Set(["ts", "js", "mjs", "cjs", "py", "go", "rs", "java", "rb", "c", "cc", "cpp", "h"]);
const DOC_EXT = new Set(["md", "mdx", "txt", "rst"]);

function extOf(rel: string): string {
  return rel.split(".").pop()?.toLowerCase() ?? "";
}

/** 名字优先；不认识再按文件扩展名的多数派兜底。 */
export function inferRole(moduleName: string, relPaths: string[]): ArchRole {
  const named = ROLE_BY_NAME[moduleName.toLowerCase()];
  if (named) return named;

  const tally: Record<ArchRole, number> = { interface: 0, logic: 0, data: 0, shared: 0, other: 0 };
  for (const p of relPaths) {
    const e = extOf(p);
    if (INTERFACE_EXT.has(e)) tally.interface++;
    else if (DATA_EXT.has(e)) tally.data++;
    else if (CODE_EXT.has(e)) tally.logic++;
    else if (DOC_EXT.has(e)) tally.other++;
    else tally.shared++;
  }
  const best = (Object.entries(tally) as [ArchRole, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])[0];
  return best?.[0] ?? "other";
}
