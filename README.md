# Cahier d'appel numérique 📋

Application web installable (PWA) qui permet à un enseignant de **faire l'appel en quelques secondes, même hors-ligne**, de conserver un historique fiable et de générer des rapports PDF / Excel.

Conforme au cahier des charges v2.0 (septembre 2026) : SaaS multi-tenant, validation manuelle des comptes, paiement hors application.

---

## Fonctionnalités (V1)

| Module | Détails |
|---|---|
| **Compte enseignant** | Inscription email + mot de passe · statut *en attente* jusqu'à validation manuelle · écran bloquant clair |
| **Classes & élèves** | Plusieurs classes · ajout manuel (un par un ou en bloc) · **import CSV / Excel** avec aperçu et correction · modification / suppression |
| **Prise de présence** | Tout le monde *présent* par défaut → on ne touche que les exceptions (Absent / Retard / Excusé) · bouton « Tous présents » · correction d'un appel passé · horodatage automatique |
| **Hors-ligne** | Appels stockés dans IndexedDB (Dexie) · file de synchronisation · envoi automatique au retour du réseau · bandeau d'état |
| **Historique** | Calendrier mensuel par classe avec code couleur · classement des élèves · fiche élève avec chronologie et compteurs (absences, retards, taux de présence) |
| **Exports** | Registre PDF (élèves × jours, couleurs, totaux) · Excel 3 feuilles (registre, données brutes, synthèse) · fiche individuelle PDF à signer |
| **Admin** | Liste des comptes avec statut, plan, activité · valider / suspendre / réactiver · changement de plan · note interne de paiement · recherche |
| **Plans** | Gratuit (1 classe, 1 mois d'historique, pas d'export) · Individuel mensuel / annuel (illimité) — appliqués dans l'interface **et** en base (trigger) |
| **PWA** | Manifest + service worker · installable depuis le navigateur · mode `standalone` |

## Stack

- **Frontend** : React 19 + Vite 8, React Router 7, CSS natif (mobile-first, thème clair/sombre automatique, couleur de marque via `--primary` dans `src/styles.css`)
- **PWA** : `vite-plugin-pwa` (Workbox)
- **Backend** : Supabase (Auth + PostgreSQL + Row Level Security)
- **Hors-ligne** : Dexie (IndexedDB)
- **Exports** : jsPDF + jspdf-autotable, SheetJS (xlsx)
- **Dates** : date-fns (locale `fr`)

---

## Mise en route (10 minutes)

### 1. Créer le projet Supabase

1. Créez un projet sur [supabase.com](https://supabase.com) (région Europe conseillée).
2. Ouvrez **SQL Editor → New query**, collez le contenu de [`supabase/schema.sql`](supabase/schema.sql) et exécutez-le.
   Cela crée les tables, les triggers (profil automatique, limite du plan gratuit) et **toutes les règles RLS**.
3. Dans **Authentication → Providers → Email**, vous pouvez désactiver *Confirm email* pour que l'enseignant n'ait pas d'email de confirmation à cliquer (l'accès reste de toute façon bloqué jusqu'à votre validation manuelle).
4. Dans **Authentication → URL Configuration**, ajoutez l'URL de votre site (ex. `https://appel.votredomaine.com`) dans *Site URL* et *Redirect URLs*.

### 2. Configurer l'application

```bash
cp .env.example .env
```

Renseignez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Project Settings → API).

```bash
npm install
npm run dev
```

Ouvrez http://localhost:5173.

### 3. Créer votre compte administrateur

1. Inscrivez-vous normalement depuis l'application (`/inscription`).
2. Dans **SQL Editor**, promouvez votre compte :

```sql
update public.profiles
   set role = 'admin', status = 'active', plan = 'annual'
 where email = 'votre-email@exemple.com';
```

3. Reconnectez-vous : l'onglet **Admin** apparaît dans la navigation.

---

## Parcours d'activation d'un enseignant

1. L'enseignant crée son compte → statut **En attente** (écran bloquant avec instructions de paiement).
2. Il paie hors application (Wave, Orange Money, espèces).
3. Vous ouvrez **Admin**, cliquez **Valider**, choisissez le **plan** et notez le paiement (ex. « Wave le 12/09 — 5 000 F »).
4. L'enseignant clique **Vérifier mon statut** (ou se reconnecte) et accède à l'outil.

