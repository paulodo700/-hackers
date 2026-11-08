// Utilitários dos sistemas. Sem DOM.
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Escolhe um item da lista com o gerador do jogo (determinístico).
export function escolher(rng, lista) {
  return lista.length ? lista[Math.floor(rng() * lista.length)] : null;
}

// Escolhe um item com peso ('peso', padrão 1).
export function escolherPeso(rng, lista) {
  if (!lista.length) return null;
  const total = lista.reduce((s, x) => s + (x.peso ?? 1), 0);
  let r = rng() * total;
  for (const x of lista) {
    r -= x.peso ?? 1;
    if (r < 0) return x;
  }
  return lista[lista.length - 1];
}

// Acrescenta (ou renova) um estado com duração em turnos.
export function addStatus(lista, id, turnos) {
  const e = lista.find((x) => x.id === id);
  if (e) e.turnos = Math.max(e.turnos, turnos);
  else lista.push({ id, turnos });
  return lista;
}

export const temStatus = (lista, id) => lista.some((x) => x.id === id);
export const semStatus = (lista, id) => lista.filter((x) => x.id !== id);
