import Link from "next/link";
import { ScoreBadge } from "@/components/ScoreBadge";
import type { Rang } from "@/lib/classement";
import {
  ContractChip,
  FreshnessChip,
  SourceChip,
  TrainingChip,
  ZoneChip,
} from "@/components/Chips";
import { contratLabel, estNonRenseigne, signalFormationCitable } from "@/lib/offers";
import type { Offer } from "@/lib/offers";

/**
 * Une ligne d'offre : dense, scannable, tout ce qui décide est visible sans cliquer.
 *
 * `sansNote` sert aux visiteurs qui n'ont pas encore de profil. Une note calculée sur un profil
 * vide est un chiffre exact et un renseignement faux : elle dit « 12/100 » quand la vérité est
 * « on ne sait pas encore ». Dans ce cas la pastille disparaît, et la ligne « absent de ton
 * profil » aussi — il n'y a pas de profil dont être absent.
 */
export function OfferRow({
  offre,
  rang,
  sansNote = false,
  place = null,
}: {
  offre: Offer;
  rang?: number;
  sansNote?: boolean;
  /** La place de l'offre dans le classement complet, quand elle en a une. */
  place?: Rang | null;
}) {
  const manquants = sansNote ? [] : (offre.skills?.missing ?? []);
  const couvertes = sansNote ? [] : (offre.skills?.covered ?? []);

  return (
    <article
      className={`group relative border-b border-line px-5 py-4 transition hover:bg-surface ${
        estNonRenseigne(offre) ? "bg-paper-deep/40" : ""
      }`}
    >
      <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
        {typeof rang === "number" ? (
          <span className="num mt-0.5 hidden w-6 shrink-0 text-sm text-muted sm:block">
            {String(rang).padStart(2, "0")}
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-medium leading-snug text-ink">
            <Link href={`/offres/${offre.id}`} className="after:absolute after:inset-0">
              {offre.title ?? "Intitulé non communiqué"}
            </Link>
          </h3>

          <p className="mt-1 text-sm text-ink-soft">
            <span className="font-medium">{offre.company ?? "Entreprise non communiquée"}</span>
            <span className="text-muted"> · {offre.location ?? "lieu non précisé"}</span>
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <ContractChip offre={offre} />
            <SourceChip source={offre.source} />
            <ZoneChip zone={offre.location_zone} sansLieu={!offre.location?.trim()} />
            {offre.duration ? (
              <span className="inline-flex items-center rounded-[6px] border border-line bg-surface px-2 py-0.5 text-xs text-muted num">
                {offre.duration}
              </span>
            ) : null}
            {signalFormationCitable(offre) ? <TrainingChip /> : null}
            <FreshnessChip offre={offre} />
          </div>

          {/* L'aperçu de l'annonce a été retiré. Les offres d'un même employeur ouvrent
              presque toujours sur la même accroche d'entreprise, donc deux lignes de texte ne
              distinguaient rien. Ce qui distingue, c'est ce que l'offre demande et que tu as
              déjà, face à ce qu'elle demande et qui te manque. */}
          {couvertes.length > 0 || manquants.length > 0 ? (
            <div className="mt-2 space-y-0.5 text-xs leading-relaxed">
              {couvertes.length > 0 ? (
                <p className="text-muted">
                  <span className="text-good">Tu as</span>{" "}
                  <span className="text-ink-soft">{couvertes.slice(0, 5).join(", ")}</span>
                  {couvertes.length > 5 ? ` +${couvertes.length - 5}` : ""}
                </p>
              ) : null}
              {manquants.length > 0 ? (
                <p className="text-muted">
                  <span className="text-bad">Il manque</span>{" "}
                  <span className="text-ink-soft">{manquants.slice(0, 5).join(", ")}</span>
                  {manquants.length > 5 ? ` +${manquants.length - 5}` : ""}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {sansNote ? null : (
          <div className="flex flex-col items-end gap-1.5">
            {place ? (
              <div className="text-right">
                {/* Le rang d'abord. La meme donnee, dite autrement, cesse de decourager sans
                    mentir : une place se comprend et se vise, un pourcentage nu se subit. */}
                <span className="font-display text-2xl font-light leading-none tabular-nums text-ink">
                  {place.rang}
                  <span className="text-base">{place.rang === 1 ? "re" : "e"}</span>
                </span>
                <div className="font-mono text-[10px] tracking-[0.08em] text-muted">
                  sur {place.sur}
                </div>
              </div>
            ) : null}
            <ScoreBadge score={offre.score} taille={place ? "xs" : "md"} />
          </div>
        )}
      </div>
    </article>
  );
}

/** Version compacte, pour les aperçus de la page d'accueil. */
export function OfferMini({ offre }: { offre: Offer }) {
  return (
    <Link
      href={`/offres/${offre.id}`}
      className="card flex items-start gap-4 p-4 transition hover:border-line-strong hover:shadow-[0_1px_0_var(--color-line-strong)]"
    >
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">
          {offre.title ?? "Intitulé non communiqué"}
        </h3>
        <p className="mt-1 truncate text-xs text-ink-soft">
          {offre.company ?? "Entreprise non communiquée"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <ContractChip offre={offre} />
          {offre.location_zone === "toulouse" ? <ZoneChip zone="toulouse" /> : null}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          {contratLabel(offre)} · {offre.duration ?? "durée non précisée"}
        </p>
      </div>
      <ScoreBadge score={offre.score} />
    </Link>
  );
}
