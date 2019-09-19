var GenName = "ImageReader";

var MASTER_MAX_IMAGE = 1024;

Generators[GenName] = new StagedBrickGenerator(GenName, [
	{apply: function(inst, promise) {
		if(inst._statusEnabled)
			inst._ticket.Text = "Waiting for file read...";
		var reader = new FileReader();
		reader.onload = function(e) {
			if(inst._statusEnabled)
				inst._ticket.Text = "Loading image...";
			var cvs = document.createElement('canvas');
			var ctx = document.createElement('canvas').getContext('2d');
			$(cvs).prop("width", MASTER_MAX_IMAGE);
			$(cvs).prop("height", MASTER_MAX_IMAGE);
			ctx.canvas.width = MASTER_MAX_IMAGE;
			ctx.canvas.height = MASTER_MAX_IMAGE;
			var img = new Image();
			img.src = this.result;
			img.onload = function() {
				if(inst._statusEnabled) //todo: updateStatus function?
					inst._ticket.Text = "Parsing image...";
				//load image into a temporary canvas
				var iX = Math.floor(img.width*inst.imgScale);
				var iY = Math.floor(img.height*inst.imgScale);
				if(iX > MASTER_MAX_IMAGE || iY > MASTER_MAX_IMAGE) {
					//todo: warn user
				}
				ctx.drawImage(img, 0, 0, iX, iY);
				inst.imgData = ctx.getImageData(0, 0, iX, iY).data;
				inst.imgSizeX = iX;
				inst.imgSizeY = iY;
				
				//get rid of the temporary canvas and make sure the image isn't in memory anymore
				img.src = '';
				img = null;
				cvs.remove();
				
				promise.resolve(inst);
			}
		}
		reader.readAsDataURL(inst.fileName);
	}},
	new SBG_SlowIterator(function(inst) {
		//deinterlace RGBA color data to objects, and quantize with BRS color scheme
		var currPx = [inst.imgData[inst.currI]/255,inst.imgData[inst.currI+1]/255,inst.imgData[inst.currI+2]/255, inst.imgData[inst.currI+3]/255];
		if(inst.imgData[inst.currI+3]/255 < inst.alphaCutoff) { //TODO: true transparency, a lot of things don't pass it through right so this is the best there is right now
			inst.colors.push("skip");
		} else {
			inst.colors.push(ColorQuantize(currPx, brsColorsetRGB).Color);
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
			return "Deinterlacing/quantizing... " + Math.floor(inst.currI/inst.maxI*100) + "%";
		}
	}),
	new SBG_SlowIterator(function(inst) {
		var currPx = inst.colors[inst.currX + inst.currY * inst.maxX];
	
		//TODO: +X+Y, +Y+X, -X+Y, -Y+X, +X-Y, +Y-X, -X-Y, -Y-X optimization
		//instead of the seekAhead increment, mark pixels as visited and skip based on that
		//also allow random seeding until no pixels are left instead of straight iteration?
	
		//merge regions of adjacent identical color into one brick
		//todo: we can probably do merging with https://github.com/mikolalysenko/rectangle-decomposition
		//for now, just uses a simple one-directional merge
		if(inst.optMode == "y") {
			var seekAhead = 0;
			if(currPx != "skip") {
				for(var i = inst.currY + 1; i < inst.maxY; i++) {
					var nextPx = inst.colors[inst.currX + (inst.currY + seekAhead) * inst.maxX];
					if(nextPx != "skip" && currPx[0] == nextPx[0] && currPx[1] == nextPx[1] && currPx[2] == nextPx[2] && currPx[3] == nextPx[3])
						seekAhead++;
					else break;
					if(inst.horizontal) {
						if((seekAhead+2)*inst.pixelScale > MASTER_SX_LIMIT) break;	
					} else {
						if((seekAhead+2)*inst.pixelScale*3 > MASTER_SZ_LIMIT) break;	
					}
				}
			
				var brickPos;
				var brickSize;
				if(inst.horizontal) {
					brickPos = new THREE.Vector3(inst.currX*inst.pixelScale, (inst.maxY-inst.currY-1-seekAhead)*inst.pixelScale, 0);
					brickSize = new THREE.Vector3(inst.pixelScale, (1+seekAhead)*inst.pixelScale, 1);
				} else {
					brickPos = new THREE.Vector3(inst.currX*inst.pixelScale, 0, (inst.maxY-inst.currY-1-seekAhead)*3*inst.pixelScale);
					brickSize = new THREE.Vector3(1*inst.pixelScale, 1, (1+seekAhead)*3*inst.pixelScale);
				}
			
				inst.brickBuffer.push(new InternalBrick(
					brickSize,
					brickPos,
					0,
					new THREE.Color(currPx[0], currPx[1], currPx[2], currPx[3]),
					0,
					{
						InternalName: "Basic"
					}
				).AutoOffset());
			}
			inst.currY += 1 + seekAhead;
			if(inst.currY == inst.maxY) {
				inst.currY = 0;
				inst.currX ++;
			}
			return inst.currX == inst.maxX;
		} else {
			var seekAhead = 0;
			if(currPx != "skip") {
				if(inst.optMode == "x") {
					for(var i = inst.currX + 1; i < inst.maxX; i++) {
						var nextPx = inst.colors[inst.currX + seekAhead + inst.currY * inst.maxX];
						if(nextPx != "skip" && currPx[0] == nextPx[0] && currPx[1] == nextPx[1] && currPx[2] == nextPx[2] && currPx[3] == nextPx[3])
							seekAhead++;
						else break;
						if((seekAhead+2)*inst.pixelScale > MASTER_SX_LIMIT) break;
					}
				}
			
				var brickPos;
				var brickSize;
				if(inst.horizontal) {
					brickPos = new THREE.Vector3(inst.currX*inst.pixelScale, (inst.maxY-inst.currY-1)*inst.pixelScale, 0);
					brickSize = new THREE.Vector3((1+seekAhead)*inst.pixelScale, 1*inst.pixelScale, 1);
				} else {
					brickPos = new THREE.Vector3(inst.currX*inst.pixelScale, 0, (inst.maxY-inst.currY-1)*3*inst.pixelScale);
					brickSize = new THREE.Vector3((1+seekAhead)*inst.pixelScale, 1, 3*inst.pixelScale);
				}
			
				inst.brickBuffer.push(new InternalBrick(
					brickSize,
					brickPos,
					0,
					new THREE.Color(currPx[0], currPx[1], currPx[2], currPx[3]),
					0,
					{
						InternalName: "Basic"
					}
				).AutoOffset());
			}
			inst.currX += 1 + seekAhead;
			if(inst.currX == inst.maxX) {
				inst.currX = 0;
				inst.currY ++;
			}
			return inst.currY == inst.maxY;
		}
	}, {
		RunSpeed: 50,
		MaxExecTime: 40,
		OnStageSetup: function(inst) {
			inst.maxX = inst.imgSizeX;
			inst.maxY = inst.imgSizeY;
			inst.currX = 0;
			inst.currY = 0;
		},
		OnStagePause: function(inst) {
			if(inst.optMode == "y")
				return "Building image... " + Math.floor((inst.currY+inst.currX*inst.maxY)/(inst.maxX*inst.maxY)*100) + "%";
			else
				return "Building image... " + Math.floor((inst.currX+inst.currY*inst.maxX)/(inst.maxX*inst.maxY)*100) + "%";
		}
	})
], {
	Controls: {
		Reader: $("<input>", {"type":"file", "class":"opt-full", "accept":"image/*", "height":"20"}),
		ScaleLabel: $("<span>", {"class":"opt-half","text":"Resolution Scale (2^n):"}),
		Scale: $("<input>", {"type":"number", "class":"opt-half opt-input", "min":-4, "max":4, "value":0, "step":0.1}),
		PxScaleLabel: $("<span>", {"class":"opt-half","text":"Brick Upscale (linear):"}),
		PxScale: $("<input>", {"type":"number", "class":"opt-half opt-input", "min":1, "max":50, "value":1, "step":1}),
		ModeLabel: $("<span>", {"class":"opt-half","text":"Build Horizontal:"}),
		Mode: $("<input>", {"type":"checkbox", "class":"opt-half opt-input"}),
		OptModeLabel: $("<span>", {"class":"opt-half","text":"Optimize:"}),
		OptMode: $("<select class='opt-half opt-input'><option value='none'>None</option><option value='x' selected>X</option><option value='y'>Y</option></select>"),
		AlphaCutoffLabel: $("<span>", {"class":"opt-half","text":"Alpha cutoff:"}),
		AlphaCutoff: $("<input>", {"type":"number", "class":"opt-half opt-input", "min":0, "max":0.99, "value":0, "step":0.01})
	},
	OnSetup: function(inst) {
		if(this.controls.Reader.get(0).files.length < 1) {
			inst.abort = "No file loaded";
			return;
		}
		
		inst.imgScale = Math.pow(2, this.controls.Scale.val()*1);
		inst.pixelScale = this.controls.PxScale.val()*1;
		inst.horizontal = this.controls.Mode.get(0).checked;
		inst.optMode = this.controls.OptMode.val();
		inst.fileName = this.controls.Reader.get(0).files[0];
		inst.alphaCutoff = this.controls.AlphaCutoff.val()*1;
	}
});
var o = new Option(GenName, GenName);
$(o).html(GenName);
$("#generator-type").append(o);
Generators[GenName].OptionElement = o;