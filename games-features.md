# Fonctionnalités de Gamification — Versions Futures

> ⚠️ **Ces fonctionnalités ne font PAS partie de la v1 de l'application.**
> Ce fichier sert de backlog pour les versions v2 et v3. Aucune de ces features ne doit être implémentée dans le cadre du hackathon initial.

---

## Philosophie générale

La gamification doit rester au service de l'**objectif éducatif** : apprendre à trier les déchets en s'amusant. Chaque jeu doit :
- Reposer sur les données réelles des datasets locaux (`guide-de-tri0.json`, etc.)
- Rester adapté aux enfants d'environ 12 ans
- Donner un **feedback immédiat et bienveillant** — bonne ou mauvaise réponse, le chatbot explique toujours pourquoi
- Être accessible depuis l'interface web et (en v3) depuis Telegram

---

## Jeu 1 — 🕵️ Détective des Déchets *(priorité haute — v2)*

### Description
L'enfant endosse le rôle d'un détective du recyclage. Le chatbot lui soumet des défis et l'enfant doit identifier comment trier le déchet présenté.

### Modes de jeu

**Mode Image** : le chatbot affiche une image tirée du dataset ODWB (`photos.url`) et demande :
> _"🕵️ Détective, tu reconnais cet objet ? Dans quelle poubelle ou quel container du recyparc il faut le mettre ?"_

**Mode Texte** : le chatbot décrit un déchet sans le nommer directement :
> _"Je suis fait de verre, j'ai contenu du jus d'orange, et je suis vide. Où est ma place ? 🍊"_

**Mode Chrono** *(variante)* : l'enfant a un temps limité pour répondre — ajoute une dimension de défi sans pression excessive.

### Logique de réponse
- L'enfant répond librement (texte ou vocal)
- Le chatbot compare la réponse au champ `infocollecte` ou `infoparc` du dataset via fuzzy matching
- **Bonne réponse** → félicitations + anecdote sur le devenir du déchet (champ `destination`)
- **Mauvaise réponse** → explication bienveillante + la bonne réponse + lien `en_savoir` si disponible

### Scoring
- Points gagnés par bonne réponse
- Bonus pour les réponses rapides (mode chrono)
- Score affiché en fin de session avec un message d'encouragement

### Source de données
- Questions générées dynamiquement depuis `dataset/guide-de-tri0.json`
- Images issues de `photos.url` (appel réseau ODWB)
- Niveau de difficulté adaptable : déchets communs (PMC, verre) pour les débutants, déchets spéciaux (amiante, piles) pour les experts

---

## Jeu 2 — 🧠 Quiz du Recyclage *(v2)*

### Description
Un quiz à choix multiples sur le tri des déchets et le recyclage, généré dynamiquement depuis les datasets.

### Format
- Question + 4 propositions de réponse
- Exemples de questions :
  - _"Une bouteille de lait en plastique, ça va dans... ?"_ → A. Sac bleu B. Sac blanc C. Verre D. Recyparc
  - _"Vrai ou faux : le verre peut être recyclé à l'infini ?"_
  - _"Quelle intercommunale gère les recyparcs en province de Luxembourg ?"_
- 10 questions par session, durée estimée ~5 minutes

### Niveaux de difficulté
| Niveau | Type de questions |
|--------|------------------|
| 🟢 Débutant | Déchets du quotidien, règles de base |
| 🟡 Intermédiaire | Déchets spéciaux, nuances PMC vs résiduel |
| 🔴 Expert | Filières de recyclage, intercommunales, chiffres environnementaux |

### Scoring & feedback
- Score final avec classement (_"Tu es un Super Recycleur ! 🏆"_)
- Récapitulatif des erreurs avec explications
- Défi à refaire pour améliorer son score

---

## Jeu 3 — 🗑️ Trier la Poubelle *(v2)*

### Description
Mini-jeu de type "drag & drop" (interface web) ou choix textuels (Telegram). Le chatbot présente une liste de 5 à 8 objets mélangés et l'enfant doit les affecter à la bonne poubelle ou au bon container.

### Exemple
> _"Tu vides ta chambre ! 🧹 Voici ce que tu trouves : une canette de soda 🥤, un vieux téléphone 📱, du papier journal 📰, des restes de pizza 🍕, et une ampoule 💡. À toi de trier !"_

### Implémentation
- Interface web : drag & drop visuel vers les icônes des poubelles (sac bleu, sac blanc, verre, recyparc, Recupel)
- Telegram : réponse par numéro ou nom de poubelle
- Score : X/Y objets bien triés + explications pour chaque erreur

---

## Jeu 4 — 🌍 Éco-Impact Meter *(v3)*

### Description
Après chaque bonne réponse ou série de bonnes réponses, le chatbot affiche l'**impact environnemental cumulé** des gestes de tri corrects — rend tangible l'effet de ses actions.

### Exemples de messages
> _"🌱 En triant correctement aujourd'hui, tu as contribué à économiser l'équivalent de 2 heures d'éclairage d'une ampoule LED !"_
> _"♻️ Si tout le monde faisait comme toi, on recyclerait 1 000 bouteilles de plus par jour en Wallonie !"_

### Notes d'implémentation
- Les chiffres doivent être **sourcés et vérifiés** — aucune invention
- Affichage progressif : une "jauge d'impact" qui se remplit au fil des sessions
- Données stockées dans `localStorage` (web) pour persistance entre sessions

---

## Jeu 5 — 🏆 Défis Hebdomadaires *(v3)*

### Description
Le chatbot propose chaque semaine un défi thématique lié à un type de déchet ou une catégorie.

### Exemples de défis
- _"Cette semaine : le défi Plastique ! 🧴 Réponds à 5 questions sur les emballages plastiques pour gagner le badge Plastique Expert !"_
- _"Défi Recyparc : trouve le recyparc le plus proche de chez toi et dis-moi ce qu'on peut y déposer !"_

### Système de badges
| Badge | Condition |
|-------|-----------|
| 🥉 Apprenti Trieur | Première session complétée |
| 🥈 Recycleur Confirmé | 50 bonnes réponses cumulées |
| 🥇 Expert du Tri | Toutes les catégories de déchets maîtrisées |
| 🏆 Champion Recyparc | Quiz expert réussi à 100% |
| 🌟 Détective Pro | 20 défis Détective réussis |

### Stockage
- Badges et progression stockés dans `localStorage` (web) ou sur l'appareil (Telegram)
- Pas de compte utilisateur requis — cohérent avec la v1

---

## Considérations techniques communes (v2/v3)

| Aspect | Note |
|--------|------|
| **Source des questions** | Générées dynamiquement depuis `guide-de-tri0.json` — pas de questions hardcodées |
| **Stockage des scores** | `localStorage` navigateur + table SQLite `game_scores` à ajouter dans `learning.db` |
| **Anti-triche** | Les réponses correctes ne sont jamais exposées dans le code client |
| **Accessibilité** | Les jeux doivent fonctionner sans souris (clavier, vocal) |
| **Telegram** | Les versions Telegram des jeux utilisent des réponses textuelles ou les boutons inline de l'API Telegram |
| **Pas de compte** | Scores et badges stockés localement — pas de sync serveur, cohérent avec la politique de confidentialité de la v1 |

---

## Références

- [`requirements.md`](./requirements.md) — Fonctionnalités v1 (hors gamification)
- [`chatbot-persona.md`](./chatbot-persona.md) — Ton et style à respecter dans les jeux
- [`dataset-odwb.md`](./dataset-odwb.md) — Source des données pour générer les questions
