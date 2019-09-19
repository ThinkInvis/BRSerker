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