// ============================================================
//  Configuración: cambia esta URL si tu backend usa otro puerto
// ============================================================
const API_URL = "/api/productos";

// ---------------- Estado ----------------
let productos = [];        // copia local de lo que hay en la base de datos
let consultaActiva = "";   // texto de la búsqueda aplicada con la lupa
let sugerencias = [];      // coincidencias mostradas en el desplegable
let indiceActivo = -1;     // sugerencia resaltada con el teclado
let editandoId = null;     // null = creando, número = editando
let errorConexion = false;

// ---------------- Elementos del DOM ----------------
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
  fNombre: $("fNombre"),
  fDescripcion: $("fDescripcion"),
  fPrecio: $("fPrecio"),
  fStock: $("fStock"),
  toast: $("toast"),
};

const dinero = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

// ============================================================
//  Comunicación con el backend (los 4 métodos CRUD)
// ============================================================
async function api(path = "", options = {}) {
  const res = await fetch(API_URL + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.status === 204 ? null : res.json();
}

async function cargarProductos() {
  mostrarEstado("Cargando productos…");
  try {
    productos = await api();            // GET /api/productos
    errorConexion = false;
  } catch (err) {
    productos = [];
    errorConexion = true;
  }
  renderTodo();
}

// ============================================================
//  Render
// ============================================================
function mostrarEstado(texto, esError = false) {
  el.status.textContent = texto;
  el.status.classList.toggle("status--error", esError);
}

function renderTodo() {
  renderTarjetas(el.grid, productos);

  el.count.textContent = productos.length
    ? `${productos.length} ${productos.length === 1 ? "producto" : "productos"}`
    : "";

  if (errorConexion) {
    mostrarEstado(`No se pudo conectar con el backend en ${API_URL}. Verifica que Spring Boot esté corriendo.`, true);
  } else if (!productos.length) {
    mostrarEstado("Aún no hay productos. Usa “Agregar producto” para crear el primero.");
  } else {
    mostrarEstado("");
  }

  if (consultaActiva) renderResultados();
}

function renderTarjetas(contenedor, lista) {
  contenedor.replaceChildren(...lista.map(crearTarjeta));
}

function crearTarjeta(p) {
  const card = document.createElement("article");
  card.className = "card";

  const titulo = document.createElement("h3");
  titulo.textContent = p.nombre;

  const desc = document.createElement("p");
  desc.className = "card__desc";
  desc.textContent = p.descripcion || "Sin descripción";

  const precio = document.createElement("div");
  precio.className = "card__price";
  precio.textContent = p.precio != null ? dinero.format(p.precio) : "—";

  const stock = document.createElement("div");
  const hayStock = (p.stock ?? 0) > 0;
  stock.className = "card__stock" + (hayStock ? "" : " card__stock--out");
  stock.textContent = hayStock ? `${p.stock} en stock` : "Agotado";

  const acciones = document.createElement("div");
  acciones.className = "card__actions";

  const btnEditar = document.createElement("button");
  btnEditar.type = "button";
  btnEditar.className = "btn btn--ghost";
  btnEditar.textContent = "Editar";
  btnEditar.addEventListener("click", () => abrirFormulario(p));

  const btnEliminar = document.createElement("button");
  btnEliminar.type = "button";
  btnEliminar.className = "btn btn--danger";
  btnEliminar.textContent = "Eliminar";
  btnEliminar.addEventListener("click", () => eliminarProducto(p));

  acciones.append(btnEditar, btnEliminar);
  card.append(titulo, desc, precio, stock, acciones);
  return card;
}

// ============================================================
//  Búsqueda
// ============================================================
// Quita tildes y mayúsculas para que "camara" encuentre "Cámara"
function normalizar(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// Primero los que EMPIEZAN con el texto, luego los que lo CONTIENEN
function buscarCoincidencias(texto, minimo = 2) {
  const q = normalizar(texto);
  if (q.length < minimo) return [];
  const empiezan = [];
  const contienen = [];
  for (const p of productos) {
    const nombre = normalizar(p.nombre || "");
    if (nombre.startsWith(q)) empiezan.push(p);
    else if (nombre.includes(q)) contienen.push(p);
  }
  return [...empiezan, ...contienen];
}

function resaltar(nombre, consulta) {
  const frag = document.createDocumentFragment();
  const q = normalizar(consulta);
  const i = q ? normalizar(nombre).indexOf(q) : -1;
  if (i < 0) {
    frag.append(nombre);
    return frag;
  }
  const marca = document.createElement("mark");
  marca.textContent = nombre.slice(i, i + q.length);
  frag.append(nombre.slice(0, i), marca, nombre.slice(i + q.length));
  return frag;
}

// ---- Sugerencias inmediatas mientras se escribe ----
function actualizarSugerencias() {
  const texto = el.input.value;
  indiceActivo = -1;
  el.input.removeAttribute("aria-activedescendant");

  if (texto.trim().length < 2) {
    ocultarSugerencias();
    return;
  }

  sugerencias = buscarCoincidencias(texto).slice(0, 6);
  el.suggestions.replaceChildren();

  if (!sugerencias.length) {
    const vacio = document.createElement("li");
    vacio.className = "suggestions__empty";
    vacio.textContent = "Sin coincidencias";
    el.suggestions.append(vacio);
  } else {
    sugerencias.forEach((p, i) => {
      const li = document.createElement("li");
      li.id = `sug-${i}`;
      li.className = "suggestions__item";
      li.setAttribute("role", "option");

      const nombre = document.createElement("span");
      nombre.append(resaltar(p.nombre, texto));

      const precio = document.createElement("span");
      precio.className = "suggestions__price";
      precio.textContent = p.precio != null ? dinero.format(p.precio) : "";

      li.append(nombre, precio);
      // mousedown (y no click) para que el input no pierda el foco antes
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        elegirSugerencia(p);
      });
      el.suggestions.append(li);
    });
  }

  el.suggestions.hidden = false;
  el.input.setAttribute("aria-expanded", "true");
}

