var _ = require('lodash');
var utils = require('./utils');
var FormulaJS = require('formulajs');
var FormulaParser = require('./formula-parser');
var Exception = require('./exception');
var ParserDelegate = require('./parser-delegate');
var Matrix = require('./matrix');

module.exports.core = function (dataSource) {
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
  var version = '0.1.0'; // based on ruleJS v0.0.5

  /**
   * Parser object delivered by jison library
   *
   * @type {Parser|*|{}}
   */
  var parser;

  /**
   * Matrix object
   *
   * @type {Matrix}
   */
  var matrix;

  /**
   * Parse input string using parser
   *
   * @returns {Object} {{error: *, result: *}}
   * @param formula
   * @param item
   */
  var parse = function (formula, item) {
    // console.log('parse', arguments);
    var result = null,
        error = null;

    if (formula.substr(0, 1) === '=') {
      formula = formula.substr(1);
    }

    if (! parser || ! matrix) {
      throw new Error('Run init() first.');
    }

    // console.warn(formula);
    var marker, fml;
    // fml = 'IF(J154=0,IF(J142>E97,J142*E95,J142*E98),IF(J142>F97,J142*F95,J142*F98))*J149';
    // fml = 'IFERROR(INDEX(D1:D393,MATCH(D128,B1:B393,0),1),0)';
    // fml = 'F197*E71';
    // fml = 'IFERROR(IF(E58="Yes",SUM(J197:M197)/(SUM(J203:M203))*J203,J197),0)';
    // fml = '(J207*J139)+(J208*J138)';
    // fml = 'INDEX(G88:G92,MATCH(J142,E88:E92,1),1)*(J142-J143)';
    if (formula === fml) {
      window.marker = marker = true;
      console.log('parse/formula', formula);
      console.log('parse/item', item);
    }

    try {

      parser.setObj(item);
      result = parser.parse(formula);

      if (FormulaJS.ISERROR(result)) {
        error = result;
      }

      var id;

      if (item && item.id) {
        id = item.id;
      }

      var deps = matrix.getDependencies(id);
      marker && console.error('deps:');
      marker && console.error(deps);

      if (deps.indexOf(id) !== -1) {
        // cyclic reference
        console.error('CYCLIC REFERENCE', id, JSON.stringify(deps));
        result = null;

        _.forEach(deps, function (id) {
          matrix.updateItem(id, {
            error: Exception.get('REF'),
            value: null
          });
        });

        throw Error('REF');
      }

    } catch (ex) {

      var message = Exception.get(ex.message);

      marker && console.error('Parse error:');
      marker && console.error(ex);
      // console.error(ex);

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

    var ret = {
      error: error,
      value: result
    };
    window.marker && console.log('parse', ret);
    delete window.marker;

    return ret;
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
      value: 'undefined' === typeof item.value ? null : item.value,
      error: 'undefined' === typeof item.error ? null : item.error,
      formula: item.formula ? ('=' + item.formula) : null,
    };
  };

  /**
   * Get the value of an item
   *
   * @param  {String} id  The id
   * @return {Object}     A sanitized item
   */
  var getItem = function (id) {
    var item = matrix.getItem(id);
    // TODO: error checking
    return resultItem(item);
  };

  /**
   * Get the values of the items from given ids
   *
   * @param  {Array} ids  The ids
   * @return {Array}      The items
   */
  var getItems = function (ids) {
    return ids.map(getItem);
  }

  /**
   * Updates an existing matrix item and recalculates the dependant items
   *
   * @param {String} id        The id of the item to update
   * @param {*}      newValue  The new value
   */
  var setItem = function (id, newValue) {
    var item = matrix.getItem(id);
    if (! item) {
      throw new Error('ERROR: No item with id: ' + id);
    }

    var formula = null,
        value = null;

    if (utils.isFormula(newValue)) {
      formula = newValue.substr(1);
    } else {
      value = newValue;
    }

    matrix.updateItem(item, {
      value: value,
      formula: formula,
    });

    // CHECK: recalculate only the dependant items + time ones (and their dependant ones)
    matrix.recalculate();

    return resultItem(item);
  };

  /**
   * Updates an existing matrix item and recalculates the dependant items
   *
   * @param {String} id        The id of the item to update
   * @param {*}      newValue  The new value
   */
  var setItemValue = function (id, newValue) {
    var item = matrix.getItem(id);
    if (! item) {
      throw new Error('ERROR: No item with id: ' + id);
    }

    if (item.formula) {
      throw new Error('ERROR: The item appears to be a formula item. You can only set the value of non-formula items');
    }

    if (utils.isFormula(newValue)) {
      throw new Error('ERROR: The new value appears to be a formula');
    }

    matrix.updateItem(item, {
      value: newValue,
    });

    // CHECK: recalculate the time based items (and their dependant ones)
    // var deps = matrix.getDependencies(id);
    // if (deps && deps.length > 0) {
    //   matrix.recalculateItems(deps);
    // }

    matrix.recalculate();

    return resultItem(item);
  };
  /**
   * Return all items in an array of arrays (rows/columns)
   *
   * @return {Array}
   */
  var getAllItems = function () {
    var rows = [];

    _.forEach(matrix.getAllItems(), function (item) {
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
    return matrix.getDependencies(id);
  };

  var _getGraphDeep = function(id, ids) {
    if (ids[id]) {
      return ids[id];
    }

    var rawItem = matrix.getItem(id),
        item = getItem(id);

    ids[id] = {
      item: item,
      depIds: rawItem.deps,
      deps: [],
    };

    if (rawItem.deps) {
      for (var i = 0, maxI = rawItem.deps.length; i < maxI; i++) {
        ids[id].deps.push(_getGraphDeep(rawItem.deps[i], ids));
      }
    }

    return ids[id];
  };

  var getGraph = function (id) {
    var item = matrix.getItem(id);
    return _getGraphDeep(item.id, {});
  };

  /**
   * Recalculates the matrix (useful for time functions)
   */
  var recalculate = function () {
    matrix.recalculate();
  };

  /**
   * Initial method, create formulas, parser and matrix objects
   */
  var init = function (args) {
    var options = _.extend({
      supportedFormulas: 'all',
      additionalFormulas: null,
    }, args);

    if (options.additionalFormulas !== null) {
      options.additionalFormulas = _.extend(FormulaJS, options.additionalFormulas);
    }

    instance = this;
    matrix = new Matrix(instance);
    parser = new FormulaParser(new ParserDelegate(matrix, options.additionalFormulas, options.supportedFormulas));

    if (dataSource) {
      matrix.scan(dataSource);
      matrix.recalculate();
    }
  };

  return {
    init: init,
    version: version,
    parse: parse,
    getGraph: getGraph,
    getAllCells: getAllItems,
    getCell: getItem,
    setCell: setItem,
    setCellValue: setItemValue,
    getCells: getItems,
    getDependantIds: getDependantIds,
    recalculate: recalculate,
  };

};
