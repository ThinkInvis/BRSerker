//Expects 'inst.vox' to be a 3D array whose values are each either an RGBA color array (full cell with that color) or the string "skip" (empty cell)
//If 'inst.octreeIrregular' is set to 'true', splits can happen anywhere (can be more efficient than center); otherwise, splits only happen directly at the center of the leaf
//If 'inst.octreeSizeLimit' is not undefined, expects it to be an array containing the inclusive maximum X, Y, and Z size for one brick. Otherwise, this limit is not used.
//If 'inst.octreeScale' is not undefined, expects it to be an array containing the X, Y, and Z brick size of one voxel. Otherwise, this size is [1, 1, 3] (a 1x1 brick). Scales octreeSizeLimit such that octreeSizeLimit applies to the output bricks, not to voxel scale.
//Result: will octree-merge regions of voxels with identical color, then create bricks in inst's brickbuffer based on the octree's contents
//SBG_SlowIterator is from [master]/StagedBrickGenerator.js
var SBGSI_OctreeVoxels = new SBG_SlowIterator(function(inst) {
	var leaf = inst.leaves[0];
	
	//scan the leaf for voxel colors that don't match its reference (upper top left of leaf)
	var i = leaf.minX;
	var j = leaf.minY;
	var k = leaf.minZ;
	var wGo = true;
	while(wGo) {
		var c1 = inst.vox[i][j][k];
		var c2 = leaf.refV;
		var isTooBig = (inst.usesOctreeSizeLimit && (
			(leaf.maxX-leaf.minX > inst.octreeSizeLimit[0]/inst.octreeScale[0])
		  ||(leaf.maxY-leaf.minY > inst.octreeSizeLimit[1]/inst.octreeScale[1])
		  ||(leaf.maxZ-leaf.minZ > inst.octreeSizeLimit[2]/inst.octreeScale[2])
		   ));
		if(((c1 != "skip" || c2 != "skip") && (c1[0] != c2[0] || c1[1] != c2[1] || c1[2] != c2[2]))
	     || isTooBig) {
			//color mismatch or brick is too big, split the leaf and restart (todo: can we just resume instead?)
			//todo: is running size check in a second pass better? seems like current approach splits things up early, but that may be beneficial sometimes
			var x0 = leaf.minX;
			var y0 = leaf.minY;
			var z0 = leaf.minZ;
			var x2 = leaf.maxX;
			var y2 = leaf.maxY;
			var z2 = leaf.maxZ
			
			var x1, y1, z1;
			if(inst.octreeIrregular && !isTooBig) {
				x1 = i;
				y1 = j;
				z1 = k;
			} else {
				x1 = Math.floor((x2+x0)/2);
				y1 = Math.floor((y2+y0)/2);
				z1 = Math.floor((z2+z0)/2);
			}
			
			inst.leaves.shift();
			
			var pairs = [[x0,y0,z0,x1,y1,z1],[x0,y1,z0,x1,y2,z1],[x1,y0,z0,x2,y1,z1],[x1,y1,z0,x2,y2,z1],[x0,y0,z1,x1,y1,z2],[x0,y1,z1,x1,y2,z2],[x1,y0,z1,x2,y1,z2],[x1,y1,z1,x2,y2,z2],];
			
			for(var w = 0; w < pairs.length; w++) {
				var p = pairs[w];
				if(p[3]-p[0] > 0 && p[4]-p[1] > 0 && p[5]-p[2] > 0) {
					inst.leaves.push({
						minX: p[0],
						maxX: p[3],
						minY: p[1],
						maxY: p[4],
						minZ: p[2],
						maxZ: p[5],
						refV: inst.vox[p[0]][p[1]][p[2]]
					});
				inst.totalLeafTracker++;
				}
			}
			
			return inst.leaves.length == 0;
		}
		
		i++;
		if(i >= leaf.maxX) {
			i = leaf.minX;
			j++;
		}
		if(j >= leaf.maxY) {
			j = leaf.minY;
			k++;
		}
		if(k >= leaf.maxZ) {
			wGo = false;
		}
	}
	
	inst.leaves.shift();
	
	if(leaf.refV != "skip") {
		var brickPos = new THREE.Vector3(leaf.minX*inst.octreeScale[0], leaf.minY*inst.octreeScale[1], leaf.minZ*inst.octreeScale[2]);
		var brickSize = new THREE.Vector3((leaf.maxX-leaf.minX)*inst.octreeScale[0], (leaf.maxY-leaf.minY)*inst.octreeScale[1], (leaf.maxZ-leaf.minZ)*inst.octreeScale[2]);
	
		inst.brickBuffer.push(new InternalBrick(
			brickSize,
			brickPos,
			0,
			new THREE.Color(leaf.refV[0], leaf.refV[1], leaf.refV[2], leaf.refV[3]),
			0,
			{
				InternalName: "Basic"
			}
		).AutoOffset());
	}
	
	return inst.leaves.length == 0;
	
},{
	RunSpeed: 50,
	MaxExecTime: 40,
	OnStageSetup: function(inst) {
		inst.maxX = inst.vox.length;
		inst.maxY = inst.vox[0].length;
		inst.maxZ = inst.vox[0][0].length;
		
		inst.totalLeafTracker = 1;
		
		inst.usesOctreeSizeLimit = (typeof inst.octreeSizeLimit !== "undefined");
		if(typeof inst.octreeScale === "undefined")
			inst.octreeScale = [1, 1, 3];
		
		inst.leaves = [{
			minX: 0,
			minY: 0,
			minZ: 0,
			maxX: inst.maxX,
			maxY: inst.maxY,
			maxZ: inst.maxZ,
			refV: inst.vox[0][0][0]
		}];
		
		inst.voxStart = window.performance.now();
	},
	OnStagePause: function(inst) {
		return "Building... tree has " + inst.leaves.length + "/" + inst.totalLeafTracker + " leaves";
	}
});


