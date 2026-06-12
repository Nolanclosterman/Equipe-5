# Architecture technique — Chatbot "Tri des Déchets"

> **Contexte hackathon (1 journée)** : toutes les décisions architecturales privilégient la **simplicité**, la **rapidité de mise en œuvre** et la **mise en production rapide sur Vercel**. On évite toute dépendance externe non indispensable.

---

## 1. Stack technique

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| Frontend | **Next.js 14+ (App Router)** | Un seul framework pour le front et le back, déploiement natif sur Vercel |
| Styling | **Tailwind CSS** | Rapidité de mise en place, pas de fichiers CSS à gérer |
| API / Backend | **Next.js Route Handlers** (`/app/api/`) | Pas de serveur séparé à déployer, co-localisé avec le front |
| Modèle IA | **Anthropic API** (Claude claude-sonnet-4-6) | Vision multimodale + texte dans un seul modèle ; meilleure robustesse pour identifier des déchets sur des photos de qualité variable prises par des enfants (flou, mauvais cadrage, éclairage médiocre) |
| Recherche fuzzy | **Fuse.js** | Librairie légère, zero-config, intégrable directement côté serveur |
| Reconnaissance vocale | **Web Speech API** (navigateur) | Native, gratuite, aucun backend requis |
| Stockage local (DB) | **Fichier JSON dans `/tmp`** (Vercel) | Pas de DB externe ; pour le hackathon, la persistance éphémère suffit |
| Historique chat | **`localStorage`** (navigateur) | Pas de compte, pas de serveur, fonctionne immédiatement |
| Hébergement | **Vercel** | Intégration GitHub native, déploiement automatique, gratuit |

---

## 2. Structure du projet Next.js

```
/
├── dataset/
│   └── guide-de-tri0.json      ← dataset ODWB complet (source de vérité, lecture seule)
│
├── app/
│   ├── layout.tsx             ← layout global (fonts, Tailwind globals)
│   ├── page.tsx               ← page principale : interface du chatbot
│   │
│   └── api/
│       ├── chat/
│       │   └── route.ts       ← POST /api/chat — traitement message texte/vocal
│       └── image/
│           └── route.ts       ← POST /api/image — analyse image uploadée
│
├── components/
│   ├── ChatWindow.tsx          ← zone d'affichage des messages
│   ├── MessageBubble.tsx       ← bulle de message (user / bot)
│   ├── InputBar.tsx            ← barre d'input : texte + PTT + upload image
│   ├── PushToTalkButton.tsx    ← bouton vocal (Web Speech API)
│   └── ImageUploadButton.tsx   ← bouton upload + prévisualisation + validation 5Mo
│
├── lib/
│   ├── search.ts               ← recherche fuzzy dans dataset/guide-de-tri0.json (Fuse.js)
│   ├── claude.ts               ← client Anthropic (chat + vision) + system prompt immuable
│   ├── sanitize.ts             ← validation et protection anti-prompt injection (texte + voix)
│   ├── db.ts                   ← connexion SQLite (better-sqlite3) + init schéma
│   ├── rateLimit.ts            ← rate limiting in-memory (1 msg / 10s par IP)
│   └── logger.ts               ← log termes inconnus → SQLite (unknown_terms)
│
└── data/
    └── synonyms.json           ← base de synonymes enrichissable manuellement
```

---

## 3. Modules et responsabilités

### 3.1 Route `POST /api/chat`

Traite les messages texte et les transcriptions vocales.

```
Entrée  : { message: string, history: Message[] }
Sortie  : { reply: string }

Flux interne :
  1. Rate limit check (IP, 1/10s)
  2. Sanitisation et validation anti-injection (lib/sanitize.ts)
  3. Fuzzy search dans dataset/guide-de-tri0.json via lib/search.ts
  4a. Si résultat(s) trouvé(s) → prompt Claude avec contexte ODWB + historique
  4b. Si aucun résultat → prompt Claude en mode fallback (connaissances générales tri déchets)
  5. Vérification scope (hors sujet → réponse de refus)
  6. Log des termes non reconnus via lib/logger.ts
  7. Retour de la réponse textuelle
```

### 3.2 Route `POST /api/image`

Analyse une image uploadée par l'utilisateur pour identifier le déchet.

