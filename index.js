var mods = [
  require('./lib/core'),
];

for (var c in mods) {
  var mod = mods[c];
  for (var f in mod) {
    exports[f] = exports[f] || mod[f];
  }
}
