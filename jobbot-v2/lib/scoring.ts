/**
 * Le bulletin (système 4 de `reference/priorites.py`), porté en TypeScript.
 *
 * C'est une **copie fidèle** du moteur Python : mêmes critères, mêmes points, mêmes arrondis
 * (arrondi bancaire de Python), mêmes libellés, accents compris. La source de vérité reste
 * `reference/priorites.py` ; `npm run verifier-scoring` compare ce calcul à `data/offers.json`
 * offre par offre, critère par critère.
 *
 * Ce module n'importe rien : il tourne tel quel dans Next.js et sous Node (script de vérification).
 */

/** Ce dont le calcul a besoin — un sous-ensemble des champs de `data/offers.json`. */
export type OffreAScorer = {
  id: number;
  source: string | null;
  canonical_url: string | null;
  title: string | null;
  company: string | null;
  description: string | null;
  skills_required: string[] | null;
  start_date: string | null;
  published_at: string | null;
  first_seen_at: string | null;
};

export type LigneBulletin = {
  critere: string;
  points: number;
  max: number;
  detail: string | null;
};

export type Resultat = {
  id: number;
  total: number;
  /** Les lignes du bulletin telles que Python les écrit (`score_reasons`). */
  raisons: string[];
  /** Les lignes découpées comme le fait `export_site._decouper` (`score_breakdown`). */
  breakdown: LigneBulletin[];
  /** Technos reconnues dans l'offre (`_exigences`). */
  exigences: string[];
  /** Exigences non couvertes par les atouts du profil. */
  manquants: string[];
};

/* ---------------------------------------------------------------- constantes */

// Atouts réels de Fanel (profil + projets). L'ordre compte : `_couverte` renvoie le premier trouvé.
const MES_ATOUTS: [string, string][] = [
  ["python", "Python"], ["javascript", "JavaScript"], ["react", "React"], ["next.js", "Next.js"],
  ["node.js", "Node.js"], ["node", "Node.js"], ["express", "Express"], ["java", "Java"],
  ["kotlin", "Kotlin"], ["php", "PHP"], ["sql", "SQL"], ["mysql", "MySQL"],
  ["postgresql", "PostgreSQL"], ["sqlite", "SQLite"], ["git", "Git"], ["github", "GitHub"],
  ["tailwind", "Tailwind"], ["power bi", "Power BI"], ["power query", "Power Query"], ["dax", "DAX"],
  ["pandas", "Pandas"], ["matplotlib", "Matplotlib"], ["excel", "Excel"], ["html", "HTML"],
  ["css", "CSS"], ["api rest", "API REST"], ["rest", "API REST"],
  ["javascript/typescript", "JavaScript"], ["json", "JSON"], ["scrum", "Scrum"], ["agile", "Agile"],
];

// Familles : une exigence proche compte comme couverte (SQL ↔ MySQL/PostgreSQL/SQLite…).
const FAMILLES: [string, string[]][] = [
  ["sql", ["mysql", "postgresql", "sqlite", "requêtes sql", "bases de données"]],
  ["power bi", ["power query", "dax", "tableaux de bord"]],
  ["javascript", ["react", "node", "next.js", "html", "css", "express"]],
  ["python", ["pandas", "matplotlib", "scripts python"]],
  ["excel", ["tableur", "tableaux croisés", "vba"]],
];

// Vocabulaire technique cherché dans l'offre (l'ordre fixe l'ordre des exigences trouvées).
const VOCABULAIRE = [
  "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Express", "Java", "Kotlin",
  "PHP", "C++", "C#", ".NET", "SQL", "MySQL", "PostgreSQL", "SQLite", "Power BI", "Power Query",
  "DAX", "Pandas", "Matplotlib", "Excel", "VBA", "Docker", "Kubernetes", "AWS", "Azure", "GCP",
  "Spark", "Fabric", "Snowflake", "Talend", "Git", "Linux", "HTML", "CSS", "Tailwind", "REST",
  "API", "JWT", "tests unitaires", "Scrum", "Agile", "UML", "PowerShell", "Bash", "ML", "IA",
  "intelligence artificielle", "IA générative", "IA generative", "LLM", "NLP", "modèles de langage",
  "réseaux de neurones", "data science", "machine learning", "deep learning", "data visualisation",
  "ETL", "Power Platform", "SharePoint", "SAP", "ServiceNow", "AWS Glue", "Jenkins", "Ansible",
  "Terraform", "Qlik", "Tableau",
];

