const path = require("path");
const fs = require("fs");

const { build } = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");

const { parseEnvVariables } = require("../packages/excalidraw/env.cjs");

const ENV_VARS = {
  development: {
    ...parseEnvVariables(`${__dirname}/../.env.development`),
    DEV: true,
  },
  production: {
    ...parseEnvVariables(`${__dirname}/../.env.production`),
    PROD: true,
  },
};

// Helper function to convert non-ASCII characters to Unicode escape sequences
const ensureAsciiOnly = (content) => {
  return content.replace(/[\u0080-\uFFFF]/g, (char) => {
    const code = char.charCodeAt(0);
    return `\\u${code.toString(16).padStart(4, "0")}`;
  });
};

// Recursively find all JS files in a directory
const findJsFiles = (dir, fileList = []) => {
  if (!fs.existsSync(dir)) {
    return fileList;
  }
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findJsFiles(filePath, fileList);
    } else if (file.endsWith(".js")) {
      fileList.push(filePath);
    }
  }
  return fileList;
};

// Plugin to ensure ASCII-only output
const asciiOnlyPlugin = (outdir) => ({
  name: "ascii-only",
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length > 0) {
        return;
      }

      // Read and process all JS files in the output directory
      const outputDir = path.resolve(build.initialOptions.outdir || outdir);
      const jsFiles = findJsFiles(outputDir);
      for (const filePath of jsFiles) {
        let content = fs.readFileSync(filePath, "utf8");
        // Convert non-ASCII characters to Unicode escape sequences
        content = ensureAsciiOnly(content);
        // Write the ASCII-only content back to the file
        fs.writeFileSync(filePath, content, "utf8");
      }
    });
  },
});

// excludes all external dependencies and bundles only the source code
const getConfig = (outdir) => ({
  outdir,
  bundle: true,
  splitting: false, // Disable code splitting to generate a single file
  format: "iife", // Expose as browser global similar to webpack umd
  globalName: "ExcalidrawLib",
  jsx: "automatic", // Use automatic JSX transform (react-jsx) and bundle jsx-runtime
  plugins: [sassPlugin(), asciiOnlyPlugin(outdir)],
  target: "es2020",
  assetNames: "[dir]/[name]",
  alias: {
    "@excalidraw/utils": path.resolve(__dirname, "../packages/utils/src"),
  },
  loader: {
    ".woff2": "file",
  },
});

function buildDev(config) {
  return build({
    ...config,
    sourcemap: true,
    define: {
      "import.meta.env": JSON.stringify(ENV_VARS.development),
    },
  });
}

function buildProd(config) {
  return build({
    ...config,
    minify: true,
    define: {
      "import.meta.env": JSON.stringify(ENV_VARS.production),
    },
  });
}

const createESMRawBuild = async () => {
  const singleFileConfig = {
    entryPoints: ["index.tsx"], // Single entry point, no chunks
    entryNames: "[name]",
  };

  // development unminified build with source maps
  await buildDev({
    ...getConfig("dist/dev"),
    ...singleFileConfig,
  });

  // production minified build without sourcemaps
  await buildProd({
    ...getConfig("dist/prod"),
    ...singleFileConfig,
  });
};

(async () => {
  await createESMRawBuild();
})();
