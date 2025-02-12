-- Create the videos storage bucket
insert into storage.buckets
    (id, name, public)
select 'videos', 'videos', true
where not exists (
    select 1 from storage.buckets where id = 'videos'
);

-- Set up RLS policies for the bucket
create policy "Videos are publicly accessible"
    on storage.objects for select
    using ( bucket_id = 'videos' );

create policy "Users can upload videos"
    on storage.objects for insert
    with check (
        bucket_id = 'videos' and
        auth.role() = 'authenticated' and
        -- Allow uploads to directories owned by the user
        (split_part(name, '/', 1))::uuid in (
            select id from videos where profile_id = auth.uid()
        )
    );

create policy "Users can update their videos"
    on storage.objects for update
    using (
        bucket_id = 'videos' and
        auth.role() = 'authenticated' and
        -- Allow updates to directories owned by the user
        (split_part(name, '/', 1))::uuid in (
            select id from videos where profile_id = auth.uid()
        )
    );

create policy "Users can delete their own videos"
    on storage.objects for delete
    using (
        bucket_id = 'videos' and
        auth.role() = 'authenticated' and
        -- Allow deletes in directories owned by the user
        (split_part(name, '/', 1))::uuid in (
            select id from videos where profile_id = auth.uid()
        )
    ); 