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
  /** Compétences souhaitées : le pipeline les compte aussi parmi les exigences. */
  skills_optional?: string[] | null;
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
  // Ajoutés le 20/10/2026 côté Python (mise en ligne de JobBot V2) puis portés ici le 21/10/2026 : sans
  // ces trois entrées, le site ne comptait pas « tests unitaires » comme couvert et affichait 4 exigences
  // couvertes là où le pipeline en compte 5 (constaté sur l'offre #796 chez Capgemini).
  ["typescript", "TypeScript"], ["tests unitaires", "tests unitaires"], ["vitest", "Vitest"],
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

// Plafond par groupe : **retiré le 21/10/2026** (« on s'en fout du plafond, enlève-moi les plafonds »).
// Il valait 3 et retirait 14 points à chaque offre au-delà de la troisième d'un même groupe. Le critère
// reste affiché (comptage des places) mais ne retire plus rien. Valeur historique : 3.
const PLAFOND_GROUPE: number | null = null;
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
  // Ajouté le 20/10/2026 (même date que côté Python) : JobBot V2 est en ligne. Ce qui le rend crédible
  // sur une offre, ce n'est pas « un site », c'est le TypeScript, le portage d'un moteur Python et les
  // tests qui le tiennent. Sans cette entrée, le site ne créditait pas le projet que le pipeline crédite
  // → 26 désaccords constatés le 21/10/2026 dans verifier-scoring.
  ["JobBot V2 — site Next.js/TypeScript, moteur de scoring porté de Python, 88 tests, PostgreSQL",
    ["typescript", "tests", "test unitaire", "postgresql", "déploiement", "mise en production",
      "modèle de données", "algorithme", "veille", "collecte", "automatisé", "qualité de code"]],
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
  const texte = norm([o.title ?? "", o.description ?? "", skillsCommeEnBase(o.skills_required),
    skillsCommeEnBase(o.skills_optional ?? null)].join(" "));
  const trouvees: string[] = [];
  for (const mot of VOCABULAIRE) {
    const motif = new RegExp("(?<![a-z0-9])" + echapper(norm(mot)) + "(?![a-z0-9])");
    if (motif.test(texte) && !trouvees.includes(mot)) trouvees.push(mot);
  }
  return trouvees;
}

/** `_couverte` : nom de l'atout qui couvre l'exigence (comparaison en minuscules, accents gardés). */
function couverte(exigence: string): string | null {
  const e = exigence.toLowerCase();
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
// Le signe est accepté : les ajustements et la ligne de plafond peuvent être négatifs.
const LIGNE_CRITERE = /^([^\d\s]+)\s+(-?\d+)\s*\/\s*(\d+)\s*(?:\((.*)\))?\s*$/u;

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

/* ------------------------------- critère 5 : la date de fin (22/10/2026)

/**
 * La rentrée de Master est en septembre 2027 : c'est la **fin** du stage qui commande tout, pas sa
 * durée — un stage de quatre mois démarrant en juin finit en octobre. Portage de
 * `eligibility.fin_de_stage` + `scoring.fin_score` : quatre paliers, drapeau de négociation, et
 * malus de classement au palier « à raccourcir ». Une fin non calculable ne reçoit rien : on ne
 * pénalise pas un champ que la source a laissé vide.
 */
const FIN_TARDIVE_MALUS = -8.0;
const PALIERS_FIN = { compatible: "2027-07-31", negociation: "2027-08-31", raccourcir: "2027-10-31" };
const PALIER_FIN_COMPATIBLE = "compatible";
const PALIER_FIN_NEGOCIATION = "negociation";
const PALIER_FIN_RACCOURCIR = "raccourcir";
const PALIER_FIN_HORS_PORTEE = "hors_portee";

const MOIS_FR: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8,
  septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

/** `_norm` de Python : minuscules, accents retirés, espaces normalisés. */
function sansAccents(txt: string): string {
  return txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** `parse_date` : ISO, JJ/MM/AAAA, MM/AAAA, « septembre 2026 », « 1er mars 2027 ». */
function parseDateFr(value: string | null | undefined): Date | null {
  const s = sansAccents(String(value ?? ""));
  if (!s) return null;
  let m = /(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(s);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? 1)));
  m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  m = /\b(\d{1,2})\/(\d{4})\b/.exec(s);
  if (m) return new Date(Date.UTC(Number(m[2]), Number(m[1]) - 1, 1));
  m = /(\d{1,2})(?:er)?\s+([a-z]+)\.?\s+(\d{4})/.exec(s);
  if (m && MOIS_FR[m[2]]) return new Date(Date.UTC(Number(m[3]), MOIS_FR[m[2]] - 1, Number(m[1])));
  m = /(?:^|\s)([a-z]+)\.?\s+(\d{4})/.exec(s);
  if (m && MOIS_FR[m[1]]) return new Date(Date.UTC(Number(m[2]), MOIS_FR[m[1]] - 1, 1));
  return null;
}

const UNITES_MOIS: Record<string, number> = {
  mois: 1, month: 1, months: 1, an: 12, ans: 12, annee: 12, annees: 12, year: 12, years: 12,
  semaine: 12 / 52, semaines: 12 / 52, week: 12 / 52, weeks: 12 / 52,
};
const UNITES_RE = "(mois|months?|ans?|annees?|years?|semaines?|weeks?)";

/** `parse_duration` : « 6 mois », « 1 an », « 4 à 6 mois », « 4-6 months », un nombre de mois. */
function parseDureeMois(value: unknown): [number, number] | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return [value, value];
  const s = sansAccents(String(value));
  const nombre = (x: string) => Number(x.replace(",", "."));
  let m = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:a|-|to|ou)\\s*(\\d+(?:[.,]\\d+)?)\\s*${UNITES_RE}`).exec(s);
  if (m) { const k = UNITES_MOIS[m[3]]; return [nombre(m[1]) * k, nombre(m[2]) * k]; }
  m = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${UNITES_RE}`).exec(s);
  if (m) { const v = nombre(m[1]) * UNITES_MOIS[m[2]]; return [v, v]; }
  if (/^\d+(?:[.,]\d+)?$/.test(s)) { const v = nombre(s); return [v, v]; }
  return null;
}

/** `_ajouter_mois` : mois fractionnaires, même arrondi que Python. */
function ajouterMois(d: Date, mois: number): Date {
  return new Date(d.getTime() + arrondiPython(mois * 30.4375) * 86_400_000);
}

