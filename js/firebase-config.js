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

const firebaseConfig = {
  apiKey: "AIzaSyDeEUCBIOj__0Z6hRGmMgT9P5Rb81KDlg8",
  authDomain: "nuruxdata-1.firebaseapp.com",
  projectId: "nuruxdata-1",
  storageBucket: "nuruxdata-1.firebasestorage.app",
  messagingSenderId: "74795399735",
  appId: "1:74795399735:web:6b31295dc60b5d63845db2",
  measurementId: "G-D5Z1CPTSHN"
};
// Le code établissement DOIT être identique à celui généré dans
// l'application (Paramètres école → Site web des parents → Générer).
const SCHOOL_CODE = "ECOLE-IAEM5C";

// Nom affiché en haut du site (peut être différent de la config Firebase)
const SCHOOL_NAME = "Les ombelles";
