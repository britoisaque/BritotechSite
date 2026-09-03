// Aplica os dados de js/site-config.js aos elementos marcados com os atributos abaixo.
// Isso permite editar o WhatsApp, endereço e redes sociais em um único lugar (site-config.js).
(() => {
  const config = window.BRITOTEC_CONFIG;
  if (!config) { console.warn("site-contact.js: js/site-config.js não foi carregado."); return; }

  const waMessage = encodeURIComponent("Olá! Vim pelo site da BritoTec e gostaria de mais informações.");
  const waLink = `https://wa.me/${config.whatsappNumber}?text=${waMessage}`;

  document.querySelectorAll("[data-whatsapp-link]").forEach(el => { el.href = waLink; });
  document.querySelectorAll("[data-whatsapp-display]").forEach(el => { el.textContent = config.whatsappDisplay; });
  document.querySelectorAll("[data-store-address]").forEach(el => { el.textContent = config.address; });

  document.querySelectorAll("[data-instagram-link]").forEach(el => {
    if (config.instagramUrl) { el.href = config.instagramUrl; el.hidden = false; }
    else { el.hidden = true; }
  });
  document.querySelectorAll("[data-facebook-link]").forEach(el => {
    if (config.facebookUrl) { el.href = config.facebookUrl; el.hidden = false; }
    else { el.hidden = true; }
  });
})();
