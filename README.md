# Gestion d'inventaire de laboratoire

Application full-stack de gestion de stock pour laboratoire. Le projet permet de piloter les articles, les fournisseurs, les seuils d'alerte, les besoins de réapprovisionnement et l'historique d'utilisation, avec authentification JWT et interface Vue 3.

## Vue d'ensemble

Le projet est composé de deux applications :

- `labo-gestion-backend` : API NestJS avec Sequelize et PostgreSQL
- `labo-gestion-frontend` : interface utilisateur Vue 3 avec Vite

L'objectif fonctionnel est de suivre les consommables du laboratoire, savoir quand réapprovisionner, préparer les demandes au magasin central ou aux fournisseurs, et conserver une traçabilité des utilisations.

## Fonctionnalités disponibles

### Authentification

- Connexion par identifiant et mot de passe.
- Génération d'un jeton JWT.
- Protection des routes métier côté backend.
- Création automatique d'un compte administrateur au démarrage du backend si absent.

### Gestion des articles

- Création, modification, suppression et consultation des articles.
- Références internes et fournisseurs.
- Prix unitaire.
- Stock actuel.
- Stock maximum par article.
- Stock minimum via seuil d'alerte bas.
- Indicateur P2.
- Association facultative à un fournisseur.

### Utilisation du stock

- Décrémentation directe depuis l'interface.
- Validation contre les stocks négatifs.
- Mise à jour immédiate de l'inventaire après utilisation.

### Fournisseurs

- Création, modification et suppression de fournisseurs.
- Liste consultable avec recherche.
- Email cliquable avec préparation d'une demande de réapprovisionnement.
- Sélection du fournisseur à la création ou édition d'un article.
- Blocage de suppression si le fournisseur est encore rattaché à des articles.

### Réapprovisionnement

- Calcul des écarts entre stock actuel et stock maximum.
- Tableau de préparation pour le magasin central.
- Affichage des articles à réapprovisionner.
- Export CSV des besoins de réapprovisionnement.
- Préparation de mails de demande article par article.
- Préparation de mails groupés par fournisseur depuis la liste fournisseurs.

### Alerte et pilotage visuel

- Mise en évidence des articles sous seuil bas.
- Bandeau d'alerte dédié pour les stocks critiques.
- Recherche, tri et filtres dans l'inventaire détaillé.
- Interface compacte avec tableaux scrollables pour éviter de surcharger la page.

### Traçabilité

- Enregistrement automatique des mouvements d'utilisation.
- Historique global ou filtré par article.
- Filtres par article, fournisseur et plage de dates.
- Export CSV de l'historique.
- Affichage compact des 5 derniers résultats visibles avec défilement pour le reste.

## Stack technique

- Frontend : Vue 3, TypeScript, Vite, Axios
- Backend : NestJS, TypeScript, Sequelize, sequelize-typescript, Passport, JWT, bcrypt, class-validator
- Base de données : PostgreSQL

## Structure du projet

```text
Lab_Gestion_Vue/
├── README.md
├── labo-gestion-backend/
│   ├── src/
│   │   ├── auth/
│   │   ├── item/
│   │   ├── stock-movements/
│   │   ├── suppliers/
│   │   └── users/
│   └── package.json
└── labo-gestion-frontend/
    ├── src/
    │   ├── components/
    │   ├── services/
    │   └── App.vue
    └── package.json
```

## Prérequis

- Node.js 20 minimum
- npm
- PostgreSQL local ou conteneurisé

## Configuration actuelle

Le backend utilise actuellement une configuration PostgreSQL définie directement dans `labo-gestion-backend/src/app.module.ts` :

- hôte : `localhost`
- port : `5432`
- utilisateur : `postgres`
- mot de passe : `root`
- base : `gestion_labo`

Exemple de lancement PostgreSQL avec Docker :

```powershell
docker run --name labo-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=root -e POSTGRES_DB=gestion_labo -p 5432:5432 -d postgres:15
```

## Installation

### Backend

```bash
cd labo-gestion-backend
npm install
```

### Frontend

```bash
cd labo-gestion-frontend
npm install
```

## Lancement en développement

