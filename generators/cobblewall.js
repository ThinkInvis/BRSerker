var GenName = "CobbleWall";
var GenDisplayName = "CobbleWall";
var GenCategory = "Procedural Generation";

var NewGen = new StagedBrickGenerator(GenName, [new SBG_SlowIterator(function(inst) {
		var sizeLeft = inst.MaxX - inst.X;
		
		var newSize = THREE.Math.randInt(inst.RndMin, inst.RndMax);
		if(newSize > sizeLeft) newSize = sizeLeft;
		
		var ncH = Mod(inst.HBasis + THREE.Math.randFloat(-inst.HVar/2, inst.HVar/2), 1);
		var ncS = THREE.Math.clamp(inst.SBasis + THREE.Math.randFloat(-inst.SVar/2, inst.SVar/2), 0, 1);
		var ncV = THREE.Math.clamp(inst.VBasis + THREE.Math.randFloat(-inst.VVar/2, inst.VVar/2), 0, 1);
		var ncRgb = hsvToRgb(ncH, ncS, ncV);
		var ncq = ColorQuantize([ncRgb[0]/255,ncRgb[1]/255,ncRgb[2]/255, 1.0], brsColorsetRGB).Color;
		var newColor = new THREE.Color(ncq[0], ncq[1], ncq[2]);
		
		var brk = new InternalBrick(
			new THREE.Vector3(newSize, 1, 1),
			new THREE.Vector3(inst.X, 0, inst.Z),
			0,
			newColor,
			0,
			{
				InternalName: "Basic"
			}
		).AutoOffset();
		inst.brickBuffer.push(brk);
		
		inst.X += newSize;
		if(inst.X >= inst.MaxX) {
			inst.X = 0;
			inst.Z += 1;
		}
		return inst.Z == inst.MaxZ;
	}, {
		RunSpeed: 50,
		MaxExecTime: 40,
		OnStagePause: function(inst) {
			return "CobbleWall " + Math.floor((inst.MaxX * inst.Z + inst.X)/(inst.MaxZ * inst.MaxX)*100) + "%";
		}
	})
], {
	Controls: {
		WidthLabel: $("<span class='opt-2-4'>Width/Height:</span>"),
		Width: $("<input>", {"type": "number", "min": 1, "max": 64, "value": 8, "step": 1, "class": "opt-1-4 opt-input"}),
		Height: $("<input>", {"type": "number", "min": 1, "max": 64, "value": 18, "step": 1, "class": "opt-1-4 opt-input"}),
		BrickLabel: $("<span class='opt-2-4'>Brick size (min, max):</span>"),
		MinBrick: $("<input>", {"type": "number", "step": 1, "class": "opt-1-4 opt-input"}),
		MaxBrick: $("<input>", {"type": "number", "step": 1, "class": "opt-1-4 opt-input"}),
		ColorHLabel: $("<span class='opt-2-4'>Hue (basis, var):</span>"),
		BaseColorH: $("<input>", {"type": "number", "min": 0, "max": 1, "value": 0, "step": 0.01, "class": "opt-1-4 opt-input"}),
		VarColorH: $("<input>", {"type": "number", "min": 0, "max": 1, "value": 0, "step": 0.01, "class": "opt-1-4 opt-input"}),
		ColorSLabel: $("<span class='opt-2-4'>Sat (basis, var):</span>"),
		BaseColorS: $("<input>", {"type": "number", "min": 0, "max": 1, "value": 0, "step": 0.01, "class": "opt-1-4 opt-input"}),
		VarColorS: $("<input>", {"type": "number", "min": 0, "max": 1, "value": 0, "step": 0.01, "class": "opt-1-4 opt-input"}),
		ColorVLabel: $("<span class='opt-2-4'>Val (basis, var):</span>"),
		BaseColorV: $("<input>", {"type": "number", "min": 0, "max": 1, "value": 0.4, "step": 0.01, "class": "opt-1-4 opt-input"}),
		VarColorV: $("<input>", {"type": "number", "min": 0, "max": 1, "value": 0.2, "step": 0.01, "class": "opt-1-4 opt-input"})
	},
	OnSetup: function(inst) {
		inst.X = 0;
		inst.Z = 0;
		
		inst.MaxX = this.controls.Width.val()*1;
		inst.MaxZ = this.controls.Height.val()*1;
		
		inst.RndMin = this.controls.MinBrick.val()*1;
		inst.RndMax = this.controls.MaxBrick.val()*1;
		
		inst.HBasis = this.controls.BaseColorH.val()*1;
		inst.HVar = this.controls.VarColorH.val()*1;
		inst.SBasis = this.controls.BaseColorS.val()*1;
		inst.SVar = this.controls.VarColorS.val()*1;
		inst.VBasis = this.controls.BaseColorV.val()*1;
		inst.VVar = this.controls.VarColorV.val()*1;
	},
	Description: "Generates random walls designed to look like cobblestone or slate."
});

LinkNumInputs(NewGen.controls.MinBrick, NewGen.controls.MaxBrick, 1, 10, 1, 6);

RegisterGenerator(NewGen, GenDisplayName, GenName, GenCategory);