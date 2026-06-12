# Requirements — Chatbot "Tri des Déchets" (Wallonie & Bruxelles)

## 1. Vue d'ensemble du projet

Développer un chatbot conversationnel en temps réel destiné exclusivement aux **enfants (environ 12 ans)**, centré sur la thématique du **tri des déchets en Belgique**, et plus précisément en **Wallonie et à Bruxelles**.

Le chatbot sera disponible via :
- **Phase 1 (v1 — scope hackathon)** : Interface web avec interface graphique (chat UI)
- **Phase 2 (hors v1 — backlog)** : Intégration avec la messagerie **Telegram** ⚠️ *Ne fait pas partie de la v1 et ne doit pas être implémentée dans le cadre du hackathon.*

---

## 2. Public cible

- Enfants d'environ **12 ans**
- Le style de communication, la personnalité et les formules de réponse du chatbot sont définis dans [`chatbot-persona.md`](./chatbot-persona.md)

---

## 3. Périmètre thématique (scope)

### ✅ Sujets autorisés

Le chatbot est capable de répondre à **tout type de question** relevant des thématiques suivantes :

**Tri et collecte des déchets**
- Comment trier un déchet spécifique (poubelle, sac, conteneur, recyparc, point Recupel)
- Les différentes catégories de tri : PMC, verre, papier/carton, déchets résiduels, organiques, verts, DEEE, déchets spéciaux (piles, médicaments, huiles, amiante, etc.)
- Les règles de collecte à domicile en Wallonie et à Bruxelles
- La localisation des recyparcs (Wallonie) et points de collecte Recupel (Wallonie + Bruxelles)

**Cycle de vie et recyclage des déchets**
- Ce que devient un déchet après sa collecte (filière de valorisation, destination finale)
- Comment fonctionne le processus de recyclage pour chaque type de matériau
- Ce que l'on fabrique à partir des déchets recyclés
- Les bénéfices environnementaux du tri et du recyclage

**Questions éducatives et générales sur les déchets**
- Pourquoi trier les déchets est important
- Différence entre recyclage, réemploi, valorisation énergétique, enfouissement
- Bonnes pratiques pour réduire ses déchets à la source (prévention)
- Fonctionnement des recyparcs et des intercommunales wallonnes

### ❌ Sujets interdits (hors scope)
- Toute question sans lien avec les déchets, leur tri, leur recyclage ou leur cycle de vie
- Pour toute question hors scope, le chatbot répond **poliment** qu'il n'est pas en mesure d'y répondre, et recentre vers son domaine

---

## 4. Sources de données

Trois datasets locaux constituent la base de connaissances du chatbot. Toutes les recherches sont effectuées localement, sans appel réseau (sauf les images ODWB, voir section 5.4).

| Dataset | Fichier | Enregistrements | Rôle |
|---------|---------|:--------------:|------|
| Guide de tri ODWB | [`dataset/guide-de-tri0.json`](./dataset/guide-de-tri0.json) | 475 | Identifier le déchet et sa filière de tri |
| Recupel points de collecte | [`dataset/recupel-points-collecte.json`](./dataset/recupel-points-collecte.json) | 1 431 (Wallonie+BXL) | Localiser un point de collecte DEEE / ampoules |
| Déchets Recyparcs | [`dataset/dechets-recyparcs.json`](./dataset/dechets-recyparcs.json) | 223 (Wallonie) | Localiser un recyparc agréé et son contact |

La structure complète de chaque dataset est documentée dans [`dataset-odwb.md`](./dataset-odwb.md).

### 4.1 Source primaire — `guide-de-tri0.json`
- Point d'entrée de toute recherche : l'utilisateur décrit ou montre un déchet → le chatbot l'identifie dans ce fichier
- **Aucun appel réseau** pour les recherches textuelles
- **Seule exception** : l'accès aux images de déchets via `photos.url` (appel HTTP vers ODWB), nécessaire pour la reconnaissance visuelle (voir section 5.4)

### 4.2 Source complémentaire — `recupel-points-collecte.json`
- Utilisé en **complément** de `guide-de-tri0.json` lorsque le déchet identifié appartient à la catégorie DEEE (appareils électriques/électroniques) ou ampoules
- Filtrage obligatoire sur `region_name_french` : `"Région wallonne"` ou `"Région de Bruxelles-Capitale"` uniquement
- Permet de proposer à l'enfant les points de collecte Recupel les plus proches de chez lui