const JOUR_MS = 86_400_000;
const jjmmaaaa = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

/** `est_stage` : le contrat de stage est-il annoncé — champ, sinon titre, sinon énoncé. */
export function estStage(o: OffreAEvaluer): boolean {
  return (["contract_type", "title", "description"] as const).some((champ) =>
    new RegExp("\\b(?:stage|stagiaire|internship|intern)\\b")
      .test(sansAccents(String(o[champ] ?? ""))));
}

export type FinStage = { fin: Date | null; palier: string; semaines: number; drapeau: string };

/** `fin_de_stage` : la date de fin calculée, et le palier de la fenêtre du 31/07/2027. */
export function finDeStage(o: OffreAEvaluer): FinStage {
  const vide: FinStage = { fin: null, palier: "", semaines: 0, drapeau: "" };
  const debut = parseDateFr(o.start_date);
  if (!debut) return vide;                                   // on ne fabrique pas une fin
  let duree = parseDureeMois((o as { duration?: unknown }).duration);
  if (!duree) {
    const finAnnoncee = parseDateFr((o as { end_date?: string | null }).end_date);
    if (finAnnoncee && finAnnoncee > debut) {
      // `_months_between` : fin incluse, l'arrondi de Python au dixième.
      const mois = Number(((((finAnnoncee.getTime() - debut.getTime()) / JOUR_MS + 1) / 30.44)
        .toFixed(1)));
      duree = [mois, mois];
    }
  }
  if (!duree) return vide;
  const fin = ajouterMois(debut, duree[0]);
  const borne = (iso: string) => new Date(`${iso}T00:00:00Z`);
  const compatible = borne(PALIERS_FIN.compatible);
  if (fin <= compatible) return { fin, palier: PALIER_FIN_COMPATIBLE, semaines: 0, drapeau: "" };
  const semaines = Math.max(1, arrondiPython((fin.getTime() - compatible.getTime()) / JOUR_MS / 7));
  if (fin <= borne(PALIERS_FIN.negociation)) {
    return { fin, palier: PALIER_FIN_NEGOCIATION, semaines,
      drapeau: `fin ${jjmmaaaa(fin)} : dépasse de ${semaines} semaine(s), à négocier` };
  }
  if (fin <= borne(PALIERS_FIN.raccourcir)) {
    return { fin, palier: PALIER_FIN_RACCOURCIR, semaines,
      drapeau: `fin ${jjmmaaaa(fin)} : nécessite de raccourcir de ${semaines} semaine(s)` };
  }
  return { fin, palier: PALIER_FIN_HORS_PORTEE, semaines,
    drapeau: `fin ${jjmmaaaa(fin)} au-delà du ${jjmmaaaa(borne(PALIERS_FIN.raccourcir))} : `
      + "hors de portée, rien à négocier" };
}

/** `fin_score` : les points du critère, et le texte tel que le bulletin l'affiche. */
export function finScore(o: OffreAEvaluer): [number, string] {
  if (!estStage(o)) {
    return [0.0, "date de fin : offre non concernée (contrat non-stage) (0)"];
  }
  const f = finDeStage(o);
  if (!f.fin) return [0.0, "fin de stage : non calculable (début ou durée absents) (0)"];
  if (f.palier === PALIER_FIN_RACCOURCIR) {
    return [FIN_TARDIVE_MALUS, `${f.drapeau} (${signe0(FIN_TARDIVE_MALUS)})`];
  }
  if (f.drapeau) return [0.0, `${f.drapeau} (0)`];
  return [0.0, `fin ${jjmmaaaa(f.fin)} : dans la fenêtre (0)`];
}

/* ------------------------------------------------- ajustements du 22/10/2026 */

/**
 * Les quatre critères d'accessibilité, calculés par les fonctions du moteur `score_offer`
 * (`niveauDiplome`, `prerequisMetier`, `bloqueursAdmin`, `scoreDates`) : une seule implémentation
 * des règles et des pièges, comme côté Python où `priorites.py` importe `scoring.py`.
 */
type Ajustements = {
  niveau: number;
  metier: number;
  dates: number;
  competences: number;
  /** 5e critère : la date de fin, qui commande tout (rentrée de Master en septembre 2027). */
  fin: number;
  txtNiveau: string;
  txtPrerequis: string;
  txtDates: string;
  txtCompetences: string;
  txtFin: string;
  bloqueurs: string[];
  /** Somme des cinq ajustements, ajoutée à la note des quatre systèmes. */
  total: number;
};

function ajustements(o: OffreAScorer): Ajustements {
  const [niveauBrut, txtNiveau] = niveauDiplome(o);
  const [metierBrut, termes] = prerequisMetier(o);
  const bloqueurs = bloqueursAdmin(o);
  const [datesBrut, txtDates] = scoreDates(o);
  const [compBrut, comps] = competencesHorsProfil(o);
  const [finBrut, txtFin] = finScore(o);
  const niveau = Math.round(niveauBrut), metier = Math.round(metierBrut),
    dates = Math.round(datesBrut), competences = Math.round(compBrut), fin = Math.round(finBrut);
  const txtPrerequis = termes.length
    ? `prérequis métier hors profil : ${termes.join(", ")} (${signe0(metier)})`
    : "prérequis métier : aucun hors profil (0)";
  const txtCompetences = comps.length === 1
    ? `compétence exigée hors profil : ${comps[0]} (${signe0(competences)})`
    : comps.length
      ? `compétences exigées hors profil : ${comps.join(", ")} (${signe0(competences)})`
      : "compétences exigées : toutes dans le référentiel (0)";
  return {
    niveau, metier, dates, competences, fin, txtNiveau, txtPrerequis, txtDates, txtCompetences,
    txtFin, bloqueurs,
    total: niveau + metier + dates + competences + fin,
  };
}

/** Les quatre lignes additives du bulletin — même texte que `priorites._lignes_ajustements`. */
function lignesAjustements(a: Ajustements): string[] {
  return [
    `diplôme ${a.niveau}/0 (${a.txtNiveau})`,
    `prérequis ${a.metier}/0 (${a.txtPrerequis})`,
    `compétences ${a.competences}/0 (${a.txtCompetences})`,
    `dates ${a.dates}/0 (${a.txtDates})`,
    `fin ${a.fin}/0 (${a.txtFin})`,
  ];
}

