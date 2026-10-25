# Docker

The application runs as two images plus a database. Each environment (`test`, `prod`) has its own pair of images.

| Image | Built from | Contents |
|---|---|---|
| `catalog-api` | `Dockerfile` | Spring Boot REST API (JRE 17, non-root user) |
| `catalog-web` | `docker/web.Dockerfile` | nginx serving the static frontend and proxying `/api` to the API |
| `postgres` | official image | PostgreSQL 16 (local and test stacks) |

## Requirements

- Docker Desktop (WSL 2 backend on Windows) with Docker Compose v2

## Run locally

```bash
cp .env.example .env          # then edit the passwords
docker compose up -d --build
docker compose ps             # wait until api and web are "healthy"
```

Open [http://localhost:8080](http://localhost:8080). Stop the IDE run configuration first if it is using port 8080.

```bash
docker compose logs -f api    # follow the API logs
docker compose down           # stop (keeps the data)
docker compose down -v        # stop and delete the database volume
```

## Configuration (environment variables)

The API reads its database settings from the environment, so the same image runs in every environment.

| Variable | Meaning |
|---|---|
| `SPRING_DATASOURCE_URL` | JDBC URL, e.g. `jdbc:postgresql://db:5432/crud_db` |
| `SPRING_DATASOURCE_USERNAME` | Database user |
| `SPRING_DATASOURCE_PASSWORD` | Database password |
| `SPRING_JPA_HIBERNATE_DDL_AUTO` | `update` creates or updates the table on startup |

## Debug from the IDE against the containerized database

Start only the database and run `UceApplication` from IntelliJ with these environment variables:

```bash
docker compose up -d db
```

```
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/crud_db
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=<your password>
```

Never point a local debugging session to the production database.

## End-to-end tests against the stack

```bash
cd e2e-tests
npm test                       # uses http://localhost:8080 by default
```

## Publish the images

```bash
docker login
export DOCKERHUB_USER=<your-user>

# 1) Build and tag with an immutable version
IMAGE_TAG=1.0.0 docker compose build

# 2) Push the version and the environment tag it is promoted to
for svc in api web; do
  docker tag $DOCKERHUB_USER/catalog-$svc:1.0.0 $DOCKERHUB_USER/catalog-$svc:test
  docker push $DOCKERHUB_USER/catalog-$svc:1.0.0
  docker push $DOCKERHUB_USER/catalog-$svc:test
done
```

Tag scheme: `X.Y.Z` is immutable; `test` and `prod` move to the version running in that environment.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `bad interpreter: /bin/sh^M` while building | `mvnw` has Windows line endings; the Dockerfile already fixes it, make sure `.gitattributes` keeps `mvnw` as LF |
| `UnsupportedClassVersionError` | `JAVA_VERSION` does not match `pom.xml`: `docker compose build --build-arg JAVA_VERSION=21 api` |
| `port is already allocated` | Change `WEB_PORT` or `DB_PORT` in `.env` |
| API keeps restarting | `docker compose logs api` and check the database variables |
| Changes in `static/` are not visible | `docker compose up -d --build web` |
