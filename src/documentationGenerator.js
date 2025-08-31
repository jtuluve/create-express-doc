const fs = require("fs");
const path = require("path");
const ExpressParser = require("./parser");

class DocumentationGenerator {
  constructor() {
    this.parser = new ExpressParser();
  }

  async generate(entryFile, options = {}) {
    const {
      outputDir = "./docs",
      jsonFileName = "api-documentation.json",
      readmeFileName = "README.md",
      includeMiddleware = true,
      includeSourceFiles = false,
    } = options;

    console.log("🚀 Starting API documentation generation...");

    try {
      
      console.log("📖 Parsing Express application...");
      const routes = this.parser.parseExpressApp(entryFile);

      if (routes.length === 0) {
        console.warn("⚠️  No routes found in the application");
        return null;
      }

      console.log(`✅ Found ${routes.length} routes`);

      
      console.log("📄 Generating JSON documentation...");
      const jsonDoc = this.parser.generateJSONDocumentation();

      
      this.enhanceDocumentation(jsonDoc, options);

      
      console.log("📝 Generating README.md...");
      const readmeContent = this.parser.generateReadme(jsonDoc);

      
      this.ensureOutputDirectory(outputDir);

      
      const jsonPath = path.join(outputDir, jsonFileName);
      const readmePath = path.join(outputDir, readmeFileName);

      fs.writeFileSync(jsonPath, JSON.stringify(jsonDoc, null, 2));
      fs.writeFileSync(readmePath, readmeContent);

      console.log("✨ Documentation generated successfully!");
      console.log(`📁 JSON: ${jsonPath}`);
      console.log(`📁 README: ${readmePath}`);

      return {
        routes: routes,
        jsonDoc: jsonDoc,
        readmeContent: readmeContent,
        files: {
          json: jsonPath,
          readme: readmePath,
        },
      };
    } catch (error) {
      console.error("❌ Error generating documentation:", error.message);
      throw error;
    }
  }

  enhanceDocumentation(documentation, options) {
    
    const stats = this.generateStats(documentation);
    documentation.stats = stats;

    
    const tags = this.generateTags(documentation);
    documentation.tags = tags;

    
    if (options.includeMiddleware) {
      this.addSecurityInfo(documentation);
    }

    if (!options.includeSourceFiles) {
      this.removeSourceFileInfo(documentation);
    }
  }

  generateStats(documentation) {
    const paths = documentation.paths;
    const stats = {
      totalEndpoints: 0,
      methodCounts: {},
      statusCodes: new Set(),
      pathsWithParams: 0,
      middlewareUsage: new Set(),
    };

    Object.keys(paths).forEach((pathName) => {
      const pathInfo = paths[pathName];

      
      if (pathName.includes(":") || pathName.includes("*")) {
        stats.pathsWithParams++;
      }

      Object.keys(pathInfo).forEach((method) => {
        stats.totalEndpoints++;

        const methodUpper = method.toUpperCase();
        stats.methodCounts[methodUpper] =
          (stats.methodCounts[methodUpper] || 0) + 1;

        const methodInfo = pathInfo[method];

        methodInfo.responses.forEach((response) => {
          stats.statusCodes.add(response.status);
        });

        if (methodInfo.middleware) {
          methodInfo.middleware.forEach((mw) => stats.middlewareUsage.add(mw));
        }
      });
    });

    stats.statusCodes = Array.from(stats.statusCodes).sort();
    stats.middlewareUsage = Array.from(stats.middlewareUsage);

    return stats;
  }

  generateTags(documentation) {
    const tags = {};

    Object.keys(documentation.paths).forEach((pathName) => {
      const segments = pathName.split("/").filter((s) => s);
      const category = segments.length > 0 ? segments[0] : "root";

      if (!tags[category]) {
        tags[category] = {
          name: category,
          description: `Routes under /${category}`,
          paths: [],
        };
      }

      tags[category].paths.push(pathName);
    });

    return tags;
  }

  addSecurityInfo(documentation) {
    const securityMiddleware = new Set();

    Object.keys(documentation.paths).forEach((pathName) => {
      const pathInfo = documentation.paths[pathName];

      Object.keys(pathInfo).forEach((method) => {
        const methodInfo = pathInfo[method];

        if (methodInfo.middleware) {
          methodInfo.middleware.forEach((mw) => {
            if (
              mw.toLowerCase().includes("auth") ||
              mw.toLowerCase().includes("passport") ||
              mw.toLowerCase().includes("jwt") ||
              mw.toLowerCase().includes("cors") ||
              mw.toLowerCase().includes("helmet")
            ) {
              securityMiddleware.add(mw);

              if (!methodInfo.security) {
                methodInfo.security = [];
              }
              methodInfo.security.push(mw);
            }
          });
        }
      });
    });

    if (securityMiddleware.size > 0) {
      documentation.security = {
        middleware: Array.from(securityMiddleware),
        description: "Detected security middleware in the application",
      };
    }
  }

  removeSourceFileInfo(documentation) {
    Object.keys(documentation.paths).forEach((pathName) => {
      const pathInfo = documentation.paths[pathName];

      Object.keys(pathInfo).forEach((method) => {
        delete pathInfo[method].sourceFile;
      });
    });
  }

  ensureOutputDirectory(outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${outputDir}`);
    }
  }

  validateEntryFile(entryFile) {
    if (!fs.existsSync(entryFile)) {
      throw new Error(`Entry file not found: ${entryFile}`);
    }

    const content = fs.readFileSync(entryFile, "utf8");

    if (!content.includes("express") && !content.includes("app")) {
      console.warn("⚠️  Entry file may not be an Express application");
    }

    return true;
  }

  generateSummaryReport(documentation) {
    const stats = documentation.stats;

    let report = "\n📊 Documentation Summary\n";
    report += "========================\n";
    report += `Total Endpoints: ${stats.totalEndpoints}\n`;
    report += `Unique Paths: ${Object.keys(documentation.paths).length}\n`;
    report += `Paths with Parameters: ${stats.pathsWithParams}\n`;

    report += "\nHTTP Methods:\n";
    Object.keys(stats.methodCounts).forEach((method) => {
      report += `  ${method}: ${stats.methodCounts[method]}\n`;
    });

    report += "\nStatus Codes Found:\n";
    stats.statusCodes.forEach((code) => {
      report += `  ${code}\n`;
    });

    if (stats.middlewareUsage.length > 0) {
      report += "\nMiddleware Detected:\n";
      stats.middlewareUsage.forEach((mw) => {
        report += `  ${mw}\n`;
      });
    }

    if (documentation.tags) {
      report += "\nRoute Categories:\n";
      Object.keys(documentation.tags).forEach((tag) => {
        const tagInfo = documentation.tags[tag];
        report += `  ${tag}: ${tagInfo.paths.length} paths\n`;
      });
    }

    return report;
  }
}

module.exports = DocumentationGenerator;
