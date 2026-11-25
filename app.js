/*
 * Mini Checkout — all client-side logic.
 *
 * Money is held as integer paise (1 rupee = 100 paise) so totals are exact
 * and never suffer from floating-point rounding (0.1 + 0.2 problems).
 */
"use strict";

// ---------------------------------------------------------------------------
// Catalogue: two synthetic products with fixed prices (in paise)
// ---------------------------------------------------------------------------
const PRODUCTS = [
  { id: "tote",   name: "Canvas Tote Bag",    pricePaise: 34950 },  // ₹349.50
  { id: "bottle", name: "Steel Water Bottle", pricePaise: 119900 }, // ₹1,199.00
];
const MAX_QTY = 10;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  cart: new Map(),     // productId -> quantity
  attempted: false,    // has the customer tried to submit at least once?
  status: "editing",   // "editing" | "placed"
  placedAt: 0,         // time the order was placed (used by the double-click fix)
  orders: [],          // every order created this session (should grow by 1 per order)
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", minimumFractionDigits: 2,
});
function formatPaise(paise) {
  return inr.format(paise / 100);
}

function findProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
}

function lineTotal(id) {
  return findProduct(id).pricePaise * state.cart.get(id);
}

function orderTotal() {
  let total = 0;
  for (const id of state.cart.keys()) total += lineTotal(id);
  return total;
}

function makeReference() {
  const d = new Date();
  const ymd = d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `MC-${ymd}-${rand}`;
}

/** Returns a list of problems; an empty list means the order can be placed. */
function validate(name) {
  const errors = [];
  if (state.cart.size === 0) {
    errors.push({ field: "cart", message: "Your cart is empty. Add at least one item to place an order." });
  }
  if (name.trim() === "") {
    errors.push({ field: "name", message: "Please enter your full name." });
  }
  return errors;
}

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const el = {
  productList: $("product-list"),
  cartEmpty: $("cart-empty"),
  cartTable: $("cart-table"),
  cartBody: $("cart-body"),
  orderTotal: $("order-total"),
  form: $("checkout-form"),
  formError: $("form-error"),
  name: $("customer-name"),
  nameError: $("name-error"),
  placeOrder: $("place-order"),
  checkoutView: $("checkout-view"),
  confirmation: $("confirmation"),
  confirmName: $("confirm-name"),
  confirmRef: $("confirm-ref"),
  confirmTotal: $("confirm-total"),
  newOrder: $("new-order"),
};

function button(label, ariaLabel, onClick, disabled = false) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  if (ariaLabel) b.setAttribute("aria-label", ariaLabel);
  b.disabled = disabled;
  b.addEventListener("click", onClick);
  return b;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderProducts() {
  el.productList.replaceChildren(...PRODUCTS.map((p) => {
    const li = document.createElement("li");
    li.className = "product";
    li.dataset.testid = `product-${p.id}`;

    const info = document.createElement("div");
    const name = document.createElement("div");
    name.className = "product-name";
    name.textContent = p.name;
    const price = document.createElement("div");
    price.className = "product-price";
    price.textContent = formatPaise(p.pricePaise);
    info.append(name, price);

    const atMax = (state.cart.get(p.id) || 0) >= MAX_QTY;
    li.append(info, button("Add to cart", `Add ${p.name} to cart`, () => addItem(p.id), atMax));
    return li;
  }));
}

function renderCart() {
  const empty = state.cart.size === 0;
  el.cartEmpty.hidden = !empty;
  el.cartTable.hidden = empty;

  const rows = [];
  for (const [id, qty] of state.cart) {
    const p = findProduct(id);
    const tr = document.createElement("tr");
    tr.dataset.testid = `cart-row-${id}`;

    const nameTd = document.createElement("td");
    nameTd.textContent = p.name;

    const priceTd = document.createElement("td");
    priceTd.textContent = formatPaise(p.pricePaise);

    const qtyTd = document.createElement("td");
    const qtyWrap = document.createElement("span");
    qtyWrap.className = "qty";
    const out = document.createElement("output");
    out.textContent = String(qty);
    out.dataset.testid = `qty-${id}`;
    out.setAttribute("aria-label", `Quantity of ${p.name}`);
    qtyWrap.append(
      button("−", `Decrease quantity of ${p.name}`, () => changeQty(id, -1)),
      out,
      button("+", `Increase quantity of ${p.name}`, () => changeQty(id, +1), qty >= MAX_QTY),
    );
    qtyTd.append(qtyWrap);

    const lineTd = document.createElement("td");
    lineTd.className = "num";
    lineTd.dataset.testid = `line-total-${id}`;
    lineTd.textContent = formatPaise(lineTotal(id));

    const removeTd = document.createElement("td");
    removeTd.append(button("Remove", `Remove ${p.name}`, () => removeItem(id)));

    tr.append(nameTd, priceTd, qtyTd, lineTd, removeTd);
    rows.push(tr);
  }
  el.cartBody.replaceChildren(...rows);
  el.orderTotal.textContent = formatPaise(orderTotal());
}

