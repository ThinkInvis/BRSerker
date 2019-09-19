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
	reader.readAsText(inst.fileName, 'windows-1252');
}}, new SBG_SlowIterator(function(inst) {
	var line = inst.lines[inst.currLine];
	
	if(line == "") {
		return true;
	} else if(line.substring(0, 2) == "+-") {
		var lastBrick = inst.brickBuffer[inst.brickBuffer.length-1];
		lastBrick.BlsData.ExtraLines.push(line);
	} else {
		var bwords = line.split('"');
		var bmatch = BasicFromBlsName(bwords[0]);
		if(typeof bmatch === "undefined") {
			bmatch = {
				Name: "Basic",
				SizeX: 0,
				SizeY: 0,
				SizeZ: 0,
				AddRot: 0
			}
		}
		var words = bwords[1].split(' ');
		
		var nrot = words[4]*1;
		var arot = bmatch.AddRot;
		if(bmatch.Orientation == 5 && (nrot == 0 || nrot == 2)) arot += 2;
		if(bmatch.Name == "RampCorner" && bmatch.Orientation == 5) arot -= 1;
		
		inst.brickBuffer.push(new InternalBrick(
			new THREE.Vector3(bmatch.SizeX, bmatch.SizeY, bmatch.SizeZ),
			new THREE.Vector3(words[1]*2, words[2]*2, words[3]*5),
			Mod(nrot+arot,4),
			new THREE.Color(inst.colorset[words[6]*1][0],inst.colorset[words[6]*1][1],inst.colorset[words[6]*1][2]),
			0, { //TODO: material index
				InternalName: bmatch.Name,
				Orientation: bmatch.Orientation,
				BlocklandName: bwords[0],
				BlocklandData: {
					ExtraLines: [],
					//ExtraRotation: bmatch.AddRot,
					ExtraRotation: arot,
					ColorFX: words[8],
					ShapeFX: words[9],
					Raycasting: words[10],
					PrintName: words[7],
					IsBaseplate: words[5]
				},
				Collides: words[11]*1 == 1,
				Visible: words[12]*1 == 1
		}));
	}
	
	inst.currLine++;
	return inst.currLine == inst.lines.length;
	//BrickName", PosX, PosY, PosZ, AngleID, IsBaseplate, ColorID, Empty Space or PrintID, ColorFXID, ShapeFXID, Ray, Col, Ren
	//Event/light/owner/emitter/etc. (i.e. non-brick) lines start with +-
}, {
	RunSpeed: 50,
	MaxExecTime: 40
})], {
	Controls: {Reader: $("<input>", {"type":"file", "class":"opt-1-1", "accept":".bls"})},
	OnSetup: function(inst) {
		if(this.controls.Reader.get(0).files.length < 1) {
			inst.abort = "No file loaded";
			return;
		}
		inst.fileName = this.controls.Reader.get(0).files[0];
	},
	OnPause: function(inst) {
		return "Loading BLS... " + inst.currLine + "/" + inst.lines.length;
	},
	Description: "Loads bricks and related data from a Blockland save file (.BLS)."
});
var o = new Option(GenName, GenName);
$(o).html(GenName);
$("#generator-type").append(o);
Generators[GenName].OptionElement = o;