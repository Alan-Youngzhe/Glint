// 不 import：裸 save() 解析不到来源，退回全局多同名 → 低置信(0.4)
export function ping() {
  return save(2);
}
