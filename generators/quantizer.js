var GenName = "ModColorQuantize";
var GenDisplayName = "Color Quantize";
var GenCategory = "Modifiers";

var NewGen = new StagedBrickGenerator(GenName, [new SBG_SlowIterator(function(inst) {
	var tb = inst.bricks[inst.currI];
	
	var tbc = [tb.Color.r, tb.Color.g, tb.Color.b, 1.0]; //TODO: handle alpha
	
	var ncl;
	switch(inst.quantmode) {
		case "post":
			ncl = [
				Math.round(tbc[0]*inst.postR)/inst.postR,
				Math.round(tbc[1]*inst.postG)/inst.postG,
				Math.round(tbc[2]*inst.postB)/inst.postB,
				Math.round(tbc[3]*inst.postA)/inst.postA,
			];
			break;
		case "brs":
			ncl = ColorQuantize(tbc, brsColorsetRGB).Color;
			break;
		case "bls":
			ncl = ColorQuantize(tbc, blsColorsetRGB).Color;
			break;
		default:
		case "none":
			ncl = tbc;
	}
	
	tb.Color.r = ncl[0];
	tb.Color.g = ncl[1];
	tb.Color.b = ncl[2];
	
	inst.currI++;
	return inst.currI == inst.maxI;
}, {
	RunSpeed: 50,
	MaxExecTime: 40,
	Batching: 100,
	OnStagePause: function(inst) {
		return "Color-quantizing build... " + inst.currI + "/" + inst.maxI;
	}
})], {
	Controls: {
		QuantizeLabel: $("<span>", {"class":"opt-1-2","text":"Color Quantize:"}),
		Quantize: $("<select class='opt-1-2 opt-input'><option value='none'>None</option><option value='brs' selected>BR Default</option><option value='bls'>BL Default</option><option value='post'>Posterize</option></select>"),
		PosterizeLabelX: $("<span>", {"class":"opt-2-4","text":"- Posterize level:","style":"display:none"}),
		PosterizeR: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":16, "value":4, "step":1, "style":"display:none"}),
		PosterizeG: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":16, "value":4, "step":1, "style":"display:none"}),
		PosterizeLabelY: $("<span>", {"class":"opt-2-4 hint","html":"&nbsp;&nbsp;&nbsp;RG/BA stages","style":"display:none"}),
		PosterizeB: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":16, "value":4, "step":1, "style":"display:none"}),
		PosterizeA: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":1, "max":16, "value":4, "step":1, "style":"display:none"})
	},
	OnSetup: function(inst) {
		inst.bricks = inst.callerParams.BrickList;
		
		if(inst.bricks.length == 0) {
			inst.abort = "No bricks to modify";
			return;
		}
		
		inst.quantmode = this.controls.Quantize.val();
		inst.postR = this.controls.PosterizeR.val();
		inst.postG = this.controls.PosterizeG.val();
		inst.postB = this.controls.PosterizeB.val();
		inst.postA = this.controls.PosterizeA.val();
		
		inst.currI = 0;
		inst.maxI = inst.bricks.length;
	},
	Description: "Limits the colors of the entire build to a colorset, matching existing colors roughly to their closest (to a human) counterparts in the colorset."
});

RegisterGenerator(NewGen, GenDisplayName, GenName, GenCategory);