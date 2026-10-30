import Link from "next/link";
import { FAMILLES } from "@/lib/competences";

/**
 * La première chose que voit quelqu'un qui n'a pas encore de profil.
 *
 * Elle remplace deux mauvaises réponses à la même question. Avant, l'accueil affichait « l'offre
 * la mieux notée aujourd'hui » calculée sur le profil de Fanel, et la page profil ouvrait sur un
 * mur de 75 cases dont 31 déjà cochées. Dans les deux cas le site supposait au lieu de demander.
 *
 * La forme est reprise du relevé de design/cedaorg.net.md : une liste de besoins concrets plutôt
 * qu'un menu. Chaque ligne porte son intitulé et, en dessous, les technos réelles qu'elle
 * recouvre — on se reconnaît dans « REACT, NEXT.JS, TAILWIND » même sans savoir comment on
 * s'appelle professionnellement. La dernière ligne admet que les six familles ne suffiront pas à
 * tout le monde, et donne quand même une porte.
 *
 * Aucune donnée inventée : les familles et leurs membres viennent du catalogue du moteur, et
 * lib/competences.test.ts vérifie que la partition est exacte.
 */
export function CarteBesoins({ compacte = false }: { compacte?: boolean }) {
  return (
    <div className="card overflow-hidden bg-surface">
      <div className="border-b border-line px-6 py-5">
        <h2 className="text-lg font-medium leading-snug text-ink">
          Qu&apos;est-ce que tu sais faire ?
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          {compacte
            ? "Choisis une famille, coche, et les offres se notent."
            : "Coche ce que tu sais utiliser aujourd'hui. Rien d'autre n'est demandé."}
        </p>
      </div>

      <ul className="divide-y divide-line">
        {FAMILLES.map((f) => (
          <li key={f.id}>
            <Link
              href={`/profil#${f.id}`}
              className="group relative block py-4 pl-6 pr-6 transition hover:bg-paper-deep/40"
            >
              {/* Le filet de famille. Fin au repos, large au survol : la couleur répond au
                  geste au lieu de rester un aplat décoratif. */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[3px] transition-[width] duration-200 group-hover:w-[6px]"
                style={{ background: `var(${f.teinte})` }}
              />
              <p className="text-[15px] text-ink">{f.titre}</p>
              <p
                className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em]"
                style={{ color: `var(${f.teinte})` }}
              >
                {f.principales.slice(0, 4).join(", ")}
                {f.principales.length > 4 ? ` +${f.principales.length - 4}` : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-5">
        <p className="text-sm text-ink-soft">Pas sûr de ce qui te correspond ?</p>
        <Link href="/profil" className="bouton-plein px-5 py-2.5 text-xs font-medium">
          Voir toute la liste
        </Link>
      </div>
    </div>
  );
}
