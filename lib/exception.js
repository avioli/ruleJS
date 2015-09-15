var _ = require('lodash');

/**
 * Error types
 */
var errors = [
  {type: 'NULL', output: '#NULL'},
  {type: 'DIV_ZERO', output: '#DIV/0!'},
  {type: 'VALUE', output: '#VALUE!'},
  {type: 'REF', output: '#REF!'},
  {type: 'NAME', output: '#NAME?'},
  {type: 'NUM', output: '#NUM!'},
  {type: 'NOT_AVAILABLE', output: '#N/A!'},
  {type: 'ERROR', output: '#ERROR'},
  {type: 'NEED_UPDATE', output: '#NEED_UPDATE'}
];

/**
 * Get error by type
 *
 * @param {String} type
 * @returns {*}
 */
exports.get = function (type) {
  var error = _.filter(errors, function (item) {
    return item.type === type || item.output === type;
  })[0];

  return error ? error.output : null;
};
