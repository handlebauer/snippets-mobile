create table if not exists public.videos (
    id uuid default gen_random_uuid() primary key,
    profile_id uuid references public.profiles(id) on delete cascade not null,
    name text not null,
    storage_path text not null,
    duration integer, -- in seconds
    size bigint, -- in bytes
    mime_type text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    
    constraint name_length check (char_length(name) >= 1)
);

-- Set up Row Level Security (RLS)
alter table public.videos enable row level security;

-- Create policies
create policy "Videos are viewable by everyone"
    on videos for select
    using ( true );

create policy "Users can insert their own videos"
    on videos for insert
    with check ( auth.uid() = profile_id );

create policy "Users can update their own videos"
    on videos for update
    using ( auth.uid() = profile_id );

create policy "Users can delete their own videos"
    on videos for delete
    using ( auth.uid() = profile_id );

-- Create indexes
create index videos_profile_id_idx on public.videos (profile_id);
create index videos_created_at_idx on public.videos (created_at desc);

-- Set up realtime
alter publication supabase_realtime add table videos;

-- Function to automatically update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Trigger to call the function
create trigger handle_videos_updated_at
    before update on videos
    for each row
    execute function handle_updated_at(); 