-- Migration T6 : ce qu'il faut à la base en service pour que le site puisse y lire les offres.
--
--   · offers.pipeline_id      le numéro de l'offre côté pipeline, qui sert d'adresse aux fiches ;
--   · offers.skills_optional  les compétences souhaitées, lues par le moteur de note ;
--   · collectes               une ligne par copie réussie, pour dater la dernière collecte.
--
-- Rejouable et sans perte : uniquement des ajouts `IF NOT EXISTS`, aucune suppression, aucune
-- réécriture de ligne existante. Les offres déjà en base gardent un `pipeline_id` NULL jusqu'à la
-- prochaine copie du collecteur, qui le remplit. Le tout dans une transaction : en cas d'erreur,
-- rien n'est changé.
--
-- Par la connexion directe (sans « -pooler » dans l'hôte), comme db/schema.sql :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migration-t6.sql
--
-- Les mêmes instructions figurent dans db/schema.sql, pour une base créée de zéro.

BEGIN;

ALTER TABLE offers ADD COLUMN IF NOT EXISTS pipeline_id bigint;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS skills_optional jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS offers_pipeline_id_key ON offers (pipeline_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offers_skills_optional_check') THEN
        ALTER TABLE offers ADD CONSTRAINT offers_skills_optional_check
            CHECK (jsonb_typeof(skills_optional) = 'array');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS collectes (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    terminee_a    timestamptz NOT NULL,
    lues          integer     NOT NULL CHECK (lues >= 0),
    inserees      integer     NOT NULL CHECK (inserees >= 0),
    mises_a_jour  integer     NOT NULL CHECK (mises_a_jour >= 0),
    inchangees    integer     NOT NULL CHECK (inchangees >= 0)
);

CREATE INDEX IF NOT EXISTS collectes_terminee_a_idx ON collectes (terminee_a DESC);

COMMIT;
