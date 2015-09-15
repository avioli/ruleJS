var ruleJSCore = (function (dataSource) {
  'use strict';

  /**
   * Object instance
   */
  var instance = this;

  /**
   * Current version
   *
   * @type {string}
   */
  var version = '0.0.1'; // based on ruleJS v0.0.5

  /**
   * Parser object delivered by jison library
   *
   * @type {Parser|*|{}}
   */
  var parser = {};

  var FormulaParser = function (handler) {
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
//      if (!((hash.expected && hash.expected.indexOf("';'") >= 0) &&
//        (hash.token === "}" || hash.token === "EOF" ||
//          parser.newLine || parser.wasNewLine)))
//      {
//        throw new SyntaxError(hash);
//      }
      throw {
        name: 'Parser error',
        message: str,
        prop: hash
      }
    };

    newParser.yy.handler = handler;

    return newParser;
  };

  /**
   * Exception object
   *
   * @type {{errors: {type: string, output: string}[], get: get}}
   */
  var Exception = {
    /**
     * Error types
     */
    errors: [
      {type: 'NULL', output: '#NULL'},
      {type: 'DIV_ZERO', output: '#DIV/0!'},
      {type: 'VALUE', output: '#VALUE!'},
      {type: 'REF', output: '#REF!'},
      {type: 'NAME', output: '#NAME?'},
      {type: 'NUM', output: '#NUM!'},
      {type: 'NOT_AVAILABLE', output: '#N/A!'},
      {type: 'ERROR', output: '#ERROR'},
      {type: 'NEED_UPDATE', output: '#NEED_UPDATE'}
    ],
    /**
     * Get error by type
     *
     * @param {String} type
     * @returns {*}
     */
    get: function (type) {
      var error = Exception.errors.filter(function (item) {
        return item.type === type || item.output === type;
      })[0];

      return error ? error.output : null;
    }
  };

  /**
   * Matrix collection for each form, contains cache of all items in the dataSource
   */
  var Matrix = function () {

    /**
     * Single item (cell) object
     *
     * @type {{id: string, formula: string, value: string, error: string, deps: Array}}
     */
    var item = {
      id: '',
      formula: '',
      value: '',
      error: '',
      deps: []
    };

    /**
     * Array of items
     *
     * @type {Array}
     */
    this.data = [];

    /**
     * Recalculates all matrix formulas
     *
     * @returns {Array} the recalculated matrix
     */
    this.recalculate = function () {
      return instance.matrix.data.map(function (item) {
        if (item.formula) {
          return calculateItemFormula(item.formula, item);
        }
        return item;
      });
    };

    /**
     * Get item from data array
     *
     * @param {String} id
     * @returns {*}
     */
    this.getItem = function (id) {
      return instance.matrix.data.filter(function (item) {
        return item.id === id;
      })[0];
    };

    /**
     * Remove item from data array
     *
     * @param {String} id
     */
    this.removeItem = function (id) {
      instance.matrix.data = instance.matrix.data.filter(function (item) {
        return item.id !== id;
      });
    };

    /**
     * Remove items from data array in col
     *
     * @param {Number} col
     */
    this.removeItemsInCol = function (col) {
      instance.matrix.data = instance.matrix.data.filter(function (item) {
        return item.col !== col;
      });
    };

    /**
     * Remove items from data array in row
     *
     * @param {Number} row
     */
    this.removeItemsInRow = function (row) {
      instance.matrix.data = instance.matrix.data.filter(function (item) {
        return item.row !== row;
      })
    };

    /**
     * Remove items from data array below col
     *
     * @param col
     */
    this.removeItemsBelowCol = function (col) {
      instance.matrix.data = instance.matrix.data.filter(function (item) {
        return item.col < col;
      });
    };

    /**
     * Remove items from data array below row
     *
     * @param row
     */
    this.removeItemsBelowRow = function (row) {
      instance.matrix.data = instance.matrix.data.filter(function (item) {
        return item.row < row;
      })
    };

    /**
     * Update item properties
     *
     * @param {Object|String} item or id
     * @param {Object} props
     * @returns {item} the updated item
     */
    this.updateItem = function (item, props) {
      if (instance.utils.isString(item)) {
        item = instance.matrix.getItem(item);
      }

      if (item && props) {
        for (var p in props) {
          if (item[p] && instance.utils.isArray(item[p])) {
            if (instance.utils.isArray(props[p])) {
              props[p].forEach(function (i) {
                if (item[p].indexOf(i) === -1) {
                  item[p].push(i);
                }
              });
            } else {

              if (item[p].indexOf(props[p]) === -1) {
                item[p].push(props[p]);
              }
            }
          } else {
            item[p] = props[p];
          }
        }
      }
      return item;
    };

    /**
     * Add item to data array
     *
     * @param {Object} item
     */
    this.addItem = function (item) {
      var cellId = item.id;

      if (! instance.utils.isSet(item.row) || ! instance.utils.isSet(item.col)) {
        var coords = instance.utils.cellCoords(cellId);
        // TODO: Make immutable
        item.row = coords.row;
        item.col = coords.col;
      }

      var cellExists = instance.matrix.getItem(cellId);

      if (! cellExists) {
        instance.matrix.data.push(item);
      } else {
        instance.matrix.updateItem(cellExists, item);
      }

      return cellExists || item;
    };

    /**
     * Get references items to column
     *
     * @param {Number} col
     * @returns {Array}
     *
     * TODO: remove if not used
     */
    this.getRefItemsToColumn = function (col) {
      var result = [];

      if (!instance.matrix.data.length) {
        return result;
      }

      instance.matrix.data.forEach(function (item) {
        if (item.deps) {
          var deps = item.deps.filter(function (cell) {

            var alpha = instance.utils.getCellAlphaNum(cell).alpha,
              num = instance.utils.toNum(alpha);

            return num >= col;
          });

          if (deps.length > 0 && result.indexOf(item.id) === -1) {
            result.push(item.id);
          }
        }
      });

      return result;
    };

    /**
     * Get references items to row
     *
     * @param {Number} row
     * @returns {Array}
     *
     * TODO: remove if not used
     */
    this.getRefItemsToRow = function (row) {
      var result = [];

      if (!instance.matrix.data.length) {
        return result;
      }

      instance.matrix.data.forEach(function (item) {
        if (item.deps) {
          var deps = item.deps.filter(function (cell) {
            var num = instance.utils.getCellAlphaNum(cell).num;
            return num > row;
          });

          if (deps.length > 0 && result.indexOf(item.id) === -1) {
            result.push(item.id);
          }
        }
      });

      return result;
    };

    /**
     * Get cell dependencies
     *
     * @param {String} id
     * @returns {Array}
     */
    this.getDependencies = function (id) {
      // console.log('matrix.getDependencies', arguments);
      /**
       * Get dependencies by id
       *
       * @param {String} id
       * @returns {Array}
       */
      var getDependencies = function (id) {
        // console.log('getDependencies', arguments);
        // TODO: convert to use reduce()

        var deps = [];

        instance.matrix.data.forEach(function (item) {
          if (item.deps && item.deps.length && item.deps.indexOf(id) > -1 && deps.indexOf(item.id) === -1) {
            deps.push(item.id);
          }
        });
        // console.log('deps', deps);

        return deps;
      };

      /**
       * Get all dependencies
       *
       * @param {String} id
       */
      var getDependenciesDeep = function (id, accumulator) {
        // console.log('getDependenciesDeep', arguments);

        getDependencies(id).forEach(function (refId) {
          if (accumulator.indexOf(refId) === -1) {
            accumulator.push(refId);

            var item = instance.matrix.getItem(refId);
            if (item.deps && item.deps.length) {
              getDependenciesDeep(refId, accumulator);
            }
          }
        });

        return accumulator;
      };

      return getDependenciesDeep(id, []);
    };

    /**
     * Calculate item formula
     *
     * @param {String} formula
     * @param {item} reference item
     * @returns {item} the updated item
     */
    var calculateItemFormula = function (formula, item) {
      // to avoid double translate formulas, update item data in parser
      var parsed = parse(formula, item);
      return instance.matrix.updateItem(item, parsed);
    };

    this.depsInFormula = function (item) {

      var formula = item.formula,
          deps = item.deps;

      if (deps) {
        deps = deps.filter(function (id) {
          return formula.indexOf(id) !== -1;
        });

        return deps.length > 0;
      }

      return false;
    };

    /**
     * Scan the dataSource and build the calculation matrix
     *
     * @param {Array} dataSource array of arrays
     */
    this.scan = function (dataSource) {
      dataSource.forEach(function (row, j) {
        row.forEach(function (data, k) {
          var id = instance.utils.translateCellCoords({row: j, col: k}),
              formula = null,
              value = null;

          if (instance.utils.isFormula(data)) {
            formula = data.substr(1);
          } else {
            value = data;
          }

          instance.matrix.addItem({
            id: id,
            row: j,
            col: k,
            value: value,
            formula: formula
          });
        });
      });
    };
  };

  /**
   * Utils methods
   *
   * @type {{isArray: isArray, toNum: toNum, toChar: toChar, cellCoords: cellCoords}}
   */
  var utils = {
    /**
     * Check if value is array
     *
     * @param value
     * @returns {boolean}
     *
     * PARSER callback
     */
    isArray: function (value) {
      return Object.prototype.toString.call(value) === '[object Array]';
    },

    /**
     * Check if value is number
     *
     * @param value
     * @returns {boolean}
     */
    isNumber: function (value) {
      return Object.prototype.toString.call(value) === '[object Number]';
    },

    /**
     * Check if value is string
     *
     * @param value
     * @returns {boolean}
     */
    isString: function (value) {
      return Object.prototype.toString.call(value) === '[object String]';
    },

    /**
     * Check if value is function
     *
     * @param value
     * @returns {boolean}
     */
    isFunction: function (value) {
      return Object.prototype.toString.call(value) === '[object Function]';
    },

    /**
     * Check if value is undefined
     *
     * @param value
     * @returns {boolean}
     */
    isUndefined: function (value) {
      return Object.prototype.toString.call(value) === '[object Undefined]';
    },

    /**
     * Check if value is null
     *
     * @param value
     * @returns {boolean}
     */
    isNull: function (value) {
      return Object.prototype.toString.call(value) === '[object Null]';
    },

    /**
     * Check if value is set
     *
     * @param value
     * @returns {boolean}
     */
    isSet: function (value) {
      return !instance.utils.isUndefined(value) && !instance.utils.isNull(value);
    },

    /**
     * Check if value is cell
     *
     * @param {String} value
     * @returns {Boolean}
     */
    isCell: function (value) {
      return value.match(/^[A-Za-z]+[0-9]+/) ? true : false;
    },

    /**
     * Check if value is formula
     *
     * @param {String} value
     * @returns {Boolean}
     */
    isFormula: function (value) {
      return instance.utils.isString(value) && value.length > 1 && value.substr(0, 1) === '=';
    },

    /**
     * Get row name and column number
     *
     * @param cell
     * @returns {{alpha: string, num: number}}
     */
    getCellAlphaNum: function (cell) {
      var num = cell.match(/\d+$/),
          alpha = cell.replace(num, '');

      return {
        alpha: alpha,
        num: parseInt(num[0], 10)
      }
    },

    /**
     * Change row cell index A1 -> A2
     *
     * @param {String} cell
     * @param {Number} counter
     * @returns {String}
     */
    changeRowIndex: function (cell, counter) {
      var alphaNum = instance.utils.getCellAlphaNum(cell),
          alpha = alphaNum.alpha,
          col = alpha,
          row = parseInt(alphaNum.num + counter, 10);

      if (row < 1) {
        row = 1;
      }

      return col + '' + row;
    },

    /**
     * Change col cell index A1 -> B1 Z1 -> AA1
     *
     * @param {String} cell
     * @param {Number} counter
     * @returns {String}
     */
    changeColIndex: function (cell, counter) {
      var alphaNum = instance.utils.getCellAlphaNum(cell),
          alpha = alphaNum.alpha,
          col = instance.utils.toChar(parseInt(instance.utils.toNum(alpha) + counter, 10)),
          row = alphaNum.num;

      if (!col || col.length === 0) {
        col = 'A';
      }

      var fixedCol = alpha[0] === '$' || false,
          fixedRow = alpha[alpha.length - 1] === '$' || false;

      col = (fixedCol ? '$' : '') + col;
      row = (fixedRow ? '$' : '') + row;

      return col + '' + row;
    },

    /**
     * Change formula
     *
     * @param  {String} formula  The formula to change
     * @param  {int}    delta    A delta
     * @param  {Object} change   Col/Row object
     * @return {Array}           The new match
     *
     * TODO: Not used
     */
    changeFormula: function (formula, delta, change) {
      if (!delta) {
        delta = 1;
      }

      return formula.replace(/(\$?[A-Za-z]+\$?[0-9]+)/g, function (match) {
        var alphaNum = instance.utils.getCellAlphaNum(match),
            alpha = alphaNum.alpha,
            num = alphaNum.num;

        if (instance.utils.isNumber(change.col)) {
          num = instance.utils.toNum(alpha);

          if (change.col <= num) {
            return instance.utils.changeColIndex(match, delta);
          }
        }

        if (instance.utils.isNumber(change.row)) {
          if (change.row < num) {
            return instance.utils.changeRowIndex(match, delta);
          }
        }

        return match;
      });
    },

    /**
     * Update formula cells
     *
     * @param {String} formula
     * @param {String} direction
     * @param {Number} delta
     * @returns {String}
     */
    updateFormula: function (formula, direction, delta) {
      var type,
          counter;

      // left, right -> col
      if (['left', 'right'].indexOf(direction) !== -1) {
        type = 'col';
      } else if (['up', 'down'].indexOf(direction) !== -1) {
        type = 'row'
      }

      // down, up -> row
      if (['down', 'right'].indexOf(direction) !== -1) {
        counter = delta * 1;
      } else if(['up', 'left'].indexOf(direction) !== -1) {
        counter = delta * (-1);
      }

      if (type && counter) {
        return formula.replace(/(\$?[A-Za-z]+\$?[0-9]+)/g, function (match) {

          var alpha = instance.utils.getCellAlphaNum(match).alpha;

          var fixedCol = alpha[0] === '$' || false,
              fixedRow = alpha[alpha.length - 1] === '$' || false;

          if (type === 'row' && fixedRow) {
            return match;
          }

          if (type === 'col' && fixedCol) {
            return match;
          }

          return (type === 'row' ? instance.utils.changeRowIndex(match, counter) : instance.utils.changeColIndex(match, counter));
        });
      }

      return formula;
    },

    /**
     * Convert string char to number e.g A => 0, Z => 25, AA => 27
     *
     * @param {String} chr
     * @returns {Number}
     */
    toNum: function (chr) {
//      chr = instance.utils.clearFormula(chr).split('');
//
//      var base = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"],
//          i, j, result = 0;
//
//      for (i = 0, j = chr.length - 1; i < chr.length; i += 1, j -= 1) {
//        result += Math.pow(base.length, j) * (base.indexOf(chr[i]));
//      }
//
//      return result;

      chr = instance.utils.clearFormula(chr);
      var base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', i, j, result = 0;

      for (i = 0, j = chr.length - 1; i < chr.length; i += 1, j -= 1) {
        result += Math.pow(base.length, j) * (base.indexOf(chr[i]) + 1);
      }

      if (result) {
        --result;
      }

      return result;
    },

    /**
     * Convert number to string char, e.g 0 => A, 25 => Z, 26 => AA
     *
     * @param {Number} num
     * @returns {String}
     */
    toChar: function (num) {
      var s = '';

      while (num >= 0) {
        s = String.fromCharCode(num % 26 + 97) + s;
        num = Math.floor(num / 26) - 1;
      }

      return s.toUpperCase();
    },

    /**
     * Get cell coordinates
     *
     * @param {String} cell A1
     * @returns {{row: Number, col: number}}
     */
    cellCoords: function (cell) {
      var num = cell.match(/\d+$/),
          alpha = cell.replace(num, '');

      return {
        row: parseInt(num[0], 10) - 1,
        col: instance.utils.toNum(alpha)
      };
    },

    /**
     * Remove $ from formula
     *
     * @param {String} formula
     * @returns {String|void}
     */
    clearFormula: function (formula) {
      return formula.replace(/\$/g, '');
    },

    /**
     * Translate cell coordinates to merged form {row:0, col:0} -> A1
     *
     * @param coords
     * @returns {string}
     */
    translateCellCoords: function (coords) {
      return instance.utils.toChar(coords.col) + '' + parseInt(coords.row + 1, 10);
    },

    /**
     * Iterate cell range and get theirs indexes and values
     *
     * @param {Object} startCell ex.: {row:1, col: 1}
     * @param {Object} endCell ex.: {row:10, col: 1}
     * @param {Function=} callback
     * @returns {{index: Array, value: Array}}
     */
    iterateCells: function (startCell, endCell, callback) {
      var result = {
        index: [], // list of cell index: A1, A2, A3
        value: []  // list of cell value
      };

      var cols = {
        start: 0,
        end: 0
      };

      if (endCell.col >= startCell.col) {
        cols = {
          start: startCell.col,
          end: endCell.col
        };
      } else {
        cols = {
          start: endCell.col,
          end: startCell.col
        };
      }

      var rows = {
        start: 0,
        end: 0
      };

      if (endCell.row >= startCell.row) {
        rows = {
          start: startCell.row,
          end: endCell.row
        };
      } else {
        rows = {
          start: endCell.row,
          end: startCell.row
        };
      }

      for (var row = rows.start, j = 0; row <= rows.end; row++, j++) {
        for (var column = cols.start, k = 0; column <= cols.end; column++, k++) {
          var cellIndex = instance.utils.toChar(column) + (row + 1),
              cellValue = instance.helper.cellValue.call(this, cellIndex);

          if ('undefined' === typeof result.index[j]) {
            result.index[j] = [];
            result.value[j] = [];
          }

          result.index[j][k] = cellIndex;
          result.value[j][k] = cellValue;
        }
      }

      if (instance.utils.isFunction(callback)) {
        return callback.apply(callback, [result]);
      } else {
        return result;
      }
    },

    sort: function (rev) {
      return function (a, b) {
        return ((a < b) ? -1 : ((a > b) ? 1 : 0)) * (rev ? -1 : 1);
      }
    }
  };

  /**
   * Helper with methods using by parser
   *
   * @type {{number: number, numberInverted: numberInverted, mathMatch: mathMatch, callFunction: callFunction}}
   */
  var helper = {
    /**
     * List of supported formulas
     */
    SUPPORTED_FORMULAS: [
      'ABS', 'ACCRINT', 'ACOS', 'ACOSH', 'ACOTH', 'AND', 'ARABIC', 'ASIN', 'ASINH', 'ATAN', 'ATAN2', 'ATANH', 'AVEDEV', 'AVERAGE', 'AVERAGEA', 'AVERAGEIF',
      'BASE', 'BESSELI', 'BESSELJ', 'BESSELK', 'BESSELY', 'BETADIST', 'BETAINV', 'BIN2DEC', 'BIN2HEX', 'BIN2OCT', 'BINOMDIST', 'BINOMDISTRANGE', 'BINOMINV', 'BITAND', 'BITLSHIFT', 'BITOR', 'BITRSHIFT', 'BITXOR',
      'CEILING', 'CEILINGMATH', 'CEILINGPRECISE', 'CHAR', 'CHISQDIST', 'CHISQINV', 'CODE', 'COMBIN', 'COMBINA', 'COMPLEX', 'CONCATENATE', 'CONFIDENCENORM', 'CONFIDENCET', 'CONVERT', 'CORREL', 'COS', 'COSH', 'COT', 'COTH', 'COUNT', 'COUNTA', 'COUNTBLANK', 'COUNTIF', 'COUNTIFS', 'COUNTIN', 'COUNTUNIQUE', 'COVARIANCEP', 'COVARIANCES', 'CSC', 'CSCH', 'CUMIPMT', 'CUMPRINC',
      'DATE', 'DATEVALUE', 'DAY', 'DAYS', 'DAYS360', 'DB', 'DDB', 'DEC2BIN', 'DEC2HEX', 'DEC2OCT', 'DECIMAL', 'DEGREES', 'DELTA', 'DEVSQ', 'DOLLAR', 'DOLLARDE', 'DOLLARFR',
      'E', 'EDATE', 'EFFECT', 'EOMONTH', 'ERF', 'ERFC', 'EVEN', 'EXACT', 'EXPONDIST',
      'FALSE', 'FDIST', 'FINV', 'FISHER', 'FISHERINV',
      'IF', 'INT', 'ISEVEN', 'ISODD',
      'LN', 'LOG', 'LOG10',
      'MAX', 'MAXA', 'MEDIAN', 'MIN', 'MINA', 'MOD',
      'NOT',
      'ODD', 'OR',
      'PI', 'POWER',
      'ROUND', 'ROUNDDOWN', 'ROUNDUP',
      'SIN', 'SINH', 'SPLIT', 'SQRT', 'SQRTPI', 'SUM', 'SUMIF', 'SUMIFS', 'SUMPRODUCT', 'SUMSQ', 'SUMX2MY2', 'SUMX2PY2', 'SUMXMY2',
      'TAN', 'TANH', 'TRUE', 'TRUNC',
      'XOR'
    ],

    /**
     * Get number
     *
     * @param  {Number|String} num
     * @returns {Number}
     *
     * PARSER callback
     */
    number: function (num) {
      if (num === null) {
        return 0;
      }

      switch (typeof num) {
        case 'undefined':
          return 0;
        case 'number':
          return num;
        case 'string':
          if (!isNaN(num)) {
            if (num.length === 0) return 0;
            return num.indexOf('.') > -1 ? parseFloat(num) : parseInt(num, 10);
          }
      }

      return num;
    },

    /**
     * Get string
     *
     * @param {Number|String} str
     * @returns {string}
     *
     * PARSER callback
     */
    string: function (str) {
      return str.substring(1, str.length - 1);
    },

    /**
     * Invert number
     *
     * @param num
     * @returns {Number}
     *
     * PARSER callback
     */
    numberInverted: function (num) {
      return this.number(num) * (-1);
    },

    /**
     * Match special operation
     *
     * @param {String} type
     * @param {String} exp1
     * @param {String} exp2
     * @returns {*}
     *
     * PARSER callback
     */
    specialMatch: function (type, exp1, exp2) {
      if (instance.helper.ISERROR(exp1)) {
        return exp1;
      }

      if (instance.helper.ISERROR(exp2)) {
        return exp2;
      }
      var result;

      switch (type) {
        case '&':
          result = exp1.toString() + exp2.toString();
          break;
      }
      return result;
    },

    ISERR: function (value) {
      switch (value) {
        case '#DIV/0!':
        case '#VALUE!':
        case '#NUM!':
        case '#NULL!':
        case '#REF!':
        case '#NAME?':
          return true;
        default:
          return false;
      }
    },

    ISERROR: function (value) {
      return instance.helper.ISERR(value) || value === '#N/A';
    },

    /**
     * Match logic operation
     *
     * @param {String} type
     * @param {String|Number} exp1
     * @param {String|Number} exp2
     * @returns {Boolean} result
     *
     * PARSER callback
     */
    logicMatch: function (type, exp1, exp2) {
      if (instance.helper.ISERROR(exp1)) {
        return exp1;
      }

      if (instance.helper.ISERROR(exp2)) {
        return exp2;
      }

      var result;

      switch (type) {
        case '=':
          result = (exp1 === exp2);
          break;

        case '>':
          result = (exp1 > exp2);
          break;

        case '<':
          result = (exp1 < exp2);
          break;

        case '>=':
          result = (exp1 >= exp2);
          break;

        case '<=':
          result = (exp1 <= exp2);
          break;

        case '<>': /* falls through */
        case 'NOT':
          result = (exp1 !== exp2);
          break;
      }

      return result;
    },

    /**
     * Match math operation
     *
     * @param {String} type
     * @param {Number} number1
     * @param {Number} number2
     * @returns {*}
     *
     * PARSER callback
     */
    mathMatch: function (type, number1, number2) {
      if (instance.helper.ISERROR(number1)) {
        return number1;
      }

      if (instance.helper.ISERROR(number2)) {
        return number2;
      }
      var result;

      number1 = helper.number(number1);
      number2 = helper.number(number2);

      if (isNaN(number1) || isNaN(number2)) {

        if (number1[0] === '=' || number2[0] === '=') {
          throw Error('NEED_UPDATE');
        }

        throw Error('VALUE');
      }

      switch (type) {
        case '+':
          result = number1 + number2;
          break;
        case '-':
          result = number1 - number2;
          break;
        case '/':
          result = number1 / number2;
          if (result == Infinity) {
            throw Error('DIV_ZERO');
          } else if (isNaN(result)) {
            throw Error('VALUE');
          }
          break;
        case '*':
          result = number1 * number2;
          break;
        case '^':
          result = Math.pow(number1, number2);
          break;
      }

      return result;
    },

    /**
     * Call function from formula
     *
     * @param {String} fn
     * @param {Array} args
     * @returns {*}
     *
     * PARSER callback
     */
    callFunction: function (fn, args) {
      // console.log('callFunction', arguments);
      fn = fn.toUpperCase();
      args = args || [];

      // TODO: move to Formula.js
      if (fn !== 'IFERROR' && _.some(_.flatten(args), instance.helper.ISERROR)) {
        return Error('VALUE');
      }

      if (instance.helper.SUPPORTED_FORMULAS.indexOf(fn) > -1) {
        if (instance.formulas[fn]) {
          var value = instance.formulas[fn].apply(this, args);
          return value;
        }
      }

      throw Error('NAME');
    },

    /**
     * Get variable from formula
     *
     * @param {Array} args
     * @returns {*}
     *
     * PARSER callback
     */
    callVariable: function (args) {
      // console.log('callVariable', arguments);
      args = args || [];
      var str = args[0];

      if (str) {
        str = str.toUpperCase();
        if (instance.formulas[str]) {
          return ((typeof instance.formulas[str] === 'function') ? instance.formulas[str].apply(this, args) : instance.formulas[str]);
        }
      }

      throw Error('NAME');
    },

    /**
     * Get cell value
     *
     * @param {String} id => A1 AA1
     * @returns {*}
     *
     * PARSER callback
     */
    cellValue: function (id) {
      // console.log('cellValue', arguments);
      var value,
          fnCellValue = instance.custom.cellValue,
          formulaItem = this,
          refItem = instance.matrix.getItem(id);

      // check if custom cellValue fn exists
      if (instance.utils.isFunction(fnCellValue)) {
        console.error('NOT COVERED');
        throw Error('TODO: NOT COVERED');

        var cellCoords = instance.utils.cellCoords(id),
            cellId = instance.utils.translateCellCoords({row: formulaItem.row, col: formulaItem.col});

        // get value
        value = refItem ? refItem.value : fnCellValue(cellCoords.row, cellCoords.col);

        if (instance.utils.isNull(value)) {
          value = 0;
        }

        if (cellId) {
          // update dependencies
          instance.matrix.updateItem(cellId, {
            deps: [id]
          });
        }

      } else {

        // get value
        value = refItem.value;

        // update dependencies
        instance.matrix.updateItem(formulaItem, {
          deps: [id]
        });
      }

      // check references error
      if (refItem && refItem.deps) {
        if (refItem.deps.indexOf(cellId) !== -1) {
          // Cyclic reference
          throw Error('REF');
        }
      }

      // check if any error occurs
      if (refItem && refItem.error) {
        throw Error(refItem.error);
      }

      // return value if is set
      if (instance.utils.isSet(value)) {
        var result = instance.helper.number(value);

        return !isNaN(result) ? result : value;
      }

      // cell is not available
      throw Error('NOT_AVAILABLE');
    },

    /**
     * Get cell range values
     *
     * @param {String} start cell A1
     * @param {String} end cell B3
     * @returns {Array}
     *
     * PARSER callback
     */
    cellRangeValue: function (start, end) {
      // console.log('cellRangeValue', arguments);
      var fnCellValue = instance.custom.cellValue,
          coordsStart = instance.utils.cellCoords(start),
          coordsEnd = instance.utils.cellCoords(end),
          formulaItem = this;

      // iterate cells to get values and indexes
      var cells = instance.utils.iterateCells.call(this, coordsStart, coordsEnd),
          result = [];

      // check if custom cellValue fn exists
      if (instance.utils.isFunction(fnCellValue)) {
        console.error('NOT COVERED');
        throw Error('TODO: NOT COVERED');

        var cellId = instance.utils.translateCellCoords({row: formulaItem.row, col: formulaItem.col});

        // update dependencies
        instance.matrix.updateItem(cellId, {deps: _.flatten(cells.index)});

      } else {

        // update dependencies
        instance.matrix.updateItem(formulaItem, {
          deps: _.flatten(cells.index)
        });
      }

      result.push(cells.value);
      return result;
    },

    /**
     * Get fixed cell value
     *
     * @param {String} id
     * @returns {*}
     *
     * PARSER callback
     */
    fixedCellValue: function (id) {
      // console.log('fixedCellValue', arguments);
      id = id.replace(/\$/g, '');
      return instance.helper.cellValue.call(this, id);
    },

    /**
     * Get fixed cell range values
     *
     * @param {String} start
     * @param {String} end
     * @returns {Array}
     *
     * PARSER callback
     */
    fixedCellRangeValue: function (start, end) {
      // console.log('fixedCellRangeValue', arguments);
      start = start.replace(/\$/g, '');
      end = end.replace(/\$/g, '');

      return instance.helper.cellRangeValue.call(this, start, end);
    }
  };

  /**
   * Parse input string using parser
   *
   * @returns {Object} {{error: *, result: *}}
   * @param formula
   * @param item
   */
  var parse = function (formula, item) {
    var result = null,
        error = null;

    if (formula.substr(0, 1) === '=') {
      formula = formula.substr(1);
    }

    try {
      // console.log('parse', arguments);

      parser.setObj(item);
      result = parser.parse(formula);

      var id;

      if (item && item.id) {
        id = item.id;
      }

      var deps = instance.matrix.getDependencies(id);

      if (deps.indexOf(id) !== -1) {
        // cyclic reference
        console.error('CYCLIC REFERENCE', id);
        result = null;

        deps.forEach(function (id) {
          instance.matrix.updateItem(id, {
            error: Exception.get('REF'),
            value: null
          });
        });

        throw Error('REF');
      }

    } catch (ex) {

      var message = Exception.get(ex.message);

      if (message) {
        error = message;
      } else {
        error = Exception.get('ERROR');
      }

      //console.debug(ex.prop);
      //debugger;
      //error = ex.message;
      //error = Exception.get('ERROR');
    }

    return {
      error: error,
      value: result
    }
  };

  /**
   * Get a sanitized item from a matrix item
   *
   * @param  {item}   item  The matrix item
   * @return {Object}       A sanitized item
   */
  var resultItem = function (item) {
    return {
      id: item.id,
      value: item.value || null,
      error: item.error || null,
      formula: item.formula ? ('=' + item.formula) : null,
    };
  };

  /**
   * Get the value of an item
   *
   * @param  {String} id  The id
   * @return {Object}     A sanitized item
   */
  var getItemValue = function (id) {
    var item = instance.matrix.getItem(id);
    // TODO: error checking
    return resultItem(item);
  };

  /**
   * Get the values of the items from given ids
   *
   * @param  {Array} ids  The ids
   * @return {Array}      The items
   */
  var getItemsValues = function (ids) {
    return ids.map(getItemValue);
  }

  /**
   * Updates an existing matrix item and recalculates the dependant items
   *
   * @param {String} id        The id of the item to update
   * @param {*}      newValue  The new value
   */
  var setItemValue = function (id, newValue) {
    var item = instance.matrix.getItem(id);
    if (! item) {
      throw new Error('ERROR: No item with id: ' + id);
    }

    var formula = null,
        value = null;

    if (instance.utils.isFormula(newValue)) {
      formula = newValue.substr(1);
    } else {
      value = newValue;
    }

    instance.matrix.updateItem(item, {
      value: value,
      formula: formula,
    });

    // CHECK: recalculate only the dependant items + time ones (and their dependant ones)
    instance.matrix.recalculate();

    return resultItem(item);
  };

  /**
   * Return all items in an array of arrays (rows/columns)
   *
   * @return {Array}
   */
  var getAllItems = function () {
    var rows = [];

    instance.matrix.data.forEach(function (item) {
      var row = item.row,
          col = item.col;

      if ('undefined' === typeof rows[row]) {
        rows[row] = [];
      }

      rows[row][col] = resultItem(item);
    });

    return rows;
  };

  /**
   * Returns the ids of the items that are dependants of a given id
   *
   * @param  {String} id The id of the item
   * @return {Array}     An array of ids
   */
  var getDependantIds = function (id) {
    return instance.matrix.getDependencies(id);
  };

  /**
   * Recalculates the matrix (useful for time functions)
   */
  var recalculate = function () {
    instance.matrix.recalculate();
  };

  var options = {
    trackFormulasCoverage: false,
    supportedFormulas: 'all',
  };

  /**
   * Initial method, create formulas, parser and matrix objects
   */
  var init = function (args) {
    options = _.extend({}, options, args);

    instance = this;

    parser = new FormulaParser(instance);

    instance.formulas = Formula;

    if (options.supportedFormulas !== 'all' && _.isArray(options.supportedFormulas)) {
      var supportedFormulas = _.filter(options.supportedFormulas, _.isString);
      instance.helper.SUPPORTED_FORMULAS = supportedFormulas;
    }

    instance.matrix = new Matrix();

    // will hold custom functions
    // TODO: investigate what populates this
    instance.custom = {};

    if (dataSource) {
      instance.matrix.scan(dataSource);
      instance.matrix.recalculate();
    }
  };

  return {
    init: init,
    version: version,
    utils: utils,
    helper: helper,
    parse: parse,
    getAllValues: getAllItems,
    getValue: getItemValue,
    setValue: setItemValue,
    getValues: getItemsValues,
    getDependantIds: getDependantIds,
    recalculate: recalculate,
  };

});