/** Ligne du plafond : elle ne retire pas de points forfaitaires, elle constate l'écart à la borne. */
function lignePlafond(a: Ajustements, brut: number, note: number, plafond: number): string {
  const ecart = note - brut;
  if (a.bloqueurs.length) {
    return `plafond ${ecart}/0 (⛔ bloqueur administratif : ${a.bloqueurs[0]} — note plafonnée à ${plafond})`;
  }
  return `plafond ${ecart}/0 (note plafonnée à ${plafond})`;
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
export function classer(
  offres: OffreAScorer[],
  maintenant: number,
  actions: Map<number, number> = new Map(),
): Resultat[] {
  const premiere: { prio: number; o: OffreAScorer; raisons: string[]; exigs: string[]; manquants: string[];
    groupe: string; ajust: Ajustements }[] = [];
  for (const o of offres) {
    const exigs = exigences(o);
    const couvertes = exigs.filter((x) => couverte(x));
    const manquants = exigs.filter((x) => !couverte(x));
    // Dénominateur plancher de 3 (biais corrigé côté Python le 18/10/2026).
    const base = exigs.length ? couvertes.length / Math.max(3, exigs.length) : 0.35;
    const j = jours(o, maintenant);
    const lien = projet(o.title ?? "", o.description ?? "");
    // Les quatre critères d'accessibilité entrent dans la note du bulletin (et dans celle des
    // systèmes 1 à 3 côté Python, où `classer` les ajoute au même endroit).
    const ajust = ajustements(o);

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
    const prio = coherence + metier12 + source8 + fiche6 + cal8 + cout6 + frais12 + ptsDos
      + ajust.total;
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
    premiere.push({ prio, o, raisons, exigs, manquants, groupe: groupe(o), ajust });
  }

  // Deuxième passe : plafond par groupe. `sort` est stable : à égalité, l'ordre d'entrée tient.
  // Départage par identifiant, comme le Python : à égalité de note, l'ordre ne doit pas dépendre de
  // l'ordre d'entrée, sinon les « nᵉ place » de la diversité divergent entre le pipeline et le site.
  const ordonnes = [...premiere].sort((a, b) => b.prio - a.prio || a.o.id - b.o.id);
  const vus = new Map<string, number>();
  const finaux = ordonnes.map((r) => {
    let points: number, pourquoi: string;
    const deja = vus.get(r.groupe) ?? 0;
    if (PLAFOND_GROUPE === null || deja < PLAFOND_GROUPE) {
      vus.set(r.groupe, deja + 1);
      [points, pourquoi] = [14, `${r.groupe} — ${deja + 1}ᵉ place`];
    } else {
      [points, pourquoi] = [0, `plafond atteint chez ${r.groupe}`];
    }
    // Les quatre lignes du 22/10/2026, puis le plafond s'il mord : la note reste la somme exacte
    // de **toutes** les lignes du bulletin (`prio` contient déjà les ajustements).
    const raisons = [...r.raisons, `diversité ${points}/14 (${pourquoi})`, ...lignesAjustements(r.ajust)];
    const brut = r.prio + points;
    const plafond = r.ajust.bloqueurs.length ? PLAFOND_ADMIN : 100;
    const note = Math.min(brut, plafond);
    if (note !== brut) raisons.push(lignePlafond(r.ajust, brut, note, plafond));
    return {
      id: r.o.id,
      total: note,
      raisons,
      breakdown: decouper(raisons),
      exigences: r.exigs,
      manquants: r.manquants,
    };
  });
  return finaux.sort((a, b) => b.total - a.total || a.id - b.id);
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

/* ==========================================================================
 * `score_offer` — portage fidèle du moteur `scoring.py`
 *
 * Le bulletin ci-dessus (`classer`) est le portage de `priorites.py` ; ce bloc-ci est celui du
 * moteur de score de la base (`scoring.py`), avec ses six sous-scores et les quatre critères
 * ajoutés le 22/10/2026 : niveau de diplôme, prérequis métier, bloqueurs administratifs (plafond
 * 55), compatibilité des dates. `npm run verifier-scoring` ne compare que `classer` ; l'égalité de
 * `scoreOffre` avec Python se vérifie en lançant les deux moteurs sur les mêmes offres.
 * ========================================================================== */

export type OffreAEvaluer = OffreAScorer & {
  education_required?: string | null;
  location?: string | null;
  contract_type?: string | null;
  miage_mentioned?: boolean | number | null;
  skills_optional?: string[] | string | null;
};

export type LigneScore = { critere: string; points: number; max: number; detail: string };

export type ResultatScore = {
  technical_score: number;
  education_score: number;
  location_score: number;
  contract_score: number;
  miage_score: number;
  source_score: number;
  /** Ajustements (22/10/2026) : bonus/malus, chacun avec sa ligne dans `breakdown`. */
  niveau_diplome: number;
  prerequis_metier: number;
  /** Compétences exigées absentes du référentiel : -3 chacune, plafonné à -9. */
  competences_hors_profil: number;
  dates: number;
  /** Critère 5 (22/10/2026) : compatibilité de la date de fin avec la fenêtre du 31/07/2027. */
  date_de_fin: number;
  bloqueur_admin: boolean;
  /** Plafond appliqué (55) si un bloqueur administratif a été trouvé, sinon `null`. */
  plafond: number | null;
  score: number;
  confidence: number;
  reasons: string[];
  breakdown: LigneScore[];
};

const MAX_SCORE: Record<string, number> = {
  technical_score: 35, education_score: 25, location_score: 15,
  contract_score: 10, miage_score: 10, source_score: 5,
};

const PILE_SCORE: [string, string][] = [
  ["python", "Python"], ["javascript", "JavaScript"], ["react", "React"], ["next.js", "Next.js"],
  ["node.js", "Node.js"], ["express", "Express"], ["postgresql", "PostgreSQL"], ["mysql", "MySQL"],
  ["jwt", "JWT"], ["pandas", "Pandas"], ["matplotlib", "Matplotlib"], ["power bi", "Power BI"],
  ["git", "Git"], ["github", "GitHub"], ["docker", "Docker"], ["linux", "Linux"],
  ["tailwind css", "Tailwind CSS"], ["chart.js", "Chart.js"], ["sql", "SQL"], ["html", "HTML"],
  ["css", "CSS"], ["api rest", "API REST"],
];

const ALIAS_SCORE: Record<string, string> = {
  js: "javascript", ecmascript: "javascript",
  reactjs: "react", "react.js": "react",
  nextjs: "next.js", next: "next.js",
  nodejs: "node.js", node: "node.js",
  expressjs: "express", "express.js": "express",
  postgres: "postgresql", psql: "postgresql",
  powerbi: "power bi",
  tailwind: "tailwind css", tailwindcss: "tailwind css",
  chartjs: "chart.js",
  html5: "html", css3: "css",
  rest: "api rest", "rest api": "api rest", "api restful": "api rest",
  "restful api": "api rest", restful: "api rest", "apis rest": "api rest",
  "json web token": "jwt",
  "github actions": "github",
};

const TECH_NEUTRAL_SCORE = 20.0;
const REQUIRED_WEIGHT_SCORE = 0.8;
const OPTIONAL_WEIGHT_SCORE = 0.2;

const LIEUX: [string[], number][] = [
  [["toulouse", "haute-garonne", "blagnac", "labege", "colomiers"], 15],
  [["paris", "ile-de-france", "idf", "la defense",
    "suresnes", "boulogne", "nanterre", "courbevoie", "puteaux", "levallois", "neuilly",
    "issy-les-moulineaux", "issy les moulineaux", "rueil", "colombes", "asnieres",
    "clichy", "montrouge", "malakoff", "clamart", "meudon", "sevres", "chatillon",
    "gennevilliers", "saint-cloud", "saint cloud",
    "saint-denis", "saint denis", "montreuil", "aubervilliers", "pantin", "bobigny",
    "noisy-le-grand", "noisy le grand", "bagnolet", "saint-ouen", "saint ouen",
    "vincennes", "creteil", "ivry", "vitry", "villejuif", "fontenay-sous-bois",
    "charenton", "saint-mande", "saint-maur", "maisons-alfort", "arcueil", "rungis",
    "cergy", "argenteuil", "pontoise", "sarcelles", "massy", "palaiseau", "saclay",
    "evry", "orsay", "versailles", "saint-quentin-en-yvelines", "guyancourt",
    "velizy", "saint-germain-en-laye", "marne-la-vallee", "melun", "meaux",
    "champs-sur-marne", "serris"], 13],
  [["remote", "teletravail", "full remote", "a distance", "distanciel"], 10],
];
const LIEU_DEFAUT = 3, IDF_SCORE = 13, TOULOUSE_SCORE = 15;
const IDF_DEPT_RE_SCORE = /(?:^|\D)(?:75|77|78|91|92|93|94|95)(?:\s*-\s|\d{3}\b)/;
const HAUTE_GARONNE_RE_SCORE = /(?:^|\D)31(?:\s*-\s|\d{3}\b)/;

const CONTRATS: [string[], number][] = [
  [["alternance", "apprentissage", "apprenti", "contrat pro", "professionnalisation", "work-study"], 10],
  [["stage", "stagiaire", "internship", "intern"], 8],
  [["cdd", "fixed-term"], 5],
];

const SOURCES_SCORE: Record<string, number> = {
  career_page: 5, company: 5, site_entreprise: 5, careers: 5,
  airbus: 5, "sopra-steria": 5, sopra_steria: 5, capgemini: 5, thales: 5,
  renault: 5, atos: 5, cnes: 5, orange: 5, sii: 5, accenture: 5,
  france_travail: 4, apec: 4, welcome_to_the_jungle: 4, wttj: 4,
  jobteaser: 4, hellowork: 3, indeed: 3, linkedin: 3,
  labonnealternance: 4, "1jeune1solution": 3,
};
const SOURCE_DEFAUT_SCORE = 1;

const MIAGE_TERMES = [
  "informatique de gestion", "systemes d'information", "systeme d'information",
  "master informatique", "licence informatique", "formation informatique",
  "ecole d'ingenieur ou universite", "universite", "msi", "sio",
  "data", "developpement",
];

/* --- quatre critères ajoutés le 22/10/2026 --- */
const NIVEAU_BAC3_BONUS = 7.0;
const NIVEAU_BAC5_MALUS = -8.0;

/** (libellé affiché, variantes normalisées) — même liste que `scoring.PREREQUIS_METIER`. */
const PREREQUIS_METIER: [string, string[]][] = [
  ["mécanique spatiale", ["mecanique spatiale"]],
  ["chaînes RF", ["chaines rf", "chaine rf", "chaine radiofrequence"]],
  ["bilans de puissance", ["bilans de puissance", "bilan de puissance"]],
  ["aéronautique", ["aeronautique"]],
  ["spatial", ["spatial", "spatiale"]],
  ["traitement du signal", ["traitement du signal"]],
  ["OCR", ["ocr"]],
  ["VHDL", ["vhdl"]],
  ["hyperfréquences", ["hyperfrequences", "hyperfrequence"]],
];
const PREREQUIS_METIER_MALUS = -4.0;
const MARQUEURS_EXIGENCE = [
  "maitrise", "connaissance", "competence", "experience", "requis", "exige",
  "notion", "formation", "diplome", "solide", "background", "capacite",
  "appetence", "sensibilite", "pratique",
];

const BLOQUEURS_ADMIN = [
  "habilitation de securite", "habilitation", "secret defense",
  "nationalite francaise", "enquete administrative", "etre de nationalite",
];
const PLAFOND_ADMIN = 55;

const DISPONIBILITE = "2027-03-29";
const DATE_INCOMPATIBLE_MALUS = -10.0;
const DATE_COMPATIBLE_BONUS = 3.0;

/** Compétences réellement confirmées — copie de `faits.COMPETENCES_CONFIRMEES`. */
const COMPETENCES_CONFIRMEES = [
  "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Express",
  "Java", "Kotlin", "SQL", "MySQL", "PostgreSQL", "SQLite", "HTML", "CSS",
  "Tailwind CSS", "Power BI", "Power Query", "DAX", "Pandas", "Matplotlib", "Excel",
  "Git", "GitHub", "Linux", "API REST", "JWT", "Chart.js",
  "Agile/Scrum", "Vitest", "JSON",
];

const COMPETENCE_MALUS = -3.0;
const COMPETENCE_PLAFOND = -9.0;

/** Termes techniques hors référentiel — copie de `scoring.TECH_HORS_PROFIL`. */
const TECH_HORS_PROFIL: [string, string][] = [
  ["C++", "(?<![a-z0-9])c\\+\\+(?![a-z0-9])"],
  ["C#", "(?<![a-z0-9])c#"],
  [".NET", "\\.net\\b"],
  ["Vue.js", "(?<![a-z0-9])vue(?:\\.?js)?(?![a-z0-9])"],
  ["Angular", "(?<![a-z0-9])angular(?![a-z0-9])"],
  ["Kubernetes", "(?<![a-z0-9])(?:kubernetes|k8s)(?![a-z0-9])"],
  ["GitLab", "(?<![a-z0-9])gitlab(?![a-z0-9])"],
  ["Spark", "(?<![a-z0-9])spark(?![a-z0-9])"],
  ["AWS", "(?<![a-z0-9])aws(?![a-z0-9])"],
  ["Azure", "(?<![a-z0-9])azure(?![a-z0-9])"],
  ["GCP", "(?<![a-z0-9])(?:gcp|google cloud)(?![a-z0-9])"],
  ["Scala", "(?<![a-z0-9])scala(?![a-z0-9])"],
  ["Rust", "(?<![a-z0-9])rust(?![a-z0-9])"],
  ["Django", "(?<![a-z0-9])django(?![a-z0-9])"],
  ["Flask", "(?<![a-z0-9])flask(?![a-z0-9])"],
  ["FastAPI", "(?<![a-z0-9])fastapi(?![a-z0-9])"],
  ["Spring", "(?<![a-z0-9])spring(?:\\s*boot)?(?![a-z0-9])"],
  ["MongoDB", "(?<![a-z0-9])mongo(?:db)?(?![a-z0-9])"],
  ["Oracle", "(?<![a-z0-9])oracle(?![a-z0-9])"],
  ["GraphQL", "(?<![a-z0-9])graphql(?![a-z0-9])"],
  ["NumPy", "(?<![a-z0-9])numpy(?![a-z0-9])"],
  ["Airflow", "(?<![a-z0-9])airflow(?![a-z0-9])"],
  ["dbt", "(?<![a-z0-9])dbt(?![a-z0-9])"],
  ["Qlik", "(?<![a-z0-9])qlik(?![a-z0-9])"],
  ["VBA", "(?<![a-z0-9])vba(?![a-z0-9])"],
  ["Terraform", "(?<![a-z0-9])terraform(?![a-z0-9])"],
  ["Ansible", "(?<![a-z0-9])ansible(?![a-z0-9])"],
  ["Jenkins", "(?<![a-z0-9])jenkins(?![a-z0-9])"],
  ["PowerShell", "(?<![a-z0-9])powershell(?![a-z0-9])"],
  ["Bash", "(?<![a-z0-9])bash(?![a-z0-9])"],
  ["UML", "(?<![a-z0-9])uml(?![a-z0-9])"],
  ["MATLAB", "(?<![a-z0-9])matlab(?![a-z0-9])"],
  ["COBOL", "(?<![a-z0-9])cobol(?![a-z0-9])"],
  ["Fortran", "(?<![a-z0-9])fortran(?![a-z0-9])"],
  ["VHDL", "(?<![a-z0-9])vhdl(?![a-z0-9])"],
  ["FPGA", "(?<![a-z0-9])fpga(?![a-z0-9])"],
  ["Assembleur", "(?<![a-z0-9])assembleur(?![a-z0-9])"],
  ["Hadoop", "(?<![a-z0-9])hadoop(?![a-z0-9])"],
  ["Kafka", "(?<![a-z0-9])kafka(?![a-z0-9])"],
  ["Elasticsearch", "(?<![a-z0-9])elasticsearch(?![a-z0-9])"],
  ["Redis", "(?<![a-z0-9])redis(?![a-z0-9])"],
  ["Laravel", "(?<![a-z0-9])laravel(?![a-z0-9])"],
  ["Symfony", "(?<![a-z0-9])symfony(?![a-z0-9])"],
  ["Talend", "(?<![a-z0-9])talend(?![a-z0-9])"],
  ["Snowflake", "(?<![a-z0-9])snowflake(?![a-z0-9])"],
];


/** `round(x, 2)` de Python : égalité vers le pair sur la valeur exacte. */
function arrondi2(x: number): number {
  const y = x * 100;
  const bas = Math.floor(y);
  if (Math.abs(y - bas - 0.5) < 1e-9) return (bas % 2 === 0 ? bas : bas + 1) / 100;
  return Math.round(y) / 100;
}

function signe0(x: number): string {
  const v = format0f(Math.abs(x));
  return x < 0 ? `-${v}` : `+${v}`;
}

function normCompetence(s: string): string {
  const cle = norm(s).trim().replace(/\s+/g, " ");
  return ALIAS_SCORE[cle] ?? cle;
}

function asListe(v: string[] | string | null | undefined): string[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.filter((x) => String(x).trim());
  const s = String(v).trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.filter((x) => String(x).trim()).map(String);
    } catch { /* chaîne non JSON : on retombe sur le découpage */ }
  }
  return s.split(/[,;/|]/).map((x) => x.trim()).filter(Boolean);
}

