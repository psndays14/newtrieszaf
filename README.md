# ZAF BAT Execution OS V5

Version statique premium orientée exploitation chantier.

## Ce que cette version ajoute
- **Fiche contact approfondie** : capacité, zones, conformité, tarifs, tags, expérience, complétude.
- **Matching intelligent** : score pondéré par spécialité, historique, zone, disponibilité, conformité et confiance.
- **Documents branchés au projet** : devis, contrat, avenant, situation, PV et audit générés depuis les données projet.
- **UI resserrée** : grilles `minmax(0, …)`, contenus cassés proprement, listes scrollables, tables en overflow contrôlé.
- **Coffre local chiffré** : AES-GCM via Web Crypto, export/import de l’enveloppe chiffrée.

## Fichiers
- `index.html` — application principale
- `app.js` — logique applicative

## Déploiement
Cette version fonctionne en statique. Tu peux la déposer sur GitHub Pages.

## Limite importante
La sécurité reste **front-only**. Pour un vrai produit multi-utilisateur vendable à des tiers, il faudra ensuite brancher :
- authentification réelle
- base distante
- rôles / permissions
- stockage documentaire serveur
- logs serveur
- signatures / workflows