/** Show or hide validation messages. Never touches what the customer typed. */
function renderErrors(errors) {
  const nameErr = errors.find((e) => e.field === "name");
  el.nameError.hidden = !nameErr;
  el.nameError.textContent = nameErr ? nameErr.message : "";
  el.name.setAttribute("aria-invalid", nameErr ? "true" : "false");

  el.formError.hidden = errors.length === 0;
  el.formError.replaceChildren();
  if (errors.length) {
    const p = document.createElement("p");
    p.style.margin = "0";
    p.textContent = "We couldn't place your order:";
    const ul = document.createElement("ul");
    ul.style.margin = "4px 0 0";
    for (const e of errors) {
      const li = document.createElement("li");
      li.textContent = e.message;
      ul.append(li);
    }
    el.formError.append(p, ul);
  }
}

function render() {
  renderProducts();
  renderCart();
  // Once the customer has tried to submit, keep the messages in sync as they fix things.
  if (state.attempted) renderErrors(validate(el.name.value));
}

// ---------------------------------------------------------------------------
// Cart actions
// ---------------------------------------------------------------------------
function addItem(id) {
  const qty = state.cart.get(id) || 0;
  if (qty >= MAX_QTY) return;
  state.cart.set(id, qty + 1);
  render();
}

function changeQty(id, delta) {
  const next = (state.cart.get(id) || 0) + delta;
  if (next <= 0) state.cart.delete(id);
  else state.cart.set(id, Math.min(next, MAX_QTY));
  render();
}

function removeItem(id) {
  state.cart.delete(id);
  render();
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------
function placeOrder(event) {
  event.preventDefault();

  // Double-submit guard: once an order exists, any further submit is ignored.
  if (state.status !== "editing") return;

  state.attempted = true;
  const errors = validate(el.name.value);
  renderErrors(errors);
  if (errors.length) {
    // Move focus to the first thing the customer needs to fix.
    if (errors.some((e) => e.field === "name")) el.name.focus();
    else el.formError.focus();
    return;
  }

  // Lock synchronously, BEFORE any rendering, so a second click/submit in the
  // same instant hits the guard above.
  state.status = "placed";
  state.placedAt = performance.now();
  el.placeOrder.disabled = true;

  const order = {
    reference: makeReference(),
    name: el.name.value.trim(),
    totalPaise: orderTotal(),
    items: Array.from(state.cart, ([id, qty]) => ({ id, qty })),
  };
  state.orders.push(order);

  el.confirmName.textContent = order.name;
  el.confirmRef.textContent = order.reference;
  el.confirmTotal.textContent = formatPaise(order.totalPaise);
  el.checkoutView.hidden = true;
  el.confirmation.hidden = false;
  el.confirmation.focus();
}

function startNewOrder() {
  state.cart.clear();
  state.attempted = false;
  state.status = "editing";
  el.name.value = "";
  el.placeOrder.disabled = false;
  renderErrors([]);
  el.confirmation.hidden = true;
  el.checkoutView.hidden = false;
  render();
  el.name.focus();
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
el.form.addEventListener("submit", placeOrder);
el.name.addEventListener("input", () => {
  if (state.attempted) renderErrors(validate(el.name.value));
});
el.formError.tabIndex = -1;

// Defect D-01 fix: the 2nd press of a double-click on "Place order" lands on the
// confirmation and the browser highlights a word there. Ignore that text
// selection only in the moment right after the order is placed.
document.addEventListener("mousedown", (e) => {
  if (e.detail > 1 && state.status === "placed" && performance.now() - state.placedAt < 1000) {
    e.preventDefault();
  }
});
el.newOrder.addEventListener("click", startNewOrder);

// Read-only hook so tests can confirm how many orders were actually created.
window.miniCheckout = Object.freeze({
  orderCount: () => state.orders.length,
});

render();
