import { bande, BANDE_TEXTE, type Bande } from "@/lib/offers";

/**
 * La note, posée comme sur un relevé plutôt que dans une pastille.
 *
 * Ce composant était un rectangle coloré à coins ronds : la forme que prend la note sur tous les
 * sites d'emploi, et celle que produit n'importe quel gabarit. Elle avait un défaut de fond en
 * plus d'être banale — l'aplat de couleur attirait l'œil sur la pastille, alors que
 * l'information, ici, c'est le nombre.
 *
 * Désormais le chiffre **est** la marque : composé grand et maigre dans la serif des titres,
 * avec son dénominateur en petit à côté. C'est le quatrième principe du relevé de design :
 * le nombre est à la fois l'ornement et l'argument. La bande de qualité devient un filet de
 * deux pixels sous le chiffre, assez pour qu'on la voie du coin de l'œil, pas assez pour qu'elle
 * prenne le dessus.
 *
 * La couleur ne porte jamais seule le sens : la lecture en clair est dans le `title` et dans un
 * texte réservé aux lecteurs d'écran, et elle s'affiche en toutes lettres en grande taille.
 * Quelqu'un qui ne distingue pas le vert du jaune lit la même chose que les autres.
 */
/** Le chiffre prend la couleur de sa bande : c'est l'information principale de la page. */
const ENCRE: Record<Bande, string> = {
  excellent: "text-good",
  bon: "text-accent",
  moyen: "text-warn",
  faible: "text-muted",
};

const FILET: Record<Bande, string> = {
  excellent: "bg-good",
  bon: "bg-accent",
  moyen: "bg-warn",
  faible: "bg-line-strong",
};

export function ScoreBadge({
  score,
  taille = "md",
}: {
  score: number | null;
  taille?: "md" | "lg";
}) {
  const b = bande(score);
  const grand = taille === "lg";

  return (
    <div className="shrink-0 text-right" title={BANDE_TEXTE[b]}>
      <div className="flex items-baseline justify-end gap-1">
        <span
          className={`font-display font-light leading-none tracking-tight tabular-nums ${
            grand ? "text-[3.25rem]" : "text-[1.75rem]"
          } ${ENCRE[b]}`}
        >
          {score ?? "–"}
        </span>
        <span className="font-mono text-[10px] tracking-[0.08em] text-muted">/100</span>
      </div>

      {/* Le filet de qualité. `aria-hidden` : il double une information déjà écrite. */}
      <div
        className={`mt-1.5 ml-auto h-0.5 rounded-full ${FILET[b]} ${grand ? "w-20" : "w-12"}`}
        aria-hidden
      />

      {grand ? (
        <div className="mt-2 text-xs font-medium text-ink-soft">{BANDE_TEXTE[b]}</div>
      ) : (
        <span className="sr-only">{BANDE_TEXTE[b]}</span>
      )}
    </div>
  );
}
