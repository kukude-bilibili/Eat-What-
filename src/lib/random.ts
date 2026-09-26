/**
 * 加密安全随机数工具。
 * 转盘选菜、洗牌、撒花等所有随机场景统一走这里：
 * CSPRNG（crypto.getRandomValues）+ 拒绝采样消除模偏差。
 * 能运行本应用的浏览器（ES2022+）均支持 Web Crypto，无降级路径。
 */

export function secureInt(n: number): number {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError(`n 必须为正整数，收到 ${n}`)
  // 2^32 不能被 n 整除时有模偏差：只接受 [0, limit) 的均匀区间
  const limit = Math.floor(0x100000000 / n) * n
  const buf = new Uint32Array(1)
  do {
    globalThis.crypto.getRandomValues(buf)
  } while (buf[0] >= limit)
  return buf[0] % n
}

/** 加密安全随机浮点数 [0, 1) */
export function secureFloat(): number {
  const buf = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buf)
  return buf[0] / 0x100000000
}

/** Fisher–Yates 洗牌（secureInt 驱动），返回新数组不改动原数组 */
export function secureShuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = secureInt(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