const PILE_NORM = new Set(PILE_SCORE.map(([k]) => normCompetence(k)));

function texteOffre(o: OffreAEvaluer): string {
  return norm(["title", "education_required", "description", "location", "contract_type"]
    .map((k) => String((o as Record<string, unknown>)[k] ?? "")).join(" "));
}

function scoreTechnique(o: OffreAEvaluer): number {
  const req = new Set(asListe(o.skills_required).map(normCompetence));
  const opt = new Set(asListe(o.skills_optional).map(normCompetence).filter((x) => !req.has(x)));
  if (req.size === 0 && opt.size === 0) return TECH_NEUTRAL_SCORE;
  const reqRatio = req.size ? [...req].filter((x) => PILE_NORM.has(x)).length / req.size : null;
  const optRatio = opt.size ? [...opt].filter((x) => PILE_NORM.has(x)).length / opt.size : null;
  let ratio: number;
  if (reqRatio === null) ratio = optRatio as number;
  else if (optRatio === null) ratio = reqRatio;
  else ratio = REQUIRED_WEIGHT_SCORE * reqRatio + OPTIONAL_WEIGHT_SCORE * optRatio;
  return arrondi2(MAX_SCORE.technical_score * ratio);
}

function scoreEducation(o: OffreAEvaluer): number {
  const edu = norm(o.education_required);
  if (!edu.trim()) return 15.0;
  const niveaux = [...edu.matchAll(/bac\s*\+\s*(\d)/g)].map((m) => Number(m[1]));
  if (edu.includes("doctorat") || edu.includes("phd")) return 0.0;
  const enCours = ["en cours", "preparation", "prepare", "poursuite", "integrer"]
    .some((t) => edu.includes(t));
  let lvl: number;
  if (niveaux.length) lvl = Math.min(...niveaux);
  else if (/\b(licence|bachelor|l3|but)\b/.test(edu)) lvl = 3;
  else if (/\b(master|m1|m2|ingenieur)\b/.test(edu)) lvl = 5;
  else if (/\b(bts|dut|deust)\b/.test(edu)) lvl = 2;
  else return 15.0;
  if (lvl <= 2) return 20.0;
  if (lvl === 3) return 25.0;
  if (enCours || lvl === 4) return 20.0;
  return 8.0;
}

