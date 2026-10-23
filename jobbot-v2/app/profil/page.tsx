import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CATALOGUE } from "@/lib/scoring";
import { ZONE_LABEL, offers, type Zone } from "@/lib/offers";
import {
  NIVEAU_LABEL,
  PROFIL_DEFAUT,
  RECHERCHE_LABEL,
  classementPour,
  estParDefaut,
  lireProfil,
  type NiveauEtudes,
  type TypeRecherche,
} from "@/lib/profil";
import { enregistrerProfil, reinitialiserProfil } from "./actions";

export const metadata: Metadata = {
  title: "Ton profil — JobBot",
  description:
    "Les compétences que tu confirmes, ta zone et ton niveau : c'est à partir d'eux que chaque offre est notée.",
};

const ZONES: Zone[] = ["toulouse", "idf", "remote", "autre"];
const NIVEAUX: NiveauEtudes[] = ["bac+3", "bac+4", "bac+5"];
const RECHERCHES: TypeRecherche[] = ["stage", "alternance"];

/** Une case à cocher qui ressemble aux puces du reste du site, et qui marche sans JavaScript. */
function Case({
  name,
  value,
  defaultChecked,
  children,
}: {
  name: string;
  value: string;
  defaultChecked: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-soft transition hover:border-ink/40 hover:text-ink has-checked:border-ink has-checked:bg-ink has-checked:font-medium has-checked:text-paper">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
      />
      {/* La case suit l'état : une puce noire portant une case vide se lisait mal. */}
      <span aria-hidden className="opacity-60 group-has-checked:hidden">☐</span>
      <span aria-hidden className="hidden group-has-checked:inline">☑</span>
      {children}
    </label>
  );
}

async function Formulaire({ searchParams }: { searchParams: Promise<{ enregistre?: string; reinitialise?: string }> }) {
  const p = await searchParams;
  const profil = await lireProfil();
  const choisies = new Set(profil.competences);
  const parDefaut = estParDefaut(profil);

  // Ce que le profil change concrètement, dit en chiffres plutôt qu'en promesse.
  const classement = classementPour(profil);
  const notes = [...classement.values()].map((r) => r.total);
  const moyenne = notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length) : 0;
  const auDessusDe65 = notes.filter((n) => n >= 65).length;

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <p className="compteur">Profil</p>
      <h1 className="titre-page mt-3">Ce que tu sais faire</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Chaque offre est notée à partir de cette liste. Rien n&apos;est deviné à ta place :{" "}
        <strong className="font-medium text-ink-soft">
          une compétence que tu n&apos;as pas cochée ne compte jamais
        </strong>
        , même si ton CV la mentionne.
      </p>

      {p.enregistre ? (
        <p className="mt-6 rounded-card border border-good/30 bg-good-soft px-4 py-3 text-sm text-good">
          Profil enregistré. Les {offers.length} offres viennent d&apos;être renotées.
        </p>
      ) : null}
      {p.reinitialise ? (
        <p className="mt-6 rounded-card border border-line bg-paper-deep px-4 py-3 text-sm text-ink-soft">
          Profil remis à son réglage de départ, et le cookie effacé.
        </p>
      ) : null}

      <div className="card mt-6 p-5">
        <p className="text-sm text-ink-soft">
          Avec ce profil : note moyenne{" "}
          <strong className="num font-semibold text-ink">{moyenne}</strong> sur les{" "}
          <span className="num">{offers.length}</span> offres, dont{" "}
          <strong className="num font-semibold text-ink">{auDessusDe65}</strong> au-dessus de 65.
          {parDefaut ? (
            <span className="text-muted"> C&apos;est encore le réglage de départ.</span>
          ) : null}
        </p>
      </div>

      <form action={enregistrerProfil} className="mt-10 space-y-10">
        <section>
          <h2 className="label">Compétences confirmées</h2>
          <p className="mt-2 text-sm text-muted">
            Coche ce que tu sais utiliser aujourd&apos;hui. Décoche ce qui n&apos;est pas vrai — une
            liste trop généreuse donne des notes flatteuses et des candidatures perdues.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {CATALOGUE.map((c) => (
              <Case key={c.nom} name="competence" value={c.nom} defaultChecked={choisies.has(c.nom)}>
                {c.nom}
              </Case>
            ))}
          </div>
        </section>

        <section>
          <h2 className="label">Où tu cherches</h2>
          <p className="mt-2 text-sm text-muted">
            Sans aucune case cochée, toutes les zones sont acceptées.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {ZONES.map((z) => (
              <Case key={z} name="zone" value={z} defaultChecked={profil.zones.includes(z)}>
                {ZONE_LABEL[z]}
              </Case>
            ))}
          </div>
        </section>

        <section>
          <h2 className="label">Ce que tu cherches</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {RECHERCHES.map((r) => (
              <Case key={r} name="recherche" value={r} defaultChecked={profil.recherche.includes(r)}>
                {RECHERCHE_LABEL[r]}
              </Case>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            L&apos;alternance est aujourd&apos;hui exclue de la collecte, volontairement, jusqu&apos;en
            janvier 2027. La cocher ne fera donc rien apparaître pour l&apos;instant.
          </p>
        </section>

        <section>
          <h2 className="label">Ton niveau</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {NIVEAUX.map((n) => (
              <label
                key={n}
                className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-soft transition hover:border-ink/40 hover:text-ink has-checked:border-ink has-checked:bg-ink has-checked:font-medium has-checked:text-paper"
              >
                <input
                  type="radio"
                  name="niveau"
                  value={n}
                  defaultChecked={profil.niveau === n}
                  className="sr-only"
                />
                {NIVEAU_LABEL[n]}
              </label>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <button type="submit" className="bouton-plein px-5 py-3 text-sm font-medium">
            Enregistrer et renoter les offres
          </button>
          <Link href="/offres" className="lien-anime py-3 text-sm font-medium text-accent">
            Voir la liste
          </Link>
        </div>
      </form>

      <form action={reinitialiserProfil} className="mt-10 border-t border-line pt-6">
        <h2 className="label">Tes données</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Ce profil vit dans un <strong className="font-medium text-ink-soft">cookie</strong> sur
          ton navigateur, en clair et lisible. Il ne part sur aucun serveur, il n&apos;est associé à
          aucun compte, et aucun CV n&apos;est stocké à ce stade. Ce bouton l&apos;efface pour de
          bon.
        </p>
        <button type="submit" className="bouton-vide mt-4 px-4 py-2.5 text-sm font-medium">
          Effacer mon profil
        </button>
      </form>

      <p className="mt-10 text-xs leading-relaxed text-muted">
        Le profil de départ reprend celui du pipeline ({PROFIL_DEFAUT.competences.length}{" "}
        compétences). Tant que tu n&apos;y touches pas, les notes affichées sont exactement celles
        que le moteur Python calcule — c&apos;est ce qui rend ce réglage sans risque.
      </p>
    </div>
  );
}

function Squelette() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12" aria-hidden>
      <div className="h-3 w-20 rounded bg-paper-deep" />
      <div className="mt-4 h-10 w-80 max-w-full rounded bg-paper-deep" />
      <div className="mt-6 h-20 rounded-card bg-paper-deep/70" />
    </div>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ enregistre?: string; reinitialise?: string }>;
}) {
  return (
    <Suspense fallback={<Squelette />}>
      <Formulaire searchParams={searchParams} />
    </Suspense>
  );
}
