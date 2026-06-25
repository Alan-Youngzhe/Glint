export class Box {
  private n = 0;
  add(x: number) {
    return this.helper(x); // this.helper → 本类方法（confidence 1.0）
  }
  helper(x: number) {
    return this.n + x;
  }
}
