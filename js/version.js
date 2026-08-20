// version.js — Un solo sitio para la versión y la fecha de build.
//
// Antes: el README decía v23, la sticky bar v21, el footer "v21 (2026-07-13)"
// con una fecha fija del 4 de agosto, el <title> "agosto de 2026" a mano y el
// PDF exportado lo mismo. Cinco sitios que había que recordar actualizar.
// Classic script (not a module) — loaded with <script src defer>

window.BUILD = 'v24';

document.addEventListener('DOMContentLoaded', function () {
  var mes = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  document.title = 'Market Intelligence · ' + mes;

  var tag = document.querySelector('.build-tag');
  if (tag) tag.textContent = window.BUILD;

  var footer = document.querySelector('footer');
  if (footer) {
    footer.textContent = 'Market Intelligence ' + window.BUILD + ' · Tu Asesor Financiero · ' +
      'Solo informativo, no es asesoría financiera regulada · ' +
      new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
});

/** Nombre del PDF exportado, con el mes actual. */
window.pdfFilename = function () {
  var mes = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }).replace(/\s+/g, '-');
  return 'market-intelligence-' + mes + '.pdf';
};
