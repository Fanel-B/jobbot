import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Bulletin } from "@/components/Bulletin";
import { Simulant, SimulantSquelette } from "@/components/Simulant";
import { NoteDuProfil, NoteSquelette } from "@/components/NoteDuProfil";
import { ScoreBadge } from "@/components/ScoreBadge";
import {
  ContractChip,
  FreshnessChip,
  InfoChip,
  SourceChip,
  TrainingChip,
  ZoneChip,
} from "@/components/Chips";
import {
  contratLabel,
  dateCourte,
  estNonRenseigne,
  fraicheur,
  offers,
  parId,
  signalFormationCitable,
  sourceLabel,
} from "@/lib/offers";

export function generateStaticParams() {
  return offers.map((o) => ({ id: String(o.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const offre = parId(id);
  if (!offre) return { title: "Offre introuvable - JobBot" };
  return {
    title: `${offre.title ?? "Offre"} - ${offre.company ?? "JobBot"}`,
    description: (offre.description ?? "").slice(0, 155) || undefined,
  };
}

/**
 * « Non précisé » plutôt qu'une valeur inventée : la règle vaut pour tous les champs.
 *
 * L'accord suit le mot : « Durée non précisée », « Niveau non précisé ». Le libellé est déjà
 * au-dessus dans la liste de définitions, donc on n'affiche que la mention — la répéter donnait
 * « Durée · Durée non précisé par l'annonce ».
 */
function NonPrecise({ genre = "m" }: { genre?: "m" | "f" }) {
  return (
    <span className="italic text-muted">
      non précisé{genre === "f" ? "e" : ""} par l&apos;annonce
    </span>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // Next 16 : `searchParams` est une Promise, et doit être lue dans un composant enveloppé
  // de <Suspense> — sinon le pré-rendu échoue (« blocking-prerender-dynamic »).
  searchParams: Promise<{ simule?: string }>;
}) {
  const { id } = await params;
  const offre = parId(id);
  if (!offre) notFound();

  const exigences = offre.skills?.required ?? [];
  const manquants = new Set((offre.skills?.missing ?? []).map((m) => m.toLowerCase()));
  const cvRecommande = estNonRenseigne(offre)
    ? "À définir après lecture de l'annonce d'origine"
    : (offre.contract_kinds ?? []).includes("stage")
      ? "CV Stage"
      : "CV Alternance";

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/offres" className="text-sm text-muted hover:text-ink">
        ← Toutes les offres
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.35fr_1fr]">
        {/* --------------------------------------------------------------- colonne */}
        <div className="min-w-0">
          <h1 className="titre-page">
            {offre.title ?? "Intitulé non communiqué"}
          </h1>
          <p className="mt-3 text-base text-ink-soft">
            <span className="font-medium text-ink">
              {offre.company ?? "Entreprise non communiquée"}
            </span>
            <span className="text-muted"> · {offre.location ?? "lieu non précisé"}</span>
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <ContractChip offre={offre} />
            <SourceChip source={offre.source} />
            <ZoneChip zone={offre.location_zone} />
            {signalFormationCitable(offre) ? <TrainingChip /> : null}
            <FreshnessChip offre={offre} />
            {offre.miage_mentioned ? <InfoChip>MIAGE mentionné</InfoChip> : null}
          </div>

          {estNonRenseigne(offre) ? (
            <div className="mt-6 rounded-card border border-dashed border-line-strong bg-paper-deep/60 p-5">
              <p className="text-sm font-medium">Type de contrat non renseigné par la source</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                JobBot ne devine pas ce que la source ne dit pas. Cette annonce peut être un stage,
                une alternance ou un poste confirmé : vérifie sur l&apos;annonce d&apos;origine avant
                d&apos;y consacrer du temps. Elle n&apos;entre pas dans le classement principal.
              </p>
            </div>
          ) : null}

          {/* Jamais d'accusation sans citation : le bloc n'existe que si l'extrait existe. */}
          {signalFormationCitable(offre) ? (
            <div className="mt-6 rounded-card border border-warn/30 bg-warn-soft p-5">
              <p className="text-sm font-medium text-warn">
                ⚠ Offre à vérifier, signaux d&apos;un organisme de formation
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Cette annonce contient des formulations typiques d&apos;une école ou d&apos;un CFA
                qui recrute pour son propre compte. Aucune accusation : voici l&apos;extrait exact
                qui a déclenché le signal.
              </p>
              <blockquote className="mt-3 border-l-2 border-warn/40 pl-3 text-sm italic text-ink-soft">
                {offre.training_excerpt}
              </blockquote>
            </div>
          ) : null}

          {/* Détails concrets */}
          <section className="mt-8">
            <h2 className="label">
              Ce que dit l&apos;annonce
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted">Type de contrat</dt>
                <dd className="mt-1 text-sm">{contratLabel(offre)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Durée</dt>
                <dd className="mt-1 text-sm">
                  {offre.duration ? offre.duration : <NonPrecise genre="f" />}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Début</dt>
                <dd className="mt-1 text-sm">
                  {offre.start_date ? offre.start_date : <NonPrecise genre="f" />}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Niveau demandé</dt>
                <dd className="mt-1 text-sm">
                  {offre.education_required ? (
                    offre.education_required
                  ) : (
                    <NonPrecise />
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Publiée</dt>
                <dd className="mt-1 text-sm">{dateCourte(offre.published_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Vue pour la dernière fois</dt>
                <dd className="mt-1 text-sm">{fraicheur(offre)}</dd>
              </div>
            </dl>
          </section>

          {/* Compétences */}
          {exigences.length > 0 ? (
            <section className="mt-9">
              <h2 className="label">
                Ce que l&apos;offre demande, face à ton profil
              </h2>
              <ul className="mt-4 space-y-2">
                {exigences.map((e) => {
                  const manque = manquants.has(e.toLowerCase());
                  return (
                    /* Un filet vertical plutôt qu'une pastille cochée : la petite coche verte
                       dans un carré est le motif de liste le plus vu, et la couleur n'y porte
                       jamais seule l'information — le texte dit déjà lequel manque. */
                    <li key={e} className="flex items-start gap-3.5 text-sm">
                      <span
                        className={`mt-1 h-4 w-0.5 shrink-0 rounded-sm ${
                          manque ? "bg-bad" : "bg-good"
                        }`}
                        aria-hidden
                      />
                      <span className={manque ? "text-ink-soft" : "text-ink"}>
                        {e}
                        {manque ? (
                          <span className="text-muted">
                            {" "}
                            · demandé, absent de ton profil aujourd&apos;hui
                          </span>
                        ) : (
                          <span className="text-muted"> · déjà dans ton profil</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {manquants.size > 0 ? (
                <p className="mt-4 text-xs text-muted">
                  Ces cases ne sont pas éliminatoires : elles servent à savoir ce qu&apos;il faut
                  travailler avant de postuler, et à choisir les offres où l&apos;écart est le plus
                  faible.
                </p>
              ) : null}
            </section>
          ) : null}

          {/* Le simulant : « et si j'apprenais X ? » */}
          <Suspense fallback={<SimulantSquelette />}>
            <Simulant offreId={offre.id} searchParams={searchParams} />
          </Suspense>

          {/* Description réelle */}
          <section className="mt-9">
            <h2 className="label">
              L&apos;annonce
            </h2>
            {offre.description ? (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                {offre.description}
              </p>
            ) : (
              <p className="mt-4 rounded-card border border-line bg-paper-deep/50 p-4 text-sm text-muted">
                La source ne fournit pas le texte de cette annonce. JobBot ne le reconstitue pas,
                ouvre l&apos;annonce d&apos;origine pour la lire en entier.
              </p>
            )}
          </section>
        </div>

        {/* ------------------------------------------------------------- latéral */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            {/* La note vient du profil en cours, comme dans la liste. Les deux ne doivent
                jamais diverger : afficher ici un chiffre calculé autrement serait le genre de
                contradiction qu'un ami repère en trente secondes. */}
            <Suspense fallback={<NoteSquelette />}>
              <NoteDuProfil offreId={offre.id} />
            </Suspense>

            <div className="mt-6 border-t border-line pt-5">
              <p className="label">Version de CV conseillée</p>
              <p className="mt-1 text-sm font-medium">{cvRecommande}</p>
              <p className="mt-1 text-xs text-muted">
                Décidée par le type de contrat de l&apos;offre, pas par une impression.
              </p>
            </div>

            {offre.canonical_url ? (
              <a
                href={offre.canonical_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 block rounded-lg bg-ink px-4 py-3 text-center text-sm font-medium text-paper transition hover:bg-ink-soft"
              >
                Ouvrir l&apos;annonce d&apos;origine ↗
              </a>
            ) : (
              <p className="mt-6 text-xs text-muted">
                Lien d&apos;origine absent : cette offre n&apos;aurait pas dû être affichée sans.
              </p>
            )}

            <dl className="mt-6 space-y-2 border-t border-line pt-5 text-xs text-muted">
              <div className="flex justify-between gap-3">
                <dt>Source</dt>
                <dd className="text-right text-ink-soft">{sourceLabel(offre.source)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Identifiant source</dt>
                <dd className="num max-w-[11rem] truncate text-right text-ink-soft">
                  {offre.source_offer_id ?? "non communiqué"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Ajoutée à JobBot</dt>
                <dd className="text-right text-ink-soft">{dateCourte(offre.first_seen_at)}</dd>
              </div>
            </dl>
          </div>

          <p className="mt-4 px-1 text-xs leading-relaxed text-muted">
            Le lien vers l&apos;annonce d&apos;origine est obligatoire : JobBot t&apos;envoie vers
            l&apos;employeur, il ne recopie pas son annonce.
          </p>
        </aside>
      </div>
    </div>
  );
}
