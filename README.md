# TestCo1 - Minimal Two-Page Web Application

A minimal two-page web application built with Node.js and Express for testing the complete development-to-deployment workflow on Render.

## Features

- **Homepage (`/`)**: Displays a single password input box and an `Enter` button centered in the viewport on a white background. Entering `test123` navigates to `/success`. Entering anything else clears the input without error messages.
- **Success (`/success`)**: Displays the word **success** in bold, centered in the viewport. Direct route navigation is fully supported.

## Installation

Install project dependencies:

```bash
npm install
```

## Running Locally

To run the application locally in development mode:

```bash
npm run dev
```

Or using standard node start:

```bash
npm start
```

The application will be accessible at [http://localhost:3000](http://localhost:3000).

## Building

Because this application uses a Node.js runtime with Express, no transpilation or build step is required:

```bash
npm run build
```

## Running Production Version

To execute the production server:

```bash
npm start
```

You can optionally specify a custom port:

```bash
PORT=8080 npm start
```

## Deployment on Render

This project is configured for deployment on [Render](https://render.com) as a Web Service.

### Deployment Steps on Render:

1. **Connect Repository**: Connect your GitHub repository `TestCo1` to Render.
2. **Create Web Service**:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. **Render Blueprint (`render.yaml`)**:
   - Alternatively, deploy using Render's Blueprint feature by linking the repository. Render automatically reads `render.yaml` and sets up the Web Service.
