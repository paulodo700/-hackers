// Preenche o nome do serviço e o contato da central na página de termos.
fetch('/api/public/config')
  .then((r) => r.json())
  .then((c) => {
    if (!c) return;
    if (c.brand_name) {
      document.querySelectorAll('[data-marca]').forEach((el) => (el.textContent = c.brand_name));
      document.title = `Termos de uso · ${c.brand_name}`;
    }
    const d = String(c.support_phone || '');
    if (d.length === 10 || d.length === 11) {
      const mask = d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      const contato = document.getElementById('contato');
      contato.textContent = `Fale com a central de atendimento: ${mask} (telefone e WhatsApp). `;
    }
  })
  .catch(() => {});
