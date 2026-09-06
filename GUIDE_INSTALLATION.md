# Guide d'installation — Site web des parents

Ce site permet aux parents de consulter, en se connectant avec le **matricule**
et le **nom de famille** de leur enfant :
- les notifications envoyées par l'école (paiements, réunions, sorties…)
- les bulletins publiés
- les remarques de comportement (avec pastille de couleur)

L'application NuruxData reste **100% locale et fonctionne toujours sans
internet**. Ce site est une extension optionnelle : vous ne publiez que ce
que vous choisissez, quand vous avez une connexion.

Tout est gratuit pour une petite école (le plan gratuit de Firebase suffit
largement : des dizaines de milliers de lectures/écritures par jour gratuites).

## Étape 1 — Créer le projet Firebase (10 minutes, une seule fois)

1. Allez sur **console.firebase.google.com** et connectez-vous avec un compte
   Google (créez-en un gratuitement si besoin).
2. Cliquez sur **Ajouter un projet**, donnez-lui un nom (ex : `ecole-nuruxdata`),
   continuez avec les options par défaut.
3. Une fois le projet créé, dans le menu de gauche allez dans
   **Compilation → Firestore Database** → **Créer une base de données**.
   - Choisissez **Mode production**.
   - Choisissez une région proche de vous (ex : `europe-west` ou `us-central`).
4. Allez dans **Règles** (onglet en haut de Firestore) et collez ceci, puis
   **Publier** :

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /schools/{schoolCode}/{document=**} {
         allow read: if true;
         allow write: if true;
       }
     }
   }
   ```

   > Ces règles sont simples et adaptées à un usage sans mot de passe complexe
   > (comme demandé : connexion par matricule). Elles autorisent la lecture et
   > l'écriture sur les données de votre école. Pour une sécurité renforcée
   > plus tard, on peut ajouter une authentification Firebase — demandez si
   > besoin.

5. Retournez à la page d'accueil du projet (icône ⚙ → **Paramètres du
   projet**), descendez à **Vos applications**, cliquez sur l'icône **`</>`**
   (Web), donnez un nom à l'app, cliquez **Enregistrer**.
6. Firebase affiche un bloc `firebaseConfig = { apiKey: "...", ... }`.
   **Gardez cette page ouverte**, vous allez recopier ces valeurs à l'étape 2.

## Étape 2 — Configurer les deux côtés (application + site)

### Dans l'application NuruxData
Allez dans **Paramètres école → Site web des parents** :
- Cliquez **Générer** pour créer un code établissement (ex : `ECOLE-4F82Q1`).
- Recopiez `apiKey`, `projectId`, `appId` (et `storageBucket` si présent)
  depuis la page Firebase de l'étape 1.
- Cliquez **Enregistrer la configuration**, puis **Tester la connexion**.

### Dans le site (fichier `js/firebase-config.js`)
Ouvrez ce fichier avec un éditeur de texte simple (Bloc-notes, VS Code…) et
remplissez avec **exactement les mêmes valeurs** :

```js
const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "votre-projet.firebaseapp.com",
  projectId: "...",
  storageBucket: "",
  appId: "...",
};
const SCHOOL_CODE = "ECOLE-4F82Q1";   // le même code généré dans l'application
const SCHOOL_NAME = "Nom de votre établissement";
```

## Étape 3 — Mettre le site en ligne

Le dossier `site-parents/` est un site statique (aucun serveur à maintenir).
Trois options gratuites, du plus simple au plus complet :

**Option A — Netlify Drop (le plus simple)**
1. Allez sur **app.netlify.com/drop**
2. Faites glisser le dossier `site-parents` entier dans la page.
3. Netlify vous donne une adresse (ex : `https://ecole-parents.netlify.app`)
   à communiquer aux parents.

**Option B — Firebase Hosting (recommandé, même projet que la base de données)**
1. Installez Node.js, puis dans un terminal : `npm install -g firebase-tools`
2. `firebase login`, puis dans le dossier `site-parents/` : `firebase init hosting`
   (choisissez le projet créé à l'étape 1, dossier public = `.`)
3. `firebase deploy` → Firebase donne l'adresse du site.

**Option C — GitHub Pages** si vous utilisez déjà GitHub.

## Étape 4 — Utilisation au quotidien

- Dans l'application, l'onglet **Publier** permet d'envoyer des notifications
  et de publier les bulletins d'une classe.
- Dans l'onglet **Remarques**, chaque remarque peut être publiée
  individuellement d'un clic.
- Tout cela ne nécessite internet **qu'au moment de la publication** —
  vous pouvez continuer à travailler hors ligne le reste du temps.
- Les mises à jour apparaissent **en direct** sur le site (sans que le parent
  ait besoin de rafraîchir la page).

## Sécurité — à savoir

L'accès parent se fait uniquement avec le matricule + le nom de famille de
l'élève, sans mot de passe, comme demandé. C'est simple pour les familles,
mais toute personne connaissant ces deux informations peut consulter
l'espace de l'élève. Si vous souhaitez un niveau de sécurité supérieur
(mot de passe personnel par famille), c'est possible à ajouter plus tard.
