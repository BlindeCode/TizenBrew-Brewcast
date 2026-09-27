const webpack = require('webpack');
const path = require('path');
const CopyWebpackPlugin = require("copy-webpack-plugin");

const buildMode = 'production';
// const buildMode = 'development';

// const TARGET = 'electron';
// const TARGET = 'webOS';
const TARGET = 'tizenOS';

// The TizenBrew module version (repo root package.json), shown by the service and sent to senders.
const APP_VERSION = require('../../package.json').version;
// How users add the module in TizenBrew. The service uses it to open the module when a cast
// arrives, so it must match, e.g. BREWCAST_MODULE=gh/BlindeCode/tizenbrew-brewcast@release.
const MODULE = process.env.BREWCAST_MODULE || 'gh/BlindeCode/tizenbrew-brewcast';

module.exports = [
    {
        mode: buildMode,
        entry: {
            preload: './src/main/Preload.ts',
            renderer: './src/main/Renderer.ts',
        },
        target: 'web',
        module: {
            rules: [
                {
                    // One rule: overlapping rules would run ts-loader twice on src/ files.
                    test: /\.tsx?$/,
                    include: [path.resolve(__dirname, '../common/web'), path.resolve(__dirname, 'lib'), path.resolve(__dirname, 'src')],
                    use: [{ loader: 'ts-loader' }]
                }
            ],
        },
        resolve: {
            alias: {
                'src': path.resolve(__dirname, 'src'),
                'lib': path.resolve(__dirname, 'lib'),
                'modules': path.resolve(__dirname, 'node_modules'),
                'common': path.resolve(__dirname, '../common/web'),
            },
            extensions: ['.tsx', '.ts', '.js'],
        },
        output: {
            filename: '[name].js',
            // NOTE: `dist/main` seems to be a reserved directory on the LGTV device??? Access denied errors otherwise when reading from main directory...
            path: path.resolve(__dirname, 'dist/main_window'),
        },
        plugins: [
            new CopyWebpackPlugin({
                patterns: [
                    // Common assets
                    {
                        from: '../common/assets/**',
                        to: '../[path][name][ext]',
                        context: path.resolve(__dirname, '..', 'common'),
                        globOptions: { ignore: ['**/*.txt'] }
                    },
                    {
                        from: '../common/web/main/common.css',
                        to: '[name][ext]',
                    },
                    // Target assets
                    { from: 'assets/icons/largeIcon.png', to: '../../FCastReceiver/icon.png' },
                    { from: 'assets/icons/largeIcon.png', to: '../../FCastReceiverService/shared/res/icon.png' },
                    {
                        from: '**',
                        to: '../assets/[path][name][ext]',
                        context: path.resolve(__dirname, 'assets'),
                    },
                    {
                        from: './src/main/*',
                        to: '[name][ext]',
                        globOptions: { ignore: ['**/*.ts'] }
                    }
                ],
            }),
            new webpack.DefinePlugin({
                TARGET: JSON.stringify(TARGET)
            })
        ]
    },
    {
        mode: buildMode,
        entry: {
            preload: './src/player/Preload.ts',
            renderer: './src/player/Renderer.ts',
        },
        target: 'web',
        module: {
            rules: [
                {
                    // One rule: overlapping rules would run ts-loader twice on src/ files.
                    test: /\.tsx?$/,
                    include: [path.resolve(__dirname, '../common/web'), path.resolve(__dirname, 'lib'), path.resolve(__dirname, 'src')],
                    use: [{ loader: 'ts-loader' }]
                }
            ],
        },
        resolve: {
            alias: {
                'src': path.resolve(__dirname, 'src'),
                'lib': path.resolve(__dirname, 'lib'),
                'modules': path.resolve(__dirname, 'node_modules'),
                'common': path.resolve(__dirname, '../common/web'),
            },
            extensions: ['.tsx', '.ts', '.js'],
        },
        output: {
            filename: '[name].js',
            path: path.resolve(__dirname, 'dist/player'),
        },
        plugins: [
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: '../common/web/player/common.css',
                        to: '[name][ext]',
                    },
                    {
                        from: './src/player/*',
                        to: '[name][ext]',
                        globOptions: { ignore: ['**/*.ts'] }
                    }
                ],
            }),
            new webpack.DefinePlugin({
                TARGET: JSON.stringify(TARGET)
            })
        ]
    },
    // Image viewer (images, and queue items that are images).
    {
        mode: buildMode,
        entry: {
            preload: './src/viewer/Preload.ts',
            renderer: './src/viewer/Renderer.ts',
        },
        target: 'web',
        module: {
            rules: [
                {
                    // One rule: overlapping rules would run ts-loader twice on src/ files.
                    test: /\.tsx?$/,
                    include: [path.resolve(__dirname, '../common/web'), path.resolve(__dirname, 'lib'), path.resolve(__dirname, 'src')],
                    use: [{ loader: 'ts-loader' }]
                }
            ],
        },
        resolve: {
            alias: {
                'src': path.resolve(__dirname, 'src'),
                'lib': path.resolve(__dirname, 'lib'),
                'modules': path.resolve(__dirname, 'node_modules'),
                'common': path.resolve(__dirname, '../common/web'),
            },
            extensions: ['.tsx', '.ts', '.js'],
        },
        output: {
            filename: '[name].js',
            path: path.resolve(__dirname, 'dist/viewer'),
        },
        plugins: [
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: '../common/web/viewer/common.css',
                        to: '[name][ext]',
                    },
                    {
                        from: './src/viewer/*',
                        to: '[name][ext]',
                        globOptions: { ignore: ['**/*.ts'] }
                    }
                ],
            }),
            new webpack.DefinePlugin({
                TARGET: JSON.stringify(TARGET)
            })
        ]
    },
    // Network service, run by TizenBrew in its Node service (package.json `serviceFile`). One
    // self-contained file: TizenBrew downloads and evaluates it with only Node's built-in modules.
    // Dependencies are compiled down to ES2018 too, so the bundle parses on older TV runtimes
    // (protocol v4 itself needs Node 12+; older runtimes get v3).
    {
        mode: buildMode,
        entry: {
            service: './service/index.ts',
        },
        target: 'node8.12',
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    include: [path.resolve(__dirname, '../common/web'), path.resolve(__dirname, 'service')],
                    use: [{ loader: 'ts-loader', options: { configFile: path.resolve(__dirname, 'tsconfig.service.json') } }]
                },
                {
                    test: /\.m?js$/,
                    include: [path.resolve(__dirname, 'node_modules')],
                    use: [{ loader: 'ts-loader', options: { configFile: path.resolve(__dirname, 'tsconfig.vendor.json'), transpileOnly: true } }]
                },
            ],
        },
        resolve: {
            alias: {
                'src': path.resolve(__dirname, 'service'),
                'modules': path.resolve(__dirname, 'node_modules'),
                'common': path.resolve(__dirname, '../common/web'),
            },
            extensions: ['.ts', '.js'],
        },
        output: {
            filename: '[name].js',
            path: path.resolve(__dirname, 'dist/service'),
        },
        optimization: {
            // Keep stack traces from the TV readable.
            minimize: false,
        },
        performance: {
            hints: false,
        },
        plugins: [
            new webpack.DefinePlugin({
                TARGET: JSON.stringify(TARGET),
                APP_VERSION: JSON.stringify(APP_VERSION),
                MODULE: JSON.stringify(MODULE),
            })
        ]
    },
];