```
Entrée  : FormData { image: File (≤ 5Mo) }
Sortie  : { reply: string }

Flux interne :
  1. Validation taille (≤ 5 Mo) et format (image/*)
  2. Rate limit check (IP, 1/10s)
  3. Envoi image à Claude Vision (claude-sonnet-4-6) avec les URLs des images ODWB candidates
     (les photos.url des enregistrements sont fournies comme contexte visuel de référence)
  4. Si déchet identifié → recherche dans dataset/guide-de-tri0.json → réponse tri
  5. Si image non pertinente → réponse de refus poli
  6. Retour de la réponse textuelle
```

### 3.3 `lib/sanitize.ts` — Protection contre le prompt injection

Toute entrée utilisateur (texte saisi ou transcription vocale) passe obligatoirement par ce module **avant** d'être transmise au modèle IA.

**Mesures appliquées :**

1. **Limitation de longueur** : message tronqué à 500 caractères maximum — empêche les injections longues et les tentatives de noyer le system prompt
2. **Détection de patterns d'injection** : rejet immédiat si le message contient des formulations typiques d'injection :
   - `ignore (les|les instructions|previous|tout)...`
   - `tu es maintenant...` / `you are now...`
   - `oublie tout...` / `forget everything...`
   - `agis comme...` / `act as...`
   - `[SYSTEM]`, `###`, balises XML/HTML simulant un rôle (`<system>`, `<assistant>`)
   - Toute tentative de redéfinir le rôle ou le contexte du modèle
3. **Séparation stricte des rôles API Anthropic** : l'input utilisateur est **toujours** transmis dans le rôle `user` de l'API Anthropic — jamais injecté dans le `system` prompt ni dans un message `assistant`
4. **System prompt immuable** : le system prompt (personnalité, scope, règles) est défini côté serveur dans `lib/claude.ts` et n'est **jamais** influencé ou modifiable par le contenu utilisateur
5. **Transcription vocale** : le texte transcrit par la Web Speech API est soumis aux **mêmes validations** que le texte saisi manuellement — la voix n'est pas un canal privilégié

**En cas de détection d'injection :**
- Le message est rejeté silencieusement côté serveur
- Le chatbot répond avec une formule neutre du type "Je n'ai pas bien compris ta question, peux-tu reformuler ?"
- L'événement est loggé (sans le contenu) pour surveillance

### 3.4 `lib/search.ts` — Recherche fuzzy locale

- Charge `dataset/guide-de-tri0.json` **une seule fois** au démarrage (mis en mémoire)
- Utilise **Fuse.js** pour la recherche approximative sur les champs `dechet` et `categorie`
- Consulte `data/synonyms.json` pour étendre les termes de recherche avant matching
- Retourne les N meilleurs résultats avec leur score de confiance

### 3.5 `lib/rateLimit.ts` — Rate limiting

- Map in-memory `IP → timestamp dernier message`
- Limite : **1 requête toutes les 10 secondes** par IP (appliqué sur `/api/chat` et `/api/image`)
- Suffisant pour le hackathon ; pas besoin de Redis ou de persistance

### 3.6 `lib/logger.ts` — Log des termes non reconnus

- Insère dans la table SQLite **`unknown_terms`** via `lib/db.ts`
- Incrémente le compteur `count` si le terme existe déjà (UPSERT)
- Ces données alimentent la révision manuelle des synonymes et l'enrichissement de `data/synonyms.json`

### 3.7 Frontend — Historique de conversation

- Les messages sont stockés dans **`localStorage`** sous la clé `chat-history`
- Structure : `Message[]` avec `{ role: "user"|"assistant", content: string, timestamp }`
- L'historique est transmis à chaque appel `/api/chat` pour maintenir le contexte de la session

---

## 4. Stockage et persistance

### 4.1 Fichiers statiques (lecture seule, bundlés)

| Fichier | Emplacement | Rôle |
|---------|-------------|------|
| `dataset/guide-de-tri0.json` | Racine (versionné) | Dataset ODWB complet — source de vérité, jamais modifié à runtime |
| `data/synonyms.json` | Racine (versionné) | Base de synonymes initiale, enrichissable manuellement entre sessions |

### 4.2 Base de données SQLite — Apprentissage continu

**Librairie** : `better-sqlite3` (synchrone, zéro config, pas de serveur)
**Fichier** : `/tmp/learning.db` sur Vercel · `data/learning.db` en local/VPS

> ⚠️ **Contrainte Vercel** : `/tmp` est éphémère par instance serverless — la DB est réinitialisée à chaque cold start. Comportement acceptable pour le hackathon. En déployant sur un VPS ou en container, `data/learning.db` devient pleinement persistant sans aucun changement de code.

**Schéma de la base :**

