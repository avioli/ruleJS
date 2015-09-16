var _ = require('lodash');
var utils = require('./utils');

/**
 * Matrix collection for each form, contains cache of all items in the dataSource
 *
 * @param {Object} matrixDelegate Should have .parse()
 */
var Matrix = function (matrixDelegate) {
  var instance = this;

  /**
   * Single item (cell) object
   *
   * @type {{id: string, formula: string, value: string, error: string, deps: Array}}
   */
  var item = {
    id:      '',
    formula: '',
    value:   '',
    error:   '',
    deps:    []
  };

  /**
   * Data store
   *
   * @type {Object}
   */
  instance.data = Object.create(null);

  /**
   * Calculate item formula
   *
   * @param   {String} formula
   * @param   {item}   reference item
   * @returns {item}   the updated item
   */
  var calculateItemFormula = function (item) {
    if (! item.formula) {
      return item;
    }
    var parsed = matrixDelegate.parse(item.formula, item);
    return instance.updateItem(item, parsed);
  };

  /**
   * Recalculates all matrix formulas
   * @returns {Array}
   */
  this.recalculate = function () {
    return _.forEach(instance.data, calculateItemFormula);
  };

  /**
   * Recalculates a set of items in the matrix
   * @param   {Array} itemIds
   * @returns {Array}
   */
  this.recalculateItems = function (itemIds) {
    return _.map(itemIds, function(id) {
      var item = instance.getItem(id);
      if (! item) {
        throw new Error('No item with id: ' + id);
      }
      return calculateItemFormula(item);
    });
  };

  /**
   * Get item from data store
   *
   * @param   {String} id
   * @returns {Item}
   */
  this.getItem = function (id) {
    return instance.data[id];
  };

  /**
   * Returns a shallow copy of the data store
   *
   * @return {Object}
   */
  this.getAllItems = function () {
    return instance.data;
  };

  /**
   * Remove item from data array
   *
   * @param {String} id
   */
  this.removeItem = function (id) {
    instance.data = _.filter(instance.data, function (item) {
      return item.id !== id;
    });
  };

  /**
   * Remove items from data array in col
   *
   * @param {Number} col
   */
  this.removeItemsInCol = function (col) {
    instance.data = _.filter(instance.data, function (item) {
      return item.col !== col;
    });
  };

  /**
   * Remove items from data array in row
   *
   * @param {Number} row
   */
  this.removeItemsInRow = function (row) {
    instance.data = _.filter(instance.data, function (item) {
      return item.row !== row;
    })
  };

  /**
   * Remove items from data array below col
   *
   * @param col
   */
  this.removeItemsBelowCol = function (col) {
    instance.data = _.filter(instance.data, function (item) {
      return item.col < col;
    });
  };

  /**
   * Remove items from data array below row
   *
   * @param row
   */
  this.removeItemsBelowRow = function (row) {
    instance.data = _.filter(instance.data, function (item) {
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
    if (utils.isString(item)) {
      item = instance.getItem(item);
    }

    if (item && props) {
      for (var p in props) {
        if (item[p] && utils.isArray(item[p])) {
          if (utils.isArray(props[p])) {
            _.forEach(props[p], function (i) {
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
    var cellId = item.id,
        existingCell = instance.getItem(cellId);

    if (! utils.isSet(item.row) || ! utils.isSet(item.col)) {
      var coords = utils.cellCoords(cellId);
      // TODO: Make immutable
      item.row = coords.row;
      item.col = coords.col;
    }

    if (! existingCell) {
      instance.data[cellId] = item;
    } else {
      instance.updateItem(existingCell, item);
    }

    return existingCell || item;
  };

  /**
   * Get references items to column
   *
   * @param {Number} col
   * @returns {Array}
   *
   * TODO: remove if not used
   */
  /*
  this.getRefItemsToColumn = function (col) {
    var result = [];

    if (!instance.data.length) {
      return result;
    }

    _.forEach(instance.data, function (item) {
      if (item.deps) {
        var deps = _.filter(item.deps, function (cell) {

          var alpha = utils.getCellAlphaNum(cell).alpha,
            num = utils.toNum(alpha);

          return num >= col;
        });

        if (deps.length > 0 && result.indexOf(item.id) === -1) {
          result.push(item.id);
        }
      }
    });

    return result;
  };
  */

  /**
   * Get references items to row
   *
   * @param {Number} row
   * @returns {Array}
   *
   * TODO: remove if not used
   */
  /*
  this.getRefItemsToRow = function (row) {
    var result = [];

    if (!instance.data.length) {
      return result;
    }

    _.forEach(instance.data, function (item) {
      if (item.deps) {
        var deps = _.filter(item.deps, function (cell) {
          var num = utils.getCellAlphaNum(cell).num;
          return num > row;
        });

        if (deps.length > 0 && result.indexOf(item.id) === -1) {
          result.push(item.id);
        }
      }
    });

    return result;
  };
  */

  this.getItemsWithDependencies = function () {
    // TODO: return instance.dataWithDeps or recreate it if empty
    return instance.data;
  };

  /**
   * Get dependencies by id
   *
   * @param {String} id
   * @returns {Array}
   */
  var getDependencies = function (id) {
    // console.log('getDependencies', arguments);
    var deps = [];

    _.forEach(instance.getItemsWithDependencies(), function (item) {
      // match only items with dependencies
      // make sure the id is in the item's dependencies list
      // make sure the item's id is not already part of the new dependencies list
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

    _.forEach(getDependencies(id), function (refId) {
      if (accumulator.indexOf(refId) !== -1) {
        return;
      }

      accumulator.push(refId);

      var item = instance.getItem(refId);
      if (item.deps && item.deps.length) {
        getDependenciesDeep(refId, accumulator);
      }
    });

    return accumulator;
  };

  /**
   * Get cell dependencies
   *
   * @param {String} id
   * @returns {Array}
   */
  this.getDependencies = function (id) {
    // console.log('matrix.getDependencies', arguments);
    return getDependenciesDeep(id, []);
  };

  /**
   * [depsInFormula description]
   * @param  {item} item
   * @return {*}         An array of dependants or false
   */
  this.depsInFormula = function (item) {

    var formula = item.formula,
        deps = item.deps;

    if (deps) {
      deps = _.filter(deps, function (id) {
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
    _.forEach(dataSource, function (row, j) {
      _.forEach(row, function (data, k) {
        var id = utils.translateCellCoords({row: j, col: k}),
            formula = null,
            value = null;

        if (utils.isFormula(data)) {
          formula = data.substr(1);
        } else {
          value = data;
        }

        instance.addItem({
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

module.exports = Matrix;
