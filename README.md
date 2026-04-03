# 🐝 La Ruche – Application pédagogique modulaire (PECA)

La Ruche est une application web conçue comme une structure modulaire en alvéoles, développée pour le PECA (Parcours d'Education Culturelle et Artistique) en Fédération Wallonie-Bruxelles.

Elle aide les équipes éducatives à explorer, organiser, commenter et partager des planches pédagogiques composées de cartes hexagonales.

🏛️ Cet outil est développé par le Service de Pilotage du PECA, en adaptation d'un outil initialement conçu par les universités de Mons, Liège et Namur.

Ce dépôt ne correspond plus au prototype V1 d'origine. V1 était essentiellement un éditeur de planches frontend uniquement. L'application actuelle est maintenant un produit complet avec authentification, sauvegarde, collaboration, contenu multilingue, export et administration.

## 🌐 Application en ligne

https://la-ruche.netlify.app/

## 📘 Manuels utilisateurs

- Français: [docs/user-manual.fr.md](docs/user-manual.fr.md)
- Nederlands: [docs/user-manual.nl.md](docs/user-manual.nl.md)

### 🎯 Objectif pédagogique

Le projet Ruche permet aux enseignants, intervenants et équipes éducatives de :

- Visualiser et organiser des cartes pédagogiques sous forme d'alvéoles hexagonales.
- Explorer des visées éducatives, des conditions de mise en œuvre, et des recommandations liées au PECA.
- Manipuler les cartes via drag-and-drop pour construire des parcours ou des réflexions pédagogiques.
- Mettre en avant des cartes spécifiques aux Délégués au Contrat d'Objectifs (DCO) via un type de ruche dédié.

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
- dom-to-image-more et JSZip pour les captures et exports

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
