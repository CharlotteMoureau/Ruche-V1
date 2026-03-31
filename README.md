# 🐝 La Ruche

La Ruche est une application web conçue pour le PECA afin d'aider les équipes éducatives à explorer, organiser, commenter et partager des planches pédagogiques composées de cartes hexagonales.

La Ruche is a web application built for PECA to help educational teams explore, organize, discuss, and share pedagogical boards made of hexagonal cards.

Ce dépôt ne correspond plus au prototype V1 d'origine. V1 était essentiellement un éditeur de planches frontend uniquement. L'application actuelle est maintenant un produit complet avec authentification, sauvegarde, collaboration, contenu multilingue, export et administration.

This repository no longer matches the original V1 prototype. V1 was essentially a frontend-only board editor. The current application is now a full product with authentication, persistence, collaboration, multilingual content, exports, and administration.

## 🌐 Application en ligne

https://la-ruche.netlify.app/

## 📘 Manuels utilisateurs

- English: [docs/user-manual.en.md](docs/user-manual.en.md)
- Français: [docs/user-manual.fr.md](docs/user-manual.fr.md)
- Nederlands: [docs/user-manual.nl.md](docs/user-manual.nl.md)

## 🇫🇷 Français

### ✨ Principales évolutions depuis la V1

- L'application n'est plus uniquement frontend : elle comprend maintenant une API Express, Prisma et une persistance SQLite.
- Les utilisateurs peuvent créer un compte, se connecter, modifier leur profil et réinitialiser leur mot de passe.
- Les ruches sont sauvegardées côté serveur et peuvent être rouvertes, dupliquées, renommées, exportées et supprimées.
- L'éditeur gère maintenant du contenu multilingue en français, anglais et néerlandais.
- La collaboration a été ajoutée avec des invitations, des rôles d'accès, une boîte de réception, des commentaires et une présence en direct dans l'éditeur.
- Les administrateurs disposent d'un espace dédié pour gérer les utilisateurs et les ruches.
- Les ruches DCO sont maintenant gérées comme un type de ruche distinct avec un jeu de cartes filtré.
- L'expérience d'édition a évolué avec la protection contre les modifications non enregistrées, les exports localisés, les cartes libres, les notes sur carte, l'annulation/rétablissement et un comportement responsive.

### 🧰 Stack technique actuelle

Frontend :

- React 19
- Vite 7
- React Router 7
- React DnD
- Sass
- Font Awesome
- Framer Motion
- dom-to-image-more, html-to-image, html2canvas, canvg, JSZip pour les captures et exports

Backend :

- Node.js
- Express 5
- Prisma 6
- SQLite
- Authentification JWT
- bcryptjs
- Zod
- Nodemailer pour les emails de réinitialisation

### 🎯 Fonctions principales

- Création de compte et connexion avec choix d'un rôle
- Réinitialisation du mot de passe
- Profil personnel avec ruches personnelles et partagées
- Création, édition, duplication et suppression de ruches
- Types de ruches standard et DCO
- Éditeur drag-and-drop basé sur des cartes
- Cartes libres créées par l'utilisateur
- Notes sur les cartes et fil de discussion de la ruche
- Rôles de collaboration : admin, édition, commentaire, lecture
- Boîte de réception pour les invitations
- Export des planches et des contenus de discussion associés
- Tableau d'administration pour les utilisateurs et les ruches
- Interface trilingue et jeux de cartes localisés

### 📁 Structure du projet

- `src/` : application React
- `server/src/` : API Express
- `prisma/` : schéma et migrations
- `public/` : assets publics
- `docs/` : manuels utilisateurs

## 🇬🇧 English

### ✨ What changed since V1

- The app is no longer frontend-only: it now includes an Express API, Prisma ORM, and SQLite persistence.
- Users can create accounts, sign in, update their profile, and reset their password.
- Hives are saved server-side and can be reopened, duplicated, renamed, exported, and deleted.
- The editor now supports multilingual content in French, English, and Dutch.
- Collaboration has been added with invitations, access roles, inbox handling, comments, and live editor presence.
- Admin users have a dedicated administration area for managing users and hives.
- DCO hives are now handled as a dedicated hive kind with filtered card sets.
- The board experience has evolved with guarded unsaved changes, localized exports, custom free cards, card notes, undo/redo, and responsive behavior.

### 🧰 Current tech stack

Frontend:

- React 19
- Vite 7
- React Router 7
- React DnD
- Sass
- Font Awesome
- Framer Motion
- dom-to-image-more, html-to-image, html2canvas, canvg, JSZip for export and capture flows

Backend:

- Node.js
- Express 5
- Prisma 6
- SQLite
- JWT authentication
- bcryptjs
- Zod validation
- Nodemailer for password reset emails

