const path = require("path");
const webpack = require("webpack");
const autoprefixer = require("autoprefixer");
const { parseEnvVariables } = require("./env");
const TerserPlugin = require("terser-webpack-plugin");
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

/**
 * Note:
 * Build: excalidraw/src/packages/excalidraw [master]$ yarn build:umd
 * After build add this line to the top of the file(it works on chrome, firefix and opera):
 * window.EXCALIDRAW_ASSET_PATH = chrome.runtime.getURL('/assets/');
 *
 * To build use(this also addas the assets path):
yarn build:umd && sed -i '.bak' "1s/^/window.EXCALIDRAW_ASSET_PATH = chrome.runtime.getURL('\/assets\/');\n/g" dist/excalidraw.production.min.js
 */

module.exports = {
  mode: "production",
  entry: {
    "excalidraw.production.min": "./entry.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    library: "ExcalidrawLib",
    libraryTarget: "umd",
    filename: "[name].js",
    // Avoid chunks, it generates errors on loading in chrome extension.
    // chunkFilename: "excalidraw-assets/[name]-[contenthash].js",
    assetModuleFilename: "excalidraw-assets/[name][ext]",
    publicPath: "",
    chunkLoading: false,
  },
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".css", ".scss"],
  },
  module: {
    rules: [
      {
        test: /\.(sa|sc|c)ss$/,
        exclude: /node_modules/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
          },
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: [autoprefixer()],
              },
            },
          },
          "sass-loader",
        ],
      },
      // So that type module works with webpack
      // https://github.com/webpack/webpack/issues/11467#issuecomment-691873586
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.(ts|tsx|js|jsx|mjs)$/,
        exclude:
          /node_modules[\\/](?!(browser-fs-access|canvas-roundrect-polyfill))/,
        use: [
          {
            loader: "import-meta-loader",
          },
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              configFile: path.resolve(__dirname, "../tsconfig.prod.json"),
            },
          },
          {
            loader: "babel-loader",
            options: {
              presets: [
                "@babel/preset-env",
                ["@babel/preset-react", { runtime: "automatic" }],
                "@babel/preset-typescript",
              ],
              plugins: [
                "transform-class-properties",
                "@babel/plugin-transform-runtime",
              ],
            },
          },
        ],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: "asset/resource",
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        test: /\.js($|\?)/i,
        // Avoid "invalid UTF-8 script" like errors on chrome extension
        terserOptions: {
          ecma: 6,
          output: {
            ascii_only: true,
          },
        },
      }),
    ],
    splitChunks: {
      chunks: "async",
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendor",
        },
      },
    },
  },
  plugins: [
    ...(process.env.ANALYZER === "true" ? [new BundleAnalyzerPlugin()] : []),
    new webpack.DefinePlugin({
      "process.env": parseEnvVariables(
        path.resolve(__dirname, "../../../.env.production"),
      ),
    }),
  ],
  externals: {
    react: {
      root: "React",
      commonjs2: "react",
      commonjs: "react",
      amd: "react",
    },
    "react-dom": {
      root: "ReactDOM",
      commonjs2: "react-dom",
      commonjs: "react-dom",
      amd: "react-dom",
    },
  },
};
