# Courriel à épiceries.ca

**À :** epiceriesca@pm.me (adresse indiquée sur https://epiceries.ca/developers)
**De :** corticalabs@yahoo.com
**Objet :** Gusto (mongusto.ca) : accès à votre API depuis notre serveur

---

Bonjour,

Je vous écris au sujet de Gusto (https://mongusto.ca), un planificateur de menus gratuit pour le Québec. On choisit son épicerie, ses repas, le nombre de personnes et son budget ; Gusto propose un menu et une liste d’épicerie au prix de la bannière choisie, sans dépasser le budget. Le site ne demande aucun compte et il est financé par la publicité.

Les prix viennent de votre API publique, et la mention « Prix fournis par épiceries.ca » figure sur le site, dans le PDF exporté et dans la page « À propos ».

**Notre difficulté**

Notre serveur fonctionne sur Cloudflare Workers. Les requêtes qu’il envoie à votre API reçoivent une vérification anti-robot (réponse 402 avec captcha). Pour l’instant, nous récupérons donc les prix depuis un ordinateur, ce qui est moins fiable pour garder les prix à jour.

Serait-il possible d’autoriser notre serveur, par exemple avec une clé d’API, un en-tête particulier ou toute autre méthode que vous préférez ? Nous ne cherchons pas à contourner votre protection : nous voulons simplement un accès que vous approuvez.

**Notre usage de l’API**

- Les visiteurs n’appellent jamais votre API : seul notre serveur l’interroge, et les résultats sont conservés dans notre base de données.
- Environ 900 ingrédients suivis, pour 6 bannières (Maxi, Super C, IGA, Metro, Provigo, Walmart).
- Recherche d’un ingrédient : 1 recherche et quelques fiches produit. Mise à jour d’un ingrédient tous les 5 jours au plus, et une fois par semaine, le jeudi matin, pour les nouvelles circulaires.
- Au plus 3 requêtes par seconde, avec l’en-tête `User-Agent: Gusto (planificateur de menus)`. Nous pouvons ralentir si vous le souhaitez.

**Deux questions techniques**

1. Beaucoup de produits n’ont pas de format (`size: null`). Nous le déduisons alors de `price` et `unitPrice.raw`. Est-ce la bonne façon de faire ? `unitPrice.value` et `unitPrice.raw` diffèrent parfois (par exemple 0,22 contre « 0.44/100g » pour l’oignon jaune chez Maxi) : lequel est le plus fiable ?
2. Est-il possible d’obtenir le prix régulier d’un produit en rabais ? Pour l’instant, nous le majorons de 25 % par prudence.

Merci pour ce service, très utile aux familles québécoises. Je peux ajouter un lien vers votre site ou adapter la mention selon vos préférences.

Bonne journée,

L’équipe Gusto
corticalabs@yahoo.com
https://mongusto.ca
