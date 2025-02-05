-- Create the videos storage bucket
insert into storage.buckets
    (id, name, public)
values
    ('videos', 'videos', true);

-- Set up RLS policies for the bucket
create policy "Videos are publicly accessible"
    on storage.objects for select
    using ( bucket_id = 'videos' );

create policy "Users can upload videos"
    on storage.objects for insert
    with check (
        bucket_id = 'videos' and
        auth.role() = 'authenticated'
    );

create policy "Users can update their own videos"
    on storage.objects for update
    using (
        bucket_id = 'videos' and
        auth.uid() = (
            select profile_id
            from videos
            where storage_path = name
            limit 1
        )
    );

create policy "Users can delete their own videos"
    on storage.objects for delete
    using (
        bucket_id = 'videos' and
        auth.uid() = (
            select profile_id
            from videos
            where storage_path = name
            limit 1
        )
    ); 