// Métiers visés (le titre pèse double). L'ordre départage les égalités.
const METIERS: [string, string[]][] = [
  ["développement full stack", ["developpeur", "developpeuse", "developpement", "full stack", "fullstack",
    "web", "logiciel", "application", "front-end", "back-end", "backend"]],
  ["data / analyse", ["data", "donnees", "business intelligence", "analytics", "reporting", "dashboard",
    "visualisation", "power bi", "statistique", "tableaux de bord"]],
  ["tests / validation", ["test", "ivvq", "validation", "verification", "qualification", "ivq"]],
  ["gestion de projet", ["gestion de projet", "coordination", "planning", "pmo", "assistant a la"]],
  ["systèmes embarqués", ["embarque", "temps reel", "fpga", "microcontroleur", "assembleur", "c++"]],
  ["industrie / mécanique", ["mecanique", "industriel", "industrialisation", "production", "fournisseurs",
    "logistique", "acoustique", "thermique"]],
];
const POINTS_METIER: Record<string, number> = {
  "développement full stack": 15, "data / analyse": 15, "tests / validation": 9,
  "gestion de projet": 6, "systèmes embarqués": 3, "industrie / mécanique": 2,
};

// Coût de dépôt selon l'ATS. Le premier motif trouvé l'emporte.
const DEPOTS: [number, string[], string][] = [
  [2, ["myworkdayjobs", "workday", "taleo", "successfactors", "njoyn", "cgi.com"], "compte + 8 étapes"],
  [4, ["recrutement.cnes", "sii-group", "emploi.sncf", "soprasteria"], "portail du site carrière"],
  [5, ["smartrecruiters", "greenhouse", "lever.co", "recruitee", "teamtailor"], "formulaire court"],
  [3, ["linkedin.com", "indeed"], "alerte — il faut retrouver l'offre d'origine"],
];

const PLAFOND_GROUPE = 3;
const GROUPES: [string, string][] = [
  ["airbus", "Airbus (et Airbus Protect, ATR, Atlantic)"],
  ["atr", "Airbus (et Airbus Protect, ATR, Atlantic)"],
  ["thales", "Thales (et Thales Alenia Space)"],
  ["capgemini", "Capgemini"],
  ["sopra", "Sopra Steria"],
  ["sii", "Groupe SII"],
  ["atos", "Atos"],
  ["cnes", "CNES"],
  ["wienerberger", "wienerberger"],
  ["rte", "RTE"],
];

const ATS_VERIFIABLES = ["myworkdayjobs", "smartrecruiters", "greenhouse", "lever.co", "recruitee",
  "teamtailor", "njoyn", "taleo", "successfactors", "cegid", "welcometothejungle",
  "sii-group", "recrutement.cnes", "soprasteria", "jobs.airbus"];
const FUITE_TARD = ["asap", "immediat"];

const PROJETS: [string, string[]][] = [
  ["TechScope — pipeline Python de détection d'anomalies (12 anomalies sur 113 lignes)",
    ["anomalie", "détection", "logs", "qualité de données", "data quality", "pipeline", "fiabilité",
      "investigation", "surveillance", "monitoring"]],
  ["Biblio-Tech — application web full stack (Next.js, Node, API, JWT, IoT simulé)",
    ["web", "front", "react", "next", "javascript", "application", "interface", "api", "full stack",
      "fullstack", "développement logiciel", "site"]],
  ["Analyse Insertion Pro MIAGE — analyse de données emploi, tableaux de bord",
    ["données", "data", "tableaux de bord", "dashboard", "power bi", "analyse", "statistique",
      "reporting", "kpi", "indicateurs", "visualisation"]],
  ["Générateur de documents / automatisation (scripts Python, traitement de fichiers)",
    ["automatisation", "automatiser", "script", "traitement de données", "extraction", "génération"]],
];

/* --------------------------------------------------- équivalents de Python */

