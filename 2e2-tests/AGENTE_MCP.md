# Agente MCP con Playwright

El servidor **Playwright MCP** le da a un asistente de IA (Claude, Copilot, etc.) las herramientas
para controlar un navegador real: abrir páginas, hacer clic, escribir en campos y leer lo que hay en pantalla.
El agente valida la página "como lo haría una persona" y te entrega un reporte.

Requisito: Node.js 18 o superior.

## 1. Conectar el servidor MCP a tu cliente

### Claude Desktop
Edita `claude_desktop_config.json` (Settings → Developer → Edit Config) y agrega:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```
Reinicia Claude Desktop. Debe aparecer el servidor "playwright" con sus herramientas.

### Claude Code
```bash
claude mcp add playwright npx @playwright/mcp@latest
```

### VS Code (GitHub Copilot, modo Agent)
Crea el archivo `.vscode/mcp.json`:

```json
{
  "servers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

## 2. Prompt para el agente

Con el backend corriendo, pega esto en el chat del cliente:

```
Usa las herramientas de Playwright para probar la página http://localhost:8080/
(catálogo de productos). Ejecuta TODAS estas validaciones y reporta cada una
como APROBADA o FALLÓ, con una breve evidencia:

FORMULARIO
1. Presiona "Agregar producto" y verifica que se abre el formulario.
2. Intenta guardar con todos los campos vacíos: debe NO guardar y marcar los campos requeridos.
3. Intenta guardar con precio negativo (-5) y stock decimal (2.5): debe NO guardar.
4. Crea un producto válido llamado "ZZ Prueba agente" (precio 12.5, stock 4):
   debe aparecer el aviso "Producto creado" y su tarjeta.
5. Edita ese producto cambiando el precio a 20 y verifica que la tarjeta se actualiza.
6. Elimina ese producto (acepta la confirmación) y verifica que desaparece.

BÚSQUEDA
7. Escribe una sola letra en el buscador: NO deben aparecer sugerencias.
8. Escribe dos letras de un producto existente: deben aparecer sugerencias de inmediato.
9. Escribe un texto que no exista: debe decir "Sin coincidencias".
10. Presiona la lupa con un nombre existente: debe mostrarse la sección de resultados con ese producto.
11. Presiona "Limpiar búsqueda": los resultados desaparecen y el campo queda vacío.

RESPONSIVE
12. Cambia el tamaño de la ventana a 375x667 (celular) y verifica que no hay scroll horizontal
    y que el buscador y el botón "Agregar producto" siguen visibles.

Al final entrega una tabla con: número, validación, resultado y observaciones.
Si algo falla, describe qué esperabas y qué pasó realmente.
```

## 3. Pruebas automáticas repetibles (Playwright Test)

El agente es ideal para explorar. Para pruebas que se ejecuten siempre igual, usa los tests de la carpeta `tests/`:

```bash
npm install
npx playwright install chromium
npm test              # ejecuta todo (modo silencioso)
npm run test:headed   # con el navegador visible
npm run test:ui       # modo interactivo
npm run reporte       # abre el reporte HTML
```

Importante: las pruebas borran los productos cuyo nombre empiece con "ZZ". No uses ese prefijo en tus datos reales.
