# Atelier 64

Studio personnel d’échecs: jouez librement les deux couleurs, recevez trois propositions Stockfish après chaque coup, puis demandez une explication en français à un serveur Ollama distant.

## Démarrage Docker

```bash
docker compose up --build
```

Ouvrir <http://localhost:8080>. Stockfish est inclus dans l’image Docker.

L’adresse Ollama est fixée côté serveur par la variable `OLLAMA_URL` (par défaut `http://host.docker.internal:11434`, soit Ollama sur la machine hôte). Pour un Ollama distant, créer un fichier `.env` à côté de `docker-compose.yml`:

```text
OLLAMA_URL=http://192.168.1.10:11434
```

Dans **Réglages**, choisir le modèle et tester la connexion.

Ollama doit écouter sur réseau accessible au conteneur. Exemple côté machine Ollama:

```bash
OLLAMA_HOST=0.0.0.0:11434 ollama serve
ollama pull qwen3:8b
```

## Sécurité / variables

- `OLLAMA_URL`: seule adresse Ollama contactée par le serveur; le navigateur ne peut plus en imposer une autre.
- Analyses Stockfish limitées à `STOCKFISH_MAX_CONCURRENT` processus simultanés (défaut: 2, ou nombre de CPU si moindre), file d’attente de `STOCKFISH_MAX_QUEUE` (défaut 8) puis réponse 503.
- Limite par IP et par minute: `ANALYZE_RATE_LIMIT` (défaut 60) pour `/api/analyze`, `OLLAMA_RATE_LIMIT` (défaut 20) pour les appels Ollama. Derrière un reverse proxy, définir `TRUST_PROXY=1` pour compter par IP réelle.

## Modèles conseillés

- `qwen3:8b`: choix par défaut, rapide, bon français, environ 6 Go disponibles.
- `qwen3:30b`: explications supérieures, machine distante puissante, environ 24 Go disponibles.
- Stockfish choisit toujours les coups. Ollama explique seulement les variantes calculées: qualité échiquéenne reste stable quel que soit LLM.

## Développement

Pré-requis: Node.js 22 et Stockfish installé dans le PATH.

```bash
npm install
npm run dev
```

Interface: <http://localhost:5173>. API: <http://localhost:3000>.

## Fonctions

- jeu des deux côtés par clic ou glisser-déposer;
- coups légaux signalés, promotion automatique en dame;
- meilleure flèche activable, 3 variantes, évaluation et profondeur réglable;
- annulation, rotation, nouvelle partie, feuille de partie;
- détection échec, mat et nulle;
- Ollama distant configurable (`OLLAMA_URL`) et testable depuis interface;
- réglages conservés localement dans navigateur;
- mise en page responsive et commandes accessibles au clavier.
