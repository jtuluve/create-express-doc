#!/usr/bin/env node
const DocumentationGenerator = require('../src/documentationGenerator');
const utils = require('../src/utils');

async function generateAPIDocumentation(entryFile, options = {}) {
  const defaultOptions = {
    outputDir: './docs',
    jsonFileName: 'api-documentation.json',
    readmeFileName: 'README.md',
    includeMiddleware: true,
    includeSourceFiles: false,
    validate: true,
    generateSummary: true
  };
  
  const config = utils.deepMerge(defaultOptions, options);
  const generator = new DocumentationGenerator();
  
  try {
    
    console.log('🔍 Validating entry file...');
    generator.validateEntryFile(entryFile);
    
    
    const result = await generator.generate(entryFile, config);
    
    if (!result) {
      console.error('❌ Failed to generate documentation');
      return null;
    }
    
    
    if (config.validate) {
      console.log('✅ Validating documentation...');
      const issues = utils.validateDocumentation(result.jsonDoc);
      
      if (issues.length > 0) {
        console.warn('⚠️  Validation issues found:');
        issues.forEach(issue => console.warn(`   - ${issue}`));
      } else {
        console.log('✅ Documentation validation passed');
      }
    }
    
    
    if (config.generateSummary) {
      const summary = generator.generateSummaryReport(result.jsonDoc);
      console.log(summary);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error generating documentation:', error.message);
    throw error;
  }
}

function showHelp() {
  console.log(`
Usage: npx create-express-doc <entry-file> [options]

Arguments:
  entry-file              Path to your Express app entry file

Options:
  --output-dir <dir>      Output directory (default: ./docs)
  --json-name <name>      JSON file name (default: api-documentation.json)
  --readme-name <name>    README file name (default: README.md)
  --no-middleware         Exclude middleware information
  --include-source        Include source file references
  --no-validate           Skip documentation validation
  --no-summary            Skip summary report
  -h, --help              Show this help message

Examples:
  npx create-express-doc ./app.js
  npx create-express-doc ./server.js --output-dir ./api-docs
  npx create-express-doc ./index.js --no-middleware --include-source
`);
}

async function runCLI(args) {
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  console.log('📄 Generating Express API documentation...')
  if (args.length < 3) {
    showHelp();
    process.exit(1);
  }
  
  const entryFile = args[2];
  const options = parseCliOptions(args.slice(3));
  
  try {
    await generateAPIDocumentation(entryFile, options);
    process.exit(0);
  } catch (error) {
    console.error('Failed to generate documentation:', error.message);
    process.exit(1);
  }
}

function parseCliOptions(args) {
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--output-dir':
        options.outputDir = args[++i];
        break;
      case '--json-name':
        options.jsonFileName = args[++i];
        break;
      case '--readme-name':
        options.readmeFileName = args[++i];
        break;
      case '--no-middleware':
        options.includeMiddleware = false;
        break;
      case '--include-source':
        options.includeSourceFiles = true;
        break;
      case '--no-validate':
        options.validate = false;
        break;
      case '--no-summary':
        options.generateSummary = false;
        break;
      default:
        if (arg.startsWith('--')) {
          console.warn(`Unknown option: ${arg}`);
        }
    }
  }
  
  return options;
}

runCLI(process.argv);