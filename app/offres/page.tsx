import { Suspense } from "react";
import Link from "next/link";
import { OfferRow } from "@/components/OfferCard";
import {
  compterFamilles,
  filtrerParContrat,
  sourceLabel,
  ZONE_LABEL,
  type Offer,
  type Zone,
} from "@/lib/offers";
import { estParDefaut, lireProfil, offresPour } from "@/lib/profil";

type Params = {
  zone?: string;
  type?: string;
  source?: string;
  tri?: string;
  min?: string;
};

const ZONES: Zone[] = ["toulouse", "idf", "remote", "autre"];

function filtrer(offres: Offer[], p: Params): Offer[] {
  let out = offres;

  if (p.zone && ZONES.includes(p.zone as Zone)) {
    out = out.filter((o) => o.location_zone === p.zone);
  }

  // Une seule porte d'entrée pour le contrat : les familles sont exclusives et couvrent tout,
  // donc aucune annonce ne peut échapper à l'ensemble des filtres (cf. lib/offers.ts).
  out = filtrerParContrat(out, p.type);

  if (p.source) out = out.filter((o) => o.source === p.source);

  const min = Number(p.min ?? "");
  if (!Number.isNaN(min) && p.min) out = out.filter((o) => (o.score ?? 0) >= min);

  const tri = p.tri ?? "score";
  out = [...out].sort((a, b) =>
    tri === "date"
      ? Date.parse(b.published_at ?? b.first_seen_at ?? "") -
        Date.parse(a.published_at ?? a.first_seen_at ?? "")
      : (b.score ?? 0) - (a.score ?? 0),
  );

  return out;
}

function lien(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `/offres?${s}` : "/offres";
}

