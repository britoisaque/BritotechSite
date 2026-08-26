/* Dados do protótipo. Com Firebase configurado, substitua estas funções por Firestore/Storage. */
(() => {
  const prefix = 'britotec';
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(`${prefix}:${key}`)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(`${prefix}:${key}`, JSON.stringify(value));
  const makeId = (name = 'id') => `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const defaults = [
    { id: 'capinha', category: 'proteção', name: 'Case Shield Crystal', price: 39.90, stock: 8, image: 'https://images.unsplash.com/photo-1601593346740-925612772716?auto=format&fit=crop&w=900&q=85', badge: 'NOVO', color: 'lime' },
    { id: 'carregador', category: 'energia', name: 'Turbo Charge 30W', price: 89.90, stock: 5, image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=85', badge: 'BEST SELLER', color: 'blue' },
    { id: 'fone', category: 'áudio', name: 'Pulse Pods Bluetooth', price: 129.90, stock: 3, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85', badge: '', color: 'purple' },
    { id: 'suporte', category: 'setup', name: 'Stand Air Flex', price: 74.90, stock: 2, image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=900&q=85', badge: '', color: 'orange' },
    { id: 'cabo', category: 'energia', name: 'Cabo Type-C Titan', price: 29.90, stock: 14, image: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=900&q=85', badge: '', color: 'teal' },
    { id: 'magnet', category: 'setup', name: 'Magnetic Dock Pro', price: 59.90, stock: 0, image: 'https://images.unsplash.com/photo-1624705002806-5d72df19c3ad?auto=format&fit=crop&w=900&q=85', badge: '', color: 'red' }
  ];
  const defaultSchedule = { 0: { enabled: false, open: '09:00', close: '18:00' }, 1: { enabled: true, open: '09:00', close: '18:00' }, 2: { enabled: true, open: '09:00', close: '18:00' }, 3: { enabled: true, open: '09:00', close: '18:00' }, 4: { enabled: true, open: '09:00', close: '18:00' }, 5: { enabled: true, open: '09:00', close: '18:00' }, 6: { enabled: true, open: '09:00', close: '14:00' } };
  const seedOwner = window.BRITOTEC_ADMIN_SEED || { username: 'proprietario', password: 'ALTERE-ESTA-SENHA', name: 'Proprietário', role: 'owner' };

  const api = {
    id: makeId, read, write, defaults,
    getProducts: () => read('products', defaults),
    setProducts(products) { write('products', products); window.dispatchEvent(new Event('britotec:products')); },
    getProduct(id) { return api.getProducts().find(product => product.id === id); },
    upsertProduct(product) {
      const products = api.getProducts(); const index = products.findIndex(item => item.id === product.id);
      const old = index >= 0 ? products[index] : null;
      const next = { ...old, ...product, id: product.id || makeId('product'), price: Number(product.price), stock: Math.max(0, Number(product.stock)) };
      if (index >= 0) products[index] = next; else products.push(next);
      api.setProducts(products);
      if (old && old.stock <= 0 && next.stock > 0) api.queueRestockNotices(next.id);
      return next;
    },
    removeProduct(id) { api.setProducts(api.getProducts().filter(product => product.id !== id)); },
    getSchedule: () => read('schedule', defaultSchedule),
    setSchedule(schedule) { write('schedule', schedule); window.dispatchEvent(new Event('britotec:schedule')); },
    storeStatus() {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
      const value = type => parts.find(part => part.type === type)?.value;
      const week = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const day = week[value('weekday')]; const current = Number(value('hour')) * 60 + Number(value('minute'));
      const config = api.getSchedule()[day];
      const parse = time => { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute; };
      const open = !!config?.enabled && current >= parse(config.open) && current < parse(config.close);
      return { open, day, config, label: open ? `Aberta agora • até ${config.close}` : config?.enabled ? `Fechada agora • abre às ${config.open}` : 'Fechada hoje' };
    },
    getOrders: () => read('orders', []),
    saveOrder(order) { const orders = api.getOrders(); orders.unshift({ ...order, id: makeId('os'), status: 'novo', createdAt: new Date().toISOString() }); write('orders', orders); },
    updateOrder(id, changes) { write('orders', api.getOrders().map(order => order.id === id ? { ...order, ...changes } : order)); },
    getRestockRequests: () => read('restockRequests', []),
    addRestockRequest(request) { const requests = api.getRestockRequests(); if (!requests.some(item => item.productId === request.productId && item.email === request.email && item.status === 'pendente')) requests.unshift({ ...request, id: makeId('notice'), status: 'pendente', createdAt: new Date().toISOString() }); write('restockRequests', requests); },
    queueRestockNotices(productId) { const product = api.getProduct(productId); const requests = api.getRestockRequests(); const changed = requests.map(request => request.productId === productId && request.status === 'pendente' ? { ...request, status: 'pronto-para-enviar', productName: product?.name } : request); write('restockRequests', changed); },
    markNoticeSent(id) { write('restockRequests', api.getRestockRequests().map(request => request.id === id ? { ...request, status: 'enviado', sentAt: new Date().toISOString() } : request)); },
    getEmployees() { const employees = read('employees', null); if (employees) return employees; const owner = { id: 'owner', ...seedOwner, role: 'owner', active: true }; write('employees', [owner]); return [owner]; },
    saveEmployees(employees) { write('employees', employees); },
    addEmployee(employee) { const employees = api.getEmployees(); if (employees.some(item => item.username.toLowerCase() === employee.username.toLowerCase())) throw new Error('Esse usuário já existe.'); employees.push({ id: makeId('employee'), role: 'admin', active: true, ...employee }); api.saveEmployees(employees); },
    updateEmployee(id, changes) { api.saveEmployees(api.getEmployees().map(employee => employee.id === id ? { ...employee, ...changes } : employee)); },
    getNotes: () => read('notes', []),
    addNote(note) { const notes = api.getNotes(); notes.unshift({ ...note, id: makeId('note'), createdAt: new Date().toISOString() }); write('notes', notes); },
    getAlerts() {
      const productAlerts = api.getProducts().filter(product => product.stock === 0 || product.stock <= 2).map(product => ({ kind: product.stock === 0 ? 'danger' : 'warning', title: product.stock === 0 ? 'Produto esgotado' : 'Estoque baixo', text: `${product.name}: ${product.stock} unidade(s) disponível(is).` }));
      const orderAlerts = api.getOrders().filter(order => order.status === 'novo').map(order => ({ kind: 'info', title: 'Ordem sem resposta', text: `${order.name} • ${order.service} • ${order.model}` }));
      const restockAlerts = api.getRestockRequests().filter(request => request.status === 'pronto-para-enviar').map(request => ({ kind: 'info', title: 'Aviso de reposição pendente', text: `${request.productName} • ${request.email}` }));
      return [...productAlerts, ...orderAlerts, ...restockAlerts];
    },
    purchase(items) {
      const products = api.getProducts();
      for (const item of items) { const product = products.find(entry => entry.id === item.id); if (!product || product.stock < item.quantity) throw new Error(`${item.name} não possui estoque suficiente.`); }
      const updated = products.map(product => { const item = items.find(entry => entry.id === product.id); return item ? { ...product, stock: product.stock - item.quantity } : product; });
      api.setProducts(updated); return updated;
    },
    db: {
      open() { return new Promise((resolve, reject) => { const request = indexedDB.open('britotec-media', 1); request.onupgradeneeded = () => request.result.createObjectStore('photos'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); },
      async savePhoto(file) { if (!file) return null; const db = await api.db.open(); const id = makeId('photo'); await new Promise((resolve, reject) => { const tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').put({ file, name: file.name, type: file.type }, id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); return id; },
      async getPhoto(id) { if (!id) return null; const db = await api.db.open(); return new Promise((resolve, reject) => { const tx = db.transaction('photos', 'readonly'); const request = tx.objectStore('photos').get(id); request.onsuccess = () => resolve(request.result?.file || null); request.onerror = () => reject(request.error); }); }
    }
  };
  window.BritoTec = api;
})();