Le passage gratuit → payant suit le même chemin (bouton **Plan & note** dans l'admin).

---

## Déploiement

### Vercel

```bash
npm i -g vercel
vercel
```

Ajoutez les deux variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans *Project Settings → Environment Variables*. Le fichier [`vercel.json`](vercel.json) gère la réécriture SPA.

### Netlify

Glissez-déposez le dossier `dist/` après `npm run build`, ou connectez le dépôt Git. Le fichier [`netlify.toml`](netlify.toml) contient la commande de build et la redirection SPA. Ajoutez les variables d'environnement dans *Site settings → Environment variables*.

> **HTTPS obligatoire** pour l'installation PWA et le service worker (fourni automatiquement par Vercel / Netlify).

---

## Structure du projet

```
app/
├── index.html                 Point d'entrée (meta PWA, police Inter)
├── vite.config.js             Vite + plugin PWA (manifest, service worker)
├── supabase/schema.sql        Schéma PostgreSQL + RLS + triggers
├── scripts/make-icons.mjs     Génère les icônes PNG (npm run icons)
├── public/icons/              Icônes de l'application
└── src/
    ├── main.jsx               Montage React + enregistrement du service worker
    ├── App.jsx                Routes, gardes (connecté / actif / admin)
    ├── styles.css             Design system (variables, composants, responsive)
    ├── context/AuthContext.jsx  Session Supabase + profil (cache hors-ligne)
    ├── components/
    │   ├── Layout.jsx         Navigation (barre basse mobile / sidebar desktop), bandeau hors-ligne
    │   ├── ui.jsx             Icônes, Modal, Confirm, Empty, TopBar…
    │   └── Toast.jsx          Notifications
    ├── lib/
    │   ├── supabase.js        Client Supabase
    │   ├── db.js              Base locale Dexie (IndexedDB)
    │   ├── repo.js            Accès aux données : Supabase ↔ cache local, file de synchro
    │   ├── export.js          PDF / Excel / import CSV-Excel (chargé à la demande)
    │   ├── online.js          Hook useOnline
    │   └── utils.js           Dates, statuts, statistiques
    └── pages/
        ├── Auth.jsx           Connexion, inscription, compte en attente / suspendu
        ├── Home.jsx           Accueil : appel du jour, stats 30 jours
        ├── Classes.jsx        Liste + création de classes
        ├── ClassDetail.jsx    Élèves, ajout, import fichier, modification
        ├── Attendance.jsx     Prise de présence (hors-ligne)
        ├── History.jsx        Calendrier mensuel + classement élèves
        ├── StudentDetail.jsx  Fiche élève
        ├── Exports.jsx        Registre PDF, Excel, fiche individuelle
        ├── Settings.jsx       Profil, abonnement, synchro, installation PWA
        └── Admin.jsx          Dashboard administrateur
```

## Modèle de données & sécurité

- `profiles` (id = auth.users.id, role, status, plan, payment_note)
- `classes`, `students`, `attendance_records` — chaque ligne porte `teacher_id`
- **RLS** : un enseignant ne lit/écrit que ses lignes **et seulement si son compte est `active`** ; l'admin lit tout et modifie les profils ; un enseignant ne peut pas modifier lui-même son rôle / statut / plan (trigger `protect_profile_fields`).
- Contrainte `unique (student_id, date)` : la synchronisation hors-ligne fait un `upsert` idempotent, donc aucun doublon même après plusieurs corrections.

## Format d'import des élèves

Fichier `.xlsx`, `.xls` ou `.csv` avec des colonnes **Nom** et **Prénom** (l'ordre et la casse n'importent pas ; `;`, `,` ou tabulation acceptés). Une seule colonne « NOM Prénom » fonctionne aussi : les mots en majuscules sont pris comme nom de famille. Un modèle est téléchargeable depuis la fenêtre d'import.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production dans `dist/` (avec service worker) |
| `npm run preview` | Prévisualiser le build |
| `npm run icons` | Régénérer les icônes PNG |

## Évolutions prévues (V2+)

Gestion des conflits de synchro multi-appareils, notifications parents (SMS / WhatsApp), plan « établissement » (`organization_id`), statistiques comparatives, paiement en ligne.
#   p r o f  
 