"""Source unique des faits du parcours de Fanel (règle du 21/10/2026, revue le 22/10/2026).

Un fait sur un projet, une durée de stage, une date de disponibilité, la zone de recherche ou un
centre d'intérêt s'écrit **ici, une seule fois**. Le CV, la lettre, les pitchs Telegram et
`eligibility.py` lisent ce module ; plus aucune valeur rédigée en dur ailleurs.

Deux règles tenues par des tests (`test_pipeline.check_faits` et `check_referentiel`) :

1. **Cohérence des paramètres** : `duree` doit correspondre à `duree_min`/`duree_max`, et la zone
   déclarée ici est celle qu'applique `eligibility.py`. Un contrôle automatique remplace l'`assert`
   de module qui cassait l'import au lieu d'expliquer (constat du 22/10/2026).
2. **Preuve des compétences** : toute entrée de `COMPETENCES_CONFIRMEES` est soit **prouvée par un
   CV maître** (le test la retrouve dans le texte des maîtres), soit **déclarée explicitement** dans
   `PREUVES` avec sa justification. Une entrée qui n'est ni l'un ni l'autre fait échouer le test.
"""

# --- Paramètres de recherche ---------------------------------------------------
# Décisions de Fanel du 22/10/2026 (révision de la même journée) : **la contrainte qui commande
# tout est la date de fin**, pas la durée. La rentrée de Master est en septembre 2027, donc le
# stage doit être terminé au 31 juillet, août à la rigueur. Conséquence assumée : une annonce de six
# mois n'est **pas** à écarter, elle se candidate en annonçant l'écart. Zone : Toulouse et
# alentours seulement — l'Île-de-France viendra dans JobBot V2, pas ici.
STAGE = {
    # Durée : 14 semaines (3,5 mois) est une offre valable — plusieurs programmes de stage, dont
    # ceux d'Airbus, sont calibrés à cette durée. Seule borne de durée réellement fermée :
    # en dessous de 14 semaines. Au-dessus de 5 mois, ce n'est plus la durée qui tranche mais la
    # date de fin (paliers ci-dessous).
    "duree": "4 à 5 mois",
    "duree_min": 3.5,
    "duree_min_semaines": 14,
    "duree_max": 5,
    "duree_nominale": 4,
    "debut": "fin mars 2027",
    "debut_iso": "2027-03-29",
    "debut_long": "29 mars 2027",
    "debut_repli_iso": "2027-04-05",
    "debut_repli_long": "5 avril 2027",
    # `fin_max` est le nom demandé par Fanel ; `fin_max_iso`/`fin_max_long` sont les formes
    # exploitables (date et texte). Le test vérifie qu'elles ne se contredisent pas.
    "fin_max": "2027-07-31",
    "fin_max_iso": "2027-07-31",
    "fin_max_long": "31 juillet 2027",
    # Paliers de la date de fin calculée (début + durée annoncée par l'annonce). `eligibility.py`
    # les lit ici : une seule déclaration des seuils.
    "fin_paliers": {
        "compatible": "2027-07-31",   # fin au 31/07 ou avant : rien à négocier
        "negociation": "2027-08-31",  # fin en août : drapeau « à négocier », pas de malus
        "raccourcir": "2027-10-31",   # septembre-octobre : drapeau + malus de classement
    },
    # Formulations autorisées — **les seules** pour parler de la disponibilité. Elles remplacent
    # toute autre manière de la dire : une autre formulation écrite ailleurs est un bug, c'est ce
    # qui a produit « 4 à 6 mois » en en-tête et « 4 à 5 mois » en profil sur 8 CV sur 11.
    # Jours-mois qu'un document a le droit d'annoncer, **par document** (décision du 22/10/2026).
    # Le garde-fou de cohérence CV/lettre les lit ici : aucune liste recopiée dans `cv_generator`.
    "dates_cv": ("29 mars",),
    "dates_lettre": ("29 mars", "31 juillet"),
    "dates_autorisees": ("29 mars", "5 avril", "31 juillet"),   # union, pour les contrôles globaux
    # Période canonique : la seule chaîne de dates autorisée **dans la lettre**.
    "periode": "29 mars au 31 juillet 2027",
    # Règle de répartition (décision de Fanel du 22/10/2026, diagnostic v4) : **le CV annonce une
    # disponibilité, la lettre explique la limite**. Une fenêtre fermée écrite sur un CV (« du 29
    # mars au 31 juillet ») se lit comme une contrainte imposée au recruteur et ferme la discussion
    # avant qu'elle commence ; une date de début suivie d'une fourchette de durée se lit comme une
    # disponibilité. Conséquence tenue par un test : **le 31 juillet n'apparaît jamais sur le CV**,
    # seulement dans la lettre, où la rentrée de Master l'explique.
    "date_fin_sur_cv": False,
    "phrase_courte": "Stage de 4 à 5 mois · dès le 29 mars 2027",
    "phrase_entiere": ("Stage de quatre à cinq mois à partir du 29 mars 2027, dates ajustables."),
    "lettre_disponibilite": ("Ma rentrée de Master MIAGE en septembre fixe la fin du stage au "
                             "31 juillet."),
    # Modèle quand l'annonce dépasse la fenêtre : l'écart s'annonce tôt et une seule fois, puis on
    # propose ce qui tient dans le délai. {duree_annonce} et {coeur} se remplissent à la rédaction.
    "lettre_ecart_modele": ("Votre annonce prévoit {duree_annonce} ; ma rentrée de Master en "
                            "septembre fixe ma disponibilité au 31 juillet, soit quatre mois pleins, "
                            "cinq si le calendrier le permet. Je candidate malgré cet écart parce "
                            "que {coeur}, et le périmètre de la première phase me paraît tenir dans "
                            "ce délai."),
    "dispo": "disponible à partir du 29 mars 2027",
    "lieu": "Toulouse",
    "mobilite": "Toulouse et alentours",
}