function scoreLieu(o: OffreAEvaluer): number {
  const loc = norm(o.location);
  let best = LIEU_DEFAUT;
  for (const [termes, pts] of LIEUX) {
    if (termes.some((t) => loc.includes(t))) best = Math.max(best, pts);
  }
  if (IDF_DEPT_RE_SCORE.test(loc)) best = Math.max(best, IDF_SCORE);
  if (HAUTE_GARONNE_RE_SCORE.test(loc)) best = Math.max(best, TOULOUSE_SCORE);
  return best;
}

function scoreContrat(o: OffreAEvaluer): number {
  const ct = norm(o.contract_type);
  for (const [termes, pts] of CONTRATS) {
    if (termes.some((t) => new RegExp(`\\b${echapper(t)}\\b`).test(ct))) return pts;
  }
  return 0.0;
}

function scoreMiage(o: OffreAEvaluer): number {
  const texte = texteOffre(o);
  if (o.miage_mentioned || /\bmiage\b/.test(texte)) return 10.0;
  if (MIAGE_TERMES.some((t) => texte.includes(t))) return 5.0;
  return 0.0;
}

function scoreSource(o: OffreAEvaluer): number {
  const cle = norm(o.source).replace(/[\s-]+/g, "_");
  return SOURCES_SCORE[cle] ?? SOURCE_DEFAUT_SCORE;
}

