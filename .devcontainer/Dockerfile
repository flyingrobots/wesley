FROM mcr.microsoft.com/devcontainers/javascript-node:20@sha256:6b11eb762a2495180fb2ab97ee14bad9d5ab427298540ddd6d4c0aebc82a66eb

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
