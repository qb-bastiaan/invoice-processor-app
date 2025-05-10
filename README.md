# Invoice Processor Application

This is a Next.js application designed to process invoices using AI. It allows users to upload invoice files, extract relevant information using Google's Gemini API, and view the processed data.

## Key Features

- **File Upload:** Supports uploading multiple invoice files (e.g., PDF, JPG).
- **AI-Powered Extraction:** Leverages Google's Gemini Pro Vision model to analyze invoice images and extract structured data based on a predefined schema.
- **Batch Processing:** Handles multiple files in a single batch.
- **Progress Tracking:** Displays real-time progress of the invoice processing.
- **Results Display:** Shows extracted line items and other invoice details in a user-friendly format.
- **Responsive Design:** Adapts to different screen sizes.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- Node.js (v18.x or later recommended)
- npm, yarn, pnpm, or bun (this project uses npm in its scripts)
- A Google Cloud Project with the Gemini API enabled.

### Setup

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd invoice-processor
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    - Create a file named `.env.local` in the `invoice-processor` directory by copying the example file:
      ```bash
      cp .env.local.example .env.local
      ```
    - Open `.env.local` and add your Google Gemini API Key:
      ```
      GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
      ```
    - Ensure the API key has access to the "gemini-pro-vision" model.

### Running the Application

1.  **Start the development server:**

    ```bash
    npm run dev
    ```

2.  Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

The page auto-updates as you edit files in the `src` directory.

## Available Scripts

In the project directory, you can run:

- `npm run dev`: Runs the app in development mode.
- `npm run build`: Builds the app for production.
- `npm start`: Starts the production server (after building).
- `npm run lint`: Lints the codebase using ESLint.

## Project Structure

- `public/`: Static assets.
- `src/`: Application source code.
  - `app/`: Next.js App Router pages and API routes.
    - `api/process-invoices/`: Backend API endpoint for invoice processing.
  - `components/`: React components.
    - `custom/`: Project-specific custom components.
    - `ui/`: Reusable UI components (e.g., from shadcn/ui).
  - `lib/`: Utility functions and libraries.
    - `gemini-utils.ts`: Functions for interacting with the Gemini API.
- `config/`: Configuration files, such as the invoice output schema.
- `input-files/`: Example input files for testing (not part of the build).
- `output-data/`: Directory where processed output might be saved (gitignored).

## Learn More (Next.js)

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
