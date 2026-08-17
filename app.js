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
  lastStatusMap: {},
  storeHours: null
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
    const resH = await fetch('/api/store-hours');
    if (resH.ok) {
      state.storeHours = await resH.json();
      updateStoreHeaderStatusUI();
    }
  } catch(e) {}

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

    // Populate complements (Livre - Nada marcado por padrão)
    const compContainer = document.getElementById('complements-options-container');
    if (compContainer && state.complements && state.complements.length) {
      let compsHtml = `
        <label class="checkbox-option" style="background: #f8fafc; border-color: #cbd5e1;">
          <input type="checkbox" id="chk-no-complement" onchange="toggleNoComplement(this)" />
          <div class="radio-content">
            <strong>❌ Sem Acompanhamentos</strong>
            <small>Desejo apenas o açaí puro no copo</small>
          </div>
        </label>
      `;

      compsHtml += state.complements.map(c => `
        <label class="checkbox-option">
          <input type="checkbox" name="acai-complement" value="${c.name}" onchange="handleComplementChange(this)" />
          <div class="radio-content">
            <strong>${c.name}</strong>
            <small>${c.desc}</small>
          </div>
        </label>
      `).join('');

      compContainer.innerHTML = compsHtml;
    }

    // Populate toppings extras (Livre - Opção "Sem Cobertura Extra")
    const topContainer = document.getElementById('toppings-options-container');
    if (topContainer && state.toppings) {
      let topHtml = `
        <label class="checkbox-option" style="background: #f8fafc; border-color: #cbd5e1;">
          <input type="checkbox" id="chk-no-topping" onchange="toggleNoTopping(this)" checked />
          <div class="radio-content">
            <strong>❌ Sem Cobertura Extra</strong>
            <small>Sem adicionais pagos</small>
          </div>
        </label>
      `;

      topHtml += state.toppings.map(t => {
        const pNum = parseFloat(t.price) || 0;
        return `
          <label class="checkbox-option">
            <input type="checkbox" name="acai-topping" value="${t.name}" data-price="${pNum}" onchange="handleToppingChange(this)" />
            <div class="radio-content">
              <strong>${t.icon || '🍫'} ${t.name} (+ R$ ${pNum.toFixed(2).replace('.', ',')})</strong>
            </div>
          </label>
        `;
      }).join('');

      topContainer.innerHTML = topHtml;
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

function toggleNoComplement(el) {
  if (el.checked) {
    document.querySelectorAll('input[name="acai-complement"]').forEach(i => i.checked = false);
  }
  calcBuilderTotal();
}

function handleComplementChange(el) {
  const noComp = document.getElementById('chk-no-complement');
  if (noComp && el.checked) {
    noComp.checked = false;
  }
  calcBuilderTotal();
}

function toggleNoTopping(el) {
  if (el.checked) {
    document.querySelectorAll('input[name="acai-topping"]').forEach(i => i.checked = false);
  }
  calcBuilderTotal();
}

function handleToppingChange(el) {
  const noTop = document.getElementById('chk-no-topping');
  if (noTop && el.checked) {
    noTop.checked = false;
  }
  calcBuilderTotal();
}

function calcBuilderTotal() {
  if (!state.activeBuilderSize) return;

  let total = state.activeBuilderSize.basePrice;

  // Complements extra fee (+ R$ 2,00 for each item beyond 3)
  const complementInputs = document.querySelectorAll('input[name="acai-complement"]:checked');
  if (complementInputs.length > 3) {
    total += (complementInputs.length - 3) * 2.00;
  }

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
  let compExtraFee = 0;
  if (comps.length > 3) {
    compExtraFee = (comps.length - 3) * 2.00;
  }
  
  // Toppings
  let extraCost = compExtraFee;
  const topps = Array.from(document.querySelectorAll('input[name="acai-topping"]:checked')).map(i => {
    extraCost += parseFloat(i.getAttribute('data-price')) || 0;
    return i.value;
  });

  const notes = document.getElementById('acai-notes').value.trim();

  let compText = comps.length ? `Acompanhamentos (${comps.length} sel${comps.length > 3 ? ' - ' + (comps.length - 3) + ' extra +R$ ' + compExtraFee.toFixed(2) : ''}): ${comps.join(', ')}` : 'Sem acompanhamentos';
  let topText = topps.length ? `Coberturas: ${topps.join(', ')}` : 'Sem cobertura extra';

  let detailsText = `${compText} | ${topText}`;
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
  if (!checkStoreOpenOrShowModal()) return;

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

        <div style="margin-top: 0.75rem; display: flex; justify-content: flex-end;">
          <button class="btn btn-purple btn-sm" onclick="openOrderReceiptModal('${o.id}')">
            <i class="fa-solid fa-receipt"></i> Ver Cupom / Comprovante
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// --- CUPOM / COMPROVANTE DIGITAL ---
let activeReceiptOrder = null;

function openOrderReceiptModal(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;

  activeReceiptOrder = order;

  const container = document.getElementById('receipt-modal-body');
  if (!container) return;

  const priceNum = parseFloat(order.total) || 0;

  container.innerHTML = `
    <div id="printable-receipt-content" style="background: #ffffff; border: 1px dashed #cbd5e1; padding: 1.25rem; border-radius: var(--radius-sm); font-family: 'Courier New', Courier, monospace; color: #0f172a;">
      <div style="text-align: center; border-bottom: 2px dashed #94a3b8; padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
        <h3 style="font-size: 1.1rem; font-weight: 900; margin-bottom: 2px;">🍧 MEUAÇAI DELIVERY</h3>
        <p style="font-size: 0.75rem;">O Melhor Açaí no Copo & Barcas</p>
        <p style="font-size: 0.7rem;">Balneário Camboriú - SC • Tel/WA: (47) 99999-8888</p>
      </div>

      <div style="font-size: 0.78rem; border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
        <div><strong>PEDIDO Nº:</strong> <span style="font-weight: 900; color: #7e22ce;">${order.id}</span></div>
        <div><strong>DATA/HORA:</strong> ${order.date || 'Hoje'}</div>
        <div><strong>CLIENTE:</strong> ${order.clientName || 'Cliente'}</div>
        <div><strong>TELEFONE:</strong> ${order.clientPhone || 'Não informado'}</div>
        <div><strong>ENDEREÇO:</strong> ${order.address}</div>
      </div>

      <div style="font-size: 0.78rem; border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
        <div style="font-weight: 800; margin-bottom: 4px;">ITENS DO PEDIDO:</div>
        <p style="white-space: pre-wrap; font-size: 0.75rem; line-height: 1.4;">${order.items}</p>
      </div>

      <div style="font-size: 0.82rem; font-weight: 800; display: flex; justify-content: space-between; border-bottom: 2px dashed #94a3b8; padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
        <span>FORMA PAGO: ${order.paymentMethod || 'PIX / Cartão'}</span>
        <span style="font-size: 1rem; color: #7e22ce;">TOTAL: R$ ${priceNum.toFixed(2).replace('.', ',')}</span>
      </div>

      <div style="text-align: center; font-size: 0.7rem; color: #64748b;">
        <p>Agradecemos a sua preferência!</p>
        <p>Volte Sempre! 🍧💜</p>
      </div>
    </div>
  `;

  const modal = document.getElementById('modal-receipt');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

function closeReceiptModal() {
  const modal = document.getElementById('modal-receipt');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

function sendReceiptWhatsApp() {
  if (!activeReceiptOrder) return;
  const o = activeReceiptOrder;
  const priceNum = parseFloat(o.total) || 0;

  const msg = `*🍧 COMPROVANTE MEUAÇAI DELIVERY*%0A` +
    `*Pedido:* ${o.id}%0A` +
    `*Data:* ${o.date || 'Hoje'}%0A` +
    `*Cliente:* ${o.clientName}%0A` +
    `*Endereço:* ${o.address}%0A%0A` +
    `*Itens:* ${o.items}%0A%0A` +
    `*Pagamento:* ${o.paymentMethod}%0A` +
    `*TOTAL:* R$ ${priceNum.toFixed(2).replace('.', ',')}%0A%0A` +
    `_Obrigado pela preferência! Bom açaí! 🍧💜_`;

  const phone = o.clientPhone ? o.clientPhone.replace(/\D/g, '') : '5547999998888';
  window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${msg}`, '_blank');
}

function printOrderReceipt() {
  const content = document.getElementById('printable-receipt-content');
  if (!content) return;

  const printWin = window.open('', '', 'width=400,height=600');
  printWin.document.write(`
    <html>
      <head>
        <title>Cupom - ${activeReceiptOrder ? activeReceiptOrder.id : 'Pedido'}</title>
        <style>
          body { font-family: monospace; padding: 10px; margin: 0; }
          @media print {
            @page { margin: 0; size: auto; }
          }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
    </html>
  `);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => {
    printWin.print();
    printWin.close();
  }, 250);
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

function isStoreCurrentlyOpen(storeHours) {
  if (!storeHours) return true;

  if (storeHours.manualStatus === 'open') return true;
  if (storeHours.manualStatus === 'closed') return false;

  const now = new Date();
  const currentDay = now.getDay();
  
  if (storeHours.daysOpen && Array.isArray(storeHours.daysOpen)) {
    const daysAsInts = storeHours.daysOpen.map(Number);
    if (!daysAsInts.includes(currentDay)) {
      return false;
    }
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [openH, openM] = (storeHours.openTime || '11:00').split(':').map(Number);
  const [closeH, closeM] = (storeHours.closeTime || '23:00').split(':').map(Number);

  const openMinutes = openH * 60 + openM;
  let closeMinutes = closeH * 60 + closeM;

  if (closeMinutes < openMinutes) {
    closeMinutes += 24 * 60;
    if (currentMinutes < openMinutes) {
      const adjustedCurrent = currentMinutes + 24 * 60;
      return adjustedCurrent >= openMinutes && adjustedCurrent < closeMinutes;
    }
  }

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

function updateStoreHeaderStatusUI() {
  const displayEl = document.getElementById('delivery-address-display');
  if (!displayEl) return;

  const isOpen = isStoreCurrentlyOpen(state.storeHours);
  const openTime = state.storeHours?.openTime || '11:00';
  const closeTime = state.storeHours?.closeTime || '23:00';

  if (isOpen) {
    displayEl.innerHTML = `<span style="color: #16a34a; font-weight: 800;"><i class="fa-solid fa-circle-check"></i> ABERTO AGORA</span> • Entregas em BC (${openTime} - ${closeTime})`;
  } else {
    displayEl.innerHTML = `<span style="color: #dc2626; font-weight: 800;"><i class="fa-solid fa-circle-xmark"></i> FECHADO NO MOMENTO</span> • Cardápio para Consulta (${openTime} - ${closeTime})`;
  }
}

function checkStoreOpenOrShowModal() {
  const isOpen = isStoreCurrentlyOpen(state.storeHours);
  if (!isOpen) {
    const titleEl = document.getElementById('store-closed-modal-title');
    const msgEl = document.getElementById('store-closed-modal-msg');
    
    const openTime = state.storeHours?.openTime || '11:00';
    const closeTime = state.storeHours?.closeTime || '23:00';
    const customMsg = state.storeHours?.closedMessage || `🔴 Loja Fechada no Momento! Nosso horário de funcionamento é das ${openTime} às ${closeTime}. Fique à vontade para olhar nosso cardápio!`;

    if (titleEl) titleEl.innerText = 'Estamos Fechados!';
    if (msgEl) msgEl.innerText = customMsg;

    const modal = document.getElementById('modal-store-closed');
    if (modal) modal.classList.add('active');
    return false;
  }
  return true;
}

function closeStoreClosedModal() {
  const modal = document.getElementById('modal-store-closed');
  if (modal) modal.classList.remove('active');
}
