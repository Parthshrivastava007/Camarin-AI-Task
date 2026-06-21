# AuraMedia - Asynchronous AI Media Processing Pipeline

AuraMedia is a production-grade microservice architecture designed to handle user image uploads, process them asynchronously through a multi-stage AI pipeline, and return enriched structured metadata to the user.

## Core Features

- **JWT Authentication**: Secure user registration and login endpoints protecting all services.
- **Asynchronous Processing**: Immediate Job ID return on image upload; processing occurs in the background.
- **Multi-Stage AI Pipeline**:
  1. **Image Captioning**: Natural language description via Salesforce BLIP on Hugging Face Inference API.
  2. **Object Detection**: Vision-based label extraction.
  3. **Content Safety**: Unsafe category scanning (Adult, Violence, Medical, Racy, Spoof).
- **Graceful Mock Fallbacks**: Works immediately out-of-the-box without requiring API keys. Trigger content safety flagging in mock mode using name keywords.
- **Real-Time Polling Dashboard**: Reactive React dashboard reflecting job state changes (pending, processing, completed, failed) with direct retry capability.
- **In-App Safety Alerts**: Persistent safety toast banners and notifications dropdown when uploaded files fail the safety checks.
- **Dockerized Environment**: Single `docker-compose up` setup launching MongoDB, Redis, API, Worker, and Frontend.

---

## System Architecture

![System Architecture Diagram](architecture_diagram.png)

```mermaid
graph TD
    User([User Client Browser]) <--> |1. React UI / Poll / Upload| API[Express API Server]
    
    subgraph Storage & Queue Infrastructure
        DB[(MongoDB Database)] <--> |Read/Write Job States & Auth| API
        Queue[Redis BullMQ Job Broker] <-- |2. Enqueue Job ID| API
        Vol[(Shared Docker Volume)] <--> |Write Images| API
    end
    
    subgraph Background Processing Layer
        Worker[BullMQ Worker Processor] <-- |3. Dequeue Job ID| Queue
        Worker <--> |Update Job Status & Results| DB
        Worker --> |4. Read Uploaded Image| Vol
        
        subgraph External AI Services (Fallback to Mock Mode if Keyless)
            Worker --> |Step 1: Captioning| HF[Hugging Face BLIP API]
            Worker --> |Step 2 & 3: Labels & SafeSearch| GCV[Google Cloud Vision API]
        end
    end
```

---

## Quick Start (Local Run)

You can spin up the entire multi-service application with Docker Compose.

### 1. Set environment variables (Optional)
Create an `.env` file in the root directory (or server directory) if you want to use live AI API connections:
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

## Detailed Tech Stack & Design Choices

### 1. Database & Queue
- **MongoDB & Mongoose**: Perfect for storing dynamic, enriched JSON metadata returned from different AI steps.
- **Redis & BullMQ**: A robust, transaction-supported message broker queue. We chose BullMQ because it handles automatic exponential backoff retries, process concurrency, and preserves job lifecycle state directly in Redis.

### 2. State & File Management
- **Shared Docker Volume (`uploads-data`)**: Images are uploaded to the API container and stored locally. A shared Docker volume maps `/app/uploads` in both the `api` and `worker` containers, allowing the worker to read the binary files directly without network transmission overhead.
- **JWT (JSON Web Token)**: Used for stateless authentication. Microservices can verify the user's signature without querying the database for every single request.

### 3. Verification & AI Mock Mode
- **Zero-Config Fallback**: If `HF_API_TOKEN` and `GOOGLE_API_KEY` are not set, the AI service shifts to Mock Mode.
- **Testing Safety Flags in Mock Mode**:
  To test flagged content handling in the UI, name your image file containing any of these keywords:
  - `unsafe` or `adult` $\rightarrow$ Triggers Adult safety flag (`VERY_LIKELY`)
  - `violence` or `blood` $\rightarrow$ Triggers Violence safety flag (`LIKELY`)
  - `racy` or `bikini` $\rightarrow$ Triggers Racy safety flag (`VERY_LIKELY`)
  - `medical` or `surgery` $\rightarrow$ Triggers Medical safety flag (`LIKELY`)

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
  - `POST /api/jobs/:id/retry`: Re-enqueue a failed job back to the BullMQ.

---

## Scaling to 10x Load (Discussion)

If the system experiences a 10x increase in load (e.g. 100+ images per second), we would see bottlenecks in disk space, CPU (for image resizing), and API rate limits. Here is how we would scale:

1. **Decouple Storage (Cloud Object Storage)**:
   - *Problem*: Shared local Docker volumes do not scale across multiple node hosts (e.g. in Kubernetes).
   - *Solution*: Swap the local disk storage with AWS S3, Google Cloud Storage, or Cloudflare R2. The API server uploads files directly to S3 and enqueues the S3 URL. The worker downloads files directly from the S3 URL, removing stateful disk dependencies.

2. **Horizontal Worker Scaling**:
   - *Problem*: AI API calls block worker slots, causing the queue to build up.
   - *Solution*: Scale the number of worker containers. Since BullMQ operates in a stateless manner with Redis coordinates, adding 10 more worker instances will distribute jobs evenly without race conditions. We can implement Autoscaling (KPA/HPA) based on queue size or queue delay metrics.

3. **Rate Limiting & Token Buckets**:
   - *Problem*: External APIs (Hugging Face / Google Vision) have rate limits and will start rejecting requests.
   - *Solution*: Configure BullMQ with rate limit limits per queue (e.g., `limiter: { max: 50, duration: 1000 }`) to regulate processing speed. Keep the images in the Redis queue and process them steadily without overwhelming external API quotas.

4. **Image Pre-processing at Edge / API**:
   - *Problem*: Transmitting large 5MB files to AI models consumes excessive bandwidth and slows processing.
   - *Solution*: Resize and compress images (e.g., limit dimensions to 1024x1024) at the API layer using a package like `sharp` before writing to storage, reducing payload sizes for the AI APIs by up to 90%.
