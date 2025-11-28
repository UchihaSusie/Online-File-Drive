# Cloud Drive – Local Development Guide

## 1. Install Dependencies

The helper script will run `npm install` where necessary, but you can pre-install:

```
cd backend && npm install

cd file-management && npm install

cd metadata-service && npm install
```
---

## 2. Configure AWS Credentials

The local stack expects an AWS profile and default region `us-east-1`.

export AWS_PROFILE=your_profile_name

export AWS_REGION=us-east-1

(Override these before running the start script if you use different values.)

---

## 3. Start the Entire Stack

You can deploy services to AWS using `file-management/scripts/deploy-v2.sh` and `metadata-service/scripts/deploy.sh`(See Readme.md under each folder), and start:
- Auth Service (`backend/src/index.js`) on **3000**
- Frontend (`python3 -m http.server`) on **8080**

Or use the helper script in the repo root to run locally.

First, deploy metadata-service, in your terminal, run:
```
cd metadata-service

./scripts/deploy.sh
```
In `start-all.sh`, replace `METADATA_SERVICE_URL` with the URL you get after you deploy the service.
Then:
```
./start-all.sh
```

It:
1. Kills anything running on ports 3000, 3002, and 8080
2. Installs dependencies for services if needed
3. Starts:
   - Auth Service (`backend/src/index.js`) on **3000**
   - File Management Service (`file-management/src/app.js`) on **3002**
   - Frontend (`python3 -m http.server`) on **8080**
4. Creates a `.env` for the File Management service pointing to:
   - `AUTH_SERVICE_URL=http://localhost:3000`
   - `METADATA_SERVICE_URL=`(Replace with the URL you get after you deploy metadata service)
   - **Metadata Service URL**: To use a local Metadata service, start it (`cd metadata-service && npm start`) and update the `.env` accordingly.
   - `S3_BUCKET_NAME=6620-cloud-drive-files` (ensure this bucket exists)
   - `AWS_REGION=us-east-1`

The script prints log locations (`/tmp/auth-service.log`, etc.) and opens `http://localhost:8080`.

---

## 6. Use the App

Open your browser to `http://localhost:8080`:

- Register or log in (Auth service)
- Upload/download/move files and folders (File Management + S3)
- Search and sort files (Metadata/Search service via deployed API Gateway)

Watch the log files for troubleshooting.

---

## 7. Stop All Services

Press `Ctrl+C` in the terminal running `start-all.sh`, 

or run:

```
./stop-all.sh
```

This script reads service PIDs from `/tmp/cloud-drive-pids.txt` and stops them.

---
