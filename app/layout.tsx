import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { Suspense } from "react";
import Link from "next/link";
import { Compte, CompteSquelette } from "@/components/Compte";
import "./globals.css";
import { meta } from "@/lib/offers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Newsreader, en graisse 300, pour tous les titres.
 *
 * Elle remplace Outfit, un grotesque géométrique. Ce n'était pas un mauvais choix en soi, mais
 * c'est la police la plus employée par les gabarits engendrés automatiquement : un titre gras en
 * grotesque géométrique sur fond clair est devenu l'image même du site fait à la chaîne. Changer
 * la famille est le seul geste typographique qui se voit immédiatement sur toutes les pages.
 *
 * Le choix suit le relevé de design/cedaorg.net.md : grand et **maigre**, pas grand et gras. À
 * 80 px la forme des lettres porte déjà l'emphase, et la graisse en plus ne fait qu'un mur.
 * Newsreader a un axe optique — à grande taille elle s'affine d'elle-même, ce que ne fait aucune
 * police à graisses figées.
 *
 * Deux serifs ont été volontairement écartées, Fraunces et Instrument Serif : ce sont celles que
 * les modèles proposent par réflexe, donc exactement ce qu'on cherche à fuir.
 */
const display = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-display-latin",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JobBot, les offres qui te correspondent vraiment",
  description:
    "Alternance et stage en France : les offres publiées par les entreprises et les sources officielles, avec une note expliquée critère par critère.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const collecte = new Date(meta.generated_at);

  return (
    <html lang="fr" className={`${inter.variable} ${display.variable}`}>
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

            <nav className="hidden items-center gap-1 text-sm text-ink-soft sm:flex">
              <Link
                href="/offres"
                className="rounded-md px-3 py-1.5 transition hover:bg-paper-deep hover:text-ink"
              >
                Offres
              </Link>
              <Link
                href="/profil"
                className="rounded-md px-3 py-1.5 transition hover:bg-paper-deep hover:text-ink"
              >
                Profil
              </Link>
              <Link
                href="/methode"
                className="rounded-md px-3 py-1.5 transition hover:bg-paper-deep hover:text-ink"
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
