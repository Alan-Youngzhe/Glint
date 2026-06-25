import { save } from "./store";
// 同名 save 在 store 和 cache 都有；import 应让 run 只连 store.save（confidence 1.0）
export function run() {
  return save(1);
}
