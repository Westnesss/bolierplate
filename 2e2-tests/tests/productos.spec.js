const { test, expect } = require('@playwright/test');

// ============================================================
//  Datos de prueba
// ============================================================
const API = '/api/products';
const PREFIJO = 'ZZ';

async function borrarDatosDePrueba(request) {
  try {
    const res = await request.get(API);
    if (!res.ok()) return;
    const lista = await res.json();
    if (!Array.isArray(lista)) return;
    for (const p of lista.filter((x) => (x.name || x.nombre) && (x.name || x.nombre).startsWith(PREFIJO))) {
      await request.delete(`${API}/${p.id}`);
    }
  } catch (e) {
    // Ignora errores si la API no responde
  }
}

async function crearProducto(request, datos) {
  const res = await request.post(API, {
    data: { description: 'Test product', price: 10, stock: 5, ...datos },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

// ---------- Ayudantes de la página ----------
const tarjeta = (page, nombre) => page.locator('#grid .card').filter({ hasText: nombre });

async function llenarFormulario(page, d) {
  await page.locator('#fName').fill(d.name || d.nombre);
  await page.locator('#fDescription').fill(d.description ?? d.descripcion ?? '');
  await page.locator('#fPrice').fill(String(d.price ?? d.precio));
  await page.locator('#fStock').fill(String(d.stock));
}

const esValido = (page, selector, propiedad) =>
  page.locator(selector).evaluate((el, p) => el.validity[p], propiedad);

test.beforeEach(async ({ request }) => borrarDatosDePrueba(request));
test.afterEach(async ({ request }) => borrarDatosDePrueba(request));

// ============================================================
//  1. CARGA INICIAL
// ============================================================
test.describe('Initial load', () => {
  test('page loads with search bar and add button', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Product Catalog/);
    await expect(page.locator('#searchInput')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add product' })).toBeVisible();
  });
});

// ============================================================
//  2. FORMULARIO
// ============================================================
test.describe('Product form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('opens and closes with Cancel', async ({ page }) => {
    await page.getByRole('button', { name: 'Add product' }).click();
    await expect(page.locator('#formDialog')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('#formDialog')).not.toBeVisible();
  });

  test('does not submit empty form', async ({ page }) => {
    let posts = 0;
    page.on('request', (r) => { if (r.method() === 'POST') posts++; });

    await page.getByRole('button', { name: 'Add product' }).click();
    await page.getByRole('button', { name: 'Save product' }).click();

    await expect(page.locator('#formDialog')).toBeVisible();
    expect(await esValido(page, '#fName', 'valueMissing')).toBe(true);
    expect(await esValido(page, '#fPrice', 'valueMissing')).toBe(true);
    expect(await esValido(page, '#fStock', 'valueMissing')).toBe(true);
    expect(posts).toBe(0);
  });

  test('rejects negative price and decimal stock', async ({ page }) => {
    let posts = 0;
    page.on('request', (r) => { if (r.method() === 'POST') posts++; });

    await page.getByRole('button', { name: 'Add product' }).click();
    await llenarFormulario(page, { name: 'ZZ Invalido', price: -5, stock: 2.5 });
    await page.getByRole('button', { name: 'Save product' }).click();

    await expect(page.locator('#formDialog')).toBeVisible();
    expect(await esValido(page, '#fPrice', 'rangeUnderflow')).toBe(true);
    expect(await esValido(page, '#fStock', 'stepMismatch')).toBe(true);
    expect(posts).toBe(0);
  });

  test('creates valid product and displays its card', async ({ page }) => {
    await page.getByRole('button', { name: 'Add product' }).click();
    await llenarFormulario(page, {
      name: 'ZZ Mouse gamer',
      description: 'Wireless',
      price: 25.5,
      stock: 10,
    });
    await page.getByRole('button', { name: 'Save product' }).click();

    await expect(page.locator('#formDialog')).not.toBeVisible();

    const card = tarjeta(page, 'ZZ Mouse gamer');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Wireless');
    await expect(card).toContainText(/25[.,]50/);
    await expect(card).toContainText('10 in stock');
  });

  test('edits an existing product', async ({ page, request }) => {
    await crearProducto(request, { name: 'ZZ Teclado', price: 30, stock: 3 });
    await page.reload();

    await tarjeta(page, 'ZZ Teclado').getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('#fName')).toHaveValue('ZZ Teclado');

    await page.locator('#fPrice').fill('49.9');
    await page.getByRole('button', { name: 'Save product' }).click();

    await expect(tarjeta(page, 'ZZ Teclado')).toContainText(/49[.,]90/);
  });

  test('deletes a product when confirmed', async ({ page, request }) => {
    await crearProducto(request, { name: 'ZZ Para borrar' });
    await page.reload();

    page.once('dialog', (d) => d.accept());
    await tarjeta(page, 'ZZ Para borrar').getByRole('button', { name: 'Delete' }).click();

    await expect(tarjeta(page, 'ZZ Para borrar')).toHaveCount(0);
  });

  test('does not delete if confirmation is cancelled', async ({ page, request }) => {
    await crearProducto(request, { name: 'ZZ Se queda' });
    await page.reload();

    page.once('dialog', (d) => d.dismiss());
    await tarjeta(page, 'ZZ Se queda').getByRole('button', { name: 'Delete' }).click();

    await expect(tarjeta(page, 'ZZ Se queda')).toBeVisible();
  });
});

// ============================================================
//  3. BÚSQUEDA
// ============================================================
test.describe('Product search', () => {
  test.beforeEach(async ({ page, request }) => {
    await crearProducto(request, { name: 'ZZ Mouse' });
    await crearProducto(request, { name: 'ZZ Monitor' });
    await crearProducto(request, { name: 'ZZ Teclado' });
    await crearProducto(request, { name: 'ZZ Cámara' });
    await page.goto('/');
  });

  test('single letter shows no suggestions', async ({ page }) => {
    await page.locator('#searchInput').pressSequentially('z');
    await expect(page.locator('#suggestions')).not.toBeVisible();
  });

  test('Escape closes suggestions', async ({ page }) => {
    await page.locator('#searchInput').pressSequentially('zz');
    await expect(page.locator('#suggestions')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#suggestions')).not.toBeVisible();
  });
});

// ============================================================
//  4. ESTADOS ESPECIALES
// ============================================================
test.describe('Special states', () => {
  test('notifies when backend does not respond', async ({ page }) => {
    await page.route('**/api/products', (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('#status')).toContainText('Could not reach the backend');
  });
});