//https://gist.github.com/Meshiest/0b1a5b3dc4a9337c359e94d33ba322a5
var GenName = "OcTerrain";

Generators[GenName] = new StagedBrickGenerator(GenName, [
	new SBG_SlowIterator(function(inst) {
		var currHeight = inst.pollHeightmap(inst.currX, inst.currY);
		
		var val, currCave;//, caveDifCheck;
		var lowestNeighbor = currHeight;
		
		if(inst.doCaves) {
			currCave = 0.5 * (1 + noise.simplex3(
				inst.currX/inst.vNoiseResolution,
				inst.currY/inst.vNoiseResolution,
				inst.currZ/inst.vNoiseResolution
			));
			
			/*if(inst.skinDepth != 0) {
				var caveDifs = [];
				for(var i = -1; i <= 1; i++) {
					for(var j = -1; j <= 1; j++) {
						for(var k = -1; k <= 1; k++) {
							
						}
					}
				}
			}*/ //NYI, need to work out the algorithm
		}
		
		if(inst.skinDepth != 0) {
			for(var i = -1; i <= 1; i++) {
				for(var j = -1; j <= 1; j++) {
					if(i == 0 && j == 0) continue;
					var nbHeight = inst.pollHeightmap(inst.currX+i, inst.currY+j);
					if(nbHeight < lowestNeighbor) lowestNeighbor = nbHeight;
				}
			}
		}
		
		if(!inst.doCaves || currCave < inst.vNoiseChance) { //Caves: remove blocks based on a threshold
			if(inst.currZ < currHeight && //Check upper terrain height
				(inst.skinDepth == 0 || lowestNeighbor - inst.currZ < inst.skinDepth)) { //Check lower terrain height (if using skin depth) relative to the lowest neighboring cell (to avoid holes)
				val = inst.grassColor;
				if(inst.grassDepth == 0 || inst.currZ < currHeight - inst.grassDepth)
					val = inst.mainColor;
			} else
				val = "skip";
		} else
			val = "skip";
		
		if(val != "skip") inst.bcMinTracker++; //for stats
		
		inst.vox[inst.currX][inst.currY][inst.currZ] = val;
		
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
			noise.seed(Math.random());
			inst.vox = [];
			for(var i = 0; i < inst.maxX; i++) {
				inst.vox[i] = [];
				for(var j = 0; j < inst.maxY; j++) {
					inst.vox[i][j] = [];
				}
			}
			inst.currX = 0;
			inst.currY = 0;
			inst.currZ = 0;
			inst.bcMinTracker = 0;
			inst.debugNoise = [];
			inst.minStart = window.performance.now();
			inst.heightmap = [];
			inst.pollHeightmap = function(i,j) {
				if(typeof inst.heightmap[i] === "undefined")
					inst.heightmap[i] = [];
				if(typeof inst.heightmap[i][j] === "undefined") {
					inst.heightmap[i][j] = 0;
					var freq = 1;
					var amp = 1;
					var ampt = 0;
					for(var k = 0; k < inst.hNoiseOctaves; k++) {
						ampt += amp;
						inst.heightmap[i][j] += amp * noise.simplex2(
							i/inst.hNoiseResolution * freq,
							j/inst.hNoiseResolution * freq
						);
						freq *= 2;
						amp *= inst.hNoisePersistence;
					}
					inst.heightmap[i][j] /= ampt / inst.hNoiseScale; //take average of all samples, then multiply by intended scale
					inst.heightmap[i][j] += inst.hNoiseOffset;
				}
				return inst.heightmap[i][j];
			}
		},
		OnStagePause: function(inst) {
			return "Generating noise... " + Math.floor(inst.currZ/inst.maxZ*100) + "%";
		},
		OnStageFinalize: function(inst) {
			inst.minEnd = window.performance.now();
		}
	}),
	SBGSI_OctreeVoxels], {
	Controls: {
		NScaleLabel: $("<span>", {"class":"opt-1-2","html":"Height scale:"}),
		NScale: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":0.01, "max":1024, "value":512, "step":0.01}),
		NOffsetLabel: $("<span>", {"class":"opt-1-2","html":"Height offset:"}),
		NOffset: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":-2048, "max":2048, "value":512, "step":0.01}),
		NResolutionLabel: $("<span>", {"class":"opt-1-2","html":"Height base scale: <span class='hint'>(10<sup>-n</sup>)</span>"}),
		NResolution: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":-4, "max":4, "value":2.6, "step":0.01}),
		NOctavesLabel: $("<span>", {"class":"opt-1-2","html":"Octaves:"}),
		NOctaves: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":1, "max":10, "value":3, "step":1}),
		NPersistenceLabel: $("<span>", {"class":"opt-1-2","html":"Persistence:"}),
		NPersistence: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":0, "max":1, "value":0.8, "step":0.001}),
		NGrassDepthLabel: $("<span>", {"class":"opt-1-2","html":"Grass depth:<span class='hint'>0 for no grass</span>"}),
		NGrassDepth: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":0, "max":256, "value":3, "step":0.1}),
		NMaxDepthLabel: $("<span>", {"class":"opt-1-2","html":"Skin depth:<span class='hint'>0 for infinite</span>"}),
		NMaxDepth: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":0, "max":256, "value":0, "step":0.1}),
		NDoCavesLabel: $("<span>", {"class":"opt-1-2","html":"Add caves: <span class='hint'>iffy, be careful</span>"}),
		NDoCaves: $("<span>", {"class":"opt-1-2 cb-container opt-input", "html":"&nbsp;"}).append($("<input>", {"type":"checkbox","checked":false})),
		NCaveResolutionLabel: $("<span>", {"class":"opt-1-2","html":"Cave base scale: <span class='hint'>(10<sup>-n</sup>)</span>", "style":"display:none"}),
		NCaveResolution: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":-4, "max":4, "value":1, "step":0.01, "style":"display:none"}),
		NCavePercentLabel: $("<span>", {"class":"opt-1-2","html":"Cave ratio: <span class='hint'>(1 = no caves)</span>", "style":"display:none"}),
		NCavePercent: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":0, "max":1, "value":0.75, "step":0.01, "style":"display:none"}),
		ModeLabel: $("<span>", {"class":"opt-1-2","text":"Irregular splits:"}),
		Mode: $("<span>", {"class":"opt-1-2 cb-container opt-input", "html":"&nbsp;"}).append($("<input>", {"type":"checkbox","checked":true})),
		SizeLabel: $("<span>", {"class":"opt-1-4","text":"Gen area:"}),
		SizeX: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":1024, "value":128, "step":1}),
		SizeY: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":1024, "value":128, "step":1}),
		SizeZ: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":3072, "value":1024, "step":1}),
		SecBBricksLabel: $("<span>", {"class":"opt-1-1","html":"Brick properties:"}),
		BScaleLabel: $("<span>", {"class":"opt-1-4","html":"Scale: <span class='hint'>Z in f's</span>"}),
		BScaleX: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":16, "value":8, "step":1}),
		BScaleY: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":16, "value":8, "step":1}),
		BScaleZ: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":48, "value":1, "step":1}),
		BLimLabel: $("<span>", {"class":"opt-1-4","html":"Limit: <span class='hint'>Z in f's</span>"}),
		BLimX: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":204, "value":128, "step":1}),
		BLimY: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":204, "value":128, "step":1}),
		BLimZ: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":511, "value":128, "step":1}),
		ColorLabel: $("<span>", {"class":"opt-1-4","text":"Dirt color:"}),
		ColorR: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":0.4, "step":0.001}),
		ColorG: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":0.3, "step":0.001}),
		ColorB: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":0.2, "step":0.001}),
		GColorLabel: $("<span>", {"class":"opt-1-4","text":"Grass color:"}),
		GColorR: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":0.1, "step":0.001}),
		GColorG: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":0.7, "step":0.001}),
		GColorB: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":0.2, "step":0.001})
	},
	OnSetup: function(inst) {
		inst.maxX = this.controls.SizeX.val()*1;
		inst.maxY = this.controls.SizeY.val()*1;
		inst.maxZ = this.controls.SizeZ.val()*1;
		
		inst.mainColor = [this.controls.ColorR.val()*1, this.controls.ColorG.val()*1, this.controls.ColorB.val()*1, 1.0];
		inst.grassColor = [this.controls.GColorR.val()*1, this.controls.GColorG.val()*1, this.controls.GColorB.val()*1, 1.0];
		inst.grassDepth = this.controls.NGrassDepth.val()*1;
		inst.skinDepth = this.controls.NMaxDepth.val()*1;
		
		inst.hNoiseOctaves = this.controls.NOctaves.val()*1;
		inst.hNoisePersistence = this.controls.NPersistence.val()*1;
		inst.hNoiseScale = this.controls.NScale.val()*1;
		inst.hNoiseOffset = this.controls.NOffset.val()*1;
		inst.hNoiseResolution = Math.pow(10, this.controls.NResolution.val()*1);
		inst.vNoiseResolution = Math.pow(10, this.controls.NCaveResolution.val()*1);
		inst.vNoiseChance = this.controls.NCavePercent.val()*1;
		
		inst.doCaves = this.controls.NDoCaves.find('input').get(0).checked;
		
		inst.octreeScale = [this.controls.BScaleX.val()*1,this.controls.BScaleY.val()*1,this.controls.BScaleZ.val()*1];
		inst.octreeSizeLimit = [this.controls.BLimX.val()*1,this.controls.BLimY.val()*1,this.controls.BLimZ.val()*1];
		//todo: hard clamp this to maximum? bad values are allowed for most inputs just to see what happens, but loading bricks higher than a certain size crashes brickadia
		//max octreeSizeLimit = [204, 204, 511];
		inst.octreeIrregular = this.controls.Mode.find('input').get(0).checked;
	},
	Description: "Generates grassed terrain based on simplex noise, with reduced brickcount through the magic of octrees.",
	OnFinalize: function(inst) {
		var now = window.performance.now();
		if(inst._statusEnabled)
			new StatusTicket(inst._statusContainer, {
				initText: "Finished terrain! Mouseover for stats: Noise generation took " + ((inst.minEnd - inst.minStart)/1000).toFixed(2) + " seconds. Minimization took " + ((now - inst.voxStart)/1000).toFixed(2) + " seconds. Original voxel terrain had " + inst.bcMinTracker + " filled voxels. Octree minimization reduced potential brickcount by " + (100-inst.brickBuffer.length/inst.bcMinTracker*100).toFixed(3) + "%!",
				bgColor: "00ff00",
				iconClass: "",
				timeout: 30000
			});
	}
});
var o = new Option(GenName, GenName);
$(o).html(GenName);
$("#generator-type").append(o);
Generators[GenName].OptionElement = o;

ParentCheckboxInput(Generators[GenName].controls.NDoCaves.find("input"), [Generators[GenName].controls.NCaveResolutionLabel,Generators[GenName].controls.NCaveResolution, Generators[GenName].controls.NCavePercentLabel, Generators[GenName].controls.NCavePercent], []);