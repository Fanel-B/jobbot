import { Suspense } from "react";
import Link from "next/link";
import { OfferRow } from "@/components/OfferCard";
import {
  offresAvecContrat,
  offresSansContrat,
  sourceLabel,
  ZONE_LABEL,
  type Offer,
  type Zone,
} from "@/lib/offers";

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

  const type = (p.type ?? "tous").toLowerCase();
  if (type === "stage") out = out.filter((o) => (o.contract_kinds ?? []).includes("stage"));
  if (type === "alternance") {
    out = out.filter((o) =>
      (o.contract_kinds ?? []).some((k) => k === "alternance" || k === "apprentissage"),
    );
  }
  // Les offres dont la source ne donne pas le type de contrat : un bloc à part, jamais mélangé.
  if (type === "non-renseigne") out = out.filter((o) => !o.contract_known);

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

function Filtre({ actif, href, children }: { actif: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        actif
          ? "border-ink bg-ink text-paper"
          : "border-line bg-surface text-ink-soft hover:border-line-strong"
      }`}
    >
      {children}
    </Link>
  );
}

async function Liste({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const toutes = [...offresAvecContrat, ...offresSansContrat];
  const liste = filtrer(toutes, p);
  const vues = liste.slice(0, 120);

  const sources = [...new Set(offresAvecContrat.map((o) => o.source))].sort();
  const nonRenseigne = (p.type ?? "").toLowerCase() === "non-renseigne";
  const nbNonRenseigne = offresSansContrat.length;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="font-display text-4xl leading-tight">
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
            {liste.length} offre{liste.length > 1 ? "s" : ""} correspondant à ces filtres. Le
            classement par défaut est la note calculée pour ton profil — le détail est sur chaque
            offre.
          </>
        )}
      </p>

      {/* Filtres : de vrais liens, donc partageables et sans JavaScript. */}
      <div className="mt-7 space-y-3 border-y border-line py-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted">Lieu</span>
          <Filtre actif={!p.zone} href={lien({ ...p, zone: undefined })}>
            Partout
          </Filtre>
          {ZONES.map((z) => (
            <Filtre key={z} actif={p.zone === z} href={lien({ ...p, zone: z })}>
              {ZONE_LABEL[z]}
            </Filtre>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted">Contrat</span>
          <Filtre actif={!p.type || p.type === "tous"} href={lien({ ...p, type: undefined })}>
            Tous
          </Filtre>
          <Filtre actif={p.type === "stage"} href={lien({ ...p, type: "stage" })}>
            Stage
          </Filtre>
          <Filtre actif={p.type === "alternance"} href={lien({ ...p, type: "alternance" })}>
            Alternance
          </Filtre>
          <Filtre actif={nonRenseigne} href={lien({ ...p, type: "non-renseigne" })}>
            Type non renseigné ({nbNonRenseigne})
          </Filtre>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted">Source</span>
          <Filtre actif={!p.source} href={lien({ ...p, source: undefined })}>
            Toutes
          </Filtre>
          {sources.map((s) => (
            <Filtre key={s} actif={p.source === s} href={lien({ ...p, source: s })}>
              {sourceLabel(s)}
            </Filtre>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted">Tri</span>
          <Filtre actif={(p.tri ?? "score") === "score"} href={lien({ ...p, tri: "score" })}>
            Note
          </Filtre>
          <Filtre actif={p.tri === "date"} href={lien({ ...p, tri: "date" })}>
            Date de publication
          </Filtre>
          <span className="mx-1 h-4 w-px bg-line" />
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted">
            Note mini
          </span>
          {[0, 60, 70, 80].map((m) => (
            <Filtre key={m} actif={(p.min ?? "0") === String(m)} href={lien({ ...p, min: m ? String(m) : undefined })}>
              {m === 0 ? "Toutes" : `${m}+`}
            </Filtre>
          ))}
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
        <p className="py-16 text-center text-sm text-muted">
          Aucune offre ne correspond à ces filtres.{" "}
          <Link href="/offres" className="text-accent underline">
            Réinitialiser
          </Link>
        </p>
      ) : (
        <div className="mt-6 card overflow-hidden">
          {vues.map((o, i) => (
            <OfferRow key={o.id} offre={o} rang={i + 1} />
          ))}
        </div>
      )}

      {liste.length > vues.length ? (
        <p className="mt-4 text-center text-xs text-muted">
          {vues.length} offres affichées sur {liste.length} — affine les filtres pour voir le reste.
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