```sql
-- Termes inconnus soumis par les utilisateurs (non matchés dans le dataset)
CREATE TABLE IF NOT EXISTS unknown_terms (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  term      TEXT NOT NULL,
  context   TEXT,                -- message complet dans lequel le terme est apparu
  count     INTEGER DEFAULT 1,   -- nombre d'occurrences
  reviewed  BOOLEAN DEFAULT 0,   -- 1 = examiné et traité manuellement
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Associations validées terme → enregistrement ODWB (synonymes appris)
CREATE TABLE IF NOT EXISTS learned_synonyms (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  term       TEXT NOT NULL UNIQUE,
  waste_id   INTEGER NOT NULL,   -- référence à l'id dans guide-de-tri0.json
  confidence REAL DEFAULT 1.0,   -- score de confiance (0.0 → 1.0)
  source     TEXT DEFAULT 'manual', -- 'manual' | 'ai' | 'user_feedback'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Fréquence des questions posées (patterns)
CREATE TABLE IF NOT EXISTS question_patterns (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern    TEXT NOT NULL UNIQUE, -- terme ou phrase normalisée
  hit_count  INTEGER DEFAULT 1,    -- nombre de fois posée
  waste_id   INTEGER,              -- résultat associé si trouvé
  fallback   BOOLEAN DEFAULT 0,    -- 1 = a déclenché le fallback modèle IA
  last_seen  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cache des analyses d'images (hash image → résultat identifié)
-- ⚠️ SÉCURITÉ : une image utilisateur ne peut alimenter ce cache QUE si elle a été
--   formellement identifiée comme un déchet par la vision IA (identified = 1 ET waste_id NOT NULL).
--   Toute image non reconnue ou hors-sujet est traitée et répondue mais JAMAIS mise en cache.
--   Cela protège le dataset contre le prompt injection et la pollution volontaire.
CREATE TABLE IF NOT EXISTS image_cache (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  image_hash   TEXT NOT NULL UNIQUE, -- SHA-256 de l'image uploadée
  waste_id     INTEGER NOT NULL,     -- id ODWB identifié — obligatoire pour entrer en cache
  confidence   REAL NOT NULL,        -- score de confiance de la vision IA
  source       TEXT DEFAULT 'odwb',  -- 'odwb' = image de référence ODWB | 'user' = uploadée par un utilisateur et validée déchet
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Fichier d'accès** : `lib/db.ts` — initialise la connexion SQLite et crée les tables au premier démarrage.

### 4.3 Stockage client (navigateur)

| Clé localStorage | Contenu |
|-----------------|---------|
| `chat-history` | `Message[]` — historique de conversation de la session courante |

---

## 5. Flux complet — Message texte

```
[Navigateur]
    │  message + historique localStorage
    ▼
POST /api/chat
    │
    ├─ Rate limit OK ?  ──Non──► 429 "Attends quelques secondes"
    │
    ├─ Fuzzy search (Fuse.js + synonyms.json) dans dataset/guide-de-tri0.json
    │       │
    │   Résultat ?
    │   ├─ OUI → contexte ODWB injecté dans prompt Claude
    │   └─ NON → fallback prompt "connaissances tri déchets Wallonie/BXL"
    │             + log terme inconnu → /tmp/unknown-terms.json
    │
    ├─ Appel Claude claude-sonnet-4-6 (prompt + historique + contexte)
    │
    └─ Réponse textuelle → navigateur → affichage + sauvegarde localStorage
```

## 6. Flux complet — Image uploadée

```
[Navigateur]
    │  fichier image (≤ 5Mo)
    ▼
