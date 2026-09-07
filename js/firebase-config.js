/* ===========================================================
   CONFIGURATION — à remplir UNE SEULE FOIS
   ===========================================================
   Ces valeurs doivent être STRICTEMENT IDENTIQUES à celles saisies
   dans l'application NuruxData/NuruxData, sous :
   Paramètres école → Site web des parents

   Où trouver ces valeurs ? Dans votre projet Firebase (gratuit) :
   console.firebase.google.com → ⚙ Paramètres du projet → Vos applications
   → icône "</>" (application Web) → copiez les valeurs ci-dessous.
   Voir le fichier GUIDE_INSTALLATION.md fourni avec ce site.
   =========================================================== */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDnS5-jODKNWmWSeQ0ZjRLb0ShospzCzf0",
  authDomain: "ombelles-school.firebaseapp.com",
  projectId: "ombelles-school",
  storageBucket: "ombelles-school.firebasestorage.app",
  messagingSenderId: "984187931623",
  appId: "1:984187931623:web:3b477dc147c5b848104b42",
  measurementId: "G-C7X5SJMD48"
};
// Le code établissement DOIT être identique à celui généré dans
// l'application (Paramètres école → Site web des parents → Générer).
const SCHOOL_CODE = "ECOLE-QHULQF";

// Nom affiché en haut du site (peut être différent de la config Firebase)
const SCHOOL_NAME = "Les ombelles";
