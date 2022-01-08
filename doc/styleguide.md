#  Style guide

##  Use ES6 features
ES6 is also known as ECMAScript 2015. Do not use features from later ECMAScript versions.

Specifically, do use:
* let and const (the `no-var` rule for `eslint` is not set for now, but will be set after a code review). Use const instead of let whenever possible.
* arrow functions.
* class definitions.
* default parameters in function calls.
* new String and Array methods.

Not sure about modules yet. First check whether they impede debugging in the Developer Tools of Firefox.

*Do not use:*
* (static) class fields. Instead, declare instance properties on this, in the constructor; declare static properties on the class name, after the class definition.
* private class methods and fields (declard with #). These have been supported only from Firefox 90 onwards.
* static initialization blocks. This is supported only from Firefox 93 onwards.
* Array.includes (which is part of ECMAScript 2016).
* async function (ECMAScript 2017).

##  Other style issues
* Do *not* create new strings, arrays as objects (`new String('literal here)` etc).
* Avoid use of falsy/thruthy conditions, as it leads to bugs. Do not use `if (!id) ...` but use `if (id==null) ...` instead. There is no `eslint` rule for this, unfortunately. We have seen many bugs where the variable was not an object reference but an integer with zero as a legitimate value. 

##  Naming

* Local variables, local constants and function names start with a lowercase letter. Use camelCase, e.g. `myVariableName` or `doSomeActions`.
* Global variables and global constants start with an uppercase letter, and also use camelCase, e.g. `ThisGlobalConstant`.
* Do not use underscores in variable names, except for class properties/methods that are supposed to be private. Marking private properties with an underscore has no special meaning, but is useful as a reminder nonetheless.

##  Formatting

* Check all ECMAScript source files using `eslint`. See the `eslintrc` file for further details. Running `eslint` should not produce any errors or warnings.
	Sometimes functions are defined in one script file but used only in other script files. Mark these function definitions with `// eslint-disable-line no-unused-vars`.
	When using functions only inside `#ifdef ... #endif`, then mark that line with `// eslint-disable-line no-undef`. Otherwise, enumerate functions in the `/* globals ... */` section at the top of the file.
* Indent using tabs. Tab size is 4.
* A single space before and after `=` in assignments.
* No space around comparison operators or other operators, except to make the structure of very long expressions clear.
* No space before colons, and a single space after a colon.
* Use single quotes for all strings, except for English/translated strings that will be visible to the user (e.g. any strings inside `_("...")`).
* Opening brace on the same line as the statement that starts the block. Closing brace at the same indent as that statement.
* There is no need for braces inside case-blocks of switch-statements.

For example, place braces like this:

	if (condition) {
		conditional statements
	} else {
		else statements
	}
	
	while (condition) {
		loop statements
	}
	
	switch (someVariable) {
	case option1:
		some statements
		break;
	case option2:
		some statements
		break;
	default:
		some statements
	}
	
	function doSomeAction() {
		function statements
	}
