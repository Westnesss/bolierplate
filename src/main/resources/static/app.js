const API_URL = "/api/products";

// ---------------- State ----------------
let products = [];
let activeQuery = "";
let suggestions = [];
let activeIndex = -1;
let editingId = null; // null = creating, number = editing
let connectionError = false;

// ---------------- DOM elements ----------------
const $ = (id) => document.getElementById(id);
const el = {
  form: $("searchForm"),
  input: $("searchInput"),
  suggestions: $("suggestions"),
  addBtn: $("addBtn"),
  resultsSection: $("resultsSection"),
  resultsTitle: $("resultsTitle"),
  resultsGrid: $("resultsGrid"),
  clearSearch: $("clearSearch"),
  grid: $("grid"),
  count: $("count"),
  status: $("status"),
  dialog: $("formDialog"),
  productForm: $("productForm"),
  formTitle: $("formTitle"),
  cancelBtn: $("cancelBtn"),
  fName: $("fName"),
  fDescription: $("fDescription"),
  fPrice: $("fPrice"),
  fStock: $("fStock"),
  toast: $("toast"),
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// ---------------- API ----------------
async function api(path = "", options = {}) {
  const res = await fetch(API_URL + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.status === 204 ? null : res.json();
}

async function loadProducts() {
  showStatus("Loading products…");
  try {
    products = await api();
    connectionError = false;
  } catch (err) {
    products = [];
    connectionError = true;
  }
  renderAll();
}

// ---------------- Rendering ----------------
function showStatus(text, isError = false) {
  el.status.textContent = text;
  el.status.classList.toggle("status--error", isError);
}

function renderAll() {
  renderCards(el.grid, products);

  el.count.textContent = products.length
    ? `${products.length} ${products.length === 1 ? "product" : "products"}`
    : "";

  if (connectionError) {
    showStatus(`Could not reach the backend at ${API_URL}. Make sure Spring Boot is running.`, true);
  } else if (!products.length) {
    showStatus("No products yet. Use “Add product” to create the first one.");
  } else {
    showStatus("");
  }

  if (activeQuery) renderResults();
}

function renderCards(container, list) {
  container.replaceChildren(...list.map(createCard));
}

function createCard(p) {
  const card = document.createElement("article");
  card.className = "card";

  const title = document.createElement("h3");
  title.textContent = p.name;

  const description = document.createElement("p");
  description.className = "card__desc";
  description.textContent = p.description || "No description";

  const price = document.createElement("div");
  price.className = "card__price";
  price.textContent = p.price != null ? currency.format(p.price) : "—";

  const stock = document.createElement("div");
  const inStock = (p.stock ?? 0) > 0;
  stock.className = "card__stock" + (inStock ? "" : " card__stock--out");
  stock.textContent = inStock ? `${p.stock} in stock` : "Out of stock";

  const actions = document.createElement("div");
  actions.className = "card__actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "btn btn--ghost";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", () => openForm(p));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn--danger";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", () => deleteProduct(p));

  actions.append(editBtn, deleteBtn);
  card.append(title, description, price, stock, actions);
  return card;
}

// ---------------- Search ----------------
// Strips accents and case so "camara" matches "Cámara".
function normalize(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// Prefix matches are listed before substring matches.
function findMatches(text, minLength = 2) {
  const q = normalize(text);
  if (q.length < minLength) return [];
  const startsWith = [];
  const contains = [];
  for (const p of products) {
    const name = normalize(p.name || "");
    if (name.startsWith(q)) startsWith.push(p);
    else if (name.includes(q)) contains.push(p);
  }
  return [...startsWith, ...contains];
}

function highlight(name, query) {
  const fragment = document.createDocumentFragment();
  const q = normalize(query);
  const i = q ? normalize(name).indexOf(q) : -1;
  if (i < 0) {
    fragment.append(name);
    return fragment;
  }
  const mark = document.createElement("mark");
  mark.textContent = name.slice(i, i + q.length);
  fragment.append(name.slice(0, i), mark, name.slice(i + q.length));
  return fragment;
}

function updateSuggestions() {
  const text = el.input.value;
  activeIndex = -1;
  el.input.removeAttribute("aria-activedescendant");

  if (text.trim().length < 2) {
    hideSuggestions();
    return;
  }

  suggestions = findMatches(text).slice(0, 6);
  el.suggestions.replaceChildren();

  if (!suggestions.length) {
    const empty = document.createElement("li");
    empty.className = "suggestions__empty";
    empty.textContent = "No matches";
    el.suggestions.append(empty);
  } else {
    suggestions.forEach((p, i) => {
      const li = document.createElement("li");
      li.id = `sug-${i}`;
      li.className = "suggestions__item";
      li.setAttribute("role", "option");

      const name = document.createElement("span");
      name.append(highlight(p.name, text));

      const price = document.createElement("span");
      price.className = "suggestions__price";
      price.textContent = p.price != null ? currency.format(p.price) : "";

      li.append(name, price);
      // mousedown instead of click so the input keeps focus.
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectSuggestion(p);
      });
      el.suggestions.append(li);
    });
  }

  el.suggestions.hidden = false;
  el.input.setAttribute("aria-expanded", "true");
}

