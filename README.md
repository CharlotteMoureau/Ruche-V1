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
