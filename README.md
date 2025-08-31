# Express Documentation Generator

An `npx` CLI tool that automatically generates comprehensive API documentation for Express.js applications by analyzing your code.

## Features

- 🔍 **Automatic Route Discovery** - Finds all Express routes by parsing your application code
- 📊 **Response Analysis** - Extracts status codes and response structures from route handlers
- 🔧 **Middleware Detection** - Identifies both global and route-specific middleware
- 📄 **Multiple Output Formats** - Generates both JSON and Markdown documentation
- 💬 **Comment Extraction** - Includes JSDoc comments as route descriptions
- 🚀 **Zero Configuration** - Works out of the box with any Express.js application

## Installation

```bash
# Run directly with npx (recommended)
npx create-express-doc <your-app.js>

# Or install globally
npm install -g create-express-doc
create-express-doc <your-app.js>
```

## Usage

### Basic Usage

```bash
npx create-express-doc app.js
```

### Advanced Options

```bash
# Specify output directory
npx create-express-doc app.js --output-dir ./documentation

# Custom JSON filename
npx create-express-doc app.js --json-name my-api-docs.json

# Custom README filename
npx create-express-doc app.js --readme-name API-DOCS.md

# Exclude middleware information
npx create-express-doc app.js --no-middleware

# Include source file references
npx create-express-doc app.js --include-source

# Skip documentation validation
npx create-express-doc app.js --no-validate

# Skip summary report
npx create-express-doc app.js --no-summary
```

### CLI Options

| Option                 | Description                        | Default                  |
| ---------------------- | ---------------------------------- | ------------------------ |
| `--output-dir <dir>`   | Output directory for documentation | `./docs`                 |
| `--json-name <name>`   | JSON file name                     | `api-documentation.json` |
| `--readme-name <name>` | README file name                   | `README.md`              |
| `--no-middleware`      | Exclude middleware information     | `false`                  |
| `--include-source`     | Include source file references     | `false`                  |
| `--no-validate`        | Skip documentation validation      | `false`                  |
| `--no-summary`         | Skip summary report                | `false`                  |
| `-h, --help`           | Show help message                  | -                        |

## What Gets Analyzed

The tool analyzes your Express.js code to extract:

### Routes

- HTTP methods (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
- Route paths (including parameters)
- Route-specific middleware
- JSDoc comments as descriptions

### Responses

- Status codes from `res.status()` calls
- Response types (JSON, send, etc.)
- Response examples from `res.json()` and `res.send()`
- Error responses and success responses

### Middleware

- Global middleware from `app.use()`
- Route-specific middleware
- Middleware function names

## Output Examples

### JSON Output (`docs/api-documentation.json`)

```json
{
  "info": {
    "title": "API Documentation",
    "version": "1.0.0",
    "description": "Auto-generated API documentation for Express.js application",
    "generatedAt": "2025-08-31T18:06:33.783Z"
  },
  "paths": {
    "/api/users": {
      "get": {
        "summary": "GET /api/users",
        "responses": [
          {
            "status": 200,
            "description": "Success response"
          },
          {
            "status": 401,
            "description": "Unauthorized"
          }
        ],
        "middleware": ["authenticationToken"],
        "security": ["authenticationToken"]
      }
    },
    "/api/users/:id": {
      "put": {
        "summary": "PUT /api/users/:id",
        "responses": [
          {
            "status": 200,
            "description": "Success response"
          },
          {
            "status": 404,
            "description": "Not found"
          }
        ],
        "middleware": ["authenticationToken"],
        "security": ["authenticationToken"]
      }
    }
  },
  "stats": {
    "totalEndpoints": 15,
    "methodCounts": {
      "GET": 5,
      "POST": 6,
      "PUT": 2,
      "DELETE": 2
    },
    "statusCodes": [200, 201, 400, 401, 403, 404, 500],
    "pathsWithParams": 3,
    "middlewareUsage": ["authenticationToken", "validateInput"]
  },
  "tags": {
    "api": {
      "name": "api",
      "description": "Routes under /api",
      "paths": [
        "/api/users",
        "/api/users/:id",
        "/api/auth/signin",
        "/api/auth/signup"
      ]
    }
  },
  "security": {
    "middleware": ["authenticationToken"],
    "description": "Detected security middleware in the application"
  }
}
```

### Markdown Output (`docs/README.md`)

The tool generates a comprehensive README.md with:

- Overview and metadata
- Table of contents
- Global middleware table
- Detailed route documentation with examples
- Response codes and examples
- Usage instructions

## Development Setup

If you want to contribute or modify the tool:

```bash
# Clone and install dependencies
git clone <your-repo>
cd create-express-doc
npm install

# Test with the example app
node bin/cli.js example/app.js
```

## How It Works

1. **Code Parsing** - Uses Babel to parse JavaScript/TypeScript files into an AST
2. **Route Discovery** - Traverses the AST to find Express route definitions
3. **Response Analysis** - Analyzes route handler functions to extract possible responses
4. **Documentation Generation** - Formats the extracted data into JSON and Markdown

## Supported Express Patterns

- Standard route definitions: `app.get('/path', handler)`
- Router-based routes: `router.get('/path', handler)`
- Multiple middleware: `app.get('/path', middleware1, middleware2, handler)`
- Chained responses: `res.status(200).json(data)`
- JSDoc comments for descriptions

## Limitations

- Only analyzes static route definitions (not dynamic routes)
- Response examples are extracted from literal values in code
- Middleware analysis is based on function names and call patterns
- Works best with standard Express.js patterns

## Contributing

0. Create a new issue if not already.
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with various Express.js applications
5. Submit a pull request
