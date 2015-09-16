var Parser = require('./parser/parser');

function FormulaParser (handler) {
  var formulaLexer = function () {};
  formulaLexer.prototype = Parser.lexer;

  var formulaParser = function () {
    this.lexer = new formulaLexer();
    this.yy = {};
  };
  formulaParser.prototype = Parser;

  var newParser = new formulaParser;
  newParser.setObj = function (obj) {
    newParser.yy.obj = obj;
  };

  newParser.yy.parseError = function (str, hash) {
    // console.log('parseError', str, hash);
    // if (!((hash.expected && hash.expected.indexOf("';'") >= 0) &&
    //  (hash.token === "}" || hash.token === "EOF" ||
    //    parser.newLine || parser.wasNewLine)))
    // {
    //  throw new SyntaxError(hash);
    // }
    throw {
      name: 'Parser error',
      message: str,
      prop: hash
    }
  };

  newParser.yy.handler = handler;

  return newParser;
};

module.exports = FormulaParser;
