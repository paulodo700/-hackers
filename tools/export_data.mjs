// Exporta os dados do jogo (JavaScript) para JSON, para a versão em Python ler os mesmos números.
// Uso: node tools/export_data.mjs   → grava em python/anelzero/data/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'python', 'anelzero', 'data');
fs.mkdirSync(OUT, { recursive: true });

const content = await import(pathToFileURL(path.join(ROOT, 'src/data/content.js')).href);
const zones = await import(pathToFileURL(path.join(ROOT, 'src/data/zones.js')).href);
const loot = await import(pathToFileURL(path.join(ROOT, 'src/loot.js')).href);

const write = (name, obj) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 2) + '\n');

write('content.json', {
  RARITY: content.RARITY,
  ITEMS: content.ITEMS,
  ENEMIES: content.ENEMIES,
  SKILLS: content.SKILLS,
  SKILL_TREE: content.SKILL_TREE,
  RECIPES: content.RECIPES,
  SHOP: content.SHOP,
  QUESTS: content.QUESTS,
  QUEST_ORDER: content.QUEST_ORDER,
  NPCS: content.NPCS,
  CODEX: content.CODEX,
  INTRO_TEXT: content.INTRO_TEXT,
  VIGIA_CHOICE: content.VIGIA_CHOICE,
  VIGIA_CHOICES: content.VIGIA_CHOICES,
  ENDINGS: content.ENDINGS,
  ENDING_RESUME: content.ENDING_RESUME,
  REPAIR_TUTORIAL: undefined,
});

write('loot.json', {
  CHEST_LOOT: loot.CHEST_LOOT,
  ZONE_LOOT: loot.ZONE_LOOT,
});

// Zonas: configuração, marcadores e o mapa gerado pela versão JavaScript (referência para o port)
const zonesOut = {};
for (const [id, z] of Object.entries(zones.ZONES)) {
  zonesOut[id] = {
    id: z.id,
    name: z.name,
    music: z.music,
    encounter: z.encounter,
    theme: z.theme,
    enemies: z.enemies,
    decor: z.decor ?? null,
    gen: z.gen ?? null,
    markers: z.markers,
    map: z.map,
  };
}
write('zones.json', { START_ZONE: zones.START_ZONE, ZONES: zonesOut });

console.log('dados exportados para', path.relative(ROOT, OUT));
