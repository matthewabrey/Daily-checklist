# ---------------------------------------------------------------
# Abreys Machine Checklist — single-service deployment
# Builds the React frontend, then runs the FastAPI backend which
# serves both the API and the built frontend on one port.
# Works on Railway, Render, or any Docker-based host.
# ---------------------------------------------------------------

# Stage 1: build the React frontend
FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install --legacy-peer-deps && npm install ajv@^8 --legacy-peer-deps
COPY frontend/ ./
# Empty backend URL = frontend calls the API on the same domain
ENV REACT_APP_BACKEND_URL=
ENV GENERATE_SOURCEMAP=false
# Admin password is baked in at build time; set this in your host's settings
ARG REACT_APP_ADMIN_PASSWORD
ENV REACT_APP_ADMIN_PASSWORD=$REACT_APP_ADMIN_PASSWORD
RUN npx craco build

# Stage 2: Python backend serving API + built frontend
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt qrcode pillow
COPY backend/ backend/
COPY --from=frontend-build /app/frontend/build frontend/build
WORKDIR /app/backend
EXPOSE 8000
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