POST /api/image
    │
    ├─ Validation taille (≤ 5Mo) / format (image/*)
    ├─ Rate limit OK ?
    │
    ├─ Appel Claude Vision (claude-sonnet-4-6)
    │     ├─ Image utilisateur en base64
    │     └─ URLs photos.url des enregistrements ODWB (contexte visuel de référence)
    │
    ├─ Déchet identifié avec confiance suffisante ?
    │   │
    │   ├─ OUI ──► recherche dans dataset/guide-de-tri0.json → réponse avec infocollecte / infoparc
    │   │          │
    │   │          └─ Mise en cache SQLite (image_cache, source='user')
    │   │               ✅ AUTORISÉ car déchet confirmé par la vision IA
    │   │
    │   └─ NON ──► réponse polie "pas un déchet reconnu"
    │               ❌ PAS de mise en cache — image ignorée du dataset
    │               (protection contre le prompt injection et la pollution volontaire)
    │
    └─ Réponse textuelle → navigateur
```

> **Règle de sécurité — enrichissement du cache image** : une image uploadée par un utilisateur ne peut **jamais** alimenter le cache tant que la vision IA n'a pas formellement confirmé qu'il s'agit d'un déchet reconnu (`waste_id` ODWB résolu + score de confiance). Les images hors-sujet, ambiguës ou potentiellement malveillantes sont traitées et répondues mais **exclues du cache** sans exception.

---

## 7. Variables d'environnement

> ⚠️ **CONVENTION — Action manuelle requise**
>
> Toute variable d'environnement listée ici ou dans tout plan d'implémentation futur **doit être fournie manuellement** par le développeur. Le modèle IA ne peut pas créer, deviner ni injecter ces valeurs.
>
> **Format de signalement dans les plans** : chaque variable nécessitant une action manuelle sera signalée avec le bloc suivant :
>
> ```
> 🔴 ACTION MANUELLE REQUISE
> Variable : <NOM_VARIABLE>
> Où : <où la configurer — ex. dashboard Vercel, fichier .env.local>
> Comment obtenir la valeur : <lien ou procédure>
> ```
>
> **Ne jamais** committer ces valeurs dans le dépôt Git. Utiliser `.env.local` en local (ajouté dans `.gitignore`) et le dashboard Vercel en production/preview.

### Variables actuelles

| Variable | Environnements | Description |
|----------|----------------|-------------|
| `ANTHROPIC_API_KEY` | Production, Preview, Development | Clé API Anthropic (Claude claude-sonnet-4-6) |

---

### 🔴 ACTION MANUELLE REQUISE — `ANTHROPIC_API_KEY`

**Où configurer :**
- **Local** : créer un fichier `.env.local` à la racine du projet avec `ANTHROPIC_API_KEY=sk-ant-...`
- **Vercel** : dashboard → Settings → Environment Variables → ajouter pour les environnements `Production`, `Preview` et `Development`

**Comment obtenir la valeur :**
1. Se connecter sur [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Créer une nouvelle clé secrète
3. Copier la valeur immédiatement (elle n'est affichée qu'une seule fois)

> Si d'autres variables d'environnement sont introduites dans de futures features, elles seront documentées ici selon le même format.

---

## 8. Dépendances npm principales

```json
{
  "dependencies": {
    "next": "^14",
    "react": "^18",
    "@anthropic-ai/sdk": "^0.39",
    "fuse.js": "^7",
    "better-sqlite3": "^9",
    "tailwindcss": "^3"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7"
  }
}
```

---

## 9. Responsive design — Implémentation Tailwind CSS

> Correspond à l'exigence définie dans [`requirements.md`](./requirements.md) — section **7.1**.

### 9.1 Structure de layout obligatoire

Le layout racine de l'application doit impérativement respecter cette structure Tailwind pour garantir le bon comportement sur mobile :

```tsx
// app/page.tsx — structure minimale imposée
<main className="flex flex-col h-[100dvh] w-full max-w-2xl mx-auto overflow-hidden">

  {/* Header optionnel — hauteur fixe */}
  <header className="flex-none px-4 py-3 border-b">
    ...
  </header>

  {/* Zone de messages — prend tout l'espace disponible, scroll interne */}
  <section className="flex-1 overflow-y-auto px-4 py-2">
    <ChatWindow />
  </section>

  {/* Barre de saisie — hauteur fixe, toujours visible */}
  <footer className="flex-none border-t px-4 py-3">
    <InputBar />
  </footer>

</main>
```

**Points critiques :**
- `h-[100dvh]` — utiliser **`dvh`** (dynamic viewport height) et non `vh`, pour compenser la barre d'adresse rétractable sur iOS Safari et Android Chrome
- `flex-1 overflow-y-auto` sur la zone de messages — elle absorbe l'espace entre header et footer, avec scroll interne uniquement
- `flex-none` sur header et footer — ils ne rétrécissent jamais, même si le contenu est grand
- `overflow-hidden` sur le conteneur racine — empêche tout scroll horizontal

### 9.2 Breakpoints et largeur maximale

```tsx
// Centré sur desktop, plein écran sur mobile
<main className="... max-w-2xl mx-auto w-full">
```

| Breakpoint Tailwind | Largeur min | Comportement |
|---------------------|-------------|--------------|
| *(default)* | 0px | Pleine largeur — interface mobile |
| `sm:` | 640px | Légère marge latérale |
| `lg:` | 1024px | Centré, max-width 672px (`max-w-2xl`) |

### 9.3 Boutons tactiles — taille minimale

Tous les boutons interactifs doivent respecter une **taille tactile de 44×44px minimum** :

```tsx
// Tailwind utilities à appliquer sur tous les boutons
className="min-w-[44px] min-h-[44px] flex items-center justify-center"
```

### 9.4 Champ de saisie — prévention du zoom Safari iOS

Safari iOS zoome automatiquement sur un champ `<input>` dont la police est inférieure à 16px.
Appliquer systématiquement sur tous les champs de saisie :

```tsx
<input className="text-base ..." />  // text-base = 16px = zoom iOS désactivé
```

### 9.5 Bouton Push-to-Talk — événements tactiles

Le bouton PTT doit répondre aux événements souris **et** tactiles :

```tsx
<button
  onMouseDown={startListening}
  onMouseUp={stopListening}
  onTouchStart={(e) => { e.preventDefault(); startListening(); }}
  onTouchEnd={(e) => { e.preventDefault(); stopListening(); }}
