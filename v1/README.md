# 🎯 JobBot Alternance — ma première version (archivée)

> **⚠️ Prototype v1, conservé hors service.** Dans cette version, les offres affichées étaient
> **générées par un modèle de langage**, pas collectées depuis de vraies sources. C'est précisément
> pour cela que j'ai écrit la v2 : des offres réelles, datées, avec un lien vérifiable vers l'annonce.

J'ai écrit cette version quand j'étais en L2. Elle marchait — trop bien, même : elle me rendait des
offres parfaitement crédibles qui n'existaient pas. Un jour j'ai voulu cliquer sur l'une d'elles, et
il n'y avait rien au bout. C'est là que j'ai compris qu'un outil de recherche d'emploi qui invente ses
offres n'est pas un outil de recherche d'emploi : c'est un générateur de découragement. Je l'ai donc
arrêtée, et j'ai recommencé sur des données réelles — c'est la v2, à la racine de ce dépôt.

Je garde le code parce qu'il documente mon point de départ, et parce que l'erreur est instructive :
**le problème n'était pas de générer du texte, c'était d'appeler ce texte une offre.**

## Ce que faisait la v1

- **Génération d'offres** — un modèle produisait des annonces « réalistes » (Dev & Data, Toulouse et
  Paris). Aucune n'était vérifiable.
- **Notation sur 100** — chaque offre était notée selon mon profil. La note portait donc sur une
  annonce fictive : un score juste appliqué au mauvais objet.
- **CV adapté en un clic** — un CV par offre, exporté en HTML convertible en PDF.
- **Suivi des candidatures** — tableau de bord avec statuts et export CSV.

## Stack

React 18 + Vite, icônes Lucide, API Anthropic (modèle `claude-sonnet-4-20250514`).

## La faille que je ne referais pas

La clé API était appelée **directement depuis le navigateur** : elle partait donc dans le paquet
JavaScript public. J'ai laissé le code tel quel en l'archivant, pour ne pas réécrire l'histoire, mais
je ne remets pas ce montage en ligne. La v2 ne fait aucun appel de modèle depuis le client, et aucune
clé n'est versionnée.

## Ce qui a survécu dans la v2

L'idée de départ — une note qui dit *pourquoi* une offre vaut le détour — est restée. Ce qui a changé :
la matière première est réelle (API publiques, `robots.txt` respectés), la note est calculée par du
code déterministe, et chaque offre porte un lien vers son annonce. Le récit complet est dans le
[README principal](../README.md).

## Lancer l'archive (facultatif)

```bash
cd v1 && npm install && npm run dev
```

Un fichier d'environnement est nécessaire pour que la génération fonctionne, mais l'intérêt de cette
version n'est pas de la relancer : c'est de la lire à côté de la v2.

---

**Fanel Balemo** — étudiant en L3 MIAGE, Université de Toulouse
