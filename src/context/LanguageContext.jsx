/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ruche-language";
const SUPPORTED_LANGUAGES = ["fr", "en", "nl"];
const DEFAULT_LANGUAGE = "fr";

const DATE_LOCALES = {
  fr: "fr-BE",
  en: "en-GB",
  nl: "nl-BE",
};

const USER_ROLES = [
  "Délégué PECA",
  "Direction",
  "Enseignant",
  "Educateur",
  "Membre d'un CPMS",
  "Futur enseignant",
  "Intervenant culturel",
  "Etudiant en Ecole Superieure des Arts",
  "Référent culturel",
  "Référent scolaire",
  "Autre",
];

const ROLE_LABELS = {
  fr: {
    "Délégué PECA": "Délégué PECA",
    Direction: "Direction",
    Enseignant: "Enseignant",
    Educateur: "Educateur",
    "Membre d'un CPMS": "Membre d'un CPMS",
    "Futur enseignant": "Futur enseignant",
    "Intervenant culturel": "Intervenant culturel",
    "Etudiant en Ecole Superieure des Arts":
      "Etudiant en Ecole Superieure des Arts",
    "Référent culturel": "Référent culturel",
    "Référent scolaire": "Référent scolaire",
    Autre: "Autre",
  },
  en: {
    "Délégué PECA": "PECA representative",
    Direction: "School leadership",
    Enseignant: "Teacher",
    Educateur: "Educator",
    "Membre d'un CPMS": "CPMS member",
    "Futur enseignant": "Future teacher",
    "Intervenant culturel": "Cultural practitioner",
    "Etudiant en Ecole Superieure des Arts": "Arts college student",
    "Référent culturel": "Cultural coordinator",
    "Référent scolaire": "School coordinator",
    Autre: "Other",
  },
  nl: {
    "Délégué PECA": "PECA-afgevaardigde",
    Direction: "Directie",
    Enseignant: "Leerkracht",
    Educateur: "Opvoeder",
    "Membre d'un CPMS": "Lid van een CLB",
    "Futur enseignant": "Toekomstige leerkracht",
    "Intervenant culturel": "Cultureel begeleider",
    "Etudiant en Ecole Superieure des Arts": "Student aan een kunsthogeschool",
    "Référent culturel": "Cultureel referentiepersoon",
    "Référent scolaire": "Schoolreferentiepersoon",
    Autre: "Andere",
  },
};

const CARD_CATEGORIES = {
  fr: [
    { key: "visees", label: "Visées & effets pour les élèves" },
    {
      key: "conditions-enseignant",
      label: "Conditions pour l'enseignant/intervenant",
    },
    {
      key: "recommandations-enseignant",
      label: "Recommandations pour l'enseignant/intervenant",
    },
    { key: "conditions-equipe", label: "Conditions pour l'équipe éducative" },
    {
      key: "recommandations-equipe",
      label: "Recommandations pour l'équipe éducative",
    },
    { key: "domaine", label: "Domaines d'expression culturelle et artistique" },
    { key: "free", label: "A vous de jouer !" },
  ],
  en: [
    { key: "visees", label: "Aims & impacts for students" },
    {
      key: "conditions-enseignant",
      label: "Conditions for teachers/practitioners",
    },
    {
      key: "recommandations-enseignant",
      label: "Recommendations for teachers/practitioners",
    },
    { key: "conditions-equipe", label: "Conditions for the educational team" },
    {
      key: "recommandations-equipe",
      label: "Recommendations for the educational team",
    },
    { key: "domaine", label: "Cultural and artistic expression domains" },
    { key: "free", label: "Your turn!" },
  ],
  nl: [
    { key: "visees", label: "Doelen & effecten voor leerlingen" },
    {
      key: "conditions-enseignant",
      label: "Voorwaarden voor leerkrachten/begeleiders",
    },
    {
      key: "recommandations-enseignant",
      label: "Aanbevelingen voor leerkrachten/begeleiders",
    },
    { key: "conditions-equipe", label: "Voorwaarden voor het schoolteam" },
    {
      key: "recommandations-equipe",
      label: "Aanbevelingen voor het schoolteam",
    },
    { key: "domaine", label: "Domeinen van culturele en artistieke expressie" },
    { key: "free", label: "Jij bent aan zet!" },
  ],
};

