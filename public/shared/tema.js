// Roda antes de a tela aparecer: aplica o tema (claro/escuro) e a cor da marca já guardados,
// para a página não "piscar" com as cores erradas.
(function () {
  try {
    var tema = localStorage.getItem('mototaxi:tema');
    var marca = JSON.parse(localStorage.getItem('mototaxi:marca') || 'null');
    // Sem escolha da pessoa, vale o tema padrão definido pela central (se houver).
    if (tema !== 'claro' && tema !== 'escuro' && marca) tema = marca.tema;
    if (tema === 'claro' || tema === 'escuro') document.documentElement.setAttribute('data-tema', tema);
    if (marca && /^#[0-9a-f]{6}$/i.test(marca.cor) && /^#[0-9a-f]{6}$/i.test(marca.sobre)) {
      document.documentElement.style.setProperty('--marca', marca.cor);
      document.documentElement.style.setProperty('--sobre-marca', marca.sobre);
    }
  } catch (e) {
    /* sem armazenamento: segue com o padrão */
  }
})();
