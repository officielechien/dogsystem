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
- `/index.html` — le site (design + affichage), à la racine
- `/api/trip-updates.js` — récupère les retards en temps réel (cache la clé API)
- `/api/stations.js` — récupère la liste des gares (Static) pour afficher de vrais noms
- `.env.example` — modèle pour tester en local (ne contient jamais la vraie clé)

## Mettre à jour le site après une modification
Si tu remplaces des fichiers existants (comme aujourd'hui), utilise à nouveau
**"Add file" → "Upload files"** sur GitHub, glisse tous les fichiers du dossier,
puis **"Commit changes"**. GitHub écrase automatiquement les anciennes versions,
et Vercel redéploie tout seul en 30-60 secondes.

## Prochaine étape
Ajouter une carte interactive et enrichir la recherche (par ligne, par numéro de train).
