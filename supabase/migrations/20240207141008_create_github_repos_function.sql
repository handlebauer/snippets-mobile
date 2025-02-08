-- Enable http extension for making external API calls
create extension if not exists http with schema extensions;

-- Function to get GitHub repos for a session
create or replace function public.get_github_repos_for_session(pairing_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    session_user_id uuid;
    user_github_token text;
    user_github_username text;
    response json;
    session_record record;
begin
    -- Input validation
    if pairing_code is null or pairing_code = '' then
        raise exception 'Pairing code is required';
    end if;

    -- Get the user_id from the recording session with additional logging
    select * into session_record
    from recording_sessions
    where code = pairing_code;

    if not found then
        raise exception 'Pairing code not found: %', pairing_code;
    end if;

    session_user_id := session_record.user_id;

    -- Get the GitHub token and username from the user's profile
    select github_access_token, github_username into user_github_token, user_github_username
    from profiles
    where id = session_user_id;

    if not found then
        raise exception 'User profile not found for user_id: %', session_user_id;
    end if;

    if user_github_token is null then
        raise exception 'User not connected to GitHub (user_id: %)', session_user_id;
    end if;

    -- Make HTTP request to GitHub API using the http extension
    select content::json into response
    from extensions.http(
        (
            'GET',
            'https://api.github.com/user/repos',
            ARRAY[
                ('Authorization', 'Bearer ' || user_github_token),
                ('Accept', 'application/vnd.github.v3+json'),
                ('User-Agent', 'snippets-app')
            ]::extensions.http_header[],
            null,
            null
        )::extensions.http_request
    );

    if response is null then
        raise exception 'Failed to fetch repositories from GitHub';
    end if;

    -- Return formatted response
    return json_build_object(
        'repos',
        (
            select json_agg(
                json_build_object(
                    'name', repo->>'name',
                    'full_name', repo->>'full_name'
                )
            )
            from json_array_elements(response) as repo
        )
    );
exception
    when others then
        -- Include the original error message in the raised exception
        raise exception 'Error in get_github_repos_for_session: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
end;
$$;

-- Function to update repository for a session
create or replace function public.update_session_repository(pairing_code text, repository_name text)
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

    -- Get the session record
    select * into session_record
    from recording_sessions
    where code = pairing_code;

    if not found then
        raise exception 'Session not found for pairing code: %', pairing_code;
    end if;

    -- Update the repository
    update recording_sessions
    set linked_repo = repository_name
    where code = pairing_code;

    -- Return success response
    return json_build_object(
        'success', true,
        'message', 'Repository updated successfully'
    );
exception
    when others then
        -- Include the original error message in the raised exception
        raise exception 'Error in update_session_repository: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
end;
$$; 