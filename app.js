/* ==========================================
   MEUAÇAI - JAVASCRIPT APP LOGIC
   ========================================== */

const state = {
  cart: [],
  orders: [],
  acaiSizes: {
    copo300: 14.00,
    copo500: 18.00,
    copo700: 24.00,
    tigela1000: 32.00
  },
  complements: [],
  toppings: [],
  drinks: [],
  currentUser: null,
  rewards: [],
  activeBuilderSize: null,
  lastStatusMap: {}
};

// Load saved user session if exists
try {
  const savedUser = localStorage.getItem('meuacai_customer');
  if (savedUser) state.currentUser = JSON.parse(savedUser);
} catch(e) {}

document.addEventListener('DOMContentLoaded', () => {
  loadStateFromStorage();
  setInterval(loadStateFromStorage, 15000);
});

async function loadStateFromStorage() {
  try {
    const res = await fetch('/api/orders');
    if (res.ok) {
      const orders = await res.json();
      
      // Sound alerts on status updates
      if (state.lastStatusMap && state.currentUser) {
        orders.forEach(o => {
          if (o.clientPhone === state.currentUser.phone) {
            const prev = state.lastStatusMap[o.id];
            if (prev && prev !== o.status) {
              if (o.status === 'SAIU_ENTREGA') {
                showToast(`🛵 Seu açaí ${o.id} SAIU PARA ENTREGA!`, 'info');
                playNotificationSound('status');
              } else if (o.status === 'ENTREGUE') {
                showToast(`🎉 Seu açaí ${o.id} FOI ENTREGUE! Bom apetite!`, 'success');
                playNotificationSound('status');
              }
            }
          }
        });
      }

      state.lastStatusMap = {};
      orders.forEach(o => { state.lastStatusMap[o.id] = o.status; });
      state.orders = orders;
    }
  } catch (e) {}

  try {
    const resS = await fetch('/api/acai-sizes');
    if (resS.ok) {
      const sizes = await resS.json();
      state.acaiSizes = sizes;
      updateDynamicCardPrices(sizes);
    }
  } catch(e) {}

  try {
    const resC = await fetch('/api/complements');
    if (resC.ok) state.complements = await resC.json();
  } catch(e) {}

  try {
    const resT = await fetch('/api/toppings');
    if (resT.ok) state.toppings = await resT.json();
  } catch(e) {}

  try {
    const resD = await fetch('/api/drinks');
    if (resD.ok) {
      state.drinks = await resD.json();
      renderDrinksCatalog();
    }
  } catch(e) {}

  renderUserOrdersTracker();
}

function updateDynamicCardPrices(sizes) {
  const p300 = document.getElementById('card-price-copo300');
  const p500 = document.getElementById('card-price-copo500');
  const p700 = document.getElementById('card-price-copo700');
  const p1000 = document.getElementById('card-price-tigela1000');

  if (p300 && sizes.copo300) p300.innerText = `R$ ${(parseFloat(sizes.copo300) || 14.00).toFixed(2).replace('.', ',')}`;
  if (p500 && sizes.copo500) p500.innerText = `R$ ${(parseFloat(sizes.copo500) || 18.00).toFixed(2).replace('.', ',')}`;
  if (p700 && sizes.copo700) p700.innerText = `R$ ${(parseFloat(sizes.copo700) || 24.00).toFixed(2).replace('.', ',')}`;
  if (p1000 && sizes.tigela1000) p1000.innerText = `R$ ${(parseFloat(sizes.tigela1000) || 32.00).toFixed(2).replace('.', ',')}`;
}

function setFulfillmentMode(mode) {
  const btnDev = document.getElementById('f-btn-delivery');
  const btnPick = document.getElementById('f-btn-pickup');
  const addrDisplay = document.getElementById('delivery-address-display');

  if (mode === 'delivery') {
    btnDev.classList.add('active');
    btnPick.classList.remove('active');
    if (addrDisplay) addrDisplay.innerText = 'Entregar em: Centro, Balneário Camboriú (20-30 min)';
  } else {
    btnPick.classList.add('active');
    btnDev.classList.remove('active');
    if (addrDisplay) addrDisplay.innerText = 'Retirar na Loja: Av. Brasil, 1200 - Centro (10-15 min)';
  }
  updateDeliveryFeeBC();
}