/**
 * `round()` de Python : arrondi au plus proche, **égalité vers le pair** (round(22.5) == 22).
 * `Math.round` arrondirait 22.5 à 23 — un point d'écart sur la cohérence.
 */
function arrondiPython(x: number): number {
  const r = Math.round(x);
  if (Math.abs(x % 1) === 0.5) return 2 * Math.round(x / 2);
  return r;
}

/** `f"{x:.0f}"` : même règle de l'égalité vers le pair, sur la valeur binaire exacte. */
function format0f(x: number): string {
  if (Math.abs(x % 1) === 0.5) return String(2 * Math.round(x / 2));
  return x.toFixed(0);
}

/** Longueur au sens de Python (`len`) : en points de code, pas en unités UTF-16. */
function longueur(s: string): number {
  return Array.from(s).length;
}

/**
 * `_norm` : minuscules, NFKD, sans diacritiques. Python retire les caractères de classe de
 * combinaison non nulle ; `\p{Mn}` couvre exactement ces cas pour le texte latin des offres.
 */
function norm(txt: string | null | undefined): string {
  return (txt ?? "").toLowerCase().normalize("NFKD").replace(/\p{Mn}/gu, "");
}

/** `_cle_texte` : NFD, sans marques (catégorie Mn), toute ponctuation réduite à une espace. */
function cleTexte(s: string | null | undefined): string {
  const texte = String(s ?? "").toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");
  return texte.replace(/[^a-z0-9]+/g, " ").trim();
}

function echapper(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * En base, `skills_required` est la chaîne JSON que l'export décode ; Python la lit **telle
 * quelle** (`str(...)`). On la ré-encode comme `json.dumps` (séparateur « , »). Les guillemets et
 * virgules ne sont ni lettres ni chiffres : la correspondance mot entier n'en dépend pas.
 */
function skillsCommeEnBase(skills: string[] | null): string {
  if (!skills || skills.length === 0) return "[]";
  return "[" + skills.map((s) => JSON.stringify(s)).join(", ") + "]";
}

/* ------------------------------------------------------------- les critères */

/**
 * `_exigences` : technos citées par l'offre, en **mot entier**.
 *
 * Python lit aussi `skills_optional`, qui n'est **pas exporté** dans `data/offers.json` : une
 * techno présente uniquement dans ce champ échappe donc à ce calcul (voir le script de vérification,
 * qui le signale en comparant avec `skills.required`).
 */
export function exigences(o: OffreAScorer): string[] {
  const texte = norm([o.title ?? "", o.description ?? "", skillsCommeEnBase(o.skills_required), ""]
    .join(" "));
  const trouvees: string[] = [];
  for (const mot of VOCABULAIRE) {
    const motif = new RegExp("(?<![a-z0-9])" + echapper(norm(mot)) + "(?![a-z0-9])");
    if (motif.test(texte) && !trouvees.includes(mot)) trouvees.push(mot);
  }
  return trouvees;
}

/**
 * `_couverte` : nom de l'atout qui couvre l'exigence (comparaison en minuscules, accents gardés).
 *
 * `ajouts` est la liste des compétences **simulées** — celles que l'on n'a pas encore et dont on
 * veut mesurer l'effet (« et si j'apprenais TypeScript ? »). Vide par défaut : le calcul rend alors
 * exactement ce que rend le pipeline, et `npm run verifier-scoring` le vérifie sur chaque offre.
 * Les ajouts sont examinés en premier, avec la même règle de correspondance que les atouts réels.
 */
function couverte(exigence: string, ajouts: readonly string[] = []): string | null {
  const e = exigence.toLowerCase();
  for (const brut of ajouts) {
    const cle = brut.toLowerCase().trim();
    if (cle && (e.includes(cle) || cle.includes(e))) return brut;
  }
  for (const [cle, nom] of MES_ATOUTS) {
    if (e.includes(cle) || cle.includes(e)) return nom;
  }
  for (const [cle, proches] of FAMILLES) {
    if ([cle, ...proches].some((p) => e.includes(p))) {
      const nom = MES_ATOUTS.find(([k]) => k === cle)?.[1];
      if (nom) return `${nom} (famille)`;
    }
  }
  return null;
}

function projet(titre: string, description: string): string | null {
  const texte = norm(`${titre} ${description}`);
  for (const [nom, mots] of PROJETS) {
    if (mots.some((m) => texte.includes(norm(m)))) return nom;
  }
  return null;
}

/**
 * Lecture stricte façon `strptime` d'une date naïve, renvoyée en millisecondes « murales »
 * (l'heure est lue comme si elle était UTC : seul l'écart entre deux dates naïves compte).
 */
function strptime(d: string, avecHeure: boolean): number | null {
  const motif = avecHeure
    ? /^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{1,2}):(\d{1,2})$/
    : /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  const m = motif.exec(d);
  if (!m) return null;
  const [an, mo, j, h = 0, mi = 0, s = 0] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || h > 23 || mi > 59 || s > 61) return null;
  const t = Date.UTC(an, mo - 1, j, h, mi, s);
  if (new Date(t).getUTCDate() !== j) return null;      // 31 février : refusé, comme Python
  return t;
}

