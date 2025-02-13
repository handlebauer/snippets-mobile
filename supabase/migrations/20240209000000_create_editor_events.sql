-- Create enum for event types
create type public.editor_event_type as enum ('insert', 'delete', 'replace');

-- Create enum for session types
create type public.recording_session_type as enum ('screen_recording', 'code_editor');

-- Create event batches table
create table public.editor_event_batches (
    id uuid default gen_random_uuid() primary key,
    session_id uuid references public.recording_sessions(id) on delete cascade not null,
    timestamp_start bigint not null,
    timestamp_end bigint not null,
    events jsonb not null, -- Store events as JSONB for queryability
    event_count integer not null,
    is_compressed boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create snapshots table
create table public.editor_snapshots (
    id uuid default gen_random_uuid() primary key,
    session_id uuid references public.recording_sessions(id) on delete cascade not null,
    event_index integer not null,
    "timestamp" bigint not null,
    content text not null,
    metadata jsonb, -- Store additional metadata like isKeyFrame, description, etc.
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for fast lookups
create index editor_event_batches_session_time_idx 
    on public.editor_event_batches (session_id, timestamp_start, timestamp_end);

create index editor_snapshots_session_event_idx 
    on public.editor_snapshots (session_id, event_index);

create index editor_snapshots_session_time_idx 
    on public.editor_snapshots (session_id, "timestamp");

-- Enable RLS
alter table public.editor_event_batches enable row level security;
alter table public.editor_snapshots enable row level security;

-- Create policies for event batches
create policy "Users can view event batches for sessions they own"
    on public.editor_event_batches for select
    using (
        exists (
            select 1 from public.recording_sessions
            where id = editor_event_batches.session_id
            and user_id = auth.uid()
        )
    );

create policy "Users can insert event batches for sessions they own"
    on public.editor_event_batches for insert
    with check (
        exists (
            select 1 from public.recording_sessions
            where id = editor_event_batches.session_id
            and user_id = auth.uid()
        )
    );

-- Create policies for snapshots
create policy "Users can view snapshots for sessions they own"
    on public.editor_snapshots for select
    using (
        exists (
            select 1 from public.recording_sessions
            where id = editor_snapshots.session_id
            and user_id = auth.uid()
        )
    );

create policy "Users can insert snapshots for sessions they own"
    on public.editor_snapshots for insert
    with check (
        exists (
            select 1 from public.recording_sessions
            where id = editor_snapshots.session_id
            and user_id = auth.uid()
        )
    );

-- Grant permissions
grant select, insert on public.editor_event_batches to authenticated;
grant select, insert on public.editor_snapshots to authenticated;

-- Set up realtime for live collaboration
alter publication supabase_realtime add table editor_event_batches;

-- Add new columns to recording_sessions
alter table public.recording_sessions 
    add column if not exists type public.recording_session_type default 'screen_recording',
    add column if not exists initial_content text,
    add column if not exists duration_ms bigint,
    add column if not exists status text check (status in ('recording', 'completed', 'archived')) default 'recording';

-- Create index for type column
create index if not exists recording_sessions_type_idx on public.recording_sessions (type);

-- Create function to cleanup old uncompressed batches
create or replace function public.compress_old_event_batches()
returns void as $$
declare
    batch record;
    compressed_events bytea;
begin
    -- Find batches older than 7 days that aren't compressed
    for batch in 
        select * from public.editor_event_batches
        where 
            created_at < (now() - interval '7 days')
            and not is_compressed
    loop
        -- In a real implementation, you'd compress the events here
        -- For now, we'll just mark them as compressed
        update public.editor_event_batches
        set 
            is_compressed = true
        where id = batch.id;
    end loop;
end;
$$ language plpgsql;

-- Create function to store editor event batches
create or replace function public.store_editor_event_batch(
    pairing_code text,
    timestamp_start bigint,
    timestamp_end bigint,
    events jsonb,
    event_count integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    session_record record;
    batch_id uuid;
begin
    -- Input validation
    if pairing_code is null or pairing_code = '' then
        raise exception 'Pairing code is required';
    end if;

    -- Get the session record and verify it exists
    select * into session_record
    from recording_sessions
    where code = pairing_code
    and type = 'code_editor'
    and status = 'recording';

    if not found then
        raise exception 'Active code editor session not found for pairing code: %', pairing_code;
    end if;

    -- Insert the event batch
    insert into editor_event_batches (
        session_id,
        timestamp_start,
        timestamp_end,
        events,
        event_count,
        created_at
    ) values (
        session_record.id,
        timestamp_start,
        timestamp_end,
        events,
        event_count,
        now()
    )
    returning id into batch_id;

    -- Return success response
    return json_build_object(
        'success', true,
        'batch_id', batch_id,
        'message', 'Event batch stored successfully'
    );
exception
    when others then
        raise exception 'Error storing event batch: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.store_editor_event_batch to authenticated;

-- Create function to store editor snapshots
create or replace function public.store_editor_snapshot(
    pairing_code text,
    event_index integer,
    "timestamp" bigint,
    content text,
    metadata jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    session_record record;
    snapshot_id uuid;
begin
    -- Input validation
    if pairing_code is null or pairing_code = '' then
        raise exception 'Pairing code is required';
    end if;

    -- Get the session record and verify it exists
    select * into session_record
    from recording_sessions
    where code = pairing_code
    and type = 'code_editor'
    and status = 'recording';

    if not found then
        raise exception 'Active code editor session not found for pairing code: %', pairing_code;
    end if;

    -- Insert the snapshot
    insert into editor_snapshots (
        session_id,
        event_index,
        "timestamp",
        content,
        metadata,
        created_at
    ) values (
        session_record.id,
        event_index,
        "timestamp",
        content,
        metadata,
        now()
    )
    returning id into snapshot_id;

    -- Return success response
    return json_build_object(
        'success', true,
        'snapshot_id', snapshot_id,
        'message', 'Snapshot stored successfully'
    );
exception
    when others then
        raise exception 'Error storing snapshot: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.store_editor_snapshot to authenticated; 