function scoreConfiance(o: OffreAEvaluer): number {
  const champs: (keyof OffreAEvaluer)[] = ["title", "company", "location", "contract_type",
    "education_required", "skills_required", "source"];
  const remplis = champs.filter((f) => {
    const v = o[f];
    if (Array.isArray(v)) return v.length > 0;
    return v !== null && v !== undefined && String(v).trim() !== "";
  }).length;
  return arrondi2(remplis / champs.length);
}

/** Critère 1 — Bac+3 demandé (+7) / Bac+5 exigé (-8), pièges « but » et « Ingénieur » tenus. */
export function niveauDiplome(o: OffreAEvaluer): [number, string] {
  const brut = String(o.education_required ?? "");
  const texte = brut.trim() ? brut : [o.title ?? "", o.description ?? ""].join(" ");
  const edu = norm(texte);
  if (!edu.trim()) return [0.0, "niveau de diplôme : non précisé (0)"];
  const niveaux = [...edu.matchAll(/bac\s*\+\s*(\d)/g)].map((m) => Number(m[1]));
  const cycleIngenieur = /(?:diplome\s+d\W{0,2}ingenieur|cycle\s+ingenieur)/.test(edu);
  let lvl: number;
  if (niveaux.length) lvl = Math.min(...niveaux);   // « Bac+3 à Bac+5 » → 3 ; « Bac+4/5 » → 4
  else if (/\b(l3|licence|bachelor)\b/.test(edu)) lvl = 3;
  else if (cycleIngenieur || /\b(master|m1|m2|msc)\b/.test(edu)) lvl = 5;
  else if (/\b(BTS|DUT|BUT|DEUST)\b/.test(texte)) lvl = 2;   // capitales uniquement
  else return [0.0, "niveau de diplôme : non précisé (0)"];
  if (lvl <= 2) return [0.0, "niveau de diplôme : Bac+2 (0)"];
  if (lvl === 3) return [NIVEAU_BAC3_BONUS, `niveau de diplôme : Bac+3 demandé (${signe0(NIVEAU_BAC3_BONUS)})`];
  if (lvl === 4) return [NIVEAU_BAC5_MALUS, `niveau de diplôme : Bac+4 exigé (${signe0(NIVEAU_BAC5_MALUS)})`];
  return [NIVEAU_BAC5_MALUS, `niveau de diplôme : Bac+5 exigé (${signe0(NIVEAU_BAC5_MALUS)})`];
}

/** Clés normalisées du référentiel (libellés composés éclatés) — `scoring._cles_referentiel`. */
const CONFIRMEES_NORM = new Set<string>(
  COMPETENCES_CONFIRMEES.flatMap((c) => c.split(/[/,()]/).map((p) => p.trim()).filter(Boolean))
    .map((p) => normCompetence(p)),
);

/** La techno est-elle dans le référentiel confirmé de Fanel ? */
export function competenceConfirmee(skill: unknown): boolean {
  return CONFIRMEES_NORM.has(normCompetence(String(skill ?? "")));
}

/** Critère 5 — compétences exigées par l'annonce et absentes du référentiel (-3 chacune, max -9). */
export function competencesHorsProfil(o: OffreAEvaluer): [number, string[]] {
  const trouvees: string[] = [];
  const ajouter = (nom: unknown) => {
    const n = String(nom ?? "").trim();
    if (n && !trouvees.includes(n)) trouvees.push(n);
  };
  for (const champ of [o.skills_required, o.skills_optional]) {
    for (const s of asListe(champ)) {
      if (!competenceConfirmee(s)) ajouter(s);
    }
  }
  const textes: string[] = [norm(o.title)];
  for (const phrase of String(o.description ?? "").split(/[.\n;!?]/)) {
    const p = norm(phrase);
    if (p.trim() && MARQUEURS_EXIGENCE.some((m) => p.includes(m))) textes.push(p);
  }
  for (const [libelle, motif] of TECH_HORS_PROFIL) {
    const re = new RegExp(motif);
    if (textes.some((t) => re.test(t))) ajouter(libelle);
  }
  return [Math.max(COMPETENCE_PLAFOND, COMPETENCE_MALUS * trouvees.length) + 0.0, trouvees];
}