/** `_jours` : ancienneté en jours (99 si aucune date lisible). */
function jours(o: OffreAScorer, maintenant: number): number {
  const d = (o.published_at || o.first_seen_at || "").slice(0, 19);
  for (const [largeur, avecHeure] of [[19, true], [10, false]] as const) {
    const t = strptime(d.slice(0, largeur).trim(), avecHeure);
    if (t !== null) return Math.max(0.0, (maintenant - t) / 1000 / 86400.0);
  }
  return 99.0;
}

function fraicheur(j: number): number {
  return j <= 1 ? 25 : j <= 2 ? 22 : j <= 3 ? 19 : j <= 5 ? 15 : j <= 7 ? 10 : 0;
}

function metier(o: OffreAScorer): [string | null, number] {
  const titre = norm(o.title), desc = norm(o.description);
  let meilleur: string | null = null, meilleurScore = -1;
  for (const [libelle, mots] of METIERS) {
    const score = mots.filter((m) => titre.includes(norm(m))).length * 2
      + mots.filter((m) => desc.includes(norm(m))).length;
    // Strictement supérieur : à égalité, la première famille gagne (comme le `max` de Python).
    if (score > meilleurScore) [meilleur, meilleurScore] = [libelle, score];
  }
  if (meilleurScore === 0 || meilleur === null) return [null, 0];
  return [meilleur, POINTS_METIER[meilleur] ?? 0];
}

function fiabiliteSource(o: OffreAScorer): [number, string] {
  const url = (o.canonical_url ?? "").toLowerCase();
  const source = (o.source ?? "").toLowerCase();
  if (ATS_VERIFIABLES.some((d) => url.includes(d))) return [12, "site carrière vérifiable"];
  if (source === "linkedin" || source === "indeed" || url.includes("linkedin.com")) {
    return [3, "alerte non vérifiable"];
  }
  return [7, `source ${source || "inconnue"}`];
}

function qualiteFiche(o: OffreAScorer, exigs: string[]): [number, string] {
  const desc = o.description ?? "";
  if (longueur(desc) >= 500 && exigs.length >= 2) return [10, `fiche complète (${exigs.length} technos)`];
  if (longueur(desc) >= 200) return [6, "fiche partielle"];
  return [2, "fiche vide — ouvrir la page avant de postuler"];
}

function calendrier(o: OffreAScorer): [number, string] {
  const debut = norm(o.start_date);
  if (!debut || FUITE_TARD.some((f) => debut.includes(f))) return [4, "date de début inconnue — à confirmer"];
  const mois = /^(20\d\d)-(\d\d)/.exec(debut);
  if (!mois) return [4, `date de début « ${o.start_date} » à confirmer`];
  const annee = Number(mois[1]), m = Number(mois[2]);
  if (annee < 2027 || (annee === 2027 && m < 3)) {
    return [0, `⚠️ démarre le ${o.start_date} — tu es encore en cours`];
  }
  if (annee < 2027 || (annee === 2027 && m <= 9)) return [10, `début ${o.start_date} compatible`];
  return [6, `début ${o.start_date} tardif pour la rentrée M1`];
}

function groupe(o: OffreAScorer): string {
  const nom = cleTexte(o.company);
  for (const [cle, g] of GROUPES) {
    if (nom.includes(cle)) return g;
  }
  return nom || "?";
}

