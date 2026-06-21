## System Architecture

![System Architecture Diagram](architecture_diagram.png)

## Quick Start (Local Run)

You can spin up the entire multi-service application with Docker Compose.

### 1. Set environment variables (Optional)
Create an `.env` file in the root directory if you want to use live AI API connections:
```env
# Hugging Face Inference API Token
HF_API_TOKEN=your_hugging_face_token_here

# Google Cloud Vision REST API Key
GOOGLE_API_KEY=your_google_cloud_vision_api_key_here
```

### 2. Launch Services
Run the following command in the root folder:
```bash
docker-compose up --build
```
This spins up:
- **MongoDB** on `mongodb://localhost:27017`
- **Redis** on `redis://localhost:6379`
- **Backend Express API** on `http://localhost:5000`
- **React Frontend** on `http://localhost:3000`
- **Worker Process** running in the background.

---

## Environment Variables & Obtaining API Keys

### 1. Hugging Face Inference API (`HF_API_TOKEN`)
Used by the background worker for Salesforce BLIP Image Captioning.
* **How to Obtain**:
  1. Register for a free account at [Hugging Face](https://huggingface.co/).
  2. Navigate to **Settings** $\rightarrow$ **Access Tokens** in your profile.
  3. Create a new token with **Read** access.
  4. Paste the value into `HF_API_TOKEN` in your `.env`.

### 2. Google Cloud Vision API Key (`GOOGLE_API_KEY`)
Used by the background worker for Label Detection and SafeSearch Content Safety annotations.
* **How to Obtain**:
  1. Log in to the [Google Cloud Console](https://console.cloud.google.com/).
  2. Create a new project or select an existing one.
  3. Enable the **Cloud Vision API** in the API Library.
  4. Navigate to **APIs & Services** $\rightarrow$ **Credentials**.
  5. Click **Create Credentials** and select **API Key**.
  6. Copy this API key and paste it into `GOOGLE_API_KEY` in your `.env`.

---

## API Endpoints Summary

For the full detailed documentation, check the [api-spec.yaml](file:///c:/Users/parth/Desktop/Camarin%20AI%20Task/api-spec.yaml) file.

- **Authentication**:
  - `POST /api/auth/register`: Signup new account.
  - `POST /api/auth/login`: Signin and get JWT token.
- **Media Jobs**:
  - `POST /api/jobs/upload`: Upload image (multipart/form-data, key: `image`). Returns `jobId` immediately.
  - `GET /api/jobs`: List user's jobs sorted by date.
  - `GET /api/jobs/:id`: Fetch specific job details and results.
  - `POST /api/jobs/:id/retry`: Re-enqueue a failed job.
  - `DELETE /api/jobs/:id`: Delete a job and its associated media file.

---

## Known Limitations & Future Improvements

If given more development time, the following improvements would be introduced:

1. **S3/Object Storage Integration**: Replace local disk storage with AWS S3 or Cloudflare R2 to allow horizontal worker containers to scale across multiple servers/regions.
2. **WebSocket Real-Time Updates**: Swap short polling with Socket.io / WebSockets for true instant updates and lower API server query overhead.
3. **Queue Rate Limiters**: Introduce strict token-bucket rate limiting on the worker queue to match the limits of Hugging Face and Google Cloud APIs to prevent quota errors under high traffic.
4. **File Clean Up Cron Job**: Implement a scheduled background job to automatically delete old uploaded media files from disk storage after 30 days to control disk usage.
5. **Secure Email Transport System**: Integrate SendGrid or Nodemailer to send actual emails for flagged uploads in addition to the current in-app Toast notifications.

---

