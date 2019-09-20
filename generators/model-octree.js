var GenName = "ModelFillOctree";

var MASTER_MAX_IMAGE = 1024;

//https://stackoverflow.com/questions/26644214/image-compression-using-quadtrees-algorithm ? just uses center split for now

Generators[GenName] = new StagedBrickGenerator(GenName, [
	{apply: function(inst, promise) {
		if(inst._statusEnabled)
			inst._ticket.Text = "Waiting for file read...";
		var reader = new FileReader();
		reader.onload = function(e) {
			if(inst._statusEnabled)
				inst._ticket.Text = "Loading OBJ...";
			var res = new THREE.OBJLoader().parse(this.result);
			console.log(res);
			inst.vox = new VoxelizerClass().sample(res, 50);
			console.log(inst.vox);
			inst.maxX = inst.vox.length;
			inst.maxY = inst.vox[0].length;
			inst.maxZ = inst.vox[0][0].length;
			promise.resolve(inst);
		}
		reader.readAsText(inst.fileName, "ISO-8859-1");
	}},
	new SBG_SlowIterator(function(inst) {
		if(inst.vox[inst.currX][inst.currY][inst.currZ] == 1) {
				inst.brickBuffer.push(new InternalBrick(
					new THREE.Vector3(1,1,3),
					new THREE.Vector3(inst.currX,inst.currY,inst.currZ*3),
					0,
					new THREE.Color(1,1,1,1),
					0,
					{
						InternalName: "Basic"
					}
				).AutoOffset());
		}
		
		inst.currX++;
		if(inst.currX >= inst.maxX) {
			inst.currX = 0;
			inst.currY++;
		}
		if(inst.currY >= inst.maxY) {
			inst.currY = 0;
			inst.currZ++;
		}
		return inst.currZ >= inst.maxZ;
	},{
		RunSpeed: 50,
		MaxExecTime: 40,
		OnStageSetup: function(inst) {
			inst.currX = 0;
			inst.currY = 0;
			inst.currZ = 0;
		},
		OnStagePause: function(inst) {
			return "Building... " + Math.floor((inst.currX+inst.currY*inst.maxX+inst.currZ*inst.maxX*inst.maxY)/inst.maxX/inst.maxY/inst.maxZ*100) + "%";
		}
	})], {
	Controls: {
		Reader: $("<input>", {"type":"file", "class":"opt-1-1", "accept":".obj", "height":"20"})
	},
	OnSetup: function(inst) {
		if(this.controls.Reader.get(0).files.length < 1) {
			inst.abort = "No file loaded";
			return;
		}
		
		inst.fileName = this.controls.Reader.get(0).files[0];
	},
	Description: "Efficiently generates bricks based on an image file."
});
var o = new Option(GenName, GenName);
$(o).html(GenName);
$("#generator-type").append(o);
Generators[GenName].OptionElement = o;