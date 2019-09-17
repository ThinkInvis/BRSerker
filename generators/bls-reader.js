var GenName = "BlsReader";

Generators[GenName] = new StagedBrickGenerator(GenName, [{apply: function(inst, promise) {
	var reader = new FileReader();
	reader.onload = function(e) {
		var lines = this.result.split("\r\n"); //TODO: is there an easy iterated version of this? can cause a short program freeze when passed huge files (see bl default saves The Bedroom, Golden Gate Bridge)
		
		if(lines[0] != "This is a Blockland save file.  You probably shouldn't modify it cause you'll screw it up.") {
			inst.abort = "Header missing";
			promise.resolve(inst);
			return;
		}
		if(lines.length < 67) {
			inst.abort = "File is truncated";
			promise.resolve(inst);
			return;
		}
		
		var numDescrLines = lines[1]*1;
		if(lines.length <= 66+numDescrLines) {
			inst.abort = "File is truncated";
			promise.resolve(inst);
			return;
		}
		var sspl = lines[66+numDescrLines].split(" ");
		if(sspl[0] != "Linecount") {
			inst.abort = "Linecount not in expected spot";
			promise.resolve(inst);
			return;
		}
		if(sspl[1] * 1 < 1) {
			inst.abort = "No bricks to load";
			promise.resolve(inst);
			return;
		}
		inst.linecount = sspl[1] * 1;
		
		inst.colorset = [];
		for(var i = 2+numDescrLines; i < 2+numDescrLines+64; i++) {
			var lw = lines[i].split(" ");
			inst.colorset.push([lw[0]*1, lw[1]*1, lw[2]*1, lw[3]*1]);
		}
		
		inst.currLine = 67+numDescrLines;
		inst.lines = lines;
		promise.resolve(inst);
	}
	reader.readAsText(inst.fileName);
}}, new SBG_SlowIterator(function(inst) {
	var line = inst.lines[inst.currLine];
	if(line.substring(0, 2) == "+-") {
		
	} else {
		var bwords = line.split('"');
		var bmatch = BasicFromBlsName(bwords[0]);
		if(typeof bmatch !== "undefined") {
			var words = bwords[1].split(' ');
			inst.brickBuffer.push(new InternalBrick(
				new THREE.Vector3(bmatch.SizeX, bmatch.SizeY, bmatch.SizeZ),
				new THREE.Vector3(words[1]*2-bmatch.SizeX/2, words[2]*2-bmatch.SizeY/2, words[3]*5-bmatch.SizeZ/2),
				words[4],
				new THREE.Color(inst.colorset[words[6]*1][0],inst.colorset[words[6]*1][1],inst.colorset[words[6]*1][2]),
				0, { //TODO: material index
					InternalName: bmatch.Name,
					BlocklandName: bwords[0],
					BlocklandRotation: 0,
					BlocklandCFX: words[8]*1, //NYI
					BlocklandSFX: words[9]*1, //NYI
					BlocklandRay: words[10]*1, //NYI
					BlocklandCol: words[11]*1, //NYI
					BlocklandRen: words[12]*1, //NYI
					BrickadiaName: ""
			}));
		}
	}
	
	inst.currLine++;
	return inst.currLine == inst.lines.length;
	//BrickName", PosX, PosY, PosZ, AngleID, IsBaseplate, ColorID, Empty Space or PrintID, ColorFXID, ShapeFXID, Ray, Col, Ren
	//Event/light/owner/emitter/etc. (i.e. non-brick) lines start with +-
}, {
	RunSpeed: 50,
	MaxExecTime: 40
})], {
	Controls: {Reader: $("<input>", {"type":"file", "class":"opt-full", "accept":".bls"})},
	OnSetup: function(inst) {
		if(this.controls.Reader.get(0).files.length < 1) {
			inst.abort = "No file loaded";
			return;
		}
		inst.fileName = this.controls.Reader.get(0).files[0];
	},
	OnPause: function(inst) {
		return "Loading BLS... " + inst.currLine + "/" + inst.lines.length;
	}
});
var o = new Option(GenName, GenName);
$(o).html(GenName);
$("#generator-type").append(o);
Generators[GenName].OptionElement = o;