const messages = {
  fr: {
    common: {
      loading: "Chargement...",
      close: "Fermer",
      cancel: "Annuler",
      save: "Enregistrer",
      delete: "Supprimer",
      confirm: "Confirmer",
      page: "Page",
      previous: "Precedent",
      next: "Suivant",
      unknownUser: "Utilisateur inconnu",
      yes: "Oui",
      no: "Non",
    },
    language: {
      label: "Langue",
      fr: "Francais",
      en: "English",
      nl: "Nederlands",
    },
    header: {
      profile: "Profil",
      admin: "Admin",
      logout: "Deconnexion",
      login: "Connexion",
      register: "Creer un compte",
    },
    landing: {
      title: "Bienvenue dans La Ruche",
      loading: "Chargement de votre session...",
      connected: "Continuez votre activité en quelques clics.",
      guest: "Connectez-vous ou créez votre compte pour commencer.",
      goProfile: "Accéder au profil",
      createHive: "Créer une Ruche",
      signIn: "Se connecter",
      createAccount: "Créer un compte",
    },
    login: {
      title: "Connexion",
      identifier: "Nom d'utilisateur ou email",
      password: "Mot de passe",
      submit: "Se connecter",
      submitting: "Connexion...",
      forgot: "Mot de passe oublié ?",
      noAccount: "Pas encore de compte ?",
      register: "Inscription",
    },
    register: {
      title: "Creer un compte",
      username: "Nom d'utilisateur (unique)",
      email: "Email",
      firstName: "Prénom",
      lastName: "Nom",
      role: "ôle",
      roleOther: "Précisez votre rôle",
      password: "Mot de passe",
      passwordConfirm: "Confirmation du mot de passe",
      submit: "Créer mon compte",
      submitting: "Création...",
    },
    forgotPassword: {
      title: "Mot de passe oublié",
      email: "Email",
      submit: "Envoyer le lien",
    },
    resetPassword: {
      invalidLink: "Lien invalide",
      title: "Nouveau mot de passe",
      password: "Mot de passe",
      passwordConfirm: "Confirmer le mot de passe",
      submit: "Mettre à jour",
    },
    protectedRoute: {
      loading: "Chargement...",
    },
    profile: {
      title: "Mon profil",
      username: "Nom d'utilisateur",
      email: "Email",
      role: "Rôle",
      createNewHive: "Créer une nouvelle Ruche",
      myHives: "Mes Ruches",
      sharedHives: "Ruches partagées",
      createdAt: "Créée le",
      updatedAt: "Dernière édition",
      open: "Ouvrir",
      duplicate: "Dupliquer",
      duplicating: "Duplication...",
      deleteProfileTitle: "Supprimer mon profil",
      deleteProfileDesc:
        "Cette action est irréversible et supprimera vos données.",
      confirmDeletion: "Confirmer la suppression",
      enterPasswords:
        "Entrez votre mot de passe deux fois pour supprimer le compte.",
      confirmPassword: "Confirmer le mot de passe",
      show: "Afficher",
      hide: "Masquer",
      deleting: "Suppression...",
      loadingTitle: "Chargement du profil",
      loadingSubtitle: "Nous récupérons vos informations et vos ruches.",
      modalDeleteHiveTitle: "Supprimer la ruche",
      modalDeleteHiveMessage:
        "Cette action est irréversible. Voulez-vous continuer ?",
      modalDuplicateTitle: "Dupliquer la ruche",
      modalDuplicateMessage: "Choisissez un nouveau nom pour la copie.",
      modalDuplicateInput: "Nom de la copie",
      modalDuplicateConfirm: "Créer la copie",
      modalCreateTitle: "Créer une nouvelle ruche",
      modalCreateMessage: "Choisissez un nom pour votre nouvelle ruche.",
      modalCreateInput: "Nom de la ruche",
      modalCreatePlaceholder:
        "Ex : Ruche projet Théâtre P2 école du renard 2024",
      missingPasswordFields:
        "Veuillez renseigner les deux champs de mot de passe.",
      passwordMismatch: "Les mots de passe ne correspondent pas.",
      duplicateNeedTitle: "Veuillez renseigner un titre pour la copie.",
      duplicateRenameRequired: "Renommez la copie avec un titre different.",
      copySuffix: "copie",
      emptyHive: "ruche vide",
      download: "Télécharger",
      downloading: "Téléchargement...",
      downloadFailed: "Erreur lors du téléchargement : {message}",
    },
    admin: {
      title: "Administration",
      users: "Utilisateurs",
      hives: "Ruches",
      searchUsers: "Rechercher (nom, email, rôle)...",
      searchHives: "Rechercher (titre, propriétaire)...",
      user: "Utilisateur",
      role: "Rôle",
      hiveCount: "Ruches",
      collabs: "Collabs",
      comments: "Commentaires",
      createdAt: "Créé le",
      updatedAt: "Dernière édition",
      actions: "Actions",
      edit: "Modifier",
      cancelEdit: "Annuler",
      save: "Enregistrer",
      owner: "Propriétaire",
      titleLabel: "Titre",
      specify: "Précisez",
      deleteUser: "Supprimer l'utilisateur",
      deleteHive: "Supprimer la ruche",
      irreversible: "Cette action est irreversible. Voulez-vous continuer ?",
    },
    editor: {
      newHiveTitle: "Nouvelle Ruche",
      backToProfile: "Retour au profil",
      hiveTitleLabel: "Titre de la Ruche",
      saveHive: "Enregistrer la ruche",
      saving: "Enregistrement...",
      duplicateInfo:
        "Cette ruche est une copie. Renommez-la avant de l'enregistrer.",
      createdAt: "Créée le",
      updatedAt: "Dernière édition",
      updating: "Mise à jour en cours...",
      loadingTitle: "Chargement de la ruche",
      loadingSubtitle: "Les cartes et les commentaires arrivent.",
      commentsTitle: "Chat de la Ruche",
      noComments: "Aucun commentaire pour l'instant.",
      reply: "Répondre",
      edit: "Éditer",
      delete: "Supprimer",
      replyPlaceholder: "Écrire une réponse...",
      send: "Envoyer",
      addCommentPlaceholder: "Ajouter un commentaire...",
      unsavedTitle: "Modifications non enregistrées",
      unsavedMessage:
        "Votre ruche contient des modifications non enregistrées. Quitter sans sauvegarder ?",
      stay: "Rester",
      saveAndLeave: "Enregistrer et quitter",
      leaveWithoutSaving: "Quitter sans enregistrer",
      editCommentTitle: "Modifier le commentaire",
      newMessage: "Nouveau message",
      deleteCommentTitle: "Supprimer le commentaire",
      saveTitleError: "Veuillez renseigner un titre avant d'enregistrer.",
      duplicateRenameError: "Renommez la copie avant de l'enregistrer.",
    },
    workspace: {
      cardCommentTitle: "Commentaire de carte",
      cardLabel: "Carte",
      createdBy: "Créé le {date} par {user}",
      updatedBy: "Dernière édition le {date} par {user}",
      noCardComment: "Aucun commentaire pour cette carte.",
      addCardCommentPlaceholder: "Ajouter un commentaire à cette carte...",
      add: "Ajouter",
      continueDeleteCardComments: "Continuer",
      deleteCardCommentsTitle: "Supprimer les commentaires de carte",
      deleteSingleCardCommentMessage:
        "Cette carte contient un commentaire. La remettre dans la bibliotheque supprimera ce commentaire. Continuer ?",
      deleteMultipleCardCommentMessage:
        "Certaines cartes contiennent un commentaire. Les remettre dans la bibliotheque supprimera ces commentaires. Continuer ?",
      deleteCardCommentTitle: "Supprimer le commentaire de carte",
      irreversible: "Cette action est irreversible. Voulez-vous continuer ?",
    },
    toolbar: {
      reset: "Réinitialiser",
      screenshot: "Capture d'écran",
      collaborators: "Collaborateurs",
      comments: "Commentaires",
      manageCollaborators: "Gestion des collaborateurs",
      invite: "Inviter",
      inviting: "Invitation...",
      currentCollaborators: "Collaborateurs actuels",
      noCollaborators: "Aucun collaborateur pour le moment.",
      remove: "Retirer",
      leaveHive: "Quitter la ruche",
      leaving: "Sortie...",
      confirmLeaveTitle: "Quitter la ruche",
      confirmLeaveMessage: "Voulez-vous vraiment quitter cette ruche ?",
      confirmLeave: "Quitter",
      screenshotTitle: "Capture d'ecran",
      roleAdmin: "Administrateur",
      roleComment: "Commentaire uniquement",
      roleRead: "Lecture seule",
      inviteRequiredEmail:
        "Impossible d'envoyer l'invitation: l'email est obligatoire.",
      inviteInvalidEmail:
        "Impossible d'envoyer l'invitation: veuillez saisir un email valide.",
      inviteUnavailable: "Invitation indisponible pour le moment.",
      inviteNoUser:
        "Invitation impossible: aucun utilisateur n'existe avec cet email. Le collaborateur doit d'abord creer un compte.",
      inviteInvalid:
        "Invitation invalide: verifiez l'email saisi puis reessayez.",
      inviteFailed: "Invitation impossible.",
      invalidRole: "Rôle invalide",
      removeFailed: "Impossible de retirer ce collaborateur",
      leaveFailed: "Impossible de quitter cette ruche",
      screenshotFailed: "Erreur lors de la capture : {message}",
      screenshotMergeError: "Impossible de generer l'image fusionnee.",
    },
    cardLibrary: {
      title: "Cartes disponibles",
      remaining: "restantes",
      freeCardTitle: "A vous de jouer !",
      maxFreeCardsReached:
        "Vous avez déjà atteint le maximum de 10 cartes libres !",
    },
    addCardModal: {
      title: "A vous de jouer !",
      placeholder: "Entrez votre texte (max. 50 caractères)",
      validate: "Valider",
      close: "Fermer",
      customCards: "cartes personnalisées",
    },
    passwordField: {
      showPassword: "Afficher le mot de passe",
    },
  },
  en: {
    common: {
      loading: "Loading...",
      close: "Close",
      cancel: "Cancel",
      save: "Save",
      delete: "Delete",
      confirm: "Confirm",
      page: "Page",
      previous: "Previous",
      next: "Next",
      unknownUser: "Unknown user",
      yes: "Yes",
      no: "No",
    },
    language: {
      label: "Language",
      fr: "Francais",
      en: "English",
      nl: "Nederlands",
    },
    header: {
      profile: "Profile",
      admin: "Admin",
      logout: "Log out",
      login: "Log in",
      register: "Create account",
    },
    landing: {
      title: "Welcome to La Ruche",
      loading: "Loading your session...",
      connected: "Continue your work in just a few clicks.",
      guest: "Log in or create your account to get started.",
      goProfile: "Go to profile",
      createHive: "Create a Hive",
      signIn: "Log in",
      createAccount: "Create account",
    },
    login: {
      title: "Log in",
      identifier: "Username or email",
      password: "Password",
      submit: "Log in",
      submitting: "Logging in...",
      forgot: "Forgot password?",
      noAccount: "No account yet?",
      register: "Sign up",
    },
    register: {
      title: "Create account",
      username: "Username (unique)",
      email: "Email",
      firstName: "First name",
      lastName: "Last name",
      role: "Role",
      roleOther: "Specify your role",
      password: "Password",
      passwordConfirm: "Confirm password",
      submit: "Create my account",
      submitting: "Creating...",
    },
    forgotPassword: {
      title: "Forgot password",
      email: "Email",
      submit: "Send link",
    },
    resetPassword: {
      invalidLink: "Invalid link",
      title: "New password",
      password: "Password",
      passwordConfirm: "Confirm password",
      submit: "Update",
    },
    protectedRoute: { loading: "Loading..." },
    profile: {
      title: "My profile",
      username: "Username",
      email: "Email",
      role: "Role",
      createNewHive: "Create a new Hive",
      myHives: "My Hives",
      sharedHives: "Shared Hives",
      createdAt: "Created on",
      updatedAt: "Last edited",
      open: "Open",
      duplicate: "Duplicate",
      duplicating: "Duplicating...",
      deleteProfileTitle: "Delete my profile",
      deleteProfileDesc:
        "This action is irreversible and will delete your data.",
      confirmDeletion: "Confirm deletion",
      enterPasswords: "Enter your password twice to delete the account.",
      confirmPassword: "Confirm password",
      show: "Show",
      hide: "Hide",
      deleting: "Deleting...",
      loadingTitle: "Loading profile",
      loadingSubtitle: "We are retrieving your information and hives.",
      modalDeleteHiveTitle: "Delete hive",
      modalDeleteHiveMessage: "This action is irreversible. Continue?",
      modalDuplicateTitle: "Duplicate hive",
      modalDuplicateMessage: "Choose a new name for the copy.",
      modalDuplicateInput: "Copy name",
      modalDuplicateConfirm: "Create copy",
      modalCreateTitle: "Create a new hive",
      modalCreateMessage: "Choose a name for your new hive.",
      modalCreateInput: "Hive name",
      modalCreatePlaceholder:
        "Example: Theatre project hive P2 Fox School 2024",
      missingPasswordFields: "Please fill in both password fields.",
      passwordMismatch: "Passwords do not match.",
      duplicateNeedTitle: "Please provide a title for the copy.",
      duplicateRenameRequired: "Rename the copy with a different title.",
      copySuffix: "copy",
      emptyHive: "empty hive",
      download: "Download",
      downloading: "Downloading...",
      downloadFailed: "Download failed: {message}",
    },
    admin: {
      title: "Administration",
      users: "Users",
      hives: "Hives",
      searchUsers: "Search (name, email, role)...",
      searchHives: "Search (title, owner)...",
      user: "User",
      role: "Role",
      hiveCount: "Hives",
      collabs: "Collabs",
      comments: "Comments",
      createdAt: "Created on",
      updatedAt: "Last edited",
      actions: "Actions",
      edit: "Edit",
      cancelEdit: "Cancel",
      save: "Save",
      owner: "Owner",
      titleLabel: "Title",
      specify: "Specify",
      deleteUser: "Delete user",
      deleteHive: "Delete hive",
      irreversible: "This action is irreversible. Continue?",
    },
    editor: {
      newHiveTitle: "New Hive",
      backToProfile: "Back to profile",
      hiveTitleLabel: "Hive title",
      saveHive: "Save hive",
      saving: "Saving...",
      duplicateInfo: "This hive is a copy. Rename it before saving.",
      createdAt: "Created on",
      updatedAt: "Last edited",
      updating: "Updating...",
      loadingTitle: "Loading hive",
      loadingSubtitle: "Cards and comments are loading.",
      commentsTitle: "Hive chat",
      noComments: "No comments yet.",
      reply: "Reply",
      edit: "Edit",
      delete: "Delete",
      replyPlaceholder: "Write a reply...",
      send: "Send",
      addCommentPlaceholder: "Add a comment...",
      unsavedTitle: "Unsaved changes",
      unsavedMessage: "Your hive has unsaved changes. Leave without saving?",
      stay: "Stay",
      saveAndLeave: "Save and leave",
      leaveWithoutSaving: "Leave without saving",
      editCommentTitle: "Edit comment",
      newMessage: "New message",
      deleteCommentTitle: "Delete comment",
      saveTitleError: "Please provide a title before saving.",
      duplicateRenameError: "Rename the copy before saving.",
    },
    workspace: {
      cardCommentTitle: "Card comment",
      cardLabel: "Card",
      createdBy: "Created on {date} by {user}",
      updatedBy: "Last edited on {date} by {user}",
      noCardComment: "No comment for this card.",
      addCardCommentPlaceholder: "Add a comment to this card...",
      add: "Add",
      continueDeleteCardComments: "Continue",
      deleteCardCommentsTitle: "Delete card comments",
      deleteSingleCardCommentMessage:
        "This card contains a comment. Returning it to the library will delete that comment. Continue?",
      deleteMultipleCardCommentMessage:
        "Some cards contain comments. Returning them to the library will delete those comments. Continue?",
      deleteCardCommentTitle: "Delete card comment",
      irreversible: "This action is irreversible. Continue?",
    },
    toolbar: {
      reset: "Reset",
      screenshot: "Screenshot",
      collaborators: "Collaborators",
      comments: "Comments",
      manageCollaborators: "Manage collaborators",
      invite: "Invite",
      inviting: "Inviting...",
      currentCollaborators: "Current collaborators",
      noCollaborators: "No collaborators yet.",
      remove: "Remove",
      leaveHive: "Leave hive",
      leaving: "Leaving...",
      confirmLeaveTitle: "Leave hive",
      confirmLeaveMessage: "Do you really want to leave this hive?",
      confirmLeave: "Leave",
      screenshotTitle: "Screenshot",
      roleAdmin: "Administrator",
      roleComment: "Comment only",
      roleRead: "Read only",
      inviteRequiredEmail: "Cannot send invitation: email is required.",
      inviteInvalidEmail: "Cannot send invitation: please enter a valid email.",
      inviteUnavailable: "Invitation is currently unavailable.",
      inviteNoUser:
        "Invitation failed: no user exists with this email. The collaborator must create an account first.",
      inviteInvalid: "Invalid invitation: check the email and try again.",
      inviteFailed: "Invitation failed.",
      invalidRole: "Invalid role",
      removeFailed: "Cannot remove this collaborator",
      leaveFailed: "Cannot leave this hive",
      screenshotFailed: "Capture failed: {message}",
      screenshotMergeError: "Unable to create merged image.",
    },
    cardLibrary: {
      title: "Available cards",
      remaining: "remaining",
      freeCardTitle: "Your turn!",
      maxFreeCardsReached: "You already reached the maximum of 10 free cards!",
    },
    addCardModal: {
      title: "Your turn!",
      placeholder: "Enter your text (max. 50 characters)",
      validate: "Validate",
      close: "Close",
      customCards: "custom cards",
    },
    passwordField: { showPassword: "Show password" },
  },
  nl: {
    common: {
      loading: "Laden...",
      close: "Sluiten",
      cancel: "Annuleren",
      save: "Opslaan",
      delete: "Verwijderen",
      confirm: "Bevestigen",
      page: "Pagina",
      previous: "Vorige",
      next: "Volgende",
      unknownUser: "Onbekende gebruiker",
      yes: "Ja",
      no: "Nee",
    },
    language: {
      label: "Taal",
      fr: "Francais",
      en: "English",
      nl: "Nederlands",
    },
    header: {
      profile: "Profiel",
      admin: "Admin",
      logout: "Afmelden",
      login: "Aanmelden",
      register: "Account aanmaken",
    },
    landing: {
      title: "Welkom bij La Ruche",
      loading: "Je sessie wordt geladen...",
      connected: "Ga verder met je werk in enkele klikken.",
      guest: "Meld je aan of maak een account om te starten.",
      goProfile: "Naar profiel",
      createHive: "Nieuwe Ruche maken",
      signIn: "Aanmelden",
      createAccount: "Account aanmaken",
    },
    login: {
      title: "Aanmelden",
      identifier: "Gebruikersnaam of e-mail",
      password: "Wachtwoord",
      submit: "Aanmelden",
      submitting: "Bezig met aanmelden...",
      forgot: "Wachtwoord vergeten?",
      noAccount: "Nog geen account?",
      register: "Registreren",
    },
    register: {
      title: "Account aanmaken",
      username: "Gebruikersnaam (uniek)",
      email: "E-mail",
      firstName: "Voornaam",
      lastName: "Achternaam",
      role: "Rol",
      roleOther: "Specificeer je rol",
      password: "Wachtwoord",
      passwordConfirm: "Bevestig wachtwoord",
      submit: "Mijn account maken",
      submitting: "Bezig met aanmaken...",
    },
    forgotPassword: {
      title: "Wachtwoord vergeten",
      email: "E-mail",
      submit: "Link verzenden",
    },
    resetPassword: {
      invalidLink: "Ongeldige link",
      title: "Nieuw wachtwoord",
      password: "Wachtwoord",
      passwordConfirm: "Bevestig wachtwoord",
      submit: "Bijwerken",
    },
    protectedRoute: { loading: "Laden..." },
    profile: {
      title: "Mijn profiel",
      username: "Gebruikersnaam",
      email: "E-mail",
      role: "Rol",
      createNewHive: "Nieuwe Ruche maken",
      myHives: "Mijn Ruches",
      sharedHives: "Gedeelde Ruches",
      createdAt: "Gemaakt op",
      updatedAt: "Laatst bewerkt",
      open: "Openen",
      duplicate: "Dupliceren",
      duplicating: "Bezig met dupliceren...",
      deleteProfileTitle: "Mijn profiel verwijderen",
      deleteProfileDesc:
        "Deze actie is onomkeerbaar en verwijdert je gegevens.",
      confirmDeletion: "Verwijderen bevestigen",
      enterPasswords:
        "Voer je wachtwoord twee keer in om het account te verwijderen.",
      confirmPassword: "Wachtwoord bevestigen",
      show: "Tonen",
      hide: "Verbergen",
      deleting: "Bezig met verwijderen...",
      loadingTitle: "Profiel laden",
      loadingSubtitle: "We halen je gegevens en ruches op.",
      modalDeleteHiveTitle: "Ruche verwijderen",
      modalDeleteHiveMessage: "Deze actie is onomkeerbaar. Wil je doorgaan?",
      modalDuplicateTitle: "Ruche dupliceren",
      modalDuplicateMessage: "Kies een nieuwe naam voor de kopie.",
      modalDuplicateInput: "Naam van de kopie",
      modalDuplicateConfirm: "Kopie maken",
      modalCreateTitle: "Nieuwe ruche maken",
      modalCreateMessage: "Kies een naam voor je nieuwe ruche.",
      modalCreateInput: "Naam van de ruche",
      modalCreatePlaceholder:
        "Bijv.: Ruche theaterproject P2 Vossenschool 2024",
      missingPasswordFields: "Vul beide wachtwoordvelden in.",
      passwordMismatch: "Wachtwoorden komen niet overeen.",
      duplicateNeedTitle: "Geef een titel voor de kopie op.",
      duplicateRenameRequired: "Hernoem de kopie met een andere titel.",
      copySuffix: "kopie",
      emptyHive: "lege bijenkorf",
      download: "Downloaden",
      downloading: "Downloaden...",
      downloadFailed: "Download mislukt: {message}",
    },
    admin: {
      title: "Beheer",
      users: "Gebruikers",
      hives: "Ruches",
      searchUsers: "Zoeken (naam, e-mail, rol)...",
      searchHives: "Zoeken (titel, eigenaar)...",
      user: "Gebruiker",
      role: "Rol",
      hiveCount: "Ruches",
      collabs: "Samenwerkingen",
      comments: "Reacties",
      createdAt: "Aangemaakt op",
      updatedAt: "Laatst bewerkt",
      actions: "Acties",
      edit: "Bewerken",
      cancelEdit: "Annuleren",
      save: "Opslaan",
      owner: "Eigenaar",
      titleLabel: "Titel",
      specify: "Specificeer",
      deleteUser: "Gebruiker verwijderen",
      deleteHive: "Ruche verwijderen",
      irreversible: "Deze actie is onomkeerbaar. Wil je doorgaan?",
    },
    editor: {
      newHiveTitle: "Nieuwe Ruche",
      backToProfile: "Terug naar profiel",
      hiveTitleLabel: "Titel van de Ruche",
      saveHive: "Ruche opslaan",
      saving: "Opslaan...",
      duplicateInfo: "Deze ruche is een kopie. Hernoem ze voor je opslaat.",
      createdAt: "Gemaakt op",
      updatedAt: "Laatst bewerkt",
      updating: "Bijwerken...",
      loadingTitle: "Ruche laden",
      loadingSubtitle: "Kaarten en reacties worden geladen.",
      commentsTitle: "Ruche-chat",
      noComments: "Nog geen reacties.",
      reply: "Antwoorden",
      edit: "Bewerken",
      delete: "Verwijderen",
      replyPlaceholder: "Schrijf een antwoord...",
      send: "Verzenden",
      addCommentPlaceholder: "Reactie toevoegen...",
      unsavedTitle: "Niet-opgeslagen wijzigingen",
      unsavedMessage:
        "Je ruche bevat niet-opgeslagen wijzigingen. Verlaten zonder op te slaan?",
      stay: "Blijven",
      saveAndLeave: "Opslaan en verlaten",
      leaveWithoutSaving: "Verlaten zonder opslaan",
      editCommentTitle: "Reactie bewerken",
      newMessage: "Nieuw bericht",
      deleteCommentTitle: "Reactie verwijderen",
      saveTitleError: "Vul een titel in voor je opslaat.",
      duplicateRenameError: "Hernoem de kopie voor je opslaat.",
    },
    workspace: {
      cardCommentTitle: "Kaartreactie",
      cardLabel: "Kaart",
      createdBy: "Aangemaakt op {date} door {user}",
      updatedBy: "Laatst bewerkt op {date} door {user}",
      noCardComment: "Geen reactie voor deze kaart.",
      addCardCommentPlaceholder: "Voeg een reactie toe aan deze kaart...",
      add: "Toevoegen",
      continueDeleteCardComments: "Doorgaan",
      deleteCardCommentsTitle: "Kaartreacties verwijderen",
      deleteSingleCardCommentMessage:
        "Deze kaart bevat een reactie. Terugplaatsen in de bibliotheek verwijdert die reactie. Doorgaan?",
      deleteMultipleCardCommentMessage:
        "Sommige kaarten bevatten reacties. Terugplaatsen in de bibliotheek verwijdert die reacties. Doorgaan?",
      deleteCardCommentTitle: "Kaartreactie verwijderen",
      irreversible: "Deze actie is onomkeerbaar. Wil je doorgaan?",
    },
    toolbar: {
      reset: "Resetten",
      screenshot: "Schermafbeelding",
      collaborators: "Samenwerkers",
      comments: "Reacties",
      manageCollaborators: "Samenwerkers beheren",
      invite: "Uitnodigen",
      inviting: "Bezig met uitnodigen...",
      currentCollaborators: "Huidige samenwerkers",
      noCollaborators: "Nog geen samenwerkers.",
      remove: "Verwijderen",
      leaveHive: "Ruche verlaten",
      leaving: "Bezig met verlaten...",
      confirmLeaveTitle: "Ruche verlaten",
      confirmLeaveMessage: "Wil je deze ruche echt verlaten?",
      confirmLeave: "Verlaten",
      screenshotTitle: "Schermafbeelding",
      roleAdmin: "Beheerder",
      roleComment: "Alleen reacties",
      roleRead: "Alleen lezen",
      inviteRequiredEmail:
        "Uitnodiging kan niet worden verzonden: e-mail is verplicht.",
      inviteInvalidEmail:
        "Uitnodiging kan niet worden verzonden: vul een geldig e-mailadres in.",
      inviteUnavailable: "Uitnodiging is momenteel niet beschikbaar.",
      inviteNoUser:
        "Uitnodiging mislukt: er bestaat geen gebruiker met dit e-mailadres. De samenwerker moet eerst een account aanmaken.",
      inviteInvalid:
        "Ongeldige uitnodiging: controleer het e-mailadres en probeer opnieuw.",
      inviteFailed: "Uitnodiging mislukt.",
      invalidRole: "Ongeldige rol",
      removeFailed: "Deze samenwerker kan niet worden verwijderd",
      leaveFailed: "Je kunt deze ruche niet verlaten",
      screenshotFailed: "Vastleggen mislukt: {message}",
      screenshotMergeError: "Samengevoegde afbeelding kon niet worden gemaakt.",
    },
    cardLibrary: {
      title: "Beschikbare kaarten",
      remaining: "over",
      freeCardTitle: "Jij bent aan zet!",
      maxFreeCardsReached:
        "Je hebt al het maximum van 10 vrije kaarten bereikt!",
    },
    addCardModal: {
      title: "Jij bent aan zet!",
      placeholder: "Vul je tekst in (max. 50 tekens)",
      validate: "Bevestigen",
      close: "Sluiten",
      customCards: "aangepaste kaarten",
    },
    passwordField: { showPassword: "Wachtwoord tonen" },
  },
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const roleLookupByNormalized = new Map(
  USER_ROLES.map((role) => [normalizeText(role), role]),
);

function resolveCanonicalRole(value) {
  if (!value) return "";
  return roleLookupByNormalized.get(normalizeText(value)) || String(value);
}

function getMessageByPath(obj, path) {
  return path.split(".").reduce((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return acc[key];
  }, obj);
}

function interpolate(template, params) {
  if (!params) return template;
  return Object.entries(params).reduce(
    (result, [key, value]) =>
      result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template,
  );
}

function getInitialLanguage() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (SUPPORTED_LANGUAGES.includes(stored)) return stored;

  const browserLang = (navigator.language || "").slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.includes(browserLang)
    ? browserLang
    : DEFAULT_LANGUAGE;
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(getInitialLanguage);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => {
    const t = (path, params) => {
      const current = getMessageByPath(messages[language], path);
      const fallback = getMessageByPath(messages[DEFAULT_LANGUAGE], path);
      const resolved = current ?? fallback;

      if (typeof resolved !== "string") {
        return path;
      }

      return interpolate(resolved, params);
    };

    const translateRole = (roleLabel) => {
      const canonical = resolveCanonicalRole(roleLabel);
      return ROLE_LABELS[language][canonical] || canonical;
    };

    return {
      language,
      setLanguage,
      supportedLanguages: SUPPORTED_LANGUAGES,
      t,
      dateLocale: DATE_LOCALES[language],
      roleOptions: USER_ROLES.map((value) => ({
        value,
        label: ROLE_LABELS[language][value] || value,
      })),
      translateRole,
      cardCategories: CARD_CATEGORIES[language],
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
