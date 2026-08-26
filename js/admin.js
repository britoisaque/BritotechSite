(() => {
  const store = window.BritoTec;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const safe = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const money = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const toast = message => { const element = $('[data-toast]'); element.textContent = message; element.classList.add('show'); clearTimeout(window.adminToast); window.adminToast = setTimeout(() => element.classList.remove('show'), 3600); };
  const date = value => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));

  // --- Firebase Authentication + Firestore ---
  if (!window.firebase || !window.BRITOTEC_FIREBASE_CONFIG) { console.error('Firebase não carregado. Verifique os <script> em portal.html e o arquivo js/firebase-config.js.'); return; }
  const fbApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.BRITOTEC_FIREBASE_CONFIG);
  const auth = firebase.auth();
  const db = firebase.firestore();

  let user = null;
  let employeesCache = [];

  const authErrorMessage = error => ({
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas seguidas. Aguarde um instante e tente de novo.',
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.'
  }[error?.code] || 'Não foi possível concluir a operação. Tente novamente.');

  function showLoginError(message) { const error = $('[data-admin-login-error]'); error.hidden = false; error.textContent = message; }
  function hideLoginError() { $('[data-admin-login-error]').hidden = true; }

  function enterApp(profile) { user = profile; $('[data-admin-login]').hidden = true; $('[data-admin-app]').hidden = false; $('[data-admin-name]').textContent = user.name; $('[data-admin-role]').textContent = user.role === 'owner' ? 'Proprietário' : 'Funcionário autorizado'; $$('[data-owner-only]').forEach(element => element.hidden = user.role !== 'owner'); renderAll(); }
  function backToLogin() { user = null; $('[data-admin-login]').hidden = false; $('[data-admin-app]').hidden = true; }

  $('[data-admin-login-form]').addEventListener('submit', async event => {
    event.preventDefault(); hideLoginError();
    const { email, password } = Object.fromEntries(new FormData(event.currentTarget));
    const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true;
    try { await auth.signInWithEmailAndPassword(email.trim(), password); }
    catch (error) { showLoginError(authErrorMessage(error)); }
    finally { button.disabled = false; }
  });

  $('[data-admin-logout]').addEventListener('click', () => auth.signOut());

  auth.onAuthStateChanged(async firebaseUser => {
    if (!firebaseUser) { backToLogin(); return; }
    try {
      const doc = await db.collection('users').doc(firebaseUser.uid).get();
      if (!doc.exists || doc.data().active === false) { showLoginError('Este usuário não tem acesso autorizado ao painel.'); await auth.signOut(); return; }
      const data = doc.data();
      enterApp({ id: firebaseUser.uid, email: firebaseUser.email, name: data.name || firebaseUser.email, role: data.role || 'admin' });
    } catch (error) { showLoginError('Não foi possível verificar seu acesso agora. Tente novamente.'); await auth.signOut(); }
  });
  function renderOverview() {
    const alerts = store.getAlerts(); const pending = store.getOrders().filter(order => order.status === 'novo').length; const low = store.getProducts().filter(product => product.stock <= 2).length; const notices = store.getRestockRequests().filter(request => request.status === 'pronto-para-enviar').length; const status = store.storeStatus();
    $('[data-stat-orders]').textContent = pending; $('[data-stat-low-stock]').textContent = low; $('[data-stat-notices]').textContent = notices; $('[data-stat-open]').textContent = status.open ? 'ABERTA' : 'FECHADA'; $('[data-stat-open-detail]').textContent = status.label; $('[data-admin-store-status]').textContent = status.open ? '● Loja aberta' : '● Loja fechada'; $('[data-admin-store-status]').classList.toggle('closed', !status.open);
    $('[data-alert-list]').innerHTML = alerts.length ? alerts.map(alert => `<article class="admin-alert ${alert.kind}"><span>${alert.kind === 'danger' ? '!' : alert.kind === 'warning' ? '↯' : 'i'}</span><div><strong>${safe(alert.title)}</strong><p>${safe(alert.text)}</p></div></article>`).join('') : '<p class="admin-empty">Tudo em ordem por aqui.</p>';
    const ready = store.getRestockRequests().filter(request => request.status === 'pronto-para-enviar');
    $('[data-notice-list]').innerHTML = ready.length ? ready.map(request => `<article class="notice-row"><div><strong>${safe(request.productName)}</strong><p>${safe(request.email)} • pedido em ${date(request.createdAt)}</p></div><button data-send-notice="${request.id}">Marcar e-mail como enviado</button></article>`).join('') : '<p class="admin-empty">Nenhum aviso de reposição pendente.</p>';
  }
  async function renderOrders() {
    const orders = store.getOrders(); $('[data-pending-orders]').textContent = orders.filter(order => order.status === 'novo').length;
    $('[data-order-list]').innerHTML = orders.length ? orders.map(order => `<article class="order-card ${order.status}"><div class="order-status">${order.status === 'novo' ? 'NOVA' : 'CONFIRMADA'}</div><div class="order-main"><div><p class="section-kicker">${safe(order.service)} • ${date(order.createdAt)}</p><h3>${safe(order.name)}</h3><p class="order-model">${safe(order.brand)} • ${safe(order.model)}</p><p class="order-issue">${safe(order.issue)}</p></div><dl><div><dt>WhatsApp</dt><dd>${safe(order.phone)}</dd></div><div><dt>E-mail</dt><dd>${safe(order.email)}</dd></div><div><dt>CPF</dt><dd>${safe(order.cpf)}</dd></div></dl></div>${order.photoId ? `<div class="order-photo"><button data-view-photo="${order.photoId}">Ver foto enviada</button><img data-order-photo="${order.photoId}" alt="Aparelho enviado pelo cliente" hidden /></div>` : ''}<div class="order-actions">${order.status === 'novo' ? `<button class="button primary" data-confirm-order="${order.id}">Confirmar e abrir WhatsApp <span>→</span></button>` : '<span>Cliente já confirmado</span>'}</div></article>`).join('') : '<p class="admin-empty">Nenhuma ordem de serviço criada ainda.</p>';
  }
  function renderInventory() { const products = store.getProducts(); $('[data-inventory-list]').innerHTML = products.map(product => `<article class="inventory-item"><img src="${safe(product.image)}" alt="" /><div><strong>${safe(product.name)}</strong><p>${safe(product.category)} • ${money(product.price)}</p></div><span class="inventory-stock ${product.stock === 0 ? 'zero' : product.stock <= 2 ? 'low' : ''}">${product.stock} un.</span><div class="inventory-actions"><button data-edit-product="${product.id}">Editar</button><button data-remove-product="${product.id}">Remover</button></div></article>`).join('') || '<p class="admin-empty">Nenhum produto cadastrado.</p>'; }
  const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  function renderSchedule() { const schedule = store.getSchedule(); $('[data-schedule-rows]').innerHTML = dayNames.map((name, day) => { const value = schedule[day]; return `<div class="schedule-row"><label><input type="checkbox" name="enabled-${day}" ${value.enabled ? 'checked' : ''} /> ${name}</label><input type="time" name="open-${day}" value="${value.open}" ${value.enabled ? '' : 'disabled'} /><span>até</span><input type="time" name="close-${day}" value="${value.close}" ${value.enabled ? '' : 'disabled'} /></div>`; }).join(''); }
  function renderNotes() { const notes = store.getNotes().filter(note => note.authorId === user.id); $('[data-notes-list]').innerHTML = notes.length ? notes.map(note => `<article class="note-item"><p>${safe(note.text)}</p><small>${date(note.createdAt)}</small></article>`).join('') : '<p class="admin-empty">Suas anotações aparecerão aqui.</p>'; }
  async function loadEmployees() { const snapshot = await db.collection('users').orderBy('name').get(); employeesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); }
  function renderEmployees() { if (user.role !== 'owner') return; $('[data-employee-list]').innerHTML = employeesCache.length ? employeesCache.map(employee => `<article class="employee-item"><span class="profile-icon">◉</span><div><strong>${safe(employee.name)}</strong><p>${safe(employee.email)} • ${employee.role === 'owner' ? 'proprietário' : employee.active ? 'autorizado' : 'desativado'}</p></div>${employee.role !== 'owner' ? `<button data-toggle-employee="${employee.id}">${employee.active ? 'Desativar' : 'Ativar'}</button>` : '<span class="owner-lock">DONO</span>'}</article>`).join('') : '<p class="admin-empty">Nenhum funcionário cadastrado.</p>'; }
  async function renderAll() { renderOverview(); renderOrders(); renderInventory(); renderSchedule(); renderNotes(); if (user.role === 'owner') { await loadEmployees(); renderEmployees(); } }
  $$('[data-admin-tab]').forEach(button => button.addEventListener('click', () => { const tab = button.dataset.adminTab; $$('[data-admin-tab]').forEach(item => item.classList.toggle('active', item === button)); $$('[data-admin-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.adminPanel === tab)); $('[data-admin-title]').textContent = button.textContent.replace(/\d+/, '').trim(); }));
  $('[data-product-form]').addEventListener('submit', event => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); const before = values.id ? store.getProduct(values.id) : null; store.upsertProduct({ ...values, stock: Number(values.stock), price: Number(values.price) }); if (before?.stock <= 0 && Number(values.stock) > 0) toast('Produto salvo e clientes em espera foram preparados para aviso.'); else toast('Produto salvo no catálogo.'); event.currentTarget.reset(); $('[data-product-form-title]').textContent = 'Novo produto'; $('[data-cancel-product]').hidden = true; renderAll(); });
  $('[data-cancel-product]').addEventListener('click', () => { $('[data-product-form]').reset(); $('[data-product-form-title]').textContent = 'Novo produto'; $('[data-cancel-product]').hidden = true; });
  $('[data-inventory-list]').addEventListener('click', event => { const edit = event.target.closest('[data-edit-product]'); const remove = event.target.closest('[data-remove-product]'); if (edit) { const product = store.getProduct(edit.dataset.editProduct); const form = $('[data-product-form]'); Object.entries(product).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; }); $('[data-product-form-title]').textContent = `Editando: ${product.name}`; $('[data-cancel-product]').hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'center' }); } if (remove) { const product = store.getProduct(remove.dataset.removeProduct); if (window.confirm(`Remover ${product.name} do catálogo?`)) { store.removeProduct(product.id); toast('Produto removido.'); renderAll(); } } });
  $('[data-schedule-form]').addEventListener('change', event => { if (event.target.type === 'checkbox') { const day = event.target.name.split('-')[1]; $$(`[name="open-${day}"], [name="close-${day}"]`).forEach(input => input.disabled = !event.target.checked); } });
  $('[data-schedule-form]').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); const schedule = {}; dayNames.forEach((_, day) => schedule[day] = { enabled: form.get(`enabled-${day}`) === 'on', open: form.get(`open-${day}`), close: form.get(`close-${day}`) }); store.setSchedule(schedule); toast('Horários atualizados no site.'); renderAll(); });
  $('[data-note-form]').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); store.addNote({ authorId: user.id, text: form.get('text') }); event.currentTarget.reset(); renderNotes(); toast('Anotação salva apenas para o seu usuário.'); });
  $('[data-employee-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const { name, email, password } = Object.fromEntries(new FormData(event.currentTarget));
    const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true;
    // Usa um app Firebase secundário só pra criar a conta, sem derrubar a sessão de quem está logado.
    const secondaryApp = firebase.apps.find(item => item.name === 'Secondary') || firebase.initializeApp(window.BRITOTEC_FIREBASE_CONFIG, 'Secondary');
    const secondaryAuth = secondaryApp.auth();
    try {
      const credential = await secondaryAuth.createUserWithEmailAndPassword(email.trim(), password);
      await db.collection('users').doc(credential.user.uid).set({ name, email: email.trim(), role: 'admin', active: true, createdAt: new Date().toISOString() });
      await secondaryAuth.signOut();
      event.currentTarget.reset();
      await loadEmployees(); renderEmployees();
      toast('Funcionário autorizado com sucesso.');
    } catch (error) { toast(authErrorMessage(error)); }
    finally { button.disabled = false; }
  });
  $('[data-employee-list]').addEventListener('click', async event => { const button = event.target.closest('[data-toggle-employee]'); if (!button) return; const employee = employeesCache.find(item => item.id === button.dataset.toggleEmployee); await db.collection('users').doc(employee.id).update({ active: !employee.active }); await loadEmployees(); renderEmployees(); toast(employee.active ? 'Acesso desativado.' : 'Acesso reativado.'); });
  $('[data-order-list]').addEventListener('click', async event => { const confirm = event.target.closest('[data-confirm-order]'); const view = event.target.closest('[data-view-photo]'); if (confirm) { const order = store.getOrders().find(item => item.id === confirm.dataset.confirmOrder); store.updateOrder(order.id, { status: 'confirmada', confirmedAt: new Date().toISOString(), confirmedBy: user.id }); const number = order.phone.replace(/\D/g, ''); const text = encodeURIComponent(`Olá, ${order.name}! Vimos sua ordem de serviço da BritoTec para ${order.model}. Em breve daremos continuidade ao atendimento.`); window.open(`https://wa.me/55${number}?text=${text}`, '_blank', 'noopener'); renderAll(); toast('Ordem confirmada e conversa do WhatsApp aberta.'); } if (view) { const file = await store.db.getPhoto(view.dataset.viewPhoto); const image = $(`[data-order-photo="${view.dataset.viewPhoto}"]`); if (file && image) { image.src = URL.createObjectURL(file); image.hidden = false; view.textContent = 'Foto carregada'; } else toast('A foto está disponível somente no navegador em que a ordem foi criada.'); } });
  $('[data-notice-list]').addEventListener('click', event => { const button = event.target.closest('[data-send-notice]'); if (!button) return; store.markNoticeSent(button.dataset.sendNotice); renderOverview(); toast('Aviso marcado como enviado.'); });
})();