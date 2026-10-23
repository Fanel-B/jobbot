import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { meta } from "@/lib/offers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Outfit : grotesque géométrique à grande hauteur d'x. C'est l'équivalent libre le plus proche
// du Gotham de la référence, qui est sous licence et ne peut pas être repris.
const display = Outfit({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-latin",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JobBot — les offres qui te correspondent vraiment",
  description:
    "Alternance et stage en France : les offres publiées par les entreprises et les sources officielles, avec une note expliquée critère par critère.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const collecte = new Date(meta.generated_at);

  return (
    <html lang="fr" className={`${inter.variable} ${display.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-[13px] font-semibold text-paper">
                J
              </span>
              <span className="text-[15px] font-semibold tracking-tight">JobBot</span>
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

            <div className="ml-auto flex items-center gap-3">
              <span className="num hidden text-xs text-muted md:inline">
                {meta.count} offres · collecte du {collecte.toLocaleDateString("fr-FR")}
              </span>
              <Link
                href="/offres"
                className="rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft"
              >
                Voir les offres
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
