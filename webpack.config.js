const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');


module.exports = (env, argv) => {
  const mode = argv.mode || 'development';
  const isProduction = mode === 'production';

  console.log(`Building ScrollTube Library in ${mode} mode...`);

  const dedicationString = `/*
    Venovani:
    Tento plugin je venovan me rodine - mamince Svetle,
    manzelce Verce, detem Natalce a Alexovi
    a nasi dceri Agatce, ktera navzdy zustane v nasich srdcich.
 
    Dedication:
    This plugin is dedicated to my family - my mother Svetla,
    my wife Verca, my children Natalka and Alex,
    and our daughter Agatka, who will forever remain in our hearts.
*/

`;

  // Base configuration shared between 
  const sharedConfig = {
    mode: mode,
    target: 'web',
    devtool: isProduction ? false : 'source-map',
    stats: {
      children: false,
      modules: false,
    },
    optimization: {
      concatenateModules: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            format: {
              comments: /Dedication:/i, // Preserve the dedication banner
            },
          },
          extractComments: false,
        }),
      ],
    },
    resolve: {
      alias: {
        'lodash-es': 'lodash'
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: path.resolve(__dirname, 'tsconfig.json'),
                transpileOnly: !isProduction,
              },
            },
          ],
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource',
        },
      ],
    },

    plugins: [
      new webpack.BannerPlugin({
        raw: true,
        banner: dedicationString,
        stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
        entryOnly: true
      })
    ],
  };

  return [
    // 1. CORE VERSION
    {
      ...sharedConfig,
      name: 'core',
      entry: {
        "scrolltube": path.resolve(__dirname, 'src/core/index.ts'),
      },
      output: {
        path: path.resolve(__dirname, 'dist/core'),
        filename: "[name].umd.min.js",
        library: {
          name: 'ScrollTube',
          type: 'umd',
          export: 'default',
        },
        globalObject: 'this',
      },
      plugins: [
        new CleanWebpackPlugin(),
        ...sharedConfig.plugins
      ]
    },
    // 2. REACT VERSION
    {
      ...sharedConfig,
      name: 'react',
      entry: {
        "scrolltube-react": path.resolve(__dirname, 'src/react/index.ts'),
      },
      output: {
        path: path.resolve(__dirname, 'dist/react'),
        filename: "index.js",
        library: {
          name: 'ScrollTubeReact',
          type: 'umd',
        },
        globalObject: 'this',
      },
      // IMPORTANT: Don't bundle React!
      externals: {
        react: 'react',
        'react-dom': 'react-dom'
      },
      plugins: [
        new CleanWebpackPlugin(),
        ...sharedConfig.plugins,
      ]
    },
  ];
};
