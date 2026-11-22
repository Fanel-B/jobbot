-- Migration T8 : le profil personnel et les champs de la nouvelle notation. NON APPLIQUÉE.
--
-- Socle T4, en brouillon. Rien n'est appliqué sur Neon, et rien ne lit encore ces colonnes : le site
-- et le collecteur ne les connaissent pas. Cette migration n'ajoute que des colonnes NULLABLES et des
-- contraintes qu'une ligne existante respecte déjà : elle ne change le sens d'aucune donnée, ne
-- supprime rien et ne touche ni à `score` ni à `location_zone`.
--
-- À appliquer par la connexion directe (sans « -pooler » dans l'hôte), sur accord de Fanel :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migration-t8.sql
--
-- Rejouable sans effet (`ADD COLUMN IF NOT EXISTS`, contraintes créées seulement si absentes), et
-- toute dans une transaction : en cas d'erreur, rien n'est modifié.
--
-- Volontairement ABSENTE de `db/schema.sql`. Les migrations T6 et T7 y sont recopiées pour une base
-- créée de zéro ; celle-ci non, parce que `scripts/appliquer-schema.mjs` rejoue `schema.sql` sur la
-- base : la recopier l'appliquerait par un autre chemin. À recopier le jour de l'application.

BEGIN;

-- ------------------------------------------------------------------------------ profiles

-- Les quatre champs personnels. `available_from` (le début au plus tôt) existe déjà.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS available_until      date;          -- fin au plus tard
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS duration_min_months  numeric(4, 1); -- durée minimale, en mois
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS duration_max_months  numeric(4, 1); -- durée maximale, en mois

-- Les zones ont trois états qu'une liste vide ne distingue pas : NULL = la personne n'a pas répondu,
-- 'partout' = elle a choisi de ne pas restreindre, 'liste' = elle a choisi des zones (colonne `zones`).
-- TODO(QUESTION) : les lignes existantes (zones = '{}') restent à NULL, « non renseigné ». Le code
-- actuel les lit comme « partout ». Les passer à 'partout' conserverait le comportement actuel : à
-- trancher avant d'appliquer.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zones_mode text;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'profiles'::regclass AND conname = 'profiles_available_until_check') THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_available_until_check
            CHECK (available_until IS NULL OR available_from IS NULL OR available_until >= available_from);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'profiles'::regclass AND conname = 'profiles_duration_check') THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_duration_check
            CHECK ((duration_min_months IS NULL OR duration_min_months > 0)
               AND (duration_max_months IS NULL OR duration_max_months > 0)
               AND (duration_min_months IS NULL OR duration_max_months IS NULL
                    OR duration_min_months <= duration_max_months));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'profiles'::regclass AND conname = 'profiles_zones_mode_check') THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_zones_mode_check
            CHECK (zones_mode IS NULL
                OR (zones_mode = 'partout' AND cardinality(zones) = 0)
                OR (zones_mode = 'liste'   AND cardinality(zones) > 0));
    END IF;
END $$;

-- --------------------------------------------------------------------------------- offers

-- Les champs du contrat d'export de la nouvelle notation. TODO(QUESTION) : NOMS ET VALEURS PROVISOIRES,
-- ceux du prompt aux livrables 4 à 7 de Hermes (niveau d'études, texte capturé, statut du pipeline,
-- raisons structurées, offres fermées). Ils seront confirmés ou corrigés à la réception de ses
-- livrables, avant toute application. Tous nuls tant que le collecteur ne les écrit pas.
ALTER TABLE offers ADD COLUMN IF NOT EXISTS statut_pipeline   text;     -- statut pour le profil de référence de Fanel
ALTER TABLE offers ADD COLUMN IF NOT EXISTS raisons_pipeline  jsonb;    -- [{code, texte, secondaire}]
ALTER TABLE offers ADD COLUMN IF NOT EXISTS motif_rejet       text;     -- renseigné si statut_pipeline = 'rejected'
ALTER TABLE offers ADD COLUMN IF NOT EXISTS fermee            boolean;  -- fermée par l'employeur ; NULL = inconnu
ALTER TABLE offers ADD COLUMN IF NOT EXISTS fermee_le         date;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS texte_capture     boolean;  -- faux pour les sources sans texte (LinkedIn)
ALTER TABLE offers ADD COLUMN IF NOT EXISTS education_level   smallint; -- niveau d'études exigé : 2 à 5, NULL si non lu
ALTER TABLE offers ADD COLUMN IF NOT EXISTS education_source  text;     -- « champ » ou « description »

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'offers'::regclass AND conname = 'offers_statut_pipeline_check') THEN
        ALTER TABLE offers ADD CONSTRAINT offers_statut_pipeline_check
            CHECK (statut_pipeline IS NULL
                OR statut_pipeline IN ('eligible', 'uncertain', 'ineligible', 'rejected'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'offers'::regclass AND conname = 'offers_raisons_pipeline_check') THEN
        ALTER TABLE offers ADD CONSTRAINT offers_raisons_pipeline_check
            CHECK (raisons_pipeline IS NULL OR jsonb_typeof(raisons_pipeline) = 'array');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'offers'::regclass AND conname = 'offers_motif_rejet_check') THEN
        ALTER TABLE offers ADD CONSTRAINT offers_motif_rejet_check
            CHECK (motif_rejet IS NULL
                OR motif_rejet IN ('hors_zone', 'date_debut', 'duree', 'alternance', 'autre'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'offers'::regclass AND conname = 'offers_fermee_le_check') THEN
        ALTER TABLE offers ADD CONSTRAINT offers_fermee_le_check
            CHECK (fermee_le IS NULL OR fermee IS TRUE);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'offers'::regclass AND conname = 'offers_education_level_check') THEN
        ALTER TABLE offers ADD CONSTRAINT offers_education_level_check
            CHECK (education_level IS NULL OR education_level BETWEEN 2 AND 5);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'offers'::regclass AND conname = 'offers_education_source_check') THEN
        ALTER TABLE offers ADD CONSTRAINT offers_education_source_check
            CHECK (education_source IS NULL OR education_source IN ('champ', 'description'));
    END IF;
END $$;

COMMIT;
