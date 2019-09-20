//Expects 'inst' to have a 3D array 'vox', whose values are each either an RGBA color array or the string "skip"
//If 'inst.octreeIrregular' is set to 'true', splits can happen anywhere (can be more efficient than center); otherwise, splits only happen directly at the center of the leaf
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
		if((c1 != "skip" || c2 != "skip") && (c1[0] != c2[0] || c1[1] != c2[1] || c1[2] != c2[2])) { 
			//color mismatch, split the leaf and restart (todo: can we just resume instead?)
			var x0 = leaf.minX;
			var y0 = leaf.minY;
			var z0 = leaf.minZ;
			var x2 = leaf.maxX;
			var y2 = leaf.maxY;
			var z2 = leaf.maxZ
			
			var x1, y1, z1;
			if(inst.octreeIrregular) {
				x1 = i;
				y1 = j;
				z1 = k;
			} else {
				x1 = Math.floor((x2+x0)/2);
				y1 = Math.floor((y2+y0)/2);
				y2 = Math.floor((y2+y0)/2);
			}
			
			inst.leaves.shift();
			
			var pairs = [[x0,y0,z0,x1,y1,z1],[x0,y1,z0,x1,y2,z1],[x1,y0,z0,x2,y1,z1],[x1,y1,z0,x2,y2,z1],[x0,y0,z1,x1,y1,z2],[x0,y1,z1,x1,y2,z2],[x1,y0,z1,x2,y1,z2],[x1,y1,z1,x2,y2,z2],];
			
			for(var w = 0; w < pairs.length; w++) {
				var p = pairs[w];
				if(p[3]-p[0] > 0 && p[4]-p[1] > 0 && p[5]-p[2] > 0)
				inst.leaves.push({
					minX: p[0],
					maxX: p[3],
					minY: p[1],
					maxY: p[4],
					minZ: p[2],
					maxZ: p[5],
					refV: inst.vox[p[0]][p[1]][p[2]]
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
			j = leaf.minY;
			k++;
		}
		if(k >= leaf.maxZ) {
			wGo = false;
		}
	}
	
	inst.leaves.shift();
	
	if(leaf.refV != "skip") {
		var brickPos = new THREE.Vector3(leaf.minX, leaf.minY, leaf.minZ*3);
		var brickSize = new THREE.Vector3(leaf.maxX-leaf.minX, leaf.maxY-leaf.minY, (leaf.maxZ-leaf.minZ)*3);
	
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
		
		inst.leaves = [{
			minX: 0,
			minY: 0,
			minZ: 0,
			maxX: inst.maxX,
			maxY: inst.maxY,
			maxZ: inst.maxZ,
			refV: inst.vox[0][0][0]
		}];
	},
	OnStagePause: function(inst) {
		return "Building model... processing " + (inst.leaves.length) + " leaves";
	}
});
