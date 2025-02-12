-- Add insights column to recording_sessions
ALTER TABLE recording_sessions
ADD COLUMN IF NOT EXISTS insights jsonb;

-- Add updated_at column to recording_sessions
ALTER TABLE recording_sessions
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

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
    insights_data jsonb
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
        insights_data ? 'summary' AND
        insights_data ? 'keyChanges' AND
        insights_data ? 'complexity' AND
        insights_data ? 'suggestions'
    ) THEN
        RAISE EXCEPTION 'Invalid insights structure';
    END IF;

    -- Update the session with insights
    UPDATE recording_sessions
    SET 
        insights = insights_data,
        updated_at = NOW()
    WHERE id = session_record.id
    RETURNING insights INTO insights_data;

    RETURN insights_data;
EXCEPTION
    WHEN others THEN
        RAISE EXCEPTION 'Failed to store insights: %', SQLERRM;
END;
$$; 