/** `_urgence` : affichée, jamais notée. */
function urgence(j: number): string {
  const reste = 7.0 - j;
  if (reste <= 1) return `⏳ dernier appel : expire dans ${format0f(Math.max(reste, 0))} j`;
  if (reste <= 2) return `⏳ expire dans ${format0f(reste)} j`;
  return `fenêtre : ${format0f(reste)} j restants`;
}

function coutDepot(o: OffreAScorer): [number, string] {
  const url = (o.canonical_url ?? "").toLowerCase();
  for (const [points, motif, libelle] of DEPOTS) {
    if (motif.some((m) => url.includes(m))) return [points, libelle];
  }
  return [4, "formulaire du site"];
}

/** `_dossier_pret` : l'export n'a aucune action enregistrée à transmettre (`actions` vide). */
function dossierPret(o: OffreAScorer, actions: Map<number, number>): [number, string] {
  const n = actions.get(o.id) ?? 0;
  if (n >= 2) return [4, "dossier déjà bien avancé"];
  if (n === 1) return [2, "dossier entamé"];
  return [0, "rien de fait"];
}

/* ------------------------------------------------------- découpage du bulletin */

// Même motif que `export_site.LIGNE_CRITERE` (le nom du critère peut porter des accents : ô, î).
const LIGNE_CRITERE = /^([^\d\s]+)\s+(\d+)\s*\/\s*(\d+)\s*(?:\((.*)\))?\s*$/u;

/** `export_site._decouper` : « cohérence 24/30 (2/2 exigences) » → {critere, points, max, detail}. */
export function decouper(raisons: string[]): LigneBulletin[] {
  const out: LigneBulletin[] = [];
  for (const ligne of raisons) {
    const m = LIGNE_CRITERE.exec(ligne.trim());
    if (!m) continue;
    out.push({ critere: m[1], points: Number(m[2]), max: Number(m[3]), detail: (m[4] ?? "").trim() || null });
  }
  return out;
}

/* ------------------------------------------------------------ heure du calcul */

/**
 * Fuseau de la machine du pipeline, en heures. `export_site.py` note les offres avec
 * `datetime.now()` (heure **locale**, sans fuseau) et écrit `meta.generated_at` en UTC juste après.
 * La machine tourne en UTC : les horodatages de collecte de la base (`last_seen_at`, au plus tard
 * 02:04:13 le 20/10/2026) précèdent `generated_at` (02:33:48 UTC) sur la même horloge.
 */
export const FUSEAU_PIPELINE_HEURES = 0;

/** L'heure murale du calcul Python, reconstituée depuis `meta.generated_at`. */
export function maintenantDeLExport(generatedAt: string, fuseauHeures = FUSEAU_PIPELINE_HEURES): number {
  return Date.parse(generatedAt) + fuseauHeures * 3_600_000;
}

/* ------------------------------------------------------------------ classer */

/**
 * `classer(offres, 4, maintenant)` : le bulletin à neuf critères, plafond par groupe compris.
 *
 * - `maintenant` : l'heure murale naïve du calcul, en millisecondes (lue comme UTC, comme les dates
 *   de la base) ;
 * - l'**ordre** de `offres` compte : à égalité de note, la passe de diversité suit l'ordre d'entrée
 *   (le tri de Python est stable). Il faut donc fournir les offres dans l'ordre où le pipeline les
 *   a chargées.
 *
 * Renvoie les résultats triés du plus prioritaire au moins.
 */
/**
 * Classe les offres. `ajouts` simule des compétences que le profil n'a pas encore : c'est le seul
 * levier du « et si j'apprenais X ? », et il ne touche que la couverture des exigences — donc le
 * critère « cohérence », puis la passe de diversité qui dépend de l'ordre des notes.
 *
 * Sans `ajouts`, le résultat est celui du pipeline, à la virgule près.
 */