// --- Port de `adapters/base.extract_start_date` (point 5 du 22/10/2026) -------------------------
const MOIS_TEXTE: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8,
  septembre: 9, octobre: 10, novembre: 11, decembre: 12,
  janv: 1, fev: 2, avr: 4, juil: 7, sept: 9, oct: 10, nov: 11, dec: 12,
};
const MOIS_MOTIF = Object.keys(MOIS_TEXTE).sort((a, b) => b.length - a.length).join("|");
const RE_TRIGGER = "(?:a partir d[ue']|a compter d[ue']|des|debut(?:ant|eras|erez|era|ons|ez|er|e)?|"
  + "commencerez|demarrage|prise de poste|a pourvoir|poste a pourvoir|commence(?:ra|ment)?|"
  + "date de debut|disponibilite|start(?:ing)?(?: date)?)";
const RE_LIEN = "(?:\\s+(?:du |de |d')?(?:l')?(?:contrat|mission|alternance|apprentissage|poste))?"
  + "[\\s:,'(]*(?:(?:le|la|du|de|en|au|courant|d'|entre|en date du)\\s+)*";
const PART_JOUR: Record<string, number> = { debut: 1, mi: 15, fin: 25 };
const PART_MOIS: Record<string, number> = { debut: 1, mi: 6, fin: 10 };
const RE_ASAP = new RegExp(RE_TRIGGER + RE_LIEN
  + "(?:des que possible|asap|immediat(?:ement)?|au plus vite|maintenant)", "g");
const RE_JMA = new RegExp(RE_TRIGGER + RE_LIEN + "(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{2,4})", "g");
const RE_MOIS = new RegExp(RE_TRIGGER + RE_LIEN + "(?:(debut|mi|fin)[\\s-]+)?(?:(\\d{1,2})(?:er)?\\s+)?"
  + `(${MOIS_MOTIF})\\.?(?:\\s+(20\\d{2}))?`, "g");
const RE_ANNEE = new RegExp(RE_TRIGGER + RE_LIEN + "(?:(debut|mi|fin)[\\s-]+)?(?:d')?(?:l'annee\\s+)?(20\\d{2})\\b", "g");
const RE_RENTREE = /\brentree(?:\s+(?:de\s+)?septembre)?(?:\s+(20\d{2}))?/g;

