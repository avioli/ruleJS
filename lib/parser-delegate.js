var _ = require('lodash');
var utils = require('./utils');
var error = require('formulajs/lib/error');
var information = require('formulajs/lib/information');
var debug = false;

/**
 * List of supported formulas
 */
var SUPPORTED_FORMULAS = [
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
];

/**
 * Delegate with methods used by the parser
 *
 * @type {{number: number, numberInverted: numberInverted, mathMatch: mathMatch, callFunction: callFunction}}
 */
var ParserDelegate = function(matrix, formulas, supportedFormulas) {
  var instance = this;

  if ('undefined' === typeof matrix) {
    throw new Error('Matrix should be set');
  }

  if ('undefined' === typeof formulas) {
    throw new Error('Formulas should be set');
  }

  if (supportedFormulas === 'all') {
    supportedFormulas = null;
  } else if (_.isArray(supportedFormulas)) {
    var filteredSupportedFormulas = _.filter(supportedFormulas, _.isString);
    supportedFormulas = filteredSupportedFormulas;
  }

  supportedFormulas = supportedFormulas || SUPPORTED_FORMULAS;

  var helper = {
    /**
     * Get number
     *
     * @param  {Number|String} num
     * @returns {Number}
     *
     * PARSER callback
     */
    number: function (num) {
      debug && window.marker && console.error('number', arguments);
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
      debug && window.marker && console.error('string', arguments);
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
      debug && window.marker && console.error('numberInverted', arguments);
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
      debug && window.marker && console.error('specialMatch', arguments);
      if (information.ISERROR(exp1)) {
        return exp1;
      }

      if (information.ISERROR(exp2)) {
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
      debug && window.marker && console.error('logicMatch', arguments);
      if (information.ISERROR(exp1)) {
        return exp1;
      }

      if (information.ISERROR(exp2)) {
        return exp2;
      }

      var result;

      switch (type) {
        case '=':
          result = (exp1 == exp2);
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
          result = (exp1 != exp2);
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
      // if (type === '/') {
      //   if (window.marker === 'C305' && number2 == 0) {
      //     debugger;
      //   }
      // }
      debug && window.marker && console.error('mathMatch', arguments);
      if (information.ISERROR(number1)) {
        return number1;
      }

      if (information.ISERROR(number2)) {
        return number2;
      }
      var result;

      number1 = helper.number(number1);
      number2 = helper.number(number2);

      if (isNaN(number1) || isNaN(number2)) {

        if (number1[0] === '=' || number2[0] === '=') {
          throw Error('NEED_UPDATE');
        }

        debug && window.marker && console.error('VALUE');
        return error.value;
        // throw Error('VALUE');
      }

      switch (type) {
        case '+': result = number1 + number2; break;
        case '-': result = number1 - number2; break;
        case '/':
          if (number2 === 0) {
            debug && window.marker && console.error('DIV_ZERO');
            return error.div0;
            // throw Error('DIV_ZERO');
          }
          result = number1 / number2;
          if (result == Infinity) {
            debug && window.marker && console.error('DIV_ZERO');
            return error.div0;
            // throw Error('DIV_ZERO');
          } else if (isNaN(result)) {
            debug && window.marker && console.error('VALUE');
            debug && window.marker && console.log(number1, number2, result);
            return error.value;
            // throw Error('VALUE');
          }
          break;
        case '*': result = number1 * number2; break;
        case '^': result = Math.pow(number1, number2); break;
      }

      debug && window.marker && console.log(result);
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
      debug && window.marker && console.error('callFunction/call', arguments);
      window.marker && console.log('callFunction', arguments);
      // console.log('callFunction', arguments);
      fn = fn.toUpperCase();
      args = args || [];

      // TODO: move to Formula.js
      // if (fn !== 'IFERROR' && _.some(_.flatten(args), information.ISERROR)) {
      //   return Error('VALUE');
      // }

      // console.log(fn, args);

      if (supportedFormulas.indexOf(fn) > -1) {
        if (formulas[fn]) {
          if ('function' === typeof formulas.__pre) {
            args = formulas.__pre.call(this, fn, args);
          }
          var value = formulas[fn].apply(this, args);
          if ('function' === typeof formulas.__post) {
            value = formulas.__post.call(this, value, fn, args);
          }
          debug && window.marker && console.log('callFunction/result', fn, args, value);
          return value;
        }
      }

      debug && window.marker && console.error('callFunction/error: NAME');
      return error.name;
      // throw Error('NAME');
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
      debug && window.marker && console.error('callVariable', arguments);
      // console.log('callVariable', arguments);
      args = args || [];
      var str = args[0];

      if (str) {
        str = str.toUpperCase();
        if (formulas[str]) {
          return ((typeof formulas[str] === 'function') ? formulas[str].apply(this, args) : formulas[str]);
        }
      }

      return error.name;
      // throw Error('NAME');
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
      debug && window.marker && console.error('cellValue/call');
      debug && window.marker && console.log('cellValue/argumnets', arguments)
      // console.log('cellValue', arguments);
      var value,
          formulaItem = this,
          refItem = matrix.getItem(id),
          cellId = utils.translateCellCoords({row: formulaItem.row, col: formulaItem.col});

      debug && window.marker && console.log('cellValue/formulaItem', formulaItem);
      // get value
      if ('undefined' === typeof refItem) {
        console.error('refItem is undefined');
      }
      value = refItem.value;
      debug && window.marker && console.log('cellValue/refItem.value', value);
      debug && window.marker && console.log('cellValue/refItem', refItem);

      // update dependencies
      matrix.updateItem(formulaItem, {
        deps: [id]
      });

      // check references error
      if (refItem && refItem.deps) {
        if (refItem.deps.indexOf(cellId) !== -1) {
          // Cyclic reference
          console.error('CYCLIC REFERENCE refItem/cellId: ', cellId, JSON.stringify(refItem.deps));
          return error.ref;
          // throw Error('REF');
        }
      }

      // check if any error occurs
      if (refItem && refItem.error) {
        return Error(refItem.error);
        // throw Error(refItem.error);
      }

      // return value if is set
      if (utils.isSet(value)) {
        var result = helper.number(value);
        result = !isNaN(result) ? result : value;

        debug && window.marker && console.log('cellValue/result', result);
        return result;
      }

      // cell is not available -- out of bounds
      debug && window.marker && console.log('cellValue/na', error.na);
      return error.na;
      // throw Error('NOT_AVAILABLE');
    },

    /**
     * Iterate cell range and get theirs indexes and values
     *
     * @param {Object} startCell ex.: {row:1, col: 1}
     * @param {Object} endCell ex.: {row:10, col: 1}
     * @param {Function=} callback
     * @returns {{index: Array, value: Array}}
     */
    iterateCells: function (startCell, endCell /*, callback*/) {
      debug && window.marker && console.error('iterateCells/call', arguments);
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

      debug && window.marker && console.log('iterateCells/params', cols, rows);

      for (var column = cols.start, k = 0; column <= cols.end; column++, k++) {
        var colIndex = utils.toChar(column);
        for (var row = rows.start, j = 0; row <= rows.end; row++, j++) {
          var cellIndex = colIndex + (row + 1),
              cellValue = null;

          try {
            cellValue = helper.cellValue.call(this, cellIndex);
          } catch (ex) {
            debug && window.marker && console.error('iterateCells/error', ex);
          }

          if ('undefined' === typeof result.index[j]) {
            result.index[j] = [];
            result.value[j] = [];
          }

          result.index[j][k] = cellIndex;
          result.value[j][k] = cellValue;
        }
      }

      debug && window.marker && console.log('iterateCells/result.index', result.index);
      debug && window.marker && console.log('iterateCells/result.value', result.value);

      // if (utils.isFunction(callback)) {
      //   return callback.apply(callback, [result]);
      // } else {
        return result;
      // }
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
      debug && window.marker && console.error('cellRangeValue/call', arguments);
      // console.log('cellRangeValue', arguments);
      var coordsStart = utils.cellCoords(start),
          coordsEnd = utils.cellCoords(end),
          formulaItem = this;

      // iterate cells to get values and indexes
      var cells = helper.iterateCells.call(this, coordsStart, coordsEnd),
          result = cells.value;

      debug && window.marker && console.log('cellRangeValue/cells', result);

      // update dependencies
      var flatDeps = _.flatten(cells.index);
      matrix.updateItem(formulaItem, {
        deps: flatDeps
      });

      // result.push(cells.value);
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
      debug && window.marker && console.error('fixedCellValue', arguments);
      // console.log('fixedCellValue', arguments);
      id = id.replace(/\$/g, '');
      return helper.cellValue.call(this, id);
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
      debug && window.marker && console.error('fixedCellRangeValue', arguments);
      // console.log('fixedCellRangeValue', arguments);
      start = start.replace(/\$/g, '');
      end = end.replace(/\$/g, '');

      return helper.cellRangeValue.call(this, start, end);
    },

    isArray: _.isArray,

  };

  return helper;
};

module.exports = ParserDelegate;
