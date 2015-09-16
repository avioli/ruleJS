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
    window.marker && console.error('isArray', arguments);
    return Object.prototype.toString.call(value) === '[object Array]';
  },

  /**
   * Check if value is number
   *
   * @param value
   * @returns {boolean}
   */
  isNumber: function (value) {
    window.marker && console.error('isNumber', arguments);
    return Object.prototype.toString.call(value) === '[object Number]';
  },

  /**
   * Check if value is string
   *
   * @param value
   * @returns {boolean}
   */
  isString: function (value) {
    window.marker && console.error('isString', arguments);
    return Object.prototype.toString.call(value) === '[object String]';
  },

  /**
   * Check if value is function
   *
   * @param value
   * @returns {boolean}
   */
  isFunction: function (value) {
    window.marker && console.error('isFunction', arguments);
    return Object.prototype.toString.call(value) === '[object Function]';
  },

  /**
   * Check if value is undefined
   *
   * @param value
   * @returns {boolean}
   */
  isUndefined: function (value) {
    window.marker && console.error('isUndefined', arguments);
    return Object.prototype.toString.call(value) === '[object Undefined]';
  },

  /**
   * Check if value is null
   *
   * @param value
   * @returns {boolean}
   */
  isNull: function (value) {
    window.marker && console.error('isNull', arguments);
    return Object.prototype.toString.call(value) === '[object Null]';
  },

  /**
   * Check if value is set
   *
   * @param value
   * @returns {boolean}
   */
  isSet: function (value) {
    window.marker && console.error('isSet', arguments);
    return !utils.isUndefined(value) && !utils.isNull(value);
  },

  /**
   * Check if value is cell
   *
   * @param {String} value
   * @returns {Boolean}
   */
  isCell: function (value) {
    window.marker && console.error('isCell', arguments);
    return value.match(/^[A-Za-z]+[0-9]+/) ? true : false;
  },

  /**
   * Check if value is formula
   *
   * @param {String} value
   * @returns {Boolean}
   */
  isFormula: function (value) {
    window.marker && console.error('isFormula', arguments);
    return utils.isString(value) && value.length > 1 && value.substr(0, 1) === '=';
  },

  /**
   * Get row name and column number
   *
   * @param cell
   * @returns {{alpha: string, num: number}}
   */
  getCellAlphaNum: function (cell) {
    window.marker && console.error('getCellAlphaNum', arguments);
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
    window.marker && console.error('changeRowIndex', arguments);
    var alphaNum = utils.getCellAlphaNum(cell),
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
    window.marker && console.error('changeColIndex', arguments);
    var alphaNum = utils.getCellAlphaNum(cell),
        alpha = alphaNum.alpha,
        col = utils.toChar(parseInt(utils.toNum(alpha) + counter, 10)),
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
    window.marker && console.error('changeFormula', arguments);
    if (!delta) {
      delta = 1;
    }

    return formula.replace(/(\$?[A-Za-z]+\$?[0-9]+)/g, function (match) {
      var alphaNum = utils.getCellAlphaNum(match),
          alpha = alphaNum.alpha,
          num = alphaNum.num;

      if (utils.isNumber(change.col)) {
        num = utils.toNum(alpha);

        if (change.col <= num) {
          return utils.changeColIndex(match, delta);
        }
      }

      if (utils.isNumber(change.row)) {
        if (change.row < num) {
          return utils.changeRowIndex(match, delta);
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
    window.marker && console.error('updateFormula', arguments);
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

        var alpha = utils.getCellAlphaNum(match).alpha;

        var fixedCol = alpha[0] === '$' || false,
            fixedRow = alpha[alpha.length - 1] === '$' || false;

        if (type === 'row' && fixedRow) {
          return match;
        }

        if (type === 'col' && fixedCol) {
          return match;
        }

        return (type === 'row' ? utils.changeRowIndex(match, counter) : utils.changeColIndex(match, counter));
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
    window.marker && console.error('toNum', arguments);
//      chr = utils.clearFormula(chr).split('');
//
//      var base = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"],
//          i, j, result = 0;
//
//      for (i = 0, j = chr.length - 1; i < chr.length; i += 1, j -= 1) {
//        result += Math.pow(base.length, j) * (base.indexOf(chr[i]));
//      }
//
//      return result;

    chr = utils.clearFormula(chr);
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
    window.marker && console.error('toChar', arguments);
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
    window.marker && console.error('cellCoords', arguments);
    var num = cell.match(/\d+$/),
        alpha = cell.replace(num, '');

    return {
      row: parseInt(num[0], 10) - 1,
      col: utils.toNum(alpha)
    };
  },

  /**
   * Remove $ from formula
   *
   * @param {String} formula
   * @returns {String|void}
   */
  clearFormula: function (formula) {
    window.marker && console.error('clearFormula', arguments);
    return formula.replace(/\$/g, '');
  },

  /**
   * Translate cell coordinates to merged form {row:0, col:0} -> A1
   *
   * @param coords
   * @returns {string}
   */
  translateCellCoords: function (coords) {
    window.marker && console.error('translateCellCoords', arguments);
    return utils.toChar(coords.col) + '' + parseInt(coords.row + 1, 10);
  },

  sort: function (rev) {
    window.marker && console.error('sort', arguments);
    return function (a, b) {
      return ((a < b) ? -1 : ((a > b) ? 1 : 0)) * (rev ? -1 : 1);
    }
  }
};

module.exports = utils;
