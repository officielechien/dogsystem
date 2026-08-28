# DOGSYSTEM

Site de suivi des trains en temps réel (Belgique), connecté à l'API SNCB / Belgian Mobility Company.

## Mettre le site en ligne (première fois)

### 1. Créer un dépôt GitHub
1. Va sur https://github.com et connecte-toi (ou crée un compte, gratuit).
2. Clique sur le bouton vert **"New repository"**.
3. Nomme-le `dogsystem`, laisse-le en **Public** ou **Private** (les deux fonctionnent avec Vercel), ne coche aucune case (pas de README, pas de .gitignore — on les a déjà).
4. Clique **"Create repository"**.
5. GitHub affiche des commandes — ignore-les pour l'instant si tu ne connais pas Git : tu peux aussi utiliser le bouton **"uploading an existing file"** sur la page du dépôt pour glisser-déposer tous les fichiers de ce dossier directement depuis ton navigateur.

### 2. Importer le projet dans Vercel
1. Va sur https://vercel.com et connecte-toi avec ton compte GitHub.
2. Clique **"Add New"** → **"Project"**.
3. Choisis le dépôt `dogsystem` que tu viens de créer.
4. Ne change aucun réglage de build (Vercel détecte tout seul qu'il n'y a pas de framework — c'est normal, il sert simplement `/public` et `/api`).

### 3. Ajouter ta clé API (étape obligatoire, avant le premier déploiement si possible)
1. Dans les réglages du projet Vercel : **Settings** → **Environment Variables**.
2. Ajoute :
   - **Name** : `SNCB_API_KEY`
   - **Value** : ta clé (celle donnée par le portail BMC, format `bmc-partner-key`)
3. Sauvegarde.

### 4. Déployer
Clique **"Deploy"**. Après 30-60 secondes, le site est en ligne à une adresse du type :
`https://dogsystem.vercel.app`

Si tu as déjà ajouté la clé API avant de déployer, tout doit fonctionner directement.
Si tu l'ajoutes après coup, il faut relancer un déploiement (**Deployments** → **⋯** → **Redeploy**).

## Structure du projet
- `/public/index.html` — le site (design + affichage)
- `/api/trip-updates.js` — la fonction serveur qui va chercher les données SNCB en cachant la clé API
- `.env.example` — modèle pour tester en local (ne contient jamais la vraie clé)

## Prochaine étape
Brancher l'API **Static** (liste des gares et lignes) pour remplacer les codes techniques
(`trip_id`, `stop_id`) actuellement affichés par de vrais noms de gares.
