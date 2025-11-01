## Configuration
# Alias SSH côté client (configuré dans ~/.ssh/config)
SSH ?= infomaniak
# Dossier de l'application sur le serveur
APP_DIR ?= /home/clients/34197ae7b2bc8df2e0c4e3d7222bd741/sites/new.infovegetal.com
# Remote Git de production (ajoutez-le avec: git remote add production <url>)
PROD_REMOTE ?= production
# Branche à déployer
BRANCH ?= master

.PHONY: help deploy push art art-run prod-optimize prod-migrate log queue-sync queue-database queue-work queue-stop queue-log assets-upload

help:
	@echo "Cibles Make disponibles:"
	@echo "  make deploy                -> git push $(PROD_REMOTE) $(BRANCH)"
	@echo "  make push                  -> alias de deploy"
	@echo "  make art cmd=...           -> exécuter une commande artisan distante"
	@echo "  make prod-optimize         -> clear/cache config, routes, views"
	@echo "  make prod-migrate          -> php artisan migrate --force"
	@echo "  make log                   -> tail -n 120 du laravel.log"
	@echo "  make queue-sync            -> forcer QUEUE_CONNECTION=sync (puis cache config)"
	@echo "  make queue-database        -> QUEUE_CONNECTION=database (puis cache config)"
	@echo "  make queue-work            -> lancer un worker en arrière-plan (nohup)"
	@echo "  make queue-stop            -> tenter d'arrêter le worker lancé par queue-work"
	@echo "  make queue-log             -> tail -n 120 du storage/logs/queue.log"
	@echo "  make assets-upload         -> scp du dossier public/build vers le serveur"

# Déploiement par push Git sur le remote de prod
deploy: push

push:
	git rev-parse --is-inside-work-tree >/dev/null 2>&1 || (echo "Ce dossier n'est pas un dépôt Git" && exit 1)
	git push $(PROD_REMOTE) $(BRANCH)

# Exécute une commande artisan distante
# Exemple: make art cmd="config:clear"
art:
	@if [ -z "$(cmd)" ]; then \
		echo "Usage: make art cmd=\"migrate --force\""; \
		exit 2; \
	fi
	ssh $(SSH) "set -e; cd $(APP_DIR) && php artisan $(cmd)"

# Alias pratique pour enchaîner plusieurs commandes artisan
art-run:
	ssh $(SSH) "set -e; cd $(APP_DIR) && \
		php artisan config:clear && php artisan optimize:clear && \
		php artisan migrate --force && \
		php artisan config:cache && php artisan route:cache && php artisan view:cache"

# Optimisations classiques après déploiement
prod-optimize:
	ssh $(SSH) "set -e; cd $(APP_DIR) && \
		php artisan config:clear && php artisan optimize:clear && \
		php artisan config:cache && php artisan route:cache && php artisan view:cache"

# Migrations en production
prod-migrate:
	ssh $(SSH) "set -e; cd $(APP_DIR) && php artisan migrate --force"

# Logs applicatifs (les 120 dernières lignes)
log:
	ssh $(SSH) "cd $(APP_DIR) && tail -n 120 storage/logs/laravel.log || true"

# Forcer la queue en mode sync (pratique si aucun worker n'est en route)
queue-sync:
	ssh $(SSH) "set -e; cd $(APP_DIR) && \
		( grep -q '^QUEUE_CONNECTION=' .env && sed -i 's/^QUEUE_CONNECTION=.*/QUEUE_CONNECTION=sync/' .env || echo '\nQUEUE_CONNECTION=sync' >> .env ) && \
		php artisan config:clear && php artisan config:cache"

# Activer la queue en database (prévoir un worker actif)
queue-database:
	ssh $(SSH) "set -e; cd $(APP_DIR) && \
		( grep -q '^QUEUE_CONNECTION=' .env && sed -i 's/^QUEUE_CONNECTION=.*/QUEUE_CONNECTION=database/' .env || echo '\nQUEUE_CONNECTION=database' >> .env ) && \
		php artisan config:clear && php artisan config:cache && \
		php artisan migrate --force"

# Lancer un worker en arrière-plan (nohup) et stocker le PID
queue-work:
	ssh $(SSH) "set -e; cd $(APP_DIR) && \
		mkdir -p storage/logs && nohup php artisan queue:work --queue=default --sleep=3 --tries=1 --timeout=120 \
			> storage/logs/queue.log 2>&1 & echo $$! > storage/queue-worker.pid && \
		echo 'Worker démarré avec PID ' \`cat storage/queue-worker.pid\`"

# Arrêter le worker si lancé via queue-work (PID file)
queue-stop:
	ssh $(SSH) "set -e; cd $(APP_DIR) && \
		if [ -f storage/queue-worker.pid ]; then \
			PID=\`cat storage/queue-worker.pid\`; \
			kill $$PID || true; rm -f storage/queue-worker.pid; \
			echo 'Worker arrêté (PID:' $$PID ')'; \
		else \
			echo 'Aucun PID trouvé. Tentative de kill par motif...'; \
			pkill -f "php artisan queue:work" || true; \
		fi"

# Consulter le log du worker
queue-log:
	ssh $(SSH) "cd $(APP_DIR) && tail -n 120 storage/logs/queue.log || true"

# Uploader le build front (public/build) vers le serveur (nécessite scp)
assets-upload:
	scp -r public/build $(SSH):$(APP_DIR)/public/