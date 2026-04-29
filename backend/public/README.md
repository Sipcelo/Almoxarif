# Frontend static artifact

This directory is the Railway deploy artifact for the current MVP frontend.

Railway is configured with root directory `/backend`, so files outside this
directory are not included in the service image. Keep this directory in sync
with the root `index.html`, `apiClient.js`, `front/`, and logo assets whenever
the legacy static frontend changes.
