var GenName = "BrsReader";

Generators[GenName] = new StagedBrickGenerator(GenName, [{apply: function(inst, promise) {
	inst.fileObj.arrayBuffer().then(buffer => {
		try {
			inst.brsdata = BRS.read(new Uint8Array(buffer));
		} catch(ex) {
			inst.abort = "Exception in brs-js: " + ex;
			promise.resolve(inst);
			return;
		}
		if(inst.brsdata.version != 4) {
			inst.abort = "Wrong BRS version (expected 4, got " + inst.brsdata.version + ")";
			promise.resolve(inst);
			return;
		}
		if(inst.brsdata.bricks.length == 0) {
			inst.abort = "Save is empty";
			promise.resolve(inst);
			return;
		}
		
		inst.currBrick = 0;
		promise.resolve(inst);
	});
	
}}, new SBG_SlowIterator(function(inst) {
	//  visibility: boolean
	var currBrick = inst.brsdata.bricks[inst.currBrick];
	var currAsset = inst.brsdata.brick_assets[currBrick.asset_name_index];
	
	
	var col;
	
	if(typeof currBrick.color === "number")
		col = inst.brsdata.colors[currBrick.color];
	else
		col = currBrick.color;
	
	var bmatch = "Basic";
	var bsize = new THREE.Vector3(currBrick.size[1]/5, currBrick.size[0]/5, currBrick.size[2]/2);
	switch(currAsset) {
		case "B_1x1_Cone":
			bsize.x = 1;
			bsize.y = 1;
			bsize.z = 3;
			bmatch = "Cone";
		case "B_1x1_Round":
			bsize.x = 1;
			bsize.y = 1;
			bsize.z = 3;
			bmatch = "Round";
		case "B_1x1F_Round":
			bsize.x = 1;
			bsize.y = 1;
			bsize.z = 1;
			bmatch = "Round";
		case "B_2x2_Round":
			bsize.x = 2;
			bsize.y = 2;
			bsize.z = 3;
			bmatch = "Round";
		case "B_2x2F_Round":
			bsize.x = 2;
			bsize.y = 2;
			bsize.z = 1;
			bmatch = "Round";
		case "PB_DefaultRampCorner":
			bmatch = "RampCorner";
		case "PB_DefaultRamp":
			bmatch = "Ramp";
			break;
		case "PB_DefaultBrick":
			break;
		default:
			//unhandled brick, may have 0 size, TODO: maybe add a ? model
	}
	
	inst.brickBuffer.push(new InternalBrick(
		bsize,
		new THREE.Vector3(currBrick.position[1]/10, currBrick.position[0]/10, currBrick.position[2]/4), //brs uses Y-right, X-forward, Z-up; we use X-right, Y-forward, Z-up
		currBrick.rotation,
		new THREE.Color(col[0]/255,col[1]/255,col[2]/255),
		0, { //TODO: material index
			InternalName: bmatch,
			BrickadiaName: currAsset,
			BrickadiaData: {
				Owner: inst.brsdata.brick_owners[currBrick.owner_index-1],
				Material: inst.brsdata.materials[currBrick.material_index],
				IsProcedural: currAsset.substring(0,3) == "PB_"
			},
			Orientation: currBrick.direction,
			Collides: currBrick.collision,
			Visible: currBrick.visibility
	}));
	
	inst.currBrick++;
	return inst.currBrick == inst.brsdata.bricks.length;
}, {
	RunSpeed: 50,
	MaxExecTime: 40,
	OnStagePause: function(inst) {
		return "Loading BRS... " + inst.currBrick + "/" + inst.brsdata.bricks.length;
	}
})], {
	Controls: {Reader: $("<input>", {"type":"file", "class":"opt-full", "accept":".brs"})},
	OnSetup: function(inst) {
		if(this.controls.Reader.get(0).files.length < 1) {
			inst.abort = "No file loaded";
			return;
		}
		inst.fileObj = this.controls.Reader.get(0).files[0];
	},
	Description: "Loads bricks and related data from a Brickadia save file (.BRS)."
});
var o = new Option(GenName, GenName);
$(o).html(GenName);
$("#generator-type").append(o);
Generators[GenName].OptionElement = o;