/** Date ISO valide ? (équivalent de `datetime.date(...)`, qui lève sur une date impossible). */
function isoValide(annee: number, mois: number, jour: number): string | null {
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return null;
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  if (d.getUTCFullYear() !== annee || d.getUTCMonth() !== mois - 1 || d.getUTCDate() !== jour) return null;
  return `${String(annee).padStart(4, "0")}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

/** `extract_start_date(text, ref)` de `adapters/base.py` : « AAAA-MM-JJ », « asap », ou null. */
export function extraireDateDebut(texte: string, ref: { annee: number; mois: number }): string | null {
  const s = norm(texte);
  if (!s.trim()) return null;
  const trouves: [number, string][] = [];
  for (const m of s.matchAll(RE_JMA)) {
    let annee = Number(m[3]);
    if (annee < 100) annee += 2000;
    const iso = isoValide(annee, Number(m[2]), Number(m[1]));
    if (iso) trouves.push([m.index ?? 0, iso]);
  }
  for (const m of s.matchAll(RE_MOIS)) {
    const mois = MOIS_TEXTE[m[3]];
    const annee = m[4] ? Number(m[4]) : (mois >= ref.mois ? ref.annee : ref.annee + 1);
    const jour = m[2] ? Number(m[2]) : (PART_JOUR[m[1]] ?? 1);
    const iso = isoValide(annee, mois, jour);
    if (iso) trouves.push([m.index ?? 0, iso]);
  }
  for (const m of s.matchAll(RE_ANNEE)) {
    const iso = isoValide(Number(m[2]), PART_MOIS[m[1]] ?? 1, 1);
    if (iso) trouves.push([m.index ?? 0, iso]);
  }
  for (const m of s.matchAll(RE_RENTREE)) {
    const iso = isoValide(m[1] ? Number(m[1]) : ref.annee, 9, 1);
    if (iso) trouves.push([m.index ?? 0, iso]);
  }
  for (const m of s.matchAll(RE_ASAP)) trouves.push([m.index ?? 0, "asap"]);
  if (!trouves.length) return null;
  trouves.sort((a, b) => (a[0] - b[0]) || ((a[1] === "asap" ? 1 : 0) - (b[1] === "asap" ? 1 : 0)));
  return trouves[0][1];
}

/** Date de début relue dans l'annonce quand la colonne `start_date` est vide. */
function dateDebutAnnonce(o: OffreAEvaluer): string | null {
  const aujourdHui = new Date();
  const ref = { annee: aujourdHui.getFullYear(), mois: aujourdHui.getMonth() + 1 };
  const pub = String(o.published_at ?? "").slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(pub);
  if (m) { ref.annee = Number(m[1]); ref.mois = Number(m[2]); }
  const trouvee = extraireDateDebut(String(o.description ?? ""), ref);
  return trouvee && /^\d{4}-\d{2}-\d{2}$/.test(trouvee) ? trouvee : null;
}

export function scoreDates(o: OffreAEvaluer): [number, string] {
  let brut = String(o.start_date ?? "").trim();
  let lueDansAnnonce = false;
  if (!/^\d{4}-\d{2}-\d{2}/.test(brut)) {
    const depuisTexte = dateDebutAnnonce(o);
    if (depuisTexte) { brut = depuisTexte; lueDansAnnonce = true; }
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(brut);
  if (!m) return [0.0, "dates : début inconnu (0)"];
  const jour = `${m[1]}-${m[2]}-${m[3]}`;
  const source = lueDansAnnonce ? " (lu dans l'annonce)" : "";
  if (jour >= DISPONIBILITE) {
    return [DATE_COMPATIBLE_BONUS,
      `début ${brut}${source} : compatible avec une disponibilité fin mars 2027 (${signe0(DATE_COMPATIBLE_BONUS)})`];
  }
  return [DATE_INCOMPATIBLE_MALUS,
    `début ${brut}${source} : incompatible avec une disponibilité fin mars 2027 (${signe0(DATE_INCOMPATIBLE_MALUS)})`];
}

/** Critère 2 — prérequis de domaine hors profil, chacun compté une seule fois. */
export function prerequisMetier(o: OffreAEvaluer): [number, string[]] {
  const titre = norm(o.title);
  const competences = norm([o.skills_required ?? [], o.skills_optional ?? [],
    o.education_required ?? ""].map((v) => (Array.isArray(v) ? skillsCommeEnBase(v) : String(v))).join(" "));
  const description = norm(o.description);
  const phrases = description.split(/[.\n;!?]/).filter((p) => p.trim());
  const occupe: Record<string, [number, number][]> = { titre: [], competences: [], description: [] };
  const zones: ["titre" | "competences" | "description", string[], boolean][] =
    [["titre", [titre], false], ["competences", [competences], false], ["description", phrases, true]];
  const trouves: string[] = [];
  for (const [libelle, variantes] of PREREQUIS_METIER) {
    const motif = new RegExp(`(?<![a-z0-9])(?:${variantes.map(echapper).join("|")})(?![a-z0-9])`, "g");
    let vu = false;
    for (const [zone, textes, filtre] of zones) {
      for (const texte of textes) {
        if (filtre && !MARQUEURS_EXIGENCE.some((m) => texte.includes(m))) continue;
        for (const m of texte.matchAll(motif)) {
          const debut = m.index ?? 0, fin = debut + m[0].length;
          if (occupe[zone].some(([d, f]) => d <= debut && fin <= f)) continue;
          occupe[zone].push([debut, fin]);
          vu = true;
        }
      }
    }
    if (vu) trouves.push(libelle);
  }
  return [PREREQUIS_METIER_MALUS * trouves.length + 0.0, trouves];
}

/** Critère 3 — bloqueurs administratifs (habilitation, secret défense, nationalité…). */
export function bloqueursAdmin(o: OffreAEvaluer): string[] {
  const texte = norm([o.title ?? "", o.description ?? "", o.education_required ?? ""].join(" "));
  return BLOQUEURS_ADMIN.filter((b) => texte.includes(b));
}

/** `score_offer` de `scoring.py` : même total, mêmes arrondis, mêmes lignes de décomposition. */
export function scoreOffre(o: OffreAEvaluer): ResultatScore {
  const technique = scoreTechnique(o);
  const education = scoreEducation(o);
  const lieu = scoreLieu(o);
  const contrat = scoreContrat(o);
  const miage = scoreMiage(o);
  const source = scoreSource(o);
  const base = technique + education + lieu + contrat + miage + source;

  const [niveau, txtNiveau] = niveauDiplome(o);
  const [metier, termes] = prerequisMetier(o);
  const bloqueurs = bloqueursAdmin(o);
  const [dates, txtDates] = scoreDates(o);
  const [competences, comps] = competencesHorsProfil(o);
  const [fin, txtFin] = finScore(o);
  const plafond = bloqueurs.length ? PLAFOND_ADMIN : null;

  let total = base + niveau + metier + dates + competences + fin;
  if (bloqueurs.length) total = Math.min(total, PLAFOND_ADMIN);
  const score = Math.trunc(arrondiPython(Math.min(100.0, Math.max(0.0, total))));

  const txtMetier = termes.length
    ? `prérequis métier hors profil : ${termes.join(", ")} (${signe0(metier)})`
    : "prérequis métier : aucun hors profil (0)";
  const txtCompetences = comps.length === 1
    ? `compétence exigée hors profil : ${comps[0]} (${signe0(competences)})`
    : comps.length
      ? `compétences exigées hors profil : ${comps.join(", ")} (${signe0(competences)})`
      : "compétences exigées : toutes dans le référentiel (0)";
  const raisons = [
    `technique ${technique.toFixed(2)}/35`,
    `diplôme ${format0f(education)}/25`,
    `lieu ${format0f(lieu)}/15`,
    `contrat ${format0f(contrat)}/10`,
    `MIAGE ${format0f(miage)}/10`,
    `source ${format0f(source)}/5`,
    txtNiveau,
    txtMetier,
    txtCompetences,
    txtDates,
    txtFin,
    bloqueurs.length
      ? `⛔ bloqueur administratif : ${bloqueurs[0]} — score plafonné à ${PLAFOND_ADMIN}`
      : "administratif : aucun bloqueur",
    `TOTAL ${score}/100`,
  ];
  const detail = (t: string) => {
    const i = t.indexOf(" : ");
    return i < 0 ? t : t.slice(i + 3);
  };
  const breakdown: LigneScore[] = [
    { critere: "technique", points: technique, max: 35, detail: "compétences de l'offre couvertes par la stack" },
    { critere: "diplôme", points: education, max: 25, detail: "compatibilité Bac+3 MIAGE" },
    { critere: "lieu", points: lieu, max: 15, detail: "Toulouse / IDF / remote" },
    { critere: "contrat", points: contrat, max: 10, detail: "stage / alternance" },
    { critere: "MIAGE", points: miage, max: 10, detail: "MIAGE explicite ou formation compatible" },
    { critere: "source", points: source, max: 5, detail: "qualité de la source" },
    { critere: "niveau de diplôme", points: niveau, max: 8, detail: detail(txtNiveau) },
    { critere: "prérequis métier", points: metier, max: 0, detail: detail(txtMetier) },
    { critere: "compétence hors profil", points: competences, max: 0, detail: detail(txtCompetences) },
    { critere: "dates", points: dates, max: 3, detail: detail(txtDates) },
    { critere: "date de fin", points: fin, max: 0, detail: detail(txtFin) },
  ];
  if (bloqueurs.length) {
    breakdown.push({ critere: "plafond administratif", points: PLAFOND_ADMIN, max: 100,
      detail: `score plafonné à ${PLAFOND_ADMIN} (${bloqueurs[0]})` });
  }
  return {
    technical_score: technique, education_score: education, location_score: lieu,
    contract_score: contrat, miage_score: miage, source_score: source,
    niveau_diplome: niveau + 0.0, prerequis_metier: metier + 0.0,
    competences_hors_profil: competences + 0.0, dates: dates + 0.0, date_de_fin: fin + 0.0,
    bloqueur_admin: bloqueurs.length > 0, plafond, score,
    confidence: scoreConfiance(o), reasons: raisons, breakdown,
  };
}
