# MST Platform Makefile

.PHONY: help dev prod test lint clean

help:
	@echo "Available commands:"
	@echo "  make dev    - Start development environment"
	@echo "  make prod   - Start production environment"
	@echo "  make test   - Run all tests"
	@echo "  make lint   - Run code linters"
	@echo "  make clean  - Clean build artifacts"

dev:
	@echo "Starting development environment..."
	docker-compose -f infrastructure/docker/docker-compose.yml up -d
	cd apps/api && npm run dev &
	cd apps/web && npm run dev &
	cd services/document/src && python app.py &
	cd services/vector/src && python app.py &
	cd services/knowledge-graph/src && python app.py &
	@echo "Development environment started!"

prod:
	@echo "Starting production environment..."
	docker-compose -f infrastructure/docker/docker-compose.prod.yml up -d

test:
	@echo "Running tests..."
	cd apps/api && npm test
	cd tests && python -m pytest

lint:
	@echo "Running linters..."
	cd apps/api && npm run lint
	cd apps/web && npm run lint
	black services/
	flake8 services/

clean:
	@echo "Cleaning..."
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete
