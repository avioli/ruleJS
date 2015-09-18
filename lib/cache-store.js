var _ = require('lodash');

/**
 * A simple object store which doesn't mutate it's cached values
 */
var CacheStore = function () {
  var _cache = Object.create(null);

  /**
   * Get a cached value for an id and key
   *
   * @param  {String} id   A valid Object for an id
   * @param  {String} key  A valid Object for a key
   *
   * @return {*}  The value for the given id/key or undefined if either is
   *              not set
   */
  this.get = function (id, key) {
    if ('undefined' !== typeof _cache[id]) {
      return _cache[id][key];
    }
  };

  /**
   * Set the key/values of a given id
   *
   * @param  {String} id     A valid Object for an id
   * @param  {Object} props  The key/values to update
   *
   * @return {*}  The new object instance for the given id
   */
  this.set = function (id, props) {
    _cache[id] = _.assign(Object.create(null), _cache[id], props);
    return _cache[id];
  };

  /**
   * Remove a set of keys for a given id
   *
   * @param  {String}       id         A valid Object for an id
   * @param  {String|Array} keyOrKeys  A key or a set of keys to remove
   *
   * @return {*}  The new object instance for the given id or undefined
   *              if no cache was found
   */
  this.remove = function (id, keyOrKeys) {
    if ('undefined' !== typeof _cache[id]) {
      _cache[id] = _.omit(_cache[id], keyOrKeys);
      return _cache[id];
    }
  };

  /**
   * Remove all the stored key/values for a given id
   *
   * @param  {String}  id  A valid Object for an id
   *
   * @return {Boolean}  True if there was a cache or false otherwise
   */
  this.clear = function (id) {
    if (_cache[id]) {
      delete _cache[id];
      return true;
    }
    return false;
  };
};

module.exports = CacheStore;