### 🎯 Main product capabilities

- Account creation and login with role selection
- Password reset flow
- Personal profile with owned and shared hives
- Hive creation, editing, duplication, and deletion
- Standard and DCO hive types
- Card-based drag-and-drop editor
- Free custom cards created by the user
- Card notes and hive discussion threads
- Collaboration roles: admin, editor, comment, read
- Invitation inbox for shared hives
- Export of boards and related discussion content
- Admin dashboard for users and hives
- Trilingual interface and localized card datasets

### 📁 Project structure

- `src/`: React application
- `server/src/`: Express API
- `prisma/`: schema and migrations
- `public/`: public assets
- `docs/`: end-user manuals

## 🚀 Production deployment (Netlify + API)

This project is a split architecture:

- Frontend: React/Vite static site
- Backend: Express API + Prisma + database

For production signup/login to work, the frontend and backend must both be deployed.

### 1. Deploy frontend on Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Frontend environment variable:
  - `VITE_API_URL=https://YOUR_API_DOMAIN/api`

Without `VITE_API_URL`, the app falls back to `/api` on the same domain, which only works if your API is also served there.

### 2. Deploy backend on a Node host

Deploy `server/src/index.js` on a backend host (Render, Railway, Fly.io, VPS, etc.).

Required backend environment variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (example: `7d`)
- `API_PORT` (or host-provided port)
- `APP_URL` (your Netlify frontend URL)
- `ADMIN_EMAIL` (optional business config)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (required for email reset flow)

### 3. Run Prisma migrations on backend

Before first production use, apply migrations in the backend environment:

- `npx prisma migrate deploy`

### 4. About Netlify secrets scanning config

`SECRETS_SCAN_OMIT_KEYS = "API_PORT,APP_URL"` is acceptable because these are typically configuration values, not credentials.

Do not omit real secrets (`JWT_SECRET`, SMTP credentials, DB credentials). Keep those protected by scanner coverage and never commit them.

### 5. Render deployment checklist (free-tier friendly, ready to copy)

Current repository structure (important for Render):

- Frontend build lives at root (`npm run build` -> `dist`)
- Backend entrypoint lives at `server/src/index.js`
- Prisma schema and migrations live in `prisma/`

For production users, you need:

- Netlify site for frontend
- Render Web Service for backend API
- A free Postgres database (recommended: Neon free tier)

Checklist:

1. Create a free Postgres database (Neon)

- Create a Neon project (free tier).
- Copy the pooled connection string as your future `DATABASE_URL`.

2. Create a Render Web Service

- New -> Web Service -> Connect this GitHub repository.
- Service name: `ruche-api`
- Root Directory: leave empty (repository root)
- Runtime: Node
- Build Command: `npm ci && npm run prisma:generate`
- Start Command: `npm run start:server:prod`

3. Add backend environment variables in Render

Copy and adapt:

```env
DATABASE_URL=YOUR_NEON_POSTGRES_URL
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
JWT_EXPIRES_IN=7d
API_PORT=4010
APP_URL=https://YOUR_NETLIFY_SITE.netlify.app
ADMIN_EMAIL=admin@example.com
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=no-reply@example.com
```

Notes:

- Render injects a runtime `PORT`. Your server currently uses `API_PORT`, so keep `API_PORT=4010` unless you update the server to prefer `PORT`.
- Password reset emails require SMTP values.

4. Database choice

- Recommended: use Neon PostgreSQL free tier and set `DATABASE_URL` to your Neon URL.
- Important: current Prisma datasource provider is SQLite in `prisma/schema.prisma`. To use PostgreSQL, switch provider to `postgresql` and create/apply migrations for Postgres.
- If you keep SQLite on Render without a persistent disk, data can be lost between deploys.

5. Point Netlify frontend to Render backend

- In Netlify Site settings -> Environment variables:
  - `VITE_API_URL=https://YOUR_RENDER_DOMAIN/api`
- Trigger a new Netlify deploy.

6. Verify production health

- Open `https://YOUR_RENDER_DOMAIN/api/health`
- Expect JSON response with `{"ok": true}`
- Then test register/login from the Netlify site.

7. Quick rollback checks if signup fails

- Confirm `VITE_API_URL` is set on Netlify (no fallback to same-origin `/api`).
- Confirm Render service has valid `DATABASE_URL` and `JWT_SECRET`.
- Confirm migrations ran successfully in Render deploy logs.

8. Free-tier reality check

- Netlify frontend: free tier is enough for testing with real users.
- Render Web Service: free tier can sleep after inactivity, causing first request delay.
- Neon Postgres: free tier is enough for small pilots.
