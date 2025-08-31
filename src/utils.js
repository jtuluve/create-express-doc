function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (
        typeof source[key] === "object" &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

function validateDocumentation(documentation) {
  const issues = [];

  if (!documentation.info) {
    issues.push("Missing info section");
  }

  if (!documentation.paths || Object.keys(documentation.paths).length === 0) {
    issues.push("No paths found in documentation");
  }

  Object.keys(documentation.paths || {}).forEach((pathName) => {
    const pathInfo = documentation.paths[pathName];

    if (!pathName.startsWith("/")) {
      issues.push(`Path should start with '/': ${pathName}`);
    }

    Object.keys(pathInfo).forEach((method) => {
      const methodInfo = pathInfo[method];

      if (
        !methodInfo.responses ||
        Object.keys(methodInfo.responses).length === 0
      ) {
        issues.push(
          `No responses defined for ${method.toUpperCase()} ${pathName}`
        );
      }

      const validMethods = [
        "get",
        "post",
        "put",
        "delete",
        "patch",
        "head",
        "options",
      ];
      if (!validMethods.includes(method.toLowerCase())) {
        issues.push(`Invalid HTTP method: ${method}`);
      }
    });
  });

  return issues;
}

module.exports = { deepMerge, validateDocumentation };
