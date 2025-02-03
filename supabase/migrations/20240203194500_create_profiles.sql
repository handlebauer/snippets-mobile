create table if not exists public.profiles (
    id uuid references auth.users on delete cascade not null primary key,
    username text unique,
    avatar_url text,
    website text,
    updated_at timestamp with time zone,
    
    constraint username_length check (char_length(username) >= 3)
);

-- Set up Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Create policies
create policy "Public profiles are viewable by everyone"
    on profiles for select
    using ( true );

create policy "Users can insert their own profile"
    on profiles for insert
    with check ( auth.uid() = id );

create policy "Users can update their own profile"
    on profiles for update
    using ( auth.uid() = id );

-- Create indexes
create index profiles_username_idx on public.profiles (username);

-- Set up realtime
alter publication supabase_realtime add table profiles; 