export function classer(
  offres: OffreAScorer[],
  maintenant: number,
  actions: Map<number, number> = new Map(),
  ajouts: readonly string[] = [],
): Resultat[] {
  const premiere: { prio: number; o: OffreAScorer; raisons: string[]; exigs: string[]; manquants: string[]; groupe: string }[] = [];
  for (const o of offres) {
    const exigs = exigences(o);
    const couvertes = exigs.filter((x) => couverte(x, ajouts));
    const manquants = exigs.filter((x) => !couverte(x, ajouts));
    // Dénominateur plancher de 3 (biais corrigé côté Python le 18/10/2026).
    const base = exigs.length ? couvertes.length / Math.max(3, exigs.length) : 0.35;
    const j = jours(o, maintenant);
    const lien = projet(o.title ?? "", o.description ?? "");

    const [libMetier, ptsMetier] = metier(o);
    const [ptsSource, pourquoiSource] = fiabiliteSource(o);
    const [ptsFiche, pourquoiFiche] = qualiteFiche(o, exigs);
    const [ptsCal, pourquoiCal] = calendrier(o);
    const [ptsCout, pourquoiCout] = coutDepot(o);
    const [ptsDos, pourquoiDos] = dossierPret(o, actions);
    const coherence = arrondiPython(30 * Math.min(1.0, base + (lien ? 0.15 : 0)));
    const metier12 = arrondiPython(12 * ptsMetier / 15);
    const source8 = arrondiPython(8 * ptsSource / 12);
    const fiche6 = arrondiPython(6 * ptsFiche / 10);
    const cal8 = arrondiPython(8 * ptsCal / 10);
    const cout6 = arrondiPython(6 * ptsCout / 5);
    const frais12 = arrondiPython(12 * fraicheur(j) / 25);
    const prio = coherence + metier12 + source8 + fiche6 + cal8 + cout6 + frais12 + ptsDos;
    const raisons = [
      `cohérence ${coherence}/30 (${couvertes.length}/${exigs.length} exigences`
        + (lien ? ` + ${lien.split(" — ")[0]}` : "") + ")",
      `métier ${metier12}/12 (${libMetier || "indéterminé"})`,
      `source ${source8}/8 (${pourquoiSource})`,
      `fiche ${fiche6}/6 (${pourquoiFiche})`,
      `calendrier ${cal8}/8 (${pourquoiCal})`,
      `dépôt ${cout6}/6 (${pourquoiCout})`,
      `dossier ${ptsDos}/4 (${pourquoiDos})`,
      `fraîcheur ${frais12}/12 (il y a ${format0f(j)} j)`,
      urgence(j),
    ];
    premiere.push({ prio, o, raisons, exigs, manquants, groupe: groupe(o) });
  }

  // Deuxième passe : plafond par groupe. `sort` est stable : à égalité, l'ordre d'entrée tient.
  const ordonnes = [...premiere].sort((a, b) => b.prio - a.prio);
  const vus = new Map<string, number>();
  const finaux = ordonnes.map((r) => {
    let points: number, pourquoi: string;
    const deja = vus.get(r.groupe) ?? 0;
    if (deja < PLAFOND_GROUPE) {
      vus.set(r.groupe, deja + 1);
      [points, pourquoi] = [14, `${r.groupe} — ${deja + 1}ᵉ place`];
    } else {
      [points, pourquoi] = [0, `plafond atteint chez ${r.groupe}`];
    }
    const raisons = [...r.raisons, `diversité ${points}/14 (${pourquoi})`];
    return {
      id: r.o.id,
      total: r.prio + points,
      raisons,
      breakdown: decouper(raisons),
      exigences: r.exigs,
      manquants: r.manquants,
    };
  });
  return finaux.sort((a, b) => b.total - a.total);
}

/**
 * Ordre dans lequel `export_site.charger` présente les offres au calcul : d'abord les stages et
 * alternances dans l'ordre de la base (identifiant croissant), puis les offres sans type de contrat,
 * de la plus récente à la plus ancienne. Cet ordre départage les égalités de la passe de diversité.
 */
export function ordreDuPipeline<T extends OffreAScorer & { contract_known: boolean }>(offres: T[]): T[] {
  const parId = (a: T, b: T) => a.id - b.id;
  const duSite = offres.filter((o) => o.contract_known).sort(parId);
  const cle = (o: T) => o.published_at || o.first_seen_at || "";
  const sansContrat = offres.filter((o) => !o.contract_known).sort(parId)
    .sort((a, b) => (cle(a) < cle(b) ? 1 : cle(a) > cle(b) ? -1 : 0));
  return [...duSite, ...sansContrat];
}
