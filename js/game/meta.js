// Progresso persistente entre runs: Relíquias, melhorias do Altar, recordes e configurações.
(() => {
  const V = (window.V = window.V || {});
  const { store } = V.Util;

  const KEY = 'meta';

  const Meta = {
    relics: 0,
    levels: {},
    best: { chapter: 0, kills: 0, runs: 0, wins: 0 },

    load() {
      const d = store.get(KEY, null);
      if (d && typeof d === 'object') {
        this.relics = d.relics || 0;
        this.levels = d.levels || {};
        this.best = Object.assign({ chapter: 0, kills: 0, runs: 0, wins: 0 }, d.best || {});
      }
    },

    save() {
      store.set(KEY, { relics: this.relics, levels: this.levels, best: this.best });
    },

    level(id) {
      return this.levels[id] || 0;
    },

    // Aplica as melhorias permanentes aos atributos iniciais de uma run.
    applyToStats(s) {
      s.maxHp += this.bonusHp();
      s.dmg *= 1 + this.level('dmg') * 0.05;
      s.moveSpeed *= 1 + this.level('move') * 0.04;
      s.goldMult *= 1 + this.level('gold') * 0.15;
    },

    bonusHp() {
      return this.level('maxhp') * 10;
    },

    // Compra um nível de melhoria do Altar, se houver Relíquias suficientes.
    buy(id) {
      const def = V.Data.metaUpgrades.find((m) => m.id === id);
      if (!def) return false;
      const lv = this.level(id);
      if (lv >= def.max) return false;
      const cost = V.Data.metaCost(def, lv);
      if (this.relics < cost) return false;
      this.relics -= cost;
      this.levels[id] = lv + 1;
      this.save();
      return true;
    },

    addRelics(n) {
      this.relics += n;
      this.save();
    },
  };

  V.Meta = Meta;
})();
