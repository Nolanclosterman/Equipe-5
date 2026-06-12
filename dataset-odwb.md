# Documentation API — ODWB Guide de tri

## 1. Vue d'ensemble

Le dataset **Open Data Wallonie-Bruxelles (ODWB)** constitue la **source de données primaire** du chatbot pour le tri des déchets en Wallonie et à Bruxelles.

- **Dataset ID** : `guide-de-tri0`
- **Nombre d'enregistrements** : 475 déchets référencés
- **Nombre de catégories** : 35 catégories
- **Format** : JSON
- **Fichier local** : [`guide-de-tri0.json`](./dataset/guide-de-tri0.json) — snapshot complet du dataset, embarqué dans l'application

### Stratégie d'accès aux données

| Opération | Méthode |
|-----------|---------|
| Recherche de déchets (texte, mots-clés, fuzzy) | ✅ Lecture locale dans `dataset/guide-de-tri0.json` — **aucun appel réseau** |
| Accès à l'image d'un déchet pour reconnaissance visuelle | 🌐 Appel HTTP vers `photos.url` (URL externe ODWB) |

> L'intégralité du dataset étant disponible localement, **l'API ODWB n'est jamais appelée pour les recherches**. Le seul appel réseau vers ODWB concerne le chargement des images référencées dans `photos.url`, nécessaire à l'analyse visuelle par l'IA.

---

## 2. Endpoint image (seul appel réseau vers ODWB)

```
GET https://www.odwb.be/api/explore/v2.1/catalog/datasets/guide-de-tri0/files/{file_id}
```

- `{file_id}` correspond à la valeur du champ `photos.id` dans l'enregistrement
- Retourne directement le fichier image (PNG, 300×500 px)
- Cet appel est effectué **uniquement dans le cadre de la reconnaissance visuelle** : l'IA charge l'image de référence ODWB pour la comparer à l'image uploadée par l'utilisateur

**Exemple :**
```
GET https://www.odwb.be/api/explore/v2.1/catalog/datasets/guide-de-tri0/files/caf331bf0a29fa0769435c01d238d2ee
```

---

## 3. Structure d'un enregistrement

Chaque enregistrement du dataset représente un **déchet spécifique** et contient les champs suivants :

```json
{
  "id": 43,
  "categorie": "Bouteilles et flacons en plastique",
  "dechet": "Bouteille de coca ou soft en plastique",
  "infocollecte": "Dans le sac bleu des PMC",
  "infoparc": null,
  "prevention": "Privilégiez les bouteilles en verre consigné ou les gourdes.",
  "destination": "Une fois lavés, broyés et transformés en pellets (pétales) ou en granulés, ils sont fondus pour fabriquer de nouveaux produits, emballages ou objets.",
  "en_savoir": "https://www.bep-environnement.be/collectes-tri-des-dechets/pmc/",
  "photos": {
    "thumbnail": true,
    "filename": "id43.png",
    "format": "PNG",
    "width": 300,
    "height": 500,
    "id": "caf331bf0a29fa0769435c01d238d2ee",
    "color_summary": [
      "rgba(254, 254, 255, 1.00)",
      "rgba(229, 211, 215, 1.00)",
      "rgba(245, 238, 240, 1.00)"
    ],
    "url": "https://www.odwb.be/api/explore/v2.1/catalog/datasets/guide-de-tri0/files/caf331bf0a29fa0769435c01d238d2ee"
  }
}
```

---

## 4. Description détaillée des champs

### 4.1 `id`
- **Type** : integer
- **Nullable** : ❌ Non (toujours présent)
- **Description** : Identifiant unique de l'enregistrement dans le dataset. Correspond également au nom du fichier image associé (`id{N}.png`)
- **Exemple** : `43`

---

### 4.2 `categorie`
- **Type** : string
- **Nullable** : ❌ Non (toujours présent)
- **Description** : Clé de regroupement thématique du déchet. Permet de regrouper plusieurs déchets similaires sous une même famille. La valeur peut contenir des espaces, des accents et des parenthèses — il ne s'agit pas d'un slug technique mais d'un libellé lisible.
- **Utilisation chatbot** : Permet de retrouver tous les déchets d'une même famille, ou de proposer des déchets similaires lors d'une recherche
- **Exemple** : `"Bouteilles et flacons en plastique"`, `"Déchets spéciaux des ménages"`, `"Verres"`

