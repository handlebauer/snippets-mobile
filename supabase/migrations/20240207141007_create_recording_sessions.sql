-- Create recording_sessions table
create table public.recording_sessions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    code text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    linked_repo text,
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