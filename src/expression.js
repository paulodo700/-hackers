// Escolhe a expressão do rosto pelo texto da fala. Módulo puro (testável em Node).
// '?' → dúvida; '!' → surpresa; demais falas → neutro.
export function moodForLine(text = '') {
  const t = String(text).trim();
  if (t.endsWith('?')) return 'doubt';
  if (t.endsWith('!')) return 'surprised';
  return 'neutral';
}

// Cansaço: abaixo de 30% da vida máxima, o rosto de Bit fica exausto.
export function moodForVitals(hp, maxHp) {
  return maxHp > 0 && hp / maxHp < 0.3 ? 'tired' : null;
}
