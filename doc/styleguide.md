#  Style guide

##  Use ES6 features
Do not use features from later ECMAScript versions.

Specifically, do use:
* let and const (the `no-var` rule for `eslint` is not set for now, but will be set after a code review)
* arrow functions
* class definitions

Not sure about modules yet. First check whether they impede debugging in the Developer Tools of Firefox.

*Do not use:*
* ...

##  Naming

* Local variables, local constants and function names start with a lowercase letter. Use camelCase, e.g. `myVariableName` or `doSomeActions`.
* Global variables and global constants start with an uppercase letter, and also use camelCase, e.g. `ThisGlobalConstant`.

##  Formatting

* Check all ECMAScript source files using `eslint`. See the `eslintrc` file for further details. Running `eslint` should not produce any errors or warnings.
	Sometimes functions are defined in one script file but used only in other script files. Mark these function definitions with `// eslint-disable-line no-unused-vars`.
	When using functions only inside `#ifdef ... #endif`, then mark that line with `// eslint-disable-line no-undef`. Otherwise, enumerate functions in the `/* globals ... */` section at the top of the file.
* Indent using tabs. Tab size is 4.
* A single space before and after `=` in assignments.
* Use single quotes for all strings, except for English/translated strings that will be visible to the user (e.g. any strings inside `_("...")`).
* No space around comparison operators or other operators, except to make the structure of very long expressions clear.
* Opening brace on the same line as the statement that starts the block. Closing brace at the same indent as that statement.
* Avoid use of falsy/thruthy conditions, as it leads to bugs. Do not use `if (!id) ...` but use `if (id==null) ...` instead. There is no `eslint` rule for this, unfortunately. We have seen many bugs where the variable was not an object reference but an integer with zero as a legitimate value. 
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
