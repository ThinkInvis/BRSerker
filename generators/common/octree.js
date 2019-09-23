//Expects 'inst.vox' to be a 3D array whose values are each either an RGBA+bricktype+brickrot array (full cell with that color and bricktype/rotation) or the string "skip" (empty cell)
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
		if(((c1 != "skip" || c2 != "skip") && (c1[0] != c2[0] || c1[1] != c2[1] || c1[2] != c2[2] || c1[4] != c2[4] || c1[5] != c2[5]))
	     || isTooBig) {
			//color mismatch or brick is too big, split the leaf and restart (todo: can we just resume instead?)
			//todo: is running size check in a second pass better? seems like current approach splits things up early, but that may be beneficial sometimes
			var x0 = leaf.minX;
			var y0 = leaf.minY;
			var z0 = leaf.minZ;
			var x2 = leaf.maxX;
			var y2 = leaf.maxY;
			var z2 = leaf.maxZ;
			
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
			leaf.refV[4],
			new THREE.Color(leaf.refV[0], leaf.refV[1], leaf.refV[2], leaf.refV[3]),
			0,
			{
				InternalName: leaf.refV[5]
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