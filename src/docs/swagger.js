/**
 * Swagger UI Setup
 * Serves Swagger UI for API documentation
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const yaml = require('yaml');

const router = express.Router();

// Load OpenAPI spec
const openApiPath = path.join(__dirname, 'openapi.json');
let openApiSpec;

try {
  const fileContent = fs.readFileSync(openApiPath, 'utf8');
  openApiSpec = JSON.parse(fileContent);
} catch (error) {
  console.error('Failed to load OpenAPI spec:', error.message);
}

// Swagger UI HTML
const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Influencerium API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui.css">
  <link rel="icon" type="image/png" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/favicon-32x32.png" sizes="32x32" />
  <style>
    body {
      margin: 0;
      padding: 0;
    }
    .topbar-wrapper {
      background: linear-gradient(90deg, #000 0%, #333 100%);
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .topbar-wrapper img {
      height: 30px;
    }
    .topbar-wrapper .title {
      color: white;
      font-size: 18px;
      font-weight: 600;
      margin-left: 10px;
    }
    .topbar-right {
      display: flex;
      gap: 15px;
    }
    .topbar-right a {
      color: white;
      text-decoration: none;
      font-size: 14px;
      opacity: 0.9;
    }
    .topbar-right a:hover {
      opacity: 1;
    }
  </style>
</head>
<body>
  <div class="topbar-wrapper">
    <div style="display: flex; align-items: center;">
      <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="12" fill="#ffffff"/>
        <path d="M14 24L20 30L34 16" stroke="#000000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="title">Influencerium API v1.0.0</span>
    </div>
    <div class="topbar-right">
      <a href="/docs">📘 Postman Collection</a>
      <a href="/api-docs" target="_blank">🔗 API Base URL</a>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/docs/spec',
        dom_id: '#swagger-ui',
        deepLinking: true,
        showRequestHeaders: true,
        showResponseHeaders: true,
        displayRequestDuration: true,
        filter: true,
        requestSnippetsEnabled: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: 'StandaloneLayout',
        docExpansion: 'none',
        operationsSorter: 'method',
        tagsSorter: 'alpha',
        persistAuthorization: true,
        oauth2RedirectUrl: '/docs/oauth2-redirect'
      });
    };
  </script>
</body>
</html>
`;

// Get OpenAPI spec as JSON
router.get('/spec', (req, res) => {
  res.json(openApiSpec);
});

// Get Swagger UI HTML
router.get('/', (req, res) => {
  res.send(swaggerHtml);
});

// OAuth2 redirect handler
router.get('/oauth2-redirect', (req, res) => {
  res.redirect('/docs');
});

module.exports = router;
