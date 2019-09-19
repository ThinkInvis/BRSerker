class SBG_SlowIterator {
	constructor(gCbStep, {
		RunSpeed = 50,
		MaxExecTime = 40,
		OnStageSetup = function() {},
		OnStagePause = function() {},
		OnStageFinalize = function() {}
	} = {}) {
		this.runSpeed = RunSpeed;
		this.maxExecTime = MaxExecTime;
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
		var masterEstopMsg;
		if(typeof inst._stageIndex === "undefined") masterEstopMsg = "Emergency stop! ";
		else masterEstopMsg = "Stage " + inst._stageIndex + " e-stop! ";
		
		if(typeof inst.abort !== "undefined") {
			promise.resolve();
			if(inst._statusEnabled)
				new StatusTicket(inst._statusContainer, {
					initText: masterEstopMsg + "Internal: " + inst.abort,
					bgColor: "ff0000",
					iconClass: "warntri",
					timeout: 15000
				});
			return;
		}
		
		inst._stageStepper = setInterval((function(self){
			return function() {
				var tAccum = 0;
				while(tAccum < self.maxExecTime) {
					var t0 = window.performance.now();
					var masterEstopMsg;
					if(typeof inst._stageIndex === "undefined") masterEstopMsg = "Emergency stop! ";
					else masterEstopMsg = "Stage " + inst._stageIndex + " e-stop! ";
					if(inst._brickCountCap > -1 && inst.brickBuffer.length > inst._brickCountCap) {
						if(inst._statusEnabled)
							new StatusTicket(inst._statusContainer, {
								initText: masterEstopMsg + "Too many bricks.",
								bgColor: "ff0000",
								iconClass: "warntri",
								timeout: 15000
							});
						self._genFinalize(inst, promise, "TooManyBricks");
						return;
					} else if(inst._extCancel) {
						if(inst._statusEnabled)
							new StatusTicket(inst._statusContainer, {
								initText: masterEstopMsg + "Cancelled by external source.",
								bgColor: "ff0000",
								iconClass: "warntri",
								timeout: 15000
							});
						self._genFinalize(inst, promise, "UserCancel");
						return;
					} else if(typeof inst.abort !== "undefined") {
						if(inst._statusEnabled)
							new StatusTicket(inst._statusContainer, {
								initText: masterEstopMsg + "e-stop! Internal: " + inst.abort,
								bgColor: "ff0000",
								iconClass: "warntri",
								timeout: 15000
							});
						self._genFinalize(inst, promise, "GenCancel");
						return;
					} else if(self.genStep(inst)) {
						self._genFinalize(inst, promise);
						return;
					}
					var t1 = window.performance.now();
					tAccum += (t1 - t0);
				}
				var ptex = self.genPause(inst);
				if(typeof ptex !== "undefined" && typeof inst._ticket !== "undefined") inst._ticket.Text = ptex;
			}
		})(this), this.runSpeed);
	}
	
	_genFinalize(inst, promise, errorCode) {
		clearInterval(inst._stageStepper);
		this.genFinalize(inst, errorCode);
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
			if(!this.controls.hasOwnProperty(i)) continue;
			jqElem.append(this.controls[i]);
		}
	}
	removeControls(jqElem) {
		for(var i in this.controls) {
			if(!this.controls.hasOwnProperty(i)) continue;
			this.controls[i].detach();
		}
	}
	
	generate({
		BrickCountCap = -1,
		StatusContainer
	} = {}) {
		var inst = {brickBuffer: [], _brickCountCap: BrickCountCap, _statusContainer: StatusContainer};

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
		
		if(typeof inst.abort !== "undefined") {
			if(inst._statusEnabled)
				new StatusTicket(StatusContainer, {
					initText: "Setup failed! Internal: " + inst.abort,
					bgColor: "ff0000",
					iconClass: "warntri",
					timeout: 15000
				});
			this._genFinalize(inst);
		}
		return inst._promise;
	}
	_genSetupDone(inst, args) {
		if(typeof inst.abort !== "undefined")
			return;
		
		var self = this;
		
		inst._stageIndex = 0;
		inst._stagePromises = [];
		for(var i = 0; i < this.genStages.length; i++) {
			inst._stagePromises[i] = $.Deferred();
		}
		for(var i = 0; i < this.genStages.length-1; i++) {
			$.when(inst._stagePromises[i]).done(function(sinst) {
				sinst._stageIndex++;
				//if(inst.abortFatal || inst._extCancelFatal) {  //TODO
					
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
		inst._promise.resolve(inst.brickBuffer);
		var ioinst = this._instances.indexOf(inst);
		if(ioinst > -1)
			this._instances.splice(ioinst, 1);
		else {
			throw(this.name + " StagedBrickGenerator lost a reference to an instance somehow! Where did it go??");
		}
	}
}