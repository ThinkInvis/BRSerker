//Expects 'inst.vox' to be a 3D array whose values are each either an RGBA color array (full cell with that color) or the string "skip" (empty cell)
//Expects 'inst.maxX', 'inst.maxY', 'inst.maxZ' to be set to the bounds of inst.vox (allows for some out-of-bounds data to be set in previous stages)
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
	Batching: 1000,
	OnStageSetup: function(inst) {
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
///// STAGE 1: Heightmap Generation
	new SBG_SlowIterator(function(inst) {
		var iv = 0;
		
		var freq = 1;
		var amp = 1;
		var ampt = 0;
		for(var k = 0; k < inst.hNoiseOctaves; k++) {
			ampt += amp;
			iv += amp * noise.simplex2(
				(inst.currX+inst.posX)/inst.hNoiseResolution * freq,
				(inst.currY+inst.posY)/inst.hNoiseResolution * freq
			);
			freq *= 2;
			amp *= inst.hNoisePersistence;
		}
		iv /= ampt / inst.hNoiseScale; //take average of all samples, then multiply by intended scale
		iv += inst.hNoiseOffset;
		
		inst.heightmap[inst.currX][inst.currY] = iv;
		
		inst.currX++;
		if(inst.currX >= inst.maxX) {
			inst.currX = 0;
			inst.currY ++;
		}
		return inst.currY >= inst.maxY;
	},{
		RunSpeed: 50,
		MaxExecTime: 40,
		OnStageSetup: function(inst) {
			inst.currX = 0;
			inst.currY = 0;
			inst.heightmap = [];
			for(var i = 0; i < inst.maxX; i++) {
				inst.heightmap[i] = [];
			}
		},
		OnStagePause: function(inst) {
			return "Generating heightmap... " + Math.floor(inst.currY/inst.maxY*100) + "%";
		}
	}),
///// STAGE 2: Falloff map generation
	new SBG_SlowIterator(function(inst) {
		if(!inst.doFalloff) return true;
		//rolling particle mask
		//http://www.nolithius.com/articles/world-generation/world-generation-breakdown
		
		for(var i = 0; i < inst.maxP; i++) {
			inst.pmap[inst.currX][inst.currY] ++;
			if(inst.pmap[inst.currX][inst.currY] > inst.highestPmap)
				inst.highestPmap = inst.pmap[inst.currX][inst.currY];
			var oval = inst.pmap[inst.currX][inst.currY];
			
			var stepX = fracToInt(-1, 1, inst.prng());
			var stepY = fracToInt(-1, 1, inst.prng());
			var nx = inst.currX + stepX;
			var ny = inst.currY + stepY;
			
			if(nx >= inst.maxX || ny >= inst.maxY || nx < 0 || ny < 0) {
				
			} else {
				var nval = inst.pmap[nx][ny];
				if(nval <= oval) {
					inst.currX = nx;
					inst.currY = ny;
				}
			}
		}
		
		inst.currX = fracToInt(inst.minEdgeDist, inst.maxX-inst.minEdgeDist-1, inst.prng());
		inst.currY = fracToInt(inst.minEdgeDist, inst.maxY-inst.minEdgeDist-1, inst.prng());
		inst.currI++;
		
		return inst.currI >= inst.maxI;
	},{
		RunSpeed: 50,
		MaxExecTime: 40,
		Batching: 256,
		OnStageSetup: function(inst) {
			if(!inst.doFalloff) return;
			inst.currI = 0;
			inst.maxI = inst.maxX*inst.maxY*inst.falloffCount;
			inst.maxP = inst.falloffLife;
			inst.minEdgeDist = inst.falloffEdge;
			inst.currX = fracToInt(inst.minEdgeDist, inst.maxX-inst.minEdgeDist-1, inst.prng());
			inst.currY = fracToInt(inst.minEdgeDist, inst.maxY-inst.minEdgeDist-1, inst.prng());
			inst.pmap = [];
			for(var i = 0; i < inst.maxX; i++) {
				inst.pmap[i] = [];
				for(var j = 0; j < inst.maxY; j++) {
					inst.pmap[i][j] = 0;
				}
			}
			inst.highestPmap = 0;
		},
		OnStagePause: function(inst) {
			return "Generating falloff map... " + Math.floor(inst.currI/inst.maxI*100) + "%";
		},
		OnStageFinalize: function(inst) {
			if(!inst.doFalloff) return;
			for(var i = 0; i < inst.maxX; i++) {
				for(var j = 0; j < inst.maxY; j++) {
					//edge blurring. TODO: add option
					var idist = Math.min(i, inst.maxX-1-i);
					var jdist = Math.min(j, inst.maxY-1-j);
					if(idist == 0 || jdist == 0) inst.pmap[i][j] = 0;
					else if(idist == 1 || jdist == 1) inst.pmap[i][j] *= 0.5;
					else if(idist == 2 || jdist == 2) inst.pmap[i][j] *= 0.75;
					else if(idist == 3 || jdist == 3) inst.pmap[i][j] *= 0.825;
					//normalization
					inst.pmap[i][j] /= inst.highestPmap;
				}
			}
		}
	}),
///// STAGE 3: Apply Falloff
	new SBG_SlowIterator(function(inst) {
		if(!inst.doFalloff) return true;
		inst.heightmap[inst.currX][inst.currY] *= inst.pmap[inst.currX][inst.currY];
		//inst.heightmap[inst.currX][inst.currY] = falloffMul * inst.maxZ;
		
		inst.currY++;
		if(inst.currY >= inst.maxY) {
			inst.currX++;
			inst.currY = 0;
		}
		return inst.currX >= inst.maxX;
	},{
		RunSpeed: 50,
		MaxExecTime: 40,
		OnStageSetup: function(inst) {
			if(!inst.doFalloff) return;
			inst.currX = 0;
			inst.currY = 0;
		},
		OnStagePause: function(inst) {
			return "Applying falloff... " + Math.floor(inst.currX/inst.maxX*100) + "%";
		}
	}),
///// STAGE 4: Heightmap Voxel Mapping
	new SBG_SlowIterator(function(inst) {
		var currHeight = Math.min(Math.floor(inst.heightmap[inst.currX][inst.currY]), inst.maxZ);
		
		var lowestNeighbor = currHeight;
		
		if(inst.skinDepth >= 0) {
			mapLocalIter2(function(val,x,y,isCenter){
				if(isCenter) return;
				var nbHeight = Math.floor(val);
				if(nbHeight < lowestNeighbor) lowestNeighbor = nbHeight;
			}, inst.heightmap, 1, inst.currX, inst.currY, inst.maxX, inst.maxY);
		}
		
		//in non-cave generation we can go really fast along the z axis so don't bother slowiterating it
		if(inst.skinDepth >= 0) {
			for(var k = 0; k < lowestNeighbor-inst.skinDepth; k++) {
				inst.vox[inst.currX][inst.currY][k] = "skip";
			}
			for(var k = lowestNeighbor-inst.skinDepth; k < currHeight; k++) {
				inst.vox[inst.currX][inst.currY][k] = inst.mainColor;
			}
		} else {
			for(var k = 0; k < currHeight; k++) {
				inst.vox[inst.currX][inst.currY][k] = inst.mainColor;
			}
		}
		if(currHeight >= inst.grassCutoff) {
			for(var k = currHeight; k < Math.min(currHeight+inst.grassDepth, inst.maxZ); k++) {
				inst.vox[inst.currX][inst.currY][k] = inst.grassColor;
			}
			for(var k = currHeight+inst.grassDepth; k < inst.maxZ; k++) {
				inst.vox[inst.currX][inst.currY][k] = "skip";
			}
		} else {
			for(var k = currHeight; k < inst.maxZ; k++) {
				inst.vox[inst.currX][inst.currY][k] = "skip";
			}
		}
		
		inst.currX++;
		if(inst.currX >= inst.maxX) {
			inst.currX = 0;
			inst.currY++;
		}
		return inst.currY >= inst.maxY;
	},{
		RunSpeed: 50,
		MaxExecTime: 40,
		OnStageSetup: function(inst) {
			inst.vox = [];
			for(var i = 0; i < inst.maxX; i++) {
				inst.vox[i] = [];
				for(var j = 0; j < inst.maxY; j++) {
					inst.vox[i][j] = [];
				}
			}
			inst.currX = 0;
			inst.currY = 0;
		},
		OnStagePause: function(inst) {
			return "Voxelizing... " + Math.floor(inst.currY/inst.maxY*100) + "%";
		}
	}),
///// STAGE 5: Cavemap Generation
	new SBG_SlowIterator(function(inst) {
		if(!inst.doCaves) return true;
		
		var i = inst.currX;
		var j = inst.currY;
		var k = inst.currZ;
		
		inst.cavemap[inst.currX][inst.currY][inst.currZ] = 0.5 * (1 + noise.simplex3(
			(inst.currX+inst.posX)/inst.vNoiseResolutionXY,
			(inst.currY+inst.posY)/inst.vNoiseResolutionXY,
			(inst.currZ+inst.posZ)/inst.vNoiseResolutionZ
		));
		
		//"surface tension" - reduce cave generation chance while near surface
		var currHeight = inst.heightmap[inst.currX][inst.currY];
		var surfDist = Math.max(currHeight - inst.currZ, 0);
		if(surfDist <= inst.vNoiseSTR) {
			var STFac = surfDist/inst.vNoiseSTR;
			inst.cavemap[inst.currX][inst.currY][inst.currZ] += (1-STFac) * inst.vNoiseSTS;
		}
		//"floor tension" - same deal but near the bottom of the build to avoid exposing map floor
		if(inst.currZ <= inst.vNoiseBTR) {
			var BTFac = inst.currZ/inst.vNoiseBTR;
			inst.cavemap[inst.currX][inst.currY][inst.currZ] += (1-BTFac) * inst.vNoiseBTS;
		}
		
		
		inst.currZ++;
		if(inst.currZ >= inst.maxZ) {
			inst.currZ=0;
			inst.currY++;
			inst.cavemap[inst.currX][inst.currY] = [];
		}
		if(inst.currY >= inst.maxY) {
			inst.currY=0;
			inst.currX++;
			inst.cavemap[inst.currX] = [[]];
		}
		return inst.currX >= inst.maxX;
	},{
		RunSpeed: 50,
		MaxExecTime: 40,
		Batching: 1000,
		OnStageSetup: function(inst) {
			if(!inst.doCaves) return;
			inst.cavemap = [[[]]];
			inst.currX = 0;
			inst.currY = 0;
			inst.currZ = 0;
		},
		OnStagePause: function(inst) {
			return "Generating cavemap... " + Math.floor(inst.currX/inst.maxX*100) + "%";
		}
	}),
///// STAGE 6: Cave Voxel Mapping/Carving
	new SBG_SlowIterator(function(inst) {
		if(!inst.doCaves) return true;
		var currHeight = Math.floor(inst.heightmap[inst.currX][inst.currY]);
		
		var cap = Math.min(inst.maxZ, currHeight);
		
		for(var k = 0; k < cap; k++) {
			if(inst.cavemap[inst.currX][inst.currY][k] < inst.vNoiseChance)
				inst.vox[inst.currX][inst.currY][k] = "skip";
			else if(inst.skinDepth >= 0 && k < currHeight - inst.skinDepth) { //skin depth is on, generate shell around caves
				var foundNeighbor = false;
				mapLocalIter3(function(val,x,y,z){
					if(val < inst.vNoiseChance) foundNeighbor = true;
				}, inst.cavemap, 1, inst.currX, inst.currY, k, inst.maxX, inst.maxY, inst.maxZ);
				//foundNeighbor is only true if we're not in a cave-carved voxel, BUT one of the adjacent voxels is
				if(foundNeighbor)
					inst.vox[inst.currX][inst.currY][k] = inst.mainColor;
			}
		}
		
		if(inst.cavemap[inst.currX][inst.currY][cap-1] < inst.vNoiseChance) {
			//punch holes in grass
			if(currHeight >= inst.grassCutoff) {
				var cap2 = Math.min(inst.maxZ, currHeight+inst.grassDepth);
				for(var k = cap; k < cap2; k++) {
					inst.vox[inst.currX][inst.currY][k] = "skip";
				}
			}
		} else if(inst.cavePatchDepth > -1) {
			//patch up surface that may have been vertically shredded by near-surface caves
			var lowestNeighbor = cap;
			mapLocalIter2(function(val,x,y,isCenter){
				if(isCenter) return;
				if(inst.cavemap[x][y][Math.max(val-1,0)] >= inst.vNoiseChance) return;
				var nbHeight = Math.floor(val);
				if(nbHeight < lowestNeighbor) lowestNeighbor = nbHeight;
			}, inst.heightmap, 1, inst.currX, inst.currY, inst.maxX, inst.maxY);
			for(var k = lowestNeighbor-inst.cavePatchDepth; k < cap; k++) {
				inst.vox[inst.currX][inst.currY][k] = inst.mainColor;
			}
		}
			
		inst.currX++;
		if(inst.currX >= inst.maxX) {
			inst.currX = 0;
			inst.currY++;
		}
		return inst.currY >= inst.maxY;
	},{
		RunSpeed: 50,
		MaxExecTime: 40,
		Batching: 100,
		OnStageSetup: function(inst) {
			if(!inst.doCaves) return;
			inst.currX = 0;
			inst.currY = 0;
		},
		OnStagePause: function(inst) {
			return "Carving caves... " + Math.floor(inst.currY/inst.maxY*100) + "%";
		}
	}),
///// STAGE 6: Octree Minimization
	SBGSI_OctreeVoxels], {
	Controls: (function() {
		var cObj = {};
		cObj.HelpLabel = $("<span>", {"text":"Mouseover an option box for help with that option."});
		cObj.NoiseOpts = {
			SeedLabel: $("<span>", {"class":"opt-1-4","html":"Seed:"}),
			Seed: $("<input>", {"type":"number", "class":"opt-3-4 opt-input", "value":0, "title": "Seed used to initialize all noise generators. Every chunk of terrain generated with the same seed will use the same set of random values. Note that changing other options (especially may seem to result in different patterns, even with the same seed."}),
			SeedPosLabel: $("<span>", {"class":"opt-1-4","html":"Position:"}),
			SeedPosX: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "value":0, "step":1, "title":"X position of the noise window. Noise generation basically uses a small window overlooking a very large area of potential noise. Use this to move said window around, in order to generate adjacent sections of terrain."}),
			SeedPosY: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "value":0, "step":1, "title":"Y position of the noise window. Noise generation basically uses a small window overlooking a very large area of potential noise. Use this to move said window around, in order to generate adjacent sections of terrain."}),
			SeedPosZ: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "value":0, "step":1, "title":"Z position of the noise window. Noise generation basically uses a small window overlooking a very large area of potential noise. Use this to move said window around, in order to generate adjacent sections of terrain. Z value is only relevant for the cavemap."}),
			SizeLabel: $("<span>", {"class":"opt-1-4","text":"Gen area:"}),
			SizeX: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":1024, "value":64, "step":1, "title":"X size of various terrain maps (height, falloff, cave, voxel). May not be equal to build size!"}),
			SizeY: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":1024, "value":64, "step":1, "title":"Y size of various terrain maps (height, falloff, cave, voxel). May not be equal to build size!"}),
			SizeZ: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":3072, "value":256, "step":1, "title":"Z size of various terrain maps (cave, voxel). May not be equal to build size!"}),
			ResolutionLabel: $("<span>", {"class":"opt-1-2","html":"Heightmap zoom: <span class='hint'>(10<sup>-n</sup>)</span>"}),
			Resolution: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":-4, "max":4, "value":2.2, "step":0.01, "title": "Inverse horizontal scale of the noise window. Higher values = slower change in terrain height. Exponential, change *slowly* (~0.1 at a time)!"}),
			ScaleLabel: $("<span>", {"class":"opt-1-2","html":"Height scale:"}),
			Scale: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":0.01, "max":1024, "value":128, "step":0.01, "title": "Half the maximum height, in voxels, of the heightmap. Increase for taller differences in overall terrain height."}),
			OffsetLabel: $("<span>", {"class":"opt-1-2","html":"Height offset:"}),
			Offset: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":-2048, "max":2048, "value":128, "step":0.01, "title": "Average height of the heightmap. Set to a value near that of 'Height scale', and set 'Gen area' Z to double that value, for best results on normal terrain. Islands may need a lower height offset for better results."}),
			OctavesLabel: $("<span>", {"class":"opt-1-2","html":"Octaves:"}),
			Octaves: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":1, "max":10, "value":3, "step":1, "title": "Number of octaves of noise to generate. More octaves = finer detail: each consecutive octave has double noise frequency, but lower noise scale as determined by 'persistence'."}),
			PersistenceLabel: $("<span>", {"class":"opt-1-2","html":"Persistence:"}),
			Persistence: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":0.001, "max":0.999, "value":0.8, "step":0.001, "title":"Mutiplier for height scale per octave. E.g. at 0.8 persistence, the first octave has 1x height, the second octave has 0.8x height, the third octave has 0.64x (0.8*0.8) height...."})
		};
		cObj.NoiseMaster = $("<button>", {"class":"opt-1-1","text":"Show/Hide: Noise Options"});
		cObj.NoiseContainer = $("<div>", {"class":"controls-subsubpanel","style":"display:none;"});
		for(var i in cObj.NoiseOpts) {
			if(!cObj.NoiseOpts.hasOwnProperty(i)) continue;
			cObj.NoiseContainer.append(cObj.NoiseOpts[i]);
		}
		ParentClickInput(cObj.NoiseMaster, [cObj.NoiseContainer]);
		
		cObj.LayerOpts = {
			GrassDepthLabel: $("<span>", {"class":"opt-1-2","html":"Grass depth:<span class='hint'> 0 = no grass</span>"}),
			GrassDepth: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":0, "max":256, "value":3, "step":0.1, "title": "The number of voxels of grass to generate directly above each voxel of terrain surface."}),
			GrassCutoffLabel: $("<span>", {"class":"opt-1-2","html":"Grass cutoff below:"}),
			GrassCutoff: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":0, "max":256, "value":6, "step":0.1, "title": "Surface voxels below this height will not have grass."}),
			MaxDepthLabel: $("<span>", {"class":"opt-1-2","html":"Skin depth:<span class='hint'> -1 = infinite</span>"}),
			MaxDepth: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":-1, "max":256, "value":-1, "step":1, "title":"If -1, terrain will be generated as one solid mass. If 0, only the terrain surface will be generated, with just enough thickness to prevent gaps. If above 0, that much extra thickness will be added beyond the minimum. Cave walls do not have the latter property, and will always be generated with a thickness of 1 if 'Skin depth' >= 0."})
		};
		cObj.LayerMaster = $("<button>", {"class":"opt-1-1","text":"Show/Hide: Layering Options"});
		cObj.LayerContainer = $("<div>", {"class":"controls-subsubpanel","style":"display:none;"});
		for(var i in cObj.LayerOpts) {
			if(!cObj.LayerOpts.hasOwnProperty(i)) continue;
			cObj.LayerContainer.append(cObj.LayerOpts[i]);
		}
		ParentClickInput(cObj.LayerMaster, [cObj.LayerContainer]);
		
		cObj.FalloffOpts = {
			DoFalloffLabel: $("<span>", {"class":"opt-1-2","html":"Add falloff:"}),
			DoFalloff: $("<span>", {"class":"opt-1-2 cb-container opt-input", "html":"&nbsp;", "title":"If checked, terrain height will be gradually reduced to 0 near the edges using a center-biased Rolling Particle Mask. A number of particles will be generated at random positions within a certain minimum distance from the edges of the falloff map. Per particle, a certain number of times, that particle will a. add 1 to the value of the falloff map at its current location, then b. move to a random adjacent tile that has a lower value than the one it's on."}).append($("<input>", {"type":"checkbox","checked":false})),
			PLifeLabel: $("<span>", {"class":"opt-1-2","html":"Particle lifetime:"}),
			PLife: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":2, "max":200, "value":50, "step":1, "title":"The number of iterations to run for each particle in the Rolling Particle Mask (mouseover 'Add falloff' for overview of this algorithm). Higher values --> smoother falloff map with less effect; lower values --> rough falloff map with extremely small islands."}),
			PCountLabel: $("<span>", {"class":"opt-1-2","html":"Particle density:<span class='hint'> per-pixel</span>"}),
			PCount: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":1, "max":1000, "value":5, "step":1, "title":"The average number of particles to generate per-pixel for the Rolling Particle Mask (mouseover 'Add falloff' for overview of this algorithm). Higher values --> smoother falloff map, with almost no side-effects until extremely high values (which can give the map a faceted appearance)."}),
			EdgeLabel: $("<span>", {"class":"opt-1-2","html":"Padding radius:</span>"}),
			Edge: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":0, "max":256, "value":16, "step":1, "title":"The minimum distance from any edge of the heightmap to generate particles for the Rolling Particle Mask (mouseover 'Add falloff' for overview of this algorithm). Higher values --> smaller islands; lower values --> more sudden cutoff near edges."})
		};
		cObj.FalloffMaster = $("<button>", {"class":"opt-1-1","text":"Show/Hide: Island Falloff Options"});
		cObj.FalloffContainer = $("<div>", {"class":"controls-subsubpanel","style":"display:none;"});
		for(var i in cObj.FalloffOpts) {
			if(!cObj.FalloffOpts.hasOwnProperty(i)) continue;
			cObj.FalloffContainer.append(cObj.FalloffOpts[i]);
		}
		ParentClickInput(cObj.FalloffMaster, [cObj.FalloffContainer]);
		
		cObj.CavesOpts = {
			DoCavesLabel: $("<span>", {"class":"opt-1-2","html":"Add caves:"}),
			DoCaves: $("<span>", {"class":"opt-1-2 cb-container opt-input", "html":"&nbsp;"}).append($("<input>", {"type":"checkbox","checked":false})),
			CaveResolutionXYLabel: $("<span>", {"class":"opt-1-2","html":"Cave XY zoom: <span class='hint'>(10<sup>-n</sup>)</span>"}),
			CaveResolutionXY: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":-4, "max":4, "value":1.3, "step":0.01}),
			CaveResolutionZLabel: $("<span>", {"class":"opt-1-2","html":"Cave Z zoom: <span class='hint'>(10<sup>-n</sup>)</span>"}),
			CaveResolutionZ: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":-4, "max":4, "value":2, "step":0.01}),
			CavePercentLabel: $("<span>", {"class":"opt-1-2","html":"Cave ratio: <span class='hint'>0 = no caves</span>"}),
			CavePercent: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":0, "max":1, "value":0.4, "step":0.01}),
			CaveSTRadiusLabel: $("<span>", {"class":"opt-1-2","html":"Surf. tens. radius:"}),
			CaveSTRadius: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":0, "max":64, "value":8, "step":1}),
			CaveSTStrengthLabel: $("<span>", {"class":"opt-1-2","html":"Surf. tens. strength:"}),
			CaveSTStrength: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":0, "max":1, "value":0.25, "step":0.01}),
			CaveBTRadiusLabel: $("<span>", {"class":"opt-1-2","html":"Floor tens. radius:"}),
			CaveBTRadius: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":0, "max":64, "value":8, "step":1}),
			CaveBTStrengthLabel: $("<span>", {"class":"opt-1-2","html":"Floor tens. strength:"}),
			CaveBTStrength: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":0, "max":1, "value":0.4, "step":0.01}),
			CavePatchDepthLabel: $("<span>", {"class":"opt-1-2","html":"Surf. patch:<span class='hint'> -1 = none</span>"}),
			CavePatchDepth: $("<input>", {"type":"number", "class":"opt-1-2 opt-input", "min":-1, "max":16, "value":1, "step":1})
		};
		cObj.CavesMaster = $("<button>", {"class":"opt-1-1","text":"Show/Hide: Cave Options"});
		cObj.CavesContainer = $("<div>", {"class":"controls-subsubpanel","style":"display:none;"});
		for(var i in cObj.CavesOpts) {
			if(!cObj.CavesOpts.hasOwnProperty(i)) continue;
			cObj.CavesContainer.append(cObj.CavesOpts[i]);
		}
		ParentClickInput(cObj.CavesMaster, [cObj.CavesContainer]);
		
		cObj.VoxelOpts = {
			ModeLabel: $("<span>", {"class":"opt-1-2","text":"Irregular splits:"}),
			Mode: $("<span>", {"class":"opt-1-2 cb-container opt-input", "html":"&nbsp;"}).append($("<input>", {"type":"checkbox","checked":true}))
		};
		cObj.VoxelMaster = $("<button>", {"class":"opt-1-1","text":"Show/Hide: Voxelization Options"});
		cObj.VoxelContainer = $("<div>", {"class":"controls-subsubpanel","style":"display:none;"});
		for(var i in cObj.VoxelOpts) {
			if(!cObj.VoxelOpts.hasOwnProperty(i)) continue;
			cObj.VoxelContainer.append(cObj.VoxelOpts[i]);
		}
		ParentClickInput(cObj.VoxelMaster, [cObj.VoxelContainer]);
		
		cObj.BrickOpts = {
			ScaleLabel: $("<span>", {"class":"opt-1-4","html":"Scale: <span class='hint'>Z in f's</span>"}),
			ScaleX: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":16, "value":4, "step":1}),
			ScaleY: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":16, "value":4, "step":1}),
			ScaleZ: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":48, "value":1, "step":1}),
			LimLabel: $("<span>", {"class":"opt-1-4","html":"Limit: <span class='hint'>Z in f's</span>"}),
			LimX: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":204, "value":128, "step":1}),
			LimY: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":204, "value":128, "step":1}),
			LimZ: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":511, "value":128, "step":1}),
			ColorLabel: $("<span>", {"class":"opt-1-4","text":"Dirt color:"}),
			ColorR: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":0.4, "step":0.001}),
			ColorG: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":0.3, "step":0.001}),
			ColorB: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":0.2, "step":0.001}),
			GColorLabel: $("<span>", {"class":"opt-1-4","text":"Grass color:"}),
			GColorR: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":0.1, "step":0.001}),
			GColorG: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":0.7, "step":0.001}),
			GColorB: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":0.2, "step":0.001})
		};
		cObj.BrickMaster = $("<button>", {"class":"opt-1-1","text":"Show/Hide: Brick Options"});
		cObj.BrickContainer = $("<div>", {"class":"controls-subsubpanel","style":"display:none;"});
		for(var i in cObj.BrickOpts) {
			if(!cObj.BrickOpts.hasOwnProperty(i)) continue;
			cObj.BrickContainer.append(cObj.BrickOpts[i]);
		}
		ParentClickInput(cObj.BrickMaster, [cObj.BrickContainer]);
		
		return cObj;
	})(),
	OnSetup: function(inst) {
		inst.maxX = this.controls.NoiseOpts.SizeX.val()*1;
		inst.maxY = this.controls.NoiseOpts.SizeY.val()*1;
		inst.maxZ = this.controls.NoiseOpts.SizeZ.val()*1;
		
		inst.mainColor = [this.controls.BrickOpts.ColorR.val()*1, this.controls.BrickOpts.ColorG.val()*1, this.controls.BrickOpts.ColorB.val()*1, 1.0];
		inst.grassColor = [this.controls.BrickOpts.GColorR.val()*1, this.controls.BrickOpts.GColorG.val()*1, this.controls.BrickOpts.GColorB.val()*1, 1.0];
		inst.grassDepth = this.controls.LayerOpts.GrassDepth.val()*1;
		inst.skinDepth = this.controls.LayerOpts.MaxDepth.val()*1;
		inst.cavePatchDepth = this.controls.CavesOpts.CavePatchDepth.val()*1;
		
		inst.posX = this.controls.NoiseOpts.SeedPosX.val()*1;
		inst.posY = this.controls.NoiseOpts.SeedPosY.val()*1;
		inst.posZ = this.controls.NoiseOpts.SeedPosZ.val()*1;
		
		inst.hNoiseOctaves = this.controls.NoiseOpts.Octaves.val()*1;
		inst.hNoisePersistence = this.controls.NoiseOpts.Persistence.val()*1;
		inst.hNoiseScale = this.controls.NoiseOpts.Scale.val()*1;
		inst.hNoiseOffset = this.controls.NoiseOpts.Offset.val()*1;
		inst.hNoiseResolution = Math.pow(10, this.controls.NoiseOpts.Resolution.val()*1);
		inst.vNoiseResolutionXY = Math.pow(10, this.controls.CavesOpts.CaveResolutionXY.val()*1);
		inst.vNoiseResolutionZ = Math.pow(10, this.controls.CavesOpts.CaveResolutionZ.val()*1);
		inst.vNoiseChance = this.controls.CavesOpts.CavePercent.val()*1;
		inst.vNoiseSTR = this.controls.CavesOpts.CaveSTRadius.val()*1;
		inst.vNoiseSTS = this.controls.CavesOpts.CaveSTStrength.val()*1;
		inst.vNoiseBTR = this.controls.CavesOpts.CaveBTRadius.val()*1;
		inst.vNoiseBTS = this.controls.CavesOpts.CaveBTStrength.val()*1;
		
		inst.grassCutoff = this.controls.LayerOpts.GrassCutoff.val()*1;
		
		inst.doCaves = this.controls.CavesOpts.DoCaves.find('input').get(0).checked;
		
		inst.octreeScale = [this.controls.BrickOpts.ScaleX.val()*1,this.controls.BrickOpts.ScaleY.val()*1,this.controls.BrickOpts.ScaleZ.val()*1];
		inst.octreeSizeLimit = [this.controls.BrickOpts.LimX.val()*1,this.controls.BrickOpts.LimY.val()*1,this.controls.BrickOpts.LimZ.val()*1];
		//todo: hard clamp this to maximum? bad values are allowed for most inputs just to see what happens, but loading bricks higher than a certain size crashes brickadia
		//max octreeSizeLimit = [204, 204, 511];
		inst.octreeIrregular = this.controls.VoxelOpts.Mode.find('input').get(0).checked;
		
		inst.doFalloff = this.controls.FalloffOpts.DoFalloff.find('input').get(0).checked;
		inst.falloffLife = this.controls.FalloffOpts.PLife.val()*1;
		inst.falloffCount = this.controls.FalloffOpts.PCount.val()*1;
		inst.falloffEdge = this.controls.FalloffOpts.Edge.val()*1;
		
		noise.seed(this.controls.NoiseOpts.Seed.val()*1);
		inst.prng = new Math.seedrandom(this.controls.NoiseOpts.Seed.val()*1);
	},
	Description: "Generates grassed terrain based on simplex noise, with reduced brickcount through the magic of octrees."
});
var o = new Option(GenName, GenName);
$(o).html(GenName);
$("#generator-type").append(o);
Generators[GenName].OptionElement = o;