function ocultarSugerencias() {
  el.suggestions.hidden = true;
  el.input.setAttribute("aria-expanded", "false");
}

function moverSeleccion(paso) {
  if (!sugerencias.length) return;
  indiceActivo = (indiceActivo + paso + sugerencias.length) % sugerencias.length;
  [...el.suggestions.children].forEach((li, i) => li.classList.toggle("is-active", i === indiceActivo));
  el.input.setAttribute("aria-activedescendant", `sug-${indiceActivo}`);
}

function elegirSugerencia(p) {
  el.input.value = p.nombre;
  buscar();
}

// ---- Resultado al presionar la lupa ----
function buscar() {
  consultaActiva = el.input.value.trim();
  ocultarSugerencias();
  if (!consultaActiva) {
    limpiarBusqueda();
    return;
  }
  renderResultados();
  el.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderResultados() {
  const coincidencias = buscarCoincidencias(consultaActiva, 1);
  el.resultsSection.hidden = false;
  el.resultsTitle.textContent = coincidencias.length
    ? `Resultados para “${consultaActiva}” (${coincidencias.length})`
    : `Resultados para “${consultaActiva}”`;

  if (!coincidencias.length) {
    const msg = document.createElement("p");
    msg.className = "empty";
    msg.textContent = "No encontramos productos con ese nombre. Revisa la ortografía o prueba con otras letras.";
    el.resultsGrid.replaceChildren(msg);
  } else {
    renderTarjetas(el.resultsGrid, coincidencias);
  }
}

function limpiarBusqueda() {
  consultaActiva = "";
  el.input.value = "";
  el.resultsSection.hidden = true;
  el.resultsGrid.replaceChildren();
  ocultarSugerencias();
}

// ============================================================
//  Crear / Editar / Eliminar
// ============================================================
function abrirFormulario(producto = null) {
  editandoId = producto ? producto.id : null;
  el.formTitle.textContent = producto ? "Editar producto" : "Agregar producto";
  el.fNombre.value = producto?.nombre ?? "";
  el.fDescripcion.value = producto?.descripcion ?? "";
  el.fPrecio.value = producto?.precio ?? "";
  el.fStock.value = producto?.stock ?? "";
  el.dialog.showModal();
  el.fNombre.focus();
}

async function guardarProducto(e) {
  e.preventDefault();
  const datos = {
    nombre: el.fNombre.value.trim(),
    descripcion: el.fDescripcion.value.trim(),
    precio: parseFloat(el.fPrecio.value),
    stock: parseInt(el.fStock.value, 10),
  };

  try {
    if (editandoId !== null) {
      await api(`/${editandoId}`, { method: "PUT", body: JSON.stringify(datos) });   // UPDATE
      avisar("Producto actualizado");
    } else {
      await api("", { method: "POST", body: JSON.stringify(datos) });                // CREATE
      avisar("Producto creado");
    }
    el.dialog.close();
    await cargarProductos();
  } catch (err) {
    avisar("No se pudo guardar el producto. Revisa que el backend esté corriendo.", true);
  }
}

async function eliminarProducto(p) {
  if (!confirm(`¿Eliminar “${p.nombre}”? Esta acción no se puede deshacer.`)) return;
  try {
    await api(`/${p.id}`, { method: "DELETE" });                                     // DELETE
    avisar("Producto eliminado");
    await cargarProductos();
  } catch (err) {
    avisar("No se pudo eliminar el producto.", true);
  }
}

// ---- Aviso temporal ----
let temporizadorAviso;
function avisar(texto, esError = false) {
  el.toast.textContent = texto;
  el.toast.classList.toggle("is-error", esError);
  el.toast.classList.add("is-visible");
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => el.toast.classList.remove("is-visible"), 3500);
}

// ============================================================
//  Eventos
// ============================================================
el.input.addEventListener("input", actualizarSugerencias);
el.input.addEventListener("focus", actualizarSugerencias);
el.input.addEventListener("blur", ocultarSugerencias);

el.input.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); moverSeleccion(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); moverSeleccion(-1); }
  else if (e.key === "Escape") { ocultarSugerencias(); }
  else if (e.key === "Enter" && indiceActivo >= 0) {
    e.preventDefault();
    elegirSugerencia(sugerencias[indiceActivo]);
  }
});

el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  buscar();
});

el.clearSearch.addEventListener("click", limpiarBusqueda);
el.addBtn.addEventListener("click", () => abrirFormulario());
el.cancelBtn.addEventListener("click", () => el.dialog.close());
el.productForm.addEventListener("submit", guardarProducto);

// Cerrar el formulario al hacer clic fuera de la tarjeta
el.dialog.addEventListener("click", (e) => {
  if (e.target === el.dialog) el.dialog.close();
});

// ---------------- Inicio ----------------
cargarProductos();
