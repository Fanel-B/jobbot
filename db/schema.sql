-- Schéma PostgreSQL de JobBot V2 (cible : Neon).
--
-- Décisions d'architecture (BRIEFING.md, section 5) :
--   - `offers.canonical_url` est UNIQUE : c'est la clé de dédoublonnage du pipeline, et la clé
--     sur laquelle le collecteur fait son « insérer ou mettre à jour » ;
--   - AUCUNE colonne `score` dans `offers` : la note dépend de qui regarde, elle est calculée à
--     la lecture (en TypeScript, au rendu) à partir du profil de la personne connectée ;
--   - aucune donnée inventée : un champ absent de la source reste NULL, jamais une valeur par défaut
--     qui ferait croire qu'il est renseigné.
--
-- Le fichier est rejouable : `CREATE ... IF NOT EXISTS` partout, aucune suppression.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql

BEGIN;

-- ---------------------------------------------------------------- offres

-- Une ligne par annonce, telle que le pipeline l'a collectée. Les colonnes reprennent celles de
-- `data/offers.json` (voir `reference/export_site.py`, fonction `ligne`), sans la note ni son
-- bulletin.
CREATE TABLE IF NOT EXISTS offers (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    canonical_url       text        NOT NULL,
    source              text        NOT NULL,             -- « linkedin », « airbus », « thales »…
    source_offer_id     text,                             -- identifiant de l'annonce chez la source
    title               text,
    company             text,
    location            text,                             -- lieu tel qu'écrit dans l'annonce
    location_zone       text        NOT NULL DEFAULT 'autre',
    contract_type       text,                             -- NULL = contrat non renseigné
    contract_known      boolean     NOT NULL DEFAULT false,
    duration            text,                             -- « 6 mois », « 4 à 6 mois »
    start_date          date,
    education_required  text,                             -- niveau demandé
    description         text,
    skills_required     jsonb       NOT NULL DEFAULT '[]'::jsonb,
    published_at        timestamp,                        -- heure locale de la source, sans fuseau
    first_seen_at       timestamp,                        -- première collecte (pipeline)
    last_seen_at        timestamp,                        -- dernière collecte (pipeline)
    miage_mentioned     boolean     NOT NULL DEFAULT false,
    -- Traçabilité de l'écriture dans cette base (pas des dates de collecte).
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT offers_canonical_url_key UNIQUE (canonical_url),
    CONSTRAINT offers_location_zone_check
        CHECK (location_zone IN ('toulouse', 'idf', 'remote', 'autre')),
    -- « Contrat renseigné » doit dire la vérité sur `contract_type` (règle n° 3 du BRIEFING).
    CONSTRAINT offers_contract_known_check
        CHECK (contract_known = (contract_type IS NOT NULL)),
    CONSTRAINT offers_skills_required_check
        CHECK (jsonb_typeof(skills_required) = 'array')
);

CREATE INDEX IF NOT EXISTS offers_location_zone_idx ON offers (location_zone);
CREATE INDEX IF NOT EXISTS offers_source_idx        ON offers (source);
CREATE INDEX IF NOT EXISTS offers_last_seen_at_idx  ON offers (last_seen_at DESC);

-- ---------------------------------------------------------------- comptes

-- Une personne qui se connecte (Auth.js : Google ou lien e-mail). Les tables propres à Auth.js
-- (comptes OAuth, sessions, jetons de vérification) seront ajoutées avec l'adaptateur choisi.
-- Les noms de colonnes entre guillemets sont imposés par l'adaptateur Postgres d'Auth.js, qui
-- écrit littéralement `"emailVerified"` et `"userId"`. PostgreSQL replie les identifiants nus en
-- minuscules : sans les guillemets ici, les requêtes de l'adaptateur ne trouveraient pas leurs
-- colonnes. Vérifié dans le SQL de `node_modules/@auth/pg-adapter`, pas supposé.
CREATE TABLE IF NOT EXISTS users (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email           text        NOT NULL,
    name            text,
    "emailVerified" timestamptz,
    image           text,                                  -- avatar renvoyé par le fournisseur
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Unicité insensible à la casse : « Fanel@… » et « fanel@… » sont la même personne.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));

-- ------------------------------------------------- évolutions de `users`

-- `CREATE TABLE IF NOT EXISTS` ne touche pas une table déjà créée : une base montée avant
-- l'arrivée d'Auth.js garde `email_verified` en minuscules et n'a pas de colonne `image`. Ces
-- deux blocs rattrapent l'écart sans rien perdre — un renommage conserve les données, et les
-- deux sont sans effet si la colonne est déjà au bon nom.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'users'
                  AND column_name = 'email_verified')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'users'
                          AND column_name = 'emailVerified') THEN
        ALTER TABLE users RENAME COLUMN email_verified TO "emailVerified";
    END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS image text;

