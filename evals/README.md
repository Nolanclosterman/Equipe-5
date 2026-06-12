# Évals du chatbot Trico

Suite d'évaluation automatisée, lancée **à chaque PR** (workflow `.github/workflows/evals.yml`) et exécutable en local.

## Fichiers
- **`chatbot-evals.md`** / **`personality.md`** — les specs lisibles (exactitude du tri / personnalité). Source de vérité humaine.
- **`cases.json`** — les mêmes cas, en machine-lisible, consommés par le runner. **À mettre à jour en même temps que les `.md`.**
- **`run-evals.mjs`** — interroge le chatbot puis fait noter chaque réponse par Claude (juge IA). Produit `eval-report.md`.

## Comment ça marche
1. Chaque cas est envoyé à la route `/api/chat` (mono ou multi-tours).
2. Claude (juge) note la réponse contre l'`expected` du cas : `pass` / `partial` / `fail` + score.
3. Un rapport markdown est généré ; en CI il est posté en **commentaire de PR**.

> **Informatif** : l'éval ne bloque jamais une PR. C'est un radar de régression, pas une barrière. Les LLM variant un peu, un écart de quelques points entre deux runs est normal.

## Lancer en local
```bash
# 1. l'app doit tourner (clé ANTHROPIC_API_KEY dans .env.local)
npm run build && npm run start &
# 2. lancer l'éval
npm run eval
```
Le runner lit automatiquement `.env.local`. Variables : `EVAL_BASE_URL`, `EVAL_JUDGE_MODEL`, `EVAL_REPORT_PATH`.

## Pré-requis CI (une seule fois, par un admin)
Ajouter le secret **`ANTHROPIC_API_KEY`** dans *Settings → Secrets and variables → Actions*. Sans lui, le workflow se contente d'un avertissement et n'évalue pas.

## Ajouter un cas
Ajoutez une entrée dans `cases.json` (`functional` ou `personality`) avec `id`, `question` (ou `turns` pour le multi-tours) et `expected` (ce que le juge doit vérifier). Documentez-le aussi dans le `.md` correspondant.
