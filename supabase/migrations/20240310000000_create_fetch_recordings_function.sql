-- Function to fetch all recordings (both video and editor) for a user
create or replace function public.fetch_user_recordings(profile_id_param uuid)
returns table (
    id uuid,
    type text,
    created_at timestamptz,
    linked_repo text,
    -- Video specific fields
    name text,
    duration numeric,
    size bigint,
    storage_path text,
    mime_type text,
    thumbnail_url text,
    -- Editor specific fields
    session_code text,
    initial_content text,
    duration_ms bigint,
    event_count integer,
    status text,
    final_content text,
    thumbnail_code text
) language plpgsql
security definer
set search_path = public
as $$
begin
    -- First, get all video recordings
    return query
    select 
        v.id,
        'video'::text as type,
        v.created_at,
        v.linked_repo,
        -- Video specific fields
        v.name,
        v.duration,
        v.size,
        v.storage_path,
        v.mime_type,
        v.thumbnail_url,
        -- Editor specific fields (null for videos)
        null::text as session_code,
        null::text as initial_content,
        null::bigint as duration_ms,
        null::integer as event_count,
        null::text as status,
        null::text as final_content,
        null::text as thumbnail_code
    from videos v
    where v.profile_id = profile_id_param
    
    union all
    
    -- Then get all editor recordings
    select 
        rs.id,
        'editor'::text as type,
        rs.created_at,
        rs.linked_repo,
        -- Video specific fields (null for editor recordings)
        null::text as name,
        (rs.duration_ms / 1000.0)::numeric as duration, -- Convert to seconds for consistency
        null::bigint as size,
        null::text as storage_path,
        null::text as mime_type,
        null::text as thumbnail_url,
        -- Editor specific fields
        rs.code as session_code,
        rs.initial_content,
        rs.duration_ms,
        (
            select coalesce(sum(eb.event_count), 0)::integer as total_events
            from editor_event_batches eb
            where eb.session_id = rs.id
        ) as event_count,
        rs.status::text,
        (
            select content
            from editor_snapshots es
            where es.session_id = rs.id
            order by event_index desc
            limit 1
        ) as final_content,
        -- Generate a clean thumbnail code from final content
        case
            when (
                select content
                from editor_snapshots es
                where es.session_id = rs.id
                order by event_index desc
                limit 1
            ) is null then null
            else (
                with cleaned_content as (
                    -- Remove empty lines and leading/trailing whitespace
                    select array_to_string(
                        array(
                            select trim(line)
                            from regexp_split_to_table(
                                (
                                    select content
                                    from editor_snapshots es
                                    where es.session_id = rs.id
                                    order by event_index desc
                                    limit 1
                                ),
                                E'\n'
                            ) as line
                            where trim(line) != ''
                            limit 10  -- Take first 10 non-empty lines
                        ),
                        E'\n'
                    ) as content
                )
                select substring(content, 1, 500)  -- Limit to 500 chars for thumbnail
                from cleaned_content
            )
        end as thumbnail_code
    from recording_sessions rs
    where rs.user_id = profile_id_param
    and rs.type = 'code_editor'
    and rs.status != 'deleted'
    
    order by created_at desc;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.fetch_user_recordings to authenticated;

-- Add index for performance
create index if not exists videos_profile_created_idx on videos (profile_id, created_at desc);
create index if not exists recording_sessions_user_created_idx on recording_sessions (user_id, created_at desc);  