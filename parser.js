function getArr(pseudoArgs) {
    var arr = [];
    for (var i = 0; i < pseudoArgs.length; i++)
        arr.push(pseudoArgs[i]);
    return arr;
}
//arithmetical:
var add = function() {
    return getArr(arguments).reduce(function(res, cur) { return res + cur; });
};
var sub = function() {
    return getArr(arguments).reduce(function(res, cur) { return res - cur; });
};
var mul = function() {
    return getArr(arguments).reduce(function(res, cur) { return res * cur; });
};
var div = function() {
    return getArr(arguments).reduce(function(res, cur) { return res / cur; });
};
var negate = function() {
    return -arguments[0];
};
var sqrt = function() {
    return Math.sqrt(Math.abs(arguments[0]));
};
var square = function() {
    return arguments[0] * arguments[0];
};
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//simplify-indetificators:
function absolutFalse() {
    return false;
}
function isZero(exp) {
    return (exp instanceof Const && exp.evaluate() === 0);
}
function isOne(exp) {
    return (exp instanceof Const && exp.evaluate() === 1);
}
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function makeOperation(prototype, f, opName, isNeutral, neutralPos, isAbsorbing, absorbingPos) {
    prototype.f = f;

    prototype.getOperationStr = function() {
        return opName;
    };

    prototype.simplify = function () {
        if (this instanceof Const || this instanceof Variable) {
            return this;
        }
        var children = [];
        for (var i = 0; i < this.ops.length; i++) {
            children.push(this.ops[i].simplify());
        }
        var res = Object.create(this.constructor.prototype);
        this.constructor.apply(res, children);
        if (children.every(isConst)) {
            return new Const(res.evaluate());
        }

        for (i = 0; i < children.length; i++) {
            if (isNeutral(children[i]) && neutralPos.indexOf(i) !== -1) {
                return children[(i+1) % 2];
            }
        }

        for (i = 0; i < children.length; i++) {
            if (isAbsorbing(children[i]) && absorbingPos.indexOf(i) !== -1) {
                return children[i];
            }
        }

        return res;

        function isConst(exp) {
            return (exp instanceof Const);
        }
    };

    function Constructor() {
        this.ops = [];
        for (var i = 0; i < arguments.length; ++i) {
            this.ops.push(arguments[i]);
        }
    }

    Constructor.prototype = prototype;
    prototype.constructor = Constructor;
    prototype.__proto__ = anyOperationPrototype;

    return Constructor;
}

var anyOperationPrototype = {};
anyOperationPrototype.toString = function () {
    var res = this.ops.join(" ");
    res += " ";
    res += this.getOperationStr();
    return res;
};
anyOperationPrototype.evaluate = function () {
    var calc = [];
    for (var i = 0; i < this.ops.length; i++) {
        calc.push(this.ops[i].evaluate.apply(this.ops[i], arguments));
    }
    return this.f.apply(this, calc);
};

var Add = makeOperation({}, add, "+", isZero, [0,1], absolutFalse, []);
var Subtract = makeOperation({}, sub, "-", isZero, [1],  absolutFalse, []);
var Multiply = makeOperation({}, mul, "*", isOne, [0,1], isZero, [0,1]);
var Divide = makeOperation({}, div, "/", isOne, [0], isZero, [0]);
var Negate = makeOperation({}, negate, "negate", absolutFalse, [], absolutFalse, []);
var Sqrt = makeOperation({}, sqrt, "sqrt", absolutFalse, [], absolutFalse, []);
var Square = makeOperation({}, square, "square", absolutFalse, [], absolutFalse, []);

Add.prototype.diff = function (p) {
    return new Add(this.ops[0].diff(p), this.ops[1].diff(p));
};
Subtract.prototype.diff = function (p) {
    return new Subtract(this.ops[0].diff(p), this.ops[1].diff(p));
};
Multiply.prototype.diff = function (p) {
    return new Add(new Multiply(this.ops[0].diff(p), this.ops[1]), new Multiply(this.ops[0], this.ops[1].diff(p)));
};
Divide.prototype.diff = function (p) {
    return new Divide(new Subtract(new Multiply(this.ops[0].diff(p), this.ops[1]), new Multiply(this.ops[0], this.ops[1].diff(p))),
        new Multiply(this.ops[1], this.ops[1]));
};
Negate.prototype.diff = function (p) {
    return new Negate(this.ops[0].diff(p));
};
Sqrt.prototype.diff = function (p) {
    var sqrt = new Sqrt(this.ops[0]);
    return new Divide(
        new Multiply(this.ops[0], this.ops[0].diff(p)),
        new Multiply(new Const(2), new Multiply(new Multiply(sqrt, sqrt), sqrt))
    );
};
Square.prototype.diff = function (p) {
    return new Multiply(this.ops[0].diff(p), new Multiply(new Const(2), this.ops[0]));
};

function Const(value) {
    this.value = value;
}
Const.prototype.diff = function (p) {
    return new Const(0);
};
Const.prototype.getOperationStr = function () {
    return this.value + "";
};
Const.prototype.toString = Const.prototype.getOperationStr;
Const.prototype.evaluate = function() {
    return this.value;
};
Const.prototype.simplify = function() {
    return this;
};
Const.prototype.__proto__ = anyOperationPrototype;

function Variable(name) {
    this.name = name;
}
Variable.prototype.diff = function (p) {
    if (this.name === p) {
        return new Const(1);
    } else {
        return new Const(0);
    }
};
Variable.prototype.getOperationStr = function () {
    return this.name + "";
};
Variable.prototype.toString = Variable.prototype.getOperationStr;
Variable.prototype.evaluate = function() {
    switch (this.name) {
        case "x":
            return arguments[0];
        case "y":
            return arguments[1];
        case "z":
            return arguments[2];
        default:
            return NaN;
    }
};
Variable.prototype.simplify = function() {
    return this;
};
Variable.prototype.__proto__ = anyOperationPrototype;

var map = {
    "+":        [Add, 2],
    "-":        [Subtract, 2],
    "*":        [Multiply, 2],
    "/":        [Divide, 2],
    "negate":   [Negate, 1],
    "sqrt":     [Sqrt, 1],
    "square":   [Square, 1]
};

function parse(s) {
    var token = s.split(/\s+/);
    var stack = [];
    for (var i = 0; i < token.length; i++) {
        if (token[i] in map) {
            var args = [];
            for (var j = 0; j < map[token[i]][1]; j++) {
                args.push(stack.pop());
            }
            args.reverse();
            var obj = Object.create(map[token[i]][0].prototype);
            map[token[i]][0].apply(obj, args);
            stack.push(obj);
        } else if (!isNaN(parseInt(token[i]))) {
            stack.push(new Const(parseInt(token[i])));
        } else if (token[i] === "x" || token[i] === "y" || token[i] === "z") {
            stack.push(new Variable(token[i]));
        }
    }
    return stack.pop();
}