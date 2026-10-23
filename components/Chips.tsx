import { contratLabel, estNonRenseigne, fraicheur, sourceLabel } from "@/lib/offers";
import type { Offer, Zone } from "@/lib/offers";

const BASE = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs";

export function SourceChip({ source }: { source: string }) {
  return (
    <span className={`${BASE} border-line bg-paper-deep text-ink-soft`}>
      <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
      {sourceLabel(source)}
    </span>
  );
}

export function ZoneChip({ zone }: { zone: Zone }) {
  const carte: Record<Zone, string> = {
    toulouse: "border-accent/25 bg-accent-soft text-accent-ink",
    idf: "border-line bg-paper-deep text-ink-soft",
    remote: "border-line bg-paper-deep text-ink-soft",
    autre: "border-line bg-paper-deep text-muted",
  };
  const texte: Record<Zone, string> = {
    toulouse: "Toulouse",
    idf: "Île-de-France",
    remote: "À distance",
    autre: "France",
  };
  return <span className={`${BASE} ${carte[zone]}`}>{texte[zone]}</span>;
}

/**
 * Le type de contrat. Quand la source ne le renseigne pas, on l'écrit — et le
 * style le distingue nettement, pour qu'aucune offre ne se fasse passer pour un stage.
 */
export function ContractChip({ offre }: { offre: Offer }) {
  if (estNonRenseigne(offre)) {
    return (
      <span className={`${BASE} border-dashed border-line-strong bg-surface text-muted`}>
        <span aria-hidden>⚠</span>
        {contratLabel(offre)}
      </span>
    );
  }
  return (
    <span className={`${BASE} border-ink/15 bg-ink text-paper`}>{contratLabel(offre)}</span>
  );
}

export function FreshnessChip({ offre }: { offre: Offer }) {
  const age = fraicheur(offre);
  const recent = age === "vue aujourd'hui" || age === "il y a 1 jour";
  return (
    <span className={`${BASE} ${recent ? "border-good/25 bg-good-soft text-good" : "border-line bg-paper-deep text-muted"}`}>
      {age}
    </span>
  );
}

export function TrainingChip() {
  return (
    <span className={`${BASE} border-warn/30 bg-warn-soft text-warn`}>
      <span aria-hidden>⚠</span>
      Offre à vérifier
    </span>
  );
}

export function InfoChip({ children }: { children: React.ReactNode }) {
  return <span className={`${BASE} border-line bg-surface text-muted`}>{children}</span>;
}
