-- Add insights column to recording_sessions
ALTER TABLE recording_sessions
ADD COLUMN IF NOT EXISTS insights jsonb;

-- Create a type for the insights structure
DO $$ BEGIN
    CREATE TYPE public.insight_suggestion AS (
        title text,
        description text,
        priority text
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.insight_complexity AS (
        before numeric,
        after numeric,
        explanation text
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.code_insights AS (
        summary text,
        key_changes text[],
        complexity insight_complexity,
        suggestions insight_suggestion[]
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create function to store insights
CREATE OR REPLACE FUNCTION store_editor_insights(
    pairing_code text,
    insights jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    session_record recording_sessions;
BEGIN
    -- Get the session
    SELECT *
    INTO session_record
    FROM recording_sessions
    WHERE code = pairing_code;

    IF session_record IS NULL THEN
        RAISE EXCEPTION 'Recording session not found for code %', pairing_code;
    END IF;

    -- Validate insights structure
    IF NOT (
        insights ? 'summary' AND
        insights ? 'keyChanges' AND
        insights ? 'complexity' AND
        insights ? 'suggestions'
    ) THEN
        RAISE EXCEPTION 'Invalid insights structure';
    END IF;

    -- Update the session with insights
    UPDATE recording_sessions
    SET 
        insights = insights,
        updated_at = NOW()
    WHERE id = session_record.id
    RETURNING insights INTO insights;

    RETURN insights;
EXCEPTION
    WHEN others THEN
        RAISE EXCEPTION 'Failed to store insights: %', SQLERRM;
END;
$$; 