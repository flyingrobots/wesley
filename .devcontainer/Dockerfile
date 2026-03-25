FROM mcr.microsoft.com/devcontainers/javascript-node:22@sha256:a01a914a47f9693114101e24e1cdede1fa76a286f03ee98d11a373a64dbd0e5e

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bats \
        jq \
        postgresql \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Prepare pnpm home for the node user
RUN mkdir -p /home/node/.local/share/pnpm && chown -R node:node /home/node/.local/share/pnpm

USER node
