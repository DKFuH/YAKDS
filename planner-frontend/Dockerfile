##
## Stage 1 – build
##
FROM node:22-slim AS build

WORKDIR /app

# Workspace manifests first for better layer caching.
COPY package*.json ./
COPY planner-frontend/package*.json ./planner-frontend/
COPY shared-schemas/package*.json ./shared-schemas/

RUN npm install --workspaces

COPY shared-schemas/ ./shared-schemas/
COPY planner-frontend/ ./planner-frontend/

RUN npm run build --workspace=@okp/shared-schemas
RUN npm run build --workspace=planner-frontend

##
## Stage 2 – serve
##
FROM nginx:alpine AS runtime

COPY planner-frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/planner-frontend/dist /usr/share/nginx/html

EXPOSE 80