function scrollToSection(secId, pillEl) {
  if (pillEl) {
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    pillEl.classList.add('active');
  }
  const target = document.getElementById(secId);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' });
  }
}

// Render Drinks Catalog
function renderDrinksCatalog() {
  const container = document.getElementById('drinks-container');
  if (!container) return;

  container.innerHTML = state.drinks.map(d => {
    const priceNum = parseFloat(d.price) || 0;
    return `
      <div class="item-row-card">
        <div class="item-row-info">
          <h5>${d.icon || '🥤'} ${d.name}</h5>
          <span>R$ ${priceNum.toFixed(2).replace('.', ',')}</span>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="addDrinkToCart('${d.id}')">
          <i class="fa-solid fa-plus text-purple"></i> Adicionar
        </button>
      </div>
    `;
  }).join('');
}

// Acai Builder Modal Logic
function openAcaiBuilderModal(key, title, fallbackPrice) {
  try {
    let basePrice = parseFloat(fallbackPrice) || 14.00;
    if (state.acaiSizes && state.acaiSizes[key]) {
      basePrice = parseFloat(state.acaiSizes[key]) || basePrice;
    }

    state.activeBuilderSize = { key, title, basePrice };

    const titleEl = document.getElementById('builder-modal-title');
    const priceEl = document.getElementById('builder-modal-price');
    if (titleEl) titleEl.innerText = `Montar ${title}`;
    if (priceEl) priceEl.innerText = `Valor Base: R$ ${basePrice.toFixed(2).replace('.', ',')}`;

    // Populate complements grátis
    const compContainer = document.getElementById('complements-options-container');
    if (compContainer && state.complements && state.complements.length) {
      compContainer.innerHTML = state.complements.map(c => `
        <label class="checkbox-option">
          <input type="checkbox" name="acai-complement" value="${c.name}" checked />
          <div class="radio-content">
            <strong>${c.name}</strong>
            <small>${c.desc}</small>
          </div>
        </label>
      `).join('');
    }

    // Populate toppings extras
    const topContainer = document.getElementById('toppings-options-container');
    if (topContainer && state.toppings) {
      topContainer.innerHTML = state.toppings.map(t => {
        const pNum = parseFloat(t.price) || 0;
        return `
          <label class="checkbox-option">
            <input type="checkbox" name="acai-topping" value="${t.name}" data-price="${pNum}" onchange="calcBuilderTotal()" />
            <div class="radio-content">
              <strong>${t.icon || '🍫'} ${t.name} (+ R$ ${pNum.toFixed(2).replace('.', ',')})</strong>
            </div>
          </label>
        `;
      }).join('');
    }

    const notesEl = document.getElementById('acai-notes');
    if (notesEl) notesEl.value = '';

    calcBuilderTotal();
  } catch(e) {
    console.error('Erro ao abrir modal builder:', e);
  }

  const modal = document.getElementById('modal-acai-builder');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

function closeAcaiBuilderModal() {
  const modal = document.getElementById('modal-acai-builder');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

function calcBuilderTotal() {
  if (!state.activeBuilderSize) return;

  let total = state.activeBuilderSize.basePrice;

  // Selected toppings
  const toppingInputs = document.querySelectorAll('input[name="acai-topping"]:checked');
  toppingInputs.forEach(input => {
    const extraPrice = parseFloat(input.getAttribute('data-price')) || 0;
    total += extraPrice;
  });

  const totalEl = document.getElementById('builder-total-price');
  if (totalEl) totalEl.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

function addAcaiToCartFromBuilder() {
  if (!state.activeBuilderSize) return;

  const { title, basePrice } = state.activeBuilderSize;

  // Complements
  const comps = Array.from(document.querySelectorAll('input[name="acai-complement"]:checked')).map(i => i.value);
  
  // Toppings
  let extraCost = 0;
  const topps = Array.from(document.querySelectorAll('input[name="acai-topping"]:checked')).map(i => {
    extraCost += parseFloat(i.getAttribute('data-price')) || 0;
    return i.value;
  });

  const notes = document.getElementById('acai-notes').value.trim();

  let detailsText = `Comps: ${comps.length ? comps.join(', ') : 'Nenhum'}`;
  if (topps.length) detailsText += ` | Coberturas: ${topps.join(', ')}`;
  if (notes) detailsText += ` | Obs: ${notes}`;

  const itemTotal = basePrice + extraCost;

  state.cart.push({
    id: 'item_' + Date.now(),
    type: 'acai',
    title: title,
    details: detailsText,
    price: itemTotal,
    qty: 1
  });

  updateCartUI();
  closeAcaiBuilderModal();
  showToast(`🍧 ${title} adicionado ao pedido!`, 'success');
}

function addDrinkToCart(drinkId) {
  const drink = state.drinks.find(d => d.id === drinkId);
  if (!drink) return;

  state.cart.push({
    id: 'item_' + Date.now(),
    type: 'drink',
    title: drink.name,
    details: 'Geladinha',
    price: parseFloat(drink.price) || 0,
    qty: 1
  });

  updateCartUI();
  showToast(`🥤 ${drink.name} adicionado ao pedido!`, 'success');
}

function updateCartUI() {
  const itemsContainer = document.getElementById('cart-items-container');
  const stickyBar = document.getElementById('sticky-cart-bar');
  const stickyCount = document.getElementById('sticky-cart-count');
  const stickyPreview = document.getElementById('sticky-cart-items-preview');
  const stickyTotal = document.getElementById('sticky-cart-total');
  const bottomBadge = document.getElementById('bottom-cart-badge');

  const totalItems = state.cart.reduce((s, i) => s + i.qty, 0);
  let subtotal = state.cart.reduce((s, i) => s + (i.price * i.qty), 0);

  if (bottomBadge) bottomBadge.innerText = totalItems;
  if (stickyCount) stickyCount.innerText = totalItems;

  if (totalItems > 0) {
    if (stickyBar) stickyBar.style.display = 'flex';
    if (stickyPreview) stickyPreview.innerText = `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`;
  } else {
    if (stickyBar) stickyBar.style.display = 'none';
  }

  if (itemsContainer) {
    if (state.cart.length === 0) {
      itemsContainer.innerHTML = `<p style="text-align: center; color: var(--color-gray); padding: 1rem;">Seu pedido está vazio. Escolha um açaí para começar! 🍧</p>`;
    } else {
      itemsContainer.innerHTML = state.cart.map((item, idx) => `
        <div style="background: #faf5ff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.85rem; position: relative;">
          <button onclick="removeFromCart(${idx})" style="position: absolute; top: 8px; right: 8px; border: none; background: transparent; color: #ef4444; font-size: 0.9rem; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
          <strong style="display: block; font-size: 0.9rem; color: var(--color-dark);">${item.title}</strong>
          <small style="display: block; font-size: 0.75rem; color: var(--color-gray); margin-top: 2px;">${item.details}</small>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
            <strong style="color: var(--color-primary); font-size: 0.95rem;">R$ ${(item.price * item.qty).toFixed(2).replace('.', ',')}</strong>
            <div style="display: flex; align-items: center; gap: 0.5rem; background: #ffffff; border: 1px solid var(--border-color); border-radius: 12px; padding: 2px 8px;">
              <button onclick="changeCartQty(${idx}, -1)" style="border: none; background: transparent; color: var(--color-primary); font-weight: 800; cursor: pointer;">-</button>
              <span style="font-size: 0.82rem; font-weight: 800;">${item.qty}</span>
              <button onclick="changeCartQty(${idx}, 1)" style="border: none; background: transparent; color: var(--color-primary); font-weight: 800; cursor: pointer;">+</button>
            </div>
          </div>
        </div>
      `).join('');
    }
  }

  const subtotalEl = document.getElementById('cart-subtotal');
  if (subtotalEl) subtotalEl.innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;

  updateDeliveryFeeBC();
}

function changeCartQty(idx, delta) {
  if (state.cart[idx]) {
    state.cart[idx].qty += delta;
    if (state.cart[idx].qty <= 0) {
      state.cart.splice(idx, 1);
    }
    updateCartUI();
  }
}

function removeFromCart(idx) {
  state.cart.splice(idx, 1);
  updateCartUI();
}

function clearCart() {
  state.cart = [];
  updateCartUI();
}

function updateDeliveryFeeBC() {
  const selectBairro = document.getElementById('checkout-bairro-bc');
  let fee = 3.00;
  if (selectBairro) {
    const opt = selectBairro.options[selectBairro.selectedIndex];
    if (opt) fee = parseFloat(opt.getAttribute('data-fee')) || 3.00;
  }

  const feeEl = document.getElementById('cart-fee-display');
  if (feeEl) feeEl.innerText = `R$ ${fee.toFixed(2).replace('.', ',')}`;

  let subtotal = state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
  let total = subtotal + fee;

  const totalEl = document.getElementById('cart-total-price');
  const stickyTotal = document.getElementById('sticky-cart-total');
  if (totalEl) totalEl.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
  if (stickyTotal) stickyTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

function toggleCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-drawer-overlay');

  if (!drawer || !overlay) return;

  const isOpen = drawer.style.transform === 'translateX(0%)';
  if (isOpen) {
    drawer.style.transform = 'translateX(100%)';
    overlay.classList.remove('active');
  } else {
    drawer.style.transform = 'translateX(0%)';
    overlay.classList.add('active');
  }
}

function proceedToCheckoutPayment() {
  if (state.cart.length === 0) {
    showToast('Adicione pelo menos um item para finalizar o pedido.', 'warning');
    return;
  }

  const address = document.getElementById('checkout-address-input').value.trim();
  if (!address) {
    showToast('Preencha seu endereço de entrega em Balneário Camboriú.', 'warning');
    return;
  }

  const method = document.getElementById('checkout-payment-method').value;
  if (method === 'pix') {
    document.getElementById('cart-step-items').style.display = 'none';
    document.getElementById('cart-step-pix').style.display = 'block';
    document.getElementById('cart-footer-actions').style.display = 'none';
  } else {
    confirmPaymentAndSendToKitchen();
  }
}

function copyPixCode() {
  const input = document.getElementById('pix-copy-input');
  if (input) {
    input.select();
    document.execCommand('copy');
    showToast('Chave PIX copiada com sucesso!', 'success');
  }
}

async function confirmPaymentAndSendToKitchen() {
  const address = document.getElementById('checkout-address-input').value.trim();
  const selectBairro = document.getElementById('checkout-bairro-bc');
  const bairro = selectBairro ? selectBairro.value : 'Centro';

  const itemsText = state.cart.map(i => `${i.qty}x ${i.title}`).join(' | ');

  let subtotal = state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
  let fee = 3.00;
  if (selectBairro) {
    const opt = selectBairro.options[selectBairro.selectedIndex];
    if (opt) fee = parseFloat(opt.getAttribute('data-fee')) || 3.00;
  }
  let total = subtotal + fee;

  const clientName = state.currentUser ? state.currentUser.name : 'Cliente Açaí BC';
  const clientPhone = state.currentUser ? state.currentUser.phone : '';

  const newOrder = {
    id: 'ACAI-' + Math.floor(1000 + Math.random() * 9000),
    clientName: clientName,
    clientPhone: clientPhone,
    address: `${address}, Bairro: ${bairro} (Balneário Camboriú)`,
    items: itemsText,
    total: total,
    paymentMethod: 'PIX / Cartão',
    status: 'EM_PREPARO',
    date: 'Hoje, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  try {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrder)
    });
  } catch (e) {}

  state.orders.unshift(newOrder);
  clearCart();
  toggleCartDrawer();

  // Reset drawer steps
  document.getElementById('cart-step-items').style.display = 'block';
  document.getElementById('cart-step-pix').style.display = 'none';
  document.getElementById('cart-footer-actions').style.display = 'flex';

  openMyOrdersModal();
  playNotificationSound('status');
  showToast('Pedido de açaí enviado para a loja! Acompanhe o preparo ao vivo.', 'success');
}

function playNotificationSound(type = 'status') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.2);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch(e) {}
}

