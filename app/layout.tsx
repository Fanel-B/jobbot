import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Compte, CompteSquelette } from "@/components/Compte";
import "./globals.css";
import { chargerDonnees } from "@/lib/donnees";
import { AgeCollecte } from "@/components/AgeCollecte";

export const metadata: Metadata = {
  title: "JobBot, les offres qui te correspondent vraiment",
  description:
    "Alternance et stage en France : les offres publiées par les entreprises et les sources officielles, avec une note expliquée critère par critère.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // La date de la collecte chargée : l'export du fichier, ou la dernière copie en base.
  // C'est une donnée, pas l'horloge : elle se pré-rend. L'âge, lui, attend la requête.
  const { meta } = await chargerDonnees();
  const collecte = new Date(meta.generated_at);

  return (
    <html lang="fr">
      {/* min-h-dvh et non min-h-screen : 100vh ignore la barre d'adresse des navigateurs
          mobiles, qui se rétracte au défilement. Le pied de page se retrouvait alors poussé
          sous le pli d'une centaine de pixels. dvh suit la hauteur réellement visible. */}
      <body className="flex min-h-dvh flex-col antialiased">
        <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-[13px] font-medium text-paper">
                J
              </span>
              <span className="text-[15px] font-medium tracking-tight">JobBot</span>
            </Link>

            {/* Visible aussi sur téléphone. Les liens étaient en `hidden sm:flex`, donc sur un
                écran étroit le pied de page devenait le seul chemin vers les offres et la
                méthode : il fallait traverser toute la page pour changer d'écran. */}
            <nav className="flex items-center gap-0.5 text-sm text-ink-soft sm:gap-1">
              <Link
                href="/offres"
                className="rounded-md px-2 py-1.5 transition hover:bg-paper-deep hover:text-ink sm:px-3"
              >
                Offres
              </Link>
              <Link
                href="/profil"
                className="rounded-md px-2 py-1.5 transition hover:bg-paper-deep hover:text-ink sm:px-3"
              >
                Profil
              </Link>
              <Link
                href="/methode"
                className="rounded-md px-2 py-1.5 transition hover:bg-paper-deep hover:text-ink sm:px-3"
              >
                Méthode
              </Link>
            </nav>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <Suspense fallback={<CompteSquelette />}>
                <Compte />
              </Suspense>
              <span className="num hidden text-xs text-muted md:inline">
                {meta.count} offres · collecte du {collecte.toLocaleDateString("fr-FR")}
              </span>
              {/* `whitespace-nowrap` : à 390 px, « Voir les offres » et « Se connecter »
                  se repliaient chacun sur deux lignes et l'en-tête se télescopait. Le libellé
                  raccourcit au lieu de passer à la ligne, et la barre garde sa hauteur. */}
              <Link
                href="/offres"
                className="whitespace-nowrap rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft"
              >
                <span className="sm:hidden">Offres</span>
                <span className="hidden sm:inline">Voir les offres</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-24 border-t border-line bg-paper-deep/60">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 text-sm text-muted sm:grid-cols-3">
            <div>
              <p className="font-medium text-ink">JobBot</p>
              <p className="mt-2 leading-relaxed">
                Recherche d&apos;alternance et de stage. Les offres sont collectées une fois, le
                classement est calculé pour chaque profil.
              </p>
            </div>
            <div>
              <p className="font-medium text-ink">D&apos;où viennent les données</p>
              <ul className="mt-2 space-y-1">
                <li>
                  <Link
                    href="/methode"
                    className="underline decoration-line-strong hover:text-ink"
                  >
                    Sources et méthode
                  </Link>
                </li>
                <li>
                  <Link
                    href="/confidentialite"
                    className="underline decoration-line-strong hover:text-ink"
                  >
                    Données et mentions légales
                  </Link>
                </li>
                <li className="num">
                  Dernière collecte : {collecte.toLocaleString("fr-FR")}
                </li>
                <Suspense fallback={null}>
                  <AgeCollecte generatedAt={meta.generated_at} />
                </Suspense>
                {meta.repli ? (
                  // Le mode base était demandé, mais le site lit le fichier : le dire, sinon la
                  // date ci-dessus passerait pour celle de la dernière copie.
                  <li>Offres lues dans le fichier de secours ({meta.repli}).</li>
                ) : null}
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">Sans compte</p>
              <p className="mt-2 leading-relaxed">
                Toutes les offres, triées par date. Avec un compte : les mêmes offres, triées par ce
                qui te correspond, avec le détail de la note.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