-- ------------------------------------------------- comptes et sessions (Auth.js)

-- Les identités externes rattachées à une personne : un compte Google aujourd'hui, un autre
-- fournisseur demain. `ON DELETE CASCADE` est ce qui fait que « supprimer mon compte » supprime
-- vraiment tout — c'est une obligation du cahier de route, pas une commodité.
CREATE TABLE IF NOT EXISTS accounts (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "userId"            bigint  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type                text    NOT NULL,
    provider            text    NOT NULL,
    "providerAccountId" text    NOT NULL,
    refresh_token       text,
    access_token        text,
    expires_at          bigint,
    token_type          text,
    scope               text,
    id_token            text,
    session_state       text,

    CONSTRAINT accounts_provider_key UNIQUE (provider, "providerAccountId")
);

CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON accounts ("userId");

-- Une ligne par session ouverte. Les sessions sont en base plutôt qu'en JWT : la déconnexion
-- doit prendre effet immédiatement, et un jeton déjà émis ne se révoque pas.
CREATE TABLE IF NOT EXISTS sessions (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "sessionToken" text        NOT NULL UNIQUE,
    "userId"       bigint      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires        timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions ("userId");

-- Jetons à usage unique (lien par e-mail). Inutilisée tant qu'on n'a que Google, mais
-- l'adaptateur la requiert au démarrage.
CREATE TABLE IF NOT EXISTS verification_token (
    identifier text        NOT NULL,
    token      text        NOT NULL,
    expires    timestamptz NOT NULL,

    PRIMARY KEY (identifier, token)
);

-- Le profil qui sert à calculer la note à la lecture. Un seul profil par personne.
CREATE TABLE IF NOT EXISTS profiles (
    user_id         bigint      PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    level           text,                                  -- « L3 », « M1 »…
    formation       text,                                  -- « MIAGE »…
    zones           text[]      NOT NULL DEFAULT '{}',     -- zones recherchées
    contract_kinds  text[]      NOT NULL DEFAULT '{}',     -- « stage », « alternance »
    -- Seules les compétences confirmées par la personne comptent dans la note (BRIEFING, § 5.C).
    skills          jsonb       NOT NULL DEFAULT '[]'::jsonb,
    available_from  date,
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT profiles_zones_check
        CHECK (zones <@ ARRAY['toulouse', 'idf', 'remote', 'autre']::text[]),
    CONSTRAINT profiles_skills_check CHECK (jsonb_typeof(skills) = 'array')
);

-- Les CV déposés. Les compétences proposées par l'IA restent séparées des compétences confirmées :
-- une compétence jamais confirmée ne compte jamais.
CREATE TABLE IF NOT EXISTS resumes (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             bigint      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    filename            text,
    mime_type           text,
    extracted_text      text,
    skills_proposed     jsonb       NOT NULL DEFAULT '[]'::jsonb,
    skills_confirmed    jsonb       NOT NULL DEFAULT '[]'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT resumes_skills_proposed_check  CHECK (jsonb_typeof(skills_proposed) = 'array'),
    CONSTRAINT resumes_skills_confirmed_check CHECK (jsonb_typeof(skills_confirmed) = 'array')
);

CREATE INDEX IF NOT EXISTS resumes_user_id_idx ON resumes (user_id);

-- Les offres mises de côté par une personne, avec où elle en est.
CREATE TABLE IF NOT EXISTS saved_offers (
    user_id     bigint      NOT NULL REFERENCES users (id)  ON DELETE CASCADE,
    offer_id    bigint      NOT NULL REFERENCES offers (id) ON DELETE CASCADE,
    status      text        NOT NULL DEFAULT 'saved',
    note        text,                                      -- note libre de la personne, pas la note de l'offre
    saved_at    timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, offer_id),
    CONSTRAINT saved_offers_status_check
        CHECK (status IN ('saved', 'applied', 'interview', 'rejected', 'archived'))
);

CREATE INDEX IF NOT EXISTS saved_offers_offer_id_idx ON saved_offers (offer_id);

-- Le journal des appels à l'IA, pour tenir un quota par personne (BRIEFING, § 5.C).
CREATE TABLE IF NOT EXISTS ai_usage (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         bigint      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind            text        NOT NULL,                  -- « extraction_competences », « cv_adapte »…
    model           text        NOT NULL,                  -- figé côté serveur
    input_tokens    integer     NOT NULL DEFAULT 0 CHECK (input_tokens  >= 0),
    output_tokens   integer     NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
    offer_id        bigint      REFERENCES offers (id)  ON DELETE SET NULL,
    resume_id       bigint      REFERENCES resumes (id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Le calcul du quota lit « les appels de cette personne depuis telle date ».
CREATE INDEX IF NOT EXISTS ai_usage_user_id_created_at_idx ON ai_usage (user_id, created_at DESC);

COMMIT;
