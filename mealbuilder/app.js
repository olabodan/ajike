let MENU = null
let STATE = {
  step: 1,
  current: {
    item: null,
    size: null,
    modifiers: {},
    quantity: 1
  },
  cart: []
}
/** Returns the display currency symbol configured in mealbuilder/menu.json (with sensible fallbacks). */
const currencySymbol = () => {
  const code = MENU?.meta?.currency
  const symbol = MENU?.meta?.currency_symbol
  if (symbol) return symbol
  if (code === 'GBP') return '£'
  if (code === 'USD') return '$'
  if (code === 'EUR') return '€'
  if (code === 'NGN') return '₦'
  return code || ''
}
const el = s => document.querySelector(s)
const els = s => Array.from(document.querySelectorAll(s))
/** Formats numeric amounts using the locale configured in mealbuilder/menu.json. */
const fmt = (n) => {
  const locale = MENU?.meta?.locale || 'en-GB'
  return Intl.NumberFormat(locale).format(Math.round(n))
}
const show = id => { const x = el(id); x.classList.remove('hidden'); x.style.opacity = '1' }
const hide = id => { const x = el(id); x.classList.add('hidden'); x.style.opacity = '0' }
const activateProgress = step => {
  els('.progress-step').forEach(e => e.classList.toggle('active', Number(e.dataset.step) === step))
}
const scrollToStep = stepId => {
  const target = el(stepId)
  if (!target) return
  const header = document.querySelector('.app-header')
  const headerOffset = header ? header.getBoundingClientRect().height : 0
  const top = window.scrollY + target.getBoundingClientRect().top - headerOffset - 12
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}
const setStep = s => {
  STATE.step = s
  activateProgress(s)
  hide('#step-1'); hide('#step-2'); hide('#step-3'); hide('#step-4'); hide('#step-5')
  show(`#step-${s}`)
  requestAnimationFrame(() => scrollToStep(`#step-${s}`))
}
const findGroup = id => MENU.modifier_groups.find(g => g.id === id)
const findModifier = id => MENU.modifiers.find(m => m.id === id)
const getItemGroups = (item) => (item.modifier_groups || []).map(id => findGroup(id)).filter(Boolean)
const itemUnitPrice = (item, qty) => {
  let base = item.price
  const promo = item.promo && item.promo.discount ? item.promo.discount : 0
  if (promo > 0) base = base * (1 - promo / 100)
  let bulkDiscount = 0
  if (item.bulk && item.bulk.allowed && Array.isArray(item.bulk.bulk_discounts)) {
    item.bulk.bulk_discounts.sort((a,b)=>a.qty-b.qty).forEach(bd => {
      if (qty >= bd.qty) bulkDiscount = bd.discount
    })
  }
  if (bulkDiscount > 0) base = base * (1 - bulkDiscount / 100)
  return base
}
const itemTotalModifiers = (mods) => {
  let t = 0
  Object.values(mods).flat().forEach(mid => {
    const m = findModifier(mid)
    if (!m || (m.availability && m.availability.available === false)) return
    t += m.price || 0
  })
  return t
}
const currentLineTotal = () => {
  const i = STATE.current.item
  if (!i) return 0
  const qty = STATE.current.quantity
  const unit = itemUnitPrice(i, qty)
  const mods = itemTotalModifiers(STATE.current.modifiers)
  return qty * (unit + mods)
}
const cartTotal = () => {
  return STATE.cart.reduce((acc, line) => {
    const unit = itemUnitPrice(line.item, line.quantity)
    const mods = itemTotalModifiers(line.modifiers)
    return acc + line.quantity * (unit + mods)
  }, 0)
}
// Get item object from MENU by id
function getItemById(id) {
  return MENU.items.find(x => x.id === id)
}
// Convert cart lines into a compact JSON-safe structure
function serializeCart() {
  return STATE.cart.map(line => ({
    itemId: line.item.id,
    size: line.size,
    modifiers: line.modifiers,
    quantity: line.quantity
  }))
}
// Convert compact cart data back into full cart lines with item objects
function deserializeCart(data) {
  if (!Array.isArray(data)) return []
  return data.map(x => ({
    item: getItemById(x.itemId),
    size: x.size || null,
    modifiers: x.modifiers || {},
    quantity: Number(x.quantity) || 1
  })).filter(line => !!line.item)
}
// Save cart to localStorage
function persistCart() {
  try {
    localStorage.setItem('ajike_cart', JSON.stringify(serializeCart()))
  } catch (e) {}
}
// Load cart from localStorage after MENU is available
function loadCart() {
  try {
    const raw = localStorage.getItem('ajike_cart')
    if (!raw) return
    const data = JSON.parse(raw)
    STATE.cart = deserializeCart(data)
  } catch (e) {}
}
const renderItems = () => {
  const grid = el('#items-grid')
  grid.innerHTML = ''
  MENU.items.forEach(item => {
    const avail = item.availability && item.availability.available !== false
    const stock = item.availability && typeof item.availability.stock === 'number' ? item.availability.stock : undefined
    if (!avail) return
    const card = document.createElement('div')
    card.className = 'card'
    const hasPromo = item.promo && item.promo.discount && item.promo.discount > 0
    const unit = itemUnitPrice(item, 1)
    card.innerHTML = `
      <img loading="lazy" src="${item.image?.url || ''}" alt="${item.name}" />
      ${item.promo?.tag === 'best_seller' ? `<div class="badge hot">🔥 Best Seller</div>`: ''}
      ${stock !== undefined && stock < 5 && stock > 0 ? `<div class="stock-low">Only ${stock} left</div>` : ''}
      ${stock === 0 ? `<div class="overlay">Out of Stock</div>` : ''}
      <div class="card-body">
        <div class="title">${item.name}</div>
        <div class="price">
          ${hasPromo ? `<span class="strike">${currencySymbol()}${fmt(item.price)}</span>` : ''}
          <span>${currencySymbol()}${fmt(unit)}</span>
        </div>
      </div>
    `
    card.addEventListener('click', () => {
      if (stock === 0) return
      STATE.current = { item, size: null, modifiers: {}, quantity: 1 }
      const sizes = Array.isArray(item.sizes) ? item.sizes : []
      renderSizes(sizes)
      const stepTo = sizes.length ? 2 : 3
      setStep(stepTo)
    })
    grid.appendChild(card)
  })
}
const renderSizes = (sizes) => {
  const list = el('#sizes-list')
  list.innerHTML = ''
  el('#to-3').disabled = true
  el('#back-to-1').onclick = () => setStep(1)
  if (!sizes || sizes.length === 0) {
    STATE.current.size = null
    renderRequiredGroup()
    setStep(3)
    return
  }
  sizes.forEach(size => {
    const opt = document.createElement('button')
    opt.className = 'option'
    opt.textContent = size[0].toUpperCase() + size.slice(1)
    opt.addEventListener('click', () => {
      els('#sizes-list .option').forEach(o => o.classList.remove('active'))
      opt.classList.add('active')
      STATE.current.size = size
      el('#to-3').disabled = false
      setTimeout(() => { renderRequiredGroup(); setStep(3) }, 250)
    })
    list.appendChild(opt)
  })
  el('#to-3').onclick = () => { renderRequiredGroup(); setStep(3) }
}
const renderRequiredGroup = () => {
  const item = STATE.current.item
  const groups = getItemGroups(item)
  const requiredGroup = groups.find(g => g.required)
  const list = el('#protein-list')
  list.innerHTML = ''
  el('#to-4').disabled = true
  el('#back-to-2').onclick = () => {
    const sizes = Array.isArray(item.sizes) ? item.sizes : []
    setStep(sizes.length ? 2 : 1)
  }
  const stepTitle = el('#step-3 .step-header h2')
  if (requiredGroup) {
    stepTitle.textContent = `Step 3 • Choose ${requiredGroup.name}`
  } else {
    stepTitle.textContent = `Step 3 • Choose Required`
  }
  if (!requiredGroup) {
    renderOptionalGroups()
    setStep(4)
    return
  }
  const group = requiredGroup
  const options = group.options
  options.forEach(mid => {
    const m = findModifier(mid)
    if (!m) return
    const available = m.availability && m.availability.available !== false
    if (!available) return
    const btn = document.createElement('button')
    btn.className = 'option'
    btn.innerHTML = `${m.image?.url ? `<img loading="lazy" src="${m.image.url}" alt="${m.name}"/>` : ''}<span>${m.name}</span><span class="price">${currencySymbol(MENU.meta.currency)}${fmt(m.price)}</span>`
    btn.addEventListener('click', () => {
      els('#protein-list .option').forEach(o => o.classList.remove('active'))
      btn.classList.add('active')
      STATE.current.modifiers[group.id] = [mid]
      el('#to-4').disabled = false
      setTimeout(() => { renderOptionalGroups(); setStep(4) }, 250)
    })
    list.appendChild(btn)
  })
  el('#to-4').onclick = () => { renderOptionalGroups(); setStep(4) }
}
const renderOptionalGroups = () => {
  const item = STATE.current.item
  const groups = getItemGroups(item).filter(g => !g.required)
  const list = el('#sides-list')
  list.innerHTML = ''
  el('#back-to-3').onclick = () => setStep(3)
  el('#to-5').onclick = () => { renderReview(); setStep(5) }
  if (groups.length === 0) {
    renderReview()
    setStep(5)
    return
  }
  groups.forEach(group => {
    STATE.current.modifiers[group.id] = STATE.current.modifiers[group.id] || []
    group.options.forEach(mid => {
      const m = findModifier(mid)
      if (!m) return
      const available = m.availability && m.availability.available !== false
      if (!available) return
      const btn = document.createElement('button')
      btn.className = 'option'
      btn.innerHTML = `${m.image?.url ? `<img loading="lazy" src="${m.image.url}" alt="${m.name}"/>` : ''}<span>${m.name}</span><span class="price">${currencySymbol(MENU.meta.currency)}${fmt(m.price)}</span>`
      btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) {
          btn.classList.remove('active')
          STATE.current.modifiers[group.id] = STATE.current.modifiers[group.id].filter(x => x !== mid)
        } else {
          btn.classList.add('active')
          STATE.current.modifiers[group.id].push(mid)
        }
      })
      list.appendChild(btn)
    })
  })
}
const renderReview = () => {
  const r = el('#review')
  const i = STATE.current.item
  const qty = STATE.current.quantity
  const unit = itemUnitPrice(i, qty)
  const mods = itemTotalModifiers(STATE.current.modifiers)
  const total = qty * (unit + mods)
  r.innerHTML = `
    <div><strong>${i.name}</strong>${STATE.current.size ? ` • ${STATE.current.size[0].toUpperCase()+STATE.current.size.slice(1)}` : ''}</div>
    <div>${Object.entries(STATE.current.modifiers).flatMap(([k,v]) => v.map(mid => `• ${findModifier(mid)?.name || mid}`)).join('<br>')}</div>
    <div>Unit: ${currencySymbol()}${fmt(unit)}</div>
    <div>Qty: ${qty}</div>
    <div>Total: ${currencySymbol()}${fmt(total)}</div>
  `
  els('.qty-controls .btn.qty').forEach(b => {
    b.onclick = () => {
      const delta = Number(b.dataset.inc)
      const nextQty = Math.max(1, STATE.current.quantity + delta)
      STATE.current.quantity = nextQty
      renderReview()
      animateCart()
    }
    const delta = Number(b.dataset.inc)
    const nextQty = STATE.current.quantity + delta
    b.disabled = delta < 0 && nextQty < 1
  })
  el('#add-to-cart').onclick = () => {
    STATE.cart.push(JSON.parse(JSON.stringify(STATE.current)))
    renderCart()
    persistCart()
    resetBuilder()
    setStep(1)
    animateCart()
  }
}
const renderCart = () => {
  const list = el('#cart-items')
  list.innerHTML = ''
  STATE.cart.forEach((line, idx) => {
    const unit = itemUnitPrice(line.item, line.quantity)
    const mods = itemTotalModifiers(line.modifiers)
    const total = line.quantity * (unit + mods)
    const li = document.createElement('li')
    li.className = 'cart-item'
    const sizeText = line.size ? ` (${line.size[0].toUpperCase()+line.size.slice(1)})` : ''
    const modsText = Object.values(line.modifiers).flat().map(mid => `• ${findModifier(mid)?.name || mid}`).join(', ')
    li.innerHTML = `
      <div>
        <div class="title">${line.quantity}x ${line.item.name}${sizeText}</div>
        <div class="meta">${modsText}</div>
      </div>
      <div class="price">${currencySymbol()}${fmt(total)}</div>
    `
    li.addEventListener('mouseenter', () => li.classList.add('cart-bounce'))
    li.addEventListener('animationend', () => li.classList.remove('cart-bounce'))
    li.onclick = () => {
      STATE.cart.splice(idx, 1)
      renderCart()
      persistCart()
    }
    list.appendChild(li)
  })
  el('#cart-total').textContent = `${currencySymbol()}${fmt(cartTotal())}`
}
const animateCart = () => {
  const c = el('#cart')
  c.classList.add('cart-bounce')
  c.addEventListener('animationend', () => c.classList.remove('cart-bounce'), { once: true })
}
const isMobile = () => window.matchMedia && window.matchMedia('(max-width: 900px)').matches
const setCartCollapsed = (collapsed) => {
  const cart = el('#cart')
  if (!cart) return
  cart.classList.toggle('collapsed', collapsed)
  const btn = el('#cart-toggle')
  if (!btn) return
  btn.textContent = collapsed ? 'Show' : 'Hide'
  btn.setAttribute('aria-expanded', String(!collapsed))
}
const initCartToggle = () => {
  const btn = el('#cart-toggle')
  const cart = el('#cart')
  if (!btn || !cart) return
  const sync = () => setCartCollapsed(isMobile())
  sync()
  btn.onclick = () => setCartCollapsed(!cart.classList.contains('collapsed'))
  window.addEventListener('resize', sync)
}
const resetBuilder = () => {
  STATE.current = { item: null, size: null, modifiers: {}, quantity: 1 }
}
const buildWhatsAppMessage = () => {
  const lines = []
  lines.push('## Ajike Kitchen Order')
  STATE.cart.forEach(line => {
    const sizeText = line.size ? ` (${line.size[0].toUpperCase()+line.size.slice(1)})` : ''
    const unit = itemUnitPrice(line.item, line.quantity)
    const mods = itemTotalModifiers(line.modifiers)
    const lineTotal = line.quantity * (unit + mods)
    lines.push(`${line.quantity}x ${line.item.name}${sizeText} — ${currencySymbol()}${fmt(lineTotal)}`)
    Object.values(line.modifiers).flat().forEach(mid => {
      const m = findModifier(mid)
      const p = m?.price || 0
      lines.push(`* ${m?.name || mid} — ${currencySymbol()}${fmt(p)}`)
    })
    lines.push('')
  })
  lines.push(`Total: ${currencySymbol()}${fmt(cartTotal())}`)
  return encodeURIComponent(lines.join('\n'))
}
const initControls = () => {
  el('#clear-cart').onclick = () => { STATE.cart = []; renderCart(); persistCart() }
  el('#checkout').onclick = () => {
    if (STATE.cart.length === 0) return
    const msg = buildWhatsAppMessage()
    const number = MENU.meta.whatsapp_number
    const url = `https://wa.me/${number}?text=${msg}`
    window.location.href = url
  }
}
const init = async () => {
  const res = await fetch('menu.json', { cache: 'no-store' })
  MENU = await res.json()
  loadCart()
  renderItems()
  renderCart()
  initControls()
  initCartToggle()
  setStep(1)
}
document.addEventListener('DOMContentLoaded', init)
