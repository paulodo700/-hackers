// Instalar cada tela como aplicativo separado (Android/computador: botão direto; iPhone: passo a passo).
import { janela } from '/shared/menu.js';
import { toast } from '/shared/ui.js';

let convite = null; // evento do navegador que permite instalar
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  convite = e;
});
window.addEventListener('appinstalled', () => {
  convite = null;
  toast('Aplicativo instalado. Abra pelo ícone na tela inicial.', 'ok');
});

export const jaInstalado = () =>
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;

const ehIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

export async function instalar(nome) {
  if (convite) {
    convite.prompt();
    const escolha = await convite.userChoice;
    convite = null;
    if (escolha.outcome === 'accepted') toast(`${nome} instalado. Abra pelo ícone na tela inicial.`, 'ok');
    return;
  }
  const passos = ehIphone()
    ? ['Toque no botão Compartilhar (quadrado com seta para cima), na barra do Safari.', 'Role e toque em "Adicionar à Tela de Início".', 'Toque em "Adicionar". O ícone aparece na tela inicial.']
    : ['No Chrome, toque nos três pontinhos no canto superior direito.', 'Toque em "Instalar aplicativo" (ou "Adicionar à tela inicial").', 'Confirme. O ícone aparece na tela inicial.'];
  const h = (tag, texto) => {
    const el = document.createElement(tag);
    el.textContent = texto;
    return el;
  };
  janela(
    `Instalar ${nome}`,
    h('p', 'Instale como aplicativo separado. Não precisa de loja.'),
    ...passos.map((p) => h('p', p))
  );
}
