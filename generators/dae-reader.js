//TODO:
//  - Finish setting up ceil/floor thickness option
//  - Allow adding margins to (or disabling entirely) build exclusion bricks
//  - Add feature generation (stairs, torches...)

var GenName = "DaeReader";
var GenDisplayName = "Maze Bitmap";
var GenCategory = "File Readers";

var MASTER_MAX_IMAGE_DAEX = 512;
var MASTER_MAX_IMAGE_DAEY = 16384;

var NewGen = new StagedBrickGenerator(GenName, [
	{apply: function(inst, promise) {
		if(inst._statusEnabled)
			inst._ticket.Text = "Waiting for file read...";
		var reader = new FileReader();
		reader.onload = function(e) {
			if(inst._statusEnabled)
				inst._ticket.Text = "Loading image...";
			
			inst.szX = inst.layerX;
			inst.szY = inst.layerY * inst.layerZ;
			
			var cvs = document.createElement('canvas');
			var ctx = document.createElement('canvas').getContext('2d');
			$(cvs).prop("width", inst.szX+2);
			$(cvs).prop("height", inst.szY+2);
			ctx.canvas.width = inst.szX+2;
			ctx.canvas.height = inst.szY+2;
			var img = new Image();
			img.src = this.result;
			img.onload = function() {
				if(inst._statusEnabled)
					inst._ticket.Text = "Parsing image...";
				ctx.drawImage(img, 0, 0, img.width, img.height);
				inst.imgData = ctx.getImageData(0, 0, img.width, img.height).data;
				
				img.src = '';
				img = null;
				cvs.remove();
				
				promise.resolve(inst);
			}
		}
		reader.readAsDataURL(inst.fileName);
	}},
	new SBG_SlowIterator(function(inst) {
		if((inst.imgData[inst.currI]/255 + inst.imgData[inst.currI+1]/255 + inst.imgData[inst.currI+2]/255 + inst.imgData[inst.currI+3]/255)/4 > 0.5 != inst.doInvert) {
			inst.colors.push(true);
		} else {
			inst.colors.push(false);
		}
		inst.currI += 4;
		return inst.currI >= inst.maxI;
	},{
		RunSpeed: 50,
		MaxExecTime: 40,
		OnStageSetup: function(inst) {
			inst.colors = [];
			inst.currI = 0;
			inst.maxI = inst.imgData.length;
			inst.currI = 0;
		},
		OnStagePause: function(inst) {
			return "Deinterlacing... " + pctDone(inst.currI, 0, inst.maxI);
		}
	}),
	new SBG_SlowIterator(function(inst) {
		var currInd = inst.currX + inst.currY * inst.layerX + inst.currZ * inst.layerY * inst.layerX;
		var currPx = inst.colors[currInd];
	
		var seekAhead = 0;
		if(currPx) {
			for(var i = inst.currX + 1; i < inst.layerX; i++) {
				var nextPx = inst.colors[inst.currX + seekAhead + 1 + inst.currY * inst.layerX + inst.currZ * inst.layerY * inst.layerX];
				if(nextPx)
					seekAhead++;
				else break;
				if((seekAhead+2)*inst.bricksize[2] > MASTER_SX_LIMIT) break;
			}
			
			var brickPos = new THREE.Vector3(inst.currX*inst.bricksize[0], (inst.layerY-inst.currY-1)*inst.bricksize[1], inst.currZ*inst.bricksize[2]);
			var brickSize = new THREE.Vector3((1+seekAhead)*inst.bricksize[0], 1*inst.bricksize[1], inst.bricksize[2]);
		
			inst.brickBuffer.push(new InternalBrick(
				brickSize,
				brickPos,
				0,
				//new THREE.Color(inst.color[0], inst.color[1], inst.color[2], inst.color[3]),
				new THREE.Color(inst.currX/inst.layerX, inst.currY/inst.layerY, inst.currZ/inst.layerZ, 1.0),
				0,
				{
					InternalName: "Basic"
				}
			).AutoOffset());
		} else {
			//var bPosCenter = new THREE.Vector3(inst.currX*inst.bricksize[0]+1, (inst.layerY-inst.currY-1)*inst.bricksize[1]+1, inst.currZ*inst.bricksize[2]+1);
			//var bSizeCenter = new THREE.Vector3(inst.bricksize[0]-2, inst.bricksize[1]-2, inst.bricksize[2]-2);
			var bPosCenter = new THREE.Vector3(inst.currX*inst.bricksize[0], (inst.layerY-inst.currY-1)*inst.bricksize[1], inst.currZ*inst.bricksize[2]);
			var bSizeCenter = new THREE.Vector3(inst.bricksize[0], inst.bricksize[1], inst.bricksize[2]);
			
			inst.brickBuffer.push(new InternalBrick(
				bSizeCenter,
				bPosCenter,
				0,
				new THREE.Color(1.0, 1.0, 1.0, 1.0),
				0,
				{
					Visible: false,
					Collides: false,
					InternalName: "Basic"
				}
			).AutoOffset());
			
			var nbUp = inst.colors[inst.currInd+inst.layerX*inst.layerY];
			var nbDn = inst.colors[inst.currInd-inst.layerX*inst.layerY];
			var nbFr = inst.colors[inst.currInd+inst.layerX];
			var nbBk = inst.colors[inst.currInd-inst.layerX];
			var nbRt = inst.colors[inst.currInd+1];
			var nbLf = inst.colors[inst.currInd-1];
			
			
		}
		
		inst.currX += 1 + seekAhead;
		if(inst.currX == inst.layerX) {
			inst.currX = 0;
			inst.currY ++;
		}
		if(inst.currY == inst.layerY) {
			inst.currY = 0;
			inst.currZ ++;
		}
		
		return inst.currZ == inst.layerZ;
	}, {
		RunSpeed: 50,
		MaxExecTime: 40,
		OnStageSetup: function(inst) {
			inst.currX = 0;
			inst.currY = 0;
			inst.currZ = 0;
		},
		OnStagePause: function(inst) {
			return "Building image... " + pctDone(inst.currZ, 0, inst.layerZ);
		}
	})
], {
	Controls: {
		Reader: $("<input>", {"type":"file", "class":"opt-1-1", "accept":"image/*", "height":"20"}),
		LayerLabel: $("<span>", {"class":"opt-1-4","html":"Maze size:"}),
		LayerX: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":512, "value":16, "step":1}),
		LayerY: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":512, "value":16, "step":1}),
		LayerZ: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":512, "value":16, "step":1}),
		ModeLabel: $("<span>", {"class":"opt-1-2","html":"Invert:<span class='hint'> dft: white = wall</span>"}),
		Mode: $("<span>", {"class":"opt-1-2 cb-container opt-input", "html":"&nbsp;"}).append($("<input>", {"type":"checkbox"})),
		/*ColorLabel: $("<span>", {"class":"opt-1-4","text":"Color:"}),
		ColorR: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":1, "step":0.001}),
		ColorG: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":0, "step":0.001}),
		ColorB: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":0, "step":0.001}),*/
		ScaleLabel: $("<span>", {"class":"opt-1-4","html":"Size: <span class='hint'>Z in f's</span>"}),
		ScaleX: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":16, "value":6, "step":1}),
		ScaleY: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":16, "value":6, "step":1}),
		ScaleZ: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":48, "value":18, "step":1})/*,
		CeilScaleLabel: $("<span>", {"class":"opt-3-4","html":"Ceiling/Floor Thickness:"}),
		CeilScale: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":48, "value":18, "step":1})*/
	},
	OnSetup: function(inst) {
		if(this.controls.Reader.get(0).files.length < 1) {
			inst.abort = "No file loaded";
			return;
		}
		inst.fileName = this.controls.Reader.get(0).files[0];
		
		inst.layerX = this.controls.LayerX.val()*1;
		inst.layerY = this.controls.LayerY.val()*1;
		inst.layerZ = this.controls.LayerZ.val()*1;
		
		inst.doInvert = this.controls.Mode.find("input").get(0).checked;
		
		//inst.color = [this.controls.ColorR.val()*1, this.controls.ColorG.val()*1, this.controls.ColorB.val()*1, 1.0];
		inst.bricksize = [this.controls.ScaleX.val()*1, this.controls.ScaleY.val()*1, this.controls.ScaleZ.val()*1];
	},
	Description: "Modified image reader which loads mazes exported from Daedalus (or any other program that exports black-and-white bitmaps). Expects 3D mazes to have W=0 in size options -- slices laid out vertically only."
});

RegisterGenerator(NewGen, GenDisplayName, GenName, GenCategory);