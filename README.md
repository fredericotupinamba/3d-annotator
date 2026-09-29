# 3D-Annotator

> **Fork notice:** This repository is an edited copy of the original [3D-Annotator](https://github.com/3D-Annotator/3D-Annotator) project. All credit for the original design, research and implementation goes to the original authors — see [Authors](#authors) below. This fork adds point-cloud specific changes on top of the upstream project, including a precision fix for models with large absolute coordinates, and support for coloring/filtering point clouds by scalar fields (e.g. intensity, classification) read from `.ply` files. It may otherwise diverge from the upstream project over time.

### An open-source, web-based labeling tool for 3D data

![Annotator](https://github.com/3D-Annotator/3D-Annotator/assets/59662406/b0542488-5f19-456f-9ac7-feb74dbedea1)






https://github.com/user-attachments/assets/63018444-dab7-4e17-9a53-49f16f5cb2fb



# Introduction

The 3D‑Annotator is an open‑source, web‑based tool for labeling 3D data. It enables users to segment 3D meshes and point clouds into defined classes using different tools. We support both colored and textured meshes, and to accelerate the processing of large models, files are cached locally. If there are existing labels, such as those from a pre‑annotation task, they can be uploaded as a starting point.
Annotation modes can be selected per model to keep workflows clear and consistent: **triangle annotation** (mesh), **per‑pixel texture annotation** (mesh), and **point‑cloud annotation** (point clouds). Per‑pixel texture annotation labels texture pixels rather than triangles, enabling crisper detail at a given mesh resolution or high‑quality results with low‑poly geometry. A variety of tools supports different selection strategies across modes.
Designed with user‑friendliness and collaboration in mind, 3D‑Annotator offers straightforward user and project management features. This allows teams to work together on multiple models within a single project, utilizing a shared set of classes for consistent and coherent annotations, well suited for academic research and industrial applications.
Currently, our primary focus is on semantic segmentation. However, the tool’s modular design allows for easy adaptation to incorporate other methods, such as point cloud classification or 3D bounding boxes. Annotations can be exported as PNG or in our annotation-file format.

# Table of Contents

- [Introduction](#introduction)
- [Features](#features)
  - [Overview 3D-Annotator](#overview-3d-annotator)
  - [Project management](#project-management)
  - [Annotation file](#annotation-file)
- [Getting started](#getting-started)
  - [Browser support](#browser-support)
  - [Dev server](#dev-server)
  - [Deploy](#deploy)
- [How to Install and Run](#how-to-install-and-run)
  - [Prerequisites](#prerequisites)
  - [1. Backend setup](#1-backend-setup)
  - [2. Frontend setup](#2-frontend-setup)
  - [3. Open the app](#3-open-the-app)
  - [Default accounts (sample data)](#default-accounts-sample-data)
  - [Troubleshooting](#troubleshooting)
  - [Alternative: Docker deployment](#alternative-docker-deployment)
    - [How the pieces fit together](#how-the-pieces-fit-together)
    - [1. Prerequisites](#1-prerequisites)
    - [2. Build the two images](#2-build-the-two-images)
    - [3. Create deployment/.env](#3-create-deploymentenv)
    - [4. Add the TLS certificate](#4-add-the-tls-certificate)
    - [5. Point the domain at this machine](#5-point-the-domain-at-this-machine)
    - [6. Start the stack](#6-start-the-stack)
    - [Updating / redeploying](#updating--redeploying)
    - [Docker troubleshooting](#docker-troubleshooting)
- [Technical details](#technical-details)
- [Dataset references](#dataset-references)
- [Future plans](#future-plans)
- [Authors](#authors)

# How to Install and Run

This section walks through running 3D-Annotator locally from scratch: a Django backend (API) and a React/Vite frontend (SPA), running as two separate dev servers. This is the recommended way to run the project for local use or evaluation. See [Deploy](#deploy) / [Alternative: Docker deployment](#alternative-docker-deployment) for a production-style setup instead.

## Prerequisites

- **Python 3.10** (3.11 also works)
- **Node.js ≥ 22** — check with `node --version`. On Windows without a version manager, the quickest way to get an up to date version is `winget install OpenJS.NodeJS.LTS`.
- **pnpm**, enabled via Node's built-in Corepack (see step 2)
- A modern Chromium-based browser (Chrome 86+) to actually use the app

## 1. Backend setup

All commands below are run from the `backend/` directory.

```bash
cd backend

# create and activate a virtual environment
python -m venv .venv
source ./.venv/bin/activate        # macOS/Linux
# .\.venv\Scripts\activate         # Windows (cmd/PowerShell)

# install dependencies
pip install -r requirements.txt

# create the database
python manage.py migrate

# optional, but recommended: creates a superuser + sample
# users/projects/labels to explore right away (see credentials below)
echo "import annotator.backend.sample_data.initializeSampleData" | python manage.py shell

# start the dev server (http://127.0.0.1:8000)
export DJANGO_DEBUG=true           # macOS/Linux
# $env:DJANGO_DEBUG="true"         # Windows PowerShell
python manage.py runserver
```

Leave this running in its own terminal. See [backend/README.md](./backend/README.md) for all available environment variables.

## 2. Frontend setup

In a **second terminal**, from the `frontend/` directory:

```bash
cd frontend

# enable pnpm (bundled with Node via Corepack)
corepack enable
# if that fails with a permission error (common on Windows when Node is
# installed under Program Files), install pnpm globally instead:
# npm install -g pnpm

pnpm install

# generate the i18n translation files (not checked into git,
# required once before the first start/build)
pnpm i18n

pnpm start
```

Before the first run, create a `frontend/.env.local` file pointing at the backend:

```
ANNOTATOR_3D_API_BASE_URL=http://127.0.0.1:8000/api
```

The frontend dev server runs at **http://localhost:3000**.

## 3. Open the app

With both servers running, open **http://localhost:3000** in Chrome and log in (see accounts below), or register a new user.

## Default accounts (sample data)

If you ran the sample data step above, these accounts are available:

| Username | Password | Notes |
| --- | --- | --- |
| `admin` | `1234` | Django superuser / admin |
| `testUser2` | `test12345` | has sample projects and labels already set up |
| `testUser3`–`testUser5` | `test12345` | additional sample users |

Sample data is defined in [`backend/annotator/backend/sample_data/sampleData.py`](./backend/annotator/backend/sample_data/sampleData.py) and can be customized before running the shell command above.

## Troubleshooting

- **`corepack enable` fails with `EPERM`/permission denied**: happens when Node is installed in a location your user can't write to (e.g. `Program Files` on Windows). Run `npm install -g pnpm` instead, or re-run `corepack enable` from an elevated/administrator terminal.
- **`pnpm install` fails on the `prepare` (husky) step with "`.git` can't be found"**: this is a known Husky quirk when installing from the `frontend/` subfolder on some setups. It only affects the git pre-commit hook (code formatting on commit), not the app itself — safe to ignore for local use. Run `npx husky install` from the repository root afterwards if you want the hook installed.
- **Blank page / import errors mentioning `i18n-types`**: make sure you ran `pnpm i18n` at least once — those files are generated, not committed to git.
- **Large file uploads fail with "BaseFile is too large"**: the backend caps upload size via `ANNOTATOR_BACKEND_MAX_FILE_SIZE` (default 1 GiB). Increase it as an environment variable on the backend if your models are larger.

## Alternative: Docker deployment

The [`deployment/`](./deployment/) folder contains a production-style setup: two Docker images (backend + frontend) sitting behind [Traefik](https://traefik.io/) as a reverse proxy that terminates HTTPS. It **requires a domain name and a TLS certificate** — some browser features this app relies on only work in a secure context. It is not needed for local development; use the [dev server setup](#how-to-install-and-run) above for that instead.

### How the pieces fit together

- **`traefik`** — the only container exposed to the internet (ports 80/443). Port 80 redirects to 443. It reads `ANNOTATOR_DEPLOYMENT_DOMAIN` from each container's labels to decide where to route a request.
- **`api`** — the Django backend, served by gunicorn. Handles everything under `/api/*`, except the one path below.
- **`static`** — an nginx server that serves the built frontend (the SPA) for every other path, **and** serves `/api/static` (Django's collected static files, e.g. for the admin panel) directly from a volume shared with the `api` container.

All three containers are defined in [`deployment/docker-compose.yml`](./deployment/docker-compose.yml). Note that it references images by name (`image:`, not `build:`) — you build them yourself first (step 2 below), it doesn't build them for you.

### 1. Prerequisites

- Docker and Docker Compose (`docker compose version`)
- A domain name pointing at the machine you're deploying to — or, for local testing only, an entry in your `hosts` file pointing a made-up domain at `127.0.0.1` (see step 5)
- A TLS certificate + private key for that domain (e.g. from [Let's Encrypt](https://letsencrypt.org/)/`certbot`, or a self-signed one for local testing)

### 2. Build the two images

Both Dockerfiles are written to be built **from the repository root** (not from `deployment/`), since they need access to both `backend/` and `frontend/`:

```bash
# from the repository root
docker build -f deployment/api/Dockerfile -t 3d-annotator-api:latest .

docker build -f deployment/static/Dockerfile \
  --build-arg API_BASE=https://YOUR_DOMAIN/api \
  --build-arg TITLE="3D-Annotator" \
  -t 3d-annotator-static:latest .
```

⚠️ `API_BASE` is baked into the frontend at **build time** (it's a Vite env var resolved during `pnpm build` inside the image) — it must already be your real domain, and you'll need to rebuild the `static` image if it ever changes.

### 3. Create `deployment/.env`

Docker Compose automatically loads a `.env` file from its working directory. Create `deployment/.env` (it's git-ignored) with:

```dotenv
# the image tags you built in step 2
ANNOTATOR_IMAGE_NAME_FULL_API=3d-annotator-api
ANNOTATOR_IMAGE_NAME_FULL_STATIC=3d-annotator-static

# your domain (must match the certificate and API_BASE from step 2)
ANNOTATOR_DEPLOYMENT_DOMAIN=YOUR_DOMAIN

# Django
ANNOTATOR_BACKEND_DEBUG=false
ANNOTATOR_BACKEND_SECRET_KEY=replace-with-a-long-random-string
ANNOTATOR_BACKEND_ALLOWED_HOSTS=YOUR_DOMAIN
ANNOTATOR_BACKEND_CSRF_TRUSTED_ORIGINS=https://YOUR_DOMAIN
ANNOTATOR_BACKEND_TOKEN_PER_USER=1
ANNOTATOR_BACKEND_MAX_FILE_SIZE=1

# initial Django admin account, created on first start
ANNOTATOR_BACKEND_SU_NAME=admin
ANNOTATOR_BACKEND_SU_EMAIL=admin@example.com
ANNOTATOR_BACKEND_SU_PASSWORD=replace-with-a-strong-password

# gunicorn
ANNOTATOR_BACKEND_TIMEOUT=1800
ANNOTATOR_BACKEND_NUM_WORKERS=1

# host UID/GID that should own files written to ./api (static/media/db),
# so they aren't owned by root — on Linux/macOS run `id -u` and `id -g`
ANNOTATOR_BACKEND_UID=1000
ANNOTATOR_BACKEND_GID=1000
```

Generate a real secret key with e.g. `python -c "import secrets; print(secrets.token_urlsafe(50))"`.

### 4. Add the TLS certificate

Docker Compose mounts `deployment/certs/` (git-ignored) into the Traefik container as `/certs`. Put your certificate and key there, then point to them in [`deployment/traefik/dynamic.yml`](./deployment/traefik/dynamic.yml):

```yaml
tls:
  certificates:
    - certFile: /certs/your-cert.pem
      keyFile: /certs/your-key.pem
```

**Just testing locally?** Generate a self-signed certificate instead (browsers will show a security warning, which is expected):

```bash
mkdir -p deployment/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout deployment/certs/local-key.pem \
  -out deployment/certs/local-cert.pem \
  -subj "/CN=YOUR_DOMAIN"
```

### 5. Point the domain at this machine

For a real server, create a DNS `A` record for your domain pointing at its public IP. For local-only testing, add a line to your hosts file instead (`/etc/hosts` on macOS/Linux, `C:\Windows\System32\drivers\etc\hosts` on Windows, needs admin rights to edit):

```
127.0.0.1 YOUR_DOMAIN
```

### 6. Start the stack

```bash
cd deployment
docker compose up -d
docker compose logs -f   # watch startup, Ctrl+C to stop watching (containers keep running)
```

Open `https://YOUR_DOMAIN` in your browser and log in with `ANNOTATOR_BACKEND_SU_NAME` / `ANNOTATOR_BACKEND_SU_PASSWORD` from your `.env`.

### Updating / redeploying

After pulling new code, rebuild the image(s) that changed (step 2) and recreate the containers:

```bash
cd deployment
docker compose up -d
```

Compose only recreates containers whose image actually changed, so this is safe to run after every rebuild. Django migrations and `collectstatic` run automatically on every `api` container start (see [`deployment/api/entrypoint.sh`](./deployment/api/entrypoint.sh)).

### Docker troubleshooting

- **Compose can't find the image / tries to pull from Docker Hub**: the image name in `.env` must exactly match the `-t` tag you used in `docker build` (step 2). Compose only builds nothing itself here — always build first.
- **Superuser creation logs an error on every restart**: expected once an admin user already exists (`createsuperuser --noinput` refuses to create a duplicate) — harmless, gunicorn still starts right after.
- **Browser refuses to load the page / mixed content errors**: double-check `API_BASE` (step 2) and `ANNOTATOR_BACKEND_CSRF_TRUSTED_ORIGINS` (step 3) both use `https://` and the exact same domain as the certificate.

# Features

## Overview 3D-Annotator

![AnnotatorOverview](https://github.com/user-attachments/assets/3796a2d3-af61-46d7-b647-87bbb9a64c52)

### Tools

3D-Annotator is equipped with a suite of powerful and intuitive tools designed to facilitate precise and efficient labeling of 3D data. These tools cater to various annotation needs, whether you're working with detailed meshes or dense point clouds.

#### 3D-Brush



https://github.com/user-attachments/assets/61221b59-2589-4fed-8325-4777a1935f9e



This tool functions as a movable sphere that allows users to paint labels onto the mesh or point cloud. As you maneuver the sphere across your model, all points, triangles or pixels within its radius are labeled. This method is particularly useful for quickly annotating large areas with precision.

#### Lasso



https://github.com/user-attachments/assets/1283bf76-4e64-42a0-9549-8d7f8b8c0750



The Lasso tool is designed for freeform selection, giving users the ability to label complex shapes and regions. By drawing a freeform shape around the desired area, users can select all points, triangles or pixels contained† within the lasso in both the foreground and background.

† Mesh supports Centroid, Intersection, and Contain modes


#### Polygon



https://github.com/user-attachments/assets/c7965d46-219d-456f-a961-0fb874f7de1d



The Polygon tool provides structured selections. Set corner points to create a polygon and adjust it before finalizing to ensure only the intended area is labeled. This method provides greater control over the labeling process, ensuring that only the intended areas are annotated.

#### Brush (Point cloud only)



https://github.com/user-attachments/assets/e422b7ac-9d99-4922-a95c-f3ecf3ac6ebe



The Brush tool for point clouds operates similarly to the 3D-Brush. It features a movable circle that selects and labels all points within its boundary, regardless of their depth relative to the camera. This tool is ideal for point cloud data, providing a straightforward and effective means of annotating large swathes of points with minimal effort.

#### Fill



https://github.com/user-attachments/assets/5193e6c1-9476-41d6-80c0-d008e1e63920




A one‑click action that assigns the selected label to all pixels. Elements already labeled with locked labels are not overwritten.

#### Triangle (Texture (per‑pixel) only)



https://github.com/user-attachments/assets/56297d35-65b9-4155-90d0-863c06642ffe




Click a triangle of the mesh to label all texture pixels mapped to that triangle. Works like triangle labeling in mesh mode, but writes the label to the corresponding pixels instead of the triangle element.

#### Pixel-Brush (Texture (per‑pixel) only)



https://github.com/user-attachments/assets/55924a04-e03d-4993-8c81-3aa999e6f18b



Labels exactly one texture pixel at the mouse cursor. Useful for fixing the last little details.

### Menus

#### Settings

The main settings menu, lets you adjust settings for each tool, and some general settings.
All the settings are client-side and persistent so they stay the same after reloading. You can revert to the default by double-clicking at the default value.

#### Labels

The Labels menu displays all the labels defined for the current project. This menu is essential for managing and applying labels during the annotation process.
You can collapse and expand it by clicking on the selected label at the top.
You can select the label you want to use, by clicking on it.
You can toggle the visibility of each label by clicking on the colored dot next to the label.
The lock button lets you lock the label, so the points and triangles, that are already labeled with that label, can`t be overwritten.
It also has an opacity slider to control the opacity of the label colors, to see the texture better.

#### Views

To switch to predefined perspectives or reset the camera, 6 views are available: top, bottom, left, right, front and back

#### Camera

In the camera menu, you can enable the gizmo and switch the camera between a perspective and an orthographic camera.
You can also change the FOV of the perspective camera.

#### Lighting

The lighting menu consists of a global light and a directional light, the sun.
You can change the brightness of both individually.
You can either set the position of the sun to one of the 6 axis positions, or set it to the current camera position.
The follow camera switch, lets the sun follow the camera, so it works like a headlight.

#### Points (point cloud only)

The points menu has a slider to adjust the size of the points.

## Project management

Project management consists of projects, where users can add members and upload 3D-models. Each Project has shared labels, that can be used in all 3D-model annotations.

### Create project

A project has to have a name and a description. The creator of the project is the owner and has special rights in the project. He can add and remove members and can delete the project. Regular members can only leave the project.

### Add models

You can add 3D-models to a project. A model consist of a model file and optionally a texture and an annotation file. You can either choose multiple files or a whole directory. After your selection, the files will be automatically combined, if the model file name is a prefix of the texture and annotation file. The name of the model defaults to the models file name but can be changed easily. You can also manually change the texture and annotation files or remove them. Texture files need to be .jpeg. Annotation files can be either .anno3d, .txt or in mesh texture mode also .png. In mesh texture mode, the texture and annotation files can only have up the maximum size of the html canvas, which can be found here: https://jhildenbiddle.github.io/canvas-size/#/?id=test-results

### Add and remove labels

You can add labels for a project. Those are used to annotate the models. Each label has a name, color and an annotation class used in the annotation file. You have to add all labels that are used in a model in order to open it.

### Add and remove members

Collaboration is at the heart of 3D-Annotator’s project management. The owner can invite and remove members.

## Annotation File

Annotations can be imported and exported from or into a simple file format called anno3d.
The file format is designed to be easily serializable and parsable.

There are three different possible targets. Support depends on the annotation mode (point-cloud, mesh, texture):

- UTF-8 (supported by all modes, human-readable)\
  Refer to the [spec](./frontend/src/anno3d/v2/targets/utf8/Specification.md) for detailed information.
- Binary (supported by all modes)\
  Refer to the [spec](./frontend/src/anno3d/v2/targets/binary/Specification.md) for detailed information.
- PNG (supported only by texture mode, human-readable depending on the configuration)\
  Refer to the [spec](./frontend/src/anno3d/v2/targets/png/Specification.md) for detailed information.

Earlier version of the 3D-Annotator used a now deprecated version of anno3d that only supported UTF-8.
A simple description can be found [here](./frontend/src/anno3d/v1/Specification.md).
This old version is still supported for imports but can not be exported anymore.

# Getting started

## Browser support

This project has only been tested on Chrome 86 or newer. Since Firefox and Safari added support for a critical feature in March 2023, they are also expected to work but have not yet been tested enough.

## Dev server

Follow the READMEs of the respective subfolders [backend](./backend/README.md) and [frontend](./frontend/README.md).

## Deploy

Docker files for both backend (api) and frontend (static file server) and the corresponding Docker compose configuration are provided in the [deployment](./deployment/) subfolder.
Please note, that some browser features used by this application require a secure context (https) and cross origin isolation.

# Technical details

This project is build on a simple RESTful backend in python using [django](https://www.djangoproject.com/) and [django-rest-framework](https://github.com/encode/django-rest-framework) and an extensive single page application frontend in TypeScript using [react](https://github.com/facebook/react) and [threejs](https://github.com/mrdoob/three.js). The annotation core is decoupled from react and can be adapted to different frontend frameworks.

## Project structure

- backend (django-rest-framework project)
- frontend (client SPA)
  - src/anno3d (parser and serializer of the export file format)
  - src/annotator (the annotation core)
    - annotation (everything handling the actual annotation)
    - files (helpers to manage access to the persistent file cache)
    - scene (threejs specific code such as camera controls/model loaders etc.)
    - tools (the tool plugin interface and the actual tools)
  - src/api (simple axios wrapper to interact with the backend REST API)
  - src/cache (persistent file caching using the origin private file system browser api)
  - src/codecs (cache and worker codecs for application entities and three js primitives)
  - src/entity (shared types, interfaces and classes between annotator, api, and ui)
  - src/events (helpers for event subscription and dispatching)
  - src/i18n (internationalization)
  - src/settings (signal based settings with persistence)
  - src/ui (the component based ui containing all react code)
  - src/util (shared utilities)
  - src/workers (worker orchestration and declarative context transfers)
- deployment (docker files for deployment)

# Dataset references

## H3D dataset
https://ifpwww.ifp.uni-stuttgart.de/benchmark/hessigheim/default.aspx

```bibtex
@article{KOLLE2021100001,
         title = {The Hessigheim 3D (H3D) benchmark on semantic segmentation of high-resolution 3D point clouds and textured meshes from UAV LiDAR and Multi-View-Stereo},
         journal = {ISPRS Open Journal of Photogrammetry and Remote Sensing},
         author = {Michael Kölle and Dominik Laupheimer and Stefan Schmohl and Norbert Haala and Franz Rottensteiner and Jan Dirk Wegner and Hugo Ledoux},
}
```

## UseGeo dataset
https://usegeo.fbk.eu/

```bibtex
@article{NEX2024100070,
         title = {UseGeo - A UAV-based multi-sensor dataset for geospatial research},
         journal = {ISPRS Open Journal of Photogrammetry and Remote Sensing},
         author = {F. Nex and E.K. Stathopoulou and F. Remondino and M.Y. Yang and L. Madhuanand and Y. Yogender and B. Alsadik and M. Weinmann and B. Jutzi and R. Qin}
}

@article{Hermann2024usegeo,
         title   = {Depth estimation and 3D reconstruction from UAV-borne imagery: Evaluation on the UseGeo dataset},
         journal = {ISPRS Open Journal of Photogrammetry and Remote Sensing},
         author  = {M. Hermann and M. Weinmann and F. Nex and E.K. Stathopoulou and F. Remondino and B. Jutzi and B. Ruf},
}
```

# Future plans

- [x] add different segmentation types
- [ ] add support for classification
- [ ] add support for bounding boxes
- [ ] add models for pre-annotation
- [ ] add methods for geometric segmentation to accelerate labeling

# Authors

The project is currently maintained and developed by:
- [Moritz Hertler](https://github.com/moritzhertler)
- [Linus Wilkins](https://github.com/linuswilkins)
- [Max Hermann](https://github.com/max-hermann)

This project was initiated as part of PSE at the Karlsruhe Institute of Technology (KIT) in the summer term of 2022 by

- Valentin Dold
- Moritz Hertler
- Florian Hüther
- Lukas Kirsch
- Linus Wilkins

Supervisors: Max Hermann & Stefan Wolf
Fraunhofer IOSB, Karlsruhe