# --- Zones de recherche ---------------------------------------------------------
# Décision de Fanel du 06/11/2026 : les zones sont **distinctes** et déclarées ici, en un seul
# endroit. L'éligibilité, l'export et le score en dérivent tous : plus aucune liste de communes
# recopiée ailleurs. `ZONE` reste l'alias de la zone « toulouse », donc à cette étape le
# comportement est **identique** : même libellé, mêmes communes, même zone reconnue.
#
# Les points par zone sont déclarés ici pour n'exister qu'une fois. `scoring.py` continue de lire
# ses propres constantes : la bascule se fera à l'étape suivante, sur décision séparée.
ZONES = {
    "toulouse": {
        "libelle": "Toulouse et alentours",
        "points": 15,
        "villes": (
            "toulouse", "haute-garonne", "colomiers", "blagnac", "labege", "balma", "saint-orens",
            "ramonville", "muret", "castanet-tolosan", "l'union", "fenouillet", "cornebarrieu",
            "aucamville", "beauzelle", "cugnaux", "tournefeuille", "plaisance-du-touch",
            "portet-sur-garonne", "poucharramet",
        ),
        # Départements reconnus : libellés France Travail « 31 - Commune » et codes postaux 31xxx.
        "departements": ("31",),
        # Régions qui *contiennent* la zone : une annonce « Occitanie » seule reste à vérifier.
        "regions_englobantes": ("occitanie",),
        # Région « propre » à la zone : quelques annonces ne donnent qu'elle, et elle vaut alors les
        # points de la zone. Vide quand ce n'était pas le cas avant le 06/11/2026 : le classement ne
        # doit pas bouger sur ce seul motif (« Occitanie » seule reste au minimum, comme avant).
        "region_propre": (),
    },
    # Montauban et Montpellier appartiennent à cette région, qui est une zone acceptée par la règle
    # arrêtée le 06/11/2026. Rien n'est déployé tant que le site n'est pas prêt : le calcul vit dans
    # la copie d'étape B, la mise en service se fera sur décision de Fanel.
    "occitanie": {
        "libelle": "Occitanie",
        "points": 13,
        "villes": (
            "montauban", "montpellier", "castres", "albi", "nimes", "nîmes", "perpignan",
            "beziers", "béziers", "narbonne", "carcassonne", "rodez", "cahors", "foix", "tarbes",
            "auch", "pamiers", "sete", "sète", "lunel", "mende", "millau",
        ),
        # Codes d'Occitanie, Toulouse exceptée : son département appartient à la zone « toulouse »,
        # qui est examinée en premier. Douze codes d'un coup seraient trop larges si l'on oubliait
        # cette exclusion.
        "departements": ("09", "11", "12", "30", "32", "34", "46", "48", "65", "66", "81", "82"),
        "regions_englobantes": (),
        # Aucune région propre : une annonce qui ne dit qu'« Occitanie » reste à vérifier et garde
        # le minimum de points, exactement comme avant le 06/11/2026.
        "region_propre": (),
    },
    # Liste des communes et départements franciliens. La zone est acceptée par la règle arrêtée le
    # 06/11/2026 ; seule la mise en service du site reste à faire, sur décision de Fanel. Les
    # communes dont le nom existe ailleurs en France figurent dans `ambigus`, plus bas.
    "idf": {
        "libelle": "Île-de-France",
        "points": 13,
        "villes": (
            "paris", "boulogne-billancourt", "issy-les-moulineaux", "nanterre", "saint-denis",
            "velizy-villacoublay", "creteil", "montrouge", "saclay", "guyancourt", "cergy", "massy",
            "palaiseau", "evry", "orsay", "versailles", "saint-quentin-en-yvelines",
            "marne-la-vallee", "montreuil", "argenteuil", "suresnes", "courbevoie", "puteaux",
            "levallois", "neuilly", "rueil", "clichy", "meudon", "chatillon", "saint-cloud",
            "gennevilliers", "vincennes", "villejuif", "ivry", "charenton", "maisons-alfort",
            "melun", "meaux", "sarcelles", "saint-germain-en-laye", "elancourt", "montigny",
            "trappes", "les ulis", "bures-sur-yvette",
            # Reprises de `scoring.py` le 06/11/2026 : ces lieux y étaient reconnus à 13 points
            # depuis le début, et les oublier aurait fait **baisser** la note d'offres déjà notées.
            # C'est le sens de la règle : une seule liste, ici.
            "la defense", "colombes", "asnieres", "asnières", "malakoff", "clamart", "sevres",
            "sèvres", "aubervilliers", "pantin", "bobigny", "noisy-le-grand", "bagnolet",
            "saint-ouen", "vitry", "fontenay-sous-bois", "idf", "velizy", "pontoise",
            "champs-sur-marne", "serris", "saint-mande", "saint-maur", "arcueil", "rungis",
            # Les variantes écrites avec une espace sont inutiles : le motif accepte le tiret ou
            # l'espace. Formes longues des noms ambigus ci-dessous : elles ne prêtent à confusion
            # avec aucune autre commune de France, donc elles classent sans confirmation.
            "vitry-sur-seine", "ivry-sur-seine", "montigny-le-bretonneux", "saint-maur-des-fosses",
            "charenton-le-pont", "saint-ouen-sur-seine", "l'ile-saint-denis", "ile-saint-denis",
        ),
        "departements": ("75", "77", "78", "91", "92", "93", "94", "95"),
        "regions_englobantes": ("ile-de-france", "île-de-france"),
        # Ici la région valait déjà les points de la zone avant le 06/11/2026 : « Île-de-France »
        # seule donnait 13. On le déclare, au lieu de le laisser dans une liste recopiée.
        # Noms de communes qui existent ailleurs en France : « Saint-Denis » est aussi à La Réunion,
        # Montigny-lès-Metz est en Moselle, Vitry-le-François dans la Marne, Ivry-la-Bataille dans
        # l'Eure, Saint-Maur-sur-le-Loir en Eure-et-Loir, Charenton-du-Cher dans le Cher,
        # Saint-Ouen-des-Champs dans l'Yonne. Sans confirmation (code postal, département, « Paris »
        # ou « Île-de-France »), ces noms ne suffisent pas à classer une offre en zone certaine :
        # elle part en « à vérifier ». Règle demandée par Fanel le 06/11/2026.
        "ambigus": ("saint-denis", "montigny", "vitry", "ivry", "saint-maur", "charenton",
                    "saint-ouen"),
        "region_propre": ("ile-de-france", "île-de-france"),
    },
    "remote": {
        "libelle": "Télétravail",
        "points": 10,
        "villes": ("teletravail", "télétravail", "remote", "a distance", "à distance",
                   "full remote", "100% remote", "home office", "homeoffice", "distanciel"),
        "departements": (),
        "regions_englobantes": (),
        "region_propre": (),
    },
}

