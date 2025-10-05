const fs = require("fs");
const path = require("path");
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;

class ExpressParser {
  constructor() {
    this.routes = [];
    this.importMap = new Map();
    this.processedFiles = new Set();
    this.baseDir = "";
  }

  parseExpressApp(entryFile) {
    this.baseDir = process.cwd();
    this.routes = [];
    this.importMap.clear();
    this.processedFiles.clear();

    console.log(`Parsing Express app from: ${entryFile}`);
    this.parseFile(entryFile, []);

    return this.routes;
  }

  parseFile(filePath, basePath = []) {
    const resolvedPath = this.resolvePath(filePath);

    if (!fs.existsSync(resolvedPath)) {
      console.warn(`File not found: ${resolvedPath}`);
      return;
    }

    if (this.processedFiles.has(resolvedPath)) {
      return;
    }

    this.processedFiles.add(resolvedPath);

    try {
      const code = fs.readFileSync(resolvedPath, "utf8");
      const ast = parse(code, {
        sourceType: "module",
        plugins: [
          "jsx",
          "typescript",
          "decorators-legacy",
          "classProperties",
          "objectRestSpread",
          "asyncGenerators",
          "functionBind",
          "exportDefaultFrom",
          "exportNamespaceFrom",
          "dynamicImport",
        ],
      });

      this.buildImportMap(ast, resolvedPath);

      const appVariable = this.findExpressApp(ast);

      this.traverseRoutes(ast, appVariable, basePath, resolvedPath);
    } catch (error) {
      console.error(`Error parsing file ${resolvedPath}:`, error.message);
    }
  }

  buildImportMap(ast, currentFilePath) {
    const currentDir = path.dirname(currentFilePath);

    traverse(ast, {
      ImportDeclaration: (path) => {
        const source = path.node.source.value;
        const resolvedImportPath = this.resolveImportPath(source, currentDir);

        path.node.specifiers.forEach((spec) => {
          if (spec.type === "ImportDefaultSpecifier") {
            this.importMap.set(spec.local.name, resolvedImportPath);
          } else if (spec.type === "ImportSpecifier") {
            this.importMap.set(spec.local.name, resolvedImportPath);
          }
        });
      },

      VariableDeclarator: (path) => {
        if (path.node.init && path.node.init.type === "CallExpression") {
          const callee = path.node.init.callee;
          if (callee.type === "Identifier" && callee.name === "require") {
            const arg = path.node.init.arguments[0];
            if (arg && arg.type === "StringLiteral") {
              const source = arg.value;
              const resolvedImportPath = this.resolveImportPath(
                source,
                currentDir
              );

              if (path.node.id.type === "Identifier") {
                this.importMap.set(path.node.id.name, resolvedImportPath);
              }
            }
          }
        }
      },
    });
  }

  findExpressApp(ast) {
    let appVariable = null;

    traverse(ast, {
      VariableDeclarator: (path) => {
        if (path.node.init && path.node.init.type === "CallExpression") {
          const callee = path.node.init.callee;

          if (callee.type === "Identifier" && callee.name === "express") {
            appVariable = path.node.id.name;
          }

          if (callee.type === "Identifier" && callee.name === "Router") {
            appVariable = path.node.id.name;
          }

          if (
            callee.type === "MemberExpression" &&
            callee.object.name === "express" &&
            callee.property.name === "Router"
          ) {
            appVariable = path.node.id.name;
          }
          if (callee.name === "Router") {
            console.log("Found Router:", path.node.id.name);
          }
        }
      },
    });

    return appVariable || "app"; // Default
  }

  traverseRoutes(ast, appVariable, basePath, currentFilePath) {
    traverse(ast, {
      CallExpression: (path) => {
        const callee = path.node.callee;

        if (callee.type === "MemberExpression") {
          const object = callee.object;
          const property = callee.property;

          if (
            object.type === "Identifier" &&
            (object.name === appVariable || object.name === "router")
          ) {
            const method = property.name;
            const args = path.node.arguments;

            if (this.isRouteMethod(method)) {
              this.handleRouteMethod(method, args, basePath, currentFilePath);
            } else if (method === "use") {
              this.handleUseMethod(args, basePath, currentFilePath);
            }
          }
        }
      },
    });
  }

  isRouteMethod(method) {
    return [
      "get",
      "post",
      "put",
      "delete",
      "patch",
      "head",
      "options",
    ].includes(method);
  }

