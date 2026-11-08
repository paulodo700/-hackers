// Escolhe a expressão do rosto pelo texto da fala. Módulo puro (testável em Node).
// '?' → dúvida; '!' → surpresa; demais falas → neutro.
export function moodForLine(text = '') {
  const t = String(text).trim();
  if (t.endsWith('?')) return 'doubt';
  if (t.endsWith('!')) return 'surprised';
  return 'neutral';
}