### 4.3 Source complémentaire — `dechets-recyparcs.json`
- Utilisé en **complément** de `guide-de-tri0.json` lorsque le champ `infoparc` d'un déchet indique qu'il faut se rendre au recyparc
- Couvre uniquement la **Wallonie** (223 recyparcs agréés, gérés par 7 intercommunales)
- Permet de proposer à l'enfant le recyparc le plus proche avec ses coordonnées et contacts

### 4.4 Source de fallback — Connaissances du modèle IA

Les connaissances propres du modèle sont mobilisées dans **deux cas distincts** :

**Cas 1 — Déchet non trouvé dans `guide-de-tri0.json`**
- Activé si la recherche fuzzy ne retourne aucun résultat pertinent pour un objet spécifique
- Le modèle répond sur le tri de cet objet en s'appuyant sur ses connaissances générales du tri en Wallonie/Bruxelles

**Cas 2 — Questions sur le cycle de vie et les procédés de recyclage**
- Les datasets locaux ne contiennent pas d'informations sur le fonctionnement technique du recyclage (comment le verre est refondu, comment le plastique est granulé, etc.) — seul le champ `destination` donne une indication sommaire de la filière
- Pour ce type de question, le modèle IA répond **sur base de ses propres connaissances**
- Ces connaissances sont **strictement encadrées** :
  - ✅ Expliquer comment un matériau est techniquement recyclé (fonte, broyage, compostage, etc.)
  - ✅ Décrire ce que l'on fabrique avec les matières recyclées
  - ✅ Expliquer les bénéfices environnementaux du recyclage
  - ❌ Ne jamais affirmer des faits incertains — si le modèle n'est pas sûr, il doit le signaler explicitement (_"je pense que..."_, _"en général..."_)
  - ❌ Pas d'hallucination : aucune invention de chiffres, de noms d'organismes ou de procédés non vérifiés
  - ❌ Pas de dérive thématique : même en mode fallback, toute réponse doit rester dans le périmètre déchets/recyclage/tri

---

## 5. Fonctionnalités

### 5.1 Modes d'entrée (input)

| Mode | Description |
|------|-------------|
| **Texte** | Saisie écrite classique |
| **Vocal (Push-to-Talk)** | L'utilisateur maintient un bouton pour enregistrer sa voix ; le message est transcrit en texte avant traitement |
| **Image** | Upload d'une photo d'un déchet pour identification |

> **Important** : Le chatbot répond **toujours par écrit**, même si l'entrée est vocale.

### 5.2 Traitement des messages texte

Le chatbot répond à **tout type de question conversationnelle** sur les déchets — pas uniquement à des demandes d'identification. Les questions peuvent être :

- **Identification** : _"Où je jette une bouteille en plastique ?"_, _"C'est quoi le sac bleu ?"_
- **Cycle de vie** : _"Qu'est-ce qui arrive à mon vieux téléphone après le recyparc ?"_, _"Comment on recycle le verre ?"_
- **Éducatives** : _"Pourquoi il faut trier les déchets ?"_, _"C'est quoi la différence entre recycler et réutiliser ?"_
- **Pratiques** : _"Comment préparer mes cartons avant de les jeter ?"_, _"Mon frigo est cassé, qu'est-ce que je fais ?"_
- **Géographiques** : _"Où est le recyparc le plus proche ?"_, _"Il y a un point Recupel dans ma ville ?"_

