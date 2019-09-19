//EXAMPLE brick generator that doubles as a stress test. Places bajillions of bricks with random color/size all over the place.
//Once you've created a generator, you'll need to include it as a script tag at the bottom of index.html.

//We'll be using this a lot.
var GenName = "StressTest";

//First argument is the display name of the generator; should be unique as we're also using it as an object index.
//Second argument is a list of main generation objects that will have their 'apply' functions called in order. The object MUST contain a function named 'apply'. This will always be passed two arguments: "inst" is the current generator instance (keeps track of internal variables), "promise" is a $.Deferred() passed by the StagedBrickGenerator.
//Once generation is done, the apply function should call promise.resolve(inst). Passing the instance variable to promise.resolve() is IMPORTANT! SBG can't keep track of it on its own.
Generators[GenName] = new StagedBrickGenerator(GenName, [new SBG_SlowIterator(function(inst) {
	//SBG_SlowIterator is a wrapper around the SBG Stage functionality described above. It executes an iterator function repeatedly over time, and resolves the promise passed by SBG once the iterator returns TRUE.
	
	//Some math on internal variables created during the OnSetup callback:
	var nSzX = THREE.Math.randInt(inst.RndMin, inst.RndMax);
	var nSzY = THREE.Math.randInt(inst.RndMin, inst.RndMax);
	var nSzZ = THREE.Math.randInt(inst.RndMin, inst.RndMax);
	
	var nX = THREE.Math.randInt(-inst.Scatter, inst.Scatter);
	var nY = THREE.Math.randInt(-inst.Scatter, inst.Scatter);
	var nZ = THREE.Math.randInt(-inst.Scatter, inst.Scatter);
	
	//util.js: Mod is the modulus function. The JS % operator is actually signed remainder -- works very differently when negative numbers are involved! In this case, % would loop hue from -1 to -0 while negative, and 0 to 1 while positive; instead of 0 to 1 for all numbers as desired here
	var ncH = Mod(inst.HBasis + THREE.Math.randFloat(-inst.HVar/2, inst.HVar/2), 1);
	var ncS = THREE.Math.clamp(inst.SBasis + THREE.Math.randFloat(-inst.SVar/2, inst.SVar/2), 0, 1);
	var ncV = THREE.Math.clamp(inst.VBasis + THREE.Math.randFloat(-inst.VVar/2, inst.VVar/2), 0, 1);
	//lib/colour.js: converts a 0-1 HSV color to a 0-255 RGB color.
	var ncRgb = hsvToRgb(ncH, ncS, ncV);
	//util.js: ColorQuantize takes a 0-1 RGBA color and a list of other such colors, and returns the closest color in the list to the single color. Uses the Delta E 2000 algorithm (very good at judging how similar two colors look to a human).
	//brsColorsetRGB is the default Brickadia colorset. Also defined: blsColorsetRGB for the Blockland colorset.
	var ncq = ColorQuantize([ncRgb[0]/255,ncRgb[1]/255,ncRgb[2]/255, 1.0], brsColorsetRGB).Color;
	var newColor = new THREE.Color(ncq[0], ncq[1], ncq[2]);
	
	//Here's the important part: generate an InternalBrick object...
	var brk = new InternalBrick(
		new THREE.Vector3(nSzX, nSzY, nSzZ), //Size
		new THREE.Vector3(nX, nY, nZ), //Position
		0, //Rotation index (0, 1, 2, 3)
		newColor, //Color (must be a THREEjs color object or the preview renderer gets cranky)
		0, //Material index (for now, only 0 is parsed by save/load)
		{
			//Strings used to identify brick type during save/load:
			InternalName: "Basic", //Internal names only specify the brick's model/behavior, and rely on other internal variables for size
			BlocklandName: ToBlsBasicName(nSzX, nSzY, nSzZ).Name, //Blockland names have several mapper functions from brick size
			BlocklandRotation: ToBlsBasicName(nSzX, nSzY, nSzZ).Rotation, //Internal rotation added to BLS bricks because of namespace mapping (no 2x1f, only 1x2f)
			BrickadiaName: "" //TODO: need a mapper for these
		}
	);
	//...and push it to the internal brick buffer. This is what will be passed to whatever called StagedBrickGenerator.generate() once everything's done.
	//AutoOffset converts the brick from corner positioning (easier to keep track of during generation) to center positioning (required by renderer and both save formats), and returns the brick object.
	inst.brickBuffer.push(brk.AutoOffset());
	
	//This is another OnSetup variable; you can use anything you want as long as it returns true when generation is complete.
	inst.Iter ++;
	return inst.Iter == inst.MaxIter;
}, { //The following are all optional parameters provided for the SBG_SlowIterator.
	RunSpeed: 50, //Milliseconds between batches of calls to the above function. Defaults to 50.
	MaxExecTime: 40, //How many milliseconds a batch of calls is allowed to last for. Any longer and the SBG will pause to let UI take a breath. True JS multithreading when :( Defaults to 40.
	OnStagePause: function(inst) {
		//This function is called after every batch of the main generator function (ROUGHLY every RunSpeed milliseconds). Defaults to an empty function.
		//The return value, if not empty, will be used to update the status display for this instance (if it has one).
		return "StressTesting... " + Math.floor(inst.Iter/inst.MaxIter*100) + "%";
	}
	//OnStageSetup: function(inst): called before the first call to the iterator, but after the SBG's own setup or the finalization of a previous stage. Defaults to an empty function.
	//OnStageFinalize: function(inst, errorCode): called after the last call to the iterator, but before the SBG's own finalization or the setup of a subsequent stage. Defaults to an empty function. If errorCode is defined, it will have one of these values (you'll have to handle throwing these errors yourself if you define a custom stage handler instead of using SBG_SlowIterator):
	//	TooManyBricks: Generation was stopped early because buffer length exceeded a BrickCountCap flag set by the caller.
	//	UserCancel: Generation was stopped by an external source using someBrickGenerator.stop(promise).
	//	GenCancel: The generator code threw a pseudo-exception by setting inst.abort to any non-undefined value.
})], { //The following are all optional parameters provided for the StagedBrickGenerator.
	StatusText: "StressTesting...", //Initial text that will appear in the status popup, and stay there if you don't change it with SBG_SlowIterator's onStagePause (or manually). Defaults to the generator's name.
	Description: "I generate lots of bricks real damn fast.", //Unused in this app (for now). Defaults to "I generate bricks."
	Controls: { //A list of JQuery element handles that, in this app, will be appended to the Generator Options UI area when this generator is selected in the menu. When another generator is selected, these will be detached before new options are added. Defaults to nothing.
		BrickCountLabel: $("<span class='opt-half'>Brick count (10^n):</span>"),
		BrickCount: $("<input>", {"type": "number", "min": 0, "max": 6, "value": 4, "step": 0.1, "class": "opt-half opt-input"}),
		ScatterLabel: $("<span class='opt-half'>Scatter radius (10^n):</span>"),
		Scatter: $("<input>", {"type": "number", "min": 1, "max": 6, "value": 2, "step": 0.1, "class": "opt-half opt-input"}),
		BrickLabel: $("<span class='opt-half'>Brick size (min, max):</span>"),
		MinBrick: $("<input>", {"type": "number", "step": 1, "class": "opt-quarter opt-input"}),
		MaxBrick: $("<input>", {"type": "number", "step": 1, "class": "opt-quarter opt-input"}),
		ColorHLabel: $("<span class='opt-half'>Hue (basis, var):</span>"),
		BaseColorH: $("<input>", {"type": "number", "min": 0, "max": 1, "value": 0.5, "step": 0.01, "class": "opt-quarter opt-input"}),
		VarColorH: $("<input>", {"type": "number", "min": 0, "max": 1, "value": 0.5, "step": 0.01, "class": "opt-quarter opt-input"}),
		ColorSLabel: $("<span class='opt-half'>Sat (basis, var):</span>"),
		BaseColorS: $("<input>", {"type": "number", "min": 0, "max": 1, "value": 0.5, "step": 0.01, "class": "opt-quarter opt-input"}),
		VarColorS: $("<input>", {"type": "number", "min": 0, "max": 1, "value": 0.5, "step": 0.01, "class": "opt-quarter opt-input"}),
		ColorVLabel: $("<span class='opt-half'>Val (basis, var):</span>"),
		BaseColorV: $("<input>", {"type": "number", "min": 0, "max": 1, "value": 0.5, "step": 0.01, "class": "opt-quarter opt-input"}),
		VarColorV: $("<input>", {"type": "number", "min": 0, "max": 1, "value": 0.5, "step": 0.01, "class": "opt-quarter opt-input"})
	},
	OnSetup: function(inst) {
		//This function is called before the first call to the first stage's generator function. Defaults to an empty function.
		//Use it to set up custom internal variables (on the 'inst' object which is unique to this generation call) and read values from controls (controls are NOT guaranteed safe during async generation, but -- in this app -- the main action buttons will be disabled to avoid conflicts).
		inst.Iter = 0;
		inst.MaxIter = Math.pow(10, this.controls.BrickCount.val()*1);

		inst.Scatter = Math.pow(10, this.controls.Scatter.val()*1);

		inst.RndMin = this.controls.MinBrick.val()*1;
		inst.RndMax = this.controls.MaxBrick.val()*1;

		inst.HBasis = this.controls.BaseColorH.val()*1;
		inst.HVar = this.controls.VarColorH.val()*1;
		inst.SBasis = this.controls.BaseColorS.val()*1;
		inst.SVar = this.controls.VarColorS.val()*1;
		inst.VBasis = this.controls.BaseColorV.val()*1;
		inst.VVar = this.controls.VarColorV.val()*1;
	}
	//OnFinalize: function(inst){}: Called after the last stage of generation finalizes, but before the result is passed to the caller.
	//TODO: pass error codes through to here once fatal (stop all stages) errors are implemented
});

//util.js: links two of the controls of this generator together into a bounded min/max pair.
//1st and 2nd arguments are jQuery handles of number/range inputs to link.
//3rd and 4th arguments are the min/max values to clamp the entire system to.
//5th and 6th arguments are the default values to set the elements to (assumed sane, be careful).
//Optional 7th argument creates a margin (values must be at least that far apart) -- default is 0 (no margin).
LinkNumInputs(Generators[GenName].controls.MinBrick, Generators[GenName].controls.MaxBrick, 1, 10, 1, 6);



//In this app, StagedBrickGenerators are stored in a global array used by the web app -- see generator-master.js. In other implementations, you just need to find some way to call $.when(someBrickGenerator.generate()).done(function(brickBuffer){...}) or similar.
//TODO: To perform synchronous generation, use someBrickGenerator.generateSync(function(brickBuffer){}). This was an option in normal non-staged BrickGenerators which included the SlowIterator functionality by default (now deprecated and removed); StagedBrickGenerators do not have this yet.

//Add this generator to the main list. Complicated because of IE compatibility, even though a lot of other things in this app probably aren't IE-compatible /shrug
var o = new Option(GenName, GenName);
$(o).html(GenName);
$("#generator-type").append(o);
Generators[GenName].OptionElement = o;