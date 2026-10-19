# Product Catalog · CRUD with Spring Boot

A product catalog web application. It includes a **REST backend** with the four CRUD methods
(Spring Boot + JPA + PostgreSQL) and a **vanilla JavaScript frontend** that consumes it, featuring a
search bar with suggestions, responsive cards, and **automated tests** with Playwright.

<!-- When you have a screenshot, save it as docs/screenshot.png and remove the comment marks:
![Catalog screenshot](docs/screenshot.png)
-->

## Features

- REST API to Create, Read, Update, and Delete products.
- Layered architecture: `model` → `repository` → `service` → `controller`.
- Framework-free frontend, responsive on any screen size.
- Search bar with instant suggestions from the second letter (accent- and case-insensitive).
- Form to create and edit products, with validations.
- End-to-end tests with Playwright (form, search, responsive layout, and error states).

## Tech stack

| Part | Technology |
|---|---|
| Backend | Java 17, Spring Boot 3, Spring Data JPA |
| Database | PostgreSQL (or H2 to try it without installing anything) |
| Frontend | HTML, CSS (Grid and Flexbox), vanilla JavaScript |
| Testing | Playwright Test (Node.js) |

## Project structure

```
.
├── database/
│   └── schema.sql                 # reference structure of the table
├── pruebas-e2e/                   # automated tests with Playwright
├── src/main/java/com/boilerplate/uce/
│   ├── controller/ProductoController.java
│   ├── model/Producto.java
│   ├── repository/ProductoRepository.java
│   ├── service/ProductoService.java
│   └── UceApplication.java
├── src/main/resources/
│   ├── static/                    # frontend (index.html, styles.css, app.js)
│   └── application.properties
├── pom.xml
└── mvnw / mvnw.cmd                # Maven Wrapper
```

## Requirements

- JDK 17 or higher
- PostgreSQL 14 or higher (or use H2, see below)
- Node.js 18 or higher (only for the tests)

You don't need to install Maven: the project includes the Maven Wrapper.

## Getting started

1. **Clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/REPO_NAME.git
   cd REPO_NAME
   ```

2. **Create the database** in PostgreSQL (with pgAdmin or `psql`):

   ```sql
   CREATE DATABASE crud_db;
   ```

   The `productos` table is created automatically when the application starts. If you prefer to
   create it manually, run `database/schema.sql`.

3. **Configure the database credentials** in `src/main/resources/application.properties`
   (database URL, username, and password) to match your local PostgreSQL installation.

4. **Run the application**

   ```bash
   ./mvnw spring-boot:run          # Windows: mvnw.cmd spring-boot:run
   ```

5. **Open** [http://localhost:8080](http://localhost:8080)

### Try it without PostgreSQL (in-memory H2)

In `application.properties`, replace the database configuration with:

```properties
spring.datasource.url=jdbc:h2:mem:crud_db
spring.datasource.driver-class-name=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=
```

(Data is lost when the application stops. Requires the `H2 Database` dependency in `pom.xml`.)

## REST API

Base URL: `http://localhost:8080/api/productos`

| Method | Path | Description | Response |
|---|---|---|---|
| `GET` | `/api/productos` | List all products | `200` |
| `GET` | `/api/productos/{id}` | Get one product | `200` / `404` |
| `POST` | `/api/productos` | Create a product | `201` |
| `PUT` | `/api/productos/{id}` | Update a product | `200` / `404` |
| `DELETE` | `/api/productos/{id}` | Delete a product | `204` / `404` |

Example request body (`POST` / `PUT`):

```json
{
  "nombre": "Mouse inalámbrico",
  "descripcion": "Mouse óptico 2.4 GHz",
  "precio": 15.5,
  "stock": 20
}
```

Fields: `nombre` (name), `descripcion` (description), `precio` (price), `stock` (units in stock).

## Automated tests

With the application running:

```bash
cd pruebas-e2e
npm install
npx playwright install chromium
npm test
npm run reporte        # opens the HTML report
```

> The tests create and delete products whose name starts with `ZZ`. Don't use that prefix for real data.

