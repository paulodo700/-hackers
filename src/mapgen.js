// Gerador determinístico de mapas extensos: salas ligadas por corredores, com objetos espalhados.
// Mesma semente = mesmo mapa (importante para salvamentos, posições e testes).
//
// Legenda gerada: '#' parede, '.' piso, '=' trilha, '~' poça, 'S' nascimento,
// e os caracteres de `markers` (cada um é colocado no número de vezes pedido em `extras`).
// Portais: 'B' (volta, perto do nascimento) e 'A' (avanço, na sala mais distante).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Gera as linhas do mapa. markers: { char: def } (def.type 'portal' e 'spawn' têm regra própria).
// extras: { char: quantidade } para objetos repetidos (pickups, baús extras). Padrão: 1.
export function generateMap({ seed, cols, rows, markers = {}, extras = {} }) {
  const rnd = mulberry32(seed);
  const grid = Array.from({ length: rows }, () => Array(cols).fill('#'));
  const set = (c, r, ch) => { grid[r][c] = ch; };
  const get = (c, r) => (c >= 0 && r >= 0 && c < cols && r < rows ? grid[r][c] : '#');

  // ---- Salas ----
  const rooms = [];
  const target = Math.max(6, Math.round((cols * rows) / 120));
  for (let attempt = 0; attempt < 6000 && rooms.length < target; attempt++) {
    const w = 6 + Math.floor(rnd() * 7);
    const h = 5 + Math.floor(rnd() * 5);
    const x = 1 + Math.floor(rnd() * (cols - w - 2));
    const y = 1 + Math.floor(rnd() * (rows - h - 2));
    const overlaps = rooms.some((o) => x < o.x + o.w + 2 && x + w + 2 > o.x && y < o.y + o.h + 2 && y + h + 2 > o.y);
    if (overlaps) continue;
    rooms.push({ x, y, w, h });
  }
  rooms.sort((a, b) => a.x - b.x);
  for (const room of rooms) {
    for (let r = room.y; r < room.y + room.h; r++) for (let c = room.x; c < room.x + room.w; c++) set(c, r, '.');
  }

  // ---- Corredores (ligação em ordem de x, mais alguns laços) ----
  const center = (room) => [Math.floor(room.x + room.w / 2), Math.floor(room.y + room.h / 2)];
  const corridor = (a, b) => {
    const [ax, ay] = center(a);
    const [bx, by] = center(b);
    const xs = Math.min(ax, bx), xe = Math.max(ax, bx);
    for (let c = xs; c <= xe; c++) if (get(c, ay) === '#') set(c, ay, '.');
    const ys = Math.min(ay, by), ye = Math.max(ay, by);
    for (let r = ys; r <= ye; r++) if (get(bx, r) === '#') set(bx, r, '.');
  };
  for (let i = 0; i + 1 < rooms.length; i++) corridor(rooms[i], rooms[i + 1]);
  for (let i = 0; i < rooms.length; i++) {
    if (rnd() < 0.25) {
      const j = Math.floor(rnd() * rooms.length);
      if (j !== i) corridor(rooms[i], rooms[j]);
    }
  }

  // ---- Trilhas de cobre e poças (decoração que também é andável / bloqueia só as poças) ----
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (grid[r][c] === '.' && rnd() < 0.12) set(c, r, '=');
  }
  rooms.forEach((room, idx) => {
    if (idx === 0 || rnd() > 0.3) return;
    const px = room.x + 2 + Math.floor(rnd() * Math.max(1, room.w - 5));
    const py = room.y + 2 + Math.floor(rnd() * Math.max(1, room.h - 5));
    for (let dr = 0; dr < 2; dr++) for (let dc = 0; dc < 2; dc++) {
      if (get(px + dc, py + dr) === '.' || get(px + dc, py + dr) === '=') set(px + dc, py + dr, '~');
    }
  });

  // ---- Interior das salas: onde os objetos podem ficar ----
  const interior = (room) => {
    const out = [];
    for (let r = room.y + 1; r < room.y + room.h - 1; r++) for (let c = room.x + 1; c < room.x + room.w - 1; c++) {
      if (grid[r][c] === '.' || grid[r][c] === '=') out.push([c, r]);
    }
    return out;
  };
  const first = rooms[0];
  const last = rooms[rooms.length - 1];
  const taken = new Set();
  const key = (c, r) => `${c},${r}`;
  const nearTaken = (c, r, d = 2) => {
    for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) if (taken.has(key(c + dc, r + dr))) return true;
    return false;
  };
  const place = (ch, c, r) => { set(c, r, ch); taken.add(key(c, r)); };

  // Nascimento e portal de volta: na primeira sala
  const spawnCells = interior(first);
  const [sc, sr] = spawnCells[Math.floor(spawnCells.length / 2)] || center(first);
  place('S', sc, sr);
  if (markers.B) {
    const b = interior(first).find(([c, r]) => Math.abs(c - sc) + Math.abs(r - sr) >= 3 && !nearTaken(c, r, 1));
    if (b) place('B', b[0], b[1]);
  }
  // Portal de avanço: na sala mais distante do nascimento
  if (markers.A) {
    const cand = interior(last).filter(([c, r]) => !nearTaken(c, r, 2));
    const a = cand[Math.floor(cand.length / 2)] || center(last);
    place('A', a[0], a[1]);
  }

  // Demais objetos (quantidade em extras; padrão 1), distribuídos pelas salas do meio do caminho
  const others = Object.keys(markers).filter((ch) => !['A', 'B', 'S'].includes(ch) && markers[ch].type !== 'portal' && markers[ch].type !== 'spawn');
  const pool = rooms.slice(1);
  for (const ch of others) {
    const count = extras[ch] ?? 1;
    for (let k = 0; k < count; k++) {
      let placed = false;
      for (let attempt = 0; attempt < 400 && !placed; attempt++) {
        const room = pool[Math.floor(rnd() * pool.length)];
        const cells = interior(room);
        if (!cells.length) continue;
        const [c, r] = cells[Math.floor(rnd() * cells.length)];
        const d = markers[ch].type === 'pickup' ? 1 : 2; // pickups podem ficar juntos; o resto espaçado
        if (nearTaken(c, r, d)) continue;
        place(ch, c, r);
        placed = true;
      }
    }
  }

  // Pilares soltos em algumas salas (sem encostar em nada importante, e sem dois juntos)
  for (const room of rooms.slice(1)) {
    for (let r = room.y + 2; r < room.y + room.h - 2; r++) for (let c = room.x + 2; c < room.x + room.w - 2; c++) {
      if (grid[r][c] !== '.' || nearTaken(c, r, 2) || rnd() > 0.06) continue;
      let adjacentPillar = false;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (get(c + dc, r + dr) === '#') adjacentPillar = true;
      if (!adjacentPillar) set(c, r, '#');
    }
  }

  return grid.map((row) => row.join(''));
}
