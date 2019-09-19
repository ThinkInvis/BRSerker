var GenName = "BrickShifter";

Generators[GenName] = new StagedBrickGenerator(GenName, [new SBG_SlowIterator(function(inst) {
	var tb = inst.bricks[inst.currI];
	
	inst.bricks[inst.currI].Position.x += inst.mvX;
	inst.bricks[inst.currI].Position.y += inst.mvY;
	inst.bricks[inst.currI].Position.z += inst.mvZ;
	
	inst.currI++;
	return inst.currI == inst.maxI;
}, {
	RunSpeed: 50,
	MaxExecTime: 40,
	OnStagePause: function(inst) {
		return "Shifting bricks... " + inst.currI + "/" + inst.maxI;
	}
})], {
	Controls: {},
	OnSetup: function(inst) {
		inst.bricks = inst.callerParams.BrickList;
		
		if(inst.bricks.length == 0) {
			inst.abort = "No bricks to shift";
			return;
		}
		
		inst.mvX = inst.callerParams.X || 0;
		inst.mvY = inst.callerParams.Y || 0;
		inst.mvZ = inst.callerParams.Z || 0;
		
		inst.currI = 0;
		inst.maxI = inst.bricks.length;
	}
});



var GenName = "BuildMirrorer";

Generators[GenName] = new StagedBrickGenerator(GenName, [new SBG_SlowIterator(function(inst) {
	var currBrick = inst.bricks[inst.currI];
	
	//TODO: mirror brick type (e.g. corner ramps)
	//can rotating simulate that?
	
	if(inst.mirrX) {
		currBrick.Position.x = -currBrick.Position.x;
		if(currBrick.FacingIndex == 2) currBrick.FacingIndex = 3;
		else if(currBrick.FacingIndex == 3) currBrick.FacingIndex = 2;
		var nri = currBrick.RotationIndex;
		if(nri == 1 || nri == 3) nri += 2;
		currBrick.RotationIndex = nri;
	}
	currBrick.RotationIndex = Mod(currBrick.RotationIndex, 4);
	if(inst.mirrY) {
		currBrick.Position.y = -currBrick.Position.y;
		var nri = currBrick.RotationIndex;
		var fi = currBrick.FacingIndex;
		if(fi == 0) currBrick.FacingIndex = 1;
		else if(fi == 1) currBrick.FacingIndex = 0;
		
		if((fi == 4 || fi == 5) && (nri == 0 || nri == 2)) currBrick.RotationIndex += 2;
		else if((fi != 4 && fi != 5) && (nri == 1 || nri == 3)) currBrick.RotationIndex += 2;
	}
	currBrick.RotationIndex = Mod(currBrick.RotationIndex, 4);
	if(inst.mirrZ) {
		currBrick.Position.z = -currBrick.Position.z;
		var nri = currBrick.RotationIndex;
		var fi = currBrick.FacingIndex;
		if(fi == 4) currBrick.FacingIndex = 5;
		else if(fi == 5) currBrick.FacingIndex = 4;
		
		if(nri == 0 || nri == 2)
			currBrick.RotationIndex += 2;
		if(currBrick.IntRef == "RampCorner")
			currBrick.RotationIndex --; //why are corners weird :(
	}
	currBrick.RotationIndex = Mod(currBrick.RotationIndex, 4);
	
	inst.currI++;
	return inst.currI == inst.maxI;
}, {
	RunSpeed: 50,
	MaxExecTime: 40,
	OnStagePause: function(inst) {
		return "Mirroring bricks... " + inst.currI + "/" + inst.maxI;
	}
})], {
	Controls: {},
	OnSetup: function(inst) {
		inst.bricks = inst.callerParams.BrickList;
		
		if(inst.bricks.length == 0) {
			inst.abort = "No bricks to mirror";
			return;
		}
		
		inst.mirrX = inst.callerParams.X || false;
		inst.mirrY = inst.callerParams.Y || false;
		inst.mirrZ = inst.callerParams.Z || false;
		
		inst.currI = 0;
		inst.maxI = inst.bricks.length;
	}
});



var GenName = "BuildRotator";