# Alias de compatibilité : `eligibility.py` lit `faits.ZONE`. À cette étape, rien ne change de
# comportement, et la preuve en est l'export identique avant et après.
ZONE = ZONES["toulouse"]

# Ordre d'examen des zones : le plus précis d'abord. Une annonce « Toulouse (télétravail) » est
# toulousaine, pas « télétravail » ; une annonce « Montauban, Occitanie » est occitane, pas
# « Occitanie seule ».
ZONES_ORDRE = ("toulouse", "occitanie", "idf", "remote")

# --- Compétences réellement confirmées (référentiel unique) ---------------------
# Source unique du référentiel : le scoring, le CV et la lettre lisent cette liste. Ce qui n'y est
# pas n'entre **jamais** dans un CV, et compte comme « compétence exigée hors profil » au scoring.
# Absents volontairement, parce que Fanel ne les a jamais pratiqués : Vue.js, C++, C#, GitLab,
# Angular, Kubernetes, Spark… **Docker retiré le 22/10/2026** : le projet Docker n'est pas construit.
COMPETENCES_CONFIRMEES = (
    "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Express",
    "Java", "Kotlin", "SQL", "MySQL", "PostgreSQL", "SQLite", "HTML", "CSS",
    "Tailwind CSS", "Power BI", "Power Query", "DAX", "Pandas", "Matplotlib", "Excel",
    "Git", "GitHub", "Linux", "API REST", "JWT", "Chart.js",
    "Agile/Scrum", "Vitest", "JSON",
)

