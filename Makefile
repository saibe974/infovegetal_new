# Simple recettes Make pour déploiement via git push sur un dépôt distant (bare + post-receive)
# Utilisation:
#   make deploy                # pousse la branche courante
#   make deploy BRANCH=master  # pousse master
#   make add-remote            # ajoute le remote "production" si absent
# Variables:
#   REMOTE ?= production       # nom du remote dans git (ou une URL complète)
#   BRANCH ?= $(shell git rev-parse --abbrev-ref HEAD)

REMOTE ?= production
BRANCH ?= $(shell git rev-parse --abbrev-ref HEAD)

.PHONY: add-remote deploy

add-remote:
	@if git remote get-url $(REMOTE) > NUL 2>&1; \
	then \
		echo Remote "$(REMOTE)" déjà configuré; \
	else \
		echo Ajoutez le remote avec: git remote add $(REMOTE) <ssh-alias>:repos/infovegetal.git ; \
		echo Exemple: git remote add $(REMOTE) prod:repos/infovegetal.git ; \
	fi

deploy:
	@git push $(REMOTE) $(BRANCH)
	@echo "Déploiement déclenché: $(REMOTE) $(BRANCH)"