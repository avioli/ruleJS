var webpack = require('webpack');
var path = require('path');

var isProd = process.argv.indexOf('--prod') !== -1;
var isStandalone = process.argv.indexOf('--standalone') !== -1;

var filename = path.join('dist', '[name]');
if (isStandalone) {
  filename += '.standalone';
}
if (isProd) {
  filename += '.min';
}
filename += '.js';

var plugins = [
  new webpack.optimize.DedupePlugin(),

  // this is required to be consumed by require.js
  new webpack.dependencies.LabeledModulesPlugin()
];
if (isProd) {
  plugins.push(new webpack.optimize.UglifyJsPlugin());
}

module.exports = {
  entry: {
    'ruleJS': path.join(__dirname, 'index'),
    // 'ruleJS.ui': path.join(__dirname, 'ui')
  },
  output: {
    path: __dirname,
    filename: filename,
    library: 'ruleJS',
    libraryTarget: 'umd'
  },
  plugins: plugins
};