**Liste complète des 35 catégories :**

| Catégorie | Nb de déchets |
|-----------|:---:|
| Amiante-ciment | 8 |
| Au recyparc - DEEE (déchets d'équipements électriques et électroniques) | 1 |
| Autres | 2 |
| Bois | 22 |
| Bouchons | 9 |
| Bouteilles et flacons en plastique | 13 |
| Cartons | 14 |
| Déchets d'équipements électriques et électroniques | 41 |
| Déchets d'équipements électroniques et électriques | 2 |
| Déchets de cuisine | 1 |
| Déchets ménagers résiduels | 63 |
| Déchets organiques | 22 |
| Déchets spéciaux des ménages | 36 |
| Déchets verts | 11 |
| Emballages bi-matière | 1 |
| Emballages métalliques | 14 |
| Emballages plastique | 3 |
| Encombrants | 28 |
| Encombrants non-incinérables | 5 |
| Encombrants non-incinérales | 1 |
| Frigolite | 7 |
| Huiles | 3 |
| Inertes | 21 |
| Matelas | 2 |
| Métaux | 21 |
| Papiers | 12 |
| Piles | 10 |
| Plastiques | 40 |
| Plastiques durs | 18 |
| Pneus | 6 |
| Pots de fleurs en plastique | 3 |
| Textiles | 9 |
| Verre plat | 6 |
| Verres | 19 |
| bouteilles et flacons en métal | 1 |

---

### 4.3 `dechet`
- **Type** : string
- **Nullable** : ❌ Non (toujours présent)
- **Description** : Nom ou description technique du déchet spécifique. C'est le champ principal pour la **recherche par mot-clé et fuzzy matching**. Il s'agit souvent d'une dénomination précise (marque générique, matériau, usage)
- **Utilisation chatbot** : Champ cible prioritaire pour la recherche textuelle
- **Exemples** : `"Bouteille de coca ou soft en plastique"`, `"Panneau photovoltaïque"`, `"Fleur fanée"`, `"Téléphone portable"`

---

### 4.4 `infocollecte`
- **Type** : string | null
- **Nullable** : ✅ Oui — absent pour **241 enregistrements sur 475** (51%)
- **Description** : Indique comment gérer le déchet **à domicile** — dans quel sac, quelle poubelle, quel container de collecte déposer le déchet, ou quel organisme contacter si la collecte à domicile n'est pas possible. Absent quand seul le passage au recyparc est possible.
- **Utilisation chatbot** : Répondre aux questions "comment je jette ça à la maison ?"
- **Exemples** :
  - `"Dans le sac bleu des PMC"`
  - `"Dans le sac blanc/gris des déchets résiduels"`
  - `"A la collecte des déchets organiques"`
  - `"Contacter Recupel pour la collecte"`

---

### 4.5 `infoparc`
- **Type** : string | null
- **Nullable** : ✅ Oui — absent pour **190 enregistrements sur 475** (40%)
- **Description** : Indique dans quel container ou zone déposer le déchet **lors d'une visite au recyparc**. Peut aussi préciser des conditions particulières (emballage hermétique, nombre de recyparcs acceptant ce déchet, interdiction totale, etc.)
- **Utilisation chatbot** : Répondre aux questions "où est-ce que je dépose ça au recyparc ?"
- **Exemples** :
  - `"Au recyparc - bois"`
  - `"Au recyparc - déchets verts"`
  - `"Interdit dans les recyparcs. S'adresser à des collecteurs agréés."`
  - `"Dans un des 9 recyparcs qui reprennent ce déchet. Obligation d'emballer hermétiquement avant d'entrer au recyparc"`

---

### 4.6 `prevention`
- **Type** : string | null
- **Nullable** : ✅ Oui — absent pour **265 enregistrements sur 475** (56%)
- **Description** : Conseils pour **prévenir ou réduire** la production de ce déchet, ou instructions sur comment le préparer avant de le trier (découpe, séparation de matériaux, nettoyage, etc.). Également des conseils de réemploi ou d'achat alternatif.
- **Utilisation chatbot** : Information pédagogique complémentaire, particulièrement adaptée pour sensibiliser les enfants aux gestes éco-responsables
- **Exemples** :
  - `"Privilégiez les bouteilles en verre consigné ou les gourdes."`
  - `"Privilégiez la location ou l'achat de seconde main. Pensez au réemploi."`
  - `"Retirez les vis et ferrures métalliques avant de déposer le bois au recyparc."`

---

### 4.7 `destination`
- **Type** : string | null
- **Nullable** : ✅ Oui — absent pour seulement **5 enregistrements sur 475** (1%) — quasiment toujours renseigné
- **Description** : Explique la **filière de valorisation finale** du déchet une fois trié : ce qu'il devient après collecte, transformation, recyclage ou enfouissement. C'est le champ le plus **pédagogique** du dataset — idéal pour expliquer aux enfants pourquoi trier a du sens.
- **Utilisation chatbot** : Enrichir les réponses avec un angle éducatif et motivant ("Si tu tris ta bouteille, elle va devenir...")
- **Exemples** :
  - `"Une fois lavés, broyés et transformés en pellets (pétales) ou en granulés, ils sont fondus pour fabriquer de nouveaux produits, emballages ou objets."`
  - `"Ils sont transformés en compost végétal (engrais, amendement organique) valorisé principalement en agriculture."`
  - `"L'amiante-ciment est acheminée dans un centre d'enfouissement technique agréé de classe 2."`
  - `"Réduits en plaquette de bois, ils sont valorisés comme combustible alternatif aux énergies fossiles dans des chaudières industrielles."`

---

### 4.8 `en_savoir`
- **Type** : string (URL) | null
- **Nullable** : ✅ Oui — absent pour **195 enregistrements sur 475** (41%)
- **Description** : URL vers une page externe fournissant des **informations complémentaires** sur le déchet ou sa filière de gestion. Les liens pointent majoritairement vers des sites d'intercommunales wallonnes (BEP, IDELUX, etc.) ou des organismes spécialisés.
- **Utilisation chatbot** : Proposer en fin de réponse un lien "pour en savoir plus" — à afficher comme lien cliquable dans l'interface
- **Exemples** :
  - `"https://www.bep-environnement.be/collectes-tri-des-dechets/pmc/"`
  - `"https://solutionspourlamiante.be/"`
  - `"https://www.odwb.be/..."`

---

### 4.9 `photos`
- **Type** : object | null
- **Nullable** : ✅ Oui — absent pour **41 enregistrements sur 475** (9%)
- **Description** : Objet contenant les métadonnées et l'URL d'accès à l'**image de référence** du déchet. Ces images sont au format PNG, en portrait (300×500 px), avec fond généralement blanc. Elles servent de **dataset visuel de référence** pour la reconnaissance d'images uploadées par les utilisateurs.

**Structure de l'objet `photos` :**

| Sous-champ | Type | Description |
|------------|------|-------------|
| `id` | string (MD5) | Identifiant unique du fichier image — utilisé dans l'URL d'accès |
| `filename` | string | Nom du fichier image, formaté `id{N}.png` où `N` correspond au champ `id` de l'enregistrement |
| `format` | string | Format de l'image — toujours `"PNG"` |
| `width` | integer | Largeur en pixels — toujours `300` |
| `height` | integer | Hauteur en pixels — toujours `500` |
| `thumbnail` | boolean | Indique si une version miniature est disponible — toujours `true` |
| `color_summary` | array[string] | Tableau des 3 couleurs dominantes de l'image au format `rgba(R, G, B, A)` — utile pour filtrage visuel grossier |
| `url` | string (URL) | URL complète pour accéder à l'image via l'API ODWB |

**URL d'accès à l'image :**
```
https://www.odwb.be/api/explore/v2.1/catalog/datasets/guide-de-tri0/files/{photos.id}
```

**Exemple complet :**
```json
"photos": {
  "thumbnail": true,
  "filename": "id43.png",
  "format": "PNG",
  "width": 300,
  "height": 500,
  "id": "caf331bf0a29fa0769435c01d238d2ee",
  "color_summary": [
    "rgba(254, 254, 255, 1.00)",
    "rgba(229, 211, 215, 1.00)",
    "rgba(245, 238, 240, 1.00)"
  ],
  "url": "https://www.odwb.be/api/explore/v2.1/catalog/datasets/guide-de-tri0/files/caf331bf0a29fa0769435c01d238d2ee"
}
```

> **Note pour la reconnaissance visuelle** : Le `color_summary` peut servir de pré-filtre rapide (ex. exclure les images à dominante verte si l'objet uploadé est rouge), mais la comparaison réelle doit se faire par analyse de contenu via vision IA.

---

## 5. Exemples d'enregistrements complets

### Déchet collecté à domicile uniquement
```json
{
  "id": 43,
  "categorie": "Bouteilles et flacons en plastique",
  "dechet": "Bouteille de coca ou soft en plastique",
  "infocollecte": "Dans le sac bleu des PMC",
  "infoparc": null,
  "prevention": "Privilégiez les bouteilles en verre consigné ou les gourdes.",
  "destination": "Une fois lavés, broyés et transformés en pellets ou en granulés, ils sont fondus pour fabriquer de nouveaux produits, emballages ou objets.",
  "en_savoir": "https://www.bep-environnement.be/collectes-tri-des-dechets/pmc/",
  "photos": { "id": "caf331bf0a29fa0769435c01d238d2ee", "filename": "id43.png", ... }
}
```

### Déchet gérable à domicile ET au recyparc
```json
{
  "id": 223,
  "categorie": "Déchets verts",
  "dechet": "Fleur fanée",
  "infocollecte": "A la collecte des déchets organiques",
  "infoparc": "Au recyparc - déchets verts",
  "prevention": null,
  "destination": "Ils sont transformés en compost végétal (engrais, amendement organique) valorisé principalement en agriculture.",
  "en_savoir": "https://www.bep-environnement.be/actualites/dechets-verts-compost/",
  "photos": { "id": "3216ad7d880e90e92b79dd6ec0ba239d", "filename": "id223.png", ... }
}
```

### Déchet interdit en recyparc, collecteur agréé requis
```json
{
  "id": 1,
  "categorie": "Amiante-ciment",
  "dechet": "Amiante floquée",
  "infocollecte": null,
  "infoparc": "Interdit dans les recyparcs. S'adresser à des collecteurs agréés.",
  "prevention": null,
  "destination": null,
  "en_savoir": "https://solutionspourlamiante.be/",
  "photos": { "id": "0a3597c07814118d198f43483dccb8aa", "filename": "id1.png", ... }
}
```

---

## 6. Notes d'implémentation pour le chatbot

### Recherches — toujours dans `dataset/guide-de-tri0.json` (local)

| Cas d'usage | Champs à utiliser |
|-------------|-------------------|
| Recherche par nom d'objet | `dechet` (fuzzy match principal) + `categorie` (regroupement) |
| Réponse "je jette ça où à la maison ?" | `infocollecte` |
| Réponse "je dépose ça où au recyparc ?" | `infoparc` |
| Conseil éco-responsable | `prevention` |
| Explication pédagogique sur le devenir du déchet | `destination` |
| Lien "pour en savoir plus" | `en_savoir` |
| Pré-filtre visuel grossier | `photos.color_summary` |

### Reconnaissance visuelle — appel réseau vers `photos.url`

| Cas d'usage | Mécanisme |
|-------------|-----------|
| Identification d'un déchet à partir d'une image uploadée | Charger `photos.url` de chaque candidat → analyse vision IA → comparaison avec l'image de l'utilisateur |
| Constitution du dataset visuel de référence | Stocker localement les images récupérées via `photos.url` pour éviter des appels répétés |

> **Règle d'or** : toute donnée textuelle vient du fichier local `dataset/guide-de-tri0.json`. Seules les images (`photos.url`) nécessitent un appel réseau vers ODWB.

---

# Dataset 2 — Recupel Points de Collecte

## 1. Vue d'ensemble

Le dataset **Recupel** liste les points de collecte accessibles au grand public pour déposer appareils électroménagers, ampoules et autres appareils électriques en vue de leur recyclage ou réemploi.

- **Fichier local** : [`dataset/recupel-points-collecte.json`](./dataset/recupel-points-collecte.json)
- **Nombre total d'enregistrements** : 3 583 points de collecte (toute Belgique)
- **Enregistrements Wallonie + Bruxelles** : **1 431** points (à filtrer via `region_name_french`)
- **Usage chatbot** : rediriger l'utilisateur vers le point de collecte le plus proche quand un déchet électrique/électronique ou une ampoule doit être déposé chez Recupel

## 2. Structure d'un enregistrement

```json
{
  "name": "Storez",
  "synonym": "Storez",
  "locations": "{...}",
  "locations_name": "Storez",
  "locations_street1": "Rues des Hauts Fourneaux",
  "locations_street2": null,
  "locations_housenumber": "1",
  "locations_postofficebox": null,
  "locations_postalcode": 6200,
  "locations_city": "Châtelet",
  "locations_cityfr": "Châtelet",
  "locations_latitude": "50.4036762",
  "locations_longitude": "4.4979048",
  "point_geo": { "lon": 4.4979048, "lat": 50.4036762 },
  "locations_categories": ["ForRecycling", "FractionSmallElectro", "RecyclePointElectro"],
  "municipality_code": 52012,
  "region_name_french": "Région wallonne",
  "province_name_french": "Hainaut (le)",
  "arrondissement_name_french": "Charleroi"
}
```

## 3. Description des champs

| Champ | Type | Nullable | Description |
|-------|------|----------|-------------|
| `name` | string | ❌ | Nom commercial du point de collecte (enseigne, intercommunale, etc.) |
| `synonym` | string | ✅ 17% | Variante ou alias du nom — utile pour la recherche |
| `locations` | string (JSON sérialisé) | ❌ | Objet JSON encodé en string contenant les mêmes données adresse/catégories — **ne pas utiliser**, préférer les champs `locations_*` déjà parsés |
| `locations_name` | string | ❌ | Nom du point (identique à `name`) |
| `locations_street1` | string | ❌ | Rue principale |
| `locations_street2` | string | ✅ 94% | Complément d'adresse — quasiment jamais renseigné |
| `locations_housenumber` | string | ✅ 4% | Numéro de rue |
| `locations_postofficebox` | string | ✅ 100% | Boîte postale — toujours null, ignorer |
| `locations_postalcode` | integer | ❌ | Code postal |
| `locations_city` | string | ❌ | Ville (nom local) |
| `locations_cityfr` | string | ❌ | Ville en français — à privilégier pour l'affichage |
| `locations_latitude` | string | ❌ | Latitude (format string) |
| `locations_longitude` | string | ❌ | Longitude (format string) |
| `point_geo` | object `{lon, lat}` | ❌ | Coordonnées géographiques (format numérique) — à utiliser pour le calcul de distance |
| `locations_categories` | array[string] | ❌ | Types de déchets acceptés et type de point (voir section 4) |
| `municipality_code` | integer | ❌ | Code INS de la commune |
| `region_name_french` | string | ❌ | Région : `"Région wallonne"`, `"Région de Bruxelles-Capitale"` ou `"Région flamande"` — **filtrer sur les deux premières** |
| `province_name_french` | string | ✅ (BXL) | Province wallonne — null pour Bruxelles |
| `arrondissement_name_french` | string | ❌ | Arrondissement administratif |

## 4. Catégories (`locations_categories`)

Les catégories déterminent ce que le point accepte et son type. Catégories clés pour le chatbot :

| Catégorie | Signification | Nb points (Wallonie+BXL) |
|-----------|---------------|:---:|
| `RecyclePointElectro` | Point de collecte appareils électroménagers | 520 |
| `RecyclePointLamps` | Point de collecte ampoules | 830 |
| `ContainerPark` | Parc à conteneurs / recyparc | 230 |
| `ForReuse` | Point de réemploi / seconde vie | 64 |
| `CollectHome` | Collecte à domicile | 11 |
| `FractionSmallElectro` | Accepte le petit électroménager | 750 |
| `FractionBigElectro` | Accepte le gros électroménager | 230 |
| `FractionCoolingFreezing` | Accepte réfrigérateurs et congélateurs | 365 |
| `FractionLamp` | Accepte les ampoules | 1 049 |
| `FractionLampTL` | Accepte les tubes fluorescents (TL/néon) | 715 |
| `ForRecycling` | Destination recyclage (vs réemploi) | — |

> **Usage chatbot** : filtrer d'abord par `region_name_french`, puis par `locations_categories` selon le type de déchet identifié dans `guide-de-tri0.json`. Proposer les points les plus proches via `point_geo`.

## 5. Notes d'implémentation

| Cas d'usage | Logique |
|-------------|---------|
| Déchet DEEE (petit électro) | Filtrer `FractionSmallElectro` + Wallonie/BXL → proposer les 3 plus proches |
| Déchet gros électro (lave-linge, frigo...) | Filtrer `FractionBigElectro` ou `FractionCoolingFreezing` |
| Ampoule / tube néon | Filtrer `FractionLamp` ou `FractionLampTL` |
| Réemploi (encore fonctionnel) | Filtrer `ForReuse` → orienter vers seconde vie avant recyclage |
| Calcul de proximité | Utiliser `point_geo.lat` / `point_geo.lon` + coordonnées de l'utilisateur (si fournies) |

---

# Dataset 3 — Déchets Recyparcs (Wallonie)

## 1. Vue d'ensemble

Le dataset **Déchets Recyparcs** liste les parcs à conteneurs agréés en Wallonie : entreprises et installations de collecte, recyclage et élimination de déchets autorisées par la Région wallonne.

- **Fichier local** : [`dataset/dechets-recyparcs.json`](./dataset/dechets-recyparcs.json)
- **Nombre d'enregistrements** : **223** recyparcs
- **Couverture géographique** : Wallonie uniquement (codes postaux 1300 → 7972)
- **Exploitants** : 7 intercommunales wallonnes (BEP, HYGEA, IDELUX, INBW, INTRADEL, IPALLE, TIBI)
- **Usage chatbot** : fournir les coordonnées et contacts d'un recyparc précis quand `infoparc` dans `guide-de-tri0.json` indique d'y déposer un déchet

## 2. Structure d'un enregistrement

```json
{
  "denomination": "PARC A CONTENEURS DE AMEL",
  "ndeg_autorisation": 350.0,
  "rue": "Lieu-dit \"Auf der Leu\" (Medell)",
  "numero": null,
  "boite": null,
  "code_postal": "4770",
  "localite": "AMEL",
  "tel": "080/340911",
  "fax": null,
  "mail": null,
  "denomination_exploitant": "IDELUX ENVIRONNEMENT SC",
  "rue_exploitant": "Drève de l'Arc-en-Ciel",
  "numero_exploitant": 98.0,
  "code_postal_exploitant": 6700.0,
  "localite_exploitant": "ARLON",
  "tel_exploitant": "063/23.18.11",
  "mail_exploitant": "idelux.environnement@idelux.be",
  "debut": null,
  "expiration": null,
  "remarques": null,
  "adresse": "Lieu-dit \"Auf der Leu\" (Medell)",
  "geo_2d": { "lon": 6.1696235, "lat": 50.3536381 }
}
```

## 3. Description des champs

| Champ | Type | Nullable | Description |
|-------|------|----------|-------------|
| `denomination` | string | ❌ | Nom officiel du recyparc (toujours en majuscules) |
| `ndeg_autorisation` | float | ❌ | Numéro d'autorisation régionale — identifiant unique |
| `rue` | string | ❌ | Rue du recyparc |
| `numero` | string | ✅ 84% | Numéro de rue — souvent absent |
| `boite` | string | ✅ 97% | Boîte postale — quasi toujours null |
| `code_postal` | string | ❌ | Code postal du recyparc |
| `localite` | string | ❌ | Commune (en majuscules) |
| `tel` | string | ✅ 10% | Téléphone direct du recyparc |
| `fax` | — | ✅ 100% | Toujours null — ignorer |
| `mail` | — | ✅ 100% | Toujours null — ignorer |
| `denomination_exploitant` | string | ❌ | Nom de l'intercommunale gestionnaire |
| `rue_exploitant` | string | ❌ | Adresse du siège de l'exploitant |
| `numero_exploitant` | float | ❌ | Numéro de rue du siège |
| `code_postal_exploitant` | float | ❌ | Code postal du siège de l'exploitant |
| `localite_exploitant` | string | ❌ | Ville du siège de l'exploitant |
| `tel_exploitant` | string | ❌ | Téléphone de l'intercommunale — à utiliser si `tel` est null |
| `mail_exploitant` | string | ❌ | Email de l'intercommunale |
| `debut` | string | ✅ 76% | Date de début d'autorisation |
| `expiration` | string | ✅ 76% | Date d'expiration d'autorisation |
| `remarques` | string | ✅ 99% | Remarques libres — quasi toujours null |
| `adresse` | string | ❌ | Adresse complète formatée (rue + numéro) |
| `geo_2d` | object `{lon, lat}` | ❌ | Coordonnées géographiques — **toujours renseigné**, à utiliser pour la proximité |
| `x` / `y` | float | ✅ 71% | Coordonnées Lambert belge — souvent nulles, préférer `geo_2d` |
| `latitude` / `longitude` | float | ✅ 95% | Doublons de `geo_2d` mais souvent nulls — utiliser `geo_2d` |

## 4. Les 7 intercommunales wallonnes

| Exploitant | Zone couverte |
|-----------|---------------|
| `BEP - ENVIRONNEMENT SC` | Province de Namur |
| `HYGEA SC` | Région du Centre (Hainaut) |
| `IDELUX ENVIRONNEMENT SC` | Province de Luxembourg |
| `INBW SCRL` | Brabant wallon |
| `INTRADEL IC` | Province de Liège |
| `IPALLE SC` | Hainaut occidental |
| `TIBI SCRL` | Arrondissement de Charleroi |

## 5. Notes d'implémentation

| Cas d'usage | Logique |
|-------------|---------|
| Trouver le recyparc le plus proche | Utiliser `geo_2d` + coordonnées de l'utilisateur |
| Afficher le contact | `tel` si renseigné, sinon `tel_exploitant` + `mail_exploitant` |
| Identifier l'intercommunale | `denomination_exploitant` → lien avec le site de l'intercommunale |
| Recyparc le plus proche par ville | Filtrer sur `localite` ou `code_postal` |

> **Lien avec `guide-de-tri0.json`** : quand le champ `infoparc` d'un enregistrement ODWB mentionne "Au recyparc", utiliser ce dataset pour proposer les recyparcs les plus proches de l'utilisateur.

---

# Synthèse des 3 datasets

| Dataset | Fichier | Enregistrements utiles | Usage principal |
|---------|---------|----------------------|-----------------|
| Guide de tri ODWB | `dataset/guide-de-tri0.json` | 475 déchets | Identifier le déchet et sa filière de tri |
| Recupel points collecte | `dataset/recupel-points-collecte.json` | 1 431 (Wallonie+BXL) | Localiser un point de collecte DEEE / ampoules |
| Déchets Recyparcs | `dataset/dechets-recyparcs.json` | 223 (Wallonie) | Localiser un recyparc agréé et son contact |

**Flux de décision recommandé pour le chatbot :**

```
Déchet identifié dans guide-de-tri0.json
        │
        ├─ infoparc renseigné ?
        │   └─ OUI → proposer recyparc proche via dechets-recyparcs.json
        │
        ├─ categorie = DEEE / ampoule / électroménager ?
        │   └─ OUI → proposer point Recupel proche via recupel-points-collecte.json
        │              (filtrer FractionSmallElectro / FractionBigElectro / FractionLamp...)
        │
        └─ infocollecte renseigné ?
            └─ OUI → collecte à domicile, pas besoin de redirection géographique
```