Generators[GenName] = new StagedBrickGenerator(GenName, [new SBG_SlowIterator(function(inst) {
	var currBrick = inst.bricks[inst.currI];
	
	if(inst.rotX == 1) {
		if(currBrick.FacingIndex == 2) currBrick.RotationIndex --;
		else if(currBrick.FacingIndex == 3) currBrick.RotationIndex ++;
		else {
			currBrick.RotationIndex -= 2;
			if(currBrick.FacingIndex == 4) currBrick.FacingIndex = 1;
			else if(currBrick.FacingIndex == 0) currBrick.FacingIndex = 4;
			else if(currBrick.FacingIndex == 5) currBrick.FacingIndex = 0;
			else if(currBrick.FacingIndex == 1) currBrick.FacingIndex = 5;
		}
		var px = currBrick.Position.z;
		currBrick.Position.z = currBrick.Position.y*3;
		currBrick.Position.y = -px/3;
	}
	currBrick.RotationIndex = Mod(currBrick.RotationIndex, 4);
	if(inst.rotY == 1) {
		if(currBrick.FacingIndex == 0) currBrick.RotationIndex ++;
		else if(currBrick.FacingIndex == 1) currBrick.RotationIndex --;
		else {
			currBrick.RotationIndex--;
			if(currBrick.FacingIndex == 4) currBrick.FacingIndex = 3;
			else if(currBrick.FacingIndex == 2) currBrick.FacingIndex = 4;
			else if(currBrick.FacingIndex == 5) currBrick.FacingIndex = 2;
			else if(currBrick.FacingIndex == 3) currBrick.FacingIndex = 5;
		}
		var px = currBrick.Position.z;
		currBrick.Position.z = currBrick.Position.x*3;
		currBrick.Position.x = -px/3;
	}
	currBrick.RotationIndex = Mod(currBrick.RotationIndex, 4);
	if(inst.rotZ == 1) {
		if(currBrick.FacingIndex == 4) currBrick.RotationIndex --;
		else if(currBrick.FacingIndex == 5) currBrick.RotationIndex ++;
		else if(currBrick.FacingIndex == 0) currBrick.FacingIndex = 3;
		else if(currBrick.FacingIndex == 3) currBrick.FacingIndex = 1;
		else if(currBrick.FacingIndex == 1) currBrick.FacingIndex = 2;
		else if(currBrick.FacingIndex == 2) currBrick.FacingIndex = 0;
		var px = currBrick.Position.y;
		currBrick.Position.y = currBrick.Position.x;
		currBrick.Position.x = -px;
	}
	currBrick.RotationIndex = Mod(currBrick.RotationIndex, 4);
	if(inst.rotX == -1) {
		if(currBrick.FacingIndex == 2) currBrick.RotationIndex ++;
		else if(currBrick.FacingIndex == 3) currBrick.RotationIndex --;
		else {
			currBrick.RotationIndex += 2;
			if(currBrick.FacingIndex == 4) currBrick.FacingIndex = 0;
			else if(currBrick.FacingIndex == 0) currBrick.FacingIndex = 5;
			else if(currBrick.FacingIndex == 5) currBrick.FacingIndex = 1;
			else if(currBrick.FacingIndex == 1) currBrick.FacingIndex = 4;
		}
		var px = currBrick.Position.z;
		currBrick.Position.z = -currBrick.Position.y*3;
		currBrick.Position.y = px/3;
	}
	currBrick.RotationIndex = Mod(currBrick.RotationIndex, 4);
	if(inst.rotY == -1) {
		if(currBrick.FacingIndex == 0) currBrick.RotationIndex --;
		else if(currBrick.FacingIndex == 1) currBrick.RotationIndex ++;
		else {
			currBrick.RotationIndex++;
			if(currBrick.FacingIndex == 4) currBrick.FacingIndex = 2;
			else if(currBrick.FacingIndex == 2) currBrick.FacingIndex = 5;
			else if(currBrick.FacingIndex == 5) currBrick.FacingIndex = 3;
			else if(currBrick.FacingIndex == 3) currBrick.FacingIndex = 4;
		}
		var px = currBrick.Position.z;
		currBrick.Position.z = -currBrick.Position.x*3;
		currBrick.Position.x = px/3;
	}
	currBrick.RotationIndex = Mod(currBrick.RotationIndex, 4);
	if(inst.rotZ == -1) {
		if(currBrick.FacingIndex == 4) currBrick.RotationIndex ++;
		else if(currBrick.FacingIndex == 5) currBrick.RotationIndex --;
		else if(currBrick.FacingIndex == 0) currBrick.FacingIndex = 2;
		else if(currBrick.FacingIndex == 2) currBrick.FacingIndex = 1;
		else if(currBrick.FacingIndex == 1) currBrick.FacingIndex = 3;
		else if(currBrick.FacingIndex == 3) currBrick.FacingIndex = 0;
		var px = currBrick.Position.y;
		currBrick.Position.y = -currBrick.Position.x;
		currBrick.Position.x = px;
	}
	currBrick.RotationIndex = Mod(currBrick.RotationIndex, 4);
	
	inst.currI++;
	return inst.currI == inst.maxI;
}, {
	RunSpeed: 50,
	MaxExecTime: 40,
	OnStagePause: function(inst) {
		return "Rotating bricks... " + inst.currI + "/" + inst.maxI;
	}
})], {
	Controls: {},
	OnSetup: function(inst) {
		inst.bricks = inst.callerParams.BrickList;
		
		if(inst.bricks.length == 0) {
			inst.abort = "No bricks to rotate";
			return;
		}
		
		inst.rotX = inst.callerParams.X || 0;
		inst.rotY = inst.callerParams.Y || 0;
		inst.rotZ = inst.callerParams.Z || 0;
		
		inst.currI = 0;
		inst.maxI = inst.bricks.length;
	}
});