# Security and privacy

CleanVoice is a local hackathon prototype. It is not ready to process real callers or to run as a public credentialed service. Known boundaries and the missing backend are documented in the [README](README.md#limitations-and-boundaries).

Do not include secrets, real contact details, recordings, transcripts, or database dumps in issues or pull requests. Use GitHub's private vulnerability reporting on the Security tab for a sensitive report; use a public issue only for a fully synthetic reproduction that contains no sensitive details.

If a credential may have been published, revoke or rotate it with its provider before cleaning Git history. Update local/deployment credentials and review provider access logs. Removing a file or rewriting a branch does not invalidate credentials or erase clones, forks, caches, or pull-request refs.

History cleanup must follow the private backup and coordination procedure in [showcase audit](docs/showcase-audit.md). Never upload the recovery bundle or a scanner report containing raw matches to this repository.
