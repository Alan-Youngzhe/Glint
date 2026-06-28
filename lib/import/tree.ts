import type { TreeNode } from "@/types/contract";

/** 把扁平的 relPath 列表组装成嵌套 TreeNode（目录在前、字母序）。 */
export function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { id: "root", name: "", path: "", kind: "dir", children: [] };

  for (const rel of paths) {
    const segs = rel.split("/");
    let cur = root;
    let acc = "";
    segs.forEach((seg, i) => {
      acc = acc ? `${acc}/${seg}` : seg;
      const isFile = i === segs.length - 1;
      cur.children ??= [];
      let next = cur.children.find((c) => c.name === seg);
      if (!next) {
        next = {
          id: acc,
          name: seg,
          path: acc,
          kind: isFile ? "file" : "dir",
          ...(isFile ? {} : { children: [] }),
        };
        cur.children.push(next);
      }
      cur = next;
    });
  }

  sortTree(root);
  return root;
}

function sortTree(node: TreeNode) {
  if (!node.children) return;
  node.children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  node.children.forEach(sortTree);
}
