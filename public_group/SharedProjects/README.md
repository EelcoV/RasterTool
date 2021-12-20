# Note on installation

Normally the directory `SharedProjects` must be writeable by the web server.
On many installations this can be accomplished by either `chown _www SharedProjects` or `chown www SharedProjects`,
followed by `chmod 0755 SharedProjects`.

When either the `classroom` or `localonly` option is true, the `SharedProjects` directory on the web server can be made read-only.
See `public_group/README.md` for details. 