  handleRouteMethod(method, args, basePath, currentFilePath) {
    if (args.length === 0) return;

    let routePath = "";
    let handlers = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg.type === "StringLiteral") {
        routePath = arg.value;
      } else if (
        arg.type === "Identifier" ||
        arg.type === "FunctionExpression" ||
        arg.type === "ArrowFunctionExpression"
      ) {
        handlers.push(arg);
      } else if (arg.type === "ArrayExpression") {
        handlers.push(...arg.elements);
      }
    }

    const fullPath = this.buildFullPath(basePath, routePath);

    const responses = this.extractResponsesFromHandlers(
      handlers,
      currentFilePath
    );

    this.routes.push({
      method: method.toUpperCase(),
      path: fullPath,
      responses: responses,
      middleware: this.extractMiddlewareInfo(handlers),
      file: currentFilePath,
    });
  }

  handleUseMethod(args, basePath, currentFilePath) {
    let routePath = "";
    const handlers = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (i === 0 && arg.type === "StringLiteral") {
        routePath = arg.value;
      } else if (arg.type === "Identifier") {
        handlers.push(arg);
      }
    }

    handlers.forEach((handler) => {
      const importPath = this.importMap.get(handler.name);
      if (importPath) {
        const newBasePath = routePath ? [...basePath, routePath] : basePath;
        this.parseFile(importPath, newBasePath);
      }
    });
  }

  extractResponsesFromHandlers(handlers, currentFilePath) {
    const responses = [];

    handlers.forEach((handler) => {
      if (handler.type === "Identifier") {
        const importPath = this.importMap.get(handler.name);
        if (importPath) {
          const handlerResponses = this.parseHandlerFile(
            importPath,
            handler.name
          );
          responses.push(...handlerResponses);
        }
      } else if (
        handler.type === "FunctionExpression" ||
        handler.type === "ArrowFunctionExpression"
      ) {
        const handlerResponses = this.extractResponsesFromFunction(handler);
        responses.push(...handlerResponses);
      }
    });

    return responses.length > 0
      ? responses
      : [{ status: 200, description: "Success" }];
  }

  parseHandlerFile(filePath, handlerName) {
    const resolvedPath = this.resolvePath(filePath);

    if (!fs.existsSync(resolvedPath)) {
      return [];
    }

    try {
      const code = fs.readFileSync(resolvedPath, "utf8");
      const ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx", "typescript", "decorators-legacy", "classProperties"],
      });

      let handlerFunction = null;

      traverse(ast, {
        FunctionDeclaration: (path) => {
          if (path.node.id && path.node.id.name === handlerName) {
            handlerFunction = path.node;
          }
        },
        VariableDeclarator: (path) => {
          if (
            path.node.id.name === handlerName &&
            (path.node.init.type === "FunctionExpression" ||
              path.node.init.type === "ArrowFunctionExpression")
          ) {
            handlerFunction = path.node.init;
          }
        },
        ExportDefaultDeclaration: (path) => {
          if (
            path.node.declaration.type === "FunctionExpression" ||
            path.node.declaration.type === "ArrowFunctionExpression" ||
            path.node.declaration.type === "FunctionDeclaration"
          ) {
            handlerFunction = path.node.declaration;
          }
        },
      });

      if (handlerFunction) {
        return this.extractResponsesFromFunction(handlerFunction);
      }
    } catch (error) {
      console.error(
        `Error parsing handler file ${resolvedPath}:`,
        error.message
      );
    }

    return [];
  }

  extractResponsesFromFunction(functionNode) {
    const responses = [];
    const tempAst = {
      type: "File",
      program: { type: "Program", body: [functionNode] },
    };
    traverse(tempAst, {
      CallExpression: (path) => {
        const callee = path.node.callee;

        // Look for res.status(), res.json(), res.send(), etc.
        if (
          callee.type === "MemberExpression" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "res"
        ) {
          const method = callee.property.name;
          const args = path.node.arguments;

          if (
            (method === "status" || method === "sendStatus") &&
            args.length > 0 &&
            args[0].type === "NumericLiteral"
          ) {
            const status = args[0].value;

            // Look for chained methods like res.status(200).json()
            const grandParent = path.parentPath.parent;
            if (grandParent && grandParent.type === "CallExpression") {
              const chainedMethod = grandParent.callee.property.name;
              const responseData = this.extractResponseData(
                grandParent,
                chainedMethod
              );

              responses.push({
                status,
                type: this.getContentType(chainedMethod, responseData),
                data: responseData,
                description: this.getStatusDescription(status),
              });
            } else {
              responses.push({
                status,
                description: this.getStatusDescription(status),
              });
            }
          } else if (["json", "send", "end"].includes(method)) {
            const responseData = this.extractResponseData(path.node, method);

            responses.push({
              status: 200, // Default status
              type: this.getContentType(method, responseData),
              data: responseData,
              description: "Success",
            });
          }
        }

        // Handle next(err) → 500
        if (
          (callee.type === "Identifier" && callee.name === "next") ||
          (callee.type === "NewExpression" && callee.callee.name === "Error")
        ) {
          responses.push({
            status: 500,
            description: "Internal Server Error",
          });
        }
      },

      IfStatement: (path) => {
        if (path.node.consequent) {
          const consequentResponses = this.extractResponsesFromBlock(
            path.node.consequent
          );
          responses.push(...consequentResponses);
        }

        if (path.node.alternate) {
          const alternateResponses = this.extractResponsesFromBlock(
            path.node.alternate
          );
          responses.push(...alternateResponses);
        }
      },
    });

    return responses;
  }

  getContentType(method, data) {
    if (method === "json") return "application/json";
    if (method === "end") return "text/plain";

    // res.send() inference like Express
    if (method === "send") {
      if (data === null) return "application/json";
      if (typeof data === "object") return "application/json";
      if (typeof data === "string") return "text/html";
      if (typeof data === "number" || typeof data === "boolean")
        return "text/html";
    }

    return "text/html"; // default fallback
  }

  extractResponsesFromBlock(block) {
    const responses = [];

    if (block.type === "BlockStatement") {
      block.body.forEach((statement) => {
        if (
          statement.type === "ExpressionStatement" &&
          statement.expression.type === "CallExpression"
        ) {
          const callExp = statement.expression;
          const callee = callExp.callee;

          if (
            callee.type === "MemberExpression" &&
            callee.object.name === "res"
          ) {
            const method = callee.property.name;

            if (method === "status") {
              const status = callExp.arguments[0]?.value || 200;
              responses.push({
                status: status,
                description: this.getStatusDescription(status),
              });
            } else if (["json", "send", "end"].includes(method)) {
              const responseData = this.extractResponseData(callExp, method);
              responses.push({
                status: 200,
                type: this.getContentType(method, responseData),
                data: responseData,
                description: "Success",
              });
            }
          }
        }
      });
    }

    return responses;
  }

  extractResponseData(callExpression, method) {
    const args = callExpression.arguments || [];

    if (args.length === 0) return null;

    const arg = args[0];

    switch (arg.type) {
      case "ObjectExpression":
        return this.parseObjectExpression(arg);
      case "ArrayExpression":
        return this.parseArrayExpression(arg);
      case "StringLiteral":
        return arg.value;
      case "NumericLiteral":
        return arg.value;
      case "BooleanLiteral":
        return arg.value;
      case "Identifier":
        return `{${arg.name}}`;
      default:
        return `{${method}_response}`;
    }
  }

  parseObjectExpression(objExp) {
    const result = {};

    objExp.properties.forEach((prop) => {
      if (prop.type === "ObjectProperty") {
        const key =
          prop.key.type === "Identifier" ? prop.key.name : prop.key.value;

        switch (prop.value.type) {
          case "StringLiteral":
            result[key] = prop.value?.extra?.rawValue || "string";
            break;
          case "NumericLiteral":
            result[key] = prop.value?.extra?.rawValue || "number";
            break;
          case "BooleanLiteral":
            result[key] = prop.value?.extra?.rawValue || "boolean";
            break;
          case "ObjectExpression":
            result[key] = this.parseObjectExpression(prop.value);
            break;
          case "ArrayExpression":
            result[key] = this.parseArrayExpression(prop.value);
            break;
          case "Identifier":
            result[key] = `{${prop.value.name}}`;
            break;
          default:
            result[key] = "unknown";
        }
      }
    });

    return result;
  }

  parseArrayExpression(arrExp) {
    if (arrExp.elements.length === 0) return [];

    const firstElement = arrExp.elements[0];
    if (firstElement) {
      switch (firstElement.type) {
        case "ObjectExpression":
          return [this.parseObjectExpression(firstElement)];
        case "StringLiteral":
          return ["string"];
        case "NumericLiteral":
          return ["number"];
        case "BooleanLiteral":
          return ["boolean"];
        default:
          return ["unknown"];
      }
    }

    return [];
  }

  extractMiddlewareInfo(handlers) {
    const middleware = [];

    for (let i = 0; i < handlers.length - 1; i++) {
      const handler = handlers[i];
      if (handler.type === "Identifier") {
        middleware.push(handler.name);
      }
    }

    return middleware;
  }

  buildFullPath(basePath, routePath) {
    const pathSegments = [...basePath];

    if (routePath && routePath !== "/") {
      pathSegments.push(routePath);
    }

    let fullPath = pathSegments.join("").replace(/\/+/g, "/");

    if (!fullPath.startsWith("/")) {
      fullPath = "/" + fullPath;
    }

    return fullPath === "//" ? "/" : fullPath;
  }

  resolveImportPath(importPath, currentDir) {
    if (importPath.startsWith(".")) {
      let resolvedPath = path.resolve(currentDir, importPath);
      if (fs.existsSync(resolvedPath)) return resolvedPath;

      const extensions = [".js", ".ts", ".mjs", "/index.js", "/index.ts"];

      for (const ext of extensions) {
        const testPath = resolvedPath + ext;
        if (fs.existsSync(testPath)) {
          return testPath;
        }
      }

      if (
        fs.existsSync(resolvedPath) &&
        fs.statSync(resolvedPath).isDirectory()
      ) {
        for (const indexFile of ["index.js", "index.ts"]) {
          const indexPath = path.join(resolvedPath, indexFile);
          if (fs.existsSync(indexPath)) {
            return indexPath;
          }
        }
      }

      return resolvedPath + ".js"; // Default
    }

    return importPath;
  }

  resolvePath(filePath) {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    return path.resolve(this.baseDir, filePath);
  }

  getStatusDescription(status) {
    const statusMap = {
      200: "OK",
      201: "Created",
      204: "No Content",
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      405: "Method Not Allowed",
      409: "Conflict",
      422: "Unprocessable Entity",
      500: "Internal Server Error",
      502: "Bad Gateway",
      503: "Service Unavailable",
    };

    return statusMap[status] || "Unknown Status";
  }

  generateJSONDocumentation() {
    const documentation = {
      info: {
        title: "API Documentation",
        version: extractVersionFromPackageJson(this.baseDir + "/package.json"),
        description:
          "Auto-generated API documentation for Express.js application",
        generatedAt: new Date().toISOString(),
      },
      paths: {},
    };

    this.routes.forEach((route) => {
      if (!documentation.paths[route.path]) {
        documentation.paths[route.path] = {};
      }

      documentation.paths[route.path][route.method.toLowerCase()] = {
        summary: `${route.method} ${route.path}`,
        responses: this.formatResponses(route.responses),
        middleware: route.middleware,
        sourceFile: route.file,
      };
    });

    return documentation;
  }

  formatResponses(responses) {
    return responses.map((response) => ({
      status: response.status,
      description: response.description,
      contentType: response.type || "application/json",
      ...(response.data && { schema: response.data }),
    }));
  }

  generateReadme(documentation) {
    let readme = `# ${documentation.info.title}\n\n`;
    readme += `${documentation.info.description}\n\n`;
    readme += `**Version:** ${documentation.info.version}  \n`;
    readme += `**Generated:** ${new Date(
      documentation.info.generatedAt
    ).toLocaleString()}\n`;
    readme += `Generated By: create-express-doc\n\n`;

    readme += `## API Endpoints\n\n`;

    const sortedPaths = Object.keys(documentation.paths).sort();

    sortedPaths.forEach((pathName) => {
      const pathInfo = documentation.paths[pathName];

      readme += `### \`${pathName}\`\n\n`;

      Object.keys(pathInfo).forEach((method) => {
        const methodInfo = pathInfo[method];
        const methodUpper = method.toUpperCase();

        readme += `#### ${methodUpper} ${pathName}\n\n`;

        if (methodInfo.middleware && methodInfo.middleware.length > 0) {
          readme += `**Middleware:** ${methodInfo.middleware.join(", ")}\n\n`;
        }

        readme += `**Responses:**\n\n`;

        methodInfo.responses.forEach((response) => {
          readme += `- **${response.status}** - ${response.description}\n`;

          if (response.contentType) {
            readme += `  - Content-Type: \`${response.contentType}\`\n`;
          }

          if (response.schema) {
            readme += `  - Schema:\n\n`;
            readme += `    \`\`\`json\n`;
            readme += `    ${JSON.stringify(response.schema, null, 2)}\n`;
            readme += `    \`\`\`\n`;
          }
        });

        readme += `\n`;
      });
    });

    readme += `\n---\n\n`;
    readme += `*This documentation was automatically generated from your Express.js application.*\n`;

    return readme;
  }

  extractResponseType() {}
}

module.exports = ExpressParser;
