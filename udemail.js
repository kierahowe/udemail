

function udemail () { 
	this.anumber = 1;
}

udemail.prototype.onLoad = function (callback) { 
	var ei = require('./emailInput');
	// console.log ("Reg: ");
	// console.log (ei);
	global.plugins.inputs.registerInput (ei);

}

module.exports = udemail;	