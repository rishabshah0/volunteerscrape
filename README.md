# CSR Opportunity Scraper

using LLMs to scrape for CSR opportunities

## Overview

This project is a full-stack application designed to scrape CSR opportunities from various websites, process the information using Large Language Models (LLMs), and display them in a clean, searchable web interface.

- **Backend**: A Python application using FastAPI, LangChain, and Playwright.
- **Frontend**: A Next.js application.
- **Database**: MongoDB.

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- MongoDB running locally or on a cloud service.
- `pnpm` for frontend package management (`npm install -g pnpm`)

### Backend Setup

1.  **Create a virtual environment:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

2.  **Install Python dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Set up environment variables:**
    - Copy the example environment file:
      ```bash
      cp .env.example .env
      ```
    - Edit the `.env` file and add your API keys for Gemini and/or OpenAI, and your MongoDB connection details.

4.  **Install Playwright browsers:**
    ```bash
    playwright install
    ```

5.  **Run the backend server:**
    ```bash
    uvicorn src.api:app --reload
    ```
    The API will be available at `http://localhost:8000`. You can see the auto-generated documentation at `http://localhost:8000/docs`.

### Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    cd my-app
    ```

2.  **Install Node.js dependencies:**
    ```bash
    pnpm install
    ```

3.  **Run the frontend development server:**
    ```bash
    pnpm dev
    ```
    The web application will be available at `http://localhost:3000`.

## How It Works

1.  **Crawling**: The backend uses either a simple `requests`-based crawler (`get_crawler.py`) or a JavaScript-rendering crawler (`js_crawler.py` with Playwright) based on the configuration in `sites.yaml`.
2.  **Parsing**: The raw HTML is cleaned using `BeautifulSoup` based on `include` and `exclude` CSS selectors defined in `sites.yaml`.
3.  **Extraction**: The cleaned text is sent to an LLM (Gemini or GPT) via LangChain. The LLM uses a "tool" (`VolunteerOpportunity` Pydantic model) to extract structured data.
4.  **Storage**: The structured data is saved in a MongoDB database. The API provides CRUD endpoints to manage these opportunities.
5.  **API**: A FastAPI server exposes endpoints for scraping, managing configurations, and retrieving opportunities.
6.  **Frontend**: A Next.js app provides a user interface for viewing, searching, and administering the scraped opportunities.
