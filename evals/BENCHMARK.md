# Benchmark — Haiku 4.5 vs Sonnet 4.6 (assistant Trico)

> Généré le 2026-06-12 · température 0.2 · 12 cas × 2 modèles · juge `claude-sonnet-4-6`
> Harnais : [evals/benchmark.ts](./benchmark.ts) — réutilise le vrai `SYSTEM_PROMPT`, `searchWaste` et `buildChatMessages` de l'app (zéro dérive). Reproduire : `node --env-file=.env.local evals/benchmark.ts`

## TL;DR

Après les fix de grounding (recherche par mots-clés + couverture + `ignoreLocation`) et le prompt « 3 phrases max » :

- **Qualité quasi identique** : Haiku **9.42/10** vs Sonnet **9.50/10** (Δ 0.08).
- **Haiku ~2× plus rapide** (TTFT 715 ms vs 1,371 ms) **et ~2× moins cher** ($0.00236 vs $0.00476 / tour).
- **Décision : défaut sur `claude-haiku-4-5`** (override par env `CLAUDE_MODEL`). Meilleur arbitrage robustesse ⇆ sobriété sous budget tokens plafonné.

## Impact des fix (avant → après)

| | Avant (search phrase entière) | Après (fix grounding) |
|---|--:|--:|
| Qualité Haiku /10 | 7.33 | **9.42** |
| Qualité Sonnet /10 | 7.58 | **9.50** |
| Ancrage (anti-hallu) /2 | 1.08 | **1.92** |
| Q15 lunettes (H/S) | 3 / 3 🔴 | **10 / 9** ✅ |
| Q18 bouchon liège (H/S) | 3 / 7 | **9 / 10** ✅ |

Cause des échecs initiaux : la recherche ne récupérait pas le bon enregistrement (« lunettes » → 0 résultat ; « verre » noyait le bouchon en liège), donc les modèles hallucinaient faute de contexte. Corrigé côté RAG → l'ancrage passe de 1.08 à 1.92/2.

## Métriques agrégées

| Métrique | haiku-4-5 | sonnet-4-6 | Lecture |
|---|--:|--:|---|
| TTFT médian | 715 ms | 1,371 ms | réactivité perçue (enfant) |
| Latence totale médiane | 1,779 ms | 3,690 ms | réponse complète |
| Débit moyen | 100.8 tok/s | 50.3 tok/s | vitesse de streaming |
| Tokens out / tour | 105 | 104 | verbosité (prompt 3 phrases max) |
| Coût moyen / tour | 0.00236 $ | 0.00476 $ | sobriété |
| **Score qualité /10** | **9.42** | **9.50** | quasi identique |

### Détail qualité (moyenne /2)

| Critère | haiku-4-5 | sonnet-4-6 |
|---|--:|--:|
| exactitude | 2.00 | 2.00 |
| completude | 1.50 | 1.58 |
| persona | 2.00 | 2.00 |
| scope | 2.00 | 2.00 |
| ancrage | 1.92 | 1.92 |

## Score /10 par cas

| Cas | haiku-4-5 | sonnet-4-6 |
|---|--:|--:|
| Q1 bouteille plastique | 10 | 9 |
| Q2 canette métal | 10 | 9 |
| Q4 GSM DEEE | 8 | 9 |
| Q5 piles | 9 | 10 |
| Q6 fleur fanée (double filière) | 10 | 10 |
| Q7 ampoule LED | 9 | 9 |
| Q8 pneu | 10 | 10 |
| Q14 huile de vidange | 9 | 10 |
| Q15 lunettes résiduel | 10 | 9 |
| Q16 sachet de thé (2 matériaux) | 10 | 10 |
| Q18 bouchon liège | 9 | 10 |
| Q20 hors-scope maths | 9 | 9 |

## Changements appliqués (branche `feat/haiku-default-rag-grounding`)

1. **Défaut Haiku 4.5** + `temperature: 0.2` sur les 3 appels (`lib/claude.ts`), pilotables par `CLAUDE_MODEL` / `CLAUDE_TEMPERATURE`.
2. **Fix RAG** (`lib/search.ts`) : classement par couverture de mots-clés (un record matchant « bouchon »+« liège »+« vin » bat un match incident sur « verre »), `ignoreLocation: true` (match n'importe où dans le champ → « liège » retrouve « …vin en liège »), `limit` 5→8.
3. **Harnais de benchmark** reproductible (`evals/benchmark.ts`).
