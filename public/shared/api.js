// Comunicação com o servidor. Cada tela (passageiro, motoqueiro, central) guarda a própria sessão,
// assim dá para usar as três no mesmo aparelho.
/* global io */

const ROLE_OF = { passageiro: 'passenger', motoqueiro: 'driver', central: 'admin' };

export function createClient(app) {
  const key = `mototaxi:${app}`;
  const role = ROLE_OF[app];
  let session = null;
  let socket = null;
  let onLogout = () => {};

  try {
    session = JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    session = null;
  }

  function save(next) {
    session = next;
    try {
      if (next) localStorage.setItem(key, JSON.stringify(next));
      else localStorage.removeItem(key);
    } catch {
      /* navegação privada: segue só na memória */
    }
  }

  async function api(path, { method, body } = {}) {
    let res;
    try {
      res = await fetch(`/api${path}`, {
        method: method || (body ? 'POST' : 'GET'),
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error('Sem conexão com a internet. Tente de novo.');
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      if (res.status === 401 && session) logout();
      const err = new Error((data && data.error) || 'Algo deu errado. Tente de novo.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // Envia um arquivo (foto de documento).
  async function upload(path, blob) {
    let res;
    try {
      res = await fetch(`/api${path}`, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'image/jpeg', Authorization: `Bearer ${session ? session.token : ''}` },
        body: blob,
      });
    } catch {
      throw new Error('Sem conexão com a internet. Tente de novo.');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || 'Não foi possível enviar a foto.');
    return data;
  }

  // Baixa um arquivo protegido (foto de documento) e devolve um endereço temporário para mostrar na tela.
  async function fileUrl(path) {
    const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${session ? session.token : ''}` } });
    if (!res.ok) throw new Error('Não foi possível abrir o documento.');
    return URL.createObjectURL(await res.blob());
  }

  async function enter(path, body) {
    const data = await api(path, { body });
    if (data.user.role !== role) {
      // Não revela quais outras telas existem.
      throw new Error('Esta conta não pode entrar por aqui.');
    }
    save(data);
    return data.user;
  }

  function logout() {
    if (socket) socket.close();
    socket = null;
    save(null);
    onLogout();
  }

  // Conexão em tempo real. Reconecta sozinha; `onReconnect` serve para recarregar o estado.
  function connect({ onReconnect } = {}) {
    if (socket) socket.close();
    socket = io({ auth: (cb) => cb({ token: session ? session.token : '' }) });
    let first = true;
    socket.on('connect', () => {
      if (!first && onReconnect) onReconnect();
      first = false;
    });
    return socket;
  }

  return {
    api,
    upload,
    fileUrl,
    login: (phone, password) => enter('/auth/login', { phone, password }),
    register: (fields) => enter('/auth/register', { ...fields, role }),
    logout,
    connect,
    // Depois de trocar a senha o servidor devolve um login novo; o antigo deixa de valer.
    adopt: (data) => save(data),
    rename: (name) => session && save({ ...session, user: { ...session.user, name } }),
    get user() {
      return session ? session.user : null;
    },
    get socket() {
      return socket;
    },
    set onLogout(fn) {
      onLogout = fn;
    },
  };
}
