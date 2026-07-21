.PHONY: setup dev stop reset migrate seed lint typecheck test test-e2e build logs

setup:
	corepack enable && pnpm install --frozen-lockfile && pnpm db:generate

dev:
	docker compose -f compose.yaml -f compose.dev.yaml up --build

stop:
	docker compose down

reset:
	docker compose down -v && docker compose up --build

migrate:
	pnpm db:migrate

seed:
	pnpm db:seed

lint:
	pnpm lint

typecheck:
	pnpm typecheck

test:
	pnpm test

test-e2e:
	pnpm test:e2e

build:
	pnpm build

logs:
	docker compose logs -f --tail=200
