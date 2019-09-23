class SBG_SlowIterator {
	constructor(gCbStep, {
		RunSpeed = 50,
		MaxExecTime = 40,
		Batching = 1,
		OnStageSetup = function() {},
		OnStagePause = function() {},
		OnStageFinalize = function() {}
	} = {}) {
		this.runSpeed = RunSpeed;
		this.maxExecTime = MaxExecTime;
		this.batching = Batching;
		this.genSetupVars = OnStageSetup;
		this.genStep = gCbStep;
		this.genPause = OnStagePause;
		this.genFinalize = OnStageFinalize;
	}
	
	apply(inst, promise) {
		this.genSetupVars(inst, promise);
		this._genSetupDone(inst, promise);
	}
	_genSetupDone(inst, promise) {
		if(typeof inst.abort !== "undefined") {
			promise.resolve(inst);
			return;
		}
		
		inst._stageStepper = setInterval((function(self){
			return function() {
				var tAccum = 0;
				while(tAccum < self.maxExecTime) {
					var t0 = window.performance.now();
					for(var i = 0; i < self.batching; i++) {
						if(inst._brickCountCap > -1 && inst.brickBuffer.length > inst._brickCountCap) {
							inst.abort = "Too many bricks.";
							while(inst.brickBuffer.length > inst._brickCountCap) {
								inst.brickBuffer.pop();
							}
							//inst.abortFatal = true;
						} else if(inst._extCancel) {
							inst.abort = "Cancelled by external source.";
							inst.abortFatal = inst._extCancelFatal == true;
						}
						
						if(typeof inst.abort !== "undefined" || self.genStep(inst)) {
							self._genFinalize(inst, promise);
							return;
						}
					}
					var t1 = window.performance.now();
					tAccum += (t1 - t0);
				}
				var ptex = self.genPause(inst);
				if(typeof ptex !== "undefined" && typeof inst._ticket !== "undefined") inst._ticket.Text = ptex;
			}
		})(this), this.runSpeed);
	}
	
	_genFinalize(inst, promise) {
		clearInterval(inst._stageStepper);
		this.genFinalize(inst);
		promise.resolve(inst);
	}
}

class StagedBrickGenerator {
	constructor(gName, gStages, {
		Controls = {},
		OnSetup = function() {},
		OnFinalize = function() {},
		StatusText = gName,
		Description = "Generates bricks.",
		StatusContainer
	} = {}) {
		this.name = gName;
		this.description = Description;
		this.controls = Controls;
		this.genSetupVars = OnSetup;
		this.genStages = gStages;
		this.genFinalize = OnFinalize;
		this.statusText = StatusText;
		this._instances = [];
	}
	
	applyControls(jqElem) {
		for(var i in this.controls) {
			if(!this.controls.hasOwnProperty(i) || typeof this.controls[i].append === "undefined") continue;
			jqElem.append(this.controls[i]);
		}
	}
	removeControls(jqElem) {
		for(var i in this.controls) {
			if(!this.controls.hasOwnProperty(i) || typeof this.controls[i].detach === "undefined") continue;
			this.controls[i].detach();
		}
	}
	
	generate({
		BrickCountCap = -1,
		StatusContainer
	} = {}, PassParams = {}) {
		var inst = {brickBuffer: [], _brickCountCap: BrickCountCap, _statusContainer: StatusContainer, callerParams: PassParams};

		this._instances.push(inst);
		if(typeof StatusContainer !== "undefined") {
			inst._ticket = new StatusTicket(StatusContainer, {initText: this.statusText});
			inst._statusEnabled = true;
		}
		
		inst._promise = $.Deferred()
		inst._promise._genInst = inst;
	
		inst._stageIndex = -1;
	
		this.genSetupVars(inst);
		this._genSetupDone(inst);
		
		return inst._promise;
	}
	_genSetupDone(inst, args) {
		if(typeof inst.abort !== "undefined") {
			if(inst._statusEnabled)
				//entire-generator setup errors are always fatal
				new StatusTicket(inst._statusContainer, {
					initText: "Setup FATAL ERROR: " + inst.abort,
					bgColor: "ff0000",
					iconClass: "fatalX",
					timeout: 15000
				});
			this._genFinalize(inst);
			return;
		}
		
		var self = this;
		
		inst._stageIndex = 0;
		inst._stagePromises = [];
		for(var i = 0; i < this.genStages.length; i++) {
			inst._stagePromises[i] = $.Deferred();
		}
		for(var i = 0; i < this.genStages.length-1; i++) {
			$.when(inst._stagePromises[i]).done(function(sinst) {
				sinst._stageIndex++;
				
				if(typeof sinst.abort !== "undefined") {
					if(sinst._statusEnabled)
						new StatusTicket(sinst._statusContainer, {
							initText: "Stage " + sinst._stageIndex + (sinst.abortFatal ? " FATAL ERROR: \"" : " error: \"") + sinst.abort + "\"",
							bgColor: sinst.abortFatal ? "ff0000" : "aa3333",
							iconClass: sinst.abortFatal ? "fatalX" : "warntri",
							timeout: 15000
						});
					if(sinst.abortFatal == true) {
						self._genFinalize(sinst);
						return;
					}
				}
				//if(inst._extCancelFatal) {  //TODO
					
				//}
				self.genStages[sinst._stageIndex].apply(sinst, sinst._stagePromises[sinst._stageIndex]);
			});
		}
		$.when(inst._stagePromises[this.genStages.length-1]).done(function() {
			self.genFinalize(inst);
			self._genFinalize(inst);
		});
		this.genStages[0].apply(inst, inst._stagePromises[0]);
	}
	
	_genFinalize(inst) {
		if(inst._statusEnabled)
			inst._ticket.close();
		inst._promise.resolve(inst.brickBuffer); //TODO: consider resolving with undefined or an error code if abortFatal?
		var ioinst = this._instances.indexOf(inst);
		if(ioinst > -1)
			this._instances.splice(ioinst, 1);
		else {
			throw(this.name + " StagedBrickGenerator lost a reference to an instance somehow! Where did it go??");
		}
	}
}