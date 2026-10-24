# Courriel à épiceries.ca (brouillon)

**À :** epiceriesca@pm.me (adresse indiquée sur https://epiceries.ca/developers)
**Objet :** Gusto, planificateur de menus gratuit : utilisation de votre API

---

Bonjour,

Je m’appelle [votre nom] et je prépare le lancement de Gusto, un planificateur de menus gratuit pour le Québec. L’utilisateur choisit son épicerie, ses repas, le nombre de personnes et son budget ; Gusto propose un menu et une liste d’épicerie au prix de sa bannière, sans jamais dépasser le budget. Le site ne demande aucun compte et est financé par la publicité.

J’aimerais utiliser votre API publique pour les prix, et je voulais vous en parler avant le lancement pour m’assurer que l’usage vous convient.

**Comment Gusto utilise l’API**

- Les visiteurs n’appellent jamais votre API directement : seul notre serveur l’interroge, et tous les résultats sont mis en cache dans notre base de données.
- Recherche initiale : environ 1 recherche (`search`) et quelques fiches (`product`) par nouvel ingrédient, étalées dans le temps (quelques requêtes toutes les 10 minutes). Nous prévoyons quelques centaines d’ingrédients au total.
- Rafraîchissement : une fois par semaine, le jeudi matin, par lots de 20 produits, pour reprendre les prix des nouvelles circulaires.
- Nous restons bien sous une requête par seconde. Les requêtes portent l’en-tête `User-Agent: Gusto (planificateur de menus)`.

**Attribution**

La mention « Prix fournis par épiceries.ca » est affichée sur le site, dans le PDF exporté et dans notre page « À propos ». Je peux ajouter un lien vers votre site ou adapter le texte selon vos préférences.

**Mes questions**

1. Cet usage vous convient-il ? Préférez-vous une autre fréquence, ou une adresse ou un en-tête particulier pour nous identifier ?
2. Beaucoup de produits n’ont pas de format (`size: null`) ; nous déduisons alors le format à partir de `price` et de `unitPrice.raw`. Est-ce la bonne façon de faire ? Nous avons aussi remarqué que `unitPrice.value` et `unitPrice.raw` diffèrent parfois (par exemple 0,22 contre « 0.44/100g » pour l’oignon jaune chez Maxi) : lequel est le plus fiable ?
3. Avez-vous un moyen d’obtenir le prix régulier d’un produit en rabais ? Pour l’instant, nous le majorons de 25 % par prudence.

Merci pour ce service, très utile pour les familles québécoises. Je reste disponible pour en discuter et vous donner l’adresse du site avant le lancement.

Bonne journée,

[Votre nom]
[Votre courriel]
[Adresse du site, une fois en ligne]
