
var AVAILABLE_FONTS = [
	{label: "Arial", val: "arial"}, 
	{label: "Times New Roman", val: "Times New Roman"},
	{label: "Verdana", val: "verdana"}
];

var DEFAULT_FONT = "arial";

// var AVAILABLE_FONT_SIZES = [
// 	{label: "8", val: 8},
// 	{label: "9", val: 9},
// 	{label: "10", val: 10},
// 	{label: "11", val: 11},
// 	{label: "12", val: 12},
// 	{label: "14", val: 14},
// 	{label: "18", val: 18},
// 	{label: "24", val: 24},
// 	{label: "36", val: 36},
// 	{label: "48", val: 48},
// 	{label: "72", val: 72},
// ];

var AVAILABLE_FONT_SIZES = [
	{label: "8", val: 1},
	{label: "10", val: 2},
	{label: "12", val: 3},
	{label: "14", val: 4},
	{label: "18", val: 5},
	{label: "24", val: 6},
	{label: "36", val: 7}
];

var DEFAULT_FONT_SIZE = 3;

var AVAILABLE_COLORS = [
	{label: "ffffff", val: "ffffff"},
	{label: "ffccc9", val: "ffccc9"},
	{label: "ffce93", val: "ffce93"},
	{label: "fffc9e", val: "fffc9e"},
	{label: "ffffc7", val: "ffffc7"},
	{label: "9aff99", val: "9aff99"},
	{label: "96fffb", val: "96fffb"},
	{label: "cdffff", val: "cdffff"},
	{label: "cbcefb", val: "cbcefb"},
	{label: "cfcfcf", val: "cfcfcf"},
	{label: "fd6864", val: "fd6864"},
	{label: "fe996b", val: "fe996b"},
	{label: "fffe65", val: "fffe65"},
	{label: "fcff2f", val: "fcff2f"},
	{label: "67fd9a", val: "67fd9a"},
	{label: "38fff8", val: "38fff8"},
	{label: "68fdff", val: "68fdff"},
	{label: "9698ed", val: "9698ed"},
	{label: "c0c0c0", val: "c0c0c0"},
	{label: "fe0000", val: "fe0000"},
	{label: "f8a102", val: "f8a102"},
	{label: "ffcc67", val: "ffcc67"},
	{label: "f8ff00", val: "f8ff00"},
	{label: "34ff34", val: "34ff34"},
	{label: "68cbd0", val: "68cbd0"},
	{label: "34cdf9", val: "34cdf9"},
	{label: "6665cd", val: "6665cd"},
	{label: "9b9b9b", val: "9b9b9b"},
	{label: "cb0000", val: "cb0000"},
	{label: "f56b00", val: "f56b00"},
	{label: "ffcb2f", val: "ffcb2f"},
	{label: "ffc702", val: "ffc702"},
	{label: "32cb00", val: "32cb00"},
	{label: "00d2cb", val: "00d2cb"},
	{label: "3166ff", val: "3166ff"},
	{label: "6434fc", val: "6434fc"},
	{label: "656565", val: "656565"},
	{label: "9a0000", val: "9a0000"},
	{label: "ce6301", val: "ce6301"},
	{label: "cd9934", val: "cd9934"},
	{label: "999903", val: "999903"},
	{label: "009901", val: "009901"},
	{label: "329a9d", val: "329a9d"},
	{label: "3531ff", val: "3531ff"},
	{label: "6200c9", val: "6200c9"},
	{label: "343434", val: "343434"},
	{label: "680100", val: "680100"},
	{label: "963400", val: "963400"},
	{label: "986536", val: "986536"},
	{label: "646809", val: "646809"},
	{label: "036400", val: "036400"},
	{label: "34696d", val: "34696d"},
	{label: "00009b", val: "00009b"},
	{label: "303498", val: "303498"},
	{label: "000000", val: "000000"},
	{label: "330001", val: "330001"},
	{label: "643403", val: "643403"},
	{label: "663234", val: "663234"},
	{label: "343300", val: "343300"},
	{label: "013300", val: "013300"},
	{label: "003532", val: "003532"},
	{label: "010066", val: "010066"},
	{label: "340096", val: "340096"}
];

var DEFAULT_COLOR = "000000";

var DEFAULT_BACKGROUND_COLOR = "ffffff";

// Helper Methods

var hexDigits = new Array ("0","1","2","3","4","5","6","7","8","9","a","b","c","d","e","f"); 

//Function to convert hex format to a rgb color
function rgb2hex(rgb) {
	var rgb_og = rgb;
 	rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
 	if(rgb)
		return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
	else
		return rgb_og;
}

function hex(x) {
  return isNaN(x) ? "00" : hexDigits[(x - x % 16) / 16] + hexDigits[x % 16];
 }

