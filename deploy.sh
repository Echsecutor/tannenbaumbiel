#!/bin/bash

set -e
set +x

git commit -am "Deploy" || true
git push
ssh hetz-echse-1 "cd tannenbaumbiel && git pull && docker compose -f docker-compose.prod.yml up --build -d"