**Logique de traitement :**
- Recherche par **mots-clés** dans les datasets locaux (priorité à `guide-de-tri0.json`)
- **Fuzzy matching** : gestion des fautes d'orthographe et des variantes orthographiques
- **Gestion des synonymes** : ex. "bouteille en plastique" = "PET", "flacon"
- Pour les questions sur le devenir d'un déchet : exploiter en priorité le champ `destination` de `guide-de-tri0.json`, puis compléter avec les connaissances du modèle si nécessaire
- Pour les questions sur les **procédés techniques de recyclage** (comment ça fonctionne, comment c'est transformé) : ces informations sont absentes des datasets — le modèle répond sur base de ses propres connaissances, **sans inventer**, en signalant l'incertitude si elle existe
- Si les datasets ne couvrent pas la question → **fallback modèle IA**, toujours dans le cadre du tri des déchets en Wallonie/Bruxelles — voir section 4.4 pour les règles anti-hallucination
- **Logging des termes non reconnus** : tout terme non identifié est enregistré pour enrichir progressivement la base de synonymes

### 5.3 Traitement des messages vocaux (Push-to-Talk)

- Transcription de l'audio en texte (Speech-to-Text)
- Le texte transcrit est ensuite traité comme un message texte classique
- La réponse est toujours textuelle (pas de synthèse vocale en sortie)

### 5.4 Traitement des images

- L'utilisateur peut uploader une photo d'un objet/déchet
- Le chatbot analyse l'image (vision IA) pour identifier le déchet
- Il utilise les **images de référence ODWB** (via `photos.url` dans le dataset local) comme référence pour la reconnaissance visuelle
- Si le déchet est identifié → le chatbot indique :
  - Dans quelle **poubelle de tri** le jeter (à domicile)
  - Et/ou dans quel **container au recyparc** le déposer
- Si l'image **ne correspond pas à un déchet** → réponse polie indiquant que le chatbot ne peut pas répondre à cette demande
- Taille maximale des images : **5 Mo**

### 5.5 Historique des conversations

- L'historique des messages est **conservé localement** :
  - **Web** : stockage dans le `localStorage` du navigateur
  - **Telegram** : stockage local sur l'appareil de l'utilisateur (si techniquement faisable via le bot Telegram)
- **Aucune création de compte utilisateur n'est requise**
- L'historique permet au chatbot de maintenir le contexte d'une session

### 5.6 Gestion des sujets hors scope

- Si la question ne concerne pas le tri des déchets → le chatbot décline poliment et recentre vers son domaine
- Les formules de réponse exactes sont définies dans [`chatbot-persona.md`](./chatbot-persona.md) — section **Formules types**

### 5.8 Redirection géographique vers recyparcs et points de collecte

Lorsqu'un déchet identifié nécessite un dépôt en dehors du domicile, le chatbot doit être capable de proposer à l'enfant **où aller concrètement**, en s'appuyant sur les datasets `dechets-recyparcs.json` et `recupel-points-collecte.json`.

#### 5.8.1 Priorité de traitement

Le chatbot applique la logique de priorité suivante, dans cet ordre :

1. **Collecte à domicile disponible** (`infocollecte` renseigné dans guide-de-tri0) → indiquer le sac/conteneur à utiliser, pas de redirection géographique nécessaire
2. **Recyparc requis** (`infoparc` renseigné) → proposer les recyparcs les plus proches via `dechets-recyparcs.json`
3. **Déchet DEEE ou ampoule** (catégorie électrique/électronique identifiée) → proposer les points Recupel les plus proches via `recupel-points-collecte.json`
4. Les deux options 2 et 3 peuvent s'appliquer simultanément si le déchet est accepté dans les deux types de points

#### 5.8.2 Demande de localisation à l'utilisateur

- Le chatbot **ne collecte pas de données GPS** — il demande simplement à l'enfant sa **ville** ou son **code postal**
- Cette demande est formulée de façon naturelle et adaptée à l'enfant : _"Pour trouver le point de collecte le plus proche de chez toi, tu peux me donner ta ville ou ton code postal ?"_
- La localisation fournie est utilisée **uniquement le temps de la réponse**, elle n'est pas sauvegardée

#### 5.8.3 Format de la réponse de redirection

- Le chatbot présente **maximum 2 à 3 points** les plus proches — pas de liste exhaustive
- Pour chaque point, afficher : nom, adresse, et si disponible le téléphone
- Pour les recyparcs : mentionner l'intercommunale gestionnaire (`denomination_exploitant`) et son contact (`tel_exploitant`) si le téléphone direct est absent
- Pour les points Recupel : mentionner les types de déchets acceptés (`locations_categories`) de façon lisible pour un enfant

#### 5.8.4 Cas particuliers

| Situation | Comportement |
|-----------|-------------|
| Utilisateur ne fournit pas sa localisation | Répondre sur le tri sans redirection géographique, inviter à redemander avec la ville |
| Déchet interdit en recyparc (ex. amiante floquée) | Ne pas rediriger vers un recyparc — indiquer clairement qu'il faut contacter un collecteur agréé |
| Déchet encore fonctionnel (point `ForReuse` Recupel disponible) | Suggérer en priorité le **réemploi** avant le recyclage |

L'intelligence derrière le chatbot doit **s'améliorer au fil du temps** de manière autonome, en capitalisant sur chaque interaction et les données du dataset local.

#### 5.7.1 Mémorisation des résultats de recherche

- Chaque association `terme recherché → résultat dans le dataset` est **persistée côté serveur** (base de données ou fichier structuré)
- Ces données constituent un **cache enrichi** qui s'étoffe progressivement et accélère les réponses futures aux mêmes questions
- Les associations validées améliorent la pertinence de la recherche fuzzy au fil du temps

#### 5.7.2 Enrichissement des synonymes et mots-clés

- Lorsqu'un terme non reconnu est loggé (voir section 6.4), il alimente une **file de révision**
- Un mécanisme (manuel ou semi-automatique) permet de valider et d'intégrer ces nouveaux termes dans la base de synonymes
- Les associations validées sont ensuite disponibles pour tous les utilisateurs futurs

#### 5.7.3 Apprentissage par les patterns de questions

- Les questions les plus fréquemment posées sont identifiées et leurs réponses **pré-calculées ou mises en cache prioritaire**
- Si une même question déclenche régulièrement le fallback modèle (= pas trouvé dans le dataset), cela doit être signalé pour investigation et potentielle mise à jour du dataset
- Le système doit tenir un **compteur de confiance** par déchet/terme : plus un résultat a été confirmé ou utilisé avec succès, plus il est priorisé

#### 5.7.4 Amélioration de la reconnaissance d'images

- Chaque image uploadée et identifiée avec succès (ou échouée) alimente un **log d'entraînement**
- Les images ODWB récupérées via `photos.url` sont stockées localement pour constituer un dataset de référence visuel croissant
- Ce dataset peut être utilisé pour affiner les capacités de vision IA au fur et à mesure (fine-tuning ou few-shot learning selon le modèle retenu)

#### 5.7.5 Aucune donnée personnelle dans l'apprentissage

- L'apprentissage porte uniquement sur les **termes, objets et patterns de questions** — jamais sur les données personnelles des utilisateurs
- Les logs d'entraînement sont **anonymisés** (pas de lien avec un utilisateur identifiable)

---

## 6. Contraintes techniques

### 6.1 Rate limiting (anti-abus)

| Type d'action | Limite |
|---------------|--------|
| Envoi de messages texte/vocal | **1 message maximum toutes les 10 secondes** par utilisateur |
| Upload d'images | **5 Mo maximum** par image |

- Les limites sont appliquées côté client ET côté serveur
- En cas de dépassement, un message d'attente clair est affiché à l'utilisateur

### 6.2 Images ODWB

- Les données textuelles sont **entièrement locales** (fichier `dataset/guide-de-tri0.json`) — aucun appel réseau pour les recherches
- Le seul accès réseau vers ODWB concerne le chargement des **images de référence** via `photos.url`, utilisé pour la reconnaissance visuelle
- Mettre en cache les images déjà chargées pour éviter les requêtes répétées
- Gérer les erreurs et timeouts de chargement d'image (fallback sur la recherche textuelle seule)

### 6.3 Reconnaissance d'images (Vision IA)

- Le modèle IA doit être capable d'**analyser le contenu des images** uploadées par l'utilisateur
- Il doit également être capable de **lire et comparer** les images de référence ODWB (chargées via `photos.url` du dataset local) afin de faire le lien entre l'image uploadée et un déchet du dataset
- Les images ODWB servent de **dataset de référence visuelle** pour améliorer la précision de l'identification

### 6.4 Stockage des logs

- Un système de **logging des objets non reconnus** doit être implémenté
- Ces logs permettront d'enrichir la base de synonymes et de mots-clés au fil du temps
- Structure minimale d'un log : `{ timestamp, input_text, matched_keywords: [], unrecognized_terms: [] }`

### 6.5 Protection contre le prompt injection

Toute entrée utilisateur — qu'elle soit saisie par **texte** ou transmise via **message vocal** (après transcription) — doit être systématiquement validée et assainie avant d'être transmise au modèle IA. L'utilisateur ne doit **jamais** pouvoir altérer le comportement du chatbot via son input.

**Règles obligatoires :**

- **Longueur maximale** : tout message est tronqué à 500 caractères côté serveur
- **Détection de patterns d'injection** : rejet de tout message contenant des formulations visant à redéfinir le rôle du modèle (`ignore tes instructions`, `tu es maintenant`, `oublie tout`, `act as`, `[SYSTEM]`, balises de rôle, etc.)
- **Séparation stricte des rôles** : l'input utilisateur est transmis **exclusivement** dans le rôle `user` de l'API OpenAI — il ne peut jamais atteindre le `system` prompt
- **System prompt immuable** : la personnalité, le scope et les règles du chatbot sont définis côté serveur et ne peuvent pas être modifiés ou influencés par le contenu d'un message utilisateur
- **Parité texte/voix** : la transcription vocale passe par le **même pipeline de validation** que la saisie texte — la voix n'est pas un canal moins sécurisé
- **Comportement en cas de rejet** : réponse neutre côté client ("Je n'ai pas bien compris, peux-tu reformuler ?") — sans révéler la raison du rejet ; événement loggé côté serveur (sans le contenu)

> Les détails d'implémentation de ce module sont documentés dans [`architecture.md`](./architecture.md) — section **3.3 `lib/sanitize.ts`**.

---

## 7. Interface graphique (Phase 1 — Web)

- Interface de **chat** moderne et colorée, adaptée visuellement aux enfants (~12 ans)
- Le ton et les textes affichés suivent les règles définies dans [`chatbot-persona.md`](./chatbot-persona.md)
- Composants UI nécessaires :
  - Zone d'affichage des messages (historique)
  - Champ de saisie texte
  - Bouton **Push-to-Talk** (maintenir pour parler)
  - Bouton d'**upload d'image** (avec prévisualisation et limite 5 Mo)
  - Indicateur de chargement pendant le traitement
  - Message d'erreur clair en cas de rate limit atteint
- Accessibilité (contraste WCAG AA minimum, taille de police adaptée)

### 7.1 Responsive design — Exigence critique

> **L'interface doit être parfaitement utilisable sur n'importe quel appareil**, du smartphone le plus étroit à l'écran large d'ordinateur de bureau. Ce n'est pas un "nice to have" — c'est une exigence de base, les enfants utilisant majoritairement leur téléphone.

#### Comportements attendus par breakpoint

| Breakpoint | Largeur | Comportement |
|------------|---------|--------------|
| **Mobile** | < 640px | L'interface occupe **100% de la hauteur et de la largeur** de l'écran. La barre de saisie est fixée en bas. Le clavier virtuel ne masque pas les messages. |
| **Tablet** | 640px – 1024px | Même comportement que mobile, centré avec une largeur max de 768px si souhaité |
| **Desktop** | > 1024px | L'interface est centrée, avec une **largeur maximale** (ex. 800px) pour éviter des bulles trop larges ; hauteur pleine page |

#### Règles impératives

- **Hauteur pleine écran** : l'interface doit occuper `100dvh` (dynamic viewport height) — pas `100vh` qui ignore la barre d'adresse du navigateur mobile
- **Barre de saisie fixée en bas** : toujours visible et accessible, même quand le clavier virtuel s'ouvre sur mobile
- **Pas de scroll horizontal** : `overflow-x: hidden` sur le conteneur racine
- **Zone de messages scrollable** : la zone de chat doit scroller indépendamment, entre le header et la barre de saisie (`flex-1 overflow-y-auto`)
- **Boutons tactiles suffisamment grands** : taille minimale de 44×44px pour tous les boutons interactifs (directive Apple HIG / WCAG 2.5.5)
- **Texte lisible sans zoom** : taille de police minimale de 16px sur mobile pour éviter le zoom automatique de Safari iOS sur les champs de saisie
- **Images et previews** : les prévisualisations d'images uploadées s'adaptent à la largeur disponible sans déborder (`max-width: 100%`)
- **Touch events** : le bouton Push-to-Talk doit répondre aux événements `touchstart` / `touchend` (et pas seulement `mousedown` / `mouseup`) pour fonctionner sur mobile

#### Appareils de référence pour les tests

| Appareil | Résolution | OS |
|----------|------------|-----|
| iPhone SE (3e gen) | 375×667 px | iOS Safari |
| iPhone 14 Pro | 393×852 px | iOS Safari |
| Samsung Galaxy S21 | 360×800 px | Android Chrome |
| iPad (9e gen) | 810×1080 px | iPadOS Safari |
| Desktop 1080p | 1920×1080 px | Chrome / Firefox |

---

## 8. Intégration Telegram (Phase 2 — ⚠️ hors v1)

> **Cette section décrit une fonctionnalité future. Elle ne fait PAS partie de la v1 et ne doit pas être implémentée dans le cadre du hackathon.**

- Création d'un **bot Telegram** exposant les mêmes fonctionnalités que l'interface web
- Gestion des messages texte, vocaux (fichiers audio Telegram → transcription) et images
- Historique stocké localement sur l'appareil de l'utilisateur (si possible via les mécanismes natifs Telegram)
- Respect des mêmes règles de rate limiting et de scope thématique
- Le bot doit être identifié clairement comme un chatbot pour enfants sur le tri des déchets

---

## 9. Exigences non fonctionnelles

| Critère | Exigence |
|---------|----------|
| **Performances** | Réponse affichée en moins de 3 secondes (hors traitement image) |
| **Disponibilité** | Interface web disponible 24h/24 |
| **Sécurité** | Aucune donnée personnelle collectée ; pas de compte utilisateur |
| **Confidentialité** | Historique uniquement local (pas de sync serveur) |
| **Maintenabilité** | Code modulaire : module recherche/fuzzy, module vision, module UI |
| **Extensibilité** | Architecture permettant d'ajouter facilement de nouvelles sources de données ou langues |

---

## 10. Versions futures — Gamification

> ⚠️ **Ces fonctionnalités sont hors scope de la v1.** Elles sont documentées pour préparer les itérations suivantes (v2/v3) sans impacter le développement initial.

L'application a vocation à intégrer des mécaniques de **gamification** dans ses versions futures afin de renforcer l'engagement et la dimension éducative auprès des enfants.

Les fonctionnalités envisagées sont détaillées dans [`games-features.md`](./games-features.md). En résumé :

| Jeu | Version cible | Concept |
|-----|:---:|---------|
| 🕵️ Détective des Déchets | v2 | Le chatbot soumet une image ou une description d'un déchet — l'enfant doit identifier la bonne poubelle ou le bon container |
| 🧠 Quiz du Recyclage | v2 | QCM à 3 niveaux de difficulté, généré dynamiquement depuis les datasets |
| 🗑️ Trier la Poubelle | v2 | Affecter une liste d'objets mélangés à la bonne poubelle (drag & drop web / texte Telegram) |
| 🌍 Éco-Impact Meter | v3 | Jauge d'impact environnemental cumulé des bons gestes de tri |
| 🏆 Défis & Badges | v3 | Défis hebdomadaires thématiques et système de badges, sans compte utilisateur |

**Contraintes à respecter pour les versions futures :**
- Toutes les questions et défis sont générés depuis les **datasets locaux** — pas de contenu hardcodé
- Les scores et badges restent stockés **localement** (localStorage / appareil) — pas de compte utilisateur, cohérent avec la politique de confidentialité
- Le ton et le style des jeux suivent les mêmes règles que le chatbot principal (voir [`chatbot-persona.md`](./chatbot-persona.md))

### 11.1 Versionnement du code source

- Le code source de l'application est versionné sur **GitHub** :
  **[https://github.com/Nolanclosterman/Equipe-5.git](https://github.com/Nolanclosterman/Equipe-5.git)**
- Toutes les contributions doivent passer par ce dépôt (branches, pull requests, etc.)

### 11.2 Déploiement

- L'application est déployée sur **[Vercel](https://vercel.com)**
- Elle doit être **accessible publiquement** depuis n'importe quel navigateur, sans installation requise
- Le déploiement est déclenché automatiquement à chaque push sur la branche principale (`main`) via l'intégration GitHub ↔ Vercel
- Les variables d'environnement sensibles (clés API, etc.) sont configurées dans le dashboard Vercel, **jamais committées dans le dépôt**

---

## 11. Synthèse des flux principaux

```
Utilisateur (enfant)
        │
        ├─ Texte ──────────────────────────────────────────────────────────────┐
        │                                                                       │
        ├─ Vocal (PTT) → Speech-to-Text → Texte ─────────────────────────────┤
        │                                                                       ▼
        │                                                          Rate Limit Check (1/10s)
        │                                                                       │
        │                                                          Fuzzy Match + Synonymes
        │                                                                       │
        │                                                          Dataset local (source primaire)
        │                                                                       │
        │                                                          Résultat trouvé ?
        │                                                         ┌─────┴─────┐
        │                                                        OUI         NON
        │                                                         │           │
        │                                                    Réponse dataset  Fallback modèle IA
        │                                                         │           │
        │                                                         └─────┬─────┘
        │                                                               │
        └─ Image ──► Vision IA + Images ODWB ──► Déchet identifié ? ──►┤
                                                                        │
                                                               Réponse écrite → Utilisateur
                                                               + Sauvegarde localStorage
```

---

## 12. Fichiers de référence

- [`dataset-odwb.md`](./dataset-odwb.md) — Documentation du dataset ODWB (structure, champs, accès aux images)
- [`architecture.md`](./architecture.md) — Architecture technique du système
- [`chatbot-persona.md`](./chatbot-persona.md) — Persona, ton et règles de communication du chatbot
- [`games-features.md`](./games-features.md) — Fonctionnalités de gamification prévues pour les versions v2/v3 (hors scope v1)
