var GenName = "Flagstone";
var GenDisplayName = "Flagstone";
var GenCategory = "Procedural Generation";

var NewGen = new StagedBrickGenerator(GenName, [new SBG_SlowIterator(function(inst) {
		var sizeLeft = inst.MaxX - inst.X;
		
		var nSzF = THREE.Math.randInt(0, 1) == 0;
		var nSzX = nSzF ? inst.Sizes[inst.currT][0] : inst.Sizes[inst.currT][1];
		var nSzY = nSzF ? inst.Sizes[inst.currT][1] : inst.Sizes[inst.currT][0];
		
		/*var hXm = Math.floor(nSzX/2);
		var hXp = nSzX-hXm;
		
		var hYm = Math.floor(nSzY/2);
		var hYp = nSzY-hYm;*/
		
		var nPX = THREE.Math.randInt(0,inst.MaxX-nSzX);
		var nPY = THREE.Math.randInt(0,inst.MaxY-nSzY);
		
		//inst.cells
		
		var found = false;
		for(var i = nPX; i < nPX + nSzX; i++) {
			for(var j = nPY; j < nPY + nSzY; j++) {
				if(inst.cells[i][j]) {
					found = true;
					break;
				}
			}
		}
		
		if(!found) {
			for(var i = nPX; i < nPX + nSzX; i++) {
				for(var j = nPY; j < nPY + nSzY; j++) {
					inst.cells[i][j] = true;
				}
			}
		
			var ncH = Mod(inst.HBasis + THREE.Math.randFloat(-inst.HVar/2, inst.HVar/2), 1);
			var ncS = THREE.Math.clamp(inst.SBasis + THREE.Math.randFloat(-inst.SVar/2, inst.SVar/2), 0, 1);
			var ncV = THREE.Math.clamp(inst.VBasis + THREE.Math.randFloat(-inst.VVar/2, inst.VVar/2), 0, 1);
			var ncRgb = hsvToRgb(ncH, ncS, ncV);
			var newColor = new THREE.Color(ncRgb[0]/255, ncRgb[1]/255, ncRgb[2]/255);
			
			var brk = new InternalBrick(
				new THREE.Vector3(nSzX, nSzY, 1),
				new THREE.Vector3(nPX, nPY, 0),
				0,
				newColor,
				0,
				{
					InternalName: "Tile"
				}
			).AutoOffset();
			inst.brickBuffer.push(brk);
		}
		
		inst.currI ++;
		if(inst.currI >= inst.NumTries[inst.currT]) {
			inst.currI = 0;
			inst.currT += 1;
		}
		return inst.currT == inst.NumTries.length;
	}, {
		RunSpeed: 50,
		MaxExecTime: 40,
		Batching: 100,
		OnStagePause: function(inst) {
			return "Flagstone " + pctDone(inst.currT, inst.NumTries.length);
		},
		OnStageFinalize: function(inst) {
			for(var i = 0; i < inst.MaxX; i++) {
				for(var j = 0; j < inst.MaxY; j++) {
					if(!inst.cells[i][j]) {
						var ncH = Mod(inst.HBasis + THREE.Math.randFloat(-inst.HVar/2, inst.HVar/2), 1);
						var ncS = THREE.Math.clamp(inst.SBasis + THREE.Math.randFloat(-inst.SVar/2, inst.SVar/2), 0, 1);
						var ncV = THREE.Math.clamp(inst.VBasis + THREE.Math.randFloat(-inst.VVar/2, inst.VVar/2), 0, 1);
						var ncRgb = hsvToRgb(ncH, ncS, ncV);
						var newColor = new THREE.Color(ncRgb[0]/255, ncRgb[1]/255, ncRgb[2]/255);
						
						var brk = new InternalBrick(
							new THREE.Vector3(1, 1, 1),
							new THREE.Vector3(i, j, 0),
							0,
							newColor,
							0,
							{
								InternalName: "Basic"
							}
						).AutoOffset();
						inst.brickBuffer.push(brk);
					}
				}
			}
		}
	})
], {
	Controls: {
		WidthLabel: $("<span class='opt-2-4'>Width/Height:</span>"),
		Width: $("<input>", {"type": "number", "min": 1, "max": 512, "value": 64, "step": 1, "class": "opt-1-4 opt-input"}),
		Height: $("<input>", {"type": "number", "min": 1, "max": 512, "value": 64, "step": 1, "class": "opt-1-4 opt-input"}),
		HintLabel1: $("<span class='opt-1-1'>Brick sizes are 4x,3x,2x3,2x2,1x3</span>"),
		HintLabel2: $("<span class='opt-1-1'># tries/area (^2)</span>"),
		NT1: $("<input>", {"type": "number", "min": -6, "max": 6, "value": -2, "step": 0.01, "class": "opt-1-1 opt-input"}),
		NT2: $("<input>", {"type": "number", "min": -6, "max": 6, "value": -1.6, "step": 0.01, "class": "opt-1-1 opt-input"}),
		NT3: $("<input>", {"type": "number", "min": -6, "max": 6, "value": -1.2, "step": 0.01, "class": "opt-1-1 opt-input"}),
		NT4: $("<input>", {"type": "number", "min": -6, "max": 6, "value": -0.6, "step": 0.01, "class": "opt-1-1 opt-input"}),
		NT5: $("<input>", {"type": "number", "min": -6, "max": 6, "value": -0.2, "step": 0.01, "class": "opt-1-1 opt-input"}),
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
		inst.currI = 0;
		inst.currT = 0;
		
		inst.MaxX = this.controls.Width.val()*1;
		inst.MaxY = this.controls.Height.val()*1;
		
		inst.NumTries = [
			Math.pow(2,this.controls.NT1.val()*1)*inst.MaxX*inst.MaxY,
			Math.pow(2,this.controls.NT2.val()*1)*inst.MaxX*inst.MaxY,
			Math.pow(2,this.controls.NT3.val()*1)*inst.MaxX*inst.MaxY,
			Math.pow(2,this.controls.NT4.val()*1)*inst.MaxX*inst.MaxY,
			Math.pow(2,this.controls.NT5.val()*1)*inst.MaxX*inst.MaxY
		];
		console.log(inst.NumTries);
		inst.Sizes = [
			[4, 4],
			[3, 3],
			[3, 2],
			[2, 2],
			[1, 3]
		];
		
		inst.cells = [];
		for(var i = 0; i < inst.MaxX; i++) {
			inst.cells[i] = [];
			for(var j = 0; j < inst.MaxY; j++) {
				inst.cells[i][j] = false;
			}
		}
		
		inst.HBasis = this.controls.BaseColorH.val()*1;
		inst.HVar = this.controls.VarColorH.val()*1;
		inst.SBasis = this.controls.BaseColorS.val()*1;
		inst.SVar = this.controls.VarColorS.val()*1;
		inst.VBasis = this.controls.BaseColorV.val()*1;
		inst.VVar = this.controls.VarColorV.val()*1;
	},
	Description: "Generates random floors designed to look like flagstone."
});

RegisterGenerator(NewGen, GenDisplayName, GenName, GenCategory);