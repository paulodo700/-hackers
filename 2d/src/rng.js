// Gerador pseudoaleatório determinístico (Mulberry32): mesma semente, mesma sequência.
// next.state() devolve o estado interno. Recriar com mulberry32(estado) continua a sequência de onde parou,
// e é assim que o salvamento retoma os combates exatamente como estavam.
export function mulberry32(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.state = () => a;
  return next;
}