Ouvrir deux terminaux.

### Terminal backend

```bash
cd labo-gestion-backend
npm run start:dev
```

API disponible sur `http://localhost:3000`

### Terminal frontend

```bash
cd labo-gestion-frontend
npm run dev
```

Interface généralement disponible sur `http://localhost:5173`

## Accès par défaut

Compte administrateur créé automatiquement si absent :

- utilisateur : `admin`
- mot de passe : `admin123`

Le frontend stocke ensuite le token JWT dans le `localStorage` et l'envoie automatiquement dans l'en-tête `Authorization`.

## API principale

### Authentification

- `POST /auth/login`

Exemple :

```json
{
  "username": "admin",
  "password": "admin123"
}
```

### Articles

- `GET /items`
- `GET /items/:id`
- `POST /items`
- `PATCH /items/:id`
- `DELETE /items/:id`
- `GET /items/restock-report`
- `POST /items/:id/decrement`

Exemple de décrémentation :

```json
{
  "amount": 1
}
```

### Fournisseurs

- `GET /suppliers`
- `GET /suppliers/:id`
- `POST /suppliers`
- `PATCH /suppliers/:id`
- `DELETE /suppliers/:id`

### Mouvements de stock

- `GET /stock-movements`

Filtres supportés :

- `itemId`
- `supplierId`
- `from`
- `to`
- `movementType`

Exemple :

```text
GET /stock-movements?itemId=3&from=2026-03-01&to=2026-03-31
```

Toutes les routes métier sont protégées par JWT.

## Parcours utilisateur dans l'interface

### Inventaire

- Recherche par nom, référence ou fournisseur.
- Filtres par état de stock.
- Tri par nom, fournisseur, stock, stock max ou écart.
- Boutons pour utiliser, éditer, supprimer ou consulter l'historique d'un article.

### Traçabilité

- Panneau dédié dans la page principale.
- Filtrage par article, fournisseur et période.
- Export CSV de l'historique filtré.
- Tableau limité visuellement à 5 lignes visibles avec ascenseur.

### Réapprovisionnement

- Vue de préparation pour le magasin central.
- Calcul automatique des quantités manquantes.
- Export CSV.
- Envoi de demande article par article.

### Fournisseurs

- Création et édition dans un formulaire dédié.
- Liste avec recherche.
- Email cliquable avec mail prérempli.
- Suppression désactivée si des articles y sont encore liés.

## Scripts utiles

### Backend

- `npm run start` : démarrage simple
- `npm run start:dev` : démarrage en mode watch
- `npm run build` : build backend
- `npm run test` : tests unitaires
- `npm run test:e2e` : tests end-to-end
- `npm run lint` : lint backend

### Frontend

- `npm run dev` : serveur de développement Vite
- `npm run build` : build frontend
- `npm run preview` : prévisualisation du build
- `npm run lint` : lint frontend
- `npm run format` : formatage Prettier

## Remarques techniques

- Le backend utilise `sequelize-typescript` avec `sync: { alter: true }` pour synchroniser le schéma.
- Les modèles Sequelize TypeScript utilisent `declare` pour éviter de masquer les getters et setters Sequelize.
- Les mouvements de stock stockent un snapshot des libellés article et fournisseur pour garder un historique lisible même si les données maîtres changent ensuite.
- L'enregistrement des usages est déclenché directement depuis la logique métier de décrémentation de stock.
- L'interface principale est actuellement centralisée dans `labo-gestion-frontend/src/App.vue`.

## Limites actuelles

- La configuration PostgreSQL est encore codée en dur.
- La clé JWT n'est pas encore externalisée dans une variable d'environnement.
- La traçabilité couvre actuellement les utilisations, pas encore les entrées de stock, corrections manuelles ou réceptions fournisseur.
- Le frontend gagnerait à être découpé en composants métier plus petits.

## Améliorations possibles

- Ajouter les mouvements d'entrée, d'ajustement et de réception.
- Externaliser la configuration sensible dans un fichier `.env`.
- Ajouter des tests frontend.
- Ajouter une gestion complète des utilisateurs depuis l'interface.
- Découper l'écran principal en composants dédiés.