>
  🎤 Parler
</button>
```

`e.preventDefault()` sur les events touch empêche le double-déclenchement souris+touch sur certains navigateurs mobiles.

### 9.6 Images uploadées — containment

Les prévisualisations d'images dans les bulles de message ne doivent jamais déborder :

```tsx
<img className="max-w-full max-h-48 rounded-lg object-contain" ... />
```

---

## 10. Références

- [`requirements.md`](./requirements.md) — Fonctionnalités et contraintes métier
- [`dataset-odwb.md`](./dataset-odwb.md) — Structure du dataset et accès aux images
- [`chatbot-persona.md`](./chatbot-persona.md) — Ton, personnalité et formules du chatbot
- [`guide-de-tri0.json`](./dataset/guide-de-tri0.json) — Dataset complet (475 déchets)

---

## 11. Workflow Git & Déploiement continu

### 11.1 Stratégie de branches

| Branche | Rôle |
|---------|------|
| `main` | Code stable, déployé en production sur Vercel |
| `feature/<nom-de-la-feature>` | Une branche par nouvelle fonctionnalité (ex. `feature/quiz-gamification`, `feature/telegram-integration`) |

**Règle** : aucun commit direct sur `main`. Toute nouvelle fonctionnalité passe obligatoirement par une branche dédiée et une Pull Request.

### 11.2 Intégration GitHub par le modèle IA (Copilot)

Lorsqu'une nouvelle fonctionnalité est demandée, le modèle IA **doit** :

1. **Créer une branche** `feature/<nom>` depuis `main` via l'API GitHub (ou `gh` CLI)
2. **Implémenter la fonctionnalité** sur cette branche
3. **Ouvrir une Pull Request** vers `main` avec :
   - Un titre descriptif de la feature
   - Une description détaillant les changements effectués
   - L'**URL de prévisualisation Vercel** (voir section 11.3) permettant de tester visuellement le chatbot avec la nouvelle feature
   - Les éventuels points d'attention pour la revue de code

### 11.3 Déploiement des branches feature sur Vercel

Vercel déploie automatiquement **chaque branche** du dépôt GitHub en tant que **Preview Deployment** — une URL unique et isolée, distincte de la production.

| Branche | Environnement Vercel | URL |
|---------|----------------------|-----|
| `main` | Production | `https://<projet>.vercel.app` |
| `feature/*` | Preview | `https://<projet>-git-<branche>-<team>.vercel.app` |

> ✅ Vercel génère ces URLs automatiquement dès qu'une branche est poussée — aucune configuration supplémentaire n'est nécessaire avec l'intégration GitHub native.

**Variables d'environnement** : les Preview Deployments héritent des variables d'environnement configurées dans le dashboard Vercel pour l'environnement `Preview` (notamment `ANTHROPIC_API_KEY`). S'assurer que cette variable est bien définie pour les trois environnements Vercel : `Production`, `Preview` et `Development`.

### 11.4 URL de preview dans la PR

L'URL de preview Vercel doit **obligatoirement figurer dans la description de la Pull Request** pour permettre une validation visuelle directe sans cloner le dépôt.

Format attendu dans la description de PR :

```
## 🚀 Preview Vercel
🔗 https://<projet>-git-feature-<nom>-<team>.vercel.app

## 📝 Description
...
```

> L'URL exacte est disponible dans le dashboard Vercel ou dans le commentaire automatique que Vercel publie sur la PR après le déploiement. Si la PR est ouverte avant que Vercel ait terminé son déploiement, mettre à jour la description dès que l'URL est disponible.
