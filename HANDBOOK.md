# Daily Logger Activity Dashboard Handbook

## 1. Overview
The **Daily Logger** is a comprehensive daily habit and activity tracker. It features a clean, native Activity Dashboard designed to seamlessly organize, store, and display personal logs and contextual notes.

## 2. Interface and User Experience
The application's frontend is built for clarity, readability, and rapid data retrieval:
*   **Activity Dashboard:** The central UI hub for monitoring daily habits and routines.
*   **Interactive Calendar:** A top-level horizontal calendar component allows users to scroll through weeks, select specific dates (e.g., Thursday, February 24, 2022), and instantly snap back to "Today".
*   **Logged Activities View:** Displays daily records as distinct, readable cards under the selected date.
*   **Category Tags:** Each entry card prominently displays its associated category tag (e.g., "Guruhari Darshan") alongside the timestamp.
*   **Native Text Rendering:** The UI is highly optimized to display complex typography cleanly, natively supporting structured paragraphs, dialogue, and non-Latin scripts like Gujarati[cite: 4].

## 3. Database Architecture (Supabase)
The backend relies on PostgreSQL via Supabase, utilizing a strict relational structure to ensure data integrity:
*   **`categories` Table:** Manages unique UUIDs for distinct log types (e.g., "Guruhari Darshan").
*   **`daily_logs` Table:** The primary ledger. Key columns include:
    *   `id` (UUID, Primary Key)
    *   `log_date` (Date)
    *   `category_id` (Foreign Key linking to `categories`)
    *   `notes` (Text payload)
    *   `status` (Text, defaults to 'present')
    *   `photo_data` / `photo_url` / `photo_storage_path` (Optional media storage pointers)
    *   `created_at` / `updated_at` (Timestamps)

## 4. Data Ingestion Pipeline
To support bulk imports of legacy records (such as multi-year PDF diaries), the application utilizes a hybrid Node.js and Python pipeline to bypass formatting headaches:
*   **Step 1: Text Extraction (Python):** `pypdf` is used to natively extract raw text from heavily formatted documents, bypassing JavaScript module resolution conflicts.
*   **Step 2: Encoding Normalization (Python):** A custom cleaning script (`fix_encoding.py`) resolves legacy Gujarati font-encoding mismatches, mapping broken syllables and floating characters into proper, readable Unicode words[cite: 4].
*   **Step 3: Safe Parsing:** The system relies on precise regex matching to isolate specific date headers (e.g., "8 August 2021", "14 August 2021") and groups the subsequent text into discrete diary entries[cite: 4].
*   **Step 4: Bulk Uploading (Node.js):** Pure CommonJS scripts (`insertGuruhari.cjs`, `fixFailedDates.cjs`) read the cleaned `.txt` files, securely authenticate with Supabase, dynamically resolve the correct `category_id`, and execute batch-inserts (chunks of 50) directly into the `daily_logs` table.

## 5. Security & Authentication
*   **Environment Variables:** Supabase URLs and Anon Keys are securely injected via `.env` files.
*   **Authentication:** Administrative ingestion scripts securely authenticate using the application's email/password credentials to safely bypass Row Level Security (RLS) constraints and attach the correct `user_id` to the logs.