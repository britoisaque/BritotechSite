(() => {
  const store = window.BritoTec;
  const local = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  };
  const money = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const escape = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const toast = message => {
    const element = document.querySelector('[data-toast]'); if (!element) return;
    element.textContent = message; element.classList.add('show'); clearTimeout(window.britotecToastTimer);
    window.britotecToastTimer = setTimeout(() => element.classList.remove('show'), 3600);
  };
  const getProfile = () => local.get('britotecProfile', null);
  const saveProfile = profile => { local.set('britotecProfile', { ...getProfile(), ...profile }); hydrateProfile(); };
  const hydrateProfile = () => {
    const profile = getProfile();
    document.querySelectorAll('[data-user-label]').forEach(el => el.textContent = profile?.name?.split(' ')[0] || 'Entrar');
    if (!profile) return;
    [['[data-profile-name]', 'name'], ['[data-profile-email]', 'email'], ['[data-profile-cpf]', 'cpf'], ['[data-profile-phone]', 'phone']].forEach(([selector, key]) => document.querySelectorAll(selector).forEach(input => { if (!input.value) input.value = profile[key] || ''; }));
  };
  function renderStoreStatus() {
    const element = document.querySelector('[data-store-status]'); if (!element || !store) return;
    const status = store.storeStatus();
    element.classList.toggle('closed', !status.open);
    element.innerHTML = `<span class="pulse-dot"></span> São João de Meriti • ${escape(status.label)}`;
  }
  function initializeFirebaseLogin() {
    const config = window.BRITOTEC_FIREBASE_CONFIG; if (!config?.apiKey || !window.firebase) return false;
    try { if (!firebase.apps.length) firebase.initializeApp(config); firebase.auth().onAuthStateChanged(user => { if (user) saveProfile({ name: user.displayName || 'Cliente BritoTec', email: user.email || '', photo: user.photoURL || '' }); }); return true; }
    catch (error) { console.warn('Firebase não pôde ser inicializado.', error); return false; }
  }
  const firebaseReady = initializeFirebaseLogin();
  const modal = document.querySelector('[data-auth-modal]');
  const openAuth = () => { if (!modal) return; modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); modal.querySelector('input')?.focus(); };
  const closeAuth = () => { if (!modal) return; modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); };
  document.querySelectorAll('[data-open-auth]').forEach(button => button.addEventListener('click', openAuth));
  document.querySelectorAll('[data-close-auth]').forEach(button => button.addEventListener('click', closeAuth));
  modal?.addEventListener('click', event => { if (event.target === modal) closeAuth(); });
  document.querySelectorAll('[data-google-login]').forEach(button => button.addEventListener('click', async () => {
    if (!firebaseReady) { toast('Configure o Firebase para ativar o login Google. Use o modo demonstração por enquanto.'); return; }
    button.disabled = true; button.textContent = 'Conectando…';
    try { const provider = new firebase.auth.GoogleAuthProvider(); await firebase.auth().signInWithPopup(provider); closeAuth(); toast('Login realizado. Seus dados foram salvos!'); }
    catch (error) { toast('Não foi possível entrar com Google. Tente novamente.'); console.warn(error); }
    finally { button.disabled = false; button.innerHTML = '<span class="google-g">G</span> Continuar com Google'; }
  }));
  document.querySelectorAll('[data-quick-profile]').forEach(form => form.addEventListener('submit', event => { event.preventDefault(); saveProfile(Object.fromEntries(new FormData(form))); closeAuth(); toast('Dados salvos. Seu atendimento ficará mais rápido!'); }));
  document.querySelectorAll('[data-cpf]').forEach(input => input.addEventListener('input', () => { const digits = input.value.replace(/\D/g, '').slice(0, 11); input.value = digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); }));
  document.querySelectorAll('[data-phone]').forEach(input => input.addEventListener('input', () => { const digits = input.value.replace(/\D/g, '').slice(0, 11); input.value = digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2'); }));
  document.querySelectorAll('[data-device-photo]').forEach(input => input.addEventListener('change', () => {
    const file = input.files?.[0]; const preview = input.closest('label')?.querySelector('[data-photo-preview]');
    if (!file || !preview) return; if (file.size > 4 * 1024 * 1024) { input.value = ''; preview.hidden = true; toast('Envie uma foto de até 4 MB.'); return; }
    preview.src = URL.createObjectURL(file); preview.hidden = false;
  }));
  document.querySelectorAll('[data-service-form]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(form)); const photo = form.querySelector('[data-device-photo]')?.files?.[0];
    const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Enviando…';
    try { const photoId = await store.db.savePhoto(photo); saveProfile({ name: values.name, email: values.email, cpf: values.cpf, phone: values.phone }); store.saveOrder({ ...values, photoId, photoName: photo?.name || '' }); form.reset(); hydrateProfile(); toast('Ordem enviada! Em breve falaremos com você pelo WhatsApp.'); }
    catch (error) { console.warn(error); toast('Não foi possível salvar a foto. Tente uma imagem menor.'); }
    finally { button.disabled = false; button.innerHTML = 'Enviar solicitação <span>→</span>'; }
  }));
  const menuToggle = document.querySelector('.menu-toggle'); const navigation = document.querySelector('.main-nav');
  menuToggle?.addEventListener('click', () => { const open = navigation.classList.toggle('open'); menuToggle.setAttribute('aria-expanded', String(open)); });
  navigation?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => navigation.classList.remove('open')));
  const currentPage = document.body.dataset.page;
  document.querySelectorAll('.main-nav a').forEach(link => { const href = link.getAttribute('href'); if ((currentPage === 'inicio' && href === 'index.html') || (currentPage === 'acessorios' && href === 'acessorios.html')) link.classList.add('active'); });
  document.querySelectorAll('[data-current-year]').forEach(el => el.textContent = new Date().getFullYear());
  hydrateProfile(); renderStoreStatus(); window.addEventListener('britotec:schedule', renderStoreStatus); setInterval(renderStoreStatus, 60000);
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } }), { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(target => observer.observe(target));

  const grid = document.querySelector('[data-product-grid]'); if (!grid) return;
  const drawer = document.querySelector('[data-cart-drawer]'); const shade = document.querySelector('[data-cart-shade]');
  const getCart = () => local.get('britotecCart', []); const saveCart = items => { local.set('britotecCart', items); renderCart(); };
  let shipping = local.get('britotecShipping', null); let coupon = local.get('britotecCoupon', null); let activeFilter = 'all';
  const openCart = () => { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); shade.classList.add('open'); };
  const closeCart = () => { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); shade.classList.remove('open'); };
  document.querySelectorAll('[data-open-cart]').forEach(button => button.addEventListener('click', openCart)); document.querySelectorAll('[data-close-cart]').forEach(button => button.addEventListener('click', closeCart)); shade?.addEventListener('click', closeCart);
  function renderProducts() {
    const products = store.getProducts(); const visible = products.filter(product => activeFilter === 'all' || product.category === activeFilter);
    grid.innerHTML = visible.map(product => `<article class="product-card reveal visible"><div class="product-image ${escape(product.color || 'blue')}">${product.badge ? `<span class="product-badge">${escape(product.badge)}</span>` : ''}<img src="${escape(product.image)}" alt="${escape(product.name)}" /><span class="stock-badge ${product.stock ? '' : 'out'}">${product.stock ? `${product.stock} em estoque` : 'Indisponível'}</span>${product.stock ? `<button class="product-add" data-add-product="${product.id}" aria-label="Adicionar ${escape(product.name)}">+</button>` : `<button class="notify-product" data-notify-product="${product.id}">ME AVISE</button>`}</div><div class="product-info"><p>${escape(product.category)}</p><h2>${escape(product.name)}</h2><div><strong>${money(product.price)}</strong><span>${product.stock ? 'à vista' : 'sem estoque'}</span></div></div></article>`).join('') || '<p class="empty-catalog">Nenhum item nesta categoria agora.</p>';
    document.querySelector('[data-product-count]').textContent = visible.length;
  }
  const renderCart = () => {
    let items = getCart(); const products = store.getProducts(); let changed = false;
    items = items.flatMap(item => { const current = products.find(product => product.id === item.id); if (!current || !current.stock) { changed = true; return []; } const quantity = Math.min(item.quantity, current.stock); if (quantity !== item.quantity) changed = true; return [{ ...current, quantity }]; });
    if (changed) local.set('britotecCart', items);
    const list = document.querySelector('[data-cart-items]'); const count = items.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll('[data-cart-count]').forEach(el => el.textContent = count); drawer.classList.toggle('empty', !items.length);
    list.innerHTML = items.map(item => `<div class="cart-line"><img src="${escape(item.image)}" alt="" /><div><h3>${escape(item.name)}</h3><strong>${money(item.price)}</strong><div class="quantity"><button data-cart-action="minus" data-id="${item.id}" aria-label="Diminuir">−</button><span>${item.quantity} de ${item.stock}</span><button data-cart-action="plus" data-id="${item.id}" aria-label="Aumentar">+</button></div></div><button class="line-remove" data-cart-action="remove" data-id="${item.id}" aria-label="Remover">×</button></div>`).join('');
    const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0); const discount = coupon ? subtotal * coupon.rate : 0; const total = Math.max(0, subtotal - discount) + (shipping?.value || 0);
    document.querySelector('[data-cart-subtotal]').textContent = money(subtotal); document.querySelector('[data-cart-discount]').textContent = discount ? `− ${money(discount)}` : '—'; document.querySelector('[data-cart-shipping]').textContent = shipping ? money(shipping.value) : '—'; document.querySelector('[data-cart-total]').textContent = money(total);
    const shippingResult = document.querySelector('[data-shipping-result]'); if (shippingResult && shipping) shippingResult.textContent = `${shipping.label}: ${money(shipping.value)} • ${shipping.days}`;
  };
  grid.addEventListener('click', event => {
    const add = event.target.closest('[data-add-product]'); const notify = event.target.closest('[data-notify-product]');
    if (add) { const product = store.getProduct(add.dataset.addProduct); const items = getCart(); const existing = items.find(item => item.id === product.id); if (existing && existing.quantity >= product.stock) { toast('Você já selecionou todas as unidades disponíveis.'); return; } if (existing) existing.quantity += 1; else items.push({ id: product.id, quantity: 1 }); saveCart(items); openCart(); toast(`${product.name} adicionado à sacola.`); }
    if (notify) { const product = store.getProduct(notify.dataset.notifyProduct); const profile = getProfile(); const email = window.prompt(`Avise seu e-mail para receber novidades sobre ${product.name}:`, profile?.email || ''); if (!email) return; if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Digite um e-mail válido.'); return; } store.addRestockRequest({ productId: product.id, email, productName: product.name }); toast('Pronto! Avisaremos quando este produto voltar ao estoque.'); }
  });
  drawer.addEventListener('click', event => { const action = event.target.dataset.cartAction; if (!action) return; const id = event.target.dataset.id; let items = getCart(); const item = items.find(product => product.id === id); const product = store.getProduct(id); if (action === 'plus' && item && product && item.quantity < product.stock) item.quantity += 1; else if (action === 'plus') { toast('Quantidade máxima disponível em estoque.'); return; } if (action === 'minus' && item) item.quantity -= 1; if (action === 'remove' || item?.quantity < 1) items = items.filter(productItem => productItem.id !== id); saveCart(items); });
  const cep = document.querySelector('[data-cep]'); cep?.addEventListener('input', () => { const value = cep.value.replace(/\D/g, '').slice(0, 8); cep.value = value.replace(/(\d{5})(\d)/, '$1-$2'); });
  document.querySelector('[data-calculate-shipping]')?.addEventListener('click', () => { const digits = cep.value.replace(/\D/g, ''); if (digits.length !== 8) { toast('Digite um CEP válido com 8 números.'); return; } const localDelivery = digits.startsWith('255'); shipping = localDelivery ? { value: 9.9, label: 'Entrega local BritoTec', days: 'chega hoje ou amanhã' } : { value: 18.9, label: 'Entrega expressa', days: '3 a 6 dias úteis' }; local.set('britotecShipping', shipping); renderCart(); toast('Frete calculado para o seu CEP.'); });
  document.querySelector('[data-apply-coupon]')?.addEventListener('click', () => { const code = document.querySelector('[data-coupon]').value.trim().toUpperCase(); const coupons = { BRITO10: { rate: .10, label: 'BRITO10' }, MERITI15: { rate: .15, label: 'MERITI15' } }; if (!coupons[code]) { coupon = null; local.set('britotecCoupon', null); renderCart(); toast('Cupom não encontrado. Tente BRITO10 ou MERITI15.'); return; } coupon = coupons[code]; local.set('britotecCoupon', coupon); renderCart(); toast(`Cupom ${code} aplicado!`); });
  document.querySelector('[data-checkout]')?.addEventListener('click', () => { const items = getCart(); if (!items.length) return; if (!getProfile()) { closeCart(); openAuth(); toast('Entre para finalizar seu pedido.'); return; } if (!shipping) { toast('Calcule o frete antes de finalizar.'); return; } try { store.purchase(items); local.set('britotecLastOrder', { items, shipping, coupon, createdAt: new Date().toISOString() }); saveCart([]); coupon = null; shipping = null; local.set('britotecCoupon', null); local.set('britotecShipping', null); closeCart(); toast('Pedido preparado! Nossa equipe entrará em contato para confirmar o pagamento.'); } catch (error) { renderProducts(); renderCart(); toast(error.message); } });
  document.querySelectorAll('.filter').forEach(filter => filter.addEventListener('click', () => { document.querySelectorAll('.filter').forEach(button => button.classList.remove('active')); filter.classList.add('active'); activeFilter = filter.dataset.filter; renderProducts(); }));
  window.addEventListener('britotec:products', () => { renderProducts(); renderCart(); }); window.addEventListener('storage', event => { if (event.key === 'britotec:products') { renderProducts(); renderCart(); } });
  renderProducts(); renderCart();
})();
