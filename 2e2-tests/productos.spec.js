const { test, expect } = require('@playwright/test');

// ============================================================
//  Datos de prueba
//  Todos los productos creados por las pruebas empiezan con "ZZ".
//  OJO: antes y después de cada prueba se BORRAN los productos
//  cuyo nombre empiece con "ZZ" para dejar la base de datos limpia.
// ============================================================
const API = '/api/productos';
const PREFIJO = 'ZZ';

async function borrarDatosDePrueba(request) {
  const res = await request.get(API);
  const lista = await res.json();
  for (const p of lista.filter((x) => x.nombre && x.nombre.startsWith(PREFIJO))) {
    await request.delete(`${API}/${p.id}`);
  }
}

async function crearProducto(request, datos) {
  const res = await request.post(API, {
    data: { descripcion: 'Producto de prueba', precio: 10, stock: 5, ...datos },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

// ---------- Ayudantes de la página ----------
const tarjeta = (page, nombre) => page.locator('#grid .card').filter({ hasText: nombre });

async function llenarFormulario(page, d) {
  await page.locator('#fNombre').fill(d.nombre);
  await page.locator('#fDescripcion').fill(d.descripcion ?? '');
  await page.locator('#fPrecio').fill(String(d.precio));
  await page.locator('#fStock').fill(String(d.stock));
}

const esValido = (page, selector, propiedad) =>
  page.locator(selector).evaluate((el, p) => el.validity[p], propiedad);

// Limpieza antes y después de CADA prueba
test.beforeEach(async ({ request }) => borrarDatosDePrueba(request));
test.afterEach(async ({ request }) => borrarDatosDePrueba(request));

// ============================================================
//  1. CARGA INICIAL
// ============================================================
test.describe('Carga inicial', () => {
  test('la página carga con buscador y botón de agregar', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Catálogo/);
    await expect(page.locator('#searchInput')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buscar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar producto' })).toBeVisible();
  });
});

// ============================================================
//  2. FORMULARIO (crear / editar / eliminar + validaciones)
// ============================================================
test.describe('Formulario de productos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('se abre y se cierra con Cancelar', async ({ page }) => {
    await page.getByRole('button', { name: 'Agregar producto' }).click();
    await expect(page.locator('#formDialog')).toBeVisible();
    await expect(page.locator('#formTitle')).toHaveText('Agregar producto');

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('#formDialog')).not.toBeVisible();
  });

  test('no deja enviar el formulario vacío', async ({ page }) => {
    let posts = 0;
    page.on('request', (r) => { if (r.method() === 'POST') posts++; });

    await page.getByRole('button', { name: 'Agregar producto' }).click();
    await page.getByRole('button', { name: 'Guardar producto' }).click();

    await expect(page.locator('#formDialog')).toBeVisible();
    expect(await esValido(page, '#fNombre', 'valueMissing')).toBe(true);
    expect(await esValido(page, '#fPrecio', 'valueMissing')).toBe(true);
    expect(await esValido(page, '#fStock', 'valueMissing')).toBe(true);
    expect(posts).toBe(0);
  });

  test('rechaza precio negativo y stock con decimales', async ({ page }) => {
    let posts = 0;
    page.on('request', (r) => { if (r.method() === 'POST') posts++; });

    await page.getByRole('button', { name: 'Agregar producto' }).click();
    await llenarFormulario(page, { nombre: 'ZZ Invalido', precio: -5, stock: 2.5 });
    await page.getByRole('button', { name: 'Guardar producto' }).click();

    await expect(page.locator('#formDialog')).toBeVisible();
    expect(await esValido(page, '#fPrecio', 'rangeUnderflow')).toBe(true);
    expect(await esValido(page, '#fStock', 'stepMismatch')).toBe(true);
    expect(posts).toBe(0);
  });

  test('crea un producto válido y aparece su tarjeta', async ({ page }) => {
    await page.getByRole('button', { name: 'Agregar producto' }).click();
    await llenarFormulario(page, {
      nombre: 'ZZ Mouse gamer',
      descripcion: 'Inalámbrico',
      precio: 25.5,
      stock: 10,
    });
    await page.getByRole('button', { name: 'Guardar producto' }).click();

    await expect(page.locator('#formDialog')).not.toBeVisible();
    await expect(page.locator('#toast')).toHaveText('Producto creado');

    const card = tarjeta(page, 'ZZ Mouse gamer');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Inalámbrico');
    await expect(card).toContainText(/25[.,]50/);
    await expect(card).toContainText('10 en stock');
  });

  test('edita un producto existente', async ({ page, request }) => {
    await crearProducto(request, { nombre: 'ZZ Teclado', precio: 30, stock: 3 });
    await page.reload();

    await tarjeta(page, 'ZZ Teclado').getByRole('button', { name: 'Editar' }).click();
    await expect(page.locator('#formTitle')).toHaveText('Editar producto');
    await expect(page.locator('#fNombre')).toHaveValue('ZZ Teclado');

    await page.locator('#fPrecio').fill('49.9');
    await page.getByRole('button', { name: 'Guardar producto' }).click();

    await expect(page.locator('#toast')).toHaveText('Producto actualizado');
    await expect(tarjeta(page, 'ZZ Teclado')).toContainText(/49[.,]90/);
  });

  test('elimina un producto cuando se confirma', async ({ page, request }) => {
    await crearProducto(request, { nombre: 'ZZ Para borrar' });
    await page.reload();

    page.once('dialog', (d) => d.accept());
    await tarjeta(page, 'ZZ Para borrar').getByRole('button', { name: 'Eliminar' }).click();

    await expect(tarjeta(page, 'ZZ Para borrar')).toHaveCount(0);
    await expect(page.locator('#toast')).toHaveText('Producto eliminado');
  });

  test('no elimina si se cancela la confirmación', async ({ page, request }) => {
    await crearProducto(request, { nombre: 'ZZ Se queda' });
    await page.reload();

    page.once('dialog', (d) => d.dismiss());
    await tarjeta(page, 'ZZ Se queda').getByRole('button', { name: 'Eliminar' }).click();

    await expect(tarjeta(page, 'ZZ Se queda')).toBeVisible();
  });

  test('muestra el HTML como texto (no lo ejecuta)', async ({ page, request }) => {
    await crearProducto(request, { nombre: 'ZZ <b>negrita</b>' });
    await page.reload();

    const card = tarjeta(page, 'ZZ <b>negrita</b>');
    await expect(card.locator('h3')).toHaveText('ZZ <b>negrita</b>');
    await expect(card.locator('h3 b')).toHaveCount(0);
  });
});

