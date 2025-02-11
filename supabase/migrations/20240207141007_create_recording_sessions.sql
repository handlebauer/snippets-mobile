-- Create session status enum
create type public.recording_session_status as enum ('draft', 'recording', 'saved', 'deleted');

-- Create recording_sessions table
create table public.recording_sessions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    code text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    linked_repo text,
    status recording_session_status default 'draft',
    constraint recording_sessions_code_key unique (code)
);

-- Create index for fast lookups on code field
create index recording_sessions_code_idx on public.recording_sessions (code);

-- Enable Row Level Security
alter table public.recording_sessions enable row level security;

-- Create policy for users to view only their own sessions
create policy "Users can view their own recording sessions"
    on public.recording_sessions for select
    using (auth.uid() = user_id);

-- Create policy for users to insert their own sessions
create policy "Users can insert their own recording sessions"
    on public.recording_sessions for insert
    with check (auth.uid() = user_id);

-- Create policy for users to update their own sessions
create policy "Users can update their own recording sessions"
    on public.recording_sessions for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Create policy for users to delete their own sessions
create policy "Users can delete their own recording sessions"
    on public.recording_sessions for delete
    using (auth.uid() = user_id);

-- Grant appropriate permissions to authenticated users
grant select, insert, update, delete on public.recording_sessions to authenticated;

-- Create function to update session status
create or replace function public.update_session_status(new_status recording_session_status, pairing_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    session_record record;
begin
    -- Input validation
    if pairing_code is null or pairing_code = '' then
        raise exception 'Pairing code is required';
    end if;

    if new_status is null then
        raise exception 'Status is required';
    end if;

    -- Get the session record
    select * into session_record
    from recording_sessions
    where code = pairing_code;

    if not found then
        raise exception 'Session not found for pairing code: %', pairing_code;
    end if;

    -- Update the session status
    update recording_sessions
    set status = new_status
    where code = pairing_code;

    -- Return success response
    return json_build_object(
        'success', true,
        'message', 'Session status updated successfully',
        'session_id', session_record.id,
        'new_status', new_status
    );
exception
    when others then
        -- Include the original error message in the raised exception
        raise exception 'Error in update_session_status: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.update_session_status to authenticated; 