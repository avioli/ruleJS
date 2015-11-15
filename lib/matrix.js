var _ = require('lodash');
var utils = require('./utils');
var CacheStore = require('./cache-store');
var debug = false;

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
  // var item = {
  //   id:      '',
  //   row:     0,
  //   col:     0,
  //   value:   '',
  //   formula: '',
  //   error:   '',
  //   deps:    [], // holds all cellIds that depend on this item
  //   fResolved: false, // true if the formula was resolved -- false if not or any of its deps is updated
  // };

  /**
   * Data store
   *
   * @type {Object}
   */
  instance.data = Object.create(null);

  /**
   * Cache store
   *
   * @type {Object}
   */
  var cache = new CacheStore();

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

    instance.calcDepth = instance.calcDepth || 0;
    instance.calcDepth++;

    instance.calcStack = instance.calcStack || [];
    instance.calcStack.push(item.id);

    if (instance.calcDepth > 20) {
      var stack = instance.calcStack;
      throw new Error('Too deep calculateItemFormula call: ' + JSON.stringify(stack));
    }

    var parsed = matrixDelegate.parse(item.formula, item);

    instance.calcDepth--;
    instance.calcStack.pop();

    return instance.updateItemValue(item, parsed.value, parsed.error);
  };

  /**
   * Recalculates all matrix formulas
   * @returns {Array}
   */
  this.recalculate = function (x) {
    if (instance.bulkSetMode) {
      console && console.warn('Don\'t call recalculate() while in bulkSetMode!');
      return;
    }
    // return _.map(instance.data, calculateItemFormula);

    // var dirtyItems = [];
    // _.forEach(instance.data, function(item) {
    //   var dirty = cache.get(item.id, 'dirty');
    //   if (dirty) {
    //     var keys = cache.get(item.id, 'dirtiedKeys');
    //     dirtyItems.push([item.id, keys]);
    //   }
    // });
    // console.log(dirtyItems);

    var items = _.map(instance.data, calculateItemFormula);
    // if (x === 1) {
    //   _.forEach(instance.data, function(item) {
    //     if (item.error) {
    //       console.error(item.error);
    //     }
    //     var dirty = cache.get(item.id, 'dirty');
    //     if (dirty) {
    //       var keys = cache.get(item.id, 'dirtiedKeys');
    //       console.log(item);
    //       console.log(keys);
    //     }
    //   });
    // }
    return items;
  };

  /**
   * Recalculates a set of items in the matrix
   * @param   {Array} itemIds
   * @returns {Array}
   */
  this.recalculateItems = function (itemIds) {
    return _.map(itemIds, function(id) {

      var item = instance.getRawItem(id);

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
  this.getRawItem = function (id) {
    return instance.data[id];
  };

  this.getItem = function (id) {
    var item = instance.getRawItem(id);

    if (item.formula && ! item.fResolved) {
      // console.debug('recalculating: ' + id);
      calculateItemFormula(item);

      if (! item.fResolved) {
        console.warn('Could not resolve formula for cellId: ' + id);
      }
    }

    return item;
  }

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

  this.updateDeps = function (item, deps) {
    var dirty = false,
        oldDeps = item.deps;

    if (! item.deps || item.deps.length === 0) {
      item.deps = deps;
      dirty = true;
    } else {
      var newDeps = oldDeps.slice(0);

      _.forEach(deps, function (depId) {
        if (newDeps.indexOf(depId) === -1) { // optimisation idea: lookup tables
          newDeps.push(depId);
          dirty = true;
        }
      });

      if (dirty) {
        item.deps = newDeps;
      }
    }

    // console.debug('updateItem: ' + item.id + ' -- old deps: ' + oldDeps + '; new deps: ' + deps + ' (dirty: ' + (dirty ? 'yes' : 'no') + ')');
    if (dirty) {
      var __keys = ['deps'];

      // dirtify the deps
      _.forEach(item.deps, function(depId) {
        dirtifyItemCache(depId, __keys);
      });

      // dirtify self
      dirtifyItemCache(item.id, __keys);
    }
  };

  this.updateItemValue = function (item, value, error) {
    var dirty = false,
        keys = ['value', 'error'],
        value = _.isUndefined(value) ? null : value,
        error = _.isUndefined(error) ? null : error;

    if (item.value !== value) {
      item.value = value;
      dirty = true;
    }

    if (item.error !== error) {
      item.error = error;
      dirty = true;
    }

    if (item.formula) {
      // console.log(item);

      // if (debug) {
        item.deps.forEach(function(depId) {
          var depItem = instance.getRawItem(depId);
          if (depItem.formula && ! depItem.fResolved) {
            console.error('Unresolved formula: ' + depItem.id);
          }
        });
      // }

      // mark as resolved
      item.fResolved = true;
    } else {
      // flag all dependencies with a formula as unresolved
      var deps = instance.getDependencies(item.id);

      deps.forEach(function(depId) {
        var depItem = instance.getRawItem(depId);

        if (depItem.formula) {
          depItem.fResolved = false;
        }
      });
    }
  };

  this.updateItemFormula = function (item, formula) {
    throw new Error('Not implemented');
  };

  /**
   * Update item properties
   *
   * @param {Object|String} item or id
   * @param {Object} props
   * @returns {item} the updated item
   */
  // this.updateItem = function (item, props) {
  //   if (utils.isString(item)) {
  //     item = instance.getRawItem(item);
  //   }

  //   if (item && props) {
  //     var dirty = false,
  //         keys = _.keys(props);

  //     _.forEach(keys, function (key) {
  //       if (key === 'id') {
  //         console.warn('Changing ID of Item!');
  //       }

  //       if (item[key] && _.isArray(item[key])) {
  //         if (_.isArray(props[key])) {
  //           _.forEach(props[key], function (i) {
  //             if (item[key].indexOf(i) === -1) {
  //               item[key].push(i);
  //               dirty = true;
  //             }
  //           });
  //         } else {
  //           if (item[key].indexOf(props[key]) === -1) {
  //             item[key].push(props[key]);
  //             dirty = true;
  //           }
  //         }
  //         // TODO: Optimization - sort array and use _.indexOf(array=item[key], value=i, fromIndex=true)
  //         // NOTE: don't do pre-optimization, unless necessary
  //       } else {
  //         if (item[key] !== props[key]) {
  //           item[key] = props[key];
  //           dirty = true;
  //         }
  //         // TODO: Optimization - if props[key] is an array -- sort it and use _.indexOf(array=item[key], value=i, fromIndex=true)
  //         // NOTE: don't do pre-optimization, unless necessary
  //       }

  //       if (key === 'deps') {
  //         // debug && console.debug('updateItem: ' + item.id + ' -- old deps: ' + item[key] + '; new deps: ' + props[key] + ' (dirty: ' + (dirty ? 'yes' : 'no') + ')');
  //         if (dirty) {
  //           var __keys = ['deps'];
  //           _.forEach(item[key], function(id) {
  //             dirtifyItemCache(id, __keys);
  //           });
  //         }
  //       }

  //     });

  //     if (dirty) {
  //       dirtifyItemCache(item.id, keys);
  //     }
  //   }

  //   return item;
  // };

  /**
   * Add item to data array
   *
   * @param {Object} item
   */
  function addItem (item) {
    var cellId = item.id,
        existingCell = instance.getRawItem(cellId);

    if (existingCell) {
      throw new Error('Item exists at cellId: ' + cellId);
    }

    if (! utils.isSet(item.row) || ! utils.isSet(item.col)) {
      var coords = utils.cellCoords(cellId);
      // TODO: Make immutable
      item.row = coords.row;
      item.col = coords.col;
    }

    instance.data[cellId] = item;

    return item;
  }

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

  var hasDirtyItemCache = function (id, dirtiedKey) {
    return cache.get(id, 'dirty') && _.indexOf(cache.get(id, 'dirtiedKeys'), dirtiedKey) !== -1;
  };

  var undirtyItemCache = function (id) {
    if (debug && ! hasDirtyItemCache(id, 'deps')) {
      throw new Error('matrix.getDependencies: ' + id + ' -- item\'s deps cache is already not dirty');
      // return;
    }
    var dirtiedKeys = _.without(cache.get(id, 'dirtiedKeys'), 'deps');
    if (dirtiedKeys.length === 0) {
      cache.remove(id, ['dirty', 'dirtiedKeys']);
    } else {
      cache.set(id, { 'dirtiedKeys': dirtiedKeys });
    }
  };

  var dirtifyItemCache = function (id, dirtiedKeys) {
    var prevDirtyKeys = [];

    if (debug) {
      if ('undefined' === typeof dirtiedKeys) {
        throw new Error('Keys cannot be undefined and should be an array of keys to mark as dirty');
      }
    }

    if (cache.get(id, 'dirty')) {
      prevDirtyKeys = cache.get(id, 'dirtiedKeys') || [];
      // debug && console.info('dirtifyItemCache: ' + id + '; prevDirtyKeys: ' + prevDirtyKeys);
    }
    cache.set(id, {
      'dirty': true,
      'dirtiedKeys': _.uniq(prevDirtyKeys.concat(dirtiedKeys)),
    });

    if (0 && debug) {
      var newDirtyKeys = cache.get(id, 'dirtiedKeys');
      var diff = _.difference(newDirtyKeys, prevDirtyKeys);
      debug && console.info('dirtifyItemCache: ' + id + '; dirtiedKeys: ' + newDirtyKeys + '; Diff: ' + diff);
    }
  };

  /**
   * Get dependencies by id
   *
   * @param {String} id
   * @returns {Array}
   */
  var getDependencies = function (id) {
    // debug && console.group('getDependencies: ' + id);
    // debug && console.log('getDependencies', arguments);

    var hasDirtyDeps = hasDirtyItemCache(id, 'deps');
    // debug && hasDirtyDeps && console.debug('!getDependencies: hasDirtyDeps');

    var deps = cache.get(id, 'dependencies');
    // debug && console.log('!getDependencies: ' + id + ' -- deps: ' + deps);
    if (hasDirtyDeps && deps) {
      // debug && console.warn('!getDependencies: ' + id + ' has cache set, but is marked as dirty');
      deps = null;
    }

    if (! deps) {
      deps = [];

      _.forEach(instance.getItemsWithDependencies(), function (item) {
        // match only items with dependencies
        if (! item.deps || item.deps.length === 0) {
          return;
        }
        // make sure the id is in the item's dependencies list
        if (item.deps.indexOf(id) === -1) {
          return;
        }
        // make sure the item's id is not already part of the new dependencies list
        if (deps.indexOf(item.id) === -1) {
          deps.push(item.id);
        }
      });
      // debug && console.log('!getDependencies: ' + id + ' -- new deps: ' + deps);

      cache.set(id, { 'dependencies': deps });
      // debug && console.log('!getDependencies: ' + id + ' to cache: ' + deps);
    } else {
      // debug && console.log('!getDependencies: ' + id + ' from cache: ' + deps);
    }

    if (hasDirtyDeps) {
      undirtyItemCache(id);
    }

    // debug && console.groupEnd('getDependencies: ' + id);
    return deps;
  };

  /**
   * Get all dependencies
   *
   * @param {String} id
   */
  var getDependenciesDeep = function (id, accumulator) {
    // debug && console.log('getDependenciesDeep', arguments);

    _.forEach(getDependencies(id), function (refId) {
      if (accumulator.indexOf(refId) !== -1) {
        return;
      }

      accumulator.push(refId);

      var item = instance.getRawItem(refId);
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
    // debug && console.time('matrix.getDependencies');
    // debug && console.group('matrix.getDependencies: ' + id);

    // debug && console.log('matrix.getDependencies', arguments);

    var hasDirtyDeps = hasDirtyItemCache(id, 'deps');
    // hasDirtyDeps && console.debug('matrix.getDependencies: hasDirtyDeps');
    // NOTE: the deps cache for this id will be cleaned by getDependencies();

    var allDependencies = cache.get(id, 'allDependencies');
    if (hasDirtyDeps && allDependencies) {
      // debug && console.warn('matrix.getDependencies: ' + id + ' has cache set, but is marked as dirty');
      allDependencies = null;
    }

    if (! allDependencies) {
      allDependencies = getDependenciesDeep(id, []);

      cache.set(id, { 'allDependencies': allDependencies });
      // debug && console.log('matrix.getDependencies: ' + id + ' to cache: ' + allDependencies);
    } else {
      // debug && console.log('matrix.getDependencies: ' + id + ' from cache: ' + allDependencies);
    }

    // debug && console.groupEnd('matrix.getDependencies: ' + id);
    // debug && console.timeEnd('matrix.getDependencies');

    return allDependencies;
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

        addItem({
          id: id,
          row: j,
          col: k,
          value: value,
          error: null,
          formula: formula,
          fResolved: false,
          deps: [],
        });
      });
    });
  };

};

module.exports = Matrix;
