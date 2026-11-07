// Geração de salas: área de jogo, obstáculos e ondas de inimigos conforme o passo do mapa.
(() => {
  const V = (window.V = window.V || {});
  const { R } = V.Util;

  const ARENA = { x0: 24, y0: 118, x1: 336, y1: 552 };
  const CENTER = { x: 180, y: 470 }; // ponto de entrada do jogador

  // Obstáculos bloqueantes (retângulos quadrados) sem sobreposição e longe do ponto de entrada.
  function makeObstacles(chapter, rng, count) {
    const out = [];
    let guard = 0;
    while (out.length < count && guard++ < 200) {
      const size = rng.int(40, 52);
      const x = rng.range(ARENA.x0 + 30, ARENA.x1 - 30 - size);
      const y = rng.range(ARENA.y0 + 30, ARENA.y1 - 30 - size);
      const cx = x + size / 2;
      const cy = y + size / 2;
      if (Math.hypot(cx - CENTER.x, cy - CENTER.y) < 110) continue;
      if (Math.hypot(cx - CENTER.x, cy - 150) < 90) continue; // deixa a entrada dos chefes aberta
      let ok = true;
      for (const o of out) {
        const ox = o.x + o.w / 2;
        const oy = o.y + o.h / 2;
        if (Math.abs(ox - cx) < (o.w + size) / 2 + 22 && Math.abs(oy - cy) < (o.h + size) / 2 + 22) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      out.push({ x, y, w: size, h: size, kind: rng.pick(chapter.obstacles) });
    }
    return out;
  }

  // Quantos obstáculos em cada tipo de sala.
  function obstacleCount(kind, rng) {
    if (kind === 'boss') return rng.int(0, 2);
    if (kind === 'elite') return rng.int(2, 4);
    return rng.int(1, 4);
  }

  // Monta as ondas. Cada onda é uma lista de { id, opts }.
  function makeWaves(chapter, step, kind, rng) {
    const diff = 1 + step * 0.06;
    const pick = () => rng.weighted(chapter.pool).id;
    if (kind === 'boss') {
      return [];
    }
    if (kind === 'elite') {
      const n = 5 + step;
      const first = [];
      for (let i = 0; i < n; i++) first.push({ id: pick(), opts: { hpMul: diff } });
      for (let i = 0; i < 2; i++) {
        first.push({
          id: pick(),
          opts: { hpMul: diff * 2.2, dmgMul: 1.3, sizeMul: 1.25, xpMul: 2.5, goldMul: 2.5, champion: true },
        });
      }
      return [R.shuffle(first)];
    }
    const base = 4 + Math.floor(step * 0.8);
    const waves = [];
    const first = [];
    for (let i = 0; i < base; i++) first.push({ id: pick(), opts: { hpMul: diff } });
    waves.push(first);
    if (step >= 3) {
      const second = [];
      for (let i = 0; i < base - 1; i++) second.push({ id: pick(), opts: { hpMul: diff } });
      waves.push(second);
    }
    return waves;
  }

  V.Arena = { ARENA, CENTER, makeObstacles, obstacleCount, makeWaves };
})();