// ============================================================
//  3. BÚSQUEDA (sugerencias + lupa)
// ============================================================
test.describe('Búsqueda de productos', () => {
  test.beforeEach(async ({ page, request }) => {
    await crearProducto(request, { nombre: 'ZZ Mouse' });
    await crearProducto(request, { nombre: 'ZZ Monitor' });
    await crearProducto(request, { nombre: 'ZZ Teclado' });
    await crearProducto(request, { nombre: 'ZZ Cámara' });
    await page.goto('/');
    await expect(page.locator('#grid .card').filter({ hasText: 'ZZ' })).toHaveCount(4);
  });

  test('con una sola letra no hay sugerencias', async ({ page }) => {
    await page.locator('#searchInput').pressSequentially('z');
    await expect(page.locator('#suggestions')).not.toBeVisible();
  });

  test('con dos letras aparecen sugerencias de inmediato', async ({ page }) => {
    const input = page.locator('#searchInput');
    const opciones = page.locator('#suggestions [role="option"]');

    await input.pressSequentially('zz');
    await expect(opciones).toHaveCount(4);

    await input.pressSequentially(' mo');
    await expect(opciones).toHaveCount(2);
    await expect(page.locator('#suggestions')).toContainText('Mouse');
    await expect(page.locator('#suggestions')).toContainText('Monitor');
    await expect(page.locator('#suggestions')).not.toContainText('Teclado');
  });

  test('ignora tildes y mayúsculas', async ({ page }) => {
    await page.locator('#searchInput').fill('ZZ CAMARA');
    await expect(page.locator('#suggestions')).toContainText('Cámara');
  });

  test('Escape cierra las sugerencias', async ({ page }) => {
    await page.locator('#searchInput').pressSequentially('zz');
    await expect(page.locator('#suggestions')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#suggestions')).not.toBeVisible();
  });

  test('la lupa muestra el producto buscado', async ({ page }) => {
    await page.locator('#searchInput').fill('zz teclado');
    await page.getByRole('button', { name: 'Buscar' }).click();

    await expect(page.locator('#resultsSection')).toBeVisible();
    await expect(page.locator('#resultsTitle')).toContainText('Resultados para');
    const cards = page.locator('#resultsGrid .card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('ZZ Teclado');
  });

  test('hacer clic en una sugerencia muestra ese producto', async ({ page }) => {
    await page.locator('#searchInput').pressSequentially('zz cam');
    await page.locator('#suggestions [role="option"]').first().click();

    await expect(page.locator('#searchInput')).toHaveValue('ZZ Cámara');
    await expect(page.locator('#resultsGrid .card')).toHaveCount(1);
    await expect(page.locator('#resultsGrid .card')).toContainText('ZZ Cámara');
  });

  test('se puede elegir con el teclado (flecha abajo + Enter)', async ({ page }) => {
    await page.locator('#searchInput').pressSequentially('zz mon');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page.locator('#resultsGrid .card')).toHaveCount(1);
    await expect(page.locator('#resultsGrid .card')).toContainText('ZZ Monitor');
  });

  test('sin coincidencias avisa al usuario', async ({ page }) => {
    await page.locator('#searchInput').pressSequentially('zzqqq');
    await expect(page.locator('#suggestions')).toContainText('Sin coincidencias');

    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.locator('#resultsSection')).toContainText('No encontramos productos');
  });

  test('limpiar búsqueda oculta los resultados y vacía el campo', async ({ page }) => {
    await page.locator('#searchInput').fill('zz mouse');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.locator('#resultsSection')).toBeVisible();

    await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
    await expect(page.locator('#resultsSection')).not.toBeVisible();
    await expect(page.locator('#searchInput')).toHaveValue('');
  });
});

// ============================================================
//  4. RESPONSIVE Y ERRORES
// ============================================================
test.describe('Responsive', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('en celular no hay scroll horizontal y todo es accesible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#searchInput')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar producto' })).toBeVisible();

    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(desborda).toBe(false);
  });
});

test.describe('Estados especiales', () => {
  test('avisa cuando el backend no responde', async ({ page }) => {
    await page.route('**/api/productos', (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('#status')).toContainText('No se pudo conectar');
  });

  test('muestra el mensaje de lista vacía', async ({ page }) => {
    await page.route('**/api/productos', (route) =>
      route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.continue()
    );
    await page.goto('/');
    await expect(page.locator('#status')).toContainText('Aún no hay productos');
  });
});