// User Orders Tracker Modal
function renderUserOrdersTracker() {
  const container = document.getElementById('user-orders-tracker-list');
  if (!container) return;

  if (state.orders.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--color-gray);">Você ainda não fez pedidos hoje.</p>`;
    return;
  }

  container.innerHTML = state.orders.map(o => {
    const priceNum = parseFloat(o.total) || 0;
    return `
      <div style="background: #faf5ff; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1rem; box-shadow: var(--shadow-sm);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <h4 style="font-family: var(--font-heading); font-size: 1.1rem; color: var(--color-dark);">MEUAÇAI</h4>
          <strong style="color: var(--color-primary);">${o.id}</strong>
        </div>
        <p style="font-size: 0.8rem; color: var(--color-gray); margin-bottom: 0.75rem;">${o.items}</p>
        <small style="display: block; color: var(--color-dark); font-weight: 700; margin-bottom: 0.5rem;">📍 ${o.address}</small>
        
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 800; padding: 0.5rem 0; border-top: 1px dashed var(--border-color);">
          <span>Total: R$ ${priceNum.toFixed(2).replace('.', ',')}</span>
          <span style="color: #166534;">${o.paymentMethod}</span>
        </div>

        <div style="margin-top: 0.75rem; background: #ffffff; padding: 0.85rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <strong style="font-size: 0.78rem; color: var(--color-gray); display: block; margin-bottom: 0.5rem;">RASTREAMENTO DO SEU AÇAÍ EM BC:</strong>
          
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; font-weight: 800; position: relative;">
            <div style="text-align: center; color: ${o.status === 'EM_PREPARO' ? 'var(--color-primary)' : '#64748b'};">
              <i class="fa-solid fa-ice-cream" style="font-size: 1.2rem; display: block; margin-bottom: 2px;"></i>
              <span>🍧 Montando</span>
            </div>
            <div style="text-align: center; color: ${o.status === 'SAIU_ENTREGA' ? 'var(--color-primary)' : '#64748b'};">
              <i class="fa-solid fa-motorcycle" style="font-size: 1.2rem; display: block; margin-bottom: 2px;"></i>
              <span>🛵 A Caminho</span>
            </div>
            <div style="text-align: center; color: ${o.status === 'ENTREGUE' ? '#166534' : '#64748b'};">
              <i class="fa-solid fa-circle-check" style="font-size: 1.2rem; display: block; margin-bottom: 2px;"></i>
              <span>🎉 Entregue</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// --- PROGRAMA DE FIDELIDADE (JS) ---
function openLoyaltyModal() {
  const modal = document.getElementById('modal-loyalty');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
  updateLoyaltyUI();
  fetchRewardsCatalog();
}

function closeLoyaltyModal() {
  const modal = document.getElementById('modal-loyalty');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

function switchLoyaltyAuthTab(tab) {
  const btnLogin = document.getElementById('btn-loyalty-tab-login');
  const btnReg = document.getElementById('btn-loyalty-tab-reg');
  const formLogin = document.getElementById('form-loyalty-login');
  const formReg = document.getElementById('form-loyalty-register');

  if (tab === 'login') {
    btnLogin.classList.add('active');
    btnReg.classList.remove('active');
    formLogin.style.display = 'block';
    formReg.style.display = 'none';
  } else {
    btnReg.classList.add('active');
    btnLogin.classList.remove('active');
    formReg.style.display = 'block';
    formLogin.style.display = 'none';
  }
}

async function handleLoyaltyRegister(e) {
  e.preventDefault();
  const name = document.getElementById('loyalty-reg-name').value.trim();
  const rawPhone = document.getElementById('loyalty-reg-phone').value.trim();
  const phone = rawPhone.replace(/\D/g, '');
  const password = document.getElementById('loyalty-reg-pass').value.trim();

  try {
    const res = await fetch('/api/customers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, password })
    });
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      state.currentUser = data.customer;
      localStorage.setItem('meuacai_customer', JSON.stringify(state.currentUser));
      showToast(data.message || 'Conta criada com sucesso! Você ganhou 20 pontos de bônus!', 'success');
      updateLoyaltyUI();
    } else {
      showToast(data.message || 'Erro ao criar conta.', 'warning');
    }
  } catch(e) {
    showToast('Erro de conexão ao cadastrar.', 'warning');
  }
}

async function handleLoyaltyLogin(e) {
  e.preventDefault();
  const rawPhone = document.getElementById('loyalty-login-phone').value.trim();
  const phone = rawPhone.replace(/\D/g, '');
  const password = document.getElementById('loyalty-login-pass').value.trim();

  try {
    const res = await fetch('/api/customers/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      state.currentUser = data.customer;
      localStorage.setItem('meuacai_customer', JSON.stringify(state.currentUser));
      showToast(`Bem-vindo de volta, ${state.currentUser.name}!`, 'success');
      updateLoyaltyUI();
    } else {
      showToast(data.message || 'WhatsApp ou senha incorretos. Se for seu primeiro acesso, clique na aba "Criar Nova Conta" ao lado!', 'warning');
    }
  } catch(e) {
    showToast('Erro de conexão ao entrar.', 'warning');
  }
}

function handleLoyaltyLogout() {
  state.currentUser = null;
  localStorage.removeItem('meuacai_customer');
  updateLoyaltyUI();
  showToast('Você saiu do Clube Fidelidade.', 'info');
}

function updateLoyaltyUI() {
  const authContainer = document.getElementById('loyalty-auth-container');
  const userContainer = document.getElementById('loyalty-user-container');

  if (state.currentUser) {
    if (authContainer) authContainer.style.display = 'none';
    if (userContainer) userContainer.style.display = 'block';

    const nameEl = document.getElementById('loyalty-user-name');
    const ptsEl = document.getElementById('loyalty-user-points');
    if (nameEl) nameEl.innerText = state.currentUser.name;
    if (ptsEl) ptsEl.innerText = state.currentUser.points;
  } else {
    if (authContainer) authContainer.style.display = 'block';
    if (userContainer) userContainer.style.display = 'none';
  }
}

async function fetchRewardsCatalog() {
  try {
    const res = await fetch('/api/rewards');
    if (res.ok) {
      state.rewards = await res.json();
      renderRewardsCatalog();
    }
  } catch(e) {}
}

function renderRewardsCatalog() {
  const container = document.getElementById('rewards-catalog-list');
  if (!container) return;

  const userPts = state.currentUser ? state.currentUser.points : 0;

  container.innerHTML = state.rewards.map(reward => {
    const canRedeem = userPts >= reward.points;
    const valNum = parseFloat(reward.value || 0);

    return `
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow-sm);">
        <div>
          <strong style="font-size: 0.95rem; color: var(--color-dark); display: block;">${reward.icon || '🎁'} ${reward.name}</strong>
          <small style="font-size: 0.75rem; color: var(--color-gray); display: block; margin-top: 2px;">${reward.desc}</small>
          <span style="font-size: 0.8rem; font-weight: 800; color: var(--color-primary); margin-top: 4px; display: inline-block;">👑 ${reward.points} Pontos</span>
        </div>
        <button class="btn ${canRedeem ? 'btn-purple' : 'btn-secondary'} btn-sm" ${canRedeem ? '' : 'disabled'} onclick="redeemRewardItem('${reward.id}')">
          ${canRedeem ? '<i class="fa-solid fa-gift"></i> Resgatar' : 'Pontos Insuficientes'}
        </button>
      </div>
    `;
  }).join('');
}

async function redeemRewardItem(rewardId) {
  if (!state.currentUser) return;
  const reward = state.rewards.find(r => r.id === rewardId);
  if (!reward) return;

  try {
    const res = await fetch('/api/customers/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: state.currentUser.phone, points: reward.points })
    });
    const data = await res.json();

    if (res.ok && data.status === 'ok') {
      state.currentUser = data.customer;
      localStorage.setItem('meuacai_customer', JSON.stringify(state.currentUser));

      // Add reward item to cart
      state.cart.push({
        id: 'rew_cart_' + Date.now(),
        type: 'reward',
        title: `🎁 PRÊMIO: ${reward.name}`,
        details: 'Resgate do Clube Fidelidade MeuAçai',
        price: reward.type === 'discount' ? -reward.value : 0.00,
        qty: 1
      });

      updateCartUI();
      updateLoyaltyUI();
      closeLoyaltyModal();
      showToast(`🎉 Você resgatou "${reward.name}"! Prêmio adicionado ao seu pedido.`, 'success');
    } else {
      showToast(data.message || 'Erro ao resgatar.', 'warning');
    }
  } catch(e) {
    showToast('Erro de conexão ao resgatar.', 'warning');
  }
}

function openMyOrdersModal() {
  const modal = document.getElementById('modal-my-orders');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
  renderUserOrdersTracker();
}

function closeMyOrdersModal() {
  const modal = document.getElementById('modal-my-orders');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'warning') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
