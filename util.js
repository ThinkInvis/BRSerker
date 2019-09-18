//links 2 number inputs together such that:
// - both inputs are limited within an overall min/max
// - value of second input is guaranteed to always be >= value of first input + margin
//assumes starting values (dft1, dft2) are sane under those restrictions
var LinkNumInputs = function(i1, i2, min, max, dft1, dft2, margin=0) {
	i1.data("linkedInput", i2);
	i2.data("linkedInput", i1);
	i1.data("linkedInputMargin", margin);
	i2.data("linkedInputMargin", margin);
	i1.change(function() {
		var newv = i1.val();
		i1.data("linkedInput").attr('min', newv*1+i1.data("linkedInputMargin")*1);
	});
	i2.change(function() {
		var newv = i2.val();
		i2.data("linkedInput").attr('max', newv*1-i2.data("linkedInputMargin")*1);
	});
	
	i1.attr('min', min);
	i1.attr('max', dft2-margin);
	i2.attr('min', dft1+margin);
	i2.attr('max', max);
	
	i1.val(dft1);
	i2.val(dft2);
}

//% operator is signed remainder, not modulus -- works differently on negative numbers
var Mod = function(n, p) {
	return n - p * Math.floor(n/p);
}
   
var isPow2 = function(n) {
	return (n !== 0) && (n & (n - 1)) === 0;
}

function download(filename, text) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}
function BlobDownload(Filename, Bytes, Mimetype) {
	var filData = new Blob(Bytes, { type: Mimetype });
	if (window.navigator && window.navigator.msSaveOrOpenBlob) { // for IE
		window.navigator.msSaveOrOpenBlob(filData, Filename);
	} else { // for Non-IE (chrome, firefox etc.)
		var a = document.createElement("a");
		document.body.appendChild(a);
		a.style = "display: none";
		var filUrl = URL.createObjectURL(filData);
		a.href = filUrl;
		a.download = Filename;
		a.click();
		a.remove();
	}
};

//find the closest color in a colorset using the dE2000 algorithm
var ColorQuantize = function(color, colorset) {
	//expects color to be an array-RGBA value from 0-1, and colorset to be an array of such values
	//TODO: opacity doesn't work right yet
	var bestScore = Number.MAX_VALUE
	var bestIndex = 0; //fallback to the first color if something goes horribly wrong
	var bestColor = colorset[0];

	var colorLAB = Colour.RGBA2LAB(color[0]*255, color[1]*255, color[2]*255, color[3]);
	
	for(var i = 0; i < colorset.length; i++) {
		var matchLAB = Colour.RGBA2LAB(colorset[i][0]*255, colorset[i][1]*255, colorset[i][2]*255, colorset[i][3]);
		var thisScore = Colour.DeltaE00(colorLAB[0], colorLAB[1], colorLAB[2], matchLAB[0], matchLAB[1], matchLAB[2]);
		
		if(thisScore < bestScore) {
			bestScore = thisScore;
			bestIndex = i;
			bestColor = colorset[i];
		}
	}
	
	return {
		Closeness: bestScore,
		SetI: bestIndex,
		Color: bestColor
	}
}