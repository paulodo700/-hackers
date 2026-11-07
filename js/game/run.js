// Estado da run atual: capítulo, passo do mapa, atributos, cartas, XP, ouro e salvamento.
(() => {
  const V = (window.V = window.V || {});
  const { R, makeRng } = V.Util;

  const BASE_STATS = () => ({
    maxHp: 100,
    hp: 100,
    dmg: 10,
    fireRate: 1.5,
    moveSpeed: 128,
    multishot: 1,
    pierce: 0,
    bounces: 0,
    homing: 0,
    explode: 0,
    critChance: 0.08,
    critMult: 2,
    lifesteal: 0,
    armor: 0,
    dodge: 0,
    goldMult: 1,
    xpMult: 1,
    relicBonus: 0,
  });

  // Peso das raridades ao sortear cartas.
  const RARITY_W = { common: 60, rare: 30, epic: 10 };

  const Run = {
    active: false,
    seed: 1,
    rng: null,
    chapter: 0,
    step: 0,
    choices: null,
    stats: null,
    cards: {},
    cardOrder: [],
    level: 1,
    xp: 0,
    gold: 0,
    kills: 0,
    roomsCleared: 0,
    bossesKilled: 0,
    startedAt: 0,

    // Começa uma nova run com os bônus permanentes (Altar) já aplicados.
    start(meta) {
      this.seed = (Math.random() * 1e9) >>> 0;
      this.rng = makeRng(this.seed);
      this.chapter = 0;
      this.step = 0;
      this.choices = null;
      this.stats = BASE_STATS();
      this.cards = {};
      this.cardOrder = [];
      this.level = 1;
      this.xp = 0;
      this.gold = 0;
      this.kills = 0;
      this.roomsCleared = 0;
      this.bossesKilled = 0;
      this.startedAt = Date.now();
      this.active = true;
      V.Meta.applyToStats(this.stats);
      const extra = V.Meta.level('start');
      for (let i = 0; i < extra; i++) this.pickCard(this.randomCards(1, 'common')[0], true);
      this.stats.hp = this.stats.maxHp;
    },

    chapterDef() {
      return V.Data.chapters[this.chapter];
    },

    // Índice global de progresso (usado para calcular relíquias ao morrer).
    progress() {
      return this.chapter * V.Data.STEPS_PER_CHAPTER + this.step;
    },

    // Escolhas do passo atual (sempre duas). Geradas uma vez e mantidas até escolher.
    currentChoices() {
      if (this.choices) return this.choices;
      if (this.isBossNode()) return (this.choices = ['boss']);
      const hurt = this.stats.hp / this.stats.maxHp < 0.6;
      const pool = [
        { w: 40, id: 'combat' },
        { w: this.step >= 1 ? 16 : 0, id: 'elite' },
        { w: 14, id: 'treasure' },
        { w: hurt ? 30 : 12, id: 'rest' },
        { w: this.gold >= 25 ? 22 : 12, id: 'shop' },
      ];
      const first = this.rng.weighted(pool);
      const rest = pool.filter((p) => p.id !== first.id && p.w > 0);
      const second = this.rng.weighted(rest);
      this.choices = this.rng.chance(0.5) ? [first.id, second.id] : [second.id, first.id];
      return this.choices;
    },

    // Avança o mapa após concluir o nó escolhido.
    advance() {
      this.choices = null;
      this.step++;
      if (this.step > V.Data.STEPS_PER_CHAPTER) {
        this.step = 0;
        this.chapter++;
      }
    },

    isBossNode() {
      return this.step >= V.Data.STEPS_PER_CHAPTER;
    },

    isFinalChapterDone() {
      return this.chapter >= V.Data.chapters.length;
    },

    xpNeeded(level) {
      return 8 + level * 6;
    },

    // Adiciona XP e retorna quantos níveis foram ganhos.
    addXp(amount) {
      this.xp += amount * this.stats.xpMult;
      let ups = 0;
      while (this.xp >= this.xpNeeded(this.level)) {
        this.xp -= this.xpNeeded(this.level);
        this.level++;
        ups++;
      }
      return ups;
    },

    addGold(n) {
      this.gold += Math.round(n);
    },

    cardCount(id) {
      return this.cards[id] || 0;
    },

    // Sorteia n cartas diferentes que ainda não atingiram o máximo.
    randomCards(n, onlyRarity) {
      const pool = V.Data.cards.filter((c) => this.cardCount(c.id) < c.max && (!onlyRarity || c.rarity === onlyRarity));
      const out = [];
      let guard = 0;
      while (out.length < n && pool.length && guard++ < 100) {
        const weighted = pool
          .filter((c) => !out.includes(c))
          .map((c) => ({ w: RARITY_W[c.rarity] * (this.cardCount(c.id) ? 0.6 : 1), c }));
        if (!weighted.length) break;
        const pick = this.rng.weighted(weighted).c;
        out.push(pick);
      }
      return out;
    },

    pickCard(card, silent) {
      if (!card) return;
      card.apply(this.stats);
      this.cards[card.id] = (this.cards[card.id] || 0) + 1;
      if (!this.cardOrder.includes(card.id)) this.cardOrder.push(card.id);
      if (!silent) this.stats.hp = Math.min(this.stats.hp, this.stats.maxHp);
    },

    // Salvamento de progresso da run (para "Continuar").
    serialize() {
      return {
        seed: this.seed,
        chapter: this.chapter,
        step: this.step,
        choices: this.choices,
        stats: this.stats,
        cards: this.cards,
        cardOrder: this.cardOrder,
        level: this.level,
        xp: this.xp,
        gold: this.gold,
        kills: this.kills,
        roomsCleared: this.roomsCleared,
        bossesKilled: this.bossesKilled,
      };
    },

    restore(d) {
      if (!d || typeof d !== 'object') return false;
      this.seed = d.seed;
      this.rng = makeRng(d.seed + d.step * 131 + d.chapter * 7919);
      this.chapter = d.chapter;
      this.step = d.step;
      this.choices = d.choices || null;
      this.stats = d.stats;
      this.cards = d.cards || {};
      this.cardOrder = d.cardOrder || [];
      this.level = d.level;
      this.xp = d.xp;
      this.gold = d.gold;
      this.kills = d.kills || 0;
      this.roomsCleared = d.roomsCleared || 0;
      this.bossesKilled = d.bossesKilled || 0;
      this.active = true;
      return true;
    },

    // Relíquias ganhas ao final da run (morte ou vitória).
    relicsOnEnd(victory) {
      let r = Math.floor(this.progress() / 2) + this.bossesKilled * 3;
      if (victory) r += 10;
      r += this.stats.relicBonus * this.bossesKilled;
      return Math.max(1, r);
    },
  };

  V.Run = Run;
})();
