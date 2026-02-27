# Volunteer Opportunity Scraper

using LLMs to scrape for volunteer opportunities

## Getting Started

### Backend Setup

1.  **Create a virtual environment:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

2.  **Install Python dependencies:**
    ```bash
    cd src
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
    The frontend will be available at `http://localhost:3000`. You can see the auto-generated API documentation at `http://localhost:8000/docs`.
