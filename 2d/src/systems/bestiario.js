// Registro das falhas: vistas, vencidas e escaneadas. Fraquezas e ataques aparecem depois de vencer ou escanear.
import { VANTAGEM } from '../data/schema.js';

export function registro(game, id) {
  if (!game.bestiario[id]) game.bestiario[id] = { vistas: 0, vencidas: 0, escaneada: false };
  return game.bestiario[id];
}
export const registrarVista = (game, id) => { registro(game, id).vistas++; };
export const registrarVitoria = (game, id) => { registro(game, id).vencidas++; };
export const registrarScan = (game, id) => { registro(game, id).escaneada = true; };

// Informação da falha. Ataques e fraquezas só aparecem com vitória ou escaneamento.
export function detalhesFalha(game, id) {
  const f = game.catalog.falhas[id];
  if (!f) return null;
  const r = registro(game, id);
  const conhecida = r.vencidas > 0 || r.escaneada;
  return {
    nome: f.nome,
    elemento: f.elemento,
    descricao: f.descricao,
    vistas: r.vistas,
    vencidas: r.vencidas,
    conhecida,
    ataques: conhecida ? (f.ataques ?? []).map((a) => game.catalog.ataques[a]?.nome ?? a) : null,
    // Quem tem vantagem contra o elemento desta falha (ex.: 'calor' contra 'frio').
    fraquezas: conhecida ? Object.entries(VANTAGEM).filter(([, def]) => def === f.elemento).map(([atk]) => atk) : null,
  };
}
