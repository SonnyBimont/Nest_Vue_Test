# Gestion d'Inventaire Laboratoire (P2)

Application full-stack conçue pour la gestion rigoureuse des consommables et équipements d'un laboratoire de niveau 2. Le système intègre le suivi des stocks en temps réel et des alertes de réapprovisionnement.

## 🛠 Architecture Technique

* **Back-end :** NestJS (TypeScript), Sequelize (ORM), Class-Validator
* **Base de données :** PostgreSQL (conteneurisé via Docker)
* **Front-end :** Vue 3 (Composition API), Vite, TypeScript, Pinia (State Management), Vue Router
* **Client HTTP :** Axios

## 📋 Prérequis

* Node.js (v18 ou supérieur)
* Docker Desktop (configuré avec WSL 2 sous Windows)
* Git

## 🚀 Installation et Démarrage

### 1. Infrastructure de données (Docker)
Démarrez le conteneur PostgreSQL avec la commande suivante :
\`\`\`bash
docker run --name labo-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=root -e POSTGRES_DB=gestion_labo -p 5432:5432 -d postgres:15
\`\`\`

### 2. Back-end (API NestJS)
Ouvrez un terminal et exécutez :
\`\`\`bash
cd labo-gestion-backend
npm install
npm run start:dev
\`\`\`
L'API est en écoute sur `http://localhost:3000`.

### 3. Front-end (Interface Vue 3)
Ouvrez un second terminal et exécutez :
\`\`\`bash
cd labo-gestion-frontend
npm install
npm run dev
\`\`\`
<<<<<<< HEAD
L'interface est accessible sur l'URL locale fournie par Vite (généralement `http://localhost:5173`).
=======
L'interface est accessible sur l'URL locale fournie par Vite (généralement `http://localhost:5173`).
>>>>>>> 3c1aedb9bb543a26351c755e9257ad9da27a98b6