# --- Preuve de chaque compétence -----------------------------------------------
# Règle du 22/10/2026 : une compétence est prouvée par un CV maître, sinon elle doit être ici avec
# sa justification. Mesure du 22/10/2026 sur les trois maîtres : 29 des 32 entrées sont prouvées ;
# trois ne le sont pas — Docker (retiré), Linux et Chart.js, déclarés ci-dessous.
PREUVE_DECLAREE = "déclaration"
PREUVES = {
    # « Linux » ne doit jamais s'écrire seul sur un CV, ni sous « Programmation » (ce n'est pas un
    # langage) : voir LIBELLES_AFFICHES et la rubrique « Systèmes & Outils ».
    "Linux": (PREUVE_DECLAREE, "administration d'un serveur Linux (VPS OVH) — déclaré le 22/10/2026"),
    # Chart.js vient de la stack déclarée par Fanel, il n'apparaît dans aucun maître.
    "Chart.js": (PREUVE_DECLAREE, "graphes du tableau de bord Biblio-Tech — confirmé par Fanel"
                              " le 22/10/2026"),
}

# Formulations affichées sur un CV. Le référentiel garde la clé courte (le scoring compare des
# technologies) ; ce qui est écrit dans le document est ce qui est vrai et lisible.
LIBELLES_AFFICHES = {
    "Linux": "Administration d'un serveur Linux (VPS OVH)",
}

# --- Projets : la seule description autorisée -----------------------------------
# « stack » : ce qui a réellement servi sur le projet, **prouvé par le bloc du projet dans un CV
# maître** (vérifié par `referentiel.py`, appelé par `test_pipeline.check_projets`). « reperes » :
# les mots qui identifient le bloc du projet dans les maîtres, pour que la vérification soit
# automatique et pas une relecture.
# Deux erreurs corrigées le 22/10/2026, trouvées en reconstruisant le dossier #897 : TechScope
# portait « Matplotlib » et pas « Power BI », alors que c'est son seul projet Power BI (sans lui,
# l'entrée « Power BI » du référentiel n'avait plus aucune preuve de projet) ; et « Analyse
# Insertion Pro MIAGE » portait « Power BI », qui n'y a jamais servi. Prises ensemble, ces deux
# erreurs faisaient écrire à une lettre un projet sous un outil absent de ce projet.
PROJETS = {
    "Biblio-Tech": {
        "titre": "Biblio-Tech — plateforme web et tableaux de bord analytiques",
        "reperes": ("biblio-tech", "bibliotheque1"),
        # Mots qui, dans une lettre, désignent ce projet sans ambiguïté. « MIAGE », « stage »,
        # « licence » sont interdits ici : ils sont dans tous les documents et feraient croire à
        # plusieurs projets cités (faux positif mesuré le 22/10/2026).
        "mots_cles": ("biblio-tech", "bibliothèque", "bibliotheque"),
        "stack": "Next.js, Node.js/Express, PostgreSQL, API REST, JWT, IoT simulé",
        "faits": [
            "application full stack : catalogue, emprunts, réservations, tableaux de bord",
            "API REST Express et PostgreSQL avec requêtes SQL natives, authentification JWT",
            "couche IoT simulée : capteurs, alertes, automatisations IF → THEN",
        ],
    },
    "JobBot V2": {
        "titre": "JobBot V2 — site de recherche d'offres et moteur de scoring en TypeScript",
        "reperes": ("jobbot",),
        "mots_cles": ("jobbot",),
        "stack": "Python, TypeScript, Next.js, PostgreSQL, 88 tests",
        "faits": [
            "collecte quotidienne d'offres depuis plusieurs sources, dédoublonnage et scoring",
            "88 tests automatisés, score recalculé à la lecture jamais stocké",
            "portage du moteur de scoring en TypeScript vérifié contre la version Python",
        ],
    },
    "TechScope": {
        "titre": "TechScope — pipeline de qualité des données et pilotage d'un parc informatique",
        "reperes": ("techscope",),
        "mots_cles": ("techscope",),
        "stack": "Python, Pandas, SQL, Power BI",
        "faits": [
            "pipeline lancé en une commande : lecture de quatre sources (JSON, SQLite, CSV), "
            "contrôles qualité (champs obligatoires, doublons, intégrité référentielle, cohérence, "
            "fraîcheur), chargement en base SQLite et exports CSV",
            "douze anomalies détectées sur 113 lignes et tracées dans un rapport, tests automatisés "
            "vérifiant chaque anomalie",
            "tableau de bord Power BI : modèle en étoile, mesures DAX, taux d'utilisation des "
            "licences à 56 %, services sans redondance, détail par métier",
        ],
    },
    "Analyse Insertion Pro MIAGE": {
        "titre": "Analyse Insertion Pro MIAGE — pipeline de traitement et restitution de données",
        "reperes": ("miage-insertion-pro", "analyse insertion"),
        "mots_cles": ("miage-insertion-pro", "insertion pro", "insertion professionnelle"),
        "stack": "Python, Pandas, SQL, Matplotlib",
        "faits": [
            "pipeline complet sur les données publiques data.esr.gouv.fr : nettoyage, jointures, "
            "statistiques descriptives, visualisations, export CSV",
            "comparaison des taux d'insertion MIAGE Toulouse avec la moyenne nationale et les "
            "autres filières, publiée sur GitHub",
        ],
    },
}


