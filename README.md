# PantherSearch

This repository contains the `panthersearch` web application and related tooling.

## Project Structure

- `panthersearch/` - Fullstack app (frontend + backend) in TS/Node.
- `panthersearch-client/` - Client-only frontend.
- `panthersearch-server/` - Python backend (FastAPI) and related services.

## Getting Started

### 1) Install Git (required for version control)

1. Download and install Git for Windows: https://git-scm.com/download/win
2. Configure your name and email:
   ```sh
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```

### 2) Initialize the repository

```sh
cd "C:\Users\Lab\Documents\New project"
git init
git add .
git commit -m "Initial commit"
```

### 3) Create a GitHub repository

1. Go to https://github.com/new and create a new repository.
2. Add the GitHub remote and push:
   ```sh
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git branch -M main
   git push -u origin main
   ```

## Next Steps

- Install dependencies in the subprojects and run the dev servers. See each subfolder's `README` or package scripts for details.
- Add a license file if desired.