function hideSuggestions() {
  el.suggestions.hidden = true;
  el.input.setAttribute("aria-expanded", "false");
}

function moveSelection(step) {
  if (!suggestions.length) return;
  activeIndex = (activeIndex + step + suggestions.length) % suggestions.length;
  [...el.suggestions.children].forEach((li, i) => li.classList.toggle("is-active", i === activeIndex));
  el.input.setAttribute("aria-activedescendant", `sug-${activeIndex}`);
}

function selectSuggestion(p) {
  el.input.value = p.name;
  search();
}

function search() {
  activeQuery = el.input.value.trim();
  hideSuggestions();
  if (!activeQuery) {
    clearSearch();
    return;
  }
  renderResults();
  el.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderResults() {
  const matches = findMatches(activeQuery, 1);
  el.resultsSection.hidden = false;
  el.resultsTitle.textContent = matches.length
    ? `Results for “${activeQuery}” (${matches.length})`
    : `Results for “${activeQuery}”`;

  if (!matches.length) {
    const message = document.createElement("p");
    message.className = "empty";
    message.textContent = "No products found with that name. Check the spelling or try different letters.";
    el.resultsGrid.replaceChildren(message);
  } else {
    renderCards(el.resultsGrid, matches);
  }
}

function clearSearch() {
  activeQuery = "";
  el.input.value = "";
  el.resultsSection.hidden = true;
  el.resultsGrid.replaceChildren();
  hideSuggestions();
}

// ---------------- Create / update / delete ----------------
function openForm(product = null) {
  editingId = product ? product.id : null;
  el.formTitle.textContent = product ? "Edit product" : "Add product";
  el.fName.value = product?.name ?? "";
  el.fDescription.value = product?.description ?? "";
  el.fPrice.value = product?.price ?? "";
  el.fStock.value = product?.stock ?? "";
  el.dialog.showModal();
  el.fName.focus();
}

async function saveProduct(e) {
  e.preventDefault();
  const data = {
    name: el.fName.value.trim(),
    description: el.fDescription.value.trim(),
    price: parseFloat(el.fPrice.value),
    stock: parseInt(el.fStock.value, 10),
  };

  try {
    if (editingId !== null) {
      await api(`/${editingId}`, { method: "PUT", body: JSON.stringify(data) });
      notify("Product updated");
    } else {
      await api("", { method: "POST", body: JSON.stringify(data) });
      notify("Product created");
    }
    el.dialog.close();
    await loadProducts();
  } catch (err) {
    notify("Could not save the product. Make sure the backend is running.", true);
  }
}

async function deleteProduct(p) {
  if (!confirm(`Delete “${p.name}”? This action cannot be undone.`)) return;
  try {
    await api(`/${p.id}`, { method: "DELETE" });
    notify("Product deleted");
    await loadProducts();
  } catch (err) {
    notify("Could not delete the product.", true);
  }
}

// ---------------- Toast ----------------
let toastTimer;
function notify(text, isError = false) {
  el.toast.textContent = text;
  el.toast.classList.toggle("is-error", isError);
  el.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("is-visible"), 3500);
}

// ---------------- Events ----------------
el.input.addEventListener("input", updateSuggestions);
el.input.addEventListener("focus", updateSuggestions);
el.input.addEventListener("blur", hideSuggestions);

el.input.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); moveSelection(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); moveSelection(-1); }
  else if (e.key === "Escape") { hideSuggestions(); }
  else if (e.key === "Enter" && activeIndex >= 0) {
    e.preventDefault();
    selectSuggestion(suggestions[activeIndex]);
  }
});

el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  search();
});

el.clearSearch.addEventListener("click", clearSearch);
el.addBtn.addEventListener("click", () => openForm());
el.cancelBtn.addEventListener("click", () => el.dialog.close());
el.productForm.addEventListener("submit", saveProduct);

// Close the dialog when clicking the backdrop.
el.dialog.addEventListener("click", (e) => {
  if (e.target === el.dialog) el.dialog.close();
});

loadProducts();