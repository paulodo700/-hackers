// Ativa os avisos do aparelho (notificações push). Precisa de um toque da pessoa, por isso fica no menu.
import { icone, toast } from '/shared/ui.js';

function paraBytes(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const texto = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(texto);
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

export async function ativarAvisos(client) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Este aparelho não aceita avisos aqui. Instale o app na tela inicial e tente de novo.');
  }
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('Permita as notificações para receber os avisos.');
  const registro = await navigator.serviceWorker.ready;
  const { key } = await client.api('/push/key');
  const existente = await registro.pushManager.getSubscription();
  const assinatura =
    existente ||
    (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraBytes(key) }));
  await client.api('/push/subscribe', { body: assinatura.toJSON() });
  toast('Avisos ativados. Você recebe quando o motorista chegar.', 'ok');
}

export { icone };
