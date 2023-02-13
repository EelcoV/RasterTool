/* stylelint-xcode-formatter
 *
 * Takes an error/warning object as input, and returns a string.
 *
 * For Xcode, the string format should be:
 *
 *	/Full/path/name/file:line:column: warning: Warning text here
 *
 * or
 *
 *	/Full/path/name/file:line:column: error: Error text here
 *
 */

module.exports = function(results, returnValue) {
	let str = "";
	results.forEach(function(result) {
		let file = result.source;

		result.warnings.forEach(function(element) {
			str +=
				file
				+ ":"
				+ element.line + ":" + element.column
				+ ": warning: "
				+ element.text
				+ "\n";
		});
	});
	return str;
};
