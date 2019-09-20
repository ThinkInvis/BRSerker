var GenName = "ImageQuadder";

var MASTER_MAX_IMAGE = 1024;

//https://stackoverflow.com/questions/26644214/image-compression-using-quadtrees-algorithm ? just uses center split for now

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
		//deinterlace RGBA color data to objects, quantize, and check against the quadtree
		//quadtree starts off with one leaf encompassing entire image
		//while there are still quadtree leaves not marked as complete:
		//	pick the first quadtree leaf
		//		set the first leaf pixel's color as the reference color
		//		iterate over image data from this leaf:
		//			if the current pixel is not the reference color, split the leaf and break loop
		//		if leaf was not split during iteration, mark it as complete
		//
		//when reading a pixel:
		//	if it already has color data, use that; only quantize if it hasn't been read yet
		//
		//each leaf should store its starting location in the image? or just translate image data over at start
		
		//setup: create quadtree, set refcol to pixel 0 of leaf 0, set currleaf to 0, set currpx to 0
		
		//loop:
		//	get the pixel at currpx in currleaf
		var currPx = [inst.imgData[inst.currI]/255,inst.imgData[inst.currI+1]/255,inst.imgData[inst.currI+2]/255, inst.imgData[inst.currI+3]/255];
		if(inst.imgData[inst.currI+3]/255 < inst.alphaCutoff) { //TODO: true transparency, a lot of things don't pass it through right so this is the best there is right now
			inst.colors.push("skip");
		} else {
			var ncl;
			switch(inst.quantmode) {
				case "post":
					ncl = [
						Math.round(currPx[0]*inst.postR)/inst.postR,
						Math.round(currPx[1]*inst.postG)/inst.postG,
						Math.round(currPx[2]*inst.postB)/inst.postB,
						Math.round(currPx[3]*inst.postA)/inst.postA
					];
					break;
				case "brs":
					ncl = ColorQuantize(currPx, brsColorsetRGB).Color;
					break;
				case "bls":
					ncl = ColorQuantize(currPx, blsColorsetRGB).Color;
					break;
				default:
				case "none":
					ncl = currPx;
			}
			inst.colors.push(ncl);
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
		var leaf = inst.leaves[0];
		
		//scan the leaf for colors that don't match its reference color (top left pixel)
		var i = leaf.minX;
		var j = leaf.minY;
		var wGo = true;
		while(wGo) {
			var c1 = inst.colors[i+j*inst.imgSizeX];
			var c2 = leaf.refC;
			if((c1 != "skip" || c2 != "skip") && (c1[0] != c2[0] || c1[1] != c2[1] || c1[2] != c2[2])) { 
				//color mismatch, split the leaf and restart (todo: can we just resume instead?)
				var x0 = leaf.minX;
				var y0 = leaf.minY;
				var x2 = leaf.maxX;
				var y2 = leaf.maxY;
				
				//var x1 = Math.floor((x2+x0)/2);
				//var y1 = Math.floor((y2+y0)/2);
				var x1 = i;
				var y1 = j;
				
				inst.leaves.shift();
				
				var pairs = [[x0,y0,x1,y1],[x0,y1,x1,y2],[x1,y0,x2,y1],[x1,y1,x2,y2]];
				
				for(var k = 0; k < pairs.length; k++) {
					var p = pairs[k];
					if(p[2]-p[0] > 0 && p[3]-p[1] > 0)
					inst.leaves.push({
						minX: p[0],
						maxX: p[2],
						minY: p[1],
						maxY: p[3],
						refC: inst.colors[p[0]+p[1]*inst.imgSizeX]
					});	
				}
				
				return inst.leaves.length == 0;
			}
			
			i++;
			if(i >= leaf.maxX) {
				i = leaf.minX;
				j++;
			}
			if(j >= leaf.maxY) {
				wGo = false;
			}
		}
		
		inst.leaves.shift();
		
		inst.debugBricks.push(leaf);
		
		var brickPos;
		var brickSize;
		if(inst.horizontal) {
			brickPos = new THREE.Vector3(leaf.minX*inst.pixelScale, leaf.minY*inst.pixelScale, 0);
			brickSize = new THREE.Vector3(leaf.maxX-leaf.minX, leaf.maxY-leaf.minY, 1);
		} else {
			brickPos = new THREE.Vector3(leaf.minX*inst.pixelScale, 0, leaf.minY*inst.pixelScale);
			brickSize = new THREE.Vector3(leaf.maxX-leaf.minX, 1, (leaf.maxY-leaf.minY)*3);
		}
	
		var brickCol = inst.colors[leaf.minX+leaf.minY*inst.imgSizeX];
		
		inst.brickBuffer.push(new InternalBrick(
			brickSize,
			brickPos,
			0,
			new THREE.Color(brickCol[0], brickCol[1], brickCol[2], brickCol[3]),
			0,
			{
				InternalName: "Basic"
			}
		).AutoOffset());
		
		return inst.leaves.length == 0;
	}, {
		RunSpeed: 50,
		MaxExecTime: 40,
		OnStageSetup: function(inst) {
			inst.leaves = [{
				minX: 0,
				minY: 0,
				maxX: inst.imgSizeX,
				maxY: inst.imgSizeY,
				refC: inst.colors[0]
			}];
			
			inst.debugBricks = [];
		},
		OnStagePause: function(inst) {
			return "Building image... processing " + (inst.leaves.length) + " leaves";
		},
		OnStageFinalize: function(inst) {
			console.log(inst.debugBricks);
		}
	})
], {
	Controls: {
		Reader: $("<input>", {"type":"file", "class":"opt-1-1", "accept":"image/*", "height":"20"}),
		ScaleLabel: $("<span>", {"class":"opt-1-2","html":"Image Scale:<span class='hint'> 2<sup>n</sup>, may be &lt;0</span>"}),
		Scale: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":-4, "max":4, "value":0, "step":0.1}),
		PxScaleLabel: $("<span>", {"class":"opt-1-2","html":"Brick Scale:<span class='hint'> linear</span>"}),
		PxScale: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":1, "max":50, "value":1, "step":1}),
		ModeLabel: $("<span>", {"class":"opt-1-2","text":"Build Horizontal:"}),
		Mode: $("<span>", {"class":"opt-1-2 cb-container opt-input", "html":"&nbsp;"}).append($("<input>", {"type":"checkbox"})),
		QuantizeLabel: $("<span>", {"class":"opt-1-2","text":"Color Quantize:"}), //TODO: add this as a standalone generator that operates on existing bricks, can replace the hardcoded quantize in cobblewall among oithers
		Quantize: $("<select class='opt-1-2 opt-input'><option value='none'>None</option><option value='brs' selected>BR Default</option><option value='bls'>BL Default</option><option value='post'>Posterize</option></select>"),
		PosterizeLabelX: $("<span>", {"class":"opt-2-4","text":"- Posterize level:","style":"display:none"}),
		PosterizeR: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":16, "value":4, "step":1, "style":"display:none"}),
		PosterizeG: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":16, "value":4, "step":1, "style":"display:none"}),
		PosterizeLabelY: $("<span>", {"class":"opt-2-4 hint","html":"&nbsp;&nbsp;&nbsp;RG/BA stages","style":"display:none"}),
		PosterizeB: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":16, "value":4, "step":1, "style":"display:none"}),
		PosterizeA: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":16, "value":4, "step":1, "style":"display:none"}),
		OptModeLabel: $("<span>", {"class":"opt-1-2","text":"Optimize:"}),
		OptMode: $("<select class='opt-1-2 opt-input'><option value='none'>None</option><option value='x' selected>X</option><option value='y'>Y</option></select>"),
		AlphaCutoffLabel: $("<span>", {"class":"opt-1-2","text":"Alpha cutoff:"}),
		AlphaCutoff: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":0, "max":0.99, "value":0, "step":0.01})
	},
	OnSetup: function(inst) {
		if(this.controls.Reader.get(0).files.length < 1) {
			inst.abort = "No file loaded";
			return;
		}
		
		inst.imgScale = Math.pow(2, this.controls.Scale.val()*1);
		inst.pixelScale = this.controls.PxScale.val()*1;
		inst.horizontal = this.controls.Mode.find("input").get(0).checked;
		inst.optMode = this.controls.OptMode.val();
		inst.fileName = this.controls.Reader.get(0).files[0];
		inst.alphaCutoff = this.controls.AlphaCutoff.val()*1;
		
		inst.quantmode = this.controls.Quantize.val();
		inst.postR = this.controls.PosterizeR.val();
		inst.postG = this.controls.PosterizeG.val();
		inst.postB = this.controls.PosterizeB.val();
		inst.postA = this.controls.PosterizeA.val();
	},
	Description: "Efficiently generates bricks based on an image file."
});
var o = new Option(GenName, GenName);
$(o).html(GenName);
$("#generator-type").append(o);
Generators[GenName].OptionElement = o;

ParentOptionInput(Generators[GenName].controls.Quantize, [Generators[GenName].controls.PosterizeLabelX,Generators[GenName].controls.PosterizeLabelY, Generators[GenName].controls.PosterizeR, Generators[GenName].controls.PosterizeG, Generators[GenName].controls.PosterizeB, Generators[GenName].controls.PosterizeA], ["post"]);