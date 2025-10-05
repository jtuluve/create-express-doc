export function extractVersionFromPackageJson(packageJsonPath) {
    const packageJson = require(packageJsonPath);
    return packageJson.version || "1.0.0";
}