/* eslint-xcode-formatter
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

module.exports = function(results) {
	let str = "";
	results.forEach(function(result) {
		let file = result.filePath;
		// Restore the preprocessed file to its original location, so that we can edit the source in Xcode, not the preprocessed one
		file = file.replace("build/server/js", "src");
		file = file.replace(/build\/app-..\/js/, "src");

		result.messages.forEach(function(element) {
			str +=
				file
				+ ":"
				+ element.line + ":" + element.column
				+ ": "
				+ (element.severity==2 ? "error: " : "warning: ")
				+ element.message
				+ " (" + element.ruleId + ")"
				+ "\n";
		});
	});
	return str;
};
