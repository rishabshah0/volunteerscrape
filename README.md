# Volunteer Opportunity Scraper

using LLMs to scrape for volunteer opportunities

## Overview

This project is a full-stack application designed to scrape volunteer opportunities from various websites, process the information using Large Language Models (LLMs), and display them in a clean, searchable web interface.

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

5.  **Run all the servers:**
    ```bash
    cd src/my-app
    npm run:dev
    ```
    The frontend will be available at `http://localhost:3000`. You can see the auto-generated documentation at `http://localhost:8000/docs`.

## Stack
MongoDB, FastAPI, NextJS, LangChain, Pydantic, ShadCN/UI
