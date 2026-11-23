// Loads game source files into a VM context for Node tests
const fs = require('fs'), vm = require('vm'), path = require('path');
module.exports = function load(files) {
  const ctx = vm.createContext({ console, Math, Date, JSON, Map, Set, Object, Array });
  const src = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n;\n');
  vm.runInContext(src, ctx);
  return name => vm.runInContext(name, ctx);
};