def faits_projet(nom: str) -> dict:
    """Fiche d'un projet, ou un vide assumé : mieux vaut « non précisé » qu'un fait inventé."""
    return PROJETS.get(nom, {})


def bloc_projets(noms: list[str] | None = None) -> str:
    """Texte prêt pour un prompt : une ligne par projet, stack et faits compris."""
    lignes = []
    for nom in (noms or PROJETS):
        f = PROJETS.get(nom)
        if not f:
            continue
        detail = " ; ".join(f["faits"])
        lignes.append(f"- {f['titre']} — {f['stack']}. {detail}.")
    return "\n".join(lignes)


def libelle_competence(item: str) -> str:
    """Formulation à écrire sur un CV pour une compétence du référentiel (défaut : l'entrée)."""
    return LIBELLES_AFFICHES.get(item, item)


# --- Centres d'intérêt : les vrais, choisis et ordonnés selon ce que le poste valorise -------
# Les libellés sont **ceux des CV maîtres**, mot pour mot : « Tech & Automatisation » (CV_MASTER),
# « Lecture », « Voyages », « Football », « Gaming » (CV_MASTER_data et _dev). Le libellé
# « Tech et IA » qui figurait ici était une recomposition (« Tech & Automatisation » du maître
# fusionné avec la ligne « tech/IA » du profil) : vérifié le 22/10/2026, il n'apparaissait nulle
# part mot pour mot. On n'invente aucun intérêt : on les réordonne et on en garde quatre.
INTERETS = {
    "dev": ["Gaming", "Tech & Automatisation", "Football", "Voyages"],
    "data": ["Tech & Automatisation", "Lecture", "Voyages", "Football"],
    "devops": ["Tech & Automatisation", "Gaming", "Football", "Voyages"],
    "defaut": ["Lecture", "Voyages", "Football", "Gaming"],
}
# Mots-clés qui désignent le domaine d'une offre, dans l'ordre où on les teste.
DOMAINE_MOTS = {
    "data": ("data", "données", "business intelligence", "bi", "analyst", "power bi", "sql",
             "machine learning", "ia", "intelligence artificielle"),
    "devops": ("devops", "cloud", "infrastructure", "docker", "ci/cd", "système", "réseau"),
    "dev": ("développeur", "developer", "web", "full stack", "fullstack", "logiciel", "software",
            "front", "back", "application", "react", "java", "python"),
}


def domaine(offer: dict) -> str:
    texte = " ".join(str(offer.get(k) or "") for k in ("title", "description", "skills_required")).lower()
    for nom, mots in DOMAINE_MOTS.items():
        if any(m in texte for m in mots):
            return nom
    return "defaut"


def interets_pour(offer: dict) -> list[str]:
    return list(INTERETS.get(domaine(offer), INTERETS["defaut"]))
