import type { TreemapNode } from "@/types/contract";

/**
 * ⌥4 分层下钻的确定性规则（借鉴 codeboarding planner_agent.should_expand_component
 * + agent_responses.assign_component_ids 的 dotted 编号，用 TS 重写，零 LLM）。
 * 无 cluster 时退化为按目录树下钻——对 MVP 足够。
 */

/** 能否继续下钻：目录且有子项才可展开；文件是叶子（点开即打开）。 */
export function shouldExpand(node: TreemapNode): boolean {
  return node.kind === "dir" && !!node.children && node.children.length > 0;
}

/** 沿 name 路径取节点（path 段为各级 name）。 */
export function nodeAtPath(root: TreemapNode, path: string[]): TreemapNode | undefined {
  let n: TreemapNode = root;
  for (const seg of path) {
    const child = n.children?.find((c) => c.name === seg);
    if (!child) return undefined;
    n = child;
  }
  return n;
}

/** path 处节点的 dotted 地址（codeboarding 风格：1 → 1.2 → 1.2.1）。root 自身为空串。 */
export function dottedAddress(root: TreemapNode, path: string[]): string {
  let node = root;
  const parts: string[] = [];
  for (const seg of path) {
    const children = node.children ?? [];
    const idx = children.findIndex((c) => c.name === seg);
    if (idx < 0) break;
    parts.push(String(idx + 1));
    node = children[idx];
  }
  return parts.join(".");
}
