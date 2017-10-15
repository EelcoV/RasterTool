var _t = new Array;

function translate(s) {
    var str = _t[s];
    if (!str)
        str=s;
    // Replace %1, %2, ... %9 by the first, second, ... ninth argument.
    //for (var i=1; i<10; i++) {
    //    str = str.replace("%"+i, arguments[i])
    //}
    var i = 1;
    while (i<arguments.length) {
        str = str.replace("%%", arguments[i]);
        i++;
    }
    return str;
}


exports.translate = translate;

