# Security and privacy

Yoshida is a local hackathon prototype. It is not ready to process real callers or to run as a public credentialed service. Known access-control and prototype boundaries are documented in the [README](README.md#limitations-and-boundaries).

Do not include secrets, real contact details, recordings, transcripts, or database dumps in issues or pull requests. Use GitHub's private vulnerability reporting on the Security tab for a sensitive report; use a public issue only for a fully synthetic reproduction that contains no sensitive details.

If a credential may have been published, revoke or rotate it with its provider before cleaning Git history. Update local/deployment credentials and review provider access logs. Removing a file or rewriting a branch does not invalidate credentials or erase clones, forks, caches, or pull-request refs.

Before rewriting shared history, retain a verified private backup and coordinate with collaborators. Never upload recovery bundles or scanner reports containing raw matches to this repository.