/** Une rangée de la barre : son libellé à gauche, ses choix à droite, toujours au même endroit. */
function Groupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-2 border-b border-line px-5 py-3.5 last:border-b-0 sm:grid-cols-[6.5rem_1fr] sm:items-center">
      <span className="label">{titre}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Filtre({ actif, href, children }: { actif: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-[6px] border px-3 py-1.5 text-xs transition ${
        actif
          ? "border-ink bg-ink font-medium text-paper"
          : "border-line bg-surface text-ink-soft hover:border-ink/40 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

async function Liste({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;

  // Le classement est celui du profil en cours, recalculé à la lecture — jamais stocké.
  // C'est la règle du cahier de route : deux personnes voient la même offre, pas la même note.
  const profil = await lireProfil();
  const notees = offresPour(profil);
  const offresAvecContrat = notees.filter((o) => o.contract_known);
  const offresSansContrat = notees.filter((o) => !o.contract_known);
  const toutes = [...offresAvecContrat, ...offresSansContrat];
  const liste = filtrer(toutes, p);
  const vues = liste.slice(0, 120);

  const sources = [...new Set(offresAvecContrat.map((o) => o.source))].sort();
  const nonRenseigne = (p.type ?? "").toLowerCase() === "non-renseigne";

  // Les comptes affichés sur les filtres de contrat tiennent compte du lieu, de la source et de
  // la note mini déjà choisis : un compte global mentirait dès qu'un autre filtre est actif.
  const comptes = compterFamilles(filtrer(toutes, { ...p, type: undefined }));
  // Le compte sur l'ensemble de la collecte, lui, sert à distinguer « ce filtre-ci ne donne
  // rien » de « cette collecte ne contient aucune offre de ce type ».
  const comptesCollecte = compterFamilles(toutes);

  // Comptes par zone et par source, calculés sans le filtre qu'ils annoncent : une puce
  // doit dire combien d'offres elle donnerait, pas combien il y en a en tout.
  const baseZone = filtrer(toutes, { ...p, zone: undefined });
  const comptesZone = Object.fromEntries(
    ZONES.map((z) => [z, baseZone.filter((o) => o.location_zone === z).length]),
  ) as Record<Zone, number>;
  const baseSource = filtrer(toutes, { ...p, source: undefined });
  const comptesSource = baseSource.reduce<Record<string, number>>((acc, o) => {
    acc[o.source] = (acc[o.source] ?? 0) + 1;
    return acc;
  }, {});
  const filtresActifs = [p.zone, p.type, p.source, p.min, p.tri].filter(Boolean).length;
  const nbNonRenseigne = comptes["non-renseigne"];
  const alternanceVide = (p.type ?? "").toLowerCase() === "alternance" && comptesCollecte.alternance === 0;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="titre-page">
        {nonRenseigne ? "Offres sans type de contrat renseigné" : "Les offres du moment"}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        {nonRenseigne ? (
          <>
            Ces annonces proviennent de sources qui ne publient pas le type de contrat. Elles sont
            affichées <strong className="font-medium text-ink-soft">telles quelles</strong>, jamais
            mélangées aux stages, et à vérifier avant de postuler.
          </>
        ) : (
          <>
            Classement calculé pour {estParDefaut(profil) ? "le profil de départ" : "ton profil"} —{" "}
            <span className="num">{profil.competences.length}</span> compétences confirmées.{" "}
            <Link href="/profil" className="lien-anime text-accent">
              {estParDefaut(profil) ? "Règle ton profil" : "Le modifier"}
            </Link>
            . Chaque offre montre son bulletin, critère par critère.
          </>
        )}
      </p>

      {/* Filtres : de vrais liens, donc partageables et utilisables sans JavaScript.
          Une rangée par critère, libellé toujours à la même place : on balaie la colonne
          de gauche pour trouver le réglage, au lieu de chercher dans une grappe de puces. */}
      <div className="card mt-7 overflow-hidden">
        <Groupe titre="Lieu">
          <Filtre actif={!p.zone} href={lien({ ...p, zone: undefined })}>
            Partout
          </Filtre>
          {ZONES.map((z) => (
            <Filtre key={z} actif={p.zone === z} href={lien({ ...p, zone: z })}>
              {ZONE_LABEL[z]}
              <span className={`num ${p.zone === z ? "text-paper/60" : "text-muted"}`}>
                {comptesZone[z]}
              </span>
            </Filtre>
          ))}
        </Groupe>

        <Groupe titre="Contrat">
          <Filtre actif={!p.type || p.type === "tous"} href={lien({ ...p, type: undefined })}>
            Tous
          </Filtre>
          <Filtre actif={p.type === "stage"} href={lien({ ...p, type: "stage" })}>
            Stage
            <span className={`num ${p.type === "stage" ? "text-paper/60" : "text-muted"}`}>
              {comptes.stage}
            </span>
          </Filtre>
          <Filtre actif={p.type === "alternance"} href={lien({ ...p, type: "alternance" })}>
            Alternance
            <span className={`num ${p.type === "alternance" ? "text-paper/60" : "text-muted"}`}>
              {comptes.alternance}
            </span>
          </Filtre>
          {/* « Autre » n'apparaît que s'il y a vraiment un type renseigné hors stage et
              alternance : un filtre vide en permanence serait du bruit. */}
          {comptes.autre > 0 ? (
            <Filtre actif={p.type === "autre"} href={lien({ ...p, type: "autre" })}>
              Autre type
              <span className={`num ${p.type === "autre" ? "text-paper/60" : "text-muted"}`}>
                {comptes.autre}
              </span>
            </Filtre>
          ) : null}
          <Filtre actif={nonRenseigne} href={lien({ ...p, type: "non-renseigne" })}>
            Non renseigné
            <span className={`num ${nonRenseigne ? "text-paper/60" : "text-muted"}`}>
              {nbNonRenseigne}
            </span>
          </Filtre>
        </Groupe>

        <Groupe titre="Source">
          <Filtre actif={!p.source} href={lien({ ...p, source: undefined })}>
            Toutes
          </Filtre>
          {sources.map((s) => (
            <Filtre key={s} actif={p.source === s} href={lien({ ...p, source: s })}>
              {sourceLabel(s)}
              <span className={`num ${p.source === s ? "text-paper/60" : "text-muted"}`}>
                {comptesSource[s] ?? 0}
              </span>
            </Filtre>
          ))}
        </Groupe>

        <Groupe titre="Classement">
          <Filtre actif={(p.tri ?? "score") === "score"} href={lien({ ...p, tri: undefined })}>
            Par note
          </Filtre>
          <Filtre actif={p.tri === "date"} href={lien({ ...p, tri: "date" })}>
            Par date de publication
          </Filtre>
        </Groupe>

        <Groupe titre="Note minimale">
          {[0, 50, 60, 70].map((m) => (
            <Filtre
              key={m}
              actif={(p.min ?? "0") === String(m)}
              href={lien({ ...p, min: m ? String(m) : undefined })}
            >
              {m === 0 ? "Aucune" : `${m} et plus`}
            </Filtre>
          ))}
        </Groupe>

        {/* Le résultat se lit au pied des réglages, là où on vient de cliquer. */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-paper-deep/60 px-5 py-3">
          <p className="text-sm text-ink-soft">
            <span className="num font-semibold text-ink">{liste.length}</span> offre
            {liste.length > 1 ? "s" : ""}
            {liste.length > vues.length ? (
              <span className="text-muted">
                {" "}
                · <span className="num">{vues.length}</span> affichées
              </span>
            ) : null}
            {filtresActifs > 0 ? (
              <span className="text-muted">
                {" "}
                · {filtresActifs} filtre{filtresActifs > 1 ? "s" : ""} actif
                {filtresActifs > 1 ? "s" : ""}
              </span>
            ) : null}
          </p>
          {filtresActifs > 0 ? (
            <Link href="/offres" className="text-xs text-accent underline underline-offset-2">
              Tout réinitialiser
            </Link>
          ) : null}
        </div>
      </div>

      {nonRenseigne ? (
        <div className="mt-6 rounded-card border border-dashed border-line-strong bg-paper-deep/60 p-5">
          <p className="text-sm font-medium text-ink">Pourquoi ces offres sont ici</p>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">
            La source ne dit pas s&apos;il s&apos;agit d&apos;un stage, d&apos;une alternance ou
            d&apos;un poste confirmé. JobBot ne le devine pas et ne l&apos;invente pas : la colonne
            reste vide, l&apos;offre porte le badge <em>Type de contrat non renseigné</em>, et elle
            n&apos;entre pas dans le classement principal. Ouvre l&apos;annonce d&apos;origine avant
            de perdre du temps dessus.
          </p>
        </div>
      ) : null}

      {vues.length === 0 ? (
        <div className="py-16 text-center">
          {alternanceVide ? (
            /* Une liste vide sans explication laisse croire à une panne. Ici l'absence est une
               décision, documentée côté pipeline (reference/eligibility.py) — on la dit. */
            <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted">
              Aucune offre d&apos;alternance dans cette collecte, et ce n&apos;est pas un défaut
              d&apos;affichage : la recherche d&apos;alternance est{" "}
              <strong className="font-medium text-ink-soft">volontairement en pause</strong>. La L3
              se termine par un stage ; l&apos;alternance reprend en janvier 2027, pour la M1/M2.
              Le pipeline met ces annonces de côté jusque-là et pourra les réintégrer sans rien
              recollecter.
            </p>
          ) : (
            <p className="text-sm text-muted">Aucune offre ne correspond à ces filtres.</p>
          )}
          <p className="mt-4 text-sm">
            <Link href="/offres" className="text-accent underline">
              Réinitialiser les filtres
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-6 card overflow-hidden">
          {vues.map((o, i) => (
            <OfferRow key={o.id} offre={o} rang={i + 1} />
          ))}
        </div>
      )}

      {liste.length > vues.length ? (
        <p className="mt-4 text-center text-xs text-muted">
          Les {vues.length} premières sur {liste.length} — affine les filtres pour voir le reste.
        </p>
      ) : null}

      {!nonRenseigne && nbNonRenseigne > 0 ? (
        <p className="mt-8 text-sm text-muted">
          {nbNonRenseigne} autres annonces n&apos;indiquent pas leur type de contrat.{" "}
          <Link href="/offres?type=non-renseigne" className="text-accent underline">
            Les voir séparément
          </Link>
          .
        </p>
      ) : null}

    </div>
  );
}

/** Squelette affiché pendant le filtrage : même silhouette, pour ne pas faire sauter la page. */
function Squelette() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10" aria-hidden>
      <div className="h-9 w-64 rounded-md bg-paper-deep" />
      <div className="mt-3 h-4 w-96 rounded bg-paper-deep/70" />
      <div className="mt-7 h-28 rounded-card border border-line bg-paper-deep/40" />
      <div className="card mt-6 divide-y divide-line overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-start gap-5 px-5 py-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-paper-deep" />
              <div className="h-3 w-1/3 rounded bg-paper-deep/70" />
              <div className="h-3 w-1/2 rounded bg-paper-deep/50" />
            </div>
            <div className="h-11 w-14 rounded-xl bg-paper-deep" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    <Suspense fallback={<Squelette />}>
      <Liste searchParams={searchParams} />
    </Suspense>
  );
}
